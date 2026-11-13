// Recorded preparation sounds use the existing activation receipt. Contact
// cues, character voices, cooldowns and mixer policy stay with their owners.
import {createAudioManifest} from './audioManifest.js';

export const V100_MANUAL_ABILITY_FOLEY = Object.freeze({
  'ability-medic-emergency-activate': Object.freeze({name:'medic-preparation-r1',duration:.92,hash:'sha256-19911c289406438cf037472bdfba5fba16bafc8bbedefc289e53be37afb61005'}),
  'ability-guardian-shieldwall-activate': Object.freeze({name:'guardian-preparation-r1',duration:.98,hash:'sha256-b8f5af55fb5353e38869e3f4fe52ea5a6597649af405125aadb2d1ac861b9fea'}),
  "ability-scout-intercept-activate": Object.freeze({"name":"scout-preparation-r1","duration":0.18,"hash":"sha256-6abf856837022310f9cdc1df8298fabad05b37f933f49998ac571d6f385ee344"}),
  "ability-ranger-precision-activate": Object.freeze({"name":"ranger-preparation-r1","duration":0.44,"hash":"sha256-5dcd6eb079ab388286cf8f43f357f6da3da142ba5371dbdd60a6dbf18a1ac33d"}),
  "ability-brute-groundbreak-activate": Object.freeze({"name":"brute-preparation-r1","duration":0.48,"hash":"sha256-9aaaa252aa28f761b297ecd3b108b3cf43674190012d981207d72c1422e09676"}),
  "ability-kumaverson-iron-pan-activate": Object.freeze({"name":"kumaverson-preparation-r1","duration":0.3,"hash":"sha256-76a25f389994c099571792c70ad90c4666d3806e4a1ce5c0d3570a85dc429fa2"}),
  "ability-babayaga-appraise-activate": Object.freeze({"name":"babayaga-preparation-r1","duration":0.34,"hash":"sha256-177c53dc91b677d9c98205a36c94b7c9176edfe24dd18447f1c7a3d7bea69b14"}),
  "ability-gunner-suppression-activate": Object.freeze({"name":"gunner-preparation-r1","duration":0.12,"hash":"sha256-7afabb3abc70694fd86e076de50b9fc423627b3b060eb743e337e8b638f6fa33"}),
  "ability-engineer-trap-arm-activate": Object.freeze({"name":"engineer-preparation-r1","duration":0.3,"hash":"sha256-15671925af7621dbeac6554b172999321e1ba097ef48fb087d634291a5d6b57d"}),
  "ability-zakimiya-molotov-activate": Object.freeze({"name":"zakimiya-preparation-r1","duration":0.34,"hash":"sha256-6f995b23392d9f897ade216695c1ca49bc32433828795ed0838883f6895953c3"}),
  "ability-mrs-chiha-salvo-ready": Object.freeze({"name":"mrs-chiha-preparation-r1","duration":0.54,"hash":"sha256-d3118b23420eb79316c23456c4bc7de1817fe36ee214079559d8d84dc7d6e223"}),
  "ability-musashi-cross-guard": Object.freeze({"name":"miyamoto-musashi-preparation-r1","duration":0.16,"hash":"sha256-061dc1d8031b1a87156254e9691d3e3bd670e96964acde86888710f09353799c"}),
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
