import { ALLY_DEATH_CONFIG } from './combatLifecycle.js';
import { V177_JOINT_ATLASES, v177JointPose, v177CaptureJointPose } from './v177JointPresentation.js';
import { V177_WALKER_FLOOR_DATA } from './v177WalkerFloorData.js';
import { v177JointActorKey } from './v177JointActorHistory.js';
import { createTurnedGetupPoseSampler } from './v177TurnedGetupMotion.js';
import { createTurnedGetupHandoffSampler } from './v177TurnedGetupHandoff.js';
import { createTurnedGetupDeathSampler } from './v177TurnedGetupDeath.js';

const corpsePaints=new WeakMap(),births=new WeakMap(),reactions=new WeakMap();
const smooth=p=>{const t=Math.max(0,Math.min(1,p));return t*t*(3-2*t);};
const atlas=V177_JOINT_ATLASES.turned;
const readyPlan=v177JointPose('turned',{requestedState:'idle'},{locomotionPhase:0,locomotionSettle:1});
const captured=v177CaptureJointPose('turned',readyPlan);
const readyPose=Object.fromEntries(atlas.parts.map(part=>[part.bone,captured[part.upper?'upper':'lower'][part.bone]]));
const boneHulls=Object.fromEntries(V177_WALKER_FLOOR_DATA.outlines.map(part=>[part.bone,part.hull]));
let sourceFloor=-Infinity;
for(const part of atlas.parts)for(const [x,y]of boneHulls[part.bone]) {
  const m=readyPose[part.bone];sourceFloor=Math.max(sourceFloor,m[1]*x+m[3]*y+m[5]);
}
const geometry={readyPose,waist:V177_WALKER_FLOOR_DATA.waist,
  neck:V177_WALKER_FLOOR_DATA.neck,floor:sourceFloor,armConstraints:atlas.armConstraints,
  legConstraints:atlas.legConstraints,boneHulls};
const samplePose=createTurnedGetupPoseSampler(geometry),handoffPose=createTurnedGetupHandoffSampler(geometry);
const riseCorpseData={...V177_WALKER_FLOOR_DATA,severedParts:{
  head:atlas.parts.filter(part=>part.bone==='head').map(part=>part.name),
  impact:atlas.parts.filter(part=>['arm-0-lower','arm-0-hand'].includes(part.bone)).map(part=>part.name),
}};

// Only a corpse that owns an actual painted rise uses this source rig. Normal
// Walker/turned deaths keep their existing presentation and Gore policy.
export function createV177TurnedRiseCorpseRig(initialCaptured) {
  const initialPose=Object.fromEntries(atlas.parts.map(part=>[part.bone,initialCaptured[part.upper?'upper':'lower'][part.bone]]));
  const spine=initialPose.spine,point=([x,y])=>[spine[0]*x+spine[2]*y+spine[4],spine[1]*x+spine[3]*y+spine[5]],
    neck=point(geometry.neck),waist=point(geometry.waist);
  // Collapse toward the body's painted lean. A late backward rise can already
  // lean forward; forcing its earlier side would straighten it before death.
  const fallenPose=samplePose(0,neck[0]>=waist[0]?'forward':'back');
  const sample=createTurnedGetupDeathSampler({...geometry,initialPose,fallenPose});
  return {data:riseCorpseData,headAttachment:{parent:'spine',pivot:geometry.neck},finalPose:fallenPose,
    sampleMatrices:progress=>{const pose=sample(progress);return atlas.parts.map(part=>pose[part.bone]);}};
}

export function rememberV177TurnedCorpsePaint(world,corpse,rendered) {
  if(!world||corpse.side!=='human')return;
  let paints=corpsePaints.get(world);if(!paints){paints=new Map();corpsePaints.set(world,paints);}
  paints.set(corpse.id,{corpseId:corpse.id,kind:corpse.kind,at:world.time,
    physicalFloorY:corpse.y+5,framePath:rendered.frame.path,
    sourceBound:rendered.sourceBound===true,sourceSha256:rendered.sourceSha256??null,
    root:{x:rendered.x,y:rendered.y,angle:rendered.angle,scaleY:rendered.scaleY,flipX:rendered.flipX},
    paintedFloorY:rendered.sourceBound&&Number.isFinite(rendered.supportY)?rendered.y+rendered.supportY:null,
    recordedAfterPaint:true});
}

// Called only by the actual infection -> new generic zombie branch. Ordinary
// spawns, summons and restored actors do not acquire a rise by having grace.
export function rememberV177TurnedBirth(world,corpse,actor) {
  if(!world||corpse.side!=='human'||actor.kind!=='turned'||actor.side!=='zombie'||!(actor.hp>0))return;
  const source=corpsePaints.get(world)?.get(corpse.id)??null;
  const initialDirection=actor.animationPresentation?.direction==='right'?'right':'left';
  // An authored lying bitmap only receives a small infection twitch. Its
  // twitch angle does not describe which end of that bitmap contains a head.
  const headSign=source?.sourceBound&&Math.abs(Math.sin(source.root.angle))>.01?Math.sign(Math.sin(source.root.angle)):null;
  const forwardSign=initialDirection==='left'?-1:1;
  births.set(v177JointActorKey(actor,world),{corpseId:corpse.id,actorId:actor.id,
    initialDirection,variant:headSign!==null&&headSign!==forwardSign?'back':'forward',
    variantBasis:headSign===null?'stable-fallback':'source-bound-fall',
    facingReleased:false,
    floorY:actor.y+5,source:source?structuredClone(source):null,
    initialRemaining:actor.spawnGrace,bornAt:world.time});
}

function registeredBirth(world,actor) {
  if(!world||actor?.kind!=='turned'||actor.side!=='zombie'||!(actor.hp>0))return null;
  return births.get(v177JointActorKey(actor,world))??null;
}

const activeBirth=(world,actor)=>actor?.spawnGrace>0?registeredBirth(world,actor):null;

function canOwnRise(actor) {
  return Boolean(actor&&!actor.contained&&!actor.gateEntering&&!(actor.attack>0)&&!(actor.attackWindup>0)
    &&!(actor.abilityWindup>0)&&(!actor.stationAbility?.phase||actor.stationAbility.phase==='idle')
    &&(!actor.manualAbility?.phase||actor.manualAbility.phase==='idle'));
}

export function v177TurnedGetupDirection(world,actor,fallback,{enabled=true}={}) {
  if(!enabled)return fallback;
  const birth=registeredBirth(world,actor);
  if(!birth||birth.facingReleased)return fallback;
  if(!canOwnRise(actor)) {
    birth.facingReleased=true;
    return fallback;
  }
  // Forced recoil can continue past the rise lock. Keep facing through it so
  // the original runtime measures a backward stride instead of mirroring the
  // body at lock expiry. Normal action owns direction after this handoff.
  if(actor.spawnGrace>0||actor.flash>0||actor.stunned>0||Math.abs(actor.knock)>.1)return birth.initialDirection;
  birth.facingReleased=true;return fallback;
}

function reactionAmplitude(world,actor) {
  const key=v177JointActorKey(actor,world),remaining=Math.max(0,actor.flash||0,actor.stunned||0);
  let state=reactions.get(key);
  if(!state){state={active:false,lastRaw:0,lastRemaining:0};reactions.set(key,state);}
  if(!(remaining>0)){state.active=false;state.lastRaw=0;state.lastRemaining=0;return 0;}
  if(!state.active||remaining>state.lastRemaining+1e-9) {
    state.startRaw=state.active?state.lastRaw:0;state.entryGrace=actor.spawnGrace;
    state.exitWindow=Math.min(.1,remaining);state.active=true;
  }
  const elapsed=Math.max(0,state.entryGrace-actor.spawnGrace);
  const raw=(state.startRaw+(1-state.startRaw)*smooth(elapsed/.06))*smooth(remaining/state.exitWindow);
  state.lastRaw=raw;state.lastRemaining=remaining;return raw;
}

export function v177TurnedGetupPose(world,actor,{ownedPose=false}={}) {
  const birth=activeBirth(world,actor);
  if(!birth)return null;
  if(ownedPose||!canOwnRise(actor)){birth.facingReleased=true;return null;}
  if(birth.facingReleased)return null;
  // The original remaining lifecycle clock owns phase, including the birth
  // tick's overshoot. Hit/stun never freeze or restart this involuntary rise.
  const progress=Math.max(0,Math.min(1,1-actor.spawnGrace/ALLY_DEATH_CONFIG.riseLockSeconds));
  const amplitude=reactionAmplitude(world,actor),rising=samplePose(progress,birth.variant,{reactionAmplitude:amplitude});
  // Knockback can advance the existing gait while AI is still rise-locked.
  // Land into its current phase and settled lift, without resetting either.
  const landingPlan=v177JointPose('turned',{requestedState:'idle'},actor.animationPresentation,{grounded:true});
  let landingPose=null;
  if(progress>.85) {
    const current=v177CaptureJointPose('turned',landingPlan);
    landingPose=Object.fromEntries(atlas.parts.map(part=>[part.bone,current[part.upper?'upper':'lower'][part.bone]]));
  }
  const pose=handoffPose(rising,landingPose,progress);
  return {...landingPlan,turnedGetup:true,getupProgress:progress,getupVariant:birth.variant,
    getupCorpseId:birth.corpseId,getupSourcePaintBound:birth.source?.sourceBound===true,
    getupReactionAmplitude:amplitude,
    resolvedJointPose:{lower:pose,upper:pose}};
}

export function readV177TurnedBirthPresentation(world,actor) {
  if(!world||actor?.kind!=='turned')return null;
  const birth=births.get(v177JointActorKey(actor,world));
  return birth?structuredClone(birth):null;
}

export function pruneV177TurnedCorpsePaints(world) {
  const paints=corpsePaints.get(world);if(!paints)return;
  const alive=new Set((world.corpses??[]).filter(c=>c.side==='human').map(c=>c.id));
  for(const id of paints.keys())if(!alive.has(id))paints.delete(id);
}
