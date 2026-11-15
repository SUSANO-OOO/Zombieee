import {createAudioManifest} from './audioManifest.js';

// Non-vocal material cues; existing character voices remain separate.
export const V100_BOSS_SKILL_AUDIO=Object.freeze(Object.fromEntries(Object.entries({
  "takuya-warning": {
    "kind": "takuya",
    "phase": "warning",
    "id": "v100-boss-skill-takuya-warning",
    "name": "takuya-warning-r1",
    "duration": 0.66,
    "fallbackId": "boss-ooguchi-charge-warning",
    "hash": "sha256-f250093ad2b73bd87339ecd02ad978ce99da0b879c1120517862a182f17c2795"
  },
  "takuya-impact": {
    "kind": "takuya",
    "phase": "impact",
    "id": "v100-boss-skill-takuya-impact",
    "name": "takuya-impact-r1",
    "duration": 0.82,
    "fallbackId": "weapon-hammer-01",
    "hash": "sha256-b17e96ac6d5c4e1c24194c36986166200f5efd674169ded368c2bd2441e090aa"
  },
  "gate-eater-warning": {
    "kind": "gate-eater",
    "phase": "warning",
    "id": "v100-boss-skill-gate-eater-warning",
    "name": "gate-eater-warning-r1",
    "duration": 0.7,
    "fallbackId": "boss-ooguchi-charge-warning",
    "hash": "sha256-7bbd33bc212569eda66ef3d09b343d791d897ce6f37abf948460490e3cfeb0bf"
  },
  "gate-eater-impact": {
    "kind": "gate-eater",
    "phase": "impact",
    "id": "v100-boss-skill-gate-eater-impact",
    "name": "gate-eater-impact-r1",
    "duration": 0.56,
    "fallbackId": "weapon-melee-impact-01",
    "hash": "sha256-4fe5b98dd4a31342acd2583a38183eb67958dedfd3aca04f5abde195ef52ba0d"
  },
  "mother-warning": {
    "kind": "mother",
    "phase": "warning",
    "id": "v100-boss-skill-mother-warning",
    "name": "mother-warning-r1",
    "duration": 0.82,
    "fallbackId": "boss-mother-brood-warning",
    "hash": "sha256-41d7f2978336c51dc66dbdb054bbed1831ca2c403ed4ccb5b57f913fdc9fdd9a"
  },
  "mother-impact": {
    "kind": "mother",
    "phase": "impact",
    "id": "v100-boss-skill-mother-impact",
    "name": "mother-impact-r1",
    "duration": 0.94,
    "fallbackId": "boss-mother-brood-eruption",
    "hash": "sha256-ccd67d08c2c7c56ff360bfc77ff06afda11706551d8bac044847db710e289654"
  },
  "kurome-warning": {
    "kind": "kurome",
    "phase": "warning",
    "id": "v100-boss-skill-kurome-warning",
    "name": "kurome-warning-r1",
    "duration": 1.02,
    "fallbackId": "v104-eye-warning",
    "hash": "sha256-26fcedc1779b438148ced0fc9a9876e76e3f1ddb004110bd8aefe2199b80ff82"
  },
  "kurome-impact": {
    "kind": "kurome",
    "phase": "impact",
    "id": "v100-boss-skill-kurome-impact",
    "name": "kurome-impact-r1",
    "duration": 0.46,
    "fallbackId": "v104-eye-fire",
    "hash": "sha256-4fc4c9c08d07baa1671d583050f210fec6bb72f66d577126f70858b3ff85f809"
  },
  "ooguchi-warning": {
    "kind": "ooguchi",
    "phase": "warning",
    "id": "v100-boss-skill-ooguchi-warning",
    "name": "ooguchi-warning-r1",
    "duration": 0.79,
    "fallbackId": "boss-ooguchi-charge-warning",
    "hash": "sha256-878b43cf6188ff4578378d89c2fd61d628c149f77ed90e58c83c41312b2f916e"
  },
  "ooguchi-impact": {
    "kind": "ooguchi",
    "phase": "impact",
    "id": "v100-boss-skill-ooguchi-impact",
    "name": "ooguchi-impact-r1",
    "duration": 0.78,
    "fallbackId": "boss-ooguchi-charge-impact",
    "hash": "sha256-87ce4bfb80f7c87982f719310d059f9791d4787aafd07fc6f5beb3bfed3b97c3"
  },
  "gairen-warning": {
    "kind": "gairen",
    "phase": "warning",
    "id": "v100-boss-skill-gairen-warning",
    "name": "gairen-warning-r1",
    "duration": 0.88,
    "fallbackId": "boss-gairen-shell-warning",
    "hash": "sha256-b7b8fd8a45648264fff5f6fc9ea81d5c72e29ba6e98954cf20dc9e2bdb92b007"
  },
  "gairen-impact": {
    "kind": "gairen",
    "phase": "impact",
    "id": "v100-boss-skill-gairen-impact",
    "name": "gairen-impact-r1",
    "duration": 1,
    "fallbackId": "boss-gairen-shell-sweep",
    "hash": "sha256-1bd01ec6556fb1d437a4d07bae8a118b549e6b3b51bd02e086d2484bbc6c1814"
  },
  "futago-warning": {
    "kind": "futago",
    "phase": "warning",
    "id": "v100-boss-skill-futago-warning",
    "name": "futago-warning-r1",
    "duration": 0.88,
    "fallbackId": "boss-futago-cross-warning",
    "hash": "sha256-950e25f845800fca0d3319010af450cadbf5937d7015b4239e2342fd3b2569eb"
  },
  "futago-impact": {
    "kind": "futago",
    "phase": "impact",
    "id": "v100-boss-skill-futago-impact",
    "name": "futago-impact-r1",
    "duration": 0.78,
    "fallbackId": "boss-futago-cross-impact",
    "hash": "sha256-6e68ea3eb8dea8429f32740b5b3869845d898cc6fedf37d9324939792820bfbe"
  },
  "mugarian-president-mutated-warning": {
    "kind": "mugarian-president-mutated",
    "phase": "warning",
    "id": "v100-boss-skill-mugarian-president-mutated-warning",
    "name": "mugarian-president-mutated-warning-r1",
    "duration": 0.78,
    "fallbackId": "boss-mother-brood-warning",
    "hash": "sha256-cad2e515e0175f16b2b8eee4f68d652b4589da4bc3ab8c2f03fcc293ada783ad"
  },
  "mugarian-president-mutated-impact": {
    "kind": "mugarian-president-mutated",
    "phase": "impact",
    "id": "v100-boss-skill-mugarian-president-mutated-impact",
    "name": "mugarian-president-mutated-impact-r1",
    "duration": 0.84,
    "fallbackId": "boss-futago-cross-impact",
    "hash": "sha256-3fc11bede1dd5f7a5e110601119165dbdf6ee09862074eb1e756166f28b3b624"
  },
  "takuya-omega-warning": {
    "kind": "takuya-omega",
    "phase": "warning",
    "id": "v100-boss-skill-takuya-omega-warning",
    "name": "takuya-omega-warning-r1",
    "duration": 0.9,
    "fallbackId": "boss-ooguchi-charge-warning",
    "hash": "sha256-b688c3850e00b21ea6fdaa21cba50de2190f7f5cd84bd5dc8eab08e2b7199f19"
  },
  "takuya-omega-impact": {
    "kind": "takuya-omega",
    "phase": "impact",
    "id": "v100-boss-skill-takuya-omega-impact",
    "name": "takuya-omega-impact-r1",
    "duration": 1.12,
    "fallbackId": "boss-futago-cross-impact",
    "hash": "sha256-19641780df5641b57f398f443efcb6075eba3aa1c033b740797ab4da47c535bb"
  },
  "gate-eater-release": {
    "kind": "gate-eater",
    "phase": "release",
    "id": "v100-boss-skill-gate-eater-release",
    "name": "gate-eater-release-r1",
    "duration": 0.7,
    "fallbackId": "weapon-melee-impact-01",
    "hash": "sha256-66d7b3dea73575e2bc1a5952a5fff5d3fddb1eb983b3f6ad4eeb468e62f1a43a"
  }
}).map(([key,value])=>[key,Object.freeze(value)])));
export const V100_BOSS_SKILL_FILES=Object.freeze(Object.fromEntries(Object.values(V100_BOSS_SKILL_AUDIO).map(profile=>[profile.id,Object.freeze({path:'/audio/quality-20261116/boss-skills/'+profile.name+'.mp3',hash:profile.hash})])));

export function withV100BossSkillAudio(manifest){
  return {...manifest,assets:[...manifest.assets,...Object.values(V100_BOSS_SKILL_AUDIO).map(profile=>({
    id:profile.id,category:'weapons',preload:'lazy',loop:false,
    gain:profile.phase==='warning'?.64:profile.phase==='release'?.56:.70,
    priority:profile.phase==='warning'?90:96,cooldownMs:150,maxInstances:2,
    sources:['mp3','ogg'].map(ext=>({src:'/audio/quality-20261116/boss-skills/'+profile.name+'.'+ext,type:ext==='mp3'?'audio/mpeg':'audio/ogg'})),
  }))]};
}

export function selectV100BossSkillPlayback(manifest,verifiedPaths=''){
  const allowed=new Set(verifiedPaths.split('\n').filter(Boolean));
  const profiles=new Map(Object.values(V100_BOSS_SKILL_AUDIO).map(p=>[p.id,p]));
  return createAudioManifest({...manifest,assets:manifest.assets.map(asset=>{
    const profile=profiles.get(asset.id);if(!profile)return asset;
    const fallback=manifest.assetById[profile.fallbackId]?.sources;
    if(!fallback?.length)throw new Error('Missing retained boss skill material: '+profile.fallbackId);
    const file=V100_BOSS_SKILL_FILES[asset.id],preferred=asset.sources.find(s=>s.src===file.path&&s.type==='audio/mpeg');
    // The installed generation stores MPEG. A new Ogg is never an offline fallback.
    return {...asset,sources:allowed.has(file.path)&&preferred?[preferred,...fallback]:fallback};
  })});
}

export function v100BossSkillCue(kind,phase,stageNumber,externalSessionActive){
  if(externalSessionActive!==true||!Number.isInteger(stageNumber)||stageNumber<1||stageNumber>30
    ||!['warning','release','impact'].includes(phase))return null;
  const key=kind+'-'+phase;return Object.hasOwn(V100_BOSS_SKILL_AUDIO,key)?V100_BOSS_SKILL_AUDIO[key].id:null;
}
export function v100BossSkillCues(kind,stageNumber,externalSessionActive){
  return ['warning','release','impact'].map(phase=>v100BossSkillCue(kind,phase,stageNumber,externalSessionActive)).filter(Boolean);
}
