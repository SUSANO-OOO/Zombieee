import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {chromium,webkit} from 'playwright';
import {v100BattleDefinitionFor} from '../app/v100BattleAdapter.js';
const out=process.env.V100_DEFENSE_PREVIEW_DIR??'outputs/v100-defense-perimeter-preview-r1';await mkdir(out,{recursive:false});
const source=(await readFile('app/v100DefenseObjectives.js','utf8')).replace(/^export /gmu,'')+'\n'+(await readFile('app/v100DefensePerimeter.js','utf8')).replace(/^import .*;\r?\n/gmu,'').replace(/^export /gmu,'');
const image='data:image/webp;base64,'+(await readFile('public/art/v100/mission-objects/defense-perimeter-states-v1.webp')).toString('base64'),report={scope:'Explicit clock/contact/impact/HP fixtures invoking the production status and renderer. Native battle placement and earned outcomes remain separate.',cases:[]};
try{for(const [engine,api]of Object.entries({chromium,webkit})){
  const browser=await api.launch({headless:true});try{
    const page=await browser.newPage({viewport:{width:1000,height:260}});await page.setContent('<body style="margin:0;background:#343a39"><canvas width="1000" height="260"></canvas></body>');
    await page.addScriptTag({content:source+'\nwindow.api={drawV100DefensePerimeter,v100DefenseStatus};'});
    const cases=await page.evaluate(async({image,definition})=>{
      const atlas=new Image();atlas.src=image;await atlas.decode();const ctx=document.querySelector('canvas').getContext('2d');
      const source=document.createElement('canvas');source.width=1983;source.height=793;const src=source.getContext('2d');src.drawImage(atlas,0,0);const cols=[0,392,770,1158,1535,1983],result=[];
      for(let i=0;i<5;i++){
        const game={definition,time:i>=3?definition.defenseEndAt:definition.prepSeconds+10,baseHp:i===4?0:920,baseMaxHp:920,crawlerHitFlash:i===2?.1:0,fighters:i===1?[{side:'zombie',hp:100,x:400,combatReady:true}]:[]},before=JSON.stringify(game);
        window.api.drawV100DefensePerimeter(ctx,game,{'v100-defense-perimeter':atlas},100+i*200,210);
        const pixels=ctx.getImageData(i*200,30,200,230).data,original=src.getImageData(cols[i],0,cols[i+1]-cols[i],793).data;
        let visible=0,sourceVisible=0;for(let j=3;j<pixels.length;j+=4)if(pixels[j]>128)visible++;for(let j=3;j<original.length;j+=4)if(original[j]>128)sourceVisible++;
        result.push({phase:window.api.v100DefenseStatus(definition,game).phase,visible,expected:sourceVisible*.28*.28,unchanged:JSON.stringify(game)===before});
      }return result;
    },{image,definition:v100BattleDefinitionFor('stage-sawara-ward-office')});
    assert.deepEqual(cases.map(c=>c.phase),['perimeter','incoming','impact','success','failed']);assert.ok(cases.every(c=>c.unchanged&&c.visible>c.expected*.8&&c.visible<c.expected*1.2));
    await page.screenshot({path:out+'/'+engine+'.png'});report.cases.push({engine,cases});
  }finally{await browser.close();}
}report.status='passed';}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error}));}
