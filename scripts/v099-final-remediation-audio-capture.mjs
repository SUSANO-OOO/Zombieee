import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

import { DEFAULT_CAMPAIGN_SETTINGS } from "../app/campaign.js";
import {
  PRODUCTION_AUDIO_MANIFEST,
  STORY_AUDIO_MIX,
  TAKUYA_ENTRANCE_AUDIO,
} from "../app/productionAudio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(root, "docs", "qa", "v099", "final-remediation", "audio");
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
const ffmpegVersion = execFileSync(ffmpegPath, ["-version"], { encoding: "utf8" })
  .split(/\r?\n/u, 1)[0];
const sampleRate = 44_100;
const categoryVolumes = Object.freeze({
  bgm: 1,
  ambience: 1,
  ui: .8,
  weapons: .82,
  melee: .84,
  humanVoices: .9,
  monsters: .86,
  support: .9,
});
const masterGain = .9;
const bgmBusGain = DEFAULT_CAMPAIGN_SETTINGS.bgmVolume;
const sfxBusGain = DEFAULT_CAMPAIGN_SETTINGS.sfxVolume;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assetFor(id) {
  const asset = PRODUCTION_AUDIO_MANIFEST.assetById[id];
  invariant(asset, `unknown production asset ${id}`);
  invariant(asset.sources.length >= 1, `${id} has no playable source`);
  return asset;
}

function sourcePathFor(id) {
  return path.join(root, "public", assetFor(id).sources[0].src.replace(/^\//u, ""));
}

function productionGainFor(id, optionVolume = 1) {
  const asset = assetFor(id);
  const settingsGain = asset.category === "bgm" ? bgmBusGain : sfxBusGain;
  return asset.gain * optionVolume * categoryVolumes[asset.category] * settingsGain * masterGain;
}

function runFfmpeg(args) {
  execFileSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    cwd: root,
    stdio: "inherit",
  });
}

function outputArguments(outputPath, durationSeconds) {
  return [
    "-t", String(durationSeconds),
    "-ar", String(sampleRate),
    "-ac", "2",
    "-codec:a", "libmp3lame",
    "-b:a", "192k",
    "-write_xing", "1",
    "-map_metadata", "-1",
    "-fflags", "+bitexact",
    "-flags:a", "+bitexact",
    outputPath,
  ];
}

function renderSingle(id, outputPath) {
  runFfmpeg([
    "-stream_loop", "-1", "-i", sourcePathFor(id),
    "-filter:a", `volume=${productionGainFor(id)}`,
    ...outputArguments(outputPath, 30),
  ]);
}

function renderTransition(fromId, toId, crossfadeSeconds, outputPath) {
  const inputSeconds = (16 + crossfadeSeconds) / 2;
  const filter = [
    `[0:a]atrim=0:${inputSeconds},asetpts=PTS-STARTPTS,volume=${productionGainFor(fromId)}[from]`,
    `[1:a]atrim=0:${inputSeconds},asetpts=PTS-STARTPTS,volume=${productionGainFor(toId)}[to]`,
    `[from][to]acrossfade=d=${crossfadeSeconds}:c1=tri:c2=tri[out]`,
  ].join(";");
  runFfmpeg([
    "-stream_loop", "-1", "-i", sourcePathFor(fromId),
    "-stream_loop", "-1", "-i", sourcePathFor(toId),
    "-filter_complex", filter,
    "-map", "[out]",
    ...outputArguments(outputPath, 16),
  ]);
}

function renderStage3Path(outputPath) {
  const normalId = "music-v099-normal";
  const bossId = "music-v099-boss";
  const entranceId = TAKUYA_ENTRANCE_AUDIO.cueId;
  const duck = TAKUYA_ENTRANCE_AUDIO.musicDuck;
  const attackEnd = duck.attackMs / 1000;
  const holdEnd = attackEnd + duck.holdMs / 1000;
  const releaseEnd = holdEnd + duck.releaseMs / 1000;
  const barkHoldEnd = 1.8;
  const barkReleaseEnd = barkHoldEnd + STORY_AUDIO_MIX.dialogueReleaseMs / 1000;
  const transient = `if(lt(t,${attackEnd}),1-(1-${duck.level})*t/${attackEnd},if(lt(t,${holdEnd}),${duck.level},if(lt(t,${releaseEnd}),${duck.level}+(1-${duck.level})*(t-${holdEnd})/${releaseEnd - holdEnd},1)))`;
  const dialogue = `if(lt(t,.35),1-(1-${STORY_AUDIO_MIX.dialogueBgmDuckLevel})*t/.35,if(lt(t,${barkHoldEnd}),${STORY_AUDIO_MIX.dialogueBgmDuckLevel},if(lt(t,${barkReleaseEnd}),${STORY_AUDIO_MIX.dialogueBgmDuckLevel}+(1-${STORY_AUDIO_MIX.dialogueBgmDuckLevel})*(t-${barkHoldEnd})/${barkReleaseEnd - barkHoldEnd},1)))`;
  const filter = [
    `[0:a]atrim=0:30,asetpts=PTS-STARTPTS,volume='${productionGainFor(normalId)}*max(0,1-t/.25)':eval=frame,aresample=${sampleRate},aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=stereo[normal]`,
    `[1:a]atrim=0:30,asetpts=PTS-STARTPTS,volume='${productionGainFor(bossId)}*min(1,t/.25)*(${transient})*(${dialogue})':eval=frame,aresample=${sampleRate},aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=stereo[boss]`,
    `[2:a]atrim=0:${TAKUYA_ENTRANCE_AUDIO.durationSeconds},asetpts=PTS-STARTPTS,volume=${productionGainFor(entranceId, .92)},aresample=${sampleRate},aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=stereo,apad=whole_len=${sampleRate * 30}[entrance]`,
    "[normal][boss][entrance]amerge=inputs=3,pan=stereo|c0=c0+c2+c4|c1=c1+c3+c5[out]",
  ].join(";");
  runFfmpeg([
    "-stream_loop", "-1", "-i", sourcePathFor(normalId),
    "-stream_loop", "-1", "-i", sourcePathFor(bossId),
    "-i", sourcePathFor(entranceId),
    "-filter_complex", filter,
    "-map", "[out]",
    ...outputArguments(outputPath, 30),
  ]);
}

function decodeMono(filePath) {
  const decoded = execFileSync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-i", filePath,
    "-f", "f32le", "-ac", "1", "-ar", String(sampleRate), "pipe:1",
  ], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  return new Float32Array(decoded.buffer, decoded.byteOffset, decoded.byteLength / 4);
}

function rms(samples, start = 0, end = samples.length) {
  let squared = 0;
  const boundedStart = Math.max(0, Math.floor(start));
  const boundedEnd = Math.min(samples.length, Math.ceil(end));
  for (let index = boundedStart; index < boundedEnd; index += 1) squared += samples[index] ** 2;
  return Math.sqrt(squared / Math.max(1, boundedEnd - boundedStart));
}

function signalMetrics(samples) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return { peak, rms: rms(samples) };
}

function spectralCentroidHz(samples) {
  const frameSize = 1024;
  const frameCount = 24;
  const maximumBin = Math.floor(8_000 * frameSize / sampleRate);
  let weightedFrequency = 0;
  let magnitudeTotal = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = Math.floor(frame * Math.max(0, samples.length - frameSize) / Math.max(1, frameCount - 1));
    for (let bin = 1; bin <= maximumBin; bin += 1) {
      let real = 0;
      let imaginary = 0;
      const angular = -2 * Math.PI * bin / frameSize;
      for (let offset = 0; offset < frameSize; offset += 1) {
        const window = .5 - .5 * Math.cos(2 * Math.PI * offset / (frameSize - 1));
        const value = samples[start + offset] * window;
        real += value * Math.cos(angular * offset);
        imaginary += value * Math.sin(angular * offset);
      }
      const magnitude = Math.hypot(real, imaginary);
      weightedFrequency += bin * sampleRate / frameSize * magnitude;
      magnitudeTotal += magnitude;
    }
  }
  return weightedFrequency / Math.max(Number.EPSILON, magnitudeTotal);
}

function onsetDensityPerSecond(samples) {
  const frameSize = Math.round(sampleRate * .02);
  let previousDb = -120;
  let lastOnsetFrame = -Infinity;
  let onsets = 0;
  const frames = Math.floor(samples.length / frameSize);
  for (let frame = 0; frame < frames; frame += 1) {
    const energy = rms(samples, frame * frameSize, (frame + 1) * frameSize);
    const db = 20 * Math.log10(Math.max(1e-9, energy));
    if (db > -34 && db - previousDb >= 2.5 && frame - lastOnsetFrame >= 3) {
      onsets += 1;
      lastOnsetFrame = frame;
    }
    previousDb = db;
  }
  return onsets / Math.max(.001, samples.length / sampleRate);
}

function integratedLoudnessLufs(filePath) {
  const result = spawnSync(ffmpegPath, [
    "-hide_banner", "-nostats", "-i", filePath,
    "-filter_complex", "ebur128=peak=true", "-f", "null", "-",
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  invariant(result.status === 0, result.stderr);
  const summaries = [...result.stderr.matchAll(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/gu)];
  invariant(summaries.length > 0, `${filePath} has no ebur128 summary`);
  return Number(summaries.at(-1)[1]);
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function captureEvidence(capture) {
  const filePath = path.join(evidenceDir, capture.filename);
  const samples = decodeMono(filePath);
  const signal = signalMetrics(samples);
  const singleAsset = capture.assetIds.length === 1 ? assetFor(capture.assetIds[0]) : null;
  const loopSamples = singleAsset?.loop ? decodeMono(sourcePathFor(singleAsset.id)) : null;
  return {
    ...capture,
    path: path.relative(root, filePath).replaceAll("\\", "/"),
    bytes: (await stat(filePath)).size,
    sha256: await sha256(filePath),
    durationSeconds: Number((samples.length / sampleRate).toFixed(3)),
    peak: Number(signal.peak.toFixed(6)),
    integratedLoudnessLufs: integratedLoudnessLufs(filePath),
    spectralCentroidHz: Number(spectralCentroidHz(samples).toFixed(1)),
    onsetDensityPerSecond: Number(onsetDensityPerSecond(samples).toFixed(3)),
    sourceLoopBoundaryDelta: loopSamples
      ? Number(Math.abs(loopSamples[0] - loopSamples.at(-1)).toFixed(6))
      : null,
  };
}

await mkdir(evidenceDir, { recursive: true });
const captures = [
  { id: "normal-30s", filename: "normal-30s.mp3", sceneIds: ["stage1"], assetIds: ["music-v099-normal"], instanceCount: 1 },
  { id: "pressure-30s", filename: "pressure-surface-30s.mp3", sceneIds: ["pressure-surface"], assetIds: ["music-v099-pressure-surface"], instanceCount: 1 },
  { id: "boss-30s", filename: "boss-30s.mp3", sceneIds: ["boss"], assetIds: ["music-v099-boss"], instanceCount: 1 },
  { id: "normal-to-pressure", filename: "normal-to-pressure-16s.mp3", sceneIds: ["stage1", "pressure-surface"], assetIds: ["music-v099-normal", "music-v099-pressure-surface"], crossfadeMs: 600, maximumConcurrentBgmInstances: 2 },
  { id: "pressure-to-boss", filename: "pressure-to-boss-16s.mp3", sceneIds: ["pressure-surface", "boss"], assetIds: ["music-v099-pressure-surface", "music-v099-boss"], crossfadeMs: 250, maximumConcurrentBgmInstances: 2 },
  { id: "boss-to-pressure", filename: "boss-to-pressure-16s.mp3", sceneIds: ["boss", "pressure-surface"], assetIds: ["music-v099-boss", "music-v099-pressure-surface"], crossfadeMs: 600, maximumConcurrentBgmInstances: 2 },
  { id: "stage3-takuya-production-path", filename: "stage3-takuya-production-path-30s.mp3", sceneIds: ["stage3", "boss"], assetIds: ["music-v099-normal", "music-v099-boss", TAKUYA_ENTRANCE_AUDIO.cueId], crossfadeMs: 250, maximumConcurrentBgmInstances: 2, entranceDuck: TAKUYA_ENTRANCE_AUDIO.musicDuck },
];

renderSingle("music-v099-normal", path.join(evidenceDir, captures[0].filename));
renderSingle("music-v099-pressure-surface", path.join(evidenceDir, captures[1].filename));
renderSingle("music-v099-boss", path.join(evidenceDir, captures[2].filename));
renderTransition("music-v099-normal", "music-v099-pressure-surface", .6, path.join(evidenceDir, captures[3].filename));
renderTransition("music-v099-pressure-surface", "music-v099-boss", .25, path.join(evidenceDir, captures[4].filename));
renderTransition("music-v099-boss", "music-v099-pressure-surface", .6, path.join(evidenceDir, captures[5].filename));
renderStage3Path(path.join(evidenceDir, captures[6].filename));

const evidence = {
  version: "0.9.9.0",
  generatedAt: new Date().toISOString(),
  method: "offline reconstruction of the production AudioMixer gain, category bus, scene crossfade, dialogue duck, and TAKUYA transient-duck graph",
  limitations: "This is deterministic production-graph evidence, not a physical speaker, physical iPhone, or hardware-loopback capture. Actual Chromium/WebKit AudioContext state and scene/instance diagnostics are recorded by the Stage 3 browser QA report.",
  ffmpeg: ffmpegVersion,
  settings: {
    masterGain,
    bgmBusGain,
    sfxBusGain,
    categoryVolumes,
  },
  productionGains: Object.fromEntries([
    "music-v099-normal",
    "music-v099-pressure-surface",
    "music-v099-pressure-station",
    "music-v099-boss",
    TAKUYA_ENTRANCE_AUDIO.cueId,
  ].map((id) => [id, productionGainFor(id, id === TAKUYA_ENTRANCE_AUDIO.cueId ? .92 : 1)])),
  captures: [],
};
for (const capture of captures) evidence.captures.push(await captureEvidence(capture));
await writeFile(path.join(evidenceDir, "capture-report.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
