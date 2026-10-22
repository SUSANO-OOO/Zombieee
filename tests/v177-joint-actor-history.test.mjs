import test from 'node:test';
import assert from 'node:assert/strict';
import { v177JointActorKey, pruneV177JointActorHistory } from '../app/v177JointActorHistory.js';
import { advanceAreaEffects } from '../app/gameRules.js';
import { spriteKinds } from '../app/spriteManifest.js';
import { v177JointPose, drawV177JointPose } from '../app/v177JointPresentation.js';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createBattleAudioRuntime, stopBattleAudioRuntime, resetBattleAudioRuntime } from '../app/battleAudioRuntime.js';

const context=()=>new Proxy({},{get:(_target,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):key==='imageSmoothingEnabled'?false:()=>{}});
const runtime={locomotionPhase:.37,locomotionSettle:1};
const paint=(kind,plan,actor,world,image={naturalWidth:1})=>drawV177JointPose(context(),image,kind,plan,0,0,100,120,{actor,world});
const replaceFighters=world=>{world.fighters=advanceAreaEffects({areaEffects:[],fighters:world.fighters,seconds:1/60}).fighters;return world.fighters[0];};

test('renderer history keys survive immutable Fighter replacement inside one battle without touching Fighter or world data',()=>{
  const actor={id:11,hp:70,kind:'ranger'},world={battleAudioGeneration:5,fighters:[actor]};
  const before=JSON.stringify(world),key=v177JointActorKey(actor,world);
  for(let i=0;i<1000;i++)assert.equal(v177JointActorKey({...actor,flash:.12,stunned:.42},world),key);
  assert.equal(JSON.stringify(world),before);assert.deepEqual(key,{});
});

test('stable IDs are scoped to their world and living membership; audio lifecycle cannot erase a continuing actor',()=>{
  const actor={id:11},world={battleAudioGeneration:5,fighters:[actor]},key=v177JointActorKey(actor,world);
  assert.notEqual(v177JointActorKey({id:12},world),key);
  assert.notEqual(v177JointActorKey({...actor},{...world}),key);
  world.battleAudioGeneration++;assert.equal(v177JointActorKey(actor,world),key);
  const next=v177JointActorKey(actor,world);world.fighters=[];pruneV177JointActorHistory(world);
  assert.notEqual(v177JointActorKey(actor,world),next);
  const reset=v177JointActorKey(actor,world);world.fighters=[actor];world.battleAudioGeneration++;pruneV177JointActorHistory(world);
  assert.equal(v177JointActorKey(actor,world),reset);
});

test('unbound unit fixtures retain object-key behavior and invalid identities cannot share a battle key',()=>{
  const actor={hp:30},world={fighters:[]};
  assert.equal(v177JointActorKey(actor),actor);assert.equal(v177JointActorKey(actor,world),actor);
  assert.notEqual(v177JointActorKey({...actor},world),actor);
  assert.equal(v177JointActorKey(null,world),null);assert.equal(v177JointActorKey(7,world),null);
  pruneV177JointActorHistory(null);
});

test('all48 actual joint draws keep their last painted hit pose after the production area-effect update replaces each actor',()=>{
  for(const kind of spriteKinds) {
    const actor={id:4,kind,hp:70},world={battleAudioGeneration:5,fighters:[actor]};
    const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.43},runtime,{actor,world});
    assert.equal(paint(kind,plan,actor,world),true);
    const copy=replaceFighters(world);assert.notEqual(copy,actor);
    const held=v177JointPose(kind,{requestedState:'hit-light'},runtime,{actor:copy,world});
    assert.ok(held,kind+' lost its painted history after the actual production clone');
    assert.equal(held.reactionHeld,true);
    for(const key of Object.keys(plan))assert.deepEqual(held[key],plan[key]);
    assert.equal(paint(kind,held,copy,world),true);
  }
});

test('living stun survives successive real update copies, paused redraw and remaining-clock progression in all48 bodies',()=>{
  for(const kind of spriteKinds) {
    let actor={id:4,kind,hp:70},world={battleAudioGeneration:5,fighters:[actor]};
    const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.43},runtime,{actor,world});
    assert.equal(paint(kind,plan,actor,world),true);
    for(const remaining of [.42,.35,.35,.2,.1]) {
      actor=replaceFighters(world);
      const stunnedRuntime={...runtime,state:'incapacitated',elapsedSeconds:.42-remaining,transitionCount:7};
      const state=v177JointPose(kind,{requestedState:'incapacitated'},stunnedRuntime,{actor,world,stunRemaining:remaining});
      assert.ok(state?.liveStun,kind+' must retain the same living stun across immutable updates');
      assert.ok(Math.abs(state.stunElapsed-(.42-remaining))<1e-10);
      assert.equal(paint(kind,state,actor,world),true);
    }
    const ready=v177JointPose(kind,{requestedState:'idle'},runtime,{actor:replaceFighters(world),world});
    assert.ok(ready);assert.notEqual(ready.liveStun,true);
  }
});

test('failed paint and an owned action invalidate the shared ID history even after another production clone',()=>{
  const kind='ranger',actor={id:4,kind,hp:70},world={battleAudioGeneration:5,fighters:[actor]};
  let plan=v177JointPose(kind,{requestedState:'idle'},runtime,{actor,world});paint(kind,plan,actor,world);
  assert.equal(paint(kind,plan,replaceFighters(world),world,{naturalWidth:0}),false);
  assert.equal(v177JointPose(kind,{requestedState:'hit-heavy'},runtime,{actor:replaceFighters(world),world}),null);
  const copy=world.fighters[0];plan=v177JointPose(kind,{requestedState:'idle'},runtime,{actor:copy,world});paint(kind,plan,copy,world);
  assert.equal(v177JointPose(kind,{requestedState:'active'},runtime,{actor:replaceFighters(world),world,ownedPose:true}),null);
  assert.equal(v177JointPose(kind,{requestedState:'incapacitated'},runtime,{actor:replaceFighters(world),world,stunRemaining:.42}),null);
});

test('the actual product draw passes the same world to both resolver and successful paint, and prunes removed actors',()=>{
  const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const draw=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='drawSpriteFighter');
  const calls=[];const visit=n=>{if(ts.isCallExpression(n))calls.push(n);ts.forEachChild(n,visit);};visit(draw);
  for(const name of ['v177JointPose','drawV177JointPose']) {
    const found=calls.filter(n=>n.expression.getText(tree)===name);assert.equal(found.length,1);
    const options=found[0].arguments.at(-1);assert.ok(ts.isObjectLiteralExpression(options));
    assert.equal(options.properties.find(p=>p.name?.getText(tree)==='world')?.initializer.getText(tree),'options.world');
    assert.equal(options.properties.find(p=>p.name?.getText(tree)==='actor')?.initializer.getText(tree),'f');
  }
  const all=[];const visitAll=n=>{if(ts.isCallExpression(n)&&n.expression.getText(tree)==='pruneV177JointActorHistory')all.push(n);ts.forEachChild(n,visitAll);};visitAll(tree);
  assert.equal(all.length,1);assert.equal(all[0].arguments[0].getText(tree),'g');
});

test('the actual result audio-stop branch and event resume retain all48 painted bodies while the battle clock is stopped',()=>{
  const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),blocks=[];
  const visit=n=>{if(ts.isIfStatement(n)&&n.expression.getText(tree)==='end'
    &&n.thenStatement.getText(tree).includes('gameRef.current.battleAudioGeneration = stopBattleAudioRuntime'))blocks.push(n.thenStatement);ts.forEachChild(n,visit);};visit(tree);
  assert.equal(blocks.length,1);
  const result=new Function('gameRef','battleAudioRuntimeRef','stopBattleAudioRuntime','resetBattlePresentationRuntime',
    'resetPressureLatchRuntime','pressureLatchRef','manualAbilityReadyStateRef',blocks[0].getText(tree));
  for(const kind of spriteKinds) {
    const audio=createBattleAudioRuntime(),actor={id:4,kind,hp:70,stunned:.35};
    const world={battleAudioGeneration:audio.battleGeneration,fighters:[actor],over:true};
    const options={actor,world,stunRemaining:.35},r={...runtime,state:'incapacitated',elapsedSeconds:.07,transitionCount:7};
    paint(kind,v177JointPose(kind,{requestedState:'active',clipProgress:.43},runtime,{actor,world}),actor,world);
    const before=v177JointPose(kind,{requestedState:'incapacitated'},r,options);assert.ok(before.liveStun);paint(kind,before,actor,world);
    result({current:world},{current:audio},stopBattleAudioRuntime,()=>({}),()=>{},{current:{}},{current:new Set()});
    assert.equal(world.battleAudioGeneration,1);assert.equal(actor.stunned,.35);
    for(let i=0;i<3;i++) {
      pruneV177JointActorHistory(world);
      const after=v177JointPose(kind,{requestedState:'incapacitated'},r,options);assert.deepEqual(after,before,kind);
      assert.equal(paint(kind,after,actor,world),true);
    }
    world.battleAudioGeneration=resetBattleAudioRuntime(audio,'battle-screen-resume');
    const resumed=v177JointPose(kind,{requestedState:'incapacitated'},r,options);assert.deepEqual(resumed,before);
  }
});
