export const V100_BRAWLER_HIT_INTERVAL=.095;
export function v100BrawlerCanAct(owner){
 return owner?.side==='human'&&owner.hp>0&&owner.combatReady===true&&!owner.contained&&!(owner.stunned>0);
}
export function v100BrawlerCanContact(owner,target){
 if(!v100BrawlerCanAct(owner)||target?.side!=='zombie'||!(target.hp>0)||target.combatReady!==true||target.contained||target.targetable===false)return false;
 const direction=Number(owner.manualAbility?.target?.direction)||1;
 return (target.x-owner.x)*direction>=0&&Math.hypot(target.x-owner.x,(target.y-owner.y)*1.25)<=(Number(target.bodyRadius)||0)+34;
}
export function v100BrawlerComboTiming(definition){
 const contacts=Array.from({length:definition.hitCount},(_,index)=>definition.windupSeconds+index*V100_BRAWLER_HIT_INTERVAL);
 return {contacts,lastContact:contacts.at(-1),recoveryEnd:contacts.at(-1)+definition.recoverySeconds};
}
export function advanceV100BrawlerCombo(runtime,seconds,definition){
 if(runtime.phase==='cooldown'){
  const remaining=Math.max(0,runtime.cooldownRemaining-seconds);
  return {runtime:{...runtime,phase:remaining?'cooldown':'ready',cooldownRemaining:remaining,abilityElapsed:remaining?runtime.abilityElapsed:0},events:[]};
 }
 if(!['windup','salvo','recovery'].includes(runtime.phase))return {runtime,events:[]};
 const timing=v100BrawlerComboTiming(definition),previous=runtime.abilityElapsed??0,next=previous+seconds;
 const events=timing.contacts.flatMap((at,index)=>at>previous+1e-9&&at<=next+1e-9?[{type:'impact',kind:'brawler',activationId:runtime.activationId,salvoIndex:index,finalRound:index===definition.hitCount-1,timelineAt:at,target:runtime.target}]:[]);
 const phase=next<definition.windupSeconds-1e-9?'windup':next<timing.lastContact-1e-9?'salvo':next<timing.recoveryEnd-1e-9?'recovery':'cooldown';
 const remaining=phase==='cooldown'?Math.max(0,definition.cooldownSeconds-(next-timing.recoveryEnd)):0;
 return {runtime:{...runtime,phase:phase==='cooldown'&&!remaining?'ready':phase,abilityElapsed:phase==='cooldown'?(remaining?timing.recoveryEnd:0):next,windupRemaining:phase==='windup'?definition.windupSeconds-next:phase==='recovery'?timing.recoveryEnd-next:0,cooldownRemaining:remaining,target:phase==='cooldown'?null:runtime.target},events};
}
// Reuse intact authored poses at the real contact cadence. This does not claim
// additional authored motion frames; replacement pose artwork is a separate task.
export function v100BrawlerComboPose(runtime,definition){
 const time=runtime.abilityElapsed??0,timing=v100BrawlerComboTiming(definition);
 if(time<definition.windupSeconds)return 'attack-a';
 if(time>=timing.lastContact+.05)return runtime.phase==='recovery'?'attack-a':'idle';
 const local=(time-definition.windupSeconds)%V100_BRAWLER_HIT_INTERVAL;
 return local<.05?'attack-b':'attack-a';
}
