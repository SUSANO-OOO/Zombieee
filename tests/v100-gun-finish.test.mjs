import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import ts from 'typescript';
import {createAudioManifest} from '../app/audioManifest.js';
import {V100_AUDIO_MANIFEST,INSTALL_AUDIO_ASSETS} from '../app/productionAudio.js';
import {PWA_GUN_FINISH_FILES as files} from '../app/pwaGunFinishFiles.js';
import {PWA_HACHI_CROWBAR_FILES as crowbarFiles} from '../app/pwaHachiCrowbarFiles.js';
import {PWA_PISTOL_TAKE_FILES as pistolFiles} from '../app/pwaPistolTakeFiles.js';
import {withV100GunFinish,selectV100GunFinishPlayback} from '../app/v100GunFinishAudio.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
const ids=['v104-handgun','weapon-rifle-01','weapon-rifle-02','weapon-gunner-01','weapon-gunner-02','weapon-smg-01','weapon-smg-02','weapon-suppressed-pistol'];
const aliases={'ability-ranger-precision-shot':'weapon-rifle-01','ability-gunner-suppression-muzzle':'weapon-gunner-01','ability-babayaga-appraise-shot':'weapon-suppressed-pistol'};
const sha=b=>createHash('sha256').update(b).digest('hex');
const baseRef='b228ee4a6ae944af4cec62524a4b2dd5b1205946';
const oldJson=p=>JSON.parse(execFileSync('git',['show',baseRef+':'+p],{maxBuffer:8*1024*1024,encoding:'utf8'}));
const allPaths=Object.values(files).map(f=>f.path).join(String.fromCharCode(10));

test('each pistol keeps its cue and falls back until all three distinct recordings are available offline',()=>{
 const installedManifest=JSON.parse(fs.readFileSync('public/asset-manifest.json','utf8'));
 for(const [cue,name] of [['v104-handgun','handgun'],['weapon-suppressed-pistol','suppressed-pistol']]){
  const descriptors=[files[cue],pistolFiles[name+'-02'],pistolFiles[name+'-03']];
  for(const missing of [null,...descriptors]){
   const storedHashes=new Set(descriptors.filter(file=>file!==missing).map(file=>file.hash));
   const allowed=verifiedPwaArtworkPaths({artworks:{...files,...pistolFiles},installedManifest,storedHashes,gameBlocked:false});
   const result=selectV100GunFinishPlayback(V100_AUDIO_MANIFEST,allowed);
   if(missing){assert.ok(result.assetById[cue]);assert.equal(result.poolById[cue],undefined);continue;}
   const pool=result.poolById[cue],base=V100_AUDIO_MANIFEST.assetById[cue];
   assert.equal(pool.avoidImmediateRepeat,true);assert.equal(pool.strategy,'shuffle');
   assert.deepEqual(pool.assetIds.map(id=>result.assetById[id].sources[0].src),descriptors.map(f=>f.path));
   for(const take of pool.assetIds){assert.equal(result.assetById[take].gain,base.gain);assert.equal(result.assetById[take].priority,base.priority);}
   for(const descriptor of descriptors.slice(1)){
    const entry=installedManifest.assets.find(a=>a.path===descriptor.path);
    assert.equal(entry.hash,descriptor.hash);assert.equal(entry.audioChannel,'se');assert.equal(entry.bundlePath,undefined);
    assert.equal('sha256-'+sha(fs.readFileSync('public'+entry.path)),descriptor.hash);
   }
   assert.equal(result.aliasById['enemy-red-panther-commander-attack'].targetId,'v104-handgun');
  }
 }
});

test('eight recorded takes replace only their eleven gun/shot assets and preserve all playback policies',()=>{
 assert.deepEqual(Object.keys(files).sort(),[...ids].sort());
 const before=structuredClone(V100_AUDIO_MANIFEST),candidate=createAudioManifest(withV100GunFinish(V100_AUDIO_MANIFEST));
 const changed=[];
 for(const old of before.assets){const next=candidate.assetById[old.id];assert.ok(next);const file=files[aliases[old.id]??old.id];
  if(file){changed.push(old.id);const{sources:oldSources,...oldPolicy}=old,{sources:newSources,...newPolicy}=next;assert.deepEqual(newPolicy,oldPolicy);assert.equal(newSources[0].src,file.path);assert.deepEqual(newSources.slice(1),oldSources);}
  else assert.deepEqual(next,old,'Unrelated cue '+old.id);
 }
 assert.deepEqual(changed.sort(),[...ids,...Object.keys(aliases)].sort());
 for(const key of ['pools','aliases','scenes'])assert.deepEqual(candidate[key],before[key]);
 assert.deepEqual(V100_AUDIO_MANIFEST,before,'No base mutation');
 const unknown={id:'constructor',sources:[{src:'/audio/original.mp3',type:'audio/mpeg'}]};assert.equal(withV100GunFinish({assets:[unknown]}).assets[0],unknown);
});

test('unverified and partial packs keep exact original gun sources while verified families use their own MPEG',()=>{
 const candidate=createAudioManifest(withV100GunFinish(V100_AUDIO_MANIFEST));
 assert.deepEqual(selectV100GunFinishPlayback(candidate,''),V100_AUDIO_MANIFEST);
 assert.deepEqual(selectV100GunFinishPlayback(V100_AUDIO_MANIFEST,''),V100_AUDIO_MANIFEST);
 for(const id of ids){const selected=selectV100GunFinishPlayback(V100_AUDIO_MANIFEST,files[id].path);for(const old of V100_AUDIO_MANIFEST.assets){const file=files[aliases[old.id]??old.id];const expected=file?.path===files[id].path?[{src:file.path,type:'audio/mpeg'},...old.sources]:old.sources;assert.deepEqual(selected.assetById[old.id].sources,expected);}}
 assert.deepEqual(selectV100GunFinishPlayback(V100_AUDIO_MANIFEST,allPaths),candidate);
});

test('saved hashes and manifest ownership gate new gun files; cached bytes alone and wrong hashes do not authorize them',()=>{
 const pack=JSON.parse(fs.readFileSync('public/asset-manifest.json','utf8'));
 const old=oldJson('public/asset-manifest.json');
 const storedHashes=new Set(pack.assets.map(a=>a.hash));
 const policy={artworks:files,storedHashes,gameBlocked:false,baseUrl:'https://susano-ooo.github.io/Zombieee/'};
 assert.equal(verifiedPwaArtworkPaths({...policy,installedManifest:old}),'');
 assert.equal(verifiedPwaArtworkPaths({...policy,installedManifest:null}),'');
 assert.deepEqual(new Set(verifiedPwaArtworkPaths({...policy,installedManifest:pack}).split(String.fromCharCode(10))),new Set(Object.values(files).map(f=>f.path)));
 const bad=structuredClone(pack),first=Object.values(files)[0];bad.assets.find(a=>a.path===first.path).hash='sha256-'+ '0'.repeat(64);
 const allowed=verifiedPwaArtworkPaths({...policy,installedManifest:bad}).split(String.fromCharCode(10));assert.equal(allowed.includes(first.path),false);assert.equal(allowed.filter(Boolean).length,7);
 assert.equal(verifiedPwaArtworkPaths({...policy,installedManifest:pack,gameBlocked:true}),'');
 assert.deepEqual(new Set(verifiedPwaArtworkPaths({...policy,installedManifest:null,browserPlayAccepted:true}).split(String.fromCharCode(10))),new Set(Object.values(files).map(f=>f.path)));
});

test('Hachi gets two stored crowbar takes while knife attacks and older packs keep their own sounds', () => {
 const pack=JSON.parse(fs.readFileSync('public/asset-manifest.json','utf8'));
 const descriptors=Object.values(crowbarFiles);
 const policy={artworks:crowbarFiles,storedHashes:new Set(descriptors.map(file=>file.hash)),gameBlocked:false};
 const allowed=verifiedPwaArtworkPaths({...policy,installedManifest:pack});
 assert.equal(selectV100GunFinishPlayback(V100_AUDIO_MANIFEST,allowed).poolById['weapon-crowbar'].assetIds.length,2);
 for (const installedManifest of [oldJson('public/asset-manifest.json'), {...pack,assets:pack.assets.filter(file=>file.path!==descriptors[0].path)}]) {
  const verified=verifiedPwaArtworkPaths({...policy,installedManifest});
  assert.deepEqual(selectV100GunFinishPlayback(V100_AUDIO_MANIFEST,verified),V100_AUDIO_MANIFEST);
 }
 const selected=selectV100GunFinishPlayback(V100_AUDIO_MANIFEST,allowed);
 const original=V100_AUDIO_MANIFEST.poolById['weapon-crowbar'];
 const knife=selected.aliasById['enemy-red-panther-knife-attack'];
 const newPool=selected.poolById['weapon-crowbar'];
 assert.deepEqual(newPool.assetIds,Object.keys(crowbarFiles));
 assert.notEqual(knife.targetId,newPool.id);
 assert.deepEqual({...knife,targetId:original.id},V100_AUDIO_MANIFEST.aliasById[knife.id]);
 assert.deepEqual({...selected.poolById[knife.targetId],id:original.id},original);
 assert.deepEqual({...newPool,assetIds:original.assetIds},original);
 for (const [index,id] of newPool.assetIds.entries()) {
  const file=crowbarFiles[id],take=selected.assetById[id],previous=V100_AUDIO_MANIFEST.assetById[original.assetIds[index]];
  const row=pack.assets.find(asset=>asset.path===file.path);
  assert.equal(row.hash,file.hash);
  assert.equal(row.bundlePath,undefined);
  assert.equal('sha256-'+sha(fs.readFileSync('public'+file.path)),file.hash);
  assert.deepEqual(take.sources,[{src:file.path,type:'audio/mpeg'},...previous.sources]);
  assert.deepEqual(selected.assetById[previous.id],previous);
  const decoded=measures(pcm('public'+file.path));
  assert.ok(decoded.onset<.06&&decoded.peak>.20&&decoded.peak<.95&&decoded.clipped===0,id);
 }
});

test('the old 411-file audio pack stays intact before the gun takes and later foley',()=>{
 const old=oldJson('public/pwa-bundles/audio-v1.json'),index=JSON.parse(fs.readFileSync('public/pwa-bundles/audio-v1.json','utf8'));
 assert.equal(Object.keys(old.assets).length,411);assert.equal(INSTALL_AUDIO_ASSETS.length,431);assert.equal(Object.keys(index.assets).length,422);
 assert.deepEqual(INSTALL_AUDIO_ASSETS.slice(422).map(asset=>asset.sources[0].src),[
  '/audio/quality-20261125/voices/human-male-heavy-death-02.wav',
  '/audio/quality-20261125/voices/human-male-heavy-death-01.wav',
  '/audio/quality-20261126/voices/human-male-light-hurt-03.mp3',
  '/audio/quality-20261126/voices/human-male-light-hurt-04.mp3',
  '/audio/quality-20261127/voices/human-male-heavy-hurt-03.mp3',
  '/audio/quality-20261127/voices/human-male-heavy-hurt-04.mp3',
  '/audio/quality-20261127/voices/nao-hurt-01.mp3',
  '/audio/quality-20261127/voices/nao-hurt-02.mp3',
  '/audio/quality-20261127/voices/nao-death.mp3',
 ]);
 assert.deepEqual(Object.keys(index.assets).slice(0,411),Object.keys(old.assets));for(const[path,row]of Object.entries(old.assets))assert.deepEqual(index.assets[path],row,path);
 const body=fs.readFileSync('public/pwa-bundles/audio-v1.bin');assert.equal(sha(body.subarray(0,36151187)),'701142bdb09c8e409ad63c30bd4c29397df90dc9ed0ad92b36a1cce9fbe3130b');
 const manifest=JSON.parse(fs.readFileSync('public/asset-manifest.json','utf8')),previous=oldJson('public/asset-manifest.json');
 for(const row of previous.assets){if(row.path.startsWith('/pwa-bundles/'))continue;const current=manifest.assets.find(a=>a.path===row.path);assert.ok(current);const{bundleLength:oldLength,...oldLogical}=row,{bundleLength:newLength,...newLogical}=current;assert.deepEqual(newLogical,oldLogical,'Prior asset '+row.path);if(oldLength!==undefined){assert.equal(oldLength,old.bytes);assert.equal(newLength,index.bytes,'Transport length follows the appended complete pack');}}
 for(const file of Object.values(files)){const bytes=fs.readFileSync('public'+file.path),packed=index.assets[file.path],entry=manifest.assets.find(a=>a.path===file.path);assert.ok(packed);assert.ok(packed.offset>=old.bytes);assert.equal(packed.hash,file.hash);assert.equal('sha256-'+sha(bytes),file.hash);assert.ok(body.subarray(packed.offset,packed.offset+packed.bytes).equals(bytes));assert.equal(entry.hash,file.hash);assert.equal(entry.audioChannel,'se');assert.equal(entry.bundlePath,'/pwa-bundles/audio-v1.bin');}
});

function pcm(path){const b=execFileSync(ffmpeg.path,['-nostdin','-hide_banner','-loglevel','error','-threads','1','-i',path,'-ar','44100','-ac','1','-f','f32le','pipe:1'],{windowsHide:true,maxBuffer:2*1024*1024});const values=[];for(let i=0;i<b.length;i+=4)values.push(b.readFloatLE(i));return values;}
function measures(a){const peak=a.reduce((m,v)=>Math.max(m,Math.abs(v)),0),rms=x=>Math.sqrt(x.reduce((n,v)=>n+v*v,0)/Math.max(1,x.length));return{samples:a.length,peak,onset:a.findIndex(v=>Math.abs(v)>=Math.max(.001,peak*.04))/44100,active:rms(a.slice(0,8820)),tail:rms(a.slice(-1764)),clipped:a.filter(v=>Math.abs(v)>=.999).length};}

test('the actual eight MPEG files raise the requested active level while preserving single-shot timing and headroom',()=>{
 for(const id of ids){const before=measures(pcm('public'+V100_AUDIO_MANIFEST.assetById[id].sources[0].src)),after=measures(pcm('public'+files[id].path));assert.equal(after.samples,before.samples,id+' duration');assert.ok(Math.abs(after.onset-before.onset)<=.01,id+' onset');assert.ok(after.peak<=.95,id+' headroom');assert.equal(after.clipped,0,id+' clipping');const levelDb=20*Math.log10(after.active/before.active);assert.ok(levelDb>=3.0&&levelDb<=3.5,id+' user-requested active level increase');assert.ok(after.tail<=Math.max(.001,after.active*.12),id+' tail');}
});

test('saved gun metadata remains a leaf and does not bring playback code into the install screen',()=>{
 const leaf=ts.createSourceFile('pwaGunFinishFiles.js',fs.readFileSync('app/pwaGunFinishFiles.js','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(leaf.statements.some(n=>ts.isImportDeclaration(n)||(ts.isExportDeclaration(n)&&n.moduleSpecifier)),false);
 const gate=ts.createSourceFile('PwaGate.tsx',fs.readFileSync('app/PwaGate.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const imports=gate.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text);assert.ok(imports.includes('./pwaGunFinishFiles.js'));assert.equal(imports.includes('./v100GunFinishAudio.js'),false);
});

test('the built install metadata stays outside the audio runtime chunk',()=>{
 const root=new URL('../dist/server/ssr/assets/',import.meta.url);
 const chunks=fs.readdirSync(root).filter(name=>name.endsWith('.js')).map(name=>({name,source:fs.readFileSync(new URL(name,root),'utf8')}));
 for (const leaf of ['pwaGunFinishFiles','pwaHachiCrowbarFiles']) {
  const metadata=chunks.filter(chunk=>chunk.source.includes('//#region app/'+leaf+'.js'));
  assert.ok(metadata.length>0,'Built saved-file metadata must be present: '+leaf);
  for(const chunk of metadata){assert.equal(chunk.source.includes('//#region app/productionAudio.js'),false,'Install metadata cannot be bundled with productionAudio: '+chunk.name);assert.equal(chunk.source.includes('//#region app/audioMixer.js'),false,'Install metadata cannot eagerly import the mixer: '+chunk.name);}
 }
});
