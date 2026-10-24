import { V177_PAISEN_PHOTO_JOINT_ATLASES as paisenPhotoAtlases } from './v177PaisenPhotoJointData.js';
import { V177_JOINT_ATLASES as bakedAtlases } from './v177JointData.js';
import { V177_QUADRUPED_JOINT_ATLASES as quadrupedAtlases } from './v177QuadrupedJointData.js';
import { V177_BIPED_JOINT_ATLASES as bipedAtlases } from './v177BipedJointData.js';
import { V177_ENEMY_JOINT_ATLASES as enemyAtlases } from './v177EnemyJointData.js';
import { V177_RUNNER_JOINT_ATLASES as runnerAtlases } from './v177RunnerJointData.js';
import { V177_FIREARM_JOINT_ATLASES as firearmAtlases } from './v177FirearmJointData.js';
import { V177_PANTHER_JOINT_ATLASES as pantherAtlases } from './v177PantherJointData.js';
import { V177_MELEE_JOINT_ATLASES as meleeAtlases } from './v177MeleeJointData.js';
import { V105_CRAZY_KING_JOINT_ATLAS as crazyKingRestoredAtlas } from './v105CrazyKingJointData.js';
import { V177_GUARD_ENEMY_JOINT_ATLASES as guardEnemyAtlases } from './v177GuardEnemyJointData.js';
import { V177_NEWCOMER_JOINT_ATLASES as newcomerAtlases } from './v177NewcomerJointData.js';
import { V177_INFECTED_JOINT_ATLASES as infectedAtlases } from './v177InfectedJointData.js';
import { V104_OMEGA_JOINT_ATLASES as omegaRightAtlases } from './v104OmegaJointData.js';
import { V177_FERAL_JOINT_ATLASES as feralAtlases } from './v177FeralJointData.js';
import { V177_FUTAGO_JOINT_ATLASES as futagoAtlases } from './v177FutagoJointData.js';
import { v177RangerCarryPose } from './v177RangerUpperMotion.js';
import { v177RangerLowerBob } from './v177RangerLowerMotion.js';
import { drawV177RangerLower } from './v177RangerLowerPaint.js';
import {v177RecessedMouthContour} from './v177MouthCavity.js';
import { v177RangerFootPlacement } from './v177RangerFootPlacement.js';
import { MAYO_RETREAT_TIMING } from './mayoLifecycle.js';
import { v177PaintLocomotion } from './v177PaintLocomotion.js';
import { applyV177GroundedMatrix, v177GroundedJointPlan, v177BlendGroundedMotion, sampleV177AttackSteps } from './v177GroundedMotion.js';
import { v177JointActorKey, v177JointBodyCorrection } from './v177JointActorHistory.js';
import {v177WeaponChoreography,v177GroundedWeaponChoreography} from './v177WeaponChoreography.js';
import {v105GroundStrikePlan} from './v105GroundStrike.js';
import {V177_CORPSE_JOINT_DATA} from './v177CorpseJointData.js';
import { animationClipFor, attackPresentationDuration } from './combatPresentation.js';
import { createV177MrsNormalWeaponCycle } from './v177MrsNormalWeaponCycle.js';
import { createV177RangerManualJoint } from './v177RangerManualJoint.js';
import { createV177FutagoAbilityJoint } from './v177FutagoAbilityJoint.js';
import { v177FirearmUpperMotion, applyV177FirearmUpperMotion,
  v177FirearmWeaponPullback, applyV177FirearmWeaponPullback } from './v177FirearmUpperMotion.js';

const locomotionStates = new Set(['idle','deploy','move','start-move','stop-move','turn','retreat']);
const attackStates = new Set(['wind-up','active','recovery']);
const recoveryStates = new Set(['reload','weapon-cycle']);
const hitStates = new Set(['hit','hit-light','hit-heavy']);
const renderedJointPoses = new WeakMap();
const bipedFootRigs = new WeakMap();
const livingStunPoses = new WeakMap();
const mayoRetreatPoses = new WeakMap();
const actorKey = actor => actor && typeof actor === 'object' ? actor : null;
function rememberRenderedJointPose(actor,kind,plan,lowerReceipt=null) {
  const key=actorKey(actor);
  if(!key)return;
  if(plan)renderedJointPoses.set(key,{kind,plan:{...(plan.phaseChangeBasePlan??plan)},lowerReceipt});
  else { renderedJointPoses.delete(key); livingStunPoses.delete(key); }
}
export function v177RenderedWeightedLowerReceipt(actor,world) {
  const entry=renderedJointPoses.get(v177JointActorKey(actor,world));
  return entry?.kind==='ranger'&&entry.lowerReceipt?{...entry.lowerReceipt}:null;
}
const clamp = p => Math.max(0, Math.min(1, Number(p) || 0));
const cycle = p => ((Number(p) || 0) % 1 + 1) % 1;

export const V177_JOINT_ATLASES = Object.fromEntries(Object.entries({...bakedAtlases,...quadrupedAtlases,...bipedAtlases,...enemyAtlases,...runnerAtlases,...firearmAtlases,...pantherAtlases,...meleeAtlases,...guardEnemyAtlases,...newcomerAtlases,...infectedAtlases,...feralAtlases,...futagoAtlases,...paisenPhotoAtlases,...omegaRightAtlases,'crazy-king':crazyKingRestoredAtlas}));

const mrsNormalWeaponCycle=createV177MrsNormalWeaponCycle({
  animationClipFor,attackPresentationDuration,captureStatusJoints,jointMatrix,
});
const rangerManualJoint=createV177RangerManualJoint({
  normalPlan:(sample,runtime)=>v177JointPose('ranger',sample,runtime),
  captureUpper:captureRangerUpper,
  blendUpper:(atlas,initial,target,p)=>blendCapturedJoints(atlas.upperRig,
    {lower:initial,upper:initial},{lower:target,upper:target},p).upper,
});

const futagoAbilityJoint=createV177FutagoAbilityJoint({
  normalPlan:(kind,sample,runtime)=>v177JointPose(kind,sample,runtime,{grounded:true}),
  capturePose:captureStatusJoints,blendPose:blendCapturedJoints,
});

export function v177JointCycleDistance(kind, renderScale) {
  const atlas = V177_JOINT_ATLASES[kind];
  const cycleDistance=atlas?.lowerRig ? atlas.lowerRig.spanPx/atlas.lowerRig.stanceFraction : atlas?.cycleDistance;
  return atlas && Number.isFinite(renderScale) && renderScale > 0
    ? cycleDistance / (atlas.referenceFrame?.scale??1) * renderScale : undefined;
}

export function v177GroundedJointPose(kind,source,sample,runtime){
  const atlas=V177_JOINT_ATLASES[kind];
  let sourceFeet;
  if(source?.choreography?.stepDistance>0&&!source.stepLeadBone&&atlas?.legConstraints?.length===2){
    sourceFeet={};const foot=new Float64Array(6);
    for(const leg of atlas.legConstraints){
      interpolatedMatrix(foot,atlas,source,leg.effectorBone,false,true,false);
      sourceFeet[leg.effectorBone]=matrixPoint(foot,leg.ankle);
    }
  }
  const plan=v177GroundedJointPlan(kind,atlas,source,sample,runtime,sourceFeet);
  if(!plan?.groundedMotion)return plan;
  // Transfer the hips over the planted feet without extending source bones.
  // Intersect every leg's reachable vertical interval; never move a plant to
  // hide an unreachable pose or fall back to disconnected limb matrices.
  const parent=new Float64Array(6),foot=new Float64Array(6);
  let lo=-Infinity,hi=Infinity;
  for(const leg of atlas.legConstraints??[]){
    interpolatedMatrix(parent,atlas,plan,leg.parentBone,leg.parentUpper!==false);
    interpolatedMatrix(foot,atlas,plan,leg.effectorBone,false);
    const [hx,hy]=matrixPoint(parent,leg.hip),[fx,fy]=matrixPoint(foot,leg.ankle);
    const reach=Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1])
      +Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])-.001;
    const vertical=Math.sqrt(Math.max(0,reach*reach-(fx-hx)*(fx-hx)));
    lo=Math.max(lo,fy-hy-vertical);hi=Math.min(hi,fy-hy+vertical);
  }
  if(lo<=hi){const dy=Math.max(lo,Math.min(hi,0));
    plan.groundedMotion.lower[5]+=dy;plan.groundedMotion.upper[5]+=dy;}
  return groundedHeldWeapons(kind,atlas,plan);
}

const presidentSoles=V177_CORPSE_JOINT_DATA['mugarian-president-mutated'].outlines
 .filter(o=>V177_JOINT_ATLASES['mugarian-president-mutated'].legConstraints.some(l=>l.paintedPaw===o.name));
function groundedHeldWeapons(kind,atlas,plan){
 if(['brute','takuya'].includes(kind)&&plan.bipedFeet&&['ground-slam','slam'].includes(plan.abilityPresentation))
  return v105GroundStrikePlan(kind,atlas,plan,v177CaptureJointPose(kind,plan));
 if(kind!=='mugarian-president-mutated')return kind==='takuya-omega'
  ?v177GroundedWeaponChoreography(kind,atlas,plan):plan;
 let soleFloor;
 if(kind==='mugarian-president-mutated'&&plan.choreography&&plan.groundedMotion){
  soleFloor=-Infinity;const m=new Float64Array(6);
  for(const o of presidentSoles){
   const part=atlas.parts.find(p=>p.name===o.name);jointMatrix(m,atlas,plan,part.bone,false);
   for(const p of o.hull)soleFloor=Math.max(soleFloor,m[1]*p[0]+m[3]*p[1]+m[5]);
  }
 }
 return v177GroundedWeaponChoreography(kind,atlas,plan,soleFloor);
}

export function v177JointPose(kind, sample, runtime, { grounded=false,ownedPose=false,actor,world,stunRemaining=0,rangerManualOwner=false,rangerManualDefinition,futagoAbilityOwner=false,futagoAbilityTuning }={}) {
  const actualActor=actor;
  actor=v177JointActorKey(actor,world);
  const atlas = V177_JOINT_ATLASES[kind];
  if(actualActor?.kind==='mayo-chan'){
    const retreat=mayoRetreatJointPose(kind,atlas,runtime,actor,actualActor);
    if(retreat){livingStunPoses.delete(actor);return retreat;}
  }
  if(atlas&&ownedPose&&futagoAbilityOwner&&['futago-separated-a','futago-separated-b'].includes(kind)){
    const abilityPlan=futagoAbilityJoint.plan({kind,actor:actualActor,atlas,runtime,
      previous:actorKey(actor)?renderedJointPoses.get(actor):null,ownedPose,
      owner:futagoAbilityOwner,tuning:futagoAbilityTuning});
    if(abilityPlan){livingStunPoses.delete(actor);return abilityPlan;}
  }
  if(kind==='ranger'&&atlas&&ownedPose&&rangerManualOwner){
    const manualPlan=rangerManualJoint.plan({kind,actor:actualActor,atlas,runtime,
      previous:actorKey(actor)?renderedJointPoses.get(actor):null,ownedPose,
      owner:rangerManualOwner,definition:rangerManualDefinition});
    if(manualPlan){livingStunPoses.delete(actor);return manualPlan;}
  }
  if (!atlas || ownedPose) { rememberRenderedJointPose(actor,kind,null); return null; }
  if(kind==='mrs-chiha')sample=mrsNormalWeaponCycle.sample(kind,sample,actualActor,{enabled:true,ownedPose});
  const state=sample?.requestedState;
  if(state==='incapacitated')return kind==='ranger'&&atlas.upperRig
    ? rangerLivingStunJointPose(kind,atlas,runtime,actor,stunRemaining)
    : livingStunJointPose(kind,atlas,runtime,actor,stunRemaining,grounded);
  if(actorKey(actor))livingStunPoses.delete(actor);
  if(hitStates.has(state)) {
    const previous=actorKey(actor) ? renderedJointPoses.get(actor) : null;
    if(previous?.kind!==kind) { rememberRenderedJointPose(actor,kind,null); return null; }
    // The existing rigid recoil still moves the body. Keep its last painted
    // feet, head and weapon instead of snapping to a different static hit row.
    const paintLocomotion=previous.plan.paintLocomotion;
    const held={...previous.plan,reactionHeld:true,...(paintLocomotion?{
      paintLocomotion:v177PaintLocomotion(runtime,paintLocomotion,{time:world?.time,x:actualActor?.x,held:true}),
    }:{})};
    return grounded?v177GroundedJointPose(kind,held,sample,runtime):held;
  }
  if (!locomotionStates.has(state) && !attackStates.has(state) && !recoveryStates.has(state)) {
    rememberRenderedJointPose(actor,kind,null); return null;
  }
  const variant=sample?.attackVariant ? atlas.attackVariants?.[sample.attackVariant] : null;
  if(sample?.attackVariant && !variant) { rememberRenderedJointPose(actor,kind,null); return null; }
  const previousPaint=actorKey(actor)?renderedJointPoses.get(actor):null;
  const paintLocomotion=atlas.type==='rigid-parts'&&Number.isFinite(world?.time)&&Number.isFinite(actualActor?.x)
    ? v177PaintLocomotion(runtime,previousPaint?.kind===kind&&!previousPaint.plan.liveStun
      ?previousPaint.plan.paintLocomotion:null,
      {time:world?.time,x:actualActor?.x}) : null;
  const phase=cycle(runtime?.locomotionPhase);
  const phaseIndex=Math.floor(phase*atlas.frameCount) % atlas.frameCount;
  const settleFrame=clamp(paintLocomotion?.settle??runtime?.locomotionSettle??1)*(atlas.settleLevels-1);
  const settleIndex=atlas.type==='rigid-parts'?Math.floor(settleFrame):Math.round(settleFrame);
  // Baked lowers keep the actual-travel phase through aiming and firing.
  // Ranger's continuous lower finishes its stop steps through painted history;
  // neither path advances the gameplay walking phase while stationary.
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
    // The runtime already eases stopping continuously. Bracket its original
    // authored rows as well, rather than jumping between four rounded poses.
    // Both axes meet at the existing pivots before fixed-length IK resolves
    // the limbs. No second bitmap, captured-pose allocation or clock is used.
    const nextSettle=Math.min(atlas.settleLevels-1,settleIndex+1),settleBlend=settleFrame-settleIndex;
    const offset=atlas.pelvisOffsets[settleIndex][phaseIndex]*(1-blend)+atlas.pelvisOffsets[settleIndex][nextPhase]*blend;
    const nextOffset=atlas.pelvisOffsets[nextSettle][phaseIndex]*(1-blend)+atlas.pelvisOffsets[nextSettle][nextPhase]*blend;
    const plan={abilityPresentation:sample?.abilityPresentation,paintLocomotion,lowerIndex,lowerNextIndex:settleIndex*atlas.frameCount+nextPhase,lowerBlend:blend,
      upperIndex:attackPhase===null?lowerIndex:attackBase+attackIndex,
      upperNextIndex:attackPhase===null?settleIndex*atlas.frameCount+nextPhase:attackBase+Math.min(atlas.frameCount,attackIndex+1),
      upperBlend:attackPhase===null?blend:attackFrame-attackIndex,phase,settleIndex,attackPhase,
      settleFrameOffset:(nextSettle-settleIndex)*atlas.frameCount,settleBlend,
      upperOffsetY:offset+(nextOffset-offset)*settleBlend};
    if((kind==='medic'||kind==='engineer'||kind==='gunner')&&attackStates.has(state)){
      const spine=jointMatrix(new Float64Array(6),atlas,plan,'spine',true);
      const follow=v177FirearmUpperMotion(kind,sample,spine,{actor:actualActor,world});
      if(follow)plan.firearmUpperTransform=follow;
      const pullback=v177FirearmWeaponPullback(kind,sample);
      if(pullback)plan.firearmWeaponPullback=pullback;
    }
    let choreographed=v177WeaponChoreography(kind,atlas,plan,actualActor);
    const previous=previousPaint?.kind===kind?previousPaint.plan:null;
    if(choreographed.choreography?.stepDistance>0&&previous?.stepLeadBone
      &&previous.choreography?.sequence===choreographed.choreography.sequence
      &&Number.isFinite(previous.attackPhase)&&previous.attackPhase<=choreographed.attackPhase)
      choreographed={...choreographed,stepLeadBone:previous.stepLeadBone};
    const painted=grounded?v177GroundedJointPose(kind,choreographed,sample,runtime):choreographed;
    return kind==='mrs-chiha'&&sample?.mrsNormalWeaponCycle
      ? mrsNormalWeaponCycle.plan(kind,sample,painted,atlas) : painted;
  }
  const upperIndex=atlas.lowerCount+(attackPhase===null ? 0 : 1+Math.round(attackPhase*atlas.frameCount));
  const plan={lowerIndex,upperIndex,phase,settleIndex,attackPhase,
    upperOffsetY:atlas.pelvisOffsets[settleIndex][phaseIndex]};
  if(atlas.upperRig&&atlas.lowerRig){plan.lowerSettle=clamp(runtime?.locomotionSettle??1);plan.upperOffsetY=v177RangerLowerBob(phase,plan.lowerSettle);}
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
    attackPhase:null,upperOffsetY:0,wristArcs:independentWrists(atlas)},result={lower:{},upper:{}};
  const scratch=[new Float64Array(6),new Float64Array(6)],matrix=new Float64Array(6);
  for(const bone of Object.keys(atlas.poses[0]))for(const upper of [false,true])
    result[upper?'upper':'lower'][bone]=[...jointMatrix(matrix,rig,plan,bone,upper,scratch)];
  return result;
}

// Protected withdrawal is a living fall/rise, not a corpse or a legacy sheet.
// Keep the visible normal/feral rig and use only the existing retreat clock.
function mayoRetreatJointPose(kind,atlas,runtime,key,actor){
  if(!actorKey(key))return null;
  const retreat=actor.mayoRetreat;
  if(!retreat||!['fall','rise'].includes(retreat.phase)){
    mayoRetreatPoses.delete(key);return null;
  }
  if(!['mayo-chan','mayo-chan-feral'].includes(kind)||atlas?.type!=='rigid-parts'
    ||!Number.isFinite(retreat.phaseElapsed)||retreat.phaseElapsed<0)return null;
  let entry=mayoRetreatPoses.get(key);
  if(!entry||entry.kind!==kind){
    const standing=v177JointPose(kind,{requestedState:'idle'},
      {...runtime,moving:false,locomotionSettle:1},{grounded:true});
    if(!standing)return null;
    const neutral=captureStatusJoints(atlas,standing),previous=renderedJointPoses.get(key);
    const initial=previous?.kind===kind?captureStatusJoints(atlas,previous.plan):copyCapturedJoints(neutral);
    const folded=copyCapturedJoints(neutral);
    const clearance=atlas.legConstraints.map(leg=>{
      const hip=matrixPoint(neutral[leg.parentUpper===false?'lower':'upper'][leg.parentBone],leg.hip);
      const paw=matrixPoint(neutral.lower[leg.effectorBone],leg.ankle);
      return Math.max(0,paw[1]-hip[1]);
    });
    const drop=Math.min(42,...clearance.map(value=>value*.5));
    transformUpperJoints(folded,[1,0,0,1,0,drop]);
    // A small neck dip follows the same head/child attachments as the live rig.
    const pivot=atlas.parentAttachments?.head?.pivot??atlas.interpolationPivots?.head;
    if(pivot){
      const [px,py]=matrixPoint(folded.upper[atlas.parentAttachments?.head?.parent??'spine'],pivot);
      const c=Math.cos(.12),s=Math.sin(.12),t=[c,s,-s,c,px-c*px+s*py,py-s*px-c*py];
      const followsHead=bone=>bone==='head'||atlas.parentAttachments?.[bone]?.parent==='head';
      for(const bone of Object.keys(folded.upper))if(followsHead(bone))folded.upper[bone]=multiplyMatrix(t,folded.upper[bone]);
    }
    resolveUpperOwnedLegs(atlas,folded,true);
    entry={kind,standing,initial,neutral,folded,drop};mayoRetreatPoses.set(key,entry);
  }
  const progress=smooth(retreat.phaseElapsed/(retreat.phase==='fall'?MAYO_RETREAT_TIMING.fallSeconds:MAYO_RETREAT_TIMING.riseSeconds));
  const pose=retreat.phase==='fall'?blendCapturedJoints(atlas,entry.initial,entry.folded,progress)
    :blendCapturedJoints(atlas,entry.folded,entry.neutral,progress);
  return {...entry.standing,resolvedJointPose:pose,attackPhase:null,
    mayoRetreatJoint:{phase:retreat.phase,elapsed:retreat.phaseElapsed,progress,drop:entry.drop,sourceAtlas:atlas.path}};
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

function resolveUpperOwnedLegs(atlas,pose,all=false) {
  const rig={...atlas,poses:[pose.lower,pose.upper]};
  const plan={lowerIndex:0,lowerNextIndex:0,lowerBlend:0,upperIndex:1,upperNextIndex:1,upperBlend:0,
    attackPhase:null,upperOffsetY:0},scratch=[new Float64Array(6),new Float64Array(6)],matrix=new Float64Array(6);
  for(const chain of atlas.legConstraints??[])if(all||chain.parentUpper!==false)for(const bone of [chain.upperBone,chain.lowerBone]){
    const m=[...jointMatrix(matrix,rig,plan,bone,false,scratch)];
    pose.lower[bone]=m;pose.upper[bone]=[...m];
  }
  return pose;
}

function returnSteppedFeet(atlas,entry,pose,progress,footProgress){
  const start=entry.stepReturn;if(!start)return pose;
  const now=sampleV177AttackSteps(atlas,{...start,phase:start.phase+(1-start.phase)*footProgress});
  if(!now)return pose;
  const dx=now.travel-(1-progress)*start.travel;
  for(const leg of atlas.legConstraints){
    const from=start.feet[leg.effectorBone],to=now.feet[leg.effectorBone],m=pose.lower[leg.effectorBone];
    m[4]+=to.x-(1-progress)*from.x;m[5]+=(1-progress)*from.lift-to.lift;
  }
  pose.lower.pelvis[4]+=dx;
  for(const m of Object.values(pose.upper))m[4]+=dx;
  let lo=-Infinity,hi=Infinity;
  for(const leg of atlas.legConstraints){
    const hip=matrixPoint(pose[leg.parentUpper===false?'lower':'upper'][leg.parentBone],leg.hip),foot=matrixPoint(pose.lower[leg.effectorBone],leg.ankle);
    const reach=Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1])+Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])-.001;
    const vertical=Math.sqrt(Math.max(0,reach*reach-(foot[0]-hip[0])**2));
    lo=Math.max(lo,foot[1]-hip[1]-vertical);hi=Math.min(hi,foot[1]-hip[1]+vertical);
  }
  const dy=lo<=hi?Math.max(lo,Math.min(hi,0)):0;
  pose.lower.pelvis[5]+=dy;for(const m of Object.values(pose.upper))m[5]+=dy;
  if(pose.returnPlan?.groundedMotion){
    const motion=pose.returnPlan.groundedMotion,lower=[...motion.lower],upper=[...motion.upper];
    lower[4]+=dx;upper[4]+=dx;lower[5]+=dy;upper[5]+=dy;
    pose.returnPlan={...pose.returnPlan,groundedMotion:{...motion,lower,upper,steps:now},stepLeadBone:now.leadBone};
  }
  pose.stepReturn=now;
  return resolveUpperOwnedLegs(atlas,pose,true);
}

function returnPaintedJoints(atlas,entry,neutral,progress,footProgress=progress) {
  const authoredReturn=Number.isFinite(entry.sourcePlan.attackPhase)
    && entry.sourcePlan.mrsNormalWeaponCycle!==true&&!entry.sourcePlan.futagoAbilityJoint;
  const target=captureStatusJoints(atlas,neutral);
  if(progress<=0)return {...copyCapturedJoints(entry.pose),upperTransform:entry.upperTransform,
    returnPlan:authoredReturn?entry.sourcePlan:null,stepReturn:entry.stepReturn};
  if(progress>=1&&(!entry.stepReturn||footProgress>=1))return {...target,upperTransform:identityMatrix(),returnPlan:null,stepReturn:entry.stepReturn?sampleV177AttackSteps(atlas,{...entry.stepReturn,phase:1}):null};
  let pose=blendCapturedJoints(atlas,entry.basePose,target,progress);
  if(authoredReturn){
    // A long two-handed swing cannot be cross-faded directly to ready: an
    // intermediate weapon angle can lie outside both fixed arm reaches. Follow
    // the original authored return path before joining the current carry pose.
    const attackPhase=entry.sourcePlan.attackPhase+(1-entry.sourcePlan.attackPhase)*clamp(progress/.7);
    const attackBase=entry.sourcePlan.upperIndex-Math.floor(entry.sourcePlan.attackPhase*atlas.frameCount);
    const frame=attackPhase*atlas.frameCount,index=Math.floor(frame);
    let returning={...neutral,attackPhase,upperIndex:attackBase+index,
      abilityPresentation:entry.sourcePlan.abilityPresentation,
      ...(entry.sourcePlan.groundStrike?{bipedFeet:entry.sourcePlan.bipedFeet,bipedFootTargets:entry.sourcePlan.bipedFootTargets}:{}),
      upperNextIndex:attackBase+Math.min(atlas.frameCount,index+1),upperBlend:frame-index,
      upperOffsetY:entry.sourcePlan.upperOffsetY+(neutral.upperOffsetY-entry.sourcePlan.upperOffsetY)*progress,
      firearmWeaponPullback:(entry.sourcePlan.firearmWeaponPullback??0)*(1-smooth(progress)),
      groundedMotion:v177BlendGroundedMotion(entry.sourcePlan.groundStrikeSourceMotion??entry.sourcePlan.groundedMotion,neutral.groundedMotion,progress)};
    if(entry.sourcePlan.choreography){
      const kind=entry.sourcePlan.choreography.kind;
      returning=v177WeaponChoreography(kind,atlas,returning,
        {attackSequence:entry.sourcePlan.choreography.sequence,attackWindup:1});
      // President's returning feet are resolved below. Constraining its cane
      // against the neutral lower here would jump the last painted wrist.
      if(kind!=='mugarian-president-mutated')returning=groundedHeldWeapons(kind,atlas,returning);
    }
    const source=captureStatusJoints(atlas,returning);
    pose.upper=progress<=.7 ? source.upper
      : blendCapturedJoints(atlas,source,target,smooth((progress-.7)/.3)).upper;
    pose.returnPlan=progress<=.7?returning:null;
  }
  // An ordinary hit can hold an already reacting body. Strip its one common
  // rigid transform before interpolating, then ease that transform out once.
  // This preserves both-hand reach without recapturing a growing body lean.
  pose=returnSteppedFeet(atlas,entry,pose,progress,footProgress);
  const angle=Math.atan2(entry.upperTransform[1],entry.upperTransform[0])*(1-progress),c=Math.cos(angle),s=Math.sin(angle);
  pose.upperTransform=[c,s,-s,c,entry.upperTransform[4]*(1-progress),entry.upperTransform[5]*(1-progress)];
  transformUpperJoints(pose,pose.upperTransform);
  return pose;
}

function captureRangerUpper(atlas,plan) {
  const captured=plan.rangerManualUpperPose??plan.rangerStunUpperPose;
  if(captured)return Object.fromEntries(Object.entries(captured).map(([bone,m])=>[bone,[...m]]));
  const rig={...atlas.upperRig,poses:plan.upperRigPoses},pose={},matrix=new Float64Array(6);
  const scratch=[new Float64Array(6),new Float64Array(6)];
  for(const bone of Object.keys(rig.poses[0]))pose[bone]=[...jointMatrix(matrix,rig,plan.upperRigPlan,bone,true,scratch)];
  return pose;
}

// A dead Ranger retains the actual weighted feet and both painted grips. No
// living actor or clock is supplied when this immutable paint is drawn again.
export function v177CaptureRangerPaint(plan) {
  const atlas=V177_JOINT_ATLASES.ranger;
  if(!plan?.upperRigPlan||!plan.upperRigPoses)return null;
  return {...structuredClone(plan),rangerStunUpperPose:captureRangerUpper(atlas,plan)};
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
  // Keep the last painted lower at entry, then use the same continuous source
  // pose as neutral. No mutable painter buffer enters this actor history.
  const lower=elapsed===0?entry.plan:neutral;
  return {...neutral,lowerIndex:lower.lowerIndex,lowerSettle:lower.lowerSettle,upperOffsetY:lower.upperOffsetY,phase:lower.phase,settleIndex:lower.settleIndex,
    liveStun:true,rangerStunUpperPose:upper,rangerStunUpperTransform:transform,stunElapsed:elapsed,stunRemaining:remaining};
}

function livingStunJointPose(kind,atlas,runtime,actor,remaining,grounded=false) {
  const key=actorKey(actor),previous=key?renderedJointPoses.get(key):null;
  if(atlas.type!=='rigid-parts'||!(remaining>0)||previous?.kind!==kind){
    rememberRenderedJointPose(actor,kind,null);return null;
  }
  const clock=Math.max(0,Number(runtime?.elapsedSeconds)||0),epoch=runtime?.transitionCount;
  let entry=livingStunPoses.get(key);
  if(!entry||entry.kind!==kind||entry.epoch!==epoch||clock<entry.clock){
    const pose=captureStatusJoints(atlas,previous.plan),basePose=copyCapturedJoints(pose);
    const upperTransform=previous.plan.stunUpperTransform??previous.plan.firearmUpperTransform??identityMatrix();
    if(previous.plan.stunUpperTransform||previous.plan.firearmUpperTransform)transformUpperJoints(basePose,inverseMatrix(upperTransform));
    const step=previous.plan.stunStepReturn??previous.plan.groundedMotion?.steps;
    const stepReturn=step?{...step,feet:Object.fromEntries(Object.entries(step.feet).map(([bone,value])=>[bone,{...value}]))}:null;
    entry={kind,epoch,clock,remaining,pose,basePose,upperTransform,stepReturn,
      groundedCane:kind==='mugarian-president-mutated'&&Boolean(previous.plan.choreography?.groundedCaneSource||previous.plan.groundedCaneReturn),
      frontBones:[...(previous.plan.frontBones??previous.plan.choreography?.frontBones??[])],
      sourcePlan:previous.plan.stunReturnPlan??previous.plan};
    livingStunPoses.set(key,entry);
  }
  const neutral=v177JointPose(kind,{requestedState:'idle'},runtime,{grounded});
  const elapsed=Math.max(0,clock-entry.clock),exitWindow=Math.min(.12,entry.remaining);
  const progress=1-(1-smooth(elapsed/.12))*smooth(remaining/exitWindow);
  const footWindow=Math.min(.28,entry.remaining),footProgress=1-(1-smooth(elapsed/.28))*smooth(remaining/footWindow);
  const amplitude=smooth(elapsed/.1)*smooth(remaining/.1);
  const returning=returnPaintedJoints(atlas,entry,neutral,progress,footProgress);
  let resolved=progress===0&&amplitude===0 ? returning : leanCapturedJoints(atlas,returning,amplitude);
  if(entry.groundedCane&&(progress!==0||amplitude!==0)){
    let soleFloor=-Infinity;
    for(const o of presidentSoles){
      const bone=atlas.parts.find(p=>p.name===o.name).bone,m=resolved.lower[bone];
      for(const p of o.hull)soleFloor=Math.max(soleFloor,m[1]*p[0]+m[3]*p[1]+m[5]);
    }
    const fixed=v177GroundedWeaponChoreography(kind,atlas,{choreography:{upper:resolved.upper},
      groundedMotion:{upper:identityMatrix()}},soleFloor);
    resolved.upper=fixed.choreography.upper;
    const rig={...atlas,poses:[resolved.lower,resolved.upper]},pose={lowerIndex:0,upperIndex:1,
      lowerNextIndex:0,upperNextIndex:1,lowerBlend:0,upperBlend:0,attackPhase:null,upperOffsetY:0};
    const cane=atlas.armConstraints.find(c=>c.effectorBone==='weapon-0'),matrix=new Float64Array(6);
    for(const bone of[cane.upperBone,cane.lowerBone])resolved.upper[bone]=[...jointMatrix(matrix,rig,pose,bone,true)];
  }
  return {...neutral,liveStun:true,resolvedJointPose:resolved,stunElapsed:elapsed,stunRemaining:remaining,
    ...(entry.groundedCane?{groundedCaneReturn:true}:{}),
    frontBones:entry.frontBones,
    stunUpperTransform:resolved.upperTransform,stunReturnPlan:resolved.returnPlan??null,stunStepReturn:resolved.stepReturn??null};
}

// Resolve before the renderer samples muzzle/ground sockets. Successful draw
// remains the only publisher of the next actor's foot history.
export function v177RangerFootPlan(kind,plan,{actor,world,width,direction}={}) {
  const atlas=V177_JOINT_ATLASES[kind],runtime=actor?.animationPresentation;
  if(kind!=='ranger'||!plan?.upperRigPlan||!atlas?.lowerRig)return plan;
  const previous=renderedJointPoses.get(v177JointActorKey(actor,world)),state=plan.rangerFeet;
  const scale=width/atlas.width,bodyCorrection=v177JointBodyCorrection(actor,world);
  const current=state&&state.time===world?.time&&state.root===actor?.x&&state.scale===scale
    &&state.phase===runtime?.locomotionPhase&&(state.bodyCorrection??0)===bodyCorrection;
  // A newly activated ability can own direction before the next simulation
  // tick updates locomotion. Its prepaint plan must survive the draw's read.
  const facing=direction===undefined&&current ? state.turnTargetFacing??state.facing
    : (direction??runtime?.direction)==='left'?-1:1;
  if(current&&(state.turnTargetFacing??state.facing)===facing)return plan;
  const feet=v177RangerFootPlacement(atlas.lowerRig,previous?.plan?.rangerFeet,{
    time:world?.time,root:actor?.x,scale,phase:runtime?.locomotionPhase,
    // Physical knock can outlast the hit flash. Carry its local leg pose
    // until the existing impulse ends, then resume the original stop steps.
    moving:runtime?.moving,facing,settle:plan.lowerSettle,
    frozen:plan.reactionHeld||plan.liveStun||Math.abs(actor?.knock??0)>.1,
    bodyCorrection,
  });
  if(!feet)return plan;
  plan={...plan,phase:feet.phase,
    lowerIndex:plan.settleIndex*atlas.frameCount+Math.floor(feet.phase*atlas.frameCount),
    lowerFootTargets:feet.targets,rangerFeet:feet.state};
  if(!plan.rangerManualUpperPose&&!plan.rangerStunUpperPose&&!plan.reactionHeld){
    const rig=atlas.upperRig,frame=(plan.attackPhase??0)*rig.frameCount,index=Math.floor(frame);
    const first=plan.attackPhase===null?0:rig.attackStartIndex+index;
    const next=plan.attackPhase===null?0:rig.attackStartIndex+Math.min(rig.frameCount,index+1);
    const current=v177RangerCarryPose(rig.poses[first],feet.phase,plan.lowerSettle);
    plan.upperRigPoses=[current,next===first?current:v177RangerCarryPose(rig.poses[next],feet.phase,plan.lowerSettle)];
    plan.upperOffsetY=v177RangerLowerBob(feet.phase,plan.lowerSettle);
  }
  return plan;
}

// Keep anatomical leg identity through stops and reflection, using the same
// actual-painted foot history as Ranger. Side-view overlap remains legal.
// Original hips, limb lengths, near/far paint order and attack steps survive.
export function v105BipedFootPlan(kind,plan,{actor,world,width,frame,direction}={}) {
  const atlas=V177_JOINT_ATLASES[kind],runtime=actor?.animationPresentation;
  if(atlas?.type!=='rigid-parts'||atlas.legConstraints?.length!==2||!plan?.groundedMotion
    ||plan.resolvedJointPose||plan.turnedGetup||plan.phaseChange||!world||!frame)return plan;
  let rig=bipedFootRigs.get(atlas);
  if(!rig){
    const factor=plan.groundedMotion.stride,legs=atlas.legConstraints.map((leg,index)=>{
      const positions=atlas.poses.slice(0,atlas.frameCount).map(p=>matrixPoint(p[leg.effectorBone],leg.ankle));
      const center=(Math.min(...positions.map(p=>p[0]))+Math.max(...positions.map(p=>p[0])))/2;
      return{...leg,footCenter:center,restOffset:leg.ankle[0]-center,
        upperLength:Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1]),
        lowerLength:Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1]),
        // The authored standing ankle and hip are one anatomical pair.
        // A walking maximum Y combined with standing X can overextend a
        // nearly straight leg and make a stationary turn wait forever.
        groundAnkle:leg.ankle[1],offset:index*.5};
    });
    const sourceLift=Math.max(...atlas.legConstraints.flatMap(leg=>{
      const ys=atlas.poses.slice(0,atlas.frameCount).map(p=>matrixPoint(p[leg.effectorBone],leg.ankle)[1]);
      return Math.max(...ys)-Math.min(...ys);
    }));
    rig={legs,phaseOwned:true,stanceFraction:.62,spanPx:atlas.cycleDistance*.62*factor,
      liftPx:Math.max(8,sourceLift*plan.groundedMotion.lift),bob:()=>0};
    bipedFootRigs.set(atlas,rig);
  }
  const reference=atlas.referenceFrame,scale=width/((reference?.width??atlas.width)*(reference?.scale??1));
  const center=(reference?.tx??0)+(reference?.scale??1)*(reference?.width??atlas.width)*frame.anchorX;
  // FootPlacement uses a source center of 240. Account for the exact painted
  // reference/anchor rather than assuming a half-width legacy sprite.
  const requestedFacing=direction==='left'?-1:1,root=actor.x,basisOffset=240-center;
  const dynamicRig={...rig,legs:rig.legs.map(leg=>({...leg,
    footCenter:leg.footCenter+basisOffset,
    hip:matrixPoint(interpolatedMatrix(new Float64Array(6),atlas,plan,leg.parentBone,leg.parentUpper!==false),leg.hip)
      .map((value,index)=>value+(index===0?basisOffset:0))}))};
  const previous=renderedJointPoses.get(v177JointActorKey(actor,world));
  const feet=v177RangerFootPlacement(dynamicRig,previous?.kind===kind?previous.plan.bipedFeet:undefined,{
    time:world.time,root,scale,phase:runtime?.locomotionPhase??0,moving:runtime?.moving,
    facing:requestedFacing,settle:plan.paintLocomotion?.settle??runtime?.locomotionSettle??1,
    frozen:plan.reactionHeld||plan.liveStun||Math.abs(actor.knock??0)>.1,
    bodyCorrection:v177JointBodyCorrection(actor,world),
  });
  if(!feet)return plan;
  const targets=Object.fromEntries(rig.legs.map((leg,index)=>{
    const [x,y,angle]=feet.targets[index],step=plan.groundedMotion.steps?.feet[leg.effectorBone];
    const m=atlas.poses[atlas.lowerCount-atlas.frameCount][leg.effectorBone];
    return[leg.effectorBone,{ankle:leg.ankle,x:x-basisOffset+(step?.x??0),y:y-(step?.lift??0),angle:angle+Math.atan2(m[1],m[0])}];
  }));
  plan={...plan,bipedFeet:feet.state,bipedFootTargets:targets};
  // Fit the original hips above both new plants. Never stretch a thigh or
  // detach a shin to mask an unreachable ankle during weight transfer.
  let lo=-Infinity,hi=Infinity;
  for(const leg of dynamicRig.legs){
    const t=targets[leg.effectorBone],reach=leg.upperLength+leg.lowerLength-.001;
    const vertical=Math.sqrt(Math.max(0,reach*reach-(t.x-(leg.hip[0]-basisOffset))**2));
    lo=Math.max(lo,t.y-leg.hip[1]-vertical);hi=Math.min(hi,t.y-leg.hip[1]+vertical);
  }
  if(lo<=hi){const dy=Math.max(lo,Math.min(hi,0));
    plan.groundedMotion={...plan.groundedMotion,lower:[...plan.groundedMotion.lower],upper:[...plan.groundedMotion.upper]};
    plan.groundedMotion.lower[5]+=dy;plan.groundedMotion.upper[5]+=dy;
  }
  return groundedHeldWeapons(kind,atlas,plan);
}

export function drawV177JointPose(ctx, image, kind, plan, x, y, width, height, {actor,world,paintReceipt}={}) {
  const actualActor=actor;
  actor=v177JointActorKey(actor,world);
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || !plan || !image?.naturalWidth) { rememberRenderedJointPose(actor,kind,null); return false; }
  if(atlas.type==='rigid-parts'){
    const resolve=plan.resolvedJointPose ? resolvedJointMatrix : jointMatrix;
    const matrix=new Float64Array(6);
    const scratch=atlas.armConstraints || atlas.legConstraints
      ? [new Float64Array(6),new Float64Array(6),{atlas,plan,chains:new Map()}] : null;
    const reference=atlas.referenceFrame;
    ctx.save();
    // Nearest sampling of a half-size atlas at a fractional, rotating battle
    // scale flickers between high-contrast texels. Keep nearest only for an
    // actual enlargement; minification needs alpha-aware filtering.
    if(atlas.paintStyle==='pixel-art'){
      ctx.imageSmoothingEnabled=width/((reference?.width??atlas.width)*(reference?.scale??1))*2<1;
      if(ctx.imageSmoothingEnabled)ctx.imageSmoothingQuality='high';
    }
    ctx.translate(x,y);ctx.scale(width/(reference?.width??atlas.width),height/(reference?.height??atlas.height));
    if(reference){ctx.translate(-reference.tx/reference.scale,-reference.ty/reference.scale);ctx.scale(1/reference.scale,1/reference.scale);}
    const front=new Set(plan.frontBones??plan.choreography?.frontBones??[]);
    const parts=front.size?[...atlas.parts.filter(p=>!front.has(p.bone)),...atlas.parts.filter(p=>front.has(p.bone))]:atlas.parts;
    for(const part of parts){
      if(part.bone==='jaw'){
        const edges=[];
        for(const [bone,points]of [[atlas.mouth.headBone,atlas.mouth.upper],[atlas.mouth.jawBone,atlas.mouth.lower]]){
          resolve(matrix,atlas,plan,bone,true);
          edges.push(points.map(([px,py])=>[matrix[0]*px+matrix[2]*py+matrix[4],matrix[1]*px+matrix[3]*py+matrix[5]]));
        }
        const cavity=kind==='ooguchi'?v177RecessedMouthContour(...edges):null;
        ctx.fillStyle=atlas.mouth.color;
        if(cavity&&ctx.createLinearGradient){
          const gradient=ctx.createLinearGradient(...cavity.throat,...cavity.lip);
          gradient.addColorStop(0,atlas.mouth.color);gradient.addColorStop(.65,atlas.mouth.color);
          gradient.addColorStop(.9,'rgba(22,13,10,.65)');gradient.addColorStop(1,'rgba(22,13,10,0)');ctx.fillStyle=gradient;
        }
        ctx.beginPath();let started=false;
        for(const [xx,yy]of cavity?.points??edges.flat()){
          if(started)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);started=true;
        }
        ctx.closePath();ctx.fill();
      }
      resolve(matrix,atlas,plan,part.bone,part.upper,scratch);
      drawRigidPart(ctx,image,part,matrix);
    }
    ctx.restore();rememberRenderedJointPose(actor,kind,plan);return true;
  }
  if(atlas.upperRig&&plan.upperRigPlan&&plan.upperRigPoses){
    plan=v177RangerFootPlan(kind,plan,{actor:actualActor,world,width});
    const feet=plan.rangerFeet;
    const lowerReceipt=atlas.lowerRig?drawV177RangerLower(ctx,image,atlas.lowerRig,plan,x,y,width,height):null;
    if(paintReceipt)paintReceipt.lower=lowerReceipt?{...lowerReceipt}:null;
    if(feet&&lowerReceipt?.mode==='continuous-weighted-mesh')Object.assign(lowerReceipt,{
      footPlacement:'planted-stop-steps',footWorldX:feet.feet.map(foot=>foot.x),
      footLiftPx:feet.feet.map(foot=>foot.height),footMoving:feet.moving,
    });
    else if(feet)plan={...plan,rangerFeet:undefined};
    if(!lowerReceipt||lowerReceipt.mode==='legacy-cell-fallback'){
      const {source:s,destination:d}=atlas.frames[plan.lowerIndex];
      const oldBob=atlas.pelvisOffsets[plan.settleIndex][Math.floor(plan.phase*atlas.frameCount)%atlas.frameCount];
      ctx.drawImage(image,s.x,s.y,s.w,s.h,x+d.x/atlas.width*width,y+(d.y+plan.upperOffsetY-oldBob)/atlas.height*height,
        d.w/atlas.width*width,d.h/atlas.height*height);
    }
    const rig={...atlas.upperRig,poses:plan.upperRigPoses};
    const matrix=new Float64Array(6),scratch=[new Float64Array(6),new Float64Array(6)];
    ctx.save();ctx.translate(x,y);ctx.scale(width/atlas.width,height/atlas.height);ctx.translate(0,plan.upperOffsetY);
    for(const part of rig.parts){
      const upper=plan.rangerManualUpperPose??plan.rangerStunUpperPose;
      if(upper)matrix.set(upper[part.bone]);
      else jointMatrix(matrix,rig,plan.upperRigPlan,part.bone,true,scratch);
      const source=part.source,destination=part.destination;
      ctx.save();ctx.transform(...matrix);
      ctx.drawImage(image,source.x,source.y,source.w,source.h,destination.x,destination.y,destination.w,destination.h);
      ctx.restore();
    }
    ctx.restore();rememberRenderedJointPose(actor,kind,plan,lowerReceipt);return true;
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
function interpolatedMatrix(out,atlas,plan,bone,upper,applyUpperOffset=true,applyGrounded=true){
  const plant=!upper&&applyGrounded&&plan.bipedFootTargets?.[bone];
  if(plant){
    const c=Math.cos(plant.angle),s=Math.sin(plant.angle),[x,y]=plant.ankle;
    out.set([c,s,-s,c,plant.x-c*x+s*y,plant.y-s*x-c*y]);return out;
  }
  if(upper&&plan.choreography?.upper[bone]){
    out.set(plan.choreography.upper[bone]);
    return applyGrounded?applyV177GroundedMatrix(out,plan,bone,upper):out;
  }
  const attachment=atlas.parentAttachments?.[bone];let anchorX,anchorY;
  if(attachment){
    interpolatedMatrix(out,atlas,plan,attachment.parent,upper,false,false);
    const [px,py]=attachment.pivot;
    anchorX=out[0]*px+out[2]*py+out[4];anchorY=out[1]*px+out[3]*py+out[5];
  }
  const a=atlas.poses[upper?plan.upperIndex:plan.lowerIndex][bone];
  const b=atlas.poses[upper?plan.upperNextIndex:plan.lowerNextIndex][bone];
  const p=upper?plan.upperBlend:plan.lowerBlend,angleA=Math.atan2(a[1],a[0]),angleB=Math.atan2(b[1],b[0]);
  const delta=Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA));
  let angle=angleA+delta*p;
  const settleBlend=upper&&plan.attackPhase!==null?0:plan.settleBlend??0;
  const settleOffset=plan.settleFrameOffset??0;
  const rowA=settleBlend>0?atlas.poses[(upper?plan.upperIndex:plan.lowerIndex)+settleOffset][bone]:a;
  const rowB=settleBlend>0?atlas.poses[(upper?plan.upperNextIndex:plan.lowerNextIndex)+settleOffset][bone]:b;
  if(settleBlend>0){
    const rowAngleA=Math.atan2(rowA[1],rowA[0]),rowAngleB=Math.atan2(rowB[1],rowB[0]);
    const rowAngle=rowAngleA+Math.atan2(Math.sin(rowAngleB-rowAngleA),Math.cos(rowAngleB-rowAngleA))*p;
    angle+=Math.atan2(Math.sin(rowAngle-angle),Math.cos(rowAngle-angle))*settleBlend;
  }
  const c=Math.cos(angle),s=Math.sin(angle);
  out[0]=c;out[1]=s;out[2]=-s;out[3]=c;
  // A source-bound soft organ can inflate; the head, torso and limb bones
  // retain the existing rigid path. Never interpolate limb scale.
  if(atlas.softBones?.[bone]){
    let sx=Math.hypot(a[0],a[1])+(Math.hypot(b[0],b[1])-Math.hypot(a[0],a[1]))*p;
    let sy=Math.hypot(a[2],a[3])+(Math.hypot(b[2],b[3])-Math.hypot(a[2],a[3]))*p;
    if(settleBlend>0){
      const rowSx=Math.hypot(rowA[0],rowA[1])+(Math.hypot(rowB[0],rowB[1])-Math.hypot(rowA[0],rowA[1]))*p;
      const rowSy=Math.hypot(rowA[2],rowA[3])+(Math.hypot(rowB[2],rowB[3])-Math.hypot(rowA[2],rowA[3]))*p;
      sx+=(rowSx-sx)*settleBlend;sy+=(rowSy-sy)*settleBlend;
    }
    out[0]*=sx;out[1]*=sx;out[2]*=sy;out[3]*=sy;
  }
  const pivot=atlas.interpolationPivots?.[bone];
  if(pivot){
    // A fast swing must interpolate its authored grip, rather than the
    // translation of the distant image origin. Otherwise the grip can arc
    // outside the arm's fixed reach between two perfectly valid source keys.
    const [px,py]=pivot,ax=a[0]*px+a[2]*py+a[4],ay=a[1]*px+a[3]*py+a[5];
    const bx=b[0]*px+b[2]*py+b[4],by=b[1]*px+b[3]*py+b[5];
    let targetX=ax+(bx-ax)*p,targetY=ay+(by-ay)*p;
    // A giant held blade cannot pass through the shoulder during collapse.
    // Interpolate this wrist in the parent's local polar coordinates: both
    // endpoint radii remain inside the original two-bone reach annulus.
    if(plan.omegaWristArc&&bone===atlas.weaponBone||plan.wristArcs?.includes(bone)){
      const chain=atlas.armConstraints.find(c=>c.effectorBone===bone),q=chain.shoulder;
      const pa=atlas.poses[plan.upperIndex][chain.parentBone],pb=atlas.poses[plan.upperNextIndex][chain.parentBone];
      const sa=matrixPoint(pa,q),sb=matrixPoint(pb,q),aa=Math.atan2(pa[1],pa[0]),ab=Math.atan2(pb[1],pb[0]);
      const ra=Math.hypot(ax-sa[0],ay-sa[1]),rb=Math.hypot(bx-sb[0],by-sb[1]);
      const theta=Math.atan2(ay-sa[1],ax-sa[0])-aa,thetaB=Math.atan2(by-sb[1],bx-sb[0])-ab;
      const parent=new Float64Array(6);interpolatedMatrix(parent,atlas,plan,chain.parentBone,true,false,false);
      const shoulder=matrixPoint(parent,q),radius=ra+(rb-ra)*p;
      const turn=theta+Math.atan2(Math.sin(thetaB-theta),Math.cos(thetaB-theta))*p+Math.atan2(parent[1],parent[0]);
      targetX=shoulder[0]+Math.cos(turn)*radius;targetY=shoulder[1]+Math.sin(turn)*radius;
    }
    if(settleBlend>0){
      const rowAx=rowA[0]*px+rowA[2]*py+rowA[4],rowAy=rowA[1]*px+rowA[3]*py+rowA[5];
      const rowBx=rowB[0]*px+rowB[2]*py+rowB[4],rowBy=rowB[1]*px+rowB[3]*py+rowB[5];
      targetX+=(rowAx+(rowBx-rowAx)*p-targetX)*settleBlend;
      targetY+=(rowAy+(rowBy-rowAy)*p-targetY)*settleBlend;
    }
    out[4]=targetX-c*px+s*py;out[5]=targetY-s*px-c*py;
    if(atlas.softBones?.[bone]){
      out[4]=targetX-out[0]*px-out[2]*py;
      out[5]=targetY-out[1]*px-out[3]*py;
    }
    // Child jaw/throat paint follows the interpolated head anchor exactly.
    // Independently interpolating two world-space pivots can detach a hinge.
    if(attachment){
      out[4]=anchorX-out[0]*px-out[2]*py;out[5]=anchorY-out[1]*px-out[3]*py;
    }
  }else{
    out[4]=a[4]+(b[4]-a[4])*p;out[5]=a[5]+(b[5]-a[5])*p;
    if(settleBlend>0){
      out[4]+=(rowA[4]+(rowB[4]-rowA[4])*p-out[4])*settleBlend;
      out[5]+=(rowA[5]+(rowB[5]-rowA[5])*p-out[5])*settleBlend;
    }
  }
  if(applyUpperOffset&&upper&&plan.attackPhase!==null)out[5]+=plan.upperOffsetY;
  return applyGrounded?applyV177GroundedMatrix(out,plan,bone,upper):out;
}

// Resolve authored two-bone chains against the same interpolated endpoints.
// A planted quadruped paw retains the travel/settling pose while its hip follows
// the attacking torso. Independent limb interpolation can detach the knee or paw.
// Bipeds with a separately painted lower pelvis keep that pelvis as the hip
// owner while the upper torso leans; the feet never follow the attack pose.
function jointMatrix(out,atlas,plan,bone,upper,scratch){
  const chain=(plan.choreography?.arms??atlas.armConstraints)?.find(a=>a.upperBone===bone||a.lowerBone===bone)
    ??atlas.legConstraints?.find(a=>a.upperBone===bone||a.lowerBone===bone);
  if(!chain){
    interpolatedMatrix(out,atlas,plan,bone,upper);
    if(upper&&bone===atlas.weaponBone)applyV177FirearmWeaponPullback(out,atlas,plan.firearmWeaponPullback);
    return upper&&plan.firearmUpperTransform?applyV177FirearmUpperMotion(out,plan.firearmUpperTransform):out;
  }
  const geometry=jointChainGeometry(atlas,plan,chain,upper,scratch);
  if(!geometry){
    interpolatedMatrix(out,atlas,plan,bone,upper);
    return upper&&plan.firearmUpperTransform?applyV177FirearmUpperMotion(out,plan.firearmUpperTransform):out;
  }
  const {sx,sy,ex,ey,wx,wy,hx,hy,tx,ty,kx,ky}=geometry;
  const isUpper=bone===chain.upperBone,rx=isUpper?sx:ex,ry=isUpper?sy:ey;
  const ax=isUpper?hx:kx,ay=isUpper?hy:ky,bx=isUpper?kx:tx,by=isUpper?ky:ty;
  const angle=Math.atan2(by-ay,bx-ax)-Math.atan2((isUpper?ey:wy)-ry,(isUpper?ex:wx)-rx),c=Math.cos(angle),s=Math.sin(angle);
  out[0]=c;out[1]=s;out[2]=-s;out[3]=c;out[4]=ax-c*rx+s*ry;out[5]=ay-s*rx-c*ry;
  return upper&&plan.firearmUpperTransform?applyV177FirearmUpperMotion(out,plan.firearmUpperTransform):out;
}

// Only one synchronous final draw owns this cache. Pose construction, ground
// correction, sockets and captured stun/corpse owners keep their original path.
function jointChainGeometry(atlas,plan,chain,upper,scratch){
  const context=scratch?.[2],cache=context?.atlas===atlas&&context.plan===plan?context.chains:null;
  let slots=cache?.get(chain);const slot=upper?1:0;
  if(slots&&slot in slots)return slots[slot];
  if(cache&&!slots){slots=[];cache.set(chain,slots);}
  const leg=Boolean(chain.hip);
  const parent=scratch?.[0]??new Float64Array(6),effector=scratch?.[1]??new Float64Array(6);
  interpolatedMatrix(parent,atlas,plan,chain.parentBone,leg?chain.parentUpper!==false:upper);
  interpolatedMatrix(effector,atlas,plan,chain.effectorBone,leg?false:upper);
  if(upper&&!leg&&chain.effectorBone===atlas.weaponBone)
    applyV177FirearmWeaponPullback(effector,atlas,plan.firearmWeaponPullback);
  const [sx,sy]=chain.hip??chain.shoulder,[ex,ey]=chain.knee??chain.elbow,[wx,wy]=chain.ankle??chain.wrist;
  // A supporting hand can come from an approved two-hand attack frame while
  // the arm retains its original neutral anatomy and visible sleeve paint.
  const [twx,twy]=chain.effectorWrist??chain.ankle??chain.wrist;
  const hx=parent[0]*sx+parent[2]*sy+parent[4],hy=parent[1]*sx+parent[3]*sy+parent[5];
  const tx=effector[0]*twx+effector[2]*twy+effector[4],ty=effector[1]*twx+effector[3]*twy+effector[5];
  const dx=tx-hx,dy=ty-hy,d=Math.hypot(dx,dy),a=Math.hypot(ex-sx,ey-sy),b=Math.hypot(wx-ex,wy-ey);
  if(d<1e-8||d>a+b+.0001||d<Math.abs(a-b)-.0001){if(slots)slots[slot]=null;return null;}
  const along=(a*a+d*d-b*b)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  // These right-facing biped sources have wide resting stances; their drawn
  // static knee angle is not an anatomical walking bend direction.
  const forwardBiped=leg&&['joint-brute','joint-guardian','joint-tky','joint-miyamoto-musashi',
    'joint-takuya','joint-takuya-omega','joint-crazy-king','joint-kumaverson','joint-babayaga'].includes(atlas.key);
  const sign=forwardBiped?-1:((ex-sx)*-(wy-sy)+(ey-sy)*(wx-sx)>=0?1:-1);
  const kx=hx+dx/d*along-dy/d*height*sign,ky=hy+dy/d*along+dx/d*height*sign;
  const geometry={sx,sy,ex,ey,wx,wy,hx,hy,tx,ty,kx,ky};
  if(slots)slots[slot]=geometry;return geometry;
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
  const frontBones=plan.frontBones??plan.choreography?.frontBones;
  return {lower,upper,...(frontBones?.length?{frontBones:[...frontBones]}:{})};
}

function independentWrists(atlas){
  return (atlas.armConstraints??[]).filter(c=>atlas.armConstraints.filter(other=>other.effectorBone===c.effectorBone).length===1).map(c=>c.effectorBone);
}

const supportMatrix=new Float64Array(6);
const supportScratch=[new Float64Array(6),new Float64Array(6)];
function drawRigidPart(ctx,image,part,matrix){
  const s=part.source,d=part.destination;
  ctx.save();ctx.transform(...matrix);
  ctx.drawImage(image,s.x,s.y,s.w,s.h,d.x,d.y,d.w,d.h);
  ctx.restore();
}
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
  const scratch=[supportScratch[0],supportScratch[1],{atlas,plan,chains:new Map()}];
  let bottom=-Infinity;
  for(const outline of outlines) {
    const m=resolve(supportMatrix,atlas,plan,outline.bone,outline.upper,scratch);
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
    upperIndex:1,upperNextIndex:2,upperBlend:p,attackPhase:null,upperOffsetY:0,omegaWristArc:source.key==='joint-takuya-omega'};
  plan.wristArcs=independentWrists(source);
  const scratch=[new Float64Array(6),new Float64Array(6)];
  return atlas.parts.map(part=>[...jointMatrix(new Float64Array(6),atlas,plan,part.bone,part.upper,scratch)]);
}

// Draw each original atlas part once. A severed group can be drawn separately
// from the remaining body without copying a piece from an unrelated raw frame.
export function drawV177ResolvedJointPose(ctx,image,kind,matrices,x,y,width,height,{omitParts,onlyParts,frontBones=[]}={}) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || atlas.type!=='rigid-parts' || atlas.mouth || !image?.naturalWidth
    || matrices?.length!==atlas.parts.length)return false;
  let selected=atlas.parts.map((part,index)=>({part,matrix:matrices[index]}))
    .filter(({part})=>(!onlyParts || onlyParts.has(part.name)) && !omitParts?.has(part.name));
  if(!selected.length || selected.some(({matrix})=>matrix?.length!==6 || !matrix.every(Number.isFinite)))return false;
  const front=new Set(frontBones);
  if(front.size)selected=[...selected.filter(({part})=>!front.has(part.bone)),...selected.filter(({part})=>front.has(part.bone))];
  const reference=atlas.referenceFrame;
  ctx.save();if(atlas.paintStyle==='pixel-art'){
    ctx.imageSmoothingEnabled=width/((reference?.width??atlas.width)*(reference?.scale??1))*2<1;
    if(ctx.imageSmoothingEnabled)ctx.imageSmoothingQuality='high';
  }
  ctx.translate(x,y);ctx.scale(width/(reference?.width??atlas.width),height/(reference?.height??atlas.height));
  if(reference){ctx.translate(-reference.tx/reference.scale,-reference.ty/reference.scale);ctx.scale(1/reference.scale,1/reference.scale);}
  for(const {part,matrix}of selected){
    drawRigidPart(ctx,image,part,matrix);
  }
  ctx.restore();return true;
}

export function v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose,x,y,bob=0,depthScale=1,sourcePoint,sourceBone,allowIdle=false}) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || !plan || plan.attackPhase===null&&!allowIdle)return null;
  let px,py,dy=plan.upperOffsetY;
  if(atlas.type==='rigid-parts'){
    const resolve=plan.resolvedJointPose ? resolvedJointMatrix : jointMatrix;
    const m=resolve(new Float64Array(6),atlas,plan,sourceBone??atlas.weaponBone,true);
    const [sx,sy]=sourcePoint??atlas.muzzle;
    px=m[0]*sx+m[2]*sy+m[4];py=m[1]*sx+m[3]*sy+m[5];dy=0;
  }else if(atlas.upperRig&&plan.upperRigPlan&&plan.upperRigPoses){
    const rig={...atlas.upperRig,poses:plan.upperRigPoses};
    const m=new Float64Array(6),[sx,sy]=rig.muzzle;
    const upper=plan.rangerManualUpperPose??plan.rangerStunUpperPose;
    if(upper)m.set(upper[rig.weaponBone]);
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
