import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import { EVENT_PORTRAIT_PROFILES } from "../app/visualProfiles.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import {
  PORTRAIT_DIALOGUE_OVERLAP_MAX_PX,
  PORTRAIT_DIALOGUE_OVERLAP_MIN_PX,
  portraitDialogueOverlapWithinContract,
} from "./issue156-remediation-contract.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

const baseUrl = new URL(process.env.ISSUE156_REMEDIATION_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Issue #156 remediation QA is local-only; refusing ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.ISSUE156_REMEDIATION_QA_ENGINES ?? "chromium,webkit").split(",");
const viewports = (process.env.ISSUE156_REMEDIATION_QA_VIEWPORTS ?? "667x375,736x414,844x340,844x390,932x430,1280x720")
  .split(",")
  .map((value) => {
    const [width, height] = value.split("x").map(Number);
    return { width, height };
  });
const evidenceDir = path.resolve(
  process.env.ISSUE156_REMEDIATION_QA_EVIDENCE_DIR ?? "docs/qa/issue156/remediation",
);
await mkdir(evidenceDir, { recursive: true });

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const relative = (file) => path.relative(process.cwd(), file).replaceAll("\\", "/");
const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");

async function sourceAlphaBounds(profile) {
  const file = path.join(process.cwd(), "public", profile.path);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let alphaTop = -1;
  let alphaBottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    let rowVisible = false;
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] >= 32) rowVisible = true;
    }
    if (rowVisible && alphaTop < 0) alphaTop = y;
    if (rowVisible) alphaBottom = y;
  }
  if (alphaTop < 0 || alphaBottom < alphaTop) {
    throw new Error(`portrait has no visible pixels: ${profile.path}`);
  }
  const sizeMatch = /(?:^|\s)(\d+(?:\.\d+)?)%$/u.exec(profile.crop);
  invariant(sizeMatch, `portrait crop must provide a height percentage: ${profile.path}`);
  return {
    alphaTop,
    alphaBottom,
    sourceWidth: info.width,
    sourceHeight: info.height,
    renderedHeightRatio: Number(sizeMatch[1]) / 100,
  };
}

const sourceGeometry = Object.fromEntries(await Promise.all(
  Object.entries(EVENT_PORTRAIT_PROFILES).map(async ([kind, profile]) => [kind, await sourceAlphaBounds(profile)]),
));

function storyUrl(withSafeArea) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "story",
    event: "prologue-kumaya-v070",
    ...(withSafeArea ? { safe: "iphone-landscape" } : {}),
  }).toString();
  return String(url);
}

async function contactSheet(engine, viewport, safeAreaProfile, entries) {
  const tileWidth = 320;
  const tileHeight = 180;
  const columns = 6;
  const rows = Math.ceil(entries.length / columns);
  const tiles = await Promise.all(entries.map(({ screenshot }) => sharp(path.resolve(screenshot))
    .resize({ width: tileWidth, height: tileHeight, fit: "cover" })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer()));
  const output = path.join(
    evidenceDir,
    `${engine}-${viewport.width}x${viewport.height}-${safeAreaProfile}-portraits-contact-sheet.png`,
  );
  await sharp({
    create: {
      width: tileWidth * columns,
      height: tileHeight * rows,
      channels: 4,
      background: { r: 7, g: 9, b: 10, alpha: 1 },
    },
  }).composite(tiles.map((input, index) => ({
    input,
    left: index % columns * tileWidth,
    top: Math.floor(index / columns) * tileHeight,
  }))).png({ compressionLevel: 9, palette: false }).toFile(output);
  return { path: relative(output), sha256: await sha256(output), columns, rows };
}

async function runCase(engine, viewport, safeAreaMode) {
  const browser = await browserTypes[engine].launch({ headless: true });
  const context = await browser.newContext({ viewport });
  let page = await context.newPage();
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  const result = { engine, viewport, safeAreaMode, status: "failed", portraits: [], diagnostics };
  const attachDiagnostics = (target) => {
    target.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
    });
    target.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
    target.on("requestfailed", (request) => diagnostics.requestFailures.push(
      `${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
    ));
    target.on("response", (response) => {
      if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
    });
  };
  try {
    attachDiagnostics(page);
    await page.goto(storyUrl(false), { waitUntil: "domcontentloaded" });
    await dismissInstallOffer(page, { timeout: 5_000 });
    await page.locator(".event-screen").waitFor({ state: "visible", timeout: 30_000 });
    const productionSafeArea = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        source: root.dataset.safeAreaSource ?? null,
        inline: Object.fromEntries(["top", "right", "bottom", "left"].map((edge) => [
          edge,
          root.style.getPropertyValue(`--app-viewport-safe-${edge}`),
        ])),
      };
    });
    invariant(productionSafeArea.source === null, `${engine}: production-safe source must be CSS env`);
    invariant(Object.values(productionSafeArea.inline).every((value) => value === ""),
      `${engine}: production path has inline safe-area override ${JSON.stringify(productionSafeArea)}`);

    const usesNotchPreset = safeAreaMode === "iphone-landscape";
    let presetSafeArea = null;
    let safeAreaProfile = "production-env-zero-inset";
    if (usesNotchPreset) {
      await page.close();
      page = await context.newPage();
      attachDiagnostics(page);
      await page.goto(storyUrl(true), { waitUntil: "domcontentloaded" });
      await dismissInstallOffer(page, { timeout: 5_000 });
      await page.locator(".event-screen").waitFor({ state: "visible", timeout: 30_000 });
      presetSafeArea = await page.evaluate(() => {
        const root = document.documentElement;
        return {
          source: root.dataset.safeAreaSource ?? null,
          values: ["top", "right", "bottom", "left"].map((edge) => (
            root.style.getPropertyValue(`--app-viewport-safe-${edge}`)
          )),
        };
      });
      invariant(presetSafeArea.source === "local-qa-iphone-landscape", `${engine}: QA preset missing`);
      invariant(JSON.stringify(presetSafeArea.values) === JSON.stringify(["0px", "44px", "21px", "44px"]),
        `${engine}: QA preset drifted ${JSON.stringify(presetSafeArea.values)}`);
      safeAreaProfile = "iphone-landscape-44-21";
    }

    const metadata = await page.locator('meta[name="description"]').getAttribute("content");
    invariant(metadata?.startsWith("大型移動拠点と"), `${engine}: public metadata prefix drifted`);
    invariant(!/crawler|クローラー/iu.test(metadata ?? ""), `${engine}: retired public wording remains`);

    for (const [kind, profile] of Object.entries(EVENT_PORTRAIT_PROFILES)) {
      const geometry = await page.evaluate(async ({ portraitKind, portraitProfile, source }) => {
        const portrait = document.querySelector(".event-portrait.active");
        const dialogue = document.querySelector(".dialogue-box");
        const name = document.querySelector(".dialogue-name b");
        const role = document.querySelector(".dialogue-name small");
        const body = document.querySelector(".dialogue-text");
        const advance = document.querySelector(".dialogue-box > em");
        if (!portrait || !dialogue || !name || !role || !body || !advance) {
          throw new Error("event presentation DOM is incomplete");
        }
        const image = new Image();
        image.src = portraitProfile.path;
        await image.decode();
        portrait.dataset.portrait = portraitKind;
        portrait.style.backgroundImage = `url('${portraitProfile.path}')`;
        portrait.style.setProperty("--event-portrait-focus-x", `${portraitProfile.focusX * 100}%`);
        portrait.style.setProperty("--event-portrait-focus-y", `${portraitProfile.focusY * 100}%`);
        portrait.style.setProperty("--event-portrait-scale", String(portraitProfile.scale));
        portrait.style.setProperty("--event-portrait-crop", portraitProfile.crop);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const rect = portrait.getBoundingClientRect();
        const dialogueRect = dialogue.getBoundingClientRect();
        const textRect = body.getBoundingClientRect();
        const advanceRect = advance.getBoundingClientRect();
        const portraitStyle = getComputedStyle(portrait);
        const dialogueStyle = getComputedStyle(dialogue);
        const renderedHeight = portrait.offsetHeight * source.renderedHeightRatio;
        const backgroundOffset = (portrait.offsetHeight - renderedHeight) * portraitProfile.focusY;
        const headMargin = backgroundOffset + source.alphaTop / source.sourceHeight * renderedHeight;
        const paintedBottom = rect.top + backgroundOffset
          + ((source.alphaBottom + 1) / source.sourceHeight) * renderedHeight;
        return {
          activePortraitCount: document.querySelectorAll(".event-portrait.active").length,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom },
          dialogueRect: { x: dialogueRect.x, y: dialogueRect.y, width: dialogueRect.width, height: dialogueRect.height },
          backgroundSize: portraitStyle.backgroundSize,
          backgroundPosition: portraitStyle.backgroundPosition,
          headMargin,
          faceCenterRatio: portraitProfile.focusY,
          elementBoxDialogueOverlap: rect.bottom - dialogueRect.top,
          paintedBottom,
          torsoDialogueOverlap: paintedBottom - dialogueRect.top,
          zIndex: { portrait: Number(portraitStyle.zIndex), dialogue: Number(dialogueStyle.zIndex) },
          typography: {
            name: Number.parseFloat(getComputedStyle(name).fontSize),
            role: Number.parseFloat(getComputedStyle(role).fontSize),
            body: Number.parseFloat(getComputedStyle(body).fontSize),
            advanceWidth: advanceRect.width,
            advanceHeight: advanceRect.height,
          },
          textOverlapAdvance: !(textRect.right <= advanceRect.left || advanceRect.right <= textRect.left
            || textRect.bottom <= advanceRect.top || advanceRect.bottom <= textRect.top),
        };
      }, { portraitKind: kind, portraitProfile: profile, source: sourceGeometry[kind] });
      invariant(geometry.activePortraitCount === 1, `${engine}/${kind}: active portrait count`);
      invariant(geometry.headMargin >= 8, `${engine}/${kind}: head margin ${geometry.headMargin}`);
      invariant(geometry.faceCenterRatio >= .18 && geometry.faceCenterRatio <= .38,
        `${engine}/${kind}: face center`);
      invariant(portraitDialogueOverlapWithinContract(geometry.torsoDialogueOverlap),
        `${engine}/${kind}: portrait/dialogue overlap must be ${PORTRAIT_DIALOGUE_OVERLAP_MIN_PX}`
        + `-${PORTRAIT_DIALOGUE_OVERLAP_MAX_PX}px ${JSON.stringify(geometry)}`);
      invariant(geometry.zIndex.dialogue > geometry.zIndex.portrait, `${engine}/${kind}: text box z-order`);
      invariant(geometry.typography.name >= 14 && geometry.typography.role >= 12 && geometry.typography.body >= 12,
        `${engine}/${kind}: typography ${JSON.stringify(geometry.typography)}`);
      invariant(geometry.typography.advanceWidth >= 44 && geometry.typography.advanceHeight >= 44,
        `${engine}/${kind}: advance target`);
      invariant(geometry.textOverlapAdvance === false, `${engine}/${kind}: body/advance overlap`);
      const screenshotPath = path.join(
        evidenceDir,
        `${engine}-${viewport.width}x${viewport.height}-${safeAreaProfile}-portrait-${kind}.png`,
      );
      await page.screenshot({ path: screenshotPath, animations: "disabled" });
      result.portraits.push({
        kind,
        safeAreaProfile,
        profile,
        source: sourceGeometry[kind],
        geometry,
        screenshot: relative(screenshotPath),
        screenshotSha256: await sha256(screenshotPath),
      });
    }
    invariant(result.portraits.length === 18, `${engine}: portrait inventory incomplete`);

    // Populate the real authored log through the player-facing advance action;
    // do not inject rows or rewrite runtime state for evidence.
    for (let advanceIndex = 0; advanceIndex < 4; advanceIndex += 1) {
      await page.locator(".dialogue-box").click();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    await page.getByRole("button", { name: "会話ログ" }).click();
    const eventLog = page.locator(".event-log");
    await eventLog.waitFor({ state: "visible" });
    const logPresentation = await eventLog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const headerTitle = element.querySelector("header b");
      const close = element.querySelector("header button");
      const entries = [...element.querySelectorAll("p")];
      const firstSpeaker = entries[0]?.querySelector("b");
      const firstBody = entries[0]?.querySelector("span");
      const dialogue = document.querySelector(".dialogue-box");
      const controls = document.querySelector(".event-controls");
      if (!headerTitle || !close || entries.length < 5 || !firstSpeaker || !firstBody || !dialogue || !controls) {
        throw new Error("conversation log DOM is incomplete");
      }
      const closeRect = close.getBoundingClientRect();
      const dialogueRect = dialogue.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      const centerX = dialogueRect.left + dialogueRect.width / 2;
      const centerY = dialogueRect.top + dialogueRect.height / 2;
      const hit = document.elementFromPoint(centerX, centerY);
      return {
        role: element.getAttribute("role"),
        ariaModal: element.getAttribute("aria-modal"),
        entryCount: entries.length,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        visualViewport: {
          width: window.visualViewport?.width ?? window.innerWidth,
          height: window.visualViewport?.height ?? window.innerHeight,
        },
        typography: {
          header: Number.parseFloat(getComputedStyle(headerTitle).fontSize),
          close: Number.parseFloat(getComputedStyle(close).fontSize),
          speaker: Number.parseFloat(getComputedStyle(firstSpeaker).fontSize),
          body: Number.parseFloat(getComputedStyle(firstBody).fontSize),
        },
        closeTarget: { width: closeRect.width, height: closeRect.height },
        horizontalOverflow: element.scrollWidth - element.clientWidth,
        dialogueCenterOwnedByLog: Boolean(hit && element.contains(hit)),
        backgroundSurfacesCovered: rect.left <= dialogueRect.left && rect.top <= dialogueRect.top
          && rect.right >= dialogueRect.right && rect.bottom >= dialogueRect.bottom
          && rect.left <= controlsRect.left && rect.top <= controlsRect.top
          && rect.right >= controlsRect.right && rect.bottom >= controlsRect.bottom,
        focusedControl: document.activeElement === close,
      };
    });
    invariant(logPresentation.role === "dialog" && logPresentation.ariaModal === "true",
      `${engine}: conversation log modal semantics ${JSON.stringify(logPresentation)}`);
    invariant(logPresentation.entryCount >= 5, `${engine}: authored log was not populated`);
    invariant(logPresentation.typography.header >= 14 && logPresentation.typography.close >= 14
      && logPresentation.typography.speaker >= 12 && logPresentation.typography.body >= 14,
    `${engine}: conversation log typography ${JSON.stringify(logPresentation.typography)}`);
    invariant(logPresentation.closeTarget.width >= 44 && logPresentation.closeTarget.height >= 44,
      `${engine}: conversation log close target ${JSON.stringify(logPresentation.closeTarget)}`);
    invariant(logPresentation.horizontalOverflow <= 1,
      `${engine}: conversation log horizontal overflow ${logPresentation.horizontalOverflow}`);
    invariant(logPresentation.rect.left >= -1 && logPresentation.rect.top >= -1
      && logPresentation.rect.right <= logPresentation.visualViewport.width + 1
      && logPresentation.rect.bottom <= logPresentation.visualViewport.height + 1,
    `${engine}: conversation log leaves visual viewport ${JSON.stringify(logPresentation)}`);
    invariant(logPresentation.dialogueCenterOwnedByLog,
      `${engine}: background dialogue remains interactive through conversation log`);
    invariant(logPresentation.backgroundSurfacesCovered,
      `${engine}: conversation log does not cover background dialogue and controls`);
    invariant(logPresentation.focusedControl, `${engine}: close action did not receive focus`);
    const logScreenshot = path.join(
      evidenceDir,
      `${engine}-${viewport.width}x${viewport.height}-${safeAreaProfile}-conversation-log.png`,
    );
    await page.screenshot({ path: logScreenshot, animations: "disabled" });
    result.logPresentation = {
      ...logPresentation,
      screenshot: relative(logScreenshot),
      screenshotSha256: await sha256(logScreenshot),
    };
    await page.getByRole("button", { name: "閉じる" }).click();
    invariant(await eventLog.count() === 0, `${engine}: conversation log did not close`);
    invariant(await page.locator(".dialogue-box").isVisible(), `${engine}: dialogue did not resume after log close`);

    result.productionSafeArea = productionSafeArea;
    result.presetSafeArea = presetSafeArea;
    result.safeAreaProfile = safeAreaProfile;
    result.metadata = metadata;
    result.contactSheet = await contactSheet(engine, viewport, safeAreaProfile, result.portraits);
    result.status = "passed";
  } catch (error) {
    result.error = String(error);
  } finally {
    await context.close();
    await browser.close();
  }
  if (result.status === "passed") {
    invariant(Object.values(diagnostics).every((entries) => entries.length === 0),
      `${engine}: browser diagnostics ${JSON.stringify(diagnostics)}`);
  }
  return result;
}

const buildIdentityAtStart = await productionBuildIdentity();
const results = [];
for (const engine of engines) {
  invariant(browserTypes[engine], `unsupported browser engine ${engine}`);
  for (const viewport of viewports) {
    const safeAreaModes = viewport.width <= 960
      ? ["production-env", "iphone-landscape"]
      : ["production-env"];
    for (const safeAreaMode of safeAreaModes) {
      results.push(await runCase(engine, viewport, safeAreaMode));
    }
  }
}
const buildIdentityAtEnd = await productionBuildIdentity();
const summary = {
  generatedAt: new Date().toISOString(),
  buildIdentityAtStart,
  buildIdentityAtEnd,
  buildIdentityStable: buildIdentityAtStart.combinedSha256 === buildIdentityAtEnd.combinedSha256,
  engines,
  viewports,
  expectedCases: engines.length * viewports.reduce(
    (total, viewport) => total + (viewport.width <= 960 ? 2 : 1),
    0,
  ),
  total: results.length,
  passed: results.filter(({ status }) => status === "passed").length,
  results,
};
const summaryPath = path.join(evidenceDir, "presentation-summary.json");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  report: relative(summaryPath),
  total: summary.total,
  passed: summary.passed,
  failed: summary.total - summary.passed,
  buildIdentityStable: summary.buildIdentityStable,
  cases: results.map(({ engine, viewport, safeAreaMode, status, error }) => ({
    engine,
    viewport,
    safeAreaMode,
    status,
    error,
  })),
}, null, 2));
invariant(summary.buildIdentityStable, "production build changed during Issue #156 QA");
invariant(summary.total === summary.expectedCases && summary.passed === summary.expectedCases,
  `Issue #156 remediation browser QA failed; see ${relative(summaryPath)}`);
