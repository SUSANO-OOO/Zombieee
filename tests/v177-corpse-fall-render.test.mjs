import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { animationClipFor, PLAYABLE_COMBAT_KINDS } from '../app/combatPresentation.js';
import { ENEMY_DEATH_CONFIG } from '../app/combatLifecycle.js';
import { spriteFrameFor, spriteKinds } from '../app/spriteManifest.js';

const source = fs.readFileSync('app/AshfallGame.tsx', 'utf8');
const parsed = ts.createSourceFile('AshfallGame.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let statements, rotation;
function visit(node) {
  if (ts.isForOfStatement(node) && ts.isBlock(node.statement) && node.expression.getText(parsed) === 'g.corpses') {
    const branch = node.statement.statements.find(s => ts.isIfStatement(s) && s.expression.getText(parsed).startsWith('sprite?.complete'));
    if (branch) {
      const names = new Set(['timing', 'dyingProgress', 'ashingProgress', 'fallAngle', 'fallProgress', 'rotationRadians']);
      statements = branch.thenStatement.statements.filter(s => ts.isVariableStatement(s)
        && s.declarationList.declarations.some(d => names.has(d.name.getText(parsed)))).map(s => s.getText(parsed)).join('\n');
      rotation = branch.thenStatement.statements.find(s => ts.isExpressionStatement(s)
        && ts.isCallExpression(s.expression) && s.expression.expression.getText(parsed) === 'ctx.rotate')?.getText(parsed);
    }
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(statements && rotation, 'exercise the actual corpse renderer and its applied rotation');
const angleFor = vm.runInNewContext(`(corpse, v100, authoredDeathPose = false) => {
  const g = { definition: { missionConfig: { v100StageNumber: v100 ? 1 : null } } };
  const corpseRenderKind = corpse.kind, allyCue = null;
  const fallDirection = corpse.variant % 2 === 0 ? -1 : 1;
  let angle;
  const ctx = { rotate: value => { angle = value; } };
  ${statements}
  ${rotation}
  return angle;
}`, { animationClipFor, ENEMY_DEATH_CONFIG });
const fallbackAllies = PLAYABLE_COMBAT_KINDS.filter(kind => !kind.startsWith('mayo-chan')
  && spriteFrameFor(kind, 'death', 'right').derivedFrom === 'hit');
assert.ok(fallbackAllies.length > 0);
const corpse = (kind, seconds, variant = 0) => ({ kind, side: 'human', state: 'dying', deathClass: 'normal', deathAge: seconds, phaseElapsed: seconds, variant });

test('every V1 ally with a fallback death starts upright and reaches the existing final fall angle', () => {
  for (const kind of fallbackAllies) {
    const duration = animationClipFor(kind, 'death').durationSeconds;
    assert.equal(angleFor(corpse(kind, 0), true), 0, kind + ' must not instantly jump to its final pose');
    const early = Math.abs(angleFor(corpse(kind, .05), true));
    assert.ok(early > 0 && early < 1.18, kind + ' must paint an intermediate fall');
    assert.ok(Math.abs(Math.abs(angleFor(corpse(kind, duration), true)) - 1.18) < 1e-12, kind);
    assert.equal(angleFor(corpse(kind, duration + 1), true), angleFor(corpse(kind, duration), true));
  }
});

test('the real ally fall progresses continuously in both existing fall directions', () => {
  for (const kind of fallbackAllies) for (const variant of [0, 1]) {
    const duration = animationClipFor(kind, 'death').durationSeconds;
    let previous = 0;
    for (let frame = 0; frame <= Math.ceil(duration * 60); frame++) {
      const angle = Math.abs(angleFor(corpse(kind, Math.min(duration, frame / 60), variant), true));
      assert.ok(Number.isFinite(angle) && angle >= previous - 1e-12 && angle <= 1.18 + 1e-12, kind);
      assert.ok(angle - previous < .09, kind + ' has no one-frame rotation jump at60fps');
      previous = angle;
    }
  }
});

test('already authored prone death art is never rotated a second time', () => {
  for (const kind of spriteKinds) for (const side of ['human', 'zombie']) for (const seconds of [0, .05, 1]) {
    assert.equal(angleFor({ ...corpse(kind, seconds), side }, true, true), 0, kind);
  }
});

test('enemy normal, heavy and boss fall timing and endpoint remain unchanged', () => {
  for (const [deathClass, endpoint] of [['normal', 1.08], ['heavy', .9], ['boss', .68]]) {
    const dyingSeconds = ENEMY_DEATH_CONFIG.timings[deathClass].dyingSeconds;
    for (const v100 of [true, false]) {
      const c = { ...corpse('walker', dyingSeconds / 4), side: 'zombie', deathClass };
      assert.ok(Math.abs(Math.abs(angleFor(c, v100)) - endpoint / 4) < 1e-12);
      assert.ok(Math.abs(Math.abs(angleFor({ ...c, state: 'dead' }, v100)) - endpoint) < 1e-12);
    }
  }
});

test('legacy ally rendering retains its original fall pose', () => {
  for (const kind of fallbackAllies) for (const seconds of [0, .05, .5]) {
    assert.equal(Math.abs(angleFor(corpse(kind, seconds), false)), 1.18, kind);
  }
});

const browserSource = fs.readFileSync('scripts/v102-combat-browser.mjs', 'utf8');
const browserParsed = ts.createSourceFile('browser.mjs', browserSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let latePredicate;
function findLate(node) {
  if (ts.isCallExpression(node) && node.expression.getText(browserParsed) === 'page.waitForFunction'
    && node.arguments[0].getText(browserParsed).includes('settled.every')) latePredicate = node.arguments[0].getText(browserParsed);
  ts.forEachChild(node, findLate);
}
findLate(browserParsed);
assert.ok(latePredicate, 'the native browser caller must wait for the actual late outcome');
function lateResult(body, receipts = [], outcome = 'corpse') {
  const pauses = [];
  const predicate = vm.runInNewContext('(' + latePredicate + ')', { window: { __ASHFALL_BATTLE_QA__: {
    getEnemyFacingRuntimeAudit: () => body,
    getPhaseGCombatSnapshot: () => ({ manualAbilityReceipts: receipts }),
    setEnemyVfxProofPaused: value => pauses.push(value),
  } } });
  return { ready: predicate({ fighterId: 7, outcome, deathSeconds: .42 }), pauses };
}

test('actual native late-corpse polling rejects early or incomplete paint before it holds the settled body', () => {
  const settled = { fighter: null, corpse: { deathAge: .6 }, corpseRenderHistory: [{ fallProgress: 1 }, { fallProgress: 1 }, { fallProgress: 1 }] };
  for (const body of [{ ...settled, corpse: { deathAge: .1 } }, { ...settled, corpseRenderHistory: [{ fallProgress: 1 }] },
    { ...settled, corpseRenderHistory: [{ fallProgress: .2 }, { fallProgress: 1 }, { fallProgress: 1 }] }]) {
    assert.deepEqual(lateResult(body), { ready: false, pauses: [] });
  }
  assert.deepEqual(lateResult(settled), { ready: true, pauses: [true] });
});

test('actual native Mayo completion polling requires the removed original actor and its own completion receipt', () => {
  const removed = { fighter: null, corpse: null, corpseRenderHistory: [] };
  const receipt = { ownerId: 7, eventType: 'retreat-complete' };
  assert.deepEqual(lateResult(removed, [{ ...receipt, ownerId: 99 }], 'retreat'), { ready: false, pauses: [] });
  assert.deepEqual(lateResult({ ...removed, fighter: { id: 7 } }, [receipt], 'retreat'), { ready: false, pauses: [] });
  assert.deepEqual(lateResult({ ...removed, corpse: { id: 7 } }, [receipt], 'retreat'), { ready: false, pauses: [] });
  assert.deepEqual(lateResult(removed, [receipt], 'retreat'), { ready: true, pauses: [true] });
});
