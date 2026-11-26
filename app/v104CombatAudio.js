import {v177JointActorKey} from './v177JointActorHistory.js';
import {PWA_PAN_GUARD_FILE} from './pwaPanGuardFile.js';
import {withRecordedLightHurtTakes} from './v100RecordedHurtTakes.js';
const recordedMayoVoices=Object.freeze({
 'voice-mayo-deploy':'recorded-bark',
 'voice-mayo-attack':'recorded-bark',
 'voice-mayo-hurt':'recorded-whine',
 'voice-mayo-retreat':'recorded-whine',
});
const shortHeavyDeathFileByTake = Object.freeze({
  '01': '/audio/quality-20261125/voices/human-male-heavy-death-01.wav',
  '02': '/audio/quality-20261125/voices/human-male-heavy-death-02.wav',
});
export const V104_SHORT_HEAVY_DEATH_PATHS = Object.freeze(Object.values(shortHeavyDeathFileByTake));

function shortHeavyDeathSources(recordingId, sources) {
  // Pages can prefix source URLs. Recording IDs stay constant.
  const take = /^human-male-heavy-death-(0[12])$/.exec(recordingId)?.[1];
  return take ? [{ src: shortHeavyDeathFileByTake[take], type: 'audio/wav' }, ...sources] : sources;
}

// Original CC0 human performances already shipped with the game. Keep each
// character's reaction family consistent; no speech synthesis or pitch shift.
const recordedHumanVoices=Object.freeze({
 'crazy-king':{profile:'male-heavy',take:'02'},
 kumaverson:{profile:'male-heavy',take:'01'},
 babayaga:{profile:'male-light',take:'02'},
 'red-panther-knife':{profile:'male-light',take:'01'},
 'red-panther-shield':{profile:'male-heavy',take:'02'},
 'red-panther-smg':{profile:'male-light',take:'02'},
 'red-panther-commander':{profile:'male-heavy',take:'01'},
});
const sources=name=>['mp3','ogg'].map(ext=>({src:`/audio/v104/combat/${name}.${ext}`,type:ext==='mp3'?'audio/mpeg':'audio/ogg'}));
const recordedSources=(name,take)=>{
 if(recordedMayoVoices[name])return[{src:`/audio/quality-20261116/mayo/${recordedMayoVoices[name]}.wav`,type:'audio/wav'}];
 const match=/^voice-(.+)-(attack|hurt|death)$/.exec(name);
 const actor=match&&recordedHumanVoices[match[1]];
 const recordingId=actor?`human-${actor.profile}-${match[2]}-${take ?? actor.take}`:name;
 const folder=actor?'/audio/v060/sfx':'/audio/v104/combat';
 return shortHeavyDeathSources(recordingId,['mp3','ogg'].map(ext=>({src:`${folder}/${recordingId}.${ext}`,type:ext==='mp3'?'audio/mpeg':'audio/ogg'})));
};
const replacements={
 ...Object.fromEntries(Object.keys(recordedMayoVoices).map(id=>[id,id])),
 'weapon-pan-hit':'pan-hit','weapon-pan-heavy-hit':'pan-heavy','weapon-pan-stun':'pan-heavy',
 'weapon-suppressed-pistol':'suppressed-pistol',
 ...Object.fromEntries(['crazy-king','kumaverson','babayaga'].flatMap(kind=>['deploy','attack','hurt','death'].map(event=>{
  const id=`voice-${kind}-${event}`;return[id,id];
 }))),
 ...Object.fromEntries(Object.keys(recordedHumanVoices).filter(kind=>kind.startsWith('red-panther-')).flatMap(kind=>['attack','hurt','death'].map(event=>{
  const id=`voice-${kind}-${event}`;return[id,id];
 }))),
};
const reactionPoolId = (assetId) => `${assetId}-takes`;

export function withV104CombatAudio(base) {
  const assets = base.assets.map(asset => {
    const replacement = replacements[asset.id];
    const updatedSources = replacement ? recordedSources(replacement) : shortHeavyDeathSources(asset.id, asset.sources);
    return updatedSources === asset.sources ? asset : { ...asset, sources: updatedSources };
  });
  // Keep the first performance for each role and vary subsequent reactions
  // with the other recording from the same voice family.
  const reactionTakes = assets.flatMap(asset => {
    const [, role, event] = /^voice-(.+)-(attack|hurt|death)$/.exec(asset.id) ?? [];
    const voice = recordedHumanVoices[role];
    if (!voice || (event !== 'hurt' && !role.startsWith('red-panther-'))) return [];
    const alternateTake = voice.take === '01' ? '02' : '01';
    const alternate = { ...asset, id: `${asset.id}-alternate`, sources: recordedSources(asset.id, alternateTake) };
    return [{
      alternate,
      pool: {
        id: reactionPoolId(asset.id),
        category: asset.category,
        assetIds: [asset.id, alternate.id],
        strategy: 'round-robin',
        cooldownMs: asset.cooldownMs,
        maxInstances: asset.maxInstances,
        priority: asset.priority,
      },
    }];
  });
  return withRecordedLightHurtTakes({
    ...base,
    assets: [...assets, ...reactionTakes.map(({ alternate }) => alternate)],
    pools: [...(base.pools ?? []), ...reactionTakes.map(({ pool }) => pool)],
  });
}
export const V104_ARMOR_AUDIO={id:'v104-armor-hit',category:'melee',sources:sources('armor-hit'),gain:.68,priority:78,cooldownMs:140,maxInstances:2};
export const V104_HANDGUN_AUDIO={id:'v104-handgun',category:'weapons',sources:sources('handgun'),gain:.72,priority:72,cooldownMs:100,maxInstances:4};
export const V104_CROSSBOW_AUDIO={id:'weapon-crossbow-release',category:'weapons',sources:sources('crossbow-release'),gain:.68,priority:70,cooldownMs:90,maxInstances:4};
export const V104_PAN_GUARD_AUDIO = {
  id: PWA_PAN_GUARD_FILE.id,
  category: 'melee',
  sources: [{src: PWA_PAN_GUARD_FILE.path, type: 'audio/mpeg'}],
  gain: .58,
  priority: 78,
  cooldownMs: 80,
  maxInstances: 2,
};
const rpVoiceEvents={attack:{priority:67,cooldownMs:1400,gain:.72},hurt:{priority:76,cooldownMs:700,gain:.78},death:{priority:86,cooldownMs:300,gain:.8}};
const rpVoices=['red-panther-knife','red-panther-shield','red-panther-smg','red-panther-commander']
 .flatMap(kind=>Object.entries(rpVoiceEvents).map(([event,settings])=>Object.freeze({kind,event,
  asset:Object.freeze({id:`voice-${kind}-${event}`,category:'humanVoices',sources:sources(`voice-${kind}-${event}`),
   preload:'lazy',loop:false,maxInstances:1,...settings})})));
export const V104_RED_PANTHER_VOICES=Object.freeze(rpVoices.map(row=>row.asset));
const rpMaterialVoices=new Map(rpVoices.map(row=>[`enemy-${row.kind}-${row.event}`,Object.freeze({...row,
 cueId: reactionPoolId(row.asset.id),
 asset:Object.freeze({...row.asset,sources:recordedSources(row.asset.id)})})]));
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
// Close-contact effort uses the existing recorded nonverbal voice family.
// Steady ranged fire keeps the weapon cue; hurt and death stay separate.
const weaponOnlyAttackKinds=new Set(['ranger','gunner','medic','engineer','mrs-chiha','babayaga']);
export function battleVoiceReady(actor,event,time,world){
 if(event==='attack'&&weaponOnlyAttackKinds.has(actor?.kind))return false;
 if(!actor||!(actor.hp>0)||!Number.isFinite(time))return false;
 const key=v177JointActorKey(actor,world),clocks=voiceClocks.get(key)??{},last=clocks[event],gap=event==='attack'?2.1:.8;
 if(Number.isFinite(last)&&time>=last&&time-last<gap)return false;
 clocks[event]=time;voiceClocks.set(key,clocks);return true;
}
// A metal contact can sound without a pain voice. Keep its clock separate
// so armor feedback never consumes the next confirmed injury reaction.
export function v104EnemyContactAudio(world,actor,damage,cueId){
 if(actor?.side!=='zombie'||!cueId||!Number.isFinite(damage)||damage<0)return null;
 const voiceAllowed=damage>0;
 if(!voiceAllowed&&v104SupplementalEnemyVoice(cueId)?.event!=='hurt')return null;
 if(!battleVoiceReady(actor,voiceAllowed?'hurt':'armor-contact',world?.time,world))return null;
 return {ownerId:actor.id,voiceAllowed};
}
// A monster's vocal reaction follows its actor. Weapon, impact and body-fall
// aliases keep their separate playback, including the Red Panther material cues.
export function v104MonsterVoiceEvent(manifest, cueId) {
  const recordedReaction = /^enemy-.+-(attack|hurt|death)$/;
  const event = recordedReaction.exec(cueId)?.[1];
  if (!event) return undefined;
  const alias = manifest.aliasById[cueId];
  if (alias && !recordedReaction.test(alias.targetId)) return undefined;
  const cue = alias ?? manifest.poolById[cueId] ?? manifest.assetById[cueId];
  if (cue?.category !== 'monsters') return undefined;
  return event === 'death' ? 'exit' : event;
}

// Keep the original takes. An injury or exit replaces the same fighter's
// held voice and invalidates an earlier take that is still loading.
export function playV104FighterVoice(mixer,cueId,event,options){
 if(event!=='attack')mixer.stopInstance(options.instanceKey,{fadeMs:45});
 const takes = event === 'hurt' && mixer.manifest?.poolById?.[reactionPoolId(cueId)];
 return mixer.play(takes ? takes.id : cueId,{...options,maxInstances:1});
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
 (world.pendingBattleAudioCues??=[]).push({cueId:owner.kind==='kumaverson'?V104_PAN_GUARD_AUDIO.id:'v104-armor-hit',
  x:owner.x,battleGeneration:world.battleAudioGeneration,ownerId:owner.id,activationId:0,
  semantic:'guard-contact',receiptId:`guard:${owner.id}:${world.time.toFixed(6)}`,dueSimulationTime:world.time,
  priority:78,cooldownMs:0,maxInstances:2});
 return true;
}
