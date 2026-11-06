// The source pistol contains one hand. Keep the other wrist independent in
// every consumer, including live stun/corpse capture and recovery.
export function withQualityBabaCombatRig(kind,atlas){
 if(kind!=='babayaga')return atlas;
 const original=atlas.armConstraints[1],free={...original,effectorBone:'arm-1-hand',
  effectorWrist:original.wrist,grip:original.wrist,bendSign:1};
 return {...atlas,armPosePolicy:'one-handed-pistol-and-free-arm',
  armConstraints:[atlas.armConstraints[0],free],
  interpolationPivots:{...atlas.interpolationPivots,'arm-1-hand':original.wrist},
  poses:atlas.poses.map(pose=>({...pose,'arm-1-hand':[...pose[original.parentBone]]}))};
}
