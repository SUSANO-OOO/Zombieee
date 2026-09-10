// Downsample a decoded source in bounded half-size steps. This is a runtime
// texture cache: it neither edits the asset nor changes its world geometry.
export function createV100ImageSampler({maxBytes=12*1024*1024,maxEntries=128,maxWorkingBytes=8*1024*1024,createCanvas=()=>document.createElement('canvas')}={}){
 let identities=new WeakMap(),ordinal=0,bytes=0,hits=0,builds=0,evictions=0;
 const cache=new Map();
 const dispose=entry=>{entry.canvas.width=0;entry.canvas.height=0;};
 function clear(){for(const entry of cache.values())dispose(entry);cache.clear();identities=new WeakMap();bytes=0;}
 function snapshot(){return{entries:cache.size,bytes,maxBytes,hits,builds,evictions};}
 function drawTexture(ctx,image,args,nearestLevel){
  const sourceWidth=image.naturalWidth||image.width,sourceHeight=image.naturalHeight||image.height;
  const rect=args.length===4?[0,0,sourceWidth,sourceHeight,...args]:args;
  if(rect.length!==8||!rect.every(Number.isFinite)){ctx.drawImage(image,...args);return;}
  const [sx,sy,sw,sh,dx,dy,dw,dh]=rect,m=ctx.getTransform();
  const pixelWidth=Math.abs(dw)*Math.hypot(m.a,m.b),pixelHeight=Math.abs(dh)*Math.hypot(m.c,m.d);
  if(!(sw>0&&sh>0&&pixelWidth>0&&pixelHeight>0)||!Number.isFinite(pixelWidth+pixelHeight)||!ctx.imageSmoothingEnabled){ctx.drawImage(image,...args);return;}
  // Select the nearest half-size level, not only levels above the destination.
  // The latter skips 1600x900 -> 960x500 battlefield plates entirely. Keeping
  // background axis within sqrt(2) of its target filters those reductions.
  // Tiny fighter textures keep the next larger level to retain face detail.
  const ratio=nearestLevel?Math.SQRT2:1;
  const minimumWidth=pixelWidth/ratio,minimumHeight=pixelHeight/ratio;
  const steps=[];let width=sw,height=sh;
  while(width>1||height>1){
   const halfW=Math.ceil(width/2),halfH=Math.ceil(height/2);
   const w=halfW>=minimumWidth?halfW:width,h=halfH>=minimumHeight?halfH:height;
   if(w===width&&h===height)break;steps.push({w,h});width=w;height=h;
  }
  const cost=width*height*4;
  if(!steps.length||maxEntries<1||cost>maxBytes||steps[0].w*steps[0].h*4>maxWorkingBytes){ctx.drawImage(image,...args);return;}
  if(!identities.has(image))identities.set(image,++ordinal);
  const key=[identities.get(image),image.currentSrc||image.src||'',sourceWidth,sourceHeight,sx,sy,sw,sh,width,height].join('|');
  let entry=cache.get(key);
  if(entry){hits++;cache.delete(key);cache.set(key,entry);}
  else{
   let input=image,previous=null,current=null;
   try{
    for(const [index,size] of steps.entries()){
     const canvas=createCanvas();current=canvas;canvas.width=size.w;canvas.height=size.h;
     const context=canvas.getContext('2d');
     if(!context){canvas.width=0;canvas.height=0;throw new Error('Downsample canvas unavailable');}
     context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
     if(index===0)context.drawImage(input,sx,sy,sw,sh,0,0,size.w,size.h);
     else context.drawImage(input,0,0,size.w,size.h);
     if(previous){previous.width=0;previous.height=0;}
     input=canvas;previous=canvas;
    }
   }catch{
    if(current){current.width=0;current.height=0;}
    if(previous){previous.width=0;previous.height=0;}
    ctx.drawImage(image,...args);return;
   }
   while(cache.size&&(bytes+cost>maxBytes||cache.size>=maxEntries)){
    const oldest=cache.keys().next().value,removed=cache.get(oldest);cache.delete(oldest);bytes-=removed.bytes;dispose(removed);evictions++;
   }
   entry={canvas:input,bytes:cost};cache.set(key,entry);bytes+=cost;builds++;
  }
  ctx.drawImage(entry.canvas,0,0,width,height,dx,dy,dw,dh);
 }
 return Object.freeze({
  draw:(ctx,image,...args)=>drawTexture(ctx,image,args,false),
  drawBackground:(ctx,image,...args)=>drawTexture(ctx,image,args,true),
  clear,snapshot,
 });
}
