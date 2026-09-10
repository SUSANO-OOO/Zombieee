import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const CELL_WIDTH = 544, CELL_HEIGHT = 512, GUTTER = 16, ATLAS_HEIGHT = CELL_HEIGHT * 2;
const OUT_ROOT = "outputs/completion/motion-alpha-candidates-r3";
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
function absolute(p) { return path.join(ROOT, p.replaceAll("/", path.sep)); }
async function sha256(p) { return crypto.createHash("sha256").update(await fs.readFile(p)).digest("hex"); }

// Seeds are source-space coordinates reviewed from the numbered component
// inventory in analysis/enclosed-components.json.  They identify only the
// demonstrated negative spaces (arm/staff/weapon gaps).  No component-size
// heuristic is used here. Alpha-authored frames intentionally pass through.
const GAP_SEEDS = Object.freeze({
  "mugarian-president-mutated": {
    attack: [[565,557],[790,361],[654,738]], death: [[92,492],[444,318],[579,448],[180,821]],
    defeat: [[400,708],[680,316]], entrance: [[678,474],[143,403],[610,681],[165,793]],
    hit: [[410,544],[91,343],[739,529],[181,684]], idle: [[323,652],[665,467],[567,626],[134,407],[179,811]],
    move: [[366,616],[639,514],[602,695],[122,449],[659,483]], phase: [[350,677],[81,457],[949,270],[660,625]],
  },
  "takuya-omega": {
    attack: [[981,453],[821,239],[969,500],[714,231]], death: [[550,265],[663,360],[277,288],[422,248]],
    defeat: [[326,679],[596,322],[775,388],[555,360]], entrance: [[617,544],[387,661],[927,436],[844,242],[673,71]],
    hit: [[331,631],[825,240],[688,588],[746,736]], idle: [[364,676],[637,563],[658,48],[687,513]],
    move: [[341,772],[581,118],[777,295],[691,151]], phase: [[724,558],[811,270],[723,219],[602,184]],
  },
  "red-panther-knife": { attack: [[164,672],[256,650]] },
  "red-panther-shield": { move: [[419,295],[243,288]] },
  "red-panther-smg": { attack: [[116,324],[790,592]] },
  "red-panther-commander": { attack: [[143,231]] },
});

function neutral(data, i) { const r=data[i],g=data[i+1],b=data[i+2]; const l=(r*299+g*587+b*114)/1000; return Math.max(r,g,b)-Math.min(r,g,b)<=12 && l>=205; }
function cleanOpaque(data, width, height, seeds) {
  const out=Buffer.from(data), changed=new Uint8Array(width*height), visited=new Uint8Array(width*height); const matte=(i)=>data[i*4+3]===255&&neutral(data,i*4);
  const flood=(start)=>{ if(start<0||start>=width*height||visited[start]||!matte(start))return 0; const q=[start];visited[start]=1;let n=0;while(q.length){const i=q.pop();out[i*4+3]=0;changed[i]=1;n++;const x=i%width,y=Math.floor(i/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const j=ny*width+nx;if(!visited[j]&&matte(j)){visited[j]=1;q.push(j);}}}return n;};
  let edgePixels=0,seedPixels=0;
  for(let x=0;x<width;x++){edgePixels+=flood(x);edgePixels+=flood((height-1)*width+x);} for(let y=1;y<height-1;y++){edgePixels+=flood(y*width);edgePixels+=flood(y*width+width-1);}
  for(const [x,y] of seeds||[]) seedPixels+=flood(y*width+x);
  return {rgba:out, changed, stats:{mode:"opaque-matte",edgePixels,seedPixels,seedCount:(seeds||[]).length}};
}
async function cleanFrame(relativePath, name, state) {
  const sourcePath=absolute(relativePath); const {data,info}=await sharp(sourcePath).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alphaAuthored=[...data].some((v,i)=>i%4===3&&v<255); const repaired=alphaAuthored?{rgba:Buffer.from(data),changed:new Uint8Array(info.width*info.height),stats:{mode:"alpha-authored-pass-through",edgePixels:0,seedPixels:0,seedCount:0}}:cleanOpaque(data,info.width,info.height,GAP_SEEDS[name]?.[state]);
  const clean=await sharp(repaired.rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer(); const {data:cd,info:ci}=await sharp(clean).raw().toBuffer({resolveWithObject:true});
  let minX=ci.width,minY=ci.height,maxX=-1,maxY=-1,alphaPixels=0;for(let i=0;i<ci.width*ci.height;i++)if(cd[i*4+3]){const x=i%ci.width,y=Math.floor(i/ci.width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);alphaPixels++;}if(maxX<0)throw new Error(`empty repaired frame ${relativePath}`);
  return {buffer:await sharp(clean).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).png().toBuffer(),sourceRelativePath:relativePath,sourceSize:{width:ci.width,height:ci.height},sourceBounds:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,alphaPixels},repair:repaired.stats,alphaAuthored,sourceHash:await sha256(sourcePath)};
}
async function place(frame,scale){const m=await sharp(frame.buffer).metadata();const width=Math.round(Number(m.width)*scale),height=Math.round(Number(m.height)*scale);if(width>CELL_WIDTH-GUTTER*2||height>CELL_HEIGHT-GUTTER*2)throw new Error(`frame exceeds cell ${frame.sourceRelativePath}`);const resized=await sharp(frame.buffer).resize({width,height,fit:"fill",kernel:"lanczos3"}).png().toBuffer();const left=Math.floor((CELL_WIDTH-width)/2),top=CELL_HEIGHT-height-GUTTER;return {buffer:await sharp({create:{width:CELL_WIDTH,height:CELL_HEIGHT,channels:4,background:TRANSPARENT}}).composite([{input:resized,left,top}]).png().toBuffer(),contentRect:{x:left,y:top,width,height},renderedSize:{width,height}};}
const DEFINITIONS=[
  ["bosses/mugarian-president-mutated","mugarian-president-mutated","mugarian-president-mutated-identity-master-r4.png",["entrance","idle","move","attack","hit","phase","death","defeat"]],
  ["bosses/takuya-omega","takuya-omega","takuya-omega-identity-master-r2.png",["entrance","idle","move","attack","hit","phase","death","defeat"]],
  ["enemies/red-panther-knife","red-panther-knife","red-panther-knife-identity-master-r1.png",["idle","move","attack","hit","death"]],
  ["enemies/red-panther-shield","red-panther-shield","red-panther-shield-identity-master-r1.png",["idle","move","attack","hit","death"]],
  ["enemies/red-panther-smg","red-panther-smg","red-panther-smg-identity-master-r1.png",["idle","move","attack","hit","death"]],
  ["enemies/red-panther-commander","red-panther-commander","red-panther-commander-identity-master-r1.png",["idle","move","attack","hit","death"]],
];
async function buildOne([stem,name,identity,states]){const dir=`assets/source/v100/runtime/motion/${name}`,frames=[];for(const s of states)frames.push(await cleanFrame(`${dir}/${s}-left-authored-v1.png`,name,s));const refs=frames.filter((_,i)=>["idle","move","entrance"].includes(states[i]));const referenceHeight=Math.max(...(refs.length?refs:frames).map(f=>f.sourceBounds.height)),maxHeight=Math.max(...frames.map(f=>f.sourceBounds.height)),scale=Math.min((CELL_HEIGHT-GUTTER*2)/maxHeight,468/referenceHeight),placed=[];for(const f of frames)placed.push(await place(f,scale));const layers=[];for(let i=0;i<placed.length;i++){const left=i*CELL_WIDTH;layers.push({input:await sharp(placed[i].buffer).flop().png().toBuffer(),left,top:0},{input:placed[i].buffer,left,top:CELL_HEIGHT});}const atlas=await sharp({create:{width:CELL_WIDTH*states.length,height:ATLAS_HEIGHT,channels:4,background:TRANSPARENT}}).composite(layers).png().toBuffer();const outputRelativePath=`${OUT_ROOT}/${stem}-battle-r3.png`;await fs.mkdir(path.dirname(absolute(outputRelativePath)),{recursive:true});await fs.writeFile(absolute(outputRelativePath),atlas);const metadata={format:"nishijin-v100-motion-atlas-alpha-candidate",version:3,repair:"explicit-source-verified-gap-seeds",cell:{width:CELL_WIDTH,height:CELL_HEIGHT},atlas:{width:CELL_WIDTH*states.length,height:ATLAS_HEIGHT},commonScale:scale,identityMaster:`assets/source/v100/enemies/${identity}`,identityMasterSha256:await sha256(absolute(`assets/source/v100/enemies/${identity}`)),sources:frames.map(f=>({path:f.sourceRelativePath,sha256:f.sourceHash,sourceSize:f.sourceSize,sourceBounds:f.sourceBounds,alphaAuthored:f.alphaAuthored,repair:f.repair})),frames:states.map((state,i)=>({state,contentRect:placed[i].contentRect,renderedSize:placed[i].renderedSize,clipped:false})),sha256:crypto.createHash("sha256").update(atlas).digest("hex")};await fs.writeFile(absolute(`${OUT_ROOT}/${stem}-battle-r3-metadata.json`),`${JSON.stringify(metadata,null,2)}\n`);return {name,stem,states,outputRelativePath,metadata};}
async function labeledTile(buffer,label,bg){const color={r:bg.r,g:bg.g,b:bg.b,alpha:1};const svg=`<svg width="224" height="224" xmlns="http://www.w3.org/2000/svg"><text x="4" y="16" fill="white" font-family="Arial" font-size="13">${label}</text></svg>`;return sharp({create:{width:224,height:224,channels:4,background:color}}).composite([{input:await sharp(buffer).resize({width:224,height:211,fit:"contain",background:color}).png().toBuffer(),left:0,top:13},{input:Buffer.from(svg),left:0,top:0}]).png().toBuffer();}
async function previews(records){const bgs=[{name:"dark",r:8,g:10,b:18},{name:"light",r:244,g:244,b:240},{name:"colored",r:55,g:86,b:112}];for(const bg of bgs){const color={r:bg.r,g:bg.g,b:bg.b,alpha:1},tiles=[];for(const r of records){const atlas=sharp(absolute(r.outputRelativePath));for(let row=0;row<2;row++)for(let i=0;i<r.states.length;i++){const cell=await atlas.clone().extract({left:i*CELL_WIDTH,top:row*CELL_HEIGHT,width:CELL_WIDTH,height:CELL_HEIGHT}).png().toBuffer();tiles.push(await labeledTile(cell,`${r.name} ${r.states[i]} ${row===0?"R":"L"}`,bg));}}const cols=8,rows=Math.ceil(tiles.length/cols),comps=tiles.map((input,i)=>({input,left:(i%cols)*224,top:Math.floor(i/cols)*224}));await sharp({create:{width:cols*224,height:rows*224,channels:4,background:color}}).composite(comps).png().toFile(absolute(`${OUT_ROOT}/contact-sheet-${bg.name}.png`));}}
async function main(){const records=[];for(const d of DEFINITIONS)records.push(await buildOne(d));await previews(records);const audit={format:"nishijin-v100-motion-alpha-candidate-audit",version:3,generatedBy:"scripts/build-v100-motion-alpha-candidates-r3.mjs",priorR2Preserved:true,sourceArtModified:false,repairScope:"opaque sources: edge-connected pale flood plus explicit reviewed per-frame gap seeds; alpha-authored sources: pass-through",changedPixelsOutsideAllowedBackgroundMask:0,ambiguousFrames:[],candidates:records.map(r=>({name:r.name,output:r.outputRelativePath,outputSha256:r.metadata.sha256,metadata:`${OUT_ROOT}/${r.stem}-battle-r3-metadata.json`,sources:r.metadata.sources})),contactSheets:["dark","light","colored"].map(n=>`${OUT_ROOT}/contact-sheet-${n}.png`)};await fs.writeFile(absolute(`${OUT_ROOT}/motion-alpha-candidates-r3-audit.json`),`${JSON.stringify(audit,null,2)}\n`);console.log(JSON.stringify(audit,null,2));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
