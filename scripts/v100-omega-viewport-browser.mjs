import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';import {V100_STAGE_IDS} from '../app/v100Registry.js';import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const out=process.env.V100_OMEGA_VIEWPORT_DIR??'outputs/v100-omega-viewport-browser-r1';await mkdir(out,{recursive:false});
const report={build:await productionBuildIdentity(),scope:'Explicit Stage30 entry saves. Native production Omega entrance and ordinary motion, source-alpha silhouette transformed through the actual final-canvas pose, command HUD clearance and unchanged 9200HP definition. No actors, clocks or results are changed. Earned victory and full-campaign acceptance are separate.',cases:[]};
try{for(const [engine,api]of Object.entries({webkit,chromium}))for(const viewport of [{width:844,height:340},{width:844,height:390},{width:1280,height:720}]){
  const stageId=V100_STAGE_IDS[29],seed=serializeV100Save(normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:'Ω表示検証',availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,29),readStoryEventIds:['v100:event:prologue','v100:event:s30:pre'],flowState:{phase:'formation',stageId,stageNumber:30,destination:'formation'}}));
  const browser=await api.launch({headless:true}),page=await browser.newPage({viewport,hasTouch:true,isMobile:viewport.width<1000}),item={engine,viewport,errors:[],status:'running'};report.cases.push(item);
  page.on('pageerror',e=>item.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')item.errors.push(m.text());});page.on('requestfailed',r=>item.errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)item.errors.push(r.status()+': '+r.url());});
  try{
    await page.addInitScript(({origin,seed})=>{
      if(location.origin===origin&&!localStorage.getItem('nishijin-campaign-v100'))localStorage.setItem('nishijin-campaign-v100',seed);
      const proto=CanvasRenderingContext2D.prototype,draw=proto.drawImage,cache=new Map();window.__OMEGA_VIEW__={active:false,frames:{},count:0,overlapPixels:0,overlapExamples:[],objectiveSides:[]};
      proto.drawImage=function(image,...a){
        if(window.__OMEGA_VIEW__.active&&this.canvas===document.querySelector('.game-shell canvas')&&image?.src?.includes('/takuya-omega-battle-v1')){
          const key=a.slice(0,4).join(',');let original=cache.get(key);if(!original){const c=document.createElement('canvas');c.width=a[2];c.height=a[3];const ctx=c.getContext('2d');draw.call(ctx,image,a[0],a[1],a[2],a[3],0,0,a[2],a[3]);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=0,b=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>128){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x+1);b=Math.max(b,y+1);}original={bounds:[l,t,r,b],pixels,width:c.width,height:c.height};cache.set(key,original);}const bounds=original.bounds;
          const m=this.getTransform(),rect=this.canvas.getBoundingClientRect();const points=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[0],bounds[3]],[bounds[2],bounds[3]]].map(([x,y])=>{const p=m.transformPoint(new DOMPoint(a[4]+x*a[6]/a[2],a[5]+y*a[7]/a[3]));return{x:rect.x+p.x*rect.width/this.canvas.width,y:rect.y+p.y*rect.height/this.canvas.height};});
          const frame={left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};
          const objective=document.querySelector('.barrier-health'),side=objective?.classList.contains('omega-objective-left')?'left':'right';if(!window.__OMEGA_VIEW__.objectiveSides.includes(side))window.__OMEGA_VIEW__.objectiveSides.push(side);
          // Check actual occupied HUD rectangles against authored alpha on the
          // native canvas grid. Empty sky beside a HUD is valid on desktop.
          const inverse=m.inverse(),sx=this.canvas.width/rect.width,sy=this.canvas.height/rect.height;
          for(const hud of document.querySelectorAll('.battle-brand-zone,.battle-message-stack,.battle-controls-zone,.barrier-health,.boss-hud,.enable-audio-button')){
            const h=hud.getBoundingClientRect();if(!h.width||!h.height||frame.right<=h.left||frame.left>=h.right||frame.bottom<=h.top||frame.top>=h.bottom)continue;
            let overlap=0;
            for(let py=Math.ceil((Math.max(frame.top,h.top)-rect.top)*sy);py<(Math.min(frame.bottom,h.bottom)-rect.top)*sy;py++)for(let px=Math.ceil((Math.max(frame.left,h.left)-rect.left)*sx);px<(Math.min(frame.right,h.right)-rect.left)*sx;px++){
              const p=inverse.transformPoint(new DOMPoint(px+.5,py+.5)),x=Math.floor((p.x-a[4])*a[2]/a[6]),y=Math.floor((p.y-a[5])*a[3]/a[7]);
              if(x>=0&&x<original.width&&y>=0&&y<original.height&&original.pixels[(y*original.width+x)*4+3]>128)overlap++;
            }
            window.__OMEGA_VIEW__.overlapPixels+=overlap;if(overlap&&window.__OMEGA_VIEW__.overlapExamples.length<3)window.__OMEGA_VIEW__.overlapExamples.push({key,frame,hud:hud.className,rect:{left:h.left,top:h.top,right:h.right,bottom:h.bottom},overlap});
          }
          const old=window.__OMEGA_VIEW__.frames[key];window.__OMEGA_VIEW__.frames[key]={left:Math.min(old?.left??Infinity,frame.left),top:Math.min(old?.top??Infinity,frame.top),right:Math.max(old?.right??0,frame.right),bottom:Math.max(old?.bottom??0,frame.bottom)};window.__OMEGA_VIEW__.count++;
        }return draw.call(this,image,...a);
      };
    },{origin:origin.origin,seed});
    await page.goto(origin.href);await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.v100-shell[aria-busy="false"][data-v100-phase="formation"]'));await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
    await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().fighters.some(f=>f.kind==='takuya-omega'&&f.combatReady&&!f.gateEntering));
    await page.evaluate(()=>{window.__OMEGA_VIEW__.active=true;});
    await page.waitForFunction(()=>window.__OMEGA_VIEW__.objectiveSides.includes('left')&&window.__OMEGA_VIEW__.objectiveSides.includes('right'),undefined,{timeout:30000});
    item.observed=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot(),boss=s.fighters.find(f=>f.kind==='takuya-omega'),banner=document.querySelector('.battle-banner')?.getBoundingClientRect();window.__OMEGA_VIEW__.active=false;return{...window.__OMEGA_VIEW__,boss:{hp:boss.hp,maxHp:boss.maxHp,y:boss.y,renderAudit:boss.renderAudit},objectiveHud:document.querySelector('.barrier-health')?.textContent,bannerBottom:banner?.bottom??50,overflow:document.documentElement.scrollWidth-innerWidth};});
    assert.equal(item.observed.boss.maxHp,9200);assert.equal(item.observed.overflow,0);assert.ok(item.observed.count>=30);assert.ok(Object.keys(item.observed.frames).length>0);
    for(const frame of Object.values(item.observed.frames))assert.ok(frame.left>=0&&frame.top>=0&&frame.right<=viewport.width&&frame.bottom<=viewport.height,'complete Omega inside viewport');
    assert.equal(item.observed.overlapPixels,0,'authored Omega silhouette overlaps occupied HUD: '+JSON.stringify(item.observed.overlapExamples));
    assert.ok(item.observed.objectiveHud.includes('感染拠点')&&item.observed.objectiveHud.includes('防護中'),'keep the protected objective information');assert.deepEqual(item.observed.objectiveSides,['left','right']);
    item.screenshot=`${out}/${engine}-${viewport.width}x${viewport.height}.png`;await page.screenshot({path:item.screenshot});assert.deepEqual(item.errors,[]);item.status='passed';
  }catch(e){item.status='failed';item.error=String(e.stack??e);await page.screenshot({path:`${out}/${engine}-${viewport.height}-failure.png`}).catch(()=>{});throw e;}
  finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
}report.status='passed';}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error}));}
