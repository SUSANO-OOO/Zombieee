import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceObjectiveDestination,deviceObjectiveMayEngage} from '../app/deviceObjectiveAi.js';
import {decideAllyIntent} from '../app/allyAi.js';
const human=(id,kind='scout',range=24)=>({id,kind,range,side:'human',hp:80,combatReady:true,gateEntering:false,x:435,y:240,lane:0});
const node={x:410,lane:0,radiusX:84};
const destination=(unit,humans,n=node)=>deviceObjectiveDestination({unit,humans,node:n,maxX:870});
test('one eligible support operates while melee screens; incapacitation transfers the duty',()=>{
 const scout=human(1),medic=human(2,'medic',210),units=[scout,medic],before=structuredClone(units);
 assert.equal(destination(medic,units).duty,'device-operator');assert.equal(destination(scout,units).duty,'device-screen');assert.deepEqual(units,before);
 for(const state of [{hp:0},{stunned:1},{gateEntering:true},{contained:true}])assert.equal(destination(scout,[scout,{...medic,...state}]).duty,'device-operator');
});
test('a guard closes on a ranged enemy rather than being pulled behind the device',()=>{
 const scout=human(1),medic=human(2,'medic',210),enemy={id:3,side:'zombie',x:530,y:240,lane:0,hp:85,bodyRadius:16};
 const intent=decideAllyIntent({missionType:'sequential-seal',unit:scout,enemies:[enemy]});
 assert.equal(intent.targetId,3);assert.ok(intent.destinationX>scout.x);
 assert.equal(deviceObjectiveMayEngage({destination:destination(scout,[scout,medic]),target:enemy,unit:scout,leash:220}),true);
 assert.equal(deviceObjectiveMayEngage({destination:destination(medic,[scout,medic]),target:enemy,unit:medic,leash:220}),false);
});
test('operator can clear a device intruder and a solo melee unit can fight before resuming work',()=>{
 const scout=human(1),medic=human(2,'medic',210),enemy={hp:85,x:470,lane:0};
 assert.ok(deviceObjectiveMayEngage({destination:destination(medic,[scout,medic]),target:enemy,unit:medic,leash:220}));
 assert.ok(deviceObjectiveMayEngage({destination:destination(scout,[scout]),target:{...enemy,x:530},unit:scout,leash:220}));
});
test('guards do not chase outside the objective leash or retain defeated targets',()=>{
 const scout=human(1),medic=human(2,'medic',210),d=destination(scout,[scout,medic]);
 for(const target of [{hp:85,x:700,lane:0},{hp:0,x:500,lane:0},{hp:85,x:500,lane:0,contained:true},null])assert.equal(deviceObjectiveMayEngage({destination:d,target,unit:scout,leash:220}),false);
});
test('seven units spread across guard slots and never request a destination past the battlefield',()=>{
 const units=Array.from({length:7},(_,i)=>human(i+1,i===0?'medic':'scout',i===0?210:24));
 const positions=units.map(unit=>destination(unit,units));assert.equal(positions.filter(p=>p.duty==='device-operator').length,1);
 assert.equal(new Set(positions.map(p=>p.x+':'+p.lane)).size,7);
 const edge=units.map(unit=>destination(unit,units,{...node,x:888}));
 assert.equal(new Set(edge.map(p=>p.x+':'+p.lane)).size,7);
 for(const p of edge)assert.ok(p.x<=870);
});
