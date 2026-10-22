// Presentation derived from the existing, source-bound joint poses. Feet keep
// their travel owner; hips and torso transfer weight over those same feet.
import {V102_MOTION_GROUPS} from './v102CombatMotion.js';

const clamp=p=>Math.max(0,Math.min(1,Number(p)||0));
const smooth=p=>{const t=clamp(p);return t*t*(3-2*t);};
const rigs=new WeakMap();
const hitStates=new Set(['hit','hit-light','hit-heavy']);
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const rotateAt=(x,y,a,dx=0,dy=0)=>{
  const c=Math.cos(a),s=Math.sin(a);return [c,s,-s,c,x-c*x+s*y+dx,y-s*x-c*y+dy];
};
function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}

export function v177BlendGroundedMotion(from,to,progress){
  if(!from||!to)return to;
  const p=clamp(progress),blend=(a,b)=>{
    const first=Math.atan2(a[1],a[0]),last=Math.atan2(b[1],b[0]);
    const angle=first+Math.atan2(Math.sin(last-first),Math.cos(last-first))*p,c=Math.cos(angle),s=Math.sin(angle);
    return [c,s,-s,c,a[4]+(b[4]-a[4])*p,a[5]+(b[5]-a[5])*p];
  };
  return {...to,lower:blend(from.lower,to.lower),upper:blend(from.upper,to.upper)};
}

export function v177GroundedStrideFactor(kind){
  const group=V102_MOTION_GROUPS[kind];
  if(kind==='ranger'||group==='floating')return 1;
  if(['rooted','giant'].includes(group))return 1.5;
  if(group==='low')return kind==='mayo-chan'?1:1.2;
  return group==='heavy'?1.25:1.15;
}

function rigFor(atlas){
  if(rigs.has(atlas))return rigs.get(atlas);
  const legs=atlas.legConstraints??[],feet={};
  for(const leg of legs){
    const positions=atlas.poses.slice(0,atlas.frameCount).map(p=>point(p[leg.effectorBone],leg.ankle));
    feet[leg.effectorBone]={ankle:leg.ankle,
      center:(Math.min(...positions.map(p=>p[0]))+Math.max(...positions.map(p=>p[0])))/2,
      floor:Math.max(...positions.map(p=>p[1]))};
  }
  const waist=atlas.interpolationPivots?.spine??(legs.length
    ?[legs.reduce((s,l)=>s+l.hip[0],0)/legs.length,legs.reduce((s,l)=>s+l.hip[1],0)/legs.length]
    :[240,260]);
  const rig={feet,waist};rigs.set(atlas,rig);return rig;
}

function attackWeight(p){
  const keys=[[0,0],[.28,-.65],[.40,1],[.58,.55],[1,0]];
  for(let i=1;i<keys.length;i++)if(p<=keys[i][0]){
    const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*smooth((p-a)/(b-a));
  }
  return 0;
}

export function v177GroundedJointPlan(kind,atlas,plan,sample,runtime){
  // Lifecycle/manual owners already contain their own resolved anatomy.
  if(!plan||atlas?.type!=='rigid-parts'||plan.resolvedJointPose||plan.liveStun
    ||plan.turnedGetup||plan.phaseChange||plan.mrsNormalWeaponCycle)return plan;
  const rig=rigFor(atlas),group=V102_MOTION_GROUPS[kind],state=sample?.requestedState;
  const heavy=['heavy','giant','rooted'].includes(group),floating=group==='floating';
  let motion;
  if(hitStates.has(state)){
    const base=plan.groundedHitBase??plan.groundedMotion;
    if(!base)return plan;
    const p=clamp(sample.clipProgress),pulse=(1-p)*(1-p),strength=state==='hit-heavy'?1.35:.8;
    const lower=rotateAt(...rig.waist,0,-5*strength*pulse,4*strength*pulse);
    const upper=rotateAt(...rig.waist,-.11*strength*pulse,-7*strength*pulse,4*strength*pulse);
    motion={...base,lower:multiply(lower,base.lower),upper:multiply(upper,base.upper)};
    return {...plan,groundedMotion:motion,groundedHitBase:base};
  }
  const phase=Number(runtime?.locomotionPhase)||0,walk=1-clamp(plan.paintLocomotion?.settle??runtime?.locomotionSettle??1);
  const walking=floating?0:walk;
  const wave=Math.sin(phase*2*Math.PI),bounce=Math.cos(phase*4*Math.PI);
  const attack=plan.attackPhase===null||plan.attackPhase===undefined?0:plan.choreography?.bodyWeight??attackWeight(plan.attackPhase);
  const gun=group==='firearm'||['medic','engineer'].includes(kind);
  const weight=gun?-attack*.3:attack;
  const dx=wave*(heavy?3:4)*walking+weight*(heavy?10:7);
  const dy=(-5+(bounce-1)*(heavy?2:3))*walking+Math.abs(weight)*(heavy?6:4);
  const manyLegs=(atlas.legConstraints?.length??0)>2;
  const lean=wave*(heavy?.022:.035)*walking+weight*(manyLegs?.025:gun?.045:heavy?.085:.065);
  motion={feet:rig.feet,stride:v177GroundedStrideFactor(kind),lift:floating?1:heavy?2.1:group==='runner'?1.7:1.45,
    lower:rotateAt(...rig.waist,0,dx,dy),upper:rotateAt(...rig.waist,lean,dx,dy)};
  return {...plan,groundedMotion:motion};
}

// Called by the same resolver as paint, ground support and weapon sockets.
// A stance foot's horizontal travel and the runtime cycle distance use the
// same factor, so a bigger stride does not create a sliding plant.
export function applyV177GroundedMatrix(out,plan,bone,upper){
  const motion=plan.groundedMotion;if(!motion)return out;
  const foot=motion.feet[bone];
  if(foot&&!upper){
    const [x,y]=point(out,foot.ankle);
    out[4]+=(x-foot.center)*(motion.stride-1);
    out[5]-=Math.max(0,foot.floor-y)*(motion.lift-1);
    return out;
  }
  if(!upper&&bone!=='pelvis')return out;
  const t=upper?motion.upper:motion.lower;
  const a=out[0],b=out[1],c=out[2],d=out[3],x=out[4],y=out[5];
  out[0]=t[0]*a+t[2]*b;out[1]=t[1]*a+t[3]*b;
  out[2]=t[0]*c+t[2]*d;out[3]=t[1]*c+t[3]*d;
  out[4]=t[0]*x+t[2]*y+t[4];out[5]=t[1]*x+t[3]*y+t[5];return out;
}
