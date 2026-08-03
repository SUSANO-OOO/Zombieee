import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import test from "node:test";

import sharp from "sharp";

import { V099_APP_ICON_IDENTITY, V099_APP_ICON_PATHS } from "../app/appIconIdentity.js";

const publicUrl = (assetPath) => new URL(`../public${assetPath}`, import.meta.url);

test("the production icon set is generated only from the Gate A approved A2 master", async () => {
  execFileSync(process.execPath, ["scripts/build-app-icons.mjs", "--check"], { stdio: "pipe" });
  const ledger = JSON.parse(await readFile(new URL("../assets/source/brand/candidates/v099/v2/candidate-ledger.json", import.meta.url), "utf8"));
  assert.equal(V099_APP_ICON_IDENTITY.candidateId, ledger.provenance.approvedCandidateId);
  assert.equal(V099_APP_ICON_IDENTITY.masterSha256, ledger.provenance.approvedMasterSha256);
  assert.equal(V099_APP_ICON_IDENTITY.approvalCommentUrl, ledger.provenance.approvalCommentUrl);

  const expectedSizes = new Map([
    [V099_APP_ICON_IDENTITY.paths.favicon48, 48],
    [V099_APP_ICON_IDENTITY.paths.appleTouch180, 180],
    [V099_APP_ICON_IDENTITY.paths.icon192, 192],
    [V099_APP_ICON_IDENTITY.paths.maskable192, 192],
    [V099_APP_ICON_IDENTITY.paths.icon512, 512],
    [V099_APP_ICON_IDENTITY.paths.maskable512, 512],
    [V099_APP_ICON_IDENTITY.paths.icon1024, 1024],
  ]);
  for (const [assetPath, size] of expectedSizes) {
    const metadata = await sharp(await readFile(publicUrl(assetPath))).metadata();
    assert.equal(metadata.format, "png", assetPath);
    assert.equal(metadata.width, size, assetPath);
    assert.equal(metadata.height, size, assetPath);
  }
});

test("only approved versioned icon paths are referenced while legacy files remain recoverable", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const manifestPaths = new Set(manifest.icons.map(({ src }) => `/${src}`));
  for (const assetPath of [
    V099_APP_ICON_IDENTITY.paths.icon192,
    V099_APP_ICON_IDENTITY.paths.icon512,
    V099_APP_ICON_IDENTITY.paths.icon1024,
    V099_APP_ICON_IDENTITY.paths.maskable192,
    V099_APP_ICON_IDENTITY.paths.maskable512,
  ]) assert.ok(manifestPaths.has(assetPath), assetPath);

  const runtimeText = (await Promise.all([
    new URL("../app/layout.tsx", import.meta.url),
    new URL("../app/appIconIdentity.js", import.meta.url),
    new URL("../public/manifest.webmanifest", import.meta.url),
  ].map((url) => readFile(url, "utf8")))).join("\n");
  assert.doesNotMatch(runtimeText, /\/favicon\.svg|\/icons\/(?:icon|apple-touch-icon)/u);
  assert.doesNotMatch(runtimeText, /v099-infected-face-[bc]2/u);
  for (const assetPath of V099_APP_ICON_PATHS) assert.match(runtimeText, new RegExp(assetPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  for (const legacy of [
    "../public/favicon.svg",
    "../public/icons/icon-192.png",
    "../public/icons/icon-512.png",
    "../public/icons/icon-1024.png",
    "../public/icons/icon-maskable-192.png",
    "../public/icons/icon-maskable-512.png",
    "../public/icons/apple-touch-icon-180.png",
  ]) await access(new URL(legacy, import.meta.url));
});

test("the 0.9.8.2 differential update reuses every non-icon hash and fetches only approved icon bytes", async () => {
  const previous = JSON.parse(execFileSync("git", [
    "show",
    "3e09b4c09cb1bc67cf1322bd539f5b0bc7e5d060:public/asset-manifest.json",
  ], { encoding: "utf8" }));
  const current = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));
  const previousNonIcons = new Map(previous.assets
    .filter(({ path }) => path !== "/favicon.svg" && !path.startsWith("/icons/"))
    .map(({ path, hash }) => [path, hash]));
  const currentNonIcons = new Map(current.assets
    .filter(({ path }) => !path.startsWith("/icons/"))
    .map(({ path, hash }) => [path, hash]));
  assert.deepEqual(currentNonIcons, previousNonIcons);

  const currentIcons = current.assets.filter(({ path }) => path.startsWith("/icons/"));
  assert.deepEqual(new Set(currentIcons.map(({ path }) => path)), new Set(V099_APP_ICON_PATHS));
  const previousHashes = new Set(previous.assets.map(({ hash }) => hash));
  const newIconObjects = new Map(currentIcons
    .filter(({ hash }) => !previousHashes.has(hash))
    .map((asset) => [asset.hash, asset.bytes]));
  assert.equal(newIconObjects.size, 5, "duplicate any/maskable sizes must reuse the same cache object");
  assert.equal([...newIconObjects.values()].reduce((sum, bytes) => sum + bytes, 0), 2_509_193);
});
