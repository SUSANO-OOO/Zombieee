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

test('the archived R5 source stays intact with all 767 historical entries',async()=>{
 const source=await readFile('docs/story/v10/STORY_SCRIPT_V100_PRODUCER_R5.md');
 assert.equal(digest(source),'c324ba3783074ecabe80716d971c35d73028a7f98f2a8069760153b1c8b17cd6');
 const entries=[...source.toString('utf8').matchAll(/\[S-[^\]\r\n]+\]/gu)];
 assert.equal(entries.length,767);assert.equal(new Set(entries.map(entry=>entry[0])).size,767);
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

const at=line=>{
 for(const event of Object.values(V100_STORY_EVENTS)) {
  const index=event.nodes.findIndex(node=>node.sourceLine===line);
  if(index>=0)return {id:event.id,index,node:event.nodes[index]};
 }
 throw Error('Missing R9 source line '+line);
};
const view=line=>{const {id,index,node}=at(line);return v100StoryDirectionFor(id,index,node);};

test('legacy epilogue resumes R9 ending once, retaining the durable checkpoint',()=>{
 const state=createV100StoryFlowState({playerName:'テスト',completedStageIds:V100_STAGE_IDS,
  readStoryEventIds:['v100:event:ending','v100:event:credits'],
  flowState:{phase:'epilogue',eventId:'v100:event:epilogue',nodeIndex:27},
  eventCursor:{eventId:'v100:event:epilogue',nodeIndex:27}});
 assert.equal(state.phase,'ending');assert.equal(state.eventId,'v100:event:ending');assert.equal(state.nodeIndex,0);
 assert.deepEqual(state.completedStageIds,V100_STAGE_IDS);
 const checkpoint=v100StoryFlowCheckpoint(state,12);
 const reopened=createV100StoryFlowState({playerName:'テスト',...checkpoint});
 assert.equal(reopened.eventId,'v100:event:ending');assert.equal(reopened.nodeIndex,12);
});

test('R9 cuts and close-ups remain bound to their physical cause and source line',()=>{
 assert.equal(view(87).cut,null,'R5 frying-pan image contradicts the new extinguisher action');
 assert.equal(view(449).cut,'s03-cold-retrieval');assert.equal(view(453).cut,'s03-cold-retrieval');
 assert.equal(view(1895).cut,'chiha-confession');assert.equal(view(1909).cut,null,'Chiha has reclaimed her card');
 assert.equal(view(2022).cut,'president-restrained-alive');assert.equal(view(2030).cut,null);
 assert.equal(view(2181).cut,'s28-physical-stop');assert.equal(view(2188).insertId,'domestic-stopped');
 assert.equal(view(602).insertId,'message-backlog');assert.equal(view(1608).insertId,'bridge-crossing');
 assert.equal(view(2320).cut,'s30-three-samples');assert.equal(view(2320).insertId,null);assert.equal(view(2415).cueId,'v100-r9-plate-stack');
 assert.equal(V100_MAIN_CAST.length,7);assert.ok(!V100_MAIN_CAST.includes('unit-hachi'));
});

test('R9 grief does not make the recovery force cry and family/homecoming reactions follow the new scene',()=>{
 const expression=(line,owner)=>{const {id,index,node}=at(line);return v100StoryExpressionFor(id,index,node,owner);};
 assert.equal(expression(421,'unit-kumaverson'),'grief');
 assert.equal(expression(451,'red-panther-commander'),'determined');
 assert.equal(expression(1844,'unit-zakimiya'),'warm');
 assert.equal(expression(1895,'unit-babayaga'),'grief');
 assert.equal(expression(1923,'unit-mrs-chiha'),'determined');
 assert.equal(expression(2385,'unit-babayaga'),'determined','R9 does not promise immediate forgiveness');
 assert.equal(expression(2415,'unit-paisen'),'warm');
});
