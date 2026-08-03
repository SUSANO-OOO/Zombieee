import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { V099_BATTLE_AUDIO_ASSET_SPECS } from "../app/battleAudioContracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readWav(id) {
  const filePath = path.join(root, "reference", "audio", "v099-generated", "masters", `${id}.wav`);
  const buffer = await readFile(filePath);
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF", id);
  assert.equal(buffer.toString("ascii", 8, 12), "WAVE", id);
  const samples = new Int16Array((buffer.length - 44) / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = buffer.readInt16LE(44 + index * 2);
  return samples;
}

test("v0.9.9.0 masters have signal, bounded peak, and no DC drift", async () => {
  for (const spec of V099_BATTLE_AUDIO_ASSET_SPECS) {
    const samples = await readWav(spec.id);
    let peak = 0;
    let sum = 0;
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample));
      sum += sample;
    }
    assert.ok(peak > 200, `${spec.id} is silent`);
    assert.ok(peak <= 32767, `${spec.id} clips`);
    assert.ok(Math.abs(sum / samples.length) < 1800, `${spec.id} has DC drift`);
  }
});

test("looping PR2 BGM masters keep a bounded seam over ten conceptual cycles", async () => {
  for (const spec of V099_BATTLE_AUDIO_ASSET_SPECS.filter(({ category }) => category === "bgm")) {
    const samples = await readWav(spec.id);
    const seam = Math.abs(samples[0] - samples.at(-1)) / 32767;
    for (let cycle = 0; cycle < 10; cycle += 1) assert.ok(seam < .08, `${spec.id} seam at cycle ${cycle}`);
  }
});
