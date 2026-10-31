import {V177_MELEE_JOINT_ATLASES} from './v177MeleeJointData.js';
import {V177_FIREARM_JOINT_ATLASES} from './v177FirearmJointData.js';
import {V177_PAISEN_PHOTO_JOINT_ATLASES} from './v177PaisenPhotoJointData.js';
import {V177_NEWCOMER_JOINT_ATLASES} from './v177NewcomerJointData.js';
import {V177_JOINT_ATLASES} from './v177JointData.js';
import {V177_BIPED_JOINT_ATLASES} from './v177BipedJointData.js';
import {V177_QUADRUPED_JOINT_ATLASES} from './v177QuadrupedJointData.js';
import {V105_CRAZY_KING_JOINT_ATLAS} from './v105CrazyKingJointData.js';
import {V177_GUARD_ENEMY_JOINT_ATLASES} from './v177GuardEnemyJointData.js';
import {withQualitySidearmAtlas} from './qualitySidearmAtlas.js';
import {QUALITY_KUMAVERSON_COMBAT_ATLAS} from './qualityKumaversonCombatJointData.js';
import {withQualityBattleHeadCalibration} from './qualityBattleHeadCalibration.js';

const baseAtlases={...V177_JOINT_ATLASES,...V177_QUADRUPED_JOINT_ATLASES,
  ...V177_BIPED_JOINT_ATLASES,...V177_FIREARM_JOINT_ATLASES,...V177_MELEE_JOINT_ATLASES,
  ...V177_NEWCOMER_JOINT_ATLASES,...V177_PAISEN_PHOTO_JOINT_ATLASES,...V177_GUARD_ENEMY_JOINT_ATLASES,
  'crazy-king':V105_CRAZY_KING_JOINT_ATLAS};
export const QUALITY_CHARACTER_BASE_ATLASES=Object.freeze(Object.fromEntries([
  'brawler','scout','ranger','medic','brute','crazy-king','kumaverson','babayaga',
  'gunner','guardian','engineer','zakimiya','tky','mrs-chiha','miyamoto-musashi','mayo-chan',
].map(kind=>[kind,baseAtlases[kind]])));

// Generated head textures share the existing bone geometry and all action poses.
export const QUALITY_CHARACTER_HEAD_ATLASES = Object.freeze({
  kumaverson: {...V177_MELEE_JOINT_ATLASES.kumaverson,path:'/art/v100/joints/kumaverson-quality-head-r1.webp'},
  babayaga: {...V177_FIREARM_JOINT_ATLASES.babayaga,path:'/art/v100/joints/babayaga-quality-head-r1.webp'},
  brawler: {...V177_PAISEN_PHOTO_JOINT_ATLASES.brawler,path:'/art/v100/joints/brawler-quality-head-r1.webp'},
  tky: {...V177_NEWCOMER_JOINT_ATLASES.tky,path:'/art/v100/joints/tky-quality-head-r1.webp'},
  zakimiya: {...V177_NEWCOMER_JOINT_ATLASES.zakimiya,path:'/art/v100/joints/zakimiya-quality-head-r1.webp'},
  ...Object.fromEntries(['scout','ranger','medic','brute','crazy-king','gunner','guardian',
    'engineer','mrs-chiha','miyamoto-musashi','mayo-chan','babayaga'].map(kind=>[
      kind,{...QUALITY_CHARACTER_BASE_ATLASES[kind],path:`/art/v100/joints/${kind}-quality-model-r3.webp`},
    ])),
});
export const QUALITY_CHARACTER_ATLASES=Object.freeze({
 ...Object.fromEntries(Object.entries(QUALITY_CHARACTER_HEAD_ATLASES).map(([kind,atlas])=>[kind,withQualityBattleHeadCalibration(kind,withQualitySidearmAtlas(kind,atlas))])),
 kumaverson:QUALITY_KUMAVERSON_COMBAT_ATLAS,
});
