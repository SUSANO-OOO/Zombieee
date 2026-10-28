import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { productionVisualIntegrityInventory } from "../app/visualIntegrityInventory.js";

const root = fileURLToPath(new URL("..", import.meta.url));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : absolute;
  }))).flat();
}

test("finite production visual inventory resolves every family and direction", async () => {
  const inventory = productionVisualIntegrityInventory();
  assert.equal(inventory.units.length, 16);
  assert.equal(inventory.events.length, 18);
  assert.equal(inventory.stages.length, 20);
  assert.ok(inventory.enemies.length >= 15);
  const runtimePaths = new Set();
  for (const entry of [...inventory.units.flatMap(({ card, portrait, battleSprite }) => [card, portrait, battleSprite]), ...inventory.events.map(({ path }) => path)]) {
    assert.match(entry, /^\/(?!.*(?:\/reference\/|identity-(?:master|r\d)))/u);
    await access(path.join(root, "public", entry.slice(1)));
    runtimePaths.add(entry);
  }
  for (const enemy of inventory.enemies) {
    await access(path.join(root, "public", enemy.sheet.slice(1)));
    assert.equal(enemy.states.length, 7, enemy.kind);
    for (const state of enemy.states) {
      assert.ok(state.left && state.right, `${enemy.kind}/${state.state}`);
    }
  }
  assert.ok(runtimePaths.size >= 18, "identity families unexpectedly alias one small placeholder set");
  assert.ok(inventory.fallbackRenderers.every(({ productionPolicy, qaFallback }) => (
    productionPolicy === "required-blocking" && qaFallback === "local-qa-only"
  )));
});

test("v0995 keeps registered runtime derivatives and exact retired originals outside the runtime manifest", async () => {
  const inventory = productionVisualIntegrityInventory();
  const registered = new Set([
    ...inventory.units.flatMap(({ card, portrait, battleSprite }) => [card, portrait, battleSprite]),
    ...inventory.events.map(({ path }) => path),
    ...inventory.enemies.map(({ sheet }) => sheet),
  ].filter((entry) => entry.includes("/art/v0995/")));
  const rootDir = path.join(root, "public", "art", "v0995");
  const actual = new Set((await walk(rootDir)).map((entry) => `/${path.relative(path.join(root, "public"), entry).replaceAll("\\", "/")}`));
  const delta=JSON.parse(await readFile(new URL('./fixtures/quality-20261028-runtime-delta.json',import.meta.url)));
  const manifest=JSON.parse(await readFile(path.join(root,'public','asset-manifest.json')));
  const retired=delta.retired.filter(row=>row.path.startsWith('/art/v0995/'));
  for(const row of retired){
    assert.ok(!manifest.assets.some(asset=>asset.path===row.path),'retired original is not distributed');
    const bytes=await readFile(path.join(root,'public',row.sourcePath??row.path));
    assert.equal(bytes.length,row.bytes);assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),row.hash);
  }
  assert.deepEqual(actual, new Set([...registered,...retired.map(row=>row.path)]));
});
