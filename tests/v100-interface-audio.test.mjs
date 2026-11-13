import test from 'node:test';
import assert from 'node:assert/strict';
import {emitV100InterfaceOperation,subscribeV100InterfaceOperations,emitV100PwaControlSound} from '../app/v100InterfaceAudio.js';
const target=()=>Object.assign(new EventTarget(),{CustomEvent});
const click=(control,extra={})=>({target:{closest:selector=>{assert.equal(selector,'button,summary,a[href]');return control;}},defaultPrevented:false,...extra});
const control=(role,extra={})=>({disabled:false,dataset:role?{uiSound:role}:{},getAttribute:()=>null,...extra});

test('a PWA operation reaches one existing listener and leaves no listener after disposal',()=>{
 const window=target(),roles=[];assert.equal(emitV100InterfaceOperation(window,'cancel'),true);
 const detach=subscribeV100InterfaceOperations(window,role=>roles.push(role));
 emitV100InterfaceOperation(window,'cancel');assert.deepEqual(roles,['cancel']);
 detach();emitV100InterfaceOperation(window,'navigate');assert.deepEqual(roles,['cancel']);
});
test('disabled, prevented, absent and unknown controls cannot emit feedback',()=>{
 const window=target(),roles=[];const detach=subscribeV100InterfaceOperations(window,role=>roles.push(role));
 for(const e of [click(null),click(control('cancel',{disabled:true})),click(control('cancel',{getAttribute:()=> 'true'})),click(control('cancel'),{defaultPrevented:true}),click(control('unrecognized'))])assert.equal(emitV100PwaControlSound(e,window),false);
 assert.equal(emitV100InterfaceOperation(window,'transaction'),false);assert.deepEqual(roles,[]);detach();
});
test('cancel, navigation summaries and accepted transaction gestures retain distinct meanings',()=>{
 const window=target(),roles=[];const detach=subscribeV100InterfaceOperations(window,role=>roles.push(role));
 for(const role of ['cancel',undefined,'transaction'])assert.equal(emitV100PwaControlSound(click(control(role)),window),true);
 assert.deepEqual(roles,['cancel','navigate','navigate'],'a gesture never claims a transaction succeeded');detach();
});
test('a missing owner does not allocate sound and an optional rejected callback cannot break a control',async()=>{
 assert.equal(emitV100InterfaceOperation(null,'navigate'),false);assert.equal(emitV100InterfaceOperation({},'navigate'),false);
 const window=target(),detach=subscribeV100InterfaceOperations(window,async()=>{throw Error('closed owner');});
 assert.equal(emitV100InterfaceOperation(window,'cancel'),true);await new Promise(resolve=>setImmediate(resolve));detach();
});
