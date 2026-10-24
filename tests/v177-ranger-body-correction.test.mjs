import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {enforceBossBodyBarrier} from '../app/bossFoundation.js';
import {V177_JOINT_ATLASES} from '../app/v177JointData.js';
import {v177RangerFootPlacement} from '../app/v177RangerFootPlacement.js';
import {v177RangerLowerPose} from '../app/v177RangerLowerMotion.js';
import {recordV177JointBodyCorrection,v177JointBodyCorrection,pruneV177JointActorHistory,recordV177JointBodyShift,v177JointBodyShiftX} from '../app/v177JointActorHistory.js';

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

test('the actual final floor projection notifies a small physical push before an unfinished Ranger stop resumes',()=>{
  const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let statements;
  const visit=node=>{if(ts.isForOfStatement(node)&&node.expression.getText(tree)==='g.fighters'&&ts.isBlock(node.statement)){
    const rows=[...node.statement.statements],start=rows.findIndex(row=>ts.isVariableStatement(row)&&row.declarationList.declarations.some(d=>d.name.getText(tree)==='grounded'));
    if(start>=0&&rows[start].getText(tree).includes('clampToWalkable(stageGeometry'))statements=rows.slice(start,rows.findIndex((row,i)=>i>start&&row.getText(tree).startsWith('const lockedTarget')));
  }ts.forEachChild(node,visit);};visit(tree);assert.ok(statements?.length);
  const body=ts.transpileModule(statements.map(s=>s.getText(tree)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText;
  const project=new Function('fighter','g','stageGeometry','renderedHalfWidth','clampToWalkable','recordV177JointBodyShift','activeLaneForY',body);
  let state,root=330,phase=13/30,settle=1,time=0;const scale=.18;
  for(let tick=0;tick<15;tick++){
    time+=1/30;const walking=tick<10;if(walking){root+=29/30;phase+=29/30/(scale*cycle);}
    settle=walking?Math.max(0,settle-1/30/.12):Math.min(1,settle+1/30/.16);
    const result=v177RangerFootPlacement(rig,state,{time,root,phase,scale,settle,moving:walking,facing:1});check(result,settle);state=result.state;
  }
  const before=structuredClone(state),input={time:time+1/30,root:root-2,phase,scale,settle:1,moving:false,facing:1};
  assert.throws(()=>check(v177RangerFootPlacement(rig,state,input),1),/Original Ranger ankle target is unreachable/,'Keep the original strict anatomical guard');
  const actor={id:31,x:root,y:325,bodyRadius:11,lane:2},world={fighters:[actor],stationMetrics:{offFloorSteps:0}},calls=[];
  project(actor,world,{},11,()=>({x:root-2,y:325,clamped:true}),(f,g,dx)=>{
    calls.push({dx,x:f.x});recordV177JointBodyShift(f,g,dx);
  },()=>2);
  assert.deepEqual(calls,[{dx:-2,x:root}]);assert.equal(actor.x,root-2);assert.equal(world.stationMetrics.offFloorSteps,1);
  const corrected=v177RangerFootPlacement(rig,state,{...input,bodyShiftX:v177JointBodyShiftX(actor,world)});check(corrected,1);
  const progressing=v177RangerFootPlacement(rig,state,{...input,root});
  assert.deepEqual(state,before);for(let i=0;i<2;i++){
    assert.ok(Math.abs(corrected.state.feet[i].x-progressing.state.feet[i].x+2)<1e-10);
    assert.equal(corrected.state.feet[i].height,progressing.state.feet[i].height,'The real landing clock still advances during the projection');
    assert.equal(corrected.state.feet[i].flight?.endAt,progressing.state.feet[i].flight?.endAt);
  }
  let after=corrected.state;
  for(let tick=1;tick<=40;tick++){
    // A constraint rejecting another attempted move must not hold this
    // otherwise unchanged painted body or postpone an unfinished landing.
    const next=v177RangerFootPlacement(rig,after,{...input,time:input.time+tick/60,bodyShiftX:-2-tick});check(next,1);after=next.state;
  }
  assert.ok(after.feet.every(foot=>foot.height===0&&!foot.flight),'Both actual stop steps finish despite repeated blocked attempts');
});

test('the actual pair separation publishes only its horizontal projection, keeping vertical scale handling independent',()=>{
  const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let block;
  const visit=node=>{if(ts.isIfStatement(node)&&node.expression.getText(tree)==='f.side === "human" || f.side === "zombie"'
    &&node.thenStatement.getText(tree).includes('pairStartX'))block=node.thenStatement;ts.forEachChild(node,visit);};visit(tree);assert.ok(block);
  const body=ts.transpileModule(block.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText;
  const run=new Function('f','g','activeLaneCenters','humanMinX','zombieTargetFloor','sameSideSeparationStep','movementStageGeometry','clampToWalkable','activeLaneForY','recordV177JointBodyShift',body);
  for(const [dx,dy]of [[-2,0],[0,2]]){
    const f={id:31,side:'human',x:330,y:200,lane:1,navigationRecovery:{terminalFallbackSeconds:0}},g={fighters:[{id:1,side:'human',hp:1,combatReady:true}]},calls=[];
    run(f,g,[100,200,300],0,null,()=>({dx,dy}),{},(_geometry,position)=>position,()=>1,(actor,world,x)=>{calls.push(x);recordV177JointBodyShift(actor,world,x);});
    assert.deepEqual(calls,[dx]);assert.equal(v177JointBodyShiftX(f,g),dx);assert.equal(v177JointBodyCorrection(f,g),0);assert.equal(f.x,330+dx);assert.equal(f.y,200+dy);
  }
});

test('continuous soft projection cannot freeze an ordinary advancing gait or postpone its original landings',()=>{
  for(const correction of [-.2,0,.2]){
    let state,reference,landings=0,phase=0;
    for(let tick=0;tick<240;tick++){
      const root=330+(29/60+correction)*tick;phase=tick*(29/60+correction)/(.18*cycle);
      const input={time:tick/60,root,phase,scale:.18,moving:true,settle:0,facing:1};
      const actual=v177RangerFootPlacement(rig,state,{...input,bodyShiftX:correction*tick}),expected=v177RangerFootPlacement(rig,reference,input);check(actual,0);
      assert.deepEqual(actual.targets,expected.targets,'Actual net walking travel remains owned by the original gait');
      for(let i=0;i<2;i++){
        assert.equal(actual.state.feet[i].flight?.endAt,expected.state.feet[i].flight?.endAt);
        if(state?.feet[i].height>0&&actual.state.feet[i].height===0)landings++;
      }
      state=actual.state;reference=expected.state;
    }
    assert.ok(landings>6);
  }
});

test('a cancelled pursuit carries only painted net displacement without inventing stop steps',()=>{
  // f7 S25 time66.133333: +.002582 actual travel cancels a29/60 attempt.
  // The independently retained16-input reproduction fails the original strict
  // bone reach on tick15; it is a boundary model, not a full S25 replay.
  const scale=78.46153846153847/480,initialRoot=659.9011553858735,phase=30.460399674544067;
  const at=65.88333333333087,net=.00258211726816171,attempt=29/60;
  let state,reference,root=initialRoot,shift=0,landings=0;
  for(let tick=0;tick<90;tick++){
    if(tick>=10){root+=net;shift+=net-attempt;}
    const input={time:at+tick/60,root,phase,scale,settle:1,moving:false,facing:1,bodyCorrection:0,bodyShiftX:shift,frozen:false};
    const before=structuredClone(state),actual=v177RangerFootPlacement(rig,state,input);
    const expected=v177RangerFootPlacement(rig,reference,{...input,root:initialRoot,bodyShiftX:0});
    check(actual,1);assert.deepEqual(state,before,'a planning query cannot mutate the preceding paint');
    for(let i=0;i<2;i++){
      assert.ok(Math.abs(actual.state.feet[i].x-expected.state.feet[i].x-(root-initialRoot))<1e-10,
        'the raw cancellation is not another movement of the supporting boot');
      assert.equal(actual.state.feet[i].height,expected.state.feet[i].height);
      assert.equal(actual.state.feet[i].flight?.endAt,expected.state.feet[i].flight?.endAt,'retain each original landing deadline');
      if(state?.feet[i].flight&&!actual.state.feet[i].flight)landings++;
    }
    state=actual.state;reference=expected.state;
  }
  assert.equal(landings,0,'the original settled stance needs no new correction step');
  assert.ok(state.feet.every(foot=>foot.height===0&&!foot.flight));
  assert.equal(state.bodyShiftX,shift,'consume the real cumulative solver receipt once');
});

test('net projection during an unfinished stop retains the original flight and landing clock',()=>{
  let state,root=330,phase=13/30,settle=1,time=0;const scale=.18;
  for(let tick=0;tick<15;tick++){
    time+=1/30;const walking=tick<10;if(walking){root+=29/30;phase+=29/30/(scale*cycle);}
    settle=walking?Math.max(0,settle-1/30/.12):Math.min(1,settle+1/30/.16);
    state=v177RangerFootPlacement(rig,state,{time,root,phase,scale,settle,moving:walking,facing:1}).state;
  }
  assert.ok(state.feet.some(foot=>foot.flight));
  const initialRoot=root,net=.00258211726816171;let reference=state,shift=0,landings=0;
  for(let tick=1;tick<=60;tick++){
    root+=net;shift+=net-29/60;
    const input={time:time+tick/60,root,phase,scale,settle:1,moving:false,facing:1,bodyShiftX:shift};
    const actual=v177RangerFootPlacement(rig,state,input),expected=v177RangerFootPlacement(rig,reference,{...input,root:initialRoot,bodyShiftX:0});
    check(actual,1);for(let i=0;i<2;i++){
      assert.ok(Math.abs(actual.state.feet[i].x-expected.state.feet[i].x-(root-initialRoot))<1e-10);
      assert.equal(actual.state.feet[i].height,expected.state.feet[i].height);
      assert.equal(actual.state.feet[i].flight?.endAt,expected.state.feet[i].flight?.endAt);
      if(state.feet[i].flight&&!actual.state.feet[i].flight)landings++;
    }
    state=actual.state;reference=expected.state;
  }
  assert.ok(landings>=2);assert.ok(state.feet.every(foot=>!foot.flight&&foot.height===0));
});

test('a simultaneous hard correction retains its original rigid priority over the soft receipt',()=>{
  let state,root=330,phase=13/30,settle=1,time=0;const scale=.18;
  for(let tick=0;tick<15;tick++){
    time+=1/30;const walking=tick<10;if(walking){root+=29/30;phase+=29/30/(scale*cycle);}
    settle=walking?Math.max(0,settle-1/30/.12):Math.min(1,settle+1/30/.16);
    state=v177RangerFootPlacement(rig,state,{time,root,phase,scale,settle,moving:walking,facing:1}).state;
  }
  assert.ok(state.feet.some(foot=>foot.flight));
  const input={time:time+1/60,root:root+.25,phase,scale,settle:1,moving:false,facing:1,bodyCorrection:1};
  const reference=v177RangerFootPlacement(rig,state,input),actual=v177RangerFootPlacement(rig,state,{...input,bodyShiftX:-.1});
  check(actual,1);assert.deepEqual(actual.targets,reference.targets);
  for(let i=0;i<2;i++){
    assert.equal(actual.state.feet[i].height,state.feet[i].height,'preserve the original hard rigid carry');
    assert.equal(actual.state.feet[i].flight?.endAt,reference.state.feet[i].flight?.endAt);
  }
  assert.equal(actual.state.bodyCorrection,1);assert.equal(actual.state.bodyShiftX,-.1);
});
