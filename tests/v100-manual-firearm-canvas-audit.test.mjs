import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {installManualFirearmCanvasAudit} from '../scripts/v100-manual-firearm-canvas-audit.mjs';

function inspect({type='muzzle',kind='gunner',mutate=()=>{},transform={}}={}){
 const entry={ownerId:3,kind,activationId:2,shotIndex:1,startedAt:20,x:418,y:268,hpBefore:100,hpAfter:78};
 const event={ownerId:3,kind,activationId:2,salvoIndex:1,at:20,eventType:type==='muzzle'&&kind==='gunner'?'muzzle':'impact'};
 const snapshot={time:20.001,v100ManualMuzzles:type==='muzzle'?[entry]:[],v100SkillContacts:type==='contact'?[entry]:[],manualAbilityReceipts:[event]};
 const canvas={dataset:{worldScale:'.5',dpr:'2',worldOffsetX:'7',worldOffsetY:'9'},toDataURL:()=>''};let actualDraws=0;
 class Context{constructor(){this.canvas=canvas;this.globalAlpha=1;this.globalCompositeOperation=type==='muzzle'?'lighter':'source-over';this.shadowBlur=0;}drawImage(){actualDraws++;}getTransform(){return{a:1,b:0,c:0,d:1,e:432,f:286,...transform};}}
 const window={__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot}};
 vm.runInNewContext('('+installManualFirearmCanvasAudit.toString()+')()',{CanvasRenderingContext2D:Context,window,location:{href:'http://localhost/'},performance:{now:()=>21000},URL,queueMicrotask:fn=>fn()});
 mutate(snapshot);
 const ctx=new Context(),image={naturalWidth:1536,naturalHeight:1024,src:'/art/v100/combat-vfx/'+(type==='muzzle'?'muzzle':'contact')+'-six-frames-r1.webp'};
 const duration=type==='contact'?.2:kind==='gunner'?.085:.1,size=type==='contact'?48:kind==='babayaga'?52:48,anchor=type==='contact'?[228,270]:[112,246];
 for(let frame=0;frame<6;frame++){
  if(Number.isFinite(snapshot.time))snapshot.time=20+(frame+.1)/6*duration;
  ctx.drawImage(image,frame%3*512,Math.floor(frame/3)*512,512,512,-anchor[0]/512*size,-anchor[1]/512*size,size,size);
 }
 assert.equal(actualDraws,6,'The observer must preserve every original draw');return window.__V100_MANUAL_FIREARM_QA__;
}

test('manual firearm canvas attribution requires the actual event, live position and frame phase for all three weapons',()=>{
 for(const kind of ['ranger','babayaga','gunner'])for(const type of ['muzzle','contact']){
  const audit=inspect({kind,type});assert.equal(audit.ignoredDraws,0);
  assert.deepEqual(Array.from(audit.records,r=>r.frame),[0,1,2,3,4,5]);
 }
});
test('manual firearm canvas attribution rejects normal fire, wrong activation or round, wrong damage and invalid geometry',()=>{
 for(const mutate of [s=>{s.manualAbilityReceipts=[];},s=>{s.manualAbilityReceipts[0].activationId++;},s=>{s.manualAbilityReceipts[0].salvoIndex++;},s=>{s.manualAbilityReceipts[0].eventType='impact';},s=>{s.v100ManualMuzzles[0].x+=20;},s=>{s.v100ManualMuzzles.push({...s.v100ManualMuzzles[0]});},s=>{s.v100ManualMuzzles[0].startedAt=19;}])assert.equal(inspect({mutate}).records.length,0);
 for(const mutate of [s=>{s.v100SkillContacts[0].hpAfter=100;},s=>{s.v100SkillContacts[0].hpAfter=105;},s=>{s.manualAbilityReceipts[0].at=19;}])assert.equal(inspect({type:'contact',mutate}).records.length,0);
 for(const transform of [{a:NaN},{a:0,d:0}])assert.equal(inspect({transform}).records.length,0);
 assert.equal(inspect({mutate:s=>{s.time=NaN;}}).records.length,0);
});
