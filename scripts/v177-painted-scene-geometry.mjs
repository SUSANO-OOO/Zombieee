// Read actual image layout after decode; no style, clock or game-state writes.
export function readV177PaintedSceneImage(element) {
  const image=element.querySelector('.v100-event-image:not(.v100-event-image-previous)');
  if(!image)return null;
  const css=getComputedStyle(image),r=image.getBoundingClientRect();
  let axisAligned=true,ancestorPaintHidden=false;
  for(let node=image;node&&node!==element.parentElement;node=node.parentElement){
    const style=getComputedStyle(node),transform=style.transform;
    if(Number(style.opacity)===0||style.visibility==='hidden'||style.display==='none')ancestorPaintHidden=true;
    if(transform&&transform!=='none'){
      const m=new DOMMatrixReadOnly(transform);
      if(m.a<=0||m.d<=0||[m.b,m.c,m.m13,m.m14,m.m23,m.m24,m.m31,m.m32,m.m34,m.m43,m.m33-1,m.m44-1].some(n=>Math.abs(n)>1e-8))axisAligned=false;
    }
  }
  return {src:image.currentSrc||image.src,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,
    layoutWidth:parseFloat(css.width),layoutHeight:parseFloat(css.height),objectFit:css.objectFit,objectPosition:css.objectPosition,axisAligned,
    opacity:Number(css.opacity),visibility:css.visibility,display:css.display,ancestorPaintHidden,
    rect:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
}

export async function readV177PaintedSceneSource(element){
  const image=element.querySelector('.v100-event-image:not(.v100-event-image-previous)');
  if(!image?.complete||!(image.naturalWidth>0))throw Error('Painted source is not decoded');
  const url=new URL(image.currentSrc||image.src,location.href);
  if(url.origin!==location.origin)throw Error('Painted source must use the same asset origin');
  const response=await fetch(url.href,{cache:'force-cache'});
  if(!response.ok)throw Error('Painted source fetch failed: '+response.status);
  const bytes=await response.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);
  return {src:url.href,bytes:bytes.byteLength,sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')};
}

const area=r=>Math.max(0,r.width)*Math.max(0,r.height);
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))
  *Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const validBox=r=>r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;

export function inspectV177PaintedSceneFaces(shot,geometry){
  if(!shot?.landmarks?.length)return {applicable:false,faces:[],issues:[]};
  const image=geometry.paintedImage,issues=[];
  if(!image?.src?.split(/[?#]/u)[0].endsWith('/art/v100/story-r9/cuts/'+shot.id+'.webp'))
    return {applicable:true,faces:[],issues:['painted face layout refers to a different source image']};
  if(!image?.complete||image.naturalWidth!==1280||image.naturalHeight!==720||!image.axisAligned||image.objectFit!=='cover'
    ||image.opacity!==1||image.visibility!=='visible'||image.display==='none'||image.ancestorPaintHidden)
    return {applicable:true,faces:[],issues:['painted face source is not decoded in a supported actual layout']};
  if(![image.layoutWidth,image.layoutHeight].every(n=>Number.isFinite(n)&&n>0)||!validBox(image.rect))
    return {applicable:true,faces:[],issues:['painted face image has no actual positive layout']};
  if(![geometry.scene,geometry.copy,geometry.headingBox].every(validBox)
    ||!Array.isArray(geometry.detailShots)||geometry.detailShots.length!==1
    ||geometry.detailShots[0].id!==shot.id||!validBox(geometry.detailShots[0].frame))
    return {applicable:true,faces:[],issues:['painted face scene or obstruction rectangles were not actually measured']};
  if(!shot.landmarks.every(mark=>mark.rect?.length===4&&mark.rect.every(Number.isFinite)
    &&mark.rect[0]>=0&&mark.rect[1]>=0&&mark.rect[2]>0&&mark.rect[3]>0
    &&mark.rect[0]+mark.rect[2]<=1280&&mark.rect[1]+mark.rect[3]<=720))
    return {applicable:true,faces:[],issues:['painted face source landmark is invalid']};
  const tokens=typeof image.objectPosition==='string'?image.objectPosition.trim().split(/\s+/u):[];
  if(tokens.length!==2||!tokens.every(s=>/^\d+(?:\.\d+)?%$/u.test(s)&&parseFloat(s)<=100))
    return {applicable:true,faces:[],issues:['painted face object-position is not an observed percentage pair']};
  const [px,py]=tokens.map(s=>parseFloat(s)/100),scale=Math.max(image.layoutWidth/1280,image.layoutHeight/720);
  const ox=(image.layoutWidth-1280*scale)*px,oy=(image.layoutHeight-720*scale)*py;
  const sx=image.rect.width/image.layoutWidth,sy=image.rect.height/image.layoutHeight;
  const obstructions=[['heading',geometry.headingBox],['dialogue',geometry.copy],...(geometry.detailShots??[]).map(s=>['detail:'+s.id,s.frame])];
  const faces=shot.landmarks.map(mark=>{
    const [x,y,w,h]=mark.rect,rect={x:image.rect.x+(x*scale+ox)*sx,y:image.rect.y+(y*scale+oy)*sy,width:w*scale*sx,height:h*scale*sy};
    if(!geometry.scene||area(rect)-overlap(rect,geometry.scene)>1e-6)issues.push(mark.id+': clipped outside scene');
    for(const [name,box]of obstructions)if(box&&overlap(rect,box)>1e-6)issues.push(mark.id+': covered by '+name);
    return {id:mark.id,rect};
  });
  return {applicable:true,faces,issues};
}
