const eventName='nishijin:v100-interface-operation';
const roles=new Set(['advance','navigate','cancel','confirm','reject']);

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
