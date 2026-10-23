import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { V177_JOINT_ATLASES, v177JointPose } from '../app/v177JointPresentation.js';
import { V177_CORPSE_JOINT_DATA } from '../app/v177CorpseJointData.js';
import { createV177CorpseJointState, sampleV177CorpseJointState, rememberV177CorpseJointPose,
  pruneV177CorpseJointPoses, v177LiveJointGroundLift, v177CorpseJointPresentation } from '../app/v177CorpseJointPresentation.js';
import { v102CorpseSeverPlan } from '../app/v102CombatGore.js';
import { V177_JOINT_ASSET_ADDITIONS } from '../scripts/v177-joint-asset-contract.mjs';
import {V104_RUNTIME_ADDITIONS}from'../scripts/v104-combat-asset-contract.mjs';
import { buildV177CorpseJointData } from '../scripts/build-v177-corpse-joints.mjs';
import { jointCorpseRenderFixture } from './helpers/v177-corpse-joint-render.mjs';
import { assertJointCorpsePaint } from '../scripts/v177-reaction-render-contract.mjs';

const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const pixels=new Map();
async function sourcePixels(kind){
  if(!pixels.has(kind))pixels.set(kind,await sharp('public'+V177_JOINT_ATLASES[kind].path).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
  return pixels.get(kind);
}

// Independent full-bitmap oracle: transform every alpha>=8 source texel's
// farthest corner. It does not use the generated hull or its support function.
async function paintedBottom(state,sample,fragment=false,onlyParts=null){
  const {data,info}=await sourcePixels(state.kind),reference=state.atlas.referenceFrame;
  const ax=state.width/reference.width/reference.scale,ay=state.height/reference.height/reference.scale;
  const view=[ax,0,0,ay,-state.width*state.frame.anchorX-ax*reference.tx,-state.height*state.frame.anchorY-ay*reference.ty];
  const root=fragment?sample.fragment.matrix:sample.matrix,matrices=fragment?state.initialMatrices:sample.matrices;let bottom=-Infinity;
  for(const [i,part]of state.atlas.parts.entries()){
    if(onlyParts&&!onlyParts.has(part.name))continue;
    if(fragment?!state.owned?.has(part.name):state.owned?.has(part.name))continue;
    const s=part.source,d=part.destination;
    const matrix=multiply(root,multiply(view,multiply(matrices[i],[d.w/s.w,0,0,d.h/s.h,d.x,d.y])));
    const dx=matrix[1]>=0?1:0,dy=matrix[3]>=0?1:0;
    for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++)if(data[((s.y+y)*info.width+s.x+x)*4+3]>=8)
      bottom=Math.max(bottom,matrix[1]*(x+dx)+matrix[3]*(y+dy)+matrix[5]);
  }
  return bottom;
}

test('backward Omega rest lowers both original boots and blade beside its bulky body in either facing',async()=>{
  const native=JSON.parse(fs.readFileSync('tests/fixtures/v177-4a3-omega-floor.json','utf8'));
  for(const flipX of [false,true])for(const style of [null,'crush','cut']){
    const fallDirection=flipX?1:-1,fixture=jointCorpseRenderFixture(native.form,{flipX,fallDirection});
    const plan=v177JointPose(native.form,{requestedState:'idle'},{locomotionPhase:0,locomotionSettle:1});
    const live={...fixture.live,plan,width:native.renderWidth,height:native.renderHeight,root:{...fixture.live.root,x:native.x,y:native.y}};
    live.root.y-=v177LiveJointGroundLift(native.form,plan,{...live,...live.root},native.y+5);
    const state=createV177CorpseJointState(native.form,live,{fallDirection,severPlan:style?{style,direction:1,at:4}:null});
    const sample=sampleV177CorpseJointState(state,{progress:1,x:native.x,y:native.y,age:1.15});
    for(const name of ['far-boot','near-boot','cleaver-and-hand']){
      const gap=sample.floor-await paintedBottom(state,sample,state.owned?.has(name),new Set([name]));
      assert.ok(gap>=-1e-8&&gap<=5,'an original boot/blade cannot remain held in the air after collapse: '+name+' gap='+gap);
    }
    const torsoGap=sample.floor-await paintedBottom(state,sample,false,new Set(['torso']));
    assert.ok(torsoGap<=35,'folded original tubes must let the main body settle closer to the floor');
    const atlas=state.atlas,pivot=atlas.interpolationPivots['back-tubes'];
    for(const progress of [0,.25,.5,.75,1]){
      const p=sampleV177CorpseJointState(state,{progress,x:native.x,y:native.y,age:progress*1.15});
      const tube=p.matrices[atlas.parts.findIndex(part=>part.name==='back-tubes')],spine=p.matrices[atlas.parts.findIndex(part=>part.name==='torso')];
      const point=m=>[m[0]*pivot[0]+m[2]*pivot[1]+m[4],m[1]*pivot[0]+m[3]*pivot[1]+m[5]],a=point(tube),b=point(spine);
      assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])/atlas.referenceFrame.scale<=.001,'the original tube hinge stays attached through the complete fall');
    }
  }
});

test('native corpse evidence rejects a detached tube even when its floor and rigid part lengths remain valid',()=>{
  const fixture=jointCorpseRenderFixture('takuya-omega',{flipX:true,fallDirection:1,style:'crush'});
  const receipt=fixture.render(1).receipt,wound=fixture.effects().wounds.find(w=>w.targetId===7);
  assertJointCorpsePaint('takuya-omega',receipt,fixture.corpse,wound,true);
  // At a quarter turn this moves the tube along the floor, leaving its vertical support unchanged.
  receipt.corpseJointParts.find(part=>part.name==='back-tubes').matrix[5]+=1;
  assert.throws(()=>assertJointCorpsePaint('takuya-omega',receipt,fixture.corpse,wound,true),/tube.*attachment/u);
});

test('the actual 1280px Omega incoming-damage size cannot carry its sole below the floor',async()=>{
  const native=JSON.parse(fs.readFileSync('tests/fixtures/v177-4a3-omega-floor.json','utf8'));
  const fixture=jointCorpseRenderFixture(native.form,{flipX:native.flipX,fallDirection:native.fallDirection});
  const live={...fixture.live,width:native.renderWidth,height:native.renderHeight,
    plan:v177JointPose(native.form,{requestedState:'idle'},{locomotionPhase:0,locomotionSettle:1}),
    root:{...fixture.live.root,x:native.x,y:native.y}};
  assert.equal(live.frame.anchorX,native.anchor.x);assert.equal(live.frame.anchorY,native.anchor.y);
  assert.equal(live.plan.lowerIndex,native.lowerFrame);assert.equal(live.plan.upperIndex,native.upperFrame);
  const lift=v177LiveJointGroundLift(native.form,live.plan,{...live,...live.root},native.y+5);
  assert.ok(lift>=0&&lift<1,'the R2 source retains the exact native size and needs at most the original subpixel correction');
  live.root.y-=lift;
  const state=createV177CorpseJointState(native.form,live,{fallDirection:native.fallDirection,
    severPlan:{style:native.severStyle,direction:native.severDirection,at:4}});
  const first=sampleV177CorpseJointState(state,{progress:0,x:native.x,y:native.y,age:0});
  assert.deepEqual(first.root,live.root,'grounding the living body prevents a position jump at death');
  const sample=sampleV177CorpseJointState(state,{progress:native.fallProgress,x:native.x,y:native.y,age:1/60});
  const bottom=await paintedBottom(state,sample);
  assert.ok(bottom<=sample.floor+1e-8,'the original source texels at the failed native size must not sink');
});

test('the actual living renderer applies grounding before its sockets, draw and remembered pose',()=>{
  const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
  const parsed=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const draw=parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='drawSpriteFighter');
  let bob;const consumers=new Map();function visit(n){
    if(ts.isVariableDeclaration(n)&&n.name.getText(parsed)==='bob')bob=n;
    if(ts.isCallExpression(n)&&['v177RenderedJointWeaponSocket','ctx.translate','rememberV177CorpseJointPose'].includes(n.expression.getText(parsed)))
      if(!consumers.has(n.expression.getText(parsed)))consumers.set(n.expression.getText(parsed),n);
    ts.forEachChild(n,visit);
  }visit(draw);
  assert.ok(bob,'exercise the actual live draw offset');
  const native=JSON.parse(fs.readFileSync('tests/fixtures/v177-4a3-omega-floor.json','utf8'));
  const plan=v177JointPose(native.form,{requestedState:'idle'},{locomotionPhase:0,locomotionSettle:1});
  const fixture=jointCorpseRenderFixture(native.form);
  const sourceBottom=v177LiveJointGroundLift(native.form,plan,{frame:fixture.live.frame,width:native.renderWidth,height:native.renderHeight,x:native.x,y:native.y,angle:0,scaleX:1,scaleY:1,flipX:native.flipX},0);
  const baseBob=sourceBottom-native.y-5.5;
  const result=vm.runInNewContext(bob.initializer.getText(parsed),{baseBob,jointPose:plan,renderKind:native.form,
    frame:fixture.live.frame,size:{w:native.renderWidth,h:native.renderHeight},f:{x:native.x,y:native.y},v177LiveJointGroundLift});
  assert.ok(result-baseBob>0&&result-baseBob<1,'a half-pixel overlap at the original size must be corrected before all consumers');
  const body=draw.getText(parsed),declaration=body.indexOf(bob.getText(parsed));
  for(const consumer of ['v177RenderedJointWeaponSocket(','ctx.translate(','rememberV177CorpseJointPose('])
    assert.ok(body.indexOf(consumer)>declaration,'the same grounded offset must reach '+consumer);
  const applied={},scope={bob:result,jointPose:plan,drewArticulatedWalk:true,renderKind:native.form,
    f:{id:631,x:native.x,y:native.y},frame:fixture.live.frame,size:{w:native.renderWidth,h:native.renderHeight},
    pose:{offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1},depthScale:1,facingSign:-1,direction:'left',
    options:{world:{}},weaponArm:V177_JOINT_ATLASES[native.form].armConstraints.find(c=>c.effectorBone===V177_JOINT_ATLASES[native.form].weaponBone),
    ctx:{translate:(x,y)=>{applied.translate={x,y};}},
    v177RenderedJointWeaponSocket:args=>{applied.socket=args;},
    rememberV177CorpseJointPose:(_world,_id,_kind,_plan,root)=>{applied.remember=root;}};
  for(const consumer of consumers.values())vm.runInNewContext(consumer.getText(parsed),scope);
  assert.equal(applied.translate.y,native.y-result);
  assert.equal(applied.remember.y,applied.translate.y);assert.equal(applied.remember.x,applied.translate.x);
  assert.equal(applied.socket.bob,result,'the socket and body use exactly the same grounded offset');
});

test('living and fallen original paint stay above the floor across sizes, gaits and facings',async()=>{
  for(const kind of Object.keys(V177_CORPSE_JOINT_DATA))for(const flipX of [false,true])
    for(const scale of [.2,4/9,.6])for(const moving of [false,true]){
      const fixture=jointCorpseRenderFixture(kind,{flipX}),atlas=V177_JOINT_ATLASES[kind];
      const live={...fixture.live,width:atlas.referenceFrame.width*scale,height:atlas.referenceFrame.height*scale,
        plan:v177JointPose(kind,{requestedState:moving?'move':'idle'},{locomotionPhase:.371,locomotionSettle:moving?0:1}),
        root:{...fixture.live.root,flipX}};
      const lift=v177LiveJointGroundLift(kind,live.plan,{...live,...live.root},290);live.root.y-=lift;
      const state=createV177CorpseJointState(kind,live,{fallDirection:flipX?1:-1});
      for(const progress of [0,1/69,.3,1]){
        const sample=sampleV177CorpseJointState(state,{progress,x:500,y:285,age:progress});
        assert.ok(await paintedBottom(state,sample)<=sample.floor+1e-8,kind+' original paint stays above the floor');
        if(progress===0){
          assert.deepEqual({...sample.root,y:live.root.y},live.root,'the first fallen paint preserves the grounded living root');
          assert.ok(Math.abs(sample.root.y-live.root.y)<1e-9,'analytic support arithmetic preserves the floor below a billionth of a world pixel');
        }
      }
    }
  assert.equal(v177LiveJointGroundLift('guardian',null,null,290),0,'other unit rigs retain their existing ground rules');
});

test('corpse poses and alpha outlines reproduce exactly from the approved original textures and recipes',async()=>{
  assert.equal(await buildV177CorpseJointData(),fs.readFileSync('app/v177CorpseJointData.js','utf8').replace(/\r\n/g,'\n'));
  for(const [kind,data]of Object.entries(V177_CORPSE_JOINT_DATA)){
    const approved=[...V177_JOINT_ASSET_ADDITIONS,...V104_RUNTIME_ADDITIONS].find(a=>a.path===data.atlasPath);
    assert.equal('sha256-'+data.atlasSha256,approved.hash);
    assert.equal(createHash('sha256').update(fs.readFileSync('public'+data.atlasPath)).digest('hex'),data.atlasSha256);
    assert.equal(data.alphaThreshold,8);assert.equal(data.outlines.length,V177_JOINT_ATLASES[kind].parts.length);
  }
});

for(const kind of Object.keys(V177_CORPSE_JOINT_DATA)){
  test(`${kind}: actual drawn body and cut/impact fragments reach the floor in both mirrored falls`,async()=>{
    for(const flipX of [false,true])for(const fallDirection of [-1,1])for(const style of [null,'cut','blast']){
      const fixture=jointCorpseRenderFixture(kind,{flipX,fallDirection,style});
      const sever=v102CorpseSeverPlan(fixture.world,fixture.corpse,fixture.live.frame,fixture.live.width,fixture.live.height);
      const state=createV177CorpseJointState(kind,fixture.live,{fallDirection,severPlan:sever});
      const first=sampleV177CorpseJointState(state,{progress:0,x:500,y:285,age:0});
      assert.deepEqual(first.root,state.initialRoot,'death must not reset the last live position or facing');
      for(const progress of [.3,1])for(const ash of progress===1?[false,true]:[false]){
        const sample=sampleV177CorpseJointState(state,{progress,x:500,y:285,age:progress*1.2,
          ashScaleX:ash?.91:1,ashScaleY:ash?.76:1});
        const body=await paintedBottom(state,sample);
        assert.ok(Math.abs(body-sample.floor-sample.groundError)<1e-8,'hull must agree with every actual source texel');
        assert.ok(body<=sample.floor+1e-8,'the body must not penetrate the floor');
        if(progress===1)assert.ok(Math.abs(body-sample.floor)<1e-8);
        if(sample.fragment){const fragment=await paintedBottom(state,sample,true);
          assert.ok(Math.abs(fragment-sample.floor-sample.fragment.groundError)<1e-8);
          assert.ok(fragment<=sample.floor+1e-8);if(progress===1)assert.ok(Math.abs(fragment-sample.floor)<1e-8);}
      }
      for(const progress of [.2,1])assert.equal(fixture.render(progress,progress===1?20:10).draws.length,state.atlas.parts.length);
    }
  });

  test(`${kind}: a detached group rests on its broad side instead of balancing on a blade or claw`,()=>{
    const fixture=jointCorpseRenderFixture(kind,{style:'blast'});
    const sever=v102CorpseSeverPlan(fixture.world,fixture.corpse,fixture.live.frame,fixture.live.width,fixture.live.height);
    const state=createV177CorpseJointState(kind,fixture.live,{fallDirection:-1,severPlan:sever}),fragment=state.fragment;
    const height=angle=>{const values=fragment.points.map(([x,y])=>Math.sin(angle)*x+Math.cos(angle)*y);return Math.max(...values)-Math.min(...values);};
    let sampled=Infinity;for(let n=0;n<720;n++)sampled=Math.min(sampled,height(n*Math.PI/720));
    assert.ok(height(fragment.restAngle)<=sampled+1e-8,'rest orientation must be at least as flat as a dense independent angular search');
  });
}

test('a source-owned action invalidates the earlier rig; corpse cache expires without touching game or save fields',()=>{
  const fixture=jointCorpseRenderFixture('takuya');
  const world={definition:{missionConfig:{v100StageNumber:3}},time:4,fighters:[{id:7}],corpses:[],save:{caps:137,receipts:['earned']}};
  const before=JSON.stringify(world),live=fixture.live;
  rememberV177CorpseJointPose(world,7,'takuya',live.plan,{frame:live.frame,width:live.width,height:live.height,...live.root});
  assert.equal(JSON.stringify(world),before);
  rememberV177CorpseJointPose(world,7,'takuya',null,{});
  assert.equal(v177CorpseJointPresentation(world,fixture.corpse,'takuya',{progress:1,fallDirection:-1}),null);
  rememberV177CorpseJointPose(world,7,'takuya',live.plan,{frame:live.frame,width:live.width,height:live.height,...live.root});
  world.corpses=[fixture.corpse];world.fighters=[];
  assert.ok(v177CorpseJointPresentation(world,fixture.corpse,'takuya',{progress:1,fallDirection:-1}));
  assert.equal(v177CorpseJointPresentation(world,{...fixture.corpse,side:'human'},'takuya',{progress:1,fallDirection:-1}),null);
  world.corpses=[];pruneV177CorpseJointPoses(world);
  assert.equal(v177CorpseJointPresentation(world,fixture.corpse,'takuya',{progress:1,fallDirection:-1}),null);
  assert.deepEqual(world.save,{caps:137,receipts:['earned']});
});

test('the actual hosted Gore callback selects a real cut source for each new corpse form and retains the four legacy cases',()=>{
  const file=fs.readFileSync('scripts/v102-combat-browser.mjs','utf8');
  const parsed=ts.createSourceFile('v102-combat-browser.mjs',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),calls=[];
  function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(parsed)==='page.evaluate'
    &&node.arguments[0]?.getText(parsed).includes('sourceKind:'))calls.push(node);ts.forEachChild(node,visit);}
  visit(parsed);assert.equal(calls.length,1);
  for(const kind of ['walker','crusher','spindle','red-panther-knife',...Object.keys(V177_CORPSE_JOINT_DATA)]){
    const operations=[],qa={
      prepareV177ContinuousActorProof:options=>{operations.push(['joint',options]);return {fighterId:7};},
      prepareEnemyFacingRuntimeProof:options=>{operations.push(['legacy',options]);return {fighterId:7};},
      setEnemyVfxProofPaused:value=>operations.push(['paused',value]),
    };
    const context=vm.createContext({kind,V177_CORPSE_JOINT_DATA,window:{__ASHFALL_BATTLE_QA__:qa}});
    const input=vm.runInContext('('+calls[0].arguments[1].getText(parsed)+')',context);
    const callback=vm.runInContext('('+calls[0].arguments[0].getText(parsed)+')',context);
    assert.equal(callback(input).fighterId,7);
    const expected=V177_CORPSE_JOINT_DATA[kind]?['joint',{form:kind,phase:'defeat',sourceKind:'tky'}]:['legacy',{kind,phase:'die'}];
    assert.deepEqual(structuredClone(operations),[expected,['paused',true]]);
  }
});
