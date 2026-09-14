import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PRODUCTION_AUDIO_MANIFEST as old, V100_AUDIO_MANIFEST as current, INSTALL_AUDIO_ASSETS } from '../app/productionAudio.js';
import { V100_MUSIC_TRACKS, V100_STORY_SCORE_CUTS, v100SurfaceScore } from '../app/v100Music.js';
import { V100_STORY_EVENTS } from '../app/v100StoryEvents.js';
import { v100EventPresentationFor } from '../app/v100EventPresentation.js';

test('approved normal/daily music is separate from other scene roles and keeps the original boss', () => {
  for (const id of ['boss','story-boss']) assert.deepEqual(current.sceneById[id],old.sceneById[id]);
  assert.deepEqual(current.assetById['music-boss'],old.assetById['music-boss']);
  assert.equal(current.sceneById.stage1.bgm,'music-v100-score-normal');
  assert.equal(current.sceneById['story-kumaya-daily'].bgm,'music-v100-score-daily');
  assert.equal(new Set(V100_MUSIC_TRACKS.map(t=>t.file)).size,8);
  assert.equal(current.sceneById.map.bgm,current.sceneById.loadout.bgm);
  for(const id of ['silence-prologue-title','silence-station-seal']) assert.equal(current.sceneById[id].bgm??null,null);
});

test('every canonical stage event has a playable scene score; dialogue never emits an automatic cue', () => {
  const visited=new Set();
  for(const [eventId,event] of Object.entries(V100_STORY_EVENTS)) {
    if(!/^v100:event:s\d{2}:/.test(eventId))continue;
    for(const [nodeIndex,node] of event.nodes.entries()){
      const view=v100EventPresentationFor({eventId,nodeIndex,node,phase:eventId.endsWith(':pre')?'event':'post'});
      const scene=current.sceneById[view.sceneId];
      assert.ok(scene,eventId+' '+node.sourceLine);
      assert.equal(view.cueId,null);
      if(node.kind!=='title')assert.ok(current.assetById[scene.bgm],eventId+' '+node.sourceLine);
      visited.add(eventId);
    }
  }
  assert.equal(visited.size,60);
});

test('TAKUYA mourning, the red-lens retrieval, the quiet soup and the finale follow source-bound musical cuts', () => {
  for(const cut of V100_STORY_SCORE_CUTS){
    const eventId='v100:event:s'+String(cut.stage).padStart(2,'0')+':post';
    const event=V100_STORY_EVENTS[eventId];
    const at=event.nodes.find(n=>n.sourceLine===cut.line);
    assert.ok(at,'Canonical cut line exists: '+cut.line);
    const index=event.nodes.indexOf(at), before=event.nodes[index-1];
    const get=node=>current.sceneById[v100EventPresentationFor({eventId,node,phase:'post'}).sceneId].bgm;
    assert.notEqual(get(before),get(at));
    assert.equal(get(at),'music-v100-score-'+cut.role);
  }
  for(const [eventId,line,role] of [['v100:event:s03:post',526,'loss'],['v100:event:s25:post',2058,'daily']]){
    const node=V100_STORY_EVENTS[eventId].nodes.find(n=>n.sourceLine===line);
    assert.ok(node);assert.equal(current.sceneById[v100EventPresentationFor({eventId,node}).sceneId].bgm,'music-v100-score-'+role);
  }
});

test('surface score cannot compete with combat; preparation and mode hubs/results have music', () => {
  assert.equal(v100SurfaceScore({ready:false,phase:'map'}),null);
  assert.equal(v100SurfaceScore({ready:true,phase:'map',battleActive:true}),null);
  assert.equal(v100SurfaceScore({ready:true,phase:'map',modeResult:'defeat'}).sceneId,'defeat');
  assert.equal(v100SurfaceScore({ready:true,phase:'map',modeResult:'victory'}).sceneId,'victory');
  assert.equal(v100SurfaceScore({ready:true,phase:'map',battleActive:true,modeResult:'victory'}),null);
  assert.equal(v100SurfaceScore({ready:true,phase:'event'}),null);
  assert.deepEqual(v100SurfaceScore({ready:true,phase:'map'}),v100SurfaceScore({ready:true,phase:'formation'}));
  assert.equal(v100SurfaceScore({ready:true,phase:'result',won:false}).sceneId,'defeat');
});

test('new music has exact attributed source and derivative hashes and preserves every legacy install source', async () => {
  const provenance=JSON.parse(await readFile('assets/source/v100/audio/scott-buckley/production-provenance.json','utf8'));
  assert.equal(provenance.license,'CC-BY-4.0');
  assert.equal(provenance.records.length,18);
  for(const record of provenance.records){
    const hash=path=>readFile(path).then(b=>createHash('sha256').update(b).digest('hex'));
    assert.equal(await hash(record.file),record.sha256,record.file);
    assert.equal(await hash(record.sourceFile),record.sourceSha256,record.sourceFile);
    assert.ok(record.durationSeconds>=72&&record.durationSeconds<=96);
  }
  const paths=new Set(INSTALL_AUDIO_ASSETS.flatMap(a=>a.sources.map(s=>s.src)));
  for(const asset of old.assets)for(const source of asset.sources)assert.ok(paths.has(source.src),source.src);
  for(const track of V100_MUSIC_TRACKS)assert.ok(paths.has('/audio/v100/score/'+track.role+'.mp3'));
});
