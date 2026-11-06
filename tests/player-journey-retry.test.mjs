import test from 'node:test';
import assert from 'node:assert/strict';
import {createV100StoryFlowState,retryV100Battle} from '../app/v100StoryFlow.js';

test('defeat retries the same stage while preserving progress and clearing only the failed battle result',()=>{
  const state={...createV100StoryFlowState(),phase:'result',stageId:'s01',stageNumber:1,
    pendingResult:{won:false,stageId:'s01'},completedStageIds:[],readStoryEventIds:['v100:event:prologue'],
    formationSlots:['unit-kumaverson','unit-babayaga'],receipts:['owned-receipt']};
  const original=structuredClone(state),result=retryV100Battle(state);
  assert.equal(result.accepted,true);assert.equal(result.state.phase,'battle');
  assert.equal(result.state.stageId,'s01');assert.equal(result.state.pendingResult,null);
  for(const key of ['formationSlots','receipts','completedStageIds','readStoryEventIds'])assert.deepEqual(result.state[key],state[key]);
  assert.deepEqual(state,original);
  assert.equal(retryV100Battle(result.state).accepted,false,'Repeated clicks cannot settle or start another result');
});
test('retry cannot bypass a victory reward or a story/preparation screen',()=>{
  for(const phase of ['map','event','formation','battle'])assert.equal(retryV100Battle({phase,pendingResult:{won:false}}).accepted,false);
  const won={phase:'result',pendingResult:{won:true}};const result=retryV100Battle(won);
  assert.equal(result.accepted,false);assert.equal(result.state,won);
});
