import {withV100BossSkillAudio} from '../app/v100BossSkillAudio.js';
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
import {V100_BOSS_COLLAPSE_AUDIO,V100_BOSS_COLLAPSE_FILES,withV100BossCollapseAudio,selectV100BossCollapsePlayback,v100BossCollapseCue} from '../app/v100BossCollapseAudio.js';
import {PWA_BOSS_COLLAPSE_FILES} from '../app/pwaBossCollapseFiles.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
const kinds=['gate-eater','mother','kurome','ooguchi','gairen','takuya','mugarian-president-mutated','futago','takuya-omega'];
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p);
const policy=a=>Object.fromEntries(Object.entries(a).filter(([key])=>key!=='sources'));
const previous=createAudioManifest(withV100ManualAbilityFoley(withMeleeFoley(withChainsawRecordings(withRecordedWeapons(v100AudioDesignCandidate(PRODUCTION_AUDIO_MANIFEST))))));
const provenance=JSON.parse(read('assets/source/quality-20261116/audio/boss-finales-r1/provenance.json'));
const files=Object.values(V100_BOSS_COLLAPSE_FILES);

test('nine non-vocal materials are added without replacing any original asset, voice, scene, alias or pool',()=>{
  assert.deepEqual(Object.keys(V100_BOSS_COLLAPSE_AUDIO),kinds);
  assert.deepEqual(createAudioManifest(withV100BossSkillAudio(withV100BossCollapseAudio(previous))),V100_AUDIO_MANIFEST);
  assert.equal(V100_AUDIO_MANIFEST.assets.length,previous.assets.length+9+19);
  for(const asset of previous.assets)assert.deepEqual(V100_AUDIO_MANIFEST.assetById[asset.id],asset,asset.id);
  for(const key of ['pools','scenes','aliases'])assert.deepEqual(V100_AUDIO_MANIFEST[key],previous[key]);
  for(const spec of Object.values(V100_BOSS_COLLAPSE_AUDIO)){
    const asset=V100_AUDIO_MANIFEST.assetById[spec.id];
    assert.equal(PRODUCTION_AUDIO_MANIFEST.assetById[spec.id],undefined);
    assert.equal(asset.category,'weapons');assert.equal(asset.preload,'lazy');assert.equal(asset.loop,false);
    assert.equal(asset.gain,.60);assert.equal(asset.priority,96);assert.equal(asset.maxInstances,2);
    assert.ok(V100_AUDIO_MANIFEST.scenes.every(s=>!s.preload.includes(spec.id)),'Only the actual arriving boss is warmed; no nine-boss global preload');
  }
});

test('only an actual V1 session and valid stage can select the corresponding boss material',()=>{
  for(const kind of kinds)for(const stage of [1,3,30])assert.equal(v100BossCollapseCue(kind,stage,true),V100_BOSS_COLLAPSE_AUDIO[kind].id);
  for(const kind of ['walker','constructor','__proto__','unknown',''])assert.equal(v100BossCollapseCue(kind,3,true),null);
  for(const stage of [0,-1,31,3.5,NaN,undefined,'3'])assert.equal(v100BossCollapseCue('takuya',stage,true),null);
  for(const active of [false,undefined,null,0,'false'])assert.equal(v100BossCollapseCue('takuya',3,active),null);
});

test('an old pack, uncommitted cached data and an unconsented or blocked browser use only the retained recorded explosion',()=>{
  const old=JSON.parse(execFileSync('git',['show','9868f75a280c445fb908abf53effaea3834ad1f1:public/asset-manifest.json'],{maxBuffer:4*1024*1024}));
  const cached=new Set([...old.assets.map(a=>a.hash),...files.map(f=>f.hash)]),fallback=V100_AUDIO_MANIFEST.assetById['support-explosion'].sources;
  assert.ok(old.assets.some(a=>a.path===fallback[0].src),'The retained MPEG actually belongs to public1.0.8');
  for(const facts of [{},{installedManifest:old,storedHashes:cached,browserPlayAccepted:true},{browserPlayAccepted:true,gameBlocked:true}]){
    const paths=verifiedPwaArtworkPaths({artworks:V100_BOSS_COLLAPSE_FILES,gameBlocked:false,...facts});assert.equal(paths,'');
    const selected=selectV100BossCollapsePlayback(V100_AUDIO_MANIFEST,paths);
    for(const id of Object.keys(V100_BOSS_COLLAPSE_FILES))assert.deepEqual(selected.assetById[id].sources,fallback);
    for(const asset of previous.assets)assert.deepEqual(selected.assetById[asset.id],V100_AUDIO_MANIFEST.assetById[asset.id]);
  }
});

test('a committed exact MPEG or explicit browser consent selects that file and a retained decoder fallback, never a new uncommitted Ogg',()=>{
  const installed={assets:files.map(f=>({...f}))},cached=new Set(files.map(f=>f.hash));
  for(const facts of [{installedManifest:installed,storedHashes:cached},{browserPlayAccepted:true}]){
    const paths=verifiedPwaArtworkPaths({artworks:V100_BOSS_COLLAPSE_FILES,gameBlocked:false,...facts});
    const selected=selectV100BossCollapsePlayback(V100_AUDIO_MANIFEST,paths);
    for(const [id,file]of Object.entries(V100_BOSS_COLLAPSE_FILES)){
      const asset=selected.assetById[id];assert.equal(asset.sources[0].src,file.path);
      assert.deepEqual(asset.sources.slice(1),V100_AUDIO_MANIFEST.assetById['support-explosion'].sources);
      assert.equal(asset.sources.some(s=>s.src.includes('/boss-finales/')&&s.src.endsWith('.ogg')),false);
      assert.deepEqual(policy(asset),policy(V100_AUDIO_MANIFEST.assetById[id]));
    }
  }
  for(const mode of ['wrong-hash','missing-cache']){
    const manifest=structuredClone(installed),stored=new Set(cached),first=files[0];
    if(mode==='wrong-hash')manifest.assets[0].hash='sha256-'+'0'.repeat(64);else stored.delete(first.hash);
    const paths=verifiedPwaArtworkPaths({artworks:V100_BOSS_COLLAPSE_FILES,installedManifest:manifest,storedHashes:stored,gameBlocked:false});
    const selected=selectV100BossCollapsePlayback(V100_AUDIO_MANIFEST,paths),id=Object.keys(V100_BOSS_COLLAPSE_FILES)[0];
    assert.deepEqual(selected.assetById[id].sources,V100_AUDIO_MANIFEST.assetById['support-explosion'].sources);
  }
});

test('the PWA shell imports only the exact source leaf, and saves every preferred material plus the retained fallback',()=>{
  assert.deepEqual(PWA_BOSS_COLLAPSE_FILES,V100_BOSS_COLLAPSE_FILES);
  const leaf=ts.createSourceFile('pwaBossCollapseFiles.js',read('app/pwaBossCollapseFiles.js').toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.equal(leaf.statements.some(n=>ts.isImportDeclaration(n)||(ts.isExportDeclaration(n)&&n.moduleSpecifier)),false);
  const gate=ts.createSourceFile('PwaGate.tsx',read('app/PwaGate.tsx').toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const imports=gate.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text);
  assert.ok(imports.includes('./pwaBossCollapseFiles.js'));assert.equal(imports.includes('./v100BossCollapseAudio.js'),false);
  const manifest=JSON.parse(read('public/asset-manifest.json'));
  for(const [id,file]of Object.entries(V100_BOSS_COLLAPSE_FILES)){
    const row=manifest.assets.find(a=>a.path===file.path);assert.ok(row);assert.equal(row.hash,file.hash);assert.equal(row.audioChannel,'se');
    assert.equal(row.hash,'sha256-'+hash(read('public'+file.path)));
    assert.ok(INSTALL_AUDIO_ASSETS.some(a=>a.sources[0].src===file.path));assert.equal(row.bundlePath,'/pwa-bundles/audio-v1.bin');
    assert.equal(V100_AUDIO_MANIFEST.assetById[id].sources[0].src,file.path);
  }
});

test('all eighteen codecs retain exact licensed masters, finite unclipped material and a quiet end before the existing finale ends',()=>{
  assert.equal(provenance.license,'CC0-1.0');assert.equal(provenance.records.length,9);
  for(const notice of provenance.notices)assert.equal(hash(read(notice.path)),notice.sha256);
  const signals=new Set();
  for(const row of provenance.records){
    assert.equal(hash(read(row.master.path)),row.master.sha256);
    for(const layer of row.layers)assert.equal(hash(read(layer.path)),layer.sha256);
    assert.deepEqual(row.visualTimeline,{staggerEnd:.18,smallBursts:[.22,.42,.61],mediumBurst:.82,majorBurst:1.03,endsAt:2.6});
    assert.ok(row.layers.some(l=>l.at===1.03));assert.equal(row.duration,2.52);
    for(const file of row.encodings){
      const encoded=read(file.path);assert.equal(hash(encoded),file.sha256);assert.equal(encoded.length,file.bytes);
      const pcm=execFileSync(ffmpeg.path,['-v','error','-i',file.path,'-f','f32le','-ac','1','-ar','48000','pipe:1'],{windowsHide:true,maxBuffer:2*1024*1024});
      let peak=0,last=-1,tail=0,major=0,count=0;
      for(let i=0;i<pcm.length/4;i++){const v=pcm.readFloatLE(i*4);assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>.001)last=i/48000;if(i>=pcm.length/4-480)tail+=v*v;if(i>=49440&&i<62400){major+=v*v;count++;}}
      assert.ok(peak>.03&&peak<.92,file.path);assert.ok(last<2.6);assert.ok(Math.sqrt(tail/480)<.005);
      assert.ok(Math.sqrt(major/count)>.015,'The main collapse contains real signal');
      assert.ok(Math.abs(pcm.length/4/48000-2.52)<.05);signals.add(hash(pcm));
    }
  }
  assert.equal(signals.size,18);
});

const sourceReversions={"app/AshfallGame.tsx":[["\"use client\";\n","\"use client\";\nimport {selectV100BossCollapsePlayback,v100BossCollapseCue} from \"./v100BossCollapseAudio.js\";\n"],["import {PwaManualFoleyPathsContext} from \"./pwaAudioAvailabilityContext.js\";","import {PwaManualFoleyPathsContext,PwaBossCollapsePathsContext} from \"./pwaAudioAvailabilityContext.js\";"],["  const [manualFoleyPathsAtEntry]=useState(()=>verifiedManualFoleyPaths);","  const [manualFoleyPathsAtEntry]=useState(()=>verifiedManualFoleyPaths);\n  const verifiedBossCollapsePaths=useContext(PwaBossCollapsePathsContext);\n  const [bossCollapsePathsAtEntry]=useState(()=>verifiedBossCollapsePaths);"],["? selectV100ManualFoleyPlayback(V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,manualFoleyPathsAtEntry)","? selectV100BossCollapsePlayback(selectV100ManualFoleyPlayback(V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,manualFoleyPathsAtEntry),bossCollapsePathsAtEntry)"],["[externalSessionActive,manualFoleyPathsAtEntry]);","[externalSessionActive,manualFoleyPathsAtEntry,bossCollapsePathsAtEntry]);"],["    if (g.signalIds.includes(receiptId)) return false;\n    g.signalIds.push(receiptId);","    if (g.signalIds.includes(receiptId)) return false;\n    g.signalIds.push(receiptId);\n    const collapseCue = v100BossCollapseCue(kind, g.definition.missionConfig.v100StageNumber, Boolean(externalSessionRef.current));\n    if (collapseCue) void productionMixerRef.current?.preloadAssets([collapseCue], { priority: \"background\" });"],["              label: fighter.kind,\n            });\n          }\n          const defeatCue","              label: fighter.kind,\n            });\n            const collapseCue = v100BossCollapseCue(fighter.kind, g.definition.missionConfig.v100StageNumber, Boolean(externalSessionRef.current));\n            if (collapseCue) playBattleSemanticCue(collapseCue, fighter.x, {\n              semantic: \"boss-collapse-material\",\n              receiptId: \"fighter:\" + fighter.id + \":collapse-material\",\n              ownerId: fighter.id,\n              priority: 96,\n              cooldownMs: 0,\n              volume: .9,\n              maxInstances: 2,\n              dedupeKey: \"boss-collapse-material:\" + fighter.id,\n            });\n          }\n          const defeatCue"]],"app/PwaGate.tsx":[["import {PwaManualFoleyPathsContext} from \"./pwaAudioAvailabilityContext.js\";","import {PwaManualFoleyPathsContext,PwaBossCollapsePathsContext} from \"./pwaAudioAvailabilityContext.js\";"],["import {PWA_MANUAL_FOLEY_FILES} from \"./pwaManualFoleyFiles.js\";","import {PWA_MANUAL_FOLEY_FILES} from \"./pwaManualFoleyFiles.js\";\nimport {PWA_BOSS_COLLAPSE_FILES} from \"./pwaBossCollapseFiles.js\";"],["  const verifiedManualFoleyPaths = verifiedPwaArtworkPaths({\n    artworks: PWA_MANUAL_FOLEY_FILES, installedManifest, storedHashes, gameBlocked: blocking, baseUrl,\n    browserPlayAccepted: offerDismissed && (!standalone || registrationFailureAcknowledged),\n  });","  const verifiedManualFoleyPaths = verifiedPwaArtworkPaths({\n    artworks: PWA_MANUAL_FOLEY_FILES, installedManifest, storedHashes, gameBlocked: blocking, baseUrl,\n    browserPlayAccepted: offerDismissed && (!standalone || registrationFailureAcknowledged),\n  });\n  const verifiedBossCollapsePaths = verifiedPwaArtworkPaths({\n    artworks: PWA_BOSS_COLLAPSE_FILES, installedManifest, storedHashes, gameBlocked: blocking, baseUrl,\n    browserPlayAccepted: offerDismissed && (!standalone || registrationFailureAcknowledged),\n  });"],["      {!blocking && <PwaManualFoleyPathsContext.Provider value={verifiedManualFoleyPaths}><PwaBattleArtworkPathsContext.Provider value={verifiedBattleArtworkPaths}>{children}</PwaBattleArtworkPathsContext.Provider></PwaManualFoleyPathsContext.Provider>}","      {!blocking && <PwaBossCollapsePathsContext.Provider value={verifiedBossCollapsePaths}><PwaManualFoleyPathsContext.Provider value={verifiedManualFoleyPaths}><PwaBattleArtworkPathsContext.Provider value={verifiedBattleArtworkPaths}>{children}</PwaBattleArtworkPathsContext.Provider></PwaManualFoleyPathsContext.Provider></PwaBossCollapsePathsContext.Provider>}"]]};
for(const [file,rules]of Object.entries(sourceReversions))test(file+' retains all previous simulation, voice and save logic except the declared audio insertion',()=>{let restored=read(file).toString('utf8').replaceAll(String.fromCharCode(13,10),String.fromCharCode(10));for(const [viewBefore,viewAfter]of [...(JSON.parse(read("tests/fixtures/phone-pause-field-source-changes.json"))[file]??[])].reverse()){assert.equal(restored.split(viewAfter).length,2,file+" phone view");restored=restored.replace(viewAfter,viewBefore);}for(const [before,after]of [...JSON.parse(read("tests/fixtures/boss-skill-source-changes.json"))[file]].reverse()){assert.equal(restored.split(after).length,2,file+" skill insertion");restored=restored.replace(after,before);}for(const [before,after]of [...rules].reverse()){assert.equal(restored.split(after).length,2,file);restored=restored.replace(after,before);}const previous=execFileSync('git',['show','05b69ccf9dd2921c3e99f023179cc22910fe2912:'+file],{maxBuffer:4*1024*1024}).toString('utf8').replaceAll(String.fromCharCode(13,10),String.fromCharCode(10));assert.equal(restored,previous);});
