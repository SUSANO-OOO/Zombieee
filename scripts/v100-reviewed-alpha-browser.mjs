import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const useCurrentWebKit = process.env.NEW_V100_NATIVE_CURRENT_WEBKIT === "1";
const { chromium, webkit } = await import(useCurrentWebKit ? "./pwa-native-runtime/node_modules/playwright/index.mjs" : "playwright");
import { createHash } from "node:crypto";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const engineName = process.env.V100_REVIEWED_ALPHA_ENGINE ?? "chromium";
const output = process.env.V100_REVIEWED_ALPHA_OUT;
assert.ok(output, "V100_REVIEWED_ALPHA_OUT is required");
assert.ok(["chromium", "webkit"].includes(engineName));
const baseUrl = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(baseUrl.hostname));
const engines = { chromium, webkit };
const requestedStages = (process.env.V100_REVIEWED_ALPHA_STAGES ?? "25,30").split(",").map(Number);
assert.ok(requestedStages.every(stage => [25, 30].includes(stage)));
const cases = [
  { stageNumber: 25, stageId: V100_STAGE_IDS[24], boss: "mugarian-president-mutated", required: ["red-panther-knife", "red-panther-shield", "red-panther-smg", "red-panther-commander", "mugarian-president-mutated"] },
  { stageNumber: 30, stageId: V100_STAGE_IDS[29], boss: "takuya-omega", required: ["takuya-omega"] },
].filter(spec => requestedStages.includes(spec.stageNumber));
const sourcePaths = {
  "red-panther-knife": "/art/v100/enemies/red-panther-knife-battle-v2.png",
  "red-panther-shield": "/art/v100/enemies/red-panther-shield-battle-v2.png",
  "red-panther-smg": "/art/v100/enemies/red-panther-smg-battle-v2.png",
  "red-panther-commander": "/art/v100/enemies/red-panther-commander-battle-v2.png",
  "mugarian-president-mutated": "/art/v100/bosses/mugarian-president-mutated-battle-v2.png",
  "takuya-omega": "/art/v100/bosses/takuya-omega-battle-v2.png",
};
const attackKinds = spec => spec.stageNumber === 25 ? ["red-panther-smg", "red-panther-commander"] : [spec.boss];

function fixture(stageNumber, stageId) {
  const base = createDefaultV100Save({ playerName: `V1 alpha ${stageNumber}` });
  const owned = [...new Set([...base.ownedUnitIds, "unit-gantetsu", "unit-babayaga", "unit-mizuchi", "unit-raider"] )];
  const unitLevels = Object.fromEntries(Object.keys(base.unitLevels).map(id => [id, 25]));
  return normalizeV100Save({ ...base, campaignStarted: true, revision: 11, availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, stageNumber - 1), ownedUnitIds: owned, registeredUnitIds: owned, unitLevels, levelCap: 30, ownedSupportIds: ["support-healing", "support-explosive-drum", "support-incendiary-drum"], supportPurchaseUnlockedIds: ["support-healing", "support-explosive-drum", "support-incendiary-drum"], equippedSupportId: "support-healing", vehicle: { upgradeLevel: 5, maxHp: 0, upgradeReceipts: ["v100:vehicle:1", "v100:vehicle:2", "v100:vehicle:3", "v100:vehicle:4", "v100:vehicle:5"] }, formationSlots: ["unit-gantetsu", "unit-babayaga", "unit-mizuchi", "unit-raider", null, null, null], flowState: { phase: "formation", stageId, stageNumber, destination: "formation", nodeIndex: 0, firstClear: false, finalized: true } });
}

const report = { engine: engineName, runtimeChoice: useCurrentWebKit ? "current-webkit-runtime" : "default-playwright-runtime", stages: requestedStages, build: await productionBuildIdentity(), viewport: { width: 844, height: 340 }, scope: "S25 native entry observes President plus naturally spawned Red Panther kinds; S30 native entry observes Omega. Explicit isolated fixture uses normalized level-25 units, level-cap 30, vehicle upgrade 5 and native support ownership. Ordinary UI deployment, abilities and support only. No actor, time, HP or result setters; this is a visual/runtime proof, not earned campaign or balance acceptance. Observation budget is actual v100 timeline end plus 180 seconds for prior-wave-clear and ordinary travel; each case stops immediately once requirements are met.", cases: [] };
await mkdir(output, { recursive: false });

for (const spec of cases) {
  const item = { stageNumber: spec.stageNumber, stageId: spec.stageId, boss: spec.boss, errors: [], inputs: [], rows: [], drawCalls: [], sourceHashes: {}, observedKinds: [], ordinaryAttackKinds: [], captures: [], status: "running" };
  report.cases.push(item);
  const browser = await engines[engineName].launch({ headless: true });
  const context = await browser.newContext({ viewport: report.viewport, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", error => item.errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") item.errors.push(message.text()); });
  page.on("requestfailed", request => item.errors.push(`${request.url()}: ${request.failure()?.errorText ?? "failed"}`));
  page.on("response", response => { if (response.status() >= 400) item.errors.push(`${response.status()}: ${response.url()}`); });
  try {
    const saveObject = fixture(spec.stageNumber, spec.stageId);
    const save = serializeV100Save(saveObject);
    item.fixture = { stageNumber: spec.stageNumber, levelCap: saveObject.levelCap, unitLevels: saveObject.unitLevels, vehicle: saveObject.vehicle, ownedUnitIds: saveObject.ownedUnitIds, formationSlots: saveObject.formationSlots };
    await page.addInitScript(({ save, sourcePaths }) => {
      for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, save);
      const audit = { active: false, drawCalls: [], counts: {}, snapshots: [], loaded: {} };
      window.__V100_REVIEWED_ALPHA__ = audit;
      const original = CanvasRenderingContext2D.prototype.drawImage;
      const names = Object.fromEntries(Object.entries(sourcePaths).map(([kind, path]) => [path, kind]));
      const lineage = new WeakMap();
      const sizeOf = image => ({ width: image?.naturalWidth || image?.width || 0, height: image?.naturalHeight || image?.height || 0 });
      const rectFor = (image, args) => {
        const size = sizeOf(image);
        if (args.length === 4) return [0, 0, size.width, size.height, ...args];
        if (args.length === 8) return args;
        return null;
      };
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
        const src = image?.currentSrc || image?.src || "";
        const directKind = Object.entries(names).find(([path]) => src.includes(path))?.[1];
        const sourceRect = rectFor(image, args);
        const productionCanvas = document.querySelector(".game-shell canvas");
        const prior = image instanceof HTMLCanvasElement && image !== productionCanvas ? lineage.get(image) : null;
        const sourceLineage = directKind && sourceRect ? { kind: directKind, path: Object.entries(names).find(([path]) => src.includes(path))?.[0], sourceRect: sourceRect.slice(0, 4) } : prior;
        if (sourceLineage && sourceRect && this.canvas !== productionCanvas) lineage.set(this.canvas, sourceLineage);
        else if (!sourceLineage) lineage.delete(this.canvas);
        if (audit.active && sourceLineage && sourceRect && this.canvas === productionCanvas) {
          const matrix = this.getTransform();
          const call = { kind: sourceLineage.kind, sourcePath: sourceLineage.path, sourceRect: sourceLineage.sourceRect, alpha: this.globalAlpha, source: sourceRect.slice(0, 4), destination: sourceRect.slice(4, 8), transform: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f }, canvas: { width: this.canvas.width, height: this.canvas.height } };
          if ((audit.counts[sourceLineage.kind] ?? 0) < 300) { audit.drawCalls.push(call); audit.counts[sourceLineage.kind] = (audit.counts[sourceLineage.kind] ?? 0) + 1; }
        }
        return original.call(this, image, ...args);
      };
    }, { save, sourcePaths });
    await page.goto(new URL("v100", baseUrl).href);
    const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
    const start = page.getByRole("button", { name: "戦闘へ", exact: true });
    await play.or(start).first().waitFor();
    if (await play.isVisible().catch(() => false)) await play.click();
    await start.click();
    await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running, undefined, { timeout: 30000 });
    await page.evaluate(() => { window.__V100_REVIEWED_ALPHA__.active = true; });
    const timeline = createBattleDefinition(spec.stageId, { v100: true }).timeline;
    const timelineEndSeconds = Math.max(...timeline.map(event => Number(event.at) || 0), 0);
    const deadline = Date.now() + (timelineEndSeconds + 180) * 1000;
    item.timelineEndSeconds = timelineEndSeconds;
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        const seen = new Set((snapshot?.fighters ?? []).filter(f => f.combatReady && f.hp > 0 && f.renderAudit?.assetReady).map(f => f.kind));
        return { time: snapshot?.time ?? 0, running: Boolean(snapshot?.running), over: Boolean(snapshot?.over), seen: [...seen], fighters: (snapshot?.fighters ?? []).filter(f => f.combatReady && f.hp > 0 && f.renderAudit?.assetReady).map(f => ({ kind: f.kind, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, attack: f.attack, attackWindup: f.attackWindup, renderAudit: f.renderAudit })) };
      });
      for (const fighter of state.fighters) {
        item.observedKinds ??= [];
        if (!item.observedKinds.includes(fighter.kind)) item.observedKinds.push(fighter.kind);
        if (spec.required.includes(fighter.kind) && (fighter.attack > 0 || fighter.attackWindup > 0) && !item.ordinaryAttackKinds?.includes(fighter.kind)) { item.ordinaryAttackKinds ??= []; item.ordinaryAttackKinds.push(fighter.kind); }
        const kindRows = item.rows.filter(row => row.kind === fighter.kind);
        if (spec.required.includes(fighter.kind) && kindRows.length < 64) item.rows.push({ time: state.time, ...fighter });
        if (!item.captures?.includes(fighter.kind) && spec.required.includes(fighter.kind)) {
          item.captures ??= [];
          item.captures.push(fighter.kind);
          await page.screenshot({ path: `${output}/s${spec.stageNumber}-${engineName}-${fighter.kind}-first.png` });
        }
      }
      const ready = spec.required.every(kind => item.observedKinds.includes(kind)) && attackKinds(spec).every(kind => item.ordinaryAttackKinds?.includes(kind));
      if (ready) { item.observed = state; break; }
      if (!state.running || state.over) break;
      await normalTacticalInput(page, item);
      await page.waitForTimeout(350);
    }
    await page.evaluate(() => { window.__V100_REVIEWED_ALPHA__.active = false; });
    const browserAudit = await page.evaluate(() => ({ ...window.__V100_REVIEWED_ALPHA__, snapshot: window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() }));
    item.drawCalls = browserAudit.drawCalls;
    item.snapshot = browserAudit.snapshot ? { time: browserAudit.snapshot.time, baseHp: browserAudit.snapshot.baseHp, baseMaxHp: browserAudit.snapshot.baseMaxHp, over: browserAudit.snapshot.over } : null;
    assert.deepEqual(item.captures?.slice().sort(), spec.required.slice().sort(), `each required kind needs a first-appearance capture for S${spec.stageNumber}`);
    const manifest = await page.evaluate(async () => fetch("/asset-manifest.json").then(r => r.json()));
    for (const kind of spec.required) {
      const path = sourcePaths[kind];
      const response = await page.request.get(new URL(path, baseUrl).href);
      assert.ok(response.ok(), `asset fetch failed: ${path}`);
      const transport = manifest.assets.find(entry => entry.path === path);
      assert.ok(transport, `${kind} is missing from the checked-in asset manifest`);
      const logicalDigest = createHash("sha256").update(await readFile(new URL(`../public${path}`, import.meta.url))).digest("hex");
      const logicalDigestFromBrowser = createHash("sha256").update(await response.body()).digest("hex");
      assert.equal(logicalDigestFromBrowser, logicalDigest, `${kind} logical PNG differs from checked-in public bytes`);
      const sourcePath = transport.sourcePath ?? path;
      const sourceResponse = await page.request.get(new URL(sourcePath, baseUrl).href);
      assert.ok(sourceResponse.ok(), `${kind} transport asset fetch failed: ${sourcePath}`);
      const sourceDigest = createHash("sha256").update(await sourceResponse.body()).digest("hex");
      assert.equal(sourceDigest, transport.hash.replace(/^sha256-/u, ""), `${kind} transport bytes differ from manifest hash`);
      item.sourceHashes[kind] = { logicalPath: path, logicalSha256: logicalDigest, transportPath: sourcePath, transportSha256: sourceDigest };
    }
    assert.ok(item.observed, `required native draw observations missing for S${spec.stageNumber}`);
    const bossRows = item.rows.filter(row => row.kind === spec.boss && row.hp > 0 && row.renderAudit?.assetReady);
    assert.ok(bossRows.length > 0, `${spec.boss} must have a live ready render observation`);
    assert.equal(bossRows[0].maxHp, spec.boss === "mugarian-president-mutated" ? 6200 : 9200, `${spec.boss} definition HP changed`);
    for (const kind of spec.required) {
      const readyRows = item.rows.filter(row => row.kind === kind && row.hp > 0 && row.renderAudit?.assetReady && row.renderAudit?.spritePath?.includes("-battle-v2.png"));
      assert.ok(readyRows.some(row => row.renderAudit.effectiveOpacity === 1), `${kind} needs a ready full-opacity v2 render audit`);
    }
    for (const kind of spec.required) {
      const calls = item.drawCalls.filter(call => call.kind === kind);
      assert.ok(calls.length > 0, `${kind} must draw from its v2 source`);
      const validBodyCalls = calls.filter(call => call.destination[2] > 0 && call.destination[3] > 0);
      assert.ok(validBodyCalls.some(call => call.alpha === 1), `${kind} must have a full-opacity body draw after entry/death fades`);
      assert.ok(validBodyCalls.every(call => call.destination.slice(2, 4).every(value => Number.isFinite(value) && value > 0)), `${kind} must have a finite positive rendered size`);
    }
    assert.deepEqual(item.errors, []);
    item.status = "observed-native-draws";
    await page.screenshot({ path: `${output}/s${spec.stageNumber}-${engineName}.png` });
  } catch (error) {
    item.status = "failed"; item.error = String(error.stack ?? error);
    await page.screenshot({ path: `${output}/s${spec.stageNumber}-${engineName}-failure.png` }).catch(() => {});
    throw error;
  } finally {
    await context.close(); await browser.close();
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  }
}
report.status = "passed";
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, engine: engineName, cases: report.cases.length }));
