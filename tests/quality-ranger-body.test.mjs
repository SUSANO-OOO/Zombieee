import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_RANGER_COMBAT_ATLAS as candidate} from '../app/qualityRangerCombatJointData.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {V177_JOINT_ATLASES as original} from '../app/v177JointData.js';
import {assertRangerRepaintGeometry} from './helpers/quality-material-contract.mjs';
const dir='assets/source/quality-20261028/rigs/ranger-combat-r1',sha=b=>createHash('sha256').update(b).digest('hex');
test('Mizuchi uses the approved r4 body source and replaces every old fallback with the full repaint',async()=>{
 assert.deepEqual(V177_JOINT_ATLASES.ranger,candidate);assertRangerRepaintGeometry(candidate,original.ranger);
 const p=JSON.parse(await readFile(`${dir}/provenance.json`));
 assert.equal(p.primary.path,'assets/source/quality-20261028/identity/mizuchi-master-r4.png');
 assert.equal(sha(await readFile(p.primary.path)),p.primary.sha256);
 for(const [file,expected]of [['combat-model-r1.png',p.modelSha256],['body-underpainting-r1.png',p.underpaintingSha256]])assert.equal(sha(await readFile(`${dir}/${file}`)),expected);
 const bytes=await readFile('public'+candidate.path);assert.equal(sha(bytes),p.asset.sha256);assert.equal(bytes.length,p.asset.bytes);
 const old=await sharp('public'+original.ranger.path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const now=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const crop=(texture,frame)=>{const s=frame.source,b=Buffer.alloc(s.w*s.h*4);for(let y=0;y<s.h;y++)texture.data.copy(b,y*s.w*4,((s.y+y)*texture.info.width+s.x)*4,((s.y+y)*texture.info.width+s.x+s.w)*4);return b;};
 for(let i=0;i<152;i++){const pixels=crop(now,candidate.frames[i]);assert.ok(pixels.some((v,j)=>j%4===3&&v>32),'nonempty fallback '+i);assert.notEqual(sha(pixels),sha(crop(old,original.ranger.frames[i])),'no old body fallback '+i);}
 for(const part of p.parts)assert.equal(sha(await readFile(`${dir}/${part.file}`)),part.sha256);
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));assert.equal(manifest.assets.filter(a=>a.path===candidate.path).length,1);assert.ok(!manifest.assets.some(a=>a.path==='/art/v100/joints/ranger-quality-neck-r4.webp'));
});
test('the repaint verifier rejects changed aim, leg mesh and foot placement instead of accepting arbitrary new geometry',()=>{
 assertRangerRepaintGeometry(candidate,original.ranger);
 for(const mutate of [a=>a.upperRig.muzzle[0]++,a=>a.upperRig.armConstraints[0].wrist[1]++,a=>a.lowerRig.legs[0].sourcePositions[0]++,a=>a.lowerRig.spanPx++,a=>a.cycleDistance++]){
  const broken=structuredClone(candidate);mutate(broken);assert.throws(()=>assertRangerRepaintGeometry(broken,original.ranger));
 }
});
