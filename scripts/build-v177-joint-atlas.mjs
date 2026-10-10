// Offline bake of actual Blender joint exports. Runtime uses two image layers;
// it does not deform a whole painted character or allocate per-fighter canvases.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';

const moduleIndex = process.argv.indexOf('--canvas-module');
const canvasModule = moduleIndex < 0 ? '@napi-rs/canvas' : pathToFileURL(path.resolve(process.argv[moduleIndex + 1])).href;
const { createCanvas, loadImage } = await import(canvasModule);
const sourceDir = path.resolve('assets/source/v100/joints/ranger-r1');
const definition = JSON.parse(await readFile(path.join(sourceDir, 'parts.json'), 'utf8'));
const motionBytes = await readFile(path.join(sourceDir, 'motion.json.gz'));
const motion = JSON.parse(gunzipSync(motionBytes));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(await readFile(path.resolve('public'+definition.identityBinding.path))),definition.identityBinding.sourceSha256,'Changed approved identity atlas');
assert.equal(sha(await readFile(path.join(sourceDir,'identity-reference.png'))),definition.sourceSha256,'Changed identity reference');
const images = {};
for (const name of definition.order) {
  const part = definition.parts.find(p => p.name === name);
  const bytes = await readFile(path.join(sourceDir, part.file));
  assert.equal(sha(bytes), part.sha256, `Changed joint source: ${name}`);
  images[name] = await loadImage(bytes);
}
const lowerNames = new Set(definition.lowerLayers);
assert.ok(definition.order.some(name => lowerNames.has(name)));
const actions = new Map(motion.actions.map(action => [action.name, action]));
const count = 30;
const transform = (m, [x,y]) => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
function triangle(ctx, image, source, target) {
  const [a,b,c] = source, [u,v,w] = target;
  const det = (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  assert.ok(Math.abs(det) > 1e-6);
  const m0 = ((v[0]-u[0])*(c[1]-a[1])-(w[0]-u[0])*(b[1]-a[1]))/det;
  const m2 = ((w[0]-u[0])*(b[0]-a[0])-(v[0]-u[0])*(c[0]-a[0]))/det;
  const m1 = ((v[1]-u[1])*(c[1]-a[1])-(w[1]-u[1])*(b[1]-a[1]))/det;
  const m3 = ((w[1]-u[1])*(b[0]-a[0])-(v[1]-u[1])*(c[0]-a[0]))/det;
  ctx.save(); ctx.beginPath();
  target.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath(); ctx.clip();
  ctx.setTransform(m0,m1,m2,m3,u[0]-m0*a[0]-m2*a[1],u[1]-m1*a[0]-m3*a[1]);
  ctx.drawImage(image,0,0); ctx.restore();
}
function raster(frame, upper, removeBob = false) {
  const canvas = createCanvas(definition.width, definition.height), ctx = canvas.getContext('2d');
  const dx = frame.bones.root.head[0] - actions.get('walk').frames[0].bones.root.head[0];
  const dy = removeBob ? frame.bones.pelvis.head[1] - definition.pelvisY : 0;
  for (const name of definition.order) {
    if (lowerNames.has(name) === upper) continue;
    if (frame.meshes[name]) {
      const mesh = motion.meshDefinitions[name], points = frame.meshes[name].map(([x,y]) => [x-dx,y-dy]);
      for (const t of mesh.triangles) triangle(ctx,images[name],t.map(j=>mesh.sourcePositions[j]),t.map(j=>points[j]));
    } else {
      const p = definition.parts.find(p => p.name === name), m = frame.deform[p.bone];
      ctx.save(); ctx.setTransform(m[0],m[1],m[2],m[3],m[4]-dx,m[5]-dy);
      ctx.drawImage(images[name],0,0); ctx.restore();
    }
  }
  return canvas;
}
function bounds(canvas) {
  const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>=8){
    x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
  }
  assert.ok(x0>0&&y0>0&&x1<canvas.width-1&&y1<canvas.height-1,'Clipped authored layer');
  return {x:Math.max(0,x0-2),y:Math.max(0,y0-2),w:Math.min(canvas.width,x1+3)-Math.max(0,x0-2),h:Math.min(canvas.height,y1+3)-Math.max(0,y0-2)};
}
const lower = [], pelvisOffsets = [];
for (const actionName of ['walk','settle-1','settle-2','settle-3']) {
  const action = actions.get(actionName), offsets = [];
  for(let i=0;i<count;i++) {
    const frame=action.frames[i*2]; lower.push(raster(frame,false));
    offsets.push(frame.bones.pelvis.head[1]-definition.pelvisY);
  }
  pelvisOffsets.push(offsets);
}
const attack = actions.get('attack');
const upper = [raster(actions.get('walk').frames[0],true,true)], muzzles = [definition.muzzle];
for(let i=0;i<=count;i++) {
  upper.push(raster(attack.frames[i*2],true));
  muzzles.push(transform(attack.frames[i*2].deform[definition.weaponBone],definition.muzzle));
}
const rows = [...lower,...upper].map(canvas => ({canvas, bounds:bounds(canvas)}));
// A fixed source-to-texture ratio prevents an individual pose from changing
// character proportions. The atlas has transparent padding between cells.
const ratio=.4, padding=2, width=1024;
let x=padding,y=padding,rowHeight=0;
for(const row of rows) {
  const w=Math.ceil(row.bounds.w*ratio),h=Math.ceil(row.bounds.h*ratio);
  if(x+w+padding>width){x=padding;y+=rowHeight+padding;rowHeight=0;}
  row.rect={x,y,w,h}; x+=w+padding;rowHeight=Math.max(rowHeight,h);
}
const height=y+rowHeight+padding;
assert.ok(width*height*4<=6*1024*1024,'Joint atlas exceeds decoded memory budget');
const atlas=createCanvas(width,height),ctx=atlas.getContext('2d');
for(const row of rows) {
  const b=row.bounds,r=row.rect;
  ctx.drawImage(row.canvas,b.x,b.y,b.w,b.h,r.x,r.y,r.w,r.h);
}
const assetPath='/art/v100/joints/ranger-r1.webp';
const bytes=await sharp(atlas.toBuffer('image/png')).webp({lossless:true,effort:6}).toBuffer();
await mkdir(path.resolve('public/art/v100/joints'),{recursive:true});
await writeFile(path.resolve('public'+assetPath),bytes);
const frameRows=rows.map(({bounds,rect})=>({source:rect,destination:bounds}));
const data={ranger:{key:'joint-ranger',path:assetPath,width:definition.width,height:definition.height,
  frameCount:count,settleLevels:4,cycleDistance:definition.motion.walk.spanPx/.62,
  decodedWidth:width,decodedHeight:height,decodedBytes:width*height*4,
  frames:frameRows,pelvisOffsets,muzzles,lowerCount:lower.length}};
await writeFile(path.resolve('app/v177JointData.js'),`// Generated by scripts/build-v177-joint-atlas.mjs; source-bound Blender bake.\nexport const V177_JOINT_ATLASES = Object.fromEntries(Object.entries(${JSON.stringify(data)}));\n`);
const provenance={schema:'zombieee-joint-atlas/1',kind:'ranger',assetPath,sha256:sha(bytes),bytes:bytes.length,
  generatedPartsStudySha256:definition.sheetSha256,identitySourceSha256:definition.sourceSha256,
  identityBinding:definition.identityBinding,
  motionSha256:sha(motionBytes),parts:definition.parts.map(({name,file,sha256,original})=>({name,file,sha256,original:Boolean(original)})),
  source:'Blender 5.2 real bone poses and explicit clothing meshes; original head, rifle and hands',
  groundY:definition.motion.walk.groundY,decodedBytes:data.ranger.decodedBytes,
  scope:{totalUnits:48,integratedCandidateUnits:1,allUnitAcceptance:false,normalPlayAcceptance:false},
  frames:frameRows.length};
await writeFile(path.join(sourceDir,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({assetPath,bytes:bytes.length,atlas:[width,height],decodedBytes:data.ranger.decodedBytes,frames:frameRows.length}));
