import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import { MANUAL_ABILITY_REGISTRY } from '../app/manualAbilities.js';
import { triggerMonkeyTrap, UNIT_ROLE_TUNING } from '../app/unitRoleMechanics.js';

const source = fs.readFileSync('app/AshfallGame.tsx', 'utf8');
const tree = ts.createSourceFile('AshfallGame.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), nodes = [];
function visit(n) { nodes.push(n); ts.forEachChild(n, visit); } visit(tree);
function code(expression) {
  const matches = nodes.filter(n => ts.isIfStatement(n) && n.expression.getText(tree) === expression);
  assert.equal(matches.length, 1);
  return ts.transpile('for (let once=0; once<1; once++) {' + matches[0].getText(tree) + '}', { target: ts.ScriptTarget.ES2022 });
}
const deploy = code('event.kind === "engineer"');
const spring = code('f.engineerTrapReady && f.engineerTrapLane !== null');
function setup(triggerCode=spring) {
  const owner = { id: 1, kind: 'engineer', side: 'human', x: 200, y: 280, hp: 100,
    engineerTrapReady: false, engineerTrapLane: null, trapDurationMultiplier: 1, manualAbility: { activationId: 2 } };
  const enemy = { id: 2, kind: 'walker', side: 'zombie', x: 650, y: 280, lane: 1, hp: 100, combatReady: true,
    stunned: 0, suppressionStacks: 0, suppressedRemaining: 0 };
  const g = { fighters: [owner, enemy], definition: { missionConfig: { v100StageNumber: 23 } }, roleMetrics: { monkeyTrapTriggers: 0 } };
  const cues = [], effects = [], randomCalls=[];
  const observedMath=Object.create(Math);observedMath.random=()=>{randomCalls.push(.5);return .5;};
  const bindings = { g, owner, f: owner, Math:observedMath, triggerMonkeyTrap, MANUAL_ABILITY_REGISTRY, UNIT_ROLE_TUNING,
    event: { kind: 'engineer', activationId: 2, target: { x: 400, y: 280, trapX: 400, trapLane: 1 } },
    activeLaneCenters: [180, 280, 380], addParticles() {},
    playManualAbilityTimelineCue: (actor, key, x, receipt) => cues.push({ ownerId: actor.id, key, x, receipt }),
    queueV100SupportAbilityEffect: (_game, effect) => effects.push(effect) };
  return { owner, enemy, g, cues, effects, randomCalls, deploy: () => vm.runInNewContext(deploy, bindings),
    tick: () => vm.runInNewContext(triggerCode, bindings) };
}

test('manual trap stays quiet until a living target actually enters, then springs exactly once', () => {
  const s = setup(); s.deploy();
  assert.equal(s.owner.engineerTrapReady, true);
  assert.deepEqual(s.cues, [], 'deploying is not a spring');
  s.tick(); assert.deepEqual(s.cues, []);
  s.enemy.x = 410; s.tick();
  assert.deepEqual(s.cues.map(c => [c.key, c.x]), [['spring', 400]]);
  assert.equal(s.enemy.stunned, MANUAL_ABILITY_REGISTRY.engineer.bindSeconds);
  assert.equal(s.enemy.suppressedRemaining, MANUAL_ABILITY_REGISTRY.engineer.bindSeconds + MANUAL_ABILITY_REGISTRY.engineer.slowSeconds);
  assert.equal(s.g.roleMetrics.monkeyTrapTriggers, 1);
  assert.deepEqual(s.effects.map(e => e.eventType), ['trap-deploy', 'trap-sprung']);
  assert.deepEqual(Array.from(s.effects[1].targetIds),[s.enemy.id]);
  assert.equal(s.effects[1].duration,MANUAL_ABILITY_REGISTRY.engineer.bindSeconds);assert.equal(s.effects[1].springSeconds,.3);
  s.tick(); assert.equal(s.cues.length, 1);
});

test('dead, unavailable and off-lane targets do not emit a trap spring', () => {
  for (const patch of [{ hp: 0 }, { combatReady: false }, { lane: 2 }]) {
    const s = setup(); s.deploy(); Object.assign(s.enemy, { x: 400 }, patch); s.tick();
    assert.deepEqual(s.cues, []);
    assert.equal(s.g.roleMetrics.monkeyTrapTriggers, 0);
    assert.equal(s.owner.engineerTrapReady, true);
  }
});

test('ordinary automatic trap keeps its existing audio and control behavior', () => {
  const s = setup(); Object.assign(s.owner, { engineerTrapReady: true, engineerTrapManual: false, engineerTrapX: 400, engineerTrapLane: 1 });
  s.enemy.x = 400; s.tick();
  assert.deepEqual(s.cues, []);
  assert.equal(s.g.roleMetrics.monkeyTrapTriggers, 1);
  assert.equal(s.enemy.stunned, UNIT_ROLE_TUNING.monkey.stopSeconds);
  assert.equal(s.effects[0].duration,.3);assert.equal(s.effects[0].targetIds,undefined);
});

test('the real trigger retains the prior targets, control timers, audio, role metrics and random calls at every trap multiplier',()=>{
  const previous=execFileSync('git',['show','b70db04735cee9b186e18cca4b67f270c17b06f5:app/AshfallGame.tsx'],{encoding:'utf8',maxBuffer:8*1024**2});
  const previousTree=ts.createSourceFile('before.tsx',previous,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),matches=[];
  function walk(n){if(ts.isIfStatement(n)&&n.expression.getText(previousTree)==='f.engineerTrapReady && f.engineerTrapLane !== null')matches.push(n);ts.forEachChild(n,walk);}walk(previousTree);assert.equal(matches.length,1);
  const previousTrigger=ts.transpile('for(let once=0;once<1;once++){'+matches[0].getText(previousTree)+'}',{target:ts.ScriptTarget.ES2022});
  for(const multiplier of [.8,1,1.5]){
    const before=setup(previousTrigger),after=setup();
    for(const s of [before,after]){s.owner.trapDurationMultiplier=multiplier;s.deploy();s.enemy.x=410;
      s.g.fighters.push({...s.enemy,id:3,x:425},{...s.enemy,id:4,lane:2});s.tick();s.tick();}
    const plain=value=>JSON.parse(JSON.stringify(value));
    assert.deepEqual(plain(after.g),plain(before.g));assert.deepEqual(plain(after.cues),plain(before.cues));assert.deepEqual(after.randomCalls,before.randomCalls);
    assert.deepEqual(Array.from(after.effects[1].targetIds),[2,3]);assert.equal(after.effects[1].duration,MANUAL_ABILITY_REGISTRY.engineer.bindSeconds*multiplier);assert.equal(after.effects[1].springSeconds,.3);
    assert.equal(after.cues.length,1);assert.equal(after.g.roleMetrics.monkeyTrapTriggers,1);
  }
});
