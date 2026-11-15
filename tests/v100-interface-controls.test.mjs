import test from 'node:test';
import assert from 'node:assert/strict';
import {v100InterfaceControlFor} from '../app/v100InterfaceAudio.js';
const control=(tag='BUTTON',values={})=>({tagName:tag,dataset:{},disabled:false,getAttribute:()=>null,matches:()=>false,closest:()=>null,...values});
const event=target=>({defaultPrevented:false,target:{closest:()=>target}});

test('existing button actions retain navigation, story advance and transaction ownership',()=>{
 assert.equal(v100InterfaceControlFor(event(control())).role,'navigate');
 assert.equal(v100InterfaceControlFor(event(control('BUTTON',{closest:()=>({})}))).role,'advance');
 for(const role of ['transaction','confirm','cancel','reject'])assert.equal(v100InterfaceControlFor(event(control('BUTTON',{dataset:{uiSound:role}}))).role,role);
});
test('form controls get navigation feedback without changing their value',()=>{
 for(const field of [control('INPUT',{type:'checkbox',checked:false}),control('INPUT',{type:'range',value:'40'}),control('INPUT',{type:'file'}),control('SELECT',{value:'high'}),control('A')]){
  const before={...field};assert.equal(v100InterfaceControlFor(event(field)).role,'navigate');assert.deepEqual(field,before);
 }
});
test('opening and closing a disclosure get distinct roles',()=>{
 assert.equal(v100InterfaceControlFor(event(control('SUMMARY',{parentElement:{open:false}}))).role,'navigate');
 assert.equal(v100InterfaceControlFor(event(control('SUMMARY',{parentElement:{open:true}}))).role,'cancel');
});
test('disabled fields, inherited fieldset disabling, hidden data and blocked events stay silent',()=>{
 for(const value of [control('BUTTON',{disabled:true}),control('INPUT',{matches:()=>true}),control('INPUT',{type:'hidden'}),control('SELECT',{getAttribute:()=> 'true'})])assert.equal(v100InterfaceControlFor(event(value)),null);
 assert.equal(v100InterfaceControlFor({...event(control()),defaultPrevented:true}),null);
 assert.equal(v100InterfaceControlFor({target:{}}),null);assert.equal(v100InterfaceControlFor(null),null);
});
test('a label touch is resolved once through its dispatched input click',()=>{
 const labelEvent={target:{closest:()=>null}},inputEvent=event(control('INPUT',{type:'checkbox'}));
 assert.deepEqual([labelEvent,inputEvent].map(v100InterfaceControlFor).filter(Boolean).map(value=>value.role),['navigate']);
});

test('touch-native range and select controls use pointer feedback without a later click duplicate',()=>{
 for(const field of [control('INPUT',{type:'range',value:'40'}),control('SELECT',{value:'high'})]){
  assert.equal(v100InterfaceControlFor({...event(field),type:'pointerdown'}).role,'navigate');
  assert.equal(v100InterfaceControlFor({...event(field),type:'keydown'}).role,'navigate');
  assert.equal(v100InterfaceControlFor({...event(field),type:'click'}),null);
 }
 assert.equal(v100InterfaceControlFor({...event(control('INPUT',{type:'checkbox'})),type:'click'}).role,'navigate');
});
