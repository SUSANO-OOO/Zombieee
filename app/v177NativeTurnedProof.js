// Only the localhost QA bridge may call this original-birth continuation.
// The original infection branch and completed rise must supply this SAME actor.
// No synthetic turned spawn, newborn/grace/clock injection, world reset or new
// proof lifetime state. Existing arm/read observations own the origin.
export function configureV177BornTurnedContinuation(world,{proofId,phase},deps){
  if(!['move','attack','engage'].includes(phase))throw Error('Turned continuation phase invalid');
  const source=deps.readGetup(world),birth=source?.actualBirth;
  if(!source?.released||source.proofId!==proofId||source.battleGeneration!==world.battleAudioGeneration
    ||!world.running||world.paused||world.over||source.time!==world.time
    ||!birth||source.actorId!==birth.actorId||source.corpseId!==birth.corpseId
    ||source.proof.manualBirth!==false||source.proof.injectedSpawnGrace!==false
    ||source.proof.manualClockAdvance!==false||!Array.isArray(source.proof.initialFighterIds)
    ||source.proof.initialFighterIds.includes(birth.actorId)||birth.actorId===birth.corpseId)
    throw Error('Original infection/newborn proof is required');
  const actor=world.fighters.find(f=>f.id===birth.actorId),actualBirth=actor&&deps.readBirth(world,actor);
  if(!actor||actor.kind!=='turned'||actor.side!=='zombie'||!(actor.hp>0)
    ||actor.spawnGrace!==0||actor.flash!==0||actor.stunned!==0||Math.abs(actor.knock||0)>.1
    ||!actualBirth||actualBirth.actorId!==actor.id||actualBirth.corpseId!==birth.corpseId
    ||actualBirth.bornAt!==birth.bornAt||actualBirth.initialRemaining!==birth.initialRemaining
    ||world.time<birth.bornAt+birth.initialRemaining
    ||birth.source?.sourceBound!==true||birth.source?.recordedAfterPaint!==true)
    throw Error('The original newborn and rise clock must have completed');
  const normal=source.draws.filter(d=>d.renderKind==='turned'&&d.jointDrawSucceeded===true
    &&d.jointGetupProgress===null&&Number.isFinite(d.jointPaintedAt)
    &&d.jointPaintedAt>=birth.bornAt+birth.initialRemaining
    &&['idle','move','start-move','stop-move','turn'].includes(d.requestedState));
  if(new Set(normal.map(d=>d.renderSequence)).size<3)
    throw Error('Three actual post-rise paints are required');
  const keys=['speed','laneSpeed','damage','range','attackEvery','hp','maxHp'];
  const original=Object.fromEntries(keys.map(k=>[k,actor[k]])),time=world.time,id=actor.id;
  if(!Object.values(original).every(Number.isFinite))throw Error('Original newborn stats must be finite');
  // Spawn ONLY the controlled human opponent. The born actor remains in-world.
  const actorStateBefore=JSON.stringify(actor);
  const targetLane=actor.lane;
  if(!Number.isInteger(targetLane)||targetLane<0||targetLane>2||typeof deps.laneYFor!=='function')
    throw Error('Current born lane center resolver is required');
  const targetY=deps.laneYFor(targetLane);
  if(!Number.isFinite(targetY))throw Error('Current born lane center must be finite');
  const target=deps.spawnTarget(world);
  if(!target||target.side!=='human'||target.kind!=='guardian'||target.id===id)
    throw Error('Controlled Guardian target unavailable');
  const reach=deps.catalog.attackReachFor(actor,target),approachDistance=Math.max(8,actor.speed*1.1);
  if(!Number.isFinite(reach)||reach<0)throw Error('Original born actor reach unavailable');
  // Only the inert opponent receives controlled initial placement and settings.
  // Do not reset this real newborn's cooldown, action, target, gait or position.
  target.x=actor.x-(phase==='move'?Math.max(250,actor.speed*5):phase==='engage'
    ?reach+approachDistance:Math.max(12,Math.min(40,actor.range*.45)));
  // The real newborn may still be between lane centers. Only the inert
  // target is aligned; read the App's CURRENT geometry, not a static/jittered Y.
  target.y=targetY;target.lane=targetLane;target.anchorLane=targetLane;
  target.combatReady=true;target.gateEntering=false;target.spawnGrace=0;target.entryRampCleared=true;
  target.speed=0;target.laneSpeed=0;target.damage=0;target.cooldown=99;target.abilityCooldown=999;
  target.hp=1_000_000;target.maxHp=1_000_000;
  const proof={fighterId:id,targetId:target.id,kind:'turned',side:'zombie',renderKind:'turned',
    v100TwinPart:null,legacyFusedFixture:false,phase,originalActorStats:original,
    initial:{actorX:actor.x,actorY:actor.y,targetX:target.x,targetY:target.y,targetLane,actorHp:actor.hp,targetHp:target.hp},
    ...(phase==='engage'?{engagement:{productionAttackReach:reach,approachDistance}}:{})};
  if(world.time!==time||actor.id!==id||world.fighters.find(f=>f.id===id)!==actor
    ||JSON.stringify(actor)!==actorStateBefore
    ||keys.some(k=>actor[k]!==original[k]))throw Error('Original birth, clock or actor state changed');
  const origin={proofId,corpseId:birth.corpseId,actorId:id,battleGeneration:source.battleGeneration,
    preparedAt:source.proof.preparedAt,releasedAt:source.releasedAt,bornAt:birth.bornAt,
    originalRiseRemaining:birth.initialRemaining,normalAt:time,
    sourceBound:true,recordedAfterPaint:true,lastNormalRenderSequence:normal.at(-1).renderSequence,
    observedNormalPaintCount:normal.length,originalActorStats:original,
    manualBirth:false,injectedSpawnGrace:false,manualClockAdvance:false};
  // The bridge may now clear ONLY this actor's QA history and bind the fresh
  // native start-ACK window. Never prepare/reset a different continuous world.
  return {...proof,origin,scope:'Original infection/new ID and completed rise, then a controlled target; not normal campaign or naturalness acceptance'};
}
