import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {evaluateUpdate,verifyUpdatePayload} from '../app/pwaUpdatePlanner.js';

const contract=JSON.parse(await readFile(new URL('./fixtures/quality-20261028-runtime-delta.json',import.meta.url)));
const baseline=JSON.parse(execFileSync('git',['show',contract.base+':public/asset-manifest.json'],{maxBuffer:4*1024*1024}));
const candidate=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url)));
const record=({path,hash,bytes,sourcePath,category,criticality,audioId})=>({path,hash,bytes,...(sourcePath?{sourcePath}:{}),category,criticality,...(audioId?{audioId}:{})});
const ordered=rows=>rows.map(record).sort((a,b)=>a.path.localeCompare(b.path));
function assertDelta(next){
  const before=new Map(baseline.assets.map(a=>[a.path,a])),after=new Map(next.assets.map(a=>[a.path,a]));
  assert.equal(after.size,next.assets.length,'no duplicate paths');
  assert.deepEqual(ordered(next.assets.filter(a=>!before.has(a.path))),ordered(contract.added));
  assert.deepEqual(ordered(baseline.assets.filter(a=>!after.has(a.path))),ordered(contract.retired));
  for(const [path,old] of before)if(after.has(path))assert.deepEqual(record(after.get(path)),record(old),'unrelated payload '+path);
}

test('quality candidate contains exactly the reviewed art and firearm delta while retaining unrelated payloads',async()=>{
  assertDelta(candidate);
  assert.equal(contract.added.length,115);assert.equal(contract.retired.length,116);
  assert.equal(contract.added.reduce((sum,a)=>sum+a.bytes,0),17816963);
  for(const row of contract.added){
    const bytes=await readFile(new URL('../public'+(row.sourcePath??row.path),import.meta.url));
    assert.equal(bytes.length,row.bytes,row.path);
    assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),row.hash,row.path);
    assert.ok(!/assets\/source|reference|写真/u.test(row.path),'private masters stay outside the runtime pack');
  }
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
  assert.deepEqual(ordered(update.diff.downloadable),ordered(contract.added));
  const verify=hashes=>verifyUpdatePayload({manifest:next,storedHashes:hashes,expectedVersion:next.version,expectedReleaseSha:next.releaseSha});
  assert.equal(verify(storedHashes).verified,false);
  const complete=new Set([...storedHashes,...contract.added.map(a=>a.hash)]);
  assert.equal(verify(complete).verified,true);
  for(const row of contract.added){const partial=new Set(complete);partial.delete(row.hash);assert.equal(verify(partial).verified,false,row.path);}
  assert.equal(verifyUpdatePayload({manifest:next,storedHashes:complete,expectedReleaseSha:contract.base}).verified,false);
});
