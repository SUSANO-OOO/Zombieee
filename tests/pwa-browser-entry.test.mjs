import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
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
test('the actual PWA play-button callback defers entry through the painted transition',()=>{
  const source=fs.readFileSync('app/PwaGate.tsx','utf8'),tree=ts.createSourceFile('PwaGate.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let button,callback;
  const visit=node=>{if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(tree)==='button'&&node.getText(tree).includes('offerCopy?.skipLabel'))button=node;ts.forEachChild(node,visit);};visit(tree);assert.ok(button);
  const click=button.openingElement.attributes.properties.find(p=>p.name?.getText(tree)==='onClick').initializer.expression;
  if(ts.isIdentifier(click)){
    const find=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(tree)===click.text)callback=node.initializer.arguments[0];ts.forEachChild(node,find);};find(tree);
  }else callback=click;
  assert.ok(callback);const f=frames(),events=[],context={browserPlayTransitionRef:{current:null},createPaintedBrowserEntry,
    window:{requestAnimationFrame:f.requestFrame,cancelAnimationFrame:f.cancelFrame},
    setBrowserPlayPending:value=>events.push(['pending',value]),setOfferDismissed:value=>events.push(['enter',value])};
  const code=ts.transpileModule('const click='+callback.getText(tree)+';click;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,context)();
  assert.equal(events.some(e=>e[0]==='enter'),false,'the old synchronous state update mounts the heavy game inside its native input');
  f.paint();assert.equal(events.some(e=>e[0]==='enter'),false);
  f.paint();assert.deepEqual(events,[['pending',true],['pending',false],['enter',true]]);
});
