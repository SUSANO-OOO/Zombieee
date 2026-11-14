import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import {V100_GUARD_IMPACT_ART as ART} from '../app/v100GuardImpactArt.js';
import {drawV100GuardImpact} from '../app/v100GuardImpactVfx.js';
import {drawV100ContactQueue,queueV100GuardContact,getV100GuardContactSnapshot} from '../app/v100CombatVfx.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';

const image=(width=768,height=512)=>({complete:true,naturalWidth:width,naturalHeight:height});
const entry=(kind='kumaverson')=>({metal:true,x:418,y:268,direction:1,duration:.16,
  guardContact:{ownerKind:kind,ownerHp:100,incomingDamage:20,resolvedSocket:true}});
function canvas(){
  const calls=[],stack=[];
  const ctx={globalAlpha:.73,globalCompositeOperation:'screen',shadowBlur:3,
    save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
    restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
    translate(...args){calls.push({type:'translate',args});},scale(...args){calls.push({type:'scale',args});},
    drawImage(...args){calls.push({type:'image',args,alpha:this.globalAlpha,composite:this.globalCompositeOperation,blur:this.shadowBlur});}};
  return {ctx,calls,stack,images:()=>calls.filter(c=>c.type==='image')};
}
function fixture(kind='kumaverson'){
  const owner={id:21,kind,side:'human',hp:100,x:400,manualAbility:{phase:'active',activationId:3,target:{direction:1}}};
  return {world:{time:20,definition:{missionConfig:{v100StageNumber:3}}},
    hit:{owner,attacker:{side:'zombie',x:440},incomingDamage:20,x:418,y:268}};
}

test('both six-phase phone materials have exact content, true alpha, safe gutters and opaque current weapon origins',async()=>{
  const provenance=JSON.parse(await readFile('assets/source/quality-20261114/guard-impact-r1/provenance-r1.json'));
  assert.equal(provenance.runtimeAssetCount,2);assert.equal(provenance.logicalBytes,121296);
  assert.equal(provenance.estimatedDecodedRgbaBytes,3145728);
  let total=0;
  for(const [kind,art]of Object.entries(ART)){
    const bytes=await readFile('public'+art.path);total+=bytes.length;
    assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),art.hash);
    const metadata=await sharp(bytes).metadata();assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[768,512,true]);
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let cell=0;cell<6;cell++){
      let edge=0,visible=0,transparent=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++){
        const alpha=data[((Math.floor(cell/3)*256+y)*info.width+cell%3*256+x)*4+3];
        if(alpha>32)visible++;if(alpha===0)transparent++;
        if(x<16||x>=240||y<16||y>=240)edge=Math.max(edge,alpha);
      }
      assert.ok(edge<=32&&visible>0&&transparent>0,kind+' frame '+cell);
      assert.ok(art.anchors[cell].every(n=>Number.isFinite(n)&&n>0&&n<1));
    }
    const row=provenance.entries.find(e=>e.kind===kind),body=V177_JOINT_ATLASES[kind];
    const source=await readFile('public'+body.path);
    assert.equal(createHash('sha256').update(source).digest('hex'),row.currentBody.sha256);
    assert.equal(body.weaponBone,row.currentBody.weaponBone);assert.deepEqual(body.muzzle,row.currentBody.muzzle);
    const part=body.parts.find(p=>p.bone===body.weaponBone&&p.name==='weapon-and-hands');assert.ok(part);
    const point=body.muzzle.map((n,i)=>part.source[i?'y':'x']+(n-part.destination[i?'y':'x'])/part.destination[i?'h':'w']*part.source[i?'h':'w']);
    const raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.ok(raw.data[(Math.floor(point[1])*raw.info.width+Math.floor(point[0]))*4+3]>=200,kind+' opaque weapon paint');
  }
  assert.equal(total,provenance.logicalBytes);
});

test('each real guard kind selects its own source and keeps all six contact cores on the actual socket',()=>{
  for(const [kind,art]of Object.entries(ART))for(const direction of [-1,1]){
    const e={...entry(kind),direction},source=image(),c=canvas();
    const original=Math.random;Math.random=()=>{throw Error('Rendering consumed simulation RNG');};
    const before=structuredClone(e);
    try{for(let cell=0;cell<6;cell++)assert.equal(drawV100GuardImpact(c.ctx,{[art.id]:source},e,(cell+.2)/6*.16),true);}
    finally{Math.random=original;}
    assert.deepEqual(e,before);assert.equal(c.images().length,6);
    for(const [cell,draw]of c.images().entries()){
      const a=draw.args;assert.equal(a[0],source);assert.deepEqual(a.slice(1,5),[cell%3*256,Math.floor(cell/3)*256,256,256]);
      assert.equal(a[7],art.worldSize);assert.equal(a[8],art.worldSize);
      assert.ok(Math.abs(a[5]+art.anchors[cell][0]*a[7])<1e-9&&Math.abs(a[6]+art.anchors[cell][1]*a[8])<1e-9);
      assert.equal(draw.composite,'source-over');assert.equal(draw.blur,0);assert.ok(draw.alpha>0&&draw.alpha<=.73);
    }
    assert.ok(c.images().at(-1).alpha<c.images()[0].alpha);
    assert.ok(c.calls.filter(x=>x.type==='translate').every(x=>x.args[0]===418&&x.args[1]===268));
    assert.equal(c.calls.filter(x=>x.type==='scale').length,direction<0?6:0);
    assert.equal(c.ctx.globalAlpha,.73);assert.equal(c.ctx.globalCompositeOperation,'screen');assert.equal(c.ctx.shadowBlur,3);assert.equal(c.stack.length,0);
    for(const elapsed of [-1,.16,1,Infinity,NaN])assert.equal(drawV100GuardImpact(c.ctx,{[art.id]:source},e,elapsed),false);
  }
});

test('an unresolved, dead, ownerless, non-metal or malformed contact cannot produce a new flash',()=>{
  const art=ART.kumaverson,source=image();
  const invalid=[{metal:false},{x:NaN},{duration:0},{guardContact:{...entry().guardContact,ownerKind:'brute'}},
    ...[{resolvedSocket:false},{ownerHp:0},{incomingDamage:0}].map(p=>({guardContact:{...entry().guardContact,...p}}))];
  for(const patch of invalid){const c=canvas();assert.equal(drawV100GuardImpact(c.ctx,{[art.id]:source},{...entry(),...patch},0),false);assert.equal(c.images().length,0);}
});

test('missing, undecoded or invalid optional images fall back for the entire real hit and can improve the next hit',()=>{
  for(const kind of Object.keys(ART))for(const optional of [undefined,{...image(),complete:false},image(0,0),image(768,256),image(Infinity,512)]){
    const {world,hit}=fixture(kind),art=ART[kind],objects={'v100-metal-contact':image(1536,1024),[art.id]:optional},c=canvas();
    assert.equal(queueV100GuardContact(world,hit),true);
    drawV100ContactQueue(c.ctx,objects,world,()=>({x:421,y:270}));
    assert.equal(c.images()[0].args[0],objects['v100-metal-contact']);assert.equal(c.images()[0].args[7],54);
    const preferred=image();objects[art.id]=preferred;world.time+=.05;
    drawV100ContactQueue(c.ctx,objects,world,()=>({x:999,y:999}));
    assert.equal(c.images()[1].args[0],objects['v100-metal-contact']);
    assert.equal(getV100GuardContactSnapshot(world)[0].x,421,'first successful socket stays attached to this hit');
    world.time+=.2;queueV100GuardContact(world,hit);
    drawV100ContactQueue(c.ctx,objects,world,()=>({x:428,y:272}));
    assert.equal(c.images().at(-1).args[0],preferred);assert.equal(c.images().at(-1).args[7],art.worldSize);
  }
});

test('the real queue waits for successfully painted weapon contact and retains one selected image until expiry',()=>{
  for(const kind of Object.keys(ART)){
    const {world,hit}=fixture(kind),art=ART[kind],source=image(),objects={[art.id]:source},c=canvas();
    queueV100GuardContact(world,hit);drawV100ContactQueue(c.ctx,objects,world,()=>null);assert.equal(c.images().length,0);
    drawV100ContactQueue(c.ctx,objects,world,()=>({x:430,y:260}));assert.equal(c.images().length,1);
    delete objects[art.id];world.time+=.04;drawV100ContactQueue(c.ctx,objects,world);assert.equal(c.images()[1].args[0],source);
    world.time+=.16;drawV100ContactQueue(c.ctx,objects,world);assert.equal(c.images().length,2);assert.deepEqual(getV100GuardContactSnapshot(world),[]);
  }
});

test('only matching committed guard art in the actual formation is decoded, and it never becomes a battle blocker',()=>{
  for(const [kind,art]of Object.entries(ART)){
    const options={stageId:V100_STAGE_IDS[1],formationKinds:[kind],verifiedGuardImpactPaths:[art.path]};
    const plan=requiredBattleAssetPlan(options),row=plan.stageObjects.find(e=>e.id===art.id);
    assert.equal(row.optional,true);assert.ok(plan.optionalPaths.includes(art.path));assert.ok(!plan.paths.includes(art.path));
    for(const patch of [{formationKinds:['scout']},{verifiedGuardImpactPaths:[]},{includeV100Sprites:false}]){
      const next=requiredBattleAssetPlan({...options,...patch});assert.ok(!next.optionalPaths.includes(art.path));assert.ok(!next.stageObjects.some(e=>e.id===art.id));
    }
    assert.ok(!plan.stageObjects.some(e=>e.id===ART[kind==='guardian'?'kumaverson':'guardian'].id));
  }
});

test('the real install gate withholds old, partial or blocked packs and exposes only committed matching guard artwork',async()=>{
  const source=await readFile('app/PwaGate.tsx','utf8'),file=ts.createSourceFile('PwaGate.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),declarations=new Map();
  function visit(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer)declarations.set(node.name.text,node.initializer.getText(file));ts.forEachChild(node,visit);}visit(file);
  const evaluate=facts=>runInNewContext(declarations.get('verifiedGuardImpactPaths'),{verifiedPwaArtworkPaths,V100_GUARD_IMPACT_ART:ART,
    installedManifest:null,storedHashes:new Set(),blocking:false,baseUrl:'/Zombieee/',offerDismissed:false,standalone:false,registrationFailureAcknowledged:false,...facts});
  const artworks=Object.values(ART),manifest={assets:artworks.map(a=>({path:a.path,hash:a.hash}))},storedHashes=new Set(artworks.map(a=>a.hash));
  assert.equal(evaluate({}),'');assert.equal(evaluate({offerDismissed:true}),artworks.map(a=>a.path).sort().join('\n'));
  assert.equal(evaluate({offerDismissed:true,standalone:true}),'');
  assert.equal(evaluate({offerDismissed:true,standalone:true,registrationFailureAcknowledged:true}),artworks.map(a=>a.path).sort().join('\n'));
  for(const facts of [{installedManifest:{assets:[]},storedHashes},{installedManifest:manifest,storedHashes:new Set()},
    {installedManifest:{assets:artworks.map(a=>({path:a.path,hash:'old'}))},storedHashes},{installedManifest:manifest,storedHashes,blocking:true}])assert.equal(evaluate(facts),'');
  assert.equal(evaluate({installedManifest:manifest,storedHashes}),artworks.map(a=>a.path).sort().join('\n'));
  assert.equal(evaluate({installedManifest:manifest,storedHashes:new Set([artworks[0].hash])}),artworks[0].path);
  const joined=runInNewContext(declarations.get('verifiedBattleArtworkPaths'),{verifiedBossDefeatPaths:'',verifiedBossAttackPaths:'',verifiedManualImpactPaths:'',verifiedParticleMaterialPaths:'',verifiedKingExhaustPaths:'',verifiedGuardImpactPaths:'guard-path'});
  assert.equal(joined,'guard-path');
  const metadata=await readFile('app/v100GuardImpactArt.js','utf8');assert.doesNotMatch(metadata,/^\s*import(?:\s|\{)/mu);
});
