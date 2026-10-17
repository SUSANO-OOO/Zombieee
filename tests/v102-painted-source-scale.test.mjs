import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {spriteKinds,spriteFrameFor} from '../app/spriteManifest.js';
import {v100HumanWalkFrame} from '../app/v100HumanWalk.js';
import {v102BattleDisplaySize} from '../app/v102BattleScale.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {renderedSourcePixelScale} from '../scripts/v102-render-source-scale.mjs';

const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let drawFrame,liveFields,corpseFields;
function fields(object){
 const names=['sourceRect','sourceRow','renderWidth','renderHeight'];
 return '{'+object.properties.filter(p=>names.includes(p.name?.getText(ast))).map(p=>p.getText(ast)).join(',')+'}';
}
function visit(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='frame'&&node.initializer?.getText(ast).startsWith('articulatedWalk || jointPose'))drawFrame=node.initializer.getText(ast);
 if(ts.isCallExpression(node)&&node.expression.getText(ast)==='recordFighterRenderAudit'&&ts.isObjectLiteralExpression(node.arguments[1])&&node.arguments[1].getText(ast).includes('jointAtlasPath:'))liveFields=fields(node.arguments[1]);
 if(ts.isCallExpression(node)&&node.expression.getText(ast)==='recordCorpseRenderAudit'&&ts.isObjectLiteralExpression(node.arguments[1]))corpseFields=fields(node.arguments[1]);
 ts.forEachChild(node,visit);
}visit(ast);
assert.ok(drawFrame&&liveFields&&corpseFields);
function paint(kind,state,direction,joint){
 const globals={renderKind:kind,state,direction,articulatedWalk:false,jointPose:joint?{}:null,tataraGroundCandidate:false,kumaGuardArtPose:null,spriteFrameFor,v100HumanWalkFrame,v102BattleDisplaySize,maximum:{w:160,h:180}};
 const body=`(()=>{const frame=${drawFrame};const size=v102BattleDisplaySize(renderKind,frame,maximum);return {frame,receipt:${liveFields}};})()`;
 return vm.runInNewContext(body,globals);
}

test('actual living and corpse paint receipts measure all 48 forms and both facings using the frame that was drawn',()=>{
 let count=0;
 for(const kind of spriteKinds){
  const scale=v102BattleDisplaySize(kind,spriteFrameFor(kind,'idle','right'),{w:160,h:180}).h/spriteFrameFor(kind,'idle','right').sourceRect.h;
  for(const direction of ['left','right'])for(const state of ['idle','walk-a','attack-a','attack-b','hit'])for(const joint of V177_JOINT_ATLASES[kind]&&state!=='hit'?[false,true]:[false]){
   const {frame,receipt}=paint(kind,state,direction,joint);
   assert.notEqual(receipt.sourceRect,frame.sourceRect,'Receipt captures a crop snapshot');
   assert.equal(receipt.sourceRect.w,frame.sourceRect.w);assert.equal(receipt.sourceRect.h,frame.sourceRect.h);
   assert.ok(Math.abs(renderedSourcePixelScale(receipt)-scale)<1e-8,kind+'/'+state+'/'+direction);count++;
  }
  const frame=spriteFrameFor(kind,'death','left'),size=v102BattleDisplaySize(kind,frame,{w:160,h:180});
  const dead=vm.runInNewContext('('+corpseFields+')',{frame,width:size.w,height:size.h});
  assert.ok(Math.abs(renderedSourcePixelScale(dead)-scale)<1e-8,kind+' defeat');
 }
 assert.ok(count>=480);
});

test('split Futago exposes the old logical-pose denominator; missing crops, stretched paint and real growth still fail strict checks',()=>{
 const states=['idle','walk-a','attack-a','attack-b','hit'];
 const samples=states.map(state=>paint('futago-separated-a',state,'left',state!=='hit'));
 const scale=renderedSourcePixelScale(samples[0].receipt);
 assert.ok(samples.every(s=>Math.abs(renderedSourcePixelScale(s.receipt)-scale)<1e-8));
 const old=samples.map((s,i)=>s.receipt.renderHeight/spriteFrameFor('futago-separated-a',states[i],'left').sourceRect.h);
 assert.ok(old.some(s=>Math.abs(s-old[0])>=1e-8),'Fixture reproduces the native failure');
 assert.throws(()=>renderedSourcePixelScale({...samples[0].receipt,sourceRect:null}),/Actual painted source/);
 assert.throws(()=>renderedSourcePixelScale({...samples[0].receipt,renderWidth:samples[0].receipt.renderWidth*1.01}),/equal horizontal/);
 const grown={...samples[0].receipt,renderWidth:samples[0].receipt.renderWidth*1.01,renderHeight:samples[0].receipt.renderHeight*1.01};
 assert.ok(Math.abs(renderedSourcePixelScale(grown)-scale)>=1e-8,'Real uniform growth remains rejected by the unchanged cross-action gate');
});
