import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';
console.log(JSON.stringify(await buildRigidJointAtlas({
 sourceDirectory:'assets/source/v100/joints/mayo-feral-r1',assetPath:'/art/v100/joints/mayo-feral-r1.webp',
 dataFile:'app/v177FeralJointData.js',exportName:'V177_FERAL_JOINT_ATLASES',generator:'scripts/build-v177-feral-joints.mjs',
 description:'Blender 5.2 dedicated feral four-leg gait with fixed-length hip/knee/ankle chains and planted paws; original face, tail, harness, collar, paws and four fanged mouth petals retained. Hidden fur completion is explicit; head-attached leaf mouth organs fold/open independently. Source texture packing preserves resolution and drawing order. All48/all-action, native continuous-play, performance and physical recording acceptance pending.',
})));
