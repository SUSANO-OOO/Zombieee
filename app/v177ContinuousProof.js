// Keep this QA configurator a dependency-free leaf. The bridge supplies the
// existing source catalogs and animation constructor when a fixture is called;
// importing it must not reorder production catalog/chunk initialization.

// Base enemies already have continuous campaign-spawn coverage. Add every ally
// and authored alternate body, including the legacy fused twin art explicitly
// as an art fixture; that form is never presented as a natural V1 encounter.
export function v177AdditionalContinuousForms(knownForms,playableKinds){
  return Object.freeze(knownForms.filter(kind=>playableKinds.includes(kind)||kind==='mayo-chan-feral'||kind==='futago'||kind.startsWith('futago-separated-')));
}

export function v177ProofFormIdentity(form,{knownForms,playableKinds}){
  if(!knownForms.includes(form))throw new Error(`Unknown continuous proof form: ${form}`);
  const kind=form==='mayo-chan-feral'?'mayo-chan':form.startsWith('futago-separated-')?'futago':form;
  return {kind,side:playableKinds.includes(kind)?'human':'zombie',renderKind:form,
    v100TwinPart:form.startsWith('futago-separated-')?form.at(-1):null,
    legacyFusedFixture:form==='futago'};
}

// Only the localhost QA bridge calls this. The actor keeps its real movement,
// range, damage, cadence, identity and progression. An inert durable opponent
// supplies a controlled target; normal AI and the real simulation do the work.
export function configureV177ContinuousActorProof(actor,target,{form,phase,lane,laneY,knownForms,playableKinds,createAnimationRuntime,feralSeconds,attackReachFor}){
  const identity=v177ProofFormIdentity(form,{knownForms,playableKinds});
  if(!['move','attack','engage'].includes(phase)||!Number.isInteger(lane)||!Number.isFinite(laneY))throw new Error('Invalid continuous proof phase or lane');
  if(actor?.kind!==identity.kind||actor?.side!==identity.side||!target||target.side===actor.side)throw new Error('Continuous proof actor/target identity mismatch');
  if(form==='mayo-chan-feral'&&!actor.manualAbility)throw new Error('Feral form requires its own manual ability runtime');
  if(typeof createAnimationRuntime!=='function'||(form==='mayo-chan-feral'&&!(Number.isFinite(feralSeconds)&&feralSeconds>0)))throw new Error('Continuous proof requires the original animation constructor and feral duration');
  const originalActorStats=Object.fromEntries(['speed','laneSpeed','damage','range','attackEvery','hp','maxHp'].map(key=>[key,actor[key]]));
  if(!Object.values(originalActorStats).every(Number.isFinite))throw new Error('Continuous proof requires finite original actor stats');
  // Use the production reach rule, including the target body, without
  // enlarging actor range or changing its original movement/cadence.
  const reachActor=form==='mayo-chan-feral'?{...actor,manualAbility:{...actor.manualAbility,phase:'feral'}}:actor;
  const engagementReach=phase==='engage'&&typeof attackReachFor==='function'?attackReachFor(reachActor,target):null;
  if(phase==='engage'&&(!(actor.speed>0)||!Number.isFinite(engagementReach)||engagementReach<0))throw new Error('Engagement proof requires original speed and production attack reach');
  const approachDistance=phase==='engage'?Math.max(8,actor.speed*1.1):null;
  const facing=actor.side==='human'?'right':'left',sign=actor.side==='human'?1:-1;
  actor.x=actor.side==='human'?330:620;
  // Let longer-range weapons be seen instead of hiding the arm and muzzle
  // behind a target placed within 40px of every body. Melee spacing is retained.
  const attackDistance=actor.range>80?actor.range*.8:typeof attackReachFor==='function'
    ?Math.max(12,attackReachFor(reachActor,target)-2):Math.max(12,Math.min(40,actor.range*.45));
  target.x=phase==='move'?(actor.side==='human'?900:250):actor.x+sign*(phase==='engage'?engagementReach+approachDistance:attackDistance);
  for(const fighter of [actor,target]){
    fighter.y=laneY;fighter.lane=lane;fighter.anchorLane=lane;
    fighter.combatReady=true;fighter.gateEntering=false;fighter.spawnGrace=0;fighter.entryRampCleared=true;
    fighter.attack=0;fighter.attackWindup=0;fighter.abilityWindup=0;fighter.flash=0;
    fighter.targetObjectId=null;fighter.retargetIn=99;fighter.abilityCooldown=999;
  }
  actor.targetId=target.id;actor.attackWindupTargetId=null;actor.attackSequence=0;actor.aiMoveDirection=0;
  actor.cooldown=phase==='move'?99:0;
  actor.animationPresentation=createAnimationRuntime({direction:facing,x:actor.x,y:actor.y});
  if(actor.kind==='futago')actor.v100TwinPart=identity.v100TwinPart??undefined;
  if(form==='mayo-chan-feral')actor.manualAbility={...actor.manualAbility,phase:'feral',activeRemaining:feralSeconds};
  target.targetId=actor.id;target.speed=0;target.laneSpeed=0;target.damage=0;target.cooldown=99;
  target.hp=1_000_000;target.maxHp=1_000_000;
  return {fighterId:actor.id,targetId:target.id,...identity,phase,originalActorStats,
    ...(phase==='engage'?{engagement:{productionAttackReach:engagementReach,approachDistance}}:{}),
    initial:{actorX:actor.x,targetX:target.x,actorHp:actor.hp,targetHp:target.hp},
    scope:identity.legacyFusedFixture?'controlled legacy fused-art fixture; not a natural V1 encounter':'controlled target with original actor stats; not normal campaign or balance acceptance'};
}

// Queue one controlled incoming hit, rather than setting HP, a corpse or a
// retreat pose. The normal simulation resolves damage and the real outcome.
// Mayo keeps its dedicated nonlethal retreat; this is not campaign balance QA.
export function configureV177ReactionProof(actor,target,options){
  const proof=configureV177ContinuousActorProof(actor,target,{...options,phase:'attack'});
  actor.cooldown=99;
  const incomingHit=v177ControlledOutcomeHit(actor,target);
  return {...proof,phase:'defeat',outcome:actor.kind==='mayo-chan'?'retreat':'corpse',incomingHit,
    scope:'controlled incoming damage with original actor HP and stats; real damage/defeat or protected retreat; not normal campaign or balance acceptance'};
}

// Also usable after the existing actual-birth, actual-activation and real pair
// constructors. It queues damage; it never manufactures HP or an outcome pose.
export function v177ControlledOutcomeHit(actor,target){
  if(!actor||!target||actor.id===target.id||actor.side===target.side||!(actor.hp>0)||!(actor.maxHp>0))
    throw new Error('Controlled outcome requires a living original actor and its opposing source');
  return {eventKind:'impact',targetKind:'fighter',targetSide:actor.side,damageMode:'direct',
    sourceId:target.id,targetId:actor.id,targetX:actor.x,targetY:actor.y-28,
    originX:target.x,originY:target.y-24,remainingSeconds:.08,damage:actor.maxHp*100+1,
    weapon:target.kind,shotIndex:0,recoil:0,casing:false,hitStopSeconds:0,impactDelaySeconds:.08,applyDamage:true};
}
