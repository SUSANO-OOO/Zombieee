import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {partitionPwaUpdateTransportPaths} from '../scripts/pwa-update-request-ownership.mjs';
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
