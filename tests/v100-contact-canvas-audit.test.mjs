import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installContactCanvasAudit} from '../scripts/v100-contact-canvas-audit.mjs';
function observe({owners=1,alternate=false,ambiguous=false,wrongAsset=false,disabled=false,nonfinite=false,receiptOverride={},snapshotOverride={},frames=[0,0,0,0,0],phaseOffset=0}={}){
 let snapshot,point;
 class Canvas{
  constructor(){this.canvas={dataset:{worldScale:'1',dpr:'1',worldOffsetX:'0',worldOffsetY:'0'},toDataURL:()=>''};this.globalCompositeOperation='source-over';this.globalAlpha=1;this.shadowBlur=0;}
  drawImage(){}
  getTransform(){return{a:1,b:0,c:0,d:1,e:point[0],f:point[1]};}
 }
 const window={location:{href:'http://localhost/v100'},__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot}};
 vm.runInNewContext('('+installContactCanvasAudit.toString()+')()',{window,CanvasRenderingContext2D:Canvas,URL,queueMicrotask:fn=>fn(),performance:{now:()=>snapshot.time*1000}});
 const canvas=new Canvas(),image={naturalWidth:1536,naturalHeight:1024,currentSrc:'http://localhost/art/v100/combat-vfx/'+(wrongAsset?'ground-impact':'contact')+'-six-frames-r1.webp'};
 for(let index=0;index<5;index++){
  const time=10+index*.095,target={id:9,side:'zombie',x:300,y:300,hp:1000-index*56,bodyRadius:nonfinite?NaN:14,combatReady:true};
  const fighters=Array.from({length:owners},(_,i)=>({id:i+1,side:'human',x:ambiguous||!alternate||i===index%2?262:100,y:300,hp:100,combatReady:true,stunned:disabled?.2:0,manualAbility:{activationId:1,sequentialBrawler:true,target:{targetId:9,direction:1}}}));
  const frame=frames[index];
  snapshot={time:time+frame/6*.2+.001+phaseOffset,fighters:[...fighters,target],manualAbilityReceipts:fighters.map(f=>({ownerId:f.id,activationId:1,kind:'brawler',eventType:'impact',at:time,salvoIndex:index,...receiptOverride})),...snapshotOverride};
  point=[293.7,270+(index%2?3:-3)];const size=index===4?70:52;
  canvas.drawImage(image,frame%3*512,Math.floor(frame/3)*512,512,512,-228/512*size,-270/512*size,size,size);
 }
 return window.__V100_CONTACT_QA__;
}
test('one surviving target, one valid attacker and five real contact draws form one complete sequence',()=>{
 const audit=observe();assert.equal(Object.keys(audit.comboContacts).length,5);assert.equal(audit.ambiguousDraws,0);
});
test('a skipped first render cell still requires a real later cell at the exact impact-clock phase',()=>{
 const frames=[1,2,4,5,1];
 assert.equal(Object.keys(observe({frames}).comboContacts).length,5);
 assert.equal(Object.keys(observe({frames,phaseOffset:.034}).comboContacts).length,0);
 assert.equal(Object.keys(observe({phaseOffset:.21}).comboContacts).length,0);
});
test('alternating attackers cannot both claim all five shared-target draws',()=>{
 const hits=Object.values(observe({owners:2,alternate:true}).comboContacts);
 assert.equal(hits.filter(h=>h.ownerId===1).length,3);assert.equal(hits.filter(h=>h.ownerId===2).length,2);
});
test('simultaneous valid owners are ambiguous and one draw cannot satisfy both',()=>{
 const audit=observe({owners:2,ambiguous:true});assert.equal(Object.keys(audit.comboContacts).length,0);assert.equal(audit.ambiguousDraws,5);
});
test('wrong sheet identity, disabled attackers and invalid coordinates cannot count as contacts',()=>{
 for(const options of [{wrongAsset:true},{disabled:true},{nonfinite:true},{receiptOverride:{at:NaN}},{receiptOverride:{at:undefined}},{snapshotOverride:{time:NaN}},{receiptOverride:{salvoIndex:-1}},{receiptOverride:{salvoIndex:5}},{receiptOverride:{salvoIndex:.5}}])assert.equal(Object.keys(observe(options).comboContacts).length,0);
});
