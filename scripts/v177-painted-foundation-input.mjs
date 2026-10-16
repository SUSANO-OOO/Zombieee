// Executes in the existing hosted page. Keep both actual paints and the
// original 30s-per-paint timeout, without repeatedly crossing the protocol
// just to read the same paused fighter. No gameplay or native UI input changes.
export async function sampleV177PaintedFoundationInput({fighterId,previous,action}) {
  const qa=globalThis.__ASHFALL_BATTLE_QA__;
  if(!qa||!Number.isFinite(fighterId)||!Number.isFinite(previous)||typeof action!=='string')
    throw new Error('Invalid painted foundation input');
  const waitForPaint=(sequence,requireReady)=>new Promise((resolve,reject)=>{
    let finished=false,frame=null;
    const cleanup=()=>{clearTimeout(timer);if(frame!==null)cancelAnimationFrame(frame);};
    const finish=(error,fighter)=>{
      if(finished)return;
      finished=true;cleanup();
      if(error)reject(error);else resolve(fighter);
    };
    const timer=setTimeout(()=>finish(new Error(`Paint timeout for ${fighterId}/${action}`)),30_000);
    const poll=()=>{
      if(finished)return;
      try{
        const fighter=qa.getSnapshot().fighters.find(f=>f.id===fighterId),render=fighter?.renderAudit;
        if(render?.renderSequence>sequence&&(!requireReady||render.assetReady))finish(null,fighter);
        else frame=requestAnimationFrame(poll);
      }catch(error){finish(error);}
    };
    poll();
  });
  const before=await waitForPaint(previous,true);
  // The old separate protocol read detached this snapshot before the input.
  // Retain that boundary even if the fixture reuses its render-audit object.
  const beforeRender=action.startsWith('hit-')?structuredClone(before.renderAudit):null;
  const sequence=before.renderAudit.renderSequence;
  qa.stepAnimationFoundationProof(fighterId,action,.06);
  const sample=await waitForPaint(sequence,false);
  return {sample,beforeRender};
}
