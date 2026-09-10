import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
const out = process.env.V100_CLINICAL_PREVIEW_DIR ?? "outputs/v100-clinical-control-preview-r1";
await mkdir(out, { recursive: false });
const source = (await readFile("app/v100DefenseObjectives.js", "utf8") + "\n" + await readFile("app/v100ClinicalControl.js", "utf8"))
  .replace(/^import .*;\r?\n/gmu, "").replace(/^export /gmu, "");
const image = `data:image/webp;base64,${(await readFile("public/art/v100/mission-objects/clinical-control-states-v1.webp")).toString("base64")}`;
const definition = v100BattleDefinitionFor("stage-mugarian-clinical-trial-wing");
const report = { build: await productionBuildIdentity(), scope: "Isolated production renderer with explicit four-state fixtures. This verifies authored source frames, alpha and browser decoding; earned combat, live draw positions and outcome remain separate.", cases: [] };
try {
  for (const [engine, api] of Object.entries({chromium, webkit})) {
    const browser = await api.launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:844,height:340}});
      await page.setContent('<body style="margin:0;background:#343a39"><canvas width="844" height="340"></canvas></body>');
      await page.addScriptTag({content:source+"\nwindow.clinicalApi={drawV100ClinicalControl,v100ClinicalControlState};"});
      const cases = await page.evaluate(async ({image,definition}) => {
        const atlas=new Image();atlas.src=image;await atlas.decode();
        const context=document.querySelector("canvas").getContext("2d"),cases=[];
        for(const [index,[time,baseHp]] of [[0,920],[45,920],[105,920],[45,0]].entries()) {
          const game={definition,time,baseHp,baseMaxHp:920,fighters:[]};
          const x=106+index*210,y=205,before=JSON.stringify(game);
          window.clinicalApi.drawV100ClinicalControl(context,game,{clinicalControlStates:atlas},x,y);
          const pixels=context.getImageData(x-90,y-125,180,132).data;
          let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>128)visible++;
          const state=window.clinicalApi.v100ClinicalControlState(definition,game);
          context.fillStyle="white";context.font="14px sans-serif";context.textAlign="center";context.fillText(state,x,y+32);
          cases.push({state,visible,unchanged:before===JSON.stringify(game)});
        }
        return cases;
      },{image,definition});
      assert.deepEqual(cases.map(c=>c.state),["sealed","releasing","complete","failed"]);
      assert.ok(cases.every(c=>c.visible>7000&&c.unchanged));
      const file=`${out}/${engine}-four-states.png`;await page.screenshot({path:file});
      report.cases.push({engine,cases,file});
    } finally {await browser.close();}
  }
  report.status="passed";
} catch(error) {report.status="failed";report.error=String(error.stack??error);process.exitCode=1;}
finally {await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,engines:report.cases.length,error:report.error}));}
