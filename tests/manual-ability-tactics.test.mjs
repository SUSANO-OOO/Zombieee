import test from 'node:test';
import assert from 'node:assert/strict';
import {MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,selectManualAbilityTarget,canActivateManualAbility} from '../app/manualAbilities.js';
import {MANUAL_ABILITY_TACTICS,manualAbilityTacticalView} from '../app/manualAbilityTactics.js';
const actor=kind=>({id:1,kind,side:'human',hp:40,maxHp:80,x:300,y:280,lane:1,combatReady:true,stunned:0,manualAbility:createManualAbilityRuntime(kind)});
const enemy=(id,kind,x=380)=>({id,kind,side:'zombie',hp:180,maxHp:180,x,y:280,lane:1,combatReady:true,speed:20});

test('all16 tactical entries use the production selection without changing battle or runtime',()=>{
 assert.deepEqual(Object.keys(MANUAL_ABILITY_TACTICS).sort(),Object.keys(MANUAL_ABILITY_REGISTRY).sort());
 for(const kind of Object.keys(MANUAL_ABILITY_REGISTRY)){
  const owner=actor(kind),fighters=[owner,enemy(2,'walker',360),enemy(3,'spitter',400)],original=structuredClone({owner,fighters});
  const view=manualAbilityTacticalView({owner,fighters}),target=selectManualAbilityTarget({owner,fighters});
  assert.ok(view.tactic&&view.summary&&view.name&&view.abilityName,kind);assert.equal(view.available,canActivateManualAbility({fighter:owner,fighters}));
  assert.ok(view.available,kind);assert.equal(view.status,'再開後に使える');assert.ok(view.targetLabel,kind);
  assert.equal(view.targetId,target.targetId??target.points?.[0]?.targetId??null);assert.deepEqual({owner,fighters},original,kind);
 }
});
test('blocked and ongoing abilities never advertise a ready target',()=>{
 const owner=actor('babayaga'),foe=enemy(2,'red-panther-smg');
 for(const [patch,status] of [[{hp:0},'戦闘不能'],[{contained:true},'捕らわれている'],[{gateEntering:true},'戦場へ移動中'],[{combatReady:false},'戦場へ移動中'],[{stunned:1.4},'ひるみ中'],[{manualAbility:{...owner.manualAbility,phase:'cooldown',cooldownRemaining:17.2}},'あと18秒'],[{manualAbility:{...owner.manualAbility,phase:'windup',windupRemaining:.2}},'発動中']]){
  const current={...owner,...patch};const view=manualAbilityTacticalView({owner:current,fighters:[current,foe]});assert.equal(view.status,status);assert.equal(view.available,false);assert.equal(view.targetLabel,null);
 }
});
test('the current injured ally is named and healthy allies are not offered treatment',()=>{
 const owner=actor('medic');let view=manualAbilityTacticalView({owner,fighters:[owner]});assert.equal(view.targetLabel,'手当て：自分');
 const injured={...actor('scout'),id:2,hp:8};view=manualAbilityTacticalView({owner,fighters:[owner,injured]});assert.equal(view.targetLabel,'手当て：ハチ');
 owner.hp=owner.maxHp;view=manualAbilityTacticalView({owner,fighters:[owner]});assert.equal(view.status,'近くに負傷者がいない');assert.equal(view.targetLabel,null);
});
test('current ranged threat and out-of-range target use the actual selection',()=>{
 const owner=actor('babayaga'),runner=enemy(2,'runner'),smg=enemy(3,'red-panther-smg',450);
 const view=manualAbilityTacticalView({owner,fighters:[owner,runner,smg]});assert.equal(view.targetId,3);assert.match(view.targetLabel,/射撃|銃|SMG/);
 const empty=manualAbilityTacticalView({owner,fighters:[owner,{...smg,x:1500}]});assert.equal(empty.status,'届く相手を待っている');assert.equal(empty.targetLabel,null);
});
test('inspection distinguishes group targets, defense and structure without fictitious foes',()=>{
 const owner=actor('tky'),fighters=[owner,enemy(2,'walker',360),enemy(3,'runner',390)];assert.match(manualAbilityTacticalView({owner,fighters}).targetLabel,/2体/);
 const guardian=actor('guardian');assert.equal(manualAbilityTacticalView({owner:guardian,fighters:[guardian,...fighters.slice(1)]}).targetLabel,'自分と近くの仲間を守る');
 const brute=actor('brute'),base={...enemy('manual-structure:enemy-base','infected-base',350)};assert.match(manualAbilityTacticalView({owner:brute,fighters:[brute,base]}).targetLabel,/敵拠点/);
 assert.equal(manualAbilityTacticalView({owner:enemy(9,'walker'),fighters:[]}),null);assert.equal(manualAbilityTacticalView(),null);
});

test('support targeting blocks the ready promise until the player cancels targeting',()=>{
 const owner=actor('babayaga'),fighters=[owner,enemy(2,'red-panther-smg')],original=structuredClone({owner,fighters});
 const blocked=manualAbilityTacticalView({owner,fighters,actionSelected:true});assert.equal(blocked.available,false);assert.equal(blocked.targetLabel,null);assert.equal(blocked.status,'先に支援の狙いを取り消す');
 const ready=manualAbilityTacticalView({owner,fighters,actionSelected:false});assert.equal(ready.available,true);assert.equal(ready.targetId,2);assert.deepEqual({owner,fighters},original);
});
