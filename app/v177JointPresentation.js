import { V177_JOINT_ATLASES } from './v177JointData.js';

const locomotionStates = new Set(['idle','move','start-move','stop-move','turn']);
const attackStates = new Set(['wind-up','active','recovery']);
const clamp = p => Math.max(0, Math.min(1, Number(p) || 0));
const cycle = p => ((Number(p) || 0) % 1 + 1) % 1;

export { V177_JOINT_ATLASES };

export function v177JointCycleDistance(kind, renderScale) {
  const atlas = V177_JOINT_ATLASES[kind];
  return atlas && Number.isFinite(renderScale) && renderScale > 0
    ? atlas.cycleDistance * renderScale : undefined;
}

export function v177JointPose(kind, sample, runtime, { ownedPose=false }={}) {
  const atlas = V177_JOINT_ATLASES[kind], state=sample?.requestedState;
  if (!atlas || ownedPose || (!locomotionStates.has(state) && !attackStates.has(state))) return null;
  const phase=cycle(runtime?.locomotionPhase);
  const phaseIndex=Math.floor(phase*atlas.frameCount) % atlas.frameCount;
  const settleIndex=Math.round(clamp(runtime?.locomotionSettle ?? 1)*(atlas.settleLevels-1));
  // The feet keep the last actual-travel phase through aiming and firing.
  // Only their lift settles to the floor; attacking never substitutes a
  // different fixed stance or advances a walking clock while stationary.
  const lowerIndex=settleIndex*atlas.frameCount+phaseIndex;
  let attackPhase=null;
  if(state==='wind-up')attackPhase=.28*clamp(sample.clipProgress);
  else if(state==='active')attackPhase=.28+.42*clamp(sample.clipProgress);
  else if(state==='recovery')attackPhase=.7+.3*clamp(sample.clipProgress);
  const upperIndex=atlas.lowerCount+(attackPhase===null ? 0 : 1+Math.round(attackPhase*atlas.frameCount));
  return {lowerIndex,upperIndex,phase,settleIndex,attackPhase,
    upperOffsetY:atlas.pelvisOffsets[settleIndex][phaseIndex]};
}

export function drawV177JointPose(ctx, image, kind, plan, x, y, width, height) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || !plan || !image?.naturalWidth)return false;
  for(const [index,dy] of [[plan.lowerIndex,0],[plan.upperIndex,plan.upperOffsetY]]) {
    const {source:s,destination:d}=atlas.frames[index];
    ctx.drawImage(image,s.x,s.y,s.w,s.h,
      x+d.x/atlas.width*width,y+(d.y+dy)/atlas.height*height,
      d.w/atlas.width*width,d.h/atlas.height*height);
  }
  return true;
}

export function v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose,x,y,bob=0,depthScale=1}) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || !plan || plan.attackPhase===null)return null;
  const [px,py]=atlas.muzzles[plan.upperIndex-atlas.lowerCount];
  const facing=direction==='left'?-1:1;
  const lx=(px/atlas.width-frame.anchorX)*size.w*(frame.flipX?-1:1)*pose.scaleX;
  const ly=((py+plan.upperOffsetY)/atlas.height-frame.anchorY)*size.h*pose.scaleY;
  const angle=pose.rotationRadians*facing,c=Math.cos(angle),s=Math.sin(angle);
  return {x:x+pose.offsetX*depthScale*facing+lx*c-ly*s,
    y:y-bob+pose.offsetY*depthScale+lx*s+ly*c};
}
