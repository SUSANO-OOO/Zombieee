// Intended location: tests/v100-chiha-final-burst-vfx.test.mjs.
// Draw-call contracts only; native original-speed and listening review are separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {clearV100AdvancedAbilityEffects,drawV100AdvancedAbilityEffects,drawV100ChihaFinalBursts,getV100AdvancedAbilityEffectsSnapshot,queueV100AdvancedAbilityEffect} from '../app/v100AdvancedAbilityVfx.js';
import {drawV100ChihaFinalBurst,V100_CHIHA_FINAL_BURST_DURATION} from '../app/v100ChihaFinalBurstVfx.js';

const world=()=>({time:10,definition:{missionConfig:{v100StageNumber:23}}});
const final=(ownerId=7,x=400)=>({ownerId,activationId:12,shotIndex:3,targetId:90+ownerId,type:'mrs-grenade-impact',finalRound:true,x,y:280,duration:V100_CHIHA_FINAL_BURST_DURATION});
function images(missing=[],failed=[]){
 const dimensions={'quality-boss-blast':[1536,1024],'v100-explosion':[768,640],'v100-dust':[128,128],'v100-smoke-a':[128,128],'v100-smoke-b':[128,128]};
 return Object.fromEntries(Object.entries(dimensions).filter(([id])=>!missing.includes(id)).map(([id,[w,h]])=>[id,{id,complete:!failed.includes(id),naturalWidth:w,naturalHeight:h}]));
}
function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function paint(width=844,height=340){
 const worldScale=Math.max(width/960,height/540),stack=[],calls=[];
 const ctx={matrix:[worldScale,0,0,worldScale,(width-960*worldScale)/2,(height-540*worldScale)/2],globalAlpha:.61,globalCompositeOperation:'multiply',shadowBlur:7,
  state(){return {matrix:[...this.matrix],alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadow:this.shadowBlur};},
  save(){stack.push(this.state());},restore(){const s=stack.pop();assert.ok(s,'balanced restore');this.matrix=s.matrix;this.globalAlpha=s.alpha;this.globalCompositeOperation=s.composite;this.shadowBlur=s.shadow;},
  translate(x,y){this.matrix=multiply(this.matrix,[1,0,0,1,x,y]);},scale(x,y){this.matrix=multiply(this.matrix,[x,0,0,y,0,0]);},rotate(a){this.matrix=multiply(this.matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
  drawImage(image,...args){
   assert.ok(image?.complete&&image.naturalWidth>0&&image.naturalHeight>0,'never draw undefined or failed images');assert.ok(args.length===4||args.length===8);assert.ok(args.every(Number.isFinite));assert.ok(this.matrix.every(Number.isFinite));assert.ok(Number.isFinite(this.globalAlpha)&&this.globalAlpha>=0&&this.globalAlpha<=1);
   const [x,y,w,h]=args.slice(-4),m=this.matrix;assert.ok(w>0&&h>0);const points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([px,py])=>[m[0]*px+m[2]*py+m[4],m[1]*px+m[3]*py+m[5]]);
   calls.push({image:image.id,args,alpha:this.globalAlpha,matrix:[...m],bounds:{left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))}});
  }};
 return {ctx,calls,stack,viewport:{viewportWidth:width,viewportHeight:height,worldScale}};
}
function boundsArea(calls){assert.ok(calls.length);return (Math.max(...calls.map(c=>c.bounds.right))-Math.min(...calls.map(c=>c.bounds.left)))*(Math.max(...calls.map(c=>c.bounds.bottom))-Math.min(...calls.map(c=>c.bounds.top)));}
function early(game,objects,p=paint()){const state=p.ctx.state();drawV100ChihaFinalBursts(p.ctx,objects,game,p.viewport);assert.deepEqual(p.ctx.state(),state,'render restores transform/alpha/composite/shadow');assert.equal(p.stack.length,0);return p;}

test('final uses only the early pass while the three normal impact streams stay in the late pass',()=>{
 const game=world(),normal=world();
 for(let shotIndex=0;shotIndex<3;shotIndex++){const e={...final(),shotIndex,finalRound:false,duration:.6,x:350+shotIndex*20};assert.equal(queueV100AdvancedAbilityEffect(game,e),true);queueV100AdvancedAbilityEffect(normal,e);}
 queueV100AdvancedAbilityEffect(game,final());game.time=normal.time=10.3;
 const p=early(game,images());assert.ok(p.calls.some(c=>c.image==='quality-boss-blast'));assert.equal(p.calls.filter(c=>c.image==='v100-explosion').length,0);
 const earlyCount=p.calls.length;drawV100AdvancedAbilityEffects(p.ctx,images(),game);
 const reference=paint();drawV100AdvancedAbilityEffects(reference.ctx,images(),normal);
 assert.deepEqual(p.calls.slice(earlyCount),reference.calls,'mixed queue late draws equal actual normal-only queue');
 const late=p.calls.slice(earlyCount);assert.equal(late.filter(c=>c.image==='v100-explosion').length,3);assert.equal(late.filter(c=>c.image==='quality-boss-blast').length,0);
});

test('missing/decode-failed dedicated sheet keeps old painted fire safely, without stretching its .6s age',()=>{
 const cases=[{missing:['quality-boss-blast']},{failed:['quality-boss-blast']},{missing:['quality-boss-blast','v100-dust']},{missing:['quality-boss-blast','v100-smoke-a','v100-smoke-b']},{missing:['quality-boss-blast','v100-explosion']},{missing:Object.keys(images())}];
 for(const c of cases){const game=world();queueV100AdvancedAbilityEffect(game,final());game.time=10.3;const objects=images(c.missing,c.failed),p=early(game,objects),hasFire=Boolean(objects['v100-explosion']);
  assert.equal(p.calls.some(d=>d.image==='v100-explosion'),hasFire);assert.equal(p.calls.some(d=>d.image==='quality-boss-blast'),false);if(!hasFire)assert.equal(p.calls.length,0);
  if(hasFire){const main=p.calls.find(d=>d.image==='v100-explosion');assert.equal(main.args.at(-2),132);assert.equal(main.args.at(-1),132);game.time=10.5999;assert.ok(early(game,objects).calls.some(d=>d.image==='v100-explosion'));}
  for(const age of [.6001,.89]){game.time=10+age;assert.equal(early(game,objects).calls.length,0,'old fire expires while final queue is still alive');assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length,1);}
 }
 // A ready dedicated fire remains visible even if every companion/old fire is absent.
 const game=world();queueV100AdvancedAbilityEffect(game,final());game.time=10.3;const p=early(game,images(['v100-explosion','v100-dust','v100-smoke-a','v100-smoke-b']));assert.ok(p.calls.length>0);assert.ok(p.calls.every(c=>c.image==='quality-boss-blast'));
});

test('actual transformed draw bounds fit10.5% per burst, including two simultaneous owners and old-pack fallback',()=>{
 for(const [width,height]of [[740,340],[844,390],[667,240],[740,220]])for(const missing of [[],['quality-boss-blast']])for(const age of [.03,.16,.3,.46,.5999,.66,.899]){
  const singles=[];
  for(const [id,x]of [[7,290],[8,670]]){const game=world();queueV100AdvancedAbilityEffect(game,final(id,x));game.time=10+age;singles.push(early(game,images(missing),paint(width,height)).calls);}
  for(const calls of singles)if(calls.length)assert.ok(boundsArea(calls)/(width*height)<=.105+1e-9,'measured image rectangles exceed screen budget');
  const game=world();queueV100AdvancedAbilityEffect(game,final(7,290));queueV100AdvancedAbilityEffect(game,final(8,670));game.time=10+age;const p=early(game,images(missing),paint(width,height));
  assert.deepEqual(p.calls,singles.flat(),'second owner adds exactly its own paint once');assert.ok(p.calls.length<=(missing.length?16:10));
  assert.ok(singles.reduce((sum,c)=>sum+(c.length?boundsArea(c):0),0)/(width*height)<=.21+1e-9,'two bounds may sum to21%, not a global10.5% limit');
 }
});

test('world-time pause, expiry and clear retain event metadata and never alter gameplay state',()=>{
 const game=world(),entry=final();queueV100AdvancedAbilityEffect(game,entry);game.time=10.3;const beforeWorld=structuredClone(game),beforeQueue=getV100AdvancedAbilityEffectsSnapshot(game),a=early(game,images()),b=early(game,images());
 assert.deepEqual(a.calls,b.calls,'same paused world.time paints the same frame');assert.deepEqual(game,beforeWorld);assert.deepEqual(getV100AdvancedAbilityEffectsSnapshot(game),beforeQueue);
 for(const key of ['ownerId','activationId','shotIndex','targetId','x','y'])assert.equal(beforeQueue[0][key],entry[key]);assert.equal(beforeQueue[0].startedAt,10);
 game.time=10.8999;assert.ok(early(game,images()).calls.length>0);game.time=10.9001;assert.equal(early(game,images()).calls.length,0);assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length,0);
 queueV100AdvancedAbilityEffect(game,entry);clearV100AdvancedAbilityEffects(game);assert.equal(early(game,images()).calls.length,0);assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length,0);
});

test('real six-cell paint advances then fades, while ground anchors remain fixed on both facing sides',()=>{
 for(const x of [290,670]){const cells=new Set();for(const age of [0,.065,.16,.29,.46,.66,.899]){const game=world();queueV100AdvancedAbilityEffect(game,final(7,x));game.time=10+age;const p=early(game,images());const fire=p.calls.filter(c=>c.image==='quality-boss-blast');assert.ok(fire.length>0&&fire.length<=2);for(const c of fire){cells.add(Math.round(c.args[0]/512)+3*Math.round(c.args[1]/512));assert.equal(c.args[2],512);assert.equal(c.args[3],512);assert.equal(c.matrix[4],p.viewport.worldScale*x+(p.viewport.viewportWidth-960*p.viewport.worldScale)/2);assert.ok(Math.sign(c.matrix[0])===(x>480?-1:1));if(age===.899)assert.ok(c.alpha<.01);}}assert.deepEqual([...cells].sort(),[0,1,2,3,4,5]);}
});

test('unrelated/invalid effect and viewport boundaries cannot paint or leak canvas state',()=>{
 for(const patch of [{finalRound:false},{type:'tky-lightblade'},{x:NaN},{elapsed:-.01},{elapsed:.9},{duration:0},{ownerId:NaN},{activationId:NaN}]){const p=paint(),state=p.ctx.state();assert.equal(drawV100ChihaFinalBurst(p.ctx,images(),{...final(),elapsed:.3,...patch},1),false);assert.equal(p.calls.length,0);assert.deepEqual(p.ctx.state(),state);assert.equal(p.stack.length,0);}
 for(const patch of [{viewportWidth:0},{viewportHeight:NaN},{worldScale:0}]){const game=world();queueV100AdvancedAbilityEffect(game,final());game.time=10.3;const p=paint();drawV100ChihaFinalBursts(p.ctx,images(),game,{...p.viewport,...patch});assert.equal(p.calls.length,0);}
 const p=paint();assert.throws(()=>p.ctx.drawImage(undefined,0,0,1,1),'fake canvas rejects unsafe draw counterexample');assert.throws(()=>p.ctx.drawImage(images()['v100-dust'],NaN,0,1,1),'fake canvas rejects nonfinite draw counterexample');
});
