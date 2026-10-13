import { V177_JOINT_ATLASES, v177CaptureJointPose, v177InterpolateCapturedJointPose,
  drawV177ResolvedJointPose } from './v177JointPresentation.js';
import { V177_CORPSE_JOINT_DATA } from './v177CorpseJointData.js';
import { v102CorpseSeverPlan, drawV102JointCorpseWound } from './v102CombatGore.js';

const worlds=new WeakMap();
const clamp=p=>Math.max(0,Math.min(1,Number(p)||0));
const ease=p=>{p=clamp(p);return p*p*(3-2*p);};
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const rotate=([x,y],angle)=>[Math.cos(angle)*x-Math.sin(angle)*y,Math.sin(angle)*x+Math.cos(angle)*y];
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const rootMatrix=root=>{const c=Math.cos(root.angle),s=Math.sin(root.angle),x=root.scaleX*(root.flipX?-1:1);
  return [c*x,s*x,-s*root.scaleY,c*root.scaleY,root.x,root.y];};
const extent=points=>({left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
  top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))});

function fragmentRestAngle(points,direction) {
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lo=[],hi=[];
  for(const p of sorted){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
  for(const p of sorted.toReversed()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}
  const hull=lo.slice(0,-1).concat(hi.slice(0,-1));let best={height:Infinity,turn:Infinity,angle:0};
  for(let i=0;i<hull.length;i++) {
    const a=hull[i],b=hull[(i+1)%hull.length],base=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    const box=extent(hull.map(p=>rotate(p,base))),height=box.bottom-box.top;
    for(let n=-2;n<=2;n++) {
      const angle=base+n*Math.PI,turn=Math.abs(angle-direction*2.4);
      if(height<best.height-1e-8 || Math.abs(height-best.height)<=1e-8&&turn<best.turn)best={height,turn,angle};
    }
  }
  return best.angle;
}

export function rememberV177CorpseJointPose(world,id,kind,plan,rendered) {
  if(!world || !V177_CORPSE_JOINT_DATA[kind])return;
  let state=worlds.get(world);if(!state){state={live:new Map(),corpses:new Map()};worlds.set(world,state);}
  // A source-owned special action cannot be replaced by a stale earlier rig.
  if(!plan){state.live.delete(id);return;}
  state.live.set(id,{kind,plan,frame:rendered.frame,width:rendered.width,height:rendered.height,
    root:{x:rendered.x,y:rendered.y,angle:rendered.angle,scaleX:rendered.scaleX,scaleY:rendered.scaleY,flipX:rendered.flipX}});
}

export function pruneV177CorpseJointPoses(world) {
  const state=worlds.get(world);if(!state)return;
  const alive=new Set((world.fighters??[]).map(f=>f.id)),dead=new Set((world.corpses??[]).map(c=>c.id));
  for(const id of state.live.keys())if(!alive.has(id)&&!dead.has(id))state.live.delete(id);
  for(const id of state.corpses.keys())if(!dead.has(id))state.corpses.delete(id);
}

function partPoint(state,matrices,index,source) {
  const p=point(matrices[index],source),r=state.atlas.referenceFrame;
  return [(p[0]-r.tx)/r.scale/r.width*state.width-state.frame.anchorX*state.width,
    (p[1]-r.ty)/r.scale/r.height*state.height-state.frame.anchorY*state.height];
}
function posedPoint(local,root) {
  const p=rotate([local[0]*root.scaleX*(root.flipX?-1:1),local[1]*root.scaleY],root.angle);
  return [p[0]+root.x,p[1]+root.y];
}
function outlinePoints(state,matrices,root,onlyParts,omitParts) {
  const points=[];
  for(let i=0;i<state.atlas.parts.length;i++) {
    const name=state.atlas.parts[i].name;if((onlyParts&&!onlyParts.has(name))||omitParts?.has(name))continue;
    for(const p of state.data.outlines[i].hull)points.push(posedPoint(partPoint(state,matrices,i,p),root));
  }
  return points;
}
function probePoint(state,matrices,root,probe) {
  const index=state.atlas.parts.findIndex(p=>p.bone===probe.bone);
  return posedPoint(partPoint(state,matrices,index,probe.pixel),root);
}
function woundsFor(atlas,owned,head) {
  if(head){const a=atlas.parentAttachments.head;return {
    body:[{bone:a.parent,pixel:a.pivot}],fragment:[{bone:'head',pixel:a.pivot}],
  };}
  const bones=new Set(atlas.parts.filter(p=>owned.has(p.name)).map(p=>p.bone));
  const chains=atlas.armConstraints.filter(c=>bones.has(c.effectorBone));
  return {body:chains.map(c=>({bone:c.lowerBone,pixel:c.wrist})),
    fragment:chains.map(c=>({bone:c.effectorBone,pixel:c.effectorWrist??c.wrist}))};
}

export function createV177CorpseJointState(kind,live,{fallDirection=-1,severPlan=null}={}) {
  const atlas=V177_JOINT_ATLASES[kind],data=V177_CORPSE_JOINT_DATA[kind];
  if(!live || live.kind!==kind || !atlas || !data || atlas.path!==data.atlasPath
    || data.outlines.length!==atlas.parts.length || data.outlines.some((o,i)=>o.name!==atlas.parts[i].name))return null;
  const initial=v177CaptureJointPose(kind,live.plan);if(!initial)return null;
  const side=fallDirection*(live.root.flipX?-1:1),finalPose={...atlas.poses[0],...data.falls[String(side)]};
  const state={kind,atlas,data,initial,finalPose,frame:live.frame,width:live.width,height:live.height,
    initialRoot:{...live.root},fallDirection,severPlan,owned:null,fragment:null};
  state.initialMatrices=v177InterpolateCapturedJointPose(kind,initial,finalPose,0);
  if(severPlan) {
    const head=severPlan.style==='cut'||severPlan.style==='saw';
    state.owned=new Set(head?data.severedParts.head:data.severedParts.impact);
    const points=outlinePoints(state,state.initialMatrices,state.initialRoot,state.owned),bounds=extent(points);
    const center=[(bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2],wounds=woundsFor(atlas,state.owned,head);
    state.fragment={points,center,head,wounds,restAngle:fragmentRestAngle(points,severPlan.direction),
      woundPoints:wounds.fragment.map(p=>probePoint(state,state.initialMatrices,state.initialRoot,p))};
  }
  const localRoot={...state.initialRoot,x:0,y:0};
  state.initialSupport=extent(outlinePoints(state,state.initialMatrices,localRoot,null,state.owned)).bottom;
  return state;
}

export function sampleV177CorpseJointState(state,{progress,x,y,age=0,ashScaleX=1,ashScaleY=1}={}) {
  if(!state)return null;
  const p=ease(progress),floor=y+5,matrices=v177InterpolateCapturedJointPose(state.kind,state.initial,state.finalPose,p);
  const root={...state.initialRoot,x:0,y:0,angle:state.initialRoot.angle+(state.fallDirection*Math.PI/2-state.initialRoot.angle)*p,
    scaleX:state.initialRoot.scaleX*ashScaleX,scaleY:state.initialRoot.scaleY*ashScaleY};
  const support=extent(outlinePoints(state,matrices,root,null,state.owned)).bottom;
  const initialY=state.initialRoot.y,allowance=(1-p)*Math.max(0,initialY+state.initialSupport-floor);
  root.x=state.initialRoot.x+(x-state.initialRoot.x)*p;
  root.y=Math.min(initialY+(floor-support-initialY)*p,floor-support+allowance);
  const sample={state,matrices,root,matrix:rootMatrix(root),progress:p,floor,groundSupportY:support,groundError:root.y+support-floor,
    bodyWounds:state.fragment?state.fragment.wounds.body.map(probe=>probePoint(state,matrices,root,probe)):[],fragment:null};
  if(state.fragment) {
    const fragment=state.fragment,t=clamp(age/.42),s=ease(t),direction=state.severPlan.direction,
      angle=fragment.restAngle*s,height=state.height*Math.abs(state.initialRoot.scaleY);
    const transformed=fragment.points.map(q=>rotate([(q[0]-fragment.center[0])*ashScaleX,(q[1]-fragment.center[1])*ashScaleY],angle));
    const support=extent(transformed).bottom,cx=fragment.center[0]+direction*s*height*.2;
    const cy=Math.min(fragment.center[1]+(floor-support-fragment.center[1])*s-Math.sin(t*Math.PI)*height*.18,floor-support);
    const c=Math.cos(angle),sn=Math.sin(angle),outer=[c*ashScaleX,sn*ashScaleX,-sn*ashScaleY,c*ashScaleY,cx,cy];
    const matrix=multiply(multiply(outer,[1,0,0,1,-fragment.center[0],-fragment.center[1]]),rootMatrix(state.initialRoot));
    sample.fragment={x:cx,y:cy,angle,ashScaleX,ashScaleY,matrix,progress:t,groundError:cy+support-floor,
      wounds:fragment.woundPoints.map(q=>{const p=rotate([(q[0]-fragment.center[0])*ashScaleX,(q[1]-fragment.center[1])*ashScaleY],angle);return [p[0]+cx,p[1]+cy];})};
  }
  return sample;
}

export function v177CorpseJointPresentation(world,corpse,kind,{progress,fallDirection,ashScaleX=1,ashScaleY=1}={}) {
  if(corpse.side!=='zombie')return null;
  const cache=worlds.get(world),live=cache?.live.get(corpse.id);if(!live||live.kind!==kind)return null;
  let state=cache.corpses.get(corpse.id);
  if(!state){
    const severPlan=v102CorpseSeverPlan(world,corpse,live.frame,live.width,live.height);
    state=createV177CorpseJointState(kind,live,{fallDirection,severPlan});if(!state)return null;
    cache.corpses.set(corpse.id,state);
  }
  return sampleV177CorpseJointState(state,{progress,x:corpse.x,y:corpse.y,
    age:state.severPlan?world.time-state.severPlan.at:0,ashScaleX,ashScaleY});
}

export function drawV177CorpseJointPresentation(ctx,image,sample,objects={}) {
  if(!sample || !image?.naturalWidth)return false;
  const s=sample.state,dx=-s.width*s.frame.anchorX,dy=-s.height*s.frame.anchorY;
  ctx.save();ctx.transform(...sample.matrix);
  const drawn=drawV177ResolvedJointPose(ctx,image,s.kind,sample.matrices,dx,dy,s.width,s.height,{omitParts:s.owned});
  ctx.restore();if(!drawn)return false;
  const radius=Math.max(2,Math.min(5.5,s.height*.025));
  for(const [x,y]of sample.bodyWounds)drawV102JointCorpseWound(ctx,s.severPlan,x,y,radius,objects);
  if(sample.fragment) {
    const f=sample.fragment;ctx.save();ctx.transform(...f.matrix);
    drawV177ResolvedJointPose(ctx,image,s.kind,s.initialMatrices,dx,dy,s.width,s.height,{onlyParts:s.owned});ctx.restore();
    for(const [x,y]of f.wounds)drawV102JointCorpseWound(ctx,s.severPlan,x,y,radius,objects,true);
  }
  return true;
}
