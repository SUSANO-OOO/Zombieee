import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {enforceBossBodyBarrier} from '../app/bossFoundation.js';
import {V177_JOINT_ATLASES} from '../app/v177JointData.js';
import {v177RangerFootPlacement} from '../app/v177RangerFootPlacement.js';
import {v177RangerLowerPose} from '../app/v177RangerLowerMotion.js';
import {recordV177JointBodyCorrection,v177JointBodyCorrection,pruneV177JointActorHistory} from '../app/v177JointActorHistory.js';

const rig=V177_JOINT_ATLASES.ranger.lowerRig,cycle=rig.spanPx/rig.stanceFraction;
function check(result,settle){
  const pose=v177RangerLowerPose(rig,result.phase,settle,undefined,result.targets);
  for(let i=0;i<2;i++){
    const j=pose.joints[i],leg=rig.legs[i];
    assert.ok(Math.abs(Math.hypot(j[2]-j[0],j[3]-j[1])-leg.upperLength)<1e-9);
    assert.ok(Math.abs(Math.hypot(j[4]-j[2],j[5]-j[3])-leg.lowerLength)<1e-9);
    assert.equal(j[4],result.targets[i][0]);assert.equal(j[5],result.targets[i][1]);
  }
}

test('the three formal WebKit boss-barrier corrections carry the last local legs, then resume actual steps',()=>{
  for(const [x,y,phase,nextPhase,scale]of [
    [727.0977930850744,285,29.295942071115917,28.964018806800528,86.30769230769232/480],
    [728.1452486774241,282,33.34357838356369,33.7621212771329,78.46153846153847/480],
    [727.0830419885019,285,29.295289972729122,28.964018806800535,86.30769230769232/480],
  ]){
    const actor={id:9,side:'human',hp:107,combatReady:true,kind:'ranger',bodyRadius:11,x,y};
    const boss={id:19,side:'zombie',hp:100,combatReady:true,kind:'mugarian-president-mutated',bodyRadius:48,x:780.5381165919282,y:y===285?282.5:282};
    const world={fighters:[actor,boss]},input={time:90.5,root:x,phase,scale,settle:1,moving:false,facing:1,bodyCorrection:0};
    const before=v177RangerFootPlacement(rig,null,input),saved=JSON.stringify(before);
    const barrier=enforceBossBodyBarrier({mover:actor,boss,padding:2,previousX:x});
    assert.equal(barrier.blocked,true);
    const shift=barrier.x-actor.x;assert.ok(shift<-7&&shift>-9);
    recordV177JointBodyCorrection(actor,world,shift);actor.x=barrier.x;
    const next={...input,time:input.time+1/60,root:actor.x,phase:nextPhase,moving:true,settle:1-1/60/.12,
      bodyCorrection:v177JointBodyCorrection(actor,world)};
    const result=v177RangerFootPlacement(rig,before.state,next);check(result,next.settle);
    assert.equal(JSON.stringify(before),saved);
    assert.ok(Math.abs(result.phase-before.phase)<1e-10,'the push carries the painted gait rather than inventing a walking stride');
    for(let i=0;i<2;i++){
      assert.ok(Math.abs(result.state.feet[i].x-before.state.feet[i].x-shift)<1e-10);
      assert.equal(result.state.feet[i].height,before.state.feet[i].height);
      assert.equal(result.state.feet[i].angle,before.state.feet[i].angle);
    }
    assert.deepEqual(v177RangerFootPlacement(rig,result.state,next),result);
    let state=result.state;
    for(let frame=1;frame<=90;frame++){
      const travel=29*frame/60,current={...next,time:next.time+frame/60,root:next.root+travel,phase:next.phase+travel/(scale*cycle),settle:0};
      const after=v177RangerFootPlacement(rig,state,current);check(after,0);
      for(let i=0;i<2;i++)if(state.feet[i].mode==='plant'&&after.state.feet[i].mode==='plant')
        assert.equal(after.state.feet[i].x,state.feet[i].x,'ordinary supports must remain fixed after the push');
      state=after.state;
    }
  }
});

test('faster ordinary approach never receives a rigid carry or moves a continuing world plant',()=>{
  let contacts=0;
  for(const scale of [.16346153846153846,.17980769230769234])for(const facing of[-1,1])for(const stride of[1,2,3,6]){
    let root=330,phase=0,state,landings=0;
    for(let frame=0;frame<=360;frame+=stride){
      const travel=63.8*frame/60;
      root=330+facing*travel;phase=travel/(scale*cycle);
      const input={time:frame/60,root,phase,scale,settle:0,moving:true,facing,bodyCorrection:0};
      const result=v177RangerFootPlacement(rig,state,input);check(result,0);
      assert.equal(result.state.offset,0,'ordinary travel must keep the actual distance-owned phase');
      if(state)for(let i=0;i<2;i++)if(state.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant'){
        assert.equal(result.state.feet[i].x,state.feet[i].x);contacts++;
      }
      if(state)for(let i=0;i<2;i++)if(state.feet[i].height>0&&result.state.feet[i].height===0)landings++;
      state=result.state;
    }
    assert.ok(landings>5,'both boots must keep returning to the ground at every tested paint cadence');
  }
  assert.ok(contacts>100);
});

test('a hard-body correction receipt survives immutable actors and skipped paints, and retires with membership',()=>{
  const actor={id:9},world={fighters:[actor]},before=JSON.stringify(world);
  assert.equal(v177JointBodyCorrection(actor,world),0);
  for(const invalid of[0,NaN,Infinity])recordV177JointBodyCorrection(actor,world,invalid);
  assert.equal(v177JointBodyCorrection(actor,world),0);
  recordV177JointBodyCorrection(actor,world,-8);recordV177JointBodyCorrection({...actor},world,8);
  assert.equal(v177JointBodyCorrection({...actor},world),2,'opposite corrections cannot cancel an unpainted receipt');
  assert.equal(v177JointBodyCorrection(actor,{fighters:[actor]}),0);
  assert.equal(JSON.stringify(world),before);
  world.fighters=[];pruneV177JointActorHistory(world);
  assert.equal(v177JointBodyCorrection(actor,world),0);
});

test('the actual boss barrier publishes its physical correction before assigning the corrected position',()=>{
  const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),blocks=[];
  const visit=n=>{if(ts.isIfStatement(n)&&n.expression.getText(tree)==='barrier.blocked')blocks.push(n.thenStatement);ts.forEachChild(n,visit);};visit(tree);
  assert.equal(blocks.length,1);
  const run=new Function('f','g','barrier','qaBarrier','recordV177JointBodyCorrection',blocks[0].getText(tree));
  const f={id:9,x:727},world={fighters:[]},calls=[];
  run(f,world,{x:719},null,(actor,g,dx)=>calls.push({actor,g,dx,atX:actor.x}));
  assert.equal(f.x,719);assert.deepEqual(calls,[{actor:f,g:world,dx:-8,atX:727}]);
});
