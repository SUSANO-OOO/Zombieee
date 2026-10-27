import assert from 'node:assert/strict';
import {assertValidationResults} from './ci-change-scope.mjs';
const results=JSON.parse(process.env.VALIDATION_RESULTS??'null');
assert.equal(results?.scope?.result,'success',
  'Validation Scope did not succeed; no qualified plan is available. Inspect the original Validation Scope job failure.');
assert.ok(process.env.VALIDATION_PLAN?.trim(),
  'Validation Scope succeeded without producing a validation plan.');
const plan=JSON.parse(process.env.VALIDATION_PLAN);
assertValidationResults(plan,results);
console.log('Required validation succeeded; outside and reused lanes retain their distinct states.');
