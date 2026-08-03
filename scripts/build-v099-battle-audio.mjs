// Generate the Version 0.9.9.0 PR2 battle audio pack.
//
// Every master is synthesized from project-authored oscillators and envelopes.
// FFmpeg only encodes the resulting project-original WAV to the single MP3
// source that the v0.9.9.0 manifest serves. No sample library, Web material,
// voice model, or third-party recording is used.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { V099_BATTLE_AUDIO_ASSET_SPECS, V099_PHYSICAL_AUDIO_ASSET_COUNT } from "../app/battleAudioContracts.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRootArg = process.argv.find((argument) => argument.startsWith("--output-root="));
const outputRoot = path.resolve(repoRoot, outputRootArg ? outputRootArg.slice("--output-root=".length) : ".");
const sampleRate = 44_100;
const seed = 0x0990BA77;
const targetMinBytes = 3.97 * 1024 * 1024;
const targetMaxBytes = 6.45 * 1024 * 1024;
const tau = Math.PI * 2;

function createRandom(inputSeed) {
  let state = inputSeed >>> 0;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17; state >>>= 0;
    state ^= state << 5; state >>>= 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

function loopSafe(frequency, duration) {
  return Math.max(1, Math.round(frequency * duration)) / duration;
}

function envelope(age, duration) {
  if (age <= 0 || age >= duration) return 0;
  const attack = Math.min(1, age / Math.min(.025, duration * .16));
  const release = Math.min(1, (duration - age) / Math.min(.09, duration * .24));
  return Math.min(attack, release);
}

function cueDuration(spec) {
  if (spec.category === "bgm") return 82;
  if (spec.id.startsWith("support-pod-inbound")) return .85;
  if (spec.id.startsWith("support-pod-landing")) return .65;
  if (spec.id.startsWith("support-pod-activation")) return .48;
  if (spec.id.startsWith("support-pod-complete")) return .38;
  if (spec.id.startsWith("ability-ready")) return .26;
  if (spec.id.includes("activate")) return .78;
  return .52;
}

function synthesise(spec, index) {
  const duration = cueDuration(spec);
  const samples = new Float32Array(Math.round(sampleRate * duration));
  const random = createRandom(seed + index * 0x9e3779b9);
  const base = 58 + (index % 9) * 7;
  const carrier = loopSafe(base, duration);
  const upper = loopSafe(base * (spec.category === "bgm" ? 3 : 6), duration);
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    let value = 0;
    if (spec.category === "bgm") {
      const beat = .5 + .5 * Math.sin(tau * loopSafe(2 / 2.4, duration) * time);
      const pulse = .5 + .5 * Math.sin(tau * loopSafe(1 / 4.8, duration) * time - Math.PI / 2);
      value += Math.sin(tau * carrier * time) * (.16 + beat * .07);
      value += Math.sin(tau * carrier * 2 * time) * (.07 + pulse * .03);
      value += Math.sin(tau * upper * time) * .035;
      value += Math.sin(tau * loopSafe(base * 5, duration) * time) * .026;
      value += Math.sin(tau * loopSafe(220 + (index % 5) * 27, duration) * time) * .045;
      value += Math.sin(tau * loopSafe(18 + index, duration) * time) * .018;
    } else {
      const age = time;
      const shaped = envelope(age, duration);
      const pitch = carrier + (1 - Math.min(1, age / duration)) * base * (2 + (index % 3));
      value += Math.sin(tau * loopSafe(pitch, duration) * age) * .50 * shaped;
      value += Math.sin(tau * loopSafe(upper, duration) * age) * .22 * shaped;
      value += Math.sin(tau * loopSafe(base * 13, duration) * age) * .10 * shaped * Math.exp(-age * 10);
      value += random() * .012 * shaped * Math.exp(-age * 8);
      if (spec.id.includes("landing") || spec.id.includes("impact") || spec.id.includes("groundbreak")) {
        value += Math.sin(tau * loopSafe(74, duration) * age) * .24 * shaped * Math.exp(-age * 4.5);
      }
      if (spec.id.includes("ready")) {
        value += Math.sin(tau * loopSafe(880 + index * 18, duration) * age) * .10 * shaped;
      }
    }
    samples[sampleIndex] = value;
  }
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const targetPeak = spec.category === "bgm" ? 10 ** (-14 / 20) : 10 ** (-7 / 20);
  const scale = peak > 0 ? targetPeak / peak : 1;
  for (let indexValue = 0; indexValue < samples.length; indexValue += 1) samples[indexValue] *= scale;
  return { samples, duration };
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    data.writeInt16LE(Math.round(value * 32767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const installer = await import("@ffmpeg-installer/ffmpeg");
    const resolved = installer.default?.path ?? installer.path;
    if (resolved) return resolved;
  } catch { /* try PATH below */ }
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    throw new Error("FFmpeg is required to encode the project-original masters.");
  }
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

const ffmpegPath = await resolveFfmpeg();
if (V099_BATTLE_AUDIO_ASSET_SPECS.length !== V099_PHYSICAL_AUDIO_ASSET_COUNT) {
  throw new Error(`Expected ${V099_PHYSICAL_AUDIO_ASSET_COUNT} v0.9.9.0 assets, got ${V099_BATTLE_AUDIO_ASSET_SPECS.length}.`);
}

const masterDir = path.join(outputRoot, "reference", "audio", "v099-generated", "masters");
const publicRoot = path.join(outputRoot, "public", "audio", "v099");
await mkdir(masterDir, { recursive: true });
await mkdir(path.join(publicRoot, "music"), { recursive: true });
await mkdir(path.join(publicRoot, "sfx"), { recursive: true });

const generated = [];
for (const [index, spec] of V099_BATTLE_AUDIO_ASSET_SPECS.entries()) {
  const folder = spec.folder;
  const masterPath = path.join(masterDir, `${spec.id}.wav`);
  const outputPath = path.join(publicRoot, folder, `${spec.id}.mp3`);
  const master = synthesise(spec, index);
  const masterBytes = toWav(master.samples);
  await writeFile(masterPath, masterBytes);
  execFileSync(ffmpegPath, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", masterPath,
    "-codec:a", "libmp3lame",
    "-b:a", spec.category === "bgm" ? "160k" : "128k",
    "-write_xing", "0",
    outputPath,
  ]);
  const outputStat = await stat(outputPath);
  generated.push({
    id: spec.id,
    category: spec.category,
    folder,
    durationSeconds: master.duration,
    loop: spec.loop,
    master: path.relative(outputRoot, masterPath).replace(/\\/g, "/"),
    masterSha256: await sha256(masterPath),
    output: path.relative(outputRoot, outputPath).replace(/\\/g, "/"),
    outputSha256: await sha256(outputPath),
    outputBytes: outputStat.size,
    addedBytes: outputStat.size,
    source: "project-original",
    creator: "SUSANO-OOO/Zombieee project",
    license: "Original project work; no third-party rights apply.",
    commercialUse: true,
    modification: true,
    redistribution: true,
    producerApproval: "PR2 design approved; physical speaker audition pending",
  });
}

const distinctBytes = generated.reduce((total, asset) => total + asset.outputBytes, 0);
if (distinctBytes < targetMinBytes || distinctBytes > targetMaxBytes) {
  throw new Error(`v0.9.9.0 distinct audio bytes ${distinctBytes} is outside ${targetMinBytes}-${targetMaxBytes}.`);
}

const provenancePath = path.join(outputRoot, "reference", "audio", "v099-generated", "provenance.json");
await writeFile(provenancePath, `${JSON.stringify({
  version: "0.9.9.0",
  issue: 136,
  designRevision: "v2",
  designApproval: "Sol APPROVE",
  generator: "scripts/build-v099-battle-audio.mjs",
  source: "project-original",
  creator: "SUSANO-OOO/Zombieee project",
  license: "Original project work; no third-party rights apply.",
  commercialUse: true,
  modification: true,
  redistribution: true,
  masterSampleRate: sampleRate,
  encoding: { format: "MP3", preferredSourceOnly: true, bgmBitrate: "160k", sfxBitrate: "128k", mime: "audio/mpeg" },
  physicalAssetCount: generated.length,
  distinctOutputBytes: distinctBytes,
  producerApproval: "PR2 design approved; physical speaker audition pending",
  assets: generated,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  physicalAssetCount: generated.length,
  distinctOutputBytes: distinctBytes,
  distinctOutputMiB: Number((distinctBytes / 1024 / 1024).toFixed(3)),
  provenance: path.relative(outputRoot, provenancePath).replace(/\\/g, "/"),
  ffmpeg: ffmpegPath,
}, null, 2));
