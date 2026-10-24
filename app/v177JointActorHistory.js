const worlds=new WeakMap();
const bodyCorrections=new WeakMap();
const objectKey=value=>value&&typeof value==='object'?value:null;

function worldState(world) {
  // Audio generations change on result/resume while this battle and its
  // fighters still exist. Only a new world or removal retires these keys.
  let state=worlds.get(world);
  if(!state){state={actors:new Map()};worlds.set(world,state);}
  return state;
}

// Gameplay replaces Fighter objects when advancing area effects. A rendered
// pose belongs to that fighter's ID within this battle, not to one tick's copy.
// These keys live only in renderer WeakMaps; no Fighter/save fields are added.
export function v177JointActorKey(actor,world) {
  if(!objectKey(actor))return null;
  if(!objectKey(world)||!Number.isSafeInteger(actor.id))return actor;
  const state=worldState(world);
  let key=state.actors.get(actor.id);
  if(!key){key={};state.actors.set(actor.id,key);}
  return key;
}

// Hard collision corrections carry the existing body, rather than asking a
// planted leg to walk through that instantaneous displacement. The receipt
// survives Fighter copies and skipped paints, and retires with the world key.
export function recordV177JointBodyCorrection(actor,world,deltaX) {
  const key=v177JointActorKey(actor,world);
  if(key&&Number.isFinite(deltaX)&&deltaX!==0)
    bodyCorrections.set(key,(bodyCorrections.get(key)??0)+1);
}

export function v177JointBodyCorrection(actor,world) {
  const key=v177JointActorKey(actor,world);
  return key?bodyCorrections.get(key)??0:0;
}

export function pruneV177JointActorHistory(world) {
  if(!objectKey(world))return;
  const state=worlds.get(world);if(!state)return;
  const alive=new Set((world.fighters??[]).map(f=>f.id));
  for(const id of state.actors.keys())if(!alive.has(id))state.actors.delete(id);
}
