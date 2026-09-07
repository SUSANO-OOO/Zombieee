import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const out=process.env.V100_OBJECTIVE_BROWSER_DIR??'outputs/v100-objective-placement-browser-r1';await mkdir(out,{recursive:false});
const report={build:await productionBuildIdentity(),scope:'Explicit stage-entry saves. Native production entry and final-canvas decoded sources, complete alpha silhouettes, exact vehicle count, HUD/viewport clearance and diagnostics. No battle state edits. Damage previews and earned wins are separate; physical-device/audio acceptance is not implied.',cases:[]};
try{
  for(const [engine,api] of Object.entries({webkit,chromium}))for(const viewport of [{width:844,height:340},{width:844,height:390},{width:1280,height:720}])for(const stageNumber of [26,6,12,19,4,1,30]){
    const stageId=V100_STAGE_IDS[stageNumber-1],seed=serializeV100Save(normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:'目標表示検証',availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,stageNumber-1),readStoryEventIds:['v100:event:prologue',`v100:event:s${stageNumber}:pre`],flowState:{phase:'formation',stageId,stageNumber,destination:'formation'}}));
    const browser=await api.launch({headless:true}),page=await browser.newPage({viewport,hasTouch:true,isMobile:viewport.width<1000});
    const item={engine,viewport,stageNumber,status:'running',errors:[]};report.cases.push(item);
    page.on('pageerror',e=>item.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')item.errors.push(m.text());});page.on('requestfailed',r=>item.errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)item.errors.push(r.status()+': '+r.url());});
    try{
      await page.addInitScript(({origin,seed})=>{
        if(location.origin===origin&&!localStorage.getItem('nishijin-campaign-v100'))localStorage.setItem('nishijin-campaign-v100',seed);
        const proto=CanvasRenderingContext2D.prototype,draw=proto.drawImage,cache=new WeakMap();window.__OBJECTIVE_PLACEMENT__={objects:[]};
        proto.drawImage=function(image,...a){
          const source=image?.src??'';
          if(this.canvas===document.querySelector('.game-shell canvas')&&/\/(transport|maintenance-cart|escort-destination|infected-stronghold|station-relay)-states-v1\.webp$/u.test(source)){
            let frames=cache.get(image);if(!frames){frames=new Map();cache.set(image,frames);}const key=a.slice(0,4).join(',');let bounds=frames.get(key);
            if(!bounds){
              const c=document.createElement('canvas');c.width=a[2];c.height=a[3];const ctx=c.getContext('2d');draw.call(ctx,image,a[0],a[1],a[2],a[3],0,0,a[2],a[3]);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
              let left=c.width,top=c.height,right=0,bottom=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}bounds=[left,top,right,bottom];frames.set(key,bounds);
            }
            const matrix=this.getTransform(),rect=this.canvas.getBoundingClientRect();
            const point=(x,y)=>{const p=matrix.transformPoint(new DOMPoint(a[4]+x*a[6]/a[2],a[5]+y*a[7]/a[3]));return{x:rect.x+p.x*rect.width/this.canvas.width,y:rect.y+p.y*rect.height/this.canvas.height};};
            if(/(escort-destination|infected-stronghold|station-relay)-states/u.test(source))window.__OBJECTIVE_PLACEMENT__.objects=[];
            window.__OBJECTIVE_PLACEMENT__.objects.push({source,args:a,topLeft:point(bounds[0],bounds[1]),bottomRight:point(bounds[2],bounds[3])});
          }return draw.call(this,image,...a);
        };
      },{origin:origin.origin,seed});
      await page.goto(origin.href);await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.v100-shell[aria-busy="false"][data-v100-phase="formation"]'));
      await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
      const expected=[6,12,19].includes(stageNumber)?2:stageNumber===26?4:1;
      await page.waitForFunction(expected=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&window.__OBJECTIVE_PLACEMENT__.objects.length===expected,expected);
      item.observed=await page.evaluate(()=>{
        const hud=document.querySelector('.barrier-health')?.getBoundingClientRect(),snapshot=window.__ASHFALL_BATTLE_QA__.getSnapshot();
        return{...window.__OBJECTIVE_PLACEMENT__,overflow:document.documentElement.scrollWidth-innerWidth,hud:hud?{x:hud.x,y:hud.y,right:hud.right,bottom:hud.bottom}:null,escort:snapshot.escortMissionObject};
      });
      assert.equal(item.observed.overflow,0);assert.equal(item.observed.objects.length,expected);
      for(const object of item.observed.objects){
        const{topLeft:a,bottomRight:b}=object;assert.ok(a.x>=0&&a.y>=0&&b.x<=viewport.width&&b.y<=viewport.height,'complete silhouette inside viewport: '+JSON.stringify(object));
        const p=item.observed.hud;if(p)assert.ok(b.x<=p.x||a.x>=p.right||b.y<=p.y||a.y>=p.bottom,'objective overlaps HUD: '+JSON.stringify({object,p}));
      }
      if(expected>1){assert.equal(item.observed.escort.vehicleCount,expected-1);assert.equal(item.observed.escort.authoredState,'intact');assert.equal(item.observed.escort.destinationReached,false);}
      item.screenshot=`${out}/${engine}-${viewport.width}x${viewport.height}-s${stageNumber}.png`;await page.screenshot({path:item.screenshot});assert.deepEqual(item.errors,[]);item.status='passed';
    }catch(error){item.status='failed';item.error=String(error.stack??error);await page.screenshot({path:`${out}/${engine}-${viewport.height}-s${stageNumber}-failure.png`}).catch(()=>{});throw error;}
    finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
  }report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error}));}
