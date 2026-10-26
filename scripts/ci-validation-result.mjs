import {assertValidationResults} from './ci-change-scope.mjs';
const plan=JSON.parse(process.env.VALIDATION_PLAN??'null');
const results=JSON.parse(process.env.VALIDATION_RESULTS??'null');
assertValidationResults(plan,results);
console.log('Required validation succeeded; outside and reused lanes retain their distinct states.');
