import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteFrameFor,spriteKinds} from '../app/spriteManifest.js';
import {beginV102GoreStep,finishV102GoreStep,noteV102GoreImpact,noteV102GorePeriodicDamage,getV102GoreSnapshot,clearV102CombatGore,V102_GORE_LIMITS,v102CorpseSeverPlan,beginV102CorpseSever,endV102CorpseSever} from '../app/v102CombatGore.js';
const fighter=(extra={})=>({id:2,kind:'walker',side:'zombie',hp:100,maxHp:100,x:350,y:320,...extra});
const world=(actors=[fighter()])=>({definition:{missionConfig:{v100StageNumber:1}},time:0,fighters:actors,corpses:[]});
function hit(g,{weapon='tky',damage=100}={}){const target=g.fighters[0],step=beginV102GoreStep(g);g.time+=1/30;target.hp-=damage;noteV102GoreImpact(g,target,{weapon,originX:target.x-50,damage});return finishV102GoreStep(g,step);}

test('only real HP loss produces gore; blocks, immunity, misses, healing, spawning and clones do not',()=>{
  for(const hpAfter of [100,120]){const g=world(),step=beginV102GoreStep(g);assert.equal(noteV102GoreImpact(g,g.fighters[0],{weapon:'tky',originX:300,damage:0}),false);g.fighters[0].hp=hpAfter;assert.equal(finishV102GoreStep(g,step),0);assert.equal(getV102GoreSnapshot(g).impacts.length,0);}
  const g=world([fighter({summonSource:'kurome-clone'})]),step=beginV102GoreStep(g);g.fighters[0].hp=0;g.fighters.push(fighter({id:3,hp:0}));assert.equal(finishV102GoreStep(g,step),0);
  g.definition.missionConfig.v100StageNumber=0;assert.equal(beginV102GoreStep(g),null);
});
test('one simulation damage result is emitted once, with its actual weapon, target and direction',()=>{
  const g=world(),step=beginV102GoreStep(g);g.time=.03;g.fighters[0].hp=0;noteV102GoreImpact(g,g.fighters[0],{weapon:'crazy-king',originX:400,damage:100});
  assert.equal(finishV102GoreStep(g,step),1);assert.equal(finishV102GoreStep(g,step),0);
  const s=getV102GoreSnapshot(g);assert.equal(s.impacts.length,1);assert.equal(s.impacts[0].style,'saw');assert.equal(s.impacts[0].direction,-1);assert.equal(s.impacts[0].targetId,2);assert.equal(s.wounds[0].severed,true);assert.equal(s.pending,false);
  s.impacts[0].x=0;assert.equal(getV102GoreSnapshot(g).impacts[0].x,350,'inspection cannot mutate presentation');
});
test('allies retain defeat/recovery anatomy and gore never writes into battle or save state',()=>{
  const g=world([fighter({side:'human',kind:'brawler'})]),before=Object.keys(g).sort();hit(g);
  assert.equal(getV102GoreSnapshot(g).wounds[0].severed,false);assert.deepEqual(Object.keys(g).sort(),before);
  assert.equal('gore' in g.fighters[0],false);clearV102CombatGore(g);assert.equal(getV102GoreSnapshot(g).wounds.length,0);
});

test('immutable area-effect updates retain real impacts; burns do not spray and bleeding drips at bounded intervals',()=>{
  const g=world(),step=beginV102GoreStep(g);
  g.fighters=g.fighters.map(f=>({...f}));g.fighters[0].hp-=20;noteV102GoreImpact(g,g.fighters[0],{weapon:'tky',originX:300,damage:20});
  assert.equal(finishV102GoreStep(g,step),1,'normal attacks after immutable area updates remain visible');
  for(const kind of ['burn','bleed']){
    const p=world();for(let i=0;i<20;i++){
      const before=beginV102GoreStep(p);p.time+=.016;p.fighters=p.fighters.map(f=>({...f,hp:f.hp-1}));
      noteV102GorePeriodicDamage(p,2,1,kind);finishV102GoreStep(p,before);
    }
    const snapshot=getV102GoreSnapshot(p);assert.equal(snapshot.impacts.length,kind==='burn'?0:1);
    if(kind==='bleed'){assert.equal(snapshot.impacts[0].style,'bleed');assert.equal(snapshot.wounds[0].severed,false);}
  }
});
test('blood, wounds and severed parts stay bounded and expire with simulation and corpse lifecycle',()=>{
  const g=world();for(let i=0;i<180;i++){g.fighters=[fighter({id:i+1})];hit(g,{damage:20});}
  const s=getV102GoreSnapshot(g);assert.ok(s.impacts.length<=V102_GORE_LIMITS.impacts);assert.ok(s.pools.length<=V102_GORE_LIMITS.pools);assert.ok(s.wounds.length<=V102_GORE_LIMITS.wounds);
  g.time+=8;const step=beginV102GoreStep(g);finishV102GoreStep(g,step);assert.equal(getV102GoreSnapshot(g).impacts.length,0);assert.equal(getV102GoreSnapshot(g).pools.length,0);
  const d=world();hit(d);d.corpses=[{...d.fighters[0],state:'ashing'}];d.fighters=[];const hold=beginV102GoreStep(d);finishV102GoreStep(d,hold);assert.equal(getV102GoreSnapshot(d).wounds.length,1);
  d.corpses=[];const gone=beginV102GoreStep(d);finishV102GoreStep(d,gone);assert.equal(getV102GoreSnapshot(d).wounds.length,0);
});
test('a severed part uses the victim death atlas inside its own bounds and shares corpse opacity',()=>{
  for(const kind of spriteKinds.filter(k=>!['mayo-chan','mayo-chan-feral'].includes(k))){
    const g=world([fighter({kind})]);hit(g);const corpse={...g.fighters[0],side:'zombie'},frame=spriteFrameFor(kind,'death','left'),plan=v102CorpseSeverPlan(g,corpse,frame,100,150);
    assert.ok(plan,kind);assert.ok(plan.part.w>0&&plan.part.h>0);assert.ok(plan.part.x>=0&&plan.part.y>=0);assert.ok(plan.part.x+plan.part.w<=frame.sourceRect.w+.01,kind);assert.ok(plan.part.y+plan.part.h<=frame.sourceRect.h+.01,kind);
    const draws=[],clips=[],ctx={globalAlpha:.24,save(){},restore(){},beginPath(){},rect(){},clip(rule){clips.push(rule);},moveTo(){},lineTo(){},closePath(){},fill(){},quadraticCurveTo(){},stroke(){},translate(){},rotate(){},drawImage(...args){draws.push(args);}};
    beginV102CorpseSever(ctx,plan);endV102CorpseSever(ctx,plan,{},frame);assert.deepEqual(clips,['evenodd',undefined]);assert.equal(ctx.globalAlpha,.24);assert.equal(draws.length,1);assert.equal(draws[0][1],frame.sourceRect.x+plan.part.x);
  }
});

test('cutting and explosive severing use distinct boundaries and preserve world flight after facing flips',()=>{
  const plans=[];
  for(const weapon of ['tky','crazy-king','grenade','guardian']){
    const g=world();hit(g,{weapon});g.time+=.2;
    const original=spriteFrameFor('walker','death','right');
    // Use the real upright hit-derived geometry, including a mirrored render.
    const frame={...spriteFrameFor('walker','hit','right'),derivedFrom:'hit',flipX:true};
    const plan=v102CorpseSeverPlan(g,g.fighters[0],frame,100,150);plans.push(plan);
    assert.equal(plan.direction,1);assert.equal(plan.localDirection,-1);
    assert.equal(plan.headCut,['tky','crazy-king'].includes(weapon));
    assert.ok(original.sourceRect.w>0);
    const positions=[],ctx={save(){},restore(){},beginPath(){},clip(){},moveTo(){},lineTo(){},closePath(){},rotate(){},drawImage(){},translate(x,y){positions.push([x,y]);}};
    endV102CorpseSever(ctx,plan,{},frame,{'v102-flesh-wound':{naturalWidth:256}});
    const r=plan.local;
    assert.ok(Math.abs(positions[0][0]-(plan.headCut?r.x+r.w*.5:r.x+r.w*.06))<1e-8);
    assert.ok(Math.abs(positions[0][1]-(plan.headCut?r.y+r.h*.97:r.y+r.h*.5))<1e-8);
    assert.ok((positions[1][0]-(r.x+r.w*.5))*-1>0,'mirrored local flight follows the original world impact');
  }
  assert.notDeepEqual(plans[0].part,plans[2].part,'slicing and explosive impact have different source boundaries');
});
