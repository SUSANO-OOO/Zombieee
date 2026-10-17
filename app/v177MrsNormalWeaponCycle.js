// Source-bound handling inside the real normal-shot recovery clock.
// This is launcher handling with the original one-piece weapon-and-hands paint.
// It neither animates an independent cylinder nor releases a hand from the gun.
export function createV177MrsNormalWeaponCycle({
  animationClipFor, attackPresentationDuration, captureStatusJoints, jointMatrix,
}) {
  const clamp = p => Math.max(0,Math.min(1,Number(p)||0));
  const point = (m,p) => [m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const around = ([x,y],angle,dx=0,dy=0) => {
    const c=Math.cos(angle),s=Math.sin(angle);
    return [c,s,-s,c,x+dx-c*x+s*y,y+dy-s*x-c*y];
  };
  function sample(kind,original,actor,{enabled=false,ownedPose=false,manualAbilityActive=false}={}) {
    if(!enabled||ownedPose||manualAbilityActive||kind!=='mrs-chiha'||actor?.kind!==kind
      ||actor.side!=='human'||!(actor.hp>0)||!(actor.attack>0)
      ||actor.attackVariant||actor.attackWindup>0||actor.abilityWindup>0
      ||actor.flash>0||actor.stunned>0||actor.contained||actor.gateEntering||actor.combatReady===false
      ||(actor.stationAbility?.phase??'idle')!=='idle'
      ||['windup','salvo','guard','recovery'].includes(actor.manualAbility?.phase)
      ||original?.requestedState!=='recovery')return original;
    const active=animationClipFor(kind,'active').durationSeconds;
    const duration=animationClipFor(kind,'recovery').durationSeconds;
    const elapsed=attackPresentationDuration(kind)-actor.attack-active;
    if(!Number.isFinite(elapsed)||elapsed<0||elapsed>duration+1e-10)return original;
    // Retain the real .22s sample, original events and timer. Do not sample the
    // separate unconnected .36s clip or introduce cylinder/audio events.
    return {...original,state:'weapon-cycle',requestedState:'weapon-cycle',
      resolvedState:'weapon-cycle',mrsNormalWeaponCycle:true,
      weaponCycleClockElapsed:elapsed,weaponCycleClockDuration:duration};
  }
  function plan(kind,sampled,original,atlas) {
    if(kind!=='mrs-chiha'||!sampled?.mrsNormalWeaponCycle||!original
      ||atlas?.type!=='rigid-parts'||atlas.weaponBone!=='weapon-0'
      ||atlas.armConstraints?.length!==2)return original;
    const p=clamp(sampled.clipProgress);
    // Exact original endpoint commands, including the final sample clamp.
    if(p<=0||p>=1-1e-12)return original;
    const captured=captureStatusJoints(atlas,original);
    const baselineSpine=captured.upper.spine,baselineHead=captured.upper.head,
      baselineWeapon=captured.upper[atlas.weaponBone];
    const bump=Math.sin(Math.PI*p)**2;
    const waist=point(baselineSpine,atlas.interpolationPivots.spine);
    const reachMargin=upper=>Math.min(...atlas.armConstraints.map(chain=>{
      const shoulder=point(upper[chain.parentBone],chain.shoulder);
      const wrist=point(upper[chain.effectorBone],chain.effectorWrist??chain.wrist);
      const d=Math.hypot(wrist[0]-shoulder[0],wrist[1]-shoulder[1]);
      const a=Math.hypot(chain.elbow[0]-chain.shoulder[0],chain.elbow[1]-chain.shoulder[1]);
      const b=Math.hypot(chain.wrist[0]-chain.elbow[0],chain.wrist[1]-chain.elbow[1]);
      return Math.min(a+b-d,d-Math.abs(a-b));
    }));
    const apply=amplitude=>{
      const lean=around(waist,-.006*bump*amplitude);
      captured.upper.spine=multiply(lean,baselineSpine);
      captured.upper.head=multiply(lean,baselineHead);
      const carried=multiply(lean,baselineWeapon);
      const grip=point(carried,atlas.interpolationPivots[atlas.weaponBone]);
      const handle=around(grip,.045*bump*amplitude,-2*bump*amplitude,
        1.5*Math.sin(2*Math.PI*p)*bump*amplitude);
      captured.upper[atlas.weaponBone]=multiply(handle,carried);
      return reachMargin(captured.upper);
    };
    if(reachMargin(captured.upper)<.001)return original;
    let amplitude=1;
    if(apply(amplitude)<.001){
      let lo=0,hi=1;
      for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(apply(mid)>=.001)lo=mid;else hi=mid;}
      amplitude=lo;apply(amplitude);
    }
    // Solve the original arm anatomy against the transformed spine and the
    // same weapon-hand wrist targets. Captured matrices already include the
    // original upper offset; this temporary plan must not add it twice.
    const rig={...atlas,poses:[captured.lower,captured.upper]};
    const selector={lowerIndex:0,lowerNextIndex:0,lowerBlend:0,
      upperIndex:1,upperNextIndex:1,upperBlend:0,attackPhase:null,upperOffsetY:0};
    const matrix=new Float64Array(6),scratch=[new Float64Array(6),new Float64Array(6)];
    for(const chain of atlas.armConstraints)for(const bone of [chain.upperBone,chain.lowerBone]){
      jointMatrix(matrix,rig,selector,bone,true,scratch);
      captured.upper[bone]=[...matrix];
    }
    return {...original,resolvedJointPose:captured,mrsNormalWeaponCycle:true,
      weaponCycleProgress:p,weaponCycleAmplitude:amplitude,
      weaponCycleClockElapsed:sampled.weaponCycleClockElapsed,weaponCycleClockDuration:sampled.weaponCycleClockDuration,
      weaponCycleReachMargin:reachMargin(captured.upper)};
  }
  return {sample,plan};
}
