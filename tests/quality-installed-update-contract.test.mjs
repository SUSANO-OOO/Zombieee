import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assertQualityInstalledAssetTransition} from '../scripts/quality-installed-update-contract.mjs';
const historical=sha=>JSON.parse(execFileSync('git',['show',sha+':public/asset-manifest.json'],{maxBuffer:4*1024*1024}));
const delta=JSON.parse(fs.readFileSync('tests/fixtures/quality-20261028-runtime-delta.json'));
const baseline=historical(delta.base),candidate=JSON.parse(fs.readFileSync('public/asset-manifest.json'));
const releases=[['0.9.9.5','55d796cc577d1d9f903a4d2c6b4382196511db27'],['1.0.1','634f8de4b0fb15df902a7dd5983ea94237cfea9d'],['1.0.2','cd246a3d8e93b69d8cb6b370d40f28924a0d86b6'],['1.0.3','99f9c193ab1e35531db39225c839138cdb1c33cd']];
const inputs=releases.map(([oldVersion,sha])=>({oldVersion,oldManifest:historical(sha),baseline,candidate,delta}));
for(const input of inputs)test('installed '+input.oldVersion+' composes its frozen source repairs with the reviewed quality delta',()=>{
 const result=assertQualityInstalledAssetTransition(input);assert.equal(result.baselineAssets,808);assert.equal(result.candidateAssets,807);assert.equal(result.qualityAdded,163);assert.equal(result.qualityRetired,164);
});

test('unapproved paths, transport changes, aliases, missing content and altered historical sources fail closed',()=>{
 const valid=inputs.at(-1),run=changes=>assertQualityInstalledAssetTransition({...valid,...changes});
 const clone=value=>structuredClone(value);
 const missing=clone(candidate);missing.assets=missing.assets.filter(row=>row.path!==delta.added[0].path);assert.throws(()=>run({candidate:missing}));
 const badHash=clone(candidate);badHash.assets.find(row=>row.path===delta.added[0].path).hash='sha256-'+'0'.repeat(64);assert.throws(()=>run({candidate:badHash}));
 const duplicate=clone(candidate);duplicate.assets.push(clone(duplicate.assets[0]));assert.throws(()=>run({candidate:duplicate}));
 const extra=clone(candidate);extra.assets.push({...extra.assets[0],path:'/art/unapproved-alias.webp'});assert.throws(()=>run({candidate:extra}));
 const retained=baseline.assets.find(row=>!delta.retired.some(r=>r.path===row.path));
 for(const [key,value]of[['sourcePath','/unapproved.webp'],['bundlePath','/unapproved.bundle'],['pack','unapproved-test-pack']]){const tampered=clone(candidate);tampered.assets.find(row=>row.path===retained.path)[key]=value;assert.throws(()=>run({candidate:tampered}),key);}
 const alias=candidate.assets.find(row=>candidate.assets.some(other=>other.path!==row.path&&other.hash===row.hash));assert.ok(alias);
 const missingAlias=clone(candidate);missingAlias.assets=missingAlias.assets.filter(row=>row.path!==alias.path);assert.throws(()=>run({candidate:missingAlias}),'shared content does not permit a missing logical alias');
 const changedBase=clone(baseline);changedBase.assets[0].bytes++;assert.throws(()=>run({baseline:changedBase}),/immutable v1.0.5/u);
 const changedOld=clone(valid.oldManifest);changedOld.assets[0].hash='sha256-'+'0'.repeat(64);assert.throws(()=>run({oldManifest:changedOld}));
 const duplicateApproval=clone(delta);duplicateApproval.added.push(clone(delta.added[0]));assert.throws(()=>run({delta:duplicateApproval}));
 const badRetirement=clone(delta);badRetirement.retired[0].hash='sha256-'+'0'.repeat(64);assert.throws(()=>run({delta:badRetirement}));
 const badRelocation=clone(delta);badRelocation.transportChanges[0].next.hash='sha256-'+'0'.repeat(64);assert.throws(()=>run({delta:badRelocation}),/retain content/u);
 const duplicateRelocation=clone(delta);duplicateRelocation.transportChanges.push(clone(delta.transportChanges[0]));assert.throws(()=>run({delta:duplicateRelocation}));
 assert.throws(()=>run({oldVersion:'unknown'}));
});
