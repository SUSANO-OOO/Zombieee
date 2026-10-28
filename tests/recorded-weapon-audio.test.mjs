import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {V100_AUDIO_MANIFEST, PRODUCTION_AUDIO_MANIFEST, enemyCombatCueFor, weaponCueForUnit} from '../app/productionAudio.js';
import {RECORDED_WEAPON_TAKES,withRecordedWeapons} from '../app/weaponRecordingRecipes.js';
import {v100AudioDesignCandidate} from '../app/v100SoundDesign.js';
const provenance=JSON.parse(fs.readFileSync('assets/source/weapon-recordings/provenance.json'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const decode=file=>{
  const b=execFileSync(ffmpeg.path,['-v','error','-i',file,'-f','f32le','-ac','1','-ar','44100','pipe:1'],{maxBuffer:4*1024*1024});
  return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);
};
test('recorded source adoption leaves every other asset and playback policy unchanged',()=>{
  const original=v100AudioDesignCandidate(PRODUCTION_AUDIO_MANIFEST),snapshot=structuredClone(original);
  const result=withRecordedWeapons(original);
  assert.deepEqual(original,snapshot,'adoption must not mutate the source manifest');
  const changed=[];
  for(const [i,asset] of original.assets.entries()){
    const adopted=result.assets[i];
    if(RECORDED_WEAPON_TAKES[asset.id]){
      changed.push(asset.id);
      const {sources:oldSources,...before}=asset,{sources:newSources,...after}=adopted;
      assert.deepEqual(after,before,'gain, pitch, category, cooldown and ownership remain authored');
      assert.equal(newSources.length,2);assert.ok(oldSources.length>0);
    }else assert.equal(adopted,asset,'BGM, voices, melee, suppressed pistol and other effects retain their asset');
  }
  assert.deepEqual(changed.sort(),Object.keys(RECORDED_WEAPON_TAKES).sort());
  for(const key of Object.keys(original).filter(key=>key!=='assets'))assert.equal(result[key],original[key]);
});
test('runtime firearm cues resolve distinct recorded families and retain real shot cadence contracts',()=>{
  for(const [kind,pool]of [['ranger','weapon-rifle'],['medic','weapon-rifle'],['gunner','weapon-gunner']]){
    assert.equal(weaponCueForUnit(kind),pool);
  }
  const enemy=enemyCombatCueFor('red-panther-smg','attack');
  assert.equal(V100_AUDIO_MANIFEST.aliasById[enemy].targetId,'weapon-smg');
  const sources=[];
  for(const family of ['rifle','gunner','smg']){
    const pool=V100_AUDIO_MANIFEST.poolById['weapon-'+family];
    assert.equal(pool.avoidImmediateRepeat,true);
    assert.equal(pool.assetIds.length,2);
    const rows=pool.assetIds.map(id=>V100_AUDIO_MANIFEST.assetById[id]);
    assert.notEqual(rows[0].sources[0].src,rows[1].sources[0].src);
    sources.push(...rows.map(a=>a.sources[0].src));
  }
  assert.equal(new Set(sources).size,6);
  assert.equal(V100_AUDIO_MANIFEST.assetById['weapon-suppressed-pistol'].sources[0].src,'/audio/v104/combat/suppressed-pistol.mp3');
});
test('adopted takes have licensed immutable sources, distinct decoded samples and no clipped or truncated tail',()=>{
  assert.equal(provenance.license,'CC0-1.0');assert.ok(fs.existsSync(provenance.notice));
  const decodedHashes=new Set();
  for(const [id,take]of Object.entries(RECORDED_WEAPON_TAKES)){
    for(const s of V100_AUDIO_MANIFEST.assetById[id].sources){
      const file='public'+s.src,row=provenance.records.find(r=>r.file===file);assert.ok(row,id);
      assert.equal(hash(file),row.sha256);assert.equal(hash(row.source.file),row.source.sha256);
      assert.equal(hash(row.reference.file),row.reference.sha256);
      assert.equal(row.sourceWindowStart,take.start);
      const samples=decode(file),peak=samples.reduce((m,s)=>Math.max(m,Math.abs(s)),0);
      assert.ok(peak>.03&&peak<.95,id+' bounded non-silent shot');
      assert.ok(samples.length/44100>=take.duration&&samples.length/44100<take.duration+.12,id+' single-shot length');
      assert.ok(samples.slice(-220).every(s=>Math.abs(s)<.001),id+' faded tail');
      const activeRms=Math.sqrt(samples.slice(0,8820).reduce((n,s)=>n+s*s,0)/8820);
      assert.ok(activeRms/row.targetActive200msRms>.85&&activeRms/row.targetActive200msRms<1.15,id+' comparable active RMS');
      if(s.type==='audio/mpeg')decodedHashes.add(createHash('sha256').update(Buffer.from(samples.buffer,samples.byteOffset,samples.byteLength)).digest('hex'));
    }
  }
  assert.equal(decodedHashes.size,Object.keys(RECORDED_WEAPON_TAKES).length,'new IDs cannot alias identical samples');
});
