import test from 'node:test';
import assert from 'node:assert/strict';
import {MANUAL_ABILITY_REGISTRY as definitions} from '../app/manualAbilities.js';
import {v105CurrentAbilitySample} from '../app/v105CurrentAbilityPose.js';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';

const kind='miyamoto-musashi',atlas=V177_JOINT_ATLASES[kind],definition=definitions[kind];
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function sample(phase='guard',elapsed=definition.windupSeconds+.2){
  const owner={kind,side:'human',hp:100,combatReady:true,stunned:0,manualAbility:{
    kind,activationId:1,phase,abilityElapsed:elapsed,windupRemaining:phase==='windup'?Math.max(0,definition.windupSeconds-elapsed):definition.recoverySeconds,
  }};
  return v105CurrentAbilitySample(owner,{requestedState:'idle',clipProgress:0},{manualDefinition:definition});
}
function pose(s){return v177CaptureJointPose(kind,v177JointPose(kind,s,{locomotionPhase:.2,locomotionSettle:1})).upper;}
function crossing(a,b,c,d){
  const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],cross=(u,v)=>u[0]*v[1]-u[1]*v[0];
  const den=cross(r,s),q=[c[0]-a[0],c[1]-a[1]];
  const t=cross(q,s)/den,u=cross(q,r)/den;
  return t>0&&t<1&&u>0&&u<1?[a[0]+t*r[0],a[1]+t*r[1]]:null;
}

test('Musashi prepares and holds a dedicated crossed guard, while counter/recovery keeps its real release path',()=>{
  assert.equal(sample('windup',.1).abilityPresentation,'cross-guard');
  const held=sample();assert.equal(held.abilityPresentation,'cross-guard');
  assert.equal(sample('recovery',definition.windupSeconds+definition.guardSeconds+.1).abilityPresentation,'manual');
  const guard=pose(held),ordinary=pose({...held,abilityPresentation:'manual'});
  assert.notDeepEqual(guard['weapon-0'],ordinary['weapon-0']);
  assert.notDeepEqual(guard['weapon-1'],ordinary['weapon-1']);
});

test('both original blade shafts cross forward of the shoulders below the neck, with unchanged source-bound hands',()=>{
  assert.equal(atlas.path,'/art/v100/joints/miyamoto-musashi-combat-r1.webp');
  const upper=pose(sample());
  const [near,far]=atlas.armConstraints;
  const nearWrist=point(upper['weapon-0'],near.wrist),farWrist=point(upper['weapon-1'],far.wrist);
  // Near tip is the existing contact; far tip is an inspected visible pixel on
  // the same original far sword, not a new weapon or an invented free point.
  const nearTip=point(upper['weapon-0'],atlas.muzzle);
  const farTip=point(upper['weapon-1'],[449.04819,18.96053]);
  const crossed=crossing(nearWrist,nearTip,farWrist,farTip);assert.ok(crossed);
  const shoulders=atlas.armConstraints.map(c=>point(upper[c.upperBone],c.shoulder));
  assert.ok(crossed[0]>Math.max(...shoulders.map(p=>p[0])),'Blades cross ahead of the body');
  assert.ok(crossed[1]>Math.min(...shoulders.map(p=>p[1]))+15,'Crossing stays below the neck');
  assert.ok(crossed[1]<Math.max(...shoulders.map(p=>p[1]))+100,'Crossing remains at chest height');
});

test('the raised guard retains rigid source arms and exact held wrists through windup and hold',()=>{
  for(let i=0;i<=80;i++){
    const upper=pose(i<80?sample('windup',definition.windupSeconds*i/80):sample());
    for(const c of atlas.armConstraints){
      const shoulder=point(upper[c.upperBone],c.shoulder),elbow=point(upper[c.upperBone],c.elbow);
      const wrist=point(upper[c.lowerBone],c.wrist),held=point(upper[c.effectorBone],c.effectorWrist??c.wrist);
      assert.ok(Math.abs(distance(shoulder,elbow)-distance(c.shoulder,c.elbow))<1e-7);
      assert.ok(Math.abs(distance(elbow,wrist)-distance(c.elbow,c.wrist))<1e-7);
      assert.ok(distance(wrist,held)<1e-7,'No detached hand or stretched forearm');
    }
  }
});
