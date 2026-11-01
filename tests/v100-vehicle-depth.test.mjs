import test from 'node:test';
import assert from 'node:assert/strict';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {v100BattleDefinitionFor} from '../app/v100BattleAdapter.js';
import {v100MissionVehiclePlacements,drawV100MissionVehicles,drawV100MissionVehicleBody} from '../app/v100MissionVehicles.js';
const game=number=>({definition:v100BattleDefinitionFor(V100_STAGE_IDS[number-1]),stageMission:{integrity:500,maxIntegrity:500},baseHp:680});
const objects=Object.fromEntries(['transportStates','maintenanceStates','destinationStates'].map(name=>['v100-mission-vehicle-'+name,{name,complete:true,naturalWidth:1536}]));
function context(){const calls=[];return{calls,save(){},restore(){},beginPath(){},ellipse(...args){calls.push(['shadow',...args]);},fill(){},fillRect(){},drawImage(...args){calls.push(['image',...args]);}};}

test('each convoy member has its own ground depth and non-escort stages have no vehicle',()=>{
 for(const stage of [6,12,19,26]){
  const rows=v100MissionVehiclePlacements(game(stage),500,285);
  assert.equal(rows.length,stage===26?3:1);
  assert.deepEqual(rows.map(r=>r.y),stage===26?[253,285,317]:[285]);
  assert.deepEqual(rows.map(r=>r.x),stage===26?[350,500,650]:[500]);
 }
 assert.deepEqual(v100MissionVehiclePlacements(game(9),500,285),[]);
});

test('deferred ground pass paints markers and shadows but no duplicate vehicle bodies',()=>{
 for(const stage of [6,12,19,26]){
  const g=game(stage),ctx=context();
  assert.equal(drawV100MissionVehicles(ctx,g,objects,500,285,{deferBodies:true}),true);
  assert.equal(ctx.calls.filter(c=>c[0]==='image').length,1,'only the destination marker in ground pass');
  const placements=v100MissionVehiclePlacements(g,500,285);
  assert.equal(ctx.calls.filter(c=>c[0]==='shadow').length,placements.length);
  for(const p of placements)drawV100MissionVehicleBody(ctx,p,objects);
  assert.equal(ctx.calls.filter(c=>c[0]==='image').length,1+placements.length);
  const full=context();drawV100MissionVehicles(full,g,objects,500,285);
  assert.deepEqual(ctx.calls.filter(c=>c[0]==='image'),full.calls.filter(c=>c[0]==='image'),'standalone audits keep identical authored body frames');
 }
});

test('all damage states retain the authored wheel anchor at each member ground position',()=>{
 for(const stage of [6,12,19,26])for(const integrity of [500,250,100,0]){
  const g=game(stage);g.stageMission.integrity=integrity;
  for(const p of v100MissionVehiclePlacements(g,500,285)){
   const ctx=context();drawV100MissionVehicleBody(ctx,p,objects);
   const [,image,left,top,,,dx,dy]=ctx.calls.find(c=>c[0]==='image');
   assert.equal(image.name,p.sprite.assetKey);
   assert.equal(dx+(p.sprite.frame[4]-left)*p.sprite.scale,p.x);
   assert.equal(dy+(p.sprite.frame[5]-top)*p.sprite.scale,p.y);
  }
 }
});
