// Source-bound original walker/turned 15-part geometry.
// Caller supplies the CURRENT ordinary idle/move pose each paint. No clocks,
// phase resets, actor state, imports, I/O, root-position changes or iterations.
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const copy=pose=>Object.fromEntries(Object.entries(pose).map(([bone,m])=>[bone,[...m]]));
const mix=(a,b,w)=>a+(b-a)*w;
const smooth=p=>p*p*(3-2*p);
const angle=m=>Math.atan2(m[1],m[0]);
const mixAngle=(a,b,w)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*w;
const rigidAt=(pivot,target,a)=>{const c=Math.cos(a),s=Math.sin(a);return[c,s,-s,c,target[0]-c*pivot[0]+s*pivot[1],target[1]-s*pivot[0]-c*pivot[1]];};
const pivotBlend=(a,b,pivot,w)=>{const A=point(a,pivot),B=point(b,pivot);return rigidAt(pivot,[mix(A[0],B[0],w),mix(A[1],B[1],w)],mixAngle(angle(a),angle(b),w));};

export function createTurnedGetupHandoffSampler({waist,neck,floor,armConstraints,legConstraints,boneHulls}){
  const waistPoint=[...waist],neckPoint=[...neck],hulls=Object.fromEntries(Object.entries(boneHulls).map(([bone,h])=>[bone,h.map(p=>[...p])]));
  const compile=c=>{const A=[...(c.hip??c.shoulder)],B=[...(c.knee??c.elbow)],C=[...(c.ankle??c.wrist)];return{parentBone:c.parentBone,upperBone:c.upperBone,lowerBone:c.lowerBone,effectorBone:c.effectorBone,A,B,C,a:distance(A,B),b:distance(B,C),upperAngle:Math.atan2(B[1]-A[1],B[0]-A[0]),lowerAngle:Math.atan2(C[1]-B[1],C[0]-B[0]),sign:(B[0]-A[0])*(-(C[1]-A[1]))+(B[1]-A[1])*(C[0]-A[0])>=0?1:-1};};
  const arms=armConstraints.map(compile),legs=legConstraints.map(compile),bones=Object.keys(hulls);
  if(bones.length!==15||arms.length!==2||legs.length!==2||!Number.isFinite(floor))throw Error('Original 15-part walker/turned geometry required');
  const maxY=(m,bone)=>{let y=-Infinity;for(const p of hulls[bone])y=Math.max(y,point(m,p)[1]);return y;};
  const solve=(c,parent,end,pose)=>{const h=point(parent,c.A),t=point(end,c.C),dx=t[0]-h[0],dy=t[1]-h[1],d=Math.hypot(dx,dy);if(!(d>Math.abs(c.a-c.b)+1e-8&&d<c.a+c.b-1e-8))throw Error(`Unreachable original handoff chain: ${c.upperBone}`);const along=(c.a*c.a+d*d-c.b*c.b)/(2*d),height=Math.sqrt(Math.max(0,c.a*c.a-along*along)),k=[h[0]+dx/d*along-dy/d*height*c.sign,h[1]+dy/d*along+dx/d*height*c.sign];pose[c.upperBone]=rigidAt(c.A,h,Math.atan2(k[1]-h[1],k[0]-h[0])-c.upperAngle);pose[c.lowerBone]=rigidAt(c.B,k,Math.atan2(t[1]-k[1],t[0]-k[0])-c.lowerAngle);};
  const requirePose=pose=>{for(const bone of bones)if(!pose?.[bone]||pose[bone].length!==6||!pose[bone].every(Number.isFinite))throw Error(`Missing/invalid full15 handoff matrix: ${bone}`);};
  return function sampleTurnedGetupHandoff(basePose,ordinaryPose,progress){
    if(!Number.isFinite(progress))throw Error('Finite normalized progress required');
    requirePose(basePose);
    if(progress<=.85)return copy(basePose);
    requirePose(ordinaryPose);
    // Coordinate conversion of the EXISTING ordinary signed-sole correction:
    // normalized target + canonical ground root equals raw ordinary target +
    // its normal ground root in actual world paint. Actor x/y never changes.
    const target=copy(ordinaryPose),ordinaryBottom=Math.max(...legs.map(c=>maxY(target[c.effectorBone],c.effectorBone))),sourceShift=floor-ordinaryBottom;
    for(const m of Object.values(target))m[5]+=sourceShift;
    if(progress>=1)return target;
    const p=(progress-.85)/.15,w=smooth(p),pose={pelvis:pivotBlend(basePose.pelvis,target.pelvis,waistPoint,w),spine:pivotBlend(basePose.spine,target.spine,waistPoint,w)};
    const baseHead=point(basePose.head,neckPoint),baseNeck=point(basePose.spine,neckPoint),targetHead=point(target.head,neckPoint),targetNeck=point(target.spine,neckPoint),currentNeck=point(pose.spine,neckPoint);
    const headAnchor=currentNeck.map((v,i)=>v+mix(baseHead[i]-baseNeck[i],targetHead[i]-targetNeck[i],w));
    pose.head=rigidAt(neckPoint,headAnchor,mixAngle(angle(basePose.head),angle(target.head),w));
    for(const c of arms)pose[c.effectorBone]=pivotBlend(basePose[c.effectorBone],target[c.effectorBone],c.C,w);
    const footPlans=legs.map(c=>{const base=basePose[c.effectorBone],final=target[c.effectorBone],blended=pivotBlend(base,final,c.C,w),footAngle=angle(blended),anchor=point(blended,c.C),down=maxY(rigidAt(c.C,[0,0],footAngle),c.effectorBone),baseClearance=Math.max(0,floor-maxY(base,c.effectorBone)),targetClearance=Math.max(0,floor-maxY(final,c.effectorBone));return{c,anchor,angle:footAngle,down,clearance:mix(baseClearance,targetClearance,w)};});
    // Ground owner can change between the two boots. Removing only their
    // common interpolated clearance keeps one sole planted without moving the
    // pelvis/torso/root or hiding an upper-part floor intrusion.
    const sharedClearance=Math.min(...footPlans.map(f=>f.clearance));
    for(const f of footPlans){f.anchor[1]=floor-f.down-(f.clearance-sharedClearance);pose[f.c.effectorBone]=rigidAt(f.c.C,f.anchor,f.angle);}
    for(const c of [...arms,...legs])solve(c,pose[c.parentBone],pose[c.effectorBone],pose);
    return pose;
  };
}
