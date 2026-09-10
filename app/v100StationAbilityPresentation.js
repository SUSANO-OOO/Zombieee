import {STATION_ENEMY_TUNING} from './stationEnemyMechanics.js';
import {spriteFrameFor,fitSpriteBattleDisplaySize} from './spriteManifest.js';

export const V100_STATION_POSE_KINDS=Object.freeze(['grappler','gate-eater']);
export const V100_STATION_STABLE_POSE=Object.freeze({offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1,opacity:1});

export function v100StationAbilityPose(kind,runtime,flash=0){
 if(!V100_STATION_POSE_KINDS.includes(kind)||!runtime||!Number.isFinite(runtime.remainingSeconds)||flash>0)return null;
 const phase=runtime.phase;
 if(kind==='grappler'){
  if(phase==='windup')return {spriteState:'attack-a',clip:'wind-up',direction:runtime.direction};
  if(phase==='ready'||phase==='pulling')return {spriteState:'attack-b',clip:'active',direction:runtime.direction};
  return null;
 }
 if(phase==='windup')return {spriteState:'attack-a',clip:'wind-up',direction:runtime.direction};
 if(phase==='charging')return {spriteState:'attack-b',clip:'active',direction:runtime.direction};
 if(phase==='exposed'){
  const elapsed=Math.max(0,STATION_ENEMY_TUNING.ticketGateEater.flankExposureSeconds-runtime.remainingSeconds);
  return {spriteState:elapsed<.16?'attack-b':elapsed<.34?'walk-a':'idle',clip:'recovery',direction:runtime.direction};
 }
 return null;
}

export function v100GateEaterAuthoredSize(frame,direction,maximum){
 const reference=spriteFrameFor('gate-eater','idle',direction);
 if(frame.path!==reference.path||frame.sourceRect.w!==reference.sourceRect.w||frame.sourceRect.h!==reference.sourceRect.h)throw Error('Recalibrate Gate Eater atlas');
 const size=fitSpriteBattleDisplaySize('gate-eater',reference,maximum);
 return {w:size.w,h:size.h};
}
