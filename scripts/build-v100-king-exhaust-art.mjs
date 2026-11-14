import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=process.cwd(),check=process.argv.includes('--check');
const folder='assets/source/quality-20261114/king-exhaust-r1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const masterPath=folder+'/master-r2.png',master=await readFile(path.join(root,masterPath));
assert.equal(sha(master),'d78285677836d15eea8ac2a8cbcb5dd5a50ae45328ac834b0b789cd8848462d9');
const metadata=await sharp(master).metadata();
assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
const raw=await sharp(master).ensureAlpha().raw().toBuffer();
for(let cell=0;cell<6;cell++)for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  if(x>=4&&x<508&&y>=4&&y<508)continue;
  assert.ok(raw[((Math.floor(cell/3)*512+y)*1536+cell%3*512+x)*4+3]<=32,'Exhaust cell must retain transparent padding');
}
const bindingPath=folder+'/body-source-binding-r1.json';
const binding=JSON.parse(await readFile(path.join(root,bindingPath),'utf8'));
assert.equal(sha(await readFile(path.join(root,binding.bodySource))),binding.bodySha256,'Approved saw body changed; recalibrate its vent');
const part=binding.sourcePart;
const sourcePoint=binding.packedSourcePoint.map((v,i)=>part.destination[i?'y':'x']+(v-part.source[i?'y':'x'])/part.source[i?'h':'w']*part.destination[i?'h':'w']);
assert.deepEqual(sourcePoint,binding.assembledCandidatePoint);
assert.equal(binding.weaponBone,'weapon-0');
async function emit(relative,bytes){
  const file=path.join(root,relative);
  if(check){const actual=await readFile(file);assert.deepEqual(/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual,bytes,relative);}
  else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}
const bytes=await sharp(master).resize(768,512).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
const assetPath='/art/quality-20261114/vfx/king-exhaust-six-r2.webp';
const art={'crazy-king':{id:'v100-king-exhaust',path:assetPath,hash:'sha256-'+sha(bytes),width:768,height:512,columns:3,rows:2}};
const socket={bodyPath:'/'+binding.bodySource.replace(/^public\//u,''),bodySha256:binding.bodySha256,
  sourceBone:binding.weaponBone,sourcePoint,axisPoint:[sourcePoint[0]-24,sourcePoint[1]]};
await emit('public'+assetPath,bytes);
await emit('app/v100KingExhaustArt.js',Buffer.from('// Generated data only. Safe for the installation gate.\nexport const V100_KING_EXHAUST_ART=Object.freeze('+JSON.stringify(art,null,2)+');\nexport const V100_KING_EXHAUST_SOCKET=Object.freeze('+JSON.stringify(socket,null,2)+');\n'));
const promptPaths=[folder+'/prompt-r1.txt',folder+'/edit-prompt-r2.txt'];
const prompts=await Promise.all(promptPaths.map(async p=>({path:p,sha256:sha(Buffer.from((await readFile(path.join(root,p),'utf8')).replaceAll('\r\n','\n')))})));
await emit(folder+'/provenance-r2.json',Buffer.from(JSON.stringify({
  generator:'scripts/build-v100-king-exhaust-art.mjs',creator:'OpenAI built-in image_gen under Producer direction; deterministic phone-sized WebP packaging by Codex',
  license:'Project-original generated effect artwork under existing game asset policy; no third-party download',
  rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original material-only exhaust created for this project'},
  producerApproval:'Current smartphone goal requests bespoke manual ability animation; candidate, not final motion/audio/device acceptance',
  generation:{mode:'built-in image_gen generation followed by built-in alpha-preserving edit',model:'Selected by host; no model name asserted',characterReferences:[]},
  source:{path:masterPath,bytes:master.length,sha256:sha(master)},prompts,
  rejectedSource:{path:folder+'/master-r1.png',reason:'Four border pixels exceeded unchanged alpha<=32 gate; retained, not packaged'},
  bodyBinding:{path:bindingPath,bodySha256:binding.bodySha256,sourcePoint,sourceBone:binding.weaponBone},
  output:{path:assetPath,bytes:bytes.length,sha256:sha(bytes),width:768,height:512,columns:3,rows:2},
  runtimeAssetCount:1,logicalBytes:bytes.length,distinctBytes:bytes.length,estimatedDecodedRgbaBytes:768*512*4,
  scope:'Optional real crazy-king formation only, existing weapon-0 joint vent and world clock. Grey exhaust packets, not fire or a new weapon. Body, damage, timing, AI, audio, saves and rewards remain unchanged. Old pack or decode failure retains existing presentation.'
},null,2)+'\n'));
console.log(JSON.stringify({check,assets:1,bytes:bytes.length,sha256:sha(bytes)},null,2));
