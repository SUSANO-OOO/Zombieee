import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { V100_INITIAL_UNIT_IDS, V100_LEGACY_GIFT } from '../app/v100Registry.js';

const updateSource = fs.readFileSync('scripts/pwa-existing-update-browser-smoke.mjs', 'utf8');
const helper = updateSource.match(/async function acknowledgeLegacyGift\([\s\S]*?\n\}/)?.[0];
assert.ok(helper, 'exercise the actual update QA helper without starting hosted PWA QA');
const campaign = fs.readFileSync('app/V100Campaign.tsx', 'utf8');
const currentGiftTitle = campaign.match(/<h2 id="v100-gift-title">([^<]+)<\/h2>/)?.[1];
assert.ok(currentGiftTitle);

function giftFixture({ title = currentGiftTitle, mutate = () => {}, updateVisible = false } = {}) {
  const mirror = {
    caps: V100_LEGACY_GIFT.amountCaps, campaignStarted: false, completedStageIds: [],
    ownedUnitIds: [...V100_INITIAL_UNIT_IDS],
    settings: { bgmEnabled: false, sfxEnabled: false, bgmVolume: 0.42, sfxVolume: 0.37, graphicsQuality: 'power-save' },
    receipts: [V100_LEGACY_GIFT.entitlementReceipt, V100_LEGACY_GIFT.popupReceipt],
    legacy: { popupAcknowledged: true },
  };
  const state = { mirror, native: { database: 'test-save', record: { serialized: JSON.stringify(mirror) } }, oldRaw: 'old-save', legacyWrites: [] };
  mutate(state);
  let clicked = false;
  const page = {
    getByRole(role, options) {
      if (role === 'button') {
        assert.equal(options.name, '更新をダウンロード');
        return { count: async () => Number(updateVisible) };
      }
      assert.equal(role, 'dialog'); assert.equal(options.exact, true);
      return {
        waitFor: async ({ state: requested, timeout }) => {
          assert.equal(timeout, requested === 'visible' ? 60_000 : 30_000);
          assert.equal(options.name, title, 'gift dialog must exist with the exact accessible name');
          assert.equal(clicked, requested === 'detached');
        },
        getByRole(buttonRole, buttonOptions) {
          assert.equal(buttonRole, 'button'); assert.equal(buttonOptions.name, '確認する'); assert.equal(buttonOptions.exact, true);
          return { click: async () => { clicked = true; } };
        },
      };
    },
    waitForFunction: async (_predicate, _argument, options) => assert.equal(options.timeout, 60_000),
  };
  const run = vm.runInNewContext(helper + '\nacknowledgeLegacyGift', {
    waitForV100Ready: async () => {}, v100State: async () => state,
    V100_INITIAL_UNIT_IDS, V100_LEGACY_GIFT, v100SaveKey: 'test-save',
    record: (label, valid) => assert.equal(valid, true, label),
    screenshot: async () => {}, markTransition: () => {},
  });
  return { run: label => run(page, { raw: 'old-save' }, label), get clicked() { return clicked; } };
}

test('current gift title and explicit old-release title reach acknowledgement with intact save checks', async () => {
  const current = giftFixture(); await current.run(); assert.equal(current.clicked, true);
  const oldTitle = '新しい作戦記録を開始しました';
  assert.ok(updateSource.includes(`acknowledgeLegacyGift(page, oldSave, "${oldTitle}")`));
  const old = giftFixture({ title: oldTitle }); await old.run(oldTitle); assert.equal(old.clicked, true);
});

test('missing gift and incorrect saved reward cannot be acknowledged', async () => {
  for (const options of [
    { title: '無関係なお知らせ' },
    { updateVisible: true },
    { mutate: s => { s.mirror.caps += 180; } },
    { mutate: s => { s.mirror.receipts.push(V100_LEGACY_GIFT.entitlementReceipt); } },
    { mutate: s => { s.oldRaw = 'overwritten'; } },
    { mutate: s => { s.native.record.serialized = '{}'; } },
    { mutate: s => { s.legacyWrites.push('unexpected-write'); } },
  ]) {
    const fixture = giftFixture(options);
    await assert.rejects(fixture.run()); assert.equal(fixture.clicked, false);
  }
});

test('repair QA confirms withdrawal only inside its alert dialog and rejects a different action', async () => {
  const source = fs.readFileSync('scripts/pwa-active-repair-browser-smoke.mjs', 'utf8');
  const statement = source.match(/await page\.getByRole\("alertdialog"\)\.getByRole\("button",[^\n]+/g);
  assert.equal(statement?.length, 1);
  const run = vm.runInNewContext('(async page => {' + statement[0] + '})');
  for (const availableName of ['撤退する', '最初からやり直す', '実行する', null]) {
    let tapped = false;
    const page = { getByRole(role) {
      assert.equal(role, 'alertdialog');
      return { getByRole(buttonRole, options) {
        assert.equal(buttonRole, 'button'); assert.equal(options.exact, true);
        return { tap: async () => { assert.equal(options.name, availableName); tapped = true; } };
      } };
    } };
    if (availableName === '撤退する') { await run(page); assert.equal(tapped, true); }
    else { await assert.rejects(run(page)); assert.equal(tapped, false); }
  }
});
