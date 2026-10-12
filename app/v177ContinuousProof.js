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
export function configureV177ContinuousActorProof(actor,target,{form,phase,lane,laneY,knownForms,playableKinds,createAnimationRuntime,feralSeconds}){
  const identity=v177ProofFormIdentity(form,{knownForms,playableKinds});
  if(!['move','attack'].includes(phase)||!Number.isInteger(lane)||!Number.isFinite(laneY))throw new Error('Invalid continuous proof phase or lane');
  if(actor?.kind!==identity.kind||actor?.side!==identity.side||!target||target.side===actor.side)throw new Error('Continuous proof actor/target identity mismatch');
  if(form==='mayo-chan-feral'&&!actor.manualAbility)throw new Error('Feral form requires its own manual ability runtime');
  if(typeof createAnimationRuntime!=='function'||(form==='mayo-chan-feral'&&!(Number.isFinite(feralSeconds)&&feralSeconds>0)))throw new Error('Continuous proof requires the original animation constructor and feral duration');
  const originalActorStats=Object.fromEntries(['speed','laneSpeed','damage','range','attackEvery','hp','maxHp'].map(key=>[key,actor[key]]));
  if(!Object.values(originalActorStats).every(Number.isFinite))throw new Error('Continuous proof requires finite original actor stats');
  const facing=actor.side==='human'?'right':'left',sign=actor.side==='human'?1:-1;
  actor.x=actor.side==='human'?330:620;
  target.x=phase==='move'?(actor.side==='human'?900:250):actor.x+sign*Math.max(12,Math.min(40,actor.range*.45));
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
    initial:{actorX:actor.x,targetX:target.x,actorHp:actor.hp,targetHp:target.hp},
    scope:identity.legacyFusedFixture?'controlled legacy fused-art fixture; not a natural V1 encounter':'controlled target with original actor stats; not normal campaign or balance acceptance'};
}
