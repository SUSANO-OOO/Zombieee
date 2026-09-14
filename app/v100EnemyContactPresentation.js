import {ENEMY_NORMAL_ATTACK_SECONDS} from './enemyVfxPresentation.js';
import {spriteFrameFor,fitSpriteBattleDisplaySize} from './spriteManifest.js';

export const V100_CONTACT_ENEMY_KINDS=Object.freeze(['walker','runner','turned','crusher','abomination','grappler','sprinter']);
export const V100_ENEMY_CONTACT_STABLE_POSE=Object.freeze({offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1,opacity:1});

// The real enemy timer is 180 ms, not the human active + recovery clip length.
// Damage is already committed when it starts: keep the authored contact pose
// for 120 ms, then withdraw the limbs without playing another raised-arm attack.
export function v100EnemyContactPose(kind,{attack=0,attackWindup=0,flash=0,abilityPhase='idle'}={}){
 if(!V100_CONTACT_ENEMY_KINDS.includes(kind)||!['idle','recovery'].includes(abilityPhase))return null;
 if(![attack,attackWindup,flash].every(Number.isFinite)||flash>0)return null;
 if(attackWindup>0)return {spriteState:'attack-a',clip:'wind-up'};
 if(attack<=0)return null;
 const elapsed=Math.max(0,ENEMY_NORMAL_ATTACK_SECONDS-attack);
 return {spriteState:elapsed<.12?'attack-b':elapsed<.15?'walk-a':'idle',clip:elapsed<.12?'active':'recovery'};
}

export function v100EnemyContactSize(kind,frame,direction,maximum){
 if(!V100_CONTACT_ENEMY_KINDS.includes(kind))throw Error('Unsupported contact enemy');
 const reference=spriteFrameFor(kind,'idle',direction);
 if(frame.path!==reference.path||frame.sourceRect.w!==reference.sourceRect.w||frame.sourceRect.h!==reference.sourceRect.h)throw Error('Recalibrate enemy contact atlas');
 // Use the existing idle size as the camera scale. Raised hands can rise and
 // a crouch can lower the head; neither should resize the rest of the body.
 const size=fitSpriteBattleDisplaySize(kind,reference,maximum);
 return {w:size.w,h:size.h};
}
