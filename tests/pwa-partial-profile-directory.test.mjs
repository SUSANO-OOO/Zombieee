import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rmdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createPartialPwaProfileDirectory } from "../scripts/pwa-partial-profile-directory.mjs";

test("the default keeps separate, empty temporary profiles", async (t) => {
  const first = await createPartialPwaProfileDirectory();
  const second = await createPartialPwaProfileDirectory();
  t.after(async () => { await rmdir(first); await rmdir(second); });
  assert.notEqual(first, second);
  assert.equal(path.dirname(first), path.resolve(os.tmpdir()));
  assert.match(path.basename(first), /^z-pwa-/u);
  assert.deepEqual(await readdir(first), []);
  assert.deepEqual(await readdir(second), []);
});

test("an explicit fresh path is created without touching its parent", async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "zp-"));
  const target = path.join(parent, "new");
  t.after(async () => { await rmdir(target); await rmdir(parent); });
  assert.equal(await createPartialPwaProfileDirectory(target), target);
  assert.deepEqual(await readdir(target), []);
  assert.deepEqual(await readdir(parent), ["new"]);
});

test("an existing profile and its save marker are preserved on rejection", async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "zp-"));
  const marker = path.join(parent, "save-marker.txt");
  await writeFile(marker, "existing-player-save", { flag: "wx" });
  t.after(async () => { await unlink(marker); await rmdir(parent); });
  await assert.rejects(createPartialPwaProfileDirectory(parent), { code: "EEXIST" });
  assert.equal(await readFile(marker, "utf8"), "existing-player-save");
  assert.deepEqual(await readdir(parent), ["save-marker.txt"]);
});

test("an existing empty directory is also rejected", async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "zp-"));
  t.after(() => rmdir(parent));
  await assert.rejects(createPartialPwaProfileDirectory(parent), { code: "EEXIST" });
  assert.deepEqual(await readdir(parent), []);
});

test("invalid paths are rejected before creating a profile", async () => {
  for (const value of ["", " ", "relative-profile", null, 10]) {
    await assert.rejects(createPartialPwaProfileDirectory(value), /absolute directory path/u);
  }
  if (process.platform === "win32") {
    await assert.rejects(createPartialPwaProfileDirectory(path.resolve("C:/", "x".repeat(61))), /at most 60/u);
  }
});

test("a missing parent is not recursively created", async (t) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "zp-"));
  t.after(() => rmdir(parent));
  await assert.rejects(createPartialPwaProfileDirectory(path.join(parent, "abs", "new")), { code: "ENOENT" });
  assert.deepEqual(await readdir(parent), []);
});
