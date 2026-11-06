import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_SCOUT_COMBAT_ATLAS as atlas} from '../app/qualityScoutCombatJointData.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
const dir='assets/source/quality-20261028/rigs/scout-combat-r1';
const d=JSON.parse(await readFile(`${dir}/parts.json`));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('Hachi uses his own complete generated body and preserved source-bound hidden cloth',async()=>{
 assert.equal(V177_JOINT_ATLASES.scout,atlas);
 assert.equal(d.identityBinding.modelSource,'assets/source/quality-20261028/identity/hachi-master-r4.png');
 assert.equal(hash(await readFile(d.identityBinding.modelSource)),d.identityBinding.modelSha256);
 assert.equal(hash(await readFile(d.modelSource)),d.sourceSha256);
 assert.equal(hash(await readFile(d.sourceOperation.underpainting)),d.sourceOperation.underpaintingSha256);
 assert.equal(d.parts.length,atlas.parts.length);
 for(const part of d.parts){
  assert.equal(hash(await readFile(`${dir}/${part.file}`)),part.sha256,part.name);
  assert.ok(['model','under','sleeve'].includes(part.source),'Every part is from this full-body family, not a retained cartoon body');
 }
 assert.deepEqual(d.parentAttachments.head.pivot,atlas.parentAttachments.head.pivot);
});

test('the actual crowbar contact belongs to opaque weapon paint and current distribution has one preferred body',async()=>{
 const pixels=await sharp(`${dir}/crowbar-and-hand.png`).ensureAlpha().raw().toBuffer();
 const [x,y]=atlas.muzzle.map(Math.floor);
 assert.ok(pixels[(y*480+x)*4+3]>=200,'Contact must be on the visible steel tip');
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 const rows=manifest.assets.filter(a=>a.path===atlas.path);assert.equal(rows.length,1);
 const bytes=await readFile('public'+atlas.path);
 assert.equal(rows[0].bytes,bytes.length);assert.equal(rows[0].hash,'sha256-'+hash(bytes));
 assert.ok(!manifest.assets.some(a=>a.path==='/art/v100/joints/scout-quality-neck-r4.webp'),'retired head-only texture is not downloaded alongside current body');
 assert.ok(atlas.decodedBytes<=512*1024);
});
