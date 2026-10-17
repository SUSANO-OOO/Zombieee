import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {mayoBattleRenderKind,createMayoRetreatRuntime,advanceMayoRetreat,mayoRetreatBlocksDamage} from '../app/mayoLifecycle.js';
import {beginV102GoreStep,finishV102GoreStep,noteV102GoreImpact,getV102GoreSnapshot} from '../app/v102CombatGore.js';
import {spriteKinds} from '../app/spriteManifest.js';
import {PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';

const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
const parsed=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let retreatDeclaration;
function visit(node){
  if(ts.isFunctionDeclaration(node)&&node.name?.text==='beginMayoRetreat')retreatDeclaration=node;
  if(!retreatDeclaration)ts.forEachChild(node,visit);
}
visit(parsed);assert.ok(retreatDeclaration,'use the actual defeat/ability retreat entry point');
const emitted=ts.transpileModule(retreatDeclaration.getText(parsed),
  {compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText;
const begin=vm.runInNewContext(emitted+'\nbeginMayoRetreat',{
  mayoBattleRenderKind,createMayoRetreatRuntime,cards:[{kind:'mayo-chan',deployCooldown:24}],addParticles:()=>{},
});

test('actual injury retreat keeps the visible form through fall, rise and the real retreat path',()=>{
  for(const phase of ['ready','feral']){
    const fighter={id:7,kind:'mayo-chan',side:'human',hp:0,maxHp:160,x:420,y:280,
      manualAbility:{phase,activeRemaining:3},mayoRetreat:null};
    const g={manualAbilityVfx:[{ownerId:7},{ownerId:9}],deployCooldowns:{},corpses:[]};
    const expected=mayoBattleRenderKind(fighter);
    assert.equal(begin(g,fighter,'injury'),true);
    assert.equal(fighter.id,7);assert.equal(fighter.kind,'mayo-chan');
    assert.equal(fighter.manualAbility.phase,'retreat');assert.equal(fighter.hp,1);
    assert.equal(fighter.mayoRetreat.reason,'injury');
    assert.equal(mayoBattleRenderKind(fighter),expected,`${phase}: injury must not swap the body at the start of fall`);
    assert.equal(mayoRetreatBlocksDamage(fighter.mayoRetreat),true);
    for(const seconds of [.34,.22,.2]){
      const result=advanceMayoRetreat(fighter.mayoRetreat,seconds,{x:fighter.x,baseX:128});
      fighter.mayoRetreat=result.runtime;fighter.x=result.x;
      assert.equal(mayoBattleRenderKind(fighter),expected,`${phase}/${fighter.mayoRetreat.phase}`);
    }
    assert.equal(fighter.mayoRetreat.phase,'run');assert.ok(fighter.x<420);
    assert.equal(g.corpses.length,0);assert.equal(g.deployCooldowns['mayo-chan'],42);
    assert.deepEqual(g.manualAbilityVfx,[{ownerId:9}]);
  }
});

test('Mayo injury, lethal damage and ability HP drain cannot enter the shared blood or severing renderer',()=>{
  for(const kind of ['mayo-chan','mayo-chan-feral'])for(const damage of [6,120]){
    const actor={id:7,kind,side:'human',hp:100,maxHp:100,x:420,y:280};
    const world={definition:{missionConfig:{v100StageNumber:1}},time:10,fighters:[actor],corpses:[]};
    const step=beginV102GoreStep(world);
    noteV102GoreImpact(world,actor,{weapon:'guardian',originX:500,originY:250,damage});
    actor.hp=Math.max(0,actor.hp-damage);finishV102GoreStep(world,step);
    assert.deepEqual(getV102GoreSnapshot(world),{impacts:[],pools:[],wounds:[],pending:false},`${kind}/${damage}: protected retreat has no blood`);
    const drain=beginV102GoreStep(world);actor.hp=Math.max(0,actor.hp-2);finishV102GoreStep(world,drain);
    assert.deepEqual(getV102GoreSnapshot(world),{impacts:[],pools:[],wounds:[],pending:false},`${kind}: ability HP drain is not a bloody impact`);
  }
});

test('all other 46 authored bodies retain the existing applied-damage gore contract',()=>{
  const forms=spriteKinds.filter(kind=>!['mayo-chan','mayo-chan-feral'].includes(kind));assert.equal(forms.length,46);
  for(const kind of forms){
    const side=PLAYABLE_COMBAT_KINDS.includes(kind)?'human':'zombie';
    const actor={id:7,kind,side,hp:100,maxHp:100,x:420,y:280};
    const world={definition:{missionConfig:{v100StageNumber:1}},time:10,fighters:[actor],corpses:[]};
    const step=beginV102GoreStep(world);
    noteV102GoreImpact(world,actor,{weapon:'guardian',originX:500,originY:250,damage:100});
    actor.hp=0;assert.equal(finishV102GoreStep(world,step),1,kind);
    const snapshot=getV102GoreSnapshot(world);
    assert.equal(snapshot.impacts.length,1);assert.equal(snapshot.pools.length,1);
    assert.equal(snapshot.wounds.length,1);assert.equal(snapshot.wounds[0].severed,side==='zombie');
  }
});
