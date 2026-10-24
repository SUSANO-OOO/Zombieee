import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeAllUnitBattle} from '../scripts/v177-native-allunit-browser.mjs';

test('title/battle entry and original asset decode both finish before setup returns',async()=>{
 const calls=[],owner={cleanup:'open'};let hook,decoded;
 const hookReady=new Promise(resolve=>{hook=resolve;}),decodeReady=new Promise(resolve=>{decoded=resolve;});
 const page={waitForFunction:async()=>{calls.push('wait-original-bridge');await hookReady;},
  evaluate:async(_fn,form)=>{calls.push('decode-'+form);await decodeReady;}};
 await prepareNativeAllUnitBattle(page,['turned','guardian'],owner,async()=>{
  calls.push('real-title-entry');hook();await Promise.resolve();await Promise.resolve();
  calls.push('real-battle-entry');decoded();
 });
 assert.ok(calls.indexOf('real-title-entry')<calls.indexOf('decode-turned'));
 assert.deepEqual(calls.filter(c=>c.startsWith('decode-')),['decode-turned','decode-guardian']);
 assert.equal(owner.assetReadiness.length,2);assert.ok(owner.assetReadiness.every(r=>r.status==='completed'));
});

test('either original setup failure still rejects and a closed owner cannot receive a completed asset',async()=>{
 const failure=Error('original title entry failed'),owner={cleanup:'open'};
 const page={waitForFunction:async()=>{},evaluate:async()=>{}};
 await assert.rejects(prepareNativeAllUnitBattle(page,['guardian'],owner,async()=>{throw failure;}),e=>e===failure);
 const assetFailure=Error('original asset decode failed');
 await assert.rejects(prepareNativeAllUnitBattle({waitForFunction:async()=>{},evaluate:async()=>{throw assetFailure;}},
  ['guardian'],{cleanup:'open'},async()=>{}),e=>e===assetFailure);
 const closed={cleanup:'pending'};let evaluated=false;
 await assert.rejects(prepareNativeAllUnitBattle({waitForFunction:async()=>{},evaluate:async()=>{evaluated=true;}},['guardian'],closed,async()=>{}),/owner is closed/u);
 assert.equal(evaluated,false);assert.equal(closed.assetReadiness[0].status,'failed');
});
