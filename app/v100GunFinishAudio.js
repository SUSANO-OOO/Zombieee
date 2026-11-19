import {createAudioManifest} from './audioManifest.js';
const gunIds=Object.freeze(['v104-handgun','weapon-rifle-01','weapon-rifle-02','weapon-gunner-01','weapon-gunner-02','weapon-smg-01','weapon-smg-02','weapon-suppressed-pistol']);
// Keep install hashes in the install-only leaf, as with manual/boss audio.
// Sharing that leaf with productionAudio pulls the entire mixer into PwaGate
// after code splitting, before the campaign's visual data is initialized.
const playbackFiles=Object.freeze(Object.fromEntries(gunIds.map(id=>[id,Object.freeze({path:`/audio/quality-20261117/firearms/${id}.mp3`})])));

const sharedShots=Object.freeze({
  'ability-ranger-precision-shot':'weapon-rifle-01',
  'ability-gunner-suppression-muzzle':'weapon-gunner-01',
  'ability-babayaga-appraise-shot':'weapon-suppressed-pistol',
});
function rewrite(manifest,allowed){
  return {...manifest,assets:manifest.assets.map(asset=>{
    const key=Object.hasOwn(sharedShots,asset.id)?sharedShots[asset.id]:asset.id;
    const file=Object.hasOwn(playbackFiles,key)?playbackFiles[key]:null;
    if(!file)return asset;
    const fallback=asset.sources.filter(source=>source.src!==file.path);
    if(!fallback.length)throw new Error('Missing original gun source: '+asset.id);
    if(allowed&&!allowed.has(file.path))return fallback.length===asset.sources.length?asset:{...asset,sources:fallback};
    return {...asset,sources:[{src:file.path,type:'audio/mpeg'},...fallback]};
  })};
}
// Playback retains the recorded fallback sources in their existing order.
export function withV100GunFinish(manifest){return rewrite(manifest,null);}
// Physical inventory owns one MPEG, independent of fallback source sorting.
export function v100GunFinishInstallAssets(manifest){
  const paths=new Set(Object.values(playbackFiles).map(file=>file.path));
  return withV100GunFinish(manifest).assets.filter(asset=>paths.has(asset.sources[0].src))
    .map(asset=>({...asset,sources:asset.sources.slice(0,1)}));
}
// A battle/conversation snapshots this whitelist at entry. Old committed packs,
// uncommitted bytes and unwrapped callers retain the original recorded cues.
export function selectV100GunFinishPlayback(manifest,verifiedPaths=''){
  return createAudioManifest(rewrite(manifest,new Set(verifiedPaths.split('\n').filter(Boolean))));
}
