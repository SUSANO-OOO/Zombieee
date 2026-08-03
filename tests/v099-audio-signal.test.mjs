import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

import { V099_BATTLE_AUDIO_ASSET_SPECS } from "../app/battleAudioContracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const provenancePath = path.join(root, "reference", "audio", "v099-generated", "provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const provenanceById = new Map(provenance.assets.map((entry) => [entry.id, entry]));
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path;
const ffmpegVersion = execFileSync(ffmpegPath, ["-version"], { encoding: "utf8" }).split(/\r?\n/, 1)[0];

function decodeMp3(id) {
  const source = path.join(root, "public", "audio", "v099",
    id.startsWith("music-") ? "music" : "sfx", `${id}.mp3`);
  const decoded = execFileSync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-i", source,
    "-f", "f32le", "-ac", "1", "-ar", "44100", "pipe:1",
  ], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  return new Float32Array(decoded.buffer, decoded.byteOffset, decoded.byteLength / 4);
}

function signalMetrics(samples) {
  let peak = 0;
  let truePeak = 0;
  let sum = 0;
  let squared = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    peak = Math.max(peak, Math.abs(sample));
    sum += sample;
    squared += sample * sample;
    if (index < 1 || index >= samples.length - 2) continue;
    const p0 = samples[index - 1];
    const p1 = sample;
    const p2 = samples[index + 1];
    const p3 = samples[index + 2];
    for (const fraction of [.25, .5, .75]) {
      const fraction2 = fraction * fraction;
      const fraction3 = fraction2 * fraction;
      const interpolated = .5 * ((2 * p1)
        + (-p0 + p2) * fraction
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * fraction2
        + (-p0 + 3 * p1 - 3 * p2 + p3) * fraction3);
      truePeak = Math.max(truePeak, Math.abs(interpolated));
    }
  }
  return {
    peak,
    truePeak: Math.max(peak, truePeak),
    dc: sum / Math.max(1, samples.length),
    rms: Math.sqrt(squared / Math.max(1, samples.length)),
  };
}

function downsampleFingerprint(samples, size = 512) {
  const result = new Float64Array(size);
  for (let bucket = 0; bucket < size; bucket += 1) {
    const start = Math.floor(bucket * samples.length / size);
    const end = Math.max(start + 1, Math.floor((bucket + 1) * samples.length / size));
    let energy = 0;
    let crossings = 0;
    for (let index = start; index < Math.min(end, samples.length); index += 1) {
      energy += samples[index] * samples[index];
      if (index > start && Math.sign(samples[index]) !== Math.sign(samples[index - 1])) crossings += 1;
    }
    result[bucket] = Math.sqrt(energy / Math.max(1, end - start)) + crossings / Math.max(1, end - start) * .08;
  }
  return result;
}

function correlation(left, right) {
  let leftMean = 0;
  let rightMean = 0;
  for (let index = 0; index < left.length; index += 1) {
    leftMean += left[index];
    rightMean += right[index];
  }
  leftMean /= left.length;
  rightMean /= right.length;
  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = 0; index < left.length; index += 1) {
    const l = left[index] - leftMean;
    const r = right[index] - rightMean;
    numerator += l * r;
    leftEnergy += l * l;
    rightEnergy += r * r;
  }
  return numerator / Math.max(Number.EPSILON, Math.sqrt(leftEnergy * rightEnergy));
}

test("v0.9.9.0 uses the pinned FFmpeg build for all distributed MP3 diagnostics", () => {
  assert.match(ffmpegVersion, /N-92722-gf22fcd4483/);
  assert.match(provenance.ffmpeg.package, /@ffmpeg-installer\/ffmpeg@1\.1\.0/);
  assert.equal(provenance.encoding.writeXing, true);
  assert.equal(provenance.encoding.bitexact, true);
});

test("all 36 distributed MP3s pass decoded true-peak, DC, duration, and tail-click checks", () => {
  for (const spec of V099_BATTLE_AUDIO_ASSET_SPECS) {
    const samples = decodeMp3(spec.id);
    const entry = provenanceById.get(spec.id);
    const metrics = signalMetrics(samples);
    assert.ok(samples.length > 4_000, `${spec.id} decoded empty`);
    assert.ok(metrics.rms > .003, `${spec.id} is effectively silent`);
    assert.ok(metrics.truePeak < .72, `${spec.id} true peak ${metrics.truePeak}`);
    assert.ok(Math.abs(metrics.dc) < .01, `${spec.id} DC ${metrics.dc}`);
    assert.ok(Math.abs(samples.length / 44_100 - entry.durationSeconds) < .08,
      `${spec.id} decoded duration drift`);
    const seam = Math.abs(samples[0] - samples.at(-1));
    assert.ok(seam < .08, `${spec.id} tail click ${seam}`);
    assert.ok(Math.abs(samples.at(-1)) < .08, `${spec.id} non-zero tail`);
  }
});

test("the decoded MP3 role matrix is signal-distinct rather than a renamed common template", () => {
  assert.equal(new Set(provenance.assets.map(({ recipeId }) => recipeId)).size, 36);
  assert.equal(new Set(provenance.assets.map(({ outputSha256 }) => outputSha256)).size, 36);
  const decoded = V099_BATTLE_AUDIO_ASSET_SPECS.map((spec) => ({
    id: spec.id,
    fingerprint: downsampleFingerprint(decodeMp3(spec.id)),
  }));
  let closest = { correlation: -1, pair: [] };
  for (let left = 0; left < decoded.length; left += 1) {
    for (let right = left + 1; right < decoded.length; right += 1) {
      const value = Math.abs(correlation(decoded[left].fingerprint, decoded[right].fingerprint));
      if (value > closest.correlation) closest = { correlation: value, pair: [decoded[left].id, decoded[right].id] };
    }
  }
  assert.ok(closest.correlation < .985,
    `closest decoded pair is template-like: ${closest.pair.join(" / ")} = ${closest.correlation}`);
});

test("each distributed BGM renders ten actual decoded loop boundaries without a seam", () => {
  for (const spec of V099_BATTLE_AUDIO_ASSET_SPECS.filter(({ category }) => category === "bgm")) {
    const samples = decodeMp3(spec.id);
    let previous = samples[0];
    let loopBoundaries = 0;
    let maximumJoinDelta = 0;
    for (let renderedFrame = 1; renderedFrame < samples.length * 10; renderedFrame += 1) {
      const sample = samples[renderedFrame % samples.length];
      if (renderedFrame % samples.length === 0) {
        loopBoundaries += 1;
        maximumJoinDelta = Math.max(maximumJoinDelta, Math.abs(sample - previous));
      }
      previous = sample;
    }
    assert.equal(loopBoundaries, 9, `${spec.id} did not render ten cycles`);
    assert.ok(maximumJoinDelta < .08, `${spec.id} ten-loop seam ${maximumJoinDelta}`);
  }
});
