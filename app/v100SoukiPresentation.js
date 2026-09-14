import {STATION_ENEMY_TUNING} from './stationEnemyMechanics.js';
import {spriteFrameFor,fitSpriteBattleDisplaySize} from './spriteManifest.js';

export const V100_SOUKI_STABLE_POSE=Object.freeze({offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1,opacity:1});
const STRIDE=Object.freeze(['walk-b','walk-a','attack-b','walk-a']);

// The atlas already has a crouch, a launch and two complete running poses.
// Bind them to the real ability phases instead of stretching an idle body.
export function v100SoukiPose(runtime,flash=0){
 const durations={telegraph:STATION_ENEMY_TUNING.souki.telegraphSeconds,burst:STATION_ENEMY_TUNING.souki.burstSeconds,recovery:STATION_ENEMY_TUNING.souki.recoverySeconds};
 const duration=durations[runtime?.phase];
 if(!duration||!Number.isFinite(runtime.remainingSeconds))return null;
 const elapsed=Math.min(duration,Math.max(0,duration-runtime.remainingSeconds));
 const clip=runtime.phase==='telegraph'?'wind-up':runtime.phase==='burst'?'special':'recovery';
 if(flash>.04)return{spriteState:'hit',clip:'hit-light',elapsed};
 if(runtime.phase==='telegraph')return{spriteState:elapsed<.1?'idle':elapsed<.2?'walk-a':'attack-a',clip,elapsed};
 if(runtime.phase==='burst')return{spriteState:elapsed<.08?'attack-b':STRIDE[Math.floor((elapsed-.08)/.095)%STRIDE.length],clip,elapsed};
 return{spriteState:elapsed<.12?'walk-a':elapsed<.28?'attack-a':'idle',clip,elapsed};
}

// Every 480x448 cell uses the same camera and foot baseline. Fitting each
// crouch/stride's visible bounds separately makes the head and torso pulse.
export function v100SoukiAuthoredSize(frame,direction,maximum){
 const reference=spriteFrameFor('sprinter','idle',direction);
 if(frame.path!==reference.path||frame.sourceRect.w!==reference.sourceRect.w||frame.sourceRect.h!==reference.sourceRect.h)throw Error('Recalibrate Souki presentation for a changed atlas');
 const size=fitSpriteBattleDisplaySize('sprinter',reference,maximum);
 return{w:size.w,h:size.h};
}
