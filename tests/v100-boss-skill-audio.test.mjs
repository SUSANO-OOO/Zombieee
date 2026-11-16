import {restorePreGuardSpectacleSource} from './helpers/guard-spectacle-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import ts from 'typescript';
import {createAudioManifest} from '../app/audioManifest.js';
import {PRODUCTION_AUDIO_MANIFEST,V100_AUDIO_MANIFEST,INSTALL_AUDIO_ASSETS} from '../app/productionAudio.js';
import {v100AudioDesignCandidate} from '../app/v100SoundDesign.js';
import {withRecordedWeapons} from '../app/weaponRecordingRecipes.js';
import {withChainsawRecordings} from '../app/chainsawRecordings.js';
import {withMeleeFoley} from '../app/meleeFoleyRecipes.js';
import {withV100ManualAbilityFoley} from '../app/v100ManualAbilityFoley.js';
import {withV100BossCollapseAudio} from '../app/v100BossCollapseAudio.js';
import {V100_BOSS_SKILL_AUDIO,V100_BOSS_SKILL_FILES,withV100BossSkillAudio,selectV100BossSkillPlayback,v100BossSkillCue,v100BossSkillCues} from '../app/v100BossSkillAudio.js';
import {PWA_BOSS_SKILL_FILES} from '../app/pwaBossSkillFiles.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
import {bossDefinitionForEnemyKind} from '../app/bossFoundation.js';
import {BOSS_ANOMALY_TUNING} from '../app/bossAnomalies.js';
import {KUROME_PROTOTYPE_TUNING} from '../app/kuromeBoss.js';
const kinds=['takuya','gate-eater','mother','kurome','ooguchi','gairen','futago','mugarian-president-mutated','takuya-omega'];
const read=p=>fs.readFileSync(p),hash=b=>createHash('sha256').update(b).digest('hex');
const before=createAudioManifest(withV100BossCollapseAudio(withV100ManualAbilityFoley(withMeleeFoley(withChainsawRecordings(withRecordedWeapons(v100AudioDesignCandidate(PRODUCTION_AUDIO_MANIFEST)))))));
const profiles=Object.values(V100_BOSS_SKILL_AUDIO),files=Object.values(V100_BOSS_SKILL_FILES);
const provenance=JSON.parse(read('assets/source/quality-20261116/audio/boss-skills-r1/provenance.json'));
const oldPack=JSON.parse(execFileSync('git',['show','9868f75a280c445fb908abf53effaea3834ad1f1:public/asset-manifest.json'],{maxBuffer:4*1024*1024}));
const policy=a=>Object.fromEntries(Object.entries(a).filter(([key])=>key!=='sources'));

test('nineteen non-vocal skill materials cover all nine bosses without replacing a voice, original source, alias, pool or scene',()=>{
 assert.equal(profiles.length,19);assert.deepEqual([...new Set(profiles.map(p=>p.kind))],kinds);
 assert.deepEqual(createAudioManifest(withV100BossSkillAudio(before)),V100_AUDIO_MANIFEST);
 assert.equal(V100_AUDIO_MANIFEST.assets.length,before.assets.length+19);
 for(const asset of before.assets)assert.deepEqual(V100_AUDIO_MANIFEST.assetById[asset.id],asset,asset.id);
 for(const key of ['pools','aliases','scenes'])assert.deepEqual(V100_AUDIO_MANIFEST[key],before[key]);
 for(const p of profiles){const a=V100_AUDIO_MANIFEST.assetById[p.id];assert.equal(a.category,'weapons');assert.equal(a.preload,'lazy');assert.equal(a.loop,false);assert.equal(a.maxInstances,2);assert.ok(before.assetById[p.fallbackId]);assert.ok(V100_AUDIO_MANIFEST.scenes.every(s=>!s.preload.includes(p.id)));}
});

test('selection requires the exact boss, phase and V1 stage; warm-up is limited to the arriving boss',()=>{
 for(const kind of kinds){const ids=v100BossSkillCues(kind,3,true);assert.equal(ids.length,kind==='gate-eater'?3:2);for(const phase of ['warning','impact'])assert.equal(v100BossSkillCue(kind,phase,3,true),V100_BOSS_SKILL_AUDIO[kind+'-'+phase].id);for(const id of ids)assert.equal(profiles.find(p=>p.id===id).kind,kind);}
 for(const phase of ['attack','constructor','__proto__','',undefined])assert.equal(v100BossSkillCue('takuya',phase,3,true),null);
 for(const kind of ['constructor','__proto__','walker','',undefined])assert.deepEqual(v100BossSkillCues(kind,3,true),[]);
 for(const stage of [0,-1,31,2.5,NaN,'3',undefined])assert.equal(v100BossSkillCue('takuya','warning',stage,true),null);
 for(const active of [false,undefined,null,0,'true'])assert.deepEqual(v100BossSkillCues('takuya',3,active),[]);
 assert.equal(v100BossSkillCue('takuya','release',3,true),null);
});

test('old packs and unaccepted or blocked new data use only actual saved fallback material and preserve every original voice',()=>{
 const stored=new Set([...oldPack.assets.map(a=>a.hash),...files.map(f=>f.hash)]);
 for(const facts of [{},{installedManifest:oldPack,storedHashes:stored,browserPlayAccepted:true},{browserPlayAccepted:true,gameBlocked:true}]){
  const paths=verifiedPwaArtworkPaths({artworks:V100_BOSS_SKILL_FILES,gameBlocked:false,...facts});assert.equal(paths,'');
  const selected=selectV100BossSkillPlayback(V100_AUDIO_MANIFEST,paths);
  for(const p of profiles){const fallback=before.assetById[p.fallbackId].sources;assert.deepEqual(selected.assetById[p.id].sources,fallback);assert.ok(oldPack.assets.some(a=>a.path===fallback[0].src),p.fallbackId);}
  for(const a of before.assets)assert.deepEqual(selected.assetById[a.id],V100_AUDIO_MANIFEST.assetById[a.id]);
 }
});

test('only exact committed MPEG or explicit browser consent enables new skill sources; a missing cache or wrong hash keeps its fallback',()=>{
 const installed={assets:files.map(f=>({...f}))},stored=new Set(files.map(f=>f.hash));
 for(const facts of [{installedManifest:installed,storedHashes:stored},{browserPlayAccepted:true}]){
  const paths=verifiedPwaArtworkPaths({artworks:V100_BOSS_SKILL_FILES,gameBlocked:false,...facts}),selected=selectV100BossSkillPlayback(V100_AUDIO_MANIFEST,paths);
  for(const p of profiles){const a=selected.assetById[p.id],f=V100_BOSS_SKILL_FILES[p.id];assert.equal(a.sources[0].src,f.path);assert.deepEqual(a.sources.slice(1),before.assetById[p.fallbackId].sources);assert.equal(a.sources.some(s=>s.src.includes('/boss-skills/')&&s.src.endsWith('.ogg')),false);assert.deepEqual(policy(a),policy(V100_AUDIO_MANIFEST.assetById[p.id]));}
 }
 for(const mode of ['wrong-hash','missing-cache']){const changed=structuredClone(installed),cached=new Set(stored),first=files[0];if(mode==='wrong-hash')changed.assets[0].hash='sha256-'+'0'.repeat(64);else cached.delete(first.hash);const paths=verifiedPwaArtworkPaths({artworks:V100_BOSS_SKILL_FILES,installedManifest:changed,storedHashes:cached,gameBlocked:false}),selected=selectV100BossSkillPlayback(V100_AUDIO_MANIFEST,paths);assert.deepEqual(selected.assetById[profiles[0].id].sources,before.assetById[profiles[0].fallbackId].sources);}
 const broken={...V100_AUDIO_MANIFEST,assetById:{...V100_AUDIO_MANIFEST.assetById}};delete broken.assetById[profiles[0].fallbackId];assert.throws(()=>selectV100BossSkillPlayback(broken),/Missing retained boss skill material/);
});

test('PWA shell imports only an inert file leaf and saves every exact preferred SE source',()=>{
 assert.deepEqual(PWA_BOSS_SKILL_FILES,V100_BOSS_SKILL_FILES);
 const leaf=ts.createSourceFile('pwaBossSkillFiles.js',read('app/pwaBossSkillFiles.js').toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(leaf.statements.some(n=>ts.isImportDeclaration(n)||(ts.isExportDeclaration(n)&&n.moduleSpecifier)),false);
 const gate=ts.createSourceFile('PwaGate.tsx',read('app/PwaGate.tsx').toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),imports=gate.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text);assert.ok(imports.includes('./pwaBossSkillFiles.js'));assert.equal(imports.includes('./v100BossSkillAudio.js'),false);
 const manifest=JSON.parse(read('public/asset-manifest.json'));
 for(const [id,f]of Object.entries(V100_BOSS_SKILL_FILES)){const row=manifest.assets.find(a=>a.path===f.path);assert.ok(row);assert.equal(row.hash,f.hash);assert.equal(row.hash,'sha256-'+hash(read('public'+f.path)));assert.equal(row.audioChannel,'se');assert.equal(row.bundlePath,'/pwa-bundles/audio-v1.bin');assert.ok(INSTALL_AUDIO_ASSETS.some(a=>a.sources[0].src===f.path));assert.equal(V100_AUDIO_MANIFEST.assetById[id].sources[0].src,f.path);}
});

test('licensed masters and all38 codecs have finite unclipped signal, prompt onset and quiet ends inside the declared warning or effect budget',()=>{
 assert.equal(provenance.license,'CC0-1.0');assert.equal(provenance.records.length,19);for(const n of provenance.notices)assert.equal(hash(read(n.path)),n.sha256);
 const signals=new Set();
 for(const r of provenance.records){assert.equal(hash(read(r.master.path)),r.master.sha256);assert.equal(r.encodings.length,2);for(const l of r.layers){assert.equal(hash(read(l.path)),l.sha256);assert.ok(l.at>=0&&l.at+l.clip<=r.duration+.0001);assert.equal(l.path.includes('voice'),false);}
  const warning=r.kind==='kurome'?KUROME_PROTOTYPE_TUNING.warningSeconds:BOSS_ANOMALY_TUNING[r.kind]?.warningSeconds??bossDefinitionForEnemyKind(r.kind).attackTelegraph.warningSeconds;assert.equal(r.warningWindow,warning);if(r.phase==='warning')assert.ok(r.duration<warning);
  for(const file of r.encodings){const b=read(file.path);assert.equal(hash(b),file.sha256);assert.equal(b.length,file.bytes);const pcm=execFileSync(ffmpeg.path,['-v','error','-i',file.path,'-f','f32le','-ac','1','-ar','48000','pipe:1'],{windowsHide:true,maxBuffer:2*1024*1024});let peak=0,first=-1,last=-1,tail=0,sum=0;for(let i=0;i<pcm.length/4;i++){const v=pcm.readFloatLE(i*4);assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));sum+=v*v;if(Math.abs(v)>.001){if(first<0)first=i/48000;last=i/48000;}if(i>=pcm.length/4-480)tail+=v*v;}assert.ok(peak>.03&&peak<.9,file.path);assert.ok(first>=0&&first<.15,file.path+' onset');assert.ok(last<r.duration+.04);assert.ok(Math.sqrt(sum/(pcm.length/4))>.01);assert.ok(Math.sqrt(tail/480)<.005);assert.ok(Math.abs(pcm.length/4/48000-r.duration)<.05);if(r.phase==='warning')assert.ok(last<warning);signals.add(hash(pcm));}
 }
 assert.equal(signals.size,38);
});

const reversions=JSON.parse(read('tests/fixtures/boss-skill-source-changes.json'));
for(const [file,rules]of Object.entries(reversions))test(file+' retains all previous simulation, separate voices, timestamps and save effects except declared material cue changes',()=>{
 let restored=restorePreGuardSpectacleSource(file,read(file).toString('utf8'));for(const [survivalBefore,survivalAfter]of [...(JSON.parse(read("tests/fixtures/phone-survival-field-source-changes.json"))[file]??[])].reverse()){assert.equal(restored.split(survivalAfter).length,2,file+" survival view");restored=restored.replace(survivalAfter,survivalBefore);}for(const [viewBefore,viewAfter]of [...(JSON.parse(read("tests/fixtures/phone-pause-field-source-changes.json"))[file]??[])].reverse()){assert.equal(restored.split(viewAfter).length,2,file+" phone view");restored=restored.replace(viewAfter,viewBefore);}for(const [a,b]of [...rules].reverse()){assert.equal(restored.split(b).length,2,file);restored=restored.replace(b,a);}const prior=execFileSync('git',['show','fddd2e7e306e84f60ff745b206abc9ae3cbae7d3:'+file],{maxBuffer:4*1024*1024}).toString('utf8').replaceAll(String.fromCharCode(13,10),String.fromCharCode(10));assert.equal(restored,prior);
});
