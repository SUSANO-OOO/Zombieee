import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {createV100ImageSampler} from '../app/v100ImageSampling.js';
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL,out=process.env.V100_SAMPLING_OUTPUT??'outputs/v100-image-sampling-r1';
await mkdir(out,{recursive:false});
const report={scope:'Actual browser sampling of unchanged game images. Read-only source assets; isolated canvas quality and warm-cache cost, not physical iPhone evidence.',engines:[]},pixels={};
for(const[engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1050,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/sampling-comparison',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><body style="margin:20px;background:#192329;color:white;font:17px system-ui"><h2>実素材の縮小比較</h2><main style="display:grid;grid-template-columns:repeat(3,320px);gap:16px"></main></body>'}));
  await page.goto(new URL('sampling-comparison',origin).href);
  await page.addScriptTag({content:'window.createSampler='+createV100ImageSampler.toString()});
  const result=await page.evaluate(async()=>{
   const records=[],samples={};
   for(const[name,path,rect,size]of[
    ['背景','/art/v060/battle-nishijin-shopping-street-v1.webp',null,[300,169]],
    ['人物','/art/v060/characters/portraits/brawler-portrait-v2.webp',null,[88,110]],
    ['戦闘コマ','/art/v100/characters/paisen-battle-v1.png',[0,0,394,757],[62,119]],
   ]){
    const image=new Image();image.src=path;await image.decode();const crop=rect??[0,0,image.naturalWidth,image.naturalHeight];
    for(const mode of['従来の一段縮小','段階的な縮小']){
     const cell=document.createElement('section'),label=document.createElement('p');label.textContent=name+' / '+mode;cell.append(label);document.querySelector('main').append(cell);
     const canvas=document.createElement('canvas');canvas.width=size[0];canvas.height=size[1];cell.append(canvas);
     const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
     const sampler=window.createSampler(),draw=()=>mode==='段階的な縮小'?sampler[name==='背景'?'drawBackground':'draw'](ctx,image,...crop,0,0,...size):ctx.drawImage(image,...crop,0,0,...size);
     const start=performance.now();draw();const coldMs=performance.now()-start;
     samples[name+'|'+mode]=Array.from(ctx.getImageData(0,0,...size).data);
     const times=[];for(let i=0;i<120;i++){ctx.clearRect(0,0,...size);const t=performance.now();draw();times.push(performance.now()-t);}times.sort((a,b)=>a-b);
     records.push({name,mode,coldMs,warmP95Ms:times[114],cache:sampler.snapshot(),size,crop,path});sampler.clear();
    }
    const note=document.createElement('section');note.textContent='位置・寸法・元画像は共通';document.querySelector('main').append(note);
   }
   return{records,samples};
  });
  pixels[engine]=result.samples;report.engines.push({engine,records:result.records,errors});
  assert.deepEqual(errors,[]);for(const r of result.records.filter(r=>r.mode==='段階的な縮小')){assert.equal(r.cache.builds,1);assert.equal(r.cache.hits,120);assert.ok(r.cache.bytes<=r.cache.maxBytes);}
  await page.screenshot({path:out+'/'+engine+'.png'});
 }finally{await browser.close();}
}
report.crossEngine=[];
for(const name of['背景','人物','戦闘コマ']){
 const metrics={name};
 for(const mode of['従来の一段縮小','段階的な縮小']){
  const a=pixels.chromium[name+'|'+mode],b=pixels.webkit[name+'|'+mode];let delta=0;
  // Premultiply to ignore meaningless RGB in fully transparent pixels.
  for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++)delta+=Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255);
  metrics[mode]=delta/(a.length/4*3);
 }
 report.crossEngine.push(metrics);
}
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({crossEngine:report.crossEngine,engines:report.engines}));
