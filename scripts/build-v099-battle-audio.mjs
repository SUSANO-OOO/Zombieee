// Generate the Version 0.9.9.0 PR2 battle audio pack.
//
// The pack is project-original procedural audio. FFmpeg is a pinned encoder;
// it does not contribute samples or authored material. Runtime receives only
// the single versioned MP3 source. WAV masters and this recipe ledger remain
// outside public/ and outside the PWA distribution manifest.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

import { V099_BATTLE_AUDIO_ASSET_SPECS, V099_PHYSICAL_AUDIO_ASSET_COUNT } from "../app/battleAudioContracts.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRootArg = process.argv.find((argument) => argument.startsWith("--output-root="));
const outputRoot = path.resolve(repoRoot, outputRootArg ? outputRootArg.slice("--output-root=".length) : ".");
const mastersOnly = process.argv.includes("--masters-only");
const sampleRate = 44_100;
const seed = 0x0990BA77;
const targetMinBytes = 3.97 * 1024 * 1024;
const targetMaxBytes = 6.45 * 1024 * 1024;
const tau = Math.PI * 2;
const pinnedFfmpegPackage = "@ffmpeg-installer/ffmpeg@1.1.0";
const pinnedFfmpegPlatformPackage = "@ffmpeg-installer/win32-x64@4.1.0";
const pinnedFfmpegVersion = "N-92722-gf22fcd4483";

function createRandom(inputSeed) {
  let state = inputSeed >>> 0;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17; state >>>= 0;
    state ^= state << 5; state >>>= 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

const tone = (start, duration, f0, f1, gain, wave = "sine") => ({ type: "tone", start, duration, f0, f1, gain, wave });
const noise = (start, duration, gain, colorHz = 1200) => ({ type: "noise", start, duration, gain, colorHz });
const impact = (start, duration, frequency, gain) => ({ type: "impact", start, duration, f0: frequency, f1: frequency * .38, gain, wave: "sine" });

const SFX_RECIPES = Object.freeze({
  "ability-ready-melee": { duration: .31, family: "ready-melee", recipeId: "ready-double-steel", events: [impact(.01, .13, 310, .72), tone(.14, .14, 520, 690, .42, "triangle"), noise(.015, .08, .18, 2600)] },
  "ability-ready-ranged": { duration: .34, family: "ready-ranged", recipeId: "ready-three-lock-pings", events: [tone(.01, .11, 740, 920, .48), tone(.105, .10, 980, 1220, .44), tone(.20, .12, 1320, 1540, .38), noise(.02, .25, .08, 4800)] },
  "ability-ready-support": { duration: .42, family: "ready-support", recipeId: "ready-service-triad", events: [tone(.01, .36, 392, 392, .28, "sine"), tone(.05, .32, 494, 494, .24, "sine"), tone(.10, .27, 659, 659, .21, "sine"), tone(.0, .20, 210, 330, .14, "triangle")] },

  "ability-brawler-kiai-activate": { duration: .82, family: "activation-melee", recipeId: "brawler-chest-drive", events: [impact(.0, .32, 82, .78), noise(.04, .34, .32, 460), tone(.20, .50, 138, 212, .34, "square"), impact(.55, .20, 176, .38)] },
  "ability-scout-intercept-activate": { duration: .66, family: "activation-melee", recipeId: "scout-dash-latch", events: [noise(.0, .38, .34, 3600), tone(.02, .42, 260, 820, .42, "saw"), impact(.40, .17, 510, .46), tone(.47, .15, 920, 610, .25)] },
  "ability-ranger-precision-activate": { duration: .74, family: "activation-ranged", recipeId: "ranger-rangefinder-lock", events: [tone(.0, .25, 1100, 1500, .26, "square"), tone(.24, .22, 1600, 1600, .34, "sine"), noise(.30, .20, .12, 5200), impact(.50, .18, 270, .34)] },
  "ability-medic-emergency-activate": { duration: .96, family: "activation-support", recipeId: "medic-emergency-scan", events: [tone(.0, .68, 240, 520, .25, "triangle"), tone(.18, .55, 660, 880, .24), tone(.48, .40, 990, 1320, .21), noise(.02, .80, .09, 2800)] },
  "ability-brute-groundbreak-activate": { duration: .92, family: "activation-melee", recipeId: "brute-concrete-windup", events: [tone(.0, .62, 54, 92, .55, "saw"), noise(.05, .72, .30, 210), impact(.60, .26, 68, .72), impact(.72, .16, 118, .38)] },
  "ability-crazy-king-overdrive-activate": { duration: 1.08, family: "activation-ranged", recipeId: "king-chain-rev", events: [tone(.0, .98, 58, 168, .46, "saw"), tone(.04, .92, 116, 336, .28, "square"), noise(.0, 1.02, .27, 870), impact(.84, .19, 92, .42)] },
  "ability-kumaverson-iron-pan-activate": { duration: .93, family: "activation-support", recipeId: "kumaverson-pan-gong", events: [impact(.0, .72, 196, .66), tone(.0, .84, 392, 376, .36), tone(.01, .72, 680, 610, .19), noise(.0, .18, .24, 3200)] },
  "ability-babayaga-appraise-activate": { duration: .79, family: "activation-ranged", recipeId: "babayaga-suppressed-appraisal", events: [noise(.0, .20, .23, 4800), impact(.03, .17, 240, .36), tone(.18, .48, 1180, 760, .28, "square"), tone(.34, .36, 410, 620, .22)] },
  "ability-gunner-suppression-activate": { duration: .88, family: "activation-ranged", recipeId: "gunner-feed-rack", events: [impact(.0, .13, 210, .38), impact(.15, .11, 280, .34), impact(.29, .10, 360, .30), tone(.38, .43, 96, 148, .44, "saw"), noise(.0, .78, .17, 1900)] },
  "ability-guardian-shieldwall-activate": { duration: 1.02, family: "activation-support", recipeId: "guardian-shield-servo", events: [tone(.0, .78, 72, 164, .38, "square"), noise(.0, .70, .23, 720), impact(.61, .33, 132, .60), tone(.68, .27, 520, 390, .24)] },
  "ability-engineer-trap-arm-activate": { duration: .86, family: "activation-support", recipeId: "engineer-ratchet-arm", events: [impact(.0, .09, 440, .32), impact(.12, .08, 510, .31), impact(.23, .08, 590, .29), impact(.34, .09, 680, .28), tone(.42, .35, 190, 360, .27, "square"), noise(.0, .75, .10, 3600)] },
  "ability-zakimiya-molotov-activate": { duration: .94, family: "activation-ranged", recipeId: "zakimiya-bottle-ignite", events: [impact(.0, .18, 740, .30), noise(.10, .72, .25, 2300), tone(.16, .62, 170, 260, .32, "saw"), tone(.42, .44, 920, 620, .20)] },

  "ability-brawler-kiai-combo-impact": { duration: .46, family: "timeline-impact", recipeId: "brawler-five-hit-cluster", events: [impact(.0, .13, 104, .62), impact(.07, .12, 132, .55), impact(.15, .12, 91, .64), impact(.24, .14, 158, .50), noise(.0, .34, .24, 520)] },
  "ability-scout-intercept-impact": { duration: .37, family: "timeline-impact", recipeId: "scout-cross-slice", events: [noise(.0, .22, .31, 5100), tone(.01, .25, 940, 260, .36, "saw"), impact(.20, .13, 230, .48)] },
  "ability-ranger-precision-shot": { duration: .33, family: "timeline-shot", recipeId: "ranger-crack", events: [noise(.0, .10, .33, 6200), impact(.0, .15, 190, .46), tone(.04, .24, 1540, 760, .24)] },
  "ability-ranger-precision-impact": { duration: .41, family: "timeline-impact", recipeId: "ranger-armor-puncture", events: [impact(.0, .20, 146, .52), noise(.0, .25, .30, 3100), tone(.08, .28, 620, 220, .24, "square")] },
  "ability-medic-treatment": { duration: .72, family: "timeline-support", recipeId: "medic-injector-cycle", events: [impact(.0, .09, 820, .22), tone(.07, .56, 310, 740, .25), tone(.24, .42, 620, 980, .22), noise(.0, .60, .09, 4200)] },
  "ability-brute-groundbreak-impact": { duration: .64, family: "timeline-impact", recipeId: "brute-ground-fracture", events: [impact(.0, .42, 58, .80), noise(.0, .52, .42, 180), impact(.18, .30, 92, .52), impact(.34, .22, 140, .34)] },
  "ability-crazy-king-overdrive-active": { duration: .58, family: "timeline-active", recipeId: "king-chain-bite", events: [tone(.0, .52, 132, 210, .42, "saw"), tone(.0, .48, 264, 420, .26, "square"), noise(.0, .53, .31, 1100)] },
  "ability-kumaverson-stance": { duration: .68, family: "timeline-support", recipeId: "kumaverson-stance-lock", events: [impact(.0, .25, 184, .50), tone(.04, .58, 276, 238, .34), noise(.0, .20, .18, 2700)] },
  "ability-babayaga-appraise-shot": { duration: .29, family: "timeline-shot", recipeId: "babayaga-whisper-shot", events: [noise(.0, .12, .27, 6900), impact(.0, .12, 220, .34), tone(.03, .20, 1260, 820, .18)] },
  "ability-babayaga-appraise-mark": { duration: .61, family: "timeline-support", recipeId: "babayaga-mark-scan", events: [tone(.0, .52, 720, 420, .24, "square"), tone(.18, .37, 1080, 690, .21), noise(.0, .50, .08, 5200)] },
  "ability-gunner-suppression-muzzle": { duration: .24, family: "timeline-shot", recipeId: "gunner-muzzle-burst", events: [noise(.0, .08, .38, 6500), impact(.0, .10, 126, .43), tone(.025, .17, 980, 430, .18, "saw")] },
  "ability-gunner-suppression-impact": { duration: .36, family: "timeline-impact", recipeId: "gunner-impact-rattle", events: [impact(.0, .14, 176, .44), impact(.08, .13, 240, .34), noise(.0, .26, .27, 3400)] },
  "ability-guardian-shieldwall-hold": { duration: .76, family: "timeline-support", recipeId: "guardian-field-hum", events: [tone(.0, .70, 84, 84, .31, "square"), tone(.04, .65, 168, 155, .22), noise(.0, .64, .11, 880), impact(.52, .18, 210, .28)] },
  "ability-engineer-trap-spring": { duration: .43, family: "timeline-impact", recipeId: "engineer-spring-snap", events: [tone(.0, .20, 210, 980, .40, "square"), impact(.12, .19, 620, .35), noise(.0, .25, .25, 4700)] },
  "ability-zakimiya-molotov-throw": { duration: .48, family: "timeline-shot", recipeId: "zakimiya-glass-arc", events: [noise(.0, .36, .19, 2600), tone(.0, .39, 290, 630, .28, "triangle"), impact(.34, .10, 980, .20)] },
  "ability-zakimiya-molotov-impact": { duration: .55, family: "timeline-impact", recipeId: "zakimiya-glass-fire-impact", events: [impact(.0, .24, 116, .57), noise(.0, .48, .39, 1700), impact(.08, .17, 760, .24), impact(.19, .14, 1120, .18)] },
  "ability-zakimiya-molotov-burn": { duration: .83, family: "timeline-support", recipeId: "zakimiya-fire-bloom", events: [noise(.0, .78, .33, 2100), tone(.0, .70, 92, 146, .22, "saw"), tone(.26, .48, 470, 310, .15)] },
  "ability-musashi-fallback-cross": { duration: .57, family: "timeline-impact", recipeId: "musashi-dual-cross", events: [noise(.0, .23, .32, 5800), tone(.0, .31, 1080, 220, .38, "saw"), noise(.14, .24, .31, 5200), tone(.15, .32, 920, 180, .36, "saw"), impact(.34, .18, 170, .44)] },
});

const MUSIC_RECIPES = Object.freeze({
  "music-v099-pressure-surface": { recipeId: "junk-punk-surface-150", family: "pressure-surface", bpm: 150, bars: 44 },
  "music-v099-pressure-station": { recipeId: "rail-dnb-station-172", family: "pressure-station", bpm: 172, bars: 52 },
  "music-v099-boss": { recipeId: "industrial-taiko-boss-132", family: "boss", bpm: 132, bars: 40 },
});

function waveValue(wave, phase) {
  const cycle = phase / tau;
  if (wave === "saw") return 2 * (cycle - Math.floor(cycle + .5));
  if (wave === "square") return Math.sin(phase) >= 0 ? 1 : -1;
  if (wave === "triangle") return 2 * Math.abs(2 * (cycle - Math.floor(cycle + .5))) - 1;
  return Math.sin(phase);
}

function eventEnvelope(age, duration, type) {
  if (age < 0 || age >= duration) return 0;
  const attack = Math.min(1, age / Math.min(type === "noise" ? .008 : .018, duration * .2));
  const release = Math.min(1, (duration - age) / Math.min(type === "impact" ? .16 : .09, duration * .38));
  return Math.min(attack, release) * (type === "impact" ? Math.exp(-age * 5.2) : 1);
}

function synthesizeSfx(spec, recipe, index) {
  const samples = new Float32Array(Math.round(sampleRate * recipe.duration));
  const random = createRandom(seed + index * 0x9e3779b9);
  let lowNoise = 0;
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const white = random();
    lowNoise = lowNoise * .94 + white * .06;
    let value = 0;
    for (const event of recipe.events) {
      const age = time - event.start;
      const env = eventEnvelope(age, event.duration, event.type);
      if (env <= 0) continue;
      if (event.type === "noise") {
        const color = .62 + .38 * Math.sin(tau * event.colorHz * time);
        value += (white * .72 + lowNoise * .28) * color * event.gain * env;
        continue;
      }
      const sweep = (event.f1 - event.f0) / Math.max(.001, event.duration);
      const phase = tau * (event.f0 * age + .5 * sweep * age * age);
      value += waveValue(event.wave, phase) * event.gain * env;
      if (event.type === "impact") value += Math.sin(phase * 2.03) * event.gain * env * .18;
    }
    samples[sampleIndex] = Math.tanh(value * 1.15);
  }
  return finalizeSamples(samples, .54, false);
}

function beatHit(time, stepSeconds, pattern, decay) {
  const stepIndex = Math.floor(time / stepSeconds);
  if (!pattern.includes(stepIndex % 16)) return 0;
  const age = time - stepIndex * stepSeconds;
  return Math.exp(-age * decay);
}

function synthesizeMusic(spec, recipe, index) {
  const beat = 60 / recipe.bpm;
  const barSeconds = beat * 4;
  const duration = barSeconds * recipe.bars;
  const samples = new Float32Array(Math.round(sampleRate * duration));
  const random = createRandom(seed ^ (index * 0x85ebca6b));
  let lowNoise = 0;
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const stepSeconds = beat / 4;
    const step = Math.floor(time / stepSeconds) % 16;
    const bar = Math.floor(time / barSeconds);
    const stepAge = time % stepSeconds;
    const white = random();
    lowNoise = lowNoise * .965 + white * .035;
    let value = 0;
    if (spec.id === "music-v099-pressure-surface") {
      const kick = beatHit(time, stepSeconds, [0, 6, 8, 11], 24);
      const snare = beatHit(time, stepSeconds, [4, 12], 30);
      const hat = beatHit(time, stepSeconds, [2, 5, 7, 10, 14, 15], 58);
      const riff = [55, 55, 65.41, 55, 73.42, 65.41, 49, 55, 55, 82.41, 73.42, 65.41, 55, 49, 65.41, 55][step];
      const gate = stepAge < stepSeconds * .72 ? 1 : .22;
      value += Math.sin(tau * (48 + 34 * Math.exp(-stepAge * 18)) * stepAge) * kick * .68;
      value += (white * .55 + Math.sin(tau * 185 * stepAge) * .45) * snare * .31;
      value += white * hat * .10;
      value += waveValue("saw", tau * riff * time) * gate * .23;
      value += waveValue("square", tau * riff * 2 * time) * gate * .09;
      const metal = beatHit(time, stepSeconds, [3, 13], 20);
      value += Math.sin(tau * 1240 * stepAge) * metal * .13;
      if (bar % 8 === 7) value += Math.sin(tau * 92 * (time % barSeconds)) * beatHit(time, stepSeconds, [0, 4, 8, 12], 9) * .16;
    } else if (spec.id === "music-v099-pressure-station") {
      const kick = beatHit(time, stepSeconds, [0, 3, 7, 10], 28);
      const snare = beatHit(time, stepSeconds, [4, 12], 34);
      const ghost = beatHit(time, stepSeconds, [6, 14, 15], 44);
      const hat = beatHit(time, stepSeconds, [1, 2, 5, 9, 11, 13], 70);
      const bassNotes = [43.65, 43.65, 58.27, 43.65, 65.41, 58.27, 38.89, 43.65, 43.65, 77.78, 65.41, 58.27, 51.91, 43.65, 58.27, 38.89];
      const bass = bassNotes[step];
      const gate = stepAge < stepSeconds * .62 ? 1 : .12;
      value += Math.sin(tau * (45 + 38 * Math.exp(-stepAge * 24)) * stepAge) * kick * .58;
      value += (white * .68 + Math.sin(tau * 220 * stepAge) * .32) * snare * .30;
      value += white * ghost * .10 + white * hat * .085;
      value += (waveValue("saw", tau * bass * time) + waveValue("saw", tau * bass * 1.012 * time)) * gate * .14;
      const rail = beatHit(time, stepSeconds, [2, 8, 15], 25);
      value += Math.sin(tau * (1760 + (bar % 4) * 110) * stepAge) * rail * .15;
      value += Math.sin(tau * [523.25, 659.25, 783.99, 987.77][Math.floor(step / 4)] * time) * (step % 4 === 0 ? .10 : .035);
    } else {
      const kick = beatHit(time, stepSeconds, [0, 7, 8], 20);
      const snare = beatHit(time, stepSeconds, [4, 12], 26);
      const taiko = beatHit(time, stepSeconds, bar % 4 === 3 ? [0, 3, 6, 9, 12, 14] : [0, 8], 10);
      const riff = [41.20, 41.20, 46.25, 41.20, 55, 46.25, 36.71, 41.20, 41.20, 61.74, 55, 46.25, 41.20, 36.71, 46.25, 41.20][step];
      const gate = stepAge < stepSeconds * .78 ? 1 : .18;
      value += Math.sin(tau * (42 + 44 * Math.exp(-stepAge * 15)) * stepAge) * kick * .62;
      value += (white * .50 + lowNoise * .50) * snare * .29;
      value += Math.sin(tau * (72 + 25 * Math.exp(-stepAge * 8)) * stepAge) * taiko * .31;
      value += waveValue("square", tau * riff * time) * gate * .20;
      value += waveValue("saw", tau * riff * 2 * time) * gate * .13;
      const alarm = beatHit(time, stepSeconds, [5, 13], 7);
      value += Math.sin(tau * (bar % 2 ? 740 : 622) * time) * alarm * .12;
      const scrap = beatHit(time, stepSeconds, [3, 10, 15], 24);
      value += Math.sin(tau * (980 + (step % 3) * 270) * stepAge) * scrap * .11;
    }
    samples[sampleIndex] = Math.tanh(value * 1.28);
  }
  return { ...finalizeSamples(samples, .34, true), duration };
}

function finalizeSamples(samples, targetPeak, loop) {
  let mean = 0;
  for (const value of samples) mean += value;
  mean /= Math.max(1, samples.length);
  let peak = 0;
  const edgeSamples = Math.max(1, Math.round(sampleRate * (loop ? .008 : .004)));
  for (let index = 0; index < samples.length; index += 1) {
    let value = samples[index] - mean;
    const edge = Math.min(1, index / edgeSamples, (samples.length - 1 - index) / edgeSamples);
    value *= Math.max(0, edge);
    samples[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  const scale = peak > 0 ? targetPeak / peak : 1;
  for (let index = 0; index < samples.length; index += 1) samples[index] *= scale;
  return { samples, duration: samples.length / sampleRate };
}

function synthesize(spec, index) {
  if (spec.category === "bgm") {
    const recipe = MUSIC_RECIPES[spec.id];
    if (!recipe) throw new Error(`Missing music recipe for ${spec.id}`);
    return { ...synthesizeMusic(spec, recipe, index), recipe };
  }
  const recipe = SFX_RECIPES[spec.id];
  if (!recipe) throw new Error(`Missing SFX recipe for ${spec.id}`);
  return { ...synthesizeSfx(spec, recipe, index), recipe };
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    data.writeInt16LE(Math.round(value * 32767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function resolveFfmpeg() {
  const resolvedPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
  if (!resolvedPath) throw new Error(`${pinnedFfmpegPackage} did not resolve an executable path.`);
  const versionOutput = execFileSync(resolvedPath, ["-version"], { encoding: "utf8" });
  const versionLine = String(versionOutput).split(/\r?\n/, 1)[0];
  if (!versionLine.includes(pinnedFfmpegVersion)) {
    throw new Error(`Expected FFmpeg ${pinnedFfmpegVersion}, got ${versionLine}.`);
  }
  return { path: resolvedPath, versionLine };
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

const ffmpeg = mastersOnly ? null : resolveFfmpeg();
if (V099_BATTLE_AUDIO_ASSET_SPECS.length !== V099_PHYSICAL_AUDIO_ASSET_COUNT) {
  throw new Error(`Expected ${V099_PHYSICAL_AUDIO_ASSET_COUNT} v0.9.9.0 assets, got ${V099_BATTLE_AUDIO_ASSET_SPECS.length}.`);
}
if (Object.keys(MUSIC_RECIPES).length !== 3 || Object.keys(SFX_RECIPES).length !== 33) {
  throw new Error(`Recipe matrix must contain 3 music and 33 SFX recipes.`);
}

const masterDir = path.join(outputRoot, "reference", "audio", "v099-generated", "masters");
const publicRoot = path.join(outputRoot, "public", "audio", "v099");
await mkdir(masterDir, { recursive: true });
await mkdir(path.join(publicRoot, "music"), { recursive: true });
await mkdir(path.join(publicRoot, "sfx"), { recursive: true });

const generated = [];
for (const [index, spec] of V099_BATTLE_AUDIO_ASSET_SPECS.entries()) {
  const masterPath = path.join(masterDir, `${spec.id}.wav`);
  const outputPath = path.join(publicRoot, spec.folder, `${spec.id}.mp3`);
  const master = synthesize(spec, index);
  await writeFile(masterPath, toWav(master.samples));
  if (mastersOnly) {
    generated.push({
      id: spec.id,
      recipeId: master.recipe.recipeId,
      master: path.relative(outputRoot, masterPath).replace(/\\/g, "/"),
      masterSha256: await sha256(masterPath),
    });
    continue;
  }
  execFileSync(ffmpeg.path, [
    "-y", "-hide_banner", "-loglevel", "error", "-fflags", "+bitexact",
    "-i", masterPath, "-map_metadata", "-1", "-codec:a", "libmp3lame",
    "-b:a", spec.category === "bgm" ? "160k" : "128k", "-write_xing", "1",
    "-id3v2_version", "3", "-flags:a", "+bitexact", outputPath,
  ]);
  const outputStat = await stat(outputPath);
  generated.push({
    id: spec.id,
    category: spec.category,
    folder: spec.folder,
    roleFamily: master.recipe.family,
    recipeId: master.recipe.recipeId,
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
    candidateId: "v099-pr2-audio-r2",
    producerApproval: "Gate A pending",
  });
}

if (mastersOnly) {
  console.log(JSON.stringify({
    physicalAssetCount: generated.length,
    generatorSeed: `0x${seed.toString(16)}`,
    masterRoot: path.relative(outputRoot, masterDir).replace(/\\/g, "/"),
  }, null, 2));
  process.exit(0);
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
  generatorVersion: 2,
  designApproval: "Sol APPROVE",
  generator: "scripts/build-v099-battle-audio.mjs",
  generatorSeed: `0x${seed.toString(16)}`,
  candidateId: "v099-pr2-audio-r2",
  source: "project-original",
  creator: "SUSANO-OOO/Zombieee project",
  license: "Original project work; no third-party rights apply.",
  commercialUse: true,
  modification: true,
  redistribution: true,
  masterSampleRate: sampleRate,
  ffmpeg: {
    package: pinnedFfmpegPackage,
    productionPlatformPackage: pinnedFfmpegPlatformPackage,
    productionPlatform: "win32-x64",
    version: ffmpeg.versionLine,
    pathPolicy: "FFMPEG_PATH or locked win32-x64 package binary; exact production version required",
  },
  encoding: { format: "MP3", preferredSourceOnly: true, bgmBitrate: "160k", sfxBitrate: "128k", mime: "audio/mpeg", writeXing: true, bitexact: true },
  physicalAssetCount: generated.length,
  distinctOutputBytes: distinctBytes,
  producerApproval: "Gate A pending",
  assets: generated,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  physicalAssetCount: generated.length,
  distinctOutputBytes: distinctBytes,
  distinctOutputMiB: Number((distinctBytes / 1024 / 1024).toFixed(3)),
  provenance: path.relative(outputRoot, provenancePath).replace(/\\/g, "/"),
  ffmpeg: ffmpeg.versionLine,
}, null, 2));
