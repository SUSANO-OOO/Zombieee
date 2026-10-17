import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';
console.log(JSON.stringify(await buildRigidJointAtlas({
 sourceDirectory:'assets/source/v100/joints/scout-r1',assetPath:'/art/v100/joints/scout-r1.webp',
 dataFile:'app/v177BipedJointData.js',exportName:'V177_BIPED_JOINT_ATLASES',generator:'scripts/build-v177-biped-joints.mjs',
 description:'Blender 5.2 fixed-length biped gait, ground settling and parented crowbar contact; original face, backpack, hand and crowbar',
})));
