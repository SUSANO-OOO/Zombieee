import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryFlowCheckpoint,createV100StoryFlowState} from '../app/v100StoryFlow.js';
import {v100StoryDirectionFor,v100StoryExpressionFor,V100_MAIN_CAST} from '../app/v100StoryDirection.js';
import {v100BasePresentationFor,V100_RETREAT_DOOR_ART} from '../app/v100BasePresentation.js';
import {requiredBattleAssetPlan,BATTLE_CRAWLER_ASSET_PATHS} from '../app/battleAssetPlan.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('all 767 Producer R5 lines and speakers survive in order with their stable event positions',async()=>{
 const source=await readFile('docs/story/v10/STORY_SCRIPT_V100_PRODUCER_R5.md');
 assert.equal(digest(source),'c324ba3783074ecabe80716d971c35d73028a7f98f2a8069760153b1c8b17cd6');
 const raw=source.toString('utf8');
 const entries=[...raw.matchAll(/^\*\*(.+?)\*\*[ \t　]+\[(S-[^\]\r\n]+)\][ \t]*\r?\n([\s\S]*?)(?=^\*\*.+?\*\*[ \t　]+\[S-|^## |$(?![\s\S]))/gmu)];
 assert.equal(entries.length,767);
 assert.equal(new Set(entries.map(entry=>entry[2])).size,767);
 const nodes=Object.values(V100_STORY_EVENTS).flatMap(event=>event.nodes.map((node,index)=>({eventId:event.id,index,node})));
 assert.equal(nodes.length,767);
 assert.equal(Object.keys(V100_STORY_EVENTS).length,94);
 for(const [index,entry] of entries.entries()) {
  const current=nodes[index],body=entry[3].trim(),speaker=entry[1];
  assert.equal(current.node.text,body,entry[2]);
  assert.equal(current.node.speaker??'', ['ト書き','表示'].includes(speaker)?'':speaker,entry[2]+' speaker');
  const eventToken=entry[2].replace(/^S-/u,'').replace(/-\d{3}$/u,'');
  const expected=eventToken.replace(/^(s\d{2})-(pre|post)$/u,'$1:$2');
  assert.equal(current.eventId,'v100:event:'+expected,entry[2]+' event');
  assert.equal(current.index,Number(entry[2].match(/(\d{3})$/u)[1])-1,entry[2]+' cursor');
 }
});

test('R5 leaves the car at hospital for S5/S6 and restores it at S7 without changing legacy plans',()=>{
 for(const number of [5,6]){
  const view=v100BasePresentationFor(number);assert.equal(view.onFoot,true);assert.equal(view.healthLabel,'退路耐久');assert.equal(view.barrageLabel,'援護射撃');
  const plan=requiredBattleAssetPlan({stageId:V100_STAGE_IDS[number-1],basePresentationStageNumber:number});
  assert.ok(plan.persistent.some(a=>a.key==='retreatDoor'&&a.path===V100_RETREAT_DOOR_ART));
  assert.ok(!plan.persistent.some(a=>Object.values(BATTLE_CRAWLER_ASSET_PATHS).includes(a.path)));
  const legacy=requiredBattleAssetPlan({stageId:V100_STAGE_IDS[number-1]});assert.ok(legacy.persistent.some(a=>a.key==='crawlerHostClosed'));
 }
 assert.equal(v100BasePresentationFor(7).onFoot,false);
});

test('epilogue film checkpoint survives reopen without marking dialogue or granting rewards',()=>{
 const id='v100:event:epilogue',count=V100_STORY_EVENTS[id].nodes.length;
 assert.equal(count,27);
 const state=createV100StoryFlowState({playerName:'テスト',flowState:{phase:'epilogue',eventId:id},eventCursor:{eventId:id,nodeIndex:count}});
 const checkpoint=v100StoryFlowCheckpoint(state,count);
 assert.equal(checkpoint.eventCursor.eventId,id);
 assert.equal(checkpoint.eventCursor.nodeIndex,count);
 const reopened=createV100StoryFlowState({playerName:'テスト',...checkpoint});
 assert.equal(reopened.phase,'epilogue');assert.equal(reopened.nodeIndex,count);
});

test('R5 cuts preserve causal order and new main-cast staging',()=>{
 const view=(id,index)=>v100StoryDirectionFor(id,index,V100_STORY_EVENTS[id].nodes[index]);
 assert.equal(view('v100:event:prologue',20).cut,'prologue-door-crisis');
 assert.equal(view('v100:event:prologue',27).cut,null,'inside attack cannot retain outside-door drawing');
 assert.equal(view('v100:event:s23:pre',9).cut,null,'card has not yet been picked up');
 assert.equal(view('v100:event:s23:pre',10).cut,'chiha-confession');
 for (let index=0;index<=3;index++) assert.equal(view('v100:event:s25:post',index).cut,'president-restrained-alive');
 assert.equal(view('v100:event:s25:post',4).cut,null);
 assert.equal(v100StoryExpressionFor('v100:event:s06:post',2,V100_STORY_EVENTS['v100:event:s06:post'].nodes[2],'unit-raider'),'determined');
 assert.equal(view('v100:event:ending',0).cut,'ending-tky-transport');
 assert.equal(view('v100:event:epilogue',23).cut,'epilogue-tky-receipt');
 assert.equal(view('v100:event:epilogue',25).cut,'epilogue-main-table');
 assert.equal(view('v100:event:epilogue',26).cut,null);
 assert.equal(view('v100:event:prologue',34).cueId,'v100-story-glass');
 assert.equal(view('v100:event:ending',19).cueId,'v100-story-latch');
 assert.equal(v100StoryExpressionFor('v100:event:s23:pre',11,V100_STORY_EVENTS['v100:event:s23:pre'].nodes[11]),'grief');
 assert.equal(V100_MAIN_CAST.length,7);assert.ok(!V100_MAIN_CAST.includes('unit-hachi'));
});
