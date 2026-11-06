import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {deviceObjectiveDestination,deviceObjectiveMayEngage} from '../app/deviceObjectiveAi.js';
import {stationSpatialSnapshot} from '../app/stationSpatialMechanics.js';
import {createStationMissionRuntime,currentPowerNode,STATION_MISSION_TYPES} from '../app/stationStageMechanics.js';
import {createBattleDefinition} from '../app/battleDefinitions.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {UNIT_CONTENT} from '../app/content/unitCatalog.js';
import {createAttackTransaction,normalAttackReach} from '../app/combatLifecycle.js';
import {decideAllyIntent} from '../app/allyAi.js';
const source=fs.readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let consumer,claimConsumer;
function visit(n){
 if(ts.isIfStatement(n)&&n.expression.getText(ast)==='stationObjective && allyIntent.reason !== "crawler-under-attack"')consumer=n.getText(ast);
 if(ts.isExpressionStatement(n)&&n.getText(ast).startsWith('target = tacticalEnemies.find(')){
  const statements=n.parent.statements,index=statements.indexOf(n);claimConsumer=statements.slice(index,index+4).map(s=>s.getText(ast)).join('\n');
 }
 ts.forEachChild(n,visit);
}visit(ast);
assert.ok(consumer,'exercise the actual station objective override');
const code=ts.transpileModule(consumer,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
assert.ok(claimConsumer?.includes('f.crawlerDefenseTargetId ='));
const claimCode=ts.transpileModule(claimConsumer,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const definition=createBattleDefinition(V100_STAGE_IDS[8],{v100:true});
const mission=createStationMissionRuntime(definition.missionType,definition.missionConfig),node=currentPowerNode(mission,definition.missionConfig);
const nodeY=286;
function fixture({offsetX=100,offsetY=0,enemyOffset=120,kind='medic',reason}={}){
 const f={...UNIT_CONTENT.find(u=>u.kind===kind),id:1,kind,side:'human',combatReady:true,gateEntering:false,x:node.x+offsetX,y:nodeY+offsetY,lane:node.lane,anchorLane:node.lane};
 const guard={...f,id:2,kind:kind==='medic'?'scout':'medic',x:node.x+25,y:nodeY+160,lane:(node.lane+2)%3};
 const enemy={id:3,side:'zombie',kind:'spitter',hp:85,x:node.x+enemyOffset,y:nodeY,lane:node.lane,bodyRadius:16};
 const stationObjective=deviceObjectiveDestination({unit:f,humans:[f,guard],node,maxX:870,nodeY});
 const context={g:{definition},f,stationObjective,allyProfile:{defenseLeash:220},fighterById:new Map([[3,enemy]]),STATION_MISSION_TYPES,deviceObjectiveMayEngage,
  allyIntent:{...decideAllyIntent({missionType:definition.missionType,unit:f,enemies:[enemy]}),...(reason?{reason}:{})},
  escortMayPursueTarget:()=>{throw Error('device case must not enter escort policy');}};
 return {context,f,guard,enemy,stationObjective};
}
test('the actual device override releases an out-of-area operator from an unrelated in-range enemy',()=>{
 const {context,f,enemy,stationObjective}=fixture();
 assert.equal(deviceObjectiveMayEngage({destination:stationObjective,target:enemy,unit:f,leash:220}),false);
 assert.notEqual(context.allyIntent.reason,'crawler-under-attack');assert.equal(context.allyIntent.targetId,enemy.id);
 assert.ok(Math.hypot(f.x-enemy.x,f.y-enemy.y)<=normalAttackReach(f,enemy));
 assert.equal(createAttackTransaction({attacker:f,candidates:[enemy],hasLineOfSight:()=>true})?.targetId,enemy.id);
 vm.runInNewContext(code,context);
 assert.equal(context.allyIntent.targetId,null);assert.equal(context.allyIntent.destinationX,node.x-12);
 assert.equal(f.x,node.x+100,'the intent does not teleport the actor');
});
test('operator arrival uses the same work ellipse as mission progress, including its diagonal edge',()=>{
 for(const [offsetX,offsetY,inside] of [[100,0,false],[60,0,true],[60,35,false],[0,42,true],[0,43,false]]){
  const {context,f,stationObjective}=fixture({offsetX,offsetY});
  const spatial=stationSpatialSnapshot({missionType:definition.missionType,missionRuntime:mission,config:definition.missionConfig,fighters:[f]});
  assert.equal(spatial.powerOperatorCount,Number(inside));
  vm.runInNewContext(code,context);assert.equal(context.allyIntent.targetId,inside?3:null);
  assert.equal(stationObjective.needsOperatorArrival,!inside);
 }
});
test('current intruder, working-area shooting, guards and crawler emergency retain their targets',()=>{
 for(const options of [{enemyOffset:50},{offsetX:-12},{kind:'scout'},{reason:'crawler-under-attack'}]){
  const {context}=fixture(options);vm.runInNewContext(code,context);assert.equal(context.allyIntent.targetId,3);
 }
});
test('device arrival obeys projected small-screen Y and preserves every input object',()=>{
 const {f,guard}=fixture(),projected=180,unit={...f,x:node.x,y:projected};
 const before=structuredClone({unit,guard,node});
 assert.equal(deviceObjectiveDestination({unit,humans:[unit,guard],node,maxX:870,nodeY:projected}).needsOperatorArrival,false);
 assert.equal(deviceObjectiveDestination({unit:{...unit,y:projected+node.radiusY+1},humans:[unit,guard],node,maxX:870,nodeY:projected}).needsOperatorArrival,true);
 assert.deepEqual({unit,guard,node},before);
});
test('the actual target consumer releases the old claim exactly once after an arrival override',()=>{
 const {context,f,enemy}=fixture();Object.assign(f,{targetId:3,retargetIn:.5,variant:0});
 Object.assign(context,{tacticalEnemies:[enemy],targetClaims:new Map([[3,2]]),crawlerAttackThreatIds:new Set(),target:enemy});
 context.allyProfile.retargetSeconds=.5;
 vm.runInNewContext(code,context);vm.runInNewContext(claimCode,context);
 assert.equal(f.targetId,null);assert.equal(context.targetClaims.get(3),1);assert.equal(context.target,undefined);
 vm.runInNewContext(claimCode,context);assert.equal(context.targetClaims.get(3),1);
});
test('legacy device and completed-device return destinations keep their target policy',()=>{
 const {context}=fixture();context.stationObjective={x:205,lane:0,duty:'objective'};
 vm.runInNewContext(code,context);assert.equal(context.allyIntent.targetId,3);assert.equal(context.allyIntent.destinationX,205);
});
