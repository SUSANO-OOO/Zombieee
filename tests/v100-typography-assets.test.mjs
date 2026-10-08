import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { V100_FONT_ASSETS } from "../app/v100Typography.js";

const root = process.cwd();
const publicRoot = path.join(root, "public");
const manifest = JSON.parse(await readFile(path.join(publicRoot, "asset-manifest.json"), "utf8"));
const provenance = JSON.parse(await readFile(path.join(root, "assets/source/v100/typography/source-provenance.json"), "utf8"));

test("V1 fonts are byte-verified critical app-shell assets with bundled OFL notices", async () => {
  assert.equal(V100_FONT_ASSETS.length, 4);
  assert.equal(provenance.sourceRevision, "9710da1eacb3be272583c3224dcb70f9da6eadbb");
  assert.equal(provenance.compression.subsetting, false);

  for (const assetPath of V100_FONT_ASSETS) {
    const asset = manifest.assets.find((entry) => entry.path === assetPath);
    assert.ok(asset, `${assetPath} is in the install manifest`);
    assert.deepEqual(
      { pack: asset.pack, category: asset.category, criticality: asset.criticality },
      { pack: "app-shell", category: "app", criticality: "critical" },
    );

    const bytes = await readFile(path.join(publicRoot, assetPath.slice(1)));
    assert.equal(asset.bytes, bytes.byteLength, `${assetPath} byte count matches`);
    assert.equal(asset.hash, `sha256-${createHash("sha256").update(bytes).digest("hex")}`, `${assetPath} hash matches`);
  }

  for (const licensePath of provenance.licenseFiles) {
    const license = await readFile(path.join(publicRoot, licensePath.slice(1)), "utf8");
    assert.match(license, /SIL Open Font License, Version 1\.1/);
  }
});

test("the title subset retains its separate source, seven glyph scope and bundled license", async () => {
  const source = JSON.parse(await readFile(path.join(root, "assets/source/v100/typography/title-font-provenance.json"), "utf8"));
  const bytes = await readFile(path.join(publicRoot, source.asset.path.slice(1)));
  assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
  assert.equal(bytes.byteLength, source.asset.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), source.asset.sha256);
  assert.equal(source.characters, "西新世紀末物語");
  assert.equal(new URL(source.source).hostname, "fonts.gstatic.com");
  assert.match(await readFile(path.join(publicRoot, source.licenseFile.slice(1)), "utf8"), /Copyright 2020 The New Tegomin Project Authors/);
});
