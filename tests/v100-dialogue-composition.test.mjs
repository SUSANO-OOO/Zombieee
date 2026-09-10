import assert from 'node:assert/strict';
import test from 'node:test';
import {v100DialogueSlots} from '../app/v100DialogueComposition.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
const says=owner=>({kind:'dialogue',portraitOwner:owner});
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
