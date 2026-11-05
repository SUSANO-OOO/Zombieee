import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {evaluateActivationSafety,SAFE_ACTIVATION_SCREENS} from '../app/pwaUpdatePlanner.js';

// Execute the actual JSX guards so a missing gate on any one notice fails,
// including update notices that need an installed pack in browser tests.
const source=fs.readFileSync('app/PwaGate.tsx','utf8');
const tree=ts.createSourceFile('PwaGate.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const guards=[];
function visit(node){
 if(ts.isJsxExpression(node)&&node.expression&&ts.isBinaryExpression(node.expression)){
  const expression=node.expression;
  if(expression.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&/^\(\s*<aside className="pwa-notice(?: |")/u.test(expression.right.getText(tree)))guards.push(expression.left.getText(tree));
 }
 ts.forEachChild(node,visit);
}
visit(tree);
function visible(changes,safety){
 const values={blocking:false,registrationFailed:true,phase:'update-available',updateCopy:{},updateDismissed:false,installPlan:{},repairDismissed:false,...changes,activation:evaluateActivationSafety(safety)};
 return guards.filter(guard=>vm.runInNewContext(guard,values)).length;
}
test('pending registration, repair and update notices wait through active play and saving',()=>{
 assert.equal(guards.length,3);
 const unsafe=[...['event','battle','result','survival','unknown'].map(screen=>({screen})),
  ...['battleActive','resultSaving','saveMutationPending','downloadActive'].map(key=>({screen:'map',[key]:true}))];
 for(const phase of ['update-available','repair-required'])for(const safety of unsafe)assert.equal(visible({phase},safety),0,JSON.stringify({phase,safety}));
});
test('pending notices return on every safe screen and still honor explicit dismissal and blocking gates',()=>{
 for(const screen of SAFE_ACTIVATION_SCREENS){
  for(const phase of ['update-available','repair-required'])assert.equal(visible({phase},{screen}),2,phase+' on '+screen);
  assert.equal(visible({blocking:true},{screen}),0);
  assert.equal(visible({registrationFailed:false,updateDismissed:true},{screen}),0);
  assert.equal(visible({phase:'repair-required',registrationFailed:false,repairDismissed:true},{screen}),0);
 }
});
