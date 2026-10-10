// Source-bound cropped paint and actual Blender bone matrices. No full-body warp.
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';
console.log(JSON.stringify(await buildRigidJointAtlas({
 sourceDirectory:'assets/source/v100/joints/mayo-r1',assetPath:'/art/v100/joints/mayo-r1.webp',
 dataFile:'app/v177QuadrupedJointData.js',exportName:'V177_QUADRUPED_JOINT_ATLASES',generator:'scripts/build-v177-quadruped-joints.mjs',
 description:'Blender 5.2 fixed-length diagonal run, ground settling and parented jaw contact; original head, jaw, tail and equipment',
})));
