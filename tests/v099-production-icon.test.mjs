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

test("the approved-icon integration preserves every unrelated pre-icon hash and fetches only approved icon bytes", async () => {
  const previous = JSON.parse(execFileSync("git", [
    "show",
    "3e09b4c09cb1bc67cf1322bd539f5b0bc7e5d060:public/asset-manifest.json",
  ], { encoding: "utf8" }));
  const current = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));
  const finalRemediationPaths = new Set([
    "/art/v099/crawler/crawler-airstrike-module-sheet-v1.png",
    "/art/v099/crawler/crawler-barrage-module-sheet-v1.png",
    "/art/v099/crawler/crawler-command-base-closed-equipment-host-v1.png",
    "/art/v099/crawler/crawler-deployment-base-interior-v1.png",
    "/art/v099/crawler/crawler-deployment-foreground-mask-v1.png",
    "/audio/v099/music/music-v099-boss.mp3",
    "/audio/v099/music/music-v099-normal.mp3",
    "/audio/v099/music/music-v099-pressure-station.mp3",
    "/audio/v099/music/music-v099-pressure-surface.mp3",
  ]);
  const v0995VisualPolishPaths = new Set([
    "/art/v070/characters/engineer-battle-v1.png",
    "/art/v0995/characters/cards/mayo-chan-formation-card-r2.webp",
    "/art/v0995/characters/cards/miyamoto-musashi-formation-card-r2.webp",
    "/art/v0995/characters/cards/monkey-formation-card-r3.webp",
    "/art/v0995/characters/cards/mrs-chiha-formation-card-r2.webp",
    "/art/v0995/characters/cards/tky-formation-card-r2.webp",
    "/art/v0995/characters/cards/zakimiya-formation-card-r2.webp",
    "/art/v0995/characters/portraits/mayo-chan-event-portrait-r2.webp",
    "/art/v0995/characters/portraits/miyamoto-musashi-event-portrait-r2.webp",
    "/art/v0995/characters/portraits/mrs-chiha-event-portrait-r2.webp",
    "/art/v0995/characters/portraits/tky-event-portrait-r2.webp",
    "/art/v0995/characters/portraits/zakimiya-event-portrait-r2.webp",
    "/art/v0995/enemies/anchor-bloom-battle-v2.png",
    "/art/v0995/enemies/cagewalker-battle-v2.png",
    "/art/v0995/enemies/choir-knot-battle-v2.png",
    "/art/v0995/enemies/pall-manta-battle-v2.png",
    "/art/v0995/enemies/resonator-battle-v2.png",
    "/art/v0995/enemies/spindle-battle-v2.png",
  ]);
  const replacedVisualPaths = new Set([
    "/art/v080/characters/monkey-battle-r2.png",
    "/art/v080/characters/cards/monkey-formation-card-r2.webp",
    "/art/v080/characters/portraits/monkey-event-portrait-r2.webp",
    ...["mayo-chan", "miyamoto-musashi", "mrs-chiha", "tky", "zakimiya"]
      .flatMap((kind) => [
        `/art/v090/characters/cards/${kind}-formation-card-r1.webp`,
        `/art/v090/characters/portraits/${kind}-event-portrait-r1.webp`,
      ]),
    ...["anchor-bloom", "cagewalker", "choir-knot", "pall-manta", "resonator", "spindle"]
      .map((kind) => `/art/v090/enemies/${kind}-battle-v1.png`),
  ]);
  const previousNonIcons = new Map(previous.assets
    .filter(({ path }) => path !== "/favicon.svg" && !path.startsWith("/icons/"))
    .filter(({ path }) => !finalRemediationPaths.has(path))
    .filter(({ path }) => !replacedVisualPaths.has(path))
    .map(({ path, hash }) => [path, hash]));
  const currentNonIcons = new Map(current.assets
    .filter(({ path }) => !path.startsWith("/icons/"))
    .filter(({ path }) => !finalRemediationPaths.has(path))
    .filter(({ path }) => !v0995VisualPolishPaths.has(path))
    .map(({ path, hash }) => [path, hash]));
  assert.deepEqual(currentNonIcons, previousNonIcons);

  const finalRemediationAssets = current.assets.filter(({ path }) => finalRemediationPaths.has(path));
  assert.deepEqual(new Set(finalRemediationAssets.map(({ path }) => path)), finalRemediationPaths);
  assert.deepEqual(
    new Set(current.assets.filter(({ path }) => v0995VisualPolishPaths.has(path)).map(({ path }) => path)),
    v0995VisualPolishPaths,
  );

  const currentIcons = current.assets.filter(({ path }) => path.startsWith("/icons/"));
  assert.deepEqual(new Set(currentIcons.map(({ path }) => path)), new Set(V099_APP_ICON_PATHS));
  const previousHashes = new Set(previous.assets.map(({ hash }) => hash));
  const newIconObjects = new Map(currentIcons
    .filter(({ hash }) => !previousHashes.has(hash))
    .map((asset) => [asset.hash, asset.bytes]));
  assert.equal(newIconObjects.size, 5, "duplicate any/maskable sizes must reuse the same cache object");
  assert.equal([...newIconObjects.values()].reduce((sum, bytes) => sum + bytes, 0), 2_509_193);
});
