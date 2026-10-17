import assert from 'node:assert/strict';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {staffRollFilmBuffersReady} from '../scripts/v100-staff-roll-audit.mjs';

function image({src='/art/v100/credits/street-shutter-r2.webp',complete=true,width=1920,decoded=true}={}){
 return {getAttribute:name=>name==='src'?src:null,complete,naturalWidth:width,dataset:{creditDecoded:String(decoded)}};
}
function ready(images){return runInNewContext('('+staffRollFilmBuffersReady.toString()+')()',{document:{querySelector:()=>images===null?null:{querySelectorAll:()=>images}}});}
test('staff-roll seek waits for the hidden preload as well as the displayed shot',()=>{
 const current=image(),hidden=image({complete:false,width:0,decoded:false});
 assert.equal(ready([current,hidden]),false,'The first visible cut does not make its pending next cut safe to replace');
 hidden.complete=true;hidden.naturalWidth=1920;
 assert.equal(ready([current,hidden]),false,'HTTP completion alone does not prove decode completion');
 hidden.dataset.creditDecoded='true';
 assert.equal(ready([current,hidden]),true,'Only decoded buffers permit the fixture to seek');
});
test('staff-roll seek fails closed for missing, empty or failed buffers',()=>{
 for(const images of [null,[],[image()],[image(),image(),image()],[image(),image({src:''})],[image(),image({width:0})],[image({decoded:false}),image()]]){
  assert.equal(ready(images),false);
 }
});
