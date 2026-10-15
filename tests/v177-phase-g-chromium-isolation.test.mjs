import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../scripts/v100-phase-g-production-matrix.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('phase-g.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const declarations=new Map(tree.statements.filter(ts.isFunctionDeclaration).map(node=>[node.name.text,node]));
function harness({launchFailure=false}={}) {
  const events=[],browsers=[],map=new Map(),metadata=new WeakMap();
  const playwright=Object.fromEntries(['chromium','webkit'].map(engine=>[engine,{async launch(){
    events.push('launch:'+engine);if(launchFailure)throw Error('native launch failed');
    let connected=true;const browser={isConnected:()=>connected,async close(){events.push('close:'+browser.id);connected=false;},
      async newContext(){events.push('context:'+browser.id);return{async newPage(){return{};}};},id:engine+'-'+(browsers.length+1)};
    browsers.push(browser);return browser;
  }}]));
  const context=vm.createContext({phaseGBrowsers:map,phaseGBrowserMetadata:metadata,phaseGBrowserSessionOrdinal:0,playwright,
    process:{env:{}},silenceBrowserOutput:async()=>{},invariant:(condition,message)=>assert.ok(condition,message)});
  for(const name of ['phaseGBrowserLifecyclePolicy','phaseGBrowser','phaseGBrowserSessionForCapture','resetPhaseGBrowser']) {
    vm.runInContext(declarations.get(name).getText(tree),context);
  }
  // Execute the real capture startup, through its first page, without a browser.
  const statements=declarations.get('captureStateImpl').body.statements;
  const stop=statements.findIndex(node=>node.getText(tree)==='await silenceBrowserOutput(page);');
  assert.ok(stop>0);
  const startup='async function captureStartup(engineName,viewport,state){'+statements.slice(0,stop+1).map(node=>node.getText(tree)).join('\n')+';return{browserPolicy,browserSession,browser};}';
  vm.runInContext(startup,context);
  return {events,browsers,map,async capture(engine,state){return context.captureStartup(engine,{safeArea:false},state);},
    async finish(capture){if(capture.browserPolicy.closeAfterCapture)await context.resetPhaseGBrowser(capture.browserPolicy.engineName);}};
}

for(const engine of ['chromium','webkit']) {
  test(engine+' extra battle captures receive separate native processes, each used once',async()=>{
    const h=harness(),ui=await h.capture(engine,'battle-normal');
    const first=await h.capture(engine,'battle-extra');
    assert.notEqual(first.browser,ui.browser);assert.equal(ui.browser.isConnected(),false);
    assert.equal(first.browserSession.isolation,'fresh-process-per-capture');
    assert.equal(first.browserSession.captureOrdinal,1);assert.equal(first.browserSession.maxCapturesPerBrowser,1);
    await h.finish(first);assert.equal(first.browser.isConnected(),false);assert.equal(h.map.has(engine),false);
    const second=await h.capture(engine,'battle-extra');
    assert.notEqual(second.browser,first.browser);assert.equal(second.browserSession.captureOrdinal,1);
    await h.finish(second);
    assert.equal(h.events.filter(event=>event.startsWith('launch:')).length,3);
    assert.equal(h.browsers.every(browser=>!browser.isConnected()),true);
  });
}

test('ordinary matrix screens continue sharing their live browser rather than resetting every screen',async()=>{
  for(const engine of ['chromium','webkit']){
    const h=harness(),first=await h.capture(engine,'battle-normal'),second=await h.capture(engine,'battle-boss');
    assert.equal(first.browser,second.browser);assert.equal(second.browserSession.captureOrdinal,2);
    assert.equal(first.browserPolicy.closeExistingBeforeCapture,false);assert.equal(first.browserPolicy.closeAfterCapture,false);
    assert.equal(h.events.filter(event=>event.startsWith('launch:')).length,1);
  }
});

test('a failed fresh browser launch stops the actual capture startup without a fallback or retry',async()=>{
  const h=harness({launchFailure:true});
  await assert.rejects(()=>h.capture('chromium','battle-extra'),/native launch failed/);
  assert.deepEqual(h.events,['launch:chromium']);assert.equal(h.browsers.length,0);
});
