// The approved author's two-bone clothing weights and actual-travel gait.
// Mutable geometry belongs only to a shared painter; actor history stores phase/settle.
const cycle=p=>((Number(p)||0)%1+1)%1;
const clamp=p=>Math.max(0,Math.min(1,Number(p)||0));
const smooth=p=>{const t=clamp(p);return t*t*(3-2*t);};
export const v177RangerLowerBob=(phase,settle)=>1.2*Math.cos(cycle(phase)*4*Math.PI)*(1-clamp(settle));

export function createV177RangerLowerPose(rig) {
  const matrices={pelvis:new Float64Array(6)},meshes={};
  for(const leg of rig.legs){for(const bone of [leg.upperBone,leg.lowerBone,leg.footBone])matrices[bone]=new Float64Array(6);
    meshes[leg.name]=new Float64Array(leg.sourcePositions.length);}
  return {matrices,meshes,joints:rig.legs.map(()=>new Float64Array(6)),bob:0,phase:0,settle:1};
}
function rigid(out,ax,ay,bx,by,cx,cy,dx,dy) {
  const angle=Math.atan2(dy-cy,dx-cx)-Math.atan2(by-ay,bx-ax),c=Math.cos(angle),s=Math.sin(angle);
  out[0]=c;out[1]=s;out[2]=-s;out[3]=c;out[4]=cx-c*ax+s*ay;out[5]=cy-s*ax-c*ay;
}
export function v177RangerLowerPose(rig,phase,settle,out=createV177RangerLowerPose(rig)) {
  phase=cycle(phase);settle=clamp(settle);out.phase=phase;out.settle=settle;out.bob=v177RangerLowerBob(phase,settle);
  const pelvis=out.matrices.pelvis;pelvis[0]=1;pelvis[1]=0;pelvis[2]=0;pelvis[3]=1;pelvis[4]=0;pelvis[5]=out.bob;
  for(let i=0;i<rig.legs.length;i++){
    const leg=rig.legs[i],q=cycle(phase+leg.offset),t=(q-rig.stanceFraction)/(1-rig.stanceFraction),swing=q>rig.stanceFraction;
    const dx=swing?rig.spanPx*(-.5+smooth(t)):rig.spanPx*(.5-q/rig.stanceFraction);
    const lift=swing?rig.liftPx*Math.sin(Math.PI*t)*(1-settle):0,angle=swing?-.16*Math.sin(Math.PI*t)*(1-settle):0;
    const hx=leg.hip[0],hy=leg.hip[1]+out.bob,ax=leg.footCenter+dx,ay=leg.groundAnkle-lift;
    const tx=ax-hx,ty=ay-hy,d=Math.hypot(tx,ty),a=leg.upperLength,b=leg.lowerLength;
    if(!(d>Math.abs(a-b)+1e-7&&d<a+b))throw new RangeError('Original Ranger ankle target is unreachable');
    const along=(a*a+d*d-b*b)/(2*d),h=Math.sqrt(Math.max(0,a*a-along*along)),ux=tx/d,uy=ty/d;
    const kx=hx+ux*along-uy*h*leg.bendSign,ky=hy+uy*along+ux*h*leg.bendSign;
    const joints=out.joints[i];joints[0]=hx;joints[1]=hy;joints[2]=kx;joints[3]=ky;joints[4]=ax;joints[5]=ay;
    const upper=out.matrices[leg.upperBone],lower=out.matrices[leg.lowerBone];
    rigid(upper,...leg.hip,...leg.knee,hx,hy,kx,ky);rigid(lower,...leg.knee,...leg.ankle,kx,ky,ax,ay);
    const c=Math.cos(angle),s=Math.sin(angle),foot=out.matrices[leg.footBone];foot[0]=c;foot[1]=s;foot[2]=-s;foot[3]=c;
    foot[4]=ax-c*leg.ankle[0]+s*leg.ankle[1];foot[5]=ay-s*leg.ankle[0]-c*leg.ankle[1];
    // Original preserve-volume dual-quaternion interpolation, not linear skinning.
    const aa=Math.atan2(upper[1],upper[0])/2,bb=Math.atan2(lower[1],lower[0])/2,aw=Math.cos(aa),az=Math.sin(aa);
    let bw=Math.cos(bb),bz=Math.sin(bb);if(aw*bw+az*bz<0){bw=-bw;bz=-bz;}
    const vertices=out.meshes[leg.name];let previousWeight=NaN,co=0,si=0,offsetX=0,offsetY=0;
    for(let j=0;j<leg.weights.length;j++){
      const w=leg.weights[j];if(w!==previousWeight){
        const q0=aw*(1-w)+bw*w,qz=az*(1-w)+bz*w,n=Math.hypot(q0,qz),qw=q0/n,qzz=qz/n;
        const ddx=((upper[4]*aw+upper[5]*az)*(1-w)+(lower[4]*bw+lower[5]*bz)*w)*.5/n;
        const ddy=((upper[5]*aw-upper[4]*az)*(1-w)+(lower[5]*bw-lower[4]*bz)*w)*.5/n;
        co=qw*qw-qzz*qzz;si=2*qw*qzz;offsetX=2*(ddx*qw-ddy*qzz);offsetY=2*(ddx*qzz+ddy*qw);previousWeight=w;
      }
      const x=leg.sourcePositions[j*2],y=leg.sourcePositions[j*2+1];vertices[j*2]=co*x-si*y+offsetX;vertices[j*2+1]=si*x+co*y+offsetY;
    }
  }
  return out;
}
