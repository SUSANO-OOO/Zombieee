import test from 'node:test';
import assert from 'node:assert/strict';
import {PWA_BROWSER_CHOICE_KEY,readBrowserPlayChoice,rememberBrowserPlayChoice} from '../app/pwaBrowserChoice.js';
import {derivePwaPhase} from '../app/pwaRuntime.js';

test('browser choice persists without touching campaign saves or installed generations',()=>{
 const values=new Map([['nishijin-campaign-v100','existing progress'],['installedManifest','existing generation']]);
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 assert.equal(readBrowserPlayChoice(storage),false);assert.equal(rememberBrowserPlayChoice(storage),true);
 assert.equal(readBrowserPlayChoice(storage),true);
 assert.deepEqual([...values],[['nishijin-campaign-v100','existing progress'],['installedManifest','existing generation'],[PWA_BROWSER_CHOICE_KEY,'browser']]);
});

test('missing, unknown, inaccessible or nonpersistent preference storage remains optional',()=>{
 for(const storage of [{getItem:()=>null},{getItem:()=> 'unknown'},{getItem:()=>{throw Error('denied');}},{getItem:()=>null,setItem:()=>{throw Error('quota');}},{getItem:()=>null,setItem:()=>{}}]){
  assert.equal(readBrowserPlayChoice(storage),false);assert.equal(rememberBrowserPlayChoice(storage),false);
 }
});

test('remembering browser play cannot bypass interrupted downloads, commit recovery or home-screen installation',()=>{
 const base={supported:true,standalone:false,offerDismissed:true};
 assert.equal(derivePwaPhase(base),'browser');
 assert.equal(derivePwaPhase({...base,downloadState:'failed'}),'download-incomplete');
 assert.equal(derivePwaPhase({...base,commitRequired:true}),'commit-required');
 assert.equal(derivePwaPhase({...base,standalone:true}),'install-required');
});
