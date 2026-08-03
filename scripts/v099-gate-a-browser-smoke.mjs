import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.V099_GATE_A_BASE_URL ?? "http://127.0.0.1:4179/");
if (!["127.0.0.1", "localhost"].includes(baseUrl.hostname)) {
  throw new Error(`Gate A smoke is local-only: ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const reportDir = path.resolve("outputs/v099-gate-a-browser-smoke");
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
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText}`));
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  try {
    const response = await page.goto(String(baseUrl), { waitUntil: "networkidle", timeout: 30_000 });
    if (!response?.ok()) throw new Error(`navigation ${response?.status()}`);
    if (!await page.getByRole("heading", { name: /Gate A Creative Acceptance Package/ }).isVisible()) {
      throw new Error("Gate A heading is not visible");
    }
    const evidence = await page.evaluate(async () => {
      const images = [...document.images];
      for (const image of images) image.loading = "eager";
      await Promise.all(images.map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => image.addEventListener("load", resolve, { once: true }))));
      const candidateReport = await fetch("candidate-report.json").then((value) => value.json());
      const audioUrls = [
        ...Object.values(candidateReport.audio.music).map(({ url }) => url),
        ...candidateReport.audio.abilities.flatMap(({ ready, root, timeline }) => [ready.url, root.url, ...timeline.map(({ url }) => url)]),
        ...candidateReport.audio.support.map(({ url }) => url),
      ];
      const audioStatuses = await Promise.all([...new Set(audioUrls)].map(async (url) => ({
        url,
        status: (await fetch(url, { headers: { Range: "bytes=0-31" } })).status,
      })));
      return {
        head: candidateReport.head,
        iconCandidates: candidateReport.iconCandidates.length,
        abilityContracts: candidateReport.audio.abilities.length,
        supportCues: candidateReport.audio.support.length,
        brokenImages: images.filter((image) => image.naturalWidth === 0).map((image) => image.src),
        audioStatuses,
        documentWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        mpegCapability: new Audio().canPlayType("audio/mpeg"),
      };
    });
    if (evidence.iconCandidates !== 3) throw new Error(`icon candidates ${evidence.iconCandidates}`);
    if (evidence.abilityContracts !== 16) throw new Error(`ability contracts ${evidence.abilityContracts}`);
    if (evidence.supportCues !== 5) throw new Error(`support cues ${evidence.supportCues}`);
    if (evidence.brokenImages.length) throw new Error(`broken images ${JSON.stringify(evidence.brokenImages)}`);
    if (evidence.audioStatuses.some(({ status }) => ![200, 206].includes(status))) {
      throw new Error(`audio status failure ${JSON.stringify(evidence.audioStatuses)}`);
    }
    if (evidence.documentWidth > evidence.innerWidth) throw new Error("horizontal overflow");
    let audioPlaybackAvailable = false;
    if (evidence.mpegCapability) {
      await page.getByRole("button", { name: "Normal surface" }).click();
      await page.waitForFunction(() => {
        const value = document.querySelector("#status")?.textContent ?? "";
        return value === "scene: normal" || value.startsWith("このbrowserでは音声を再生できません");
      });
      audioPlaybackAvailable = await page.locator("#status").textContent() === "scene: normal";
      if (audioPlaybackAvailable) {
        await page.getByRole("button", { name: "Play full lifecycle" }).click();
        await page.waitForTimeout(650);
      }
    }
    evidence.audioPlaybackAvailable = audioPlaybackAvailable;
    evidence.audioCapabilityGap = !audioPlaybackAvailable;
    await page.getByRole("button", { name: "Stop all audio" }).click();
    await page.waitForFunction(() => document.querySelector("#status")?.textContent === "all audio stopped");
    const unexpectedRequestFailures = diagnostics.requestFailures.filter((failure) => !(
      evidence.audioCapabilityGap
      && failure.includes("/audio/music-battle-stage3.mp3")
      && failure.includes("Load request cancelled")
    ));
    if (diagnostics.consoleErrors.length || diagnostics.pageErrors.length || unexpectedRequestFailures.length || diagnostics.httpErrors.length) {
      throw new Error(`diagnostics ${JSON.stringify(diagnostics)}`);
    }
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

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status === "failed").length,
  results,
};
await writeFile(path.join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exit(1);
