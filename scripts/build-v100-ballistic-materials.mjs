import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=process.cwd(),check=process.argv.includes('--check');
const folder='assets/source/quality-20261115/vfx/ballistic-materials-r1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const recipe=JSON.parse(await readFile(path.join(root,folder,'selected-recipe.json'),'utf8'));
const master=await readFile(path.join(root,recipe.masterPath));
assert.equal(sha(master),recipe.masterSha256,'Selected ballistic material changed');
assert.ok(master.length<25*1024*1024,'Master requires storage review');
const metadata=await sharp(master).metadata();
assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
const raw=await sharp(master).ensureAlpha().raw().toBuffer();
const frames=[];
for(let cell=0;cell<6;cell++){
 const ox=cell%3*512,oy=Math.floor(cell/3)*512;
 let edge=0,visible=0,minX=512,maxX=-1,minY=512,maxY=-1,tipX=-1;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const i=((oy+y)*1536+ox+x)*4,a=raw[i+3];
  if(x<32||x>=480||y<32||y>=480)edge=Math.max(edge,a);
  if(a>32)visible++;
  if(a>=200){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  const light=(raw[i]*.2126+raw[i+1]*.7152+raw[i+2]*.0722)*a/255;
  if(cell<3&&y>=190&&y<=320&&light>=100)tipX=Math.max(tipX,x);
 }
 assert.ok(edge<=32&&visible>0,'Transparent material gutters and paint required');
 if(cell<3){
  assert.ok(tipX>300&&tipX<480,'A real leading glint must be inside its cell');
  let mass=0,px=0,py=0;
  for(let y=190;y<=320;y++)for(let x=tipX-6;x<=tipX;x++){
   const i=((oy+y)*1536+ox+x)*4,w=(raw[i]*.2126+raw[i+1]*.7152+raw[i+2]*.0722)*raw[i+3]/255;
   mass+=w;px+=(x+.5)*w;py+=(y+.5)*w;
  }
  assert.ok(mass>0);frames.push({role:recipe.roles[cell],frame:cell,anchorX:px/mass/512,anchorY:py/mass/512,maxMarginAlpha:edge,visiblePixels:visible});
 }else{
  assert.ok(maxX>minX&&maxY>minY);
  frames.push({role:recipe.roles[cell],frame:cell,anchorX:(minX+maxX+1)/1024,anchorY:(minY+maxY+1)/1024,
   bodyWidthFraction:(maxX-minX+1)/512,bodyHeightFraction:(maxY-minY+1)/512,maxMarginAlpha:edge,visiblePixels:visible});
 }
}
async function emit(relative,bytes){
 const file=path.join(root,relative);
 if(check){const actual=await readFile(file),normalized=/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual;assert.deepEqual(normalized,bytes,relative+' differs from source');}
 else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}
const bytes=await sharp(master).resize(768,512).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
const art={materials:{id:'v100-ballistic-materials',path:'/art/quality-20261115/vfx/ballistic-materials-six-r1.webp',hash:'sha256-'+sha(bytes),width:768,height:512,columns:3,rows:2,
 frames:frames.map(({role,frame,anchorX,anchorY,bodyWidthFraction,bodyHeightFraction})=>({role,frame,anchorX,anchorY,...(bodyWidthFraction?{bodyWidthFraction,bodyHeightFraction}:{})}))}};
await emit('public'+art.materials.path,bytes);
await emit('app/v100BallisticMaterialArt.js',Buffer.from('// Generated data only. PwaGate must not import a battle renderer.\nexport const V100_BALLISTIC_MATERIAL_ART=Object.freeze('+JSON.stringify(art,null,2)+');\n'));
await emit(folder+'/provenance-r1.json',Buffer.from(JSON.stringify({generator:'scripts/build-v100-ballistic-materials.mjs',
 creator:'OpenAI built-in image_gen under Producer direction; deterministic smartphone packaging by Codex',
 license:'Project-original generated material artwork under existing game asset policy; no third-party download',
 rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original material-only glints and empty cases for this project'},
 producerApproval:'Smartphone goal requests authored ordinary weapon effects without placeholder shapes. Candidate, not final animation, listening or physical acceptance.',
 source:{path:recipe.masterPath,bytes:master.length,sha256:sha(master)},
 prompt:{path:recipe.promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,recipe.promptPath),'utf8')).replaceAll('\r\n','\n')))},
 generation:{mode:'built-in image_gen generation',model:'Selected by host; no model name asserted',characterReferences:[]},
 calibration:recipe.calibration,frames,output:{...art.materials,bytes:bytes.length},runtimeAssetCount:1,logicalBytes:bytes.length,estimatedDecodedRgbaBytes:768*512*4,
 scope:'Ordinary firearm flight glints and spent cases only; no body, weapon identity, shot trajectory, damage, clock, RNG, audio, rewards or save change.'
},null,2)+'\n'));
console.log(JSON.stringify({check,bytes:bytes.length,sha256:sha(bytes),frames},null,2));
