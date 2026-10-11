import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {PRODUCTION_ENEMY_SOURCE_FACING,semanticAtlasRowPlan} from '../app/enemyFacingContract.js';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function inside(x,y,polygon){let answer=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])answer=!answer;}return answer;}

export async function generateAnchorBloomSource(sourceDirectory='assets/source/v100/anchor-bloom-repair-r1'){
 const spec=JSON.parse(await readFile(path.join(sourceDirectory,'provenance.json'))),original=await readFile(spec.original),guide=await readFile(path.join(sourceDirectory,'alpha-guide.png'));
 assert.equal(digest(original),spec.originalSha256);assert.equal(digest(guide),spec.alphaGuideSha256);
 const {data,info}=await sharp(guide).ensureAlpha().raw().toBuffer({resolveWithObject:true}),rgb=await sharp(original).removeAlpha().raw().toBuffer();assert.deepEqual([info.width,info.height],[1536,1024]);
 const count=info.width*info.height,rgba=Buffer.alloc(count*4),visited=new Uint8Array(count),queue=new Int32Array(count);let head=0,tail=0;
 function background(p){const r=rgb[p*3],g=rgb[p*3+1],b=rgb[p*3+2],lum=r*.2126+g*.7152+b*.0722,spread=Math.max(r,g,b)-Math.min(r,g,b),a=data[p*4+3];return a<=3||lum>=218&&spread<=32||a<224&&lum>=184&&spread<=12;}
 function push(p){if(p<0||p>=count||visited[p]||!background(p))return;visited[p]=1;queue[tail++]=p;}
 for(let p=0;p<count;p++){rgb.copy(rgba,p*4,p*3,p*3+3);const a=data[p*4+3];rgba[p*4+3]=a<=3?0:a>=230?255:Math.min(255,Math.round(a*255/253));if(!rgba[p*4+3])push(p);}
 for(let x=0;x<info.width;x++){push(x);push((info.height-1)*info.width+x);}for(let y=0;y<info.height;y++){push(y*info.width);push(y*info.width+info.width-1);}
 while(head<tail){const p=queue[head++];rgba[p*4+3]=0;const x=p%info.width;if(x)push(p-1);if(x+1<info.width)push(p+1);push(p-info.width);push(p+info.width);}
 const source=await sharp(rgba,{raw:{width:1536,height:1024,channels:4}}).png().toBuffer();assert.equal(digest(source),spec.alphaSourceSha256);
 const poses=[],bindings=[];
 for(const owned of spec.sourceBindings){const {poseIndex:n,ownedSourceRect:r,ownedPolygon}=owned,{x:left,y:top,w:width,h:height}=r;let bytes=await sharp(source).extract({left,top,width,height}).png().toBuffer();if(ownedPolygon){const p=await sharp(bytes).ensureAlpha().raw().toBuffer();for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(!inside(left+x+.5,top+y+.5,ownedPolygon))p[(y*width+x)*4+3]=0;bytes=await sharp(p,{raw:{width,height,channels:4}}).png().toBuffer();}
  const p=await sharp(bytes).ensureAlpha().raw().toBuffer();let a=width,b=height,c=-1,d=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(p[(y*width+x)*4+3]>8){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);}assert.ok(c>a&&d>b,'Complete owned pose '+n);const body=await sharp(bytes).extract({left:a,top:b,width:c-a+1,height:d-b+1}).png().toBuffer();assert.equal(digest(body),owned.sha256,'Owned source pose '+n+' must reproduce exactly');poses.push(body);bindings.push({...owned,tightRect:{x:left+a,y:top+b,w:c-a+1,h:d-b+1}});
 }
 const rows=semanticAtlasRowPlan(PRODUCTION_ENEMY_SOURCE_FACING['anchor-bloom'].sourceFacing);assert.deepEqual(rows,spec.semanticRows);const composites=[];
 for(let col=0;col<7;col++){const body=await sharp(poses[spec.poseIndexes[col]]).resize({width:417,height:387,fit:'inside',kernel:'lanczos3'}).png().toBuffer(),m=await sharp(body).metadata(),left=Math.round((480-m.width)/2+(col===2?7:col===1?-5:0)),top=432-m.height,mirror=await sharp(body).flop().png().toBuffer();composites.push({input:rows.right==='source'?body:mirror,left:col*480+left,top},{input:rows.left==='source'?body:mirror,left:col*480+left,top:448+top});}
 const atlas=await sharp({create:{width:3360,height:896,channels:4,background:'#00000000'}}).composite(composites).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer(),transport=await sharp(atlas).webp({lossless:true,effort:6}).toBuffer();assert.equal(digest(atlas),spec.png.sha256);assert.equal(digest(transport),spec.webp.sha256);assert.equal(atlas.length,spec.png.bytes);assert.equal(transport.length,spec.webp.bytes);
 return {source,poses,atlas,transport,spec,bindings};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await generateAnchorBloomSource();await writeFile('public/art/v0995/enemies/anchor-bloom-battle-v2.png',result.atlas);await writeFile('public/pwa-optimized/art/v0995/enemies/anchor-bloom-battle-v2.webp',result.transport);console.log(JSON.stringify({kind:'anchor-bloom',sourcePoses:8,runtimeStates:7,originalRgbRetained:true,png:result.spec.png,webp:result.spec.webp}));
}
