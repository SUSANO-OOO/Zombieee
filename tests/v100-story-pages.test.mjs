import test from 'node:test';
import assert from 'node:assert/strict';
import {V100_STORY_EVENTS,v100StoryEventView} from '../app/v100StoryEvents.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
import {v100StoryExpressionFor} from '../app/v100StoryDirection.js';
const phase=id=>id==='v100:event:prologue'?'prologue':id.endsWith(':post')?'post':'event';
const presented=(id,node,index)=>v100EventPresentationFor({eventId:id,phase:phase(id),node,nodeIndex:index});
const length=text=>Array.from(text??'').length;
test('all source nodes and every existing resume cursor survive grouping, including long player names',()=>{
 let merged=0,exchanges=0;
 for(const id of Object.keys(V100_STORY_EVENTS)){
  const event=v100StoryEventView(id,'１２文字の主人公名ですよ'),before=structuredClone(event.nodes),covered=[];
  for(let cursor=0;cursor<event.nodes.length;){
   const page=v100StoryPageFor(id,event.nodes,cursor),nodes=[...page.leadingNodes,page.node];
   covered.push(...nodes);assert.equal(page.startIndex,cursor);
   assert.ok(nodes.length<=3);assert.equal(page.node,event.nodes[page.nodeIndex]);
   if(nodes.length>1){
    merged++;const p=presented(id,nodes[0],cursor);
    for(const [offset,node] of nodes.entries()){
     const q=presented(id,node,cursor+offset);
     assert.equal(q.cueId,null,id+': sound must keep its own page');assert.equal(q.cinematic,false,id);
     for(const key of ['backgroundPath','sceneLabel','sceneId','cutId','insertId'])assert.equal(q[key],p[key],id+': '+key);
     for(const owner of nodes.map(n=>n.portraitOwner).filter(Boolean))assert.equal(v100StoryExpressionFor(id,cursor,nodes[0],owner),v100StoryExpressionFor(id,cursor+offset,node,owner),id+': expression');
    }
    if(nodes[0].kind==='dialogue'){
     exchanges++;assert.equal(nodes.length,2);assert.ok(nodes.every(n=>n.kind==='dialogue'&&n.portraitOwner));
     assert.ok(nodes.reduce((n,line)=>n+length(line.text)+length(line.speaker),0)<=90);
    }else assert.ok(nodes.reduce((n,line)=>n+length(line.text),0)<=90);
   }
   cursor=page.endIndex+1;
  }
  assert.deepEqual(covered,event.nodes,id+': no lost, duplicated or reordered text');
  for(let old=0;old<event.nodes.length;old++){
   const page=v100StoryPageFor(id,event.nodes,old);
   assert.equal(page.startIndex,old);assert.deepEqual([...page.leadingNodes,page.node],event.nodes.slice(old,page.endIndex+1));
  }
  assert.deepEqual(event.nodes,before,'pagination must never rewrite the screenplay');
 }
 assert.ok(merged>150,'ordinary campaign events use the same pagination');assert.ok(exchanges>50);
});
test('sound, cut, insert, location, emotion, anonymous voice and long text remain separate beats',()=>{
 const id='v100:event:s02:pre';
 const a={kind:'dialogue',speaker:'ハチ',portraitOwner:'unit-hachi',text:'先に行く。',sceneTag:'test',sourceDocument:'STORY_SCRIPT_V100_PRODUCER_R9.md'};
 const b={...a,speaker:'パイセン',portraitOwner:'unit-paisen',text:'任せろ。'};
 assert.equal(v100StoryPageFor(id,[a,b]).endIndex,1,'safe short exchange combines');
 for(const patch of [{cueId:'v100-story-door-open'},{audioSceneId:'v100-story-soup-break'},{cutId:'s01-nao-rescue'},{insertId:'seg-lab-transfer'},{sceneTag:'other'},{expression:'alarm'},{portraitOwner:null},{kind:'battle-marker'},{text:'長い台詞。'.repeat(30)}]){
  assert.equal(v100StoryPageFor(id,[a,{...b,...patch}]).endIndex,0,JSON.stringify(patch));
 }
 assert.equal(v100StoryPageFor(id,[{...a,cueId:'v100-story-door-open'},b]).endIndex,0);
 for(const eventId of ['v100:event:ending','v100:event:epilogue','v100:event:credits'])assert.equal(v100StoryPageFor(eventId,[a,b]).endIndex,0);
});
