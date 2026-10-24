// Localhost-only controlled pair fixture. No CLI entry, product import or timer. Original spawnEnemy
// must be passed from the App closure; it calls registerV100Twin itself.
const requireProof=(ok,message)=>{if(!ok)throw new Error(message);};
const statKeys=['speed','laneSpeed','damage','range','attackEvery','hp','maxHp'];
const clone=value=>structuredClone(value);
const withoutPosition=actor=>{const copy=clone(actor);for(const key of ['x','y','lane','anchorLane'])delete copy[key];
  if(copy.animationPresentation){delete copy.animationPresentation.lastX;delete copy.animationPresentation.lastY;}return copy;};
export function v177FormalFutagoPairSource(definition){
  requireProof(definition?.missionConfig?.v100StageNumber===24&&definition.bossEnemyKind==='futago','Original S24 boss definition required');
  const waveIndex=definition.timeline.findIndex(w=>w.units.filter(k=>k==='futago').length===2);
  requireProof(waveIndex>=0,'Formal twin wave missing');const wave=definition.timeline[waveIndex];
  return {stageId:definition.stageId,waveIndex,wave:wave.wave,at:wave.at,allWaveKinds:[...wave.units],
    pairOrders:wave.units.flatMap((kind,order)=>kind==='futago'?[order]:[])};
}
export function prepareV177NativeFutagoPair(world,{renderKind,phase,proofId,lane=1,laneY},deps){
  requireProof(['futago-separated-a','futago-separated-b'].includes(renderKind),'Fused legacy form requires separate art-only fixture');
  requireProof(['move','attack','engage'].includes(phase),'Invalid phase');
  requireProof(world.paused===true&&world.running===true&&!world.over&&world.fighters.length===0,'Fresh paused owned S24 QA world required');
  requireProof(typeof proofId==='string'&&proofId.length>0,'QA proof identity required');
  requireProof(Number.isSafeInteger(world.battleAudioGeneration)&&world.battleAudioGeneration>0,'Real audio generation required');
  requireProof(Number.isFinite(world.time)&&Number.isFinite(laneY),'Original clock and lane required');
  const source=v177FormalFutagoPairSource(world.definition),clockBefore=world.time;
  const countBefore=world.v100TwinSpawnCount??0;
  requireProof(Number.isSafeInteger(countBefore)&&countBefore===0,'An unmatched prior twin cannot be borrowed');
  const born=source.pairOrders.map(order=>{
    const ordinal=world.v100TwinSpawnCount??0;
    // Real App spawn constructor sets stats, clocks, ability, AI and boss ID,
    // then invokes registerV100Twin. No part, target or actor timer assignment.
    const actor=deps.spawnEnemy(world,'futago',lane,order);
    requireProof(actor?.kind==='futago'&&actor.side==='zombie'&&actor.v100BossId==='boss-futago','Original registered boss missing');
    requireProof(world.v100TwinSpawnCount===ordinal+1,'Real registerV100Twin must advance once per birth');
    requireProof(actor.v100TwinPair===Math.floor(ordinal/2)&&actor.v100TwinPart===(ordinal%2?'b':'a'),'Registration ordinal owner mismatch');
    return {actor,ordinal,sourceOrder:order};
  });
  requireProof(born[0].actor.v100TwinPair===born[1].actor.v100TwinPair,'Same actual pair required');
  const selectedPart=renderKind.at(-1),selected=born.find(x=>x.actor.v100TwinPart===selectedPart),partner=born.find(x=>x!==selected);
  const actor=selected.actor,buddy=partner.actor;
  requireProof(deps.bossRenderKind(actor)===renderKind&&deps.bossRenderKind(buddy)==='futago-separated-'+buddy.v100TwinPart,'Actual consumer render identity mismatch');
  const expectedStats=deps.originalFutagoStatsFor(world);for(const member of born)for(const key of statKeys)requireProof(Number.isFinite(expectedStats[key])&&member.actor[key]===expectedStats[key],'Actual constructor stat differs from original catalog '+key);
  const protectedBefore=born.map(x=>withoutPosition(x.actor));
  const originalActorStats=Object.fromEntries(statKeys.map(k=>[k,actor[k]]));
  const originalPartnerStats=Object.fromEntries(statKeys.map(k=>[k,buddy[k]]));
  requireProof([...Object.values(originalActorStats),...Object.values(originalPartnerStats)].every(Number.isFinite),'Finite original stats required');
  const target=deps.spawnControlledGuardian(world),buddyTarget=deps.spawnControlledGuardian(world);
  requireProof(target&&buddyTarget&&target.id!==buddyTarget.id&&target.side==='human'&&buddyTarget.side==='human','Two real controlled opponents required');
  // These explicitly inert durable opponents are fixture-only. Both bosses keep
  // their raw HP, AI, cooldowns, ability clocks and natural target selection.
  for(const t of [target,buddyTarget]){t.speed=0;t.laneSpeed=0;t.damage=0;t.cooldown=99;t.hp=1_000_000;t.maxHp=1_000_000;}
  actor.x=610;buddy.x=880;
  const reach=deps.normalAttackReach(actor,target);
  requireProof(Number.isFinite(reach)&&reach>0,'Production reach must be read');
  const approachDistance=Math.max(8,actor.speed*1.1);
  // Keep the move opponent inside the real area's pursuit radius and nearer
  // than the companion's opponent after the real boss-body barrier moves it.
  // At the original9px/s it remains beyond normal reach throughout this clip.
  target.x=phase==='move'?actor.x-150:actor.x-(phase==='engage'?reach+approachDistance:Math.max(12,Math.min(40,actor.range*.45)));
  buddyTarget.x=850;
  for(const f of [actor,buddy,target,buddyTarget]){f.y=laneY;f.lane=lane;f.anchorLane=lane;}
  // Rebase only the positional origin of these freshly constructed fixtures.
  // Initial placement is not a walked distance; all action/gait clocks persist.
  for(const f of [actor,buddy,target,buddyTarget]){
    requireProof(f.animationPresentation&&Number.isFinite(f.animationPresentation.lastX)&&Number.isFinite(f.animationPresentation.lastY),'Original animation position required');
    f.animationPresentation.lastX=f.x;f.animationPresentation.lastY=f.y;
  }
  for(let i=0;i<born.length;i++)requireProof(JSON.stringify(withoutPosition(born[i].actor))===JSON.stringify(protectedBefore[i]),'Only initial position and its animation origin may change');
  requireProof(world.time===clockBefore,'No simulation clock advance');
  return {schema:'v177-native-shard-proof/v1',proofId,battleGeneration:world.battleAudioGeneration,
    owner:'futago-pair',fighterId:actor.id,targetId:target.id,partnerId:buddy.id,partnerTargetId:buddyTarget.id,
    kind:'futago',side:'zombie',renderKind,v100TwinPart:selectedPart,legacyFusedFixture:false,phase,
    originalActorStats,originalPartnerStats,
    ownerEvidence:{v100BossId:'boss-futago',pairId:actor.v100TwinPair,selectedPart,aId:born[0].actor.id,bId:born[1].actor.id,
      spawnCountBefore:countBefore,spawnCountAfter:world.v100TwinSpawnCount,
      spawnOrdinals:born.map(x=>({fighterId:x.actor.id,part:x.actor.v100TwinPart,ordinal:x.ordinal,sourceOrder:x.sourceOrder})),
      formalWave:source},
    engagement:phase==='engage'?{productionAttackReach:reach,approachDistance}:null,
    preparedAt:clockBefore,manualClockAdvance:false,
    fixtureScope:'Controlled S24 pair constructor fixture selects the two authored boss entries. Four accompanying Panther entries and the campaign prelude are not simulated. Both actual registered bodies remain. Not a natural campaign encounter or balance acceptance.',
    actorStateAfterPrepare:born.map(x=>({fighterId:x.actor.id,rawWithoutPosition:withoutPosition(x.actor)}))};
}

// The only new observation state: one bounded QA-only array per armed world.
// No event emitter, general ledger, new simulation state machine or actor fields.
export function createV177FutagoDamageCopy(){
  const armed=new WeakMap();
  return {
    arm(world,proof){requireProof(proof.owner==='futago-pair','Pair proof required');armed.set(world,{proof,sequence:0,rows:[],overflow:false});},
    copyAfterAppliedDamage(world,{source,target,beforeHp,resolvedDamage,mode,attackSequence}){
      const state=armed.get(world);if(!state)return;
      // Called only directly after the original damage computation in the App.
      // Preserve unknown sources hitting either target so they cannot be filtered away.
      if(![state.proof.targetId,state.proof.partnerTargetId].includes(target?.id))return;
      const afterHp=target.hp,appliedDamage=beforeHp-afterHp;
      if(![beforeHp,afterHp,resolvedDamage].every(Number.isFinite)||appliedDamage<0||Math.abs(appliedDamage-resolvedDamage)>=1e-7){state.failure='Actual postdamage boundaries differ';return;}
      const row={sequence:++state.sequence,proofId:state.proof.proofId,
        battleGeneration:world.battleAudioGeneration,sourceId:source?.id??null,targetId:target.id,sourceKind:source?.kind??null,
        attackSequence,mode,at:world.time,beforeHp,afterHp,appliedDamage};
      if(state.rows.length<128)state.rows.push(Object.freeze(row));else state.overflow=true;
    },
    read(world){const state=armed.get(world);return state?{proof:clone(state.proof),sequence:state.sequence,overflow:state.overflow,failure:state.failure??null,rows:state.rows.map(r=>({...r}))}:null;},
    clear(world){armed.delete(world);}
  };
}
