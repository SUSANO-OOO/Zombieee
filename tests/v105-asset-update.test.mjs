import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {V105_MEDIA_ADDITIONS,V105_MEDIA_RETIREMENTS,V105_ASSET_BYTES_DELTA} from '../scripts/v105-five-corrections-asset-contract.mjs';
import {evaluateUpdate} from '../app/pwaUpdatePlanner.js';
import {correctionCases} from '../scripts/v105-five-corrections-capture.mjs';

test('v105 changes exactly six named runtime payloads and retires only the previous skirt/icon selection',async()=>{
  const baseline=JSON.parse(execFileSync('git',['show','e22b134a38409b9d2f86660ee351e616c28fbf44:public/asset-manifest.json'],{encoding:'utf8',maxBuffer:4*1024*1024}));
  const current=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url),'utf8'));
  const before=new Map(baseline.assets.map(a=>[a.path,a])),after=new Map(current.assets.map(a=>[a.path,a]));
  assert.equal(baseline.version,'1.0.4');assert.equal(current.version,'1.0.5');
  const newPaths=current.assets.filter(a=>!before.has(a.path)).map(a=>a.path).sort();
  assert.deepEqual(newPaths,V105_MEDIA_ADDITIONS.map(a=>a.path).sort());
  assert.deepEqual(baseline.assets.filter(a=>!after.has(a.path)).map(a=>a.path).sort(),V105_MEDIA_RETIREMENTS.map(a=>a.path).sort());
  for(const [p,a]of before)if(after.has(p))assert.equal(after.get(p).hash,a.hash,'unrelated payload '+p);
  for(const expected of V105_MEDIA_ADDITIONS){
    const actual=after.get(expected.path),bytes=await readFile(new URL('../public'+expected.path,import.meta.url));
    assert.equal(actual.bytes,expected.bytes);assert.equal(bytes.length,expected.bytes);
    assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),expected.hash);
    assert.equal(actual.hash,expected.hash);assert.equal(actual.criticality,expected.criticality);
  }
  assert.equal(current.assets.reduce((n,a)=>n+a.bytes,0)-baseline.assets.reduce((n,a)=>n+a.bytes,0),V105_ASSET_BYTES_DELTA);
  const update=evaluateUpdate({installedManifest:baseline,publishedManifest:current,storedHashes:new Set(baseline.assets.map(a=>a.hash))});
  assert.equal(update.downloadCount,6);assert.equal(update.downloadBytes,100221);assert.equal(update.removedCount,2);
  for(const path of ['/art/v105/combat-vfx/fist-wave-r1.webp','/art/v105/joints/crazy-king-skirt-r1.webp']){
    const {data,info}=await sharp(await readFile(new URL('../public'+path,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.channels,4);assert.ok(data.some((v,i)=>i%4===3&&v===0));assert.ok(data.some((v,i)=>i%4===3&&v>128));
  }
});
test('correction capture covers changed action owners and both short mobile layouts, without a 48 by 21 cross-product',()=>{
  const desktop=correctionCases('desktop');assert.equal(desktop.filter(c=>c.mode==='manual').length,16);
  assert.equal(desktop.filter(c=>c.mode==='engage').length,9);assert.equal(desktop.filter(c=>c.mode==='enemy').length,17);
  assert.deepEqual(correctionCases('mobile390'),correctionCases('mobile340'));
  assert.throws(()=>correctionCases('all-states'));
});
