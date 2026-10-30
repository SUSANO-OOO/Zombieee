import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
import {V177_JOINT_ATLASES as authoredAtlases} from '../app/v177JointData.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';
import {buildV177RangerUpper} from '../scripts/build-v177-ranger-upper.mjs';
import {traceRangerPose,rangerPoint as point} from './helpers/v177-ranger-render.mjs';

const atlas=V177_JOINT_ATLASES.ranger,rig=atlas.upperRig;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const runtime={locomotionPhase:.371,locomotionSettle:.5};
const sample=phase=>phase<.28?{requestedState:'wind-up',clipProgress:phase/.28}
  :phase<.7?{requestedState:'active',clipProgress:(phase-.28)/.42}
  :{requestedState:'recovery',clipProgress:(phase-.7)/.3};
const upperMatrices=trace=>Object.fromEntries(rig.parts.map((part,i)=>[part.bone,trace.calls[i+1].matrix]));
function connected(m,label) {
  assert.ok(distance(point(m.spine,[230.5,112]),point(m.head,[230.5,112]))<.001,label+'/neck');
  for(const c of rig.armConstraints)for(const [a,b,joint]of [
    [point(m.spine,c.shoulder),point(m[c.upperBone],c.shoulder),'shoulder'],
    [point(m[c.upperBone],c.elbow),point(m[c.lowerBone],c.elbow),'elbow'],
    [point(m[c.lowerBone],c.wrist),point(m[c.effectorBone],c.wrist),'wrist'],
  ])assert.ok(distance(a,b)<.001,`${label}/${c.upperBone}/${joint}`);
}
function paintDifference(a,b) {
  let error=0;
  for(let i=0;i<rig.parts.length;i++){
    const d=rig.parts[i].destination;
    for(const p of [[d.x,d.y],[d.x+d.w,d.y],[d.x,d.y+d.h],[d.x+d.w,d.y+d.h]])
      error=Math.max(error,distance(point(a.calls[i+1].matrix,p),point(b.calls[i+1].matrix,p)));
  }
  return error;
}

test('the authored atlas retains all original 152 decoded cells byte-exact; runtime head derivatives retain its geometry',async()=>{
  const old=await sharp(await readFile(new URL('../public/art/v100/joints/ranger-r1.webp',import.meta.url))).ensureAlpha().raw().toBuffer();
  const bytes=await readFile(new URL('../public'+authoredAtlases.ranger.path,import.meta.url));
  assert.deepEqual({...atlas,path:authoredAtlases.ranger.path},authoredAtlases.ranger);
  const packed=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.ok(packed.data.subarray(0,old.length).equals(old),'every original RGBA byte, even under alpha0, is retained');
  const keys=['key','width','height','frameCount','settleLevels','cycleDistance','frames','pelvisOffsets','muzzles','lowerCount'];
  assert.equal(createHash('sha256').update(JSON.stringify(Object.fromEntries(keys.map(k=>[k,atlas[k]])))).digest('hex'),
    'd1320ed433a08eebdf64047e5b1fb80e780be0bdfc3f322b0b71f21b27ae115e');
  assert.equal(atlas.key,'joint-ranger');assert.equal(atlas.lowerCount,120);assert.equal(atlas.frames.length,152);
  assert.equal(atlas.decodedBytes,packed.info.width*packed.info.height*4);assert.ok(atlas.decodedBytes<=6*1024*1024);
  assert.ok(rig.parts.every(p=>p.source.y>=1015));
});

test('real upper paint follows continuous weapon IK with fixed shoulder, elbow, wrist and neck attachments',()=>{
  for(const phase of [0,.071,.249,.371,.673,.999])for(const settle of [0,.33,.66,1])for(let i=0;i<=300;i++) {
    const plan=v177JointPose('ranger',sample(i/300),{locomotionPhase:phase,locomotionSettle:settle});
    const trace=traceRangerPose(plan);assert.equal(trace.painted,true);assert.equal(trace.calls.length,8);
    connected(upperMatrices(trace),`${phase}/${settle}/${i}`);
  }
});

test('every attack key and phase boundary is continuous rather than nearest-frame weapon jumps',()=>{
  for(const t of [...Array.from({length:31},(_,i)=>i/30),.28,.7]) {
    const a=traceRangerPose(v177JointPose('ranger',sample(Math.max(0,t-1e-9)),runtime));
    const b=traceRangerPose(v177JointPose('ranger',sample(Math.min(1,t+1e-9)),runtime));
    assert.ok(paintDifference(a,b)<.001,'painted part corner discontinuity at '+t);
  }
});

test('original evaluated attack poses retain the original identity and equipment within source tolerance',async()=>{
  const motion=JSON.parse(gunzipSync(await readFile(new URL('../assets/source/v100/joints/ranger-r1/motion.json.gz',import.meta.url))));
  const attack=motion.actions.find(a=>a.name==='attack');
  for(let i=0;i<=30;i++){
    const plan=v177JointPose('ranger',sample(i/30),{locomotionPhase:0,locomotionSettle:1});
    const matrices=upperMatrices(traceRangerPose(plan)),source=attack.frames[i*2];
    for(const part of rig.parts){const d=part.destination;
      for(const p of [[d.x,d.y],[d.x+d.w,d.y],[d.x,d.y+d.h],[d.x+d.w,d.y+d.h]]){
        const expected=point(source.deform[part.bone],p);expected[1]+=plan.upperOffsetY;
        assert.ok(distance(point(matrices[part.bone],p),expected)<.01,`${i}/${part.bone}`);
      }
    }
  }
});

test('actual-travel carry changes torso and relative arm motion while retaining the selected lower anchor',()=>{
  const torso=[],weapon=[],relativeArm=[];
  for(let i=0;i<=100;i++){
    const r={locomotionPhase:i/100,locomotionSettle:0},plan=v177JointPose('ranger',{requestedState:'move'},r);
    const trace=traceRangerPose(plan),m=upperMatrices(trace);connected(m,'carry/'+i);
    assert.equal(plan.lowerIndex,Math.floor(plan.phase*30));
    assert.deepEqual(trace.calls[0].rects.slice(0,4),Object.values(atlas.frames[plan.lowerIndex].source));
    const waist=point(m.spine,[232.5,228.5]);
    assert.ok(distance(waist,[232.5,228.5+plan.upperOffsetY])<.001,'waist stays on the painted lower pelvis');
    const angle=bone=>Math.atan2(m[bone][1],m[bone][0]);torso.push(angle('spine'));weapon.push(angle('weapon-0'));
    relativeArm.push(angle('arm-0-upper')-angle('spine'));
  }
  const span=a=>Math.max(...a)-Math.min(...a);
  assert.ok(span(torso)>.02,'upper walking posture actually changes');
  assert.ok(span(relativeArm)>.005,'arm does not remain rigid against the torso');
  assert.ok(span(weapon)<.012,'the held rifle remains stable');
});

test('stopping, reverse travel, zero-time redraw and attack handover keep their real phase and carry',()=>{
  const stride=atlas.cycleDistance;let r=createCombatAnimationRuntime({x:0,y:0});
  r=advanceCombatAnimationRuntime(r,{kind:'ranger',x:-stride*.37,y:0,direction:'right',locomotionCycleDistance:stride},.12);
  assert.ok(r.locomotionPhase<0);const phase=r.locomotionPhase;
  const moving=traceRangerPose(v177JointPose('ranger',{requestedState:'move'},r));
  const beginning=traceRangerPose(v177JointPose('ranger',sample(0),r));
  assert.ok(paintDifference(moving,beginning)<.001,'windup must retain the current carry');
  for(let i=0;i<12;i++)r=advanceCombatAnimationRuntime(r,{kind:'ranger',x:-stride*.37,y:0,locomotionCycleDistance:stride},1/60);
  assert.equal(r.locomotionPhase,phase);assert.equal(r.locomotionSettle,1);
  const ready=traceRangerPose(v177JointPose('ranger',{requestedState:'idle'},r));
  const returned=traceRangerPose(v177JointPose('ranger',sample(1),r));assert.ok(paintDifference(ready,returned)<.001);
  for(let i=0;i<100;i++)assert.deepEqual(traceRangerPose(v177JointPose('ranger',{requestedState:'idle'},r)),ready);
});

test('last-painted upper is immutable through hit, and owned ability and weighted-body boundaries remain protected',()=>{
  const actor={},plan=v177JointPose('ranger',sample(.43),runtime,{actor});const first=traceRangerPose(plan,{actor});
  const hit=v177JointPose('ranger',{requestedState:'hit-light'}, {...runtime,locomotionPhase:.9},{actor});
  assert.deepEqual(traceRangerPose(hit,{actor}),first);
  assert.equal(v177JointPose('ranger',sample(.43),runtime,{actor,ownedPose:true}),null);
  assert.equal(v177JointPose('ranger',{requestedState:'hit-light'},runtime,{actor}),null);
  assert.equal(v177CaptureJointPose('ranger',plan),null,'upper-only IK does not pretend to own the weighted lower corpse/stun rig');
});

test('derived source recipe regenerates exactly and does not claim original Blender walk or visual acceptance',async()=>{
  const result=await buildV177RangerUpper({check:true});assert.equal(result.checked,true);
  const p=JSON.parse(await readFile(new URL('../assets/source/v177/ranger/upper-r2/provenance.json',import.meta.url)));
  assert.equal(p.derivedMotion,true);assert.equal(p.originalWalkUpperFixed,true);
  for(const key of ['visualAcceptance','originalSpeedAcceptance','performanceAcceptance','allUnitAcceptance'])assert.equal(p[key],false);
});
