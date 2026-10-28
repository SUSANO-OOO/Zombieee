import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {qualityCardOverlay} from './quality-card-overlay.mjs';

const root = path.resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = [
  {kind:'chiha', canonical:'assets/source/v090/characters/mrs-chiha-identity-master-r1.png',canonicalHash:'5f7b3cb8047804b595d5de57727e34a39fdd7eb6744a2ed859ebd22bb42f3b83',crop:{left:270,top:0,width:600,height:800}},
  {kind:'musashi', canonical:'assets/source/v090/characters/miyamoto-musashi-identity-master-r1.png',canonicalHash:'9d2a1ee6e8dd56b5993a1386bcecaa89c219b83cd77a0aaadab080553f6182e9',crop:{left:270,top:0,width:620,height:827}},
  {kind:'mayo', canonical:'assets/source/v090/characters/mayo-chan-identity-master-r1.png',canonicalHash:'dcbe04ca93d758da12e3c073c3b4fb36e5b8854ffcfcfcb6c1357596b589849c',crop:{left:0,top:0,width:1122,height:1402}},
  {kind:'king', canonical:'reference/characters/producer-masters-v2/crazy-king-producer-master-v2.png',canonicalHash:'0a4329786e31f6a10d646e3145eaed188ff434cedcb58a346ae8efa29161c789',crop:{left:150,top:0,width:874,height:1080},expressions:['determined'],masterExpressions:['determined'],cardExpression:'determined'},
  {kind:'tatara', canonical:'public/art/v070/characters/reference/tatara-base-r8.png', canonicalHash:'c297171a498cd8d05adbf377d26d1bb47fb89a9f19ac4aa69d34f4e3b36e84a1', crop:{left:330,top:220,width:495,height:660}},
  {kind:'raider', canonical:'public/art/v070/characters/reference/raider-base-r10.png', canonicalHash:'50c6e63f96f5841f0945a6b6f0e7b692c6f4f944fc36950cdd3ce6e91c6b7cf8', crop:{left:150,top:0,width:600,height:800},masterExpressions:['warm','determined']},
  {kind:'gantetsu', canonical:'public/art/v070/characters/reference/gantetsu-base-r7.png', canonicalHash:'a70035ddc266a2b1d9646628363d2adff6f64fe0c22f3205a89ba16f128d771d', crop:{left:210,top:0,width:620,height:827},expressions:['determined'],masterExpressions:['determined'],cardExpression:'determined'},
  {kind:'monkey', canonical:'public/art/v070/characters/reference/monkey-base-r11.png', canonicalHash:'8dbe4f5cf4e64160d7fdd22f246b4762a650988fc6bac4ad13021ba418820ad7', crop:{left:180,top:0,width:645,height:860}},
  {kind:'ikura', canonical:'public/art/v075/characters/reference/ikura-identity-master-r1.png', canonicalHash:'b095f3ee8eb84422b2f1719a455e049eb0a03f3459e17095df96e4a7d0b7772f', crop:{left:170,top:0,width:615,height:820},card:false},
  {kind:'mizuchi', canonical:'public/art/v070/characters/reference/mizuchi-base-r3.png', canonicalHash:'4b11d38cdca1421cdafa77a3a8cb8eac5d9f8ffa35aacddfcb3de4381012eade', crop:{left:120,top:0,width:650,height:830}},
  {kind:'hachi', canonical:'public/art/v070/characters/reference/hachi-base-r2.png', canonicalHash:'27d61a658e4cc8d6bccf367658308f93ff31795e6513c33549818587681343f3', crop:{left:270,top:0,width:660,height:800}},
  {kind:'nao', canonical:'public/art/v070/characters/reference/nao-base-r1.png', canonicalHash:'b412b49ef4612b557909fdc0d66e482195829d55dadccf941ac6b73966538e6d', crop:{left:120,top:0,width:650,height:780}},
];
for (const {kind,canonical,canonicalHash,crop,card=true,expressions=['warm','determined','alarm','grief'],masterExpressions=['warm'],cardExpression='warm'} of sources) {
  assert.equal(hash(await readFile(path.join(root,canonical))),canonicalHash);
  const inputs=[],outputs=[];
  async function save(relative,bytes) {
    if(check) assert.deepEqual(await readFile(path.join(root,relative)),bytes,relative);
    else await writeFile(path.join(root,relative),bytes);
    outputs.push({path:relative,sha256:hash(bytes),bytes:bytes.length});
  }
  const masterPath=`assets/source/quality-20261028/identity/${kind}-master-r4.png`;
  const masterMetadata=await sharp(path.join(root,masterPath)).metadata();
  for(const expression of expressions) {
    const source=masterExpressions.includes(expression)?masterPath:`assets/source/quality-20261028/identity/${kind}-${expression}-r6.png`;
    const bytes=await readFile(path.join(root,source));
    const metadata=await sharp(bytes).metadata();
    assert.ok(metadata.hasAlpha);
    assert.equal(metadata.width,masterMetadata.width,'Expression camera width changed');
    assert.equal(metadata.height,masterMetadata.height,'Expression camera height changed');
    inputs.push({expression,path:source,sha256:hash(bytes),width:metadata.width,height:metadata.height});
    // Identical upper-hip crop and transform for every expression. No head or
    // face pixels are repainted; equipment beyond this dialogue crop is retained
    // in the original full-body sources for separate battle authoring.
    const cell=await sharp(bytes).extract(crop).resize({width:450,height:600,fit:'contain',background:'#00000000'}).png().toBuffer();
    const portrait=await sharp({create:{width:512,height:640,channels:4,background:'#00000000'}})
      .composite([{input:cell,left:31,top:20}]).png().toBuffer();
    await save(`public/art/v100/portraits/${kind}-${expression}-quality-r1.webp`,await sharp(portrait).webp({quality:92,alphaQuality:100,effort:6}).toBuffer());
    if(expression===cardExpression&&card) await save(`public/art/v100/portraits/${kind}-formation-card-quality-r1.webp`,
      await sharp(portrait).extract({left:0,top:0,width:512,height:512}).composite([{input:qualityCardOverlay(kind)}]).webp({quality:92,alphaQuality:100,effort:6}).toBuffer());
  }
  const report={generator:'scripts/build-quality-support-portraits.mjs',canonical:{path:canonical,sha256:canonicalHash},inputs,crop,outputs,
    ...(kind==='raider'?{expressionPolicy:'Three distinct source images cover four states. Warm and determined reuse the r4 master; the requested determined variant was rejected by the generation service and was not retried.'}:{}),
    ...(kind==='gantetsu'?{expressionPolicy:'One opaque-visor portrait covers all four dialogue states; no face or facial expression was invented.'}:{}),
    ...(kind==='king'?{expressionPolicy:'One closed helmet portrait covers all four dialogue states; painted helmet markings never change like a human face.'}:{}),
    runtimeAssetCount:outputs.length,logicalBytes:outputs.reduce((sum,item)=>sum+item.bytes,0),
    distinctBytes:[...new Map(outputs.map(item=>[item.sha256,item.bytes])).values()].reduce((sum,bytes)=>sum+bytes,0),
    scope:'Local dialogue and card candidate. Battle, dedicated scenes and credits are not replaced by this builder.',
    approval:'Producer requested the redesign; final visual acceptance and integration remain open.'};
  const target=path.join(root,`assets/source/quality-20261028/identity/${kind}-runtime-provenance.json`);
  const reportBytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
  if(check) assert.deepEqual(await readFile(target),reportBytes);else await writeFile(target,reportBytes);
  console.log(JSON.stringify({kind,check,outputs:outputs.length,bytes:report.logicalBytes}));
}
