import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,deserializeV100Save,applyV100SaveMutation} from '../app/v100Save.js';
import {V100_STAGE_IDS,v100StageReward} from '../app/v100Registry.js';
import {V100_STORY_SCRIPT_VERSION,v100StoryEventIdsForStage} from '../app/v100StoryEvents.js';
import {createV100StoryFlowState,collectV100ReadReplayFlow,enterV100PostResult,completeV100Event,v100StoryFlowCheckpoint} from '../app/v100StoryFlow.js';
import {createV100BattleResult,recordV100PendingResult,finalizeV100PendingResult,collectV100ReadReplayReward} from '../app/v100Transactions.js';

const now=Date.UTC(2026,10,1),result=(number,id,hp=680)=>createV100BattleResult({stageId:V100_STAGE_IDS[number-1],battleRunId:id,won:true,objectiveComplete:true,bossDefeated:true,vehicleHp:hp,vehicleMaxHp:680});
function replay(number,{firstHp=680,replayHp=680}={}){
 let save=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:'西新',availableStageIds:V100_STAGE_IDS});
 const first=recordV100PendingResult(save,result(number,'first-'+number,firstHp));assert.equal(first.applied,true);
 const paid=finalizeV100PendingResult(first.save,{now});assert.equal(paid.applied,true);save=paid.save;
 const value=result(number,'repeat-'+number,replayHp),pending=recordV100PendingResult(save,value);assert.equal(pending.applied,true);
 const ids=v100StoryEventIdsForStage(number).filter(id=>!id.endsWith(':pre'));
 save=normalizeV100Save({...pending.save,readStoryEventIds:[...new Set([...pending.save.readStoryEventIds,...ids])],readStoryVersions:Object.fromEntries(ids.map(id=>[id,V100_STORY_SCRIPT_VERSION])),flowState:{phase:'result',stageId:value.stageId,stageNumber:number,eventId:null,nodeIndex:0,firstClear:false,finalized:false,scriptVersion:V100_STORY_SCRIPT_VERSION},eventCursor:null});
 return{save,value,ids};
}
function checkpoint(save,flow){const written=applyV100SaveMutation(save,draft=>({...draft,...v100StoryFlowCheckpoint(flow)}),{now});assert.equal(written.applied,true);return written.save;}
const stable=save=>Object.fromEntries(Object.entries(save).filter(([key])=>!['revision','updatedAt'].includes(key)));
function rejected(save,value){const before=serializeV100Save(save),r=collectV100ReadReplayReward(save,value,{now});assert.equal(r.applied,false);assert.equal(serializeV100Save(r.save),before);assert.equal(serializeV100Save(save),before);}

for(let number=1;number<=30;number++)test(`S${number}: explicit collection matches ordinary post/confirmation settlement and pays once`,()=>{
 const {save,value}=replay(number),before=serializeV100Save(save),flow=createV100StoryFlowState(save);
 const post=enterV100PostResult(flow);assert.equal(post.accepted,true);
 const confirmation=completeV100Event(post.state,{skipped:true});assert.equal(confirmation.accepted,true);
 const normalEnd=completeV100Event(confirmation.state);assert.equal(normalEnd.accepted,true);
 const normalPay=finalizeV100PendingResult(save,{result:value,now});assert.equal(normalPay.applied,true);
 const collected=collectV100ReadReplayReward(save,value,{now});assert.equal(collected.applied,true);
 const expected=checkpoint(normalPay.save,normalEnd.state),actual=checkpoint(collected.save,collected.flow);
 assert.deepEqual(stable(actual),stable(expected));assert.equal(actual.caps-save.caps,v100StageReward(number,'replay'));
 assert.equal(collected.flow.phase,'map');assert.equal(collected.flow.finalized,true);assert.equal(collected.flow.firstClear,false);assert.equal(actual.pendingResult,null);
 assert.equal(actual.receipts.filter(id=>id===`v100:s${String(number).padStart(2,'0')}:replay:${value.battleRunId}`).length,1);
 const restored=deserializeV100Save(serializeV100Save(actual));assert.equal(restored.ok,true);assert.equal(createV100StoryFlowState(restored.save).phase,'map');rejected(restored.save,value);
 assert.equal(serializeV100Save(save),before);
});

test('a replay can improve its star record, with each new star bonus applied once',()=>{
 const {save,value}=replay(1,{firstHp:400,replayHp:680}),r=collectV100ReadReplayReward(save,value,{now});assert.equal(r.applied,true);
 assert.equal(r.save.caps-save.caps,v100StageReward(1,'replay')+v100StageReward(1,'star:2')+v100StageReward(1,'star:3'));assert.equal(r.save.bestStars[value.stageId],3);
 rejected(checkpoint(r.save,r.flow),value);
});
for(const number of [1,3,30])for(const eventIndex of [0,1])for(const kind of ['unread','old-version','missing-version'])test(`S${number}: ${kind} post event ${eventIndex} remains on the ordinary story route`,()=>{
 const {save,value,ids}=replay(number),id=ids[eventIndex];
 if(kind==='unread')save.readStoryEventIds=save.readStoryEventIds.filter(x=>x!==id);
 else if(kind==='old-version')save.readStoryVersions[id]='older-script';else delete save.readStoryVersions[id];
 assert.equal(collectV100ReadReplayFlow(createV100StoryFlowState(save)).accepted,false);rejected(save,value);
});
test('first clear, including the finale, cannot collect past its unread first-clear story',()=>{
 for(const number of [1,30]){const {save,value}=replay(number);save.completedStageIds=save.completedStageIds.filter(id=>id!==value.stageId);save.flowState.firstClear=true;rejected(normalizeV100Save(save),value);}
});
test('the UI result must match the durable pending result; missing, other-stage and other-run inputs cannot collect',()=>{
 const {save,value}=replay(1);for(const bad of [null,result(2,'other-stage'),{...value,battleRunId:'other-run',resultId:'other-run'},{...value,vehicleHp:600}])rejected(save,bad);
});
test('defeat, active battle, a finalized checkpoint and a missing result cannot use the collection action',()=>{
 for(const change of [s=>{s.pendingResult.won=false;},s=>{s.flowState.phase='battle';},s=>{s.flowState.finalized=true;},s=>{s.pendingResult=null;}]){const {save,value}=replay(1);change(save);rejected(normalizeV100Save(save),value);}
});
