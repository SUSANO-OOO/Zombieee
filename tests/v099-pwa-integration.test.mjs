import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "public", "asset-manifest.json");
const bundleIndexPath = path.join(root, "public", "pwa-bundles", "audio-v1.json");
const bundlePath = path.join(root, "public", "pwa-bundles", "audio-v1.bin");

function hash(bytes) {
  return `sha256-${createHash("sha256").update(bytes).digest("hex")}`;
}

test("v0.9.9.0 audio assets are present in the generated transport manifest", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const v099 = manifest.assets.filter(({ path: assetPath }) => assetPath.startsWith("/audio/v099/"));
  assert.equal(v099.length, 37);
  assert.ok(v099.every(({ category, audioType, bundlePath: assetBundlePath }) => (
    category === "audio"
      && audioType === "audio/mpeg"
      && assetBundlePath === "/pwa-bundles/audio-v1.bin"
  )));
  assert.equal(new Set(v099.map(({ hash: assetHash }) => assetHash)).size, 37);
  assert.equal(v099.reduce((sum, asset) => sum + asset.bytes, 0), 5_967_147);
});
test("v0.9.9.0 audio slices match the PWA bundle index", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const bundleIndex = JSON.parse(await readFile(bundleIndexPath, "utf8"));
  const bundle = await readFile(bundlePath);
  const v099 = manifest.assets.filter(({ path: assetPath }) => assetPath.startsWith("/audio/v099/"));
  assert.equal(bundleIndex.bundlePath, "/pwa-bundles/audio-v1.bin");
  assert.equal(bundleIndex.bytes, bundle.length);
  for (const asset of v099) {
    const bundled = bundleIndex.assets[asset.path];
    assert.ok(bundled, asset.path);
    const start = bundled.offset;
    const end = start + bundled.bytes;
    const slice = bundle.subarray(start, end);
    assert.equal(slice.length, asset.bytes, asset.path);
    assert.equal(hash(slice), asset.hash, asset.path);
    assert.equal(asset.bundleOffset, bundled.offset, asset.path);
    assert.equal(asset.bundleBytes, bundled.bytes, asset.path);
    assert.equal(asset.bundleLength, bundle.length, asset.path);
  }
});
