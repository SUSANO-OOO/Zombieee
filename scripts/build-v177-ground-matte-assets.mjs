import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import sharp from "sharp";
import {MOTION_DEFINITIONS,regenerateMotionAtlases} from "./v100-reviewed-motion-generator.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const stage=path.join(root,"output/v177-ground-matte-regeneration");
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const definitions=[
  {kind:"red-panther-knife",path:"/art/v100/enemies/red-panther-knife-battle-v2.png",
    previous:{bytes:838448,hash:"sha256-4e590bf00d7907132f0deadfda0af369853c4bd590e31436a8c64305623ed9be",criticality:"critical"},
    previousPNG:"7cdc0436c6edd763cc4594268db44c5853b5f35cccd2e3901146ab230b6ca881",
    pngSha256:"6551d92e7b876009dece2472081c9a3c064c5e23578acba51dab024f468781e7",
    guide:"knife-death-matte-guide-r1.png"},
  {kind:"kurome",path:"/art/v090-prototypes/bosses/kurome-battle-candidate-r1.png",
    previous:{bytes:1633244,hash:"sha256-66055ffb9ba917a89791bb2d107f7087664641bd3a319440fa82480428cdb940",criticality:"critical"},
    previousPNG:"6b29b3244d2d17af31603db37719953b578942682e38d42c83f4a15952fb8a4a",
    pngSha256:"db3501624aecc25b186e90e785569a5c3e29fa89ceaf331129f8486e588e4d99",
    guide:"kurome-matte-guide-r1.png"},
];
const local=path.join(stage,"kurome-root");
for(const name of ["scripts/build-v090-kurome-prototype-assets.mjs","scripts/v177-kurome-ground-matte.mjs",
  "assets/source/v090-prototypes/bosses/kurome-identity-master-candidate-r1.png",
  "assets/source/v090-prototypes/bosses/kurome-pose-sheet-candidate-r1.png"]){
  const target=path.join(local,name);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(path.join(root,name),target);
}
const log=execFileSync(process.execPath,["scripts/build-v090-kurome-prototype-assets.mjs"],{cwd:local,maxBuffer:2*1024*1024});
await fs.writeFile(path.join(stage,"kurome-builder.log"),log);
const knife=(await regenerateMotionAtlases(path.join(stage,"knife"),MOTION_DEFINITIONS.filter(d=>d.name==="red-panther-knife")))[0];
assert.equal(knife.metadata.sources.at(-1).repair.zeroRemovalSeeds.length,0);
const records=[],replacements=[];
for(const row of definitions){
  const candidate=row.kind==="kurome"?path.join(local,"public"+row.path):knife.output;
  const png=await fs.readFile(candidate);
  assert.equal(hash(png),row.pngSha256,"Unexpected original-source matte regeneration");
  const current=await fs.readFile(path.join(root,"public"+row.path)).catch(error=>{
    if(error.code==="ENOENT")return null;
    throw error;
  });
  if(current)assert.ok([row.previousPNG,row.pngSha256].includes(hash(current)),"Uncommitted sprite revision must not be overwritten");
  const webp=await sharp(png).webp({lossless:true,effort:6}).toBuffer();
  const sourcePath="/pwa-optimized"+row.path.replace(/\.png$/u,".webp");
  await fs.mkdir(path.dirname(path.join(root,"public"+row.path)),{recursive:true});
  await fs.mkdir(path.dirname(path.join(root,"public"+sourcePath)),{recursive:true});
  await fs.writeFile(path.join(root,"public"+row.path),png);
  await fs.writeFile(path.join(root,"public"+sourcePath),webp);
  if(row.kind==="red-panther-knife"){
    await fs.copyFile(knife.output.replace(/\.png$/u,"-metadata.json"),path.join(root,"public"+row.path.replace(/\.png$/u,"-metadata.json")));
    const reviewedFile=path.join(root,"public/art/v100/provenance.json");
    const reviewed=JSON.parse(await fs.readFile(reviewedFile,"utf8"));
    const record=reviewed.records.find(r=>r.name===row.kind);
    assert.ok(record);record.sha256=row.pngSha256;record.sources=knife.metadata.sources;
    await fs.writeFile(reviewedFile,JSON.stringify(reviewed,null,2)+"\n");
    const runtimeFile=path.join(root,"assets/source/v100/runtime/v100-runtime-assets-provenance.json");
    const runtime=JSON.parse(await fs.readFile(runtimeFile,"utf8"));
    assert.ok(runtime.outputs["/public"+row.path]);
    runtime.outputs["/public"+row.path].sha256=row.pngSha256;
    await fs.writeFile(runtimeFile,JSON.stringify(runtime,null,2)+"\n");
  }
  const guide="assets/source/v100/sprite-repairs/ground-mattes/"+row.guide;
  const next={path:row.path,sourcePath,bytes:webp.length,hash:"sha256-"+hash(webp),criticality:row.previous.criticality};
  replacements.push({path:row.path,previous:{path:row.path,...row.previous},next,delta:webp.length-row.previous.bytes});
  records.push({kind:row.kind,path:row.path,previousPNG:row.previousPNG,pngSha256:row.pngSha256,pngBytes:png.length,
    guide:{path:guide,sha256:hash(await fs.readFile(path.join(root,guide))),usage:"Visual removal guide only; no generated body RGB adopted"},
    next,sourceRepair:row.kind==="kurome"?
      {allSourceRGBRetained:true,alphaChanges:28230,states:7,directions:2,protected:"Original colored/dark body and its one-pixel edge; each authored row inspected independently"}:
      {rawSourceRGBRetained:true,deathOnly:true,otherEightCellsRgbaRetained:true,repair:knife.metadata.sources.at(-1).repair}});
}
const provenance={format:"nishijin-issue177-ground-matte-repairs",base:"e4fb2403e87989a4c6323da65eac1e269348d695",
  sourceGenerators:["scripts/build-v090-kurome-prototype-assets.mjs","scripts/v100-reviewed-motion-generator.mjs"],
  records,nativeAllActionsAcceptance:false,normalCampaignAcceptance:false,physicalRecordingAcceptance:false};
await fs.writeFile(path.join(root,"assets/source/v100/sprite-repairs/ground-matte-provenance.json"),JSON.stringify(provenance,null,2)+"\n");
await fs.writeFile(path.join(root,"scripts/v177-ground-matte-repair-asset-contract.mjs"),
  "// Generated from approved original sources by build-v177-ground-matte-assets.mjs.\nexport const V177_GROUND_MATTE_SPRITE_REPLACEMENTS = Object.freeze("+JSON.stringify(replacements,null,2)+");\n");
console.log(JSON.stringify({repairs:records.map(r=>({kind:r.kind,pngSha256:r.pngSha256,bytes:r.next.bytes,hash:r.next.hash})),nativeAcceptance:false}));
