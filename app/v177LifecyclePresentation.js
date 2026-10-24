export function v177FallState(progress) {
  return progress<1?'down':'death';
}

// Receive the existing renderer dependencies from its owner. Importing the
// battle/catalog graph here can change chunk initialization order on startup.
export function createV177LifecyclePresentation({animationClipFor,sampleAnimationClip,
  mayoRetreatSpriteState,v177JointActorKey,atlasFor,v177CaptureJointPose}) {

const phases = new WeakMap();
const ordinary = new Set(['idle','move','deploy','start-move','stop-move','turn','retreat','hit','hit-light','hit-heavy']);

// These lifecycle clocks already own the fall/rise. Sampling the generic
// optional clip as well would apply a second pose and a different duration.
function v177MayoRetreatSample(actor) {
  const retreat=actor?.mayoRetreat;
  if(!retreat)return null;
  const state=retreat.phase==='fall'?'down':retreat.phase==='rise'?'get-up':'retreat';
  return {...sampleAnimationClip('mayo-chan',retreat.phase==='run'?'retreat':mayoRetreatSpriteState(retreat),retreat.phaseElapsed),
    requestedState:state,resolvedState:`mayo-protected-${retreat.phase}`,lifecycleOwner:'mayo-retreat'};
}

// Observe the registered boss, never the generic HP fallback used by HUDs.
// Spawn/save restoration establishes a baseline rather than inventing a change.
function v177ObserveBossPhase(world,actor,phase) {
  if(!world||actor?.side!=='zombie'||!actor.v100BossId||!(actor.hp>0))return;
  if(!Number.isInteger(phase)||phase<1)return;
  const key=v177JointActorKey(actor,world);
  const previous=phases.get(key);
  if(!previous){phases.set(key,{phase,pending:null,startedAt:null});return;}
  if(phase>previous.phase) {
    previous.pending={from:previous.phase,to:phase,changedAt:world.time};
    previous.startedAt=null;
  }
  previous.phase=phase;
}

// A short head dip uses the existing neck attachment. The current gait, feet,
// weapon, normal attack and all gameplay clocks keep their original owners.
// A committed authored special finishes first; it is never replaced mid-strike.
function v177PhaseChangePose(world,actor,kind,plan,sample,{ownedPose=false}={}) {
  if(!world||!actor)return null;
  const state=phases.get(v177JointActorKey(actor,world)),atlas=atlasFor(kind);
  if(!state?.pending||!plan||ownedPose||atlas?.type!=='rigid-parts')return null;
  if(state.startedAt===null) {
    if(!ordinary.has(sample.requestedState))return null;
    state.startedAt=world.time;
  }
  const duration=animationClipFor(kind,'phase-change').durationSeconds;
  const progress=Math.max(0,(world.time-state.startedAt)/duration);
  if(progress>=1){state.pending=null;state.startedAt=null;return null;}
  const captured=v177CaptureJointPose(kind,plan),headPart=atlas.parts.find(part=>part.bone==='head');
  if(!headPart)return null;
  const d=headPart.destination,pivot=atlas.parentAttachments?.head?.pivot??[d.x+d.w/2,d.y+d.h];
  const spine=captured.upper[atlas.parentAttachments?.head?.parent??'spine'];
  const px=spine[0]*pivot[0]+spine[2]*pivot[1]+spine[4];
  const py=spine[1]*pivot[0]+spine[3]*pivot[1]+spine[5];
  const angle=-.12*Math.sin(Math.PI*progress)**2,c=Math.cos(angle),s=Math.sin(angle);
  const followsHead=bone=>bone==='head'||atlas.parentAttachments?.[bone]?.parent==='head';
  const upper=Object.fromEntries(Object.entries(captured.upper).map(([bone,m])=>[bone,followsHead(bone)?[
    c*m[0]-s*m[1],s*m[0]+c*m[1],c*m[2]-s*m[3],s*m[2]+c*m[3],
    px+c*(m[4]-px)-s*(m[5]-py),py+s*(m[4]-px)+c*(m[5]-py),
  ]:m]));
  return {...plan,phaseChangeBasePlan:plan,resolvedJointPose:{lower:captured.lower,upper},phaseChange:{...state.pending,
    startedAt:state.startedAt,progress,angle,duration,baseState:sample.requestedState}};
}
return {v177MayoRetreatSample,v177ObserveBossPhase,v177PhaseChangePose};
}
