import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedPartialBundleAbort, isCausalPwaIncidentRetry, markPartialBundleCancelIntent } from "../scripts/pwa-expected-abort.mjs";
test("macOS cancellation must match the fixture URL, phase and independently observed server abort", () => {
  const url = "http://127.0.0.1:1234/Zombieee/pwa-bundles/audio-v1.bin";
  const failure = { error: "cancelled", url, phase: "candidate-unqualified-recovery-entry", at: 31_025 };
  const request = { mode: "recovery", aborted: true, startedAt: 1000, durationMs: 30_000 };
  assert.equal(isExpectedPartialBundleAbort(failure, [request], url), true);
  for (const change of [{ url: url.replace("audio-v1.bin", "art.webp") }, { error: "connection reset" },
    { phase: "candidate-relaunch" }, { at: undefined }, { at: 40_000 }]) {
    assert.equal(isExpectedPartialBundleAbort({ ...failure, ...change }, [request], url), false);
  }
  for (const change of [{ aborted: false }, { mode: "incident" }, { durationMs: null }]) {
    assert.equal(isExpectedPartialBundleAbort(failure, [{ ...request, ...change }], url), false);
  }
  assert.equal(isExpectedPartialBundleAbort(failure, [], url), false);
});

test("an extra incident transport must follow the observed 30-second abort, never run in parallel", () => {
  const previous={mode:"incident",index:4,aborted:true,completed:false,startedAt:1000,durationMs:30_050};
  const retry={mode:"incident",index:5,completed:false,startedAt:31_051};
  assert.equal(isCausalPwaIncidentRetry(previous,retry),true);
  for(const change of [{startedAt:1001},{startedAt:31_049},{startedAt:null},{index:6},{completed:true},{mode:"recovery"}])assert.equal(isCausalPwaIncidentRetry(previous,{...retry,...change}),false);
  for(const change of [{aborted:false},{durationMs:29_999},{durationMs:null},{startedAt:null},{index:3},{completed:true}])assert.equal(isCausalPwaIncidentRetry({...previous,...change},retry),false);
  assert.equal(isCausalPwaIncidentRetry(null,retry),false);
  assert.equal(isCausalPwaIncidentRetry(previous,null),false);
});

test("the archived delayed socket close stays unexpected until the new fixture intent is actually present", () => {
  const f=JSON.parse(fs.readFileSync(new URL('./fixtures/pwa-expected-abort/v177-native-872-delayed-close.json',import.meta.url)));
  assert.equal(f.source.intentMarkerWasNotInNativeRecord,true);
  assert.equal(isExpectedPartialBundleAbort(f.failure,[f.request],f.failure.url),false);
  const marked={...f.request,cancelRequestedAt:f.modeledIntentForUnitTest};
  assert.equal(isExpectedPartialBundleAbort(f.failure,[marked],f.failure.url),true);
});

test("recorded fixture intent keeps the same5s window and cannot hide unrelated failures or completed requests", () => {
  const f=JSON.parse(fs.readFileSync(new URL('./fixtures/pwa-expected-abort/v177-native-872-delayed-close.json',import.meta.url)));
  const marked={...f.request,cancelRequestedAt:f.modeledIntentForUnitTest},intent=marked.cancelRequestedAt;
  for(const change of [{at:intent-1},{at:intent+5000},{url:f.failure.url+'/other'},{error:'connection reset'},{phase:'candidate-relaunch'}]) {
    assert.equal(isExpectedPartialBundleAbort({...f.failure,...change},[marked],f.failure.url),false);
  }
  for(const change of [{cancelRequestedAt:NaN},{cancelRequestedAt:marked.startedAt-1},
    {cancelRequestedAt:marked.startedAt+marked.durationMs+1},{aborted:false},{completed:true},{index:3},{mode:'recovery'},{durationMs:null}]) {
    assert.equal(isExpectedPartialBundleAbort(f.failure,[{...marked,...change}],f.failure.url),false);
  }
});

test("only one still-held synthetic incident request can own a cancellation marker", () => {
  const held=()=>({mode:'incident',index:4,completed:false,aborted:false,startedAt:1000,durationMs:null});
  const request=held();markPartialBundleCancelIntent([request],2000);assert.equal(request.cancelRequestedAt,2000);
  assert.throws(()=>markPartialBundleCancelIntent([request],2001),/exactly one/);
  for(const requests of [[],[held(),{...held(),index:5}],[{...held(),completed:true}],
    [{...held(),aborted:true}],[{...held(),index:3}],[{...held(),mode:'recovery'}]]) {
    assert.throws(()=>markPartialBundleCancelIntent(requests,2000),/exactly one/);
  }
  assert.throws(()=>markPartialBundleCancelIntent([held()],999),/exactly one/);
  assert.throws(()=>markPartialBundleCancelIntent([held()],NaN),/finite/);
});

test("the actual PWA driver records intent before its click can synchronously emit WebKit cancellation", async () => {
  const source=fs.readFileSync(new URL('../scripts/pwa-partial-failed-update-browser-smoke.mjs',import.meta.url),'utf8');
  const tree=ts.createSourceFile('partial.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),calls=[];
  function visit(node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='markPartialBundleCancelIntent')calls.push(node);ts.forEachChild(node,visit);}
  visit(tree);assert.equal(calls.length,1);
  const statement=calls[0].parent,block=statement.parent,index=block.statements.indexOf(statement);
  const statements=block.statements.slice(index,index+2).map(node=>node.getText(tree)).join('\n');
  const f=JSON.parse(fs.readFileSync(new URL('./fixtures/pwa-expected-abort/v177-native-872-delayed-close.json',import.meta.url)));
  const request={...f.request,aborted:false,durationMs:null};let clicked=false;
  const page={getByRole(role,options){assert.equal(role,'button');assert.equal(options.name,'中断');return{async click(){
    assert.equal(request.cancelRequestedAt,f.modeledIntentForUnitTest);
    request.aborted=true;request.durationMs=f.request.durationMs;clicked=true;
    assert.equal(isExpectedPartialBundleAbort(f.failure,[request],f.failure.url),true);
  }};}};
  await vm.runInNewContext('(async()=>{'+statements+'})()',{
    markPartialBundleCancelIntent,audioRequests:[request],Date:{now:()=>f.modeledIntentForUnitTest},page,
  });
  assert.equal(clicked,true);
});
