import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { enterV100FromTitle, seedV100BrowserSaveOnce } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, validateV100SavePayload } from '../app/v100Save.js';
import { CAMPAIGN_UNITS } from '../app/campaign.js';
import { V100_STAGE_IDS, V100_UNITS } from '../app/v100Registry.js';

const url = new URL(process.env.QUALITY_SURVIVOR_URL);
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
url.searchParams.set('qaResourcePressure', '1');
const out = path.resolve(process.env.QUALITY_SURVIVOR_OUT);
await mkdir(out, { recursive: false });
const root = path.resolve(process.env.QUALITY_SURVIVOR_BUILD_ROOT);
const build = await productionBuildIdentity(root);
const snapshot = JSON.parse(await readFile(path.join(root, 'snapshot.json'), 'utf8'));
assert.equal(build.combinedSha256, snapshot.combinedSha256);
const engine = process.env.QUALITY_SURVIVOR_ENGINE ?? 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const viewport = engine === 'webkit' ? { width: 844, height: 340 } : { width: 1280, height: 720 };
const report = { engine, viewport, build, snapshot, cases: [], errors: [],
  scriptSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  scope: 'Prepared one-survivor situations; real frame loop and native ability input. No natural frequency, physical device, human playback or audio acceptance.' };
const browser = await ({ chromium, webkit })[engine].launch({ headless: true });
async function read(page) {
  return page.evaluate(() => {
    const world = window.__SURVIVOR_COMBAT_READ__();
    return { ...window.__SURVIVOR_PRESSURE_READ__(), fighters: world.fighters.map(f => ({
      id: f.id, kind: f.kind, side: f.side, hp: f.hp, maxHp: f.maxHp, stunned: f.stunned,
      attackSequence: f.attackSequence, combatReady: f.combatReady, manualAbility: f.manualAbility,
    })), receipts: world.manualAbilityReceipts };
  });
}
try {
  for (const kind of ['medic', 'miyamoto-musashi']) {
    const unitId = CAMPAIGN_UNITS.find(u => u.combatKind === kind)?.id;
    assert.ok(unitId);
    const ids = V100_UNITS.map(u => u.id);
    const seed = normalizeV100Save({ ...createDefaultV100Save({ settings: { bgmEnabled: false } }),
      campaignStarted: true, playerName: '検証', ownedUnitIds: ids, registeredUnitIds: ids,
      formationSlots: [unitId, null, null, null, null, null, null], completedStageIds: V100_STAGE_IDS.slice(0, 22),
      availableStageIds: V100_STAGE_IDS, flowState: { phase: 'formation', stageId: V100_STAGE_IDS[0], stageNumber: 1,
        eventId: null, destination: 'formation', nodeIndex: 0, firstClear: false, finalized: true } });
    assert.equal(validateV100SavePayload(seed).ok, true);
    const row = { kind, samples: [], input: null }; report.cases.push(row);
    const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block',
      recordVideo: { dir: path.join(out, kind), size: viewport } });
    await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(seed));
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', e => report.errors.push(String(e)));
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await dismissInstallOffer(page, { timeout: 30000, readySelector: '.v100-start-screen', waitForFictionDismissal: true });
      await enterV100FromTitle(page);
      const notice = page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。', { exact: true });
      if (await notice.isVisible()) await notice.locator('..').getByRole('button', { name: '閉じる', exact: true }).click();
      await page.getByRole('button', { name: '戦闘へ', exact: true }).click();
      await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running && document.documentElement.dataset.assetLoadState === 'ready');
      row.fixture = await page.evaluate(kind => {
        const qa = window.__ASHFALL_BATTLE_QA__;
        window.__SURVIVOR_COMBAT_READ__ = qa.getPhaseGCombatSnapshot;
        window.__SURVIVOR_PRESSURE_READ__ = qa.getV100ResourcePressureProof;
        const pressure = qa.prepareV100ResourcePressureProof({ attackerKind: 'walker' });
        if (kind !== 'medic') return { pressure, stun: qa.prepareV177IncomingStunProof({ kind, sourceDistance: 100 }) };
        const actorId = qa.spawnHumanForDamageProof(kind);
        return { pressure, actorId, damage: qa.applyHumanDamage(actorId, 45) };
      }, kind);
      row.initial = await read(page);
      assert.equal(row.initial.active, 1);
      await page.getByRole('button', { name: '戦闘を再開', exact: true }).click();
      const deadline = Date.now() + 65000;
      while (Date.now() < deadline) {
        const state = await read(page); row.samples.push(state);
        const actor = state.fighters.find(f => f.side === 'human' && f.hp > 0);
        if (kind === 'medic' && !row.input && actor?.hp < actor?.maxHp) {
          const button = page.getByRole('button', { name: /緊急処置/ });
          if (await button.count() && await button.isEnabled() && await button.getAttribute('aria-disabled') !== 'true') {
            await page.screenshot({ path: path.join(out, `${kind}-before-input.png`) });
            row.input = { before: state, name: await button.getAttribute('aria-label') };
            await button.click(); row.input.afterDispatch = await read(page);
          }
        }
        if (state.time - row.initial.time >= 24 || state.over) break;
        await page.waitForTimeout(100);
      }
      row.final = await read(page);
      await page.screenshot({ path: path.join(out, `${kind}-final.png`) });
      const actorId = row.initial.fighters.find(f => f.side === 'human').id;
      const actorSamples = row.samples.map(s => ({ ...s.fighters.find(f => f.id === actorId), time: s.time }));
      assert.ok(row.samples.filter(s => s.active === 1).every(s => s.commandRecovery.additionalCommand === 0), 'Living survivor received no defeat recovery grant');
      if (kind === 'medic') {
        assert.ok(row.input, 'Native self-heal button input');
        const before = row.input.before.fighters.find(f => f.id === actorId);
        assert.ok(actorSamples.some(f => f.time > row.input.before.time && f.hp > before.hp), 'Self-heal actually raised HP');
        assert.ok(actorSamples.some(f => f.time > row.input.before.time + 1 && f.attackSequence > before.attackSequence), 'Medic returned to ordinary shooting');
      } else {
        const stunned = actorSamples.find(f => f.stunned > 0 && f.hp > 0);
        assert.ok(stunned, 'Original enemy attack actually stunned survivor');
        assert.ok(actorSamples.some(f => f.time > stunned.time && f.stunned <= 0 && f.attackSequence > stunned.attackSequence), 'Survivor resumed attacks after actual stun');
      }
      row.status = 'observed';
    } catch (error) { row.status = 'failed'; row.error = String(error); await page.screenshot({ path: path.join(out, `${kind}-failure.png`) }).catch(() => {}); throw error; }
    finally { await context.close(); await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
  }
  assert.deepEqual(report.errors, []);
  report.status = 'observed';
} finally { await browser.close(); await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, cases: report.cases.map(({ kind, status }) => ({ kind, status })), build: build.combinedSha256 }));
