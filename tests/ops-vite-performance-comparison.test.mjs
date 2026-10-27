import test from 'node:test';import assert from 'node:assert/strict';
import {comparisonPlan} from '../scripts/ops-vite-performance-comparison.mjs';
const base='a'.repeat(40),candidate='b'.repeat(40),paths=['package.json','package-lock.json'];
test('comparison fixes ABBA order over two builds and the exact dependency versions',()=>{
  const plan=comparisonPlan(base,candidate,paths);assert.equal(plan.map(r=>r.label).join(''),'ABBA');
  assert.deepEqual(plan.map(r=>r.vite),['8.0.13','8.1.6','8.1.6','8.0.13']);assert.equal(new Set(plan.map(r=>r.head)).size,2);
});
test('product, harness or unknown changes and invalid refs cannot enter dependency comparison',()=>{
  for(const changed of [[],['package.json'],[...paths,'app/AshfallGame.tsx'],[...paths,'scripts/v100-device-runtime-browser.mjs']])assert.throws(()=>comparisonPlan(base,candidate,changed));
  assert.throws(()=>comparisonPlan(base,base,paths));assert.throws(()=>comparisonPlan('main',candidate,paths));
});
