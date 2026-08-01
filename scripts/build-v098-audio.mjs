// Builds the 0.9.8 loadout theme.
//
// Same rules as the 0.7.0 story audio (scripts/build-v070-story-audio.py): the
// master is synthesized here from oscillators, deterministic noise and shaped
// envelopes. No recording, no sample library, no third-party or model-generated
// source is involved, so the result is original project work with no licence to
// track. FFmpeg only transcodes the project's own WAV master to the MP3 and OGG
// the manifest serves.
//
// The piece: the loadout screen is the quiet minute before a sortie, inside the
// CRAWLER. It sits a fifth below the map theme's centre so moving between the
// two screens reads as descending into the hull rather than as a new track
// starting. A slow engine pulse underneath, a four-note figure that never quite
// resolves, and metal ticks from the bay. It is deliberately sparse: dialogue
// and UI cues play over it constantly.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Finds an encoder without making one a project dependency.
 *
 * This script runs once to author an asset, exactly like the 0.7.0 Python
 * generators, so FFmpeg is a tool the author supplies rather than something the
 * app or its build needs. @ffmpeg-installer is honoured when it happens to be
 * installed (`npm i --no-save @ffmpeg-installer/ffmpeg` is the easiest way to
 * get one), otherwise the PATH copy is used.
 */
async function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const installer = await import("@ffmpeg-installer/ffmpeg");
    const resolved = installer.default?.path ?? installer.path;
    if (resolved) return resolved;
  } catch { /* fall through to PATH */ }
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    throw new Error(
      "FFmpeg was not found. Set FFMPEG_PATH, put ffmpeg on PATH, or run "
      + "`npm install --no-save @ffmpeg-installer/ffmpeg`.",
    );
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const masterDir = path.join(root, "reference", "audio", "v098-generated", "masters");
const outputDir = path.join(root, "public", "audio", "v098", "music");
const provenancePath = path.join(root, "reference", "audio", "v098-generated", "provenance.json");

const SAMPLE_RATE = 44_100;
const SEED = 0x0980A7;

/** Deterministic noise: the same build always produces the same master. */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

const TAU = Math.PI * 2;

/**
 * A loop is only seamless if every layer completes a whole number of cycles
 * inside its length. Frequencies are therefore snapped to the loop grid rather
 * than used as written, which is what stops the join from clicking.
 */
function loopSafe(frequency, durationSeconds) {
  return Math.max(1, Math.round(frequency * durationSeconds)) / durationSeconds;
}

function build() {
  const duration = 8;
  const length = Math.round(SAMPLE_RATE * duration);
  const random = createRandom(SEED);
  const out = new Float32Array(length);

  // D minor, an octave and a fifth below the map theme's register.
  const root = 73.42;
  const bass = loopSafe(root, duration);
  const fifth = loopSafe(root * 1.5, duration);

  // Four-note figure. The last note is the flat seventh, so the phrase hangs
  // instead of landing - the sortie has not happened yet.
  const figure = [293.66, 349.23, 261.63, 466.16].map((hz) => loopSafe(hz, duration));

  let brownState = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const loopPhase = t / duration;
    let sample = 0;

    // Engine pulse: a slow breath under everything, two cycles per loop.
    const pulse = 0.5 + 0.5 * Math.sin(TAU * (2 / duration) * t - Math.PI / 2);
    sample += Math.sin(TAU * bass * t) * 0.20 * (0.55 + pulse * 0.45);
    sample += Math.sin(TAU * fifth * t) * 0.075 * (0.4 + pulse * 0.6);
    // A little second harmonic keeps the bass audible on phone speakers, which
    // reproduce almost nothing at 73Hz.
    sample += Math.sin(TAU * loopSafe(root * 2, duration) * t) * 0.05;

    // The figure: one note every two seconds, each plucked and left to ring.
    for (let note = 0; note < figure.length; note += 1) {
      const start = note * 2;
      const age = t - start;
      if (age < 0 || age > 2.6) continue;
      const attack = Math.min(1, age / 0.012);
      const decay = Math.exp(-age * 1.9);
      const voice = Math.sin(TAU * figure[note] * t) * 0.55
        + Math.sin(TAU * figure[note] * 2 * t) * 0.16
        + Math.sin(TAU * figure[note] * 3 * t) * 0.05;
      sample += voice * attack * decay * 0.115;
    }

    // Bay ambience: filtered brown noise, the room the crew is standing in.
    brownState = (brownState + random() * 0.035) * 0.994;
    sample += brownState * 0.5;

    // Metal ticks: someone working on the racks. Sparse and off the beat so the
    // loop does not sound like a metronome.
    for (const tick of [0.85, 2.55, 3.9, 5.35, 6.7, 7.45]) {
      const age = t - tick;
      if (age < 0 || age > 0.09) continue;
      const ring = Math.sin(TAU * loopSafe(2140, duration) * age)
        + Math.sin(TAU * loopSafe(3170, duration) * age) * 0.5;
      sample += ring * Math.exp(-age * 62) * 0.026;
    }

    // Loop-edge safety: a short equal-power taper on both ends, cross-matched so
    // the seam is inaudible even if a decoder trims a frame.
    const edge = 0.06;
    let gain = 1;
    if (loopPhase < edge / duration) gain = Math.sin((loopPhase * duration / edge) * (Math.PI / 2));
    else if (loopPhase > 1 - edge / duration) {
      gain = Math.sin(((1 - loopPhase) * duration / edge) * (Math.PI / 2));
    }

    out[i] = sample * gain;
  }

  // Normalise with headroom. BGM sits under dialogue, SE and voice, so this is
  // deliberately quiet: -14 dBFS peak rather than the usual -1.
  let peak = 0;
  for (const value of out) peak = Math.max(peak, Math.abs(value));
  const target = 10 ** (-14 / 20);
  const scale = peak > 0 ? target / peak : 1;
  for (let i = 0; i < out.length; i += 1) out[i] *= scale;
  return out;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const trackId = "music-v098-loadout";
await mkdir(masterDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

const wav = toWav(build());
const masterPath = path.join(masterDir, `${trackId}.wav`);
await writeFile(masterPath, wav);

const ffmpegPath = await resolveFfmpeg();
const encode = (target, args) => {
  execFileSync(ffmpegPath, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", masterPath,
    ...args,
    target,
  ]);
};
const mp3Path = path.join(outputDir, `${trackId}.mp3`);
const oggPath = path.join(outputDir, `${trackId}.ogg`);
// Matches the bitrate the 0.7.0 tracks ship at, so one screen's music is not
// heavier than the rest of the pack. `-write_xing 0` keeps the MP3 free of the
// leading info frame that makes gapless looping unreliable.
encode(mp3Path, ["-codec:a", "libmp3lame", "-b:a", "112k", "-write_xing", "0"]);
encode(oggPath, ["-codec:a", "libvorbis", "-qscale:a", "3"]);

const digest = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
const provenance = {
  version: "0.9.8",
  issue: 131,
  method: "Synthesized in scripts/build-v098-audio.mjs from oscillators, deterministic "
    + "noise and shaped envelopes. No recording, sample library, third-party asset or "
    + "generative model is involved. FFmpeg only transcodes the project's own WAV master.",
  licence: "Original work of this project. No third-party rights apply.",
  seed: SEED,
  sampleRate: SAMPLE_RATE,
  tracks: [{
    id: trackId,
    scene: "loadout",
    durationSeconds: 8,
    loop: true,
    master: path.relative(root, masterPath).replace(/\\/g, "/"),
    mp3: { path: path.relative(root, mp3Path).replace(/\\/g, "/"), sha256: await digest(mp3Path) },
    ogg: { path: path.relative(root, oggPath).replace(/\\/g, "/"), sha256: await digest(oggPath) },
  }],
};
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

const { statSync } = await import("node:fs");
console.log(JSON.stringify({
  master: `${(wav.length / 1024).toFixed(0)}KB`,
  mp3: `${(statSync(mp3Path).size / 1024).toFixed(0)}KB`,
  ogg: `${(statSync(oggPath).size / 1024).toFixed(0)}KB`,
  provenance: path.relative(root, provenancePath).replace(/\\/g, "/"),
}, null, 2));
