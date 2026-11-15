import {createAudioManifest} from './audioManifest.js';

// Non-vocal collapse material follows each boss's existing 2.6-second finale.
export const V100_BOSS_COLLAPSE_AUDIO=Object.freeze(Object.fromEntries(Object.entries({
  "gate-eater": {
    "id": "v100-boss-collapse-gate-eater",
    "name": "gate-eater-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-fef4ada76d530273e6a2dbd5bf6008a0bf28a73676547e909f02d8104d40f1c8"
  },
  "mother": {
    "id": "v100-boss-collapse-mother",
    "name": "mother-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-7ac46292c9b9be361d96897a104de155a5f9d64e7d392b85f201ef2e5ca65403"
  },
  "kurome": {
    "id": "v100-boss-collapse-kurome",
    "name": "kurome-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-68e34cb1cd7042140ff1545130bf7aafd65fa21951ffc599d88721a646ef98e2"
  },
  "ooguchi": {
    "id": "v100-boss-collapse-ooguchi",
    "name": "ooguchi-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-1ffe938011b0688806feccb1764813fff24f47de8c5381b79ec194f1aee82faa"
  },
  "gairen": {
    "id": "v100-boss-collapse-gairen",
    "name": "gairen-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-1c1814f5e1f748578d6dee7cf0e7fb1e711983c1a4d49665eccd9ff9ec79f7b5"
  },
  "takuya": {
    "id": "v100-boss-collapse-takuya",
    "name": "takuya-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-a4aaad08a68cd2fa92cb32104bf8ef3bb43a81f48ea64bf845ea04263fae74a0"
  },
  "mugarian-president-mutated": {
    "id": "v100-boss-collapse-mugarian-president-mutated",
    "name": "mugarian-president-mutated-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-79886883e2db12f0d5fa0193949ee8129f4db3606618c5c4cfd8bd9ec5a2c2b3"
  },
  "futago": {
    "id": "v100-boss-collapse-futago",
    "name": "futago-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-ba0c747b3558f57b0540bb029c87590f4854a6e78896e3cd27fabcb1b0b24a64"
  },
  "takuya-omega": {
    "id": "v100-boss-collapse-takuya-omega",
    "name": "takuya-omega-collapse-r1",
    "duration": 2.52,
    "hash": "sha256-a77fddfe5867da317cf0070dfdec3781452d04aa3465f2b2c356f3aa36d1b3ef"
  }
}).map(([kind,value])=>[kind,Object.freeze(value)])));
export const V100_BOSS_COLLAPSE_FILES=Object.freeze(Object.fromEntries(Object.values(V100_BOSS_COLLAPSE_AUDIO).map(profile=>[profile.id,Object.freeze({
  path:'/audio/quality-20261116/boss-finales/'+profile.name+'.mp3',hash:profile.hash,
})])));

export function withV100BossCollapseAudio(manifest){
  return {...manifest,assets:[...manifest.assets,...Object.values(V100_BOSS_COLLAPSE_AUDIO).map(profile=>({
    id:profile.id,category:'weapons',preload:'lazy',loop:false,gain:.60,priority:96,cooldownMs:180,maxInstances:2,
    sources:['mp3','ogg'].map(ext=>({src:'/audio/quality-20261116/boss-finales/'+profile.name+'.'+ext,type:ext==='mp3'?'audio/mpeg':'audio/ogg'})),
  }))]};
}

export function selectV100BossCollapsePlayback(manifest,verifiedPaths=''){
  const allowed=new Set(verifiedPaths.split('\n').filter(Boolean));
  const fallback=manifest.assetById['support-explosion']?.sources;
  if(!fallback?.length)throw new Error('Missing retained recorded explosion');
  return createAudioManifest({...manifest,assets:manifest.assets.map(asset=>{
    const file=Object.hasOwn(V100_BOSS_COLLAPSE_FILES,asset.id)?V100_BOSS_COLLAPSE_FILES[asset.id]:null;
    if(!file)return asset;
    const preferred=asset.sources.find(source=>source.src===file.path&&source.type==='audio/mpeg');
    return {...asset,sources:allowed.has(file.path)&&preferred?[preferred,...fallback]:fallback};
  })});
}

export function v100BossCollapseCue(kind,stageNumber,externalSessionActive){
  if(externalSessionActive!==true||!Number.isInteger(stageNumber)||stageNumber<1||stageNumber>30
    ||!Object.hasOwn(V100_BOSS_COLLAPSE_AUDIO,kind))return null;
  return V100_BOSS_COLLAPSE_AUDIO[kind].id;
}
