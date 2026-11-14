import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

const root=process.cwd(),check=process.argv.includes('--check');
const folder='assets/source/quality-20261114/guard-impact-r1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sources=[
  {kind:'kumaverson',material:'pan',size:70,hash:'35fde60994cb1206ce42606333591dcb663bf42b0b1da1dd2d9dda844abd19d8'},
  {kind:'guardian',material:'shield',size:82,hash:'a287c84fb5d2b288494c4078041d2cdf7ab138774cfeb214ff523f64272330fa'},
];
async function emit(relative,bytes){
  const file=path.join(root,relative);
  if(check){const actual=await readFile(file);assert.deepEqual(/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual,bytes,relative);}
  else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}
function inspectCell(data,cell){
  const ox=cell%3*512,oy=Math.floor(cell/3)*512,stride=513;
  const integral=new Float64Array(stride*stride);let maxMarginAlpha=0,visible=0;
  for(let y=0;y<512;y++){
    let row=0;
    for(let x=0;x<512;x++){
      const i=((oy+y)*1536+ox+x)*4,a=data[i+3];
      if(x<32||x>=480||y<32||y>=480)maxMarginAlpha=Math.max(maxMarginAlpha,a);
      if(a>32)visible++;
      row+=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)*a/255;
      integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;
    }
  }
  assert.ok(maxMarginAlpha<=32,'Every cell retains32px transparent safety padding');
  assert.ok(visible>0,'All six phases must contain real paint');
  // Find the dense contact core, not a distant bright spark. An11px box
  // suppresses the thin trails; its local centroid compensates authored drift.
  let best=-1,bestDistance=Infinity,cx=0,cy=0;
  for(let y=180;y<=330;y++)for(let x=100;x<=240;x++){
    const x0=x-5,y0=y-5,x1=x+6,y1=y+6;
    const value=integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0];
    const distance=(x-180)**2+(y-256)**2;
    if(value>best||(value===best&&distance<bestDistance)){best=value;bestDistance=distance;cx=x;cy=y;}
  }
  assert.ok(best>0);
  let mass=0,px=0,py=0;
  for(let y=cy-5;y<=cy+5;y++)for(let x=cx-5;x<=cx+5;x++){
    const i=((oy+y)*1536+ox+x)*4,w=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)*data[i+3]/255;
    mass+=w;px+=(x+.5)*w;py+=(y+.5)*w;
  }
  const anchor=[px/mass/512,py/mass/512];
  assert.ok(anchor.every(Number.isFinite));
  return {frame:cell,maxMarginAlpha,visiblePixels:visible,anchor,coreBox:[cx-5,cy-5,11,11]};
}
const art={},entries=[];
for(const spec of sources){
  const masterPath=folder+'/'+spec.material+'-master-r1.png',master=await readFile(path.join(root,masterPath));
  assert.equal(sha(master),spec.hash,'Retain the selected original master');
  const metadata=await sharp(master).metadata();
  assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
  const pixels=await sharp(master).ensureAlpha().raw().toBuffer();
  const cells=Array.from({length:6},(_,cell)=>inspectCell(pixels,cell));
  const bytes=await sharp(master).resize(768,512).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
  const assetPath='/art/quality-20261114/vfx/guard-'+spec.material+'-impact-six-r1.webp';
  art[spec.kind]={id:'v100-guard-'+spec.material+'-impact',path:assetPath,hash:'sha256-'+sha(bytes),
    width:768,height:512,columns:3,rows:2,worldSize:spec.size,anchors:cells.map(c=>c.anchor)};
  await emit('public'+assetPath,bytes);
  const body=V177_JOINT_ATLASES[spec.kind],bodyBytes=await readFile(path.join(root,'public'+body.path));
  const promptPath=folder+'/'+spec.material+'-prompt-r1.txt';
  entries.push({kind:spec.kind,material:spec.material,source:{path:masterPath,bytes:master.length,sha256:sha(master)},
    prompt:{path:promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,promptPath),'utf8')).replaceAll('\r\n','\n')))},
    currentBody:{path:body.path,sha256:sha(bodyBytes),weaponBone:body.weaponBone,muzzle:body.muzzle},
    cells,output:{...art[spec.kind],bytes:bytes.length}});
}
await emit('app/v100GuardImpactArt.js',Buffer.from('// Generated data only. Safe for the installation gate.\nexport const V100_GUARD_IMPACT_ART=Object.freeze('+JSON.stringify(art,null,2)+');\n'));
const logicalBytes=entries.reduce((sum,e)=>sum+e.output.bytes,0);
await emit(folder+'/provenance-r1.json',Buffer.from(JSON.stringify({
  generator:'scripts/build-v100-guard-impact-art.mjs',
  creator:'OpenAI built-in image_gen under Producer direction; deterministic phone-sized WebP packaging by Codex',
  license:'Project-original generated effect artwork under existing game asset policy; no third-party download',
  rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original material-only contact effects created for this project'},
  producerApproval:'Current smartphone goal requests character-specific manual ability VFX; candidate,not final motion/audio/device acceptance',
  generation:{mode:'built-in image_gen generation',model:'Selected by host; no model name asserted',characterReferences:[]},
  anchorMethod:'Dense11x11 alpha-weighted luminance maximum in the measured contact window,then local centroid;normalized pixel centers',
  runtimeAssetCount:2,logicalBytes,distinctBytes:logicalBytes,estimatedDecodedRgbaBytes:2*768*512*4,
  scope:'Optional cast-iron pan and steel shield contact paint at the existing real guard-hit socket. Original body,weapon,damage,guard radius,hit receipts,duration,audio,save and old mandatory fallback remain unchanged.',entries,
},null,2)+'\n'));
console.log(JSON.stringify({check,assets:2,bytes:logicalBytes,art},null,2));
