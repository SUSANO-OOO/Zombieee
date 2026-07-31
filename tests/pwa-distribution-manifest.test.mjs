import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import {
  ASSET_MANIFEST_SCHEMA,
  ASSET_PACK_IDS,
  RELEASE_SHA_PLACEHOLDER,
  validateAssetManifest,
} from "../app/pwaAssetManifest.js";

const manifest = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));
const webAppManifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));

test("the shipped distribution manifest is structurally valid", () => {
  assert.deepEqual(validateAssetManifest(manifest), { valid: true, errors: [] });
  assert.equal(manifest.schema, ASSET_MANIFEST_SCHEMA);
  assert.equal(manifest.version, RELEASE_VERSION);
  assert.equal(manifest.releaseSha, RELEASE_SHA_PLACEHOLDER);
});

test("the distribution manifest is regenerated from the game's own manifests", () => {
  // Fails when a sprite, visual, stage-object, or audio manifest changes
  // without the distribution manifest being rebuilt.
  execFileSync(process.execPath, ["scripts/build-asset-manifest.mjs", "--check"], { stdio: "pipe" });
});

test("every shipped asset extension is exempt from end-of-line conversion", async () => {
  // A text-ish asset such as an SVG would otherwise be checked out with CRLF on
  // Windows and LF on Linux. The manifest hashes bytes, so the pack generated
  // on one platform would declare a size and sha256 the other never serves,
  // and that asset would fail verification forever on the device.
  const gitattributes = await readFile(new URL("../.gitattributes", import.meta.url), "utf8");
  const extensions = new Set(
    manifest.assets.map((asset) => /\.[a-z0-9]+$/i.exec(asset.path)?.[0]?.toLowerCase()).filter(Boolean),
  );
  for (const extension of extensions) {
    assert.match(
      gitattributes,
      new RegExp(`^\\*\\${extension} -text$`, "m"),
      `${extension} assets must be marked -text in .gitattributes`,
    );
  }
});

test("the Pages build stamps the release SHA and verifies the published pack", async () => {
  // The manifest ships with a placeholder because the release commit does not
  // exist until the merge that creates it. The Pages build is the only place
  // that knows the real SHA, and the device compares hash, version, and release
  // SHA together, so an unstamped manifest would make that check vacuous.
  const build = await readFile(new URL("../scripts/build-github-pages.mjs", import.meta.url), "utf8");

  assert.match(build, /distribution\.releaseSha = releaseSha/, "the release SHA must be stamped in");
  assert.match(build, /was not stamped with the release SHA/, "the stamp must be read back and confirmed");
  assert.match(
    build,
    /distribution\.version !== releaseVersion/,
    "a manifest built for another version must fail the release",
  );
  // Bytes and digests must be checked against what will actually be served: a
  // mismatch is unrepairable on the device, so it has to fail the build.
  assert.match(build, /createHash\("sha256"\)/);
  assert.match(build, /does not match asset-manifest\.json/);
});

test("every pack carries assets and every first-install pack is represented", () => {
  const packs = new Set(manifest.assets.map((asset) => asset.pack));
  for (const pack of ASSET_PACK_IDS) assert.ok(packs.has(pack), `pack ${pack} has no assets`);
});

test("the pack excludes development, QA, and authoring reference art", () => {
  for (const asset of manifest.assets) {
    assert.doesNotMatch(asset.path, /\/reference\//, `${asset.path} is reference art`);
    assert.doesNotMatch(asset.path, /identity-(master|r\d)/, `${asset.path} is an authoring identity master`);
    assert.doesNotMatch(asset.path, /\.map$/, `${asset.path} is a source map`);
    assert.doesNotMatch(asset.path, /(^|\/)(qa|dev|gallery|sandbox)[-/]/i, `${asset.path} is not player-facing`);
  }
});

test("every sprite atlas the renderer can request is in the pack", async () => {
  // Guards the exclusion rules against over-reach: dropping one atlas would
  // make that unit, enemy, or boss unrenderable offline.
  const { spriteKinds, spriteSheetPath } = await import("../app/spriteManifest.js");
  const paths = new Set(manifest.assets.map((asset) => asset.path));
  for (const kind of spriteKinds) {
    assert.ok(paths.has(spriteSheetPath(kind)), `sprite atlas for ${kind} is missing from the pack`);
  }
});

test("the persistent battlefield fixtures are in the pack", async () => {
  const { V075_VISUAL_PROFILES } = await import("../app/visualProfiles.js");
  const paths = new Set(manifest.assets.map((asset) => asset.path));
  for (const runtimePath of [
    V075_VISUAL_PROFILES.crawler.closed.path,
    V075_VISUAL_PROFILES.crawler.open.path,
    V075_VISUAL_PROFILES.enemyBase.intact.path,
  ]) {
    assert.ok(paths.has(runtimePath), `${runtimePath} is drawn every battle and must ship`);
  }
});

test("every stage background reachable from the campaign is in the pack", async () => {
  const { PRODUCTION_VISUALS } = await import("../app/productionVisuals.js");
  const paths = new Set(manifest.assets.map((asset) => asset.path));
  for (const [stageId, background] of Object.entries(PRODUCTION_VISUALS.stages)) {
    assert.ok(paths.has(background), `background for ${stageId} is missing from the pack`);
  }
});

test("every audio source the mixer can play is in the pack", async () => {
  const { PRODUCTION_AUDIO_MANIFEST } = await import("../app/productionAudio.js");
  const paths = new Set(manifest.assets.map((asset) => asset.path));
  for (const audioAsset of PRODUCTION_AUDIO_MANIFEST.assets ?? []) {
    for (const source of audioAsset.sources ?? []) {
      assert.ok(paths.has(source.src), `${source.src} (${audioAsset.id}) is missing from the pack`);
    }
  }
});

test("battle-critical art is marked critical and audio never blocks play", () => {
  const byCategory = (category) => manifest.assets.filter((asset) => asset.category === category);

  for (const asset of [...byCategory("unit"), ...byCategory("enemy"), ...byCategory("boss")]) {
    assert.equal(asset.criticality, "critical", `${asset.path} must be critical`);
  }
  for (const asset of byCategory("audio")) {
    assert.equal(asset.criticality, "optional", `${asset.path} must not block play`);
    assert.ok(["bgm", "se", "voice"].includes(asset.audioChannel));
  }
});

test("the manifest covers playable units, enemies, bosses, backgrounds, and all audio channels", () => {
  const categories = new Set(manifest.assets.map((asset) => asset.category));
  for (const category of ["app", "background", "unit", "enemy", "boss", "portrait", "object", "audio"]) {
    assert.ok(categories.has(category), `category ${category} is missing from the pack`);
  }

  const channels = new Set(
    manifest.assets.filter((asset) => asset.category === "audio").map((asset) => asset.audioChannel),
  );
  for (const channel of ["bgm", "se", "voice"]) {
    assert.ok(channels.has(channel), `audio channel ${channel} is missing from the pack`);
  }
});

test("the home-screen icons are part of the first install", () => {
  const paths = new Set(manifest.assets.map((asset) => asset.path));
  for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"]) {
    assert.ok(paths.has(icon), `${icon} must ship in the app shell pack`);
  }
});

test("the web app manifest is installable, landscape, and standalone", () => {
  assert.equal(webAppManifest.display, "standalone");
  assert.equal(webAppManifest.orientation, "landscape");
  assert.equal(typeof webAppManifest.name, "string");
  assert.ok(webAppManifest.name.length > 0);
  assert.ok(webAppManifest.short_name.length > 0);
  assert.ok(webAppManifest.short_name.length <= 12);
  assert.equal(webAppManifest.theme_color, "#0b0d0d");
  assert.equal(webAppManifest.background_color, "#0b0d0d");
});

test("web app manifest URLs stay relative so the Pages base path works unchanged", () => {
  assert.equal(webAppManifest.start_url, "./");
  assert.equal(webAppManifest.scope, "./");
  for (const icon of webAppManifest.icons) {
    assert.doesNotMatch(icon.src, /^\//, `${icon.src} must be relative to the manifest`);
    assert.doesNotMatch(icon.src, /^https?:/, `${icon.src} must not be absolute`);
  }
});

test("the icon set provides 192, 512, and a maskable variant", () => {
  const bySize = new Map(webAppManifest.icons.map((icon) => [`${icon.sizes}:${icon.purpose}`, icon]));
  assert.ok(bySize.has("192x192:any"));
  assert.ok(bySize.has("512x512:any"));
  assert.ok(bySize.has("512x512:maskable"));
});

test("the manifest requests no camera, location, or notification capability", () => {
  const serialized = JSON.stringify(webAppManifest);
  for (const capability of ["camera", "geolocation", "notification", "microphone", "permissions"]) {
    assert.doesNotMatch(serialized, new RegExp(capability, "i"));
  }
});
