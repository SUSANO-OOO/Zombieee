// Local QA observations only; the real infection branch owns every birth.
const observations=new WeakMap();
const clone=value=>value==null?null:structuredClone(value);

export function armV177TurnedGetupProof(world,fields) {
  const corpse=world.corpses.find(row=>row.id===fields.corpseId);
  if(!world.running||!world.paused||world.over||world.time!==72
    ||![0,1].includes(fields.variant)||!corpse||corpse.kind!=='brawler'
    ||corpse.side!=='human'||corpse.variant!==fields.variant
    ||corpse.state!=='infection-warning'||Math.abs(corpse.infectionRemaining-4.8)>1e-9)
    throw Error('Turned get-up prepared corpse boundary changed');
  const proof={...fields,form:'turned',phase:'turned-getup',fixtureGroup:'actual-infection-getup',
    battleGeneration:world.battleAudioGeneration,proofId:`${world.battleAudioGeneration}:turned-getup:${fields.corpseId}`,
    preparedAt:world.time,preparedCorpseAgeSeconds:7.2,preparedCorpse:clone(corpse),
    initialFighterIds:world.fighters.map(row=>row.id),expectedVariant:fields.variant===0?'forward':'back',
    manualBirth:false,injectedSpawnGrace:false,manualClockAdvance:false,preparedFixture:true};
  observations.set(world,{proof,released:false,releasedAt:null,actualBirth:null,overflow:false});
  return clone(proof);
}

export function releaseV177TurnedGetupProof(world,proofId) {
  const state=observations.get(world);
  if(!state||state.released||state.proof.proofId!==proofId
    ||state.proof.battleGeneration!==world.battleAudioGeneration||world.time!==state.proof.preparedAt
    ||!world.running||!world.paused||world.over||!world.corpses.some(row=>row.id===state.proof.corpseId))
    throw Error('Turned get-up release boundary changed');
  state.released=true;state.releasedAt=world.time;world.paused=false;
  return {proofId,battleGeneration:state.proof.battleGeneration,releasedAt:state.releasedAt};
}

export function readV177TurnedGetupProof(world,{afterSequence=0,light=false}={},
  {readBirth,corpseHistory,fighterHistory}) {
  const state=observations.get(world);if(!state)return null;
  if(state.proof.battleGeneration!==world.battleAudioGeneration
    ||!Number.isSafeInteger(afterSequence)||afterSequence<0)throw Error('Turned get-up observation boundary changed');
  const matches=world.fighters.flatMap(fighter=>{
    if(fighter.kind!=='turned'||fighter.side!=='zombie')return [];
    const birth=readBirth(world,fighter);
    return birth?.corpseId===state.proof.corpseId&&birth.actorId===fighter.id?[{fighter,birth}]:[];
  });
  if(matches.length>1)throw Error('Prepared corpse acquired multiple actual turned births');
  const match=matches[0]??null;
  if(match) {
    if(!state.released||state.proof.initialFighterIds.includes(match.fighter.id)
      ||state.actualBirth&&state.actualBirth.actorId!==match.fighter.id)
      throw Error('Turned get-up actual newborn identity changed');
    state.actualBirth??=clone(match.birth);
  }
  const actorId=state.actualBirth?.actorId??null,corpseRows=corpseHistory(state.proof.corpseId),
    fighterRows=actorId===null?[]:fighterHistory(actorId);
  const summary={proofId:state.proof.proofId,battleGeneration:state.proof.battleGeneration,time:world.time,
    running:world.running,paused:world.paused,over:world.over,released:state.released,
    corpseId:state.proof.corpseId,actorId,corpseRenderSequence:corpseRows.at(-1)?.renderSequence??null,
    fighterRenderSequence:fighterRows.at(-1)?.renderSequence??null};
  if(light)return summary;
  if(afterSequence>0&&[corpseRows,fighterRows].some(rows=>rows.length>=128&&rows[0].renderSequence>afterSequence))state.overflow=true;
  return clone({...summary,proof:state.proof,releasedAt:state.releasedAt,actualBirth:state.actualBirth,
    birth:match?.birth??null,overflow:state.overflow,
    corpse:world.corpses.find(row=>row.id===state.proof.corpseId)??null,fighter:match?.fighter??null,
    corpseDraws:corpseRows.filter(row=>row.renderSequence>afterSequence),draws:fighterRows.filter(row=>row.renderSequence>afterSequence)});
}
