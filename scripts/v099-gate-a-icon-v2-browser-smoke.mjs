import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.V099_GATE_A_ICON_V2_BASE_URL ?? "http://127.0.0.1:4180/");
if (!["127.0.0.1", "localhost"].includes(baseUrl.hostname)) throw new Error(`local-only smoke: ${baseUrl}`);
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const reportDir = path.resolve("outputs/v099-gate-a-icon-v2-browser-smoke");
await mkdir(reportDir, { recursive: true });
const cases = [
  { engine: "chromium", viewport: { width: 1280, height: 720 } },
  { engine: "chromium", viewport: { width: 844, height: 390 } },
  { engine: "webkit", viewport: { width: 844, height: 390 } },
];
const results = [];
for (const testCase of cases) {
  const browser = await playwright[testCase.engine].launch({ headless: true });
  const context = await browser.newContext({ viewport: testCase.viewport });
  const page = await context.newPage();
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (m) => { if (m.type() === "error") diagnostics.consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => diagnostics.pageErrors.push(String(e)));
  page.on("requestfailed", (r) => diagnostics.requestFailures.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.status() >= 400) diagnostics.httpErrors.push(`${r.status()} ${r.url()}`); });
  try {
    const response = await page.goto(String(baseUrl), { waitUntil: "networkidle", timeout: 30_000 });
    if (!response?.ok()) throw new Error(`navigation ${response?.status()}`);
    if (!await page.getByRole("heading", { name: /Gate A Icon-only Candidate v2/ }).isVisible()) throw new Error("heading missing");
    const evidence = await page.evaluate(async () => {
      const report = await fetch("candidate-report.json").then((r) => r.json());
      const images = [...document.images];
      for (const image of images) image.loading = "eager";
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
      return {
        head: report.head,
        candidates: report.candidates.length,
        productionIconWiring: report.productionIconWiring,
        audio: report.audio,
        vfx: report.vfx,
        imageCount: images.length,
        brokenImages: images.filter((image) => image.naturalWidth === 0).map((image) => image.src),
        documentWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    if (evidence.candidates !== 3 || evidence.imageCount !== 28) throw new Error(`candidate/image count ${JSON.stringify(evidence)}`);
    if (evidence.productionIconWiring !== false || evidence.audio !== "approved and fixed" || evidence.vfx !== "approved and fixed") throw new Error("Gate A boundary drift");
    if (evidence.brokenImages.length || evidence.documentWidth > evidence.innerWidth) throw new Error(`render failure ${JSON.stringify(evidence)}`);
    if (Object.values(diagnostics).some((items) => items.length)) throw new Error(`diagnostics ${JSON.stringify(diagnostics)}`);
    const screenshot = path.join(reportDir, `${testCase.engine}-${testCase.viewport.width}x${testCase.viewport.height}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ ...testCase, status: "passed", evidence, diagnostics, screenshot });
  } catch (error) {
    results.push({ ...testCase, status: "failed", error: String(error), diagnostics });
  } finally {
    await context.close();
    await browser.close();
  }
}
const report = { generatedAt: new Date().toISOString(), baseUrl: String(baseUrl), passed: results.filter((r) => r.status === "passed").length, failed: results.filter((r) => r.status === "failed").length, results };
await writeFile(path.join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exit(1);
