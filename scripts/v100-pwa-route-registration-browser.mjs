import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const engine = process.env.V100_ROUTE_ENGINE ?? "chromium";
const root = path.resolve("_site");
const out = path.resolve(process.env.V100_ROUTE_OUT ?? "outputs/v100-pwa-route-registration");
await mkdir(out, { recursive: false });
const report = { engine, scope: "Real worker registration and controlled reload at the root and both nested URL forms; fresh isolated browser context per route", build: await productionBuildIdentity(), workerSha256: createHash("sha256").update(await readFile(path.join(root, "sw.js"))).digest("hex"), cases: [] };
const port = await new Promise((resolve, reject) => {
  const socket = createServer(); socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => { const value = socket.address().port; socket.close(() => resolve(value)); });
});
const server = spawn(process.execPath, ["scripts/serve-pages-candidate.mjs", root], {
  env: { ...process.env, PAGES_CANDIDATE_PORT: String(port) }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned static server did not start")), 15000);
    server.once("error", reject);
    server.stdout.on("data", chunk => { if (String(chunk).includes('"url"')) { clearTimeout(timer); resolve(); } });
  });
  browser = await (await pwaBrowserType(engine)).launch();
  const base = "http://127.0.0.1:" + port + "/Zombieee/";
  for (const suffix of ["", "v100", "v100/"]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 340 } });
    const record = { url: base + suffix, errors: [], workerRequests: [] };
    report.cases.push(record);
    try {
      const page = await context.newPage(); page.setDefaultTimeout(45000);
      page.on("pageerror", error => record.errors.push(String(error)));
      page.on("console", message => { if (message.type() === "error") record.errors.push(message.text()); });
      context.on("request", request => { if (request.url().includes("sw.js")) record.workerRequests.push(request.url()); });
      await page.goto(record.url, { waitUntil: "domcontentloaded" });
      record.registration = await page.evaluate(async () => {
        let timer;
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Worker did not activate within 45 seconds")), 45000); }),
        ]).finally(() => clearTimeout(timer));
        return { scope: registration.scope, scriptURL: registration.active.scriptURL };
      });
      assert.deepEqual(record.registration, { scope: base, scriptURL: base + "sw.js" });
      const worker = await page.evaluate(async url => {
        const response = await fetch(url, { cache: "no-store" });
        return { status: response.status, type: response.headers.get("content-type"), source: await response.text() };
      }, record.registration.scriptURL);
      assert.equal(worker.status, 200); assert.match(worker.type, /javascript/);
      record.fetchedWorkerSha256 = createHash("sha256").update(worker.source).digest("hex");
      assert.equal(record.fetchedWorkerSha256, report.workerSha256);
      await page.reload({ waitUntil: "networkidle" });
      record.controller = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
      assert.equal(record.controller, base + "sw.js");
      assert.deepEqual(record.errors, []);
      assert.ok(record.workerRequests.length > 0);
      assert.ok(record.workerRequests.every(url => url === base + "sw.js"));
      record.status = "passed";
    } catch (error) { record.status = "failed"; record.error = String(error); throw error; }
    finally { await context.close(); await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
  }
  report.status = "passed";
} catch (error) { report.status = "failed"; report.error = String(error); process.exitCode = 1; }
finally {
  await browser?.close(); server.kill();
  report.buildAfter = await productionBuildIdentity();
  assert.equal(report.build.combinedSha256, report.buildAfter.combinedSha256);
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, engine, cases: report.cases.length, error: report.error }));
