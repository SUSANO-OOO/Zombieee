import test from 'node:test';
import assert from 'node:assert/strict';
import {recordQualityFailureScreenshot} from '../scripts/v100-quality-failure-screenshot.mjs';

test('failed-case screenshot retains its original call and verified bytes',async()=>{
  const row={status:'failed',error:'original title timeout',captures:[]},calls=[];
  const result=await recordQualityFailureScreenshot(row,{screenshot:async options=>calls.push(options)},'/evidence/title-failure.png',{readFile:async file=>{assert.equal(file,'/evidence/title-failure.png');return Buffer.from('abc');}});
  assert.deepEqual(calls,[{path:'/evidence/title-failure.png'}]);
  assert.deepEqual(result,{file:'title-failure.png',status:'captured',bytes:3,sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
  assert.equal(row.status,'failed');assert.equal(row.error,'original title timeout');assert.deepEqual(row.captures,[]);
});
test('a screenshot timeout is recorded without reading a nonexistent image',async()=>{
  const row={status:'failed',error:'primary timeout'};let attempts=0,reads=0;
  const result=await recordQualityFailureScreenshot(row,{screenshot:async()=>{attempts++;throw new Error('Screenshot timed out waiting for fonts');}},'/evidence/title-failure.png',{readFile:async()=>{reads++;throw new Error('must not read');}});
  assert.equal(attempts,1);assert.equal(reads,0);assert.deepEqual(result,{file:'title-failure.png',status:'unavailable',error:'Error: Screenshot timed out waiting for fonts'});
  assert.equal(row.error,'primary timeout');assert.equal(row.status,'failed');
});
test('an unreadable captured image is never reported as verified',async()=>{
  const row={status:'failed',error:'original failure'};
  const result=await recordQualityFailureScreenshot(row,{screenshot:async()=>{}},'/evidence/failure.png',{readFile:async()=>{throw new Error('read failed');}});
  assert.deepEqual(result,{file:'failure.png',status:'unverified',error:'Error: read failed'});assert.equal(Object.hasOwn(result,'sha256'),false);
  assert.equal(row.error,'original failure');assert.equal(row.status,'failed');
});
test('closed-page capture preserves all original failure and diagnostic fields',async()=>{
  const row={id:'webkit-title',status:'failed',error:'original title timeout',errors:[{kind:'page',message:'earlier error'}],navigationAborts:[],captures:[{file:'earlier.png'}]},before=structuredClone(row);
  await recordQualityFailureScreenshot(row,{screenshot:async()=>{throw new Error('Target page has been closed');}},'/evidence/failure.png',{readFile:async()=>{throw new Error('must not read');}});
  const {failureScreenshot,...unchanged}=row;assert.deepEqual(unchanged,before);assert.equal(failureScreenshot.status,'unavailable');assert.match(failureScreenshot.error,/Target page has been closed/);
});
