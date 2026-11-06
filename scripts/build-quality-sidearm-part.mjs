import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_CHARACTER_HEAD_ATLASES} from '../app/qualityCharacterAtlases.js';
const root='assets/source/quality-20261028/weapon-sidearm-r1',check=process.argv.includes('--check');
const p=JSON.parse(await readFile(root+'/source-plan.json')),bytes=await readFile(p.model);
assert.equal(createHash('sha256').update(bytes).digest('hex'),p.modelSha256);
const master=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const mask=await sharp(Buffer.from(`<svg width="${master.info.width}" height="${master.info.height}"><polygon points="${p.extractionPolygon.map(p=>p.join(',')).join(' ')}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();
const rgba=Buffer.from(master.data);for(let i=0;i<rgba.length;i+=4){
 const skin=rgba[i]-rgba[i+1]>24&&rgba[i+1]>rgba[i+2]+8&&rgba[i]>100;
 rgba[i+3]=skin?0:Math.round(rgba[i+3]*mask[i+3]/255);if(!rgba[i+3])rgba.fill(0,i,i+3);
}
const extracted=await sharp(rgba,{raw:master.info}).extract(p.extractedRect).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const [ox,oy]=p.extractOrigin,[ax,ay]=p.axisReference,[vx,vy]=p.sourceAxis,len=Math.hypot(vx,vy),c=vx/len,s=-vy/len;
let min=Infinity,tip=-Infinity;
for(let y=0;y<extracted.info.height;y++)for(let x=0;x<extracted.info.width;x++){
 if(extracted.data[(y*extracted.info.width+x)*4+3]<128)continue;
 const dx=x+ox+.5-ax,dy=y+oy+.5-ay,along=dx*c-dy*s,cross=dx*s+dy*c;
 min=Math.min(min,along);if(Math.abs(cross)<2)tip=Math.max(tip,along);
}
const inset=tip-p.muzzleInsetSourcePixels,anchor=[ax+c*inset,ay-s*inset],scale=78/(inset-min),d=p.destination;
const width=d.w*p.density,height=d.h*p.density,out=Buffer.alloc(width*height*4);
function sample(x,y){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,acc=[0,0,0,0];
 for(let j=0;j<2;j++)for(let i=0;i<2;i++){
  const xx=ix+i,yy=iy+j;if(xx<0||yy<0||xx>=extracted.info.width||yy>=extracted.info.height)continue;
  const n=(yy*extracted.info.width+xx)*4,w=(i?fx:1-fx)*(j?fy:1-fy),a=extracted.data[n+3]/255;
  acc[3]+=w*a;for(let k=0;k<3;k++)acc[k]+=extracted.data[n+k]*w*a;
 }
 return acc[3]>0?[...acc.slice(0,3).map(v=>Math.round(v/acc[3])),Math.round(acc[3]*255)]:[0,0,0,0];
}
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const wx=(d.x+(x+.5)/p.density-326)/scale,wy=(d.y+(y+.5)/p.density-179)/scale;
 out.set(sample(c*wx+s*wy+anchor[0]-ox-.5,-s*wx+c*wy+anchor[1]-oy-.5),(y*width+x)*4);
}
const base=await sharp(p.retainedBase).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const atlas=QUALITY_CHARACTER_HEAD_ATLASES.babayaga,old=atlas.parts.find(part=>part.bone===atlas.weaponBone);
function inside(x,y){let yes=false;for(let i=0,j=p.handPolygon.length-1;i<p.handPolygon.length;j=i++){
 const a=p.handPolygon[i],b=p.handPolygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const wx=d.x+(x+.5)/p.density,wy=d.y+(y+.5)/p.density,sx=(wx-old.destination.x)/old.destination.w*old.source.w,sy=(wy-old.destination.y)/old.destination.h*old.source.h;
 if(sx<0||sy<0||sx>=old.source.w||sy>=old.source.h||!inside(sx,sy))continue;
 const n=((old.source.y+Math.floor(sy))*base.info.width+old.source.x+Math.floor(sx))*4,i=(y*width+x)*4,a=base.data[n+3]/255,b=out[i+3]/255,total=a+b*(1-a);
 for(let k=0;k<3;k++)out[i+k]=total?Math.round((base.data[n+k]*a+out[i+k]*b*(1-a))/total):0;out[i+3]=Math.round(total*255);
}
async function emit(file,buffer){if(check)assert.deepEqual(await readFile(file),buffer,file);else await writeFile(file,buffer);}
if(check){assert.deepEqual(p.sourceAnchor,anchor);assert.equal(p.scale,scale);}
else{p.sourceAnchor=anchor;p.scale=scale;await writeFile(root+'/source-plan.json',JSON.stringify(p,null,2));}
await emit(root+'/'+p.authored,await sharp(out,{raw:{width,height,channels:4}}).png().toBuffer());
console.log(JSON.stringify({check,anchor,scale,width,height,muzzleAlpha:out[((179-d.y)*p.density*width+(326-d.x)*p.density)*4+3]}));
