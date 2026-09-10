import test from 'node:test';
import assert from 'node:assert/strict';
import {createV100ImageSampler} from '../app/v100ImageSampling.js';
function fixture(options={}){
 const allocated=[],source={naturalWidth:1024,naturalHeight:512,src:'test.png'},calls=[];
 const createCanvas=()=>{const canvas={width:0,height:0};canvas.getContext=()=>({drawImage:(...args)=>calls.push({target:canvas,args})});allocated.push(canvas);return canvas;};
 const drawCalls=[],ctx={imageSmoothingEnabled:true,getTransform:()=>({a:-1,b:0,c:0,d:1}),drawImage:(...args)=>drawCalls.push(args)};
 return{sampler:createV100ImageSampler({createCanvas,...options}),allocated,source,calls,drawCalls,ctx};
}
test('repeated half-size draws keep exact destination geometry and reuse a cached crop',()=>{
 const f=fixture();f.sampler.draw(f.ctx,f.source,32,16,512,256,-25,-40,64,32);
 assert.deepEqual(f.calls[0].args,[f.source,32,16,512,256,0,0,256,128]);
 assert.deepEqual(f.drawCalls[0].slice(1),[0,0,64,32,-25,-40,64,32]);
 const allocations=f.allocated.length;f.sampler.draw(f.ctx,f.source,32,16,512,256,-30,-45,64,32);
 assert.equal(f.allocated.length,allocations);assert.equal(f.sampler.snapshot().hits,1);
 assert.deepEqual(f.drawCalls[1].slice(5),[-30,-45,64,32]);
 assert.ok(f.allocated.slice(0,-1).every(c=>c.width===0&&c.height===0));
});
test('anisotropic cropping downsamples only the axis that can safely shrink, accounting for DPR',()=>{
 const f=fixture();f.ctx.getTransform=()=>({a:0,b:2,c:-2,d:0});
 f.sampler.draw(f.ctx,f.source,0,0,1024,512,0,0,200,200);
 assert.deepEqual(f.drawCalls[0].slice(1),[0,0,512,512,0,0,200,200]);
});

test('fractional battlefield reduction uses its closest level rather than bypassing filtering',()=>{
 const f=fixture(),plate={naturalWidth:1600,naturalHeight:900,src:'stage.webp'};
 f.sampler.drawBackground(f.ctx,plate,0,-73,960,500);
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].args,[plate,0,0,1600,900,0,0,800,450]);
 assert.deepEqual(f.drawCalls[0].slice(1),[0,0,800,450,0,-73,960,500]);
 assert.equal(f.sampler.snapshot().bytes,800*450*4);
 f.sampler.draw(f.ctx,plate,0,-73,960,500);
 assert.equal(f.drawCalls[1][0],plate,'fighter sampling retains the larger level');
});
test('cache evicts least recently used textures under its byte and entry budget and releases on clear',()=>{
 const f=fixture({maxBytes:8192,maxEntries:1});f.sampler.draw(f.ctx,f.source,0,0,64,32);const first=f.drawCalls[0][0];
 f.sampler.draw(f.ctx,{...f.source,src:'second.png'},0,0,64,32);
 assert.equal(first.width,0);assert.equal(f.sampler.snapshot().evictions,1);assert.equal(f.sampler.snapshot().bytes,8192);
 f.sampler.clear();assert.equal(f.sampler.snapshot().bytes,0);assert.equal(f.sampler.snapshot().entries,0);assert.ok(f.allocated.every(c=>c.width===0));
});
test('unminified, nearest-neighbor and oversized scratch requests use the original source without allocations',()=>{
 const f=fixture({maxWorkingBytes:128});f.sampler.draw(f.ctx,f.source,0,0,2048,1024);f.sampler.draw(f.ctx,f.source,0,0,64,32);
 f.ctx.imageSmoothingEnabled=false;f.sampler.draw(f.ctx,f.source,0,0,64,32);
 assert.equal(f.allocated.length,0);assert.ok(f.drawCalls.every(c=>c[0]===f.source));
});
test('a changed source URL or crop cannot reuse a different image region',()=>{
 const f=fixture();f.sampler.draw(f.ctx,f.source,0,0,512,256,0,0,64,32);const first=f.drawCalls[0][0];
 f.sampler.draw(f.ctx,f.source,512,0,512,256,0,0,64,32);assert.notEqual(f.drawCalls[1][0],first);
 f.source.src='replacement.png';f.sampler.draw(f.ctx,f.source,0,0,512,256,0,0,64,32);assert.notEqual(f.drawCalls[2][0],first);
});
test('failure at any half-size step releases both the current and previous working canvas before fallback',()=>{
 for(const failingStep of [1,2]){
  const canvases=[];let draws=0;
  const f=fixture({createCanvas:()=>{const c={width:0,height:0,getContext:()=>({drawImage:()=>{if(++draws===failingStep)throw Error('simulated allocation/draw failure');}})};canvases.push(c);return c;}});
  f.sampler.draw(f.ctx,f.source,0,0,64,32);
  assert.equal(f.drawCalls.length,1);assert.equal(f.drawCalls[0][0],f.source);
  assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.equal(f.sampler.snapshot().bytes,0);
 }
});
