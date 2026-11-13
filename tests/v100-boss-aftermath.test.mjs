import assert from 'node:assert/strict';
import test from 'node:test';
import {drawV100BossAftermath} from '../app/v100BossAftermath.js';
const kinds=['mother','ooguchi','gairen','futago','mugarian-president-mutated','takuya-omega'];
function fixture(){
 const calls=[],stack=[],ctx={globalAlpha:.7,globalCompositeOperation:'screen',shadowBlur:3,tx:0,ty:0,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.tx,this.ty]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.tx,this.ty]=stack.pop();},
  translate(...v){assert.ok(v.every(Number.isFinite));this.tx+=v[0];this.ty+=v[1];},rotate(v){assert.ok(Number.isFinite(v));},scale(...v){assert.ok(v.every(Number.isFinite));},
  drawImage(...args){calls.push({args,alpha:this.globalAlpha,composite:this.globalCompositeOperation,tx:this.tx,ty:this.ty});}};
 const objects=Object.fromEntries(['v100-dust','v100-smoke-a','v100-smoke-b','v100-ground-impact'].map(id=>[id,{id,complete:true,naturalWidth:128,naturalHeight:128}]));
 return {calls,ctx,objects,stack};
}
const entry={kind:'takuya-omega',x:400,y:250,elapsed:.4,duration:1.1,phase:'active',seed:17};
test('boss disturbances use decoded environmental paint, stay finite and restore canvas state',()=>{
 for(const kind of kinds){const f=fixture();
  assert.equal(drawV100BossAftermath(f.ctx,f.objects,{...entry,kind}),true);
  assert.ok(f.calls.length>=5&&f.calls.length<=16);
  assert.ok(f.calls.every(c=>Object.values(f.objects).includes(c.args[0])&&c.args.slice(1).every(Number.isFinite)&&c.alpha>0&&c.alpha<=1&&c.composite==='source-over'));
  assert.equal(f.ctx.globalAlpha,.7);assert.equal(f.ctx.globalCompositeOperation,'screen');assert.equal(f.ctx.shadowBlur,3);assert.equal(f.stack.length,0);
 }
});
test('boss profiles and stable seeds differ without frame-to-frame randomness',()=>{
 const render=patch=>{const f=fixture();drawV100BossAftermath(f.ctx,f.objects,{...entry,...patch});return f.calls.map(c=>[c.args[0].id,...c.args.slice(1),c.alpha]);};
 assert.deepEqual(render({}),render({}));
 assert.notDeepEqual(render({seed:17}),render({seed:18}));
 assert.equal(new Set(kinds.map(kind=>JSON.stringify(render({kind})))).size,kinds.length);
 assert.notDeepEqual(render({elapsed:.2}),render({elapsed:.6}));
 assert.notDeepEqual(render({phase:'active'}),render({phase:'recovery'}));
});
test('unknown, windup, expired and invalid states draw nothing; a missing required texture fails closed',()=>{
 for(const patch of [{kind:'takuya'},{phase:'windup'},{elapsed:-1},{elapsed:1.1},{x:NaN},{duration:0},{seed:NaN}]){
  const f=fixture();assert.equal(drawV100BossAftermath(f.ctx,f.objects,{...entry,...patch}),false);assert.equal(f.calls.length,0);
 }
 assert.throws(()=>drawV100BossAftermath(fixture().ctx,{},entry),/must decode/);
});

test('dust and smoke continue from the last active geometry into recovery without a jump',()=>{
 const end=fixture(),start=fixture();
 drawV100BossAftermath(end.ctx,end.objects,{...entry,elapsed:1.0999,duration:1.1});
 drawV100BossAftermath(start.ctx,start.objects,{...entry,phase:'recovery',elapsed:.0001,duration:1.08});
 assert.equal(start.calls.length,end.calls.length);
 for(let i=0;i<start.calls.length;i++){
  const a=start.calls[i],b=end.calls[i];assert.equal(a.args[0].id,b.args[0].id);
  for(const key of ['tx','ty'])assert.ok(Math.abs(a[key]-b[key])<1,key+' must not restart at the phase boundary');
  for(const slot of [3,4])assert.ok(Math.abs(a.args[slot]-b.args[slot])<1,'plume size must not shrink at the phase boundary');
  assert.ok(Math.abs(a.alpha-b.alpha)<.002);
 }
});
