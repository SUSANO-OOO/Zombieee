import {withV177PaintPartIdentity} from './helpers/v177-render-trace.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import sharp from 'sharp';import test from 'node:test';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
test('Babayaga lowers the original silencer for carry, raises a horizontal one-hand aim and keeps the free arm joined',async()=>{
const kind='babayaga',atlas=V177_JOINT_ATLASES[kind],d=JSON.parse(fs.readFileSync('assets/source/v100/joints/babayaga-r1/parts.json'));
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pixels=await sharp('assets/source/v100/joints/babayaga-r1/weapon-and-hands.png').ensureAlpha().raw().toBuffer();for(const p of d.barrelAxis)assert.ok(pixels[(p[1]*480+p[0])*4+3]>=32,'Barrel axis belongs to original silencer paint');
let samples=0,failures=0,minLeg=Infinity,minArm=Infinity,maxJoin=0,maxAimDy=0,maxCarryDy=0,aimed=0,worst;
for(let phase=0;phase<12;phase++)for(const settle of [0,1])for(const state of ['wind-up','active','recovery'])for(let n=0;n<=30;n++){
 const runtime={locomotionPhase:(phase+.1371)/12,locomotionSettle:settle},sample={requestedState:state,clipProgress:n/30},m=[];
 const ctx={save(){},restore(){},translate(){},scale(){},transform(...v){m.push(v);},drawImage(){}};assert.ok(withV177PaintPartIdentity(()=>drawV177JointPose(ctx,{naturalWidth:512},kind,v177JointPose(kind,sample,runtime),0,0,480,448),ctx,kind,[m]));
 const raw=Object.fromEntries(atlas.parts.map((p,i)=>[p.bone,m[i]])),controls=v177CaptureJointPose(kind,v177JointPose(kind,sample,runtime)).upper;samples++;
 for(const l of d.legConstraints){const hip=point(raw[l.parentBone],l.hip),ankle=point(raw[l.effectorBone],l.ankle),a=dist(l.hip,l.knee),b=dist(l.knee,l.ankle),gap=dist(hip,ankle),margin=Math.min(a+b-gap,gap-Math.abs(a-b));minLeg=Math.min(minLeg,margin);const join=Math.max(dist(hip,point(raw[l.upperBone],l.hip)),dist(point(raw[l.upperBone],l.knee),point(raw[l.lowerBone],l.knee)),dist(point(raw[l.lowerBone],l.ankle),ankle));maxJoin=Math.max(maxJoin,join);if(margin<=.001||join>=.001){failures++;worst={phase,settle,state,n,bone:l.upperBone,margin,join};}}
 for(const a of atlas.armConstraints){const shoulder=point(raw[a.parentBone],a.shoulder),target=point(raw[a.effectorBone]??controls[a.effectorBone],a.effectorWrist??a.wrist),upper=dist(a.shoulder,a.elbow),lower=dist(a.elbow,a.wrist),reach=dist(shoulder,target),margin=Math.min(upper+lower-reach,reach-Math.abs(upper-lower));minArm=Math.min(minArm,margin);const join=Math.max(dist(shoulder,point(raw[a.upperBone],a.shoulder)),dist(point(raw[a.upperBone],a.elbow),point(raw[a.lowerBone],a.elbow)),dist(point(raw[a.lowerBone],a.wrist),target));maxJoin=Math.max(maxJoin,join);if(margin<=.001||join>=.001){failures++;worst={phase,settle,state,n,bone:a.upperBone,margin,join};}}
 const a=point(raw['weapon-0'],d.barrelAxis[0]),b=point(raw['weapon-0'],d.barrelAxis[1]),dy=Math.abs(a[1]-b[1]);
 const [aimAt,lowerAt]=atlas.attackBoundaries,p=state==='wind-up'?aimAt*n/30:state==='active'?aimAt+(lowerAt-aimAt)*n/30:lowerAt+(1-lowerAt)*n/30;
 if(p>=atlas.attackBoundaries[0]&&p<=atlas.attackBoundaries[1]){maxAimDy=Math.max(maxAimDy,dy);aimed++;}
 if(n===0&&state==='wind-up'||n===30&&state==='recovery')maxCarryDy=Math.max(maxCarryDy,dy);
}
assert.equal(samples,2232);assert.equal(failures,0,JSON.stringify(worst));assert.ok(minLeg>.001&&minArm>.001&&maxJoin<.001);
assert.ok(aimed>500&&maxAimDy<.001,'The original silencer stays horizontal while aiming and firing');
assert.ok(maxCarryDy>10,'Carry lowers the handgun before and after engagement');
});
