import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {V100_EVENT_EXPRESSIONS, V100_EVENT_PORTRAIT_PROFILES, V100_R5_STORY_CUTS} from "../app/v100StoryDirection.js";
import {V100_RETREAT_DOOR_ART} from "../app/v100BasePresentation.js";
const sourceRoot="assets/source/v100/story-r5";
const provenance=JSON.parse(await fs.readFile(sourceRoot+"/imagegen-specs.json","utf8"));
const digest=buffer=>createHash("sha256").update(buffer).digest("hex");
const outputs=[];
async function output(assetPath,buffer,source,recipe) {
 const destination="public"+assetPath;
 await fs.mkdir(path.dirname(destination),{recursive:true});
 let old=null; try { old=await fs.readFile(destination); } catch(error) { if(error.code!=="ENOENT") throw error; }
 if(!old || !old.equals(buffer)) await fs.writeFile(destination,buffer);
 outputs.push({assetPath,bytes:buffer.length,sha256:digest(buffer),source:source.path,sourceSha256:source.selectedSha256,recipe});
}
for(const profile of new Set(Object.values(V100_EVENT_PORTRAIT_PROFILES))) {
 const source=provenance.records.find(record=>record.name===profile && record.kind==="expression");
 if(!source) throw new Error("Missing identity expression atlas: "+profile);
 const bytes=await fs.readFile(source.path);
 if(digest(bytes)!==source.selectedSha256 || !source.hasAlpha || source.width%2 || source.height%2) throw new Error("Invalid source atlas: "+profile);
 const width=source.width/2,height=source.height/2;
 for(const [index,expression] of V100_EVENT_EXPRESSIONS.entries()) {
  // Split the generated sprite sheet and normalize its canvas without changing
  // face, anatomy, colors or costume. Crop only the bottom framing margin.
  const extraction={left:(index%2)*width,top:Math.floor(index/2)*height,width,height:Math.floor(height*.96)};
  const buffer=await sharp(bytes).extract(extraction).resize(512,640,{fit:"contain",position:"bottom",background:"#00000000"}).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
  await output(`/art/v100/story-r5/portraits/${profile}-${expression}.webp`,buffer,source,{extraction,width:512,height:640,fit:"contain",position:"bottom",quality:94,alphaQuality:100});
 }
}
for(const [name,assetPath] of Object.entries(V100_R5_STORY_CUTS)) {
 const source=provenance.records.find(record=>record.name===(name==="chiha-confession"?"chiha-confession-r2":name) && record.kind==="cut");
 if(!source) throw new Error("Missing narrative cut: "+name);
 const bytes=await fs.readFile(source.path);
 if(digest(bytes)!==source.selectedSha256) throw new Error("Changed source cut: "+name);
 await output(assetPath,await sharp(bytes).resize(1280,720,{fit:"cover",position:"centre"}).webp({quality:94,effort:6}).toBuffer(),source,{width:1280,height:720,fit:"cover",quality:94});
}
const retreat=provenance.records.find(record=>record.name==="maintenance-retreat-door"&&record.kind==="object");
if(!retreat || !retreat.hasAlpha) throw new Error("Missing transparent R5 retreat doorway");
const retreatBytes=await fs.readFile(retreat.path);
if(digest(retreatBytes)!==retreat.selectedSha256) throw new Error("Changed retreat source");
await output(V100_RETREAT_DOOR_ART,await sharp(retreatBytes).resize(768,576,{fit:"contain",background:"#00000000"}).webp({quality:94,alphaQuality:100,effort:6}).toBuffer(),retreat,{width:768,height:576,fit:"contain",quality:94,alphaQuality:100});
await fs.writeFile(sourceRoot+"/runtime-provenance.json",JSON.stringify({schemaVersion:1,sourceTool:provenance.tool,identityPolicy:"Original character masters retained; waist-up expression sheets and R5 story cuts",outputs},null,2)+"\n");
console.log(JSON.stringify({outputs:outputs.length,bytes:outputs.reduce((sum,row)=>sum+row.bytes,0)}));
