import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,V100_AUDIO_MANIFEST,INSTALL_AUDIO_ASSETS,humanVoiceCueForUnit,unitAudioCueFor} from '../app/productionAudio.js';
const provenance=JSON.parse(fs.readFileSync('assets/source/quality-20261116/mayo-recordings/provenance.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected={deploy:'recorded-bark',attack:'recorded-bark',hurt:'recorded-whine',death:'recorded-whine'};
test('Mayo uses recorded Chihuahua reactions in both gameplay manifests with unchanged cue settings',()=>{
 for(const [name,manifest] of [['gameplay',GAMEPLAY_PRODUCTION_AUDIO_MANIFEST],['v100',V100_AUDIO_MANIFEST]]){
  for(const [event,file] of Object.entries(expected)){
   const id=humanVoiceCueForUnit('mayo-chan',event);
   assert.equal(id,event==='death'?'voice-mayo-retreat':`voice-mayo-${event}`);
   assert.equal(unitAudioCueFor('mayo-chan','voice',event),id);
   const asset=manifest.assetById[id];
   assert.deepEqual(asset.sources,[{src:`/audio/quality-20261116/mayo/${file}.wav`,type:'audio/wav'}]);
   const previous=provenance.previousCueSettings[name].find(a=>a.id===id);
   assert.deepEqual(Object.fromEntries(Object.keys(previous).map(key=>[key,asset[key]])),previous);
  }
 }
 assert.equal(humanVoiceCueForUnit('mayo-chan','speech'),null);
});
test('recorded Mayo files decode as mono PCM16 at their full source duration with safe headroom',()=>{
 assert.equal(provenance.license,'CC0-1.0');
 assert.equal(provenance.runtimeAssets.paths,2);
 for(const row of provenance.rows){
  assert.equal(sha(fs.readFileSync(row.source)),row.sourceSha256);
  const wav=fs.readFileSync(row.output);
  assert.equal(sha(wav),row.outputSha256);
  assert.equal(wav.subarray(0,4).toString(),'RIFF');
  assert.equal(wav.subarray(8,16).toString(),'WAVEfmt ');
  assert.equal(wav.readUInt16LE(20),1);
  assert.equal(wav.readUInt16LE(22),1);
  assert.equal(wav.readUInt32LE(24),44100);
  assert.equal(wav.readUInt16LE(34),16);
  assert.equal(wav.readUInt32LE(40),row.samples*2);
  assert.equal(wav.length,44+row.samples*2);
  let peak=0;
  for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i))/32768);
  assert.ok(peak>.70&&peak<=.708);
  assert.equal(row.trim,false);assert.equal(row.pitchShift,false);assert.equal(row.timeStretch,false);
 }
});
test('Mayo recorded and original recovery sounds are both included offline',()=>{
 const installed=new Set(INSTALL_AUDIO_ASSETS.flatMap(a=>a.sources.map(s=>s.src)));
 const legacy=JSON.parse(fs.readFileSync('reference/audio/v090-generated/provenance.json','utf8'));
 for(const id of ['voice-mayo-deploy','voice-mayo-attack','voice-mayo-hurt','voice-mayo-retreat']){
  const original=`/audio/v090/sfx/${id}.wav`;
  assert.ok(installed.has(original));
  const master=legacy.cues.find(c=>c.id===id).finals.find(s=>s.path===`public${original}`);
  assert.equal(sha(fs.readFileSync(`public${original}`)),master.sha256);
 }
 for(const file of ['recorded-bark','recorded-whine'])assert.ok(installed.has(`/audio/quality-20261116/mayo/${file}.wav`));
});
