import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import {V100_BOSSES} from '../app/v100Registry.js';
import {V100_BOSS_DOSSIER_ART} from '../app/v100BossDossierArt.js';
import {V100_UI_MATERIAL_ART} from '../app/v100PreparationArt.js';
import {canUseVerifiedPwaArtwork} from '../app/pwaArtworkAvailability.js';

const read=file=>readFile(new URL('../'+file,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const assets=Object.values(V100_BOSS_DOSSIER_ART);
const active=rows=>({assets:rows});

test('all nine current boss dossiers are registered, source-bound and compact; Futago keeps two separate bodies',async()=>{
  const manifest=JSON.parse(await read('public/asset-manifest.json'));
  const provenance=JSON.parse(await read('assets/source/quality-20261114/boss-dossiers/provenance.json'));
  assert.deepEqual(Object.keys(V100_BOSS_DOSSIER_ART).sort(),V100_BOSSES.map(b=>b.id).sort());
  assert.equal(provenance.entries.length,9);
  let bytes=0;
  for(const entry of provenance.entries){
    const art=V100_BOSS_DOSSIER_ART[entry.id],row=manifest.assets.find(a=>a.path===art.path);
    assert.ok(row);assert.equal(row.hash,art.hash);assert.equal(row.category,'boss');
    const buffer=await read('public'+art.path),metadata=await sharp(buffer).metadata();
    assert.equal(sha(buffer),entry.sha256);assert.equal(art.hash,'sha256-'+entry.sha256);
    assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[256,288,true]);
    assert.equal(buffer.length,entry.bytes);bytes+=buffer.length;
    for(const input of entry.inputs){
      assert.equal(sha(await read(input.source)),input.sourceSha256,'Original identity is preserved');
      assert.equal(sha(await read('public'+input.currentTexture.path)),input.currentTexture.sha256);
    }
  }
  assert.equal(provenance.logicalBytes,bytes);assert.equal(provenance.estimatedDecodedRgbaBytes,9*256*288*4);
  const twins=provenance.entries.find(e=>e.id==='boss-futago');
  assert.deepEqual(twins.inputs.map(i=>i.kind),['futago-separated-a','futago-separated-b']);
  assert.ok(twins.inputs.every(i=>!i.currentTexture.path.endsWith('/futago-r1.webp')),'The legacy fused body is not a current V1 dossier');
});

const gateSource=await readFile(new URL('../app/PwaGate.tsx',import.meta.url),'utf8');
const parsed=ts.createSourceFile('PwaGate.tsx',gateSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const effects=[];
function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(parsed)==='useEffect'&&node.arguments[0]?.getText(parsed).includes('dataset.pwaBossDossiers'))effects.push(node.arguments[0]);
  ts.forEachChild(node,visit);
}
visit(parsed);assert.equal(effects.length,1,'One actual PwaGate effect owns the artwork readiness');
function runGate(options){
  const dataset={};
  const cleanup=vm.runInNewContext('('+effects[0].getText(parsed)+')()',{
    canUseVerifiedPwaArtwork,V100_UI_MATERIAL_ART,V100_BOSS_DOSSIER_ART,
    installedManifest:null,storedHashes:new Set(),blocking:false,baseUrl:'/',
    offerDismissed:false,standalone:false,registrationFailureAcknowledged:false,
    ...options,document:{documentElement:{dataset}},
  });
  const value={...dataset};cleanup();assert.deepEqual(dataset,{},'Unmount clears both CSS permissions');return value;
}

test('actual PwaGate keeps dossier CSS disabled for old, partial, wrong or blocked installed artwork',()=>{
  const rows=[V100_UI_MATERIAL_ART,...assets],storedHashes=new Set(rows.map(a=>a.hash));
  assert.equal(runGate({installedManifest:active(rows),storedHashes}).pwaBossDossiers,'ready');
  const negatives=[
    {installedManifest:active([V100_UI_MATERIAL_ART]),offerDismissed:true},
    {installedManifest:active(rows),storedHashes:new Set(rows.slice(0,-1).map(a=>a.hash))},
    {installedManifest:active(rows.slice(0,-1))},
    {installedManifest:active(rows.map((a,i)=>i===1?{...a,hash:'old-content'}:a))},
    {installedManifest:active(rows.map((a,i)=>i===1?{...a,path:'/different.webp'}:a))},
    {installedManifest:active(rows),blocking:true},
  ];
  for(const options of negatives)assert.equal(runGate({storedHashes,...options}).pwaBossDossiers,'deferred');
  assert.equal(runGate({installedManifest:active([V100_UI_MATERIAL_ART]),storedHashes}).pwaUiMaterials,'ready','Existing artwork is not withheld by the new family');
});

test('new dossier CSS needs explicit browser play without an installed generation and respects the Pages prefix',()=>{
  assert.equal(runGate({}).pwaBossDossiers,'deferred');
  assert.equal(runGate({offerDismissed:true}).pwaBossDossiers,'ready');
  assert.equal(runGate({offerDismissed:true,blocking:true}).pwaBossDossiers,'deferred');
  assert.equal(runGate({offerDismissed:true,standalone:true}).pwaBossDossiers,'deferred');
  assert.equal(runGate({offerDismissed:true,standalone:true,registrationFailureAcknowledged:true}).pwaBossDossiers,'ready');
  const rows=[V100_UI_MATERIAL_ART,...assets],storedHashes=new Set(rows.map(a=>a.hash));
  assert.equal(runGate({installedManifest:active(rows),storedHashes,baseUrl:'https://example.test/Zombieee/'}).pwaBossDossiers,'ready');
});
