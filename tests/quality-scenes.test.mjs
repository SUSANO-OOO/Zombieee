import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {V100_CREDITS_FILM} from '../app/v100CreditsFilm.js';
import {v100StoryDirectionFor} from '../app/v100StoryDirection.js';
import {V100_QUALITY_SCENE_ASSETS,v100QualityScenePathFor} from '../app/v100QualitySceneAssets.js';
import {v177StoryDetailShotFor} from '../app/v177StoryDetailShots.js';

test('versioned scene payloads replace only the eight declared paths and add three Babayaga events',async()=>{
 const provenance=JSON.parse(await readFile('assets/source/quality-20261028/scenes/runtime-provenance-r1.json'));
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 assert.equal(provenance.records.length,11);
 assert.equal(provenance.records.filter(row=>row.newEvent).length,3);
 const livePaths=new Set([...V100_CREDITS_FILM.map(shot=>shot.src),...Object.entries(V100_STORY_EVENTS).flatMap(([id,event])=>event.nodes.map((node,i)=>v100StoryDirectionFor(id,i,node).backgroundPath))]);
 for(const record of provenance.records){
  assert.ok(livePaths.has(record.path),'unreachable scene '+record.id);
  const asset=manifest.assets.find(a=>a.path===record.path);assert.ok(asset,record.id);
  const bytes=await readFile('public'+record.path);
  assert.equal(asset.bytes,bytes.length);
  assert.equal(record.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(asset.hash,'sha256-'+record.sha256);
  if(record.detail){
   const shot=v177StoryDetailShotFor(record.path);
   assert.ok(shot);assert.deepEqual(shot.rect,record.detail.rect);
   assert.equal(shot.sourceWidth,record.dimensions[0]);assert.equal(shot.sourceHeight,record.dimensions[1]);
   const [x,y,w,h]=shot.rect;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=shot.sourceWidth&&y+h<=shot.sourceHeight,'authored action crop stays inside its current source');
  }
  if(record.previousPath){
   assert.equal(v100QualityScenePathFor(record.previousPath),record.path);
   assert.equal(manifest.assets.some(a=>a.path===record.previousPath),false,'duplicate old runtime '+record.id);
   const original=await readFile('public'+record.previousPath);
   assert.equal(createHash('sha256').update(original).digest('hex'),record.previousSha256,'original preserved');
  }
 }
 assert.equal(v100QualityScenePathFor('/unrelated.webp'),'/unrelated.webp');
 for(const id of ['facility-power','vehicle-patch','vehicle-mayo-splash','kumaya-main-table']){
  const sceneId=id==='kumaya-main-table'?'epilogue-main-table':id;
  assert.equal(V100_CREDITS_FILM.find(s=>s.id===id).src,V100_QUALITY_SCENE_ASSETS[sceneId].path);
 }
});

test('new Babayaga cuts begin on their authored action and preserve the preceding phone diagram and plot',()=>{
 for(const [eventId,line,last,cut]of [
  ['v100:event:s06:pre',618,620,'s06-babayaga-old-message'],
  ['v100:event:s18:post',1553,1553,'s18-babayaga-chiha-records'],
  ['v100:event:s27:pre',2115,2117,'s27-babayaga-cover'],
 ]){
  const event=V100_STORY_EVENTS[eventId],uses=event.nodes.filter(n=>n.cutId===cut);
  assert.equal(uses[0].sourceLine,line);assert.equal(uses[0].kind,'action');
  assert.equal(uses.at(-1).sourceLine,last);
  for(const node of uses){assert.equal(node.insertId,null);assert.equal(v100StoryDirectionFor(eventId,0,node).backgroundPath,V100_QUALITY_SCENE_ASSETS[cut].path);}
  assert.notEqual(event.nodes.find(n=>n.sourceLine===line-2)?.cutId,cut,'no early action reveal');
 }
 const before=V100_STORY_EVENTS['v100:event:s06:pre'].nodes.filter(n=>n.sourceLine>=602&&n.sourceLine<=616);
 assert.ok(before.length);assert.ok(before.every(n=>n.insertId==='message-backlog'));
 assert.match(V100_STORY_EVENTS['v100:event:s18:post'].nodes.find(n=>n.sourceLine===1553).text,/二人で搬送車へ運んだ/u);
 assert.match(V100_STORY_EVENTS['v100:event:s27:pre'].nodes.find(n=>n.sourceLine===2115).text,/撃ち返せる位置/u);
});
