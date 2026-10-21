import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let entry,record;
function visit(node){if(ts.isVariableDeclaration(node)) {
  if(node.name.getText(tree)==='cpuEntryAt')entry=node.initializer.getText(tree);
  if(node.name.getText(tree)==='recordFrameCpu')record=node.initializer.getText(tree);
}ts.forEachChild(node,visit);}
visit(tree);assert.ok(entry&&record);
const code=ts.transpileModule(`()=>{const cpuEntryAt=${entry};return ${record};}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(enabled){let clock=20;const performanceCounters={frameCpuSequence:0,frameCpuTimings:[],lastFrameExitAt:null};
 const create=vm.runInNewContext(code,{fighterRenderAuditEnabled:enabled,qaMode:null,qaScenario:null,
  performance:{now:()=>clock++},performanceCounters,now:19,g:{time:10}});
 return {create,performanceCounters};}
test('phase-g and ordinary localhost QA frames record CPU timing even without the old scenario flags',()=>{
 const {create,performanceCounters:p}=fixture(true);create()(20.2,20.7);
 assert.equal(p.frameCpuSequence,1);assert.equal(p.frameCpuTimings.length,1);
 assert.equal(p.frameCpuTimings[0].entryAt,20);assert.equal(p.frameCpuTimings[0].simulationFinishedAt,20.2);
 assert.equal(p.frameCpuTimings[0].drawFinishedAt,20.7);assert.equal(p.frameCpuTimings[0].exitAt,21);
});
test('actual recorder keeps only128 ordered frame costs and does not collect on public play',()=>{
 const {create,performanceCounters:p}=fixture(true);
 for(let i=0;i<150;i++)create()(i+100,i+101);
 assert.equal(p.frameCpuTimings.length,128);assert.equal(p.frameCpuTimings[0].sequence,23);assert.equal(p.frameCpuTimings.at(-1).sequence,150);
 const off=fixture(false);off.create()(1,2);assert.equal(off.performanceCounters.frameCpuSequence,0);assert.deepEqual(off.performanceCounters.frameCpuTimings,[]);
});
