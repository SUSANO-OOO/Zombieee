import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function entryFixture(events, { clickElapsed = 0 } = {}) {
  let now = 0;
  let forcedState = null;
  const clicks = [];
  const waits = [];
  const state = () => forcedState ?? events.filter(event => event.at <= now).at(-1)?.state ?? 'loading';
  const locator = names => ({
    names,
    or(other) { return locator([...names, ...other.names]); },
    first() { return this; },
    getByRole(_, { name }) { return locator([name === '続ける' ? 'notice' : 'offer']); },
    async isVisible() { return names.some(name => visible(name)); },
    async isEnabled() { return state() !== 'notice-disabled'; },
    async waitFor({ state: expected = 'visible', timeout }) {
      waits.push({ names, expected, at: now, timeout });
      const matches = () => expected === 'hidden' ? names.every(name => !visible(name)) : names.some(name => visible(name));
      if (matches()) return;
      const deadline = now + timeout;
      for (const event of events) {
        if (event.at <= now || event.at > deadline) continue;
        now = event.at;
        if (matches()) return;
      }
      now = deadline;
      throw new Error('entry visibility deadline exceeded');
    },
    async boundingBox() { return { x: 0, y: 0, width: 100, height: 44 }; },
    async click() {
      const name = names.find(visible);
      assert.ok(name, 'native entry click requires the visible control');
      assert.notEqual(state(), 'notice-disabled', 'disabled notice must finish its own countdown');
      clicks.push(name);
      now += clickElapsed;
      if (name === 'notice') forcedState = null;
      if (name === 'offer') forcedState = 'title';
    },
  });
  function visible(name) {
    const current = state();
    return name === 'notice' ? current.startsWith('notice') : current === (name === 'offer' ? 'offer' : 'title');
  }
  const page = {
    locator(selector) { return locator([selector === '.fiction-notice' ? 'notice' : 'title']); },
    getByRole(_, { name }) { return locator([name === '続ける' ? 'notice' : 'offer']); },
    async goto() { return { ok: () => true, status: () => 200 }; },
  };
  const helperSource = await readFile(new URL('../scripts/pwa-gate-qa.mjs', import.meta.url), 'utf8');
  const dismissInstallOffer = vm.runInNewContext(helperSource.replace(/^export /gm, '') + '\n dismissInstallOffer;', {
    Date: { now: () => now },
  });
  return { page, dismissInstallOffer, clicks, waits, get now() { return now; }, get state() { return state(); } };
}

test('actual event-audio entry waits for late fiction and install controls before title entry', async () => {
  const fixture = await entryFixture([{ at: 12000, state: 'notice-disabled' }, { at: 18000, state: 'offer' }]);
  const source = await readFile(new URL('../scripts/v100-event-presentation-audio-browser-smoke.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('          const response = await page.goto(');
  const end = source.indexOf('          const eventSelector = ', start);
  assert.ok(start >= 0 && end > start, 'exercise the actual production QA entry block');
  const runEntry = new (async function () {}).constructor('page', 'url', 'timeout', 'invariant', 'clickUsable', 'dismissInstallOffer', source.slice(start, end));
  await runEntry(fixture.page, new URL('http://127.0.0.1/v100?event-audio-qa=1'), 45000,
    (condition, message) => assert.ok(condition, message),
    async (control, _, options) => control.click(options), fixture.dismissInstallOffer);
  assert.equal(fixture.state, 'title');
  assert.deepEqual(fixture.clicks, ['offer']);
  assert.equal(fixture.now, 18000);
});

test('an already mounted title does not consume the optional install wait', async () => {
  const fixture = await entryFixture([{ at: 0, state: 'title' }]);
  const clicked = await fixture.dismissInstallOffer(fixture.page, { timeout: 45000, readySelector: '.v100-start-screen' });
  assert.equal(clicked, false);
  assert.equal(fixture.now, 0);
  assert.deepEqual(fixture.clicks, []);
});

test('an entry that never becomes ready fails instead of silently continuing to the title', async () => {
  const fixture = await entryFixture([]);
  await assert.rejects(fixture.dismissInstallOffer(fixture.page, { timeout: 45000, readySelector: '.v100-start-screen' }), /deadline exceeded/);
  assert.equal(fixture.now, 45000);
  assert.deepEqual(fixture.clicks, []);
});

test('fiction and install steps share the original deadline and retain the caller hit-target check', async () => {
  const fixture = await entryFixture([{ at: 0, state: 'notice' }, { at: 8000, state: 'loading' }, { at: 22000, state: 'offer' }], { clickElapsed: 8000 });
  const checked = [];
  await assert.rejects(fixture.dismissInstallOffer(fixture.page, {
    timeout: 20000,
    readySelector: '.v100-start-screen',
    clickControl: async (control, label, options) => { checked.push({ label, timeout: options.timeout }); await control.click(options); },
  }), /deadline exceeded/);
  assert.equal(fixture.now, 20000);
  assert.equal(checked.length, 1);
  assert.equal(checked[0].timeout, 20000);
  assert.deepEqual(fixture.clicks, ['notice']);
});
