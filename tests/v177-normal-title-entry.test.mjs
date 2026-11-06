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
  const isGoto=node=>ts.isExpressionStatement(node)&&ts.isAwaitExpression(node.expression)
    &&ts.isCallExpression(node.expression.expression)&&node.expression.expression.expression.getText(parsed)==='page.goto';
  const route=parsed.statements.find(node=>ts.isTryStatement(node)&&node.tryBlock.statements.some(isGoto));
  const branch = route?.tryBlock.statements.find(node => ts.isIfStatement(node)
    && node.expression.getText(parsed) === '!resumeDir');
  assert.ok(route && branch, 'exercise the real normal-play entry before its fresh/resume branch');
  const start=route.tryBlock.statements.findIndex(isGoto),branchIndex=route.tryBlock.statements.indexOf(branch);
  assert.ok(start>=0&&branchIndex>start,'native entry must precede the fresh/resume branch');
  assert.deepEqual(route.tryBlock.statements.slice(start,branchIndex).map(node=>node.expression?.expression?.expression?.getText(parsed)),
    ['page.goto','dismissInstallOffer','enterV100FromTitle'],'execute the exact native entry sequence after browser setup');
  return source.slice(route.tryBlock.statements[start].getStart(parsed),branch.getStart(parsed));
}

function titleFixture(hasSave, {hasOffer=true, missingTitle=false,maxTimeout=15000}={}) {
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
      assert.ok(timeout > 0 && timeout <= maxTimeout, 'preserve the existing per-step deadline');
      assert.ok(expected === 'hidden' ? names.every(name => !visible(name)) : names.some(visible), 'wait for the actual title state');
    },
    async click({ timeout = 15000 } = {}) {
      const name = names.find(visible);
      assert.ok(name, 'only click a visible native control');
      assert.ok(timeout > 0 && timeout <= maxTimeout);
      clicks.push(name);
      if (name === 'offer') state = 'title-waiting';
      else if (name === 'タップして開始') state = 'title-complete';
      else if (name === '初めから') { assert.equal(hasSave, false, 'never reset an earned resume'); state = 'name'; }
      else if (name === '続きから') { assert.equal(hasSave, true); state = 'campaign'; }
    },
  });
  const page = {
    async goto() { state = missingTitle ? 'missing' : hasOffer ? 'offer' : 'title-waiting'; return {status:()=>200}; },
    getByRole(_, { name }) { return locator([name === 'ブラウザで遊ぶ' ? 'offer' : name]); },
    locator(selector) { return locator([selector === '.fiction-notice' ? 'notice'
      : selector.includes('data-title-intro') ? 'title-complete' : 'title']); },
    async waitForFunction(predicate, _, { timeout }) {
      deadlines.push(timeout);
      assert.ok(timeout > 0 && timeout <= maxTimeout);
      const document = { querySelector: () => state.startsWith('title-') ? { dataset: { titleIntro: state.slice(6) } } : null };
      assert.equal(vm.runInNewContext('(' + predicate.toString() + ')()', { document }), true);
    },
  };
  return { page, clicks, deadlines, earnedSave, get state() { return state; } };
}

function fixtureEntryBlock(file) {
  const source=fs.readFileSync(file,'utf8');
  const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  let entry;
  function visit(node){
    if(ts.isBlock(node)){
      const calls=node.statements.map(s=>s.expression?.expression?.expression?.getText(parsed));
      const start=calls.indexOf('page.goto'),end=calls.indexOf('enterV100FromTitle');
      if(start>=0&&end>start){
        assert.deepEqual(calls.slice(start,end+1),['page.goto','dismissInstallOffer','enterV100FromTitle']);
        assert.equal(entry,undefined,'only one native scenario entry');
        entry=source.slice(node.statements[start].getStart(parsed),node.statements[end].end);
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(parsed);assert.ok(entry,'find the actual scenario entry');return entry;
}

function cardEntryBlock(file) {
  const source=fs.readFileSync(file,'utf8');
  const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  let entry;
  function visit(node) {
    if(ts.isBlock(node)) {
      const statements=node.statements;
      const start=statements.findIndex(s=>ts.isExpressionStatement(s)&&s.getText(parsed).startsWith('assert.equal((await page.goto('));
      const end=statements.findIndex(s=>s.expression?.expression?.expression?.getText(parsed)==='enterV100FromTitle');
      if(start>=0&&end>start) {
        assert.equal(entry,undefined,'only one card scenario entry');
        entry=source.slice(statements[start].getStart(parsed),statements[end].end);
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(parsed);assert.ok(entry,'exercise the real card entry through the native title');return entry;
}

for(const file of ['scripts/v100-card-portrait-browser.mjs','scripts/v100-card-resize-browser.mjs']) {
  async function run(fixture) {
    const execute=new (async function(){}).constructor('page','baseUrl','base','row','assert','dismissInstallOffer','enterV100FromTitle',cardEntryBlock(file));
    const base=new URL('http://127.0.0.1/');
    await execute(fixture.page,base,base,{},assert,dismissInstallOffer,enterV100FromTitle);
  }
  for(const hasOffer of [true,false])test(`${file}: card entry resumes the prepared save with invitation ${hasOffer?'present':'absent'}`,async()=>{
    const fixture=titleFixture(true,{hasOffer,maxTimeout:30000});
    await run(fixture);
    assert.equal(fixture.state,'campaign');
    assert.deepEqual(fixture.clicks,[...(hasOffer?['offer']:[]),'タップして開始','続きから']);
  });
  test(`${file}: a missing title cannot count as card readiness`,async()=>{
    const fixture=titleFixture(true,{hasOffer:false,missingTitle:true,maxTimeout:30000});
    await assert.rejects(run(fixture));assert.deepEqual(fixture.clicks,[]);
  });
}

for(const file of ['scripts/v100-battle-improvement-browser.mjs','scripts/v100-staff-roll-native-browser.mjs']){
  for(const hasOffer of [true,false])test(`${file}: saved scenario enters the title with invitation ${hasOffer?'present':'absent'}`,async()=>{
    const fixture=titleFixture(true,{hasOffer,maxTimeout:file.includes('staff-roll')?30000:15000});
    const run=new (async function(){}).constructor('page','origin','dismissInstallOffer','enterV100FromTitle',fixtureEntryBlock(file));
    await run(fixture.page,new URL('http://127.0.0.1/'),dismissInstallOffer,enterV100FromTitle);
    assert.equal(fixture.state,'campaign');
    assert.deepEqual(fixture.clicks,[...(hasOffer?['offer']:[]),'タップして開始','続きから']);
  });
  test(`${file}: missing entry cannot count as scenario readiness`,async()=>{
    const fixture=titleFixture(true,{hasOffer:false,missingTitle:true,maxTimeout:file.includes('staff-roll')?30000:15000});
    const run=new (async function(){}).constructor('page','origin','dismissInstallOffer','enterV100FromTitle',fixtureEntryBlock(file));
    await assert.rejects(run(fixture.page,new URL('http://127.0.0.1/'),dismissInstallOffer,enterV100FromTitle));
    assert.deepEqual(fixture.clicks,[]);
  });
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
