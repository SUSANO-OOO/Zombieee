// Recorded preparation sounds use the existing activation receipt. Contact
// cues, character voices, cooldowns and mixer policy stay with their owners.
export const V100_MANUAL_ABILITY_FOLEY = Object.freeze({
  'ability-medic-emergency-activate': Object.freeze({name:'medic-preparation-r1',duration:.92}),
  'ability-guardian-shieldwall-activate': Object.freeze({name:'guardian-preparation-r1',duration:.98}),
});

export function withV100ManualAbilityFoley(manifest) {
  return {...manifest,assets:manifest.assets.map(asset=>{
    const recipe=Object.hasOwn(V100_MANUAL_ABILITY_FOLEY,asset.id)?V100_MANUAL_ABILITY_FOLEY[asset.id]:null;
    return recipe?{...asset,sources:['mp3','ogg'].map(ext=>({
      src:`/audio/quality-20261114/manual/${recipe.name}.${ext}`,
      type:ext==='mp3'?'audio/mpeg':'audio/ogg',
    }))}:asset;
  })};
}
