import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const out=path.resolve('output/quality-20261028/panther-scale-r2');
await mkdir(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#202731}canvas{display:block}</style><canvas width="844" height="340"></canvas><script type="module">
import {V177_JOINT_ATLASES as atlases,v177JointPose,drawV177JointPose} from '/app/v177JointPresentation.js';
import {V177_PANTHER_JOINT_ATLASES as originals} from '/app/v177PantherJointData.js';
import {spriteFrameFor} from '/app/spriteManifest.js';
import {v102BattleDisplaySize} from '/app/v102BattleScale.js';
import {animationClipFor} from '/app/combatPresentation.js';
const kinds=['red-panther-knife','red-panther-shield','red-panther-smg','red-panther-commander'];
const maximum=[{w:54,h:68},{w:62,h:70},{w:60,h:68},{w:62,h:70}];
const selected={...atlases},images={};
for(const k of kinds){let img=new Image();img.src=atlases[k].path;await img.decode();images[k]=img;}
const c=document.querySelector('canvas'),ctx=c.getContext('2d');
const start=performance.now();window.__frames=0;
function draw(now){
 const t=(now-start)/1000,phase=t%4,state=phase<1?'idle':phase<3?'move':'active',progress=state==='active'?phase-3:0;
 ctx.fillStyle='#202731';ctx.fillRect(0,0,844,340);ctx.font='15px sans-serif';ctx.fillStyle='white';
 ctx.fillText('表示倍率の比較（実レンダラー／同じ動作・同じ素材）',12,23);
 for(let row=0;row<2;row++){
  const floor=155+row*160;ctx.fillStyle='#d5dae1';ctx.fillText(row?'修正後':'修正前',12,floor-106);
  ctx.strokeStyle='#70808d';ctx.beginPath();ctx.moveTo(12,floor);ctx.lineTo(832,floor);ctx.stroke();
  for(let i=0;i<kinds.length;i++){
   const k=kinds[i];atlases[k]=row?selected[k]:originals[k];
   const frame=spriteFrameFor(k,'idle','right'),size=v102BattleDisplaySize(k,frame,maximum[i]);
   const scale=animationClipFor(k,'idle').bodyScale;size.w*=scale;size.h*=scale;
   const plan=v177JointPose(k,{requestedState:state,clipProgress:progress},{locomotionPhase:t*.9,locomotionSettle:state==='move'?0:1});
   const x=125+i*190;drawV177JointPose(ctx,images[k],k,plan,x-frame.anchorX*size.w,floor-frame.anchorY*size.h,size.w,size.h);
   ctx.fillStyle='white';ctx.fillText(['刀兵','盾兵','銃兵','指揮官'][i],x-18,floor+20);
   atlases[k]=selected[k];
  }
 }
 window.__frames++;window.__state={state,t};requestAnimationFrame(draw);
}requestAnimationFrame(draw);window.__ready=true;
</script>`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:844,height:340},recordVideo:{dir:out,size:{width:844,height:340}}});
const sources=['app/qualityPantherBodyScale.js','app/v177JointPresentation.js','app/v177PantherJointData.js'];
const hashes=Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const report={scope:'Isolated production-renderer comparison at native canvas size. Same atlas textures and pose clock, original versus calibrated projection. Not actual campaign gameplay or physical-device acceptance.',sources:hashes,errors:[]};
try {
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='quality.local')return route.abort();
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
  const isModule=url.pathname.startsWith('/app/'),isAsset=url.pathname.startsWith('/art/');
  if(!isModule&&!isAsset)return route.abort();
  const root=path.resolve(isModule?'.':'public'),file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep))return route.abort();
  return route.fulfill({contentType:isModule?'application/javascript':'image/webp',body:await readFile(file)});
 });
 await page.goto('http://quality.local/');await page.waitForFunction(()=>window.__ready);
 await page.screenshot({path:path.join(out,'idle.png')});
 await page.waitForFunction(()=>window.__state?.state==='move');await page.screenshot({path:path.join(out,'move.png')});
 await page.waitForFunction(()=>window.__state?.state==='active');await page.screenshot({path:path.join(out,'attack.png')});
 await page.waitForFunction(()=>window.__state?.t>9);report.frames=await page.evaluate(()=>window.__frames);
 assert.equal(report.errors.length,0);assert.ok(report.frames>120);report.status='rendered';
 await context.close();report.video=await page.video().path();
}catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await context.close();await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
