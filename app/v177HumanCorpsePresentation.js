import { V177_JOINT_ATLASES, drawV177JointPose, v177CaptureJointPose,
  v177InterpolateCapturedJointPose, v177CaptureRangerPaint } from './v177JointPresentation.js';
import { v177RangerLowerPose } from './v177RangerLowerMotion.js';
import { PLAYABLE_COMBAT_KINDS } from './combatPresentation.js';

// Brawler already owns a source-bound articulated fall. Mayo survives through
// its protected knockdown owner. The other allies shared the instant prone cell.
export const V177_CONTINUOUS_HUMAN_CORPSE_KINDS=Object.freeze(
  PLAYABLE_COMBAT_KINDS.filter(kind=>!['brawler','mayo-chan'].includes(kind)));
const kinds=new Set(V177_CONTINUOUS_HUMAN_CORPSE_KINDS),worlds=new WeakMap();
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const box=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const ease=p=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p);};

export function rememberV177HumanCorpsePaint(world,actor,kind,paint) {
  if(!world||actor?.side!=='human'||!kinds.has(kind))return;
  let cache=worlds.get(world);
  if(!cache){cache={live:new Map(),dead:new Map()};worlds.set(world,cache);}
  // Called after the successful body paint, including a source-owned special
  // sprite. A missing paint must never borrow the earlier walking rig.
  if(!paint?.image?.naturalWidth){cache.live.delete(actor.id);return;}
  cache.live.set(actor.id,{...paint,kind,paintedAt:world.time});
}

export function pruneV177HumanCorpsePaints(world) {
  const cache=worlds.get(world);if(!cache)return;
  const live=new Set((world.fighters??[]).map(f=>f.id)),dead=new Set((world.corpses??[]).map(c=>c.id));
  for(const id of cache.live.keys())if(!live.has(id)&&!dead.has(id))cache.live.delete(id);
  for(const id of cache.dead.keys())if(!dead.has(id))cache.dead.delete(id);
}

function localBounds(paint) {
  const {kind,plan,frame,width,height}=paint,atlas=V177_JOINT_ATLASES[kind];let points=[];
  if(plan&&kind==='ranger') {
    const pose=v177RangerLowerPose(atlas.lowerRig,plan.phase,plan.lowerSettle,undefined,plan.lowerFootTargets);
    for(const part of atlas.lowerRig.parts) {
      const mesh=pose.meshes[part.name],d=part.destination;
      points.push(...(mesh?Array.from({length:mesh.length/2},(_,i)=>[mesh[i*2],mesh[i*2+1]])
        :box(d.x,d.y,d.w,d.h).map(p=>point(pose.matrices[part.bone],p))));
    }
    for(const part of atlas.upperRig.parts) {
      const d=part.destination,m=plan.rangerStunUpperPose[part.bone];
      points.push(...box(d.x,d.y,d.w,d.h).map(p=>{const q=point(m,p);return [q[0],q[1]+plan.upperOffsetY];}));
    }
    points=points.map(([x,y])=>[x/atlas.width*width-frame.anchorX*width,y/atlas.height*height-frame.anchorY*height]);
  } else if(plan) {
    const initial=v177CaptureJointPose(kind,plan),matrices=v177InterpolateCapturedJointPose(kind,initial,atlas.poses[0],0);
    if(!matrices)return null;
    const r=atlas.referenceFrame??{width:atlas.width,height:atlas.height,scale:1,tx:0,ty:0};
    for(let i=0;i<atlas.parts.length;i++) {
      const d=atlas.parts[i].destination;
      points.push(...box(d.x,d.y,d.w,d.h).map(p=>point(matrices[i],p)).map(([x,y])=>[
        (x-r.tx)/r.scale/r.width*width-frame.anchorX*width,(y-r.ty)/r.scale/r.height*height-frame.anchorY*height]));
    }
  } else points=box(-frame.anchorX*width,-frame.anchorY*height,width,height);
  if(!points.length||points.some(p=>!p.every(Number.isFinite)))return null;
  return {left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
    top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
}

function drawPaint(ctx,paint,receipt={}) {
  const {image,kind,plan,frame,width,height}=paint;
  if(plan) {
    const drawn=drawV177JointPose(ctx,image,kind,plan,-width*frame.anchorX,-height*frame.anchorY,width,height,{paintReceipt:receipt});
    return drawn&&(kind!=='ranger'||receipt.lower?.mode==='continuous-weighted-mesh'
      &&receipt.lower.meshVertices===130&&receipt.lower.meshTriangles===192&&receipt.lower.degenerate===0);
  }
  for(const s of frame.drawSlices??[{x:0,y:0,w:frame.sourceRect.w,h:frame.sourceRect.h}])ctx.drawImage(image,
    frame.sourceRect.x+s.x,frame.sourceRect.y+s.y,s.w,s.h,
    -width*frame.anchorX+width*s.x/frame.sourceRect.w,-height*frame.anchorY+height*s.y/frame.sourceRect.h,
    width*s.w/frame.sourceRect.w,height*s.h/frame.sourceRect.h);
  return true;
}

function hull(points) {
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lo=[],hi=[];
  for(const p of sorted){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
  for(const p of sorted.toReversed()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}
  return lo.slice(0,-1).concat(hi.slice(0,-1));
}

// One bounded readback at the actual death entry. It measures the painted
// weighted silhouette as well as rigid parts, without changing living floors
// or retaining a bitmap per corpse. All subsequent paints use the same source.
export function createV177HumanCorpsePaint(live,createCanvas=()=>live.image.ownerDocument?.createElement('canvas')??globalThis.document?.createElement('canvas')) {
  let canvas;
  try {
  const {image,...values}=live,paint={...structuredClone(values),image};
  if(paint.plan&&paint.kind==='ranger')paint.plan=v177CaptureRangerPaint(paint.plan);
  const bounds=localBounds(paint);if(!bounds)return null;
  const scale=paint.pixelScale;
  if(!(Number.isFinite(scale)&&scale>0))return null;
  const left=Math.floor(bounds.left*scale)-2,top=Math.floor(bounds.top*scale)-2;
  const width=Math.ceil(bounds.right*scale)-left+2,height=Math.ceil(bounds.bottom*scale)-top+2;
  if(width*height>262144||width<=0||height<=0)return null;
  canvas=createCanvas();if(!canvas?.getContext)return null;
  canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
    ctx.setTransform(scale,0,0,scale,-left,-top);
    if(!drawPaint(ctx,paint))return null;
    const rgba=ctx.getImageData(0,0,width,height).data,points=[];
    for(let x=0;x<width;x++) {
      let first=height,last=-1;
      for(let y=0;y<height;y++)if(rgba[(y*width+x)*4+3]>=8){first=Math.min(first,y);last=Math.max(last,y);}
      if(last>=0)points.push(...box((left+x)/scale,(top+first)/scale,1/scale,(last-first+1)/scale));
    }
    if(points.length<4)return null;
    return {...paint,outline:hull(points),outlinePixels:width*height,alphaThreshold:8};
  } catch { return null; }
  finally {if(canvas){canvas.width=1;canvas.height=1;}}
}

export function sampleV177HumanCorpsePaint(paint,{progress,x,y,tremorX=0,tremorY=0,scaleY=1,jitter=0}={}) {
  if(!paint)return null;
  const p=ease(progress),initial=paint.root,angle=initial.angle+(paint.fallDirection*Math.PI/2-initial.angle)*p+jitter;
  const c=Math.cos(angle),s=Math.sin(angle),sx=initial.scaleX*(initial.flipX?-1:1),sy=initial.scaleY*scaleY;
  const support=Math.max(...paint.outline.map(([px,py])=>s*px*sx+c*py*sy)),floor=y+5;
  const initialSupport=Math.max(...paint.outline.map(([px,py])=>Math.sin(initial.angle)*px*sx+Math.cos(initial.angle)*py*initial.scaleY));
  const contactFloor=floor+(initial.y+initialSupport-floor)*(1-p);
  const root={...initial,x:initial.x+(x-initial.x)*p+tremorX,
    y:Math.min(initial.y+(floor-support-initial.y)*p,contactFloor-support)+tremorY,angle,scaleY:sy};
  return {paint,root,progress:p,support,floor,groundError:root.y+support-floor,drawReceipt:{},
    matrix:[c*sx,s*sx,-s*sy,c*sy,root.x,root.y]};
}

export function v177HumanCorpsePresentation(world,corpse,kind,options) {
  if(corpse.side!=='human'||!kinds.has(kind))return null;
  const cache=worlds.get(world),live=cache?.live.get(corpse.id);if(!live||live.kind!==kind)return null;
  if(!cache.dead.has(corpse.id))cache.dead.set(corpse.id,createV177HumanCorpsePaint({...live,fallDirection:options.fallDirection}));
  return sampleV177HumanCorpsePaint(cache.dead.get(corpse.id),{...options,x:corpse.x,y:corpse.y});
}

export function drawV177HumanCorpsePaint(ctx,sample) {
  if(!sample)return false;
  ctx.save();ctx.transform(...sample.matrix);const drawn=drawPaint(ctx,sample.paint,sample.drawReceipt);ctx.restore();return drawn;
}
