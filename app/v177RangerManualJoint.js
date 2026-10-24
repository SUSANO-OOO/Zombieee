const finite = Number.isFinite;
const clamp = t => Math.max(0,Math.min(1,t));
const smooth = t => {t=clamp(t);return t*t*(3-2*t);};
const cycle = t => ((t%1)+1)%1;
const copyUpper = pose => Object.fromEntries(Object.entries(pose).map(([bone,m])=>[bone,[...m]]));
const finiteUpper = pose => pose && Object.values(pose).every(m=>m?.length===6&&m.every(finite));

// Only original Ranger precision-shot. The original manual owner, gameplay
// clocks, activation/impact, targets, audio and saves remain outside this helper.
// Entry data is carried on the plan only; the existing actual-draw history is
// the sole publisher. An unpainted plan cannot become the next entry source.
export function createV177RangerManualJoint({normalPlan,captureUpper,blendUpper}) {
  function plan({kind,actor,atlas,runtime,previous,ownedPose,owner,definition}) {
    const m=actor?.manualAbility;
    if(kind!=='ranger'||actor?.kind!=='ranger'||actor.side!=='human'||!(actor.hp>0)
      ||ownedPose!==true||owner!==true||actor.stationAbility?.phase!=='idle'
      ||m?.kind!=='ranger'||!['windup','recovery'].includes(m.phase)
      ||!Number.isSafeInteger(m.activationId)||m.activationId<=0||!m.target
      ||!finite(m.target.direction)||m.target.direction===0
      ||definition?.runtimeStatus!=='integrated'||definition.windupSeconds!==.5||definition.recoverySeconds!==.18
      ||!atlas?.upperRig||!atlas.lowerRig||!finite(runtime?.locomotionPhase)||!finite(runtime?.locomotionSettle)
      ||previous?.kind!=='ranger'||!previous.plan?.upperRigPlan
      ||previous.lowerReceipt?.mode!=='continuous-weighted-mesh')return null;
    const windup=definition.windupSeconds,recovery=definition.recoverySeconds;
    if(!finite(m.abilityElapsed)||!finite(m.windupRemaining)||m.windupRemaining<0)return null;
    const elapsed=m.phase==='windup'?windup-m.windupRemaining:m.abilityElapsed;
    if(!finite(elapsed)||elapsed<0||elapsed>windup+recovery+1e-8
      ||Math.abs(m.abilityElapsed-elapsed)>1e-7
      ||m.phase==='windup'&&(elapsed>windup||m.windupRemaining>windup)
      ||m.phase==='recovery'&&(elapsed<windup||Math.abs(m.windupRemaining-(windup+recovery-elapsed))>1e-7))return null;
    let entry=previous.plan.rangerManualJoint?.activationId===m.activationId
      ? previous.plan.rangerManualJoint.entry : null;
    if(!entry) {
      // A first paint after the real shot cannot synthesize the missed windup.
      if(m.phase!=='windup'||elapsed>=windup)return null;
      const upper=captureUpper(atlas,previous.plan);
      if(!finiteUpper(upper))return null;
      const phase=previous.plan.phase,settle=previous.plan.lowerSettle;
      if(!finite(phase)||!finite(settle)||!finite(previous.plan.upperOffsetY))return null;
      const current=cycle(runtime.locomotionPhase),delta=((current-phase+.5)%1+1)%1-.5;
      entry={elapsed,upper,phase,rawPhase:runtime.locomotionPhase-delta,settle,
        upperOffsetY:previous.plan.upperOffsetY,lowerIndex:previous.plan.lowerIndex};
    }
    if(elapsed+1e-9<entry.elapsed)return null;
    const aimP=smooth((elapsed-entry.elapsed)/(windup-entry.elapsed));
    const phase=elapsed===entry.elapsed?entry.phase:cycle(entry.rawPhase+(runtime.locomotionPhase-entry.rawPhase)*aimP);
    const settle=elapsed===entry.elapsed?entry.settle:entry.settle+(clamp(runtime.locomotionSettle)-entry.settle)*aimP;
    const gait={...runtime,locomotionPhase:phase,locomotionSettle:settle};
    const neutral=normalPlan({requestedState:'idle'},gait);
    if(!neutral?.upperRigPlan)return null;
    let upper,presentationPhase,attackPhase;
    if(m.phase==='windup') {
      const aiming=normalPlan({requestedState:'wind-up',clipProgress:1},gait);
      upper=aimP===0?copyUpper(entry.upper):blendUpper(atlas,entry.upper,captureUpper(atlas,aiming),aimP);
      attackPhase=aiming.attackPhase*aimP;presentationPhase='aim';
    }else {
      // Keep the original .18s recovery. Give the actual recoil half of it:
      // a real 66.7ms paint interval otherwise skipped the whole impulse.
      const afterShot=elapsed-windup,recoilSeconds=recovery/2;
      if(afterShot<=recoilSeconds) {
        const recoil=normalPlan({requestedState:'active',clipProgress:clamp(afterShot/recoilSeconds)},gait);
        upper=captureUpper(atlas,recoil);attackPhase=recoil.attackPhase;presentationPhase='recoil';
      }else {
        const released=normalPlan({requestedState:'active',clipProgress:1},gait),p=smooth((afterShot-recoilSeconds)/(recovery-recoilSeconds));
        upper=blendUpper(atlas,captureUpper(atlas,released),captureUpper(atlas,neutral),p);
        attackPhase=released.attackPhase+(1-released.attackPhase)*p;presentationPhase='return';
      }
    }
    if(!finiteUpper(upper))return null;
    return {...neutral,phase,lowerSettle:settle,
      lowerIndex:elapsed===entry.elapsed?entry.lowerIndex:neutral.lowerIndex,
      upperOffsetY:elapsed===entry.elapsed?entry.upperOffsetY:neutral.upperOffsetY,
      attackPhase,rangerManualUpperPose:upper,
      rangerManualJoint:{activationId:m.activationId,entry,clockElapsed:elapsed,presentationPhase}};
  }
  return {plan};
}
