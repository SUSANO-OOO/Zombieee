import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium,webkit} from 'playwright';
import {stageVisualFor} from '../app/productionVisuals.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL,out='outputs/v100-raster-decoder-control-r1';
await mkdir(out,{recursive:false});
const paths=[stageVisualFor(V100_STAGE_IDS[0]),'/art/v060/characters/babayaga-battle-v1.png','/art/v100/combat-vfx/muzzle-six-frames-r1.webp'];
const reference=[];
for(const path of paths){
 const {data,info}=await sharp('public'+path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const points=[];
 for(let y=5;y<info.height;y+=13)for(let x=7;x<info.width;x+=17){
  const i=(y*info.width+x)*4;
  // Opaque pixels avoid differing premultiply rounding conventions.
  if(data[i+3]===255)points.push({x,y,rgba:[...data.subarray(i,i+4)]});
 }
 reference.push({path,width:info.width,height:info.height,points});
}
const report={scope:'Independent direct image decode at native raster size; no game renderer, PWA transport or canvas scaling. Not physical Safari evidence.',results:[]};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:960,height:720}});
  await page.route('**/decoder-control',r=>r.fulfill({contentType:'text/html',body:'<body style="background:#182026;color:white;font:16px sans-serif"><h1>Native image decoder control</h1><main style="display:flex;flex-wrap:wrap"></main></body>'}));
  await page.goto(new URL('decoder-control',origin).href);
  for(const input of reference){
   const observed=await page.evaluate(async input=>{
    const image=new Image();image.src=input.path;await image.decode();
    image.style='width:300px;height:auto;object-fit:contain;align-self:start';document.querySelector('main').append(image);
    const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    return{width:c.width,height:c.height,rgba:input.points.map(({x,y})=>[...ctx.getImageData(x,y,1,1).data])};
   },input);
   assert.equal(observed.width,input.width);assert.equal(observed.height,input.height);
   let maximum=0,total=0,large=0,channels=0;
   input.points.forEach((point,i)=>point.rgba.forEach((v,c)=>{const delta=Math.abs(v-observed.rgba[i][c]);maximum=Math.max(maximum,delta);total+=delta;channels++;if(delta>4)large++}));
   report.results.push({engine,path:input.path,pixels:input.points.length,maximumChannelDelta:maximum,meanChannelDelta:channels?total/channels:null,channelsDifferingOver4:large});
  }
  await page.screenshot({path:out+'/'+engine+'.png'});
 }finally{await browser.close();}
}
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
