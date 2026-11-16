import test from "node:test";
import assert from "node:assert/strict";
import { candidateDownloadProgressWindow, matchesCandidateDownloadProgress } from "../scripts/pwa-partial-progress-window.mjs";

const plan = ["a","b","c"].map((hash) => ({path:"/"+hash,hash}));
test("an untouched candidate requires every planned logical target", () => {
  assert.deepEqual(candidateDownloadProgressWindow(plan,new Set()),{minimum:3,maximum:3});
});
test("action-time cached content narrows the pending boundary without changing the full-plan ceiling", () => {
  const before=candidateDownloadProgressWindow(plan,new Set(["a"]));
  const atAction=candidateDownloadProgressWindow(plan,new Set(["a","b"]));
  assert.equal(before.minimum,2);
  assert.deepEqual(atAction,{minimum:1,maximum:3});
  for(const n of [1,2,3])assert.equal(matchesCandidateDownloadProgress(n,atAction),true);
  for(const n of [0,4])assert.equal(matchesCandidateDownloadProgress(n,atAction),false);
});
test("unrelated cached hashes cannot excuse an omitted candidate target", () => {
  const window=candidateDownloadProgressWindow(plan,new Set(["foreign","old-only"]));
  assert.equal(matchesCandidateDownloadProgress(2,window),false);
  assert.equal(matchesCandidateDownloadProgress(3,window),true);
});
test("shared content hashes satisfy logical aliases without adding transport targets", () => {
  assert.deepEqual(candidateDownloadProgressWindow([{hash:"shared"},{hash:"shared"},{hash:"new"}],new Set(["shared"])),{minimum:1,maximum:3});
});
test("non-integer, negative and non-finite progress cannot pass", () => {
  const window=candidateDownloadProgressWindow(plan,new Set(["a","b"]));
  for(const n of [-1,1.5,NaN,Infinity,"2"])assert.equal(matchesCandidateDownloadProgress(n,window),false);
});
test("missing plans or invalid content identities fail rather than becoming a permissive window", () => {
  assert.throws(()=>candidateDownloadProgressWindow(undefined,new Set()),TypeError);
  assert.throws(()=>candidateDownloadProgressWindow(plan,[]),TypeError);
  assert.throws(()=>candidateDownloadProgressWindow([{}],new Set()),TypeError);
});
