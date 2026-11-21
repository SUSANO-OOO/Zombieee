const clamp=p=>Math.max(0,Math.min(1,Number(p)||0));
const sample=(base,state,p,style)=>({...base,requestedState:state,clipProgress:clamp(p),
  movement:false,abilityPresentation:style});

const manualPresentation = {
  scout: 'scout-intercept', guardian: 'guard', kumaverson: 'guard',
  brawler: 'fist-wave', brute: 'ground-slam', 'crazy-king': 'chainsaw-rev',
  medic: 'support-manual', engineer: 'support-manual', 'mrs-chiha': 'launcher-salvo',
  babayaga: 'weak-point-assessment', gunner: 'suppression-burst', tky: 'lightblade-release',
  zakimiya: 'fire-whisky-throw', 'mayo-chan': 'mayo-transform',
};

export function v105AbilityFacing(owner){
  const ability=owner?.stationAbility;
  if(!ability||ability.phase==='idle')return null;
  if(owner.kind==='sprinter')return 'left';
  if(['grappler','gate-eater'].includes(owner.kind)&&Number.isFinite(ability.direction)&&ability.direction!==0)
    return ability.direction<0?'left':'right';
  return null;
}

// Ability clocks select motion on the same current atlas as normal combat.
// A legacy whole-body ability cell never owns the actor's person/clothes.
export function v105CurrentAbilitySample(owner,base,{manualDefinition,anomaly,kurome,infected,takuyaWarning,takuyaReturn,station}={}){
  if(!owner||!(owner.hp>0)||!owner.combatReady)return null;
  const m=owner.manualAbility;
  if(owner.stunned>0&&(['windup','recovery','salvo','guard','active','feral'].includes(m?.phase)
    ||owner.stationAbility?.phase&&owner.stationAbility.phase!=='idle'||owner.abilityWindup>0))
    return sample(base,'incapacitated',0,'ability-interrupted');
  if(owner.side==='human'&&manualDefinition&&['windup','recovery','salvo','guard','active','feral'].includes(m?.phase)){
    // Defensive/buff active time permits normal walking and attacks. Only an
    // actual stationary guard gets a braced pose; its limbs remain animated.
    if(['active','feral'].includes(m.phase)){
      if(owner.kind==='crazy-king'&&m.phase==='active'&&['wind-up','active','recovery'].includes(base.requestedState)){
        return {...base,abilityPresentation:'chainsaw-overdrive'};
      }
      if(!['guardian','kumaverson'].includes(owner.kind)||owner.animationPresentation?.moving||owner.attack>0||owner.attackWindup>0)return null;
      return sample(base,'active',.2+.02*Math.sin((m.abilityElapsed??0)*5),'guard');
    }
    const style=owner.kind==='miyamoto-musashi'&&m.phase==='windup'
      ? 'cross-guard' : manualPresentation[owner.kind] ?? 'manual';
    if(owner.kind==='gunner'&&m.phase==='windup'){
      const elapsed=m.abilityElapsed??manualDefinition.windupSeconds-m.windupRemaining;
      if(elapsed<manualDefinition.aimSeconds)return sample(base,'wind-up',elapsed/manualDefinition.aimSeconds,style);
      const index=Math.min(manualDefinition.burstCount-1,Math.floor((elapsed-manualDefinition.aimSeconds)/manualDefinition.burstIntervalSeconds));
      const since=elapsed-manualDefinition.aimSeconds-index*manualDefinition.burstIntervalSeconds;
      return sample(base,'active',since/manualDefinition.burstIntervalSeconds,style);
    }
    if(owner.kind==='zakimiya'&&m.phase==='windup'){
      const elapsed=m.abilityElapsed??manualDefinition.windupSeconds-m.windupRemaining,releaseAt=manualDefinition.throwReleaseSeconds;
      return elapsed<releaseAt?sample(base,'wind-up',elapsed/releaseAt,style)
        :sample(base,'active',(elapsed-releaseAt)/(manualDefinition.windupSeconds-releaseAt),style);
    }
    if(m.phase==='windup')return sample(base,'wind-up',(manualDefinition.windupSeconds-m.windupRemaining)/manualDefinition.windupSeconds,style);
    if(m.phase==='guard')return sample(base,'active',.25,'cross-guard');
    if(m.phase==='salvo'){
      const interval=manualDefinition.salvoIntervalSeconds??.12,elapsed=(m.abilityElapsed??0)-manualDefinition.windupSeconds;
      if(style==='launcher-salvo'){
        const lastLaunch=Math.max(0,(m.salvoIndex??1)-1)*interval;
        return sample(base,'active',(elapsed-lastLaunch)/interval,style);
      }
      return sample(base,'active',.12+.4*clamp((elapsed%interval)/Math.min(.08,interval)),style);
    }
    const elapsed=manualDefinition.recoverySeconds-m.windupRemaining;
    if(owner.kind==='miyamoto-musashi')return sample(base,'recovery',elapsed/manualDefinition.recoverySeconds,'cross-counter');
    if(['gunner','zakimiya','mrs-chiha','mayo-chan'].includes(owner.kind))
      return sample(base,'recovery',elapsed/manualDefinition.recoverySeconds,style);
    const release=Math.min(.065,manualDefinition.recoverySeconds*.4);
    return elapsed<release?sample(base,'active',elapsed/release,style)
      :sample(base,'recovery',(elapsed-release)/Math.max(.001,manualDefinition.recoverySeconds-release),style);
  }
  if(owner.kind==='takuya'&&(owner.abilityWindup>0||owner.takuyaSlamPresentationRemaining>0)){
    if(owner.abilityWindup>0)return sample(base,'wind-up',1-owner.abilityWindup/takuyaWarning,'slam');
    const elapsed=takuyaReturn-owner.takuyaSlamPresentationRemaining,strike=.14;
    return elapsed<strike?sample(base,'active',elapsed/strike,'slam')
      :sample(base,'recovery',(elapsed-strike)/Math.max(.001,takuyaReturn-strike),'slam');
  }
  const a=owner.stationAbility,phase=a?.phase;
  if(!a||phase==='idle'||!Number.isFinite(a.remainingSeconds))return null;
  let state,duration;
  if(anomaly||infected){
    const tuning=anomaly??infected;
    state={warning:'wind-up',active:'active',recovery:'recovery'}[phase];
    duration=tuning[{warning:'warningSeconds',active:'activeSeconds',recovery:'recoverySeconds'}[phase]];
  }else if(owner.kind==='kurome'){
    state={tracking:'wind-up',locked:'wind-up',firing:'active',recovery:'recovery'}[phase];
    duration=kurome?.[{tracking:'warningSeconds',locked:'warningSeconds',firing:'fireSeconds',recovery:'recoverySeconds'}[phase]];
  }else if(owner.kind==='sprinter'){
    if(phase==='burst')return sample(base,'move',owner.animationPresentation?.locomotionPhase??0,'burst');
    state=phase==='telegraph'?'wind-up':'recovery';duration=phase==='telegraph'?station.souki.telegraphSeconds:station.souki.recoverySeconds;
  }else if(owner.kind==='grappler'){
    state=phase==='windup'?'wind-up':'active';duration=phase==='windup'?station.karamite.windupSeconds:station.karamite.holdSeconds;
  }else if(owner.kind==='ooze'){
    state=phase==='windup'?'wind-up':'active';duration=station.leakMud.windupSeconds;
  }else if(owner.kind==='gate-eater'){
    state=phase==='windup'?'wind-up':phase==='exposed'?'recovery':'active';
    duration=phase==='windup'?station.ticketGateEater.windupSeconds:phase==='exposed'?station.ticketGateEater.flankExposureSeconds:station.ticketGateEater.chargeSeconds;
  }
  if(!state||!(duration>0))return null;
  return sample(base,state,1-a.remainingSeconds/duration,owner.kind==='grappler'?'bind':'enemy-ability');
}
