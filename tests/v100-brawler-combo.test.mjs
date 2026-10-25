import assert from 'node:assert/strict';
import test from 'node:test';
import {MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,beginManualAbility,advanceManualAbility,manualAbilityLocksNormalAction,manualAbilityCheckpointCooldown,restoreManualAbilityCooldown} from '../app/manualAbilities.js';
import {v100BrawlerCanAct,v100BrawlerCanContact} from '../app/v100BrawlerCombo.js';
const definition=MANUAL_ABILITY_REGISTRY.brawler;
const start=()=>beginManualAbility(createManualAbilityRuntime('brawler'),{targetId:9,x:300,y:300},{sequentialBrawler:true}).runtime;
test('Paisen now releases one fist wave; partitioned or oversized steps cannot restore old timed melee hits',()=>{
 for(const steps of [[1],Array(20).fill(.05),[.259,.001,.095,.095,.095,.095,.14,.22]]){
  let runtime=start();const events=[];
  for(const step of steps){const result=advanceManualAbility(runtime,step);events.push(...result.events);runtime=result.runtime;}
  assert.deepEqual(events.map(e=>e.type),['fist-wave-release']);
  assert.equal(events[0].salvoIndex,undefined);
  assert.equal(events.length*definition.impactDamage,280);
  assert.equal(runtime.phase,'cooldown');assert.deepEqual(advanceManualAbility(runtime,.1).events,[]);
 }
 const waiting=advanceManualAbility(start(),.2);assert.equal(waiting.events.length,0);
 const first=advanceManualAbility(waiting.runtime,.06);assert.equal(first.events.length,1);assert.equal(first.runtime.phase,'recovery');
 assert.equal(manualAbilityLocksNormalAction(first.runtime),true);
 const retract=advanceManualAbility(first.runtime,.06);assert.equal(retract.events.length,0);
 assert.equal(advanceManualAbility(retract.runtime,0).events.length,0);
 assert.equal(advanceManualAbility({...retract.runtime,phase:'retreat'},10).events.length,0);
});
test('saving during fist-wave recovery preserves outstanding action/cooldown debt without replaying release',()=>{
 const runtime=advanceManualAbility(start(),.4).runtime;
 const debt=manualAbilityCheckpointCooldown(runtime);
 assert.equal(debt,12.38);
 const restored=restoreManualAbilityCooldown('brawler',debt);
 assert.equal(restored.phase,'cooldown');assert.equal(advanceManualAbility(restored,.1).events.length,0);
 assert.equal(advanceManualAbility(runtime,100).runtime.phase,'ready');
});
test('legacy campaign uses the same fist-wave release contract, with no old melee damage event',()=>{
 const legacy=beginManualAbility(createManualAbilityRuntime('brawler'),{targetId:9,x:300,y:300}).runtime;
 const step=advanceManualAbility(legacy,definition.windupSeconds);
 assert.equal(step.events.length,1);assert.equal(step.events[0].salvoIndex,undefined);assert.equal(step.runtime.phase,'recovery');
 assert.equal(step.events[0].type,'fist-wave-release');
});
test('ordinary physical melee contact eligibility stays separate from the fist-wave projectile',()=>{
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
