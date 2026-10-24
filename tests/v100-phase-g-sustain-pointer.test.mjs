import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import test from 'node:test';
import{execFileSync}from'node:child_process';
import{performance}from'node:perf_hooks';
const source=fs.readFileSync('scripts/v100-phase-g-production-matrix.mjs','utf8');
const tree=ts.createSourceFile('matrix.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const helpers=['phaseGSustainAbilityObserver','validatePhaseGSustainAbilityReceipt','phaseGSustainAbilityTap'].map(name=>{const n=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(n,name);return n.getText(tree);}).join('\n');
const evidence=fs.readFileSync('scripts/v100-phase-g-runtime-evidence.mjs','utf8');
const parsed=ts.createSourceFile('evidence.mjs',evidence,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const marker=parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='manualMarkerDispatchStarted').getText(parsed).replace('export ','');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(change={}){
 let clock=100,gets=0,handlerCalls=0,closed=false,hitBlocked=false;
 const calls=[],listeners=new Map(),snapshot={screen:'battle',stageId:'stage-3',battleGeneration:2,time:3,
  running:true,paused:false,over:false,fighters:[{id:9,kind:'brute',side:'human',hp:100,manualAbility:{activationId:0}}],manualAbilityReceipts:[]};
 class Element{constructor(){this.dataset={fighterId:'9',abilityKind:'brute'};this.disabled=false;this.isConnected=true;}
  closest(s){assert.equal(s,'button');return this;}matches(s){assert.equal(s,'button.manual-ability-ready.available');return true;}
  getBoundingClientRect(){return{x:10.25,y:20,width:60,height:30};}getAttribute(s){assert.equal(s,'aria-disabled');return change.disabled?'true':'false';}}
 const el=new Element(),other=new Element();other.dataset.fighterId='10';
 const document={documentElement:{},querySelectorAll:()=>change.missing?[]:[el],elementFromPoint:()=>change.covered||hitBlocked?other:el,
  addEventListener(type,handler,options){assert.equal(options.capture,true);assert.equal(options.passive,true);listeners.set(type,handler);},
  removeEventListener(type,handler,capture){assert.equal(capture,true);assert.equal(listeners.get(type),handler);listeners.delete(type);}};
 const window={__ASHFALL_BATTLE_QA__:{getPhaseGCombatSnapshot(){gets++;if(change.readFails&&gets===2)throw Error('post observation failed');return clone(snapshot);}}};
 const context=vm.createContext({window,document,Element,performance:{now:()=>clock},Date:{now:()=>clock},Math,
  phaseGPointerFailure:(code,evidence)=>Object.assign(new Error(code),{code,evidence,phaseGTerminalInputFailure:true})});
 vm.runInContext(marker+'\n'+helpers+'\nthis.api={observer:phaseGSustainAbilityObserver,validate:validatePhaseGSustainAbilityReceipt,tap:phaseGSustainAbilityTap};',context);
 const activate=()=>{handlerCalls++;if(change.noActivation)return;snapshot.fighters[0].manualAbility.activationId++;
  snapshot.manualAbilityReceipts.push({ownerId:9,kind:'brute',eventType:'start',activationId:snapshot.fighters[0].manualAbility.activationId,at:snapshot.time});};
 const page={isClosed:()=>closed,async evaluate(fn,arg){calls.push(arg.mode);clock++;
  const result=fn(arg);if(arg.mode==='finish')result.cleanupFixtureObserved=listeners.size===0;return clone(result);},
  mouse:{async click(x,y){calls.push('native-click');if(change.nativeError)throw Error('native input rejected');
   if(change.lateClick){clock=601;return;}
   let types=['pointermove','pointerdown','pointerup','click'];if(change.missingUp)types=types.filter(t=>t!=='pointerup');
   if(change.reordered)types=['pointermove','pointerup','pointerdown','click'];if(change.duplicateClick)types.push('click');
   for(const type of types){clock++;if(change.wrongTarget)hitBlocked=true;if(change.disabledAtDown&&type==='pointerdown')el.disabled=true;
    const event={type,target:change.wrongTarget?other:el,isTrusted:!change.untrusted,pointerType:change.touch?'touch':'mouse',button:type==='pointermove'?-1:0,clientX:x,clientY:y};
    listeners.get(type)?.(event);if(type==='click'){activate();if(change.removeButton)el.isConnected=false;}}
   if(change.multipleStarts)activate();if(change.generationChange)snapshot.battleGeneration++;
   if(change.removeActor)snapshot.fighters=[];
   snapshot.time+=1/60;
  }}};
 return{context,page,calls,listeners,snapshot,get gets(){return gets;},get handlerCalls(){return handlerCalls;},closeContext(){closed=true;listeners.clear();window.__V100_PHASE_G_SUSTAIN_POINTERS__?.clear();}};
}
const results=[];
async function run(name,change,expected){const f=fixture(change),phases=[];let accepted,error;
 try{accepted=await f.context.api.tap(f.page,{selector:'button.manual-ability-ready.available:not([disabled])',index:0},phases);}catch(e){error=String(e);}
 if(expected==='pass'){assert.equal(error,undefined,name);assert.equal(accepted,true,name);assert.deepEqual(f.calls,['arm','native-click','finish']);assert.equal(f.gets,2);assert.equal(f.handlerCalls,1);assert.equal(f.listeners.size,0);}
 if(expected==='unavailable'){assert.equal(error,undefined);assert.equal(accepted,false);assert.deepEqual(f.calls,['arm']);assert.equal(f.handlerCalls,0);assert.equal(f.listeners.size,0);}
 if(expected==='fail-finalized'){assert.ok(error,name);assert.notEqual(accepted,true);assert.deepEqual(f.calls,['arm','native-click','finish']);assert.equal(f.listeners.size,0);}
 if(expected==='fail-no-later-rpc'){assert.ok(error,name);assert.deepEqual(f.calls,['arm','native-click']);f.closeContext();assert.equal(f.listeners.size,0);}
 results.push({name,logicFixturePassed:true,accepted:accepted??false,error:error??null,rpcs:f.calls,syntheticFixtureOnly:true});}
test('native sustain transaction checks trusted delivery, one actual start and all failure boundaries',async()=>{
await run('one real-sequence-shaped fixture and exactly one production-start-shaped receipt',{},'pass');
await run('normal production HUD removal after click is permitted',{removeButton:true},'pass');
await run('receipt remains causal if owner disappears after its accepted activation',{removeActor:true},'pass');
for(const [name,change]of Object.entries({missing:{missing:true},covered:{covered:true},disabled:{disabled:true}}))await run(name,change,'unavailable');
for(const [name,change]of Object.entries({missingUp:{missingUp:true},wrongTarget:{wrongTarget:true},wrongGeneration:{generationChange:true},duplicateStart:{multipleStarts:true},noStart:{noActivation:true},syntheticEvent:{untrusted:true},touchInput:{touch:true},eventReordered:{reordered:true},duplicateClick:{duplicateClick:true},disabledBeforeDown:{disabledAtDown:true},postReadThrows:{readFails:true}}))await run(name,change,'fail-finalized');
await run('native error sends neither a receipt RPC nor a second input',{nativeError:true},'fail-no-later-rpc');
await run('late native fulfillment cannot start the final RPC past original500ms',{lateClick:true},'fail-no-later-rpc');
assert.equal(results.length,19);
});
test('the native sustain change preserves the original500ms lock, terminal cancellation and default deployment input',()=>{
const original=ts.createSourceFile('original.mjs',execFileSync('git',['show','6a5226647ebf9ba7692c69b9c64af4ce32059d1b:scripts/v100-phase-g-production-matrix.mjs'],{encoding:'utf8',windowsHide:true}),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const candidate=tree;
for(const name of ['phaseGPageInputState','withPhaseGPageInputLock','phaseGPointerFailure','withDeploymentPreinputDeadline','phaseGOrderedControlInput','installDeploymentPointerReceipt','readDeploymentPointerReceipts','removeDeploymentPointerReceipt','performVerifiedDeploymentPointer']){const a=original.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name),b=candidate.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(a&&b);assert.equal(a.getText(original),b.getText(candidate),name);}
assert.match(source,/phaseGSustainAbilityTap\(page,\{selector:sustainAbilitySelector,index\},phases\), 500, "sustain-ability"/u);
});

test('the real outer500ms timeout also forbids later page diagnostics and another input',async()=>{
 const functions=['phaseGPointerFailure','withDeploymentPreinputDeadline','phaseGOrderedControlInput'].map(name=>{
  const n=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(n);return n.getText(tree);}).join('\n');
 let arrow;const visit=n=>{if(ts.isArrowFunction(n)&&n.body.getText(tree).includes('try {\n              await phaseGOrderedControlInput'))arrow=n;
  ts.forEachChild(n,visit);};visit(tree);assert.ok(arrow,'Test the actual sustain callsite exception path');
 let cancellations=0,inputs=0;
 const context={performance,page:{},sustainAbilitySelector:'button.manual-ability-ready.available',index:0,
  phaseGSustainAbilityTap:async()=>{inputs++;return new Promise(()=>{});},
  terminateTimedOutDeploymentPreinput:async()=>{cancellations++;return{terminalLifecycleVerified:true};},
  setTimeout:(fn,ms)=>{assert.equal(ms,500);return setTimeout(fn,0);},clearTimeout};
 const operation=vm.runInNewContext(functions+'\n('+arrow.getText(tree)+')()',context);
 await assert.rejects(operation,e=>e.code==='QA_HARNESS_CONTROL_INPUT_TIMEOUT'&&e.phaseGCausalNoFurtherPageRpc===true);
 assert.equal(cancellations,1);assert.equal(inputs,1);
});
