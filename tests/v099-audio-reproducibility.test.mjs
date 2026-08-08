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
const pinnedVersion = "N-92722-gf22fcd4483";

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

test("a clean temporary output root reproduces every v0.9.9.0 WAV SHA on every platform", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "zombieee-v099-audio-"));
  try {
    execFileSync(process.execPath, [generator, `--output-root=${temporaryRoot}`, "--masters-only"], {
      cwd: root,
      stdio: "pipe",
      maxBuffer: 4 * 1024 * 1024,
    });
    const checkedIn = JSON.parse(await readFile(
      path.join(root, "reference", "audio", "v099-generated", "provenance.json"),
      "utf8",
    ));
    for (const expected of checkedIn.assets) {
      assert.equal(await sha256(path.join(temporaryRoot, expected.master)), expected.masterSha256,
        `${expected.id} master file`);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("MP3 regeneration is exact on the pinned production encoder and fails closed elsewhere", async () => {
  const checkedIn = JSON.parse(await readFile(
    path.join(root, "reference", "audio", "v099-generated", "provenance.json"),
    "utf8",
  ));
  assert.equal(checkedIn.ffmpeg.productionPlatformPackage, "@ffmpeg-installer/win32-x64@4.1.0");
  assert.equal(checkedIn.ffmpeg.productionPlatform, "win32-x64");
  const localVersion = execFileSync(ffmpegInstaller.path, ["-version"], { encoding: "utf8" })
    .split(/\r?\n/, 1)[0];
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "zombieee-v099-audio-"));
  try {
    if (!localVersion.includes(pinnedVersion)) {
      assert.throws(() => execFileSync(process.execPath, [generator, `--output-root=${temporaryRoot}`], {
        cwd: root,
        env: { ...process.env, FFMPEG_PATH: ffmpegInstaller.path },
        stdio: "pipe",
        maxBuffer: 4 * 1024 * 1024,
      }), /Expected FFmpeg N-92722-gf22fcd4483/);
      for (const expected of checkedIn.assets) {
        assert.equal(await sha256(path.join(root, expected.output)), expected.outputSha256,
          `${expected.id} checked-in output`);
      }
      return;
    }
    execFileSync(process.execPath, [generator, `--output-root=${temporaryRoot}`], {
      cwd: root,
      env: { ...process.env, FFMPEG_PATH: ffmpegInstaller.path },
      stdio: "pipe",
      maxBuffer: 4 * 1024 * 1024,
    });
    const regenerated = JSON.parse(await readFile(
      path.join(temporaryRoot, "reference", "audio", "v099-generated", "provenance.json"),
      "utf8",
    ));
    assert.equal(regenerated.ffmpeg.version, checkedIn.ffmpeg.version);
    assert.equal(regenerated.distinctOutputBytes, checkedIn.distinctOutputBytes);
    for (const expected of checkedIn.assets) {
      const actual = regenerated.assets.find(({ id }) => id === expected.id);
      assert.ok(actual, expected.id);
      assert.equal(actual.outputSha256, expected.outputSha256, `${expected.id} output ledger`);
      assert.equal(await sha256(path.join(temporaryRoot, actual.output)), expected.outputSha256,
        `${expected.id} output file`);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
