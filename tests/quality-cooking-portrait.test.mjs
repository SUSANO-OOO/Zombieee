import test from 'node:test';
import assert from 'node:assert/strict';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100EventPortraitPath,v100StoryExpressionFor,v100StoryListenerFor,V100_EVENT_EXPRESSIONS} from '../app/v100StoryDirection.js';

test('all authored everyday rice-serving nodes retain the cooking prop for speaker and listener',()=>{
  let count=0;
  for(const [id,event]of Object.entries(V100_STORY_EVENTS))for(const [index,node]of event.nodes.entries()){
    if(!['daily','soup'].includes(node.sceneTag))continue;
    const expression=v100StoryExpressionFor(id,index,node,'unit-kumaverson');
    assert.equal(expression,'warm',`${id}:${index}: new emotion needs its own cooking asset`);
    assert.equal(v100EventPortraitPath('unit-kumaverson',expression,node.sceneTag),'/art/v100/portraits/kumaverson-cooking-warm-stage-r1.webp',`${id}:${index}`);
    count++;
  }
  assert.equal(count,39);
});
test('danger, unrelated scenes and all other identities retain their adopted portrait paths',()=>{
  for(const expression of V100_EVENT_EXPRESSIONS){
    for(const tag of [null,'crisis','escape','unknown'])assert.equal(v100EventPortraitPath('unit-kumaverson',expression,tag),`/art/v100/portraits/kumaverson-${expression}-stage-r1.webp`);
    for(const owner of ['unit-babayaga','unit-tky','unit-paisen'])assert.equal(v100EventPortraitPath(owner,expression,'daily'),v100EventPortraitPath(owner,expression));
  }
  assert.equal(v100EventPortraitPath('unknown','warm','daily'),null);
});
test('the rice-serving invitation addresses Zakimiya without replacing his wife in her own line',()=>{
  let overrides=0;
  for(const [id,event]of Object.entries(V100_STORY_EVENTS))for(const node of event.nodes){
    const listener=v100StoryListenerFor(id,node);
    if(id==='v100:event:s25:post'&&node.sourceKey==='r9:2036'){
      assert.equal(listener,'unit-zakimiya');overrides++;
    }else assert.equal(listener,null,`${id}:${node.sourceKey}`);
  }
  assert.equal(overrides,1);
});
test('Zakimiya keeps his son and milk bottle throughout the authored soup scene only',()=>{
  let count=0;
  for(const [id,event]of Object.entries(V100_STORY_EVENTS))for(const [index,node]of event.nodes.entries()){
    if(node.sceneTag!=='soup')continue;
    assert.equal(id,'v100:event:s25:post','new soup scene needs a prop continuity review');
    const expression=v100StoryExpressionFor(id,index,node,'unit-zakimiya');
    assert.equal(expression,'warm','new emotion needs a matching family portrait');
    assert.equal(v100EventPortraitPath('unit-zakimiya',expression,node.sceneTag),'/art/v100/portraits/zakimiya-family-warm-quality-r1.webp');
    count++;
  }
  assert.equal(count,9);
  for(const expression of V100_EVENT_EXPRESSIONS)for(const tag of ['daily','crisis',null])assert.equal(v100EventPortraitPath('unit-zakimiya',expression,tag),`/art/v100/portraits/zakimiya-${expression}-quality-r1.webp`);
});
