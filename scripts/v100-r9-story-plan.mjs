import assert from 'node:assert/strict';
import {V100_STORY_EVENTS,v100StoryEventView} from '../app/v100StoryEvents.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {v100EventPhaseForId} from '../app/v100Registry.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
import {V100_AUDIO_MANIFEST} from '../app/productionAudio.js';

export function r9StoryPlan(playerName='全編確認'){
 const events=[],finalizers=[];
 for(const [eventId,source]of Object.entries(V100_STORY_EVENTS)){
  if(!source.nodes.length){finalizers.push(eventId);continue;}
  if(eventId==='v100:event:credits')continue; // The native-film bookend QA owns its 11 scenes.
  const event=v100StoryEventView(eventId,playerName),phase=v100EventPhaseForId(eventId),pages=[];
  for(let index=0;index<event.nodes.length;){
   const page=v100StoryPageFor(eventId,event.nodes,index),nodes=event.nodes.slice(index,page.endIndex+1);
   const presentation=v100EventPresentationFor({eventId,phase,node:page.node,nodeIndex:page.nodeIndex});
   const audio=V100_AUDIO_MANIFEST.scenes.find(s=>s.id===presentation.sceneId);assert.ok(audio,'Known scene audio required');
   pages.push({startIndex:index,nodeIndex:page.nodeIndex,
    sourceIndices:nodes.map((_,i)=>index+i),sourceLines:nodes.map(n=>n.sourceLine),texts:nodes.map(n=>n.text),
    presentation,requiresAudio:Boolean(audio.bgm||audio.ambience?.length),
    sceneAudio:{bgmAssetId:audio.bgm??null,ambienceAssetIds:audio.ambience??[]}});
   index=page.endIndex+1;
  }
  assert.deepEqual(pages.flatMap(p=>p.sourceIndices),event.nodes.map((_,i)=>i),'Each original node must be seen exactly once');
  events.push({eventId,phase,nodeCount:event.nodes.length,pages});
 }
 return {events,finalizers,credits:{eventId:'v100:event:credits',nodes:V100_STORY_EVENTS['v100:event:credits'].nodes.length},
  totalSourceNodes:Object.values(V100_STORY_EVENTS).reduce((n,e)=>n+e.nodes.length,0)};
}

export function readR9PageGeometry(element){
 const copy=element.querySelector('.v100-node-copy,.v100-node-title,.v100-credits-shot');
 const action=element.querySelector('.v100-event-actions .v100-primary');
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const bounds=copy&&rect(copy),button=action&&rect(action),hit=button&&document.elementFromPoint(button.x+button.width/2,button.y+button.height/2);
 const blocks=[...(copy?.querySelectorAll('.v100-node-kind,p')??[])].map(e=>({text:e.textContent,...rect(e)}));
 return {nodeIndex:Number(element.dataset.v100NodeIndex),text:copy?.textContent??'',bounds,button,blocks,
  viewport:{width:innerWidth,height:innerHeight},actionReachable:Boolean(action&&hit&&(hit===action||action.contains(hit))),
  overflow:Math.max(document.documentElement.scrollWidth-innerWidth,document.body.scrollWidth-innerWidth),
  audio:window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.()??null};
}

export function assertR9PageGeometry(state,page){
 const compact=s=>s.replace(/\s+/gu,'');
 assert.equal(state.nodeIndex,page.nodeIndex,'The real cursor must advance to this page');
 for(const text of page.texts)assert.ok(compact(state.text).includes(compact(text)),'Authored text is missing');
 const fits=r=>r&&r.width>0&&r.height>0&&r.x>=-1&&r.y>=-1&&r.right<=state.viewport.width+1&&r.bottom<=state.viewport.height+1;
 assert.ok(fits(state.bounds),'Story text leaves the viewport');assert.ok(fits(state.button),'Next control leaves the viewport');
 assert.equal(state.actionReachable,true,'Next control is occluded');assert.ok(state.overflow<=1,'Horizontal page overflow');
 for(const block of state.blocks)assert.ok(block.x>=state.bounds.x-1&&block.right<=state.bounds.right+1
  &&block.y>=state.bounds.y-1&&block.bottom<=state.bounds.bottom+1,'Authored text leaves its card');
 for(let i=0;i<state.blocks.length;i++)for(const b of state.blocks.slice(i+1)){
  const a=state.blocks[i];assert.ok(Math.min(a.right,b.right)-Math.max(a.x,b.x)<=.5
   ||Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<=.5,'Authored text blocks overlap');
 }
 assert.equal(state.audio?.desired?.sceneId,page.presentation.sceneId,'Wrong story audio scene');
 assert.equal(state.audio?.sceneState?.sceneId,page.presentation.sceneId,'Story audio was not applied');
 assert.equal(state.audio?.sceneState?.bgmAssetId,page.sceneAudio.bgmAssetId,'Authored BGM did not start');
 assert.deepEqual([...state.audio.sceneState.ambienceAssetIds].sort(),[...page.sceneAudio.ambienceAssetIds].sort(),'Authored ambience did not start');
 assert.equal(state.audio?.diagnostics?.contextState,'running','Story audio context is not running');
 if(page.requiresAudio)assert.equal(state.audio?.active?.sceneId,page.presentation.sceneId,'Story audio has no active scene voice');
 if(page.presentation.cueId)assert.ok(state.audio.receipts.some(r=>r.action==='cue-started'
  &&r.eventId===page.presentation.eventId&&r.nodeIndex===page.nodeIndex&&r.cueId===page.presentation.cueId),'Arrival sound did not start');
 return true;
}
