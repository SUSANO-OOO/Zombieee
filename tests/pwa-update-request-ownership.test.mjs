import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {partitionPwaUpdateTransportPaths,inspectPwaContentTransportCoverage} from '../scripts/pwa-update-request-ownership.mjs';
const receipt=JSON.parse(await readFile(new URL('./fixtures/pwa-f989-recovery-logical-audio.json',import.meta.url)));
const download=new Set(receipt.repairTransportPaths),logical=new Set(receipt.bundledRuntimeAudioSourcePaths);
test('native f989 recovery keeps a preparation BGM source read separate from exact updater transports',()=>{
 const result=partitionPwaUpdateTransportPaths(receipt.recoveryAssetRequests,download,logical);
 assert.deepEqual(result.unexpected,[]);
 assert.deepEqual(result.runtimeAudio,['/Zombieee/audio/v100/score/preparation.mp3']);
 assert.ok(receipt.sourceAsset.bundlePath&&receipt.sourceAsset.audioChannel==='bgm');
 assert.equal(result.repair.length,receipt.recoveryAssetRequests.length-1);
 assert.equal(result.repair.filter(p=>p==='/Zombieee/pwa-bundles/audio-v1.bin').length,2);
 assert.ok(!download.has(result.runtimeAudio[0]),'The recorded case must reproduce the previous ownership mismatch');
});
test('unknown audio and unbundled paths remain unexpected; updater ownership takes precedence',()=>{
 const unknown=['/Zombieee/audio/v100/score/not-in-manifest.mp3','/Zombieee/audio/unbundled.mp3'];
 const result=partitionPwaUpdateTransportPaths([...unknown,...logical],new Set([...download,...logical]),logical);
 assert.deepEqual(result.unexpected,unknown);assert.deepEqual(result.runtimeAudio,[]);
 assert.deepEqual(result.repair,[...logical],'A path declared as updater transport cannot escape exact updater accounting');
});
test('classification never drops duplicate repairs, successful refetches or extra bundle attempts',()=>{
 const asset=[...download].find(p=>!p.endsWith('/audio-v1.bin')),bundle='/Zombieee/pwa-bundles/audio-v1.bin';
 const requests=[asset,asset,bundle,bundle,bundle,...logical];
 const result=partitionPwaUpdateTransportPaths(requests,download,logical);
 assert.deepEqual(result.repair,requests.slice(0,5));
 assert.equal(result.repair.filter(p=>p===asset).length,2);
 assert.equal(result.repair.filter(p=>p===bundle).length,3);
 assert.equal(result.repair.length+result.runtimeAudio.length+result.unexpected.length,requests.length);
});

const aliases=[{pathname:'/warm.webp',contentKey:'hash:shared'},{pathname:'/determined.webp',contentKey:'hash:shared'}];
test('one verified download covers both identical-content portrait aliases in either request order',()=>{
 for(const path of ['/warm.webp','/determined.webp']){
  const result=inspectPwaContentTransportCoverage([path],aliases);
  assert.equal(result.ok,true);assert.equal(result.expected,1);assert.equal(result.observed,1);
 }
});
test('an alias cannot substitute for a different missing hash or conceal a successful-content refetch',()=>{
 const missing=inspectPwaContentTransportCoverage(['/warm.webp'],[...aliases,{pathname:'/other.webp',contentKey:'hash:other'}]);
 assert.equal(missing.ok,false);assert.deepEqual(missing.missing,['hash:other']);
 for(const paths of [['/warm.webp','/determined.webp'],['/warm.webp','/warm.webp']]){
  const result=inspectPwaContentTransportCoverage(paths,aliases);
  assert.equal(result.ok,false);assert.equal(result.duplicate.length,1);
 }
});
test('bundle retries remain explicit exceptions while unknown paths and ambiguous identities fail closed',()=>{
 const bundle={pathname:'/audio.bin',contentKey:'bundle:/audio.bin'};
 const result=inspectPwaContentTransportCoverage(['/warm.webp','/audio.bin','/audio.bin'],[...aliases,bundle],{repeatablePaths:new Set(['/audio.bin'])});
 assert.equal(result.ok,true);assert.equal(result.expected,2);
 assert.equal(inspectPwaContentTransportCoverage(['/audio.bin','/audio.bin'],[bundle]).ok,false);
 const unknown=inspectPwaContentTransportCoverage(['/warm.webp','/unknown.webp'],aliases);
 assert.equal(unknown.ok,false);assert.deepEqual(unknown.unexpected,['/unknown.webp']);
 assert.throws(()=>inspectPwaContentTransportCoverage([],[...aliases,{pathname:'/warm.webp',contentKey:'hash:other'}]),/Ambiguous/);
});
