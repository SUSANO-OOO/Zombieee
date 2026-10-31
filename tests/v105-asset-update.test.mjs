import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {V105_MEDIA_ADDITIONS,V105_MEDIA_RETIREMENTS,V105_ASSET_BYTES_DELTA} from '../scripts/v105-five-corrections-asset-contract.mjs';
import {evaluateUpdate} from '../app/pwaUpdatePlanner.js';
import {correctionCases,canContinueCompletedCorrection,assertCurrentCorrectionPaints} from '../scripts/v105-five-corrections-capture.mjs';

test('the published v105 delta changes exactly six named payloads and its corrections remain installed',async()=>{
  const baseline=JSON.parse(execFileSync('git',['show','e22b134a38409b9d2f86660ee351e616c28fbf44:public/asset-manifest.json'],{encoding:'utf8',maxBuffer:4*1024*1024}));
  // This is a historical release delta, not a ban on later quality updates.
  const current=JSON.parse(execFileSync('git',['show','ff5dba24e88c810182cda1f044bd26dfc3e512c1:public/asset-manifest.json'],{encoding:'utf8',maxBuffer:4*1024*1024}));
  const candidate=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url),'utf8'));
  const kingHead=JSON.parse(await readFile(new URL('../assets/source/quality-20261028/identity/battle-heads-r3/runtime-provenance.json',import.meta.url),'utf8')).entries.find(row=>row.kind==='crazy-king');
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
    const replacement=expected.path==='/art/v105/joints/crazy-king-skirt-r1.webp'?kingHead:null;
    if(replacement){assert.equal(replacement.basePath,expected.path);assert.equal('sha256-'+replacement.baseSha256,expected.hash);}
    const active=replacement?{path:replacement.assetPath,bytes:replacement.bytes,hash:'sha256-'+replacement.sha256,criticality:expected.criticality}:expected;
    const installed=candidate.assets.find(asset=>asset.path===active.path);
    assert.ok(installed,`retained v105 correction ${expected.path}`);
    for(const key of ['bytes','hash','criticality'])assert.equal(installed[key],active[key]);
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

test('a retained assertion failure remains failed while only intact independent capture contexts may continue',()=>{
  const row={status:'failed',file:'original.webm',bytes:100,capture:{failed:null,startAt:1,stopAt:3001}},boundary={pageClosed:false,errorsBefore:0,errorsAfter:1};
  assert.equal(canContinueCompletedCorrection(row,boundary),true);assert.equal(row.status,'failed');
  for(const invalid of [{...row,deadlineExpired:true},{...row,bytes:0},{...row,capture:undefined},
    {...row,capture:{...row.capture,failed:'recorder error'}},{...row,capture:{...row.capture,stopAt:0}}])
    assert.equal(canContinueCompletedCorrection(invalid,boundary),false);
  assert.equal(canContinueCompletedCorrection(row,{...boundary,pageClosed:true}),false);
  assert.equal(canContinueCompletedCorrection(row,{...boundary,fatalErrors:1}),false);
  assert.equal(canContinueCompletedCorrection(row,{...boundary,errorsAfter:2}),false,'A product/page error must not be hidden by continuing');
});

test('ability captures reject vanished/legacy bodies and retain the real Mayo form change',()=>{
  const atlasPaths={'mayo-chan':'normal.webp','mayo-chan-feral':'feral.webp'},owner={id:1,kind:'mayo-chan',hp:100};
  const frame=(n,kind,path)=>({time:n/60,fighters:[{...owner,draw:{renderSequence:n,jointDrawSucceeded:true,renderKind:kind,jointAtlasPath:path}}]});
  const capture={rows:[frame(1,'mayo-chan','normal.webp'),frame(2,'mayo-chan-feral','feral.webp'),frame(3,'mayo-chan','normal.webp')]};
  assert.equal(assertCurrentCorrectionPaints(capture,[1],atlasPaths).actualDistinctOwnerPaints,3);
  for(const draw of [{renderSequence:2},{renderSequence:2,jointDrawSucceeded:false},
    {renderSequence:2,jointDrawSucceeded:true,renderKind:'mayo-chan-feral',jointAtlasPath:'old-body.png'},
    {renderSequence:2,jointDrawSucceeded:true,renderKind:'different-person',jointAtlasPath:'normal.webp'}])
    assert.throws(()=>assertCurrentCorrectionPaints({rows:[capture.rows[0],{time:.2,fighters:[{...owner,draw}]}]},[1],atlasPaths));
});
