import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Ashfall Outpost Ver.1.1", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ASHFALL OUTPOST Ver\.1\.1/);
  assert.match(html, /aria-label="ASHFALL OUTPOST game"/);
  assert.match(html, /<canvas[^>]*width="960"[^>]*height="540"/);
  assert.match(html, /BEGIN OPERATION/);
  assert.match(html, /AIRSTRIKE/);
  assert.match(html, /VER 1\.1 · VISUAL COMBAT UPDATE/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the upgraded battlefield and combat systems", async () => {
  const [game, css, layout] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  await access(new URL("../public/battlefield-v2.png", import.meta.url));
  assert.match(game, /battlefield-v2\.png/);
  assert.match(game, /abomination/);
  assert.match(game, /spitter/);
  assert.match(game, /damageTexts/);
  assert.match(game, /corpses/);
  assert.match(game, /comboTime/);
  assert.match(css, /orientation:portrait/);
  assert.match(layout, /ASHFALL OUTPOST Ver\.1\.1/);
});
