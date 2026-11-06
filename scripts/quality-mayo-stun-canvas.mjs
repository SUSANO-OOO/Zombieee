import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright';

// A bounded shared-renderer check, not a production battle, natural ability
// timing, original-speed observation, audio, or physical-device acceptance.
const ancestor='e4f9f56584e4e5fa33d1cfaa254b13a71e83ee54';
const out=path.resolve(process.env.QUALITY_MAYO_STUN_OUT??'output/quality-20261028/mayo-feral-stun-canvas-r1');
const hash=b=>createHash('sha256').update(b).digest('hex');
await fs.mkdir(out,{recursive:false});
await fs.copyFile(new URL(import.meta.url),path.join(out,'driver.mjs'));
const old=execFileSync('git',['show',ancestor+':app/v177JointPresentation.js'],{maxBuffer:8e6,encoding:'utf8'});
await fs.writeFile(path.join(out,'before-v177JointPresentation.js'),old);
const source=`
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from './app/v177JointPresentation.js';
import {createManualAbilityRuntime,advanceManualAbility} from './app/manualAbilities.js';
import {v105CurrentAbilitySample} from './app/v105CurrentAbilityPose.js';
window.runMayoStun=async()=>{
 const images={};
 for(const kind of ['mayo-chan','mayo-chan-feral']){
  const image=new Image();image.src=V177_JOINT_ATLASES[kind].path;await image.decode();images[kind]=image;
 }
 const actor={kind:'mayo-chan',side:'human',hp:170,combatReady:true,stunned:.2,
  manualAbility:{...createManualAbilityRuntime('mayo-chan'),phase:'recovery',windupRemaining:.005}};
 const runtime={locomotionPhase:.371,locomotionSettle:.5,elapsedSeconds:0,transitionCount:2};
 const rows=[];
 function frame(label,kind,sample,elapsed,remaining){
  const canvas=document.createElement('canvas');canvas.width=480;canvas.height=250;
  const ctx=canvas.getContext('2d'),plan=v177JointPose(kind,sample,{...runtime,elapsedSeconds:elapsed},{actor,grounded:true,stunRemaining:remaining});
  const succeeded=Boolean(plan)&&drawV177JointPose(ctx,images[kind],kind,plan,50,60,360,160,{actor});
  const data=ctx.getImageData(0,0,480,250).data;let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i])pixels++;
  const box=document.createElement('section'),title=document.createElement('p');title.textContent=label+' / current rig: '+succeeded;box.append(title,canvas);document.body.append(box);
  rows.push({label,kind,requestedState:sample.requestedState,liveStun:Boolean(plan?.liveStun),succeeded,pixels,atlas:V177_JOINT_ATLASES[kind].path,stunElapsed:plan?.stunElapsed??null});
 }
 frame('normal before transition','mayo-chan',{requestedState:'idle'},0,0);
 actor.manualAbility=advanceManualAbility(actor.manualAbility,.016).runtime;
 const before=JSON.stringify(actor),sample=v105CurrentAbilitySample(actor,{requestedState:'idle'});
 frame('feral stun entry','mayo-chan-feral',sample,0,.2);
 frame('feral stun 0.05s','mayo-chan-feral',sample,.05,.15);
 frame('feral resumed gait','mayo-chan-feral',{requestedState:'move'},.2,0);
 return {rows,phase:actor.manualAbility.phase,actorUnchanged:JSON.stringify(actor)===before};
};`;
const report={ancestor,scope:'Isolated actual shared-function Canvas draw with controlled state/time. No production battle, native speed, audio, physical or whole-game acceptance.',cases:[],errors:[]};
const browser=await chromium.launch({headless:true});
try{
 for(const baseline of [true,false]){
  const label=baseline?'before':'after';
  const compiled=await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'mayo-stun-canvas-entry.js'},bundle:true,format:'iife',platform:'browser',write:false,metafile:true,
   plugins:baseline?[{name:'exact-ancestor-renderer',setup(b){b.onLoad({filter:/[\\/]v177JointPresentation\.js$/},()=>({contents:old,loader:'js',resolveDir:path.resolve('app')}));}}]:[]});
  const bundle=compiled.outputFiles[0].contents;await fs.writeFile(path.join(out,label+'.js'),bundle);
  const inputs=[];
  for(const file of Object.keys(compiled.metafile.inputs))if(file!=='mayo-stun-canvas-entry.js'){
   const bytes=baseline&&file==='app/v177JointPresentation.js'?Buffer.from(old):await fs.readFile(file);
   inputs.push({file,bytes:bytes.length,sha256:hash(bytes)});
  }
  const context=await browser.newContext({viewport:{width:1040,height:690},serviceWorkers:'block'}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  try{
   await page.route('http://127.0.0.1/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/bundle.js')return route.fulfill({contentType:'text/javascript',body:Buffer.from(bundle)});
    if(url.pathname.startsWith('/art/')){
     const file=path.resolve('public','.'+url.pathname);assert.ok(file.startsWith(path.resolve('public')+path.sep));
     return route.fulfill({contentType:'image/webp',body:await fs.readFile(file)});
    }
    return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{background:#bbb;color:#111;font:16px sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:12px}section{background:#eee}p{margin:8px}canvas{display:block}</style><script src="/bundle.js"></script>'});
   });
   await page.goto('http://127.0.0.1/mayo-stun-canvas');const result=await page.evaluate(()=>window.runMayoStun());
   assert.equal(result.phase,'feral');assert.equal(result.actorUnchanged,true);
   for(const row of result.rows){const expected=!baseline||!row.label.startsWith('feral stun');assert.equal(row.succeeded,expected);assert.equal(row.pixels>0,expected);if(!baseline&&row.label.startsWith('feral stun'))assert.equal(row.liveStun,true);}
   await page.screenshot({path:path.join(out,label+'.png')});
   report.cases.push({label,bundleSha256:hash(bundle),inputs,...result});
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);
}catch(e){report.error=String(e);throw e;}
finally{await browser.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({out,cases:report.cases.map(c=>({label:c.label,rows:c.rows}))}));
