import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {bindV100BattleCardPanGuard} from '../app/v100BattleCardPanGuard.js';
import {restorePreBattleCardPanSource} from './helpers/guard-spectacle-source.mjs';
class Pane extends EventTarget{scrollLeft=0;scrollWidth=800;clientWidth=300;phone=true;closest(){return this.phone?{}:null;}}
function touch(pane,type,x=100,y=100,count=1){const e=new Event(type,{cancelable:true});Object.defineProperty(e,'touches',{value:Array.from({length:count},()=>({clientX:x,clientY:y}))});pane.dispatchEvent(e);return e;}
test('outward edge gestures are consumed while inward finger pans remain native',()=>{
 for(const [position,endX,prevented]of [[0,140,true],[0,60,false],[500,60,true],[500,140,false]]){const p=new Pane();p.scrollLeft=position;const close=bindV100BattleCardPanGuard(p);assert.equal(touch(p,'touchstart').defaultPrevented,false);assert.equal(touch(p,'touchmove',endX).defaultPrevented,prevented);close();}
 const p=new Pane();p.scrollWidth=p.clientWidth;const close=bindV100BattleCardPanGuard(p);touch(p,'touchstart');assert(touch(p,'touchmove',140).defaultPrevented);close();
});
test('tap jitter, vertical motion and multitouch do not become blocked horizontal gestures',()=>{
 const p=new Pane(),close=bindV100BattleCardPanGuard(p);touch(p,'touchstart');assert.equal(touch(p,'touchmove',104).defaultPrevented,false);assert.equal(touch(p,'touchmove',130,150).defaultPrevented,false);assert.equal(touch(p,'touchmove',150,100,2).defaultPrevented,false);assert.equal(touch(p,'touchmove',150).defaultPrevented,false,'multitouch retires the old single-finger start');close();
});
test('a pan that starts inside the strip stays native as it reaches an edge',()=>{
 const p=new Pane();p.scrollLeft=200;const close=bindV100BattleCardPanGuard(p);touch(p,'touchstart');p.scrollLeft=0;assert.equal(touch(p,'touchmove',160).defaultPrevented,false);touch(p,'touchend',160,100,0);assert.equal(touch(p,'touchmove',180).defaultPrevented,false);close();
});
test('scope and callback cleanup preserve other screens and remove all gesture interception',()=>{
 const p=new Pane(),close=bindV100BattleCardPanGuard(p);p.phone=false;touch(p,'touchstart');assert.equal(touch(p,'touchmove',150).defaultPrevented,false);p.phone=true;touch(p,'touchstart');assert(touch(p,'touchmove',150).defaultPrevented);touch(p,'touchcancel',150,100,0);assert.equal(touch(p,'touchmove',170).defaultPrevented,false);close();close();touch(p,'touchstart');assert.equal(touch(p,'touchmove',150).defaultPrevented,false);assert.equal(bindV100BattleCardPanGuard(null),undefined);
});
test('declared ref and leaf import alone restore the complete accepted application source',()=>{
 const file='app/AshfallGame.tsx',source=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),base=execFileSync('git',['show','bdd4ffa8d6ff082f8d86a857d7c0833165a57574:'+file],{maxBuffer:4e6}).toString().replaceAll('\r\n','\n');assert.equal(restorePreBattleCardPanSource(file,source),base);
 assert.throws(()=>restorePreBattleCardPanSource(file,source.replace('aria-label="生存者ユニット"','aria-label="別の欄"')),/battle card pan edit must occur exactly once/);
 assert.throws(()=>restorePreBattleCardPanSource(file,source.replace('ref={bindV100BattleCardPanGuard}','ref={undefined}')),/battle card pan edit must occur exactly once/);
 assert.throws(()=>restorePreBattleCardPanSource(file,source.replace('playUiOperationCue(open ? \"selection\" : \"back\"','playUiOperationCue(open ? \"confirm\" : \"back\"')),/manual tactics UI edit must occur exactly once/);
 assert.throws(()=>restorePreBattleCardPanSource(file,source.replace('campaignPortraits={externalSessionActive}','campaignPortraits={true}')),/manual tactics UI edit must occur exactly once/);
 const declaredGun=JSON.parse(fs.readFileSync('tests/fixtures/gun-finish-source-changes.json','utf8'))[file][0][1];
 assert(source.includes(declaredGun));
 assert.throws(()=>restorePreBattleCardPanSource(file,source.replace(declaredGun,declaredGun.replace('PwaGunFinishPathsContext','PwaGunFinishPathsContextUnexpected'))),/gun source edit must occur exactly once/);
 for (const [before, after] of [
  ["background={backgroundCacheRef.current[activeBattlefieldVisualId]}", "background={null}"],
  ["precisionEnd: lastHit", "precisionEnd: firstHit"],
  ["playEnemyContactCue(g, reactionTarget, reactionDamage)", "playEnemyContactCue(g, reactionTarget, 0)"],
 ]) {
  assert.ok(source.includes(before));
  assert.throws(() => restorePreBattleCardPanSource(file, source.replace(before, after)), /phone battle edit must occur exactly once/);
 }
 assert.notEqual(restorePreBattleCardPanSource(file,source.replace('"use client";','"changed runtime contract";')),base,'an unrelated source edit must not be hidden by declared UI/audio restoration');
});
