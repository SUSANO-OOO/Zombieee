import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {v100TwinAttackName,bossDefinitionForEnemyKind,bossTelegraphSnapshot} from '../app/bossFoundation.js';
import {v105EnemyAbilityName} from '../app/v105AbilityNames.js';
import {restorePreTwinWordingSource} from './helpers/guard-spectacle-source.mjs';
const twin=(part='a',enraged=false)=>({id:part==='a'?1:2,kind:'futago',side:'zombie',v100BossId:'boss-futago',v100TwinPart:part,v100TwinEnraged:enraged,x:610,y:180,hp:3000,maxHp:3000,stationAbility:{kind:'futago',phase:'warning',remainingSeconds:.9,targetX:570,targetY:180}});
test('both registered twin bodies show one consistent skill name in the body tag and warning hint',()=>{
 for(const part of ['a','b'])for(const enraged of [false,true]){
  const actor=twin(part,enraged),before=JSON.stringify(actor),expected=enraged?'激昂斬撃':'双体交差撃';
  assert.equal(v100TwinAttackName(actor),expected);
  assert.equal(v105EnemyAbilityName('futago',{boss:bossDefinitionForEnemyKind('futago'),owner:actor}),expected);
  const hint=bossTelegraphSnapshot(actor);assert.equal(hint.displayName,expected);
  assert.equal(hint.remainingSeconds,.9);assert.equal(hint.targetX,570);assert.equal(hint.targetY,180);
  assert.match(hint.counterplay,/片側.*激昂/);assert.equal(JSON.stringify(actor),before);
 }
});
test('cutting the control changes both the ability name and warning without overriding rage',()=>{
 const actor=twin();
 assert.equal(v100TwinAttackName(actor,true),'単体斬撃');
 assert.equal(v105EnemyAbilityName('futago',{owner:actor,twinLinkCut:true}),'単体斬撃');
 assert.equal(bossTelegraphSnapshot(actor,{twinLinkCut:true}).displayName,'単体斬撃');
 assert.equal(v100TwinAttackName(twin('b',true),true),'激昂斬撃');
});
test('legacy fused and unrelated owners do not acquire the registered pair name',()=>{
 for(const bad of [{...twin(),v100BossId:undefined},{...twin(),v100TwinPart:undefined},{...twin(),v100BossId:'boss-takuya'},{...twin(),kind:'takuya'},{...twin(),side:'human'}]){
  assert.equal(v100TwinAttackName(bad),null);
  assert.equal(v105EnemyAbilityName('futago',{boss:bossDefinitionForEnemyKind('futago'),owner:bad}),'融合交差撃');
 }
 assert.equal(v105EnemyAbilityName('futago',{boss:bossDefinitionForEnemyKind('futago')}),'融合交差撃');
});
test('declared twin presentation edits reverse to the entire prior app, definition and name modules',()=>{
 for(const file of ['app/AshfallGame.tsx','app/bossFoundation.js','app/v105AbilityNames.js']){
  const source=fs.readFileSync(file,'utf8'),before=execFileSync('git',['show','329fa37d1af807b467753ffb44fb8c5ac7e68309:'+file],{maxBuffer:4e6}).toString('utf8').replaceAll('\r\n','\n');
  assert.equal(restorePreTwinWordingSource(file,source)===before,true,file+' has undeclared non-presentation changes');
 }
});
