import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readNativeBattleControl,nativeBattleTap} from '../scripts/v100-normal-tactical-input.mjs';

function browserRead({clockAvailable=true,covered=false}={}){
 let clock=1000;const calls=[];
 const element={disabled:false,dataset:{fighterId:'2',abilityKind:'guardian'},getAttribute:key=>key==='aria-label'?'ガンテツ：鉄壁展開':null,matches:()=>false,getBoundingClientRect:()=>{calls.push('geometry');clock+=180;return{x:10,y:20,width:60,height:30};}};
 const context={elements:[element],document:{elementFromPoint:()=>{calls.push('hit-test');clock+=35;return{closest:()=>covered?{}:element};}}};if(clockAvailable)context.performance={now:()=>clock};
 const state=vm.runInNewContext('('+readNativeBattleControl.toString()+')(elements)',context);return{state,calls};
}
test('one actual browser control read separates geometry and hit testing without another RPC',()=>{
 const {state,calls}=browserRead();assert.deepEqual(calls,['geometry','hit-test']);
 assert.deepEqual(JSON.parse(JSON.stringify(state.browserReadTimings)),{geometryMs:180,hitTestMs:35,totalMs:215});
 assert.equal(state.point.x,40);assert.equal(state.point.y,35);assert.equal(state.fighterId,'2');assert.equal(state.abilityKind,'guardian');
});
test('missing timing capability and an occluded control preserve the original eligibility checks',()=>{
 const noClock=browserRead({clockAvailable:false});assert.equal(noClock.state.browserReadTimings,null);assert.equal(noClock.state.point.x,40);
 const blocked=browserRead({covered:true});assert.equal(blocked.state.point,null);assert.equal(blocked.state.browserReadTimings.totalMs,215);
});
test('the native operation retains one observation and ordered move/down/up with its timing receipt',async()=>{
 const calls=[],phases=[],state=browserRead().state,locator={evaluateAll:async reader=>{assert.equal(reader,readNativeBattleControl);calls.push('observe');return state;}},page={mouse:Object.fromEntries(['move','down','up'].map(key=>[key,async()=>calls.push(key)]))};
 assert.equal(await nativeBattleTap(page,locator,phases),true);assert.deepEqual(calls,['observe','move','down','up']);assert.equal(phases[0].observation.browserReadTimings.totalMs,215);assert.ok(phases.every(p=>p.status==='completed'));
});
