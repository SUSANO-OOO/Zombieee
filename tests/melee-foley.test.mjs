import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {PRODUCTION_AUDIO_MANIFEST, GAMEPLAY_PRODUCTION_AUDIO_MANIFEST, V100_AUDIO_MANIFEST} from '../app/productionAudio.js';
import {withMeleeFoley, MELEE_FOLEY_RECIPES} from '../app/meleeFoleyRecipes.js';
const provenance=JSON.parse(fs.readFileSync('assets/source/melee-foley/provenance.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fileHash=file=>sha(fs.readFileSync(file));

test('melee adoption preserves all authored policies, other assets and the input manifest',()=>{
  const before=structuredClone(PRODUCTION_AUDIO_MANIFEST),after=withMeleeFoley(PRODUCTION_AUDIO_MANIFEST);
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST,before);
  const changed=[];
  for(const [i,asset] of before.assets.entries()){
    const {sources,...policy}=asset,{sources:adopted,...newPolicy}=after.assets[i];
    assert.deepEqual(newPolicy,policy);
    if(MELEE_FOLEY_RECIPES[asset.id]){
      changed.push(asset.id);assert.notDeepEqual(adopted,sources);
    }else assert.deepEqual(after.assets[i],asset);
  }
  assert.deepEqual(changed.sort(),Object.keys(MELEE_FOLEY_RECIPES).sort());
  for(const key of Object.keys(before).filter(k=>k!=='assets'))assert.deepEqual(after[key],before[key]);
});

test('both runtime modes resolve non-repeating melee pools to distinct adopted files',()=>{
  for(const manifest of [GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,V100_AUDIO_MANIFEST]){
    for(const family of ['crowbar','unarmed','hammer']){
      const pool=manifest.poolById['weapon-'+family];
      assert.equal(pool.avoidImmediateRepeat,true);
      assert.equal(pool.assetIds.length,2);
      const files=pool.assetIds.map(id=>manifest.assetById[id].sources[0].src);
      assert.equal(new Set(files).size,2);
      for(const file of files)assert.match(file,/^\/audio\/weapons\/melee\//u);
    }
  }
});

test('both encodings retain provenance, distinct samples, bounded levels and faded tails',()=>{
  assert.equal(provenance.license,'CC0-1.0');
  for(const notice of provenance.notices)assert.equal(fileHash(notice.file),notice.sha256);
  const hashes={mp3:new Set(),ogg:new Set()};
  assert.equal(provenance.records.length,12);
  for(const row of provenance.records){
    assert.equal(fileHash(row.file),row.sha256);
    assert.equal(fileHash(row.reference.file),row.reference.sha256);
    for(const input of row.inputs)assert.equal(fileHash(input.file),input.sha256);
    const bytes=execFileSync(ffmpeg.path,['-v','error','-i',row.file,'-f','f32le','-ac','1','-ar','44100','pipe:1']);
    const samples=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
    hashes[row.file.split('.').at(-1)].add(sha(bytes));
    const peak=samples.reduce((p,s)=>Math.max(p,Math.abs(s)),0);
    assert.ok(peak>.03&&peak<.95,row.file+' non-silent, unclipped');
    assert.ok(Math.abs(samples.length/44100-row.duration)<.06,row.file+' duration');
    assert.ok(samples.slice(-220).every(s=>Math.abs(s)<.003),row.file+' faded tail');
    const rms=Math.sqrt(samples.slice(0,8820).reduce((sum,s)=>sum+s*s,0)/8820);
    assert.ok(Math.abs(rms/row.targetActive200msRms-1)<.15,row.file+' active level');
  }
  for(const set of Object.values(hashes))assert.equal(set.size,6,'different IDs must not repeat the same decoded waveform');
});
