import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { animationClipFor, PLAYABLE_COMBAT_KINDS } from '../app/combatPresentation.js';
import { ENEMY_DEATH_CONFIG } from '../app/combatLifecycle.js';
import { spriteFrameFor, spriteKinds } from '../app/spriteManifest.js';
import { v102CorpseFallingPose, v102HasFallingDeathFrame, V102_FALLING_DEATH_KINDS } from '../app/v102CorpsePose.js';

const source = fs.readFileSync('app/AshfallGame.tsx', 'utf8');
const parsed = ts.createSourceFile('AshfallGame.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let statements, rotation, translation;
function visit(node) {
  if (ts.isForOfStatement(node) && ts.isBlock(node.statement) && node.expression.getText(parsed) === 'g.corpses') {
    const spriteBranch=s=>{
      if(!ts.isIfStatement(s))return null;
      if(s.expression.getText(parsed).startsWith('sprite?.complete'))return s;
      return s.elseStatement?spriteBranch(s.elseStatement):null;
    };
    const branch = node.statement.statements.map(spriteBranch).find(Boolean);
    if (branch) {
      const names = new Set(['authoredDeathPose', 'timing', 'dyingProgress', 'ashingProgress', 'fallAngle', 'fallProgress', 'corpseFallingPose', 'rotationRadians', 'groundOffsetY']);
      statements = branch.thenStatement.statements.filter(s => ts.isVariableStatement(s)
        && s.declarationList.declarations.some(d => names.has(d.name.getText(parsed)))).map(s => s.getText(parsed)).join('\n');
      rotation = branch.thenStatement.statements.find(s => ts.isExpressionStatement(s)
        && ts.isCallExpression(s.expression) && s.expression.expression.getText(parsed) === 'ctx.rotate')?.getText(parsed);
      translation = branch.thenStatement.statements.find(s => ts.isExpressionStatement(s)
        && ts.isCallExpression(s.expression) && s.expression.expression.getText(parsed) === 'ctx.translate')?.getText(parsed);
    }
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(statements && rotation && translation, 'exercise the actual corpse renderer and its applied transforms');
const renderFor = vm.runInNewContext(`(corpse, v100) => {
  const g = { definition: { missionConfig: { v100StageNumber: v100 ? 1 : null } } };
  const corpseRenderKind = corpse.kind, allyCue = null;
  const frame = spriteFrameFor(corpse.kind, 'death', corpse.side === 'human' ? 'right' : 'left');
  const width = frame.sourceRect.w * .2, height = frame.sourceRect.h * .2;
  const fallDirection = corpse.variant % 2 === 0 ? -1 : 1;
  let angle, translatedY;
  const ctx = { rotate: value => { angle = value; }, translate: (_, y) => { translatedY = y; } };
  ${statements}
  ${rotation}
  ${translation}
  return { angle, translatedY, frame, width, height };
}`, { animationClipFor, ENEMY_DEATH_CONFIG, spriteFrameFor, v102CorpseFallingPose, v102HasFallingDeathFrame });
const angleFor = (corpse, v100) => renderFor(corpse, v100).angle;
const fallbackAllies = PLAYABLE_COMBAT_KINDS.filter(kind => !kind.startsWith('mayo-chan')
  && spriteFrameFor(kind, 'death', 'right').derivedFrom === 'hit');
assert.ok(fallbackAllies.length > 0);
const corpse = (kind, seconds, variant = 0) => ({ kind, x:330, y:282, side: 'human', state: 'dying', deathClass: 'normal', deathAge: seconds, phaseElapsed: seconds, variant });

test('every V1 ally with a fallback death starts upright and reaches the existing final fall angle', () => {
  for (const kind of fallbackAllies) {
    const duration = animationClipFor(kind, 'death').durationSeconds;
    const endpoint = v102HasFallingDeathFrame(kind, spriteFrameFor(kind, 'death', 'right')) ? Math.PI / 2 : 1.18;
    assert.equal(angleFor(corpse(kind, 0), true), 0, kind + ' must not instantly jump to its final pose');
    const early = Math.abs(angleFor(corpse(kind, .05), true));
    assert.ok(early > 0 && early < endpoint, kind + ' must paint an intermediate fall');
    assert.ok(Math.abs(Math.abs(angleFor(corpse(kind, duration), true)) - endpoint) < 1e-12, kind);
    assert.equal(angleFor(corpse(kind, duration + 1), true), angleFor(corpse(kind, duration), true));
  }
});

test('the real ally fall progresses continuously in both existing fall directions', () => {
  for (const kind of fallbackAllies) for (const variant of [0, 1]) {
    const duration = animationClipFor(kind, 'death').durationSeconds;
    const endpoint = v102HasFallingDeathFrame(kind, spriteFrameFor(kind, 'death', 'right')) ? Math.PI / 2 : 1.18;
    let previous = 0;
    for (let frame = 0; frame <= Math.ceil(duration * 60); frame++) {
      const angle = Math.abs(angleFor(corpse(kind, Math.min(duration, frame / 60), variant), true));
      assert.ok(Number.isFinite(angle) && angle >= previous - 1e-12 && angle <= endpoint + 1e-12, kind);
      assert.ok(angle - previous < .09, kind + ' has no one-frame rotation jump at60fps');
      previous = angle;
    }
  }
});

test('already authored prone death art is never rotated a second time', () => {
  for (const kind of spriteKinds) for (const side of ['human', 'zombie']) for (const seconds of [0, .05, 1]) {
    const frame = spriteFrameFor(kind, 'death', side === 'human' ? 'right' : 'left');
    if (frame.derivedFrom !== 'hit' && !v102HasFallingDeathFrame(kind, frame)) assert.equal(angleFor({ ...corpse(kind, seconds), side }, true), 0, kind);
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

test('actual falling-key boss renderer reaches the grounded horizontal endpoint in both fall directions', () => {
  for (const kind of V102_FALLING_DEATH_KINDS) for (const variant of [0, 1]) {
    const c = {...corpse(kind, ENEMY_DEATH_CONFIG.timings.boss.dyingSeconds, variant), side:'zombie', deathClass:'boss'};
    const rendered = renderFor(c, true);
    assert.ok(Math.abs(Math.abs(rendered.angle) - Math.PI / 2) < 1e-8, kind + ' must not stay frozen in its airborne key');
  }
});

test('actual corpse canvas translation applies the source-bound floor contact offset', () => {
  for (const kind of V102_FALLING_DEATH_KINDS) for (const variant of [0, 1]) {
    const c = {...corpse(kind, ENEMY_DEATH_CONFIG.timings.boss.dyingSeconds, variant), side:'zombie', deathClass:'boss'};
    const rendered = renderFor(c, true), expected = v102CorpseFallingPose(kind, rendered.frame, rendered.width, rendered.height, variant === 0 ? -1 : 1, 1);
    assert.ok(Math.abs(rendered.translatedY - (c.y + 5 + expected.groundOffsetY)) < 1e-8, kind + ' must draw the measured contact offset');
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

test('native late polling also waits for an actually landed joint-owned fragment',()=>{
  const body=error=>({fighter:null,corpse:{deathAge:.6},corpseRenderHistory:Array.from({length:3},()=>({
    fallProgress:1,corpseJointPose:true,corpseJointOwnedParts:['head'],corpseJointFragmentGroundError:error,
  }))});
  for(const error of [undefined,NaN,-.1,.1])assert.deepEqual(lateResult(body(error)),{ready:false,pauses:[]});
  assert.deepEqual(lateResult(body(0)),{ready:true,pauses:[true]});
});
