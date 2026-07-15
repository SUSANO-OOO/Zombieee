import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PRODUCTION_AUDIO_MANIFEST } from "../app/productionAudio.js";
import { PRODUCTION_VISUALS } from "../app/productionVisuals.js";
import { CHARACTER_PORTRAIT_ART, PORTRAIT_ART, SPRITE_MANIFEST } from "../app/spriteManifest.js";
import { STAGE_OBJECT_MANIFEST } from "../app/stageObjectManifest.js";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function flattenVisualPaths() {
  return [
    PRODUCTION_VISUALS.title,
    PRODUCTION_VISUALS.command,
    PRODUCTION_VISUALS.guide,
    ...Object.values(PRODUCTION_VISUALS.stages),
    ...Object.values(CHARACTER_PORTRAIT_ART),
    ...Object.values(PORTRAIT_ART),
    ...Object.values(SPRITE_MANIFEST).map(({ path: spritePath }) => spritePath),
    ...Object.values(STAGE_OBJECT_MANIFEST).flatMap((stage) => [
      stage.backgroundPath,
      ...stage.objects.flatMap((object) => [object.path, object.replacesRuntimeSprite].filter(Boolean)),
    ]),
  ];
}

function expectedContentType(assetPath) {
  if (assetPath.endsWith(".mp3")) return "audio/mpeg";
  if (assetPath.endsWith(".ogg")) return "audio/ogg";
  if (assetPath.endsWith(".png")) return "image/png";
  if (assetPath.endsWith(".webp")) return "image/webp";
  if (assetPath.endsWith(".css")) return "text/css";
  if (assetPath.endsWith(".js")) return "application/javascript";
  throw new RangeError(`Unknown production asset type: ${assetPath}`);
}

async function fetchBatch(origin, assetPaths) {
  const results = [];
  for (let offset = 0; offset < assetPaths.length; offset += 20) {
    const batch = assetPaths.slice(offset, offset + 20);
    results.push(...await Promise.all(batch.map(async (assetPath) => {
      const response = await fetch(`${origin}${assetPath}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { assetPath, response, bytes };
    })));
  }
  return results;
}

test("the production server returns every manifest asset with a nonempty body and exact MIME type", { timeout: 120_000 }, async () => {
  // vinext 0.0.50 stores Windows path.relative() results as cache keys. HTTP
  // paths use slashes, so apply the same narrowly scoped compatibility fix as
  // scripts/run-vinext.mjs before loading its production server.
  if (process.platform === "win32") {
    const platformRelative = path.relative;
    path.relative = (...args) => platformRelative(...args).replaceAll(path.sep, "/");
  }
  const { CONTENT_TYPES } = await import("../node_modules/vinext/dist/server/static-file-cache.js");
  CONTENT_TYPES[".mp3"] = "audio/mpeg";
  CONTENT_TYPES[".ogg"] = "audio/ogg";
  const { startProdServer } = await import("../node_modules/vinext/dist/server/prod-server.js");
  const { server, port } = await startProdServer({
    port: 0,
    host: "127.0.0.1",
    outDir: path.join(repositoryRoot, "dist"),
  });
  const origin = `http://127.0.0.1:${port}`;
  try {
    const rootResponse = await fetch(`${origin}/`);
    const html = await rootResponse.text();
    assert.equal(rootResponse.status, 200);
    assert.match(rootResponse.headers.get("content-type") ?? "", /^text\/html/);
    assert.ok(html.length > 1_000);

    const clientAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]);
    assert.ok(clientAssets.some((assetPath) => assetPath.endsWith(".js")));
    assert.ok(clientAssets.some((assetPath) => assetPath.endsWith(".css")));

    const audioPaths = PRODUCTION_AUDIO_MANIFEST.assets.flatMap((asset) => asset.sources.map(({ src }) => src));
    const assetPaths = [...new Set([...clientAssets, ...audioPaths, ...flattenVisualPaths()])].sort();
    assert.ok(assetPaths.length >= 300);
    const results = await fetchBatch(origin, assetPaths);
    for (const { assetPath, response, bytes } of results) {
      assert.equal(response.status, 200, assetPath);
      assert.equal(response.headers.get("content-type"), expectedContentType(assetPath), assetPath);
      assert.ok(bytes.length > 64, assetPath);
    }
    assert.equal(results.length, assetPaths.length);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
