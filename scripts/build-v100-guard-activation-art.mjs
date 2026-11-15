import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';
const root=process.cwd(),check=process.argv.includes('--check'),folder='assets/source/quality-20261115/guard-activation-r1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');const recipe=JSON.parse(await readFile(path.join(root,folder,'selected-recipe.json'),'utf8'));
assert.deepEqual(recipe.rows.map(r=>r.kind),['kumaverson','guardian']);const art={},provenance=[],outputs=[];
for(const row of recipe.rows){
 const master=await readFile(path.join(root,row.masterPath));assert.equal(sha(master),row.masterSha256);assert.ok(master.length<25*1024*1024);
 const meta=await sharp(master).metadata();assert.deepEqual([meta.width,meta.height,meta.hasAlpha],[1536,1024,true]);const raw=await sharp(master).ensureAlpha().raw().toBuffer();const cells=[];
 for(let frame=0;frame<6;frame++){
  const ox=frame%3*512,oy=Math.floor(frame/3)*512;let gutterAlpha=0,visible=0,windowAlpha=0,windowPixels=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=((oy+y)*1536+ox+x)*4,a=raw[i+3];if(x<4||x>=508||y<4||y>=508)gutterAlpha=Math.max(gutterAlpha,a);if(a>=32)visible++;if(x>=220&&x<292&&y<180){windowAlpha+=a;windowPixels++;}}
  assert.ok(gutterAlpha<=16&&visible>1500,'Every cell requires actual translucent material and transparent sampling gutters');
  let best=-1,peak=0;for(let y=440;y<=486;y++){let mass=0;for(let dy=-2;dy<=2;dy++)for(let x=128;x<384;x++){const i=((oy+y+dy)*1536+ox+x)*4,a=raw[i+3];if(a>=64)mass+=(raw[i]*.2126+raw[i+1]*.7152+raw[i+2]*.0722)*a/255;}if(mass>best){best=mass;peak=y;}}
  assert.ok(best>0);cells.push({frame,gutterAlpha,visiblePixels:visible,upperActorWindowMeanAlpha:windowAlpha/windowPixels,floorPeak:peak,anchor:[.5,(peak+.5)/512]});
 }
 assert.ok(cells[2].visiblePixels>cells[0].visiblePixels*2);assert.ok(cells[5].visiblePixels<Math.max(...cells.map(c=>c.visiblePixels))*.6);
 const bytes=await sharp(master).resize(768,512).webp({lossless:true,effort:6}).toBuffer();
 art[row.kind]={id:row.id,path:row.runtimePath,hash:'sha256-'+sha(bytes),width:768,height:512,columns:3,rows:2,anchors:cells.map(c=>c.anchor),worldWidth:row.worldWidth,worldHeight:row.worldHeight};outputs.push(['public'+row.runtimePath,bytes]);
 const prompt=Buffer.from((await readFile(path.join(root,row.promptPath),'utf8')).replaceAll('\r\n','\n'));
 provenance.push({kind:row.kind,description:row.description,master:{path:row.masterPath,bytes:master.length,sha256:sha(master)},prompt:{path:row.promptPath,sha256:sha(prompt)},cells,output:{...art[row.kind],bytes:bytes.length}});
}
const total=provenance.reduce((n,r)=>n+r.output.bytes,0);assert.ok(total<100*1024*1024);
outputs.push(['app/v100GuardActivationArt.js',Buffer.from('// Generated material data only. Safe for the installation gate.\nexport const V100_GUARD_ACTIVATION_ART=Object.freeze('+JSON.stringify(art,null,2)+');\n')]);
outputs.push([folder+'/provenance-r2.json',Buffer.from(JSON.stringify({recipe:{path:folder+'/selected-recipe.json',sha256:sha(Buffer.from((await readFile(path.join(root,folder,'selected-recipe.json'),'utf8')).replaceAll('\r\n','\n')))},generator:'scripts/build-v100-guard-activation-art.mjs',creator:'OpenAI built-in image_gen under user production direction; deterministic smartphone packaging by Codex',license:'Project-original generated material; user output ownership under the checked provider terms and applicable law',rights:{commercialUse:true,modification:true,redistribution:true,basis:recipe.providerTerms},producerApproval:recipe.authorization,generation:recipe.generation,runtimeAssetCount:2,logicalBytes:total,distinctBytes:total,estimatedDecodedRgbaBytes:2*768*512*4,rows:provenance,scope:'Only optional grounded activation paint for two existing guards. Current queue timing, deduplication, guard/heal mechanics, actor identity, weapon, audio, simulation and save are unchanged. Pure resampling/encoding preserves generated alpha; no background removal or painted substitute.'},null,2)+'\n')]);
for(const [relative,content]of outputs){const target=path.join(root,relative);if(check){const actual=await readFile(target),normalized=/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual;assert.deepEqual(normalized,content,relative+' differs from bound masters');}else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,content);}}
console.log(JSON.stringify({check,files:provenance.map(r=>({kind:r.kind,...r.output})),logicalBytes:total,cells:provenance.map(r=>({kind:r.kind,cells:r.cells}))},null,2));
