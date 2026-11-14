import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GAMEPLAY_PRODUCTION_AUDIO_MANIFEST} from '../app/productionAudio.js';
const folder='assets/source/quality-20261114/kumaverson-attack-b-r1/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const approved='2ce38aef00ef715053a768536a676d5ada111dc94e3ed713e16c362f25038584';
test('producer choice B remains the same Kuma style53 and utterance without replacing the original master',async()=>{
 const choice=JSON.parse(await readFile(folder+'selection.json')),voices=JSON.parse(await readFile('assets/source/v104/combat-audio/voices.json'));
 const rows=voices.cast.filter(v=>v.kind==='kumaverson'&&v.event==='attack');assert.equal(rows.length,1);const row=rows[0];
 assert.equal(choice.selectedCandidate,'compact-fall-b');assert.equal(choice.producerPreferenceAccepted,true);
 assert.equal(row.styleId,53);assert.equal(row.credit,'VOICEVOX:麒ヶ島宗麟');assert.equal(row.text,'せいっ！');
 assert.equal(row.source,folder+'accepted-b.wav');assert.equal(row.sha256,approved);assert.equal(row.engineVersion,'0.25.2');
 const wav=await readFile(row.source);assert.equal(wav.length,33836);assert.equal(sha(wav),approved);
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt32LE(24),48000);assert.equal(wav.readUInt16LE(34),16);
 assert.equal(sha(await readFile(choice.previousCast.source)),choice.previousCast.sha256);
 const query=JSON.parse(await readFile(row.sourceQuery));assert.equal(query.speedScale,1.07);assert.equal(query.pitchScale,0);assert.equal(query.intonationScale,1.04);assert.equal(query.kana,"セ'イッ");
});
test('both game formats come from B while cue identity, event limits and game gain remain unchanged',async()=>{
 const provenance=JSON.parse(await readFile('assets/source/v104/combat-audio/provenance.json')),audit=JSON.parse(await readFile(folder+'render-audit.json'));
 for(const [ext,hash]of [['mp3','e250e4cd98abbf5a73360127f21d1e3238804ad4aae4f74361f4c479015a2472'],['ogg','ad19f71552cba6e0523c1a03a525bd48b59b6ebb8f2f3b94e805785d5baaf7bb']]){
  const file='public/audio/v104/combat/voice-kumaverson-attack.'+ext,bytes=await readFile(file),record=provenance.records.find(r=>r.file===file);
  assert.equal(sha(bytes),hash);assert.equal(record.sha256,hash);assert.equal(record.bytes,bytes.length);assert.equal(record.inputs[0].sha256,approved);
  assert.equal(record.styleId,53);assert.equal(record.credit,'VOICEVOX:麒ヶ島宗麟');assert.equal(record.text,'せいっ！');
 }
 const cue=GAMEPLAY_PRODUCTION_AUDIO_MANIFEST.assets.find(a=>a.id==='voice-kumaverson-attack');
 assert.deepEqual(cue.sources.map(s=>s.src),['/audio/v104/combat/voice-kumaverson-attack.mp3','/audio/v104/combat/voice-kumaverson-attack.ogg']);
 assert.equal(cue.gain,.76);assert.equal(cue.cooldownMs,220);assert.equal(cue.maxInstances,2);assert.equal(cue.priority,68);
 assert.equal(audit.sourceWaveSha256,approved);assert.equal(audit.mp3.samples,audit.reference.samples);assert.equal(audit.mp3.clips,0);assert.ok(audit.correlation>.97);assert.ok(Math.abs(audit.rmsDeltaDbFromFilteredB)<.5);
});