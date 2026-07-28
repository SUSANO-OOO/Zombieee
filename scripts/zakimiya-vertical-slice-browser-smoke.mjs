import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.ZAKIMIYA_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Zakimiya QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.ZAKIMIYA_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
for (const engine of engines) {
  if (!browserTypes[engine]) throw new Error(`Unknown ZAKIMIYA_QA_ENGINES value: ${engine}`);
}

const viewports = [
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const evidenceDir = path.resolve(
  process.env.ZAKIMIYA_QA_EVIDENCE_DIR ?? "outputs/zakimiya-vertical-slice-browser-smoke",
);
const timeout = Math.max(10_000, Number(process.env.ZAKIMIYA_QA_TIMEOUT_MS) || 30_000);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
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
  return diagnostics;
}

function qaUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ qa: "zakimiya", safe: "iphone-landscape" }).toString();
  return String(url);
}

function rectanglesOverlap(left, right, gap = 2) {
  return left.left < right.right + gap
    && left.right + gap > right.left
    && left.top < right.bottom + gap
    && left.bottom + gap > right.top;
}

for (const engine of engines) {
  const browser = await browserTypes[engine].launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(timeout);
      const diagnostics = diagnosticsFor(page);
      await page.goto(qaUrl(), { waitUntil: "domcontentloaded" });
      const migrationButton = page.getByRole("button", { name: "内容を確認" });
      if (await migrationButton.isVisible().catch(() => false)) await migrationButton.click();
      const start = page.locator(".formation-footer .campaign-primary");
      await start.waitFor({ state: "visible" });
      if (await migrationButton.isVisible().catch(() => false)) await migrationButton.click();
      await page.waitForFunction(() => {
        const button = document.querySelector(".formation-footer .campaign-primary");
        return button instanceof HTMLButtonElement && !button.disabled;
      });
      await start.click();
      for (let eventCount = 0; eventCount < 8; eventCount += 1) {
        await page.waitForFunction(() => (
          Boolean(document.querySelector("canvas.battlefield.active"))
          || Boolean(document.querySelector(".event-screen"))
        ));
        if (await page.locator("canvas.battlefield.active").isVisible().catch(() => false)) break;
        const eventScreen = page.locator(".event-screen");
        invariant(await eventScreen.isVisible(), `${engine}/${viewport.height}: battle entry reached neither event nor battlefield`);
        await eventScreen.getByRole("button", { name: "スキップ", exact: true }).click();
        await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
      }
      await page.locator("canvas.battlefield.active").waitFor({ state: "visible" });
      await page.waitForFunction(() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        const zakimiya = snapshot?.fighters?.find((fighter) => fighter.kind === "zakimiya");
        return zakimiya?.combatReady === true && zakimiya.attackSequence >= 1;
      });
      const readyButton = page.locator(".manual-ability-ready[data-ability-kind='zakimiya']");
      await readyButton.waitFor({ state: "visible" });
      const supportButton = page.locator(".support-btn:not([disabled])").first();
      await supportButton.click();
      await readyButton.waitFor({ state: "detached" });
      await supportButton.click();
      await readyButton.waitFor({ state: "visible" });

      const before = await page.evaluate(() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
        const button = document.querySelector(".manual-ability-ready[data-ability-kind='zakimiya']");
        const pointer = button?.querySelector(":scope > i");
        const canvas = document.querySelector("canvas.battlefield");
        const selectors = [
          ".top-hud", ".survival-hud", ".boss-hud", ".crawler-alert",
          ".battle-barks", ".bottom-hud", ".stats-strip",
        ];
        return {
          snapshot,
          buttonRect: button?.getBoundingClientRect().toJSON() ?? null,
          canvasRect: canvas?.getBoundingClientRect().toJSON() ?? null,
          ownerAnchor: button ? {
            x: Number(button.dataset.ownerAnchorX),
            y: Number(button.dataset.ownerAnchorY),
          } : null,
          pointer: pointer ? {
            height: Number.parseFloat(pointer.style.height),
            transform: pointer.style.transform,
          } : null,
          obstacleRects: selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
            .filter((element) => {
              const style = getComputedStyle(element);
              return style.display !== "none" && style.visibility !== "hidden";
            })
            .map((element) => element.getBoundingClientRect().toJSON()),
          sprite: (() => {
            const image = [...document.images].find((candidate) => candidate.src.includes("zakimiya-battle-r1.png"));
            return image ? { complete: image.complete, width: image.naturalWidth, height: image.naturalHeight } : null;
          })(),
        };
      });
      invariant(before.buttonRect && before.canvasRect, `${engine}/${viewport.height}: ready icon geometry missing`);
      invariant(before.buttonRect.width >= 44 && before.buttonRect.height >= 44,
        `${engine}/${viewport.height}: ready icon hit target is below 44px`);
      invariant(before.buttonRect.left >= before.canvasRect.left + 44,
        `${engine}/${viewport.height}: ready icon entered left safe area`);
      invariant(before.buttonRect.right <= before.canvasRect.right - 44,
        `${engine}/${viewport.height}: ready icon entered right safe area`);
      invariant(before.buttonRect.top >= before.canvasRect.top,
        `${engine}/${viewport.height}: ready icon entered top safe area`);
      invariant(before.buttonRect.bottom <= before.canvasRect.bottom - 21,
        `${engine}/${viewport.height}: ready icon entered bottom safe area`);
      invariant(before.ownerAnchor && before.pointer,
        `${engine}/${viewport.height}: owner pointer evidence missing`);
      const pointerOrigin = {
        x: before.buttonRect.left - before.canvasRect.left + before.buttonRect.width / 2,
        y: before.buttonRect.top - before.canvasRect.top + before.buttonRect.height / 2,
      };
      const expectedPointerLength = Math.hypot(
        before.ownerAnchor.x - pointerOrigin.x,
        before.ownerAnchor.y - pointerOrigin.y,
      );
      invariant(Math.abs(before.pointer.height - expectedPointerLength) < 1,
        `${engine}/${viewport.height}: ready icon pointer does not reach its owner`);
      invariant(/^rotate\(-?\d+(?:\.\d+)?deg\)$/.test(before.pointer.transform),
        `${engine}/${viewport.height}: ready icon pointer direction missing`);
      for (const obstacle of before.obstacleRects) {
        invariant(!rectanglesOverlap(before.buttonRect, obstacle),
          `${engine}/${viewport.height}: ready icon overlaps HUD obstacle`);
      }
      invariant(before.snapshot.geometry.offFloorCount === 0,
        `${engine}/${viewport.height}: fighter grounding failed`);
      const zakimiyaBefore = before.snapshot.fighters.find((fighter) => fighter.kind === "zakimiya");
      invariant(zakimiyaBefore?.attackSequence >= 1,
        `${engine}/${viewport.height}: normal bottle attack did not execute`);
      invariant(zakimiyaBefore?.manualAbility?.phase === "ready",
        `${engine}/${viewport.height}: manual ability was not ready`);

      const baseName = `${engine}-${viewport.width}x${viewport.height}`;
      await page.screenshot({ path: path.join(evidenceDir, `${baseName}-ready.png`) });
      await readyButton.click();
      await readyButton.waitFor({ state: "detached" });
      await page.waitForTimeout(140);
      const midFlight = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      invariant(midFlight.manualAbilityVfx.length === 1,
        `${engine}/${viewport.height}: thrown bottle VFX was not active`);
      await page.screenshot({ path: path.join(evidenceDir, `${baseName}-ability.png`) });
      await page.waitForFunction(() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return snapshot?.areaEffects?.some((effect) => effect.kind === "burn" && effect.sourceSupplyId < -100000);
      });
      const after = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
      const zakimiyaAfter = after.fighters.find((fighter) => fighter.kind === "zakimiya");
      const cluster = after.fighters.filter((fighter) => (
        fighter.side === "zombie" && fighter.x >= 520 && fighter.hp < fighter.maxHp
      ));
      invariant(cluster.length === 3,
        `${engine}/${viewport.height}: fire whisky did not damage the three-enemy cluster`);
      invariant(zakimiyaAfter?.manualAbility?.phase === "cooldown",
        `${engine}/${viewport.height}: ability did not enter per-instance cooldown`);
      invariant(await readyButton.count() === 0,
        `${engine}/${viewport.height}: cooldown rendered a persistent overhead icon`);
      invariant(after.areaEffects.some((effect) => effect.kind === "burn"),
        `${engine}/${viewport.height}: burn area was not connected`);
      invariant(diagnostics.consoleErrors.length === 0, `${engine}/${viewport.height}: console errors ${diagnostics.consoleErrors}`);
      invariant(diagnostics.pageErrors.length === 0, `${engine}/${viewport.height}: page errors ${diagnostics.pageErrors}`);
      invariant(diagnostics.requestFailures.length === 0, `${engine}/${viewport.height}: request failures ${diagnostics.requestFailures}`);
      invariant(diagnostics.httpErrors.length === 0, `${engine}/${viewport.height}: HTTP errors ${diagnostics.httpErrors}`);

      results.push({
        engine,
        viewport,
        normalAttackSequence: zakimiyaBefore.attackSequence,
        readyIcon: before.buttonRect,
        affectedClusterIds: cluster.map(({ id }) => id),
        cooldownRemaining: zakimiyaAfter.manualAbility.cooldownRemaining,
        offFloorCount: after.geometry.offFloorCount,
        diagnostics,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

await writeFile(
  path.join(evidenceDir, "results.json"),
  `${JSON.stringify({ cases: results.length, results }, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({ message: "Zakimiya vertical-slice browser QA passed", cases: results.length, evidenceDir }, null, 2));
