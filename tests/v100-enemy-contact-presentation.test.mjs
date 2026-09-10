import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {ENEMY_NORMAL_ATTACK_SECONDS} from '../app/enemyVfxPresentation.js';
import {V100_CONTACT_ENEMY_KINDS,v100EnemyContactPose,v100EnemyContactSize} from '../app/v100EnemyContactPresentation.js';
import {spriteFrameFor,spriteBattleDisplaySizeFor,SPRITE_STATES} from '../app/spriteManifest.js';

test('normal enemy contact starts at the real damage timer and survives the former skipped frame interval',()=>{
 assert.equal(ENEMY_NORMAL_ATTACK_SECONDS,.18,'Preserve the gameplay timer');
 for(const kind of V100_CONTACT_ENEMY_KINDS){
  const before={attack:0,attackWindup:.22,flash:0,abilityPhase:'idle'},saved={...before};
  assert.equal(v100EnemyContactPose(kind,before).spriteState,'attack-a');assert.deepEqual(before,saved);
  for(const elapsed of [0,1/60,2/60,3/60,4/60,5/60,6/60])assert.equal(v100EnemyContactPose(kind,{attack:ENEMY_NORMAL_ATTACK_SECONDS-elapsed}).spriteState,'attack-b');
  assert.equal(v100EnemyContactPose(kind,{attack:.045}).spriteState,'walk-a');
  assert.equal(v100EnemyContactPose(kind,{attack:.015}).spriteState,'idle');
  assert.equal(v100EnemyContactPose(kind,{attack:0}),null);
  assert.equal(v100EnemyContactPose(kind,{attack:.15,flash:.03}),null,'Real hit reactions retain priority');
  assert.equal(v100EnemyContactPose(kind,{attack:.15,abilityPhase:'windup'}),null,'Do not replace station abilities');
 }
 assert.equal(v100EnemyContactPose('red-panther-knife',{attack:.15}),null);
 assert.equal(v100EnemyContactPose('walker',{attack:NaN}),null);
});

test('enemy cell scale keeps raised arms and crouches at their authored body proportions',()=>{
 for(const kind of V100_CONTACT_ENEMY_KINDS)for(const direction of ['left','right']){
  const maximum=spriteBattleDisplaySizeFor(kind),idle=spriteFrameFor(kind,'idle',direction),reference=v100EnemyContactSize(kind,idle,direction,maximum);
  for(const pose of SPRITE_STATES){const frame=spriteFrameFor(kind,pose,direction);assert.deepEqual(v100EnemyContactSize(kind,frame,direction,maximum),reference);}
 }
 assert.throws(()=>v100EnemyContactSize('grappler',spriteFrameFor('guardian','idle','left'),'left',{w:60,h:100}),/Recalibrate/);
});

test('enemy contact sampling and all normal target timers share one unchanged duration',async()=>{
 const source=await readFile(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
 assert.equal((source.match(/f\.attack = ENEMY_NORMAL_ATTACK_SECONDS;/g)||[]).length,2,'Fighter and objective attacks');
 assert.match(source,/f\.attack = f\.side === "human" \? attackPresentationDuration\(f\.kind\) : ENEMY_NORMAL_ATTACK_SECONDS;/,'Crawler attacks');
 assert.match(source,/options\.v100AuthoredPresentation && f\.side === 'zombie'\s*\? v100EnemyContactPose/,'V1 rendering only');
 assert.match(source,/snapshot\.phase === "warning" && !authoredMeleeWarning/,'Authored body replaces the normal melee warning ribbons');
});
