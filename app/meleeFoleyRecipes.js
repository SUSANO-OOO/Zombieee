// Distinct licensed foley performances. These recipes do not change contact
// timing, pitch, damage, voices, pool selection or mixer priorities.
export const MELEE_FOLEY_RECIPES = Object.freeze({
  'weapon-crowbar-01': {duration:.62,reference:'swing',layers:[['kenney-rpg/knifeSlice.ogg',1]]},
  'weapon-crowbar-02': {duration:.60,reference:'swing',layers:[['kenney-rpg/knifeSlice2.ogg',1]]},
  'weapon-unarmed-01': {duration:.36,reference:'body',layers:[['kenney-impact/impactSoft_heavy_000.ogg',1]]},
  'weapon-unarmed-02': {duration:.36,reference:'body',layers:[['kenney-rpg/dropLeather.ogg',.75],['kenney-impact/impactSoft_heavy_000.ogg',.25]]},
  'weapon-hammer-01': {duration:.50,reference:'heavy-metal',layers:[['kenney-impact/impactSoft_heavy_000.ogg',.8],['kenney-impact/impactMetal_heavy_000.ogg',.2]]},
  'weapon-hammer-02': {duration:.50,reference:'heavy-metal',layers:[['kenney-impact/impactWood_heavy_000.ogg',.8],['kenney-impact/impactMetal_light_000.ogg',.2]]},
});

export function withMeleeFoley(manifest) {
  return {...manifest,assets:manifest.assets.map(asset=>MELEE_FOLEY_RECIPES[asset.id]
    ? {...asset,sources:['mp3','ogg'].map(ext=>({src:`/audio/weapons/melee/${asset.id}.${ext}`,type:ext==='mp3'?'audio/mpeg':'audio/ogg'}))}
    : asset)};
}
