import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  CAMPAIGN_STAGE_IDS,
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
} from "../app/campaign.js";

const publicUrl = process.env.GITHUB_PAGES_PUBLIC_URL?.trim();
const expectedVersion = process.env.GITHUB_PAGES_EXPECTED_VERSION?.trim();
const expectedReleaseSha = process.env.GITHUB_PAGES_EXPECTED_RELEASE_SHA?.trim();
const expectedRequestId = process.env.GITHUB_PAGES_EXPECTED_REQUEST_ID?.trim();
const expectedIssueNumber = process.env.GITHUB_PAGES_EXPECTED_ISSUE_NUMBER?.trim();
if (!publicUrl) throw new Error("GITHUB_PAGES_PUBLIC_URL is required");
if (!expectedVersion || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))?(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u.test(expectedVersion)) {
  throw new Error("GITHUB_PAGES_EXPECTED_VERSION must be an unprefixed release version");
}
if (!expectedReleaseSha || !/^[0-9a-f]{40}$/u.test(expectedReleaseSha)) {
  throw new Error("GITHUB_PAGES_EXPECTED_RELEASE_SHA must be a 40-character lowercase SHA");
}
if (!expectedRequestId || !/^[0-9A-Za-z][0-9A-Za-z._-]{7,127}$/u.test(expectedRequestId)) {
  throw new Error("GITHUB_PAGES_EXPECTED_REQUEST_ID must be a safe release request identifier");
}
if (!expectedIssueNumber || !/^[1-9]\d*$/u.test(expectedIssueNumber)) {
  throw new Error("GITHUB_PAGES_EXPECTED_ISSUE_NUMBER must be a positive integer");
}

const evidenceDir = path.resolve(process.env.GITHUB_PAGES_EVIDENCE_DIR ?? "pages-evidence-public");
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const saveKey = "nishijin-campaign-v1";
const currentFixture = {
  ...createDefaultCampaignSave(),
  campaignStarted: true,
  readStoryEventIds: ["prologue-opening-v070", "prologue-summary-v070"],
  revision: 951,
  updatedAt: "2026-07-31T00:00:00.000Z",
};
currentFixture.unlockedStageIds = [
  ...new Set([...currentFixture.unlockedStageIds, CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]),
];
currentFixture.integrity = computeCampaignSaveIntegrity(currentFixture);
const release090Fixture = {
  ...currentFixture,
  survival: { ...currentFixture.survival },
  schemaVersion: 13,
  revision: 900,
  updatedAt: "2026-07-29T00:00:00.000Z",
};
delete release090Fixture.employmentNoticeReceipts;
delete release090Fixture.seenEmploymentNoticeIds;
delete release090Fixture.survival.highestReachedWave;
release090Fixture.integrity = computeCampaignSaveIntegrity(release090Fixture);
const publicCases = [
  { viewport: { width: 1280, height: 720 }, saveProfile: "fresh", scenario: "normal" },
  { viewport: { width: 844, height: 390 }, saveProfile: "v0.9.0-schema13", scenario: "normal" },
  { viewport: { width: 844, height: 340 }, saveProfile: "v0.9.5-schema14", scenario: "normal" },
  { viewport: { width: 844, height: 390 }, saveProfile: "v0.9.5-schema14", scenario: "idb-delay" },
  { viewport: { width: 844, height: 390 }, saveProfile: "v0.9.5-schema14", scenario: "idb-blocked" },
  { viewport: { width: 844, height: 390 }, saveProfile: "v0.9.5-schema14", scenario: "decode-hang" },
  { viewport: { width: 844, height: 390 }, saveProfile: "v0.9.5-schema14", scenario: "slow-network" },
  { viewport: { width: 844, height: 390 }, saveProfile: "v0.9.5-schema14", scenario: "optional-hang" },
];

async function advanceToMap(page) {
  for (let step = 0; step < 12; step += 1) {
    if (await page.locator(".map-screen").isVisible()) return;
    if (await page.locator(".event-screen").isVisible()) {
      await page.getByRole("button", { name: "スキップ", exact: true }).click();
      await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
      await page.waitForTimeout(100);
      continue;
    }
    await page.waitForTimeout(100);
  }
  await page.locator(".map-screen").waitFor({ state: "visible", timeout: 30_000 });
}

async function advanceToBattle(page) {
  for (let step = 0; step < 12; step += 1) {
    if (await page.locator('.game-shell[data-screen="battle"]').isVisible()) return;
    if (await page.locator(".event-screen").isVisible()) {
      await page.getByRole("button", { name: "スキップ", exact: true }).click();
      await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
      await page.waitForTimeout(100);
      continue;
    }
    await page.waitForTimeout(100);
  }
  await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout: 30_000 });
}

try {
  for (const { viewport, saveProfile, scenario } of publicCases) {
    const context = await browser.newContext({
      viewport,
      serviceWorkers: "block",
    });
    if (saveProfile !== "fresh") {
      await context.addInitScript(({ key, serialized }) => {
        localStorage.setItem(key, serialized);
      }, {
        key: saveKey,
        serialized: JSON.stringify(saveProfile === "v0.9.0-schema13" ? release090Fixture : currentFixture),
      });
    }
    if (scenario === "idb-delay") {
      await context.addInitScript(() => {
        Object.defineProperty(window, "indexedDB", {
          configurable: true,
          value: { open: () => ({}) },
        });
      });
    }
    if (scenario === "idb-blocked") {
      await context.addInitScript(() => {
        Object.defineProperty(window, "indexedDB", {
          configurable: true,
          value: {
            open() {
              const request = {};
              queueMicrotask(() => request.onblocked?.());
              return request;
            },
          },
        });
      });
    }
    if (scenario === "decode-hang") {
      await context.addInitScript(() => {
        HTMLImageElement.prototype.decode = () => new Promise(() => {});
      });
    }
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ "cache-control": "no-cache" });
    if (scenario === "slow-network") {
      await page.route("**/*.{png,webp}", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 350));
        await route.continue();
      });
    }
    if (scenario === "optional-hang") {
      await page.route("**/tactical-drop-pod-v1.png", () => {});
    }

    const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [], warnings: [] };
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
      if (message.type() === "warning") diagnostics.warnings.push(message.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
    page.on("requestfailed", (request) => {
      // ERR_ABORTED is a cancellation, not a fault. The game keeps pulling
      // battle art for as long as the page lives, so against the published
      // origin there is always something in flight when a scenario ends, and
      // which asset gets cancelled is pure timing. Excluding it is safe because
      // the response watcher below catches anything genuinely missing or broken
      // as an HTTP error, which a cancelled request never becomes.
      const reason = request.failure()?.errorText ?? "unknown";
      if (reason.includes("net::ERR_ABORTED")) return;
      diagnostics.requestFailures.push(`${request.url()} :: ${reason}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
    });

    const target = new URL(publicUrl);
    target.searchParams.set("qa_release", expectedReleaseSha);
    target.searchParams.set("qa_request", expectedRequestId);
    target.searchParams.set("qa_viewport", `${viewport.width}x${viewport.height}`);
    target.searchParams.set("qa_scenario", scenario);

    let navigation = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      Object.values(diagnostics).forEach((entries) => { entries.length = 0; });
      try {
        navigation = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 120_000 });
        if (navigation?.ok()) break;
        lastError = new Error(`HTTP ${navigation?.status() ?? "unknown"}`);
      } catch (error) {
        lastError = error;
      }
      await page.waitForTimeout(5_000);
    }
    if (!navigation?.ok()) throw new Error(`Published document failed after retries: ${String(lastError)}`);

    await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout: 120_000 });
    const pageTitle = await page.title();
    if (!pageTitle.includes(expectedVersion)) {
      throw new Error(`Published title does not identify Version ${expectedVersion}: ${pageTitle}`);
    }
    const versionMeta = await page.locator('meta[name="github-pages-version"]').getAttribute("content");
    const releaseMeta = await page.locator('meta[name="github-pages-release"]').getAttribute("content");
    const requestMeta = await page.locator('meta[name="github-pages-request-id"]').getAttribute("content");
    const issueMeta = await page.locator('meta[name="github-pages-issue"]').getAttribute("content");
    if (versionMeta !== expectedVersion) {
      throw new Error(`Published version metadata is ${versionMeta ?? "missing"}, expected ${expectedVersion}`);
    }
    if (releaseMeta !== expectedReleaseSha) {
      throw new Error(`Published release metadata is ${releaseMeta ?? "missing"}, expected ${expectedReleaseSha}`);
    }
    if (requestMeta !== expectedRequestId) {
      throw new Error(`Published request metadata is ${requestMeta ?? "missing"}, expected ${expectedRequestId}`);
    }
    if (issueMeta !== expectedIssueNumber) {
      throw new Error(`Published issue metadata is ${issueMeta ?? "missing"}, expected ${expectedIssueNumber}`);
    }

    // Since 0.9.6.4 a first visit meets the download entry screen before the
    // title. These scenarios are about the published game itself, and each one
    // starts from empty storage, so decline the download and play from the
    // network. The entry flow has its own coverage in the PWA matrix.
    const declineDownload = page.getByRole("button", { name: "ダウンロードせずに遊ぶ" });
    await declineDownload.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    if (await declineDownload.isVisible().catch(() => false)) await declineDownload.click();

    const startButton = page.locator(".title-start");
    await startButton.waitFor({ state: "visible", timeout: 30_000 });
    await page.locator('.save-environment-badge:not([data-save-environment="checking"])').waitFor({
      state: "visible",
      timeout: 30_000,
    });
    await page.locator('.game-shell:not([data-save-persistence="checking"])').waitFor({
      state: "visible",
      timeout: 30_000,
    });
    const saveEnvironment = await page.locator(".save-environment-badge").evaluate((element) => ({
      kind: element.getAttribute("data-save-environment"),
      origin: element.getAttribute("data-save-origin"),
    }));
    if (saveEnvironment.kind !== "github-pages" || saveEnvironment.origin !== new URL(publicUrl).origin) {
      throw new Error(`Published save environment is incorrect: ${JSON.stringify(saveEnvironment)}`);
    }
    if (!(await startButton.isEnabled())) {
      throw new Error("Published title start button stayed disabled after save hydration");
    }
    const savePersistence = await page.locator(".game-shell").getAttribute("data-save-persistence");
    if (scenario === "idb-delay" || scenario === "idb-blocked") {
      if (savePersistence !== "recovered") {
        throw new Error(`${scenario} did not settle as recovered: ${savePersistence}`);
      }
      if (!(await page.locator(".save-persistence-warning").isVisible())) {
        throw new Error(`${scenario} did not expose a player-facing degraded-storage reason`);
      }
      if (!(await page.getByRole("button", { name: "保存先を再確認", exact: true }).isEnabled())) {
        throw new Error(`${scenario} did not expose an enabled storage retry control`);
      }
    }
    const migrationNotice = page.locator(".migration-notice");
    if (await migrationNotice.isVisible()) {
      await migrationNotice.getByRole("button", { name: "内容を確認", exact: true }).click();
    }

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
      path: path.join(evidenceDir, `github-pages-public-title-${viewport.width}x${viewport.height}-${scenario}.png`),
      fullPage: true,
    });
    await startButton.click();
    await page.locator(".event-screen, .map-screen").first().waitFor({ state: "visible", timeout: 60_000 });
    await advanceToMap(page);
    const openStageNodes = page.locator(".stage-node.open");
    const openStageCount = await openStageNodes.count();
    if (openStageCount === 0) throw new Error("No selectable Stage was available on the published map");
    if (saveProfile !== "fresh" && openStageCount < 2) {
      throw new Error(`${saveProfile} fixture did not expose a second Stage for selection-change QA`);
    }
    const selectedStageNode = openStageNodes.nth(openStageCount > 1 ? 1 : 0);
    const selectedStageName = (await selectedStageNode.locator("b").innerText()).trim();
    await selectedStageNode.click();
    await page.locator(".stage-detail h2").filter({ hasText: selectedStageName }).waitFor({
      state: "visible",
      timeout: 30_000,
    });
    const prepareButton = page.getByRole("button", { name: "この作戦を編成", exact: true });
    if (!(await prepareButton.isEnabled())) throw new Error("Stage prepare button is disabled");
    await prepareButton.click();
    await page.locator(".formation-screen").waitFor({ state: "visible", timeout: 30_000 });
    // Must outlast ASSET_LOAD_SESSION_DEADLINE_MS, or this waits less time than
    // the app is entitled to take and reports a timeout of its own making. The
    // critical unit sheets are 14.1MB from the published origin.
    await page.locator('.game-shell[data-assets-state="ready"], .game-shell[data-assets-state="error"]').waitFor({
      state: "visible",
      timeout: 150_000,
    });
    const assetState = await page.locator(".game-shell").getAttribute("data-assets-state");
    if (assetState !== "ready") throw new Error(`Published critical assets did not become ready: ${assetState}`);
    const deployButton = page.locator(".formation-footer .campaign-primary");
    // The button enables on the same state change this just awaited, so give
    // React its render rather than sampling the instant the attribute flips.
    await page.waitForFunction(() => {
      const button = document.querySelector(".formation-footer .campaign-primary");
      return Boolean(button) && !button.disabled;
    }, null, { timeout: 30_000 }).catch(() => {});
    if (!(await deployButton.isEnabled())) throw new Error("Published deploy button stayed disabled");
    await page.screenshot({
      path: path.join(evidenceDir, `github-pages-public-loadout-${viewport.width}x${viewport.height}-${scenario}.png`),
      fullPage: true,
    });
    await deployButton.click();
    await advanceToBattle(page);
    await page.screenshot({
      path: path.join(evidenceDir, `github-pages-public-battle-${viewport.width}x${viewport.height}-${scenario}.png`),
      fullPage: true,
    });

    // This run blocks service workers on purpose (see `serviceWorkers: "block"`
    // above) so the published game flow is exercised straight from the network
    // rather than from a worker cache. Since Version 0.9.6 the page registers
    // one, so Chromium now reports that the harness refused it. That warning is
    // this harness describing its own setting, not a fault in the site, and the
    // worker itself is covered by the PWA browser matrix.
    const ALLOWED_WARNINGS = [
      "was preloaded using link preload but not used",
      "Service Worker registration blocked by Playwright",
    ];
    const unexpectedWarnings = diagnostics.warnings.filter(
      (warning) => !ALLOWED_WARNINGS.some((allowed) => warning.includes(allowed)),
    );
    if (diagnostics.consoleErrors.length || diagnostics.pageErrors.length || diagnostics.requestFailures.length || diagnostics.httpErrors.length || unexpectedWarnings.length) {
      throw new Error(`Published browser diagnostics failed: ${JSON.stringify({ ...diagnostics, warnings: unexpectedWarnings })}`);
    }

    results.push({
      viewport,
      saveProfile,
      scenario,
      selectedStageName,
      title: pageTitle,
      versionMeta,
      releaseMeta,
      requestMeta,
      issueMeta,
      saveEnvironment,
      savePersistence,
      assetState,
      reachedBattle: true,
      dimensions,
      warningCount: diagnostics.warnings.length,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const summary = {
  url: publicUrl,
  expectedVersion,
  expectedReleaseSha,
  expectedRequestId,
  expectedIssueNumber,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
