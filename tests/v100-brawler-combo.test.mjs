import assert from 'node:assert/strict';
import test from 'node:test';
import {MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,beginManualAbility,advanceManualAbility,manualAbilityLocksNormalAction,manualAbilityCheckpointCooldown,restoreManualAbilityCooldown} from '../app/manualAbilities.js';
import {v100BrawlerComboTiming,v100BrawlerComboPose,v100BrawlerCanAct,v100BrawlerCanContact} from '../app/v100BrawlerCombo.js';
const definition=MANUAL_ABILITY_REGISTRY.brawler;
const start=()=>beginManualAbility(createManualAbilityRuntime('brawler'),{targetId:9,x:300,y:300},{sequentialBrawler:true}).runtime;
test('V1 Paisen applies five spaced contacts, then recovers; a large step cannot drop or duplicate a hit',()=>{
 const timing=v100BrawlerComboTiming(definition);
 for(const steps of [[1],Array(20).fill(.05),[.259,.001,.095,.095,.095,.095,.14,.22]]){
  let runtime=start();const events=[];
  for(const step of steps){const result=advanceManualAbility(runtime,step);events.push(...result.events);runtime=result.runtime;}
  assert.deepEqual(events.map(e=>e.salvoIndex),[0,1,2,3,4]);
  assert.deepEqual(events.map(e=>e.timelineAt),timing.contacts);
  assert.deepEqual(events.map(e=>e.finalRound),[false,false,false,false,true]);
  assert.equal(events.length*definition.impactDamage,280);
  assert.equal(runtime.phase,'cooldown');assert.deepEqual(advanceManualAbility(runtime,.1).events,[]);
 }
 const waiting=advanceManualAbility(start(),.2);assert.equal(waiting.events.length,0);
 const first=advanceManualAbility(waiting.runtime,.06);assert.equal(first.events.length,1);assert.equal(first.runtime.phase,'salvo');
 assert.equal(manualAbilityLocksNormalAction(first.runtime),true);
 assert.equal(v100BrawlerComboPose(first.runtime,definition),'attack-b');
 const retract=advanceManualAbility(first.runtime,.06);assert.equal(v100BrawlerComboPose(retract.runtime,definition),'attack-a');
 assert.equal(advanceManualAbility(retract.runtime,0).events.length,0);
 assert.equal(advanceManualAbility({...retract.runtime,phase:'retreat'},10).events.length,0);
});
test('saving during a combo preserves the outstanding action/cooldown debt without replaying contacts',()=>{
 const runtime=advanceManualAbility(start(),.4).runtime;
 const debt=manualAbilityCheckpointCooldown(runtime);
 assert.equal(debt,12.38);
 const restored=restoreManualAbilityCooldown('brawler',debt);
 assert.equal(restored.phase,'cooldown');assert.equal(advanceManualAbility(restored,.1).events.length,0);
 assert.equal(advanceManualAbility(runtime,100).runtime.phase,'ready');
});
test('legacy abilities keep their existing single-impact contract',()=>{
 const legacy=beginManualAbility(createManualAbilityRuntime('brawler'),{targetId:9,x:300,y:300}).runtime;
 const step=advanceManualAbility(legacy,definition.windupSeconds);
 assert.equal(step.events.length,1);assert.equal(step.events[0].salvoIndex,undefined);assert.equal(step.runtime.phase,'recovery');
});
test('stun, containment, knockback, another lane, and a lost target stop physical combo contacts',()=>{
 const owner={side:'human',hp:100,combatReady:true,x:300,y:300,stunned:0,manualAbility:start()},target={side:'zombie',hp:300,combatReady:true,x:338,y:300,bodyRadius:14};
 assert.equal(v100BrawlerCanAct(owner),true);assert.equal(v100BrawlerCanContact(owner,target),true);
 for(const change of [{stunned:.22},{contained:true},{hp:0},{combatReady:false}]){
  assert.equal(v100BrawlerCanAct({...owner,...change}),false);assert.equal(v100BrawlerCanContact({...owner,...change},target),false);
 }
 // Cagewalker's real24px push moves this38px contact to62px: no remote punch.
 assert.equal(v100BrawlerCanContact({...owner,x:276},target),false);
 assert.equal(v100BrawlerCanContact(owner,{...target,y:360}),false);
 for(const change of [{hp:0},{contained:true},{targetable:false},{x:280}])assert.equal(v100BrawlerCanContact(owner,{...target,...change}),false);
 const active=advanceManualAbility(start(),.4).runtime;
 const interrupted=restoreManualAbilityCooldown('brawler',manualAbilityCheckpointCooldown(active));
 assert.equal(interrupted.cooldownRemaining,12.38);assert.equal(advanceManualAbility(interrupted,.3).events.length,0);
});
