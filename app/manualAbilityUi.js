export const MANUAL_ABILITY_SYMBOL_DICTIONARY = Object.freeze({
  ready: "発動可能",
  awaitingTarget: "対象待ち",
  targeting: "対象を選択",
  cooldown: "再準備中",
  active: "効果発生",
  legend: "ユニット名の能力名をタップして発動",
});

export function manualAbilityVisibleStateFor({ available = false, targeting = false } = {}) {
  if (targeting) return MANUAL_ABILITY_SYMBOL_DICTIONARY.targeting;
  return available ? MANUAL_ABILITY_SYMBOL_DICTIONARY.ready : MANUAL_ABILITY_SYMBOL_DICTIONARY.awaitingTarget;
}

// A HUD snapshot may catch up while a pointer is already over its button.
// Preserve the displayed hit box for this interaction, owned by this battle
// and fighter. Movement resumes on leave/up/cancel/blur or lost availability.
export function createManualAbilityPointerHold(){
 const worlds=new WeakMap();
 const entries=world=>{let m=worlds.get(world);if(!m){m=new Map();worlds.set(world,m);}return m;};
 return{
  hold(world,icon,position){
   if(!world||!icon.available||![position.x,position.y].every(Number.isFinite))return;
   const m=entries(world);if(!m.has(icon.fighterId))m.set(icon.fighterId,{kind:icon.kind,...position});
  },
  position(world,icon,enabled=true){
   const m=entries(world),held=m.get(icon.fighterId);
   if(!enabled||!icon.available||held?.kind!==icon.kind){m.delete(icon.fighterId);return icon;}
   return held;
  },
  release(world,id){worlds.get(world)?.delete(id);},
  clear(world){worlds.get(world)?.clear();},
 };
}
