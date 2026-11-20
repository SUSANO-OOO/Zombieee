import test from 'node:test';
import assert from 'node:assert/strict';
import {v104EnemyContactAudio} from '../app/v104CombatAudio.js';

const zombie = (id,kind='walker') => ({id,kind,side:'zombie',hp:500});

test('an injury voice requires damage to the living recipient and uses its original cooldown',()=>{
 const target=zombie(1),world={time:50,fighters:[target]},cue='enemy-walker-hurt';
 assert.equal(v104EnemyContactAudio(world,target,0,cue),null);
 assert.deepEqual(v104EnemyContactAudio(world,target,25,cue),{ownerId:1,voiceAllowed:true});
 assert.equal(v104EnemyContactAudio(world,target,25,cue),null);
 world.time+=1;
 assert.equal(v104EnemyContactAudio(world,{...target,hp:0},30,cue),null);
 assert.deepEqual(v104EnemyContactAudio(world,target,30,cue),{ownerId:1,voiceAllowed:true});
});

test('a blocked Panther contact keeps the material sound and does not cost an injury voice',()=>{
 const target=zombie(2,'red-panther-shield'),world={time:50,fighters:[target]},cue='enemy-red-panther-shield-hurt';
 assert.deepEqual(v104EnemyContactAudio(world,target,0,cue),{ownerId:2,voiceAllowed:false});
 assert.equal(v104EnemyContactAudio(world,target,0,cue),null);
 assert.deepEqual(v104EnemyContactAudio(world,target,10,cue),{ownerId:2,voiceAllowed:true});
 assert.equal(v104EnemyContactAudio(world,target,10,cue),null);
});
