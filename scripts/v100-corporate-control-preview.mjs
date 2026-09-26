import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {chromium,webkit} from "playwright";
const out=process.env.V100_CONTROL_PREVIEW_DIR??"outputs/v100-corporate-control-preview-r2";
await mkdir(out,{recursive:false});
const source=(await readFile("app/v100CorporateControl.js","utf8")).replace(/^export /gmu,"");
const report={scope:"Explicit HP fixtures invoking the production renderer in both browser engines. This checks complete authored frames and no game mutation; native in-game positions and earned outcomes are separate.",cases:[]};
try{
  for(const [engine,api] of Object.entries({chromium,webkit}))for(const variant of ["corporate","lure"]){
    const image=`data:image/webp;base64,${(await readFile(`public/art/v100/mission-objects/${variant}-control-states-v1.webp`)).toString("base64")}`;
    const browser=await api.launch({headless:true});
    try{
      const page=await browser.newPage({viewport:{width:844,height:340}});
      await page.setContent('<body style="margin:0;background:#343a39"><canvas width="844" height="340"></canvas></body>');
      await page.addScriptTag({content:source+"\nwindow.controlApi={drawV100CorporateControl,v100CorporateControlState};"});
      const cases=await page.evaluate(async ({image,variant})=>{
        const atlas=new Image();atlas.src=image;await atlas.decode();const c=document.querySelector("canvas").getContext("2d"),cases=[];
        const original=document.createElement("canvas");original.width=atlas.naturalWidth;original.height=atlas.naturalHeight;
        const sourceContext=original.getContext("2d");sourceContext.drawImage(atlas,0,0);
        const columns=variant==="lure"?[0,530,1060,1560,2172]:[0,530,1030,1530,2172];
        for(const [i,hp] of [1000,700,300,0].entries()){
          const game={definition:{stageId:variant==="lure"?"stage-mugarian-logistics-hq":"stage-mugarian-special-operations-armory"},barricadeHp:hp,barricadeMaxHp:1000,barricadeVulnerable:true};
          const x=105+i*210,before=JSON.stringify(game);
          window.controlApi.drawV100CorporateControl(c,game,{corporateControlStates:atlas,lureControlStates:atlas},{attackX:x-10},[0,0,242]);
          const pixels=c.getImageData(x-95,90,190,230).data;let visible=0;for(let j=3;j<pixels.length;j+=4)if(pixels[j]>128)visible++;
          const sourcePixels=sourceContext.getImageData(columns[i],0,columns[i+1]-columns[i],724).data;
          let sourceVisible=0;for(let j=3;j<sourcePixels.length;j+=4)if(sourcePixels[j]>128)sourceVisible++;
          cases.push({state:window.controlApi.v100CorporateControlState(game),visible,expectedScaledSilhouette:sourceVisible*.22*.22,unchanged:before===JSON.stringify(game)});
        }return cases;
      },{image,variant});
      assert.deepEqual(cases.map(c=>c.state),[0,1,2,3]);assert.ok(cases.every(c=>c.visible>c.expectedScaledSilhouette*.8&&c.visible<c.expectedScaledSilhouette*1.2&&c.unchanged));
      const file=`${out}/${engine}-${variant}-four-states.png`;await page.screenshot({path:file});report.cases.push({engine,variant,cases,file});
    }finally{await browser.close();}
  }report.status="passed";
}catch(error){report.status="failed";report.error=String(error.stack??error);process.exitCode=1;}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,engines:report.cases.length,error:report.error}));}
