import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {battleVoiceReady} from '../app/v104CombatAudio.js';
import {V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST} from '../app/productionAudio.js';
test('weapon fire uses recorded sources in both game entry modes, without a repeated synthetic human imitation',()=>{
 for(const manifest of [V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST]){
  assert.equal(manifest.assetById['weapon-special-kill'].sources[0].src,'/audio/v100/foley/body.mp3','priority kill is an impact, not an extra synthetic gunshot');
  for(const id of ['weapon-suppressed-pistol','ability-babayaga-appraise-shot'])assert.equal(manifest.assetById[id].sources[0].src,'/audio/quality-20261028/babayaga-suppressed-r2.mp3');
  for(const[id,recorded]of [['ability-ranger-precision-shot','weapon-rifle-01'],['ability-gunner-suppression-muzzle','weapon-gunner-01']])assert.deepEqual(manifest.assetById[id].sources,V100_AUDIO_MANIFEST.assetById[recorded].sources);
 }
 for(const kind of ['scout','ranger','brute','brawler','gunner','medic','guardian','engineer','zakimiya','tky','mrs-chiha','miyamoto-musashi','babayaga']){
  const actor={id:1,kind,hp:100};assert.equal(battleVoiceReady(actor,'attack',0,{}),false,kind);
  assert.equal(battleVoiceReady(actor,'hurt',0,{}),true,'real hurt dialogue remains separately owned');
 }
 for(const kind of ['kumaverson','crazy-king','red-panther-smg'])assert.equal(battleVoiceReady({id:2,kind,hp:100},'attack',0,{}),true,'meaningful dedicated bark retains its owner');
});
test('Baba tie pixels belong to the torso and cannot travel with either arm',async()=>{
 const root='assets/source/quality-20261028/babayaga-material-r2/',load=p=>sharp(p).ensureAlpha().raw().toBuffer();
 const ref=await load('assets/source/v100/joints/babayaga-r1/identity-reference.png'),torso=await load(root+'torso-source-frame.png'),upper=await load(root+'far-upper-arm-source-frame.png'),lower=await load(root+'far-forearm-source-frame.png');
 for(const[x,y]of [[253,125],[254,139],[257,158],[260,176],[264,187]]){
  const i=(y*480+x)*4;assert.deepEqual(torso.subarray(i,i+4),ref.subarray(i,i+4),'source tie retained on spine');
  for(const arm of [upper,lower])assert.notDeepEqual(arm.subarray(i,i+4),ref.subarray(i,i+4),'no tie moves on arm');
 }
 const p=JSON.parse(await readFile(root+'provenance.json'));assert.deepEqual(p.outputs.map(x=>x.name),['torso','far-upper-arm','far-forearm','weapon-and-hands']);
});
