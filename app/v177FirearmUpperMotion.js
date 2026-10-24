// Follow the existing normal-shot phases. The waist stays on its source pelvis;
// shoulders, both hands and the weapon receive one common rigid transform.
const waists={medic:[240,193],engineer:[235,203],gunner:[205,200]};
const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*smooth(t);

// Pure response to the existing released Shot lifetime; no renderer timer/state.
function gunnerShotPulse(actor,world) {
  if(!Number.isSafeInteger(actor?.id)||!Array.isArray(world?.shots))return 0;
  let pulse=0;
  for(const shot of world.shots){
    if(shot.sourceId!==actor.id||shot.side!=='human'||shot.weapon!=='gunner'
      ||shot.style!=='projectile'||![0,1,2].includes(shot.shotIndex)
      ||!Number.isFinite(shot.duration)||!Number.isFinite(shot.life)||shot.life<=0)continue;
    const age=shot.duration-shot.life;
    if(age<0||age>=.08)continue;
    const amount=age<.012?smooth(age/.012):1-smooth((age-.012)/.068);
    pulse=Math.max(pulse,amount); // Multi-target traces cannot multiply one kick.
  }
  return pulse;
}
function gunnerUpperAngle(sample,actor,world) {
  const p=Math.max(0,Math.min(1,Number(sample?.clipProgress)||0));
  let base;
  switch(sample?.requestedState){
    case 'wind-up':return p===0?null:mix(0,.012,p);
    case 'active':base=mix(.012,-.016,p);break;
    case 'recovery':if(p===1)return null;base=mix(-.016,0,p);break;
    default:return null;
  }
  return base-.08*gunnerShotPulse(actor,world);
}

export function v177FirearmUpperMotion(kind,sample,spine,{actor,world}={}) {
  if(kind!=='medic'&&kind!=='engineer'&&kind!=='gunner')return null;
  const p=Math.max(0,Math.min(1,Number(sample?.clipProgress)||0));
  const support=kind==='medic',ready=support ? .014 : .018,
    kick=support?-.055:-.065,release=support?-.02:-.025;
  let angle;
  if(kind==='gunner'){
    angle=gunnerUpperAngle(sample,actor,world);if(angle===null)return null;
  }else switch(sample?.requestedState){
    case 'wind-up':if(p===0)return null;angle=mix(0,ready,p);break;
    case 'active':angle=p<.3?mix(ready,kick,p/.3):mix(kick,release,(p-.3)/.7);break;
    case 'recovery':if(p===1)return null;angle=mix(release,0,p);break;
    default:return null;
  }
  const [wx,wy]=waists[kind],x=spine[0]*wx+spine[2]*wy+spine[4],
    y=spine[1]*wx+spine[3]*wy+spine[5],c=Math.cos(angle),s=Math.sin(angle);
  return [c,s,-s,c,x-c*x+s*y,y-s*x-c*y];
}

// The existing normal-shot progress owns the handling stroke. Moving the
// weapon before arm IK lets both elbows yield while their original grips stay.
export function v177FirearmWeaponPullback(kind,sample) {
  const distance=kind==='medic'?12:kind==='engineer'?16:0;
  if(!distance)return 0;
  const p=Math.max(0,Math.min(1,Number(sample?.clipProgress)||0));
  if(sample?.requestedState==='active')return distance*(p<.3?mix(0,1,p/.3):mix(1,.25,(p-.3)/.7));
  if(sample?.requestedState==='recovery')return distance*mix(.25,0,p);
  return 0;
}

export function applyV177FirearmWeaponPullback(out,atlas,amount) {
  if(!amount)return out;
  const arm=atlas.armConstraints[0],[gx,gy]=arm.effectorWrist??arm.wrist;
  const dx=atlas.muzzle[0]-gx,dy=atlas.muzzle[1]-gy,length=Math.hypot(dx,dy);
  const x=dx/length*amount,y=dy/length*amount;
  out[4]-=out[0]*x+out[2]*y;out[5]-=out[1]*x+out[3]*y;
  return out;
}

export function applyV177FirearmUpperMotion(out,t) {
  const a=out[0],b=out[1],c=out[2],d=out[3],x=out[4],y=out[5];
  out[0]=t[0]*a+t[2]*b;out[1]=t[1]*a+t[3]*b;
  out[2]=t[0]*c+t[2]*d;out[3]=t[1]*c+t[3]*d;
  out[4]=t[0]*x+t[2]*y+t[4];out[5]=t[1]*x+t[3]*y+t[5];
  return out;
}
