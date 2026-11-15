const eventName='nishijin:v100-interface-operation';
const roles=new Set(['advance','navigate','cancel','confirm','reject']);

// Labels dispatch a second click to their input. Resolve only the input itself,
// so one touch never plays both a label sound and a control sound.
export function v100InterfaceControlFor(event) {
  if(event?.defaultPrevented)return null;
  const control=event?.target?.closest?.('button,input,select,summary,a[href]');
  if(!control||control.disabled||control.matches?.(':disabled')||control.type==='hidden'
    ||control.getAttribute?.('aria-disabled')==='true')return null;
  if(event.type==='click'&&(control.type==='range'||control.tagName==='SELECT'))return null;
  const role=control.dataset?.uiSound??(control.tagName==='SUMMARY'&&control.parentElement?.open
    ?'cancel':control.closest?.('.v100-event-actions')?'advance':'navigate');
  return {control,role};
}

// A PWA-owned portal cannot bubble through the campaign's React capture.
// Dispatch synchronously inside the gesture; only an existing owner listens.
export function emitV100InterfaceOperation(target,role) {
  if(!roles.has(role)||typeof target?.dispatchEvent!=='function')return false;
  const EventType=target.CustomEvent??globalThis.CustomEvent;
  if(typeof EventType!=='function')return false;
  target.dispatchEvent(new EventType(eventName,{detail:{role}}));return true;
}
export function subscribeV100InterfaceOperations(target,operation) {
  if(typeof target?.addEventListener!=='function')return ()=>{};
  const listener=event=>{
    const role=event.detail?.role;if(!roles.has(role))return;
    try { void Promise.resolve(operation(role)).catch(()=>{}); } catch { /* Optional feedback cannot block an action. */ }
  };
  target.addEventListener(eventName,listener);
  return ()=>target.removeEventListener(eventName,listener);
}
export function emitV100PwaControlSound(event,target) {
  if(event.defaultPrevented)return false;
  const control=event.target?.closest?.('button,summary,a[href]');
  if(!control||control.disabled||control.getAttribute('aria-disabled')==='true')return false;
  const role=control.dataset.uiSound??'navigate';
  return emitV100InterfaceOperation(target,role==='transaction'?'navigate':role);
}
