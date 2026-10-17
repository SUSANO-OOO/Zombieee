import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildV177WalkerFloor } from '../scripts/build-v177-walker-floor.mjs';
import { V177_WALKER_FLOOR_DATA as data } from '../app/v177WalkerFloorData.js';
import { V177_JOINT_ATLASES as atlases, v177JointPose, drawV177JointPose, v177JointPaintSupportY } from '../app/v177JointPresentation.js';
import { V177_CORPSE_JOINT_DATA } from '../app/v177CorpseJointData.js';
import { v177LiveJointGroundLift } from '../app/v177CorpseJointPresentation.js';
import { spriteFrameFor, spriteBattleDisplaySizeFor, COMPACT_BATTLE_SPRITE_SCALE } from '../app/spriteManifest.js';
import { v100EnemyContactSize } from '../app/v100EnemyContactPresentation.js';
import { v102BattleBodyScale } from '../app/v102CombatMotion.js';
import { stageGeometryFor, STAGE_VIEWPORT_IDS, battlefieldDepthScale } from '../app/stageGeometry.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';

const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function paintMatrices(kind,plan,r) {
  let m=[1,0,0,1,0,0];const stack=[],paint=[];
  const ctx={save:()=>stack.push([...m]),restore:()=>{m=stack.pop();},
    transform:(...n)=>{m=multiply(m,n);},translate:(x,y)=>{m=multiply(m,[1,0,0,1,x,y]);},
    scale:(x,y)=>{m=multiply(m,[x,0,0,y,0,0]);},
    rotate:a=>{m=multiply(m,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
    drawImage:()=>paint.push([...m])};
  ctx.translate(r.x,r.y);ctx.rotate(r.angle);ctx.scale(r.scaleX*(r.flipX?-1:1),r.scaleY);
  assert.equal(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,-r.width*r.frame.anchorX,-r.height*r.frame.anchorY,r.width,r.height),true);
  assert.equal(paint.length,15);assert.equal(stack.length,0);
  return paint;
}
const paintedBottom=matrices=>Math.max(...data.outlines.flatMap((part,i)=>part.hull.map(p=>point(matrices[i],p)[1])));
function contexts() {
  const frame=spriteFrameFor('turned','walk-a','right'),size=v100EnemyContactSize('turned',frame,'right',spriteBattleDisplaySizeFor('turned'));
  return Object.values(STAGE_VIEWPORT_IDS).flatMap(viewport=>{
    const geo=stageGeometryFor(V100_STAGE_IDS[0],viewport),depth=battlefieldDepthScale(geo,geo.lanes[1].y);
    const scale=(viewport===STAGE_VIEWPORT_IDS.STANDARD?1:COMPACT_BATTLE_SPRITE_SCALE)*depth*v102BattleBodyScale('turned');
    return [false,true].map(flipX=>({viewport,frame,width:size.w*scale,height:size.h*scale,x:530,y:geo.lanes[1].y,angle:0,scaleX:1,scaleY:1,flipX}));
  });
}

test('floor data reproduces every original alpha>=1 part without changing the shared identity atlas or corpse ownership',async()=>{
  assert.equal((await buildV177WalkerFloor()),(await readFile(new URL('../app/v177WalkerFloorData.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n'));
  assert.equal(data.alphaThreshold,1);assert.equal(data.outlines.length,15);
  assert.equal(data.outlines.reduce((sum,p)=>sum+p.hull.length,0),245);
  assert.equal(atlases.walker,atlases.turned);assert.equal(V177_CORPSE_JOINT_DATA.walker,undefined);assert.equal(V177_CORPSE_JOINT_DATA.turned,undefined);
  const image=await readFile(new URL('../public'+data.atlasPath,import.meta.url));
  assert.equal(createHash('sha256').update(image).digest('hex'),data.atlasSha256);
  assert.deepEqual(data.outlines.map(p=>p.name),atlases.walker.parts.map(p=>p.name));
});

test('the actual 15-part draw places walking and attack soles on the fixed floor in all three viewport profiles and mirrors',()=>{
  const before=JSON.stringify(atlases.walker),rows=contexts();let count=0;
  for(const kind of ['walker','turned'])for(const state of ['idle','move','wind-up','active','recovery'])
    for(const phase of [0,.037,.125,.25,.5,.75,.99999])for(const settle of [0,.1249,.5,.8751,1])for(const clipProgress of [0,.37,1]) {
      const plan=v177JointPose(kind,{requestedState:state,clipProgress},{locomotionPhase:phase,locomotionSettle:settle});
      for(const r of rows) {
        const floor=r.y+5,raw=paintedBottom(paintMatrices(kind,plan,r));
        const correction=v177LiveJointGroundLift(kind,plan,r,floor);
        assert.ok(Math.abs(correction-(raw-floor))<1e-9,`${kind}/${state}/${phase}/${settle}`);
        const actual=paintedBottom(paintMatrices(kind,plan,{...r,y:r.y-correction}));
        assert.ok(Math.abs(actual-floor)<1e-9);count++;
      }
    }
  assert.equal(count,6300);assert.equal(JSON.stringify(atlases.walker),before);
});

test('ready receives a signed downward correction, and paused repeats and hit/stun snapshots retain actual foot support',()=>{
  for(const kind of ['walker','turned'])for(const r of contexts()) {
    const actor={},runtime={locomotionPhase:.23,locomotionSettle:1};
    const ready=v177JointPose(kind,{requestedState:'idle'},runtime,{actor});
    drawV177JointPose({save(){},restore(){},translate(){},scale(){},transform(){},drawImage(){}},{naturalWidth:512},kind,ready,0,0,1,1,{actor});
    const signed=v177LiveJointGroundLift(kind,ready,r,r.y+5);assert.ok(signed< -4.4&&signed> -4.6);
    assert.equal(v177LiveJointGroundLift(kind,ready,r,r.y+5),signed);
    for(const state of ['hit-light','hit-heavy','incapacitated']) {
      const plan=v177JointPose(kind,{requestedState:state},runtime,{actor,stunRemaining:.42});
      assert.ok(plan);const correction=v177LiveJointGroundLift(kind,plan,r,r.y+5);
      assert.ok(Math.abs(paintedBottom(paintMatrices(kind,plan,{...r,y:r.y-correction}))-(r.y+5))<1e-9);
    }
  }
});

test('the general support query agrees with actual canvas transforms under nonuniform scale, rotation and mirror',()=>{
  const plan=v177JointPose('turned',{requestedState:'active',clipProgress:.4},{locomotionPhase:.38,locomotionSettle:.6});
  for(const base of contexts())for(const angle of [-.8,0,.6])for(const scaleY of [.75,1,1.2]) {
    const r={...base,angle,scaleX:1.1,scaleY};
    assert.ok(Math.abs(v177JointPaintSupportY('turned',plan,data.outlines,r)-paintedBottom(paintMatrices('turned',plan,r)))<1e-9);
  }
});

test('unrelated live forms, invalid plans and missing floor data do not acquire walker correction',()=>{
  const r=contexts()[0];
  assert.equal(v177LiveJointGroundLift('walker',null,r,r.y+5),0);
  assert.equal(v177LiveJointGroundLift('turned',{},r,NaN),0);
  assert.equal(v177JointPaintSupportY('walker',null,data.outlines,r),null);
  assert.equal(v177JointPaintSupportY('walker',v177JointPose('walker',{requestedState:'idle'},{}),data.outlines,{...r,width:0}),null);
  for(const kind of Object.keys(atlases).filter(k=>!['walker','turned'].includes(k)&&!V177_CORPSE_JOINT_DATA[k]))
    assert.equal(v177LiveJointGroundLift(kind,v177JointPose(kind,{requestedState:'idle'},{}),r,r.y+5),0,kind);
});
