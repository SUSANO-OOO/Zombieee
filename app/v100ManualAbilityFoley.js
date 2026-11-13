// Recorded preparation sounds use the existing activation receipt. Contact
// cues, character voices, cooldowns and mixer policy stay with their owners.
import {createAudioManifest} from './audioManifest.js';

export const V100_MANUAL_ABILITY_FOLEY = Object.freeze({
  'ability-medic-emergency-activate': Object.freeze({name:'medic-preparation-r1',duration:.92,hash:'sha256-19911c289406438cf037472bdfba5fba16bafc8bbedefc289e53be37afb61005'}),
  'ability-guardian-shieldwall-activate': Object.freeze({name:'guardian-preparation-r1',duration:.98,hash:'sha256-b8f5af55fb5353e38869e3f4fe52ea5a6597649af405125aadb2d1ac861b9fea'}),
});

export const V100_MANUAL_FOLEY_FILES=Object.freeze(Object.fromEntries(Object.entries(V100_MANUAL_ABILITY_FOLEY)
  .map(([id,recipe])=>[id,Object.freeze({path:`/audio/quality-20261114/manual/${recipe.name}.mp3`,hash:recipe.hash})])));

export function withV100ManualAbilityFoley(manifest) {
  return {...manifest,assets:manifest.assets.map(asset=>{
    const recipe=Object.hasOwn(V100_MANUAL_ABILITY_FOLEY,asset.id)?V100_MANUAL_ABILITY_FOLEY[asset.id]:null;
    return recipe?{...asset,sources:['mp3','ogg'].map(ext=>({
      src:`/audio/quality-20261114/manual/${recipe.name}.${ext}`,
      type:ext==='mp3'?'audio/mpeg':'audio/ogg',
    }))}:asset;
  })};
}

export function selectV100ManualFoleyPlayback(manifest,fallbackManifest,verifiedPaths='') {
  const allowed=new Set(verifiedPaths.split('\n').filter(Boolean));
  return createAudioManifest({...manifest,assets:manifest.assets.map(asset=>{
    const file=Object.hasOwn(V100_MANUAL_FOLEY_FILES,asset.id)?V100_MANUAL_FOLEY_FILES[asset.id]:null;
    if(!file)return asset;
    const fallback=fallbackManifest.assetById[asset.id]?.sources;
    if(!fallback?.length)throw new Error('Missing original manual preparation: '+asset.id);
    // The complete offline pack stores MPEG only. Never request a new Ogg
    // alternative that the installed generation has not accepted or saved.
    const preferred=asset.sources.find(source=>source.src===file.path&&source.type==='audio/mpeg');
    return {...asset,sources:allowed.has(file.path)&&preferred?[preferred,...fallback]:fallback};
  })});
}
