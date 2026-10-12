import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {removeKuromeGroundMatte} from "../scripts/v177-kurome-ground-matte.mjs";
import {MOTION_DEFINITIONS,regenerateMotionAtlases} from "../scripts/v100-reviewed-motion-generator.mjs";
import {V177_GROUND_MATTE_SPRITE_REPLACEMENTS} from "../scripts/v177-ground-matte-repair-asset-contract.mjs";
import {V177_JOINT_ASSET_ADDITIONS} from "../scripts/v177-joint-asset-contract.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const base="e4fb2403e87989a4c6323da65eac1e269348d695";
const old=file=>execFileSync("git",["show",base+":"+file],{cwd:root,maxBuffer:8*1024*1024});
const hash=b=>createHash("sha256").update(b).digest("hex");
const raw=bytes=>sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const disk=file=>fs.readFile(path.join(root,file));

test("Kurome loses only the ground alpha in all14 source cells while original body paint, textures and motion stay exact",async()=>{
  const file="public/art/v090-prototypes/bosses/kurome-battle-candidate-r1.png";
  const before=await raw(old(file)),after=await raw(await disk(file));
  assert.equal(before.info.width,3360);assert.equal(before.info.height,896);
  assert.equal(after.info.width,before.info.width);assert.equal(after.info.height,before.info.height);
  let changes=0;
  for(let i=0;i<before.data.length;i+=4){
    assert.ok(before.data.subarray(i,i+3).equals(after.data.subarray(i,i+3)),"original RGB must survive");
    if(before.data[i+3]===after.data[i+3])continue;
    changes++;
    assert.equal(after.data[i+3],0);
    const y=Math.floor(i/4/before.info.width)%448;
    assert.ok(y>=390&&y<432,"body above the reviewed ground strip must survive");
    const colors=[...before.data.subarray(i,i+3)];
    assert.ok(Math.min(...colors)>=130&&Math.max(...colors)-Math.min(...colors)<=32,"dark outlines and colored claws/bones must survive");
  }
  assert.equal(changes,28230);
  const probes=[[240,417],[240,421],[240,411],[240,420],[240,422],[240,416],[208,414]];
  for(let row=0;row<2;row++)for(let column=0;column<7;column++){
    const [rightX,y]=probes[column],x=row?479-rightX:rightX,i=((row*448+y)*3360+column*480+x)*4+3;
    assert.ok(before.data[i]>0,"the original source contains the matte");
    assert.equal(after.data[i],0,"the same actual ground pixel is transparent in each authored row");
  }
  for(const kind of ["kurome","red-panther-knife"]){
    const dir="assets/source/v100/joints/"+kind+"-r1/",parts=JSON.parse(await disk(dir+"parts.json"));
    for(const part of parts.parts)assert.ok((await disk(dir+part.file)).equals(old(dir+part.file)),"original body part: "+kind+"/"+part.file);
    assert.ok((await disk(dir+"motion.json.gz")).equals(old(dir+"motion.json.gz")),"original Blender motion");
    assert.equal(hash(await disk("public"+parts.identityBinding.path)),parts.identityBinding.sourceSha256);
  }
  assert.equal(V177_JOINT_ASSET_ADDITIONS.length,45);
  for(const asset of V177_JOINT_ASSET_ADDITIONS)assert.ok((await disk("public"+asset.path)).equals(old("public"+asset.path)),"all45 runtime joint textures remain unchanged");
  assert.throws(()=>removeKuromeGroundMatte(before.data,{...before.info,width:3359}));
  const altered=Buffer.from(before.data);altered[(417*3360+240)*4+3]=0;
  assert.throws(()=>removeKuromeGroundMatte(altered,before.info),/source drift/u);
});

test("Knife death gap and cord hole use original RGB while eight nondeath cells and blade reflections stay exact",async()=>{
  await fs.mkdir(path.join(root,"output"),{recursive:true});
  const destination=await fs.mkdtemp(path.join(root,"output/ground-knife-test-"));
  const record=(await regenerateMotionAtlases(destination,MOTION_DEFINITIONS.filter(d=>d.name==="red-panther-knife")))[0];
  const png="public/art/v100/enemies/red-panther-knife-battle-v2.png",metadata=png.replace(/\.png$/u,"-metadata.json");
  assert.ok((await fs.readFile(record.output)).equals(await disk(png)),"original generator reproduces the exact repaired PNG");
  const original=await raw(await disk("assets/source/v100/runtime/motion/red-panther-knife/death-left-authored-v1.png"));
  const repaired=await raw(record.frames[4].fullBuffer);
  for(let i=0;i<original.data.length;i+=4)assert.ok(original.data.subarray(i,i+3).equals(repaired.data.subarray(i,i+3)),"raw original source RGB");
  for(const [x,y]of [[704,706],[187,830]]){
    const i=(y*original.info.width+x)*4+3;assert.equal(original.data[i],255);assert.equal(repaired.data[i],0);
  }
  assert.equal(repaired.data[(883*original.info.width+341)*4+3],255,"the real knife reflection survives");
  const before=await raw(old(png)),after=await raw(await disk(png));
  for(let row=0;row<2;row++)for(let column=0;column<4;column++)for(let y=0;y<512;y++){
    const start=((row*512+y)*before.info.width+column*544)*4;
    assert.ok(before.data.subarray(start,start+544*4).equals(after.data.subarray(start,start+544*4)),"all original nondeath pixels");
  }
  const previous=JSON.parse(old(metadata)),current=JSON.parse(await disk(metadata));
  assert.deepEqual(current.frames,previous.frames);assert.equal(current.commonScale,previous.commonScale);
  assert.equal(current.groundAnchorPixels,previous.groundAnchorPixels);
});

test("the two source-bound matte transports match the manifest with no unrelated asset replacement",async()=>{
  const current=JSON.parse(await disk("public/asset-manifest.json")),previous=JSON.parse(old("public/asset-manifest.json"));
  const previousByPath=new Map(previous.assets.map(a=>[a.path,a]));
  assert.equal(current.assets.length,previous.assets.length);
  const changed=current.assets.filter(a=>a.hash!==previousByPath.get(a.path)?.hash);
  assert.deepEqual(changed.map(a=>a.path).sort(),V177_GROUND_MATTE_SPRITE_REPLACEMENTS.map(a=>a.path).sort());
  const provenance=JSON.parse(await disk("assets/source/v100/sprite-repairs/ground-matte-provenance.json"));
  assert.equal(provenance.kuromeBuilderMode,"--battle-only");
  for(const binding of V177_GROUND_MATTE_SPRITE_REPLACEMENTS){
    const actual=current.assets.find(a=>a.path===binding.path),source=provenance.records.find(a=>a.path===binding.path);
    for(const key of ["hash","bytes","sourcePath","criticality"])assert.equal(actual[key],binding.next[key]);
    assert.equal(hash(await disk(source.guide.path)),source.guide.sha256);
    const png=await raw(await disk("public"+binding.path)),webp=await raw(await disk("public"+actual.sourcePath));
    assert.equal(png.info.width,webp.info.width);assert.equal(png.info.height,webp.info.height);
    for(let i=0;i<png.data.length;i+=4){assert.equal(png.data[i+3],webp.data[i+3]);if(png.data[i+3])assert.ok(png.data.subarray(i,i+3).equals(webp.data.subarray(i,i+3)),"visible original RGB in transport");}
  }
});

test("isolated original source builders reproduce both matte sprites, transports and joint bindings byte-for-byte",async()=>{
  await fs.mkdir(path.join(root,"output"),{recursive:true});
  const fixture=await fs.mkdtemp(path.join(root,"output/ground-matte-replay-"));
  const files=["scripts/build-v177-ground-matte-assets.mjs","scripts/build-v090-kurome-prototype-assets.mjs",
    "scripts/v177-kurome-ground-matte.mjs","scripts/v100-reviewed-motion-generator.mjs","scripts/build-v177-rigid-joint-atlas.mjs",
    "assets/source/v090-prototypes/bosses/kurome-identity-master-candidate-r1.png","assets/source/v090-prototypes/bosses/kurome-pose-sheet-candidate-r1.png",
    "assets/source/v100/enemies/red-panther-knife-identity-master-r1.png","public/art/v100/provenance.json",
    "assets/source/v100/runtime/v100-runtime-assets-provenance.json",
    "assets/source/v100/sprite-repairs/ground-mattes/knife-death-matte-guide-r1.png",
    "assets/source/v100/sprite-repairs/ground-mattes/kurome-matte-guide-r1.png"];
  for(const file of files){await fs.mkdir(path.dirname(path.join(fixture,file)),{recursive:true});await fs.copyFile(path.join(root,file),path.join(fixture,file));}
  await fs.cp(path.join(root,"assets/source/v100/runtime/motion/red-panther-knife"),path.join(fixture,"assets/source/v100/runtime/motion/red-panther-knife"),{recursive:true});
  await fs.writeFile(path.join(fixture,"package.json"),JSON.stringify({type:"module"}));
  execFileSync(process.execPath,["scripts/build-v177-ground-matte-assets.mjs"],{cwd:fixture,timeout:60000,maxBuffer:2*1024*1024});
  for(const name of ["kurome-identity-candidate-r1.webp","kurome-compendium-candidate-r1.webp"]){
    await assert.rejects(fs.access(path.join(fixture,"output/v177-ground-matte-regeneration/kurome-root/public/art/v090-prototypes/bosses",name)),{code:"ENOENT"},"matte replay must not generate unchanged reference artwork");
  }
  for(const kind of ["kurome","red-panther-knife"])await fs.cp(path.join(root,"assets/source/v100/joints/"+kind+"-r1"),path.join(fixture,"assets/source/v100/joints/"+kind+"-r1"),{recursive:true});
  const child=[
    "import fs from 'node:fs';",
    "import {buildRigidJointAtlas} from './scripts/build-v177-rigid-joint-atlas.mjs';",
    "for(const kind of ['kurome','red-panther-knife']){const sourceDirectory='assets/source/v100/joints/'+kind+'-r1';const p=JSON.parse(fs.readFileSync(sourceDirectory+'/provenance.json'));await buildRigidJointAtlas({sourceDirectory,assetPath:p.assetPath,dataFile:null,description:p.source});}"
  ].join("\n");
  await fs.writeFile(path.join(fixture,"replay-joints.mjs"),child);
  execFileSync(process.execPath,["replay-joints.mjs"],{cwd:fixture,timeout:60000,maxBuffer:2*1024*1024});
  const outputs=[
    "public/art/v100/enemies/red-panther-knife-battle-v2.png","public/art/v090-prototypes/bosses/kurome-battle-candidate-r1.png",
    "public/pwa-optimized/art/v100/enemies/red-panther-knife-battle-v2.webp","public/pwa-optimized/art/v090-prototypes/bosses/kurome-battle-candidate-r1.webp",
    "public/art/v100/enemies/red-panther-knife-battle-v2-metadata.json","public/art/v100/provenance.json",
    "assets/source/v100/runtime/v100-runtime-assets-provenance.json","assets/source/v100/sprite-repairs/ground-matte-provenance.json",
    "scripts/v177-ground-matte-repair-asset-contract.mjs",
    "assets/source/v100/joints/kurome-r1/provenance.json","assets/source/v100/joints/red-panther-knife-r1/provenance.json",
    "public/art/v100/joints/kurome-r1.webp","public/art/v100/joints/red-panther-knife-r1.webp"
  ];
  for(const file of outputs)assert.ok((await fs.readFile(path.join(fixture,file))).equals(await disk(file)),"isolated regeneration: "+file);
  await fs.writeFile(path.join(root,"output/issue177-ground-matte-full-source-replay-r1.json"),JSON.stringify({at:new Date().toISOString(),fixture,outputs,byteIdentical:outputs.length,nativeAcceptance:false},null,2)+"\n");
});
