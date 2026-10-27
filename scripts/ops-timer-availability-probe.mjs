// Diagnostic observations only. Never supplies a game, RAF or media timestamp.
export function startAvailabilityProbe(enabled){
  if(typeof enabled!=='boolean'||window.__OPS_TIMER_AVAILABILITY__)throw Error('Invalid or duplicate timer probe');
  const state={enabled,rows:[],overflow:false,timer:null,startedAt:performance.now()};
  if(enabled)state.timer=setInterval(()=>{
    if(state.rows.length>=4096){state.overflow=true;clearInterval(state.timer);return;}
    state.rows.push(performance.now());
  },16);
  window.__OPS_TIMER_AVAILABILITY__=state;
  return {enabled,startedAt:state.startedAt,intervalMs:enabled?16:null};
}
export function stopAvailabilityProbe(){
  const state=window.__OPS_TIMER_AVAILABILITY__;if(!state)throw Error('Missing timer probe');
  if(state.timer!==null)clearInterval(state.timer);
  delete window.__OPS_TIMER_AVAILABILITY__;
  const result={...state,stoppedAt:performance.now()};delete result.timer;return result;
}
