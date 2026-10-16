// Derived carry motion for the original ranger paint. Actual travel and the
// existing stop-settle own its phase; no render clock or previous pose is used.
export const V177_RANGER_CARRY = Object.freeze({
  waist:Object.freeze([232.5,228.5]),grip:Object.freeze([244,173]),
  spineRadians:.016,weaponRelativeRadians:-.020,weaponLiftPx:1,
});
const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const rotateAt = ([x,y],angle,dy=0) => {
  const c=Math.cos(angle),s=Math.sin(angle);return [c,s,-s,c,x-c*x+s*y,y-s*x-c*y+dy];
};

export function v177RangerCarryPose(pose,phase,settle=1) {
  const s=Number.isFinite(settle)?Math.max(0,Math.min(1,settle)):1;
  const amount=1-s*s*(3-2*s);
  if(amount===0)return pose;
  const p=Number.isFinite(phase)?phase:0,wave=Math.sin(2*Math.PI*p);
  const body=rotateAt(V177_RANGER_CARRY.waist,V177_RANGER_CARRY.spineRadians*amount*wave);
  const carry=rotateAt(V177_RANGER_CARRY.grip,V177_RANGER_CARRY.weaponRelativeRadians*amount*wave,
    V177_RANGER_CARRY.weaponLiftPx*amount*Math.sin(4*Math.PI*p));
  const result=Object.fromEntries(Object.entries(pose).map(([bone,m])=>[bone,multiply(body,m)]));
  result['weapon-0']=multiply(body,multiply(carry,pose['weapon-0']));
  return result;
}
