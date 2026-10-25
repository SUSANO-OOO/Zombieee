import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';
import {V177_MELEE_JOINT_ATLASES} from '../app/v177MeleeJointData.js';

const directory='assets/source/v105/crazy-king',oldDirectory='assets/source/v100/joints/crazy-king-r1';
const input=process.argv[2];assert.ok(input,'Pass the selected transparent imagegen skirt output');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const raw=await fs.readFile(input),partsFile=path.join(oldDirectory,'parts.json');
const before=await fs.readFile(partsFile),definition=JSON.parse(before),part=definition.parts.find(p=>p.name==='pelvis');
const originalPartSha='6fd357b7f66896b34aef9dbb15d346096baa4196ca21cfdce60f5832d4a64e44';
assert.ok(part.file==='pelvis.png'||part.file==='../../../v105/crazy-king/pelvis-restored-r1.png');
if(part.file==='pelvis.png')assert.equal(part.sha256,originalPartSha);
await fs.mkdir(directory,{recursive:true});
const writeSelected=async(file,bytes)=>{try{const current=await fs.readFile(file);assert.equal(sha(current),sha(bytes),'Never overwrite a different selected asset');}
 catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(file,bytes,{flag:'wx'});}};
await writeSelected(path.join(directory,'pelvis-generated-r1.png'),raw);
// Register the selected garment in the unchanged 480x448 source coordinate
// system. Only its scale/position changes; preserve the generated alpha/color.
const garment=await sharp(raw).trim().resize(96,70,{fit:'fill'}).png().toBuffer();
const restored=await sharp({create:{width:480,height:448,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
 .composite([{input:garment,left:173,top:220}]).png().toBuffer();
const restoredFile=path.join(directory,'pelvis-restored-r1.png');await writeSelected(restoredFile,restored);
const record={schema:'v105-approved-clothing-restoration/1',kind:'crazy-king',
 approvedDesign:{document:'docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md',
  reference:'public/art/v060/characters/crazy-king-battle-v1.png',referenceSha256:sha(await fs.readFile('public/art/v060/characters/crazy-king-battle-v1.png')),
  identityReference:oldDirectory+'/identity-reference.png',identitySha256:definition.sourceSha256,
  clothing:'Original green jacket, black pleated skirt and tall red boots'},
 cause:'The generated pelvis part contained red shorts before atlas packing. Restore the skirt; do not revert current motion.',
 originalPart:{file:oldDirectory+'/pelvis.png',sha256:originalPartSha},
 generation:{tool:'built-in image_gen',selectedOutputSha256:sha(raw),workspaceSource:directory+'/pelvis-generated-r1.png',transparentBackground:true,
  prompt:'Replace only the incorrect red shorts pelvis part with the approved black/dark charcoal pleated skirt from the supplied Crazy King identity reference. Preserve the painted game style, perspective and lighting. Reconstruct hidden pleats to match the original garment. Isolate the complete skirt on genuine transparency, with no jacket, head, arms, chainsaw, legs, boots, text or background. No redesign, trousers or red fabric.'},
 registration:{canvas:[480,448],rectangle:{x:173,y:220,width:96,height:70},method:'Trim transparent margin and register the selected garment; no motion or other part changes'},
 output:{file:restoredFile,sha256:sha(restored)}};
part.file='../../../v105/crazy-king/pelvis-restored-r1.png';part.sha256=sha(restored);part.clothingRestoration=directory+'/provenance.json';
await fs.writeFile(partsFile,JSON.stringify(definition,null,2)+'\n');
await fs.mkdir('public/art/v105/joints',{recursive:true});let atlas;
const built=await buildRigidJointAtlas({sourceDirectory:oldDirectory,assetPath:'/art/v105/joints/crazy-king-skirt-r1.webp',dataFile:null,
 generator:'scripts/build-v105-crazy-king-skirt.mjs',captureAtlas:value=>{atlas=value;},
 description:'Approved black pleated skirt restored from original identity. Existing green jacket, red boots, body, weapon, evaluated gait, attack matrices, IK and clocks unchanged.'});
const original=V177_MELEE_JOINT_ATLASES['crazy-king'],replaceKeys=['path','decodedWidth','decodedHeight','decodedBytes','parts'];
const strip=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!replaceKeys.includes(key)));
// The generated data module serializes JSON: undefined keys are absent and
// signed zero is zero. Compare that exact representation, then inherit the
// original matrices by reference in the runtime override.
assert.equal(sha(JSON.stringify(strip(atlas))),sha(JSON.stringify(strip(original))),
 'All existing serialized motion, anatomy, interpolation and clocks must remain identical');
for(const item of atlas.parts.filter(p=>p.name!=='pelvis'))assert.deepEqual(item.destination,original.parts.find(p=>p.name===item.name).destination,item.name);
const override=Object.fromEntries(replaceKeys.map(key=>[key,atlas[key]]));
await fs.writeFile('app/v105CrazyKingJointData.js',
 "// Generated garment/packing override; inherit every verified motion matrix.\nimport {V177_MELEE_JOINT_ATLASES} from './v177MeleeJointData.js';\nexport const V105_CRAZY_KING_JOINT_ATLAS={...V177_MELEE_JOINT_ATLASES['crazy-king'],..."+JSON.stringify(override,null,2)+"};\n");
record.runtime=built;record.motionAndOtherAnatomyUnchanged=true;
await fs.writeFile(path.join(directory,'provenance.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({kind:'crazy-king',asset:built.assetPath,motionUnchanged:true,otherPartsUnchanged:true,restoredSkirt:true}));
