import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {V100_BALLISTIC_MATERIAL_ART} from '../app/v100BallisticMaterialArt.js';
import {drawV100BallisticShot} from '../app/v100BallisticVfx.js';
import {clearV100ContactQueue} from '../app/v100CombatVfx.js';
import {weaponProfileForUnit} from '../app/combatPresentation.js';
import {enemyProjectilePresentationFor} from '../app/enemyVfxPresentation.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';

const art=V100_BALLISTIC_MATERIAL_ART.materials,image={complete:true,naturalWidth:768,naturalHeight:512};
const shot=(weapon='ranger')=>({weapon,style:'projectile',side:'human',x:320,y:240,tx:480,ty:260,life:.15,sourceId:1,targetId:2,shotIndex:2,casing:true});
const params=(weapon='ranger',patch={})=>({weapon,x:360,y:245,ux:1,uy:0,p:.25,elapsed:.03,distance:160,weaponProfile:weaponProfileForUnit(weapon),...patch});
function canvas(){
 const calls=[],stack=[];const c={globalAlpha:.73,globalCompositeOperation:'screen',shadowBlur:9,x:0,y:0,rotation:0,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.x,this.y,this.rotation]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.x,this.y,this.rotation]=stack.pop();},
  translate(x,y){this.x+=x;this.y+=y;},rotate(r){this.rotation+=r;},
  drawImage(...args){calls.push({args,x:this.x,y:this.y,rotation:this.rotation,alpha:this.globalAlpha});}};
 return {c,calls,assertRestored(){assert.deepEqual([c.globalAlpha,c.globalCompositeOperation,c.shadowBlur,c.x,c.y,c.rotation],[.73,'screen',9,0,0,0]);assert.equal(stack.length,0);}};
}

test('current rifle, suppressed pistol, SMG and handgun identities select the proper real materials',()=>{
 const kinds={ranger:[1,4,6.8],babayaga:[2,3,5.6],gunner:[1,4,6.8],
  'red-panther-smg':[0,3,6],'red-panther-commander':[0,3,6],crawler:[1,5,8.8]};
 for(const [kind,[glint,caseFrame,bodyWidth]]of Object.entries(kinds)){
  const e=shot(kind),p=params(kind),world={marker:'unchanged'},before=JSON.stringify({e,p,world}),v=canvas();
  const original=Math.random;Math.random=()=>{throw Error('rendering consumed simulation randomness');};
  try{assert.equal(drawV100BallisticShot(v.c,{[art.id]:image},e,p,world),true);}finally{Math.random=original;}
  assert.equal(v.calls.length,2);assert.equal(JSON.stringify({e,p,world}),before);v.assertRestored();
  for(const [index,frame]of [glint,caseFrame].entries()){
   const draw=v.calls[index],a=draw.args;assert.equal(a[0],image);
   assert.deepEqual(a.slice(1,5),[frame%3*256,Math.floor(frame/3)*256,256,256]);
   assert.ok(Math.abs(a[5]+art.frames[frame].anchorX*a[7])<1e-8);
   assert.ok(Math.abs(a[6]+art.frames[frame].anchorY*a[8])<1e-8);assert.ok(draw.alpha>0&&draw.alpha<=.73);
  }
  assert.ok(Math.abs(v.calls[1].args[7]*art.frames[caseFrame].bodyWidthFraction-bodyWidth)<1e-8);
 }
});

test('flight glints follow the actual trajectory, cannot start behind the muzzle and do not linger at impact',()=>{
 const world={},e=shot(),objects={[art.id]:image};
 for(const [ux,uy]of [[1,0],[-1,0],[.6,.8]])for(const p of [.01,.1,.49,.9]){
  const v=canvas(),input=params('ranger',{ux,uy,p});drawV100BallisticShot(v.c,objects,e,input,world);
  const flight=v.calls[0],frame=art.frames[1];
  assert.equal(flight.x,input.x);assert.equal(flight.y,input.y);assert.equal(flight.rotation,Math.atan2(uy,ux));
  assert.ok(flight.args[7]*frame.anchorX<=input.distance*p+1e-9,'full source box does not extend behind the real launch point');
  v.assertRestored();
 }
 const impact=canvas();assert.equal(drawV100BallisticShot(impact.c,objects,e,params('ranger',{p:1,elapsed:.12}),world),true);
 assert.equal(impact.calls.length,0,'actual damage owns hit effects; no frozen dot or invented later splinters');
 const noCase=canvas();drawV100BallisticShot(noCase.c,objects,{...e,casing:false},params(),world);assert.equal(noCase.calls.length,1);
 const invalid=[{p:NaN},{p:-1},{p:1.1},{x:Infinity},{elapsed:-1},{ux:0,uy:0}];
 for(const patch of invalid){const v=canvas();assert.equal(drawV100BallisticShot(v.c,objects,e,params('ranger',patch),world),true);assert.equal(v.calls.length,0);v.assertRestored();}
 for(const life of [0,-1,NaN,Infinity]){const v=canvas();assert.equal(drawV100BallisticShot(v.c,objects,{...e,life},params(),world),true);assert.equal(v.calls.length,0);}
});

test('a missing or late atlas retains painted flight fallback for the battle, and the existing reset enables new material',()=>{
 const fallback={complete:true,naturalWidth:512,naturalHeight:512},world={},objects={'v104-steel':fallback};
 const first=canvas();drawV100BallisticShot(first.c,objects,shot(),params(),world);assert.equal(first.calls.length,1);assert.equal(first.calls[0].args[0],fallback);
 objects[art.id]=image;
 const next=canvas();drawV100BallisticShot(next.c,objects,shot('babayaga'),params('babayaga'),world);assert.equal(next.calls.length,1);assert.equal(next.calls[0].args[0],fallback);
 clearV100ContactQueue(world);
 const reset=canvas();drawV100BallisticShot(reset.c,objects,shot(),params(),world);assert.equal(reset.calls.length,2);assert.ok(reset.calls.every(c=>c.args[0]===image));
 delete objects[art.id];const retained=canvas();drawV100BallisticShot(retained.c,objects,shot(),params(),world);assert.ok(retained.calls.every(c=>c.args[0]===image));
 const separate=canvas();drawV100BallisticShot(separate.c,objects,shot(),params(),{});assert.equal(separate.calls[0].args[0],fallback);
 for(const malformed of [{...image,complete:false},{...image,naturalWidth:0},{...image,naturalHeight:256}]){
  const v=canvas();drawV100BallisticShot(v.c,{'v104-steel':fallback,[art.id]:malformed},shot(),params(),{});assert.equal(v.calls[0].args[0],fallback);
 }
});

test('medical support, crossbow, thrown weapons, blades and infected projectiles cannot acquire firearm material',()=>{
 for(const kind of ['medic','engineer','zakimiya','mrs-chiha','tky','spitter','kurome','guardian']){
  const v=canvas();assert.equal(drawV100BallisticShot(v.c,{[art.id]:image},shot(kind),params(kind),{}),false);assert.equal(v.calls.length,0);
 }
 const v=canvas();assert.equal(drawV100BallisticShot(v.c,{[art.id]:image},{...shot(),style:'melee'},params(),{}),false);
});

test('the actual ordinary-shot consumer selects materials before legacy geometry and retains the live muzzle contract',async()=>{
 const text=await readFile('app/AshfallGame.tsx','utf8'),file=ts.createSourceFile('AshfallGame.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const node=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='drawAuthoredShotVfx');assert.ok(node);
 const executable=ts.transpileModule(node.getText(file)+'\nthis.paint=drawAuthoredShotVfx;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 for(const kind of ['ranger','babayaga','gunner','red-panther-smg','red-panther-commander','crawler'])for(const muzzleOrigin of [{x:334,y:219},null]){
  const muzzles=[],v=canvas(),world={},objects={[art.id]:image},e=shot(kind);
  const scope={drawV100BallisticShot,V100_CONTACT_WEAPONS:[],drawV100Muzzle:(_c,_o,data)=>muzzles.push(data),
   drawCombatRibbon:()=>{throw Error('legacy beam reached')},drawCombatSplinters:()=>{throw Error('legacy hit glyph reached')}};
  runInNewContext(executable,scope);
  assert.equal(scope.paint(v.c,e,{...params(kind),duration:.2,impactProgress:-1,enemyProjectile:enemyProjectilePresentationFor(kind),color:'#b7efff',v100StageObjects:objects,muzzleOrigin,world}),true);
  assert.equal(v.calls.length,2);assert.equal(muzzles.length,muzzleOrigin===null?0:1);
  if(muzzleOrigin){assert.equal(muzzles[0].x,334);assert.equal(muzzles[0].y,219);assert.equal(muzzles[0].weapon,kind);}
  v.assertRestored();
 }
 assert.ok(text.includes('      world:g,'),'the actual world owns visual source choice');
});

test('the actual PWA gate and every V1 plan withhold uncommitted materials without blocking a battle',async()=>{
 const text=await readFile('app/PwaGate.tsx','utf8'),file=ts.createSourceFile('PwaGate.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),declarations=new Map();
 function visit(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer)declarations.set(node.name.text,node.initializer.getText(file));ts.forEachChild(node,visit);}visit(file);
 const manifest={assets:[{path:art.path,hash:art.hash}]},storedHashes=new Set([art.hash]);
 const evaluate=extra=>runInNewContext(declarations.get('verifiedBallisticMaterialPaths'),{verifiedPwaArtworkPaths,V100_BALLISTIC_MATERIAL_ART,
  installedManifest:manifest,storedHashes,blocking:false,baseUrl:'/Zombieee/',offerDismissed:false,standalone:false,registrationFailureAcknowledged:false,...extra});
 assert.equal(evaluate({}),art.path);
 for(const extra of [{installedManifest:{assets:[]}},{storedHashes:new Set()},{blocking:true},
  {installedManifest:{assets:[{path:art.path,hash:'old'}]}},{installedManifest:null}])assert.equal(evaluate({...extra,offerDismissed:extra.installedManifest===null?false:true}),'');
 assert.equal(evaluate({installedManifest:null,offerDismissed:true}),art.path);
 for(const stageId of V100_STAGE_IDS){
  const before=requiredBattleAssetPlan({stageId}),after=requiredBattleAssetPlan({stageId,verifiedBallisticMaterialPaths:[art.path]});
  assert.ok(!before.stageObjects.some(a=>a.id===art.id));assert.ok(!before.paths.includes(art.path));
  assert.ok(after.stageObjects.find(a=>a.id===art.id)?.optional);assert.ok(after.optionalPaths.includes(art.path));assert.ok(!after.paths.includes(art.path));
 }
 const empty=Object.fromEntries([...declarations.keys()].filter(n=>/^verified[A-Z]\w*Paths$/.test(n)&&n!=='verifiedBattleArtworkPaths').map(n=>[n,'']));
 assert.equal(runInNewContext(declarations.get('verifiedBattleArtworkPaths'),{...empty,verifiedBallisticMaterialPaths:art.path}),art.path);
});

test('the selected six-role source reproduces its exact offline material and calibrated data',async()=>{
 execFileSync(process.execPath,['scripts/build-v100-ballistic-materials.mjs','--check'],{timeout:30000});
 const bytes=await readFile('public'+art.path),manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 const row=manifest.assets.find(a=>a.path===art.path);assert.equal(row.bytes,56496);
 assert.equal(row.hash,'sha256-'+createHash('sha256').update(bytes).digest('hex'));assert.equal(row.hash,art.hash);assert.equal(row.criticality,'critical');
 assert.deepEqual(art.frames.map(f=>f.role),['pistol','rifle','suppressed','pistol-case','rifle-case','shell-case']);
});
