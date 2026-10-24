const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const angle=m=>Math.atan2(m[1],m[0]);
const mix=(a,b,p)=>a+(b-a)*p;
const turn=(a,b,p)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*p;
const copy=pose=>Object.fromEntries(Object.entries(pose).map(([bone,m])=>[bone,[...m]]));
const rigidAt=(pivot,target,a)=>{const c=Math.cos(a),s=Math.sin(a);return[c,s,-s,c,target[0]-c*pivot[0]+s*pivot[1],target[1]-s*pivot[0]-c*pivot[1]];};
const blendAt=(a,b,pivot,p)=>{const A=point(a,pivot),B=point(b,pivot);return rigidAt(pivot,A.map((v,i)=>mix(v,B[i],p)),turn(angle(a),angle(b),p));};

// A dying body releases its planted hands and feet. Interpolate the original
// joint angles with forward kinematics; no unreachable fixed end targets,
// shrinking matrix blends, actor clocks or world/root transforms are used.
export function createTurnedGetupDeathSampler({initialPose,fallenPose,waist,neck,armConstraints,legConstraints}) {
  const initial=copy(initialPose),fallen=copy(fallenPose),waistPoint=[...waist],neckPoint=[...neck];
  const compile=c=>{
    const A=[...(c.shoulder??c.hip)],B=[...(c.elbow??c.knee)],C=[...(c.wrist??c.ankle)];
    const upperAngle=Math.atan2(B[1]-A[1],B[0]-A[0]),lowerAngle=Math.atan2(C[1]-B[1],C[0]-B[0]);
    const relative=pose=>{
      const upper=angle(pose[c.upperBone])+upperAngle,lower=angle(pose[c.lowerBone])+lowerAngle;
      return [upper-angle(pose[c.parentBone]),lower-upper,angle(pose[c.effectorBone])-lower];
    };
    return {...c,A,B,C,upperAngle,lowerAngle,a:Math.hypot(B[0]-A[0],B[1]-A[1]),
      b:Math.hypot(C[0]-B[0],C[1]-B[1]),from:relative(initial),to:relative(fallen)};
  };
  const chains=[...armConstraints,...legConstraints].map(compile);
  for(const pose of [initial,fallen]) {
    if(Object.keys(pose).length!==15)throw Error('The original full15 death pose is required');
    for(const m of Object.values(pose))if(m.length!==6||!m.every(Number.isFinite))throw Error('Invalid death pose matrix');
  }
  return function sampleTurnedGetupDeath(progress) {
    if(!Number.isFinite(progress))throw Error('Finite normalized death progress required');
    if(progress<=0)return copy(initial);
    if(progress>=1)return copy(fallen);
    const p=progress,pose={pelvis:blendAt(initial.pelvis,fallen.pelvis,waistPoint,p),spine:blendAt(initial.spine,fallen.spine,waistPoint,p)};
    const currentNeck=point(pose.spine,neckPoint),fromNeck=point(initial.spine,neckPoint),toNeck=point(fallen.spine,neckPoint);
    const fromHead=point(initial.head,neckPoint),toHead=point(fallen.head,neckPoint);
    pose.head=rigidAt(neckPoint,currentNeck.map((v,i)=>v+mix(fromHead[i]-fromNeck[i],toHead[i]-toNeck[i],p)),turn(angle(initial.head),angle(fallen.head),p));
    for(const c of chains) {
      const A=point(pose[c.parentBone],c.A),upper=angle(pose[c.parentBone])+turn(c.from[0],c.to[0],p);
      const lower=upper+turn(c.from[1],c.to[1],p),end=lower+turn(c.from[2],c.to[2],p);
      const B=[A[0]+c.a*Math.cos(upper),A[1]+c.a*Math.sin(upper)],C=[B[0]+c.b*Math.cos(lower),B[1]+c.b*Math.sin(lower)];
      pose[c.upperBone]=rigidAt(c.A,A,upper-c.upperAngle);pose[c.lowerBone]=rigidAt(c.B,B,lower-c.lowerAngle);
      pose[c.effectorBone]=rigidAt(c.C,C,end);
    }
    return pose;
  };
}
