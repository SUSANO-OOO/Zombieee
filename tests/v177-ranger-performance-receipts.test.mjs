import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {normalTacticalInput} from '../scripts/v100-normal-tactical-input.mjs';
import {rangerPerformanceReceipts} from '../scripts/v177-ranger-performance-receipts.mjs';

const windowBounds={startedAt:0,endedAt:5000};
function actor(id,sequence,time){return{id,kind:'ranger',side:'human',hp:70,maxHp:70,x:100+sequence,y:280,lane:1,speed:29,laneSpeed:75,damage:22.4,range:145,attackEvery:.82,
  render:{renderSequence:sequence,renderKind:'ranger',assetReady:true,renderWidth:150,renderHeight:140,jointPaintedAt:time-.02,
    jointAtlasPath:V177_JOINT_ATLASES.ranger.path,jointDrawSucceeded:true,jointWeightedLowerDrawSucceeded:true,
    jointWeightedLower:{mode:'continuous-weighted-mesh',phase:.37,settle:.5,parts:5,meshVertices:130,meshTriangles:192,coverageSamples:4,duplicateWithinPart:0,degenerate:0}}};}
function samples(){return Array.from({length:4},(_,i)=>{const actors=i===2?[]:i===3?[actor(1100,520,10+i)]:[actor(1001,100+i*10,10+i),...(i===1?[actor(1100,500,10+i)]:[])];
  return{time:10+i,humans:actors.map(({id,kind,hp,maxHp,x,y,lane})=>({id,kind,hp,maxHp,x,y,lane})),rangerDraws:{readAt:(i+1)*1000,simulationTime:10+i,actors}};});}

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
      fighter={...actual,renderAudit,x:100,y:50,lane:1,combatReady:true},state={time:10,running:true,over:true,won:false,fighters:[fighter],deployQueue:[]};
    const before=structuredClone(state),context={window:{__ASHFALL_BATTLE_QA__:{getSnapshot:()=>state}},performance:{now:()=>1000}};
    let observed,calls=0;const page={async evaluate(fn,arg){calls++;context.arg=arg;return vm.runInNewContext('('+fn.toString()+')(arg)',context);}};
    await normalTacticalInput(page,{inputs:[]},{rangerDrawObservation:true,observeSnapshot:s=>{observed=structuredClone(s);}});
    assert.equal(calls,1);assert.equal(observed.rangerDraws.readAt,1000);assert.equal(observed.rangerDraws.simulationTime,state.time);
    assert.deepEqual(observed.rangerDraws.actors[0].render,renderAudit);assert.equal(observed.rangerDraws.actors[0].id,fighter.id);
    await normalTacticalInput(page,{inputs:[]},{observeSnapshot:s=>{observed=structuredClone(s);}});
    assert.equal(Object.hasOwn(observed,'rangerDraws'),false);assert.deepEqual(state,before);
  }
});

test('the actual device projection retains raw receipts and all original window, scalar gates, fixture and tactical policy stay exact',()=>{
  const read=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),source=read('scripts/v100-device-runtime-browser.mjs'),
    old=execFileSync('git',['show','207e19bd33e6ce62895c615dedaa816ae469d70c:scripts/v100-device-runtime-browser.mjs'],{encoding:'utf8'}).replaceAll('\r\n','\n'),
    tree=text=>ts.createSourceFile('device.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),ast=tree(source),oldAst=tree(old);
  const declaration=(ast,name)=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
  for(const name of ['beginMeasurement','endMeasurement','fixtureSave'])assert.equal(declaration(ast,name).getText(ast),declaration(oldAst,name).getText(oldAst),name);
  const gate=ast=>{const rows=[];const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='gates')rows.push(n.initializer.getText(ast));ts.forEachChild(n,visit);};visit(ast);assert.equal(rows.length,1);return rows[0];};
  assert.equal(gate(ast),gate(oldAst));
  const project=new Function('bossKind','return '+declaration(ast,'snapshotProjection').getText(ast))('mugarian-president-mutated'),row={...samples()[0],fighters:[]};
  assert.equal(project(row).rangerDraws,row.rangerDraws);delete row.rangerDraws;assert.equal(Object.hasOwn(project(row),'rangerDraws'),false);
  const tactical=read('scripts/v100-normal-tactical-input.mjs'),oldTactical=execFileSync('git',['show','207e19bd33e6ce62895c615dedaa816ae469d70c:scripts/v100-normal-tactical-input.mjs'],{encoding:'utf8'}).replaceAll('\r\n','\n'),marker='  observeSnapshot?.(s);';
  const s25Only="s25FireComparison ? s25FireDeploymentPriorities(s, record.s25ObservedHumans, earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities) : earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities";
  assert.equal(tactical.split(s25Only).length,2,'only the one explicit S25 branch is exempt');
  assert.equal(tactical.slice(tactical.indexOf(marker)).replace(s25Only,"earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities"),oldTactical.slice(oldTactical.indexOf(marker)),'all baseline tactical policy remains exact');
});
