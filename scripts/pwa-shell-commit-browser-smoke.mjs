// Real Service Worker/Cache Storage proof of first-install and update shell gates.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const workerBytes = await readFile(new URL("../public/sw.js", import.meta.url));
let releaseSha = "shell-a";
let failure = null;
let onHeldCssRequest = null;
const heldCssResponses = [];
const server = createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const send = (status, type, body) => {
    response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    response.end(body);
  };
  if (pathname === "/Zombieee/sw.js") return send(200, "application/javascript", workerBytes);
  if (pathname === "/Zombieee/pwa-shell.json") return send(200, "application/json", JSON.stringify({
    files: ["assets/base.js", "assets/base.css"],
  }));
  if (pathname === "/Zombieee/" || pathname === "/Zombieee/v100/") {
    if (failure === "root" && pathname === "/Zombieee/") return send(503, "text/plain", "offline root");
    const route = pathname.includes("v100") ? "v100" : "root";
    return send(200, "text/html", `<!doctype html><html><head><meta name="github-pages-release" content="${releaseSha}"><link rel="stylesheet" href="/Zombieee/assets/base.css"></head><body data-route="${route}"><script src="/Zombieee/assets/base.js"></script></body></html>`);
  }
  if (pathname === "/Zombieee/assets/base.js") {
    return send(200, "application/javascript", `window.__shellBoot = ${JSON.stringify(releaseSha)};`);
  }
  if (pathname === "/Zombieee/assets/base.css") {
    if (failure === "css") return send(503, "text/plain", "missing css");
    if (failure === "delay-css") {
      heldCssResponses.push(response);
      onHeldCssRequest?.();
      return undefined;
    }
    return send(200, "text/css", "body{color:rgb(1,2,3)}");
  }
  if (pathname === "/Zombieee/asset-manifest.json") return send(200, "application/json", "{}");
  if (pathname === "/Zombieee/release.json") return send(200, "application/json", "{}");
  if (pathname === "/Zombieee/manifest.webmanifest") return send(200, "application/manifest+json", "{}");
  return send(404, "text/plain", "not found");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/Zombieee/`;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const checks = [];
const manifest = (sha) => ({ version: "1.0.0", releaseSha: sha, assets: [
  { path: "/art/probe.png", hash: `sha256-${"0".repeat(64)}`, bytes: 1 },
] });
const ask = (message, fromPage = page) => fromPage.evaluate(async (data) => {
  const registration = await navigator.serviceWorker.ready;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data);
    registration.active.postMessage(data, [channel.port2]);
  });
}, message);
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  failure = "root";
  const firstFailure = await ask({ type: "pwa:commit-manifest", manifest: manifest("shell-a") });
  const firstState = await ask({ type: "pwa:get-state" });
  assert.equal(firstFailure.type, "pwa:commit-failed");
  assert.equal(firstState.active, null);
  checks.push("first install keeps its gate closed when root HTML cannot warm");

  failure = null;
  const firstSuccess = await ask({ type: "pwa:commit-manifest", manifest: manifest("shell-a") });
  assert.equal(firstSuccess.type, "pwa:committed");
  assert.equal((await ask({ type: "pwa:get-state" })).active.releaseSha, "shell-a");
  checks.push("complete root, V100, JS, and CSS shell commits");

  releaseSha = "shell-b";
  failure = "css";
  const updateFailure = await ask({ type: "pwa:commit-manifest", manifest: manifest("shell-b") });
  const updateState = await ask({ type: "pwa:get-state" });
  assert.equal(updateFailure.type, "pwa:commit-failed");
  assert.equal(updateState.active.releaseSha, "shell-a");
  assert.equal(updateState.previous, null);
  checks.push("missing update CSS leaves the old active generation intact");

  failure = null;
  const updateSuccess = await ask({ type: "pwa:commit-manifest", manifest: manifest("shell-b") });
  const finalState = await ask({ type: "pwa:get-state" });
  assert.equal(updateSuccess.type, "pwa:committed");
  assert.equal(finalState.active.releaseSha, "shell-b");
  assert.equal(finalState.previous.releaseSha, "shell-a");
  checks.push("successful update retains the prior generation");

  await context.setOffline(true);
  assert.equal((await ask({ type: "pwa:rollback" })).type, "pwa:rolled-back");
  const recovered = await ask({ type: "pwa:commit-manifest", manifest: manifest("shell-b") });
  assert.equal(recovered.type, "pwa:committed");
  assert.equal((await ask({ type: "pwa:get-state" })).active.releaseSha, "shell-b");
  checks.push("a fully cached candidate can be committed again while offline");
  for (const [route, expected] of [["", "root"], ["v100/", "v100"]]) {
    await page.goto(new URL(route, base).toString(), { waitUntil: "load" });
    const actual = await page.evaluate(() => ({
      route: document.body.dataset.route,
      shell: window.__shellBoot,
      css: getComputedStyle(document.body).color,
    }));
    assert.deepEqual(actual, { route: expected, shell: "shell-b", css: "rgb(1, 2, 3)" });
    checks.push(`${expected} launches offline with its own HTML and the active JS/CSS`);
  }

  await context.setOffline(false);
  const otherPage = await context.newPage();
  await otherPage.goto(base, { waitUntil: "domcontentloaded" });
  releaseSha = "shell-c";
  failure = "delay-css";
  const cssRequested = new Promise((resolve) => { onHeldCssRequest = resolve; });
  const pendingCommit = ask({ type: "pwa:commit-manifest", manifest: manifest("shell-c") });
  await Promise.race([
    cssRequested,
    new Promise((_, reject) => setTimeout(() => reject(new Error("concurrent commit never reached the delayed CSS")), 10_000)),
  ]);
  const rollbackDuringWarm = await ask({ type: "pwa:rollback" }, otherPage);
  const supersededCommit = await pendingCommit;
  failure = null;
  for (const response of heldCssResponses) response.end("body{color:rgb(1,2,3)}");
  const afterRollback = await ask({ type: "pwa:get-state" });
  assert.equal(rollbackDuringWarm.type, "pwa:rolled-back");
  assert.deepEqual({ type: supersededCommit.type, reason: supersededCommit.reason }, {
    type: "pwa:commit-failed", reason: "superseded",
  });
  assert.equal(afterRollback.active.releaseSha, "shell-a");
  assert.equal(afterRollback.previous, null);
  assert.equal(await page.evaluate(() => caches.has("zombieee-shell-1.0.0-shell-a")), true);
  checks.push("another tab can roll back while a newer shell warms without being overwritten");
  await context.setOffline(true);
  await page.goto(base, { waitUntil: "load" });
  assert.equal(await page.evaluate(() => window.__shellBoot), "shell-a");
  checks.push("the rolled-back generation still launches offline after the concurrent request");

  await context.setOffline(false);
  failure = "delay-css";
  releaseSha = "shell-c";
  const secondCssRequested = new Promise((resolve) => { onHeldCssRequest = resolve; });
  const competingCommit = ask({ type: "pwa:commit-manifest", manifest: manifest("shell-c") });
  await Promise.race([
    secondCssRequested,
    new Promise((_, reject) => setTimeout(() => reject(new Error("competing commit never reached the delayed CSS")), 10_000)),
  ]);
  releaseSha = "shell-d";
  failure = null;
  const newestCommit = ask({ type: "pwa:commit-manifest", manifest: manifest("shell-d") }, otherPage);
  const supersededByCommit = await competingCommit;
  const latestResult = await newestCommit;
  for (const response of heldCssResponses) {
    if (!response.writableEnded) response.end("body{color:rgb(1,2,3)}");
  }
  const finalConcurrentState = await ask({ type: "pwa:get-state" });
  assert.deepEqual({ type: supersededByCommit.type, reason: supersededByCommit.reason }, {
    type: "pwa:commit-failed", reason: "superseded",
  });
  assert.equal(latestResult.type, "pwa:committed");
  assert.equal(finalConcurrentState.active.releaseSha, "shell-d");
  assert.equal(finalConcurrentState.previous.releaseSha, "shell-a");
  checks.push("overlapping commits choose the latest request and retain the outgoing generation");
  console.log(JSON.stringify({ status: "passed", checks, base }, null, 2));
} finally {
  for (const response of heldCssResponses) {
    if (!response.writableEnded) response.end();
  }
  await context.setOffline(false).catch(() => {});
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
