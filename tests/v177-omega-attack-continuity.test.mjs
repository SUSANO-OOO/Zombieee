import {withV177PaintPartIdentity} from './helpers/v177-render-trace.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import test from 'node:test';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from '../app/v177JointPresentation.js';
test('Omega retains both pelvis hips, closed right-hand greatsword grip and empty left arm through attacks and settling',()=>{
const kind='takuya-omega',atlas=V177_JOINT_ATLASES[kind],d=JSON.parse(fs.readFileSync('assets/source/v100/joints/'+kind+'-r3/parts.json'));
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
let samples=0,failures=0,minLeg=Infinity,minArm=Infinity,maxJoin=0,worst;
for(let phase=0;phase<12;phase++)for(const settle of [0,1])for(const state of ['wind-up','active','recovery'])for(let n=0;n<=30;n++){
 const runtime={locomotionPhase:(phase+.1371)/12,locomotionSettle:settle},sample={requestedState:state,clipProgress:n/30},m=[];
 const ctx={save(){},restore(){},translate(){},scale(){},transform(...v){m.push(v);},drawImage(){}};assert.ok(withV177PaintPartIdentity(()=>drawV177JointPose(ctx,{naturalWidth:512},kind,v177JointPose(kind,sample,runtime),0,0,544,512),ctx,kind,[m]));
 const raw=Object.fromEntries(atlas.parts.map((p,i)=>[p.bone,m[i]]));samples++;
 for(const l of d.legConstraints){const hip=point(raw[l.parentBone],l.hip),ankle=point(raw[l.effectorBone],l.ankle),a=dist(l.hip,l.knee),b=dist(l.knee,l.ankle),gap=dist(hip,ankle),margin=Math.min(a+b-gap,gap-Math.abs(a-b));minLeg=Math.min(minLeg,margin);const join=Math.max(dist(hip,point(raw[l.upperBone],l.hip)),dist(point(raw[l.upperBone],l.knee),point(raw[l.lowerBone],l.knee)),dist(point(raw[l.lowerBone],l.ankle),ankle));maxJoin=Math.max(maxJoin,join);if(margin<=.001||join>=.001){failures++;worst={phase,settle,state,n,bone:l.upperBone,margin,join};}}
 for(const a of d.armConstraints){const shoulder=point(raw[a.parentBone],a.shoulder),target=point(raw[a.effectorBone],a.effectorWrist??a.wrist),upper=dist(a.shoulder,a.elbow),lower=dist(a.elbow,a.wrist),reach=dist(shoulder,target),margin=Math.min(upper+lower-reach,reach-Math.abs(upper-lower));minArm=Math.min(minArm,margin);const join=Math.max(dist(shoulder,point(raw[a.upperBone],a.shoulder)),dist(point(raw[a.upperBone],a.elbow),point(raw[a.lowerBone],a.elbow)),dist(point(raw[a.lowerBone],a.wrist),target));maxJoin=Math.max(maxJoin,join);if(margin<=.001||join>=.001){failures++;worst={phase,settle,state,n,bone:a.upperBone,margin,join};}}
}
assert.equal(samples,2232);assert.equal(failures,0,JSON.stringify(worst));assert.ok(minLeg>.001&&minArm>.001&&maxJoin<.001);
});
