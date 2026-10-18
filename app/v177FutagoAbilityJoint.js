const finite = Number.isFinite;
const clamp = p => Math.max(0,Math.min(1,p));
const smooth = p => {p=clamp(p);return p*p*(3-2*p);};
const forms={a:'futago-separated-a',b:'futago-separated-b'};
const clips={warning:'wind-up',active:'active',recovery:'recovery'};
const periods={warning:'warningSeconds',active:'activeSeconds',recovery:'recoverySeconds'};

// A typed owner for the original formal S24 pair only. This helper observes
// the original station runtime and existing actually-painted joint history.
// It never advances an ability, resets gait, changes damage or creates VFX.
export function createV177FutagoAbilityJoint({normalPlan,capturePose,blendPose}) {
  function plan({kind,actor,atlas,runtime,previous,ownedPose,owner,tuning}) {
    const ability=actor?.stationAbility,part=actor?.v100TwinPart;
    if(!forms[part]||kind!==forms[part]||actor?.kind!=='futago'||actor.side!=='zombie'
      ||actor.v100BossId!=='boss-futago'||!Number.isSafeInteger(actor.v100TwinPair)||actor.v100TwinPair<0
      ||!(actor.hp>0)||actor.combatReady===false||actor.contained||actor.gateEntering
      ||ownedPose!==true||owner!==true||ability?.kind!=='futago'||!clips[ability.phase]
      ||actor.abilityWindup!==0||atlas?.type!=='rigid-parts'
      ||!finite(runtime?.locomotionPhase)||!finite(runtime?.locomotionSettle)
      ||!Number.isSafeInteger(actor.attackSequence)||actor.attackSequence<0)return null;
    const duration=tuning?.[periods[ability.phase]],remaining=ability.remainingSeconds;
    if(!finite(duration)||duration<=0||!finite(remaining)||remaining<0||remaining>duration+1e-8)return null;
    const elapsed=duration-remaining,progress=clamp(elapsed/duration);
    const target=normalPlan(kind,{requestedState:clips[ability.phase],clipProgress:progress},runtime);
    if(!target)return null;
    const old=previous?.kind===kind?previous.plan:null,oldMarker=old?.futagoAbilityJoint;
    let entry=oldMarker?.part===part&&oldMarker.pairId===actor.v100TwinPair
      &&(ability.phase==='warning'?oldMarker.sequence===actor.attackSequence:oldMarker.sequence+1===actor.attackSequence)
      ? oldMarker.entry:null;
    let captured=null;
    if(ability.phase==='warning') {
      if(entry&&elapsed+1e-9<entry.elapsed)entry=null;
      if(!entry&&old&&elapsed<duration)entry={elapsed,pose:capturePose(atlas,old)};
      if(entry) {
        const p=smooth((elapsed-entry.elapsed)/(duration-entry.elapsed));
        captured=blendPose(atlas,entry.pose,capturePose(atlas,target),p);
      }
    }
    if(ability.phase==='recovery') {
      // The source attack-end arms differ from the current locomotion row.
      // Return within the original recovery clock to the current live gait,
      // using the same source pivots and fixed-length two-arm/two-leg solve.
      const neutral=normalPlan(kind,{requestedState:'idle'},runtime);
      if(!neutral)return null;
      captured=blendPose(atlas,capturePose(atlas,target),capturePose(atlas,neutral),smooth(progress));
    }
    return {...target,...(captured?{resolvedJointPose:captured}:{}),
      futagoAbilityJoint:{part,pairId:actor.v100TwinPair,sequence:ability.phase==='warning'?actor.attackSequence:actor.attackSequence-1,
        phase:ability.phase,elapsed,duration,remaining,entry,entryPaintBound:Boolean(entry)}};
  }
  return {plan};
}
