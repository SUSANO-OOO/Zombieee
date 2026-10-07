import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { emittedPwaShellFiles } from "../scripts/pwa-shell-files.mjs";

async function fixture(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "zombieee-shell-files-"));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(root).startsWith("zombieee-shell-files-"));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, "assets"));
  for (const file of files) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "fixture");
  }
  return root;
}

test("offline shell includes an emitted RSC stylesheet omitted by the Vite manifest", async t => {
  const root = await fixture(t, ["assets/app.js", "assets/index-rsc.css", "assets/lazy/page.mjs", "assets/source.js.map", "assets/map.webp"]);
  await mkdir(path.join(root, ".vite"));
  await writeFile(path.join(root, ".vite", "manifest.json"), JSON.stringify({ app: { file: "assets/app.js" } }));
  assert.deepEqual(await emittedPwaShellFiles(root), ["assets/app.js", "assets/index-rsc.css", "assets/lazy/page.mjs"]);
});

test("a build with no emitted shell script or stylesheet fails closed", async t => {
  const root = await fixture(t, ["assets/map.webp"]);
  await assert.rejects(emittedPwaShellFiles(root), /no PWA shell JS\/CSS/u);
});

test("an emitted filename outside the service worker shell contract fails closed", async t => {
  const root = await fixture(t, ["assets/page with spaces.css"]);
  await assert.rejects(emittedPwaShellFiles(root), /Invalid PWA shell path/u);
});
