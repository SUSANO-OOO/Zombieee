import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source=await readFile('scripts/v100-r9-full-story-browser.mjs','utf8');
const parsed=ts.createSourceFile('r9.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const reader=parsed.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='readR9FailureState');
assert.ok(reader);
function read(audio,{empty=false}={}){
 const event={getAttribute:key=>({'data-v100-event-id':'v100:event:s03:pre','data-v100-node-index':'14'})[key],querySelectorAll:()=>[]};
 const shell={getAttribute:()=> 'event',querySelector:()=>event};
 return vm.runInNewContext(reader.getText(parsed)+'\nreadR9FailureState()',{
  document:{querySelector:()=>empty?null:shell},window:audio?{__V100_EVENT_AUDIO_QA__:{getSnapshot:()=>audio}}:{},
 });
}
test('failure evidence identifies the visible page and bounds audio state without copying unknown payloads',()=>{
 const result=read({desired:{sceneId:'scene',nodeIndex:14,secret:'do-not-copy'},active:{sceneId:'old'},sceneState:{sceneId:'scene',bgmAssetId:'bgm',ambienceAssetIds:Array(30).fill('ambience')},
  diagnostics:{contextState:'running',payload:{secret:'do-not-copy'}},receipts:Array.from({length:100},(_,nodeIndex)=>({action:'cue-started',nodeIndex,cueId:'x'.repeat(500),payload:{secret:'do-not-copy'}}))});
 assert.equal(result.eventId,'v100:event:s03:pre');assert.equal(result.nodeIndex,'14');
 assert.equal(result.audio.desired.nodeIndex,14);assert.equal(result.audio.active.sceneId,'old');assert.equal(result.audio.diagnostics.contextState,'running');
 assert.equal(result.audio.receipts.length,32);assert.equal(result.audio.receipts[0].nodeIndex,68);assert.equal(result.audio.receipts[0].cueId.length,200);
 assert.equal(result.audio.sceneState.ambienceAssetIds.length,12);assert.equal(JSON.stringify(result).includes('do-not-copy'),false);
});
test('a missing page or audio API is recorded without creating a new primary error',()=>{
 const result=read(null,{empty:true});assert.equal(result.phase,null);assert.equal(result.eventId,null);assert.equal(result.nodeIndex,null);
 assert.equal(result.audio.receipts.length,0);assert.equal(result.images.length,0);
});
test('the diagnostic reader stays failure-only and leaves the original case wait in place',()=>{
 assert.equal((source.match(/page\.evaluate\(readR9FailureState\)/g)??[]).length,1);
 assert.ok(source.indexOf('page.evaluate(readR9FailureState)')>source.indexOf("row.status='failed';row.error=String(error)"));
 assert.ok(source.includes('page.setDefaultTimeout(15000)'));
 assert.ok(source.includes("setTimeout(()=>reject(new Error('failure-state-read-deadline-2000ms')),2000)"));
 assert.ok(source.includes('finally{clearTimeout(failureReadTimer);}'));
});
