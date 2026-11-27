import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {evaluateUpdate,verifyUpdatePayload} from '../app/pwaUpdatePlanner.js';
import {crewExitTakes} from './fixtures/crew-exit-voices.mjs';

const contract=JSON.parse(await readFile(new URL('./fixtures/quality-20261028-runtime-delta.json',import.meta.url)));
const baseline=JSON.parse(execFileSync('git',['show',contract.base+':public/asset-manifest.json'],{maxBuffer:4*1024*1024}));
const candidate=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url)));
const record=asset=>({...asset});
const ordered=rows=>rows.map(record).sort((a,b)=>a.path.localeCompare(b.path));
function assertDelta(next){
  const before=new Map(baseline.assets.map(a=>[a.path,a])),after=new Map(next.assets.map(a=>[a.path,a]));
  const relocations=new Map([...contract.transportChanges,...contract.contentReplacements].map(row=>[row.path,row]));
  assert.equal(after.size,next.assets.length,'no duplicate paths');
  assert.deepEqual(ordered(next.assets.filter(a=>!before.has(a.path))),ordered(contract.added));
  assert.deepEqual(ordered(baseline.assets.filter(a=>!after.has(a.path))),ordered(contract.retired));
  for(const [path,old] of before)if(after.has(path)){
    const relocation=relocations.get(path);if(relocation)assert.deepEqual(relocation.previous,old,'audio relocation source '+path);
    assert.deepEqual(record(after.get(path)),record(relocation?.next??old),'unrelated payload '+path);
  }
}

test('quality candidate contains exactly the reviewed art, audio and VFX delta while retaining unrelated payloads',async()=>{
  assertDelta(candidate);
  assert.equal(contract.added.length,563);assert.equal(contract.retired.length,166);
  assert.equal(contract.transportChanges.length,344);assert.equal(contract.contentReplacements.length,1);
  assert.equal(contract.added.reduce((sum,a)=>sum+a.bytes,0),55039115);
  for(const row of contract.added){
    const bytes=await readFile(new URL('../public'+(row.sourcePath??row.path),import.meta.url));
    assert.equal(bytes.length,row.bytes,row.path);
    assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),row.hash,row.path);
    assert.ok(!/assets\/source|reference|写真/u.test(row.path),'private masters stay outside the runtime pack');
  }
});

test('every bundled audio range still contains its exact encoded content after the reviewed bundle relocation',async()=>{
 const bundles=new Map();let checked=0;
 for(const row of candidate.assets.filter(row=>row.bundlePath)){
  if(!bundles.has(row.bundlePath))bundles.set(row.bundlePath,await readFile(new URL('../public'+row.bundlePath,import.meta.url)));
  const bytes=bundles.get(row.bundlePath);assert.equal(row.bundleLength,bytes.length);assert.equal(row.bundleBytes,row.bytes);
  assert.ok(Number.isSafeInteger(row.bundleOffset)&&row.bundleOffset>=0&&row.bundleOffset+row.bundleBytes<=bytes.length);
  assert.equal('sha256-'+createHash('sha256').update(bytes.subarray(row.bundleOffset,row.bundleOffset+row.bundleBytes)).digest('hex'),row.hash,row.path);checked++;
 }
 assert.equal(checked,646);
 const directAudio=manifest=>manifest.assets.filter(row=>row.category==='audio'&&!row.bundlePath);
 const alternateFiles=contract.added.filter(row=>row.category==='audio'&&!row.bundlePath);
 assert.deepEqual(alternateFiles.map(row=>row.path),[
  '/audio/v060/sfx/enemy-runner-hurt-02.ogg',
  '/audio/v060/sfx/enemy-turned-hurt-01.ogg',
  '/audio/v060/sfx/enemy-turned-hurt-02.ogg',
  '/audio/v060/sfx/human-male-light-attack-01.ogg',
  '/audio/v100/foley/treatment.ogg',
  '/audio/v104/combat/armor-hit.ogg',
  '/audio/quality-20261125/voices/human-male-heavy-death-01.wav',
  '/audio/quality-20261125/voices/human-male-heavy-death-02.wav',
  '/audio/quality-20261126/foley/hachi-crowbar-01.mp3',
  '/audio/quality-20261126/foley/hachi-crowbar-02.mp3',
  '/audio/quality-20261126/voices/human-male-light-hurt-03.mp3',
  '/audio/quality-20261126/voices/human-male-light-hurt-04.mp3',
  '/audio/quality-20261127/voices/human-male-heavy-hurt-03.mp3',
  '/audio/quality-20261127/voices/human-male-heavy-hurt-04.mp3',
  '/audio/quality-20261127/voices/nao-death.mp3',
  '/audio/quality-20261127/voices/nao-hurt-01.mp3',
  '/audio/quality-20261127/voices/nao-hurt-02.mp3',
  '/audio/quality-20261127/firearms/handgun-02.mp3',
  '/audio/quality-20261127/firearms/handgun-03.mp3',
  '/audio/quality-20261127/firearms/suppressed-pistol-02.mp3',
  '/audio/quality-20261127/firearms/suppressed-pistol-03.mp3',
  '/audio/quality-20261127/chiha/chiha-salvo-final.mp3',
  '/audio/quality-20261127/chiha/chiha-salvo-impact.mp3',
  '/audio/quality-20261127/chiha/chiha-salvo-launch-a.mp3',
  '/audio/quality-20261127/chiha/chiha-salvo-launch-b.mp3',
  '/audio/quality-20261127/manual-strikes/ability-ranger-precision-impact.mp3',
  '/audio/quality-20261127/manual-strikes/ability-ranger-precision-shot.mp3',
  '/audio/quality-20261127/manual-strikes/ability-scout-intercept-impact.mp3',
  '/audio/quality-20261127/melee-effort/crazy-king-attack-02.mp3',
  '/audio/quality-20261127/melee-effort/crazy-king-attack-03.mp3',
  '/audio/quality-20261127/melee-effort/kumaverson-attack-02.mp3',
  '/audio/quality-20261127/melee-effort/kumaverson-attack-03.mp3',
  '/audio/quality-20261127/voices/field-reaction-03.mp3',
  ...crewExitTakes.map(take=>take.path).sort(),
 ]);
 assert.deepEqual(ordered(directAudio(candidate)),ordered([...directAudio(baseline),...alternateFiles]));
});

test('missing or changed new art, stale portraits and unreviewed unrelated replacements fail closed',()=>{
  for(const row of contract.added){
    const missing=structuredClone(candidate);missing.assets=missing.assets.filter(a=>a.path!==row.path);assert.throws(()=>assertDelta(missing),row.path);
    const changed=structuredClone(candidate);changed.assets.find(a=>a.path===row.path).hash='sha256-'+'0'.repeat(64);assert.throws(()=>assertDelta(changed),row.path);
  }
  for(const row of contract.retired){const stale=structuredClone(candidate);stale.assets.push(row);assert.throws(()=>assertDelta(stale),row.path);}
  const changed=structuredClone(candidate);changed.assets.find(a=>baseline.assets.some(b=>b.path===a.path)).bytes++;assert.throws(()=>assertDelta(changed));
});

test('installed v105 reuses retained hashes and cannot activate a partial quality pack',()=>{
  // Local simulation only: no version, tag or deployed manifest is changed.
  const installed={...baseline,releaseSha:contract.base},next={...candidate,releaseSha:contract.source};
  const storedHashes=new Set(baseline.assets.map(a=>a.hash));
  const update=evaluateUpdate({installedManifest:installed,publishedManifest:next,storedHashes});
  assert.equal(update.available,true);
  const downloads=[...contract.added,...contract.contentReplacements.map(row=>row.next)];
  assert.deepEqual(ordered(update.diff.downloadable),ordered(downloads));assert.equal(downloads.length,564);
  const verify=hashes=>verifyUpdatePayload({manifest:next,storedHashes:hashes,expectedVersion:next.version,expectedReleaseSha:next.releaseSha});
  assert.equal(verify(storedHashes).verified,false);
  const complete=new Set([...storedHashes,...downloads.map(a=>a.hash)]);
  assert.equal(verify(complete).verified,true);
  for(const row of downloads){const partial=new Set(complete);partial.delete(row.hash);assert.equal(verify(partial).verified,false,row.path);}
  assert.equal(verifyUpdatePayload({manifest:next,storedHashes:complete,expectedReleaseSha:contract.base}).verified,false);
});

test('only the producer-selected Kuma retained payload changes; every other retained encoded payload stays exact',()=>{
 const before=new Map(baseline.assets.map(r=>[r.path,r])),path='/audio/v104/combat/voice-kumaverson-attack.mp3';
 const changes=candidate.assets.filter(r=>before.has(r.path)&&(r.hash!==before.get(r.path).hash||r.bytes!==before.get(r.path).bytes));
 assert.deepEqual(changes.map(r=>r.path),[path]);
 assert.equal(before.get(path).hash,'sha256-7a52a049f2dd6acc27a2df86d11037ac9152c4f26364e4f06b568a25db7a0f33');
 assert.equal(changes[0].hash,'sha256-e250e4cd98abbf5a73360127f21d1e3238804ad4aae4f74361f4c479015a2472');assert.equal(changes[0].bytes,3221);
 assert.deepEqual(contract.contentReplacements.map(r=>r.path),[path]);
 for(const row of contract.transportChanges){assert.equal(row.next.hash,row.previous.hash,row.path);assert.equal(row.next.bytes,row.previous.bytes,row.path);}
 const wrong=structuredClone(candidate);wrong.assets.find(r=>r.path===path).hash=before.get(path).hash;assert.throws(()=>assertDelta(wrong));
});

test('late effects and recordings append without moving or replacing older files',()=>{
  const pinned='0aee66adbe961afea7ed70b558cf468f0357d616';
  const oldManifest=JSON.parse(execFileSync('git',['show',pinned+':public/asset-manifest.json'],{maxBuffer:4*1024*1024}));
  const retained=new Map(candidate.assets.map(asset=>[asset.path,asset]));
  const added=candidate.assets.filter(asset=>asset.bundlePath!='/pwa-bundles/audio-fallback-v1.bin'&&!oldManifest.assets.some(old=>old.path===asset.path));
  assert.deepEqual(added.map(asset=>asset.path).sort(),[
    '/art/quality-20261126/vfx/hachi-intercept-six-r1.webp',
    '/art/quality-20261126/vfx/incendiary-drum-column-six-r1.webp',
    '/art/quality-20261127/vfx/late-boss-floor-r1.webp',
    '/art/v102/combat-gore/ground-stains-r1.webp',
    '/audio/quality-20261121/station-mud/floor-mud-impact-r1.mp3',
    '/audio/quality-20261121/station-mud/floor-mud-warning-r1.mp3',
    '/audio/quality-20261124/manual/pan-guard-contact.mp3',
    '/audio/quality-20261125/voices/human-male-heavy-death-01.wav',
    '/audio/quality-20261125/voices/human-male-heavy-death-02.wav',
    '/audio/quality-20261126/foley/hachi-crowbar-01.mp3',
    '/audio/quality-20261126/foley/hachi-crowbar-02.mp3',
    '/audio/quality-20261126/voices/human-male-light-hurt-03.mp3',
    '/audio/quality-20261126/voices/human-male-light-hurt-04.mp3',
    '/audio/quality-20261127/chiha/chiha-salvo-final.mp3',
    '/audio/quality-20261127/chiha/chiha-salvo-impact.mp3',
    '/audio/quality-20261127/chiha/chiha-salvo-launch-a.mp3',
    '/audio/quality-20261127/chiha/chiha-salvo-launch-b.mp3',
    ...crewExitTakes.map(take=>take.path).sort(),
    '/audio/quality-20261127/firearms/handgun-02.mp3',
    '/audio/quality-20261127/firearms/handgun-03.mp3',
    '/audio/quality-20261127/firearms/suppressed-pistol-02.mp3',
    '/audio/quality-20261127/firearms/suppressed-pistol-03.mp3',
    '/audio/quality-20261127/manual-strikes/ability-ranger-precision-impact.mp3',
    '/audio/quality-20261127/manual-strikes/ability-ranger-precision-shot.mp3',
    '/audio/quality-20261127/manual-strikes/ability-scout-intercept-impact.mp3',
    '/audio/quality-20261127/melee-effort/crazy-king-attack-02.mp3',
    '/audio/quality-20261127/melee-effort/crazy-king-attack-03.mp3',
    '/audio/quality-20261127/melee-effort/kumaverson-attack-02.mp3',
    '/audio/quality-20261127/melee-effort/kumaverson-attack-03.mp3',
    '/audio/quality-20261127/voices/field-reaction-03.mp3',
    '/audio/quality-20261127/voices/human-male-heavy-hurt-03.mp3',
    '/audio/quality-20261127/voices/human-male-heavy-hurt-04.mp3',
    '/audio/quality-20261127/voices/nao-death.mp3',
    '/audio/quality-20261127/voices/nao-hurt-01.mp3',
    '/audio/quality-20261127/voices/nao-hurt-02.mp3',
    '/audio/v060/sfx/enemy-runner-hurt-02.ogg',
    '/audio/v060/sfx/enemy-turned-hurt-01.ogg',
    '/audio/v060/sfx/enemy-turned-hurt-02.ogg',
    '/audio/v060/sfx/human-male-light-attack-01.ogg',
  ]);
  for(const asset of oldManifest.assets){
    const next=retained.get(asset.path);
    const expected=asset.bundlePath==='/pwa-bundles/audio-v1.bin'?{...asset,bundleLength:asset.bundleLength+20717}:asset;
    assert.deepEqual(next,expected,asset.path);
  }
  const foley=added.filter(asset=>asset.bundlePath==='/pwa-bundles/audio-v1.bin');
  assert.equal(foley.reduce((n,asset)=>n+asset.bytes,0),20717);
  assert.ok(foley.every(asset=>asset.bundleOffset>=36220919));
});
