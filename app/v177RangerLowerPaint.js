import {createV177RangerLowerPose,v177RangerLowerPose} from './v177RangerLowerMotion.js';

const painters=new WeakMap(),MAX_PIXELS=65536;
const paintCounts={createdPainters:0,rasterizedDraws:0,reusedDraws:0};
export const getV177RangerLowerPaintSnapshot=()=>({...paintCounts});
const samples=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
const topLeft=(ax,ay,bx,by)=>by<ay||(by===ay&&bx>ax);
const owned=(v,edge)=>v>1e-10||(Math.abs(v)<=1e-10&&edge);
const createRaster=(parts,canvas,context)=>({valid:false,width:0,height:0,duplicateWithinPart:0,degenerate:0,imageData:null,canvas,context,
  parts:parts.map(part=>({part,target:new Float64Array(part.target.length)}))});
const invalidateRasters=p=>{for(const raster of p.rasters)raster.valid=false;};

// One source read per original crop. At most two bounded surfaces retain the
// exact raster payloads, so selecting a cached owner needs no pixel upload.
// Image ownership releases all buffers when the installed sprite is released.
export function createV177RangerLowerPainter(image,rig,createCanvas=()=>image.ownerDocument?.createElement('canvas')??globalThis.document?.createElement('canvas')) {
  const canvas=createCanvas();if(!canvas?.getContext)return null;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;
  const parts=rig.parts.map(part=>{
    const s=part.source,d=part.destination;canvas.width=s.w;canvas.height=s.h;
    context.clearRect(0,0,s.w,s.h);context.drawImage(image,s.x,s.y,s.w,s.h,0,0,s.w,s.h);
    const data=context.getImageData(0,0,s.w,s.h).data,leg=rig.legs.find(l=>l.name===part.name);
    // Cache the exact binary64 divisions once. Keep the original per-sample
    // alpha*weight, channel*amount and Float32 compositing order unchanged.
    const normalized=Float64Array.from(data,value=>value/255);
    const uv=new Float64Array(leg?.sourcePositions??[d.x,d.y,d.x+d.w,d.y,d.x+d.w,d.y+d.h,d.x,d.y+d.h]);
    const indices=new Uint16Array(leg?.triangles??[0,1,2,0,2,3]);
    return {name:part.name,bone:part.bone,rect:d,data,normalized,uv,leg,indices,rasterIndices:indices.slice(),target:new Float64Array(uv.length)};
  });
  paintCounts.createdPainters++;
  const lastRaster=createRaster(parts,canvas,context);
  return {canvas,context,parts,pose:createV177RangerLowerPose(rig),rig,width:0,height:0,sample:null,accum:null,visits:null,imageData:null,
    createCanvas,lastRaster,rasters:[lastRaster]};
}
function ensureCapacity(p,w,h) {
  let width=Math.max(p.width,w),height=Math.max(p.height,h);
  if(width*height>MAX_PIXELS){if(w*h>MAX_PIXELS){invalidateRasters(p);return false;}width=w;height=h;}
  if(width===p.width&&height===p.height)return true;
  invalidateRasters(p);
  const sample=new Float32Array(width*height*4),accum=new Float32Array(width*height*4),visits=new Uint8Array(width*height);
  const imageData=p.context.createImageData(width,height);
  const lastRaster=createRaster(p.parts,p.canvas,p.context);lastRaster.imageData=imageData;
  // Allocate before releasing old owners. A failed growth must leave the
  // invalidated old-size surfaces intact so the next small draw can recover.
  for(const raster of p.rasters)if(raster.canvas!==p.canvas){raster.canvas.width=0;raster.canvas.height=0;}
  p.width=width;p.height=height;p.canvas.width=width;p.canvas.height=height;
  p.sample=sample;p.accum=accum;p.visits=visits;
  p.lastRaster=lastRaster;p.rasters=[lastRaster];
  p.imageData=imageData;p.lastRaster.imageData=imageData;return true;
}
function triangleArea(v,a,b,c) {
  return (v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1])-(v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
}
function selectPartDiagonals(g) {
  const source=g.indices,indices=g.rasterIndices,v=g.target;indices.set(source);
  for(let i=0;i+5<source.length;i+=6){
    const a=source[i],b=source[i+1],c=source[i+2],d=source[i+5];
    if(source[i+3]!==a||source[i+4]!==c)continue;
    const first=triangleArea(v,a,b,c),second=triangleArea(v,a,c,d);
    if(Math.abs(first)<1e-12||Math.abs(second)<1e-12||first*second>=0)continue;
    // A bent cloth quad can become concave while keeping its four vertices.
    // Use its interior diagonal only when both alternate faces agree in winding.
    // A crossed or collapsed quad keeps the original failure visible.
    const alternateFirst=triangleArea(v,a,b,d),alternateSecond=triangleArea(v,b,c,d);
    if(Math.abs(alternateFirst)>=1e-12&&Math.abs(alternateSecond)>=1e-12&&alternateFirst*alternateSecond>0){
      indices[i+2]=d;indices[i+3]=b;
    }
  }
}
function rasterPart(p,g,w,h,ox,oy,stats) {
  p.visits.fill(0,0,w*h);
  for(let ti=0;ti<g.rasterIndices.length;ti+=3){
    let ia=g.rasterIndices[ti]*2,ib=g.rasterIndices[ti+1]*2,ic=g.rasterIndices[ti+2]*2;
    let ax=g.target[ia],ay=g.target[ia+1],bx=g.target[ib],by=g.target[ib+1],cx=g.target[ic],cy=g.target[ic+1];
    let area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<1e-12){stats.degenerate++;continue;}
    if(area<0){const index=ib;ib=ic;ic=index;const x=bx,y=by;bx=cx;by=cy;cx=x;cy=y;area=-area;}
    const abTop=topLeft(ax,ay,bx,by),bcTop=topLeft(bx,by,cx,cy),caTop=topLeft(cx,cy,ax,ay);
    const xmin=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-ox)),xmax=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-ox));
    const ymin=Math.max(0,Math.ceil(Math.min(ay,by,cy)-oy)),ymax=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-oy));
    for(let py=ymin;py<=ymax;py++)for(let px=xmin;px<=xmax;px++){
      const x=px+ox,y=py+oy,ab=(bx-ax)*(y-ay)-(by-ay)*(x-ax),bc=(cx-bx)*(y-by)-(cy-by)*(x-bx),ca=(ax-cx)*(y-cy)-(ay-cy)*(x-cx);
      if(!owned(ab,abTop)||!owned(bc,bcTop)||!owned(ca,caTop))continue;
      const pixel=py*w+px;if(p.visits[pixel]++)stats.duplicateWithinPart++;
      const wa=bc/area,wb=ca/area,wc=ab/area;
      const sx=g.uv[ia]*wa+g.uv[ib]*wb+g.uv[ic]*wc-g.rect.x-.5,sy=g.uv[ia+1]*wa+g.uv[ib+1]*wb+g.uv[ic+1]*wc-g.rect.y-.5;
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;let r=0,green=0,b=0,a=0;
      for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){
        const ux=ix+xx,uy=iy+yy;if(ux<0||uy<0||ux>=g.rect.w||uy>=g.rect.h)continue;
        const at=(uy*g.rect.w+ux)*4,alpha=g.normalized[at+3];if(alpha===0)continue;
        const weight=(xx?fx:1-fx)*(yy?fy:1-fy);
        const amount=alpha*weight;a+=amount;r+=g.normalized[at]*amount;green+=g.normalized[at+1]*amount;b+=g.normalized[at+2]*amount;
      }
      if(a===0)continue;const at=pixel*4;
      if(a===1){p.sample[at]=r;p.sample[at+1]=green;p.sample[at+2]=b;p.sample[at+3]=1;continue;}
      const keep=1-a;
      p.sample[at]=r+p.sample[at]*keep;p.sample[at+1]=green+p.sample[at+1]*keep;p.sample[at+2]=b+p.sample[at+2]*keep;p.sample[at+3]=a+p.sample[at+3]*keep;
    }
  }
}

export function paintV177RangerLower(p,ctx,phase,settle,x,y,width,height,feet=null) {
  const diagnostic=globalThis.__V100_RAF_CALLBACK_DIAG__;
  const trace=diagnostic?.rangerPaintActive===true&&typeof diagnostic.rangerPaint==='function'
    ?{startedAt:performance.now()}:null;
  let pose;
  try{pose=v177RangerLowerPose(p.rig,phase,settle,p.pose,feet);}catch(error){invalidateRasters(p);throw error;}
  if(trace)trace.poseFinishedAt=performance.now();
  const m=ctx.getTransform();
  if(trace){trace.phase=pose.phase;trace.settle=pose.settle;trace.transform=[m.a,m.b,m.c,m.d,m.e,m.f];}
  const sx=width/480,sy=height/448,a=m.a*sx,b=m.b*sx,c=m.c*sy,d=m.d*sy,e=m.a*x+m.c*y+m.e,f=m.b*x+m.d*y+m.f;
  if(![a,b,c,d,e,f].every(Number.isFinite)||Math.abs(a*d-b*c)<1e-12){invalidateRasters(p);return {mode:'legacy-cell-fallback',reason:'invalid-transform'};}
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const g of p.parts){
    const matrix=g.leg?null:pose.matrices[g.bone],vertices=g.leg?pose.meshes[g.name]:g.uv;
    for(let i=0;i<vertices.length;i+=2){
      let vx=vertices[i],vy=vertices[i+1];if(matrix){const xx=matrix[0]*vx+matrix[2]*vy+matrix[4];vy=matrix[1]*vx+matrix[3]*vy+matrix[5];vx=xx;}
      const px=a*vx+c*vy+e,py=b*vx+d*vy+f;g.target[i]=px;g.target[i+1]=py;
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
    }
  }
  left=Math.max(0,Math.floor(left-1));top=Math.max(0,Math.floor(top-1));right=Math.min(ctx.canvas.width,Math.ceil(right+1));bottom=Math.min(ctx.canvas.height,Math.ceil(bottom+1));
  const w=right-left,h=bottom-top,receipt={mode:'continuous-weighted-mesh',phase:pose.phase,settle:pose.settle,parts:5,meshVertices:130,meshTriangles:192,
    coverageSamples:4,width:Math.max(0,w),height:Math.max(0,h),duplicateWithinPart:0,degenerate:0};
  if(w<=0||h<=0){invalidateRasters(p);return {...receipt,mode:'offscreen-weighted-mesh'};}
  if(!ensureCapacity(p,w,h))return {mode:'legacy-cell-fallback',reason:'bounded-raster-capacity',width:w,height:h};
  for(const g of p.parts){
    for(let i=0;i<g.target.length;i+=2){g.target[i]-=left;g.target[i+1]-=top;}
    selectPartDiagonals(g);
  }
  // Compare every current backing-pixel vertex after pose/IK/clipping. Each
  // payload owns its uploaded surface, within the same combined pixel bound.
  let last=p.rasters.find(raster=>raster.valid&&raster.width===w&&raster.height===h&&raster.parts.length===p.parts.length&&p.parts.every((g,i)=>
    raster.parts[i].part===g&&g.target.every((value,j)=>value===raster.parts[i].target[j])));
  const same=!!last;
  if(trace){trace.lookupFinishedAt=performance.now();trace.reused=same;trace.cacheSwitch=same&&last!==p.lastRaster;trace.width=w;trace.height=h;}
  if(same){
    p.lastRaster=last;p.imageData=last.imageData;
    receipt.duplicateWithinPart=last.duplicateWithinPart;receipt.degenerate=last.degenerate;
    if(trace){trace.rasterFinishedAt=trace.lookupFinishedAt;trace.uploadFinishedAt=performance.now();}
  }else{
    if(p.lastRaster.valid&&p.width*p.height*2<=MAX_PIXELS){
      last=p.rasters.find(raster=>raster!==p.lastRaster);
      if(!last){
        let canvas;
        try{
          canvas=p.createCanvas();if(!canvas?.getContext)throw Error('Ranger raster surface unavailable');
          canvas.width=p.width;canvas.height=p.height;
          const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Ranger raster context unavailable');
          last=createRaster(p.parts,canvas,context);last.imageData=p.context.createImageData(p.width,p.height);
        }catch(error){if(canvas){canvas.width=0;canvas.height=0;}invalidateRasters(p);throw error;}
        p.rasters.push(last);
      }
      p.lastRaster=last;p.imageData=last.imageData;
    }else last=p.lastRaster;
    last.valid=false;
    p.accum.fill(0,0,w*h*4);
    for(const [ox,oy]of samples){
      p.sample.fill(0,0,w*h*4);for(const g of p.parts)rasterPart(p,g,w,h,ox,oy,receipt);
      for(let i=0;i<w*h*4;i++)p.accum[i]+=p.sample[i]*.25;
    }
    p.imageData.data.fill(0);
    for(let py=0;py<h;py++)for(let px=0;px<w;px++){
      const at=(py*w+px)*4,to=(py*p.width+px)*4,alpha=p.accum[at+3];if(alpha===0)continue;
      for(let k=0;k<3;k++)p.imageData.data[to+k]=alpha>0?Math.round(p.accum[at+k]/alpha*255):0;p.imageData.data[to+3]=Math.round(alpha*255);
    }
    if(trace)trace.rasterFinishedAt=performance.now();
    try{last.context.putImageData(p.imageData,0,0,0,0,w,h);}catch(error){invalidateRasters(p);throw error;}
    if(trace)trace.uploadFinishedAt=performance.now();
    if(last.parts.length!==p.parts.length||p.parts.some((g,i)=>last.parts[i].part!==g))
      last.parts=p.parts.map(part=>({part,target:new Float64Array(part.target.length)}));
    for(let i=0;i<p.parts.length;i++)last.parts[i].target.set(p.parts[i].target);
    last.width=w;last.height=h;last.duplicateWithinPart=receipt.duplicateWithinPart;last.degenerate=receipt.degenerate;last.valid=true;
    paintCounts.rasterizedDraws++;
  }
  // The lower is already in backing pixels. The existing clip, alpha, filter,
  // compositing and body transform apply once, with no second bitmap or leg.
  ctx.save();
  try{ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(last.canvas,0,0,w,h,left,top,w,h);}
  catch(error){invalidateRasters(p);throw error;}
  finally{ctx.restore();}
  if(same)paintCounts.reusedDraws++;
  if(trace){trace.endedAt=performance.now();diagnostic.rangerPaint(trace);}
  return receipt;
}

export function drawV177RangerLower(ctx,image,rig,plan,x,y,width,height) {
  if(!ctx.getTransform||!ctx.setTransform||!ctx.canvas)return {mode:'legacy-cell-fallback',reason:'canvas-capability-unavailable'};
  let painter=painters.get(image);
  if(painter===undefined){try{painter=createV177RangerLowerPainter(image,rig);}catch{painter=null;}painters.set(image,painter);}
  if(!painter)return {mode:'legacy-cell-fallback',reason:'source-readback-unavailable'};
  return paintV177RangerLower(painter,ctx,plan.phase,plan.lowerSettle,x,y,width,height,plan.lowerFootTargets);
}
