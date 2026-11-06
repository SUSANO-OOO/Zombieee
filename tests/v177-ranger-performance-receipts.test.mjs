import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177RenderedWeightedLowerReceipt} from '../app/v177JointPresentation.js';
import {normalTacticalInput} from '../scripts/v100-normal-tactical-input.mjs';
import {rangerPerformanceReceipts} from '../scripts/v177-ranger-performance-receipts.mjs';
import {getV177RangerLowerPaintSnapshot} from '../app/v177RangerLowerPaint.js';

const windowBounds={startedAt:0,endedAt:5000};
function actor(id,sequence,time){return{id,kind:'ranger',side:'human',hp:70,maxHp:70,x:100+sequence,y:280,lane:1,speed:29,laneSpeed:75,damage:22.4,range:145,attackEvery:.82,
  objectRender:null,renderSource:{kind:'same-snapshot-unfiltered-tail',fighterId:id,historyLength:1},
  render:{renderSequence:sequence,renderKind:'ranger',assetReady:true,renderWidth:150,renderHeight:140,jointPaintedAt:time-.02,
    jointAtlasPath:V177_JOINT_ATLASES.ranger.path,jointDrawSucceeded:true,jointWeightedLowerDrawSucceeded:true,
    jointWeightedLower:{mode:'continuous-weighted-mesh',phase:.37,settle:.5,parts:5,meshVertices:130,meshTriangles:192,coverageSamples:4,duplicateWithinPart:0,degenerate:0}}};}
const measurementStart=()=>({startedAt:0,active:true,boundary:{renderSequence:90,simulationTime:9.9,battleAudioGeneration:7,
  actors:[{id:1001,renderSequence:90,jointPaintedAt:9.9,objectTailSame:false,worldWeightedLower:null}]}});
function samples(){return Array.from({length:4},(_,i)=>{const actors=i===2?[]:i===3?[actor(1100,520,10+i)]:[actor(1001,100+i*10,10+i),...(i===1?[actor(1100,500,10+i)]:[])];
  return{time:10+i,humans:actors.map(({id,kind,hp,maxHp,x,y,lane})=>({id,kind,hp,maxHp,x,y,lane})),rangerDraws:{readAt:(i+1)*1000,simulationTime:10+i,measurementStart:measurementStart(),
    renderBoundary:{renderSequence:[100,500,510,520][i],simulationTime:10+i,battleAudioGeneration:7},actors}};});}

test('an actual-ID receipt window preserves real absence and replacement while requiring advancing postpaint geometry',()=>{
  const input=samples(),before=structuredClone(input),result=rangerPerformanceReceipts(input,windowBounds);
  assert.equal(result.status,'recorded');assert.equal(result.weightedPaintObserved,true);assert.equal(result.absenceSamples,1);
  assert.deepEqual(result.actors.map(a=>a.id),[1001,1100]);assert.ok(result.actors.every(a=>a.lastSequence>a.firstSequence&&a.lastPaintedAt>a.firstPaintedAt));
  assert.equal(result.originalSpeedAccepted,false);assert.equal(result.naturalnessAccepted,false);assert.equal(result.physicalIphoneRecordingAccepted,false);
  assert.equal(result.wholeGameAccepted,false);assert.deepEqual(input,before);
});

test('missing, stale, borrowed, fallback and unsuccessful Ranger receipts cannot qualify the measured workload',()=>{
  const changes=[
    rows=>{delete rows[0].rangerDraws;},rows=>{for(const r of rows)r.rangerDraws.actors=[];},
    rows=>{delete rows[0].humans;},rows=>{rows[0].humans[0].id++;},rows=>{rows[0].rangerDraws.actors[0].hp='70';},
    rows=>{rows[0].rangerDraws.readAt=6000;},rows=>{rows[1].rangerDraws.readAt=1000;},
    rows=>{rows[1].rangerDraws.simulationTime=500;},rows=>{rows[0].rangerDraws.actors[0].id=-1;},
    rows=>{rows[0].rangerDraws.actors.push(structuredClone(rows[0].rangerDraws.actors[0]));},
    rows=>{delete rows[0].rangerDraws.actors[0].range;},rows=>{rows[0].rangerDraws.actors[0].side='zombie';},
    rows=>{delete rows[0].rangerDraws.actors[0].render;},rows=>{rows[0].rangerDraws.actors[0].render.assetReady=false;},
    rows=>{rows[0].rangerDraws.actors[0].render.renderKind='gunner';},rows=>{rows[0].rangerDraws.actors[0].render.jointAtlasPath='other.webp';},
    rows=>{rows[0].rangerDraws.actors[0].render.jointDrawSucceeded=false;},rows=>{delete rows[0].rangerDraws.actors[0].render.jointWeightedLowerDrawSucceeded;},
    rows=>{rows[0].rangerDraws.actors[0].render.jointWeightedLowerDrawSucceeded=false;},rows=>{rows[0].rangerDraws.actors[0].render.jointPaintedAt=30;},
    rows=>{rows[1].rangerDraws.actors[0].render.renderSequence=100;},rows=>{rows[1].rangerDraws.actors[0].render.jointPaintedAt=9.98;},
    ...['fallback','offscreen'].map(mode=>rows=>{rows[0].rangerDraws.actors[0].render.jointWeightedLower.mode=mode;}),
    ...['parts','meshVertices','meshTriangles','coverageSamples','duplicateWithinPart','degenerate'].map(key=>rows=>{rows[0].rangerDraws.actors[0].render.jointWeightedLower[key]++;}),
    rows=>{rows[0].rangerDraws.actors[0].render.jointWeightedLower.phase=NaN;},rows=>{rows[0].rangerDraws.actors[0].render.jointWeightedLower.settle=2;},
  ];
  for(const change of changes){const rows=samples();change(rows);const result=rangerPerformanceReceipts(rows,windowBounds);
    assert.equal(result.weightedPaintObserved,false);assert.equal(result.status,'incomplete');assert.ok(result.errors.length>0);}
});

test('the actual tactical RPC copies the same raw Ranger audit only when requested and preserves failed or absent values',async()=>{
  for(const value of [true,false,undefined]){
    const actual=actor(1001,100,10),renderAudit={...actual.render,jointWeightedLowerDrawSucceeded:value},
      fighter={...actual,renderAudit,renderAuditHistory:[renderAudit],x:100,y:50,lane:1,combatReady:true},state={time:10,running:true,over:true,won:false,fighters:[fighter],deployQueue:[],
        rangerRenderObservation:{renderSequence:100,simulationTime:10,battleAudioGeneration:7}};
    const before=structuredClone(state),context={window:{__ASHFALL_BATTLE_QA__:{getSnapshot:()=>state},__V100_DEVICE_RAF__:{startedAt:0,active:true,performanceBefore:{rangerDrawBoundary:measurementStart().boundary}}},performance:{now:()=>1000}};
    let observed,calls=0;const page={async evaluate(fn,arg){calls++;context.arg=arg;return vm.runInNewContext('('+fn.toString()+')(arg)',context);}};
    await normalTacticalInput(page,{inputs:[]},{rangerDrawObservation:true,observeSnapshot:s=>{observed=structuredClone(s);}});
    assert.equal(calls,1);assert.equal(observed.rangerDraws.readAt,1000);assert.equal(observed.rangerDraws.simulationTime,state.time);
    assert.deepEqual(observed.rangerDraws.actors[0].render,renderAudit);assert.deepEqual(observed.rangerDraws.actors[0].objectRender,renderAudit);
    assert.equal(observed.rangerDraws.actors[0].renderSource.fighterId,fighter.id);assert.deepEqual(observed.rangerDraws.renderBoundary,state.rangerRenderObservation);assert.equal(observed.rangerDraws.actors[0].id,fighter.id);
    await normalTacticalInput(page,{inputs:[]},{observeSnapshot:s=>{observed=structuredClone(s);}});
    assert.equal(Object.hasOwn(observed,'rangerDraws'),false);assert.deepEqual(state,before);
  }
});

test('the actual device projection retains raw receipts and all original window, scalar gates, fixture and tactical policy stay exact',()=>{
  const read=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),source=read('scripts/v100-device-runtime-browser.mjs'),
    old=execFileSync('git',['show','207e19bd33e6ce62895c615dedaa816ae469d70c:scripts/v100-device-runtime-browser.mjs'],{encoding:'utf8'}).replaceAll('\r\n','\n'),
    tree=text=>ts.createSourceFile('device.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),ast=tree(source),oldAst=tree(old);
  const declaration=(ast,name)=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
  // The changed stop is exercised against the original default-off callback
  // and failure boundaries in v177-ranger-deferred-observation.test.mjs.
  for(const name of ['beginMeasurement','fixtureSave']){
    let current=declaration(ast,name).getText(ast)
      .replace(', frameCpuChunks: [], frameCpuOverflow: 0','')
      .replace(', deferredCpu: {chunks:state.frameCpuChunks,overflow:state.frameCpuOverflow}','');
    if(name==='beginMeasurement'){
      const addition=`    if(deferRangerObservation){
      state.rangerObservationOwner={state,window,document,performance,startedAt:state.startedAt};
      state.rangerDrawObservations=[];state.rangerDrawOverflow=0;
    }
`;
      assert.equal(current.split(addition).length,2,'Only the reviewed opt-in storage is exempt');
      current=current.replace(addition,'').replace('beginMeasurement(page,{deferRangerObservation=false}={})','beginMeasurement(page)')
        .replace('page.evaluate(deferRangerObservation =>','page.evaluate(() =>').replace('},deferRangerObservation);','});');
    }
    assert.equal(current,declaration(oldAst,name).getText(oldAst),name);
  }
  const gate=ast=>{const rows=[];const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='gates')rows.push(n.initializer.getText(ast));ts.forEachChild(n,visit);};visit(ast);assert.equal(rows.length,1);return rows[0];};
  assert.equal(gate(ast),gate(oldAst));
  const project=new Function('bossKind','return '+declaration(ast,'snapshotProjection').getText(ast))('mugarian-president-mutated'),row={...samples()[0],fighters:[]};
  assert.equal(project(row).rangerDraws,row.rangerDraws);delete row.rangerDraws;assert.equal(Object.hasOwn(project(row),'rangerDraws'),false);
  const tactical=read('scripts/v100-normal-tactical-input.mjs'),oldTactical=execFileSync('git',['show','207e19bd33e6ce62895c615dedaa816ae469d70c:scripts/v100-normal-tactical-input.mjs'],{encoding:'utf8'}).replaceAll('\r\n','\n'),marker='  observeSnapshot?.(s);';
  const s25Only="s25FireComparison ? s25FireDeploymentPriorities(s, record.s25ObservedHumans, earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities) : earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities";
  assert.equal(tactical.split(s25Only).length,2,'only the one explicit S25 branch is exempt');
  const projectionCalls=[];
  const tacticalAst=tree(oldTactical),visitProjection=n=>{if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='evaluate'&&n.expression.expression.getText(tacticalAst)==="page.locator('.game-shell canvas')")projectionCalls.push(n.getText(tacticalAst));ts.forEachChild(n,visitProjection);};visitProjection(tacticalAst);
  assert.equal(projectionCalls.length,1);
  const immediate="page.locator('.game-shell canvas').evaluateAll(projectRepresentativeAirstrikeCanvases,target)";
  assert.equal(tactical.split(immediate).length,2);
  const fixedCardRead=`    // Formation cards are fixed during a battle and were counted in kinds.
    // Re-read each actual nth owner immediately before and after scrolling;
    // do not add a separate locator-count round trip for the same card list.
    const selector='button.unit-card[data-kind="'+kind+'"]',candidates=page.locator(selector);let deployed=false;
    for(let i=0;i<target[kind];i++)if(await nativeBattleTap(page,candidates.nth(i),[],{selector,index:i})){record.inputs.push({time:s.time,action:'deploy',kind,command:s.energy});deployed=true;break;}`;
  const previousCardRead=`    const candidates=page.locator('button.unit-card[data-kind="'+kind+'"]');let deployed=false;
    for(let i=0;i<await candidates.count();i++)if(await nativeBattleTap(page,candidates.nth(i))){record.inputs.push({time:s.time,action:'deploy',kind,command:s.energy});deployed=true;break;}`;
  assert.equal(tactical.split(fixedCardRead).length,2,'only the exact fixed-count/fresh-nth deployment block is exempt');
  assert.equal(oldTactical.split(previousCardRead).length,2);
  assert.equal(tactical.slice(tactical.indexOf(marker)).replace(immediate,projectionCalls[0]).replace(s25Only,"earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities").replace(fixedCardRead,previousCardRead),oldTactical.slice(oldTactical.indexOf(marker)),'all baseline tactical policy remains exact');
});

test('formal CPU chunks use the original elapsed RPC and immutable raw numbers without altering clocks or controls',async()=>{
 const source=fs.readFileSync('scripts/v100-device-runtime-browser.mjs','utf8'),tree=ts.createSourceFile('device.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 let read;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='stillMeasuring')read=n.initializer.getText(tree);ts.forEachChild(n,visit);};visit(tree);assert.ok(read);
 let enabled;const readEnabled=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='retainFrameCpuChunks')enabled=n.initializer.getText(tree);ts.forEachChild(n,readEnabled);};readEnabled(tree);assert.ok(enabled);
 const formal={runtimeRole:'formal',engine:'webkit',callbackDiagnostic:false,observerlessDiagnostic:false,blankBaselineDiagnostic:true};
 assert.equal(vm.runInNewContext(enabled,formal),true,'The actual formal environment keeps its separate blank controls and real boss CPU chunks');
 for(const option of [{runtimeRole:'native-control'},{engine:'chromium'},{callbackDiagnostic:true},{observerlessDiagnostic:true}])
  assert.equal(vm.runInNewContext(enabled,{...formal,...option}),false);
 let now=100,calls=0;
 const raw={frameCpuSequence:7,frameCpuTimings:[{sequence:7,rafTimestamp:95,entryAt:96,previousExitAt:90,
  simulationFinishedAt:97,drawFinishedAt:99,exitAt:100,simulationTime:3}]};
 const observation={maxChunks:128,chunks:[],overflow:0},result={frameCpuObservation:observation};
 const owner={active:true,startedAt:100,frameCpuChunks:[],frameCpuOverflow:0};
 const context=vm.createContext({assert,window:{__V100_DEVICE_RAF__:owner},performance:{now:()=>now},__ASHFALL_RUNTIME_PERFORMANCE__:raw,
  result,measurement:{startedAt:100},measurementMs:30000,retainFrameCpuChunks:true,
  page:{evaluate:async(fn,args)=>{calls++;assert.deepEqual(JSON.parse(JSON.stringify(args)),{startedAt:100,durationMs:30000});return fn(args);}}});
 const still=vm.runInContext(read,context);assert.equal(await still(),true);assert.equal(calls,1);
 assert.deepEqual(JSON.parse(JSON.stringify(owner.frameCpuChunks[0].rows)),[[7,95,96,90,97,99,100,3]]);
 raw.frameCpuTimings[0].entryAt=777;assert.equal(owner.frameCpuChunks[0].rows[0][2],96,'Later ring mutation cannot rewrite an earlier reply');
 for(let i=1;i<130;i++)await still();assert.equal(owner.frameCpuChunks.length,128);assert.equal(owner.frameCpuOverflow,2);
 assert.equal(observation.chunks.length,0,'No raw payload is transferred during the window');assert.equal(calls,130);
 now=30100;assert.equal(await still(),false,'Exact original30s boundary');
 context.retainFrameCpuChunks=false;const count=owner.frameCpuChunks.length,overflow=owner.frameCpuOverflow;
 now=30099;assert.equal(await still(),true);now=30100;assert.equal(await still(),false);
 assert.equal(owner.frameCpuChunks.length,count);assert.equal(owner.frameCpuOverflow,overflow,'Excluded controls keep their original scalar path');
 context.retainFrameCpuChunks=true;owner.active=false;await assert.rejects(still(),/owner changed/);
 owner.active=true;owner.startedAt=99;await assert.rejects(still(),/owner changed/);
 owner.startedAt=100;owner.frameCpuChunks=null;await assert.rejects(still(),/owner changed/);
});


test('the exact unchanged start frame is a separately counted baseline, never a new in-window paint',()=>{
 const rows=samples(),start={startedAt:0,active:true,boundary:{renderSequence:100,simulationTime:10,battleAudioGeneration:7,actors:[{id:1001,renderSequence:100,jointPaintedAt:10,objectTailSame:true,worldWeightedLower:structuredClone(rows[0].rangerDraws.actors[0].render.jointWeightedLower)}]}};
 for(const row of rows)row.rangerDraws.measurementStart=structuredClone(start);rows[0].rangerDraws.actors[0].render.jointPaintedAt=10;
 const result=rangerPerformanceReceipts(rows,windowBounds);assert.equal(result.status,'recorded');assert.equal(result.baselineObservations,1);assert.equal(result.newPaintObservations,3);
 const faults=[r=>{for(const row of r)row.rangerDraws.measurementStart.boundary.actors[0].jointPaintedAt=9.99;r[0].rangerDraws.actors[0].render.jointPaintedAt=9.99;},
   r=>r[0].rangerDraws.renderBoundary.renderSequence++,r=>{for(const row of r)row.rangerDraws.measurementStart.boundary.actors[0].id=999;},
   r=>{for(const row of r)row.rangerDraws.measurementStart.boundary.actors[0].renderSequence=99;},r=>r[0].rangerDraws.renderBoundary.battleAudioGeneration++,
   r=>{for(const row of r)row.rangerDraws.measurementStart.boundary.actors[0].objectTailSame=false;},
   r=>{for(const row of r)row.rangerDraws.measurementStart.boundary.actors[0].worldWeightedLower=null;},
   r=>{for(const row of r)row.rangerDraws.measurementStart.boundary.actors[0].worldWeightedLower.phase+=1e-5;},
   r=>{for(const row of r)row.rangerDraws.measurementStart.boundary.actors[0].worldWeightedLower.mode='legacy-cell-fallback';},
   r=>{for(const row of r)delete row.rangerDraws.measurementStart.boundary.actors[0].objectTailSame;},
   r=>{for(const row of r)delete row.rangerDraws.measurementStart.boundary.actors[0].worldWeightedLower;}
 ];
 for(const mutate of faults){const candidate=structuredClone(rows);mutate(candidate);assert.equal(rangerPerformanceReceipts(candidate,windowBounds).weightedPaintObserved,false);}
 const only=structuredClone(rows.slice(0,1));assert.equal(rangerPerformanceReceipts(only,windowBounds).weightedPaintObserved,false,'A start frame without new advancing paint is insufficient');
});

test('start/preceding snapshot counter and clock reject prewindow and newly observed stale tails without an age tolerance',()=>{
 const oldSource=execFileSync('git',['show','26440877ee9cb120f0d3e4e38a73c38252cc46a5:scripts/v177-ranger-performance-receipts.mjs'],{encoding:'utf8'}).replace(/^import[^\n]*\n/m,'').replace('export function rangerPerformanceReceipts','function rangerPerformanceReceipts');
 const original=vm.runInNewContext(oldSource+'\nrangerPerformanceReceipts;',{V177_JOINT_ATLASES});
 const mutations=[
  r=>r[0].rangerDraws.actors[0].render.jointPaintedAt=0,
  r=>r[0].rangerDraws.actors[0].render.renderSequence=89,
  r=>r[1].rangerDraws.actors[1].render.renderSequence=99,
  r=>r[1].rangerDraws.actors[1].render.jointPaintedAt=9.99,
  r=>{const a=r[3].rangerDraws.actors[0];a.id=1200;a.renderSource.fighterId=1200;a.render.renderSequence=505;r[3].humans[0].id=1200;},
  r=>{const a=r[3].rangerDraws.actors[0];a.id=1200;a.renderSource.fighterId=1200;a.render.jointPaintedAt=11.5;r[3].humans[0].id=1200;},
  r=>r[1].rangerDraws.actors[0].render.renderSequence=501,
 ];
 for(const mutate of mutations){const rows=samples();mutate(rows);assert.equal(original(rows,windowBounds).weightedPaintObserved,true,'Retain actual original stale-tail acceptance counterexample');const result=rangerPerformanceReceipts(rows,windowBounds);assert.equal(result.status,'incomplete');assert(result.errors.some(e=>e.includes('preceding actual snapshot')));}
 const rows=samples();assert.equal(rangerPerformanceReceipts(rows,windowBounds).newPaintObservations,4);
});

test('actual boundary/source/raw disagreement, missing or inactive window, generation and clock faults remain failures',()=>{
 const changes=[r=>{delete r[0].rangerDraws.measurementStart;},r=>r[0].rangerDraws.measurementStart.active=false,
  r=>r[0].rangerDraws.measurementStart.startedAt=1,r=>r[0].rangerDraws.measurementStart.boundary.actors=null,
  r=>r[0].rangerDraws.measurementStart.boundary.actors=[null],r=>r[0].rangerDraws.measurementStart.boundary.renderSequence=NaN,
  r=>{delete r[0].rangerDraws.renderBoundary;},r=>r[0].rangerDraws.renderBoundary.simulationTime++,
  r=>r[1].rangerDraws.renderBoundary.battleAudioGeneration++,r=>r[1].rangerDraws.measurementStart.boundary.simulationTime-=.001,
  r=>r[1].rangerDraws.renderBoundary.renderSequence=99,r=>r[0].rangerDraws.actors[0].renderSource.fighterId++,
  r=>{delete r[0].rangerDraws.actors[0].renderSource;},r=>r[0].rangerDraws.actors[0].renderSource.historyLength=0,
  r=>r[0].rangerDraws.actors[0].renderSource.historyLength=129,r=>{delete r[0].rangerDraws.actors[0].objectRender;},
  r=>{const a=r[0].rangerDraws.actors[0];a.objectRender={...structuredClone(a.render),jointDrawSucceeded:false};},
  r=>r[0].rangerDraws.actors[0].render.jointWeightedLowerDrawSucceeded=false];
 for(const mutate of changes){const rows=samples();mutate(rows);const result=rangerPerformanceReceipts(rows,windowBounds);assert.equal(result.weightedPaintObserved,false);assert.equal(result.status,'incomplete');}
});


// Pure unit Canvas: actual draw/cache ownership, without claiming real pixels.
function unitSurface(){const canvas={width:0,height:0};canvas.getContext=()=>({clearRect(){},drawImage(){},getImageData:(_x,_y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}});return canvas;}
function unitDraw(actor,world){
 const atlas=V177_JOINT_ATLASES.ranger,image={naturalWidth:atlas.decodedWidth,naturalHeight:atlas.decodedHeight,ownerDocument:{createElement:unitSurface}};
 let m=[1,0,0,1,422,318];const stack=[],multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 const ctx={canvas:{width:844,height:340},getTransform:()=>Object.fromEntries(['a','b','c','d','e','f'].map((k,i)=>[k,m[i]])),save(){stack.push([...m]);},restore(){m=stack.pop();},setTransform(...v){m=v;},transform(...v){m=multiply(m,v);},translate(x,y){m=multiply(m,[1,0,0,1,x,y]);},scale(x,y){m=multiply(m,[x,0,0,y,0,0]);},drawImage(){}};
 const plan=v177JointPose('ranger',{requestedState:'idle'},actor.animationPresentation,{actor,world});assert(plan);assert.equal(drawV177JointPose(ctx,image,'ranger',plan,-48,-86,96,89.6,{actor,world}),true);const lower=v177RenderedWeightedLowerReceipt(actor,world);assert.equal(lower.mode,'continuous-weighted-mesh');return lower;
}

function appVmFixture(){
 const frames=new Map(),timers=new Map();let nextHandle=0,evaluateCalls=0;
 const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),app=ts.createSourceFile('actual-App.tsx',read('app/AshfallGame.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes=[];
 const walk=n=>{nodes.push(n);ts.forEachChild(n,walk);};walk(app);
 const fn=name=>nodes.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name),qa=name=>nodes.find(n=>ts.isPropertyAssignment(n)&&n.name.getText(app)===name);
 const snapshot=qa('getSnapshot'),perf=qa('getPerformanceSnapshot');assert(snapshot&&perf);
 const fighters=nodes.find(n=>ts.isPropertyAssignment(n)&&n.name.getText(app)==='fighters'&&n.pos>snapshot.pos&&n.end<snapshot.end&&n.initializer.getText(app).startsWith('g.fighters.map'));
 const observation=nodes.find(n=>ts.isPropertyAssignment(n)&&n.name.getText(app)==='rangerRenderObservation'&&n.pos>snapshot.pos&&n.end<snapshot.end);assert(fighters&&observation);
 const context=vm.createContext({v177RenderedWeightedLowerReceipt,getV177RangerLowerPaintSnapshot,fighterRenderAudit:new WeakMap(),fighterRenderAuditHistory:new Map(),fighterRenderSequence:0,
  runtimePerformanceRef:{current:{renderFrames:30}},v100ImageSampler:{snapshot:()=>({})},v100ShotLayer:{snapshot:()=>({})},graphicsProfileRef:{current:{}},
  staticBattlefieldCacheRef:{current:{hits:0,rebuilds:0,canvas:null}},renderObjectPoolSnapshot:()=>({}),
  activeBattlefieldDepthScale:()=>1,sampleAnimationClip:()=>({spriteState:'idle',groundAnchor:1,pose:{}}),enemyCombatVfxSnapshot:()=>null,
  performance:{now:()=>context.nativeClock},nativeClock:0,
  requestAnimationFrame:fn=>{const id=++nextHandle;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:fn=>{const id=++nextHandle;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),document:{visibilityState:'visible'},
  gameRef:{current:null},window:{addEventListener(){},removeEventListener(){}}});
 const expression=text=>{const js=ts.transpileModule('('+text+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return vm.runInContext(js,context);};
 const body=text=>vm.runInContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,context);
 const record=expression(fn('recordFighterRenderAudit').getText(app)),mapFighter=expression(fighters.initializer.arguments[0].getText(app));
 const makeObservation=()=>expression('()=>('+observation.initializer.getText(app)+')')();
 const rules=ts.createSourceFile('rules.js',read('app/gameRules.js'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),area=rules.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='advanceAreaEffects');assert(area);
 context.advanceAreaEffects=expression(area.getText(rules).replace(/^export\s+/,''));
 Object.assign(context,{worldYFor:()=>{throw Error('Nonempty area branch');},pointInGroundEffectEllipse:()=>{throw Error('Nonempty area branch');},dt:1/60,activeMedicalIds:[],retainActiveAreaEffects:x=>x,noteV102GorePeriodicDamage:()=>{throw Error('Unexpected damage');},recordUnitDamage:()=>{throw Error('Unexpected damage');}});
 const areaDecl=nodes.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations[0]?.name.getText(app)==='areaStep'),siblings=areaDecl.parent.statements,first=siblings.indexOf(areaDecl),last=siblings.findIndex((n,i)=>i>first&&n.getText(app).startsWith('g.fighters = areaStep.fighters'));assert(last>first);const actualAssignment=siblings.slice(first,last+1).map(n=>n.getText(app)).join('\n');
 const performanceGetter=expression(perf.initializer.getText(app));let perfCalls=0,snapshotCalls=0;
 const getSnapshot=()=>{snapshotCalls++;const g=context.g;return {time:g.time,running:true,over:true,won:false,deployQueue:[],rangerRenderObservation:makeObservation(),fighters:g.fighters.map(mapFighter)};};
 context.window.__ASHFALL_BATTLE_QA__={getSnapshot,getPerformanceSnapshot:()=>{perfCalls++;return performanceGetter();}};
 const driver=ts.createSourceFile('driver.mjs',read('scripts/v100-device-runtime-browser.mjs'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),begin=driver.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='beginMeasurement');assert(begin);const beginMeasurement=expression(begin.getText(driver));
 const page={evaluate:async(fn,arg)=>{evaluateCalls++;context.arg=arg;return expression('('+fn.toString()+')')(arg);}};
 return {context,page,record,getSnapshot,beginMeasurement,copy:()=>body('{'+actualAssignment+'}'),counters:()=>({perfCalls,snapshotCalls,evaluateCalls}),
  frame:at=>{context.nativeClock=at;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(at);},
  expire:()=>{const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();},pending:()=>({frames:frames.size,timers:timers.size}),
  setWorld:g=>{context.g=g;context.gameRef.current=g;},paint:draw=>{const actor=context.g.fighters[0],world=context.g;let lower=draw.jointWeightedLower;if(draw.jointDrawSucceeded===true)lower=unitDraw(actor,world);else v177JointPose('ranger',{requestedState:'special'},actor.animationPresentation,{ownedPose:true,actor,world});const next=body('++fighterRenderSequence');record(actor,{...draw,renderSequence:next,jointWeightedLower:lower});context.runtimePerformanceRef.current.renderFrames++;return next;}};
}

test('actual record→actual area-copy/assignment→same getSnapshot projection is fresh after the existing beginMeasurement boundary',async()=>{
 const f=appVmFixture(),a={...actor(9,1,10),animationPresentation:{state:'idle',elapsedSeconds:0,lastEvents:[]},stationAbility:{phase:'idle'},manualAbility:{phase:'ready'}};
 const g={time:10,battleAudioGeneration:7,fighters:[a],areaEffects:[],renderObjectPools:{particles:{},shots:{},damageTexts:{}},particles:[],shots:[],damageTexts:[]};f.setWorld(g);
 f.paint({...a.render,jointPaintedAt:10});await f.beginMeasurement(f.page);f.copy();assert.notEqual(g.fighters[0],a);assert.equal(f.getSnapshot().fighters[0].renderAudit,null);
 assert.equal(f.counters().perfCalls,1);const rows=[];
 for(let i=0;i<3;i++){g.time=10+i;f.context.nativeClock=1000+i*1000;if(i>0){f.paint({...a.render,jointPaintedAt:g.time});f.copy();}
  let snapshot;await normalTacticalInput(f.page,{inputs:[]},{rangerDrawObservation:true,observeSnapshot:s=>{snapshot=structuredClone(s);}});
  rows.push({...snapshot,humans:snapshot.fighters.filter(a=>a.side==='human').map(({id,kind,hp,maxHp,x,y,lane})=>({id,kind,hp,maxHp,x,y,lane}))});
  assert.equal(snapshot.rangerDraws.actors[0].objectRender,null);assert.equal(snapshot.rangerDraws.actors[0].renderSource.fighterId,9);
 }
 const result=rangerPerformanceReceipts(rows,windowBounds);assert.equal(result.status,'recorded',result.errors.join(';'));assert.equal(result.baselineObservations,1);assert.equal(result.newPaintObservations,2);assert.equal(f.counters().perfCalls,1,'tactical read must not add performance RPCs');
 // The newest failed row remains the raw selected tail after a copy. An older
 // true row is deliberately present and may not be selected instead.
 g.time=13;f.context.nativeClock=4000;f.paint({...a.render,jointPaintedAt:13,jointDrawSucceeded:false,jointWeightedLowerDrawSucceeded:false,jointWeightedLower:{mode:'legacy-cell-fallback'}});f.copy();let failed;
 await normalTacticalInput(f.page,{inputs:[]},{rangerDrawObservation:true,observeSnapshot:s=>{failed=structuredClone(s);}});assert.equal(failed.rangerDraws.actors[0].render.jointDrawSucceeded,false);assert.equal(failed.rangerDraws.actors[0].render.renderSequence,4);assert.equal(failed.rangerDraws.actors[0].objectRender,null);
 failed.humans=failed.fighters.filter(a=>a.side==='human');assert.equal(rangerPerformanceReceipts([...rows,failed],windowBounds).weightedPaintObserved,false);
});

test('all original receipt check expressions and the original advancing-actor requirement remain present',()=>{
 const original=execFileSync('git',['show','26440877ee9cb120f0d3e4e38a73c38252cc46a5:scripts/v177-ranger-performance-receipts.mjs'],{encoding:'utf8'}).replaceAll('\r\n','\n'),candidate=fs.readFileSync(new URL('../scripts/v177-ranger-performance-receipts.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const calls=text=>{const sf=ts.createSourceFile('receipt.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),found=[];const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(sf)==='check')found.push(n.getText(sf));ts.forEachChild(n,visit);};visit(sf);return found;};
 const newer=calls(candidate);for(const call of calls(original))assert(newer.includes(call),call);
 const advancing='const advancingActors=[...actors.values()].filter(actor=>actor.observations>=2&&actor.lastSequence>actor.firstSequence&&actor.lastPaintedAt>actor.firstPaintedAt);';assert(original.includes(advancing));assert(candidate.includes(advancing));
});


test('unprovable copied start and distinct or reused actors in a new unpainted world cannot borrow an old baseline',async()=>{
 const makeActor=()=>({...actor(9,1,10),animationPresentation:{state:'idle',elapsedSeconds:0,lastEvents:[]},stationAbility:{phase:'idle'},manualAbility:{phase:'ready'}}),makeWorld=(a,generation)=>({time:10,battleAudioGeneration:generation,fighters:[a],areaEffects:[],renderObjectPools:{particles:{},shots:{},damageTexts:{}},particles:[],shots:[],damageTexts:[]});
 for(const mode of ['copy-before-start','new-actor-new-world','same-actor-new-world']){
  const f=appVmFixture(),oldActor=makeActor(),old=makeWorld(oldActor,7);f.setWorld(old);f.paint({...oldActor.render,jointPaintedAt:10});let g=old;
  if(mode==='copy-before-start')f.copy();else{g=makeWorld(mode==='same-actor-new-world'?oldActor:makeActor(),8);f.setWorld(g);}
  await f.beginMeasurement(f.page);const start=f.context.window.__V100_DEVICE_RAF__.performanceBefore.rangerDrawBoundary;
  assert.equal(start.actors[0].objectTailSame,mode==='same-actor-new-world');if(mode!=='copy-before-start')assert.equal(start.actors[0].worldWeightedLower,null);
  const rows=[];for(let i=0;i<2;i++){f.context.nativeClock=1000+i*1000;if(i){g.time=11;f.paint({...oldActor.render,jointPaintedAt:11});f.copy();}let s;await normalTacticalInput(f.page,{inputs:[]},{rangerDrawObservation:true,observeSnapshot:v=>{s=structuredClone(v);}});s.humans=s.fighters.filter(a=>a.side==='human');rows.push(s);}
  const result=rangerPerformanceReceipts(rows,windowBounds);assert.equal(result.status,'incomplete',mode);assert.equal(result.baselineObservations,0);assert.equal(result.newPaintObservations,1);assert(result.errors.some(e=>e.includes('preceding actual snapshot')));assert.equal(rows[0].rangerDraws.actors[0].render.renderSequence,1,'Original stale raw is retained');
 }
});

async function firstPaintFixture(){
 const f=appVmFixture(),a={...actor(9,1,10),animationPresentation:{state:'idle',elapsedSeconds:0,lastEvents:[]},stationAbility:{phase:'idle'},manualAbility:{phase:'ready'}},
  g={time:10,battleAudioGeneration:7,fighters:[a],areaEffects:[],renderObjectPools:{particles:{},shots:{},damageTexts:{}},particles:[],shots:[],damageTexts:[]};
 f.setWorld(g);f.paint({...a.render,jointPaintedAt:g.time});await f.beginMeasurement(f.page);
 g.time+=1/60;f.copy();f.context.nativeClock=1000;
 let latest;const read=()=>normalTacticalInput(f.page,{inputs:[]},{rangerDrawObservation:true,awaitInitialRangerPaint:true,observeSnapshot:s=>{latest=structuredClone(s);}});
 return{f,g,a,read,latest:()=>latest};
}

test('initial native observation waits through skipped paint and then reads the first completed frame in its original RPC',async()=>{
 const {f,g,a,read,latest}=await firstPaintFixture(),state=f.context.window.__V100_DEVICE_RAF__,start=structuredClone({startedAt:state.startedAt,performanceBefore:state.performanceBefore}),before=f.counters(),task=read();
 assert.equal(f.counters().snapshotCalls,before.snapshotCalls,'do not sample the known prepaint object copy');
 const entry=f.context.window.__V100_DEVICE_RAF__.rangerFirstPaintFence.beforeRenderFrames;
 g.time+=1/60;f.copy();f.frame(1017);await Promise.resolve();
 assert.equal(f.counters().snapshotCalls,before.snapshotCalls,'a simulation-only callback must not emit or discard a sample');
 assert.equal(f.context.window.__V100_DEVICE_RAF__.rangerFirstPaintFence.status,'pending');
 g.time+=1/60;f.paint({...a.render,jointPaintedAt:g.time});f.frame(1034);await task;
 const first=latest(),fence=first.rangerDraws.firstPaintFence;
 assert.equal(fence.status,'completed');assert.equal(fence.beforeRenderFrames,entry);assert.equal(fence.observedRenderFrames,entry+1);assert.equal(fence.rafCallbacks,2);
 assert.equal(first.rangerDraws.actors[0].render.jointPaintedAt,first.time);
 assert.equal(first.rangerDraws.actors[0].render.jointDrawSucceeded,true);assert.equal(f.counters().snapshotCalls,before.snapshotCalls+1);
 assert.equal(f.counters().evaluateCalls,before.evaluateCalls+1,'no added browser RPC');assert.equal(f.pending().timers,0);
 assert.equal(f.context.window.__V100_DEVICE_RAF__.startedAt,start.startedAt);assert.deepEqual(structuredClone(f.context.window.__V100_DEVICE_RAF__.performanceBefore),start.performanceBefore);
 const perfAfterFirst=f.counters().perfCalls;
 g.time=11;f.context.nativeClock=2000;f.paint({...a.render,jointPaintedAt:g.time});f.copy();await read();
 assert.equal(f.counters().perfCalls,perfAfterFirst,'later observations must not poll performance or wait for paint');
 const rows=[first,latest()].map(s=>({...s,humans:s.fighters.filter(a=>a.side==='human')})),result=rangerPerformanceReceipts(rows,windowBounds);
 assert.equal(result.status,'recorded',result.errors.join(';'));assert.equal(result.baselineObservations,0);assert.equal(result.newPaintObservations,2);
 assert.equal(result.naturalnessAccepted,false);assert.equal(result.wholeGameAccepted,false);
});

test('the first completed frame is retained even when its Ranger draw failed or supplied no fresh receipt',async()=>{
 for(const mode of ['failed','missing']){
  const {f,g,a,read,latest}=await firstPaintFixture(),task=read();g.time+=1/60;
  if(mode==='failed')f.paint({...a.render,jointPaintedAt:g.time,jointDrawSucceeded:false,jointWeightedLowerDrawSucceeded:false,jointWeightedLower:{mode:'legacy-cell-fallback'}});
  else f.context.runtimePerformanceRef.current.renderFrames++;
  f.frame(1017);await task;
  const s=latest(),draw=s.rangerDraws.actors[0].render,result=rangerPerformanceReceipts([{...s,humans:s.fighters}],windowBounds);
  assert.equal(s.rangerDraws.firstPaintFence.status,'completed');assert.equal(s.rangerDraws.firstPaintFence.rafCallbacks,1);assert.equal(f.counters().snapshotCalls,1);
  if(mode==='failed'){assert.equal(draw.jointDrawSucceeded,false);assert(result.errors.some(e=>e.includes('not actually painted')));}
  else{assert(draw.jointPaintedAt<s.time);assert(result.errors.some(e=>e.includes('preceding actual snapshot')));}
  assert.equal(result.weightedPaintObserved,false,'never wait for a later successful weighted draw');
 }
});

test('initial paint waiting fails on a stopped or replaced owner, regressed counter and deadline without observing or applying inputs',async()=>{
 for(const mode of ['stopped','replaced-measurement','replaced-qa','regressed-counter','timeout']){
  const {f,read}=await firstPaintFixture(),state=f.context.window.__V100_DEVICE_RAF__,task=read(),failure=assert.rejects(task,/stopped or changed|missing or regressed|Timed out/);
  if(mode==='stopped')state.active=false;
  else if(mode==='replaced-measurement')f.context.window.__V100_DEVICE_RAF__={...state};
  else if(mode==='replaced-qa')f.context.window.__ASHFALL_BATTLE_QA__={...f.context.window.__ASHFALL_BATTLE_QA__};
  else if(mode==='regressed-counter')f.context.runtimePerformanceRef.current.renderFrames--;
  if(mode==='timeout')f.expire();else f.frame(1017);
  await failure;assert.equal(state.rangerFirstPaintFence.status,'failed');assert.equal(f.counters().snapshotCalls,0);assert.equal(f.pending().timers,0);
 }
 const {f,read}=await firstPaintFixture();delete f.context.window.__V100_DEVICE_RAF__.performanceBefore.renderFrames;
 await assert.rejects(read(),/original actual render counter/);assert.equal(f.counters().snapshotCalls,0);
});

test('a new physical Ranger paint on the first unchanged fixed tick is distinct from the old cloned start tail',()=>{
 // Mac run40013984822: start seq23737/sim79.55, initial actor paint79.5333;
 // the completed fence observed a new seq23738/paint79.55 on the current object.
 const rows=samples(),start=rows[0].rangerDraws.measurementStart.boundary,a=rows[0].rangerDraws.actors[0];
 start.actors[0].objectTailSame=false;start.actors[0].jointPaintedAt=start.simulationTime-1/60;
 start.actors[0].worldWeightedLower=structuredClone(a.render.jointWeightedLower);
 for(const row of rows)row.rangerDraws.measurementStart.boundary=structuredClone(start);
 rows[0].time=start.simulationTime;rows[0].rangerDraws.simulationTime=start.simulationTime;rows[0].rangerDraws.renderBoundary.simulationTime=start.simulationTime;
 a.render.jointPaintedAt=start.simulationTime;a.objectRender=structuredClone(a.render);
 rows[0].rangerDraws.firstPaintFence={status:'completed',requestedAt:5,observedAt:10,beforeRenderFrames:40,observedRenderFrames:41,timeoutMs:2000};
 const before=structuredClone(rows),result=rangerPerformanceReceipts(rows,windowBounds);
 assert.equal(result.status,'recorded',result.errors.join(';'));assert.equal(result.baselineObservations,0);
 assert.equal(result.firstFixedStepPaintObservations,1);assert.equal(result.newPaintObservations,4);assert.deepEqual(rows,before);
 const faults=[
  r=>{const x=r[0].rangerDraws.actors[0];x.render.renderSequence=start.renderSequence;x.objectRender=structuredClone(x.render);},
  r=>{const x=r[0].rangerDraws.actors[0];x.render.jointPaintedAt=start.actors[0].jointPaintedAt;x.objectRender=structuredClone(x.render);},
  r=>r[0].rangerDraws.actors[0].objectRender=null,
  r=>r[0].rangerDraws.actors[0].objectRender.jointPaintedAt-=1/60,
  r=>r[0].rangerDraws.firstPaintFence.status='pending',
  r=>r[0].rangerDraws.firstPaintFence.observedRenderFrames=40,
  r=>r[0].rangerDraws.firstPaintFence.requestedAt=-1,
  r=>r[0].rangerDraws.firstPaintFence.observedAt=1001,
  r=>r[0].rangerDraws.firstPaintFence.timeoutMs=2001,
  r=>{delete r[0].rangerDraws.firstPaintFence;},
  r=>{for(const row of r)row.rangerDraws.measurementStart.boundary.actors[0].id=999;},
  r=>r[0].rangerDraws.actors[0].render.jointWeightedLowerDrawSucceeded=false,
  r=>{const x=r[1].rangerDraws.actors[0];x.render.jointPaintedAt=r[0].time;x.objectRender=structuredClone(x.render);r[1].rangerDraws.firstPaintFence=structuredClone(r[0].rangerDraws.firstPaintFence);},
 ];
 for(const mutate of faults){const invalid=structuredClone(rows);mutate(invalid);const bad=rangerPerformanceReceipts(invalid,windowBounds);assert.equal(bad.status,'incomplete');assert.equal(bad.weightedPaintObserved,false);}
});


test('the same original end callback exports all unmodified CPU chunks after stopping and also preserves partial failures',async()=>{
 const source=fs.readFileSync('scripts/v100-device-runtime-browser.mjs','utf8'),tree=ts.createSourceFile('device.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const end=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='endMeasurement');assert.ok(end);
 const chunks=[{measuring:true,readAt:100,frameCpuSequence:1,rows:[[1,90,91,89,92,93,94,1.5]]}];
 const owner={active:true,handle:123,startedAt:0,times:[10,20],capacity:4800,overflow:0,visibilityEvents:[],listeners:{},frameCpuChunks:chunks,frameCpuOverflow:3};
 let stopped=false,calls=0;
 const ctx=vm.createContext({structuredClone,window:{__V100_DEVICE_RAF__:owner},document:{visibilityState:'visible'},performance:{now:()=>{assert.equal(stopped,true);return 30000;}},
 cancelAnimationFrame:h=>{assert.equal(h,123);stopped=true;},page:{evaluate:async fn=>{calls++;return fn();}}});
 const endMeasurement=vm.runInContext('('+end.getText(tree)+')',ctx),receipt=await endMeasurement(ctx.page);
 assert.equal(calls,1);assert.equal(receipt.endedAt,30000);assert.equal(owner.active,false);
 assert.equal(receipt.deferredCpu.chunks,chunks);assert.equal(receipt.deferredCpu.overflow,3);assert.equal(chunks[0].rows[0][2],91);
 assert.match(source,/result\.partialMeasurement = await endMeasurement\(page\)/u);
 assert.match(source,/Object\.assign\(result\.frameCpuObservation,result\.partialMeasurement\.deferredCpu\)/u);
});
