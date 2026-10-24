const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));

// A pursuit can start and stop between two actual paints. Keep its airborne
// pose visible before settling, using only the last successfully painted pose.
export function v177PaintLocomotion(runtime,previous,{time,x,held=false}={}) {
  const phase=Number(runtime?.locomotionPhase)||0,settle=clamp(runtime?.locomotionSettle??1);
  if(held&&previous)return [time,x].every(Number.isFinite)
    ? {phase,settle:previous.settle,time,x} : previous;
  if(![time,x].every(Number.isFinite))return {phase,settle};
  if(!previous||![previous.time,previous.x,previous.phase,previous.settle].every(Number.isFinite)
    ||time<previous.time)return {phase,settle,time,x};
  const dt=time-previous.time;
  if(dt===0&&x===previous.x&&phase===previous.phase)return previous;
  const travelled=Math.abs(phase-previous.phase)>1e-9;
  const paintedSettle=travelled?Math.max(0,previous.settle-dt/.12):Math.min(1,previous.settle+dt/.16);
  return {phase,settle:Math.min(settle,paintedSettle),time,x};
}
