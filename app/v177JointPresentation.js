import { V177_PAISEN_PHOTO_JOINT_ATLASES as paisenPhotoAtlases } from './v177PaisenPhotoJointData.js';
import { V177_JOINT_ATLASES as bakedAtlases } from './v177JointData.js';
import { V177_QUADRUPED_JOINT_ATLASES as quadrupedAtlases } from './v177QuadrupedJointData.js';
import { V177_BIPED_JOINT_ATLASES as bipedAtlases } from './v177BipedJointData.js';
import { V177_ENEMY_JOINT_ATLASES as enemyAtlases } from './v177EnemyJointData.js';
import { V177_RUNNER_JOINT_ATLASES as runnerAtlases } from './v177RunnerJointData.js';
import { V177_FIREARM_JOINT_ATLASES as firearmAtlases } from './v177FirearmJointData.js';
import { V177_PANTHER_JOINT_ATLASES as pantherAtlases } from './v177PantherJointData.js';
import { V177_MELEE_JOINT_ATLASES as meleeAtlases } from './v177MeleeJointData.js';
import { V177_GUARD_ENEMY_JOINT_ATLASES as guardEnemyAtlases } from './v177GuardEnemyJointData.js';
import { V177_NEWCOMER_JOINT_ATLASES as newcomerAtlases } from './v177NewcomerJointData.js';
import { V177_INFECTED_JOINT_ATLASES as infectedAtlases } from './v177InfectedJointData.js';
import { V177_FERAL_JOINT_ATLASES as feralAtlases } from './v177FeralJointData.js';
import { V177_FUTAGO_JOINT_ATLASES as futagoAtlases } from './v177FutagoJointData.js';
import { v177RangerCarryPose } from './v177RangerUpperMotion.js';
import { v177JointActorKey } from './v177JointActorHistory.js';

const locomotionStates = new Set(['idle','deploy','move','start-move','stop-move','turn','retreat']);
const attackStates = new Set(['wind-up','active','recovery']);
const recoveryStates = new Set(['reload','weapon-cycle']);
const hitStates = new Set(['hit','hit-light','hit-heavy']);
const renderedJointPoses = new WeakMap();
const livingStunPoses = new WeakMap();
const actorKey = actor => actor && typeof actor === 'object' ? actor : null;
function rememberRenderedJointPose(actor,kind,plan) {
  const key=actorKey(actor);
  if(!key)return;
  if(plan)renderedJointPoses.set(key,{kind,plan:{...plan}});
  else { renderedJointPoses.delete(key); livingStunPoses.delete(key); }
}
const clamp = p => Math.max(0, Math.min(1, Number(p) || 0));
const cycle = p => ((Number(p) || 0) % 1 + 1) % 1;

export const V177_JOINT_ATLASES = Object.fromEntries(Object.entries({...bakedAtlases,...quadrupedAtlases,...bipedAtlases,...enemyAtlases,...runnerAtlases,...firearmAtlases,...pantherAtlases,...meleeAtlases,...guardEnemyAtlases,...newcomerAtlases,...infectedAtlases,...feralAtlases,...futagoAtlases,...paisenPhotoAtlases}));

export function v177JointCycleDistance(kind, renderScale) {
  const atlas = V177_JOINT_ATLASES[kind];
  return atlas && Number.isFinite(renderScale) && renderScale > 0
    ? atlas.cycleDistance / (atlas.referenceFrame?.scale??1) * renderScale : undefined;
}

export function v177JointPose(kind, sample, runtime, { ownedPose=false,actor,world,stunRemaining=0 }={}) {
  actor=v177JointActorKey(actor,world);
  const atlas = V177_JOINT_ATLASES[kind], state=sample?.requestedState;
  if (!atlas || ownedPose) { rememberRenderedJointPose(actor,kind,null); return null; }
  if(state==='incapacitated')return kind==='ranger'&&atlas.upperRig
    ? rangerLivingStunJointPose(kind,atlas,runtime,actor,stunRemaining)
    : livingStunJointPose(kind,atlas,runtime,actor,stunRemaining);
  if(actorKey(actor))livingStunPoses.delete(actor);
  if(hitStates.has(state)) {
    const previous=actorKey(actor) ? renderedJointPoses.get(actor) : null;
    if(previous?.kind!==kind) { rememberRenderedJointPose(actor,kind,null); return null; }
    // The existing rigid recoil still moves the body. Keep its last painted
    // feet, head and weapon instead of snapping to a different static hit row.
    return {...previous.plan,reactionHeld:true};
  }
  if (!locomotionStates.has(state) && !attackStates.has(state) && !recoveryStates.has(state)) {
    rememberRenderedJointPose(actor,kind,null); return null;
  }
  const variant=sample?.attackVariant ? atlas.attackVariants?.[sample.attackVariant] : null;
  if(sample?.attackVariant && !variant) { rememberRenderedJointPose(actor,kind,null); return null; }
  const phase=cycle(runtime?.locomotionPhase);
  const phaseIndex=Math.floor(phase*atlas.frameCount) % atlas.frameCount;
  const settleIndex=Math.round(clamp(runtime?.locomotionSettle ?? 1)*(atlas.settleLevels-1));
  // The feet keep the last actual-travel phase through aiming and firing.
  // Only their lift settles to the floor; attacking never substitutes a
  // different fixed stance or advances a walking clock while stationary.
  const lowerIndex=settleIndex*atlas.frameCount+phaseIndex;
  let attackPhase=null;
  const [windupEnd,activeEnd]=variant?.attackBoundaries??atlas.attackBoundaries??[.28,.7];
  if(state==='wind-up')attackPhase=windupEnd*clamp(sample.clipProgress);
  else if(state==='active')attackPhase=windupEnd+(activeEnd-windupEnd)*clamp(sample.clipProgress);
  else if(state==='recovery')attackPhase=activeEnd+(1-activeEnd)*clamp(sample.clipProgress);
  // Real firing cadence can enter reload between shots. Keep the same body,
  // settled feet and source-bound hands while the weapon lowers and returns
  // to its ready baseline, rather than swapping to a legacy static frame.
  else if(recoveryStates.has(state))attackPhase=activeEnd+(1-activeEnd)*clamp(sample.clipProgress);
  if(atlas.type==='rigid-parts'){
    const attackBase=variant?.startIndex??atlas.lowerCount;
    const attackFrame=(attackPhase??0)*atlas.frameCount,attackIndex=Math.floor(attackFrame);
    const nextPhase=(phaseIndex+1)%atlas.frameCount,blend=phase*atlas.frameCount-phaseIndex;
    return {lowerIndex,lowerNextIndex:settleIndex*atlas.frameCount+nextPhase,lowerBlend:blend,
      upperIndex:attackPhase===null?lowerIndex:attackBase+attackIndex,
      upperNextIndex:attackPhase===null?settleIndex*atlas.frameCount+nextPhase:attackBase+Math.min(atlas.frameCount,attackIndex+1),
      upperBlend:attackPhase===null?blend:attackFrame-attackIndex,phase,settleIndex,attackPhase,
      upperOffsetY:atlas.pelvisOffsets[settleIndex][phaseIndex]*(1-blend)+atlas.pelvisOffsets[settleIndex][nextPhase]*blend};
  }
  const upperIndex=atlas.lowerCount+(attackPhase===null ? 0 : 1+Math.round(attackPhase*atlas.frameCount));
  const plan={lowerIndex,upperIndex,phase,settleIndex,attackPhase,
    upperOffsetY:atlas.pelvisOffsets[settleIndex][phaseIndex]};
  if(atlas.upperRig){
    const rig=atlas.upperRig,frame=(attackPhase??0)*rig.frameCount,index=Math.floor(frame);
    const first=attackPhase===null?0:rig.attackStartIndex+index;
    const next=attackPhase===null?0:rig.attackStartIndex+Math.min(rig.frameCount,index+1);
    const current=v177RangerCarryPose(rig.poses[first],phase,runtime?.locomotionSettle??1);
    const following=next===first?current:v177RangerCarryPose(rig.poses[next],phase,runtime?.locomotionSettle??1);
    // Both source keys receive the same carry transform before fixed-length IK.
    // Interpolating their pivots commutes with that common rigid transform.
    plan.upperRigPoses=[current,following];
    plan.upperRigPlan={lowerIndex:0,lowerNextIndex:0,lowerBlend:0,
      upperIndex:0,upperNextIndex:1,upperBlend:attackPhase===null?0:frame-index,
      attackPhase,upperOffsetY:0};
  }
  return plan;
}

function resolvedJointMatrix(out,_atlas,plan,bone,upper) {
  out.set(plan.resolvedJointPose[upper?'upper':'lower'][bone]);return out;
}

const smooth = p => { const t=clamp(p);return t*t*(3-2*t); };
const matrixPoint = (m,[x,y]) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function multiplyMatrix(a,b) {
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}

const identityMatrix = () => [1,0,0,1,0,0];
const copyCapturedJoints = pose => ({
  lower:Object.fromEntries(Object.entries(pose.lower).map(([k,m])=>[k,[...m]])),
  upper:Object.fromEntries(Object.entries(pose.upper).map(([k,m])=>[k,[...m]])),
});
function inverseMatrix(m) {
  const d=m[0]*m[3]-m[1]*m[2];
  return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,
    (m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
}
function transformUpperJoints(pose,t) {
  for(const bone of Object.keys(pose.upper))pose.upper[bone]=multiplyMatrix(t,pose.upper[bone]);
}

function captureStatusJoints(atlas,plan) {
  if(plan.resolvedJointPose)return copyCapturedJoints(plan.resolvedJointPose);
  const pose={lower:{},upper:{}},matrix=new Float64Array(6);
  const scratch=[new Float64Array(6),new Float64Array(6)];
  for(const bone of Object.keys(atlas.poses[0]))for(const upper of [false,true])
    pose[upper?'upper':'lower'][bone]=[...jointMatrix(matrix,atlas,plan,bone,upper,scratch)];
  return pose;
}

function blendCapturedJoints(atlas,initial,neutral,p) {
  if(p>=1)return neutral;
  if(p<=0)return copyCapturedJoints(initial);
  const interpolationPivots={...atlas.interpolationPivots};
  for(const chain of [...(atlas.armConstraints??[]),...(atlas.legConstraints??[])])
    interpolationPivots[chain.effectorBone]??=chain.effectorWrist??chain.ankle??chain.wrist;
  const rig={...atlas,interpolationPivots,poses:[initial.lower,initial.upper,neutral.lower,neutral.upper]};
  const plan={lowerIndex:0,lowerNextIndex:2,lowerBlend:p,upperIndex:1,upperNextIndex:3,upperBlend:p,
    attackPhase:null,upperOffsetY:0},result={lower:{},upper:{}};
  const scratch=[new Float64Array(6),new Float64Array(6)],matrix=new Float64Array(6);
  for(const bone of Object.keys(atlas.poses[0]))for(const upper of [false,true])
    result[upper?'upper':'lower'][bone]=[...jointMatrix(matrix,rig,plan,bone,upper,scratch)];
  return result;
}

function leanCapturedJoints(atlas,pose,amplitude) {
  const legs=atlas.legConstraints??[];
  if(!legs.length||amplitude<=0)return resolveUpperOwnedLegs(atlas,pose);
  const hips=legs.map(chain=>matrixPoint(pose[chain.parentUpper===false?'lower':'upper'][chain.parentBone],chain.hip));
  const px=hips.reduce((sum,p)=>sum+p[0],0)/hips.length,py=hips.reduce((sum,p)=>sum+p[1],0)/hips.length;
  const transform=angle=>{const c=Math.cos(angle),s=Math.sin(angle);return [c,s,-s,c,px-c*px+s*py,py-s*px-c*py];};
  const reaches=t=>legs.every((chain,i)=>{
    if(chain.parentUpper===false)return true;
    const [hx,hy]=matrixPoint(t,hips[i]);
    const [tx,ty]=matrixPoint(pose.lower[chain.effectorBone],chain.effectorWrist??chain.ankle);
    const a=Math.hypot(chain.knee[0]-chain.hip[0],chain.knee[1]-chain.hip[1]);
    const b=Math.hypot(chain.ankle[0]-chain.knee[0],chain.ankle[1]-chain.knee[1]);
    const d=Math.hypot(tx-hx,ty-hy);return d<=a+b+1e-8&&d>=Math.abs(a-b)-1e-8;
  });
  // A low or many-legged body keeps its actual foot targets. Bound the lean by
  // this pose's fixed limb reach instead of letting an IK fallback detach a paw.
  let angle=-.035*amplitude,t=transform(angle);
  for(let i=0;i<12&&!reaches(t);i++){angle*=.5;t=transform(angle);}
  if(!reaches(t))t=transform(0);
  // Resolve all attachments first, then move each upper matrix exactly once.
  // Applying the transform recursively again would detach a jaw or soft organ.
  transformUpperJoints(pose,t);
  pose.upperTransform=multiplyMatrix(t,pose.upperTransform??identityMatrix());
  return resolveUpperOwnedLegs(atlas,pose);
}

function resolveUpperOwnedLegs(atlas,pose) {
  const rig={...atlas,poses:[pose.lower,pose.upper]};
  const plan={lowerIndex:0,lowerNextIndex:0,lowerBlend:0,upperIndex:1,upperNextIndex:1,upperBlend:0,
    attackPhase:null,upperOffsetY:0},scratch=[new Float64Array(6),new Float64Array(6)],matrix=new Float64Array(6);
  for(const chain of atlas.legConstraints??[])if(chain.parentUpper!==false)for(const bone of [chain.upperBone,chain.lowerBone]){
    const m=[...jointMatrix(matrix,rig,plan,bone,false,scratch)];
    pose.lower[bone]=m;pose.upper[bone]=[...m];
  }
  return pose;
}

function returnPaintedJoints(atlas,entry,neutral,progress) {
  const target=captureStatusJoints(atlas,neutral);
  if(progress<=0)return {...copyCapturedJoints(entry.pose),upperTransform:entry.upperTransform,
    returnPlan:Number.isFinite(entry.sourcePlan.attackPhase)?entry.sourcePlan:null};
  if(progress>=1)return {...target,upperTransform:identityMatrix(),returnPlan:null};
  const pose=blendCapturedJoints(atlas,entry.basePose,target,progress);
  if(Number.isFinite(entry.sourcePlan.attackPhase)){
    // A long two-handed swing cannot be cross-faded directly to ready: an
    // intermediate weapon angle can lie outside both fixed arm reaches. Follow
    // the original authored return path before joining the current carry pose.
    const attackPhase=entry.sourcePlan.attackPhase+(1-entry.sourcePlan.attackPhase)*clamp(progress/.7);
    const attackBase=entry.sourcePlan.upperIndex-Math.floor(entry.sourcePlan.attackPhase*atlas.frameCount);
    const frame=attackPhase*atlas.frameCount,index=Math.floor(frame);
    const returning={...neutral,attackPhase,upperIndex:attackBase+index,
      upperNextIndex:attackBase+Math.min(atlas.frameCount,index+1),upperBlend:frame-index,
      upperOffsetY:entry.sourcePlan.upperOffsetY+(neutral.upperOffsetY-entry.sourcePlan.upperOffsetY)*progress};
    const source=captureStatusJoints(atlas,returning);
    pose.upper=progress<=.7 ? source.upper
      : blendCapturedJoints(atlas,source,target,smooth((progress-.7)/.3)).upper;
    pose.returnPlan=progress<=.7?returning:null;
  }
  // An ordinary hit can hold an already reacting body. Strip its one common
  // rigid transform before interpolating, then ease that transform out once.
  // This preserves both-hand reach without recapturing a growing body lean.
  const angle=Math.atan2(entry.upperTransform[1],entry.upperTransform[0])*(1-progress),c=Math.cos(angle),s=Math.sin(angle);
  pose.upperTransform=[c,s,-s,c,entry.upperTransform[4]*(1-progress),entry.upperTransform[5]*(1-progress)];
  transformUpperJoints(pose,pose.upperTransform);
  return pose;
}

function captureRangerUpper(atlas,plan) {
  if(plan.rangerStunUpperPose)return Object.fromEntries(Object.entries(plan.rangerStunUpperPose).map(([bone,m])=>[bone,[...m]]));
  const rig={...atlas.upperRig,poses:plan.upperRigPoses},pose={},matrix=new Float64Array(6);
  const scratch=[new Float64Array(6),new Float64Array(6)];
  for(const bone of Object.keys(rig.poses[0]))pose[bone]=[...jointMatrix(matrix,rig,plan.upperRigPlan,bone,true,scratch)];
  return pose;
}

function rangerLivingStunJointPose(kind,atlas,runtime,actor,remaining) {
  const key=actorKey(actor),previous=key?renderedJointPoses.get(key):null;
  if(!(remaining>0)||previous?.kind!==kind||!previous.plan.upperRigPlan){
    rememberRenderedJointPose(actor,kind,null);return null;
  }
  let entry=livingStunPoses.get(key);
  if(!entry||!entry.rangerUpper||remaining>entry.lastRemaining+1e-9){
    const pose=captureRangerUpper(atlas,previous.plan);
    const transform=previous.plan.rangerStunUpperTransform??identityMatrix(),inverse=inverseMatrix(transform);
    const basePose=Object.fromEntries(Object.entries(pose).map(([bone,m])=>[bone,multiplyMatrix(inverse,m)]));
    entry={kind,rangerUpper:true,pose,basePose,transform,remaining,lastRemaining:remaining,elapsed:0,plan:previous.plan};
    livingStunPoses.set(key,entry);
  }
  // Only the actual remaining stun timer advances this visual reaction.
  // Idle/move runtime transitions and repeated redraws cannot reset its clock.
  entry.elapsed+=Math.max(0,entry.lastRemaining-remaining);entry.lastRemaining=remaining;
  const elapsed=entry.elapsed,neutral=v177JointPose(kind,{requestedState:'idle'},runtime);
  const target=captureRangerUpper(atlas,neutral),exitWindow=Math.min(.12,entry.remaining);
  const progress=1-(1-smooth(elapsed/.12))*smooth(remaining/exitWindow);
  const upper=elapsed===0?Object.fromEntries(Object.entries(entry.pose).map(([bone,m])=>[bone,[...m]]))
    : blendCapturedJoints(atlas.upperRig,{lower:entry.basePose,upper:entry.basePose},{lower:target,upper:target},progress).upper;
  let transform=entry.transform;
  if(elapsed>0){
    const amplitude=smooth(elapsed/.1)*smooth(remaining/.1);
    // One bounded common lean, including re-hit entries, keeps both grips and
    // the neck attached without accumulating a larger bend on every hit.
    const angle=Math.atan2(entry.transform[1],entry.transform[0])*(1-progress)-.035*amplitude*progress;
    const [px,py]=matrixPoint(upper.spine,[232.5,228.5]),c=Math.cos(angle),s=Math.sin(angle);
    transform=[c,s,-s,c,px-c*px+s*py,py-s*px-c*py];
    for(const bone of Object.keys(upper))upper[bone]=multiplyMatrix(transform,upper[bone]);
  }
  // The original weighted lower remains a single original cell, with its
  // matching pelvis offset. Never crossfade a second pair of painted feet.
  const lower=elapsed===0?entry.plan:neutral;
  return {...neutral,lowerIndex:lower.lowerIndex,upperOffsetY:lower.upperOffsetY,phase:lower.phase,settleIndex:lower.settleIndex,
    liveStun:true,rangerStunUpperPose:upper,rangerStunUpperTransform:transform,stunElapsed:elapsed,stunRemaining:remaining};
}

function livingStunJointPose(kind,atlas,runtime,actor,remaining) {
  const key=actorKey(actor),previous=key?renderedJointPoses.get(key):null;
  if(atlas.type!=='rigid-parts'||!(remaining>0)||previous?.kind!==kind){
    rememberRenderedJointPose(actor,kind,null);return null;
  }
  const clock=Math.max(0,Number(runtime?.elapsedSeconds)||0),epoch=runtime?.transitionCount;
  let entry=livingStunPoses.get(key);
  if(!entry||entry.kind!==kind||entry.epoch!==epoch||clock<entry.clock){
    const pose=captureStatusJoints(atlas,previous.plan),basePose=copyCapturedJoints(pose);
    const upperTransform=previous.plan.stunUpperTransform??identityMatrix();
    if(previous.plan.stunUpperTransform)transformUpperJoints(basePose,inverseMatrix(upperTransform));
    entry={kind,epoch,clock,remaining,pose,basePose,upperTransform,
      sourcePlan:previous.plan.stunReturnPlan??previous.plan};
    livingStunPoses.set(key,entry);
  }
  const neutral=v177JointPose(kind,{requestedState:'idle'},runtime);
  const elapsed=Math.max(0,clock-entry.clock),exitWindow=Math.min(.12,entry.remaining);
  const progress=1-(1-smooth(elapsed/.12))*smooth(remaining/exitWindow);
  const amplitude=smooth(elapsed/.1)*smooth(remaining/.1);
  const returning=returnPaintedJoints(atlas,entry,neutral,progress);
  const resolved=progress===0&&amplitude===0 ? returning : leanCapturedJoints(atlas,returning,amplitude);
  return {...neutral,liveStun:true,resolvedJointPose:resolved,stunElapsed:elapsed,stunRemaining:remaining,
    stunUpperTransform:resolved.upperTransform,stunReturnPlan:resolved.returnPlan??null};
}

export function drawV177JointPose(ctx, image, kind, plan, x, y, width, height, {actor,world}={}) {
  actor=v177JointActorKey(actor,world);
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || !plan || !image?.naturalWidth) { rememberRenderedJointPose(actor,kind,null); return false; }
  if(atlas.type==='rigid-parts'){
    const resolve=plan.resolvedJointPose ? resolvedJointMatrix : jointMatrix;
    const matrix=new Float64Array(6);
    const scratch=atlas.armConstraints || atlas.legConstraints ? [new Float64Array(6),new Float64Array(6)] : null;
    const reference=atlas.referenceFrame;
    ctx.save();if(atlas.paintStyle==='pixel-art')ctx.imageSmoothingEnabled=false;
    ctx.translate(x,y);ctx.scale(width/(reference?.width??atlas.width),height/(reference?.height??atlas.height));
    if(reference){ctx.translate(-reference.tx/reference.scale,-reference.ty/reference.scale);ctx.scale(1/reference.scale,1/reference.scale);}
    for(const part of atlas.parts){
      if(part.bone==='jaw'){
        ctx.fillStyle=atlas.mouth.color;ctx.beginPath();let started=false;
        for(const [bone,points]of [[atlas.mouth.headBone,atlas.mouth.upper],[atlas.mouth.jawBone,atlas.mouth.lower]]){
          resolve(matrix,atlas,plan,bone,true);
          for(const [px,py]of points){const xx=matrix[0]*px+matrix[2]*py+matrix[4],yy=matrix[1]*px+matrix[3]*py+matrix[5];
            if(started)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);started=true;}
        }
        ctx.closePath();ctx.fill();
      }
      resolve(matrix,atlas,plan,part.bone,part.upper,scratch);
      const s=part.source,d=part.destination;
      ctx.save();ctx.transform(...matrix);ctx.drawImage(image,s.x,s.y,s.w,s.h,d.x,d.y,d.w,d.h);ctx.restore();
    }
    ctx.restore();rememberRenderedJointPose(actor,kind,plan);return true;
  }
  if(atlas.upperRig&&plan.upperRigPlan&&plan.upperRigPoses){
    const {source:s,destination:d}=atlas.frames[plan.lowerIndex];
    ctx.drawImage(image,s.x,s.y,s.w,s.h,x+d.x/atlas.width*width,y+d.y/atlas.height*height,
      d.w/atlas.width*width,d.h/atlas.height*height);
    const rig={...atlas.upperRig,poses:plan.upperRigPoses};
    const matrix=new Float64Array(6),scratch=[new Float64Array(6),new Float64Array(6)];
    ctx.save();ctx.translate(x,y);ctx.scale(width/atlas.width,height/atlas.height);ctx.translate(0,plan.upperOffsetY);
    for(const part of rig.parts){
      if(plan.rangerStunUpperPose)matrix.set(plan.rangerStunUpperPose[part.bone]);
      else jointMatrix(matrix,rig,plan.upperRigPlan,part.bone,true,scratch);
      const source=part.source,destination=part.destination;
      ctx.save();ctx.transform(...matrix);
      ctx.drawImage(image,source.x,source.y,source.w,source.h,destination.x,destination.y,destination.w,destination.h);
      ctx.restore();
    }
    ctx.restore();rememberRenderedJointPose(actor,kind,plan);return true;
  }
  for(const [index,dy] of [[plan.lowerIndex,0],[plan.upperIndex,plan.upperOffsetY]]) {
    const {source:s,destination:d}=atlas.frames[index];
    ctx.drawImage(image,s.x,s.y,s.w,s.h,
      x+d.x/atlas.width*width,y+(d.y+dy)/atlas.height*height,
      d.w/atlas.width*width,d.h/atlas.height*height);
  }
  rememberRenderedJointPose(actor,kind,plan);return true;
}

// Interpolate rigid transforms, rather than matrix coefficients that shorten
// limbs between samples. The actual Blender root travel was removed by bake.
function interpolatedMatrix(out,atlas,plan,bone,upper,applyUpperOffset=true){
  const attachment=atlas.parentAttachments?.[bone];let anchorX,anchorY;
  if(attachment){
    interpolatedMatrix(out,atlas,plan,attachment.parent,upper,false);
    const [px,py]=attachment.pivot;
    anchorX=out[0]*px+out[2]*py+out[4];anchorY=out[1]*px+out[3]*py+out[5];
  }
  const a=atlas.poses[upper?plan.upperIndex:plan.lowerIndex][bone];
  const b=atlas.poses[upper?plan.upperNextIndex:plan.lowerNextIndex][bone];
  const p=upper?plan.upperBlend:plan.lowerBlend,angleA=Math.atan2(a[1],a[0]),angleB=Math.atan2(b[1],b[0]);
  const delta=Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA)),angle=angleA+delta*p,c=Math.cos(angle),s=Math.sin(angle);
  out[0]=c;out[1]=s;out[2]=-s;out[3]=c;
  // A source-bound soft organ can inflate; the head, torso and limb bones
  // retain the existing rigid path. Never interpolate limb scale.
  if(atlas.softBones?.[bone]){
    const sx=Math.hypot(a[0],a[1])+(Math.hypot(b[0],b[1])-Math.hypot(a[0],a[1]))*p;
    const sy=Math.hypot(a[2],a[3])+(Math.hypot(b[2],b[3])-Math.hypot(a[2],a[3]))*p;
    out[0]*=sx;out[1]*=sx;out[2]*=sy;out[3]*=sy;
  }
  const pivot=atlas.interpolationPivots?.[bone];
  if(pivot){
    // A fast swing must interpolate its authored grip, rather than the
    // translation of the distant image origin. Otherwise the grip can arc
    // outside the arm's fixed reach between two perfectly valid source keys.
    const [px,py]=pivot,ax=a[0]*px+a[2]*py+a[4],ay=a[1]*px+a[3]*py+a[5];
    const bx=b[0]*px+b[2]*py+b[4],by=b[1]*px+b[3]*py+b[5];
    out[4]=ax+(bx-ax)*p-c*px+s*py;out[5]=ay+(by-ay)*p-s*px-c*py;
    if(atlas.softBones?.[bone]){
      out[4]=ax+(bx-ax)*p-out[0]*px-out[2]*py;
      out[5]=ay+(by-ay)*p-out[1]*px-out[3]*py;
    }
    // Child jaw/throat paint follows the interpolated head anchor exactly.
    // Independently interpolating two world-space pivots can detach a hinge.
    if(attachment){
      out[4]=anchorX-out[0]*px-out[2]*py;out[5]=anchorY-out[1]*px-out[3]*py;
    }
  }else{
    out[4]=a[4]+(b[4]-a[4])*p;out[5]=a[5]+(b[5]-a[5])*p;
  }
  if(applyUpperOffset&&upper&&plan.attackPhase!==null)out[5]+=plan.upperOffsetY;
  return out;
}

// Resolve authored two-bone chains against the same interpolated endpoints.
// A planted quadruped paw retains the travel/settling pose while its hip follows
// the attacking torso. Independent limb interpolation can detach the knee or paw.
// Bipeds with a separately painted lower pelvis keep that pelvis as the hip
// owner while the upper torso leans; the feet never follow the attack pose.
function jointMatrix(out,atlas,plan,bone,upper,scratch){
  const chain=atlas.armConstraints?.find(a=>a.upperBone===bone||a.lowerBone===bone)
    ??atlas.legConstraints?.find(a=>a.upperBone===bone||a.lowerBone===bone);
  if(!chain)return interpolatedMatrix(out,atlas,plan,bone,upper);
  const leg=Boolean(chain.hip);
  const parent=scratch?.[0]??new Float64Array(6),effector=scratch?.[1]??new Float64Array(6);
  interpolatedMatrix(parent,atlas,plan,chain.parentBone,leg?chain.parentUpper!==false:upper);
  interpolatedMatrix(effector,atlas,plan,chain.effectorBone,leg?false:upper);
  const [sx,sy]=chain.hip??chain.shoulder,[ex,ey]=chain.knee??chain.elbow,[wx,wy]=chain.ankle??chain.wrist;
  // A supporting hand can come from an approved two-hand attack frame while
  // the arm retains its original neutral anatomy and visible sleeve paint.
  const [twx,twy]=chain.effectorWrist??chain.ankle??chain.wrist;
  const hx=parent[0]*sx+parent[2]*sy+parent[4],hy=parent[1]*sx+parent[3]*sy+parent[5];
  const tx=effector[0]*twx+effector[2]*twy+effector[4],ty=effector[1]*twx+effector[3]*twy+effector[5];
  const dx=tx-hx,dy=ty-hy,d=Math.hypot(dx,dy),a=Math.hypot(ex-sx,ey-sy),b=Math.hypot(wx-ex,wy-ey);
  if(d<1e-8||d>a+b+.0001||d<Math.abs(a-b)-.0001)return interpolatedMatrix(out,atlas,plan,bone,upper);
  const along=(a*a+d*d-b*b)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  const sign=(ex-sx)*-(wy-sy)+(ey-sy)*(wx-sx)>=0?1:-1;
  const kx=hx+dx/d*along-dy/d*height*sign,ky=hy+dy/d*along+dx/d*height*sign;
  const isUpper=bone===chain.upperBone,rx=isUpper?sx:ex,ry=isUpper?sy:ey;
  const ax=isUpper?hx:kx,ay=isUpper?hy:ky,bx=isUpper?kx:tx,by=isUpper?ky:ty;
  const angle=Math.atan2(by-ay,bx-ax)-Math.atan2((isUpper?ey:wy)-ry,(isUpper?ex:wx)-rx),c=Math.cos(angle),s=Math.sin(angle);
  out[0]=c;out[1]=s;out[2]=-s;out[3]=c;out[4]=ax-c*rx+s*ry;out[5]=ay-s*rx-c*ry;
  return out;
}

// Keep the actual upper/lower owners when a rendered live pose becomes a
// corpse. Resolving to a neutral pose first would visibly reset the feet or
// weapon. These snapshots are renderer data, never campaign/save data.
export function v177CaptureJointPose(kind,plan) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || atlas.type!=='rigid-parts' || !plan)return null;
  const lower={},upper={};
  const resolve=plan.resolvedJointPose ? resolvedJointMatrix : jointMatrix;
  for(const bone of Object.keys(atlas.poses[0])){
    lower[bone]=[...resolve(new Float64Array(6),atlas,plan,bone,false)];
    upper[bone]=[...resolve(new Float64Array(6),atlas,plan,bone,true)];
  }
  return {lower,upper};
}

const supportMatrix=new Float64Array(6);
const supportScratch=[new Float64Array(6),new Float64Array(6)];
// Resolve the same source matrices as drawV177JointPose. This synchronous
// support query reuses three small matrices instead of capturing/re-solving
// every limb and allocating an array for each painted outline vertex.
export function v177JointPaintSupportY(kind,plan,outlines,rendered) {
  const atlas=V177_JOINT_ATLASES[kind],r=atlas?.referenceFrame;
  if(!plan||atlas?.type!=='rigid-parts'||!r||!outlines?.length)return null;
  const {frame,width,height,x,y,angle=0,scaleX=1,scaleY=1,flipX=false}=rendered;
  if(!frame||![width,height,x,y,angle,scaleX,scaleY].every(Number.isFinite)||width<=0||height<=0)return null;
  const sin=Math.sin(angle),cos=Math.cos(angle),sx=scaleX*(flipX?-1:1);
  const xx=sin*sx*width/(r.scale*r.width),yy=cos*scaleY*height/(r.scale*r.height);
  const origin=y-sin*sx*width*(r.tx/(r.scale*r.width)+frame.anchorX)
    -cos*scaleY*height*(r.ty/(r.scale*r.height)+frame.anchorY);
  const resolve=plan.resolvedJointPose?resolvedJointMatrix:jointMatrix;
  let bottom=-Infinity;
  for(const outline of outlines) {
    const m=resolve(supportMatrix,atlas,plan,outline.bone,outline.upper,supportScratch);
    const a=xx*m[0]+yy*m[1],b=xx*m[2]+yy*m[3],c=origin+xx*m[4]+yy*m[5];
    for(const p of outline.hull)bottom=Math.max(bottom,a*p[0]+b*p[1]+c);
  }
  return Number.isFinite(bottom)?bottom:null;
}

// The existing rigid interpolation and fixed-length IK own this transition.
// In particular, the lower pelvis is not replaced by the attacking torso.
export function v177InterpolateCapturedJointPose(kind,initial,finalPose,progress) {
  const source=V177_JOINT_ATLASES[kind];
  if(!source || source.type!=='rigid-parts' || !initial || !finalPose)return null;
  // A captured overhead weapon can rotate far before reaching its resting
  // pose. Interpolating its image origin can carry the grip outside the arm's
  // reach. Retain authored pivots, and otherwise interpolate the original
  // wrist/ankle endpoint used by the same fixed-length limb chain.
  const interpolationPivots={...source.interpolationPivots};
  for(const chain of [...(source.armConstraints??[]),...(source.legConstraints??[])])
    interpolationPivots[chain.effectorBone]??=chain.effectorWrist??chain.ankle??chain.wrist;
  const atlas={...source,interpolationPivots,poses:[initial.lower,initial.upper,finalPose]},p=clamp(progress);
  const plan={lowerIndex:0,lowerNextIndex:2,lowerBlend:p,
    upperIndex:1,upperNextIndex:2,upperBlend:p,attackPhase:null,upperOffsetY:0};
  const scratch=[new Float64Array(6),new Float64Array(6)];
  return atlas.parts.map(part=>[...jointMatrix(new Float64Array(6),atlas,plan,part.bone,part.upper,scratch)]);
}

// Draw each original atlas part once. A severed group can be drawn separately
// from the remaining body without copying a piece from an unrelated raw frame.
export function drawV177ResolvedJointPose(ctx,image,kind,matrices,x,y,width,height,{omitParts,onlyParts}={}) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || atlas.type!=='rigid-parts' || atlas.mouth || !image?.naturalWidth
    || matrices?.length!==atlas.parts.length)return false;
  const selected=atlas.parts.map((part,index)=>({part,matrix:matrices[index]}))
    .filter(({part})=>(!onlyParts || onlyParts.has(part.name)) && !omitParts?.has(part.name));
  if(!selected.length || selected.some(({matrix})=>matrix?.length!==6 || !matrix.every(Number.isFinite)))return false;
  const reference=atlas.referenceFrame;
  ctx.save();if(atlas.paintStyle==='pixel-art')ctx.imageSmoothingEnabled=false;
  ctx.translate(x,y);ctx.scale(width/(reference?.width??atlas.width),height/(reference?.height??atlas.height));
  if(reference){ctx.translate(-reference.tx/reference.scale,-reference.ty/reference.scale);ctx.scale(1/reference.scale,1/reference.scale);}
  for(const {part,matrix}of selected){
    const s=part.source,d=part.destination;
    ctx.save();ctx.transform(...matrix);ctx.drawImage(image,s.x,s.y,s.w,s.h,d.x,d.y,d.w,d.h);ctx.restore();
  }
  ctx.restore();return true;
}

export function v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose,x,y,bob=0,depthScale=1}) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || !plan || plan.attackPhase===null)return null;
  let px,py,dy=plan.upperOffsetY;
  if(atlas.type==='rigid-parts'){
    const resolve=plan.resolvedJointPose ? resolvedJointMatrix : jointMatrix;
    const m=resolve(new Float64Array(6),atlas,plan,atlas.weaponBone,true),[sx,sy]=atlas.muzzle;
    px=m[0]*sx+m[2]*sy+m[4];py=m[1]*sx+m[3]*sy+m[5];dy=0;
  }else if(atlas.upperRig&&plan.upperRigPlan&&plan.upperRigPoses){
    const rig={...atlas.upperRig,poses:plan.upperRigPoses};
    const m=new Float64Array(6),[sx,sy]=rig.muzzle;
    if(plan.rangerStunUpperPose)m.set(plan.rangerStunUpperPose[rig.weaponBone]);
    else jointMatrix(m,rig,plan.upperRigPlan,rig.weaponBone,true);
    px=m[0]*sx+m[2]*sy+m[4];py=m[1]*sx+m[3]*sy+m[5];
  }else [px,py]=atlas.muzzles[plan.upperIndex-atlas.lowerCount];
  const reference=atlas.referenceFrame;
  if(reference){px=(px-reference.tx)/reference.scale;py=(py-reference.ty)/reference.scale;dy/=reference.scale;}
  const facing=direction==='left'?-1:1;
  const lx=(px/(reference?.width??atlas.width)-frame.anchorX)*size.w*(frame.flipX?-1:1)*pose.scaleX;
  const ly=((py+dy)/(reference?.height??atlas.height)-frame.anchorY)*size.h*pose.scaleY;
  const angle=pose.rotationRadians*facing,c=Math.cos(angle),s=Math.sin(angle);
  return {x:x+pose.offsetX*depthScale*facing+lx*c-ly*s,
    y:y-bob+pose.offsetY*depthScale+lx*s+ly*c};
}
