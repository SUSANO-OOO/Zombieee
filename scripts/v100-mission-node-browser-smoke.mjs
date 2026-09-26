import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { V100_NODE_ART, V100_NODE_PROFILES, v100NodeFrame } from "../app/v100MissionNodes.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const out = path.resolve(process.env.V100_NODE_BROWSER_DIR ?? "outputs/v100-mission-node-browser");
await mkdir(out, { recursive: false });
const report = { build: await productionBuildIdentity(), scope: "Explicit save fixtures, native battle entry, read-only actual canvas calls and mission state; state transitions and earned play verified separately", cases: [] };
try {
  for (const [engine, api] of Object.entries({ chromium, webkit })) for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 340 }]) for (const number of [9, 15, 16, 28]) {
    const browser = await api.launch({ headless: true }), page = await browser.newPage({ viewport, hasTouch: true, isMobile: viewport.width < 1000 });
    const item = { engine, viewport, number, errors: [], status: "running" }; report.cases.push(item);
    const stageId = V100_STAGE_IDS[number - 1];
    const seed = normalizeV100Save({ ...createDefaultV100Save(), campaignStarted: true, playerName: "任務表示検証", levelCap: 30,
      availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, number - 1),
      readStoryEventIds: ["v100:event:prologue", `v100:event:s${String(number).padStart(2, "0")}:pre`],
      flowState: { phase: "formation", stageId, stageNumber: number, destination: "formation" } });
    page.on("pageerror", error => item.errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") item.errors.push(message.text()); });
    page.on("requestfailed", request => item.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on("response", response => { if (response.status() >= 400) item.errors.push(`${response.status()}: ${response.url()}`); });
    try {
      await page.addInitScript(({ origin, seed }) => {
        if (location.origin === origin && !localStorage.getItem("nishijin-campaign-v100")) localStorage.setItem("nishijin-campaign-v100", seed);
        const p = CanvasRenderingContext2D.prototype, draw = p.drawImage, clear = p.clearRect, backgroundSources = new WeakMap();
        window.__NODE_FRAME__ = []; window.__NODE_BACKGROUND__ = null;
        p.clearRect = function (...args) { if (this.canvas === document.querySelector(".game-shell canvas")) window.__NODE_FRAME__ = []; return clear.apply(this, args); };
        p.drawImage = function (source, ...args) {
          const background = source?.src ?? backgroundSources.get(source) ?? "";
          if (background.includes("/stages/")) backgroundSources.set(this.canvas, background);
          if (this.canvas === document.querySelector(".game-shell canvas")) {
            if (source?.src?.includes("node-states-v1.webp")) window.__NODE_FRAME__.push({ url: source.src, args });
            if (background.includes("/stages/")) window.__NODE_BACKGROUND__ = background;
          }
          return draw.call(this, source, ...args);
        };
      }, { origin: origin.origin, seed: serializeV100Save(seed) });
      await page.goto(origin.href); await page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.v100-shell[aria-busy="false"][data-v100-phase="formation"]'));
      await page.getByRole("button", { name: "戦闘へ", exact: true }).click();
      const count = number === 28 ? 4 : 3;
      await page.waitForFunction(count => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running && window.__NODE_FRAME__?.length === count, count);
      item.observed = await page.evaluate(() => ({ draws: window.__NODE_FRAME__, background: window.__NODE_BACKGROUND__, mission: window.__ASHFALL_BATTLE_QA__.getSnapshot().stageMission }));
      assert.equal(item.observed.draws.length, count);
      assert.equal(item.observed.mission.powerActivated, 0);
      const profile = V100_NODE_PROFILES[stageId], frame = v100NodeFrame(profile.shape, profile.shutdown ? "on" : "off");
      for (const draw of item.observed.draws) {
        assert.ok(draw.url.endsWith(V100_NODE_ART));
        assert.deepEqual(draw.args.slice(0, 4), [frame.x, frame.y, frame.w, frame.h]);
      }
      item.hud = await page.locator(".game-shell").innerText();
      if (number === 28) { assert.match(item.hud, /停止/u); assert.doesNotMatch(item.hud, /起動/u); }
      if (number === 16) assert.ok(item.observed.background?.endsWith("/art/v100/stages/s16-central-seal-clean-v1.webp"));
      if (number === 9) assert.ok(item.observed.background?.endsWith("/art/v100/stages/s09-hospital-mechanical-room-v1.webp"));
      item.screenshot = path.join(out, `${engine}-${viewport.width}x${viewport.height}-s${number}.png`);
      await page.screenshot({ path: item.screenshot }); assert.deepEqual(item.errors, []); item.status = "passed";
    } catch (error) {
      item.error = String(error.stack ?? error); item.status = "failed";
      await page.screenshot({ path: path.join(out, `${engine}-${viewport.width}-s${number}-failure.png`) }).catch(() => {}); throw error;
    } finally { await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
  }
  report.status = "passed";
} catch (error) { report.status = "failed"; report.error = String(error); process.exitCode = 1; }
finally { await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, cases: report.cases.length, error: report.error })); }
