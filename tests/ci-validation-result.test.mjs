import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ciChangeScope,validationPlan,LANE_JOBS,JOB_LANES} from '../scripts/ci-change-scope.mjs';

const fingerprints=Object.fromEntries(Object.keys(LANE_JOBS).map(key=>[key,'1'.repeat(64)]));
const plan=validationPlan(ciChangeScope(['README.md']),{head:'a'.repeat(40),base:'b'.repeat(40),merge:'c'.repeat(40),fingerprints});
const needs={...Object.fromEntries(Object.keys(JOB_LANES).map(key=>[key,{result:'skipped'}])),scope:{result:'success'},verify:{result:'success'}};
const run=(scope,planText=JSON.stringify(plan),patch={})=>spawnSync(process.execPath,
  [fileURLToPath(new URL('../scripts/ci-validation-result.mjs',import.meta.url))],
  {encoding:'utf8',windowsHide:true,env:{...process.env,VALIDATION_PLAN:planText,
    VALIDATION_RESULTS:JSON.stringify({...needs,...patch,scope:{result:scope}})}});

test('a successful scope keeps the existing required-results gate',()=>{
  const success=run('success');assert.equal(success.status,0,success.stderr);assert.match(success.stdout,/Required validation succeeded/u);
  const bad=run('success',JSON.stringify(plan),{verify:{result:'failure'}});
  assert.notEqual(bad.status,0);assert.match(bad.stderr,/Build, tests and current provenance must succeed/u);
});
test('failed, cancelled, skipped or absent scope reports its primary failure before parsing an empty or forged plan',()=>{
  for(const scope of ['failure','cancelled','skipped',undefined])for(const text of ['',JSON.stringify(plan)]){
    const result=run(scope,text);assert.notEqual(result.status,0);
    assert.match(result.stderr,/Validation Scope did not succeed/u);assert.doesNotMatch(result.stderr,/Unexpected end of JSON input/u);
    assert.doesNotMatch(result.stdout,/Required validation succeeded/u);
  }
});
test('a green scope with missing or malformed output still fails closed',()=>{
  for(const text of ['','not-json','null']){
    const result=run('success',text);assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout,/Required validation succeeded/u);
  }
});
