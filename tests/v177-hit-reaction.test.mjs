import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rememberV177HitStrength,v177HitReactionState} from '../app/v177HitReaction.js';
import {pruneV177JointActorHistory} from '../app/v177JointActorHistory.js';

test('an actual12 impulse remains heavy after the original.9 physical decay in either actor order',()=>{
 for(const sourceFirst of [false,true]){
  const world={},actor={id:1,hp:100,flash:0,knock:0,x:530};
  const impact=()=>{actor.hp-=22;actor.flash=.16;actor.knock=12;};
  const integrate=()=>{actor.flash=Math.max(0,actor.flash-1/60);rememberV177HitStrength(actor,world);actor.x-=actor.knock*6/60;actor.knock*=.9;};
  if(sourceFirst){impact();integrate();}else{integrate();impact();}
  assert.equal(v177HitReactionState(actor,world),'hit-heavy');
  const before=structuredClone(actor);assert.equal(v177HitReactionState(actor,world),'hit-heavy');assert.deepEqual(actor,before);
  integrate();assert.equal(v177HitReactionState(actor,world),'hit-heavy');
  assert.equal(actor.hp,78);
 }
});

test('strength never crosses the original12 boundary, extends flash or survives a new injury',()=>{
 const world={},a={id:2,hp:100,flash:.16,knock:11.999};
 rememberV177HitStrength(a,world);a.knock*=.9;assert.equal(v177HitReactionState(a,world),'hit-light');
 a.knock=14;rememberV177HitStrength(a,world);a.knock=3;assert.equal(v177HitReactionState(a,world),'hit-heavy');
 a.flash=0;assert.equal(v177HitReactionState(a,world),'hit-light');assert.equal(a.flash,0);
 a.flash=.12;a.knock=5;rememberV177HitStrength(a,world);assert.equal(v177HitReactionState(a,world),'hit-light');
 a.hp=0;assert.equal(v177HitReactionState(a,world),'hit-light');
});

test('the original world owner survives actor copies but retires with removal or a new battle',()=>{
 const world={},actor={id:7,hp:100,flash:.16,knock:12};rememberV177HitStrength(actor,world);
 const copy={...actor,knock:3};assert.equal(v177HitReactionState(copy,world),'hit-heavy');
 assert.equal(v177HitReactionState(copy,{}),'hit-light');
 world.fighters=[];pruneV177JointActorHistory(world);assert.equal(v177HitReactionState(copy,world),'hit-light');
});

test('both actual drawing and runtime use the same impulse captured before physical decay',()=>{
 const app=readFileSync('app/AshfallGame.tsx','utf8');
 assert.ok(app.indexOf('rememberV177HitStrength(f,g)')<app.indexOf('f.knock *= .9'));
 assert.match(app,/v177HitReactionState\(f,options\.world\)/u);
 assert.match(app,/v177HitReactionState\(fighter,g\)/u);
 assert.ok(!app.includes('f.knock >= 12 ? "hit-heavy" : "hit-light"'));
 assert.ok(!app.includes('fighter.knock >= 12 ? "hit-heavy" : "hit-light"'));
});
