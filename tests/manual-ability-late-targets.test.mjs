import test from 'node:test';
import assert from 'node:assert/strict';
import {createManualAbilityRuntime,selectManualAbilityTarget,canActivateManualAbility} from '../app/manualAbilities.js';
import {ENEMY_CONTENT} from '../app/content/enemyCatalog.js';

const owner=kind=>({id:1,kind,side:'human',x:200,y:280,lane:1,hp:100,maxHp:100,combatReady:true,facing:1,manualAbility:createManualAbilityRuntime(kind)});
function enemy(id,kind,x=290,extra={}){const d=ENEMY_CONTENT.find(e=>e.id===kind);assert.ok(d);return{...d,id,kind,side:'zombie',x,y:280,lane:1,hp:d.hp,maxHp:d.hp,combatReady:true,...extra};}

test('precision abilities pick late gunmen over a healthier ordinary enemy or runner',()=>{
 for(const kind of ['ranger','babayaga'])for(const gunman of ['red-panther-smg','red-panther-commander']){
  const targets=[enemy(2,'walker',260,{hp:2000}),enemy(3,'runner',270),enemy(4,gunman,330)];
  assert.equal(selectManualAbilityTarget({owner:owner(kind),fighters:targets}).targetId,4,kind+'/'+gunman);
 }
});

test('interception and traps prefer the charging knife soldier over a slow canopy enemy',()=>{
 for(const kind of ['scout','engineer']){
  const targets=[enemy(2,'pall-manta',250),enemy(3,'red-panther-knife',340)];
  assert.equal(selectManualAbilityTarget({owner:owner(kind),fighters:targets}).targetId,3,kind);
 }
});

test('heavy late shields outrank ordinary crowds for precision fire without outranking gunmen',()=>{
 for(const kind of ['ranger','babayaga']){
  const targets=[enemy(2,'walker',250,{hp:2000}),enemy(3,'red-panther-shield',290),enemy(4,'pall-manta',310)];
  assert.equal(selectManualAbilityTarget({owner:owner(kind),fighters:targets}).targetId,3);
  targets.push(enemy(5,'red-panther-smg',350));
  assert.equal(selectManualAbilityTarget({owner:owner(kind),fighters:targets}).targetId,5);
 }
});

test('every canonical boss retains counterattack priority even without redundant boss flags',()=>{
 for(const boss of ENEMY_CONTENT.filter(e=>e.spawnClass==='boss')){
  const targets=[enemy(2,'walker',225),enemy(3,boss.id,290)];
  assert.equal(selectManualAbilityTarget({owner:owner('miyamoto-musashi'),fighters:targets}).targetId,3,boss.id);
 }
});

test('priority never bypasses target validity, reach or ability readiness',()=>{
 for(const kind of ['ranger','babayaga','scout','engineer']){
  const targets=[enemy(2,'walker',250),enemy(3,'red-panther-smg',900),enemy(4,'red-panther-knife',270,{hp:0}),enemy(5,'red-panther-commander',280,{combatReady:false}),enemy(6,'red-panther-shield',290,{targetable:false})];
  const actor=owner(kind),saved=structuredClone({actor,targets});
  assert.equal(selectManualAbilityTarget({owner:actor,fighters:targets}).targetId,2);
  assert.ok(canActivateManualAbility({fighter:actor,fighters:targets}));
  assert.deepEqual({actor,targets},saved);
  actor.manualAbility={...actor.manualAbility,phase:'cooldown',cooldownRemaining:10};
  assert.equal(canActivateManualAbility({fighter:actor,fighters:targets}),false);
 }
});
