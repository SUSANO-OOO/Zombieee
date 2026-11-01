const available = unit => unit?.side === 'human' && unit.hp > 0 && unit.combatReady === true
  && !unit.gateEntering && !unit.contained && !(unit.stunned > 0);
const priority = unit => ['medic','engineer'].includes(unit.kind) ? 0 : unit.range > 64 ? 1 : 2;

export function deviceObjectiveDestination({unit,humans,node,maxX}) {
  const active=humans.filter(available).sort((a,b)=>priority(a)-priority(b)||Number(a.id)-Number(b.id));
  const operator=active[0];
  const guards=active.filter(f=>f.id!==operator?.id);
  const slot=Math.max(0,guards.findIndex(f=>f.id===unit.id));
  const operating=unit.id===operator?.id;
  const operatorX=Math.min(maxX,node.x-12);
  const frontX=node.x+96<=maxX?node.x+96:operatorX-36;
  return {x:operating?operatorX:frontX-Math.floor(slot/3)*36,
    lane:operating?node.lane:(node.lane+slot)%3,
    duty:operating?'device-operator':'device-screen',
    objectiveX:node.x,objectiveLane:node.lane,objectiveRadiusX:node.radiusX,solo:active.length===1};
}

export function deviceObjectiveMayEngage({destination,target,unit,leash}) {
  if(!target||!(target.hp>0)||target.contained)return false;
  if(Math.abs(target.x-destination.objectiveX)>leash)return false;
  if(destination.duty==='device-screen'||destination.solo)return true;
  // The operator may clear an intruder at the device; the screen handles
  // ranged enemies beyond the operating area and then regroups.
  return target.lane===destination.objectiveLane
    &&Math.abs(target.x-destination.objectiveX)<=destination.objectiveRadiusX+Math.min(24,unit.range);
}
