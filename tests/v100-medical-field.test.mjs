import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAreaEffects} from '../app/gameRules.js';
import {drawV100MedicalArea,drawV100MedicalRecipients} from '../app/v100MedicalFieldVfx.js';

const mist={complete:true,naturalWidth:128,naturalHeight:128};
const gauze={complete:true,naturalWidth:1536,naturalHeight:1024};
const objects={'v100-dust':mist,'quality-medic-gauze':gauze};
function makeWorld(){
 return {time:10,battlefieldObjects:[{id:7,kind:'medical',phase:'active',hp:100}],
 areaEffects:[{id:3,sourceSupplyId:7,kind:'healing',phase:'active',remaining:8,x:350,y:240,radius:104,amountPerSecond:18}],
 fighters:[{id:1,side:'human',hp:20,maxHp:80,x:354,y:240,combatReady:true}]};
}
function canvas(){
 const calls=[],stack=[];
 const ctx={globalAlpha:.37,globalCompositeOperation:'multiply',shadowBlur:17,
 save(){stack.push({alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadow:this.shadowBlur});},
 restore(){const s=stack.pop();this.globalAlpha=s.alpha;this.globalCompositeOperation=s.composite;this.shadowBlur=s.shadow;},
 translate(x,y){calls.push({type:'translate',x,y});},scale(x,y){calls.push({type:'scale',x,y});},
 drawImage(...args){calls.push({type:'draw',args,alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadow:this.shadowBlur});}};
 return {ctx,calls,stack};
}
const draws=c=>c.calls.filter(x=>x.type==='draw');
test('a deployed aid station paints material mist, restores canvas state and leaves simulation data untouched',()=>{
 const w=makeWorld(),before=JSON.stringify(w),c=canvas();
 assert.equal(drawV100MedicalArea(c.ctx,objects,w.areaEffects[0],w.time,w),true);
 assert.equal(draws(c).length,2);
 assert.ok(draws(c).every(d=>d.args[0]===mist&&d.composite==='source-over'&&d.shadow===0&&d.alpha>0&&d.alpha<=.22));
 assert.deepEqual([c.ctx.globalAlpha,c.ctx.globalCompositeOperation,c.ctx.shadowBlur,c.stack.length],[.37,'multiply',17,0]);
 assert.equal(JSON.stringify(w),before);
 const translations=c.calls.filter(x=>x.type==='translate');
 for(let i=0;i<translations.length;i++){
  const x=translations[i].x,width=draws(c)[i].args[3];
  assert.ok(x-width/2>=350-104&&x+width/2<=350+104);
 }
});
test('the dressing selects the actual game-rule recipients, and overlapping stations paint a recipient once',()=>{
 const w=makeWorld(),base=w.fighters[0];
 w.fighters=[
 {...base,id:1},{...base,id:2,x:350,y:270},{...base,id:3,x:350,y:295},
 {...base,id:4,x:455},{...base,id:5,hp:80},{...base,id:6,hp:0},
 {...base,id:7,side:'zombie'},{...base,id:8,combatReady:false},
 ];
 const stepped=advanceAreaEffects({areaEffects:w.areaEffects,fighters:w.fighters,seconds:.1,activeSupplyIds:[7]});
 w.fighters=stepped.fighters;w.areaEffects=[...stepped.areaEffects,{...stepped.areaEffects[0],id:4}];
 const c=canvas(),before=JSON.stringify(w);assert.equal(drawV100MedicalRecipients(c.ctx,objects,w),true);
 const positions=[...new Set(draws(c).map(d=>JSON.stringify([d.args[5]+d.args[7]/2,d.args[6]+60])))].map(s=>JSON.parse(s));
 const expected=stepped.changes.filter(c=>c.kind==='healing').map(change=>w.fighters.find(f=>f.id===change.id));
 assert.deepEqual(positions.sort(),expected.map(f=>[f.x,f.y]).sort());
 assert.ok(draws(c).length<=expected.length*2);
 assert.equal(JSON.stringify(w),before);
});
test('recipient animation uses all six actual atlas cells and follows the living actor',()=>{
 const w=makeWorld(),cells=new Set();
 for(let i=0;i<18;i++){w.time=10+i/24;const c=canvas();drawV100MedicalRecipients(c.ctx,objects,w);
 for(const d of draws(c)){assert.equal(d.args[0],gauze);assert.equal(d.args[3],512);assert.equal(d.args[4],512);
 cells.add(d.args[1]/512+d.args[2]/512*3);assert.ok(d.args.slice(1).every(Number.isFinite));}}
 assert.deepEqual([...cells].sort(),[0,1,2,3,4,5]);
 const before=canvas();drawV100MedicalRecipients(before.ctx,objects,w);
 w.fighters[0].x+=20;w.fighters[0].y-=8;
 const after=canvas();drawV100MedicalRecipients(after.ctx,objects,w);
 assert.equal(draws(after)[0].args[5]-draws(before)[0].args[5],20);
 assert.equal(draws(after)[0].args[6]-draws(before)[0].args[6],-8);
 w.fighters[0].hp=w.fighters[0].maxHp;const full=canvas();assert.equal(drawV100MedicalRecipients(full.ctx,objects,w),false);assert.equal(draws(full).length,0);
});
test('destroyed, missing and expired source stations paint neither a field nor a treatment',()=>{
 for(const failure of ['dead','missing','expired']){
  const w=makeWorld();if(failure==='dead')w.battlefieldObjects[0].hp=0;
  if(failure==='missing')w.battlefieldObjects=[];
  if(failure==='expired')w.areaEffects[0]={...w.areaEffects[0],remaining:0,phase:'expired'};
  const c=canvas();assert.equal(drawV100MedicalArea(c.ctx,objects,w.areaEffects[0],w.time,w),false);
  assert.equal(drawV100MedicalRecipients(c.ctx,objects,w),false);assert.equal(draws(c).length,0);
 }
 const w=makeWorld(),step=advanceAreaEffects({areaEffects:w.areaEffects,fighters:w.fighters,seconds:.1,activeSupplyIds:[]});
 assert.deepEqual(step.changes,[]);assert.equal(step.areaEffects[0].phase,'expired');
});
test('missing or incorrect material does not invent a ring, vector, glyph or load request',()=>{
 const w=makeWorld();
 for(const unavailable of [{},{'v100-dust':{...mist,complete:false}},{'quality-medic-gauze':{...gauze,naturalWidth:128}}]){
  const c=canvas();assert.equal(drawV100MedicalArea(c.ctx,unavailable,w.areaEffects[0],w.time,w),false);
  assert.equal(drawV100MedicalRecipients(c.ctx,unavailable,w),false);assert.equal(c.calls.length,0);
 }
});
test('remaining lifetime and the last healing points fade without changing the real eight-second / 18 HP rule',()=>{
 const w=makeWorld(),first=canvas();drawV100MedicalRecipients(first.ctx,objects,w);
 w.areaEffects[0].remaining=.1;w.fighters[0].hp=79.9;const last=canvas();drawV100MedicalRecipients(last.ctx,objects,w);
 assert.ok(draws(last)[0].alpha<draws(first)[0].alpha/10);
 const base=makeWorld(),step=advanceAreaEffects({areaEffects:base.areaEffects,fighters:base.fighters,seconds:8,activeSupplyIds:[7]});
 assert.equal(step.fighters[0].hp,80);assert.equal(step.changes[0].amount,60);assert.equal(step.areaEffects[0].remaining,0);
 const ended=canvas();base.areaEffects=step.areaEffects;base.fighters=step.fighters;
 assert.equal(drawV100MedicalRecipients(ended.ctx,objects,base),false);assert.equal(draws(ended).length,0);
});
test('render variation never consumes simulation randomness and rejects non-finite input',()=>{
 const w=makeWorld(),original=Math.random;
 try{Math.random=()=>{throw new Error('simulation RNG must not be used by paint');};const c=canvas();
 assert.equal(drawV100MedicalArea(c.ctx,objects,w.areaEffects[0],w.time,w),true);
 assert.equal(drawV100MedicalRecipients(c.ctx,objects,w),true);}finally{Math.random=original;}
 for(const key of ['id','sourceSupplyId','x','y','radius','remaining']){
  const bad=makeWorld();bad.areaEffects[0][key]=NaN;const c=canvas();
  assert.equal(drawV100MedicalArea(c.ctx,objects,bad.areaEffects[0],bad.time,bad),false);
  assert.equal(drawV100MedicalRecipients(c.ctx,objects,bad),false);assert.equal(c.calls.length,0);
 }
});

test('a newly active overlapping station keeps treatment visible as the earlier station expires',()=>{
 const w=makeWorld(),fresh=canvas();drawV100MedicalRecipients(fresh.ctx,objects,w);
 w.areaEffects[0].remaining=.01;w.areaEffects.push({...w.areaEffects[0],id:4,sourceSupplyId:8,remaining:8});
 w.battlefieldObjects.push({...w.battlefieldObjects[0],id:8});
 const overlap=canvas();drawV100MedicalRecipients(overlap.ctx,objects,w);
 assert.deepEqual(draws(overlap).map(d=>[d.alpha,...d.args.slice(1)]),draws(fresh).map(d=>[d.alpha,...d.args.slice(1)]));
});
