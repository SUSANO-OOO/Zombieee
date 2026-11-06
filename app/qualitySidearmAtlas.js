// This version changes Baba's weapon paint only. Joint coordinates, pose clocks,
// both wrist anchors and the measured muzzle remain owned by the existing rig.
export const QUALITY_SIDEARM_BASE_PATH = '/art/v100/joints/babayaga-quality-model-r3.webp';
export const QUALITY_SIDEARM_RETAINED_BASE = 'assets/source/quality-20261028/weapon-sidearm-r1/base-head-r3.webp';
export const QUALITY_SIDEARM_PATH = '/art/v100/joints/babayaga-suppressed-sidearm-r1.webp';
export function withQualitySidearmAtlas(kind,base){
 if(kind!=='babayaga')return base;
 return {...base,path:QUALITY_SIDEARM_PATH,decodedWidth:512,decodedHeight:171,decodedBytes:512*171*4,
  parts:base.parts.map(part=>part.bone===base.weaponBone?{...part,
   source:{x:2,y:67,w:212,h:102},destination:{x:226,y:168,w:106,h:51}}:part)};
}
