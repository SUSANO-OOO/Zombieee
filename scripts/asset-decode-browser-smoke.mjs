import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.ASSET_DECODE_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Asset decode QA is local-only; refusing ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const evidenceDir = path.resolve(process.env.ASSET_DECODE_QA_EVIDENCE_DIR ?? "outputs/asset-decode-browser-smoke");
const timeout = Math.max(30_000, Number(process.env.ASSET_DECODE_QA_TIMEOUT_MS) || 180_000);
const browser = await playwright.chromium.launch({ headless: true });
const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
let result;

await mkdir(evidenceDir, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "16",
    state: "start",
    decode: "assets",
  }).toString();
  await page.goto(String(url), { waitUntil: "domcontentloaded", timeout });
  await page.waitForFunction(
    () => ["passed", "failed"].includes(document.documentElement.dataset.assetDecodeStatus ?? ""),
    undefined,
    { timeout },
  );
  result = await page.evaluate(async () => {
    const root = document.documentElement.dataset;
    const bridge = window.__ASHFALL_AUDIO_QA__;
    const carbineAssets = bridge.assets.filter(({ id }) => id.startsWith("weapon-suppressed-carbine-"));
    const carbinePool = bridge.pools.find(({ id }) => id === "weapon-suppressed-carbine");
    const played = await bridge.play("weapon-suppressed-carbine", {
      priority: 90,
      dedupeKey: "v080-carbine-browser-smoke",
    });
    return {
      status: root.assetDecodeStatus,
      audioRequested: Number(root.assetDecodeAudioRequested),
      audioDecoded: Number(root.assetDecodeAudioDecoded),
      portraitRequested: Number(root.assetDecodePortraitRequested),
      portraitDecoded: Number(root.assetDecodePortraitDecoded),
      imageRequested: Number(root.assetDecodeImageRequested),
      imageDecoded: Number(root.assetDecodeImageDecoded),
      failures: JSON.parse(root.assetDecodeFailures ?? "[]"),
      carbineAssets,
      carbinePool,
      carbinePlayed: Boolean(played),
      diagnostics: bridge.getDiagnostics(),
    };
  });
  if (result.status !== "passed"
    || result.audioDecoded !== result.audioRequested
    || result.portraitDecoded !== result.portraitRequested
    || result.imageDecoded !== result.imageRequested
    || result.failures.length > 0
    || result.carbineAssets.length !== 2
    || result.carbinePool?.assetIds?.length !== 2
    || !result.carbinePlayed
    || Object.values(diagnostics).some((entries) => entries.length > 0)) {
    throw new Error(`Asset decode QA failed: ${JSON.stringify({ result, diagnostics })}`);
  }
  await context.close();
} finally {
  await browser.close();
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  engine: "chromium",
  result,
  diagnostics,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
