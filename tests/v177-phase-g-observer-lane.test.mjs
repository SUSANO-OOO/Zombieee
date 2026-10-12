import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('scripts/v100-phase-g-production-matrix.mjs','utf8');
const parsed=ts.createSourceFile('matrix.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const names=['phaseGPageInputState','withPhaseGPageInputLock','waitForPhaseGPagePredicate','waitForCombatActivity'];
const functions=parsed.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text));
const declaration=name=>parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(parsed);

test('the actual initial combat observer cannot issue a page read during native input',async()=>{
  let releaseInput;
  const pending=new Promise(resolve=>{releaseInput=resolve;});
  const events=[];
  const harness=vm.runInNewContext(functions.map(n=>n.getText(parsed)).join('\n')
    +'\n({withPhaseGPageInputLock,waitForCombatActivity})',{
    phaseGPageInputTails:new WeakMap(),Date,setTimeout,clearTimeout,
    checkpointRecorderFor:()=>null,battleTimeout:45000,
    invariant:(value,message)=>assert.ok(value,message),
    withDeploymentPreinputDeadline:async(_page,operation)=>operation,
  });
  const page={
    evaluate:async()=>{events.push('page-read');return true;},
    waitForFunction:async()=>{events.push('page-read');},
  };
  const input=harness.withPhaseGPageInputLock(page,async()=>{events.push('input-start');await pending;events.push('input-end');});
  await Promise.resolve();await Promise.resolve();
  const observer=harness.waitForCombatActivity(page);
  try{
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(events,['input-start'],'foreground polling must share the existing input lane');
  }finally{releaseInput();await Promise.all([input,observer]);}
  assert.deepEqual(events,['input-start','input-end','page-read']);
});

test('false foreground predicates consume queue time and cannot restart their original deadline',async()=>{
  let now=0,reads=0;
  const budgets=[];
  const wait=vm.runInNewContext(declaration('waitForPhaseGPagePredicate')+'\nwaitForPhaseGPagePredicate',{
    Date:{now:()=>now},invariant:(value,message)=>assert.ok(value,message),
    withPhaseGPageInputLock:async(_page,operation)=>{await Promise.resolve();now+=60;return operation();},
    withDeploymentPreinputDeadline:async(_page,operation,budget)=>{budgets.push(budget);return operation;},
    setTimeout:(callback,ms)=>{now+=ms;callback();},
  });
  await assert.rejects(wait({evaluate:async()=>{reads++;return false;}},()=>false,null,{timeout:300,polling:100}),
    /FOREGROUND_OBSERVATION_DEADLINE_EXCEEDED/);
  assert.equal(now,300);assert.equal(reads,2);assert.deepEqual(budgets,[300,140]);
});

test('an unresolved foreground read is cancelled once and seals later native input',async()=>{
  let expire,rejectRead,readCount=0,cancelCount=0;
  const pending=new Promise((_resolve,reject)=>{rejectRead=reject;});
  const required=['phaseGPageInputState','withPhaseGPageInputLock','phaseGPointerFailure',
    'withDeploymentPreinputDeadline','waitForPhaseGPagePredicate'];
  const harness=vm.runInNewContext(required.map(declaration).join('\n')
    +'\n({waitForPhaseGPagePredicate,withPhaseGPageInputLock})',{
    phaseGPageInputTails:new WeakMap(),Date,invariant:(value,message)=>assert.ok(value,message),
    setTimeout:(callback,ms)=>{assert.ok(ms>0&&ms<=45000);expire=callback;return 1;},clearTimeout:()=>{},
    terminateTimedOutDeploymentPreinput:async(_page,operation)=>{
      cancelCount++;rejectRead(new Error('owned context cancellation'));await operation.catch(()=>{});
      return{terminalLifecycleVerified:true};
    },
  });
  const page={evaluate:async()=>{readCount++;return pending;}};
  const operation=harness.waitForPhaseGPagePredicate(page,()=>false,null,{timeout:45000,polling:100});
  await Promise.resolve();await Promise.resolve();
  assert.equal(readCount,1);expire();
  const failure=await operation.then(()=>assert.fail('unresolved read must not pass'),error=>error);
  assert.equal(failure.code,'QA_HARNESS_FOREGROUND_OBSERVATION_TIMEOUT');
  assert.equal(failure.phaseGCausalNoFurtherPageRpc,true);
  assert.equal(failure.phaseGPointerEvidence.cancellation.terminalLifecycleVerified,true);
  await assert.rejects(harness.withPhaseGPageInputLock(page,()=>assert.fail('no later native input')),error=>error===failure);
  assert.equal(readCount,1);assert.equal(cancelCount,1);
});

test('manual-marker failure does not make another page RPC after terminal cancellation',async()=>{
  const primary=Object.assign(new Error('terminal foreground read'),{phaseGCausalNoFurtherPageRpc:true});
  const wait=vm.runInNewContext(declaration('waitForManualMarkerObservation')+'\nwaitForManualMarkerObservation',{
    battleTimeout:150000,manualMarkerActivation:()=>({ok:true,identity:{},errors:[]}),
    invariant:(value,message)=>assert.ok(value,message),
    waitForPhaseGPagePredicate:async()=>{throw primary;},
    withPhaseGPageInputLock:()=>assert.fail('terminal failure cannot enqueue diagnostic page work'),
    readPhaseGSetupRuntime:()=>assert.fail('terminal failure cannot issue a diagnostic RPC'),
  });
  await assert.rejects(wait({},'babayaga',{}),error=>error===primary);
});
