import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { advanceManualAbility, beginManualAbility, createManualAbilityRuntime, MANUAL_ABILITY_REGISTRY } from '../app/manualAbilities.js';

const source = fs.readFileSync('app/AshfallGame.tsx', 'utf8');
const tree = ts.createSourceFile('AshfallGame.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
visit(tree);
const one = predicate => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1);
  return matches[0];
};
const release = one(n => ts.isIfStatement(n) && n.expression.getText(tree).includes('previousRuntimeElapsed < .4'));
const impact = one(n => ts.isIfStatement(n) && n.expression.getText(tree) === 'event.kind === "zakimiya"');
const advance = one(n => ts.isVariableDeclaration(n) && n.name.getText(tree) === 'previousRuntimeElapsed').parent.parent;
const statements = advance.parent.statements;
const start = statements.indexOf(advance), end = statements.indexOf(release);
assert.ok(start >= 0 && end > start);
// Execute the actual game consumer, not a duplicate audio scheduler.
const tick = ts.transpile(statements.slice(start, end + 1).map(n => n.getText(tree)).join('\n')
  + '\nfor (const event of abilityStep.events) {' + impact.getText(tree) + '}', { target: ts.ScriptTarget.ES2022 });

function scenario(stageNumber = 23, target = { x: 320, y: 280, lane: 1 }) {
  const owner = { id: 1, kind: 'zakimiya', side: 'human', x: 200, y: 280, hp: 100,
    manualAbility: beginManualAbility(createManualAbilityRuntime('zakimiya'), target).runtime };
  const victim = { id: 2, side: 'zombie', hp: 100, combatReady: true, x: 320, y: 280, flash: 0, knock: 0 };
  const g = { time: 0, fighters: [owner, victim], definition: { missionConfig: { v100StageNumber: stageNumber } },
    areaEffects: [], nextAreaEffectId: 1, flashOverlay: 0, shake: 0 };
  const cues = [], effects = [];
  return { owner, victim, g, cues, effects, step(dt) {
    g.time += dt;
    vm.runInNewContext(tick, {
      g, owner, dt, previousAbilityPhase: owner.manualAbility.phase, advanceManualAbility, MANUAL_ABILITY_REGISTRY,
      playManualAbilityTimelineCue: (_owner, key, x, receipt) => cues.push({ key, x, receipt, at: g.time }),
      queueAdvancedAbilityPendingOrigin: (_g, _owner, effect) => effects.push(effect),
      queueV100AdvancedAbilityEffect: (_g, effect) => effects.push(effect),
      effectDistance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
      noteV102GoreImpact() {}, recordUnitDamage() {}, addDamageText() {}, addParticles() {},
      activeLaneForY: () => 1, triggerCameraShake: () => 1, CAMERA_SHAKE_EVENTS: { airstrikeImpact: 1 },
    });
  } };
}

test('bottle release sounds before contact, while damage and fire keep their original timing', () => {
  for (const stage of [23, undefined]) {
    const s = scenario(stage);
    if (stage === undefined) delete s.g.definition.missionConfig.v100StageNumber;
    s.step(.39);
    assert.deepEqual(s.cues, []);
    s.step(.02);
    assert.deepEqual(s.cues.map(c => c.key), ['throw']);
    assert.equal(s.cues[0].x, s.owner.x);
    assert.equal(s.victim.hp, 100);
    assert.equal(s.g.areaEffects.length, 0);
    if (stage) {
      const bottle = s.effects.find(e => e.type === 'zakimiya-bottle');
      assert.ok(Math.abs(bottle.startedAt - .4) < 1e-10);
      assert.equal(bottle.duration, .16);
    }
    s.step(.14);
    assert.deepEqual(s.cues.map(c => c.key), ['throw']);
    s.step(.02);
    assert.deepEqual(s.cues.map(c => c.key), ['throw', 'impact', 'burn']);
    assert.ok(s.cues[1].at - s.cues[0].at >= .15);
    assert.equal(s.cues[1].x, 320);
    assert.equal(s.victim.hp, 58);
    assert.equal(s.g.areaEffects.length, 1);
    assert.equal(s.g.areaEffects[0].remaining, 5);
    s.step(.1);
    assert.equal(s.cues.length, 3, 'recovery cannot replay the throw');
  }
});

test('a step crossing release and impact emits one throw before the contact cues', () => {
  for (const dt of [.6, .9]) {
    const s = scenario(); s.step(dt);
    assert.deepEqual(s.cues.map(c => c.key), ['throw', 'impact', 'burn']);
    assert.equal(s.victim.hp, 58);
  }
});

test('cancelling before the throw does not produce a delayed throw or impact', () => {
  const s = scenario(); s.step(.2);
  s.owner.manualAbility = createManualAbilityRuntime('zakimiya');
  s.step(.5);
  assert.deepEqual(s.cues, []);
  assert.equal(s.victim.hp, 100);
  assert.equal(s.g.areaEffects.length, 0);
});
