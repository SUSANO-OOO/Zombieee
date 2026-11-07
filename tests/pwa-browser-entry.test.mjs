import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {derivePwaPhase,canPlayOffline} from '../app/pwaRuntime.js';
import {createPaintedBrowserEntry} from '../app/pwaBrowserEntry.js';

function frames(){let next=0;const queue=new Map();return {
  requestFrame:callback=>{const id=++next;queue.set(id,callback);return id;},
  cancelFrame:id=>queue.delete(id),
  paint(){const callbacks=[...queue.values()];queue.clear();callbacks.forEach(callback=>callback());},
  callbacks:()=>[...queue.values()],size:()=>queue.size,
};}
test('browser entry acknowledges once and leaves an intervening paint before mounting the game',()=>{
  const f=frames(),events=[],entry=createPaintedBrowserEntry({...f,onPending:value=>events.push(['pending',value]),onEnter:()=>events.push(['enter'])});
  assert.equal(entry.request(),true);assert.equal(entry.request(),false);
  assert.deepEqual(events,[['pending',true]]);
  f.paint();assert.deepEqual(events,[['pending',true]]);
  f.paint();assert.deepEqual(events,[['pending',true],['pending',false],['enter']]);
  assert.equal(entry.request(),false);assert.equal(f.size(),0);
});
test('unmount cancels either frame and late callbacks cannot enter or schedule more work',()=>{
  for(const afterFirstPaint of [false,true]){
    const f=frames(),events=[],entry=createPaintedBrowserEntry({...f,onPending:value=>events.push(['pending',value]),onEnter:()=>events.push(['enter'])});
    entry.request();if(afterFirstPaint)f.paint();const [late]=f.callbacks();entry.dispose();
    assert.equal(f.size(),0);late();assert.equal(f.size(),0);assert.deepEqual(events,[['pending',true]]);
    assert.equal(entry.request(),false);
  }
});
test('disposal caused by pending feedback never mounts a stale game owner',()=>{
  for(const when of [true,false]){
    const f=frames(),events=[];let entry;
    entry=createPaintedBrowserEntry({...f,onPending:value=>{events.push(['pending',value]);if(value===when)entry.dispose();},onEnter:()=>events.push(['enter'])});
    entry.request();f.paint();f.paint();assert.equal(events.some(e=>e[0]==='enter'),false);assert.equal(f.size(),0);
  }
});
test('actual gate keeps first phone setup and failed registration ahead of play, preserving recovery',()=>{
 const source=fs.readFileSync('app/PwaGate.tsx','utf8'),tree=ts.createSourceFile('PwaGate.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),expressions={};
 const visit=node=>{if(ts.isVariableDeclaration(node)&&['settling','blocking'].includes(node.name.getText(tree)))expressions[node.name.getText(tree)]=node.initializer.getText(tree);ts.forEachChild(node,visit);};visit(tree);
 assert.ok(expressions.settling);assert.ok(expressions.blocking);
 const rows=[
  [{},true], [{offerDismissed:false},true], [{offerDismissed:true},false],
  [{installedManifest:{version:'test'}},false],
  [{registrationFailed:true,supported:false},true],
  [{registrationFailed:true,supported:false,offerDismissed:true},true],
  [{registrationFailed:true,supported:false,standalone:true,offerDismissed:true},true],
  [{registrationFailed:true,supported:false,registrationFailureAcknowledged:true},false],
  [{booted:false},true], [{bootFailure:true},true],
  [{standalone:true},true], [{downloadState:'running'},true], [{downloadState:'paused'},true],
  [{downloadState:'failed'},true], [{downloadState:'cancelled'},true], [{downloadState:'committing'},true], [{downloadState:'complete'},true],
  [{commitRequired:true},true], [{commitRequired:true,commitRecoveryBusy:true},true],
  [{standalone:true,installedManifest:{version:'test'},installPlan:{complete:true},publishedChecked:false},true],
  [{standalone:true,installedManifest:{version:'test'},installPlan:{complete:true},publishedChecked:true},false],
 ];
 for(const [changes,expected] of rows){
  const values={supported:true,standalone:false,booted:true,bootFailure:false,publishedChecked:true,offerDismissed:false,registrationFailed:false,registrationFailureAcknowledged:false,...changes};
  values.phase=derivePwaPhase(values);values.playable=canPlayOffline({phase:values.phase,installPlan:values.installPlan});
  const result=vm.runInNewContext('const settling='+expressions.settling+';'+expressions.blocking,values);
  assert.equal(result,expected,JSON.stringify(changes));
 }
});
