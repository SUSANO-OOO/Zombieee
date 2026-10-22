// Local QA observations of the original Spindle -> Ranger combat path. These
// records belong to the world renderer, never to a Fighter or campaign save.
const observations = new WeakMap();
const statKeys = ['kind','side','maxHp','speed','laneSpeed','damage','range','attackEvery','bodyRadius',
  'defense','progressionLevel','progressionRank'];
export const v177IncomingStunStats = fighter => Object.fromEntries(statKeys.map(key => [key,
  fighter[key]??(key==='progressionLevel'?1:key==='progressionRank'?0:null)]));

export function configureV177IncomingStunPair(actor,source,{lane,laneY,createAnimationRuntime,createNavigationRuntime,actorKind='ranger'}) {
  if(actor.kind!==actorKind||actor.side!=='human'||source.kind!=='spindle'||source.side!=='zombie')
    throw new Error('Incoming stun proof requires the original requested ally and Spindle');
  const original={actor:v177IncomingStunStats(actor),source:v177IncomingStunStats(source),
    actorHp:actor.hp,sourceHp:source.hp,actorCooldown:actor.cooldown,sourceCooldown:source.cooldown,
    sourceAbilityCooldown:source.abilityCooldown,actorSpawnGrace:actor.spawnGrace};
  for(const [fighter,x,direction]of [[actor,450,'right'],[source,488,'left']]){
    fighter.x=x;fighter.y=laneY;fighter.lane=lane;fighter.anchorLane=lane;
    fighter.animationPresentation=createAnimationRuntime({x,y:laneY,direction});
    fighter.navigationRecovery=createNavigationRuntime({x,y:laneY,lane});
  }
  return {form:actorKind,kind:actorKind,renderKind:actorKind,side:'human',phase:'incoming-stun',
    fighterId:actor.id,targetId:source.id,lane,original,originalStats:true,inertOpponent:false,
    injectedHit:false,injectedStun:false,manualClockAdvance:false};
}

export function armV177IncomingStunProof(world,proof) {
  const bound={...proof,battleGeneration:world.battleAudioGeneration,
    proofId:`${world.battleAudioGeneration}:${proof.fighterId}:${proof.targetId}`};
  observations.set(world,{proof:bound,impacts:[],draws:[],overflow:false,released:false});
  return structuredClone(bound);
}
export function releaseV177IncomingStunProof(world,proofId) {
  const state=observations.get(world);
  if(!state||state.released||state.proof.proofId!==proofId||state.proof.battleGeneration!==world.battleAudioGeneration
    ||!world.running||!world.paused||world.over)throw new Error('Incoming stun proof release boundary changed');
  state.released=true;state.releasedAt=world.time;world.paused=false;
  return {proofId,releasedAt:state.releasedAt};
}
export function readV177IncomingStunProof(world,afterSequence=0) {
  const state=observations.get(world);
  return state?structuredClone({...state,draws:state.draws.filter(row=>row.renderSequence>afterSequence)}):null;
}
export function recordV177IncomingStunImpact(world,source,target,kind,hpBefore,damage,attackSequence=null) {
  const state=observations.get(world);
  if(!state||source.id!==state.proof.targetId||target.id!==state.proof.fighterId)return;
  if(state.impacts.length>=16){state.overflow=true;return;}
  state.impacts.push({kind,at:world.time,proofId:state.proof.proofId,battleGeneration:world.battleAudioGeneration,
    sourceId:source.id,targetId:target.id,
    sourceKind:source.kind,targetKind:target.kind,hpBefore,hpAfter:target.hp,damage,
    flash:target.flash,stunned:target.stunned,attackSequence,sourceAbilityPhase:source.stationAbility?.phase??null,
    abilityTargetIds:[...(source.stationAbility?.targetIds??[])],
    distance:Math.hypot(source.x-target.x,source.y-target.y)});
}
export function recordV177IncomingStunDraw(world,fighter,drawSucceeded,plan,audit) {
  const state=observations.get(world);
  if(!state||fighter.id!==state.proof.fighterId||!audit)return;
  if(state.draws.length>=512){state.overflow=true;return;}
  state.draws.push({at:world.time,proofId:state.proof.proofId,battleGeneration:world.battleAudioGeneration,
    renderSequence:audit.renderSequence,requestedState:audit.requestedState,
    renderKind:audit.renderKind,jointAtlasPath:audit.jointAtlasPath,jointDrawSucceeded:Boolean(drawSucceeded),
    jointWeightedLowerDrawSucceeded:audit.jointWeightedLowerDrawSucceeded===true,jointWeightedLower:audit.jointWeightedLower?{...audit.jointWeightedLower}:null,
    liveStun:Boolean(plan?.liveStun),stunRemaining:plan?.stunRemaining??null,stunElapsed:plan?.stunElapsed??null,
    hp:fighter.hp,flash:fighter.flash,stunned:fighter.stunned,attack:fighter.attack,attackWindup:fighter.attackWindup,
    abilityWindup:fighter.abilityWindup,manualAbilityPhase:fighter.manualAbility?.phase??null,
    lowerIndex:plan?.lowerIndex??null,upperOffsetY:plan?.upperOffsetY??null,
    upperPose:plan?.rangerStunUpperPose?structuredClone(plan.rangerStunUpperPose):null});
}
