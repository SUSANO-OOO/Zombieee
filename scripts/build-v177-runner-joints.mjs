import assert from 'node:assert/strict';
import {spriteFrameFor,SPRITE_STATES} from '../app/spriteManifest.js';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';
// Running changes the evaluated motion, while preserving the identical approved paint.
for(const state of SPRITE_STATES)for(const direction of ['left','right'])
 assert.deepEqual(spriteFrameFor('runner',state,direction),spriteFrameFor('walker',state,direction));
console.log(JSON.stringify(await buildRigidJointAtlas({
 sourceDirectory:'assets/source/v100/joints/runner-r1',assetPath:'/art/v100/joints/walker-r1.webp',
 dataFile:'app/v177RunnerJointData.js',exportName:'V177_RUNNER_JOINT_ATLASES',generator:'scripts/build-v177-runner-joints.mjs',
 description:'Blender 5.2 fixed-length running, short flight and opposed bent-arm swing; exact shared infected paint and legacy source scale',
})));
