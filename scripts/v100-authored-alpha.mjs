// Build-time decoding of the authored source convention. Color is never used
// as a key for sources that already contain alpha. Opaque sources in this
// motion set have a pale matte; dark ink/clothing is always subject content.
export function authoredMotionRgba(data, width, height) {
  if (data.length !== width * height * 4) throw new Error('Expected RGBA motion source');
  const rgba = Buffer.from(data);
  for (let i=3;i<data.length;i+=4) if (data[i] < 255) return rgba;
  const neutralBright = offset => {
    const r=data[offset],g=data[offset+1],b=data[offset+2];
    return Math.max(r,g,b)-Math.min(r,g,b)<=12 && (r*299+g*587+b*114)/1000>=205;
  };
  let borderPixels=0,brightBorder=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(x&&x!==width-1&&y&&y!==height-1)continue;
    borderPixels++;if(neutralBright((y*width+x)*4))brightBorder++;
  }
  if(brightBorder/borderPixels<.95)throw new Error('Opaque motion matte is not the documented pale background; preserve source for review');
  const visited=new Uint8Array(width*height),queue=new Int32Array(width*height);
  let head=0,tail=0;
  const add=(x,y)=>{
    const i=y*width+x;
    if(visited[i]||!neutralBright(i*4))return;
    visited[i]=1;queue[tail++]=i;
  };
  for(let x=0;x<width;x++){add(x,0);add(x,height-1);}
  for(let y=1;y<height-1;y++){add(0,y);add(width-1,y);}
  while(head<tail){
    const i=queue[head++],x=i%width,y=Math.floor(i/width);
    rgba[i*4+3]=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy;if((dx||dy)&&nx>=0&&nx<width&&ny>=0&&ny<height)add(nx,ny);
    }
  }
  return rgba;
}
