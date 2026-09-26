import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {V100_COMBAT_VFX_ART} from '../app/v100CombatVfx.js';
import {stageVisualFor} from '../app/productionVisuals.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
const out='outputs/v100-vfx-review-r1',origin=process.env.V100_CAMPAIGN_QA_BASE_URL;
await mkdir(out,{recursive:true});
const html='<html lang="ja"><meta charset="utf-8"><style>body{margin:0;background:#080d10;color:#f9db9d;font:18px sans-serif}canvas{display:block;width:844px;height:340px}p{position:absolute;top:4px;left:24px;margin:0}small{position:absolute;bottom:10px;left:24px;font-size:13px}</style><canvas width="960" height="387"></canvas><p>爆発と土煙 — 演出の確認用</p><small>爆発は短く、煙は薄く消える。実戦のタイミング・重なりは別途確認中。</small></html>';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:844,height:340},recordVideo:{dir:out+'/video',size:{width:844,height:340}}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/vfx-proof',r=>r.fulfill({contentType:'text/html',body:html}));
await page.goto(new URL('vfx-proof',origin).href);
const source=await readFile('app/v100CombatVfx.js','utf8');
await page.addScriptTag({type:'module',content:source+`
 const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
 const objects={};
 for(const [id,path] of Object.entries(V100_COMBAT_VFX_ART)){const im=new Image();im.src=path;await im.decode();objects[id]=im;}
 const bg=new Image();bg.src=${JSON.stringify(stageVisualFor(V100_STAGE_IDS[0]))};await bg.decode();
 function frame(t){
  ctx.drawImage(bg,0,0,960,387);ctx.fillStyle='rgba(4,9,12,.15)';ctx.fillRect(0,0,960,387);
  const elapsed=t%4.5;
  drawV100Explosion(ctx,objects,{x:320,y:270,scale:'medium',elapsed,duration:1.05});
  drawV100Explosion(ctx,objects,{x:620,y:285,scale:'large',elapsed:elapsed-.35,duration:1.42});
  if(elapsed<1.5)drawV100FootDust(ctx,objects,{x:850-elapsed*160,y:330,time:t,seed:4,direction:-1,rush:elapsed>.5,windup:elapsed<=.5});
 }
 window.paintVfx=frame;frame(.65);window.vfxReady=true;
 window.startVfx=()=>{const start=performance.now();function animate(now){frame((now-start)/1000);if(now-start<10000)requestAnimationFrame(animate);else window.vfxEnded=true}requestAnimationFrame(animate)};
`});
await page.waitForFunction(()=>window.vfxReady);
await page.screenshot({path:out+'/impact.png'});
await page.evaluate(()=>window.startVfx());
await page.waitForFunction(()=>window.vfxEnded,{},{timeout:15000});
await page.evaluate(()=>window.paintVfx(4));
await page.screenshot({path:out+'/after-clear.png'});
await context.close();const video=await page.video().path();await browser.close();
if(errors.length)throw new Error(errors.join('\n'));
const mp4=out+'/vfx.mp4';
execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-i',video,'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-an',mp4]);
await copyFile(mp4,'outputs/v100-audio-review-r2/vfx.mp4');
let index=await readFile('outputs/v100-audio-review-r2/index.html','utf8');
if(!index.includes('src="vfx.mp4"'))index=index.replace('</html>','')+'<section><h2>爆発・土煙の演出候補</h2><p>ゲームで使う描画処理を再生しています。キャラクターの攻撃モーションは作業中です。</p><video controls playsinline preload="metadata" src="vfx.mp4"></video><small>rubberduck / Kenney, CC0。炎と煙の連続コマ・土煙の素材を使用。</small></section></html>';
await writeFile('outputs/v100-audio-review-r2/index.html',index);
await writeFile(out+'/report.json',JSON.stringify({scope:'Production VFX renderer on production background, isolated timed display, not gameplay or physical-device acceptance',sources:V100_COMBAT_VFX_ART,video,mp4,errors},null,2));
console.log(mp4);
