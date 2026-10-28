import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
import {V100_STORY_LOCATION_BACKDROPS as art,V100_STORY_LOCATION_SPANS as spans,v100StoryLocationFor} from '../app/v100StoryLocations.js';

const node=(suffix,line)=>{const result=V100_STORY_EVENTS[`v100:event:${suffix}`].nodes.find(n=>n.sourceLine===line);assert.ok(result,`${suffix}:${line}`);return result;};
const present=(suffix,line)=>v100EventPresentationFor({eventId:`v100:event:${suffix}`,node:node(suffix,line)});

test('boarding and cargo anchors match the current canonical actions; vehicle mentions outside do not switch location',()=>{
 for(const [suffix,line,anchor] of [['prologue',167,/運転席へ乗り込んだ/u],['s01:post',253,/全員が荷室へ/u],['s12:pre',998,/荷室へひっくり返る/u],['s19:post',1652,/装甲車両へ戻ってきた/u],['s20:post',1750,/乗り込んだ/u],['s26:post',2084,/薬瓶を詰めた保冷箱/u],['s30:post',2336,/運転席へ腰を下ろす/u]]){
  assert.match(node(suffix,line).text,anchor);assert.ok(v100StoryLocationFor(`v100:event:${suffix}`,node(suffix,line)));
 }
 for(const [suffix,line] of [['prologue',165],['s05:pre',518],['s12:pre',1008],['s19:post',1632],['s20:post',1728],['s26:pre',2075],['s26:post',2100]])assert.equal(v100StoryLocationFor(`v100:event:${suffix}`,node(suffix,line)),null);
 assert.equal(v100StoryLocationFor('v100:event:prologue',{sourceLine:167,kind:'action',sourceDocument:'older-script.md'}),null);
});

test('authored rescue cut overrides the vehicle backdrop and returns to it on the next page',()=>{
 assert.equal(present('s01:post',269).backgroundPath,art['rescue-vehicle'].path);
 assert.match(present('s01:post',271).backgroundPath,/s01-nao-rescue\.webp$/u);
 assert.equal(present('s01:post',273).backgroundPath,art['rescue-vehicle'].path);
 assert.equal(present('s26:post',2084).backgroundPath,art['refrigerated-cargo'].path);
 assert.equal(present('s26:post',2100).backgroundPath,null);
});

test('short-page grouping never merges across boarding; every authored node is retained exactly once',()=>{
 const snapshot=JSON.stringify(V100_STORY_EVENTS);
 for(const [eventId,event] of Object.entries(V100_STORY_EVENTS)){
  const indices=[];
  for(let i=0;i<event.nodes.length;){
   const page=v100StoryPageFor(eventId,event.nodes,i);
   const locations=event.nodes.slice(i,page.endIndex+1).map(n=>v100StoryLocationFor(eventId,n)?.path??null);
   assert.equal(new Set(locations).size,1,`${eventId}:${i}`);
   for(let j=i;j<=page.endIndex;j++)indices.push(j);
   i=page.endIndex+1;
  }
  assert.deepEqual(indices,event.nodes.map((_,i)=>i));
 }
 const nodes=V100_STORY_EVENTS['v100:event:prologue'].nodes,start=nodes.findIndex(n=>n.sourceLine===165);
 assert.equal(v100StoryPageFor('v100:event:prologue',nodes,start).endIndex,start);
 assert.equal(JSON.stringify(V100_STORY_EVENTS),snapshot,'Presentation must not modify text, IDs, cues, or canonical order');
 for(const [eventId,first,last] of spans)assert.ok(V100_STORY_EVENTS[eventId].nodes.some(n=>n.sourceLine>=first&&n.sourceLine<=last));
});

test('both location outputs match authoring hashes and the offline campaign manifest',async()=>{
 const provenance=JSON.parse(await readFile('assets/source/quality-20261028/locations/provenance.json','utf8'));
 const manifest=JSON.parse(await readFile('public/asset-manifest.json','utf8'));
 assert.equal(provenance.records.length,Object.keys(art).length);
 for(const record of provenance.records){
  for(const [path,hash]of [[record.source,record.sourceSha256],[record.output,record.sha256]])assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash);
  const asset=manifest.assets.find(a=>a.path===record.output.slice('public'.length));assert.ok(asset);
  assert.equal(asset.bytes,record.bytes);assert.equal(asset.hash,`sha256-${record.sha256}`);
 }
});
