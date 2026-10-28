import {V177_MELEE_JOINT_ATLASES} from './v177MeleeJointData.js';
import {V177_FIREARM_JOINT_ATLASES} from './v177FirearmJointData.js';
import {V177_PAISEN_PHOTO_JOINT_ATLASES} from './v177PaisenPhotoJointData.js';
import {V177_NEWCOMER_JOINT_ATLASES} from './v177NewcomerJointData.js';

// Generated head textures share the existing bone geometry and all action poses.
export const QUALITY_CHARACTER_ATLASES = Object.freeze({
  kumaverson: {...V177_MELEE_JOINT_ATLASES.kumaverson,path:'/art/v100/joints/kumaverson-quality-head-r1.webp'},
  babayaga: {...V177_FIREARM_JOINT_ATLASES.babayaga,path:'/art/v100/joints/babayaga-quality-head-r1.webp'},
  brawler: {...V177_PAISEN_PHOTO_JOINT_ATLASES.brawler,path:'/art/v100/joints/brawler-quality-head-r1.webp'},
  tky: {...V177_NEWCOMER_JOINT_ATLASES.tky,path:'/art/v100/joints/tky-quality-head-r1.webp'},
  zakimiya: {...V177_NEWCOMER_JOINT_ATLASES.zakimiya,path:'/art/v100/joints/zakimiya-quality-head-r1.webp'},
});
