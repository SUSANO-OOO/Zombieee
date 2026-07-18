import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const publicUrl = process.env.GITHUB_PAGES_PUBLIC_URL?.trim();
const expectedReleaseSha = process.env.GITHUB_PAGES_EXPECTED_RELEASE_SHA?.trim();
if (!publicUrl) throw new Error("GITHUB_PAGES_PUBLIC_URL is required");
if (!expectedReleaseSha || !/^[0-9a-f]{40}$/u.test(expectedReleaseSha)) {
  throw new Error("GITHUB_PAGES_EXPECTED_RELEASE_SHA must be a 40-character lowercase SHA");
}

const evidenceDir = path.resolve("pages-evidence-public");
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
    { width: 844, height: 340 },
  ]) {
    const context = await browser.newContext({
      viewport,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ "cache-control": "no-cache" });

    const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], warnings: [] };
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "warning") diagnostics.warnings.push(message.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
    page.on("requestfailed", (request) => diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));

    const target = new URL(publicUrl);
    target.searchParams.set("qa_release", expectedReleaseSha);
    target.searchParams.set("qa_viewport", `${viewport.width}x${viewport.height}`);

    let navigation = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      try {
        navigation = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 120_000 });
        if (navigation?.ok()) break;
        lastError = new Error(`HTTP ${navigation?.status() ?? "unknown"}`);
      } catch (error) {
        lastError = error;
      }
      await page.waitForTimeout(10_000);
    }
    if (!navigation?.ok()) throw new Error(`Published document failed after retries: ${String(lastError)}`);

    await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout: 120_000 });
    const releaseMeta = await page.locator('meta[name="github-pages-release"]').getAttribute("content");
    if (releaseMeta !== expectedReleaseSha) {
      throw new Error(`Published release metadata is ${releaseMeta ?? "missing"}, expected ${expectedReleaseSha}`);
    }

    const startButton = page.locator(".title-start");
    await startButton.waitFor({ state: "visible", timeout: 30_000 });

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
    }));
    if (dimensions.documentWidth !== viewport.width || dimensions.bodyWidth !== viewport.width) {
      throw new Error(`Horizontal overflow at ${viewport.width}x${viewport.height}: ${JSON.stringify(dimensions)}`);
    }

    await page.screenshot({
      path: path.join(evidenceDir, `github-pages-public-title-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
    await startButton.click();
    await page.locator(".event-screen, .map-screen").first().waitFor({ state: "visible", timeout: 60_000 });

    const unexpectedWarnings = diagnostics.warnings.filter((warning) => !warning.includes("was preloaded using link preload but not used"));
    if (diagnostics.consoleErrors.length || diagnostics.pageErrors.length || diagnostics.requestFailures.length || unexpectedWarnings.length) {
      throw new Error(`Published browser diagnostics failed: ${JSON.stringify({ ...diagnostics, warnings: unexpectedWarnings })}`);
    }

    results.push({
      viewport,
      title: await page.title(),
      releaseMeta,
      dimensions,
      warningCount: diagnostics.warnings.length,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const summary = { url: publicUrl, expectedReleaseSha, results };
await writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
