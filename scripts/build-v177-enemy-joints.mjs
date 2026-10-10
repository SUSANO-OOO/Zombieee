import assert from 'node:assert/strict';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {SPRITE_STATES} from '../app/spriteManifest.js';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';
// These two existing kinds share exactly the same approved painted identity.
for(const state of SPRITE_STATES)for(const direction of ['left','right'])
 assert.deepEqual(spriteFrameFor('turned',state,direction),spriteFrameFor('walker',state,direction));
console.log(JSON.stringify(await buildRigidJointAtlas({
 sourceDirectory:'assets/source/v100/joints/walker-r1',assetPath:'/art/v100/joints/walker-r1.webp',
 dataFile:'app/v177EnemyJointData.js',exportName:'V177_ENEMY_JOINT_ATLASES',generator:'scripts/build-v177-enemy-joints.mjs',aliases:['turned'],
 description:'Blender 5.2 fixed-length infected biped gait, settling and claw reach; original head and hands, approved legacy source scale',
})));
