import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { silenceBrowserOutput, assertSilentQaHost } from "./silent-browser-output.mjs";
import { enterV100FromTitle } from "./v100-title-qa-entry.mjs";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, deserializeV100Save, V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { exportV100BrowserSave } from "../app/v100CampaignStorage.js";
import { createV100BattleResult, recordV100PendingResult, finalizeV100PendingResult, purchaseV100Unit } from "../app/v100Transactions.js";
import { V100_BOSSES, V100_STAGE_IDS, v100StageReward } from "../app/v100Registry.js";
import { beginV100Survival, checkpointV100Survival } from "../app/v100SurvivalTransactions.js";
import { beginSurvivalWave, completeSurvivalWave } from "../app/survival.js";
import { selectSurvivalBossKind, survivalWaveReward, survivalUpgradePreview } from "../app/survivalBattleRuntime.js";

assertSilentQaHost(process.platform);
const git = (...args) => execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const head = git("rev-parse", "HEAD");
assert.equal(git("diff", "--name-only"), "");
assert.equal(git("diff", "--cached", "--name-only"), "");
const base = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "Owned local contexts only");
const out = path.resolve(process.env.V100_QUALITY_LOOP_OUT ?? "outputs/v100-quality-loop");
await mkdir(out, { recursive: false });
let early = createDefaultV100Save({ playerName: "西新確認" });
for (const index of [0, 1]) {
  const result = createV100BattleResult({ stageId: V100_STAGE_IDS[index], battleRunId: "quality-budget-" + index, won: true, objectiveComplete: true, vehicleHp: 408, vehicleMaxHp: 680 });
  const pending = recordV100PendingResult(early, result);
  assert.equal(pending.applied, true);
  const settled = finalizeV100PendingResult(pending.save);
  assert.equal(settled.applied, true);
  early = settled.save;
  if (index === 0) { const purchase = purchaseV100Unit(early, "unit-nao"); assert.equal(purchase.applied, true); early = purchase.save; }
}
early = normalizeV100Save({ ...early, campaignStarted: true, flowState: { phase: "map", eventId: null, stageId: V100_STAGE_IDS[2], stageNumber: 3, destination: "map", nodeIndex: 0, firstClear: false, finalized: true } });
const budgetBackup = exportV100BrowserSave(early);
await writeFile(path.join(out, "two-stage-budget-fixture.json"), budgetBackup);
const report = { status: "running", head, tree: git("rev-parse", "HEAD^{tree}"), build: await productionBuildIdentity(), physicalDevice: false,
  audioOutput: "Forced silent output on hosted Linux/macOS. Local Windows game-browser QA is disabled after reported audible output.",
  scope: "Phone rendering and native inputs. Two early victories, reward cases and result cases are developer-synthetic production receipts and reports; Nao purchased with the two one-star victories' CAPS. Subsequent upgrade/formation/battle inputs in early-budget-native are native. Reward/result cases prove presentation, save/resume and no duplicate payout, not real victories or measured combat. Visual late-stage/event fixtures do not prove unlocks or difficulty. No AI campaign-clear gate, physical iPhone, external-game play or speaker-listening claim.",
  budget: { caps: early.caps, levels: early.unitLevels, owned: early.ownedUnitIds, receipts: early.receipts, sha256: createHash("sha256").update(budgetBackup).digest("hex") }, cases: [] };
const engines = (process.env.V100_QUALITY_LOOP_ENGINES ?? "chromium,webkit").split(",");
const sizes = (process.env.V100_QUALITY_LOOP_SIZES ?? "844x340,844x390").split(",").map(value => { const [width, height] = value.split("x").map(Number); return { width, height }; });
const sections = (process.env.V100_QUALITY_LOOP_SECTIONS ?? 'presentation,rewards,results,survival,native').split(',');
assert.ok(sections.length && sections.every(value => ['presentation', 'rewards', 'results', 'survival', 'native'].includes(value)));
report.sections = sections;
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && !document.querySelector('.v100-shell[aria-busy="true"]') && document.documentElement.dataset.pwaSaveMutationPending === "false");
const rawSave = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), V100_PRIMARY_STORAGE_KEY);
const eventCheckpoint = () => {
  const shell = document.querySelector('.v100-shell'), event = shell?.querySelector('[data-v100-event-id]');
  return JSON.stringify([shell?.getAttribute('data-v100-phase'), event?.getAttribute('data-v100-event-id'), event?.getAttribute('data-v100-node-index')]);
};
async function advanceEvent(page) {
  await ready(page);
  const before = await page.evaluate(eventCheckpoint);
  await page.locator('.v100-event-actions .v100-primary').tap();
  await page.waitForFunction(({ before, key }) => {
    const shell = document.querySelector('.v100-shell'), event = shell?.querySelector('[data-v100-event-id]');
    const current = JSON.stringify([shell?.getAttribute('data-v100-phase'), event?.getAttribute('data-v100-event-id'), event?.getAttribute('data-v100-node-index')]);
    return current !== before && !shell?.matches('[aria-busy="true"]') && document.documentElement.dataset[key] === 'false';
  }, { before, key: 'pwaSaveMutationPending' });
}
const acknowledge = async (page, enter = true) => {
  const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
  await play.or(page.locator(".v100-shell")).first().waitFor();
  if (await play.isVisible()) await play.tap();
  await ready(page);
  if (enter && await page.locator('.v100-start-screen').isVisible()) {
    // Finish the local preload before dismissing its owner. Cancellation on a
    // fast departure is covered by the dedicated audio lifecycle fixture.
    await page.waitForFunction(() => {
      const audio = document.querySelector('[data-title-music]');
      return audio && !audio.error && audio.networkState === HTMLMediaElement.NETWORK_IDLE && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    });
    await enterV100FromTitle(page);
  }
  await ready(page);
};
async function within(locator, minimum = 0, requireHit = true) {
  const state = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight, reachable: hit === element || element.contains(hit) };
  });
  assert.ok(state.x >= 0 && state.y >= 0 && state.right <= state.viewportWidth + 1 && state.bottom <= state.viewportHeight + 1, JSON.stringify(state));
  assert.ok(state.height >= minimum && (!requireHit || state.reachable), JSON.stringify(state));
  const clipped = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY) && (rect.y < bounds.y - 1 || rect.bottom > bounds.bottom + 1)) return parent.className;
      if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX) && (rect.x < bounds.x - 1 || rect.right > bounds.right + 1)) return parent.className;
    }
    return null;
  });
  assert.equal(clipped, null, 'Clipped by ancestor: ' + clipped);
  return state;
}
async function diagramWithin(locator) {
  const bounds = await within(locator, 0, false);
  const diagram = await locator.evaluate(svg => {
    const box = svg.viewBox.baseVal;
    return { pointerEvents: getComputedStyle(svg).pointerEvents, clippedTexts: [...svg.querySelectorAll('text')].filter(text => {
      const rect = text.getBBox(), pad = (parseFloat(getComputedStyle(text).strokeWidth) || 0) / 2;
      return rect.x - pad < box.x || rect.y - pad < box.y || rect.x + rect.width + pad > box.x + box.width || rect.y + rect.height + pad > box.y + box.height;
    }).map(text => text.textContent) };
  });
  assert.equal(diagram.pointerEvents, 'none', 'The mission diagram is static, not a touch control');
  assert.deepEqual(diagram.clippedTexts, []);
  return { ...bounds, ...diagram };
}
async function formationCardsWithin(page, viewport) {
  await page.evaluate(() => document.fonts.ready);
  const cards = await page.locator('.v100-slot.filled').evaluateAll(elements => elements.map(card => {
    const rectangle = element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; };
    const metadata = card.querySelector('.v100-slot-meta');
    return { card: rectangle(card), portrait: rectangle(card.querySelector('.v100-slot-portrait')), metadata: rectangle(metadata),
      text: [...metadata.querySelectorAll('small,strong,b')].filter(element => getComputedStyle(element).display !== 'none').map(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        return { value: element.textContent, box: rectangle(element), clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
          lines: [...range.getClientRects()].map(rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })) };
      }) };
  }));
  assert.equal(cards.length, 7, 'Every filled call-in card is checked');
  for (const { card, portrait, metadata, text } of cards) {
    assert.ok(portrait.width >= card.width - 12, 'Portrait uses the card width without a narrow vertical crop');
    assert.ok(portrait.height >= 40, 'Portrait remains large enough to identify the unit');
    if (viewport.height > 460) assert.ok(portrait.width / portrait.height >= 0.75, 'Desktop portrait area avoids a narrow vertical strip');
    assert.ok(portrait.y + portrait.height <= metadata.y + 1, 'Portrait and unit details have separate rows');
    assert.ok(metadata.y + metadata.height <= card.y + card.height, 'All unit details fit inside the card');
    for (const item of text) {
      assert.ok(item.scrollHeight <= item.clientHeight + 1, 'Text is not vertically clipped: ' + item.value);
      for (const line of item.lines) assert.ok(line.x >= metadata.x - 1 && line.x + line.width <= metadata.x + metadata.width + 1
        && line.y >= metadata.y - 1 && line.y + line.height <= metadata.y + metadata.height + 1, 'Full text is visible: ' + item.value);
    }
  }
  return cards;
}
async function capture(page, row, name) {
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.waitForFunction(() => [...document.querySelectorAll('.v100-portrait-frame img')]
    .every(image => Number(getComputedStyle(image).opacity) >= 0.99));
  const file = row.id + "-" + name + ".png";
  await page.screenshot({ path: path.join(out, file) });
  row.captures.push({ file, sha256: createHash("sha256").update(await readFile(path.join(out, file))).digest("hex") });
}
async function runCase(browser, engine, viewport, id, seed, work) {
  const row = { id: engine + "-" + viewport.width + "x" + viewport.height + "-" + id, status: "running", errors: [], navigationAborts: [], captures: [] };
  report.cases.push(row);
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, acceptDownloads: true });
  let navigating = false;
  if (seed) {
    const decoded = deserializeV100Save(serializeV100Save(seed));
    assert.equal(decoded.ok, true, `${row.id}: invalid QA seed ${decoded.errors?.join(',')}`);
  }
  if (seed) await context.addInitScript(raw => {
    for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, raw);
  }, serializeV100Save(seed));
  const page = await context.newPage();
  await silenceBrowserOutput(page);
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => row.errors.push({ kind: "page", message: String(error) }));
  page.on("console", message => { if (message.type() === "error") row.errors.push({ kind: "console", message: message.text() }); });
  page.on("response", response => { if (response.status() >= 400) row.errors.push({ kind: "http", url: response.url(), status: response.status() }); });
  page.on("requestfailed", request => {
    const failure = { kind: "request", url: request.url(), message: request.failure()?.errorText };
    if (navigating && /abort|cancel/i.test(failure.message ?? "")) row.navigationAborts.push(failure);
    else row.errors.push(failure);
  });
  try {
    await page.goto(new URL("v100", base).href, { waitUntil: "networkidle" });
    assert.equal(await page.locator('meta[name="github-pages-release"]').getAttribute("content"), head);
    await acknowledge(page, Boolean(seed));
    await work(page, row, async () => { navigating = true; try { await page.reload({ waitUntil: "networkidle" }); await acknowledge(page); } finally { navigating = false; } });
    row.silentOutput = await page.evaluate(() => {
      const proof = globalThis.__CODEX_SILENT_QA__;
      return proof && { blockNativePlayback: proof.blockNativePlayback, nativePlayCalls: proof.nativePlayCalls, blockedNativePlays: proof.blockedNativePlays };
    });
    if (row.silentOutput?.blockNativePlayback) assert.equal(row.silentOutput.nativePlayCalls, 0);
    assert.deepEqual(row.errors, []);
    row.status = "passed";
  } catch (error) { row.status = "failed"; row.error = String(error); await page.screenshot({ path: path.join(out, row.id + "-failure.png") }).catch(() => {}); }
  finally { navigating = true; await context.close(); await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
}
for (const engine of engines) {
  const type = await pwaBrowserType(engine);
  const browser = await type.launch({ headless: true, ...(engine === 'chromium' ? {args:['--mute-audio']} : {}) });
  try {
    for (const viewport of sections.includes('presentation') ? sizes : []) {
      for (const number of [1, 2, 5, 6, 9, 16, 25, 26, 28, 29]) {
        const stageId = V100_STAGE_IDS[number - 1];
        const fixture = normalizeV100Save({ ...early, availableStageIds: V100_STAGE_IDS, formationSlots: [...early.formationSlots.slice(0, 4), "unit-nao", "unit-hachi", "unit-paisen"], flowState: { phase: "formation", eventId: null, stageId, stageNumber: number, destination: "battle", nodeIndex: 0, firstClear: false, finalized: false } });
        await runCase(browser, engine, viewport, "briefing-s" + number, fixture, async (page, row) => {
          await page.locator('.v100-formation-panel').waitFor();
          const summary = page.locator(".v100-briefing-details > summary");
          await within(summary, 44); await summary.tap();
          await page.locator(".v100-mission-diagram").waitFor();
          row.mission = await page.locator(".v100-mission-diagram").getAttribute("data-v100-mission-mode");
          row.diagram = await diagramWithin(page.locator(".v100-mission-diagram"));
          const popup = page.locator(".v100-briefing-details > div");
          await within(popup);
          row.briefing = await popup.innerText();
          await popup.evaluate(element => { element.scrollTop = element.scrollHeight; });
          await capture(page, row, "intel");
          await summary.tap();
          await within(page.getByRole("button", { name: "戦闘へ", exact: true }), 44);
          row.formationCards = await formationCardsWithin(page, viewport);
          await capture(page, row, "board");
        });
      }
      for (const [eventId, index, count] of [["v100:event:s17:post", 3, 2], ["v100:event:s23:pre", 10, 0], ["v100:event:s28:pre", 3, 0], ["v100:event:s30:pre", 18, 2]]) {
        const stageNumber = Number(eventId.split(':')[2].slice(1));
        const stageId = V100_STAGE_IDS[stageNumber - 1];
        const isPost = eventId.endsWith(':post');
        const stageSave = normalizeV100Save({ ...early, availableStageIds: [...new Set([...early.availableStageIds, stageId])] });
        const pending = isPost ? recordV100PendingResult(stageSave, createV100BattleResult({ stageId,
          battleRunId: 'quality-event-' + stageNumber, won: true, objectiveComplete: true, bossDefeated: true, vehicleHp: 408, vehicleMaxHp: 680 })) : null;
        if (isPost) assert.equal(pending.applied, true, `Post-event QA receipt: ${pending.reason}`);
        const fixture = normalizeV100Save({ ...(pending?.save ?? stageSave), eventCursor: null,
          flowState: { phase: isPost ? "post" : "event", eventId, stageId, stageNumber, destination: "map", nodeIndex: index, firstClear: isPost, finalized: false } });
        await runCase(browser, engine, viewport, eventId.replaceAll(":", "-"), fixture, async (page, row) => {
          await page.locator(".v100-story-node").waitFor();
          row.owners = await page.locator(".v100-portrait-frame").evaluateAll(elements => elements.map(element => ({ owner: element.dataset.portraitOwner, side: element.dataset.portraitSide })));
          assert.equal(row.owners.length, count);
          if (eventId.includes("s17") || eventId.includes("s30")) assert.deepEqual(row.owners.map(owner => owner.owner).sort(), ["unit-babayaga", "unit-mrs-chiha"]);
          if (eventId.includes("s23")) {
            const backdrop = page.locator('.v100-event-backdrop');
            assert.equal(await backdrop.getAttribute('data-v100-cinematic'), 'true');
            await page.locator('img[src$="chiha-confession.webp"]').waitFor();
          }
          await within(page.locator(".v100-node-copy p"));
          await within(page.getByRole("button", { name: "次へ", exact: true }), 44);
          await capture(page, row, "scene");
        });
      }
    }
    for (const viewport of sections.includes('presentation') ? [...sizes, { width: 760, height: 500 }] : []) {
      const fixture = normalizeV100Save({ ...early, ownedUnitIds: [...early.ownedUnitIds, 'unit-crazy-king'],
        unitLevels: { ...early.unitLevels, 'unit-crazy-king': 1 },
        formationSlots: ['unit-crazy-king', ...early.formationSlots.slice(0, 4), 'unit-nao', 'unit-paisen'],
        flowState: { phase: 'formation', eventId: null, stageId: V100_STAGE_IDS[0], stageNumber: 1, destination: 'battle', nodeIndex: 0, firstClear: false, finalized: false } });
      await runCase(browser, engine, viewport, 'formation-long-name', fixture, async (page, row) => {
        await page.locator('.v100-formation-panel').waitFor();
        row.formationCards = await formationCardsWithin(page, viewport);
        assert.ok(row.formationCards[0].text.some(item => item.value === 'クレイジーキング'));
        await capture(page, row, 'board');
      });
    }
    for (const viewport of sections.includes('rewards') ? sizes : []) {
      const stageId = V100_STAGE_IDS[0];
      const value = createV100BattleResult({ stageId, battleRunId: 'quality-reward-replay', won: true, objectiveComplete: true, vehicleHp: 680, vehicleMaxHp: 680 });
      const pending = recordV100PendingResult(early, value);
      assert.equal(pending.applied, true);
      const settled = finalizeV100PendingResult(pending.save);
      assert.equal(settled.applied, true);
      const fixture = normalizeV100Save({ ...settled.save, readStoryEventIds: [...new Set([...settled.save.readStoryEventIds, 'v100:event:s01:post'])], flowState: { phase: 'first-clear-post', eventId: 'v100:event:s01:first-clear-post', stageId, stageNumber: 1, destination: 'first-clear-post', nodeIndex: 0, firstClear: false, finalized: false } });
      await runCase(browser, engine, viewport, 'replay-reward', fixture, async (page, row, reload) => {
        await page.locator('.v100-reward-summary').waitFor();
        assert.ok((await page.locator('.v100-reward-summary').innerText()).includes('+' + settled.save.lastResult.rewardCaps));
        assert.equal(settled.save.lastResult.rewardBreakdown.firstClear, 0);
        const summary = page.locator('.v100-reward-breakdown summary');
        await within(summary, 44); await summary.tap();
        await within(page.locator('.v100-reward-breakdown > p'));
        row.totalBox = await within(page.locator('.v100-reward-summary .v100-result-rewards article').first());
        await within(page.locator('.v100-reward-summary .v100-result-rewards strong').first());
        await within(page.locator('.v100-reward-summary > p'));
        await within(page.locator('.v100-event-actions .v100-primary'), 44);
        row.breakdown = await page.locator('.v100-reward-breakdown > p').innerText();
        assert.ok(row.breakdown.includes('再挑戦報酬'));
        await capture(page, row, 'settlement');
        const saved = await rawSave(page);
        await reload();
        assert.deepEqual(await rawSave(page), saved);
        await page.locator('.v100-reward-summary').waitFor();
        await advanceEvent(page);
        await page.locator('.v100-map-layout').waitFor();
        const continued = await rawSave(page);
        assert.equal(continued.caps, saved.caps);
        assert.deepEqual(continued.receipts, saved.receipts);
        row.confirmation = { caps: continued.caps, rewardCaps: saved.lastResult.rewardCaps, receiptsUnchanged: true, resumed: true };
      });
      // S5/S20 have the most first-clear payloads; include both long unlock names.
      for (const firstNumber of [2, 5, 20]) {
      const firstStageId = V100_STAGE_IDS[firstNumber - 1];
      const slug = 's' + String(firstNumber).padStart(2, '0');
      const initial = normalizeV100Save({ ...createDefaultV100Save({ playerName: '西新確認' }), campaignStarted: true, completedStageIds: V100_STAGE_IDS.slice(0, firstNumber - 1), availableStageIds: V100_STAGE_IDS.slice(0, firstNumber) });
      const value = createV100BattleResult({ stageId: firstStageId, battleRunId: 'quality-first-reward-' + firstNumber, won: true, objectiveComplete: true, bossDefeated: true, vehicleHp: 408, vehicleMaxHp: 680 });
      assert.equal(value.stars, 1);
      const pending = recordV100PendingResult(initial, value);
      assert.equal(pending.applied, true);
      const settled = finalizeV100PendingResult(pending.save);
      assert.equal(settled.applied, true);
      assert.equal(settled.save.lastResult.rewardCaps, v100StageReward(firstNumber, 'first-clear'));
      const firstFixture = normalizeV100Save({ ...settled.save, readStoryEventIds: [...new Set([...settled.save.readStoryEventIds, 'v100:event:' + slug + ':post'])], flowState: { phase: 'first-clear-post', eventId: 'v100:event:' + slug + ':first-clear-post', stageId: firstStageId, stageNumber: firstNumber, destination: 'first-clear-post', nodeIndex: 0, firstClear: true, finalized: false } });
      await runCase(browser, engine, viewport, 'first-clear-reward-s' + firstNumber, firstFixture, async (page, row, reload) => {
        await page.locator('.v100-reward-summary').waitFor();
        const summary = page.locator('.v100-reward-breakdown summary');
        await within(summary, 44); await summary.tap();
        await within(page.locator('.v100-reward-breakdown > p'));
        row.totalBox = await within(page.locator('.v100-reward-summary .v100-result-rewards strong').first());
        await within(page.locator('.v100-reward-summary .v100-result-rewards article').nth(1).locator('strong'));
        await capture(page, row, 'settlement');
        await page.locator('.v100-reward-summary > p').scrollIntoViewIfNeeded();
        await within(page.locator('.v100-reward-summary > p'));
        await within(page.locator('.v100-event-actions .v100-primary'), 44);
        await capture(page, row, 'investment-note');
        const saved = await rawSave(page);
        await reload(); assert.deepEqual(await rawSave(page), saved);
        assert.equal(saved.lastResult.firstClear, true);
      });
      }
    }
    for (const viewport of sections.includes('survival') ? sizes : []) {
      const initial = createDefaultV100Save();
      const seed = normalizeV100Save({ ...initial, campaignStarted: true,
        receipts: [V100_BOSSES[0].firstDefeatReceipt], flowState: { ...initial.flowState, phase: 'map' },
        settings: { ...initial.settings, bgmEnabled: false, sfxEnabled: false } });
      const begun = beginV100Survival(seed, { runId: 'v101-survival-preview-fixture' });
      assert.equal(begun.applied, true, begun.reason);
      let run = begun.save.survival.active.run;
      for (let wave = 1; wave <= 5; wave++) {
        run = beginSurvivalWave(run);
        const boss = selectSurvivalBossKind({ waveNumber: wave, bossPool: run.bossPool, lastBossKind: run.lastBossKind, strictBossPool: true });
        if (boss) run = { ...run, lastBossKind: boss };
        run = completeSurvivalWave(run, { kills: 3, bossKills: boss ? 1 : 0, crawlerHp: 540, battleSeconds: 10,
          enemyDefeatsByKind: boss ? { [boss]: 1, walker: 2 } : { walker: 3 }, reward: survivalWaveReward(wave) });
      }
      const checkpoint = checkpointV100Survival(begun.save, run);
      assert.equal(checkpoint.applied, true, checkpoint.reason);
      await runCase(browser, engine, viewport, 'survival-upgrade-preview', checkpoint.save, async (page, row) => {
        row.scope = 'Synthetic valid Wave 5 checkpoint; native upgrade selection and Wave 6 resume, not an earned boss victory.';
        const dialog = page.getByRole('dialog', { name: 'ボス撃破強化選択', exact: true });
        await dialog.waitFor();
        const buttons = dialog.locator('.survival-upgrade-choices button');
        assert.equal(await buttons.count(), 3);
        row.text = await dialog.innerText();
        assert.match(row.text, /次は第6波/u);
        assert.match(row.text, /→/u);
        row.choiceBoxes = [];
        for (let index = 0; index < 3; index++) {
          await buttons.nth(index).scrollIntoViewIfNeeded();
          row.choiceBoxes.push(await within(buttons.nth(index), 44));
        }
        await capture(page, row, 'choices');
        const choice = checkpoint.save.survival.active.run.pendingUpgradeChoices[0];
        row.preview = survivalUpgradePreview(checkpoint.save.survival.active.run, choice);
        await buttons.first().tap();
        await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.documentElement.dataset.pwaSaveMutationPending === 'false'
          && window.__ASHFALL_BATTLE_QA__?.getSnapshot?.()?.running);
        const saved = await rawSave(page);
        assert.equal(saved.survival.active.run.temporaryUpgradeStacks[choice], (run.temporaryUpgradeStacks[choice] ?? 0) + 1);
        assert.equal(saved.caps, checkpoint.save.caps);
        row.savedChoice = { choice, stacks: saved.survival.active.run.temporaryUpgradeStacks[choice], caps: saved.caps };
      });
    }
    for (const viewport of sections.includes('results') ? sizes : []) {
      for (const won of [true, false]) {
        const stageId = V100_STAGE_IDS[2];
        const battleReport = { wave: 9, kills: 41, units: [
          { unitId: 'unit-hachi', damage: 100, damageTaken: 82, healing: 0 },
          { unitId: 'unit-paisen', damage: 88, damageTaken: 104, healing: 0 },
          { unitId: 'unit-kumaverson', damage: 121, damageTaken: 44, healing: 0 },
          { unitId: 'unit-babayaga', damage: 160, damageTaken: 21, healing: 0 },
          { unitId: 'unit-nao', damage: 0, damageTaken: 33, healing: 144 },
        ] };
        const value = createV100BattleResult({ stageId, battleRunId: 'quality-report-' + won, won, objectiveComplete: won, bossDefeated: won, vehicleHp: won ? 340 : 0, vehicleMaxHp: 680, elapsedSeconds: 180, unitDeaths: 3, battleReport });
        // Production stores victories as pending settlements, defeats as lastResult.
        const pending = won ? recordV100PendingResult(early, value) : null;
        if (won) assert.equal(pending.applied, true);
        const fixture = normalizeV100Save({ ...(won ? pending.save : { ...early, lastResult: value }), flowState: { phase: 'result', eventId: null, stageId, stageNumber: 3, destination: 'result', nodeIndex: 0, firstClear: won, finalized: false } });
        await runCase(browser, engine, viewport, 'result-' + (won ? 'win' : 'lose'), fixture, async (page, row, reload) => {
          await page.locator('.v100-result-panel').waitFor();
          await capture(page, row, 'result');
          const summary = page.locator('.v100-battle-report summary');
          await within(summary, 44); await summary.tap();
          const body = page.locator('.v100-battle-report > div');
          await within(body);
          assert.equal(await body.locator('tbody tr').count(), 5);
          row.reportText = await body.innerText();
          assert.ok(row.reportText.includes('ハチ') && row.reportText.includes('ナオ') && row.reportText.includes('回復したHP'));
          await capture(page, row, 'report-heading');
          await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
          await within(body.locator('tbody tr').last().locator('td').last());
          await capture(page, row, 'report'); await summary.tap();
          const saved = await rawSave(page);
          await reload(); assert.deepEqual(await rawSave(page), saved);
          assert.deepEqual((won ? saved.pendingResult : saved.lastResult).battleReport, battleReport);
          const next = page.getByRole('button', { name: won ? '次の場面へ' : '編成へ戻る', exact: true });
          await within(next, 44); await next.tap(); await ready(page);
          if (won) await page.locator('[data-v100-event-id="v100:event:s03:post"]').waitFor();
          else { await page.locator('.v100-formation-panel').waitFor(); assert.equal((await rawSave(page)).caps, early.caps); }
          row.syntheticReport = true; row.resumed = true;
        });
      }
    }
    if (sections.includes('native')) await runCase(browser, engine, { width: 844, height: 340 }, "early-budget-native", null, async (page, row, reload) => {
      await page.locator(".v100-shell").getByRole("button", { name: "データ管理", exact: true }).tap();
      await page.getByRole("dialog", { name: "データ管理", exact: true }).getByLabel("セーブを復元", { exact: true }).setInputFiles({ name: "budget.json", mimeType: "application/json", buffer: Buffer.from(budgetBackup) });
      await page.getByRole("dialog", { name: "データ管理", exact: true }).waitFor({ state: "hidden" });
      await ready(page); await enterV100FromTitle(page);
      await page.locator(".v100-map-layout").waitFor(); await ready(page);
      assert.equal((await rawSave(page)).caps, early.caps);
      const offer = page.getByRole('button', { name: '後で決める', exact: true });
      if (await offer.isVisible()) { await offer.tap(); await ready(page); }
      const restoredNotice = page.locator('.v100-notice button');
      if (await restoredNotice.isVisible()) { await restoredNotice.tap(); await ready(page); }
      await page.getByRole("button", { name: "この作戦を編成", exact: true }).tap();
      for (let n = 0; n < 60 && !await page.locator(".v100-formation-panel").isVisible(); n++) await advanceEvent(page);
      await page.locator(".v100-slot-track .v100-slot").nth(4).tap();
      await page.getByRole("button", { name: "ナオを枠5へ配置", exact: true }).tap();
      await page.locator(".v100-sortie-selected").tap();
      assert.equal(await page.locator(".v100-personnel-focus").getAttribute("data-unit-id"), "unit-nao");
      await page.getByRole("button", { name: "出撃編成へ", exact: true }).tap();
      await page.getByRole('navigation', { name: '作戦準備メニュー' }).getByRole('button', { name: '隊員', exact: true }).tap();
      await page.locator(".v100-personnel-card").first().tap();
      const growth = page.locator(".v100-unit-growth-notes summary");
      await within(growth, 44); await growth.tap(); row.growthBox = await within(page.locator(".v100-unit-growth-notes p"));
      assert.ok(row.growthBox.width >= Math.min(320, 0.6 * row.growthBox.viewportWidth));
      await page.locator('.v100-unit-growth-notes p').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await capture(page, row, "growth"); await growth.tap();
      await page.locator(".v100-personnel-focus .v100-primary").tap(); await ready(page);
      row.afterUpgrade = await rawSave(page);
      assert.equal(row.afterUpgrade.unitLevels["unit-hachi"], 2);
      assert.equal(row.afterUpgrade.caps, early.caps - 30);
      await page.getByRole('navigation', { name: '作戦準備メニュー' }).getByRole('button', { name: '編成', exact: true }).tap();
      await page.getByRole("button", { name: "戦闘へ", exact: true }).tap();
      row.native = { inputs: [], samples: [] };
      const deadline = Date.now() + 125000;
      while (Date.now() < deadline && !await page.locator(".v100-result-panel").isVisible()) {
        await normalTacticalInput(page, row.native);
        await page.waitForTimeout(250);
      }
      if (await page.locator(".v100-result-panel").isVisible()) {
        row.nativeResult = true;
        const summary = page.locator(".v100-battle-report summary");
        await within(summary, 44); await summary.tap(); await within(page.locator(".v100-battle-report > div"));
        row.resultText = await page.locator(".v100-result-panel").innerText();
        row.won = await page.locator(".v100-result-panel").getAttribute("data-v100-surface") === "result-win";
        await capture(page, row, "native-result");
        await summary.tap();
        const saved = await rawSave(page);
        await reload();
        assert.deepEqual(await rawSave(page), saved);
        if (row.won) {
          await page.getByRole("button", { name: "次の場面へ", exact: true }).tap();
          for (let index = 0; index < 80 && !await page.locator(".v100-map-layout").isVisible(); index++) await advanceEvent(page);
          await page.locator(".v100-map-layout").waitFor();
          row.finalResult = (await rawSave(page)).lastResult;
          assert.ok(row.finalResult.rewardBreakdown);
        } else {
          await page.getByRole("button", { name: "編成へ戻る", exact: true }).tap();
          assert.equal(await page.locator(".v100-mission-diagram").getAttribute("data-v100-mission-mode"), "advance");
        }
      } else {
        row.nativeResult = false;
        await capture(page, row, "native-pressure");
        await page.getByRole("button", { name: "一時停止", exact: true }).tap();
      }
      assert.ok(row.native.inputs.length > 0);
    });
  } finally { await browser.close(); }
}
report.status = report.cases.every(row => row.status === "passed") ? "passed" : "failed";
await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ status: report.status, cases: report.cases.length, failed: report.cases.filter(row => row.status !== "passed").map(row => ({ id: row.id, error: row.error })) }) + "\n");
if (report.status !== "passed") process.exitCode = 1;
