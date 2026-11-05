import assert from 'node:assert/strict';
import {v100StoryEventView} from '../app/v100StoryEvents.js';
import {v100ActionPortraitSubjects,v100DialogueSlots} from '../app/v100DialogueComposition.js';
import {v100EventPortraitPath,v100StoryExpressionFor,v100StoryListenerFor} from '../app/v100StoryDirection.js';
import {v100StoryPortraitPath} from '../app/v100StoryPortraitPaths.js';

// Expected image routing, independent of the observed DOM. This checks asset
// identity/count, not whether an approved face was drawn well inside that file.
export function expectedStoryPortraits(eventId,page,playerName='全編確認') {
  const event=v100StoryEventView(eventId,playerName),node=event.nodes[page.nodeIndex];
  assert.ok(node,'Unknown story node');
  if(page.presentation.cinematic||['title','montage'].includes(node.kind))return [];
  const subjects=v100ActionPortraitSubjects(eventId,node,page.nodeIndex);
  const owner=node.portraitOwner??subjects[0]??null;
  const resolve=person=>{
    const expression=v100StoryExpressionFor(eventId,page.nodeIndex,node,person);
    const source=v100EventPortraitPath(person,expression,node.sceneTag)??v100StoryPortraitPath(person);
    return source?{owner:person,expression,source}:null;
  };
  const primary=resolve(owner),slots=v100DialogueSlots(event.nodes,page.nodeIndex);
  const side=slots.right?.portraitOwner===owner?'right':'left';
  const other=node.kind==='dialogue'&&primary?slots[side==='right'?'left':'right']:null;
  const listener=v100StoryListenerFor(eventId,node)??other?.portraitOwner??subjects[1]??null;
  return [resolve(listener),primary].filter(Boolean);
}

export function assertStoryPortraitSources(paint,expected) {
  assert.ok(paint&&Array.isArray(paint.portraits),'Missing portrait observation');
  assert.equal(paint.portraitCount,expected.length,'Wrong portrait count');
  assert.equal(paint.portraits.length,expected.length,'Missing or extra portrait');
  const assetPath=source=>new URL(source,'http://localhost/').pathname;
  assert.deepEqual(paint.portraits.map(p=>assetPath(p.source)),expected.map(p=>assetPath(p.source)),
    'Wrong speaker/listener image or expression');
}
