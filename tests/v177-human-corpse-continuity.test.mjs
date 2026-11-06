import test from 'node:test';
import assert from 'node:assert/strict';
import { animationClipFor } from '../app/combatPresentation.js';
import { ALLY_DEATH_CONFIG } from '../app/combatLifecycle.js';
import { v177JointPose, v177CaptureRangerPaint } from '../app/v177JointPresentation.js';
import { createV177HumanCorpsePaint, sampleV177HumanCorpsePaint, rememberV177HumanCorpsePaint,
  v177HumanCorpsePresentation, pruneV177HumanCorpsePaints, V177_CONTINUOUS_HUMAN_CORPSE_KINDS } from '../app/v177HumanCorpsePresentation.js';
import { assertContinuousHumanCorpse } from '../scripts/v177-human-corpse-contract.mjs';

const root={x:305.25,y:222.3,angle:.035,scaleX:1.02,scaleY:.99,flipX:false};
const outline=[[-12,-81],[21,-79],[26,3],[-14,2]];
const paint={root,outline,kind:'scout',fallDirection:-1};
const transformed=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];

test('the death starts on the actual last live transform and reaches the floor continuously on the original clock',()=>{
  assert.equal(V177_CONTINUOUS_HUMAN_CORPSE_KINDS.length,15);
  for(const kind of V177_CONTINUOUS_HUMAN_CORPSE_KINDS)for(const flipX of [false,true])for(const fallDirection of [-1,1]){
    assert.equal(animationClipFor(kind,'death').durationSeconds,.42);
    assert.equal(ALLY_DEATH_CONFIG.dyingSeconds,.55);assert.equal(ALLY_DEATH_CONFIG.infectionSeconds,12);
    const current={...paint,kind,fallDirection,root:{...root,flipX}},before=structuredClone(current);
    const first=sampleV177HumanCorpsePaint(current,{progress:0,x:309,y:220});
    assert.equal(first.root.x,root.x);assert.equal(first.root.y,root.y);assert.equal(first.root.angle,root.angle);
    const next=sampleV177HumanCorpsePaint(current,{progress:1e-5,x:309,y:220});
    assert.ok(Math.abs(next.root.y-first.root.y)<1e-6,'no first-frame floor snap');
    let prior=first;
    for(let frame=1;frame<=84;frame++){
      const sample=sampleV177HumanCorpsePaint(current,{progress:frame/84,x:309,y:220});
      assert.ok(Math.abs(sample.root.angle-prior.root.angle)<.03,'continuous fall rather than a prone cell at first hit');
      prior=sample;
    }
    assert.equal(prior.root.angle,fallDirection*Math.PI/2);assert.equal(prior.root.x,309);
    const bottom=Math.max(...outline.map(p=>transformed(prior.matrix,p)[1]));
    assert.ok(Math.abs(bottom-225)<1e-10,'the actual outline owns settled floor contact');
    const rest=sampleV177HumanCorpsePaint(current,{progress:4,x:309,y:220});assert.deepEqual(rest,prior);
    assert.deepEqual(current,before,'renderer data and clocks are not advanced by redraws');
  }
});

test('capturing a Ranger preserves the actual planted feet, weighted phase, and interrupted upper owner',()=>{
  const runtime={locomotionPhase:.721,locomotionSettle:.3};
  const plan=v177JointPose('ranger',{requestedState:'active',clipProgress:.42},runtime);
  plan.lowerFootTargets=[[190,411,-.025],[285,414,.01]];
  const before=structuredClone(plan),captured=v177CaptureRangerPaint(plan);
  assert.equal(captured.phase,plan.phase);assert.equal(captured.lowerSettle,plan.lowerSettle);
  assert.deepEqual(captured.lowerFootTargets,plan.lowerFootTargets);assert.notEqual(captured.lowerFootTargets,plan.lowerFootTargets);
  assert.ok(Object.values(captured.rangerStunUpperPose).every(m=>m.length===6&&m.every(Number.isFinite)));
  assert.deepEqual(plan,before);plan.lowerFootTargets[0][0]=10;assert.equal(captured.lowerFootTargets[0][0],190);
  assert.equal(v177CaptureRangerPaint(null),null);
});

// The pixel probe is injected only for ownership/error-path tests. Native
// three-viewport recordings separately test actual source alpha and weighted paint.
function probeCanvas(){
  const canvas={width:0,height:0};
  canvas.getContext=()=>({save(){},restore(){},translate(){},scale(){},transform(){},setTransform(){},drawImage(){},
    getImageData(_x,_y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++)data[(y*w+x)*4+3]=255;return {data};}});
  return canvas;
}
function living(kind='scout'){
  return {kind,image:{naturalWidth:1024,ownerDocument:{createElement:probeCanvas}},pixelScale:1,
    frame:{path:'/original.png',sourceRect:{x:0,y:0,w:80,h:100},anchorX:.5,anchorY:1},
    plan:null,width:80,height:100,root:{...root},paintedAt:10};
}

test('corpse ownership is per original battle and actor, prunes removal, and never revives an earlier rig after missing paint',()=>{
  const actor={id:3,side:'human'},world={time:10,fighters:[actor],corpses:[]},other={time:10,fighters:[],corpses:[]};
  const corpse={id:3,side:'human',x:305,y:220},options={progress:.2,fallDirection:-1};
  const original=living();rememberV177HumanCorpsePaint(world,actor,'scout',original);
  assert.equal(v177HumanCorpsePresentation(other,corpse,'scout',options),null);
  assert.equal(v177HumanCorpsePresentation(world,{...corpse,side:'zombie'},'scout',options),null);
  const sample=v177HumanCorpsePresentation(world,corpse,'scout',options);
  assert.ok(sample);assert.equal(sample.paint.plan,null,'the actual special sprite is retained');
  original.root.x=999;assert.equal(sample.paint.root.x,root.x,'the death entry freezes the actual source');
  world.fighters=[];world.corpses=[];pruneV177HumanCorpsePaints(world);
  assert.equal(v177HumanCorpsePresentation(world,corpse,'scout',options),null);
  rememberV177HumanCorpsePaint(world,actor,'scout',living());
  rememberV177HumanCorpsePaint(world,actor,'scout',null);
  assert.equal(v177HumanCorpsePresentation(world,corpse,'scout',options),null);
  rememberV177HumanCorpsePaint(world,actor,'brawler',living('brawler'));
  assert.equal(v177HumanCorpsePresentation(world,corpse,'brawler',options).paint.kind,'brawler');
  rememberV177HumanCorpsePaint(world,actor,'mayo-chan',living('mayo-chan'));
  assert.equal(v177HumanCorpsePresentation(world,corpse,'mayo-chan',options),null);
});

test('failed or unbounded source readback cannot claim a continuous corpse',()=>{
  const source=living(),failing=()=>({width:0,height:0,getContext(){throw Error('readback unavailable');}});
  assert.equal(createV177HumanCorpsePaint(source,failing),null);
  assert.equal(createV177HumanCorpsePaint(source,()=>{throw Error('canvas unavailable');}),null);
  assert.equal(createV177HumanCorpsePaint({...source,pixelScale:0},probeCanvas),null);
  assert.equal(createV177HumanCorpsePaint({...source,width:100000},probeCanvas),null);
  assert.equal(createV177HumanCorpsePaint({...source,plan:v177JointPose('ranger',{requestedState:'idle'},{locomotionPhase:0,locomotionSettle:1}),kind:'ranger'},probeCanvas),null,
    'a lower fallback is not weighted paint success');
});

test('a legacy prone image, frozen fall, stale owner, floating endpoint, or Ranger lower fallback cannot satisfy the new outcome owner',()=>{
  for(const form of V177_CONTINUOUS_HUMAN_CORPSE_KINDS){
    const source={...root,angle:0},lastLive={bodyPaintedAt:10,bodyPaintRoot:source,jointDrawSucceeded:true,
      jointAtlasPath:'/original-'+form+'.webp',sourceRect:{x:0,y:0,w:480,h:448},frameFlipX:false};
    const dead=[.2,.5,1,1,1].map(progress=>{
      const s=sampleV177HumanCorpsePaint({...paint,root:source},{progress,x:309,y:220});
      return {corpsePaintContinuous:true,resolvedState:'continuous-human-death',spritePath:lastLive.jointAtlasPath,
        corpsePaintedAt:10,corpsePaintMode:form==='ranger'?'weighted':'rigid',corpsePaintSourceRoot:{...source},
        sourceRect:{...lastLive.sourceRect},frameFlipX:false,corpsePaintMatrix:s.matrix,corpsePaintOutline:outline.map(p=>[...p]),
        y:220,fallProgress:progress,rotationRadians:s.root.angle,corpseGroundOffsetY:s.root.y-225,corpseGroundSupportY:s.support,
        corpseWeightedLower:{mode:'continuous-weighted-mesh',meshVertices:130,meshTriangles:192,parts:5,degenerate:0,duplicateWithinPart:0}};
    });
    const corpse={variant:0};assert.doesNotThrow(()=>assertContinuousHumanCorpse(form,dead,lastLive,corpse));
    for(const change of [
      rows=>{for(const r of rows){r.corpsePaintContinuous=false;r.resolvedState='death';r.rotationRadians=0;r.spritePath='/v070-prone.png';}},
      rows=>{for(const r of rows)r.rotationRadians=0;},
      rows=>{rows[0].corpsePaintedAt=9;},rows=>{rows[0].corpsePaintSourceRoot.x++;},
      rows=>{rows.at(-1).corpsePaintMatrix[5]-=1;},rows=>{rows.at(-1).corpsePaintOutline[0][0]++;},
      rows=>{rows[0].corpsePaintMode='sprite';},
      ...(form==='ranger'?[rows=>{rows[0].corpseWeightedLower.mode='legacy-cell-fallback';},rows=>{rows[0].corpseWeightedLower.degenerate++;}]:[]),
    ]){const changed=structuredClone(dead);change(changed);assert.throws(()=>assertContinuousHumanCorpse(form,changed,lastLive,corpse));}
  }
});
