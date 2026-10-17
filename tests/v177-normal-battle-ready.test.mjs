import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import { createDefaultV100Save } from '../app/v100Save.js';
import { normalCampaignDeploymentCount } from '../scripts/v100-normal-play-contract.mjs';

const driverSource = fs.readFileSync('scripts/v100-normal-campaign-playthrough.mjs', 'utf8');
const driver = ts.createSourceFile('driver.mjs', driverSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = driver.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'battle');
assert.ok(declaration);
const appSource = fs.readFileSync('app/AshfallGame.tsx', 'utf8');
const app = ts.createSourceFile('AshfallGame.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const counters = [];
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute =>
    ts.isJsxAttribute(attribute) && attribute.name.getText(app) === 'className'
    && attribute.initializer?.text === 'bay-status v100-deployed-count')) counters.push(node);
  ts.forEachChild(node, visit);
}
visit(app);
assert.equal(counters.length, 1);
const renderCounter = vm.runInNewContext(ts.transpileModule('(hud) => (' + counters[0].getText(app) + ');', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText, { React });

function fixture({ ready = false, stuck = false, duplicate = false } = {}) {
  const save = createDefaultV100Save({ now: '2026-10-14T00:00:00Z' }), original = structuredClone(save);
  const report = { stages: [], provenance: { head: 'a'.repeat(40) } }, events = [];
  const probe = new Error('Stop the offline source probe after reading the real counter');
  const timeout = new Error('Battle HUD did not become visible within the original 15000ms step deadline');
  let parsed;
  const page = { locator(selector) {
    assert.equal(selector, '.v100-deployed-count', 'no inputs may run before the visible battle HUD');
    return {
      async waitFor(options) {
        assert.equal(options.state, 'visible');assert.equal(options.timeout, 15_000);
        events.push('wait-visible');
        if (stuck) throw timeout;
        await Promise.resolve();ready = true;
      },
      async evaluateAll(read,args) {
        events.push('read-counter');
        const node = { getAttribute(name) {
          assert.equal(name, 'aria-label');
          return renderCounter({ summonedCount: 0 }).props['aria-label'];
        } };
        return read(ready ? (duplicate ? [node, node] : [node]) : [],args);
      },
    };
  } };
  const battle = vm.runInNewContext(declaration.getText(driver) + '\nbattle;', {
    page, report, saveAt: async () => save, persist: async () => {},out:'inert',
    createNormalFrameCapture:async()=>({record:async()=>{}}),
    finishNormalFrameCapture:async()=>({status:'incomplete',performanceAcceptance:false}),
    __V177_READ_NORMAL_FRAMES__:()=>({owner:'inert',sequence:0,times:[]}),
    phaseAt: async () => 'battle', continueRequested: async () => {},
    normalCampaignDeploymentCount(label) {
      parsed = normalCampaignDeploymentCount(label);
      throw probe;
    },
  });
  return { run: () => battle({ id: 'stage-01', number: 1 }), report, events, probe, timeout,
    verifySave: () => assert.deepEqual(save, original), parsed: () => parsed };
}

test('the real normal battle waits for the production HUD after the outer phase already says battle', async () => {
  for (const ready of [false, true]) {
    const f = fixture({ ready });
    await assert.rejects(f.run(), error => error === f.probe);
    assert.deepEqual(f.events, ['wait-visible', 'read-counter']);
    assert.deepEqual(f.parsed(), { active: 0, limit: 7 });
    assert.equal(f.report.stages.length, 1);assert.equal(f.report.stages[0].inputs.length, 0);
    assert.equal(f.report.stages[0].status, 'running');f.verifySave();
  }
});

test('stuck asset preparation fails once within the original step deadline without reading or changing a save', async () => {
  const f = fixture({ stuck: true });
  await assert.rejects(f.run(), error => error === f.timeout);
  assert.deepEqual(f.events, ['wait-visible']);
  assert.equal(f.report.stages[0].inputs.length, 0);assert.equal(f.report.stages[0].status, 'running');f.verifySave();
});

test('a visible but duplicated production counter still fails the original strict deployment contract', async () => {
  const f = fixture({ duplicate: true });
  await assert.rejects(f.run(), /normal play requires the actual deployment counter/u);
  assert.equal(f.report.stages[0].inputs.length, 0);f.verifySave();
});
