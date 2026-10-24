// Keep the original 30 observations and 120ms waits inside the browser task.
// Transport between observations must not consume the real 6.2s feral window.
export async function collectV177MayoNativeSamples({owner,fighterId}) {
  const key='__V177_MAYO_NATIVE_SAMPLES__';
  if(typeof owner!=='string'||!owner||!Number.isSafeInteger(fighterId)||fighterId<=0)throw new Error('Mayo sample owner required');
  if(globalThis[key])throw new Error('Mayo sample collection already owned');
  const state={owner,fighterId,sampleCount:30,spacingMs:120,samples:[],startedAt:performance.now(),
    finishedAt:null,status:'collecting',error:null,cancelled:false,cancelWait:null};
  globalThis[key]=state;
  try{
    for(let i=0;i<state.sampleCount;i++){
      if(state.cancelled)throw new Error('Mayo sample collection cancelled');
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{state.cancelWait=null;resolve();},state.spacingMs);
        state.cancelWait=()=>{clearTimeout(timer);state.cancelWait=null;reject(new Error('Mayo sample collection cancelled'));};
      });
      if(state.cancelled)throw new Error('Mayo sample collection cancelled');
      const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa.getSnapshot(),audit=qa.getEnemyFacingRuntimeAudit(fighterId);
      const sample={at:performance.now(),simulationTime:snapshot.time,running:snapshot.running,paused:snapshot.paused,
        route:location.pathname,visible:document.visibilityState==='visible',fighter:audit.fighter,
        renders:audit.renderHistory.map(r=>({renderSequence:r.renderSequence,renderKind:r.renderKind,assetReady:r.assetReady,
          x:r.x,y:r.y,renderWidth:r.renderWidth,renderHeight:r.renderHeight,poseScaleX:r.poseScaleX,poseScaleY:r.poseScaleY,
          requestedState:r.requestedState,actualXDelta:r.actualXDelta,jointAtlasPath:r.jointAtlasPath,
          jointLowerFrame:r.jointLowerFrame,jointWeightedLowerDrawSucceeded:r.jointWeightedLowerDrawSucceeded,
          jointWeightedLower:r.jointWeightedLower,jointUpperFrame:r.jointUpperFrame,renderedWeaponSocket:r.renderedWeaponSocket}))};
      // Each original evaluate serialized immediately. Retain that same value
      // boundary even if a later draw mutates a nested audit object.
      state.samples.push(structuredClone(sample));
    }
    state.status='completed';
  }catch(error){state.status='failed';state.error=String(error);}
  finally{state.finishedAt=performance.now();}
  return {owner:state.owner,status:state.status,count:state.samples.length,startedAt:state.startedAt,
    finishedAt:state.finishedAt,error:state.error,sampleCount:state.sampleCount,spacingMs:state.spacingMs};
}

// Read once after completion, or retain partial observations after a failed
// protocol call. Cancelling this owner never touches gameplay or its clock.
export function takeV177MayoNativeSamples({owner}) {
  const key='__V177_MAYO_NATIVE_SAMPLES__',state=globalThis[key];
  if(!state)return null;
  if(state.owner!==owner)throw new Error('Mayo sample collection belongs to another owner');
  if(state.status==='collecting'){state.cancelled=true;state.cancelWait?.();}
  delete globalThis[key];
  return {owner:state.owner,fighterId:state.fighterId,status:state.status,samples:state.samples,
    startedAt:state.startedAt,finishedAt:state.finishedAt,error:state.error,
    sampleCount:state.sampleCount,spacingMs:state.spacingMs,cancelled:state.cancelled};
}
