// Localhost-only observations of the original Mayo activation and self-drain.
// This dependency-free leaf does not start a runtime or change actor state.
export function createMayoFeralProofOwner(deps) {
  const states=new WeakMap();let nextGeneration=0;
  const need=(c,m)=>{if(!c)throw new Error(m);};
  const pick=f=>Object.fromEntries(['speed','laneSpeed','damage','range','attackEvery','hp','maxHp','cooldown'].map(k=>[k,f[k]]));
  const manual=m=>Object.fromEntries(['kind','phase','activationId','abilityElapsed','windupRemaining','activeRemaining','cooldownRemaining'].map(k=>[k,m?.[k]]));
  const copy=x=>structuredClone(x),state=(world,id)=>{const s=states.get(world);need(s&&s.proof.proofId===id,'Stale Mayo proof/world');return s;};
  function prepare(world,{proofId,phase}) {
    need(['move','attack','engage'].includes(phase)&&typeof proofId==='string'&&proofId.length>0,'Invalid Mayo request');
    // This supplied App callback must call spawnHuman(g,"mayo-chan",false),
    // spawnEnemy(g,"walker",lane), and the existing controlled room reset.
    // It MUST NOT call the generic feral configurator or overwrite actor HP,
    // manual state, attack/cooldown, stats or any clock.
    const {actor,target}=deps.prepareNormalPair(world);
    need(actor.kind==='mayo-chan'&&actor.side==='human'&&actor.hp>0&&actor.combatReady,'Original Mayo unavailable');
    need(actor.manualAbility?.phase==='ready'&&!actor.mayoRetreat,'A real ready Mayo is required');
    need(target.kind==='walker'&&target.side==='zombie','Original inert enemy required');
    const originalActorStats=pick(actor),priorActivationId=actor.manualAbility.activationId;
    need(Object.values(originalActorStats).every(Number.isFinite)&&Number.isSafeInteger(priorActivationId),'Original finite actor stats/activation required');
    Object.assign(target,{speed:0,laneSpeed:0,damage:0,cooldown:99,hp:1_000_000,maxHp:1_000_000});
    // Only the opponent is staged. Actor stays where the original pair spawned.
    target.x=900;target.y=actor.y;target.lane=actor.lane;target.anchorLane=actor.lane;
    for(const [k,v]of Object.entries(originalActorStats))need(actor[k]===v,'Actor overwritten at setup:'+k);
    const proof={schema:'v177-native-shard-proof/v1',proofId,proofGeneration:++nextGeneration,
      battleGeneration:deps.battleGeneration(world),owner:'mayo-activation',fighterId:actor.id,targetId:target.id,
      kind:'mayo-chan',side:'human',renderKind:'mayo-chan-feral',v100TwinPart:null,legacyFusedFixture:false,
      phase,originalActorStats,priorActivationId,preparedAt:world.time,activeSeconds:deps.definition.activeSeconds};
    states.set(world,{proof,actorId:actor.id,rows:[],overflow:false,pending:null,ownerEvidence:null,armed:false,released:false});
    return copy(proof);
  }
  function beforeStep(world,actor,dt,tick) {
    const s=states.get(world);if(!s||actor.id!==s.actorId)return;
    const start=world.manualAbilityReceipts.find(r=>r.ownerId===actor.id&&r.kind==='mayo-chan'&&r.eventType==='start'&&r.activationId===s.proof.priorActivationId+1);
    if(!start)return;
    if(!s.ownerEvidence)s.ownerEvidence={activationId:start.activationId,startReceipt:copy(start),activeSeconds:deps.definition.activeSeconds};
    if(s.pending){s.failure='Overlapping Mayo source tick';return;} // telemetry never changes original simulation by throwing
    s.pending={tick,from:world.time-dt,to:world.time,dt,hpBefore:actor.hp,maxHp:actor.maxHp,
      before:manual(actor.manualAbility),retreatBefore:Boolean(actor.mayoRetreat)};
  }
  function afterStep(world,actor,tick) {
    const s=states.get(world);if(!s||actor.id!==s.actorId||!s.pending)return;
    if(s.pending.tick!==tick){s.failure='Mayo tick mismatch';return;}
    const row={...s.pending,hpAfter:actor.hp,after:manual(actor.manualAbility),retreatAfter:Boolean(actor.mayoRetreat)};
    s.pending=null;if(s.rows.length<4096)s.rows.push(row);else s.overflow=true;
    const feral=world.manualAbilityReceipts.find(r=>r.ownerId===actor.id&&r.activationId===s.ownerEvidence.activationId&&r.kind==='mayo-chan'&&r.eventType==='feral-start');
    if(feral&&!s.ownerEvidence.feralReceipt){s.ownerEvidence.feralReceipt=copy(feral);s.ownerEvidence.feralStartAt=feral.at;}
  }
  function arm(world,proofId) {
    const s=state(world,proofId),actor=world.fighters.find(f=>f.id===s.actorId),target=world.fighters.find(f=>f.id===s.proof.targetId);
    need(!s.failure&&!s.pending&&!s.armed&&!s.released,'Mayo proof invalid/already armed/released');
    need(s.ownerEvidence?.feralReceipt&&!s.overflow&&world.running&&!world.over&&actor?.hp>0&&actor.combatReady&&actor?.manualAbility?.phase==='feral'&&actor.manualAbility.activeRemaining>0&&!actor.mayoRetreat,'Real feral window missing/expired');
    need(deps.battleGeneration(world)===s.proof.battleGeneration,'Battle lifecycle changed');
    const reach=deps.attackReachFor(actor,target),approach=Math.max(8,actor.speed*1.1);
    need(Number.isFinite(reach)&&reach>=0&&target,'Real feral reach missing');
    const targetLane=actor.lane,targetY=deps.laneYFor?.(targetLane);
    need(Number.isInteger(targetLane)&&targetLane>=0&&targetLane<=2&&Number.isFinite(targetY),'Current Mayo lane center resolver required');
    world.paused=true;deps.setPausedUi(true);
    // Actor, HP, CD and clocks are never reset. Stage only the inert opponent
    // relative to the actually living/activated actor, using its real reach.
    target.x=s.proof.phase==='move'?900:actor.x+(s.proof.phase==='engage'?reach+approach:Math.max(12,Math.min(40,actor.range*.45)));
    target.y=targetY;target.lane=targetLane;target.anchorLane=targetLane;
    s.proof.engagement=s.proof.phase==='engage'?{productionAttackReach:reach,approachDistance:approach}:null;
    s.armed=true;s.arm={simulationTime:world.time,tick:deps.simulationTick(world),activeRemaining:actor.manualAbility.activeRemaining,hp:actor.hp};
    return copy({...s.proof,ownerEvidence:s.ownerEvidence,arm:s.arm});
  }
  function release(world,proofId) {
    const s=state(world,proofId),actor=world.fighters.find(f=>f.id===s.actorId);
    need(!s.failure&&!s.pending&&s.armed&&!s.released&&world.running&&!world.over&&world.paused&&actor?.hp>0&&actor.combatReady&&!actor.mayoRetreat&&actor?.manualAbility?.phase==='feral'&&actor.manualAbility.activeRemaining>0,'Feral release invalid/expired');
    need(deps.battleGeneration(world)===s.proof.battleGeneration,'Battle lifecycle changed');
    s.released=true;s.release={simulationTime:world.time,tick:deps.simulationTick(world),nativeAt:deps.nativeNow()};
    world.paused=false;deps.setPausedUi(false);return copy(s.release);
  }
  function read(world,proofId) {const s=state(world,proofId);return copy({...s.proof,ownerEvidence:s.ownerEvidence,ledger:s.rows,overflow:s.overflow,failure:s.failure??null,pending:s.pending?copy(s.pending):null,arm:s.arm??null,release:s.release??null});}
  // Sampling needs only this actual live projection; do not transfer the full
  // prefix ledger on each120ms read. Full bounded raw ledger is retained once.
  function readLive(world,proofId){const s=state(world,proofId),f=world.fighters.find(f=>f.id===s.actorId);
    return copy({proofId:s.proof.proofId,proofGeneration:s.proof.proofGeneration,battleGeneration:deps.battleGeneration(world),
      simulationTime:world.time,simulationTick:deps.simulationTick(world),fighterId:f?.id??null,
      manualAbility:f?manual(f.manualAbility):null,mayoRetreat:f?.mayoRetreat??null,hp:f?.hp??null});}
  return {prepare,beforeStep,afterStep,arm,release,read,readLive};
}
