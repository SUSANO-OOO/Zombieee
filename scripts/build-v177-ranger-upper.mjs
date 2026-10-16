// Retain every decoded cell of the original weighted lower bake, and append
// crops of the same approved upper paint for continuous weapon/arm IK.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES as baked} from '../app/v177JointData.js';
import {V177_RANGER_CARRY} from '../app/v177RangerUpperMotion.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pins={
  'author.py':'d2907d00cc1e4a82c4ea31658511d1647dc4f78a333cfd1835af7561972fd25e',
  'parts.json':'3268cf5f364951ac792c5c4aca9fe3478c55a4a719f0a4f276722bf9fae7f89c',
  'motion.json.gz':'863cbb7a10f613f9c6fa77025bec706328a857efb40a793e1056d51498ddc386',
};
const basePath='/art/v100/joints/ranger-r1.webp';
const baseSha='eb70556d6c4e0d53ec812da6b5a95de91dd0d4d6cb87cd6da1a0c0d61672ed5e';
const baseFieldsSha='d1320ed433a08eebdf64047e5b1fb80e780be0bdfc3f322b0b71f21b27ae115e';
const dataPath='app/v177JointData.js',assetPath='/art/v100/joints/ranger-r2.webp';
const provenancePath='assets/source/v177/ranger/upper-r2/provenance.json';
const fieldNames=['key','width','height','frameCount','settleLevels','cycleDistance','frames','pelvisOffsets','muzzles','lowerCount'];

export async function buildV177RangerUpper({root=process.cwd(),check=false}={}) {
  const sourceDir=path.join(root,'assets/source/v100/joints/ranger-r1'),inputs={};
  for(const [file,expected]of Object.entries(pins)){
    inputs[file]=await readFile(path.join(sourceDir,file));assert.equal(sha(inputs[file]),expected,'Changed original ranger source: '+file);
  }
  const definition=JSON.parse(inputs['parts.json']),motion=JSON.parse(gunzipSync(inputs['motion.json.gz']));
  assert.equal(sha(await readFile(path.join(sourceDir,'identity-reference.png'))),definition.sourceSha256);
  assert.equal(sha(await readFile(path.join(root,'public'+definition.identityBinding.path))),definition.identityBinding.sourceSha256);
  const original=Object.fromEntries(fieldNames.map(k=>[k,baked.ranger[k]]));
  assert.equal(sha(JSON.stringify(original)),baseFieldsSha,'Changed legacy lower/upper cell coordinates');
  assert.equal(original.lowerCount,120);assert.equal(original.frames.length,152);
  const baseBytes=await readFile(path.join(root,'public'+basePath));assert.equal(sha(baseBytes),baseSha);
  const base=await sharp(baseBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(base.info.width,1024);assert.equal(base.info.height,1013);
  const lower=new Set(definition.lowerLayers),rows=[],partBindings=[];
  let x=2,y=base.info.height+2,rowHeight=0;
  for(const name of definition.order){
    const part=definition.parts.find(p=>p.name===name),bytes=await readFile(path.join(sourceDir,part.file));
    assert.equal(sha(bytes),part.sha256,'Changed original part: '+name);
    partBindings.push({name,file:part.file,sha256:part.sha256,original:Boolean(part.original)});
    if(lower.has(name))continue;
    assert.ok(part.bone&&!part.kind,'Upper paint must be rigid and source-bound');
    const raw=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let x0=raw.info.width,y0=raw.info.height,x1=-1,y1=-1;
    for(let yy=0;yy<raw.info.height;yy++)for(let xx=0;xx<raw.info.width;xx++)if(raw.data[(yy*raw.info.width+xx)*4+3]>0){
      x0=Math.min(x0,xx);y0=Math.min(y0,yy);x1=Math.max(x1,xx);y1=Math.max(y1,yy);
    }
    assert.ok(x1>=x0&&y1>=y0,name);x0=Math.max(0,x0-1);y0=Math.max(0,y0-1);
    x1=Math.min(raw.info.width-1,x1+1);y1=Math.min(raw.info.height-1,y1+1);
    const destination={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
    const w=Math.ceil(destination.w*.5),h=Math.ceil(destination.h*.5);
    if(x+w+2>base.info.width){x=2;y+=rowHeight+2;rowHeight=0;}
    const pixels=await sharp(bytes).extract({left:x0,top:y0,width:destination.w,height:destination.h})
      .resize(w,h,{kernel:'cubic'}).ensureAlpha().raw().toBuffer();
    rows.push({name,bone:part.bone,source:{x,y,w,h},destination,upper:true,pixels});
    x+=w+2;rowHeight=Math.max(rowHeight,h);
  }
  assert.equal(rows.length,7);
  const width=base.info.width,height=y+rowHeight+2,decodedBytes=width*height*4;
  assert.ok(decodedBytes<=6*1024*1024,'Hybrid ranger exceeds existing decoded memory budget');
  const rgba=Buffer.alloc(decodedBytes);base.data.copy(rgba);
  for(const row of rows)for(let yy=0;yy<row.source.h;yy++)row.pixels.copy(rgba,
    ((row.source.y+yy)*width+row.source.x)*4,yy*row.source.w*4,(yy+1)*row.source.w*4);
  // exact also retains RGB under alpha=0; every legacy decoded byte is a control.
  const asset=await sharp(rgba,{raw:{width,height,channels:4}}).webp({lossless:true,exact:true,effort:6}).toBuffer();
  const decoded=await sharp(asset).ensureAlpha().raw().toBuffer();
  if(!decoded.subarray(0,base.data.length).equals(base.data)){
    let alpha=0,visibleRgb=0,transparentRgb=0;
    for(let i=0;i<base.data.length;i+=4){if(base.data[i+3]!==decoded[i+3])alpha++;
      for(let c=0;c<3;c++)if(base.data[i+c]!==decoded[i+c]){if(base.data[i+3]>0)visibleRgb++;else transparentRgb++;}}
    throw new Error('Legacy decoded cells changed: '+JSON.stringify({alpha,visibleRgb,transparentRgb}));
  }
  const actions=new Map(motion.actions.map(a=>[a.name,a])),walk=actions.get('walk'),attack=actions.get('attack');
  const bones=rows.map(p=>p.bone),rootX=walk.frames[0].bones.root.head[0];
  const upperPose=(frame,removeBob=false)=>{
    const dx=frame.bones.root.head[0]-rootX,dy=removeBob?frame.bones.pelvis.head[1]-definition.pelvisY:0;
    return Object.fromEntries(bones.map(bone=>{const m=[...frame.deform[bone]];m[4]-=dx;m[5]-=dy;return [bone,m];}));
  };
  const upperRig={frameCount:30,attackStartIndex:1,parts:rows.map(({pixels,...part})=>{void pixels;return part;}),
    poses:[upperPose(walk.frames[0],true),...Array.from({length:31},(_,i)=>upperPose(attack.frames[i*2]))],
    weaponBone:definition.weaponBone,muzzle:definition.muzzle,
    interpolationPivots:{spine:[232.5,228.5],head:[230.5,112],'weapon-0':[244,173]},
    parentAttachments:{head:{parent:'spine',pivot:[230.5,112]}},
    armConstraints:[
      {shoulder:[208,110],elbow:[188,144],wrist:[224,158],upperBone:'arm-0-upper',lowerBone:'arm-0-lower',parentBone:'spine',effectorBone:'weapon-0'},
      {shoulder:[253,114],elbow:[260,173],wrist:[283,191],upperBone:'arm-1-upper',lowerBone:'arm-1-lower',parentBone:'spine',effectorBone:'weapon-0'},
    ]};
  const data={ranger:{...original,path:assetPath,decodedWidth:width,decodedHeight:height,decodedBytes,upperRig}};
  const dataBytes=Buffer.from('// Generated by scripts/build-v177-ranger-upper.mjs; original weighted lower cells and same-source continuous upper rig.\nexport const V177_JOINT_ATLASES = Object.fromEntries(Object.entries('+JSON.stringify(data)+'));\n');
  const generator=await readFile(new URL(import.meta.url)),carry=await readFile(path.join(root,'app/v177RangerUpperMotion.js'));
  const provenance={schema:'zombieee-ranger-hybrid/1',kind:'ranger',assetPath,bytes:asset.length,sha256:sha(asset),decodedBytes,
    identityBinding:definition.identityBinding,identityReferenceSha256:definition.sourceSha256,originalInputs:pins,
    originalAtlas:{path:basePath,sha256:baseSha,decodedWidth:1024,decodedHeight:1013,retainedCells:152,retainedLowerCells:120,decodedRgbaExact:true},
    parts:partBindings,sourceOrder:upperRig.parts.map(p=>p.name),attackFrames:{source:'original evaluated Blender attack',keys:31,frameStep:2},
    derivedMotion:true,originalWalkUpperFixed:true,carryRecipe:V177_RANGER_CARRY,
    generator:{file:'scripts/build-v177-ranger-upper.mjs',sha256:sha(generator),sharp:sharp.versions.sharp,vips:sharp.versions.vips},
    carryImplementation:{file:'app/v177RangerUpperMotion.js',sha256:sha(carry)},data:{file:dataPath,sha256:sha(dataBytes)},
    visualAcceptance:false,originalSpeedAcceptance:false,performanceAcceptance:false,allUnitAcceptance:false};
  const outputs=[['public'+assetPath,asset],[dataPath,dataBytes],[provenancePath,Buffer.from(JSON.stringify(provenance,null,2)+'\n')]];
  for(const [file,bytes]of outputs){const absolute=path.join(root,file);
    if(check)assert.ok((await readFile(absolute)).equals(bytes),'Generated ranger output drift: '+file);
    else {await mkdir(path.dirname(absolute),{recursive:true});await writeFile(absolute,bytes);}
  }
  return {assetPath,decodedBytes,atlas:[width,height],upperParts:7,retainedLowerCells:120,
    outputs:outputs.map(([file,bytes])=>({file,bytes:bytes.length,sha256:sha(bytes)})),checked:check};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  console.log(JSON.stringify(await buildV177RangerUpper({check:process.argv.includes('--check')})));
