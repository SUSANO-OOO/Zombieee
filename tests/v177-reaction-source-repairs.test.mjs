import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import {applyV177ReactionRepairs,deriveV177ReactionPose,V177_REACTION_RECIPES} from '../scripts/v177-reaction-source-repairs.mjs';
import {spriteFrameFor} from '../app/spriteManifest.js';

const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const proof=JSON.parse(await readFile(new URL('../assets/source/v100/sprite-repairs/reaction-source-provenance.json',import.meta.url),'utf8'));
const inputs=JSON.parse(await readFile(new URL('../assets/source/v100/sprite-repairs/reactions/inputs.json',import.meta.url),'utf8'));
const rgba=async b=>sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});

test('four repaired reaction atlases reproduce exactly and retain all 40 approved idle/walk/attack cells',async()=>{
  for(const row of proof.rows){const png=await readFile(path.join(root,'public'+row.path));assert.equal('sha256-'+sha(png),row.nextPng.hash);
    assert.deepEqual(await applyV177ReactionRepairs(row.kind,png,root),png,'Source regeneration must be byte-identical and idempotent');
    for(const cell of row.cells){const pixels=await sharp(png).extract({left:cell.column*480,top:cell.row*448,width:480,height:448}).ensureAlpha().raw().toBuffer();assert.equal(sha(pixels),cell.newRgbaSha256);if(cell.column<5)assert.equal(sha(pixels),cell.oldRgbaSha256);}
    for(const state of ['hit','death'])for(const direction of ['right','left']){const frame=spriteFrameFor(row.kind,state,direction);assert.equal(frame.path,row.path);assert.equal(frame.contentRect.y+frame.contentRect.h-frame.y,432);assert.ok(frame.gutter.left>=16&&frame.gutter.right>=16);}
  }
  assert.equal(proof.unchangedCells,40);assert.equal(proof.changedCells,16);assert.equal(proof.nativeAcceptance,false);
});

test('the restored hit faces, hands and weapons are the original approved paint, not the generated whole figures',async()=>{
  const regions={zakimiya:[[45,30,80,90],[20,140,180,100]],'mrs-chiha':[[210,35,100,90],[140,150,180,130]],'miyamoto-musashi':[[30,20,90,75],[50,150,200,100]]};
  for(const [kind,protectedRegions]of Object.entries(regions)){const r=V177_REACTION_RECIPES[kind],[left,top,width,height]=r.hit;
    const original=await sharp(path.join(root,'assets/source/v090/characters/'+kind+'-combat-poses-source-r1.png')).extract({left,top,width,height}).ensureAlpha().raw().toBuffer(),fixed=(await rgba(await deriveV177ReactionPose(kind,'hit',root))).data;
    for(const [x0,y0,w,h]of protectedRegions){let compared=0;for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const p=(y*width+x)*4,red=original[p],green=original[p+1],blue=original[p+2];if(Math.hypot(red,green,255-blue)<r.key+76)continue;
      assert.equal(fixed[p],red,kind+' original red');assert.equal(fixed[p+1],green,kind+' original green');assert.equal(fixed[p+2],Math.min(blue,Math.max(red,green)+18),kind+' original blue after existing despill');assert.equal(fixed[p+3],255,kind+' proper anatomy must not disappear');compared++;}
      assert.ok(compared>1000,kind+' original paint actually checked');}
  }
  assert.equal(inputs.generatedWholeFiguresAdopted,false);
});

test('localized fallen-foot repairs retain every original face, hand, body and weapon pixel to the right of the overlap',async()=>{
  for(const kind of ['mrs-chiha','miyamoto-musashi']){const r=V177_REACTION_RECIPES[kind],[left,top,width,height]=r.death,original=await sharp(path.join(root,'assets/source/v090/characters/'+kind+'-combat-poses-source-r1.png')).extract({left,top,width,height}).ensureAlpha().raw().toBuffer(),fixed=(await rgba(await deriveV177ReactionPose(kind,'death',root))).data;
    let compared=0;for(let y=0;y<height;y++)for(let x=110;x<width;x++){const p=(y*width+x)*4,red=original[p],green=original[p+1],blue=original[p+2],d=Math.hypot(red,green,255-blue),a=d<=48?0:d>=124?255:Math.round((d-48)*255/76);const expected=a?[red,green,Math.min(blue,Math.max(red,green)+(a===255?18:2)),a]:[0,0,0,0];assert.deepEqual(Array.from(fixed.subarray(p,p+4)),expected);if(a)compared++;}assert.ok(compared>10000);
  }
});

test('Kumaverson owns the full prone head left of the old grid boundary and retains both feet and his pan',async()=>{
  const pose=await rgba(await deriveV177ReactionPose('kumaverson','death',root));assert.equal(pose.info.width,454);assert.equal(pose.info.height,471);
  let recoveredHead=0;for(let y=257;y<335;y++)for(let x=17;x<36;x++)if(pose.data[(y*454+x)*4+3]>8)recoveredHead++;assert.ok(recoveredHead>300,'The old x=836 boundary actually omitted the original head');
  const row=proof.rows.find(r=>r.kind==='kumaverson');assert.ok(row.visible.right[6][2]-row.visible.right[6][0]>=429);assert.equal(row.nonreactionCellsPreserved,10);
});

test('a drifted frozen source cell is rejected before reaction painting',async()=>{
  const row=proof.rows[0],png=await readFile(path.join(root,'public'+row.path)),decoded=await rgba(png);decoded.data[0]^=1;
  const changed=await sharp(decoded.data,{raw:{width:3360,height:896,channels:4}}).png().toBuffer();await assert.rejects(applyV177ReactionRepairs(row.kind,changed,root),/Nonreaction source drift/);
});

test('the original Zakimiya and Chiha source builders reproduce repaired sheets without regenerating approved identity derivatives',async()=>{
  const scratch=await mkdtemp(path.join(os.tmpdir(),'zombieee-reaction-replay-'));
  try{
    for(const input of inputs.inputs){const destination=path.join(scratch,input.path);await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.join(root,input.path),destination);}
    const jsonPath=path.join(scratch,'assets/source/v100/sprite-repairs/reactions/inputs.json');await writeFile(jsonPath,JSON.stringify(inputs));
    for(const file of ['zakimiya-identity-master-r1.png','zakimiya-cutout-source-r1.png','mrs-chiha-identity-master-r1.png'])await copyFile(path.join(root,'assets/source/v090/characters',file),path.join(scratch,'assets/source/v090/characters',file));
    const identities=[];for(const kind of ['zakimiya','mrs-chiha'])for(const [dir,suffix]of [['portraits','event-portrait'],['cards','formation-card']]){const relative='public/art/v090/characters/'+dir+'/'+kind+'-'+suffix+'-r1.webp',bytes=await readFile(path.join(root,relative));await mkdir(path.dirname(path.join(scratch,relative)),{recursive:true});await writeFile(path.join(scratch,relative),bytes);identities.push({relative,hash:sha(bytes)});}
    execFileSync(process.execPath,[path.join(root,'scripts/build-v090-zakimiya-assets.mjs')],{cwd:scratch,maxBuffer:512*1024,timeout:60000});
    execFileSync(process.execPath,[path.join(root,'scripts/build-v090-new-playable-human-assets.mjs'),'--battle-only=mrs-chiha'],{cwd:scratch,maxBuffer:512*1024,timeout:60000});
    for(const kind of ['zakimiya','mrs-chiha']){const row=proof.rows.find(r=>r.kind===kind);assert.equal('sha256-'+sha(await readFile(path.join(scratch,'public'+row.path))),row.nextPng.hash);}
    for(const item of identities)assert.equal(sha(await readFile(path.join(scratch,item.relative))),item.hash);
  }finally{assert.equal(path.dirname(path.resolve(scratch)),path.resolve(os.tmpdir()));assert.ok(path.basename(scratch).startsWith('zombieee-reaction-replay-'));await rm(scratch,{recursive:true,force:true});}
});
