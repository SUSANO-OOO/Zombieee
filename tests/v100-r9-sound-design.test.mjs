import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { V100_STORY_EVENTS } from '../app/v100StoryEvents.js';
import { V100_AUDIO_MANIFEST } from '../app/productionAudio.js';
import { V100_R9_SOUND_RECIPES, V100_R9_AUDIO_SCENES } from '../app/v100R9SoundDesign.js';
import { v100EventPresentationFor } from '../app/v100EventPresentation.js';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const nodes=Object.entries(V100_STORY_EVENTS).flatMap(([eventId,event])=>event.nodes.map(node=>({eventId,node})));

test('R9 physical sounds and all scene scores reach actual story nodes',()=>{
 const used=new Set(nodes.map(({node})=>node.cueId).filter(Boolean));
 for(const {eventId,node} of nodes){
  if(!node.audioSceneId)continue;
  const scene=V100_AUDIO_MANIFEST.sceneById[node.audioSceneId];
  assert.ok(scene,`${eventId}/${node.sourceKey}`);
  assert.equal(v100EventPresentationFor({eventId,node}).sceneId,node.audioSceneId);
  assert.ok(V100_AUDIO_MANIFEST.assetById[scene.bgm]);
  scene.ambience.forEach(id=>used.add(id));
 }
 for(const name of Object.keys(V100_R9_SOUND_RECIPES))assert.ok(used.has(`v100-r9-${name}`),`${name}: unused sound`);
 for(const scene of V100_R9_AUDIO_SCENES)assert.ok(nodes.some(({node})=>node.audioSceneId===`v100-r9-${scene.id}`),`${scene.id}: unused score`);
 const at=line=>nodes.find(({node})=>node.sourceLine===line).node;
 for(const [line,name] of [[109,'chair-scrape'],[125,'extinguisher'],[507,'shutter-open'],[817,'cable-disconnect'],[850,'glass-knock'],[854,'ceiling-fall'],[858,'shutter-jam'],[916,'oxygen-valve'],[1152,'coupler-release'],[1608,'barrier-raise'],[1612,'vehicle-collision'],[1917,'door-battering'],[1919,'card-burnout'],[2320,'sample-lids'],[2330,'fire-catch'],[2395,'gas-ignition'],[2415,'plate-stack']])assert.equal(at(line).cueId,`v100-r9-${name}`,`${line}`);
});

test('R9 MP3 and OGG decode to bounded physical signals with source-bound provenance',async()=>{
 const ledger=JSON.parse(await readFile('assets/source/v100/audio/r9-sound-provenance.json','utf8'));
 assert.equal(ledger.records.length,Object.keys(V100_R9_SOUND_RECIPES).length*2);
 const manifest=JSON.parse(await readFile('public/asset-manifest.json','utf8'));
 for(const record of ledger.records){
  const bytes=await readFile(record.file);
  assert.equal(bytes.length,record.bytes);assert.equal(sha(bytes),record.sha256,record.file);
  for(const source of record.sources){assert.equal(source.license,'CC0-1.0');assert.equal(sha(await readFile(source.file)),source.sha256);}
  const asset=V100_AUDIO_MANIFEST.assetById[record.id];
  assert.ok(asset.sources.some(source=>record.file==='public'+source.src));
  if(record.file.endsWith('.mp3'))assert.ok(manifest.assets.some(asset=>asset.path===record.file.slice(6)&&asset.hash==='sha256-'+record.sha256));
  const pcm=execFileSync(ffmpeg.path,['-hide_banner','-loglevel','error','-i',record.file,'-f','f32le','-ar','44100','-ac','1','pipe:1'],{maxBuffer:8*1024*1024});
  const samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4);
  let peak=0,sum=0,squares=0;
  for(const sample of samples){assert.ok(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));sum+=sample;squares+=sample*sample;}
  const rms=Math.sqrt(squares/samples.length),duration=samples.length/44100;
  assert.ok(Math.abs(duration-record.duration)<.08,`${record.file}: duration ${duration}`);
  assert.ok(rms>.001,`${record.file}: silence`);assert.ok(peak<.98,`${record.file}: clipping ${peak}`);
  assert.ok(Math.abs(sum/samples.length)<.01,`${record.file}: DC offset`);
  if(record.loop)assert.ok(Math.abs(samples[0]-samples.at(-1))<.01,`${record.file}: discontinuous loop seam`);
 }
});
