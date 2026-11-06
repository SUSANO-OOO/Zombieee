import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { enterV100FromTitle, seedV100BrowserSaveOnce } from "./v100-title-qa-entry.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, validateV100SavePayload } from "../app/v100Save.js";
import { CAMPAIGN_UNITS } from "../app/campaign.js";
import { V100_STAGE_IDS, V100_UNITS } from "../app/v100Registry.js";
import { assertRecoveryDeferredThroughInput } from "./quality-command-recovery-oracle.mjs";

const url = new URL(process.env.QUALITY_PRESSURE_URL), out = path.resolve(process.env.QUALITY_PRESSURE_OUT);
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname)); assert.equal(url.searchParams.has("qa"), false); url.searchParams.set("qaResourcePressure", "1");
const engine = process.env.QUALITY_PRESSURE_ENGINE ?? "chromium"; assert.ok(["chromium", "webkit"].includes(engine));
const expectRecovery = process.env.QUALITY_PRESSURE_EXPECT_RECOVERY === "1";
const viewport = process.env.QUALITY_PRESSURE_VIEWPORT === "340" ? { width: 340, height: 220 } : { width: 844, height: 390 };
await mkdir(out, { recursive: false });
const root = process.env.QUALITY_PRESSURE_BUILD_ROOT, build = await productionBuildIdentity(root ?? ".");
const snapshot = root ? JSON.parse(await readFile(path.join(root, "snapshot.json"), "utf8")) : null;
if (snapshot) assert.equal(snapshot.combinedSha256, build.combinedSha256);
const requested = (process.env.QUALITY_PRESSURE_CASES ?? "").split(",").filter(Boolean);
const scenarios = [
  { id: "hachi-walker", kind: "scout", enemy: "walker" },
  { id: "kuma-walker", kind: "kumaverson", enemy: "walker" },
  { id: "kuma-cooldown-walker", kind: "kumaverson", enemy: "walker", cooldown: 17 },
  { id: "musashi-walker", kind: "miyamoto-musashi", enemy: "walker" },
  { id: "kuma-runner", kind: "kumaverson", enemy: "runner" },
  { id: "kuma-support-reserve", kind: "kumaverson", enemy: "walker", reserve: true },
  { id: "mayo-withdrawal", kind: "mayo-chan", enemy: "walker", withdrawal: true },
  { id: "mayo-kuma-mixed", kind: "kumaverson", companion: "mayo-chan", enemy: "walker" },
  { id: "musashi-real-ko", kind: "miyamoto-musashi", enemy: "walker", actualDefeat: true },
  { id: "mayo-real-retreat", kind: "mayo-chan", enemy: "walker", actualDefeat: true, withdrawal: true },
].filter(s => !requested.length || requested.includes(s.id));
assert.ok(scenarios.length); for (const id of requested) assert.ok(scenarios.some(s => s.id === id));
const report = { engine, url: url.href, snapshot, build, requested, qaScriptSha256: createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex"),
  scope: "Primary comparisons use explicit prepared collapsed-force scenes, spent resources and unchanged walker/runner at the same initial position. Individually marked actual-defeat probes instead use a prepared 1HP stunned actor at recorded positions. Setup pauses before measurement; subsequent real clock, AI, damage and native accepted UI inputs are observed. Not natural progression, balance acceptance, human original-speed/listening or physical proof.",
  cases: [], errors: [] };
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true, ...(engine === "chromium" ? { args: ["--mute-audio"] } : {}) });
const state = page => page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getV100ResourcePressureProof?.() ?? null);
const controls = page => page.locator(".game-shell").evaluate(shell => ({
  cards: [...shell.querySelectorAll("button.unit-card")].map(b => ({ kind: b.dataset.kind, state: b.dataset.state, blocked: b.getAttribute("aria-disabled") === "true", text: b.innerText })),
  support: [...shell.querySelectorAll("button.support-btn")].map(b => ({ category: b.dataset.category, state: b.dataset.state, blocked: b.getAttribute("aria-disabled") === "true", text: b.innerText })),
  abilities: shell.querySelectorAll('button.manual-ability-ready.available[aria-disabled="false"]').length,
}));
async function shot(page, file) { await page.screenshot({ path: path.join(out, file) }); }
async function persist() { await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n"); }
try {
  for (const scenario of scenarios) {
    const unitId = CAMPAIGN_UNITS.find(u => u.combatKind === scenario.kind)?.id; assert.ok(unitId);
    const companionId = scenario.companion ? CAMPAIGN_UNITS.find(u => u.combatKind === scenario.companion)?.id : null;
    if (scenario.companion) assert.ok(companionId);
    const ids = V100_UNITS.map(u => u.id), seed = normalizeV100Save({ ...createDefaultV100Save({ settings: { bgmEnabled: false } }), campaignStarted: true, playerName: "検証",
      ownedUnitIds: ids, registeredUnitIds: ids, formationSlots: [unitId, companionId, null, null, null, null, null],
      completedStageIds: V100_STAGE_IDS.slice(0, 22), availableStageIds: V100_STAGE_IDS, flowState: { phase: "formation", stageId: V100_STAGE_IDS[0], stageNumber: 1, eventId: null, destination: "formation", nodeIndex: 0, firstClear: false, finalized: true } });
    assert.equal(validateV100SavePayload(seed).ok, true);
    const record = { case: scenario.id, prepared: true, kind: scenario.kind, enemy: scenario.enemy, rows: [], inputs: [] }; report.cases.push(record);
    const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: "block", recordVideo: { dir: path.join(out, scenario.id + "-video"), size: viewport } });
    await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(seed));
    const page = await context.newPage(); page.on("pageerror", e => report.errors.push(String(e)));
    try {
      await page.goto(url.href); await dismissInstallOffer(page, { timeout: 30000, readySelector: ".v100-start-screen", waitForFictionDismissal: true }); await enterV100FromTitle(page);
      const notice = page.getByText("オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。", { exact: true }); if (await notice.isVisible()) await notice.locator("..").getByRole("button", { name: "閉じる", exact: true }).click();
      await page.getByRole("button", { name: "戦闘へ", exact: true }).click();
      await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running && document.documentElement.dataset.assetLoadState === "ready");
      record.opening = await state(page);
      if (expectRecovery) {
        assert.equal(record.opening.battleMode, "campaign");
        assert.equal(record.opening.commandRecovery.armed, false);
        assert.equal(record.opening.commandRecovery.active, false);
        assert.equal(record.opening.commandRecovery.used, false);
      }
      record.setup = await page.evaluate(options => options.actualDefeat
        ? window.__ASHFALL_BATTLE_QA__.prepareV100ActualDefeatProof()
        : window.__ASHFALL_BATTLE_QA__.prepareV100ResourcePressureProof(options), {
        actualDefeat: Boolean(scenario.actualDefeat),
        attackerKind: scenario.enemy, supportReserve: Boolean(scenario.reserve), mayoWithdrawal: Boolean(scenario.withdrawal), mayoCompanionWithdrawal: Boolean(scenario.companion), reentrySeconds: scenario.cooldown ?? 0,
      });
      assert.ok(record.setup?.prepared); assert.deepEqual(record.setup.cards.map(card => card.kind).sort(), [scenario.kind, scenario.companion].filter(Boolean).sort());
      const primaryCard = record.setup.cards.find(card => card.kind === scenario.kind);
      if (scenario.actualDefeat) {
        assert.equal(record.setup.actor.hp, 1); assert.equal(record.setup.actor.stunned, 3);
        record.scope = "Fault-injection fixture: prepared 1HP stunned actor and unchanged walker at the recorded position. Actual normal enemy hit, KO/retreat and caller wiring; not normal stats, natural progression or balance proof.";
      }
      if (scenario.companion) assert.equal(record.setup.cards.find(card => card.kind === scenario.companion).cooldown, 42);
      assert.equal(record.setup.energy, 0); assert.equal(record.setup.scrap, 0); assert.equal(record.setup.supportGauge, scenario.reserve ? 85 : 0);
      record.initial = await state(page); await shot(page, scenario.id + "-initial-paused.png"); await persist();
      await page.getByRole("button", { name: "戦闘を再開", exact: true }).click();
      const wallStart = Date.now(), timeStart = record.initial.time;
      const card = page.locator('button.unit-card[data-kind="' + scenario.kind + '"]');
      let afterActionAt = null, nextControlAt = 0;
      while (Date.now() - wallStart < 60000) {
        const s = await state(page); if (!s || s.over) { record.terminal = s; break; }
        const seconds = s.time - timeStart; record.rows.push(s);
        if (scenario.actualDefeat && !record.observedDefeat && s.unitsLost > record.initial.unitsLost) {
          record.observedDefeat = { seconds, state: s }; await shot(page, scenario.id + "-actual-defeat.png");
        }
        if (expectRecovery && !record.recoveryHud && s.commandRecovery.active && await page.locator('.resource.command.recovering').count()) {
          record.recoveryHud = await page.evaluate(() => {
            const el = document.querySelector('.resource.command.recovering'), status = document.querySelector('.v100-deploy-status');
            const range = document.createRange(); range.selectNodeContents(status); const text = range.getBoundingClientRect(), card = status.closest('button').getBoundingClientRect();
            return { resource: el.getAttribute('aria-label'), status: status.textContent,
              detail: status.closest('button').querySelector('.v100-deploy-shortage')?.textContent ?? null,
              accessibleCard: status.closest('button').getAttribute('aria-label'), text: { left: text.left, right: text.right }, card: { left: card.left, right: card.right }, viewport: innerWidth };
          });
          assert.ok(record.recoveryHud.text.left >= record.recoveryHud.card.left - 1);
          assert.ok(record.recoveryHud.text.right <= record.recoveryHud.card.right + 1);
          assert.equal(record.recoveryHud.status, '出撃不可');
          assert.match(record.recoveryHud.detail, /^(?:あと約\d+秒|指揮 あと\d+)$/u);
          assert.match(record.recoveryHud.accessibleCard, /出撃まで約\d+秒/u);
          await shot(page, scenario.id + "-recovering.png");
        }
        if (seconds >= nextControlAt) { record.lastControls = await controls(page); nextControlAt = seconds + .4; }
        if (!record.firstUsefulInput) {
          if (scenario.reserve) {
            const barrage = page.locator('button.support-btn[data-category="vehicle"][data-state="ready"][aria-disabled="false"]');
            if (await barrage.count()) {
              const before = await state(page); await barrage.click(); const after = await state(page);
              if (after && after.supportGauge < before.supportGauge) {
                record.firstReady = { kind: "vehicle", seconds: before.time - timeStart, hp: before.baseHp };
                record.firstUsefulInput = { kind: "vehicle", seconds: after.time - timeStart, hp: after.baseHp };
                record.acceptedSupportState = after;
                record.rows.push(after); record.inputs.push({ action: "vehicle", seconds: record.firstUsefulInput.seconds }); afterActionAt = record.firstUsefulInput.seconds;
                await shot(page, scenario.id + "-first-input.png");
              }
            }
          }
          if (!record.firstUsefulInput && await card.getAttribute("data-state") === "ready" && await card.getAttribute("aria-disabled") !== "true") {
            const before = await state(page); await card.click(); const after = await state(page);
            assert.ok(after && (after.active + after.queued > before.active + before.queued || before.energy - after.energy > primaryCard.cost - 1), "Native deployment was not accepted");
            record.firstReady = { kind: scenario.kind, seconds: before.time - timeStart, hp: before.baseHp };
            record.firstUsefulInput = { kind: scenario.kind, seconds: after.time - timeStart, hp: after.baseHp };
            record.rows.push(after); record.inputs.push({ action: "deploy", seconds: record.firstUsefulInput.seconds, commandBefore: before.energy, commandAfter: after.energy });
            afterActionAt = record.firstUsefulInput.seconds; await shot(page, scenario.id + "-first-input.png");
          }
        }
        if (record.firstUsefulInput && s.combatReady > 0 && record.firstCombatReady === undefined) record.firstCombatReady = { seconds, hp: s.baseHp };
        if (afterActionAt !== null && seconds >= afterActionAt + 3) { record.end = s; await shot(page, scenario.id + "-after-input.png"); break; }
        await page.waitForTimeout(100);
      }
      assert.ok(record.firstUsefulInput, "No useful native action returned within the observation budget");
      record.vehicleDamageBeforeInput = record.initial.baseHp - record.firstUsefulInput.hp;
      record.elapsedToInput = record.firstUsefulInput.seconds; record.status = "observed";
      if (expectRecovery) {
        record.recoveryUsed = record.rows.some(s => s.commandRecovery.used);
        record.additionalCommand = Math.max(...record.rows.map(s => s.commandRecovery.additionalCommand));
        if (scenario.actualDefeat) {
          assert.ok(record.observedDefeat, "Actual enemy hit did not produce the required KO/retreat");
          record.secondsFromObservedDefeat = record.elapsedToInput - record.observedDefeat.seconds;
          if (scenario.withdrawal) assert.ok(record.observedDefeat.state.cards.find(card => card.kind === "mayo-chan").cooldown > 35);
        }
        if (scenario.companion) {
          for (const row of record.rows) assert.ok(row.cards.find(card => card.kind === scenario.companion).cooldown >= Math.max(0, 42 - (row.time - timeStart)) - .05, "Mayo withdrawal cooldown was shortened");
          const first = record.rows.find(row => Math.abs(row.time - timeStart - record.elapsedToInput) < 1e-7);
          record.companionCooldownAtFirstInput = first.cards.find(card => card.kind === scenario.companion).cooldown;
          assert.ok(record.companionCooldownAtFirstInput > 33);
        }
        if (scenario.reserve) {
          record.supportDeferral = assertRecoveryDeferredThroughInput({ initial: record.initial, rows: record.rows, acceptedState: record.acceptedSupportState });
        } else if (scenario.withdrawal) {
          assert.equal(record.recoveryUsed, false); assert.equal(record.additionalCommand, 0);
        } else {
          assert.equal(record.recoveryUsed, true); assert.ok(record.recoveryHud);
          assert.ok((record.secondsFromObservedDefeat ?? record.elapsedToInput) <= Math.max(8, scenario.cooldown ?? 0) + .8);
          assert.ok(record.additionalCommand <= Math.max(0, primaryCard.cost - 3 * Math.max(8, scenario.cooldown ?? 0)) + .2);
        }
      }
      await persist();
    } catch (error) { record.failure = String(error); await page.screenshot({ path: path.join(out, scenario.id + "-failure.png") }).catch(() => {}); throw error; }
    finally { record.video = await page.video()?.path(); await context.close(); }
  }
  assert.deepEqual(report.errors, []); report.status = "observed";
} catch (error) { report.status = "failed"; report.failure = String(error); throw error; }
finally { await browser.close(); await persist(); }
console.log(JSON.stringify({ engine, status: report.status, cases: report.cases.map(c => ({ id: c.case, seconds: c.elapsedToInput, damage: c.vehicleDamageBeforeInput, combatReady: c.firstCombatReady })) }));
