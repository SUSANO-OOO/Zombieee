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
 assert.equal(present('s01:post',271).backgroundPath,'/art/v100/quality-20261028/scenes/s01-nao-rescue-r1.webp');
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

test('hospital transitions follow entry actions and retain the corridor through instructions',()=>{
 assert.match(node('s07:post',681).text,/防火扉が閉まった/u);
 assert.match(node('s21:post',1800).text,/中へ押し込んだ/u);
 assert.match(node('s22:pre',1805).text,/消毒液の臭いがする廊下/u);
 for(const line of [681,707,709,711])assert.equal(present('s07:post',line).backgroundPath,art['hospital-corridor'].path);
 assert.equal(present('s21:post',1798).backgroundPath,null);
 assert.equal(present('s21:post',1800).backgroundPath,art['clinical-corridor'].path);
 for(const line of [1805,1821,1823])assert.equal(present('s22:pre',line).backgroundPath,art['clinical-corridor'].path);
 for(const n of V100_STORY_EVENTS['v100:event:s07:pre'].nodes)assert.equal(v100StoryLocationFor('v100:event:s07:pre',n),null);
});

test('post-battle locations retain the ledger and family cut, then follow the outdoor handover',()=>{
 assert.match(node('s08:post',741).text,/廊下に出た/u);
 for(const line of [741,753,773])assert.equal(present('s08:post',line).backgroundPath,art['hospital-corridor'].path);
 assert.equal(present('s08:post',753).insertId,'patient-ledger');
 assert.equal(present('s08:pre',716).backgroundPath,null);
 for(const line of [1828,1842])assert.equal(present('s22:post',line).backgroundPath,art['clinical-room'].path);
 for(const line of [1844,1854])assert.equal(present('s22:post',line).backgroundPath,'/art/v100/quality-20261028/scenes/s22-zakimiya-holds-son-r1.webp');
 for(const line of [1856,1858,1860])assert.equal(present('s22:post',line).backgroundPath,art['logistics-gate'].path);
 assert.equal(v100StoryLocationFor('v100:event:s22:post',node('s22:post',1862)),null,'mixed handover/departure/entry node is not assigned one inferred location');
});

test('all location outputs match authoring hashes and the offline campaign manifest',async()=>{
 const provenance=JSON.parse(await readFile('assets/source/quality-20261028/locations/provenance.json','utf8'));
 const manifest=JSON.parse(await readFile('public/asset-manifest.json','utf8'));
 assert.equal(provenance.records.length,Object.values(art).filter(a=>!a.existing).length);
 for(const asset of Object.values(art))assert.ok(manifest.assets.some(a=>a.path===asset.path),asset.path);
 for(const record of provenance.records){
  for(const [path,hash]of [[record.source,record.sourceSha256],[record.output,record.sha256]])assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash);
  const asset=manifest.assets.find(a=>a.path===record.output.slice('public'.length));assert.ok(asset);
  assert.equal(asset.bytes,record.bytes);assert.equal(asset.hash,`sha256-${record.sha256}`);
 }
});
