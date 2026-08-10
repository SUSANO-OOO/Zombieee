import { createHash } from "node:crypto";
import { appendFile, readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  MOBILE_BATTLE_HUD_TYPOGRAPHY,
  mobileBattleHudLayout,
} from "../app/battleHudLayout.js";
import {
  CRAWLER_DEPLOYMENT_CHECKPOINTS,
  crawlerDeploymentUnitFamily,
} from "../app/crawlerDeployment.js";
import {
  CRAWLER_AIRSTRIKE_SPRITE_PHASES,
  CRAWLER_BARRAGE_SPRITE_PHASES,
  V099_CRAWLER_RUNTIME_PROFILE,
  crawlerAirstrikeSpritePhase,
  crawlerBarrageSpritePhase,
  resolveCrawlerEquipmentFrame,
} from "../app/crawlerEquipmentSprites.js";
import { AIRSTRIKE_DEF, CRAWLER_BARRAGE_DEF } from "../app/gameRules.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

const baseUrl = new URL(
  process.env.V099_FINAL_REMEDIATION_QA_BASE_URL
    ?? process.env.V099_PRESENTATION_QA_BASE_URL
    ?? "http://127.0.0.1:4177/",
);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.9.0 final-remediation QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const canonicalEngines = ["chromium", "webkit"];
const canonicalCaseTypes = ["hud", "crawler-equipment", "deployment"];
const canonicalViewports = [
  { width: 667, height: 375 },
  { width: 736, height: 414 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
  { width: 1280, height: 720 },
];
const canonicalDeploymentUnits = Object.freeze([
  Object.freeze({ family: "hachi", kind: "scout" }),
  Object.freeze({ family: "mizuchi", kind: "ranger" }),
  Object.freeze({ family: "paisen", kind: "brawler" }),
  Object.freeze({ family: "crazy-king", kind: "crazy-king" }),
  Object.freeze({ family: "mayo-chan", kind: "mayo-chan" }),
  Object.freeze({ family: "tatara", kind: "brute" }),
  Object.freeze({ family: "standard-human", kind: "medic" }),
]);

function parseUniqueAxis(name, rawValue, allowedValues) {
  const values = rawValue.split(",").map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) throw new Error(`${name} must not be empty`);
  if (new Set(values).size !== values.length) throw new Error(`${name} contains duplicate entries`);
  const unsupported = values.filter((value) => !allowedValues.includes(value));
  if (unsupported.length > 0) throw new Error(`${name} contains unsupported entries: ${unsupported.join(",")}`);
  return values;
}

const engines = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_ENGINES",
  process.env.V099_FINAL_REMEDIATION_QA_ENGINES ?? canonicalEngines.join(","),
  canonicalEngines,
);
const viewportKeys = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_VIEWPORTS",
  process.env.V099_FINAL_REMEDIATION_QA_VIEWPORTS ?? "667x375,736x414,844x390,844x340,1280x720",
  canonicalViewports.map(({ width, height }) => `${width}x${height}`),
);
const viewports = viewportKeys.map((key) => {
  const [width, height] = key.split("x").map(Number);
  return { width, height };
});
const deploymentKinds = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS",
  process.env.V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS
    ?? canonicalDeploymentUnits.map(({ kind }) => kind).join(","),
  canonicalDeploymentUnits.map(({ kind }) => kind),
);
const deploymentUnits = canonicalDeploymentUnits.filter(({ kind }) => deploymentKinds.includes(kind));
const caseTypes = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_CASES",
  process.env.V099_FINAL_REMEDIATION_QA_CASES ?? canonicalCaseTypes.join(","),
  canonicalCaseTypes,
);
const timeout = Math.max(
  10_000,
  Number(process.env.V099_FINAL_REMEDIATION_QA_TIMEOUT_MS) || 30_000,
);
const evidenceDir = path.resolve(
  process.env.V099_FINAL_REMEDIATION_QA_EVIDENCE_DIR
    ?? "docs/qa/v099/final-remediation/browser",
);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function noOpLifecycleDiagnostics() {
  return {
    file: null,
    setPhase: () => {},
    event: () => {},
    attachBrowser: () => {},
    attachContext: () => {},
    attachPage: () => {},
    markPageCloseBegin: () => {},
    markContextCloseBegin: () => {},
    markBrowserCloseBegin: () => {},
    flush: async () => {},
  };
}

async function createLifecycleDiagnostics({ engine, viewport, caseType, name }) {
  if (engine !== "webkit") return noOpLifecycleDiagnostics();

  const filePath = path.join(evidenceDir, `${name}-${caseType}-lifecycle.jsonl`);
  await writeFile(filePath, "", "utf8");
  const startedAt = Date.now();
  const expectedPages = new WeakSet();
  const expectedContexts = new WeakSet();
  const pageDiagnostics = new WeakMap();
  let lastPage = null;
  let currentPhase = "initialization";
  let lastSuccessfulMilestone = null;
  let normalCleanupStarted = false;
  let expectedBrowserClose = false;
  let writeQueue = Promise.resolve();
  let writeError = null;

  function pageIsClosed(page) {
    try {
      return page && typeof page.isClosed === "function" ? page.isClosed() : null;
    } catch {
      return null;
    }
  }

  function diagnosticsSnapshot(page) {
    const diagnostics = pageDiagnostics.get(page ?? lastPage);
    return diagnostics
      ? {
        consoleErrors: [...diagnostics.consoleErrors],
        pageErrors: [...diagnostics.pageErrors],
        requestFailures: [...diagnostics.requestFailures],
        httpErrors: [...diagnostics.httpErrors],
      }
      : null;
  }

  function record(event, { page = null, phase = currentPhase, milestone = null, ...fields } = {}) {
    if (milestone) lastSuccessfulMilestone = milestone;
    const entry = {
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      engine,
      viewport: `${viewport.width}x${viewport.height}`,
      caseType,
      phase,
      currentPhase,
      event,
      pageIsClosed: pageIsClosed(page),
      pageDiagnostics: diagnosticsSnapshot(page),
      runnerResourceEvidenceDir: relativeEvidencePath(evidenceDir),
      normalCleanupStarted,
      lastSuccessfulMilestone,
      ...fields,
    };
    const line = `${JSON.stringify(entry)}\n`;
    writeQueue = writeQueue.then(() => appendFile(filePath, line, "utf8")).catch((error) => {
      writeError ??= error;
    });
  }

  function setPhase(phase, milestone = null) {
    currentPhase = phase;
    record("phase changed", { phase, milestone });
  }

  function attachBrowser(browser) {
    expectedBrowserClose = false;
    normalCleanupStarted = false;
    browser.on("disconnected", () => {
      record("browser disconnected", {
        expected: expectedBrowserClose,
        unexpected: !expectedBrowserClose,
      });
    });
    record("browser launched");
  }

  function attachContext(context) {
    context.on("close", () => {
      const expected = expectedContexts.has(context) || normalCleanupStarted;
      record("context closed", { expected, unexpected: !expected });
    });
    record("context created");
  }

  function attachPage(page, diagnostics = null) {
    pageDiagnostics.set(page, diagnostics);
    lastPage = page;
    page.on("close", () => {
      const expected = expectedPages.has(page) || normalCleanupStarted;
      record("page close", { page, expected, unexpected: !expected });
    });
    page.on("crash", () => {
      record("page crash", { page, expected: false, unexpected: true });
    });
    page.on("pageerror", (error) => {
      record("pageerror", { page, error: String(error) });
    });
    record("page created", { page });
  }

  function markPageCloseBegin(page) {
    expectedPages.add(page);
    record("page close begin", { page, expected: true });
  }

  function markContextCloseBegin(context) {
    expectedContexts.add(context);
    normalCleanupStarted = true;
    record("context close begin");
  }

  function markBrowserCloseBegin() {
    expectedBrowserClose = true;
    normalCleanupStarted = true;
    record("browser close begin");
  }

  record("case start");
  return {
    file: relativeEvidencePath(filePath),
    setPhase,
    event: record,
    attachBrowser,
    attachContext,
    attachPage,
    markPageCloseBegin,
    markContextCloseBegin,
    markBrowserCloseBegin,
    flush: async () => {
      await writeQueue;
      if (writeError) throw new Error(`Lifecycle diagnostics could not be written: ${writeError}`);
    },
  };
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function relativeEvidencePath(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function safeAreaForViewport(viewport) {
  return viewport.width === 844
    ? { top: 0, right: 44, bottom: 21, left: 44, preset: "iphone-landscape" }
    : { top: 0, right: 0, bottom: 0, left: 0, preset: null };
}

function caseUrl(qaMode, { stageNumber = 3, safeAreaPreset = null } = {}) {
  const url = new URL(baseUrl);
  const parameters = { qa: qaMode };
  if (safeAreaPreset) parameters.safe = safeAreaPreset;
  if (qaMode === "mission") Object.assign(parameters, { stage: String(stageNumber), state: "start" });
  url.search = new URLSearchParams(parameters).toString();
  return String(url);
}

function diagnosticsFor(page, lifecycle = null) {
  let active = true;
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (active && message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (active) diagnostics.pageErrors.push(String(error));
  });
  page.on("requestfailed", (request) => {
    if (!active) return;
    diagnostics.requestFailures.push(
      `${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (active && response.status() >= 400) {
      diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  lifecycle?.attachPage(page, diagnostics);
  return {
    diagnostics,
    stop: () => { active = false; },
  };
}

function diagnosticsClean(diagnostics) {
  return Object.values(diagnostics).every((entries) => entries.length === 0);
}

async function nextRender(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function screenshot(page, filename) {
  await nextRender(page);
  const screenshotPath = path.join(evidenceDir, filename);
  await page.screenshot({ path: screenshotPath, animations: "allow" });
  return relativeEvidencePath(screenshotPath);
}

async function crawlerRuntimeContactSheet(name, kind, viewport, entries) {
  invariant(entries.length === 7, `${name}/${kind}: runtime contact sheet requires seven phases`);
  const crop = {
    left: 0,
    top: Math.max(0, Math.round(viewport.height * .14)),
    width: Math.min(248, viewport.width),
    height: Math.min(250, viewport.height - Math.max(0, Math.round(viewport.height * .14))),
  };
  const tiles = [];
  for (const entry of entries) {
    const buffer = await sharp(path.resolve(entry.screenshot))
      .extract(crop)
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer();
    tiles.push(buffer);
  }
  const outputPath = path.join(evidenceDir, `${name}-crawler-${kind}-runtime-contact-sheet.png`);
  await sharp({
    create: {
      width: crop.width * tiles.length,
      height: crop.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(tiles.map((input, index) => ({ input, left: index * crop.width, top: 0 })))
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(outputPath);
  const relativePath = relativeEvidencePath(outputPath);
  return {
    path: relativePath,
    sha256: await evidenceSha256(relativePath),
    crop,
    columns: entries.length,
    phases: entries.map(({ phase }) => phase),
  };
}

async function deploymentRuntimeContactSheet(name, family, viewport, entries) {
  invariant(entries.length === CRAWLER_DEPLOYMENT_CHECKPOINTS.length,
    `${name}/${family}: deployment contact sheet is incomplete`);
  const crop = {
    left: 0,
    top: Math.max(0, Math.round(viewport.height * .1)),
    width: Math.min(Math.round(viewport.width * .52), viewport.width),
    height: Math.min(Math.round(viewport.height * .72), viewport.height),
  };
  const tiles = [];
  for (const entry of entries) {
    tiles.push(await sharp(path.resolve(entry.screenshot))
      .extract(crop)
      .resize({ width: 320, height: 180, fit: "contain", background: "#080a0b" })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer());
  }
  const outputPath = path.join(evidenceDir, `${name}-deployment-${family}-contact-sheet.png`);
  await sharp({
    create: {
      width: 320 * entries.length,
      height: 180,
      channels: 4,
      background: { r: 8, g: 10, b: 11, alpha: 1 },
    },
  }).composite(tiles.map((input, index) => ({ input, left: index * 320, top: 0 })))
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(outputPath);
  const relativePath = relativeEvidencePath(outputPath);
  return {
    path: relativePath,
    sha256: await evidenceSha256(relativePath),
    crop,
    columns: entries.length,
    checkpoints: entries.map(({ checkpoint }) => checkpoint),
  };
}

async function evidenceSha256(relativePath) {
  return createHash("sha256")
    .update(await readFile(path.resolve(relativePath)))
    .digest("hex");
}

async function enterLegacyQaBattle(page, qaMode) {
  if (qaMode === "mission") return;
  await page.waitForFunction(
    () => ["loadout", "event", "battle"].includes(
      document.querySelector(".game-shell")?.getAttribute("data-screen") ?? "",
    ),
    undefined,
    { timeout },
  );
  if (await page.locator('.game-shell[data-screen="loadout"]').count()) {
    await page.waitForFunction(
      () => {
        const state = window.__ASHFALL_ASSET_QA__?.getState?.();
        return ["ready", "degraded-ready"].includes(state?.state)
          && state.pending === 0;
      },
      undefined,
      { timeout },
    );
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 12_000) });
    const deployButton = page.getByRole("button", { name: /この編成で出撃/u });
    await deployButton.waitFor({ state: "visible", timeout });
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((button) => (
        button.textContent?.includes("この編成で出撃") && !button.disabled
      )),
      undefined,
      { timeout },
    );
    await deployButton.click({ timeout });
  }
  for (let advance = 0; advance < 48; advance += 1) {
    const screen = await page.locator(".game-shell").getAttribute("data-screen");
    if (screen === "battle") return;
    invariant(screen === "event", `${qaMode}: unexpected legacy QA screen ${screen}`);
    const dialogue = page.locator(".dialogue-box");
    await dialogue.waitFor({ state: "visible", timeout });
    // Each authored event line can introduce its portrait/sprite lazily.  Wait
    // for that request to finish before advancing the deterministic QA story;
    // otherwise the harness itself would cancel a valid image request when it
    // tears the line down 30ms later.
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 12_000) });
    await dialogue.click({ timeout });
    await page.waitForTimeout(30);
  }
  throw new Error(`${qaMode}: story queue did not reach battle within 48 advances`);
}

async function openBattlePage(context, qaMode, options = {}, lifecycle = null) {
  lifecycle?.setPhase("page creation");
  const page = await context.newPage();
  const diagnosticControl = diagnosticsFor(page, lifecycle);
  lifecycle?.setPhase("navigation");
  lifecycle?.event("navigation start", { page });
  const viewport = page.viewportSize();
  const response = await page.goto(caseUrl(qaMode, {
    ...options,
    safeAreaPreset: options.safeAreaPreset ?? safeAreaForViewport(viewport).preset,
  }), {
    waitUntil: "domcontentloaded",
    timeout,
  });
  lifecycle?.event("navigation complete", { page, status: response?.status(), milestone: "navigation complete" });
  invariant(response?.ok(), `${qaMode}: navigation returned HTTP ${response?.status()}`);
  lifecycle?.setPhase("battle setup");
  await dismissInstallOffer(page, { timeout });
  await enterLegacyQaBattle(page, qaMode);
  lifecycle?.setPhase("battle readiness");
  lifecycle?.event("battle readiness start", { page });
  await page.waitForFunction(
    () => {
      const battle = window.__ASHFALL_BATTLE_QA__;
      const assets = window.__ASHFALL_ASSET_QA__;
      return battle?.getSnapshot?.().screen === "battle"
        && battle.getSnapshot().running === true
        && ["ready", "degraded-ready"].includes(assets?.getState?.().state);
    },
    undefined,
    { timeout },
  );
  lifecycle?.event("battle readiness complete", { page, milestone: "battle readiness complete" });
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 12_000) });
  return { page, ...diagnosticControl };
}

async function clientPointForWorld(page, point) {
  const box = await page.locator("canvas.battlefield.active").boundingBox();
  invariant(box, "battlefield canvas has no display box");
  const scale = Math.max(box.width / 960, box.height / 540);
  return {
    x: box.x + (box.width - 960 * scale) / 2 + point.x * scale,
    y: box.y + (box.height - 540 * scale) / 2 + point.y * scale,
  };
}

async function recursiveLatestMtimeMs(directory) {
  let latest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    latest = Math.max(
      latest,
      entry.isDirectory()
        ? await recursiveLatestMtimeMs(entryPath)
        : entry.isFile() ? (await stat(entryPath)).mtimeMs : 0,
    );
  }
  return latest;
}

async function staticRuntimeEvidence() {
  const ashfallSource = await readFile(path.resolve("app/AshfallGame.tsx"), "utf8");
  const equipmentFunctionStart = ashfallSource.indexOf("function drawCrawlerEquipmentFrame(");
  const equipmentFunctionEnd = ashfallSource.indexOf("function crawlerAuthoredWorldPoint(", equipmentFunctionStart);
  invariant(equipmentFunctionStart >= 0 && equipmentFunctionEnd > equipmentFunctionStart,
    "CRAWLER authored-equipment renderer is missing");
  const equipmentRenderer = ashfallSource.slice(equipmentFunctionStart, equipmentFunctionEnd);
  invariant(equipmentRenderer.includes("ctx.drawImage("),
    "CRAWLER equipment renderer does not draw the authored raster sheet");
  invariant(!/(?:beginPath|moveTo|lineTo|arc|fillRect|strokeRect|Path2D)\s*\(/u.test(equipmentRenderer),
    "CRAWLER equipment renderer contains Canvas body geometry");
  invariant(!ashfallSource.includes("function drawAirstrikeObserver("),
    "legacy Canvas airstrike observer body remains in the runtime");

  const provenance = JSON.parse(await readFile(
    path.resolve("assets/source/v099/crawler/provenance.json"),
    "utf8",
  ));
  invariant(provenance.generation?.runtimeCanvasGeometry === false,
    "CRAWLER provenance does not prohibit runtime Canvas geometry");
  const runtimePaths = [
    V099_CRAWLER_RUNTIME_PROFILE.equipmentHost.closed.path,
    V099_CRAWLER_RUNTIME_PROFILE.deployment.baseInterior.path,
    V099_CRAWLER_RUNTIME_PROFILE.deployment.foregroundMask.path,
    V099_CRAWLER_RUNTIME_PROFILE.equipment.barrage.sheet.path,
    V099_CRAWLER_RUNTIME_PROFILE.equipment.airstrike.sheet.path,
  ];
  invariant(new Set(runtimePaths).size === 5, "CRAWLER runtime profile collapsed physical assets");
  for (const assetPath of runtimePaths) {
    invariant((await stat(path.resolve(`public${assetPath}`))).size > 0,
      `CRAWLER runtime asset is missing: ${assetPath}`);
  }
  for (const [kind, phases] of [
    ["barrage", CRAWLER_BARRAGE_SPRITE_PHASES],
    ["airstrike", CRAWLER_AIRSTRIKE_SPRITE_PHASES],
  ]) {
    invariant(phases.length === 7, `${kind} authored phase count drifted`);
    for (const phase of phases) {
      invariant(resolveCrawlerEquipmentFrame(kind, phase), `${kind}:${phase} frame is unresolved`);
    }
  }
  return {
    renderer: "drawCrawlerEquipmentFrame",
    rendererUsesDrawImage: true,
    rendererCanvasBodyGeometry: false,
    provenanceRuntimeCanvasGeometry: provenance.generation.runtimeCanvasGeometry,
    runtimePaths,
    barragePhases: [...CRAWLER_BARRAGE_SPRITE_PHASES],
    airstrikePhases: [...CRAWLER_AIRSTRIKE_SPRITE_PHASES],
  };
}

async function measureHud(page, viewport, label) {
  const safeArea = safeAreaForViewport(viewport);
  const expectedLayout = mobileBattleHudLayout({
    ...viewport,
    safeAreaTop: safeArea.top,
    safeAreaRight: safeArea.right,
    safeAreaBottom: safeArea.bottom,
    safeAreaLeft: safeArea.left,
  });
  const desktopRegression = expectedLayout === null && viewport.width === 1280 && viewport.height === 720;
  invariant(expectedLayout || desktopRegression,
    `${label}: no canonical HUD contract for ${viewport.width}x${viewport.height}`);
  const measured = await page.evaluate(({ expectedTypography }) => {
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        left: value.left,
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden"
        && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
    };
    const fontRules = [
      [".battle-banner", expectedTypography.banner.minPx],
      [".battle-barks p", 12],
      [".battle-controls-zone .phase-block small", expectedTypography.detail.minPx],
      [".battle-controls-zone .phase-block strong", 14],
      [".battle-controls-zone .phase-block em", expectedTypography.detail.minPx],
      [".resource > span", expectedTypography.detail.minPx],
      [".resource small", expectedTypography.detail.minPx],
      [".battle-stats span", expectedTypography.stats.minPx],
      [".unit-card .card-copy b", expectedTypography.unitName.minPx],
      [".unit-card .cost", expectedTypography.unitCost.minPx],
      [".unit-card .card-state", expectedTypography.disabledReason.minPx],
      [".unit-card .cooldown-mask small", expectedTypography.disabledReason.minPx],
      [".support-btn b", expectedTypography.supportName.minPx],
      [".support-btn small", expectedTypography.disabledReason.minPx],
      [".support-btn em", expectedTypography.supportCost.minPx],
      [".battle-objective", expectedTypography.objective.minPx],
      [".boss-hud div", expectedTypography.detail.minPx],
      [".boss-hud b", expectedTypography.detail.minPx],
    ];
    const fontChecks = fontRules.flatMap(([selector, minimum]) => (
      [...document.querySelectorAll(selector)].filter(visible).map((element) => ({
        selector,
        text: element.textContent?.trim() ?? "",
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        minimum,
        fits: element.scrollWidth <= element.clientWidth + 2
          && element.scrollHeight <= element.clientHeight + 2,
        rect: rect(element),
      }))
    ));
    const top = document.querySelector(".top-hud");
    const bottom = document.querySelector(".bottom-hud");
    const topZones = [
      document.querySelector(".battle-brand-zone"),
      document.querySelector(".top-hud > .battle-message-stack"),
      document.querySelector(".battle-controls-zone"),
    ];
    const bottomZones = [
      document.querySelector(".resource-stack"),
      document.querySelector(".bottom-hud > .unit-cards"),
      document.querySelector(".support-zone"),
    ];
    const normalizedWidths = (elements) => {
      const widths = elements.map((element) => rect(element)?.width ?? 0);
      const total = widths.reduce((sum, width) => sum + width, 0);
      return widths.map((width) => total > 0 ? width / total : 0);
    };
    const overlap = (left, right) => {
      const a = rect(left);
      const b = rect(right);
      return Boolean(a && b
        && Math.min(a.right, b.right) - Math.max(a.left, b.left) > .5
        && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .5);
    };
    const pairOverlaps = (elements) => elements.flatMap((element, index) => (
      elements.slice(index + 1).map((other, offset) => ({
        pair: [index, index + offset + 1],
        overlaps: overlap(element, other),
      }))
    ));
    const banner = document.querySelector(".battle-banner");
    const bark = document.querySelector(".battle-barks");
    const boss = document.querySelector(".boss-hud");
    const bossHeading = boss?.querySelector("div") ?? null;
    const bossLabel = bossHeading?.querySelector("span") ?? null;
    const bossValue = bossHeading?.querySelector("b") ?? null;
    const crawlerAlert = document.querySelector(".crawler-alert");
    const unitStrip = document.querySelector(".unit-cards");
    const unitStripRect = rect(unitStrip);
    const unitSlots = [...document.querySelectorAll(".unit-cards > .unit-card")];
    const unitSlotRects = unitSlots.map((element) => rect(element));
    const disabled = [...document.querySelectorAll("button[aria-disabled='true']")]
      .filter(visible)
      .map((button) => {
        const style = getComputedStyle(button);
        return {
          className: button.className,
          label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
          opacity: Number.parseFloat(style.opacity),
          cursor: style.cursor,
          rect: rect(button),
        };
      });
    const rootStyle = getComputedStyle(document.documentElement);
    const safeInsets = Object.fromEntries(["top", "right", "bottom", "left"].map((edge) => [
      edge,
      Math.max(0, Number.parseFloat(rootStyle.getPropertyValue(`--app-viewport-safe-${edge}`)) || 0),
    ]));
    const ownedRects = [top, bottom, ...topZones, ...bottomZones].map(rect).filter(Boolean);
    const insideViewport = (box) => box.left >= -.5 && box.top >= -.5
      && box.right <= innerWidth + .5 && box.bottom <= innerHeight + .5;
    const controlGroups = [
      [...document.querySelectorAll(".battle-controls-zone button")].filter(visible),
      [...document.querySelectorAll(".support-zone > button")].filter(visible),
    ];
    const requiredHudInformation = {
      brand: visible(document.querySelector(".battle-brand-zone")),
      phase: visible(document.querySelector(".phase-block")),
      resources: visible(document.querySelector(".resource-stack")),
      stats: visible(document.querySelector(".battle-stats")),
      units: visible(document.querySelector(".unit-cards"))
        && document.querySelectorAll(".unit-cards > .unit-card").length > 0,
      support: visible(document.querySelector(".support-zone")),
      objective: visible(document.querySelector(".battle-objective")),
      controls: visible(document.querySelector(".battle-controls-zone")),
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      safeInsets,
      top: rect(top),
      bottom: rect(bottom),
      topZones: topZones.map(rect),
      bottomZones: bottomZones.map(rect),
      topRatios: normalizedWidths(topZones),
      bottomRatios: normalizedWidths(bottomZones),
      topPairOverlaps: pairOverlaps(topZones),
      bottomPairOverlaps: pairOverlaps(bottomZones),
      banner: rect(banner),
      bark: rect(bark),
      bannerBarkOverlap: overlap(banner, bark),
      boss: rect(boss),
      bossHeading: rect(bossHeading),
      bossLabel: rect(bossLabel),
      bossValue: rect(bossValue),
      crawlerAlert: rect(crawlerAlert),
      bossCrawlerAlertOverlap: overlap(boss, crawlerAlert),
      unitSlots: {
        logical: unitSlots.length,
        placeholders: unitSlots.filter((element) => element.classList.contains("unit-card-placeholder")).length,
        placeholderButtons: unitSlots.filter((element) => element.classList.contains("unit-card-placeholder") && element instanceof HTMLButtonElement).length,
        visible: unitSlotRects.filter((slot) => Boolean(slot)
          && slot.left >= (rect(unitStrip)?.left ?? 0) - 1
          && slot.right <= (rect(unitStrip)?.right ?? 0) + 1).length,
        allPainted: unitSlotRects.every((slot) => Boolean(slot) && slot.width > 0 && slot.height > 0),
        finalOffset: unitSlotRects.at(-1) && unitStripRect
          ? unitSlotRects.at(-1).right - unitStripRect.left
          : 0,
        scrollWidth: unitStrip?.scrollWidth || 0,
        clientWidth: unitStrip?.clientWidth || 0,
      },
      publicBattleText: document.body.innerText,
      fontChecks,
      disabled,
      disabledUnitCount: disabled.filter(({ className }) => String(className).includes("unit-card")).length,
      disabledSupportCount: disabled.filter(({ className }) => String(className).includes("support-btn")).length,
      ownedZonesInViewport: ownedRects.every(insideViewport),
      controlPairOverlaps: controlGroups.flatMap(pairOverlaps),
      requiredHudInformation,
      documentOverflow: {
        horizontal: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        vertical: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) > innerHeight + 1,
      },
    };
  }, { expectedTypography: MOBILE_BATTLE_HUD_TYPOGRAPHY });

  const ratioClose = (actual, expected) => Math.abs(actual - expected) <= .008;
  invariant(measured.top && measured.bottom, `${label}: top or bottom HUD is missing`);
  invariant(measured.topZones.every(Boolean) && measured.bottomZones.every(Boolean),
    `${label}: one or more owned HUD zones are missing`);
  invariant(measured.topPairOverlaps.every(({ overlaps }) => !overlaps),
    `${label}: top HUD zones overlap`);
  invariant(measured.bottomPairOverlaps.every(({ overlaps }) => !overlaps),
    `${label}: bottom HUD zones overlap`);
  invariant(measured.controlPairOverlaps.every(({ overlaps }) => !overlaps),
    `${label}: HUD controls collide`);
  const clearBattlefieldHeight = measured.bottom.top - measured.top.bottom;
  let expectedSafeAreaAdjusted = null;
  if (expectedLayout) {
    invariant(measured.topRatios.every((value, index) => ratioClose(value, [.28, .38, .34][index])),
      `${label}: top 28/38/34 ownership drift ${JSON.stringify(measured.topRatios)}`);
    const expectedBottomRatios = [
      expectedLayout.bottom.resources.width / expectedLayout.content.width,
      expectedLayout.bottom.units.width / expectedLayout.content.width,
      expectedLayout.bottom.support.width / expectedLayout.content.width,
    ];
    invariant(measured.bottomRatios.every((value, index) => ratioClose(value, expectedBottomRatios[index])),
      `${label}: bottom ownership drift ${JSON.stringify({
        actual: measured.bottomRatios,
        expected: expectedBottomRatios,
      })}`);
    const expectedTopHeight = expectedLayout.topHeight;
    const expectedBottomHeight = expectedLayout.bottomHeight;
    const expectedBattlefieldHeight = expectedLayout.battlefield.height;
    invariant(Math.abs(measured.top.height - expectedTopHeight) <= 2,
      `${label}: top HUD height ${measured.top.height}/${expectedTopHeight}`);
    invariant(Math.abs(measured.bottom.height - expectedBottomHeight) <= 2,
      `${label}: bottom HUD height ${measured.bottom.height}/${expectedBottomHeight}`);
    invariant(clearBattlefieldHeight >= expectedBattlefieldHeight - 2,
      `${label}: battlefield band ${clearBattlefieldHeight}/${expectedBattlefieldHeight}`);
    expectedSafeAreaAdjusted = {
      topHeight: expectedTopHeight,
      bottomHeight: expectedBottomHeight,
      battlefieldHeight: expectedBattlefieldHeight,
    };
  } else {
    invariant(measured.viewport.width === 1280 && measured.viewport.height === 720,
      `${label}: desktop regression viewport drifted ${JSON.stringify(measured.viewport)}`);
    invariant(measured.ownedZonesInViewport, `${label}: desktop HUD is clipped by the viewport`);
    invariant(!measured.documentOverflow.horizontal && !measured.documentOverflow.vertical,
      `${label}: desktop document overflow ${JSON.stringify(measured.documentOverflow)}`);
    invariant(Object.values(measured.requiredHudInformation).every(Boolean),
      `${label}: required desktop HUD information is missing ${JSON.stringify(measured.requiredHudInformation)}`);
    invariant(clearBattlefieldHeight > 0, `${label}: desktop HUD leaves no visible battlefield`);
  }
  invariant(measured.fontChecks.length > 0, `${label}: no visible HUD typography was audited`);
  if (expectedLayout) {
    invariant(measured.fontChecks.every(({ fontSize, minimum }) => fontSize + .01 >= minimum),
      `${label}: undersized HUD text ${JSON.stringify(measured.fontChecks.filter(({ fontSize, minimum }) => fontSize + .01 < minimum))}`);
    invariant(measured.fontChecks.every(({ fits }) => fits),
      `${label}: truncated HUD text ${JSON.stringify(measured.fontChecks.filter(({ fits }) => !fits))}`);
  }
  invariant(measured.unitSlots.logical === 7 && measured.unitSlots.allPainted,
    `${label}: seven logical unit slots were not rendered ${JSON.stringify(measured.unitSlots)}`);
  invariant(measured.unitSlots.visible >= 4,
    `${label}: fewer than four unit slots are visible ${JSON.stringify(measured.unitSlots)}`);
  invariant(measured.unitSlots.finalOffset <= measured.unitSlots.scrollWidth + 1,
    `${label}: unit strip cannot reach its final logical slot ${JSON.stringify(measured.unitSlots)}`);
  invariant(measured.unitSlots.placeholderButtons === 0,
    `${label}: empty unit placeholders became interactive ${JSON.stringify(measured.unitSlots)}`);
  invariant(!/CRAWLER|クローラー/iu.test(measured.publicBattleText),
    `${label}: internal CRAWLER wording leaked into player-facing battle text`);
  if (measured.banner && measured.bark) {
    invariant(!measured.bannerBarkOverlap, `${label}: battle banner overlaps battle bark`);
  }
  if (measured.boss) {
    invariant(measured.boss.top >= measured.top.bottom - 1
      && measured.boss.bottom <= measured.bottom.top + 1,
    `${label}: boss HUD escaped the battlefield band`);
    invariant(measured.bossHeading && measured.bossLabel && measured.bossValue,
      `${label}: boss HUD semantic fields are missing`);
    if (expectedLayout) {
      invariant(Math.abs(measured.bossLabel.top - measured.bossValue.top) <= 2
        && Math.abs(measured.bossLabel.bottom - measured.bossValue.bottom) <= 2
        && measured.bossLabel.right <= measured.bossValue.left + .5,
      `${label}: boss phase or current/max is semantically wrapped or overlapping`);
    }
  }
  if (measured.boss && measured.crawlerAlert) {
    invariant(!measured.bossCrawlerAlertOverlap,
      `${label}: boss HUD overlaps crawler threat alert`);
  }
  return {
    ...measured,
    contract: expectedLayout ? "mobile" : "desktop-regression",
    expected: expectedLayout,
    expectedSafeAreaAdjusted,
    clearBattlefieldHeight,
  };
}

async function waitForQuietBattleMessages(page, label) {
  await page.waitForFunction(
    () => !document.querySelector(".battle-banner") && !document.querySelector(".battle-barks"),
    undefined,
    { timeout },
  ).catch((error) => {
    throw new Error(`${label}: battle messages did not clear: ${String(error)}`);
  });
}

async function captureHudState(page, viewport, axisName, stateId, lifecycle = null) {
  lifecycle?.setPhase(`HUD state capture/${stateId}`);
  lifecycle?.event("HUD state capture start", { page, stateId });
  const layout = await measureHud(page, viewport, `${axisName}/${stateId}`);
  const semantic = await page.evaluate(() => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const banner = document.querySelector(".battle-banner");
    const bark = document.querySelector(".battle-barks");
    const boss = document.querySelector(".boss-hud");
    const objective = document.querySelector(".battle-objective");
    return {
      stageId: snapshot.stageId,
      time: snapshot.time,
      paused: snapshot.paused,
      humanCount: snapshot.fighters.filter((fighter) => fighter.side === "human" && fighter.hp > 0).length,
      bossKinds: snapshot.fighters
        .filter((fighter) => fighter.side === "zombie" && ["takuya", "gate-eater", "kurome", "mother", "ooguchi", "gairen", "futago"].includes(fighter.kind))
        .map((fighter) => fighter.kind),
      manualAbilityReceiptCount: snapshot.manualAbilityReceipts?.length ?? 0,
      bannerText: banner?.textContent?.trim() ?? "",
      barkText: bark?.textContent?.trim() ?? "",
      bossText: boss?.textContent?.trim() ?? "",
      objectiveText: objective?.textContent?.trim() ?? "",
      objectiveFits: objective
        ? objective.scrollWidth <= objective.clientWidth + 2
          && objective.scrollHeight <= objective.clientHeight + 2
        : false,
    };
  });
  const screenshotPath = await screenshot(page, `${axisName}-hud-${stateId}.png`);
  lifecycle?.event("HUD state capture complete", {
    page,
    stateId,
    milestone: `${stateId} HUD state capture complete`,
  });
  return {
    id: stateId,
    semantic,
    layout,
    screenshot: screenshotPath,
    screenshotSha256: await evidenceSha256(screenshotPath),
  };
}

async function createDisabledHudState(page, label, { minimumOpacity = .72 } = {}) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = await page.evaluate(() => (
      [...document.querySelectorAll("button.unit-card")]
        .filter((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true")
        .map((button) => ({
          kind: button.getAttribute("data-kind"),
          cost: Number((button.querySelector(".cost")?.textContent ?? "").match(/\d+/u)?.[0] ?? 0),
        }))
        .sort((left, right) => right.cost - left.cost)[0] ?? null
    ));
    if (!candidate?.kind) {
      await page.waitForTimeout(60);
      continue;
    }
    const clicked = await page.evaluate((kind) => {
      const button = document.querySelector(`button.unit-card[data-kind='${kind}']`);
      if (!(button instanceof HTMLButtonElement)
        || button.disabled
        || button.getAttribute("aria-disabled") === "true") return false;
      button.click();
      return true;
    }, candidate.kind);
    if (!clicked) {
      await page.waitForTimeout(60);
      continue;
    }
    await page.waitForTimeout(60);
    if (await page.locator("button.unit-card[aria-disabled='true']").count() > 0) break;
  }
  await page.waitForFunction(
    () => document.querySelectorAll("button.unit-card[aria-disabled='true']").length > 0
      && document.querySelectorAll("button.support-btn[aria-disabled='true']").length > 0,
    undefined,
    { timeout },
  );
  const disabled = await page.evaluate(() => (
    [...document.querySelectorAll("button[aria-disabled='true']")].map((button) => ({
      className: button.className,
      label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
      reason: button.getAttribute("data-block-reason"),
      opacity: Number.parseFloat(getComputedStyle(button).opacity),
      cursor: getComputedStyle(button).cursor,
    }))
  ));
  invariant(disabled.some(({ className }) => String(className).includes("unit-card")),
    `${label}: no unit-card disabled state was produced`);
  invariant(disabled.some(({ className }) => String(className).includes("support-btn")),
    `${label}: no support disabled state was produced`);
  const disabledTextControls = disabled.filter(({ className }) => (
    String(className).includes("unit-card") || String(className).includes("support-btn")
  ));
  if (minimumOpacity !== null) {
    invariant(disabledTextControls.every(({ opacity }) => opacity >= minimumOpacity),
      `${label}: disabled text control opacity fell below ${minimumOpacity}`
      + ` ${JSON.stringify(disabledTextControls)}`);
  }
  return disabled;
}

async function runHudCase(browserType, engine, viewport) {
  const name = `${engine}-${viewport.width}x${viewport.height}`;
  const lifecycle = await createLifecycleDiagnostics({
    engine,
    viewport,
    caseType: "hud",
    name,
  });
  let browser = null;
  let context = null;
  let page = null;
  const diagnosticControls = [];
  const result = { type: "hud", engine, viewport, status: "failed", states: [] };
  try {
    lifecycle.setPhase("browser launch");
    browser = await browserType.launch({ headless: true });
    lifecycle.attachBrowser(browser);
    lifecycle.setPhase("context creation");
    context = await browser.newContext({ viewport });
    lifecycle.attachContext(context);
    const stage1 = await openBattlePage(context, "mission", { stageNumber: 1 }, lifecycle);
    diagnosticControls.push(stage1);
    page = stage1.page;

    lifecycle.setPhase("stage1-normal message settle");
    await waitForQuietBattleMessages(page, `${name}/stage1-normal`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const normal = await captureHudState(page, viewport, name, "stage1-normal", lifecycle);
    invariant(normal.semantic.stageId.includes("shopping-street")
      && !normal.semantic.bannerText
      && !normal.semantic.barkText
      && normal.semantic.bossKinds.length === 0,
    `${name}: Stage 1 normal HUD fixture drifted ${JSON.stringify(normal.semantic)}`);
    result.states.push(normal);

    const fiveUnitProof = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof([
        "scout",
        "ranger",
        "brawler",
        "medic",
        "gunner",
      ])
    ));
    invariant(fiveUnitProof?.ownerIds?.length === 5, `${name}: five-unit fixture was not created`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const fiveUnits = await captureHudState(page, viewport, name, "five-units", lifecycle);
    invariant(fiveUnits.semantic.humanCount === 5,
      `${name}: five-unit HUD state has ${fiveUnits.semantic.humanCount} live humans`);
    result.states.push(fiveUnits);

    const deploymentPrepared = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof({
        attackerKind: "walker",
        lane: 1,
        existingClaim: false,
      })
    ));
    invariant(Number.isInteger(deploymentPrepared?.attackerId),
      `${name}: deployment-banner fixture is unavailable`);
    const deploymentFrame = await queueAndPauseAtFirstDeploymentFrame(
      page,
      "scout",
      `${name}/deployment-banner`,
    );
    invariant(deploymentFrame.audit?.deploymentPlan?.checkpoint === "fully-inside",
      `${name}: deployment banner did not freeze the production progress-0 frame`);
    const deploymentBanner = await captureHudState(page, viewport, name, "deployment-banner", lifecycle);
    invariant(deploymentBanner.semantic.bannerText.includes("移動拠点から出撃"),
      `${name}: deployment banner copy is missing`);
    result.states.push(deploymentBanner);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));

    const abilityProof = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof("medic")
    ));
    invariant(abilityProof?.ownerIds?.length === 1,
      `${name}: manual-ability fixture is unavailable`);
    const abilityButton = page.locator("button.manual-ability-ready:not([aria-disabled='true'])").first();
    await abilityButton.waitFor({ state: "visible", timeout });
    await abilityButton.click({ timeout });
    await page.waitForFunction(
      () => document.querySelector(".battle-banner")?.textContent?.includes("//")
        && (window.__ASHFALL_BATTLE_QA__.getSnapshot().manualAbilityReceipts?.length ?? 0) === 1,
      undefined,
      { timeout },
    );
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const abilityBanner = await captureHudState(page, viewport, name, "manual-ability-banner", lifecycle);
    invariant(abilityBanner.semantic.manualAbilityReceiptCount === 1
      && abilityBanner.semantic.bannerText.includes("緊急処置"),
    `${name}: manual ability banner did not use the production activation path`);
    result.states.push(abilityBanner);

    stage1.stop();
    lifecycle.markPageCloseBegin(page);
    await page.close();

    const stage3 = await openBattlePage(context, "mission", { stageNumber: 3 }, lifecycle);
    diagnosticControls.push(stage3);
    page = stage3.page;
    await waitForQuietBattleMessages(page, `${name}/objective-full`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const objective = await captureHudState(page, viewport, name, "objective-full", lifecycle);
    invariant(objective.semantic.objectiveFits && objective.semantic.objectiveText.startsWith("目標：")
      && objective.semantic.objectiveText.length >= 8,
    `${name}: full objective is missing or truncated ${JSON.stringify(objective.semantic)}`);
    result.states.push(objective);

    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    const disabledControls = await createDisabledHudState(page, `${name}/support-disabled`, {
      minimumOpacity: mobileBattleHudLayout(viewport) ? .72 : null,
    });
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const disabled = await captureHudState(page, viewport, name, "support-disabled", lifecycle);
    invariant(disabled.layout.disabledUnitCount > 0 && disabled.layout.disabledSupportCount > 0,
      `${name}: disabled unit/support state did not remain visible`);
    result.states.push({ ...disabled, disabledControls });

    stage3.stop();
    lifecycle.setPhase("first browser teardown");
    lifecycle.markContextCloseBegin(context);
    await context.close();
    context = null;
    lifecycle.markBrowserCloseBegin();
    await browser.close();
    browser = null;
    page = null;

    lifecycle.setPhase("browser relaunch");
    browser = await browserType.launch({ headless: true });
    lifecycle.attachBrowser(browser);
    lifecycle.setPhase("context recreation");
    context = await browser.newContext({ viewport });
    lifecycle.attachContext(context);
    const bossStage3 = await openBattlePage(context, "mission", { stageNumber: 3 }, lifecycle);
    diagnosticControls.push(bossStage3);
    page = bossStage3.page;
    await waitForQuietBattleMessages(page, `${name}/boss-fixture`);
    const bossPrepared = await page.evaluate(
      () => window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof("takuya"),
    );
    invariant(bossPrepared?.kind === "takuya", `${name}: TAKUYA HUD fixture is unavailable`);
    const bossEntry = await page.waitForFunction(
      () => {
        const proof = window.__ASHFALL_BATTLE_QA__.getBossFoundationProof("takuya");
        return proof?.bossId && proof.gateEntering === true ? proof : null;
      },
      undefined,
      { timeout, polling: 10 },
    ).then((handle) => handle.jsonValue());
    invariant(Number.isInteger(bossEntry?.bossId), `${name}: TAKUYA entrance did not start`);
    await page.evaluate(
      (bossId) => window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(bossId),
      bossEntry.bossId,
    );
    await page.waitForFunction(
      () => {
        const proof = window.__ASHFALL_BATTLE_QA__.getBossFoundationProof("takuya");
        return proof?.combatReady === true
          && document.querySelector(".battle-banner")
          && document.querySelector(".battle-barks")
          && document.querySelector(".boss-hud");
      },
      undefined,
      { timeout, polling: 10 },
    );
    const simultaneous = await captureHudState(page, viewport, name, "banner-bark-boss", lifecycle);
    invariant(simultaneous.layout.banner && simultaneous.layout.bark && simultaneous.layout.boss,
      `${name}: simultaneous banner, bark, and boss HUD state was not rendered`);
    result.states.push(simultaneous);

    await waitForQuietBattleMessages(page, `${name}/stage3-boss`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const boss = await captureHudState(page, viewport, name, "stage3-boss", lifecycle);
    invariant(boss.layout.boss && boss.semantic.bossKinds.includes("takuya")
      && !boss.semantic.bannerText && !boss.semantic.barkText,
    `${name}: clean Stage 3 boss HUD state was not retained`);
    result.states.push(boss);

    const expectedStateIds = [
      "stage1-normal",
      "five-units",
      "deployment-banner",
      "manual-ability-banner",
      "objective-full",
      "support-disabled",
      "banner-bark-boss",
      "stage3-boss",
    ];
    invariant(result.states.length === expectedStateIds.length
      && result.states.every((state, index) => state.id === expectedStateIds[index]),
    `${name}: eight-state HUD matrix is incomplete`);
    invariant(new Set(result.states.map(({ screenshotSha256 }) => screenshotSha256)).size === expectedStateIds.length,
      `${name}: HUD state screenshots are not semantically distinct`);
    result.status = "passed";
  } catch (error) {
    result.error = String(error);
    if (page && !page.isClosed()) {
      try {
        result.failureScreenshot = await screenshot(page, `${name}-hud-failed.png`);
      } catch {
        // Preserve the original failure.
      }
    }
  } finally {
    for (const control of diagnosticControls) control.stop();
    result.diagnostics = {
      consoleErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.consoleErrors),
      pageErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.pageErrors),
      requestFailures: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.requestFailures),
      httpErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.httpErrors),
    };
    if (result.status === "passed" && !diagnosticsClean(result.diagnostics)) {
      result.status = "failed";
      result.error = `Browser diagnostics were not clean: ${JSON.stringify(result.diagnostics)}`;
    }
    lifecycle.event("case complete", { status: result.status, error: result.error ?? null });
    if (context) {
      lifecycle.markContextCloseBegin(context);
      await context.close().catch(() => {});
    }
    if (browser) {
      lifecycle.markBrowserCloseBegin();
      await browser.close().catch(() => {});
    }
    await lifecycle.flush();
    result.lifecycleLog = lifecycle.file;
  }
  return result;
}

async function pauseAtEquipmentPhase(page, kind, expectedPhase, label) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const runtime = await page.evaluate((runtimeKind) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      return runtimeKind === "barrage" ? snapshot.crawlerAbility : snapshot.airstrike;
    }, kind);
    const resolved = kind === "barrage"
      ? crawlerBarrageSpritePhase(runtime, CRAWLER_BARRAGE_DEF)
      : crawlerAirstrikeSpritePhase(runtime, AIRSTRIKE_DEF);
    if (resolved === expectedPhase) {
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
      const frozenRuntime = await page.evaluate((runtimeKind) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
        return runtimeKind === "barrage" ? snapshot.crawlerAbility : snapshot.airstrike;
      }, kind);
      const frozenPhase = kind === "barrage"
        ? crawlerBarrageSpritePhase(frozenRuntime, CRAWLER_BARRAGE_DEF)
        : crawlerAirstrikeSpritePhase(frozenRuntime, AIRSTRIKE_DEF);
      if (frozenPhase === expectedPhase) return { runtime: frozenRuntime, authoredPhase: frozenPhase };
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    }
    await page.waitForTimeout(3);
  }
  throw new Error(`${label}: timed out waiting for authored ${kind} phase ${expectedPhase}`);
}

async function loadedCrawlerAssets(page, label) {
  const loadedKeys = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getLoadedSpriteKeys());
  const requiredKeys = [
    "crawlerHostClosed",
    "crawlerDeploymentBase",
    "crawlerForegroundMask",
    "crawlerBarrageEquipment",
    "crawlerAirstrikeEquipment",
  ];
  invariant(requiredKeys.every((key) => loadedKeys.includes(key)),
    `${label}: CRAWLER sprites are not resident ${JSON.stringify({ requiredKeys, loadedKeys })}`);
  return { requiredKeys, loadedKeys };
}

async function runEquipmentCase(browser, engine, viewport, runtimeEvidence, lifecycle = null) {
  const name = `${engine}-${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport });
  lifecycle?.attachContext(context);
  let page;
  let stopDiagnostics = () => {};
  let diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  const result = { type: "crawler-equipment", engine, viewport, status: "failed" };
  try {
    lifecycle?.setPhase("crawler equipment setup");
    ({ page, stop: stopDiagnostics, diagnostics } = await openBattlePage(context, "mission", {}, lifecycle));
    const assets = await loadedCrawlerAssets(page, name);

    const barrage = [];
    await page.evaluate(() => {
      window.__ASHFALL_BATTLE_QA__.prepareV099CrawlerInputProof();
      window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
    });
    for (const [index, phase] of CRAWLER_BARRAGE_SPRITE_PHASES.entries()) {
      lifecycle?.setPhase(`crawler barrage/${phase}`);
      if (index === 1) {
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
        await page.keyboard.press("g");
      }
      const evidence = await pauseAtEquipmentPhase(page, "barrage", phase, name);
      lifecycle?.event("equipment phase complete", { page, equipment: "barrage", phase });
      const screenshotPath = await screenshot(page, `${name}-crawler-barrage-${index}-${phase}.png`);
      barrage.push({
        phase,
        ...evidence,
        screenshot: screenshotPath,
        screenshotSha256: await evidenceSha256(screenshotPath),
      });
      if (index < CRAWLER_BARRAGE_SPRITE_PHASES.length - 1) {
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
      }
    }

    const airstrike = [];
    const airstrikePrepared = await page.evaluate(() => {
      const prepared = window.__ASHFALL_BATTLE_QA__.prepareV099AirstrikeInputProof();
      window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
      return prepared;
    });
    for (const [index, phase] of CRAWLER_AIRSTRIKE_SPRITE_PHASES.entries()) {
      lifecycle?.setPhase(`crawler airstrike/${phase}`);
      if (index === 1) {
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
        await page.keyboard.press("q");
        invariant(await page.locator("button.support-btn.airstrike").evaluate(
          (button) => button.classList.contains("selected"),
        ), `${name}: Q did not select the production airstrike input`);
        const prepared = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike);
        invariant(prepared.phase === "idle", `${name}: airstrike changed before battlefield placement`);
        const point = await clientPointForWorld(page, {
          x: airstrikePrepared.targetX,
          y: airstrikePrepared.targetY,
        });
        await page.mouse.click(point.x, point.y);
      }
      const evidence = await pauseAtEquipmentPhase(page, "airstrike", phase, name);
      lifecycle?.event("equipment phase complete", { page, equipment: "airstrike", phase });
      const screenshotPath = await screenshot(page, `${name}-crawler-airstrike-${index}-${phase}.png`);
      airstrike.push({
        phase,
        ...evidence,
        screenshot: screenshotPath,
        screenshotSha256: await evidenceSha256(screenshotPath),
      });
      if (index < CRAWLER_AIRSTRIKE_SPRITE_PHASES.length - 1) {
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
      }
    }

    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike.phase === "idle",
      undefined,
      { timeout, polling: 5 },
    );
    const simultaneousTarget = await page.evaluate(
      () => window.__ASHFALL_BATTLE_QA__.prepareV099AirstrikeInputProof(),
    );
    await page.keyboard.press("q");
    const simultaneousPoint = await clientPointForWorld(page, {
      x: simultaneousTarget.targetX,
      y: simultaneousTarget.targetY,
    });
    await page.mouse.click(simultaneousPoint.x, simultaneousPoint.y);
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike.phase !== "idle",
      undefined,
      { timeout, polling: 5 },
    );
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.prepareV099CrawlerInputProof());
    await nextRender(page);
    await page.keyboard.press("g");
    const simultaneous = await page.evaluate(async (maximumMs) => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < maximumMs) {
        const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
        if (snapshot.crawlerAbility.phase !== "ready"
          && snapshot.crawlerAbility.phase !== "cooldown"
          && snapshot.airstrike.phase !== "idle") {
          window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
          return { crawlerAbility: snapshot.crawlerAbility, airstrike: snapshot.airstrike };
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      throw new Error("simultaneous CRAWLER equipment state timed out");
    }, timeout);
    const simultaneousPhases = {
      barrage: crawlerBarrageSpritePhase(simultaneous.crawlerAbility, CRAWLER_BARRAGE_DEF),
      airstrike: crawlerAirstrikeSpritePhase(simultaneous.airstrike, AIRSTRIKE_DEF),
    };
    invariant(simultaneousPhases.barrage !== "stowed" && simultaneousPhases.airstrike !== "stowed",
      `${name}: simultaneous authored equipment did not deploy ${JSON.stringify(simultaneousPhases)}`);
    const simultaneousScreenshot = await screenshot(page, `${name}-crawler-equipment-simultaneous.png`);

    invariant(new Set(barrage.map(({ phase }) => phase)).size === 7,
      `${name}: barrage phase evidence is incomplete`);
    invariant(new Set(airstrike.map(({ phase }) => phase)).size === 7,
      `${name}: airstrike phase evidence is incomplete`);
    invariant(new Set(barrage.map(({ screenshotSha256 }) => screenshotSha256)).size === 7,
      `${name}: barrage runtime phase screenshots are not distinct`);
    invariant(new Set(airstrike.map(({ screenshotSha256 }) => screenshotSha256)).size === 7,
      `${name}: airstrike runtime phase screenshots are not distinct`);
    const contactSheets = {
      barrage: await crawlerRuntimeContactSheet(name, "barrage", viewport, barrage),
      airstrike: await crawlerRuntimeContactSheet(name, "airstrike", viewport, airstrike),
    };
    Object.assign(result, {
      status: "passed",
      assets,
      runtimeEvidence,
      barrage,
      airstrike,
      contactSheets,
      simultaneous: { ...simultaneous, authoredPhases: simultaneousPhases },
      screenshots: {
        idle: barrage[0].screenshot,
        simultaneous: simultaneousScreenshot,
      },
    });
  } catch (error) {
    result.error = String(error);
    if (page && !page.isClosed()) {
      try {
        result.failureScreenshot = await screenshot(page, `${name}-crawler-equipment-failed.png`);
      } catch {
        // Preserve the original failure.
      }
    }
  } finally {
    stopDiagnostics();
    result.diagnostics = diagnostics;
    if (result.status === "passed" && !diagnosticsClean(diagnostics)) {
      result.status = "failed";
      result.error = `Browser diagnostics were not clean: ${JSON.stringify(diagnostics)}`;
    }
    lifecycle?.event("case complete", { status: result.status, error: result.error ?? null });
    lifecycle?.markContextCloseBegin(context);
    await context.close();
    if (lifecycle?.file) result.lifecycleLog = lifecycle.file;
  }
  return result;
}

async function pauseAtDeploymentCheckpoint(page, fighterId, checkpoint, minimumProgress, label) {
  return page.evaluate(async ({ id, expected, requiredProgress, maximumMs }) => {
    const startedAt = performance.now();
    while (performance.now() - startedAt < maximumMs) {
      const qa = window.__ASHFALL_BATTLE_QA__;
      const snapshot = qa.getSnapshot();
      const fighter = snapshot.fighters.find((candidate) => candidate.id === id);
      if (fighter) {
        const audit = qa.auditFighterUnitLayer(id);
        const doorX = Number(snapshot.battleSpace?.crawlerDoor?.x ?? fighter.x);
        const rampX = Number(fighter.entryRampX ?? fighter.combatReadyX ?? doorX + 1);
        const progress = Math.max(0, Math.min(1, (fighter.x - doorX) / Math.max(1, rampX - doorX)));
        if (audit?.deploymentPlan?.checkpoint === expected && progress + 1e-6 >= requiredProgress) {
          qa.setRepresentativeSixProofPaused(true);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const frozenSnapshot = qa.getSnapshot();
          const frozenFighter = frozenSnapshot.fighters.find((candidate) => candidate.id === id);
          const frozenAudit = qa.auditFighterUnitLayer(id);
          if (frozenAudit?.deploymentPlan?.checkpoint === expected) {
            const frozenDoorX = Number(frozenSnapshot.battleSpace?.crawlerDoor?.x ?? frozenFighter.x);
            const frozenRampX = Number(frozenFighter.entryRampX ?? frozenFighter.combatReadyX ?? frozenDoorX + 1);
            const frozenProgress = Math.max(0, Math.min(
              1,
              (frozenFighter.x - frozenDoorX) / Math.max(1, frozenRampX - frozenDoorX),
            ));
            if (frozenProgress + 1e-6 >= requiredProgress) {
              return { fighter: frozenFighter, audit: frozenAudit, observedProgress: frozenProgress };
            }
          }
          qa.setRepresentativeSixProofPaused(false);
        }
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    throw new Error(`deployment checkpoint ${expected} timed out`);
  }, {
    id: fighterId,
    expected: checkpoint,
    requiredProgress: minimumProgress,
    maximumMs: timeout,
  }).catch((error) => {
    throw new Error(`${label}: ${String(error)}`);
  });
}

async function queueAndPauseAtFirstDeploymentFrame(page, unitKind, label) {
  return page.evaluate(async ({ kind, maximumMs }) => {
    const qa = window.__ASHFALL_BATTLE_QA__;
    if (qa.queueCrawlerDefenseUnit(kind, 1) !== true) {
      throw new Error(`CRAWLER queue rejected ${kind}`);
    }
    const startedAt = performance.now();
    while (performance.now() - startedAt < maximumMs) {
      const snapshot = qa.getSnapshot();
      const fighter = snapshot.fighters.find((candidate) => (
        candidate.side === "human"
          && candidate.kind === kind
          && candidate.spawnPortalId === "crawler-door"
      ));
      if (fighter) {
        const audit = qa.auditFighterUnitLayer(fighter.id);
        const bannerReady = document.querySelector(".battle-banner")?.textContent
          ?.includes("移動拠点から出撃") === true;
        const doorX = Number(snapshot.battleSpace?.crawlerDoor?.x ?? fighter.x);
        const rampX = Number(fighter.entryRampX ?? fighter.combatReadyX ?? doorX + 1);
        const progress = Math.max(0, Math.min(1, (fighter.x - doorX) / Math.max(1, rampX - doorX)));
        if (bannerReady && audit?.deploymentPlan?.checkpoint === "fully-inside" && progress === 0) {
          qa.setRepresentativeSixProofPaused(true);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const frozenSnapshot = qa.getSnapshot();
          const frozenFighter = frozenSnapshot.fighters.find((candidate) => candidate.id === fighter.id);
          const frozenAudit = qa.auditFighterUnitLayer(fighter.id);
          if (frozenAudit?.deploymentPlan?.checkpoint === "fully-inside"
            && frozenFighter.x === fighter.x) {
            return { fighter: frozenFighter, audit: frozenAudit, observedProgress: progress };
          }
          qa.setRepresentativeSixProofPaused(false);
        }
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    throw new Error(`first deployment frame for ${kind} timed out`);
  }, { kind: unitKind, maximumMs: timeout }).catch((error) => {
    throw new Error(`${label}: ${String(error)}`);
  });
}

function validateDeploymentCheckpoint(evidence, expectedFamily, expectedCheckpoint, label) {
  const { audit, fighter } = evidence;
  invariant(audit.deploymentPlan?.family === expectedFamily,
    `${label}: deployment family ${audit.deploymentPlan?.family}/${expectedFamily}`);
  invariant(audit.deploymentPlan?.checkpoint === expectedCheckpoint,
    `${label}: checkpoint ${audit.deploymentPlan?.checkpoint}/${expectedCheckpoint}`);
  if (expectedCheckpoint === "fully-inside") {
    invariant(evidence.observedProgress === 0,
      `${label}: fully-inside frame advanced to ${evidence.observedProgress}`);
  }
  invariant(audit.actual?.nonzeroPixels > 0 && audit.actual?.bounds,
    `${label}: production unit layer disappeared`);
  invariant(audit.opaque?.nonzeroPixels > 0 && audit.opaque?.bounds,
    `${label}: opaque reference unit layer disappeared`);
  invariant(audit.alphaOneFromFirstVisibleFrame === true,
    `${label}: deployment unit was not alpha 1`);
  invariant(audit.opacityComparison?.maskIoU >= .999
    && audit.opacityComparison?.normalizedAlphaL1 <= .001,
  `${label}: deployment alpha differs from the opaque reference`);
  invariant(audit.clipRect === null && audit.clipMode === "none",
    `${label}: legacy deployment clip remains`);
  invariant(audit.unitDrawCount === 1, `${label}: unit draw count ${audit.unitDrawCount}`);
  invariant(audit.finalCompositePixels?.pass === true,
    `${label}: final battle canvas RGBA failed ${JSON.stringify(audit.finalCompositePixels)}`);
  invariant(audit.finalCompositePixels?.fractionalForegroundPixels === 0,
    `${label}: CRAWLER foreground has fractional global alpha`);
  invariant(audit.finalCompositePixels?.singleUnitSilhouette === true,
    `${label}: duplicate or ghost unit silhouette detected`);
  invariant(audit.finalCompositePixels?.finalCanvasKeepsUnitOpaque === true,
    `${label}: final canvas does not retain opaque unit pixels`);
  invariant(fighter?.renderAudit?.poseOpacity === 1
    && fighter?.renderAudit?.effectiveOpacity === 1
    && fighter?.animationPresentation?.pose?.opacity === 1,
  `${label}: live fighter render remained translucent`);
  if (expectedCheckpoint === "fully-outside") {
    invariant(audit.deploymentPlan.active === false
      && audit.deploymentPlan.checkpoint === "fully-outside",
    `${label}: fully-outside unit retained an interior pass`);
  } else {
    invariant(audit.deploymentPlan.active === true,
      `${label}: deployment plan became inactive before the ramp exit`);
    invariant(audit.deploymentPlan.unitPass === "before-foreground-mask",
      `${label}: physical CRAWLER occlusion is not owned by the foreground mask`);
  }
}

async function runDeploymentCase(browser, engine, viewport, lifecycle = null) {
  const name = `${engine}-${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport });
  lifecycle?.attachContext(context);
  let page;
  let stopDiagnostics = () => {};
  let diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  const result = { type: "deployment", engine, viewport, status: "failed", units: [] };
  try {
    lifecycle?.setPhase("deployment setup");
    ({ page, stop: stopDiagnostics, diagnostics } = await openBattlePage(context, "mission", {}, lifecycle));
    await loadedCrawlerAssets(page, name);
    for (const unit of deploymentUnits) {
      invariant(crawlerDeploymentUnitFamily(unit.kind) === unit.family,
        `${name}/${unit.kind}: static deployment family mapping drifted`);
      const unitResult = { ...unit, checkpoints: [], status: "failed" };
      const prepared = await page.evaluate((kind) => (
        window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof({
          attackerKind: kind === "crazy-king" ? "crusher" : "walker",
          lane: 1,
          existingClaim: false,
        })
      ), unit.kind);
      invariant(Number.isInteger(prepared?.attackerId),
        `${name}/${unit.kind}: deployment fixture is unavailable`);
      lifecycle?.setPhase(`deployment/${unit.family}/fixture`);
      const firstFrame = await queueAndPauseAtFirstDeploymentFrame(
        page,
        unit.kind,
        `${name}/${unit.kind}`,
      );
      const fighterId = firstFrame.fighter?.id ?? null;
      invariant(Number.isInteger(fighterId), `${name}/${unit.kind}: fighter identity is unavailable`);
      for (const [checkpointIndex, checkpoint] of CRAWLER_DEPLOYMENT_CHECKPOINTS.entries()) {
        let evidence = firstFrame;
        if (checkpointIndex > 0) {
          await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
          evidence = await pauseAtDeploymentCheckpoint(
            page,
            fighterId,
            checkpoint.id,
            checkpoint.progress,
            `${name}/${unit.family}/${checkpoint.id}`,
          );
        }
        const label = `${name}/${unit.family}/${checkpoint.id}`;
        lifecycle?.setPhase(`deployment checkpoint/${unit.family}/${checkpoint.id}`);
        lifecycle?.event("deployment checkpoint start", {
          page,
          family: unit.family,
          checkpoint: checkpoint.id,
        });
        validateDeploymentCheckpoint(evidence, unit.family, checkpoint.id, label);
        const screenshotPath = await screenshot(
          page,
          `${name}-deployment-${unit.family}-${checkpointIndex}-${checkpoint.id}.png`,
        );
        const screenshotSha256 = await evidenceSha256(screenshotPath);
        unitResult.checkpoints.push({
          checkpoint: checkpoint.id,
          requestedProgress: checkpoint.progress,
          observedCheckpoint: evidence.audit.deploymentPlan?.checkpoint ?? null,
          observedProgress: evidence.observedProgress ?? null,
          fighter: evidence.fighter,
          audit: evidence.audit,
          screenshot: screenshotPath,
          screenshotSha256,
        });
        lifecycle?.event("deployment checkpoint complete", {
          page,
          family: unit.family,
          checkpoint: checkpoint.id,
          milestone: `${unit.family}/${checkpoint.id} deployment checkpoint complete`,
        });
      }
      const fullyInside = unitResult.checkpoints[0];
      const firstVisible = unitResult.checkpoints[1];
      invariant(fullyInside.observedCheckpoint === "fully-inside"
        && fullyInside.observedProgress === 0,
      `${name}/${unit.family}: production progress-0 frame was not retained`);
      invariant(firstVisible.observedCheckpoint === "first-visible"
        && firstVisible.observedProgress >= CRAWLER_DEPLOYMENT_CHECKPOINTS[1].progress
        && firstVisible.fighter.x > fullyInside.fighter.x,
      `${name}/${unit.family}: first-visible frame did not advance monotonically`);
      invariant(firstVisible.screenshotSha256 !== fullyInside.screenshotSha256,
        `${name}/${unit.family}: fully-inside and first-visible screenshots are identical`);
      invariant(unitResult.checkpoints.every((entry, index, entries) => (
        index === 0 || entry.fighter.x + 1e-6 >= entries[index - 1].fighter.x
      )), `${name}/${unit.family}: deployment position regressed between checkpoints`);
      const midpoint = unitResult.checkpoints.find(({ checkpoint }) => checkpoint === "half");
      const rampClear = unitResult.checkpoints.at(-1);
      invariant(midpoint?.observedProgress >= .5,
        `${name}/${unit.family}: midpoint evidence is missing`);
      invariant(rampClear?.observedCheckpoint === "fully-outside"
        && rampClear.fighter.entryRampCleared === true
        && rampClear.fighter.gateEntering === false
        && rampClear.fighter.combatReady === true,
      `${name}/${unit.family}: ramp-clear/combat-ready boundary is incomplete`);
      // Production intentionally flips ramp-cleared and combat-ready atomically.
      // Name the five acceptance keyframes explicitly while retaining the six
      // sampled frames and their original receipt/checkpoint data.
      unitResult.requiredKeyframes = {
        doorInside: fullyInside,
        firstVisible,
        midpoint,
        rampClear,
        combatReady: rampClear,
      };
      unitResult.contactSheet = await deploymentRuntimeContactSheet(
        name,
        unit.family,
        viewport,
        unitResult.checkpoints,
      );
      unitResult.status = "passed";
      unitResult.fighterId = fighterId;
      result.units.push(unitResult);
    }
    invariant(result.units.length === deploymentUnits.length
      && result.units.every(({ status, checkpoints }) => (
        status === "passed" && checkpoints.length === CRAWLER_DEPLOYMENT_CHECKPOINTS.length
      )), `${name}: deployment matrix is incomplete`);
    result.status = "passed";
  } catch (error) {
    result.error = String(error);
    if (page && !page.isClosed()) {
      try {
        result.failureScreenshot = await screenshot(page, `${name}-deployment-failed.png`);
      } catch {
        // Preserve the original failure.
      }
    }
  } finally {
    stopDiagnostics();
    result.diagnostics = diagnostics;
    if (result.status === "passed" && !diagnosticsClean(diagnostics)) {
      result.status = "failed";
      result.error = `Browser diagnostics were not clean: ${JSON.stringify(diagnostics)}`;
    }
    lifecycle?.event("case complete", { status: result.status, error: result.error ?? null });
    lifecycle?.markContextCloseBegin(context);
    await context.close();
    if (lifecycle?.file) result.lifecycleLog = lifecycle.file;
  }
  return result;
}

const buildIdentityAtStart = await productionBuildIdentity();
const buildSentinel = path.resolve("dist/server/index.js");
const buildMtimeMs = (await stat(buildSentinel)).mtimeMs;
const latestInputMtimeMs = Math.max(
  await recursiveLatestMtimeMs(path.resolve("app")),
  await recursiveLatestMtimeMs(path.resolve("public")),
  (await stat(path.resolve("package.json"))).mtimeMs,
);
invariant(buildMtimeMs >= latestInputMtimeMs,
  "Production build is stale; rebuild before final-remediation browser QA");
const runtimeEvidence = await staticRuntimeEvidence();

for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `Unsupported browser engine: ${engine}`);
  for (const viewport of viewports) {
    if (caseTypes.includes("hud")) results.push(await runHudCase(browserType, engine, viewport));
    if (caseTypes.includes("crawler-equipment") || caseTypes.includes("deployment")) {
      const lifecycleByCase = new Map();
      for (const caseType of ["crawler-equipment", "deployment"]) {
        if (caseTypes.includes(caseType)) {
          lifecycleByCase.set(caseType, await createLifecycleDiagnostics({
            engine,
            viewport,
            caseType,
            name: `${engine}-${viewport.width}x${viewport.height}`,
          }));
        }
      }
      let browser = null;
      try {
        lifecycleByCase.forEach((lifecycle) => lifecycle.setPhase("browser launch"));
        browser = await browserType.launch({ headless: true });
        lifecycleByCase.forEach((lifecycle) => lifecycle.attachBrowser(browser));
        if (caseTypes.includes("crawler-equipment")) {
          results.push(await runEquipmentCase(
            browser,
            engine,
            viewport,
            runtimeEvidence,
            lifecycleByCase.get("crawler-equipment"),
          ));
        }
        if (caseTypes.includes("deployment")) {
          results.push(await runDeploymentCase(
            browser,
            engine,
            viewport,
            lifecycleByCase.get("deployment"),
          ));
        }
      } finally {
        lifecycleByCase.forEach((lifecycle) => {
          lifecycle.setPhase("browser teardown");
          lifecycle.markBrowserCloseBegin();
        });
        if (browser) await browser.close();
        for (const lifecycle of lifecycleByCase.values()) await lifecycle.flush();
      }
    }
  }
}

const buildIdentityAtEnd = await productionBuildIdentity();
const buildIdentityStable = buildIdentityAtStart.combinedSha256 === buildIdentityAtEnd.combinedSha256;
const expectedCaseCount = engines.length * viewports.length * caseTypes.length;
const canonicalAxes = engines.length === canonicalEngines.length
  && canonicalEngines.every((engine) => engines.includes(engine))
  && viewportKeys.length === canonicalViewports.length
  && canonicalViewports.every(({ width, height }) => viewportKeys.includes(`${width}x${height}`))
  && deploymentUnits.length === canonicalDeploymentUnits.length
  && caseTypes.length === canonicalCaseTypes.length
  && canonicalCaseTypes.every((caseType) => caseTypes.includes(caseType));
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  canonicalAxes,
  engines,
  viewports,
  deploymentUnits,
  caseTypes,
  buildFreshness: {
    sentinel: relativeEvidencePath(buildSentinel),
    buildMtime: new Date(buildMtimeMs).toISOString(),
    latestProductionInputMtime: new Date(latestInputMtimeMs).toISOString(),
    fresh: buildMtimeMs >= latestInputMtimeMs,
  },
  buildIdentityAtStart,
  buildIdentityAtEnd,
  buildIdentityStable,
  runtimeEvidence,
  expectedCaseCount,
  total: results.length,
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status !== "passed").length,
  screenshotCount: results.reduce((total, result) => {
    if (result.type === "hud") return total + (result.status === "passed" ? result.states.length : 0);
    if (result.type === "crawler-equipment") {
      return total + (result.barrage?.length ?? 0) + (result.airstrike?.length ?? 0) + (result.simultaneous ? 1 : 0);
    }
    if (result.type === "deployment") {
      return total + result.units.reduce((sum, unit) => sum + unit.checkpoints.length, 0);
    }
    return total;
  }, 0),
  contactSheetCount: results.reduce((total, result) => (
    total
      + (result.type === "crawler-equipment" && result.contactSheets ? 2 : 0)
      + (result.type === "deployment"
        ? result.units.filter(({ contactSheet }) => Boolean(contactSheet)).length
        : 0)
  ), 0),
  results,
};
const summaryPath = path.join(evidenceDir, "summary.json");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  report: relativeEvidencePath(summaryPath),
  canonicalAxes,
  expectedCaseCount,
  total: summary.total,
  passed: summary.passed,
  failed: summary.failed,
  screenshotCount: summary.screenshotCount,
  buildIdentityStable,
  cases: results.map(({ type, engine, viewport, status, error }) => ({
    type,
    engine,
    viewport: `${viewport.width}x${viewport.height}`,
    status,
    error,
  })),
}, null, 2));

invariant(buildIdentityStable, "Production dist changed while final-remediation browser QA was running");
invariant(results.length === expectedCaseCount,
  `Final-remediation QA produced ${results.length}/${expectedCaseCount} cases`);
invariant(summary.failed === 0,
  `Final-remediation QA failed ${summary.failed}/${summary.total} cases; see ${relativeEvidencePath(summaryPath)}`);
if (canonicalAxes) {
  invariant(summary.screenshotCount === (engines.length * viewports.length * (8 + 15 + 42)),
    `Canonical final-remediation screenshot matrix is incomplete: ${summary.screenshotCount}`);
}
