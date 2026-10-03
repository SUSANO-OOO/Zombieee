import assert from 'node:assert/strict';
import test from 'node:test';
import {decideAllyIntent} from '../app/allyAi.js';
import {canAcquireCombatTarget, canNormalAttackTarget} from '../app/combatLifecycle.js';
import {advanceTowardLane, humanLaneTransitioning} from '../app/lanePlanner.js';
import {LANE_Y} from '../app/gameRules.js';

const boss={id:'boss',kind:'gate-eater',boss:true,side:'zombie',x:560,y:LANE_Y[1],lane:1,hp:2100,bodyRadius:32,combatReady:true};
const mayo={id:'mayo-a',kind:'mayo-chan',side:'human',x:320,y:LANE_Y[1],lane:1,assignedLane:1,range:22,bodyRadius:7};

test('Mayo keeps the boss through the physical lane transition and reaches an attackable flank',()=>{
 let unit={...mayo},previousIntent=null,changedLane=false,attacked=false;
 for(let tick=0;tick<600;tick++){
  const intent=decideAllyIntent({unit,enemies:[boss],assignedLane:1,previousIntent,
   laneTransitioning:humanLaneTransitioning({currentLane:unit.lane,assignedLane:1})});
  assert.equal(intent.targetId,boss.id,`target retained at step ${tick}`);
  assert.ok(intent.destinationY<boss.y);
  const delta=intent.destinationX-unit.x;
  const laneStep=advanceTowardLane({y:unit.y,currentLane:unit.lane,destinationLane:intent.destinationLane,
   destinationY:intent.destinationY,laneCenters:LANE_Y,laneSpeed:96,seconds:1/60});
  unit={...unit,x:unit.x+Math.sign(delta)*Math.min(Math.abs(delta),33/60),y:laneStep.y,lane:laneStep.lane};
  changedLane ||= unit.lane!==mayo.lane;
  if(canNormalAttackTarget({attacker:unit,target:boss})){attacked=true;break;}
  previousIntent=intent;
 }
 assert.ok(changedLane,'physical flank crosses the lane boundary without teleporting');
 assert.ok(attacked,'real range 22 plus boss radius must reach, without a range buff');
 const retained=decideAllyIntent({unit,enemies:[boss],assignedLane:1,previousIntent:{targetId:boss.id},laneTransitioning:true});
 assert.equal(retained.targetId,boss.id);
 const dead=decideAllyIntent({unit,enemies:[{...boss,hp:0}],assignedLane:1,previousIntent:retained,laneTransitioning:true});
 assert.equal(dead.targetId,null);
});

test('flanking exception preserves target lifecycle, side, distance and ordinary melee lane boundaries',()=>{
 const adjacent={...mayo,x:boss.x,y:boss.y-40,lane:0};
 assert.equal(canAcquireCombatTarget({attacker:adjacent,target:boss}),true);
 assert.equal(canNormalAttackTarget({attacker:adjacent,target:boss}),true);
 for(const target of [{...boss,hp:0},{...boss,combatReady:false},{...boss,targetable:false},{...boss,side:'human'},
  {...boss,state:'dying'},{...boss,boss:false,kind:'walker'},{...boss,lane:2}]){
  assert.equal(canAcquireCombatTarget({attacker:adjacent,target}),false,JSON.stringify(target));
 }
 assert.equal(canNormalAttackTarget({attacker:{...adjacent,x:boss.x-200},target:boss}),false);
 assert.equal(canAcquireCombatTarget({attacker:{...adjacent,kind:'kumaverson'},target:boss}),false);
});
