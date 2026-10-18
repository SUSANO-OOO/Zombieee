import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

const validRenderBoundary=b=>b&&Number.isSafeInteger(b.renderSequence)&&b.renderSequence>=0
  &&Number.isFinite(b.simulationTime)&&b.simulationTime>=0&&Number.isSafeInteger(b.battleAudioGeneration)&&b.battleAudioGeneration>=0;
const validStartActors=b=>Array.isArray(b?.actors)&&new Set(b.actors.map(a=>a?.id)).size===b.actors.length
  &&b.actors.every(a=>Number.isSafeInteger(a?.id)&&a.id>0&&typeof a.objectTailSame==='boolean'
    &&Object.hasOwn(a,'worldWeightedLower')&&(a.worldWeightedLower===null||typeof a.worldWeightedLower==='object'&&!Array.isArray(a.worldWeightedLower))
    &&(a.renderSequence===null||Number.isSafeInteger(a.renderSequence)&&a.renderSequence>0&&a.renderSequence<=b.renderSequence)
    &&(a.jointPaintedAt===null||Number.isFinite(a.jointPaintedAt)&&a.jointPaintedAt>=0&&a.jointPaintedAt<=b.simulationTime));

// These receipts qualify the workload inside the existing performance window.
// They do not replace its native RAF clock,33ms budget or any original gate.
export function rangerPerformanceReceipts(samples,{startedAt,endedAt}){
  const errors=[],actors=new Map();let observations=0,absenceSamples=0,lastReadAt=null,lastSimulationTime=null;
  let firstStart=null,lastRenderBoundary=null,baselineObservations=0,newPaintObservations=0;
  const check=(ok,message)=>{if(!ok)errors.push(message);};
  check(Number.isFinite(startedAt)&&Number.isFinite(endedAt)&&endedAt>startedAt,'Invalid original measurement window');
  check(Array.isArray(samples)&&samples.length>0,'Missing in-window observations');
  for(const [index,sample]of (Array.isArray(samples)?samples:[]).entries()){
    const sampleErrorsBefore=errors.length;
    const observed=sample.rangerDraws;
    if(!observed){errors.push('Missing Ranger draw projection at sample'+index);continue;}
    const start=observed.measurementStart,current=observed.renderBoundary,origin=start?.boundary;
    check(start?.startedAt===startedAt&&start?.active===true,'Missing exact original measurement-start binding');
    check(validRenderBoundary(origin)&&validStartActors(origin),'Missing or invalid actual start render boundary');
    check(validRenderBoundary(current)&&current.simulationTime===observed.simulationTime,'Missing or inconsistent same-snapshot render boundary');
    check(current?.battleAudioGeneration===origin?.battleAudioGeneration,'Ranger observation crosses the original battle generation');
    check(current?.renderSequence>=origin?.renderSequence&&current?.simulationTime>=origin?.simulationTime,'Ranger snapshot precedes the original start boundary');
    if(firstStart===null)firstStart=start;
    else check(JSON.stringify(start)===JSON.stringify(firstStart),'Original measurement-start boundary changed');
    const preceding=lastRenderBoundary??origin;
    if(lastRenderBoundary)check(current?.renderSequence>=lastRenderBoundary.renderSequence
      &&current?.battleAudioGeneration===lastRenderBoundary.battleAudioGeneration,'Actual snapshot render counter or generation regressed');
    check(Number.isFinite(observed.readAt)&&observed.readAt>=startedAt&&observed.readAt<=endedAt,'Ranger read lies outside the original native window');
    check(lastReadAt===null||observed.readAt>lastReadAt,'Ranger read clock did not advance');lastReadAt=observed.readAt;
    check(Number.isFinite(observed.simulationTime)&&observed.simulationTime===sample.time,'Ranger simulation clock differs from the same snapshot');
    check(lastSimulationTime===null||observed.simulationTime>lastSimulationTime,'Ranger simulation clock did not advance');lastSimulationTime=observed.simulationTime;
    if(!Array.isArray(observed.actors)){errors.push('Missing Ranger actor array');continue;}
    const expected=Array.isArray(sample.humans)?sample.humans.filter(actor=>actor.kind==='ranger'&&actor.hp>0):null;
    check(expected!==null,'Missing same-snapshot human ID bindings');
    check(expected!==null&&expected.length===observed.actors.length,'Observed Ranger IDs differ from the same living humans');
    if(!observed.actors.length)absenceSamples++;
    const sampleBoundaryValid=errors.length===sampleErrorsBefore;
    const ids=new Set();
    for(const actor of observed.actors){
      const actorErrorsBefore=errors.length;
      observations++;
      check(Number.isSafeInteger(actor.id)&&actor.id>0&&!ids.has(actor.id),'Invalid or duplicate actual Ranger ID');ids.add(actor.id);
      check(actor.kind==='ranger'&&actor.side==='human'&&Number.isFinite(actor.hp)&&actor.hp>0&&actor.hp<=actor.maxHp,'Receipt is not for a living production Ranger');
      const human=expected?.find(row=>row.id===actor.id);
      check(human!==undefined&&['kind','hp','maxHp','x','y','lane'].every(key=>human[key]===actor[key]),'Ranger receipt belongs to a different same-snapshot human');
      check(Number.isFinite(actor.x)&&Number.isFinite(actor.y)&&Number.isSafeInteger(actor.lane)&&actor.lane>=0,'Missing actual Ranger position');
      check(['maxHp','speed','laneSpeed','damage','range','attackEvery'].every(key=>Number.isFinite(actor[key])&&actor[key]>0),'Missing original Ranger actor stats');
      const draw=actor.render;
      if(!draw){errors.push('Missing actual Ranger postpaint receipt');continue;}
      check(actor.renderSource?.kind==='same-snapshot-unfiltered-tail'&&actor.renderSource.fighterId===actor.id
        &&Number.isSafeInteger(actor.renderSource.historyLength)&&actor.renderSource.historyLength>=1&&actor.renderSource.historyLength<=128,'Missing or foreign unfiltered Ranger tail source');
      check(Object.hasOwn(actor,'objectRender'),'Original object-keyed audit was not retained');
      if(actor.objectRender!==null)check(actor.objectRender&&typeof actor.objectRender==='object'
        &&JSON.stringify(actor.objectRender)===JSON.stringify(draw),'Object audit and unfiltered tail disagree');
      const initial=Array.isArray(origin?.actors)?origin.actors.find(row=>row?.id===actor.id):undefined;
      const baseline=index===0&&validRenderBoundary(origin)&&validRenderBoundary(current)
        &&current.renderSequence===origin.renderSequence&&current.simulationTime===origin.simulationTime
        &&current.battleAudioGeneration===origin.battleAudioGeneration
        &&initial?.renderSequence===draw.renderSequence&&initial?.jointPaintedAt===draw.jointPaintedAt
        &&initial?.objectTailSame===true&&initial?.worldWeightedLower!==null
        &&JSON.stringify(initial.worldWeightedLower)===JSON.stringify(draw.jointWeightedLower)
        &&draw.jointPaintedAt===origin.simulationTime;
      const newPaint=validRenderBoundary(preceding)&&validRenderBoundary(current)
        &&draw.renderSequence>preceding.renderSequence&&draw.renderSequence<=current.renderSequence
        &&draw.jointPaintedAt>preceding.simulationTime&&draw.jointPaintedAt<=current.simulationTime;
      check(baseline||newPaint,'Ranger tail is neither exact start-frame baseline nor new paint after the preceding actual snapshot');
      check(draw.renderKind==='ranger'&&draw.assetReady===true&&draw.renderWidth>0&&draw.renderHeight>0,'Ranger draw identity or asset is unverified');
      check(draw.jointAtlasPath===V177_JOINT_ATLASES.ranger.path,'Ranger draw uses a different connected texture');
      check(Number.isSafeInteger(draw.renderSequence)&&draw.renderSequence>0,'Missing actual Ranger render sequence');
      check(Number.isFinite(draw.jointPaintedAt)&&draw.jointPaintedAt>=0&&draw.jointPaintedAt<=observed.simulationTime,'Missing original Ranger paint clock');
      check(draw.jointDrawSucceeded===true&&draw.jointWeightedLowerDrawSucceeded===true,'Ranger weighted lower was not actually painted');
      const lower=draw.jointWeightedLower;
      check(lower?.mode==='continuous-weighted-mesh'&&lower.parts===5&&lower.meshVertices===130&&lower.meshTriangles===192
        &&lower.coverageSamples===4&&lower.duplicateWithinPart===0&&lower.degenerate===0
        &&Number.isFinite(lower.phase)&&Number.isFinite(lower.settle)&&lower.settle>=0&&lower.settle<=1,'Missing or fallback Ranger weighted geometry');
      const previous=actors.get(actor.id);
      if(previous){
        check(draw.renderSequence>previous.lastSequence&&draw.jointPaintedAt>previous.lastPaintedAt,'Observed Ranger paint did not advance');
        previous.lastSequence=draw.renderSequence;previous.lastPaintedAt=draw.jointPaintedAt;previous.lastReadAt=observed.readAt;previous.observations++;
      }else actors.set(actor.id,{id:actor.id,kind:actor.kind,firstReadAt:observed.readAt,lastReadAt:observed.readAt,
        firstSequence:draw.renderSequence,lastSequence:draw.renderSequence,firstPaintedAt:draw.jointPaintedAt,lastPaintedAt:draw.jointPaintedAt,
        originalStats:Object.fromEntries(['maxHp','speed','laneSpeed','damage','range','attackEvery'].map(key=>[key,actor[key]])),observations:1});
      if(sampleBoundaryValid&&errors.length===actorErrorsBefore){if(baseline)baselineObservations++;else if(newPaint)newPaintObservations++;}
    }
    lastRenderBoundary=current;
  }
  const advancingActors=[...actors.values()].filter(actor=>actor.observations>=2&&actor.lastSequence>actor.firstSequence&&actor.lastPaintedAt>actor.firstPaintedAt);
  check(advancingActors.length>0,'No Ranger has advancing weighted draws inside the original window');
  return{schema:'v177-ranger-performance-receipts/v1',status:errors.length?'incomplete':'recorded',weightedPaintObserved:errors.length===0,
    startedAt,endedAt,sampleCount:Array.isArray(samples)?samples.length:0,observations,absenceSamples,baselineObservations,newPaintObservations,actors:[...actors.values()],errors,
    scope:'Actual unfiltered same-ID tails qualified by original start/preceding snapshot counter and clock; exact start-frame baselines are separate from new in-window paints. Genuine absence/new IDs and original raw object audits retained.',
    originalSpeedAccepted:false,naturalnessAccepted:false,physicalIphoneRecordingAccepted:false,wholeGameAccepted:false};
}
