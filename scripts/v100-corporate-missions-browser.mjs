import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium,webkit} from "playwright";
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from "../app/v100Save.js";
import {V100_STAGE_IDS} from "../app/v100Registry.js";
import {stageVisualFor} from "../app/productionVisuals.js";
import {V100_CORPORATE_CONTROLS} from "../app/v100CorporateControl.js";
import {productionBuildIdentity} from "./browser-qa-build-identity.mjs";
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(["localhost","127.0.0.1"].includes(origin.hostname));
const out=process.env.V100_CORPORATE_BROWSER_DIR??"outputs/v100-corporate-missions-browser-r4";await mkdir(out,{recursive:false});
const report={build:await productionBuildIdentity(),scope:"Explicit entry saves. Native production battle entry, final-canvas source/transform/silhouette, overflow and diagnostics. Damage fixtures and earned battle are separate. Browser results do not establish physical-device or audible acceptance.",cases:[]};
try{
  for(const [engine,api] of Object.entries({webkit,chromium}))for(const viewport of [{width:844,height:340},{width:844,height:390},{width:1280,height:720}])for(const stageNumber of [27,21,23,24,25]){
    const stageId=V100_STAGE_IDS[stageNumber-1],seed=serializeV100Save(normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:"設備表示検証",availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,stageNumber-1),readStoryEventIds:["v100:event:prologue",`v100:event:s${stageNumber}:pre`],flowState:{phase:"formation",stageId,stageNumber,destination:"formation"}}));
    const browser=await api.launch({headless:true}),page=await browser.newPage({viewport,hasTouch:true,isMobile:viewport.width<1000});
    const item={engine,viewport,stageNumber,errors:[],status:"running"};report.cases.push(item);
    page.on("pageerror",e=>item.errors.push(String(e)));page.on("console",m=>{if(m.type()==="error")item.errors.push(m.text());});
    page.on("requestfailed",r=>item.errors.push(r.url()+": "+r.failure()?.errorText));page.on("response",r=>{if(r.status()>=400)item.errors.push(r.status()+": "+r.url());});
    try{
      await page.addInitScript(({origin,seed})=>{
        if(location.origin===origin&&!localStorage.getItem("nishijin-campaign-v100"))localStorage.setItem("nishijin-campaign-v100",seed);
        const p=CanvasRenderingContext2D.prototype,draw=p.drawImage,sources=new WeakMap();window.__CORPORATE_VIEW__={};
        p.drawImage=function(image,...a){
          const source=image?.src??sources.get(image)??"";if(source.includes("/stages/"))sources.set(this.canvas,source);
          if(this.canvas===document.querySelector(".game-shell canvas")){
            if(source.includes("/stages/"))window.__CORPORATE_VIEW__.background=source;
            if(/\/(corporate|lure)-control-states-v1\.webp$/u.test(source)){
              const matrix=this.getTransform(),rect=this.canvas.getBoundingClientRect();
              const bounds=source.includes("lure")?[36,20,471,710]:[107,15,459,712];
              const point=(sx,sy)=>{const p=matrix.transformPoint(new DOMPoint(a[4]+(sx-a[0])*a[6]/a[2],a[5]+(sy-a[1])*a[7]/a[3]));return{x:rect.x+p.x*rect.width/this.canvas.width,y:rect.y+p.y*rect.height/this.canvas.height};};
              window.__CORPORATE_VIEW__.object={source,args:a,topLeft:point(bounds[0],bounds[1]),bottomRight:point(bounds[2],bounds[3])};
            }
          }return draw.call(this,image,...a);
        };
      },{origin:origin.origin,seed});
      await page.goto(origin.href);await page.getByRole("button",{name:"ブラウザで遊ぶ",exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.v100-shell[aria-busy="false"][data-v100-phase="formation"]'));
      await page.getByRole("button",{name:"戦闘へ",exact:true}).click();
      await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&window.__CORPORATE_VIEW__.object);
      item.observed=await page.evaluate(()=>{const panel=document.querySelector(".barrier-health").getBoundingClientRect();return{...window.__CORPORATE_VIEW__,overflow:document.documentElement.scrollWidth-innerWidth,panel:{x:panel.x,y:panel.y,right:panel.right,bottom:panel.bottom},hud:document.querySelector(".barrier-health").textContent,objective:document.querySelector(".battle-objective").textContent};});
      assert.ok(item.observed.background.endsWith(stageVisualFor(stageId)));assert.equal(item.observed.overflow,0);
      const{topLeft:a,bottomRight:b}=item.observed.object;assert.ok(a.x>=0&&a.y>=0&&b.x<=viewport.width&&b.y<=viewport.height,"complete objective must remain visible");
      const p=item.observed.panel;assert.ok(b.x<=p.x||a.x>=p.right||b.y<=p.y||a.y>=p.bottom,"objective silhouette must not overlap its HUD");
      assert.ok(item.observed.hud.includes(V100_CORPORATE_CONTROLS[stageId]));
      item.file=`${out}/${engine}-${viewport.width}x${viewport.height}-s${stageNumber}.png`;await page.screenshot({path:item.file});assert.deepEqual(item.errors,[]);item.status="passed";
    }catch(error){item.status="failed";item.error=String(error.stack??error);await page.screenshot({path:`${out}/${engine}-${viewport.height}-s${stageNumber}-failure.png`}).catch(()=>{});throw error;}
    finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
  }report.status="passed";
}catch(error){report.status="failed";report.error=String(error.stack??error);process.exitCode=1;}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error}));}
