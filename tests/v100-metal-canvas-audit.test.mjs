import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {installMetalCanvasAudit} from '../scripts/v100-metal-canvas-audit.mjs';

function inspect(mutator=()=>{},destination={},captureProbe=null){
 const snapshot={time:20.001,fighters:[{id:21,kind:'kumaverson',side:'human',hp:100,x:400,y:300,manualAbility:{phase:'active',activationId:3}}],v100MetalContacts:[{ownerId:21,ownerKind:'kumaverson',resolvedSocket:true,activationId:3,ownerHp:100,incomingDamage:20,x:418,y:268,startedAt:20,duration:.16}]};
 const canvas={width:844,height:340,pixel:'live-0',dataset:{worldScale:'1',dpr:'1',worldOffsetX:'0',worldOffsetY:'0'},toDataURL:()=>{throw Error('Do not encode the live canvas');}};
 class Context{constructor(target=canvas){this.canvas=target;this.globalAlpha=1;this.globalCompositeOperation='source-over';this.shadowBlur=0;}drawImage(...args){if(args.length===3)this.canvas.pixel=args[0].pixel;}getTransform(){return{a:1,b:0,c:0,d:1,e:418,f:268,...destination.transform};}}
 const copies=[];let encodes=0;
 const document={createElement:()=>{const copy={width:0,height:0,pixel:null,getContext:()=>new Context(copy),toDataURL:()=>{encodes++;return 'data:image/png;base64,'+copy.pixel;}};copies.push(copy);return copy;}};
 const window={location:{href:'http://localhost/'},__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot}};
 vm.runInNewContext('('+installMetalCanvasAudit.toString()+')()',{CanvasRenderingContext2D:Context,window,document,URL,performance:{now:()=>21000},queueMicrotask:fn=>fn()});
 mutator(snapshot);
 const context=new Context(),image={naturalWidth:1536,naturalHeight:1024,src:'/art/v100/combat-vfx/metal-impact-six-r1.webp'};
 for(const [frame,age]of [[1,.001],[2,.041],[4,.081],[5,.121]]){
  if(Number.isFinite(snapshot.time))snapshot.time=20+age;
  canvas.pixel='real-frame-'+frame;
  context.drawImage(image,frame%3*512,Math.floor(frame/3)*512,512,512,destination.dx??-180/512*54,destination.dy??-256/512*54,54,54);
 }
 if(captureProbe)captureProbe({audit:window.__V100_METAL_QA__,copies,encodes:()=>encodes,exportCaptures:window.__V100_METAL_EXPORT_CAPTURES__,canvas});
 return window.__V100_METAL_QA__;
}
test('metal oracle accepts four actual phases of one finite incoming-contact receipt',()=>{
 const audit=inspect();assert.equal(audit.unmatched,0);assert.deepEqual(Array.from(audit.draws,d=>d.frame),[1,2,4,5]);
 assert.equal(new Set(audit.draws.map(d=>d.contact.key)).size,1);
});

test('metal frame capture preserves actual draw copies without encoding or retaining live canvases during the burst',()=>{
 inspect(()=>{},{},({audit,copies,encodes,exportCaptures,canvas})=>{
  assert.equal(encodes(),0);assert.equal(copies.length,4);
  assert.ok(copies.every(c=>c.width===844&&c.height===340));
  canvas.pixel='later-battle';exportCaptures();
  assert.equal(encodes(),4);for(const frame of [1,2,4,5])assert.equal(audit.captures[frame],'data:image/png;base64,real-frame-'+frame);
  assert.ok(copies.every(c=>c.width===0&&c.height===0),'Release bounded copy surfaces after export');
  exportCaptures();assert.equal(encodes(),4,'Export is idempotent');
 });
});
test('guardian metal attribution additionally requires a resolved shield socket',()=>{
 const guardian=s=>{s.fighters[0].kind='guardian';s.v100MetalContacts[0].ownerKind='guardian';s.v100MetalContacts[0].resolvedSocket=true;};
 assert.equal(inspect(guardian).unmatched,0);
 assert.equal(inspect(s=>{guardian(s);s.v100MetalContacts[0].resolvedSocket=false;}).unmatched,4);
});
test('metal oracle rejects undrawable destinations and transforms',()=>{
 for(const destination of [{dx:NaN},{dy:NaN},{transform:{a:NaN}},{transform:{a:0,d:0}}])assert.equal(inspect(()=>{},destination).draws.filter(d=>d.contact).length,0);
});
test('metal oracle rejects no-hit aura, dead owner, invalid time and incorrect phase',()=>{
 for(const change of [s=>{s.v100MetalContacts=[];},s=>{s.fighters[0].hp=0;},s=>{s.time=NaN;},s=>{s.v100MetalContacts[0].startedAt=19;},s=>{s.v100MetalContacts[0].startedAt=19.96;},s=>{s.v100MetalContacts[0].incomingDamage=0;},s=>{s.v100MetalContacts.push({...s.v100MetalContacts[0]});},s=>{s.fighters[0].manualAbility.activationId=4;}]){
  const audit=inspect(change);assert.equal(audit.draws.filter(d=>d.contact).length,0);
 }
});
