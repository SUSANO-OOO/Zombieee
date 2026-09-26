import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {V100_STAGE_BY_ID} from '../app/v100Registry.js';
import {V100_CORPORATE_CONTROLS} from '../app/v100CorporateControl.js';
const out=process.env.V100_OBJECTIVE_PREVIEW_DIR??'outputs/v100-objective-states-preview-r1';await mkdir(out,{recursive:false});
const sources=await Promise.all(['app/v100AssaultObjects.js','app/v100MissionVehicleSprites.js'].map(async p=>(await readFile(p,'utf8')).replace(/^import .*;\r?\n/gmu,'').replace(/^export /gmu,'')));
const report={scope:'Explicit HP fixtures calling the production renderers, with decoded source-alpha coverage and unchanged game-state checks. Native battle placement and ordinary wins are separate evidence.',cases:[]};
try{
  for(const [engine,api] of Object.entries({chromium,webkit})){
    const browser=await api.launch({headless:true});
    try{for(const variant of ['stronghold','relay','transport','maintenance','destination']){
      const file={stronghold:'infected-stronghold',relay:'station-relay',transport:'transport',maintenance:'maintenance-cart',destination:'escort-destination'}[variant]+'-states-v1.webp';
      const image='data:image/webp;base64,'+(await readFile('public/art/v100/mission-objects/'+file)).toString('base64');
      const page=await browser.newPage({viewport:{width:1000,height:400}});
      await page.setContent('<body style="margin:0;background:#343a39"><canvas width="1000" height="400"></canvas></body>');
      await page.addScriptTag({content:'const V100_STAGE_BY_ID='+JSON.stringify(V100_STAGE_BY_ID)+';const V100_CORPORATE_CONTROLS='+JSON.stringify(V100_CORPORATE_CONTROLS)+';\n'+sources.join('\n')+'\nwindow.api={drawV100AssaultObject,drawV100VehicleSprite,v100VehicleSprite,drawV100EscortDestination,v100EscortDestinationState};'});
      const cases=await page.evaluate(async({image,variant})=>{
        const atlas=new Image();atlas.src=image;await atlas.decode();const ctx=document.querySelector('canvas').getContext('2d'),result=[];
        const original=document.createElement('canvas');original.width=atlas.naturalWidth;original.height=atlas.naturalHeight;const src=original.getContext('2d');src.drawImage(atlas,0,0);
        for(let i=0;i<(variant==='destination'?2:4);i++){
          const hp=[1000,590,290,0][i],x=125+i*250,y=330;
          const game={definition:{stageId:variant==='relay'?'stage-nishijin-station-gate':'stage-nishijin-shopping-street',missionConfig:{v100StageNumber:variant==='relay'?4:1}},barricadeHp:hp,barricadeMaxHp:1000,baseHp:680,stageMission:{integrity:hp,maxIntegrity:1000,completed:i===1}};
          const before=JSON.stringify(game),draw=ctx.drawImage;let args;
          ctx.drawImage=function(img,...a){args=a;return draw.call(this,img,...a);};
          if(['stronghold','relay'].includes(variant))window.api.drawV100AssaultObject(ctx,game,{['v100-assault-'+variant]:atlas},{attackX:x-10},[0,0,y-42]);
          else if(variant==='destination')window.api.drawV100EscortDestination(ctx,game,atlas,x,y);
          else window.api.drawV100VehicleSprite(ctx,atlas,window.api.v100VehicleSprite(variant==='maintenance'?'stage-nishijin-station-tunnel-seal':'stage-research-freight-passage',game.stageMission),x,y);
          ctx.drawImage=draw;
          const pixels=ctx.getImageData(i*250,20,250,380).data;let visible=0;for(let j=3;j<pixels.length;j+=4)if(pixels[j]>128)visible++;
          const source=src.getImageData(args[0],args[1],args[2],args[3]).data;let sourceVisible=0;for(let j=3;j<source.length;j+=4)if(source[j]>128)sourceVisible++;
          result.push({index:i,args,visible,expected:sourceVisible*(args[6]/args[2])*(args[7]/args[3]),unchanged:JSON.stringify(game)===before});
        }return result;
      },{image,variant});
      assert.ok(cases.every(c=>c.unchanged&&c.visible>c.expected*.8&&c.visible<c.expected*1.2),JSON.stringify({variant,cases}));
      const screenshot=out+'/'+engine+'-'+variant+'.png';await page.screenshot({path:screenshot});report.cases.push({engine,variant,cases,screenshot});await page.close();
    }}finally{await browser.close();}
  }report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error}));}
