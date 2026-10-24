import {createV177RangerLowerPose,v177RangerLowerPose} from './v177RangerLowerMotion.js';

const painters=new WeakMap(),MAX_PIXELS=65536,MAX_SURFACES=32;
const paintCounts={createdPainters:0,rasterizedDraws:0,reusedDraws:0};
export const getV177RangerLowerPaintSnapshot=()=>({...paintCounts});
const samples=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
const topLeft=(ax,ay,bx,by)=>by<ay||(by===ay&&bx>ax);
const owned=(v,edge)=>v>1e-10||(Math.abs(v)<=1e-10&&edge);
function sourceKernelOccupancy(data,width,height){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||data.length!==width*height*4)return null;
  const stride=width+1,occupancy=new Uint8Array(stride*(height+1));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]!==0){
    const at=y*stride+x;occupancy[at]=1;occupancy[at+1]=1;occupancy[at+stride]=1;occupancy[at+stride+1]=1;
  }
  return occupancy;
}
const sameRgba=(a,b)=>{if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;};
const createRaster=(parts,canvas,context,attributes)=>({valid:false,width:0,height:0,duplicateWithinPart:0,degenerate:0,imageData:null,canvas,context,attributes,uploadOwner:null,lastUsed:0,
  parts:parts.map(part=>({part,target:new Float64Array(part.target.length)}))});
const invalidateRasters=p=>{for(const raster of p.rasters){raster.valid=false;raster.uploadOwner=null;}};
function createPaintSurface(createCanvas,width=0,height=0){
  const canvas=createCanvas();if(!canvas?.getContext)return null;
  canvas.width=width;canvas.height=height;
  try{
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context){canvas.width=0;canvas.height=0;return null;}
    return {canvas,context,attributes:context.getContextAttributes?.()??null};
  }catch(error){canvas.width=0;canvas.height=0;throw error;}
}

// One source read per original crop. A small LRU of exact raster payloads
// avoids overwriting recently drawn surfaces, within the same total pixel cap.
// Image ownership releases all buffers when the installed sprite is released.
export function createV177RangerLowerPainter(image,rig,createCanvas=()=>image.ownerDocument?.createElement('canvas')??globalThis.document?.createElement('canvas')) {
  const sourceCanvas=createCanvas();if(!sourceCanvas?.getContext)return null;
  const source=sourceCanvas.getContext('2d',{willReadFrequently:true});
  if(!source){sourceCanvas.width=0;sourceCanvas.height=0;return null;}
  // Read original crops once and release that canvas. Retained surfaces keep
  // the original hint for the generated RGBA path, without reading pixels back.
  let parts;
  try{parts=rig.parts.map(part=>{
    const s=part.source,d=part.destination;sourceCanvas.width=s.w;sourceCanvas.height=s.h;
    source.clearRect(0,0,s.w,s.h);source.drawImage(image,s.x,s.y,s.w,s.h,0,0,s.w,s.h);
    const data=source.getImageData(0,0,s.w,s.h).data,leg=rig.legs.find(l=>l.name===part.name);
    // Cache the exact binary64 divisions once. Keep the original per-sample
    // alpha*weight, channel*amount and Float32 compositing order unchanged.
    const normalized=Float64Array.from(data,value=>value/255);
    const uv=new Float64Array(leg?.sourcePositions??[d.x,d.y,d.x+d.w,d.y,d.x+d.w,d.y+d.h,d.x,d.y+d.h]);
    const indices=new Uint16Array(leg?.triangles??[0,1,2,0,2,3]);
    return {name:part.name,bone:part.bone,rect:d,data,normalized,kernelOccupancy:sourceKernelOccupancy(data,d.w,d.h),uv,leg,indices,rasterIndices:indices.slice(),target:new Float64Array(uv.length)};
  });}finally{sourceCanvas.width=0;sourceCanvas.height=0;}
  const surface=createPaintSurface(createCanvas);if(!surface)return null;
  const {canvas,context,attributes}=surface;
  paintCounts.createdPainters++;
  const lastRaster=createRaster(parts,canvas,context,attributes);
  return {canvas,context,attributes,parts,pose:createV177RangerLowerPose(rig),rig,width:0,height:0,sample:null,accum:null,visits:null,imageData:null,
    createCanvas,lastRaster,rasters:[lastRaster],useSequence:0};
}
function ensureCapacity(p,w,h) {
  let width=Math.max(p.width,w),height=Math.max(p.height,h);
  if(width*height>MAX_PIXELS){if(w*h>MAX_PIXELS){invalidateRasters(p);return false;}width=w;height=h;}
  if(width===p.width&&height===p.height)return true;
  try{
    const sample=new Float32Array(width*height*4),accum=new Float32Array(width*height*4),visits=new Uint8Array(width*height);
    p.width=width;p.height=height;p.sample=sample;p.accum=accum;p.visits=visits;
    for(const raster of p.rasters)if(raster.valid){
      const backingWidth=raster.width+(width>raster.width?1:0),backingHeight=raster.height+(width===raster.width&&height>raster.height?1:0);
      if(raster.canvas.width!==backingWidth||raster.canvas.height!==backingHeight)retireRaster(p,raster);
    }
  }catch(error){invalidateRasters(p);throw error;}
  return true;
}
function retireRaster(p,raster) {
  for(const borrower of p.rasters)if(borrower.uploadOwner===raster){borrower.valid=false;borrower.uploadOwner=null;}
  raster.valid=false;raster.uploadOwner=null;
}
function selectRaster(p,w,h) {
  const pixels=w*h,total=p.rasters.reduce((sum,raster)=>sum+raster.canvas.width*raster.canvas.height,0);
  let raster=p.rasters.find(raster=>!raster.valid);
  if(!raster&&(p.rasters.length>=MAX_SURFACES||total+pixels>MAX_PIXELS))
    raster=p.rasters.reduce((oldest,current)=>!oldest||current.lastUsed<oldest.lastUsed?current:oldest,null);
  let transient;
  try{
    if(!raster){
      const surface=createPaintSurface(p.createCanvas);
      if(!surface)throw Error('Ranger raster context unavailable');
      transient=surface.canvas;raster=createRaster(p.parts,surface.canvas,surface.context,surface.attributes);
    }
    const resize=raster.canvas.width!==w||raster.canvas.height!==h;
    // Obtain the replacement before retiring a usable owner. Allocation failure
    // invalidates reuse, but leaves the old canvases available for recovery.
    const imageData=resize||!raster.imageData?p.context.createImageData(w,h):raster.imageData;
    let retained=total-raster.canvas.width*raster.canvas.height;
    while(retained+pixels>MAX_PIXELS){
      const victim=p.rasters.filter(current=>current!==raster).reduce((oldest,current)=>!oldest||current.lastUsed<oldest.lastUsed?current:oldest,null);
      retireRaster(p,victim);retained-=victim.canvas.width*victim.canvas.height;
      victim.canvas.width=0;victim.canvas.height=0;victim.imageData=null;
      p.rasters.splice(p.rasters.indexOf(victim),1);
    }
    if(resize){retireRaster(p,raster);raster.canvas.width=w;raster.canvas.height=h;}
    raster.imageData=imageData;
    if(!p.rasters.includes(raster))p.rasters.push(raster);
    return raster;
  }catch(error){if(transient){transient.width=0;transient.height=0;}invalidateRasters(p);throw error;}
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
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
      // Skip only kernels whose original four alpha bytes are all zero.
      if(g.kernelOccupancy&&(ix< -1||iy< -1||ix>=g.rect.w||iy>=g.rect.h||!g.kernelOccupancy[(iy+1)*(g.rect.w+1)+ix+1]))continue;
      let r=0,green=0,b=0,a=0;
      if(ix>=0&&iy>=0&&ix+1<g.rect.w&&iy+1<g.rect.h){
        // Interior kernels have all four original taps. Keep exactly the old
        // 00,10,01,11 binary64 operations/addition order, without repeating
        // four loop/bound/index calculations for every coverage sample.
        const n=g.normalized,wx=1-fx,wy=1-fy,row=g.rect.w*4;
        let at=(iy*g.rect.w+ix)*4,alpha=n[at+3];
        if(alpha!==0){const amount=alpha*(wx*wy);a+=amount;r+=n[at]*amount;green+=n[at+1]*amount;b+=n[at+2]*amount;}
        at+=4;alpha=n[at+3];
        if(alpha!==0){const amount=alpha*(fx*wy);a+=amount;r+=n[at]*amount;green+=n[at+1]*amount;b+=n[at+2]*amount;}
        at+=row-4;alpha=n[at+3];
        if(alpha!==0){const amount=alpha*(wx*fy);a+=amount;r+=n[at]*amount;green+=n[at+1]*amount;b+=n[at+2]*amount;}
        at+=4;alpha=n[at+3];
        if(alpha!==0){const amount=alpha*(fx*fy);a+=amount;r+=n[at]*amount;green+=n[at+1]*amount;b+=n[at+2]*amount;}
      }else{
        // The original clipped-border path owns every outside tap decision.
        for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){
          const ux=ix+xx,uy=iy+yy;if(ux<0||uy<0||ux>=g.rect.w||uy>=g.rect.h)continue;
          const at=(uy*g.rect.w+ux)*4,alpha=g.normalized[at+3];if(alpha===0)continue;
          const weight=(xx?fx:1-fx)*(yy?fy:1-fy);
          const amount=alpha*weight;a+=amount;r+=g.normalized[at]*amount;green+=g.normalized[at+1]*amount;b+=g.normalized[at+2]*amount;
        }
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
  // Whole-image and cropped-image blits can round alpha differently. Preserve
  // the original path with one transparent column or row, rather than keeping
  // the full old workspace rectangle on every retained surface.
  const backingWidth=w+(p.width>w?1:0),backingHeight=h+(p.width===w&&p.height>h?1:0);
  for(const g of p.parts){
    for(let i=0;i<g.target.length;i+=2){g.target[i]-=left;g.target[i+1]-=top;}
    selectPartDiagonals(g);
  }
  // Compare every current backing-pixel vertex after pose/IK/clipping. Each
  // payload owns its uploaded surface, within the same combined pixel bound.
  const previousRaster=p.lastRaster,previousUploadOwner=previousRaster.uploadOwner??previousRaster;
  let last=p.rasters.find(raster=>raster.valid&&raster.width===w&&raster.height===h&&raster.canvas.width===backingWidth&&raster.canvas.height===backingHeight&&raster.parts.length===p.parts.length&&p.parts.every((g,i)=>
    raster.parts[i].part===g&&g.target.every((value,j)=>value===raster.parts[i].target[j])));
  const same=!!last;
  if(trace){trace.lookupFinishedAt=performance.now();trace.reused=same;trace.cacheSwitch=same&&(last.uploadOwner??last)!==(previousRaster.uploadOwner??previousRaster);trace.geometryCacheSwitch=same&&last!==previousRaster;trace.width=w;trace.height=h;}
  if(same){
    p.lastRaster=last;p.imageData=last.imageData;
    receipt.duplicateWithinPart=last.duplicateWithinPart;receipt.degenerate=last.degenerate;
    if(trace){trace.rasterFinishedAt=trace.lookupFinishedAt;trace.uploadFinishedAt=performance.now();}
  }else{
    last=selectRaster(p,backingWidth,backingHeight);p.lastRaster=last;p.imageData=last.imageData;
    if(trace){trace.writeSurfaceIndex=p.rasters.indexOf(last);trace.writeSurfaceLastUsed=last.lastUsed;
      trace.drawsSinceSurfaceUse=last.lastUsed>0?p.useSequence-last.lastUsed:null;trace.replacingValidGeometry=last.valid;}
    const retainOwnPayload=last.valid&&!last.uploadOwner&&last.width===w&&last.height===h;
    // Reassigning an owner can also turn it into an alias. Retire all old
    // borrowers before either its payload or its ownership is changed.
    retireRaster(p,last);
    p.accum.fill(0,0,w*h*4);
    for(const [ox,oy]of samples){
      p.sample.fill(0,0,w*h*4);for(const g of p.parts)rasterPart(p,g,w,h,ox,oy,receipt);
      for(let i=0;i<w*h*4;i++)p.accum[i]+=p.sample[i]*.25;
    }
    // Sampling is finished. Its existing Float32 workspace can retain every
    // old byte exactly while generating the new payload, with no extra buffer.
    if(retainOwnPayload)p.sample.set(p.imageData.data);
    p.imageData.data.fill(0);
    for(let py=0;py<h;py++)for(let px=0;px<w;px++){
      const at=(py*w+px)*4,to=(py*p.imageData.width+px)*4,alpha=p.accum[at+3];if(alpha===0)continue;
      for(let k=0;k<3;k++)p.imageData.data[to+k]=alpha>0?Math.round(p.accum[at+k]/alpha*255):0;p.imageData.data[to+3]=Math.round(alpha*255);
    }
    if(trace)trace.rasterFinishedAt=performance.now();
    // Geometry can differ below byte precision. Reuse an already uploaded
    // surface only after comparing every generated RGBA byte, without a tolerance.
    const ownPayloadReused=retainOwnPayload&&sameRgba(p.imageData.data,p.sample.subarray(0,p.imageData.data.length));
    const previousPayloadReused=!ownPayloadReused&&previousUploadOwner!==last&&previousUploadOwner.valid&&previousUploadOwner.width===w&&previousUploadOwner.height===h
      &&previousUploadOwner.imageData.width===p.imageData.width&&previousUploadOwner.imageData.height===p.imageData.height
      &&sameRgba(p.imageData.data,previousUploadOwner.imageData.data);
    const payloadReused=ownPayloadReused||previousPayloadReused;
    if(ownPayloadReused)last.uploadOwner=null;
    else if(previousPayloadReused)last.uploadOwner=previousUploadOwner;
    else{
      last.uploadOwner=null;
      // The payload owns this exact backing size. Its optional guard row/column
      // is already transparent; write the complete original RGBA once rather
      // than asking the native canvas to clip a dirty rectangle.
      try{last.context.putImageData(p.imageData,0,0);}catch(error){invalidateRasters(p);throw error;}
    }
    if(trace){trace.payloadReused=payloadReused;trace.payloadReuseOwner=ownPayloadReused?'own':previousPayloadReused?'previous':null;trace.actualUpload=!payloadReused;}
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
  const uploadOwner=last.uploadOwner??last;
  last.lastUsed=++p.useSequence;uploadOwner.lastUsed=p.useSequence;
  try{ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(uploadOwner.canvas,0,0,w,h,left,top,w,h);}
  catch(error){invalidateRasters(p);throw error;}
  finally{ctx.restore();}
  if(same)paintCounts.reusedDraws++;
  if(trace){trace.drawSurfaceIndex=p.rasters.indexOf(uploadOwner);trace.surfaceCount=p.rasters.length;trace.surfacePixels=p.rasters.reduce((sum,raster)=>sum+raster.canvas.width*raster.canvas.height,0);trace.surfaceAttributes=uploadOwner.attributes;trace.endedAt=performance.now();diagnostic.rangerPaint(trace);}
  return receipt;
}

export function drawV177RangerLower(ctx,image,rig,plan,x,y,width,height) {
  if(!ctx.getTransform||!ctx.setTransform||!ctx.canvas)return {mode:'legacy-cell-fallback',reason:'canvas-capability-unavailable'};
  let painter=painters.get(image);
  if(painter===undefined){try{painter=createV177RangerLowerPainter(image,rig);}catch{painter=null;}painters.set(image,painter);}
  if(!painter)return {mode:'legacy-cell-fallback',reason:'source-readback-unavailable'};
  return paintV177RangerLower(painter,ctx,plan.phase,plan.lowerSettle,x,y,width,height,plan.lowerFootTargets);
}
