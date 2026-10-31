import {QUALITY_BATTLE_HEAD_CALIBRATIONS} from './qualityBattleHeadCalibrationData.js';

export function withQualityBattleHeadCalibration(kind,atlas){
 const update=QUALITY_BATTLE_HEAD_CALIBRATIONS[kind];
 if(!update)return atlas;
 const {parts,headRig,neckAttachment,...texture}=update;
 // neckAttachment describes the material-registration seam. The original
 // anatomical bone pivot and reaction/return owners remain in the base rig.
 void neckAttachment;
 return headRig==='ranger-upper'
  ?{...atlas,...texture,upperRig:{...atlas.upperRig,parts}}
  :{...atlas,...texture,parts};
}
