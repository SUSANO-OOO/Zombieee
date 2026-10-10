import { sampleAnimationClip } from './combatPresentation.js';
import { ENEMY_NORMAL_ATTACK_SECONDS } from './enemyCombatTiming.js';

const groups = {
  light: ['brawler','scout','medic','engineer','zakimiya','tky','miyamoto-musashi'],
  heavy: ['brute','guardian','kumaverson','crazy-king'],
  firearm: ['ranger','gunner','babayaga','mrs-chiha','red-panther-smg','red-panther-commander'],
  infected: ['walker','turned','spitter','grappler','red-panther-knife','red-panther-shield'],
  runner: ['runner','sprinter','kurome'],
  giant: ['crusher','abomination','takuya','gate-eater','gairen','futago','futago-separated-a','futago-separated-b','cagewalker','mugarian-president-mutated','takuya-omega'],
  low: ['mayo-chan','mayo-chan-feral','ooze','ooguchi','spindle'],
  rooted: ['mother','resonator','choir-knot','anchor-bloom'],
  floating: ['shade','pall-manta'],
};
export const V102_MOTION_GROUPS = Object.freeze(Object.fromEntries(
  Object.entries(groups).flatMap(([group,kinds]) => kinds.map(kind => [kind,group])),
));
const IDENTITY = Object.freeze({offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1,opacity:1});
const clamp = p => Math.max(0,Math.min(1,Number(p)||0));
const smooth = p => p*p*(3-2*p);

// Each body retains one camera scale. The painted poses own joint movement;
// recoil is a rigid weight shift, never a change in head/weapon proportions.
export function v102CombatMotionSample(kind,sample,{ownedPose=false,side,attack=0,attackWindup=0,abilityWindup=0}={}) {
  if (!V102_MOTION_GROUPS[kind] || ownedPose) return sample;
  const group=V102_MOTION_GROUPS[kind];
  let result=sample;
  if(side==='zombie'&&abilityWindup<=0) {
    if(attackWindup>0) result={...sample,spriteState:'attack-a'};
    else if(attack>0) {
      const elapsed=Math.max(0,ENEMY_NORMAL_ATTACK_SECONDS-attack);
      // Enemy normal attacks use the real 180 ms timer, rather than a much
      // longer allied clip which could hide their contact pose altogether.
      result={...sampleAnimationClip(kind,elapsed<.12?'active':'recovery',0),
        spriteState:elapsed<.12?'attack-b':'idle',clipProgress:clamp(elapsed/ENEMY_NORMAL_ATTACK_SECONDS)};
    }
  }
  const p=clamp(result.clipProgress),state=result.requestedState;
  const force=group==='giant'?2.2:group==='heavy'?1.7:group==='firearm'?1.25:1.5;
  let pose=IDENTITY;
  if(state==='wind-up') pose={...IDENTITY,offsetX:-force*smooth(p),rotationRadians:-.018*smooth(p)};
  else if(state==='active') {
    const recoil=(1-p)*(1-p);
    pose={...IDENTITY,offsetX:(group==='firearm'?-1:1)*force*recoil,rotationRadians:(group==='firearm'?-.01:.018)*recoil};
  } else if(state==='recovery') {
    // Keep the released limb pose before returning to ready. Replaying
    // attack-a here was a second windup with no corresponding damage.
    result={...result,spriteState:p<.7?'attack-b':'idle'};
  } else if(['hit','hit-light','hit-heavy'].includes(state)) {
    const recoil=(1-p)*(1-p);
    pose={...IDENTITY,offsetX:-force*recoil,rotationRadians:-.022*recoil};
  }
  return {...result,bodyScale:1,pose};
}

export function v102GroundLift(kind,sample,legacyLift) {
  // Limbs exchange support on the floor. Only creatures designed to hover
  // retain a floating whole-body path.
  return V102_MOTION_GROUPS[kind]==='floating'?legacyLift:0;
}

export function v102TravelCycleDistance(kind,contentHeight) {
  const group=V102_MOTION_GROUPS[kind];
  if(!group||!Number.isFinite(contentHeight)||contentHeight<=0)return undefined;
  const ratio=group==='low'?.65:group==='runner'?.38:group==='rooted'?.18:.3;
  return Math.max(9,Math.min(34,contentHeight*ratio));
}
