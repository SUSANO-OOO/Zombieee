import { V177_JOINT_ATLASES as bakedAtlases } from './v177JointData.js';
import { V177_QUADRUPED_JOINT_ATLASES as quadrupedAtlases } from './v177QuadrupedJointData.js';
import { V177_BIPED_JOINT_ATLASES as bipedAtlases } from './v177BipedJointData.js';
import { V177_ENEMY_JOINT_ATLASES as enemyAtlases } from './v177EnemyJointData.js';
import { V177_RUNNER_JOINT_ATLASES as runnerAtlases } from './v177RunnerJointData.js';
import { V177_FIREARM_JOINT_ATLASES as firearmAtlases } from './v177FirearmJointData.js';
import { V177_PANTHER_JOINT_ATLASES as pantherAtlases } from './v177PantherJointData.js';
import { V177_MELEE_JOINT_ATLASES as meleeAtlases } from './v177MeleeJointData.js';
import { V177_GUARD_ENEMY_JOINT_ATLASES as guardEnemyAtlases } from './v177GuardEnemyJointData.js';
import { V177_NEWCOMER_JOINT_ATLASES as newcomerAtlases } from './v177NewcomerJointData.js';
import { V177_INFECTED_JOINT_ATLASES as infectedAtlases } from './v177InfectedJointData.js';
import { V177_FERAL_JOINT_ATLASES as feralAtlases } from './v177FeralJointData.js';
import { V177_FUTAGO_JOINT_ATLASES as futagoAtlases } from './v177FutagoJointData.js';

const locomotionStates = new Set(['idle','move','start-move','stop-move','turn','retreat']);
const attackStates = new Set(['wind-up','active','recovery']);
const recoveryStates = new Set(['reload','weapon-cycle']);
const clamp = p => Math.max(0, Math.min(1, Number(p) || 0));
const cycle = p => ((Number(p) || 0) % 1 + 1) % 1;

export const V177_JOINT_ATLASES = Object.fromEntries(Object.entries({...bakedAtlases,...quadrupedAtlases,...bipedAtlases,...enemyAtlases,...runnerAtlases,...firearmAtlases,...pantherAtlases,...meleeAtlases,...guardEnemyAtlases,...newcomerAtlases,...infectedAtlases,...feralAtlases,...futagoAtlases}));

export function v177JointCycleDistance(kind, renderScale) {
  const atlas = V177_JOINT_ATLASES[kind];
  return atlas && Number.isFinite(renderScale) && renderScale > 0
    ? atlas.cycleDistance / (atlas.referenceFrame?.scale??1) * renderScale : undefined;
}

export function v177JointPose(kind, sample, runtime, { ownedPose=false }={}) {
  const atlas = V177_JOINT_ATLASES[kind], state=sample?.requestedState;
  if (!atlas || ownedPose || (!locomotionStates.has(state) && !attackStates.has(state) && !recoveryStates.has(state))) return null;
  const variant=sample?.attackVariant ? atlas.attackVariants?.[sample.attackVariant] : null;
  if(sample?.attackVariant && !variant)return null;
  const phase=cycle(runtime?.locomotionPhase);
  const phaseIndex=Math.floor(phase*atlas.frameCount) % atlas.frameCount;
  const settleIndex=Math.round(clamp(runtime?.locomotionSettle ?? 1)*(atlas.settleLevels-1));
  // The feet keep the last actual-travel phase through aiming and firing.
  // Only their lift settles to the floor; attacking never substitutes a
  // different fixed stance or advances a walking clock while stationary.
  const lowerIndex=settleIndex*atlas.frameCount+phaseIndex;
  let attackPhase=null;
  const [windupEnd,activeEnd]=variant?.attackBoundaries??atlas.attackBoundaries??[.28,.7];
  if(state==='wind-up')attackPhase=windupEnd*clamp(sample.clipProgress);
  else if(state==='active')attackPhase=windupEnd+(activeEnd-windupEnd)*clamp(sample.clipProgress);
  else if(state==='recovery')attackPhase=activeEnd+(1-activeEnd)*clamp(sample.clipProgress);
  // Real firing cadence can enter reload between shots. Keep the same body,
  // settled feet and source-bound hands while the weapon lowers and returns
  // to its ready baseline, rather than swapping to a legacy static frame.
  else if(recoveryStates.has(state))attackPhase=activeEnd+(1-activeEnd)*clamp(sample.clipProgress);
  if(atlas.type==='rigid-parts'){
    const attackBase=variant?.startIndex??atlas.lowerCount;
    const attackFrame=(attackPhase??0)*atlas.frameCount,attackIndex=Math.floor(attackFrame);
    const nextPhase=(phaseIndex+1)%atlas.frameCount,blend=phase*atlas.frameCount-phaseIndex;
    return {lowerIndex,lowerNextIndex:settleIndex*atlas.frameCount+nextPhase,lowerBlend:blend,
      upperIndex:attackPhase===null?lowerIndex:attackBase+attackIndex,
      upperNextIndex:attackPhase===null?settleIndex*atlas.frameCount+nextPhase:attackBase+Math.min(atlas.frameCount,attackIndex+1),
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
    const scratch=atlas.armConstraints || atlas.legConstraints ? [new Float64Array(6),new Float64Array(6)] : null;
    const reference=atlas.referenceFrame;
    ctx.save();if(atlas.paintStyle==='pixel-art')ctx.imageSmoothingEnabled=false;
    ctx.translate(x,y);ctx.scale(width/(reference?.width??atlas.width),height/(reference?.height??atlas.height));
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
function interpolatedMatrix(out,atlas,plan,bone,upper,applyUpperOffset=true){
  const attachment=atlas.parentAttachments?.[bone];let anchorX,anchorY;
  if(attachment){
    interpolatedMatrix(out,atlas,plan,attachment.parent,upper,false);
    const [px,py]=attachment.pivot;
    anchorX=out[0]*px+out[2]*py+out[4];anchorY=out[1]*px+out[3]*py+out[5];
  }
  const a=atlas.poses[upper?plan.upperIndex:plan.lowerIndex][bone];
  const b=atlas.poses[upper?plan.upperNextIndex:plan.lowerNextIndex][bone];
  const p=upper?plan.upperBlend:plan.lowerBlend,angleA=Math.atan2(a[1],a[0]),angleB=Math.atan2(b[1],b[0]);
  const delta=Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA)),angle=angleA+delta*p,c=Math.cos(angle),s=Math.sin(angle);
  out[0]=c;out[1]=s;out[2]=-s;out[3]=c;
  // A source-bound soft organ can inflate; the head, torso and limb bones
  // retain the existing rigid path. Never interpolate limb scale.
  if(atlas.softBones?.[bone]){
    const sx=Math.hypot(a[0],a[1])+(Math.hypot(b[0],b[1])-Math.hypot(a[0],a[1]))*p;
    const sy=Math.hypot(a[2],a[3])+(Math.hypot(b[2],b[3])-Math.hypot(a[2],a[3]))*p;
    out[0]*=sx;out[1]*=sx;out[2]*=sy;out[3]*=sy;
  }
  const pivot=atlas.interpolationPivots?.[bone];
  if(pivot){
    // A fast swing must interpolate its authored grip, rather than the
    // translation of the distant image origin. Otherwise the grip can arc
    // outside the arm's fixed reach between two perfectly valid source keys.
    const [px,py]=pivot,ax=a[0]*px+a[2]*py+a[4],ay=a[1]*px+a[3]*py+a[5];
    const bx=b[0]*px+b[2]*py+b[4],by=b[1]*px+b[3]*py+b[5];
    out[4]=ax+(bx-ax)*p-c*px+s*py;out[5]=ay+(by-ay)*p-s*px-c*py;
    if(atlas.softBones?.[bone]){
      out[4]=ax+(bx-ax)*p-out[0]*px-out[2]*py;
      out[5]=ay+(by-ay)*p-out[1]*px-out[3]*py;
    }
    // Child jaw/throat paint follows the interpolated head anchor exactly.
    // Independently interpolating two world-space pivots can detach a hinge.
    if(attachment){
      out[4]=anchorX-out[0]*px-out[2]*py;out[5]=anchorY-out[1]*px-out[3]*py;
    }
  }else{
    out[4]=a[4]+(b[4]-a[4])*p;out[5]=a[5]+(b[5]-a[5])*p;
  }
  if(applyUpperOffset&&upper&&plan.attackPhase!==null)out[5]+=plan.upperOffsetY;
  return out;
}

// Resolve authored two-bone chains against the same interpolated endpoints.
// A planted quadruped paw retains the travel/settling pose while its hip follows
// the attacking torso. Independent limb interpolation can detach the knee or paw.
// Bipeds with a separately painted lower pelvis keep that pelvis as the hip
// owner while the upper torso leans; the feet never follow the attack pose.
function jointMatrix(out,atlas,plan,bone,upper,scratch){
  const chain=atlas.armConstraints?.find(a=>a.upperBone===bone||a.lowerBone===bone)
    ??atlas.legConstraints?.find(a=>a.upperBone===bone||a.lowerBone===bone);
  if(!chain)return interpolatedMatrix(out,atlas,plan,bone,upper);
  const leg=Boolean(chain.hip);
  const parent=scratch?.[0]??new Float64Array(6),effector=scratch?.[1]??new Float64Array(6);
  interpolatedMatrix(parent,atlas,plan,chain.parentBone,leg?chain.parentUpper!==false:upper);
  interpolatedMatrix(effector,atlas,plan,chain.effectorBone,leg?false:upper);
  const [sx,sy]=chain.hip??chain.shoulder,[ex,ey]=chain.knee??chain.elbow,[wx,wy]=chain.ankle??chain.wrist;
  // A supporting hand can come from an approved two-hand attack frame while
  // the arm retains its original neutral anatomy and visible sleeve paint.
  const [twx,twy]=chain.effectorWrist??chain.ankle??chain.wrist;
  const hx=parent[0]*sx+parent[2]*sy+parent[4],hy=parent[1]*sx+parent[3]*sy+parent[5];
  const tx=effector[0]*twx+effector[2]*twy+effector[4],ty=effector[1]*twx+effector[3]*twy+effector[5];
  const dx=tx-hx,dy=ty-hy,d=Math.hypot(dx,dy),a=Math.hypot(ex-sx,ey-sy),b=Math.hypot(wx-ex,wy-ey);
  if(d<1e-8||d>a+b+.0001||d<Math.abs(a-b)-.0001)return interpolatedMatrix(out,atlas,plan,bone,upper);
  const along=(a*a+d*d-b*b)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  const sign=(ex-sx)*-(wy-sy)+(ey-sy)*(wx-sx)>=0?1:-1;
  const kx=hx+dx/d*along-dy/d*height*sign,ky=hy+dy/d*along+dx/d*height*sign;
  const isUpper=bone===chain.upperBone,rx=isUpper?sx:ex,ry=isUpper?sy:ey;
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
