import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {CHAINSAW_RECORDING_CUES,withChainsawRecordings} from '../app/chainsawRecordings.js';
import {V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,PRODUCTION_AUDIO_MANIFEST} from '../app/productionAudio.js';
const provenance=JSON.parse(fs.readFileSync('assets/source/chainsaw-recordings/provenance.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
function decode(file) {const b=execFileSync(ffmpeg.path,['-v','error','-i',file,'-ar','44100','-ac','1','-f','f32le','pipe:1']);return new Float32Array(b.buffer,b.byteOffset,b.length/4);}
test('both gameplay manifests replace all six saw actions and both ability phases without changing playback contracts or voices',()=>{
 const original=structuredClone(PRODUCTION_AUDIO_MANIFEST),result=withChainsawRecordings(PRODUCTION_AUDIO_MANIFEST);
 assert.deepEqual(PRODUCTION_AUDIO_MANIFEST,original);
 const changed=[];
 for(const [i,before] of original.assets.entries()) {
  const after=result.assets[i],name=CHAINSAW_RECORDING_CUES[before.id];
  if(!name){assert.deepEqual(after,before);continue;}
  changed.push(before.id);const {sources:unused,...policy}=before;const {sources,...actual}=after;
  void unused;
  assert.deepEqual(actual,policy);
  for(const manifest of [V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST])assert.deepEqual(manifest.assetById[before.id].sources,sources);
  assert.ok(sources.every(s=>s.src.includes('/weapons/chainsaw/')));
 }
 assert.deepEqual(changed.sort(),Object.keys(CHAINSAW_RECORDING_CUES).sort());
 assert.equal(V100_AUDIO_MANIFEST.assetById['weapon-chainsaw-idle-loop'].loop,true);
});
test('every adopted sound has a licensed original, verified payload and safe decoded level',()=>{
 assert.equal(provenance.license,'CC0-1.0');
 assert.equal(provenance.subjectiveListening,'not performed');
 const decodedHashes=new Set();let checked=0;
 for(const id of Object.keys(CHAINSAW_RECORDING_CUES))for(const s of V100_AUDIO_MANIFEST.assetById[id].sources){
  const file='public'+s.src,row=provenance.records.find(r=>r.file===file);assert.ok(row,id);
  const b=fs.readFileSync(file);assert.equal(hash(b),row.sha256);assert.equal(b.length,row.bytes);
  for(const input of row.inputs)assert.equal(hash(fs.readFileSync(input.file)),input.sha256);
  const a=decode(file);assert.ok(a.length>10000);assert.ok(a.every(Number.isFinite));
  const peak=a.reduce((m,v)=>Math.max(m,Math.abs(v)),0),rms=Math.sqrt(a.reduce((n,v)=>n+v*v,0)/a.length);
  assert.ok(peak<.9);assert.ok(rms>.005);
  if(!id.endsWith('idle-loop'))assert.ok(Math.abs(a.at(-1))<.003,'one-shot fades out');
  if(s.type!=='audio/ogg')decodedHashes.add(hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength)));
  checked++;
 }
 assert.equal(checked,15);assert.equal(decodedHashes.size,8,'each motor/contact/ability phase has its own source adaptation');
});
test('idle PCM repeats across the splice without an encoder gap or high peak',()=>{
 const asset=V100_AUDIO_MANIFEST.assetById['weapon-chainsaw-idle-loop'];
 assert.deepEqual(asset.sources.map(s=>s.type),['audio/wav']);
 const a=decode('public'+asset.sources[0].src);assert.equal(a.length,88200);
 assert.ok(a.reduce((m,v)=>Math.max(m,Math.abs(v)),0)<.181);
 assert.ok(Math.abs(a[0]-a.at(-1))<.003);
 const edges=[...a.slice(-441),...a.slice(0,441)];
 assert.ok(Math.sqrt(edges.reduce((n,v)=>n+v*v,0)/edges.length)>.001,'splice is not padded silence');
});
