// Diagnostic observer only: read the actual queue every native animation frame.
// Record transitions and hits, without scheduling or manufacturing any attack.
export function installGuardianContactTrace(){
 const trace={events:[],frames:0},prior=new Map();window.__V100_GUARDIAN_TRACE__=trace;
 const observe=()=>{
  const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
  if(s?.running&&!s.over){
   trace.frames++;
   const contacts=s.v100MetalContacts??[];
   for(const g of s.fighters.filter(f=>f.kind==='guardian'&&f.side==='human')){
    const before=prior.get(g.id),key=g.manualAbility?.phase+':'+g.manualAbility?.activationId;
    if((!before||before.hp!==g.hp||before.key!==key||contacts.some(c=>c.ownerId===g.id))&&trace.events.length<1200){
     trace.events.push({time:s.time,pageSeconds:performance.now()/1000,guard:{id:g.id,x:g.x,y:g.y,hp:g.hp,phase:g.manualAbility?.phase,activation:g.manualAbility?.activationId,target:g.manualAbility?.target,animation:g.animationPresentation,render:g.renderAudit,flash:g.flash},contacts,nearby:s.fighters.filter(f=>f.side==='zombie'&&Math.hypot(f.x-g.x,f.y-g.y)<250).map(f=>({id:f.id,kind:f.kind,x:f.x,y:f.y,hp:f.hp,ability:f.stationAbility,attack:f.attack}))});
    }
    prior.set(g.id,{hp:g.hp,key});
   }
  }
  requestAnimationFrame(observe);
 };
 requestAnimationFrame(observe);
}
