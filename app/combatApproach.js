// Quicker traversal on clear ground, easing to the original combat speed.
// Both sides retain their relative speeds, slows, attack timers and stop rules.
export function combatApproachSpeed(speed,distance){
  if(!(speed>0)||!Number.isFinite(distance))return Math.max(0,Number(speed)||0);
  const t=Math.max(0,Math.min(1,(Math.abs(distance)-36)/144));
  return speed*(1+1.5*t*t*(3-2*t));
}
