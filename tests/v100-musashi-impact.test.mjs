import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import {V100_MANUAL_IMPACT_ART as ART} from '../app/v100ManualImpactArt.js';
import {drawV100MusashiImpact} from '../app/v100ManualImpactVfx.js';
import {queueV100AdvancedAbilityEffect,drawV100AdvancedAbilityEffects,getV100AdvancedAbilityEffectsSnapshot,clearV100AdvancedAbilityEffects} from '../app/v100AdvancedAbilityVfx.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {advanceAreaEffects} from '../app/gameRules.js';

const art=ART['miyamoto-musashi'];
const image=(width=768,height=512)=>({complete:true,naturalWidth:width,naturalHeight:height});
const entry=()=>({ownerId:7,activationId:2,targetId:9,type:'musashi-crosscut',x:370,y:220,duration:.22,direction:1});
function fixture(){const owner={id:7,kind:'miyamoto-musashi',side:'human',hp:135,x:300,y:250,manualAbility:{activationId:2}};return{owner,world:{time:10,definition:{missionConfig:{v100StageNumber:1}},fighters:[owner]}};}
function canvas(){const calls=[],transforms=[],stack=[];const ctx={globalAlpha:.73,globalCompositeOperation:'screen',shadowBlur:3,
 save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
 translate(...a){transforms.push(['translate',...a]);},scale(...a){transforms.push(['scale',...a]);},drawImage(...args){calls.push({args,alpha:this.globalAlpha});}};return{ctx,calls,transforms,stack};}

test('the six smartphone contact phases have exact source, alpha gutters, drifting remnants and the same approved dual-blade body',async()=>{
 const bytes=await readFile('public'+art.path),meta=await sharp(bytes).metadata();
 assert.equal(bytes.length,52570);assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),art.hash);
 assert.deepEqual([meta.width,meta.height,meta.hasAlpha],[768,512,true]);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let cell=0;cell<6;cell++){
  let edge=0,paint=0,transparent=0;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const alpha=data[((Math.floor(cell/3)*256+y)*info.width+cell%3*256+x)*4+3];if(alpha>32)paint++;if(alpha===0)transparent++;if(x<16||x>=240||y<16||y>=240)edge=Math.max(edge,alpha);}
  assert.ok(edge<=32&&paint>0&&transparent>0,'frame '+cell);assert.ok(art.anchors[cell].every(n=>Number.isFinite(n)&&n>0&&n<1));
 }
 for(const anchor of art.anchors.slice(3))assert.deepEqual(anchor,art.anchors[2],'released fragments keep their last ignition origin');
 const provenance=JSON.parse(await readFile('assets/source/quality-20261114/musashi-impact-r1/provenance-r1.json'));
 assert.equal(provenance.logicalBytes,52570);assert.equal(provenance.runtimeAssetCount,1);assert.equal(provenance.estimatedDecodedRgbaBytes,1572864);
 const body=V177_JOINT_ATLASES['miyamoto-musashi'],bodyBytes=await readFile('public'+body.path);
 assert.equal(body.path,provenance.currentBody.path);assert.equal(body.weaponBone,provenance.currentBody.weaponBone);
 assert.equal(createHash('sha256').update(bodyBytes).digest('hex'),provenance.currentBody.sha256);
 assert.equal(ART.brute.hash,'sha256-39fff2d40df64ae92800f98312db40c35aeec72da208b719ac8da462ad5d1c32','Tatara retains its own unchanged material');
});

test('two-frame blending aligns contact cores in both directions, restores state and changes no game data or RNG',()=>{
 for(const direction of [-1,1]){
  const e={...entry(),direction},before=structuredClone(e),source=image(),c=canvas();const random=Math.random;Math.random=()=>{throw Error('Render consumed simulation RNG');};
  try{for(const progress of [.02,.21,.41,.61,.81,.98])assert.equal(drawV100MusashiImpact(c.ctx,{[art.id]:source},e,progress*.22),true);}finally{Math.random=random;}
  assert.deepEqual(e,before);const cells=new Set();
  for(const draw of c.calls){const a=draw.args,cell=a[1]/256+a[2]/256*3;cells.add(cell);assert.equal(a[0],source);assert.deepEqual(a.slice(3,5),[256,256]);assert.deepEqual(a.slice(7),[128,128]);
   assert.ok(Math.abs(a[5]+art.anchors[cell][0]*128)<1e-9&&Math.abs(a[6]+art.anchors[cell][1]*128)<1e-9);assert.ok(draw.alpha>0&&draw.alpha<=.73);}
  assert.equal(cells.size,6);assert.ok(c.calls.at(-1).alpha<c.calls[0].alpha);
  assert.equal(c.transforms.filter(t=>t[0]==='scale').length,direction<0?6:0);
  assert.equal(c.ctx.globalAlpha,.73);assert.equal(c.ctx.globalCompositeOperation,'screen');assert.equal(c.ctx.shadowBlur,3);assert.equal(c.stack.length,0);
  for(const elapsed of [-1,.22,.5,NaN,Infinity])assert.equal(drawV100MusashiImpact(c.ctx,{[art.id]:source},e,elapsed),false);
 }
 for(const patch of [{type:'tky-lightblade'},{x:NaN},{duration:0}])assert.equal(drawV100MusashiImpact({}, {},{...entry(),...patch},0),false);
});

test('the real advanced queue uses physical fallback for missing or invalid art, never the old X, and never swaps an in-flight hit',()=>{
 for(const invalid of [undefined,{...image(),complete:false},image(768,256),image(0,0),image(Infinity,512)]){
  const {world}=fixture(),fallback=image(1536,1024),glyph=image(1536,1024),objects={'v100-contact':fallback,'v100-countercut':glyph,[art.id]:invalid},c=canvas();
  queueV100AdvancedAbilityEffect(world,entry());const before=structuredClone(world),beforeQueue=getV100AdvancedAbilityEffectsSnapshot(world);
  drawV100AdvancedAbilityEffects(c.ctx,objects,world);assert.equal(c.calls.length,1);assert.equal(c.calls[0].args[0],fallback);
  assert.equal(c.calls[0].args[7],90);assert.deepEqual(world,before);assert.deepEqual(getV100AdvancedAbilityEffectsSnapshot(world),beforeQueue);
  const preferred=image();objects[art.id]=preferred;world.time+=.08;drawV100AdvancedAbilityEffects(c.ctx,objects,world);
  assert.ok(c.calls.every(d=>d.args[0]===fallback));
  world.fighters=advanceAreaEffects({fighters:world.fighters,areaEffects:[],seconds:.016}).fighters;world.time+=.3;
  queueV100AdvancedAbilityEffect(world,{...entry(),activationId:3});drawV100AdvancedAbilityEffects(c.ctx,objects,world);
  assert.equal(c.calls.at(-1).args[0],preferred);assert.ok(c.calls.every(d=>d.args[0]!==glyph));
 }
 const {world}=fixture(),c=canvas();queueV100AdvancedAbilityEffect(world,entry());drawV100AdvancedAbilityEffects(c.ctx,{'v100-countercut':image(1536,1024)},world);assert.equal(c.calls.length,0,'a glyph cannot reappear when physical sources are absent');
});

test('the selected image survives lookup removal until the real contact expires, and clearing removes it',()=>{
 const {world}=fixture(),source=image(),objects={[art.id]:source},c=canvas();queueV100AdvancedAbilityEffect(world,entry());drawV100AdvancedAbilityEffects(c.ctx,objects,world);
 delete objects[art.id];world.time+=.1;drawV100AdvancedAbilityEffects(c.ctx,objects,world);assert.ok(c.calls.length>1&&c.calls.every(d=>d.args[0]===source));
 const count=c.calls.length;world.time=10.23;drawV100AdvancedAbilityEffects(c.ctx,objects,world);assert.equal(c.calls.length,count);assert.deepEqual(getV100AdvancedAbilityEffectsSnapshot(world),[]);
 queueV100AdvancedAbilityEffect(world,{...entry(),activationId:3});clearV100AdvancedAbilityEffects(world);drawV100AdvancedAbilityEffects(c.ctx,objects,world);assert.equal(c.calls.length,count);
});

test('only the committed selected formation decodes the new paint, and no current V1 stage decodes the former six-MiB glyph',()=>{
 for(const stageId of V100_STAGE_IDS){const plan=requiredBattleAssetPlan({stageId,formationKinds:['miyamoto-musashi'],verifiedManualImpactPaths:[art.path]});
  assert.ok(plan.optionalPaths.includes(art.path));assert.ok(!plan.paths.includes(art.path));assert.equal(plan.stageObjects.find(a=>a.id===art.id).optional,true);
  assert.ok(!plan.stageObjects.some(a=>a.id==='v100-countercut'));assert.ok(plan.stageObjects.some(a=>a.id==='v100-contact'));
 }
 const options={stageId:V100_STAGE_IDS[0],formationKinds:['miyamoto-musashi'],verifiedManualImpactPaths:[art.path]};
 for(const patch of [{formationKinds:['brute']},{verifiedManualImpactPaths:[]},{includeV100Sprites:false}])assert.ok(!requiredBattleAssetPlan({...options,...patch}).optionalPaths.includes(art.path));
});

test('the actual PWA manual-art gate exposes only each saved exact image and cannot fetch new contact paint from an old or partial pack',async()=>{
 const source=await readFile('app/PwaGate.tsx','utf8'),file=ts.createSourceFile('PwaGate.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='verifiedManualImpactPaths')expression=n.initializer.getText(file);ts.forEachChild(n,visit);}visit(file);assert.ok(expression);
 const evaluate=facts=>runInNewContext(expression,{verifiedPwaArtworkPaths,V100_MANUAL_IMPACT_ART:ART,installedManifest:null,storedHashes:new Set(),blocking:false,baseUrl:'/Zombieee/',offerDismissed:false,standalone:false,registrationFailureAcknowledged:false,...facts});
 assert.equal(evaluate({}),'');assert.equal(evaluate({installedManifest:{assets:[{path:ART.brute.path,hash:ART.brute.hash}]},storedHashes:new Set([ART.brute.hash,art.hash])}),ART.brute.path);
 for(const facts of [{installedManifest:{assets:[{path:art.path,hash:'old'}]},storedHashes:new Set([art.hash])},{installedManifest:{assets:[{path:art.path,hash:art.hash}]}},
  {installedManifest:{assets:[{path:art.path,hash:art.hash}]},storedHashes:new Set([art.hash]),blocking:true}])assert.equal(evaluate(facts),'');
 assert.equal(evaluate({installedManifest:{assets:[{path:art.path,hash:art.hash}]},storedHashes:new Set([art.hash])}),art.path);
 assert.ok(evaluate({offerDismissed:true}).split('\n').includes(art.path));
 const leaf=await readFile('app/v100ManualImpactArt.js','utf8');assert.doesNotMatch(leaf,/^\s*import(?:\s|\{)/mu);
});

test('actual counter and fallback producers preserve damage-owned target positions and both facing directions, existing material sparks and random consumption',async()=>{
 const source=await readFile('app/AshfallGame.tsx','utf8'),file=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),calls=[],counterBlocks=[];let particleFunction;
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='addParticles')particleFunction=n.getText(file);if(ts.isCallExpression(n)&&n.expression.getText(file)==='queueV100AdvancedAbilityEffect'&&n.arguments[1]?.getText(file).includes('"musashi-crosscut"'))calls.push(n.getText(file));
  if(ts.isIfStatement(n)&&n.expression.getText(file)==='counterTarget'&&n.thenStatement.getText(file).includes('queueV100AdvancedAbilityEffect'))counterBlocks.push(n.getText(file));ts.forEachChild(n,visit);}visit(file);assert.equal(calls.length,2);assert.equal(counterBlocks.length,1);assert.ok(particleFunction);
 const execute=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 for(const x of [260,300,370])for(const call of calls){
  const {world,owner}=fixture(),victim={id:9,kind:'walker',side:'zombie',hp:200,x,y:250,stunned:0,flash:0,knock:0};
  const counterProducer=call.includes('counterTarget');runInNewContext(execute(call),{g:world,owner,target:counterProducer?owner:victim,counterTarget:victim,counter:{event:{activationId:2}},queueV100AdvancedAbilityEffect});
  const contact=getV100AdvancedAbilityEffectsSnapshot(world)[0];assert.equal(contact.targetId,9);assert.equal(contact.ownerId,7);assert.equal(contact.x,x);assert.equal(contact.y,220);assert.equal(contact.duration,.22);assert.equal(contact.direction,x>=300?1:-1);
 }
 for(const v1 of [true,false])for(const boss of [true,false])for(const density of [.25,.6,1]){
  const {world,owner}=fixture();world.definition.missionConfig=v1?{v100StageNumber:1}:{};
  const victim={id:9,kind:boss?'takuya':'walker',side:'zombie',boss,hp:200,x:370,y:250,stunned:0,flash:0,knock:0};let randomDraws=0,recorded=0;const math=Object.create(Math);math.random=()=>((++randomDraws*37)%997)/997;world.graphicsEffectDensity=density;world.particles=[];world.renderObjectPools={particles:[]};
  runInNewContext(execute(particleFunction+"\n"+counterBlocks[0]),{g:world,Math:math,PARTICLE_POOL_KEYS:[],RENDER_ARRAY_LIMITS:{particles:512},acquireRenderObject:()=>({}),capRenderObjectsInPlace(){},target:owner,counterTarget:victim,counter:{event:{activationId:2}},MANUAL_ABILITY_REGISTRY,
   isBossFighter:f=>f.boss,noteV102GoreImpact(){},recordUnitDamage:(_g,_kind,n)=>{recorded+=n;},queueV100AdvancedAbilityEffect,addDamageText(){}});
  const expected=88*(boss?1.65:1);assert.ok(Math.abs(victim.hp-(200-expected))<1e-9);assert.equal(recorded,expected);assert.equal(victim.stunned,.9);assert.equal(owner.x,300);const count=Math.max(1,Math.round(18*density));assert.equal(world.particles.length,count);assert.equal(randomDraws,count*4);assert.equal(math.random(),(((count*4+1)*37)%997)/997);
  assert.equal(getV100AdvancedAbilityEffectsSnapshot(world).length,v1?1:0);
 }
});
