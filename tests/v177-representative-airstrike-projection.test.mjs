import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {projectRepresentativeAirstrikeCanvases} from '../scripts/v100-normal-tactical-input.mjs';

test('the real representative projection observes a removed battle canvas immediately and keeps the exact current hit target',()=>{
  const target={x:340,y:270},canvas={dataset:{worldScale:'.8',worldOffsetX:'13',worldOffsetY:'-4'},getBoundingClientRect:()=>({x:10,y:20,width:844,height:390})};
  let hit=canvas,reads=0;const read=vm.runInNewContext('('+projectRepresentativeAirstrikeCanvases.toString()+')',{
    document:{elementFromPoint(x,y){reads++;assert.equal(x,295);assert.equal(y,232);return hit;}}});
  assert.equal(read([],target),null);assert.equal(reads,0);assert.equal(read([canvas,canvas],target),null);assert.equal(reads,0);
  assert.deepEqual(structuredClone(read([canvas],target)),{x:295,y:232});hit={};assert.equal(read([canvas],target),null);
  const zero={...canvas,getBoundingClientRect:()=>({x:10,y:20,width:0,height:390})};assert.equal(read([zero],target),null);
  for(const worldScale of ['0','-1','NaN','Infinity'])assert.equal(read([{...canvas,dataset:{...canvas.dataset,worldScale}}],target),null);
});

test('the actual airstrike call uses one immediate canvas projection and never waits for a canvas from a completed battle',async()=>{
  const source=readFileSync('scripts/v100-normal-tactical-input.mjs','utf8'),tree=ts.createSourceFile('tactical.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),matches=[];
  const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='point'
    &&node.initializer?.getText(tree).includes('projectRepresentativeAirstrikeCanvases'))matches.push(node);ts.forEachChild(node,visit);};visit(tree);assert.equal(matches.length,1);
  const read=new Function('page','target','projectRepresentativeAirstrikeCanvases','return (async()=>'+matches[0].initializer.getText(tree)+')()');
  let reads=0;
  const page={locator(selector){assert.equal(selector,'.game-shell canvas');return{evaluate(){throw Error('A removed battle canvas must not be awaited');},
    async evaluateAll(callback,arg){reads++;assert.equal(callback,projectRepresentativeAirstrikeCanvases);assert.deepEqual(arg,{x:340,y:270});return callback([],arg);}};}};
  assert.equal(await read(page,{x:340,y:270},projectRepresentativeAirstrikeCanvases),null);assert.equal(reads,1);
});
