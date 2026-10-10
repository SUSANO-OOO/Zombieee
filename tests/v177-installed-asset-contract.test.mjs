import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { V177_INSTALLED_ASSET_CONTRACT } from "../scripts/v177-installed-asset-contract.mjs";
import { V100_RELEASE_ASSET_CONTRACT } from "../scripts/v100-release-asset-contract.mjs";

const candidate = JSON.parse(readFileSync(new URL("../public/asset-manifest.json", import.meta.url)));
const record = ({path, bytes, hash}) => ({path, bytes, hash});
const ordered = assets => assets.map(record).sort((a, b) => a.path.localeCompare(b.path));
const baselines = [
  ["1.0.1", "634f8de4b0fb15df902a7dd5983ea94237cfea9d", 50, 14_788_208, 24],
  ["1.0.2", "cd246a3d8e93b69d8cb6b370d40f28924a0d86b6", 49, 14_767_256, 23],
];
for (const [version, sha, count, bytes, network] of baselines) {
  test(`the frozen installed ${version} pack downloads exactly the R9, score and sprite delta`, () => {
    const old = JSON.parse(execFileSync("git", ["show", `${sha}:public/asset-manifest.json`], {encoding:"utf8",maxBuffer:4*1024*1024}));
    const expected = V177_INSTALLED_ASSET_CONTRACT[version];
    assert.equal(old.version, version);
    assert.equal(old.assets.length, expected.assets);
    const oldHashes = new Set(old.assets.map(asset => asset.hash));
    assert.equal(oldHashes.size, expected.distinct);
    const changed = candidate.assets.filter(asset => !oldHashes.has(asset.hash));
    assert.deepEqual(ordered(changed), ordered(expected.changed), "unexpected download or missing approved media");
    assert.equal(changed.length, count);
    assert.equal(expected.additions, count);
    assert.equal(changed.reduce((sum, asset) => sum + asset.bytes, 0), bytes);
    assert.equal(expected.bytes, bytes);
    assert.equal(changed.filter(asset => asset.bundlePath).length, 27);
    assert.equal(expected.bundled, 27);
    assert.equal(new Set(changed.map(asset => asset.bundlePath ?? asset.sourcePath ?? asset.path)).size, network);
    assert.equal(expected.network, network);
    const next = new Map(candidate.assets.map(asset => [asset.path, asset]));
    const replaced = [];
    for (const asset of old.assets) {
      const replacement = next.get(asset.path);
      assert.ok(replacement, `installed asset removed: ${asset.path}`);
      if (replacement.hash !== asset.hash) replaced.push(asset.path);
      else {
        assert.equal(replacement.bytes, asset.bytes);
        assert.equal(replacement.sourcePath, asset.sourcePath);
        assert.equal(replacement.bundlePath, asset.bundlePath);
      }
    }
    assert.deepEqual(replaced.sort(), expected.replaced);
  });
}
test("the frozen 0.9.9.5 delta includes Musashi's changed hash and the existing card replacement", () => {
  const old = JSON.parse(execFileSync("git", ["show", "55d796cc577d1d9f903a4d2c6b4382196511db27:public/asset-manifest.json"], {encoding:"utf8",maxBuffer:4*1024*1024}));
  const hashes = new Set(old.assets.map(asset => asset.hash));
  const changed = candidate.assets.filter(asset => !hashes.has(asset.hash));
  assert.equal(changed.length, V100_RELEASE_ASSET_CONTRACT.additionsFromV0995);
  assert.equal(changed.reduce((sum, asset) => sum + asset.bytes, 0), V100_RELEASE_ASSET_CONTRACT.bytesFromV0995);
  assert.equal(changed.filter(asset => asset.bundlePath).length, V100_RELEASE_ASSET_CONTRACT.bundledAudioAdditionsFromV0995);
  assert.equal(new Set(changed.map(asset => asset.bundlePath ?? asset.sourcePath ?? asset.path)).size, V100_RELEASE_ASSET_CONTRACT.networkSourcesFromV0995);
  const next = new Map(candidate.assets.map(asset => [asset.path, asset]));
  assert.deepEqual(old.assets.filter(asset => next.get(asset.path)?.hash !== asset.hash).map(asset => asset.path).sort(), [
    "/art/v080/characters/cards/kumaverson-formation-card-r2.webp",
    "/art/v090/characters/miyamoto-musashi-battle-r1.png",
  ]);
});
