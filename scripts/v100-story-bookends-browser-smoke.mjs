// Presentation fixtures only. This is not a substitute for the normal
// name-to-Stage-30 playthrough or a physical-device/audio listening pass.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STORY_EVENTS } from "../app/v100StoryEvents.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { createV100BattleResult, recordV100PendingResult } from "../app/v100Transactions.js";
import { v100EventPresentationFor } from "../app/v100EventPresentation.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177/");
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname));
const out = path.resolve(process.env.V100_BOOKENDS_EVIDENCE_DIR ?? "outputs/v100-story-bookends");
await mkdir(out, { recursive: true });
const report = { evidenceKind: "seeded presentation fixtures; no gameplay completion claim", build: await productionBuildIdentity(), cases: [] };
const engineNames = (process.env.V100_BOOKENDS_ENGINES ?? "chromium,webkit").split(",");
const eventSuffixes = (process.env.V100_BOOKENDS_EVENTS ?? "prologue,ending,credits,epilogue").split(",");
const sizes = (process.env.V100_BOOKENDS_VIEWPORTS ?? "1280x720,844x390,844x340").split(",").map(value => {
  const [width, height] = value.split("x").map(Number);
  assert.ok(width > 0 && height > 0);
  return { width, height };
});

async function inspect(page, eventId, phase, index, result) {
  const node = V100_STORY_EVENTS[eventId].nodes[index];
  const expected = v100EventPresentationFor({ eventId, phase, node, nodeIndex: index });
  const surface = page.locator(`[data-v100-event-id="${eventId}"][data-v100-node-index="${index}"]`);
  await surface.waitFor({ state: "visible", timeout: 15000 });
  const state = await surface.evaluate(element => {
    const backdrop = element.querySelector(".v100-event-backdrop");
    const copy = element.querySelector(".v100-credits-shot, .v100-node-copy, .v100-node-title");
    const rect = copy?.getBoundingClientRect();
    const action = element.querySelector(".v100-primary");
    const button = action?.getBoundingClientRect();
    const hit = button && document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2);
    return {
      background: backdrop ? getComputedStyle(backdrop).backgroundImage : null,
      titleCard: backdrop?.getAttribute("data-v100-title-card") === "true",
      text: copy?.textContent ?? "", scene: copy?.getAttribute("data-v100-credit-scene"),
      copyFits: Boolean(rect && rect.top >= 0 && rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight),
      actionReachable: Boolean(action && hit && (hit === action || action.contains(hit))),
      bodyOverflow: Math.max(document.documentElement.scrollWidth - innerWidth, document.body.scrollWidth - innerWidth),
    };
  });
  if (expected.backgroundPath) assert.ok(state.background?.includes(expected.backgroundPath), JSON.stringify(state));
  if (node.kind === "title") assert.equal(state.titleCard, true);
  if (node.kind === "montage") assert.equal(state.scene, node.sceneLabel);
  assert.equal(state.copyFits, true, `${eventId}:${index} text outside viewport`);
  assert.equal(state.actionReachable, true, `${eventId}:${index} next action is occluded`);
  assert.ok(state.bodyOverflow <= 1);
  assert.ok(!state.text.includes("台詞は使わず"));
  const audio = await page.evaluate(() => window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.() ?? null);
  assert.equal(audio?.desired?.sceneId, expected.sceneId);
  result.observations.push({ index, sourceLine: node.sourceLine, expectedSceneId: expected.sceneId, ...state });
  return expected;
}

try {
  for (const engine of engineNames) {
    assert.ok(["chromium", "webkit"].includes(engine));
    const browser = await ({ chromium, webkit })[engine].launch({ headless: true });
    try {
      for (const viewport of sizes) {
        for (const suffix of eventSuffixes) {
          const eventId = `v100:event:${suffix}`;
          assert.ok(V100_STORY_EVENTS[eventId], `Unknown event ${eventId}`);
          const stageNumber = V100_STORY_EVENTS[eventId].stageNumber;
          const phase = stageNumber ? "post" : suffix === "prologue" ? "event" : suffix;
          const name = `${engine}-${viewport.width}x${viewport.height}-${suffix.replaceAll(":", "-")}`;
          const context = await browser.newContext({ viewport, hasTouch: viewport.width === 844, isMobile: viewport.width === 844 });
          const page = await context.newPage();
          const result = { name, status: "failed", observations: [], diagnostics: { console: [], page: [], request: [], http: [] } };
          report.cases.push(result);
          page.on("console", message => { if (message.type() === "error") result.diagnostics.console.push(message.text()); });
          page.on("pageerror", error => result.diagnostics.page.push(String(error)));
          page.on("requestfailed", request => result.diagnostics.request.push({ url: request.url(), error: request.failure() }));
          page.on("response", response => { if (response.status() >= 400) result.diagnostics.http.push({ url: response.url(), status: response.status() }); });
          try {
            let save = normalizeV100Save({ ...createDefaultV100Save({ playerName: "場面確認" }), campaignStarted: true,
              flowState: { phase, eventId, stageId: null, stageNumber: null, nodeIndex: 0, finalized: true, firstClear: false, destination: phase } });
            if (stageNumber) {
              assert.ok(["s20:post", "s25:post"].includes(suffix));
              const stageId = V100_STAGE_IDS[stageNumber - 1];
              const initial = normalizeV100Save({ ...save, availableStageIds: V100_STAGE_IDS.slice(0, stageNumber), completedStageIds: V100_STAGE_IDS.slice(0, stageNumber - 1) });
              const result = createV100BattleResult({ stageId, battleRunId: name, won: true, bossDefeated: true, vehicleHp: 680, vehicleMaxHp: 680, objectiveComplete: true, elapsedSeconds: 120, unitDeaths: 0 });
              const pending = recordV100PendingResult(initial, result);
              assert.equal(pending.applied, true, pending.reason);
              save = normalizeV100Save({ ...pending.save, flowState: { phase, eventId, stageId, stageNumber, nodeIndex: 0, finalized: false, firstClear: true, destination: phase } });
            }
            await context.addInitScript(({ origin, serialized }) => {
              if (location.origin !== origin) return;
              for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, serialized);
            }, { origin: origin.origin, serialized: serializeV100Save(save) });
            const response = await page.goto(new URL("?event-audio-qa=1", origin).href, { waitUntil: "domcontentloaded" });
            assert.equal(response?.ok(), true);
            await page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }).click();
            await inspect(page, eventId, phase, 0, result);
            await page.screenshot({ path: path.join(out, `${name}-first.png`) });
            result.webAudioAvailable = await page.evaluate(() => typeof AudioContext === "function" || typeof webkitAudioContext === "function");
            result.audioEvidence = result.webAudioAvailable ? "scene-start receipt; no physical listening claim" : "unavailable on this browser; no audible-sound acceptance";
            const nodes = V100_STORY_EVENTS[eventId].nodes;
            // Every credit shot is reached through the real Next action.
            // The desktop lane also traverses every bookend node, including
            // crisis/blackout/location boundaries and the final title.
            const last = stageNumber || suffix === "credits" || (engine === "chromium" && viewport.width === 1280) ? nodes.length - 1 : 1;
            for (let index = 1; index <= last; index += 1) {
              await page.locator(".v100-event-actions .v100-primary").click();
              const expected = await inspect(page, eventId, phase, index, result);
              if (result.webAudioAvailable) {
                await page.waitForFunction(({ eventId, index, sceneId }) => {
                  const snapshot = window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.();
                  return snapshot?.receipts?.some(receipt => receipt.action === "started" && receipt.eventId === eventId && receipt.nodeIndex === index && receipt.sceneId === sceneId);
                }, { eventId, index, sceneId: expected.sceneId }, { timeout: 15000 });
              }
              if (index === last || [1617, 1623, 2058, 2064].includes(nodes[index].sourceLine) || (suffix === "credits" && index === 5)) await page.screenshot({ path: path.join(out, `${name}-${index}.png`) });
            }
            if (suffix === "credits") {
              await page.locator(".v100-event-actions .v100-primary").click();
              await inspect(page, "v100:event:epilogue", "epilogue", 0, result);
              assert.equal(result.observations.filter(row => row.scene).length, 11);
            }
            result.audio = await page.evaluate(() => window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.() ?? null);
            for (const [kind, errors] of Object.entries(result.diagnostics)) assert.deepEqual(errors, [], `${name} ${kind}`);
            result.status = "passed";
          } catch (error) {
            result.error = String(error);
            await page.screenshot({ path: path.join(out, `${name}-failed.png`) }).catch(() => {});
            throw error;
          } finally {
            await context.close();
            await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
          }
        }
      }
    } finally { await browser.close(); }
  }
} finally {
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: "passed", cases: report.cases.length, report: path.join(out, "report.json") }));
