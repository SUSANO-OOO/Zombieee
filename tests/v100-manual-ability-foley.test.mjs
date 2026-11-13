import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {createAudioManifest} from '../app/audioManifest.js';
import {PRODUCTION_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,V100_AUDIO_MANIFEST,INSTALL_AUDIO_ASSETS} from '../app/productionAudio.js';
import {v100AudioDesignCandidate} from '../app/v100SoundDesign.js';
import {withRecordedWeapons} from '../app/weaponRecordingRecipes.js';
import {withChainsawRecordings} from '../app/chainsawRecordings.js';
import {withMeleeFoley} from '../app/meleeFoleyRecipes.js';
import {V100_MANUAL_ABILITY_FOLEY,V100_MANUAL_FOLEY_FILES,withV100ManualAbilityFoley,selectV100ManualFoleyPlayback} from '../app/v100ManualAbilityFoley.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
import {V099_MANUAL_ABILITY_AUDIO_CONTRACTS} from '../app/battleAudioContracts.js';

const ids=['ability-guardian-shieldwall-activate','ability-medic-emergency-activate'];
const previous=createAudioManifest(withMeleeFoley(withChainsawRecordings(withRecordedWeapons(v100AudioDesignCandidate(PRODUCTION_AUDIO_MANIFEST)))));
const provenance=JSON.parse(fs.readFileSync('assets/source/quality-20261114/audio/manual-foley-r1/provenance.json','utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fileHash=p=>sha(fs.readFileSync(p));

test('the final V1 composition replaces exactly two activation sources and retains every voice, contact cue and playback policy',()=>{
  assert.deepEqual(Object.keys(V100_MANUAL_ABILITY_FOLEY).sort(),ids);
  const changed=[];
  for(const before of previous.assets){
    const after=V100_AUDIO_MANIFEST.assetById[before.id];assert.ok(after);
    if(ids.includes(before.id)){
      changed.push(before.id);
      const {sources:oldSources,...oldPolicy}=before,{sources:newSources,...newPolicy}=after;
      assert.deepEqual(newPolicy,oldPolicy);assert.notDeepEqual(newSources,oldSources);
      assert.deepEqual(GAMEPLAY_PRODUCTION_AUDIO_MANIFEST.assetById[before.id].sources,oldSources,'Legacy source remains available');
      assert.match(newSources[0].src,/^\/audio\/quality-20261114\/manual\//u);
    }else assert.deepEqual(after,before,before.id+' cannot borrow a preparation sound');
  }
  assert.deepEqual(changed.sort(),ids);assert.equal(V100_AUDIO_MANIFEST.assets.length,previous.assets.length);
  for(const key of ['pools','aliases','scenes'])assert.deepEqual(V100_AUDIO_MANIFEST[key],previous[key]);
  assert.equal(V099_MANUAL_ABILITY_AUDIO_CONTRACTS.medic.activationRoot,ids[1]);
  assert.equal(V099_MANUAL_ABILITY_AUDIO_CONTRACTS.guardian.activationRoot,ids[0]);
});

test('the source override does not mutate inputs, change scene policy, or match an unrelated cue',()=>{
  const before=structuredClone(PRODUCTION_AUDIO_MANIFEST),after=withV100ManualAbilityFoley(PRODUCTION_AUDIO_MANIFEST);
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST,before);
  for(const key of Object.keys(before).filter(k=>k!=='assets'))assert.deepEqual(after[key],before[key]);
  const unrelated={id:'constructor',sources:[{src:'/audio/original.mp3',type:'audio/mpeg'}]};
  assert.equal(withV100ManualAbilityFoley({assets:[unrelated]}).assets[0],unrelated);
});

test('the complete offline pack owns both new MPEG cues while retaining each legacy recording',()=>{
  const manifest=JSON.parse(fs.readFileSync('public/asset-manifest.json','utf8'));
  for(const id of ids){
    const source=V100_AUDIO_MANIFEST.assetById[id].sources[0];
    const install=INSTALL_AUDIO_ASSETS.find(a=>a.sources[0].src===source.src);assert.ok(install);
    const entry=manifest.assets.find(a=>a.path===source.src);assert.ok(entry);
    assert.equal(entry.hash,'sha256-'+fileHash('public'+source.src));assert.equal(entry.audioChannel,'se');
    assert.equal(entry.bundlePath,'/pwa-bundles/audio-v1.bin');
    const old=GAMEPLAY_PRODUCTION_AUDIO_MANIFEST.assetById[id].sources[0].src;
    assert.ok(manifest.assets.some(a=>a.path===old),'An installed old generation still has its original cue');
  }
});

test('old committed packs, cached-but-uncommitted new bytes and an unconsented browser keep the original preparation sources',()=>{
  const old=JSON.parse(execFileSync('git',['show','86a0a062ede5e73cc8c327fda9612120ac578c0a:public/asset-manifest.json'],{maxBuffer:4*1024*1024}));
  const stored=new Set([...old.assets.map(a=>a.hash),...Object.values(V100_MANUAL_FOLEY_FILES).map(a=>a.hash)]);
  for(const facts of [{},{installedManifest:old,storedHashes:stored,browserPlayAccepted:true},{browserPlayAccepted:true,gameBlocked:true}]){
    const paths=verifiedPwaArtworkPaths({artworks:V100_MANUAL_FOLEY_FILES,gameBlocked:false,...facts});assert.equal(paths,'');
    const selected=selectV100ManualFoleyPlayback(V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,paths);
    for(const id of ids)assert.deepEqual(selected.assetById[id].sources,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST.assetById[id].sources);
  }
});

test('exact saved MPEG or explicit browser play permits only that source with the original cue as decoder fallback',()=>{
  const files=Object.values(V100_MANUAL_FOLEY_FILES),installed={assets:files.map(f=>({...f}))},stored=new Set(files.map(f=>f.hash));
  for(const facts of [{installedManifest:installed,storedHashes:stored},{browserPlayAccepted:true}]){
    const paths=verifiedPwaArtworkPaths({artworks:V100_MANUAL_FOLEY_FILES,gameBlocked:false,...facts});
    const selected=selectV100ManualFoleyPlayback(V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,paths);
    for(const old of V100_AUDIO_MANIFEST.assets){
      const next=selected.assetById[old.id];
      if(ids.includes(old.id)){
        assert.deepEqual(next.sources,[old.sources[0],...GAMEPLAY_PRODUCTION_AUDIO_MANIFEST.assetById[old.id].sources]);
        assert.equal(next.sources.some(s=>s.src.endsWith('.ogg')),false,'An installed MPEG pack never requests an unaccepted Ogg');
        const {sources:_old,...policy}=old,{sources:_next,...nextPolicy}=next;assert.deepEqual(nextPolicy,policy);
      }else assert.deepEqual(next,old);
    }
  }
  for(const bad of ['wrong-hash','missing-cache']){
    const manifest=structuredClone(installed),hashes=new Set(stored),first=files[0];
    if(bad==='wrong-hash')manifest.assets[0].hash='sha256-'+'0'.repeat(64);else hashes.delete(first.hash);
    const paths=verifiedPwaArtworkPaths({artworks:V100_MANUAL_FOLEY_FILES,installedManifest:manifest,storedHashes:hashes,gameBlocked:false,baseUrl:'https://example.test/Zombieee/'});
    const selected=selectV100ManualFoleyPlayback(V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,paths);
    const id=Object.keys(V100_MANUAL_FOLEY_FILES)[0];assert.deepEqual(selected.assetById[id].sources,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST.assetById[id].sources);
  }
  for(const [id,file]of Object.entries(V100_MANUAL_FOLEY_FILES))assert.equal(file.hash,'sha256-'+fileHash('public'+V100_AUDIO_MANIFEST.assetById[id].sources[0].src));
});

test('both codec choices retain licensed masters, distinct audible signals, original duration bounds and quiet tails',()=>{
  assert.equal(provenance.license,'CC0-1.0');assert.equal(provenance.records.length,2);
  for(const notice of provenance.notices)assert.equal(fileHash(notice.path),notice.sha256);
  const decodedHashes=new Set();
  for(const row of provenance.records){
    assert.equal(fileHash(row.master.path),row.master.sha256);
    assert.equal(fileHash(row.reference.path),row.reference.sha256);
    for(const layer of row.layers)assert.equal(fileHash(layer.path),layer.sha256);
    assert.ok(row.duration<=(row.kind==='medic'?.96:1.02),'Preparation cannot overrun the existing root');
    for(const output of row.encodings){
      assert.equal(fileHash(output.path),output.sha256);assert.equal(fs.statSync(output.path).size,output.bytes);
      const pcm=execFileSync(ffmpeg.path,['-v','error','-i',output.path,'-f','f32le','-ac','1','-ar','48000','pipe:1'],{windowsHide:true,maxBuffer:1024*1024});
      let peak=0,active=0,tail=0;
      for(let i=0;i<pcm.length;i+=4){const s=pcm.readFloatLE(i);assert.ok(Number.isFinite(s));peak=Math.max(peak,Math.abs(s));if(i<4800*4)active+=s*s;if(i>=pcm.length-480*4)tail+=s*s;}
      assert.ok(peak>.03&&peak<.95,output.path+' must decode without silence or clipped peaks');
      assert.ok(Math.sqrt(active/4800)>.005,'The press has an immediate audible preparation');
      assert.ok(Math.sqrt(tail/480)<.005,'No abrupt or sustained electronic tail');
      assert.ok(Math.abs(pcm.length/4/48000-row.duration)<.04,'Codec duration');decodedHashes.add(sha(pcm));
    }
  }
  assert.equal(decodedHashes.size,4,'Characters and codec renditions remain distinct');
});
