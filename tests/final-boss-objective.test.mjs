import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleDefinition} from '../app/battleDefinitions.js';
import {battleOutcomeFor,objectiveForBattle} from '../app/battleDefinitions.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {createBattleBarkRuntime,queueBattleBark} from '../app/battleBarks.js';

test('the final boss objective follows remaining reinforcements, not an intact optional core',()=>{
 const d=createBattleDefinition(V100_STAGE_IDS[29],{v100:true});
 const s={baseHp:d.baseMaxHp,barricadeHp:d.enemyBaseMaxHp,barricadeVulnerable:true,
  bossDefeated:true,bossDefeatPending:false,wavesResolved:false};
 assert.ok(s.barricadeHp>0);
 assert.equal(objectiveForBattle(d,{...s,bossDefeated:false}),d.objective);
 assert.equal(objectiveForBattle(d,s),'残存感染体を掃討');
 assert.equal(battleOutcomeFor(d,s),null);
 assert.equal(battleOutcomeFor(d,{...s,wavesResolved:true}),'won');
 assert.equal(battleOutcomeFor(d,{...s,wavesResolved:true,bossDefeatPending:true}),null);
 assert.equal(battleOutcomeFor(d,{...s,wavesResolved:true,baseHp:0}),'lost');
});

test('an exact existing bark retains identity and cannot fall back to a misleading line',()=>{
 const event={trigger:'takuya-down',speakerKind:'crawler',speakerId:'tactical',lineId:'takuya-down-02'};
 const result=queueBattleBark({runtime:createBattleBarkRuntime(),event,allowedSpeakerKinds:['ranger'],random:()=>0});
 assert.equal(result.shown,true);
 assert.equal(result.bark.lineId,'takuya-down-02');
 assert.equal(result.bark.text,'巨大反応、停止。まだ終わってない。');
 assert.equal(result.bark.speakerKind,'ranger');
 assert.equal(queueBattleBark({runtime:result.runtime,event,random:()=>0}).shown,false);
 for(const invalid of [{...event,lineId:'missing-line'},{...event,trigger:'base-exposed'}]){
  const r=queueBattleBark({runtime:createBattleBarkRuntime(),event:invalid,random:()=>0});
  assert.equal(r.shown,false);assert.equal(r.reason,'no-approved-line');
 }
 assert.equal(queueBattleBark({runtime:createBattleBarkRuntime(),event,allowedSpeakerKinds:['guide'],random:()=>0}).shown,false);
 const ordinary=queueBattleBark({runtime:createBattleBarkRuntime(),event:{trigger:'takuya-down',speakerKind:'crawler'},random:()=>0});
 assert.equal(ordinary.bark.lineId,'takuya-down-01');
});
