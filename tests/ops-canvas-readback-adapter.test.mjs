import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {selectCanvasReadbackMode,readCanvasReadbackReceipt} from '../scripts/ops-canvas-readback-adapter.mjs';
function fixture(mode,{honor=true}={}){
  const calls=[];
  class Canvas {constructor(){this.width=844;this.height=340;}getContext(type,options){
    calls.push({owner:this,type,options});return {getContextAttributes:()=>({...options,willReadFrequently:honor&&options?.willReadFrequently===true})};
  }}
  const canvas=new Canvas(),sandbox={HTMLCanvasElement:Canvas,window:{},document:{querySelector:()=>canvas}};
  const context=vm.createContext(sandbox);
  vm.runInContext('('+selectCanvasReadbackMode.toString()+')',context)(mode);
  return {calls,Canvas,canvas,sandbox,read:()=>vm.runInContext('('+readCanvasReadbackReceipt.toString()+')',context)()};
}
test('only the battle context changes the one declared hint; actual context and dimensions are retained',()=>{
  for(const mode of ['default','readback']){
    const f=fixture(mode),options=Object.freeze({alpha:false,desynchronized:true,colorSpace:'srgb'});
    const actual=f.canvas.getContext('2d',options);assert.equal(f.canvas.getContext('2d',options),actual);assert.equal(f.calls.length,1);
    assert.equal(f.calls[0].owner,f.canvas);assert.equal(f.calls[0].options.alpha,false);assert.equal(f.calls[0].options.desynchronized,true);
    assert.equal(f.calls[0].options.colorSpace,'srgb');assert.equal(options.willReadFrequently,undefined);
    assert.equal(f.calls[0].options.willReadFrequently,mode==='readback'?true:undefined);
    const receipt=f.read();assert.equal(receipt.actualGameCanvas,true);assert.equal(receipt.width,844);assert.equal(receipt.height,340);
    const offscreen=new f.Canvas(),other=Object.freeze({alpha:true});offscreen.getContext('2d',other);offscreen.getContext('webgl',{});
    assert.equal(f.calls[1].options,other);assert.equal(f.sandbox.window.__OPS_CANVAS_READBACK__.calls.length,1);
  }
});
test('unsupported, ambiguous, or wrong-owner observations fail rather than reverting to an unlabelled control',()=>{
  const unsupported=fixture('readback',{honor:false});unsupported.canvas.getContext('2d',{alpha:false,desynchronized:true});
  assert.throws(unsupported.read,/did not confirm/u);
  const f=fixture('default');f.canvas.getContext('2d',{alpha:false,desynchronized:true});
  f.sandbox.window.__OPS_CANVAS_READBACK_OWNER__=new f.Canvas();assert.throws(f.read,/Exactly one actual/u);
  f.sandbox.window.__OPS_CANVAS_READBACK_OWNER__.getContext('2d',{alpha:false,desynchronized:true});
  assert.equal(f.sandbox.window.__OPS_CANVAS_READBACK__.calls.length,2);assert.throws(f.read,/Exactly one actual/u);
  assert.throws(()=>selectCanvasReadbackMode('other'),/Unknown/u);
});
