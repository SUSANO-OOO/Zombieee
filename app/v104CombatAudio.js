import {v177JointActorKey} from './v177JointActorHistory.js';
const sources=name=>['mp3','ogg'].map(ext=>({src:`/audio/v104/combat/${name}.${ext}`,type:ext==='mp3'?'audio/mpeg':'audio/ogg'}));
const replacements={
 'weapon-pan-hit':'pan-hit','weapon-pan-heavy-hit':'pan-heavy','weapon-pan-stun':'pan-heavy',
 'weapon-suppressed-pistol':'suppressed-pistol',
 ...Object.fromEntries(['crazy-king','kumaverson','babayaga'].flatMap(kind=>['deploy','attack','hurt','death'].map(event=>{
  const id=`voice-${kind}-${event}`;return[id,id];
 }))),
};
export function withV104CombatAudio(base){
 return{...base,assets:base.assets.map(asset=>replacements[asset.id]?{...asset,sources:sources(replacements[asset.id])}:asset)};
}
export const V104_ARMOR_AUDIO={id:'v104-armor-hit',category:'melee',sources:sources('armor-hit'),gain:.68,priority:78,cooldownMs:140,maxInstances:2};
export const V104_HANDGUN_AUDIO={id:'v104-handgun',category:'weapons',sources:sources('handgun'),gain:.72,priority:72,cooldownMs:100,maxInstances:4};
export const V104_CROSSBOW_AUDIO={id:'weapon-crossbow-release',category:'weapons',sources:sources('crossbow-release'),gain:.68,priority:70,cooldownMs:90,maxInstances:4};
const rpVoiceEvents={attack:{priority:67,cooldownMs:1400,gain:.72},hurt:{priority:76,cooldownMs:700,gain:.78},death:{priority:86,cooldownMs:300,gain:.8}};
const rpVoices=['red-panther-knife','red-panther-shield','red-panther-smg','red-panther-commander']
 .flatMap(kind=>Object.entries(rpVoiceEvents).map(([event,settings])=>Object.freeze({kind,event,
  asset:Object.freeze({id:`voice-${kind}-${event}`,category:'humanVoices',sources:sources(`voice-${kind}-${event}`),
   preload:'lazy',loop:false,maxInstances:1,...settings})})));
export const V104_RED_PANTHER_VOICES=Object.freeze(rpVoices.map(row=>row.asset));
const rpMaterialVoices=new Map(rpVoices.map(row=>[`enemy-${row.kind}-${row.event}`,row]));
// Keep the original weapon/material cue; the dedicated human bark accompanies it.
export function v104SupplementalEnemyVoice(cueId){return rpMaterialVoices.get(cueId)??null;}
// Contact material is separate from mass: a large fleshy enemy is still flesh.
export function v104ContactIsHard(kind){
 return ['crusher','grappler','gate-eater','gairen','guardian','red-panther-shield'].includes(kind);
}
export const V104_BOTTLE_AUDIO={id:'weapon-bottle-hit',category:'melee',
 sources:['mp3','ogg'].map(ext=>({src:`/audio/v100/foley/story-glass.${ext}`,type:ext==='mp3'?'audio/mpeg':'audio/ogg'})),
 gain:.58,priority:68,cooldownMs:140,maxInstances:2};
export const V104_BEAM_AUDIO=['warning','fire'].map(event=>({id:`v104-eye-${event}`,category:'melee',sources:sources('eye-'+event),
 gain:event==='warning'?.58:.8,priority:event==='warning'?90:94,cooldownMs:200,maxInstances:2}));
// A first real contact must be audible. Subsequent calls belong to the same
// actor and game clock, rather than a random roll that can silence a character
// for an entire encounter. The existing mixer still owns overlap and priority.
const voiceClocks=new WeakMap();
// The old generic attack grunts are not character dialogue. Do not layer
// these synthetic imitations over each weapon discharge/contact.
const weaponOnlyAttackKinds=new Set(['scout','ranger','brute','brawler','gunner','medic','guardian','engineer','zakimiya','tky','mrs-chiha','miyamoto-musashi','babayaga']);
export function battleVoiceReady(actor,event,time,world){
 if(event==='attack'&&weaponOnlyAttackKinds.has(actor?.kind))return false;
 if(!actor||!(actor.hp>0)||!Number.isFinite(time))return false;
 const key=v177JointActorKey(actor,world),clocks=voiceClocks.get(key)??{},last=clocks[event],gap=event==='attack'?2.1:.8;
 if(Number.isFinite(last)&&time>=last&&time-last<gap)return false;
 clocks[event]=time;voiceClocks.set(key,clocks);return true;
}
export function queueV104HumanHurt(world,actor,hpBefore,cueId){
 if(!(hpBefore>actor.hp)||!cueId||!battleVoiceReady(actor,'hurt',world.time,world))return false;
 const receiptId=`hurt:${actor.id}:${world.time.toFixed(6)}:${actor.hp}`;
 (world.pendingBattleAudioCues??=[]).push({cueId,x:actor.x,battleGeneration:world.battleAudioGeneration,
  ownerId:actor.id,activationId:0,semantic:'battle-hurt',receiptId,dueSimulationTime:world.time,
  priority:72,cooldownMs:0,maxInstances:2,volume:['brute','brawler'].includes(actor.kind)?.94:.8});
 return true;
}
const guardClocks=new WeakMap();
export function queueV104GuardImpact(world,owner){
 if(!Number.isFinite(world.time))return false;
 const key=v177JointActorKey(owner,world),last=guardClocks.get(key);
 if(Number.isFinite(last)&&world.time>=last&&world.time-last<.08)return false;
 guardClocks.set(key,world.time);
 (world.pendingBattleAudioCues??=[]).push({cueId:owner.kind==='kumaverson'?'weapon-pan-hit':'v104-armor-hit',
  x:owner.x,battleGeneration:world.battleAudioGeneration,ownerId:owner.id,activationId:0,
  semantic:'guard-contact',receiptId:`guard:${owner.id}:${world.time.toFixed(6)}`,dueSimulationTime:world.time,
  priority:78,cooldownMs:0,maxInstances:2});
 return true;
}
