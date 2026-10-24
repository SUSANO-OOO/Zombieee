import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
import {prepareBornTurnedWhenReady} from '../scripts/v177-native-allunit-cases.mjs';

function fixture(){
  const source={proofId:'7:turned-getup:11',released:true,running:true,paused:false,over:false,
    actualBirth:{bornAt:76.8,initialRemaining:.75,actorId:12,corpseId:11},
    fighter:{id:12,spawnGrace:0,lane:1,anchorLane:1,y:282,nextLaneDecisionAt:77.7,targetId:null,targetObjectId:null,
      navigationRecovery:{recoveryLane:null,recoverySeconds:0,terminalFallbackSeconds:0,routeReleaseRequested:false}},
    draws:[1,2,3].map(i=>({renderSequence:i,renderKind:'turned',jointDrawSucceeded:true,
      jointGetupProgress:null,jointPaintedAt:77.55+i*.05,requestedState:'move'}))};
  const events=[],proof={fighterId:12,targetId:13},qa={
    getV177TurnedGetupProof:()=>{events.push('read');return source;},
    getSnapshot:()=>{events.push('geometry');return{geometry:{laneCenters:[212,282,352]}};},
    prepareV177BornTurnedContinuation:fields=>{events.push(['prepare',fields]);source.paused=true;return proof;},
  };
  const run=vm.runInNewContext('('+prepareBornTurnedWhenReady.toString()+')',{window:{__ASHFALL_BATTLE_QA__:qa}});
  return{source,events,proof,qa,run:phase=>run({proofId:source.proofId,phase})};
}

test('born readiness returns the exact prepare result synchronously in the ready observation task only once',()=>{
  const f=fixture();assert.equal(f.run('engage'),f.proof);
  assert.deepEqual(structuredClone(f.events),['read','geometry',['prepare',{proofId:f.source.proofId,phase:'engage'}]]);
  assert.throws(()=>f.run('engage'),/Original released born proof changed/u);
  assert.equal(f.events.filter(e=>Array.isArray(e)&&e[0]==='prepare').length,1);
});

test('born engage waits for the original AI route and rejects stale readiness without any setter',()=>{
  const mutations=[s=>{s.fighter.navigationRecovery.recoveryLane=0;},s=>{s.fighter.navigationRecovery.recoverySeconds=.01;},
    s=>{s.fighter.navigationRecovery.terminalFallbackSeconds=.01;},s=>{s.fighter.navigationRecovery.routeReleaseRequested=true;},
    s=>{s.fighter.anchorLane=0;},s=>{s.fighter.y+=2.01;},s=>{s.fighter.y=NaN;},
    s=>{s.fighter.y=Infinity;},s=>{s.fighter.y=-Infinity;},s=>{s.fighter.nextLaneDecisionAt=77.6;},
    s=>{s.fighter.targetId=99;},s=>{s.fighter.targetObjectId='barricade';}];
  for(const mutate of mutations){
    const f=fixture();mutate(f.source);const before=structuredClone(f.source);
    assert.equal(f.run('engage'),false);assert.deepEqual(f.source,before);
    assert.equal(f.events.some(e=>Array.isArray(e)),false);
  }
});

test('birth, original rise and three distinct actual paints remain required for all three phases',()=>{
  const mutations=[s=>{s.actualBirth=null;},s=>{s.fighter=null;},s=>{s.fighter.spawnGrace=.01;},
    s=>{s.draws[2].renderSequence=1;},s=>{s.draws[2].jointDrawSucceeded=false;},
    s=>{s.draws[2].jointGetupProgress=.9;},s=>{s.draws[2].jointPaintedAt=77.5;},
    s=>{s.draws[2].requestedState='rise';},s=>{s.draws[2].renderKind='walker';}];
  for(const phase of ['move','attack','engage'])for(const mutate of mutations){
    const f=fixture();mutate(f.source);const before=structuredClone(f.source);
    assert.equal(f.run(phase),false);assert.deepEqual(f.source,before);
    assert.equal(f.events.some(e=>Array.isArray(e)),false);
  }
  for(const phase of ['move','attack']){
    const f=fixture();f.source.fighter.navigationRecovery=null;f.source.fighter.y+=40;
    f.qa.getSnapshot=()=>{throw Error('Move/attack must keep the existing physical placement');};
    assert.equal(f.run(phase),f.proof);
  }
});

test('the actual born bridge holds the recorder clock while keeping the pause menu off its recorded pixels',()=>{
  const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),matches=[];
  const visit=node=>{if(ts.isPropertyAssignment(node)&&node.name.getText(tree)==='prepareV177BornTurnedContinuation')matches.push(node);ts.forEachChild(node,visit);};visit(tree);
  assert.equal(matches.length,1);
  const compiled=ts.transpileModule('const prepare='+matches[0].initializer.getText(tree)+';return prepare;',
    {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for(const phase of ['move','attack','engage']){
    const actor={id:12,hp:95},world={time:79,nextId:13,paused:false,fighters:[actor],save:{revision:9}},
      proof={fighterId:12,targetId:13},menu=[],history=new Map([[12,['old']],[99,['other']]]),deltas=new Map([[12,1],[99,2]]);
    const before=structuredClone(world),bindings={gameRef:{current:world},activeLaneCenters:[212,282,352],
      configureV177BornTurnedContinuation:(actual,fields)=>{assert.equal(actual,world);assert.deepEqual(fields,{proofId:'original',phase});return proof;},
      readV177TurnedGetupProof:()=>{},readV177TurnedBirthPresentation:()=>{},spriteKinds:['turned'],PLAYABLE_COMBAT_KINDS:['guardian'],
      createCombatAnimationRuntime:()=>{},normalAttackReach:()=>45,
      fighterRenderAuditHistory:history,fighterActualXDeltaAudit:deltas,setPaused:value=>menu.push(value)};
    const prepare=new Function(...Object.keys(bindings),compiled)(...Object.values(bindings));
    assert.equal(prepare({proofId:'original',phase}),proof);
    assert.equal(world.paused,true,'native recorder still owns the clock release');
    assert.deepEqual(menu,[false],'recording must show the actual actor instead of the pause menu');
    assert.deepEqual({...world,paused:false},before);assert.equal(world.fighters[0],actor);
    assert.equal(history.has(12),false);assert.deepEqual(history.get(99),['other']);
    assert.equal(deltas.has(12),false);assert.equal(deltas.get(99),2);
  }
});
