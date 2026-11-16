import test from 'node:test';
import assert from 'node:assert/strict';
import {queueV100GuardActivation,drawV100GuardActivations} from '../app/v100GuardActivationVfx.js';
import {V100_GUARD_ACTIVATION_ART as ART} from '../app/v100GuardActivationArt.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {V100_STAGE_BY_ID} from '../app/v100Registry.js';

const previous={
 'v100-dust':{complete:true,naturalWidth:128,naturalHeight:128},
 'v100-ground-impact':{complete:true,naturalWidth:1536,naturalHeight:1024},
};
const image=()=>({complete:true,naturalWidth:768,naturalHeight:512});
function fixture(kind='guardian'){
 const owner={id:7,kind,side:'human',hp:120,x:200,y:280,manualAbility:{activationId:4,phase:'active'}};
 const world={time:3,definition:{missionConfig:{v100StageNumber:5}},fighters:[owner]};
 assert.equal(queueV100GuardActivation(world,owner),true);return {owner,world};
}
function canvas(){
 const rows=[],stack=[];return {rows,globalAlpha:.7,globalCompositeOperation:'lighter',shadowBlur:4,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
  translate(...a){rows.push(['translate',...a]);},scale(...a){rows.push(['scale',...a]);},rotate(...a){rows.push(['rotate',...a]);},
  drawImage(...a){rows.push(['raster',a,this.globalAlpha]);},
  arc(){throw Error('No geometric substitute');},ellipse(){throw Error('No geometric substitute');}};
}
function assertRestored(c){assert.deepEqual([c.globalAlpha,c.globalCompositeOperation,c.shadowBlur],[.7,'lighter',4]);}

test('each authored guard uses its own decoded six-frame art at the planted position without simulation changes',()=>{
 for(const [kind,art]of Object.entries(ART)){
  const {world}=fixture(kind),duration=kind==='guardian'?.68:.62;
  world.time+=duration*.25;const before=structuredClone(world),c=canvas(),source=image();
  drawV100GuardActivations(c,{...previous,[art.id]:source},world);
  const paints=c.rows.filter(r=>r[0]==='raster');assert.equal(paints.length,2);
  assert.deepEqual(c.rows.filter(r=>r[0]==='translate'),[['translate',200,282]]);
  for(const [index,p]of paints.entries()){
   const frame=index+1;assert.equal(p[1][0],source);
   assert.deepEqual(p[1].slice(1,5),[frame*256,0,256,256]);
   assert.deepEqual(p[1].slice(5),[-art.anchors[frame][0]*art.worldWidth,-art.anchors[frame][1]*art.worldHeight,art.worldWidth,art.worldHeight]);
   assert.ok(Math.abs(p[2]-(index===0?.72:.24))<1e-12);
  }
  assertRestored(c);assert.deepEqual(world,before);
 }
});

test('missing, incomplete, zero-size and wrong-sized optional art all retain the exact existing material fallback',()=>{
 for(const kind of Object.keys(ART))for(const bad of [undefined,{...image(),complete:false},{...image(),naturalWidth:0},{...image(),naturalWidth:769},{...image(),naturalHeight:513}]){
  const {world}=fixture(kind);world.time+=.13;const actual=canvas(),reference=canvas();
  drawV100GuardActivations(actual,{...previous,[ART[kind].id]:bad},world);
  drawV100GuardActivations(reference,previous,fixtureAt(kind,world.time));
  assert.deepEqual(actual.rows,reference.rows);assertRestored(actual);
 }
});
function fixtureAt(kind,time){const f=fixture(kind);f.world.time=time;return f.world;}

test('a late optional decode cannot pop into an existing activation but is available on the next real activation',()=>{
 const {owner,world}=fixture(),art=ART.guardian,late={...image(),complete:false},objects={...previous,[art.id]:late};
 drawV100GuardActivations(canvas(),objects,world);late.complete=true;world.time+=.13;
 const current=canvas(),reference=canvas();drawV100GuardActivations(current,objects,world);
 drawV100GuardActivations(reference,previous,fixtureAt('guardian',world.time));assert.deepEqual(current.rows,reference.rows);
 owner.manualAbility.activationId++;assert.equal(queueV100GuardActivation(world,owner),true);
 const next=canvas();drawV100GuardActivations(next,objects,world);
 assert.ok(next.rows.some(r=>r[0]==='raster'&&r[1][0]===late));assertRestored(next);
});

test('an authored drawing exception restores incoming canvas state and does not mutate the world',()=>{
 const {world}=fixture(),before=structuredClone(world),c=canvas();c.drawImage=()=>{throw Error('test drawing failure');};
 assert.throws(()=>drawV100GuardActivations(c,{...previous,[ART.guardian.id]:image()},world),/test drawing failure/);
 assertRestored(c);assert.deepEqual(world,before);
});

test('the other two guarded abilities keep their original material even when the new art is loaded',()=>{
 const all={...previous,...Object.fromEntries(Object.values(ART).map(a=>[a.id,image()]))};
 for(const kind of ['crazy-king','miyamoto-musashi']){
  const a=canvas(),b=canvas();drawV100GuardActivations(a,all,fixtureAt(kind,3.13));
  drawV100GuardActivations(b,previous,fixtureAt(kind,3.13));assert.deepEqual(a.rows,b.rows);assertRestored(a);
 }
});

test('new art loads only for selected current-version guards whose exact artwork path is verified',()=>{
 const stageId=Object.keys(V100_STAGE_BY_ID)[4],paths=Object.values(ART).map(a=>a.path),ids=new Set(Object.values(ART).map(a=>a.id));
 const authored=plan=>plan.stageObjects.filter(o=>ids.has(o.id));
 assert.deepEqual(authored(requiredBattleAssetPlan({stageId,formationKinds:['guardian','kumaverson']})),[]);
 for(const kind of Object.keys(ART)){
  const one=requiredBattleAssetPlan({stageId,formationKinds:[kind,kind],verifiedGuardImpactPaths:paths});
  assert.deepEqual(authored(one).map(o=>[o.id,o.path,o.optional]),[[ART[kind].id,ART[kind].path,true]]);
  assert.equal(one.optionalPaths.filter(p=>p===ART[kind].path).length,1);
  assert.deepEqual(one.paths,requiredBattleAssetPlan({stageId,formationKinds:[kind,kind]}).paths);
  assert.deepEqual(authored(requiredBattleAssetPlan({stageId,formationKinds:[kind],verifiedGuardImpactPaths:paths,includeV100Sprites:false})),[]);
 }
 assert.deepEqual(authored(requiredBattleAssetPlan({stageId,formationKinds:['medic'],verifiedGuardImpactPaths:paths})),[]);
});

test('authored guard paint follows the committed activation direction and cannot flip midway with a later target',()=>{
 for(const kind of Object.keys(ART))for(const direction of [-1,1]){
  const owner={id:7,kind,side:'human',hp:120,x:200,y:280,manualAbility:{activationId:4,phase:'active',target:{direction}}};
  const world={time:3,definition:{missionConfig:{v100StageNumber:5}},fighters:[owner]};
  assert.equal(queueV100GuardActivation(world,owner),true);
  owner.manualAbility.target.direction=-direction;world.time+=.2;const before=structuredClone(world),c=canvas();
  drawV100GuardActivations(c,{...previous,[ART[kind].id]:image()},world);
  assert.deepEqual(c.rows.filter(row=>row[0]==='scale'),direction===-1?[['scale',-1,1]]:[]);
  assert.ok(c.rows.some(row=>row[0]==='raster'));assertRestored(c);assert.deepEqual(world,before);
 }
});
