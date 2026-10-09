import assert from "node:assert/strict";
import { readFile,writeFile,mkdir } from "node:fs/promises";
import { chromium,webkit } from "playwright";
import path from "node:path";
const out=path.resolve(process.env.V100_VEHICLE_PREVIEW_DIR ?? "outputs/v100-mission-vehicle-preview");
await mkdir(out,{recursive:false});
const source=(await readFile("app/v100MissionVehicles.js","utf8")).replace(/^export /gmu,"");
const images=Object.fromEntries(await Promise.all(["intact","damaged"].map(async state=>[state,`data:image/webp;base64,${(await readFile(`public/art/v100/mission-objects/sealed-transport-${state}-v1.webp`)).toString("base64")}`])));
const report={scope:"Actual isolated vehicle renderer and authored alpha; production battle integration remains separate",cases:[]};
try {
 for(const [engine,api] of Object.entries({chromium,webkit})) {
  const browser=await api.launch({headless:true});
  try {
   const page=await browser.newPage({viewport:{width:844,height:390}});
   await page.setContent('<body style="margin:0;background:#202622"><canvas width="844" height="390"></canvas></body>');
   await page.addScriptTag({content:source+"\nwindow.vehicleApi={drawV100MissionVehicles,v100MissionVehicleImage};"});
   await page.evaluate(async images=>{window.vehicleImages={};for(const [state,url]of Object.entries(images)){const img=new Image();img.src=url;await img.decode();window.vehicleImages[`v100-mission-vehicle-${state}`]=img;}},images);
   const alpha=await page.evaluate(()=>{
    const original=window.vehicleImages["v100-mission-vehicle-intact"],damaged=window.vehicleImages["v100-mission-vehicle-damaged"];
    const rendered=window.vehicleApi.v100MissionVehicleImage(original,damaged,true);
    const c=document.createElement("canvas");c.width=original.naturalWidth;c.height=original.naturalHeight;const ctx=c.getContext("2d");ctx.drawImage(original,0,0);
    const a=ctx.getImageData(0,0,c.width,c.height).data,b=rendered.getContext("2d").getImageData(0,0,c.width,c.height).data;
    let mismatches=0,transparent=0,changedVisible=0;
    for(let i=3;i<a.length;i+=4){if(a[i]!==b[i])mismatches++;if(a[i]===0)transparent++;if(a[i]>=128&&(a[i-3]!==b[i-3]||a[i-2]!==b[i-2]||a[i-1]!==b[i-1]))changedVisible++;}
    return {mismatches,transparent,changedVisible};
   });
   // The author image's body is mostly alpha253, not255. Compare visible
   // authored pixels while requiring every alpha byte to match exactly.
   assert.equal(alpha.mismatches,0);assert.ok(alpha.transparent>500000);assert.ok(alpha.changedVisible>10000);
   for(const [stageId,number,count]of [["stage-research-freight-passage",12,1],["stage-coastal-link-bridge",19,1],["stage-bay-evacuation-yard",26,3]])for(const damaged of [false,true]) {
    const actual=await page.evaluate(({stageId,number,damaged})=>{const c=document.querySelector("canvas"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="#333d35";ctx.fillRect(0,150,844,150);let draws=0;const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(...args)=>{draws++;return draw(...args);};const rendered=window.vehicleApi.drawV100MissionVehicles(ctx,{definition:{stageId,missionConfig:{v100StageNumber:number}},stageMission:{integrity:damaged?200:500,maxIntegrity:500}},window.vehicleImages,422,240);ctx.drawImage=draw;return{rendered,draws};},{stageId,number,damaged});
    assert.equal(actual.rendered,true);assert.equal(actual.draws,count);
    const file=path.join(out,`${engine}-s${number}-${damaged?"damaged":"intact"}.png`);await page.screenshot({path:file});report.cases.push({engine,number,damaged,count,alpha,file,status:"passed-isolated-renderer"});
   }
  }finally{await browser.close();}
 }
 report.status="passed";
}catch(error){report.status="failed";report.error=String(error);process.exitCode=1;}
finally{await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error}));}
