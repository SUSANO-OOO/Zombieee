import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {V100_TITLE_VOICE,V100_TITLE_INTRO_END,v100TitleIntroFrame} from "../app/v100TitleIntro.js";
import {V100_TITLE_AUDIO_ADDITION} from "../scripts/v100-release-asset-contract.mjs";
test("the recorded title call is source-bound mono PCM, with its owner and rights retained",async()=>{
 const wave=await readFile(new URL("../public"+V100_TITLE_VOICE.src,import.meta.url));
 const source=JSON.parse(await readFile(new URL("../assets/source/v100/audio/title-call-provenance.json",import.meta.url),"utf8"));
 assert.equal(wave.toString("ascii",0,4),"RIFF");assert.equal(wave.toString("ascii",8,12),"WAVE");
 assert.equal(wave.readUInt16LE(20),1);assert.equal(wave.readUInt16LE(22),1);assert.equal(wave.readUInt32LE(24),44100);assert.equal(wave.readUInt16LE(34),16);
 assert.equal(wave.length,V100_TITLE_VOICE.bytes);assert.equal(createHash("sha256").update(wave).digest("hex"),V100_TITLE_VOICE.sha256);
 assert.equal((wave.length-44)/2/44100,V100_TITLE_VOICE.duration);
 assert.equal(source.author,"K4ITo");assert.equal(source.sourceOriginalDistributed,false);assert.equal(source.processing.speed,1);assert.equal(source.processing.pitch,1);
 assert.equal(source.source.sha256,"e6b455c0b081dea598f2e774e780fea1fb65dcf34894c7bdbeab5e3ed56162ba");
 assert.equal(V100_TITLE_AUDIO_ADDITION.path,V100_TITLE_VOICE.src);assert.equal(V100_TITLE_AUDIO_ADDITION.hash,"sha256-"+V100_TITLE_VOICE.sha256);
 const manifest=JSON.parse(await readFile(new URL("../public/asset-manifest.json",import.meta.url),"utf8"));
 const asset=manifest.assets.find(asset=>asset.path===V100_TITLE_VOICE.src);
 assert.equal(asset.bytes,wave.length);assert.equal(asset.hash,"sha256-"+V100_TITLE_VOICE.sha256);assert.equal(asset.criticality,"optional");assert.equal(asset.audioType,"audio/wav");
});
test("the title rises once, its final red glint is confined to the last word, and controls follow",()=>{
 let previous=0,previousMenu=0,peaks=0,wasOn=false;
 for(let t=0;t<=V100_TITLE_INTRO_END+.1;t+=.01){
  const f=v100TitleIntroFrame(t);
  assert.ok(f.reveal>=previous-1e-10);assert.ok(f.menu>=previousMenu-1e-10);previous=f.reveal;previousMenu=f.menu;
  if(f.flash>0&&!wasOn)peaks++;wasOn=f.flash>0;
  if(f.flash>0)assert.ok(f.elapsed>=2.35&&f.elapsed<=2.98);
  if(t<2.35)assert.equal(f.flash,0);
 }
 assert.equal(peaks,1);assert.equal(v100TitleIntroFrame(V100_TITLE_INTRO_END).menu,1);assert.equal(v100TitleIntroFrame(V100_TITLE_INTRO_END).complete,true);
 assert.equal(v100TitleIntroFrame(100).flash,0);assert.equal(v100TitleIntroFrame(-100).reveal,0);
});
test("reduced motion keeps readable type and removes the pulse and travel",()=>{
 for(const t of [0,.8,2.65,3.65]){
  const f=v100TitleIntroFrame(t,true);assert.equal(f.reveal,1);assert.equal(f.rise,0);assert.equal(f.flash,0);assert.equal(f.menu,1);
 }
});
