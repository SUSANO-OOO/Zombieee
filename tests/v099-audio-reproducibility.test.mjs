import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generator = path.join(root, "scripts", "build-v099-battle-audio.mjs");

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

test("a clean temporary output root reproduces every v0.9.9.0 WAV and MP3 SHA", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "zombieee-v099-audio-"));
  try {
    execFileSync(process.execPath, [generator, `--output-root=${temporaryRoot}`], {
      cwd: root,
      env: { ...process.env, FFMPEG_PATH: process.env.FFMPEG_PATH || ffmpegInstaller.path },
      stdio: "pipe",
      maxBuffer: 4 * 1024 * 1024,
    });
    const checkedIn = JSON.parse(await readFile(
      path.join(root, "reference", "audio", "v099-generated", "provenance.json"),
      "utf8",
    ));
    const regenerated = JSON.parse(await readFile(
      path.join(temporaryRoot, "reference", "audio", "v099-generated", "provenance.json"),
      "utf8",
    ));
    assert.equal(regenerated.ffmpeg.version, checkedIn.ffmpeg.version);
    assert.equal(regenerated.distinctOutputBytes, checkedIn.distinctOutputBytes);
    assert.equal(regenerated.assets.length, 36);
    const regeneratedById = new Map(regenerated.assets.map((entry) => [entry.id, entry]));
    for (const expected of checkedIn.assets) {
      const actual = regeneratedById.get(expected.id);
      assert.ok(actual, expected.id);
      assert.equal(actual.recipeId, expected.recipeId, expected.id);
      assert.equal(actual.masterSha256, expected.masterSha256, `${expected.id} master ledger`);
      assert.equal(actual.outputSha256, expected.outputSha256, `${expected.id} output ledger`);
      assert.equal(await sha256(path.join(temporaryRoot, actual.master)), expected.masterSha256, `${expected.id} master file`);
      assert.equal(await sha256(path.join(temporaryRoot, actual.output)), expected.outputSha256, `${expected.id} output file`);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
