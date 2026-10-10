import { V177_JOINT_ATLASES as bakedAtlases } from './v177JointData.js';
import { V177_QUADRUPED_JOINT_ATLASES as quadrupedAtlases } from './v177QuadrupedJointData.js';
import { V177_BIPED_JOINT_ATLASES as bipedAtlases } from './v177BipedJointData.js';
import { V177_ENEMY_JOINT_ATLASES as enemyAtlases } from './v177EnemyJointData.js';
import { V177_RUNNER_JOINT_ATLASES as runnerAtlases } from './v177RunnerJointData.js';
import { V177_FIREARM_JOINT_ATLASES as firearmAtlases } from './v177FirearmJointData.js';

const locomotionStates = new Set(['idle','move','start-move','stop-move','turn']);
const attackStates = new Set(['wind-up','active','recovery']);
const clamp = p => Math.max(0, Math.min(1, Number(p) || 0));
const cycle = p => ((Number(p) || 0) % 1 + 1) % 1;

export const V177_JOINT_ATLASES = Object.fromEntries(Object.entries({...bakedAtlases,...quadrupedAtlases,...bipedAtlases,...enemyAtlases,...runnerAtlases,...firearmAtlases}));

export function v177JointCycleDistance(kind, renderScale) {
  const atlas = V177_JOINT_ATLASES[kind];
  return atlas && Number.isFinite(renderScale) && renderScale > 0
    ? atlas.cycleDistance / (atlas.referenceFrame?.scale??1) * renderScale : undefined;
}

export function v177JointPose(kind, sample, runtime, { ownedPose=false }={}) {
  const atlas = V177_JOINT_ATLASES[kind], state=sample?.requestedState;
  if (!atlas || ownedPose || (!locomotionStates.has(state) && !attackStates.has(state))) return null;
  const phase=cycle(runtime?.locomotionPhase);
  const phaseIndex=Math.floor(phase*atlas.frameCount) % atlas.frameCount;
  const settleIndex=Math.round(clamp(runtime?.locomotionSettle ?? 1)*(atlas.settleLevels-1));
  // The feet keep the last actual-travel phase through aiming and firing.
  // Only their lift settles to the floor; attacking never substitutes a
  // different fixed stance or advances a walking clock while stationary.
  const lowerIndex=settleIndex*atlas.frameCount+phaseIndex;
  let attackPhase=null;
  const [windupEnd,activeEnd]=atlas.attackBoundaries??[.28,.7];
  if(state==='wind-up')attackPhase=windupEnd*clamp(sample.clipProgress);
  else if(state==='active')attackPhase=windupEnd+(activeEnd-windupEnd)*clamp(sample.clipProgress);
  else if(state==='recovery')attackPhase=activeEnd+(1-activeEnd)*clamp(sample.clipProgress);
  if(atlas.type==='rigid-parts'){
    const attackFrame=(attackPhase??0)*atlas.frameCount,attackIndex=Math.floor(attackFrame);
    const nextPhase=(phaseIndex+1)%atlas.frameCount,blend=phase*atlas.frameCount-phaseIndex;
    return {lowerIndex,lowerNextIndex:settleIndex*atlas.frameCount+nextPhase,lowerBlend:blend,
      upperIndex:attackPhase===null?lowerIndex:atlas.lowerCount+attackIndex,
      upperNextIndex:attackPhase===null?settleIndex*atlas.frameCount+nextPhase:atlas.lowerCount+Math.min(atlas.frameCount,attackIndex+1),
      upperBlend:attackPhase===null?blend:attackFrame-attackIndex,phase,settleIndex,attackPhase,
      upperOffsetY:atlas.pelvisOffsets[settleIndex][phaseIndex]*(1-blend)+atlas.pelvisOffsets[settleIndex][nextPhase]*blend};
  }
  const upperIndex=atlas.lowerCount+(attackPhase===null ? 0 : 1+Math.round(attackPhase*atlas.frameCount));
  return {lowerIndex,upperIndex,phase,settleIndex,attackPhase,
    upperOffsetY:atlas.pelvisOffsets[settleIndex][phaseIndex]};
}

export function drawV177JointPose(ctx, image, kind, plan, x, y, width, height) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || !plan || !image?.naturalWidth)return false;
  if(atlas.type==='rigid-parts'){
    const matrix=new Float64Array(6);
    const scratch=atlas.armConstraints ? [new Float64Array(6),new Float64Array(6)] : null;
    const reference=atlas.referenceFrame;
    ctx.save();ctx.translate(x,y);ctx.scale(width/(reference?.width??atlas.width),height/(reference?.height??atlas.height));
    if(reference){ctx.translate(-reference.tx/reference.scale,-reference.ty/reference.scale);ctx.scale(1/reference.scale,1/reference.scale);}
    for(const part of atlas.parts){
      if(part.bone==='jaw'){
        ctx.fillStyle=atlas.mouth.color;ctx.beginPath();let started=false;
        for(const [bone,points]of [[atlas.mouth.headBone,atlas.mouth.upper],[atlas.mouth.jawBone,atlas.mouth.lower]]){
          jointMatrix(matrix,atlas,plan,bone,true);
          for(const [px,py]of points){const xx=matrix[0]*px+matrix[2]*py+matrix[4],yy=matrix[1]*px+matrix[3]*py+matrix[5];
            if(started)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);started=true;}
        }
        ctx.closePath();ctx.fill();
      }
      jointMatrix(matrix,atlas,plan,part.bone,part.upper,scratch);
      const s=part.source,d=part.destination;
      ctx.save();ctx.transform(...matrix);ctx.drawImage(image,s.x,s.y,s.w,s.h,d.x,d.y,d.w,d.h);ctx.restore();
    }
    ctx.restore();return true;
  }
  for(const [index,dy] of [[plan.lowerIndex,0],[plan.upperIndex,plan.upperOffsetY]]) {
    const {source:s,destination:d}=atlas.frames[index];
    ctx.drawImage(image,s.x,s.y,s.w,s.h,
      x+d.x/atlas.width*width,y+(d.y+dy)/atlas.height*height,
      d.w/atlas.width*width,d.h/atlas.height*height);
  }
  return true;
}

// Interpolate rigid transforms, rather than matrix coefficients that shorten
// limbs between samples. The actual Blender root travel was removed by bake.
function interpolatedMatrix(out,atlas,plan,bone,upper){
  const a=atlas.poses[upper?plan.upperIndex:plan.lowerIndex][bone];
  const b=atlas.poses[upper?plan.upperNextIndex:plan.lowerNextIndex][bone];
  const p=upper?plan.upperBlend:plan.lowerBlend,angleA=Math.atan2(a[1],a[0]),angleB=Math.atan2(b[1],b[0]);
  const delta=Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA)),angle=angleA+delta*p,c=Math.cos(angle),s=Math.sin(angle);
  out[0]=c;out[1]=s;out[2]=-s;out[3]=c;out[4]=a[4]+(b[4]-a[4])*p;
  out[5]=a[5]+(b[5]-a[5])*p+(upper&&plan.attackPhase!==null?plan.upperOffsetY:0);
  return out;
}

// Independent rigid interpolation can separate a wrist from its weapon between
// source keys. Resolve the authored two-bone chain against the same interpolated
// shoulder and painted hand, keeping both limb lengths and the grip intact.
function jointMatrix(out,atlas,plan,bone,upper,scratch){
  const arm=atlas.armConstraints?.find(a=>a.upperBone===bone||a.lowerBone===bone);
  if(!arm)return interpolatedMatrix(out,atlas,plan,bone,upper);
  const parent=scratch?.[0]??new Float64Array(6),effector=scratch?.[1]??new Float64Array(6);
  interpolatedMatrix(parent,atlas,plan,arm.parentBone,upper);
  interpolatedMatrix(effector,atlas,plan,arm.effectorBone,upper);
  const [sx,sy]=arm.shoulder,[ex,ey]=arm.elbow,[wx,wy]=arm.wrist;
  const hx=parent[0]*sx+parent[2]*sy+parent[4],hy=parent[1]*sx+parent[3]*sy+parent[5];
  const tx=effector[0]*wx+effector[2]*wy+effector[4],ty=effector[1]*wx+effector[3]*wy+effector[5];
  const dx=tx-hx,dy=ty-hy,d=Math.hypot(dx,dy),a=Math.hypot(ex-sx,ey-sy),b=Math.hypot(wx-ex,wy-ey);
  if(d<1e-8||d>a+b+.0001||d<Math.abs(a-b)-.0001)return interpolatedMatrix(out,atlas,plan,bone,upper);
  const along=(a*a+d*d-b*b)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  const sign=(ex-sx)*-(wy-sy)+(ey-sy)*(wx-sx)>=0?1:-1;
  const kx=hx+dx/d*along-dy/d*height*sign,ky=hy+dy/d*along+dx/d*height*sign;
  const isUpper=bone===arm.upperBone,rx=isUpper?sx:ex,ry=isUpper?sy:ey;
  const ax=isUpper?hx:kx,ay=isUpper?hy:ky,bx=isUpper?kx:tx,by=isUpper?ky:ty;
  const angle=Math.atan2(by-ay,bx-ax)-Math.atan2((isUpper?ey:wy)-ry,(isUpper?ex:wx)-rx),c=Math.cos(angle),s=Math.sin(angle);
  out[0]=c;out[1]=s;out[2]=-s;out[3]=c;out[4]=ax-c*rx+s*ry;out[5]=ay-s*rx-c*ry;
  return out;
}

export function v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose,x,y,bob=0,depthScale=1}) {
  const atlas=V177_JOINT_ATLASES[kind];
  if(!atlas || !plan || plan.attackPhase===null)return null;
  let px,py,dy=plan.upperOffsetY;
  if(atlas.type==='rigid-parts'){
    const m=jointMatrix(new Float64Array(6),atlas,plan,atlas.weaponBone,true),[sx,sy]=atlas.muzzle;
    px=m[0]*sx+m[2]*sy+m[4];py=m[1]*sx+m[3]*sy+m[5];dy=0;
  }else [px,py]=atlas.muzzles[plan.upperIndex-atlas.lowerCount];
  const reference=atlas.referenceFrame;
  if(reference){px=(px-reference.tx)/reference.scale;py=(py-reference.ty)/reference.scale;dy/=reference.scale;}
  const facing=direction==='left'?-1:1;
  const lx=(px/(reference?.width??atlas.width)-frame.anchorX)*size.w*(frame.flipX?-1:1)*pose.scaleX;
  const ly=((py+dy)/(reference?.height??atlas.height)-frame.anchorY)*size.h*pose.scaleY;
  const angle=pose.rotationRadians*facing,c=Math.cos(angle),s=Math.sin(angle);
  return {x:x+pose.offsetX*depthScale*facing+lx*c-ly*s,
    y:y-bob+pose.offsetY*depthScale+lx*s+ly*c};
}
