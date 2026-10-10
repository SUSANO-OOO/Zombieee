import assert from 'node:assert/strict';
import test from 'node:test';
import {v100ActionPortraitSubjects,v100DialogueSlots} from '../app/v100DialogueComposition.js';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
const says=owner=>({kind:'dialogue',portraitOwner:owner});
test('authored R9 actions retain only the people present at that source beat',()=>{
 const subjects=Object.entries(V100_STORY_EVENTS).flatMap(([id,event])=>event.nodes.flatMap((node,index)=>{
  const owners=v100ActionPortraitSubjects(id,node,index);
  return owners.length?[{id,index,line:node.sourceLine,owners}]:[];
 }));
 assert.ok(subjects.length>=25);
 assert.deepEqual(subjects.find(s=>s.id==='v100:event:s17:post').owners,['unit-mrs-chiha','unit-babayaga']);
 assert.deepEqual(subjects.find(s=>s.line===2289).owners,['unit-mrs-chiha','unit-babayaga']);
 assert.deepEqual(subjects.find(s=>s.line===1844).owners,['unit-zakimiya']);
 assert.deepEqual(subjects.find(s=>s.line===2385).owners,['unit-babayaga','unit-mrs-chiha']);
 assert.deepEqual(subjects.find(s=>s.line===2375).owners,['unit-mrs-chiha']);
 assert.ok(subjects.every(s=>s.owners.every(owner=>owner!=='unit-hachi')));
 const radio=V100_STORY_EVENTS['v100:event:s27:post'].nodes.find(node=>node.speaker?.endsWith('の声'));
 assert.ok(radio);assert.deepEqual(v100ActionPortraitSubjects('v100:event:s22:post',radio),[],'CH17 is a radio voice');
 assert.deepEqual(v100ActionPortraitSubjects('v100:event:s23:pre',{kind:'dialogue',text:'ババヤガはカードではなく妻の顔を見る。'}),[]);
 assert.deepEqual(v100ActionPortraitSubjects('v100:event:s23:post',{kind:'action',text:'ババヤガはカードではなく妻の顔を見る。'}),[]);
});
test('alternating speakers keep their position and a new arrival replaces the older interlocutor',()=>{
 const nodes=[says('unit-kumaverson'),says('unit-paisen'),says('unit-kumaverson'),{kind:'player-action'},says('unit-paisen'),says('guide-ikura')];
 for(const index of [1,2,3,4]){
  const slots=v100DialogueSlots(nodes,index);
  assert.equal(slots.left.portraitOwner,'unit-kumaverson');
  assert.equal(slots.right.portraitOwner,'unit-paisen');
 }
 const slots=v100DialogueSlots(nodes,5);
 assert.equal(slots.left.portraitOwner,'guide-ikura');
 assert.equal(slots.right.portraitOwner,'unit-paisen');
});
test('quiet physical actions do not emit radio chirps',()=>{
 const view=v100EventPresentationFor({eventId:'v100:event:prologue',phase:'event',node:{kind:'player-action',text:'唐揚げを受け取る。'},nodeIndex:8});
 assert.equal(view.cueId,null);
});
