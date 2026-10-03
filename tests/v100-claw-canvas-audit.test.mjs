import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {installClawCanvasAudit} from '../scripts/v100-claw-canvas-audit.mjs';

function inspect({mutate=()=>{},transform={},destination={},path='/art/v100/combat-vfx/claw-contact-six-r1.webp'}={}){
 const snapshot={time:20.001,v100ClawContacts:[{sourceId:3,sourceKind:'walker',attackSequence:2,targetId:8,hpBefore:100,hpAfter:82,x:418,y:268,startedAt:20,duration:.2}]};
 const canvas={dataset:{worldScale:'.5',dpr:'2',worldOffsetX:'7',worldOffsetY:'9'},toDataURL:()=>''};
 let actualDraws=0;
 class Context{constructor(){this.canvas=canvas;this.globalAlpha=1;this.globalCompositeOperation='source-over';this.shadowBlur=0;}drawImage(){actualDraws++;}getTransform(){return{a:-1,b:0,c:0,d:1,e:432,f:286,...transform};}}
 const window={__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot}};
 vm.runInNewContext('('+installClawCanvasAudit.toString()+')()',{CanvasRenderingContext2D:Context,window,location:{href:'http://localhost/'},performance:{now:()=>21000},URL,queueMicrotask:fn=>fn()});
 mutate(snapshot);
 const ctx=new Context(),image={naturalWidth:1536,naturalHeight:1024,src:path};
 for(let frame=0;frame<6;frame++){
  if(Number.isFinite(snapshot.time))snapshot.time=20+(frame+.1)/6*.2;
  ctx.drawImage(image,frame%3*512,Math.floor(frame/3)*512,512,512,destination.dx??-27,destination.dy??-27,54,54);
 }
 assert.equal(actualDraws,6,'Observation must preserve every original draw');
 return window.__V100_CLAW_QA__;
}
test('claw canvas audit attributes six real frame phases to one applied hit after viewport projection',()=>{
 const audit=inspect();assert.equal(audit.unmatched,0);
 assert.deepEqual(Array.from(audit.draws,d=>d.frame),[0,1,2,3,4,5]);
 assert.equal(new Set(audit.draws.map(d=>d.contact.key)).size,1);
});
test('claw canvas audit rejects wrong damage, expiry, duplicated attribution and non-drawable positions',()=>{
 for(const mutate of [
  s=>{s.v100ClawContacts[0].hpAfter=100;},s=>{s.v100ClawContacts[0].hpAfter=105;},
  s=>{s.v100ClawContacts[0].startedAt=19;},s=>{s.v100ClawContacts[0].sourceKind='red-panther-knife';},
  s=>{s.v100ClawContacts.push({...s.v100ClawContacts[0],sourceId:9});},
  s=>{s.v100ClawContacts[0].x+=30;},s=>{s.time=NaN;},
 ])assert.equal(inspect({mutate}).unmatched,6);
 for(const invalid of [{destination:{dx:NaN}},{destination:{dy:NaN}},{transform:{a:NaN}},{transform:{a:0,d:0}}])assert.equal(inspect(invalid).unmatched,6);
 assert.equal(inspect({path:'/art/v100/combat-vfx/contact-six-frames-r1.webp'}).draws.length,0);
});
