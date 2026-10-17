import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { dismissInstallOffer } from '../scripts/pwa-gate-qa.mjs';
import { enterV100FromTitle } from '../scripts/v100-title-qa-entry.mjs';

function entryBlock(file) {
  const source = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const route = parsed.statements.find(node => ts.isTryStatement(node)
    && node.tryBlock.statements[0]?.getText(parsed).includes('page.goto(origin.href)'));
  const branch = route?.tryBlock.statements.find(node => ts.isIfStatement(node)
    && node.expression.getText(parsed) === '!resumeDir');
  assert.ok(route && branch, 'exercise the real normal-play entry before its fresh/resume branch');
  return source.slice(route.tryBlock.getStart(parsed) + 1, branch.getStart(parsed));
}

function titleFixture(hasSave) {
  let state = 'loading';
  const clicks = [], deadlines = [];
  const earnedSave = Object.freeze({ caps: 127, completedStageIds: Object.freeze(['stage-nishijin-shopping-street']), receipts: Object.freeze(['earned-stage-1']) });
  const visible = name => name === 'offer' ? state === 'offer'
    : name === 'title' ? state.startsWith('title-')
      : name === 'title-complete' ? state === 'title-complete'
        : name === 'タップして開始' ? state === 'title-waiting'
          : ['初めから', '続きから'].includes(name) && state === 'title-complete';
  const locator = names => ({
    names,
    or(other) { return locator([...names, ...other.names]); },
    first() { return this; },
    getByRole(_, { name }) { return locator([name]); },
    async isVisible() { return names.some(visible); },
    async isEnabled() { return names.includes('続きから') ? hasSave : true; },
    async waitFor({ state: expected = 'visible', timeout }) {
      deadlines.push(timeout);
      assert.ok(timeout > 0 && timeout <= 15000, 'preserve the existing per-step deadline');
      assert.ok(expected === 'hidden' ? names.every(name => !visible(name)) : names.some(visible), 'wait for the actual title state');
    },
    async click({ timeout = 15000 } = {}) {
      const name = names.find(visible);
      assert.ok(name, 'only click a visible native control');
      assert.ok(timeout > 0 && timeout <= 15000);
      clicks.push(name);
      if (name === 'offer') state = 'title-waiting';
      else if (name === 'タップして開始') state = 'title-complete';
      else if (name === '初めから') { assert.equal(hasSave, false, 'never reset an earned resume'); state = 'name'; }
      else if (name === '続きから') { assert.equal(hasSave, true); state = 'campaign'; }
    },
  });
  const page = {
    async goto() { state = 'offer'; },
    getByRole(_, { name }) { return locator([name === 'ブラウザで遊ぶ' ? 'offer' : name]); },
    locator(selector) { return locator([selector === '.fiction-notice' ? 'notice'
      : selector.includes('data-title-intro') ? 'title-complete' : 'title']); },
    async waitForFunction(predicate, _, { timeout }) {
      deadlines.push(timeout);
      assert.ok(timeout > 0 && timeout <= 15000);
      const document = { querySelector: () => state.startsWith('title-') ? { dataset: { titleIntro: state.slice(6) } } : null };
      assert.equal(vm.runInNewContext('(' + predicate.toString() + ')()', { document }), true);
    },
  };
  return { page, clicks, deadlines, earnedSave, get state() { return state; } };
}

for (const file of ['scripts/v100-normal-campaign-playthrough.mjs', 'scripts/v100-final-normal-playthrough.mjs']) {
  for (const hasSave of [false, true]) test(`${file}: actual entry completes the title before ${hasSave ? 'earned-save resume' : 'fresh name entry'}`, async () => {
    const fixture = titleFixture(hasSave);
    const saveBefore = JSON.stringify(fixture.earnedSave);
    const runEntry = new (async function () {}).constructor('page', 'origin', 'button', 'dismissInstallOffer', 'enterV100FromTitle', entryBlock(file));
    await runEntry(fixture.page, new URL('http://127.0.0.1/'), name => fixture.page.getByRole('button', { name, exact: true }), dismissInstallOffer, enterV100FromTitle);
    assert.equal(fixture.state, hasSave ? 'campaign' : 'name');
    assert.deepEqual(fixture.clicks, ['offer', 'タップして開始', hasSave ? '続きから' : '初めから']);
    assert.equal(JSON.stringify(fixture.earnedSave), saveBefore);
    assert.ok(fixture.deadlines.length >= 3);
  });
}
