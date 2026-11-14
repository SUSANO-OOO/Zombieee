import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import {V100_BOSSES} from '../app/v100Registry.js';
import {V100_BOSS_DOSSIER_ART,V100_BOSS_DOSSIER_FRAMING} from '../app/v100BossDossierArt.js';
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

test('operation-photo cameras are bound to the exact nine images and keep upper paint inside short and taller phone photos',async()=>{
  assert.deepEqual(Object.keys(V100_BOSS_DOSSIER_FRAMING).sort(),V100_BOSSES.map(b=>b.id).sort());
  for(const [id,art]of Object.entries(V100_BOSS_DOSSIER_ART)){
    const frame=V100_BOSS_DOSSIER_FRAMING[id],bytes=await read('public'+art.path);
    assert.equal(frame.hash,'sha256-'+sha(bytes));
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let top=info.height,bottom=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y);}
    for(const [w,h]of [[69,44],[100,44],[134,120]]){
      const renderedWidth=Math.min((w-8)*frame.widthFit,h*frame.heightFit),scale=renderedWidth/info.width;
      const origin={x:w/2-renderedWidth*frame.centerX,y:3-renderedWidth*info.height/info.width*frame.top};
      assert.ok(Number.isFinite(scale)&&scale>0);
      assert.ok(Math.abs(origin.y+top*scale-3)<1e-8,'Transparent padding must not push the figure below the photo');
      for(let y=top;y<top+Math.ceil((bottom-top+1)*.4);y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){
        const px=origin.x+x*scale,py=origin.y+y*scale;
        assert.ok(px>=3&&px<=w-3,id+' upper paint must fit horizontally, including both current twins');
        assert.ok(py>=2.99&&py<=h,id+' upper paint must remain vertically visible');
      }
    }
  }
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
