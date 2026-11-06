import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

// Dialogue keeps the equipment silhouette. Formation cards keep their own crop.
const check=process.argv.includes('--check');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const base='assets/source/quality-20261028/identity/';
const records=[];
for(const kind of ['babayaga','kumaverson','tatara','gantetsu','musashi','ikura']) {
  for(const expression of kind==='gantetsu'?['determined']:['warm','determined','alarm','grief']) {
    const master=expression==='warm'||kind==='gantetsu';
    const input=base+(kind==='babayaga'||kind==='kumaverson'
      ?master?`${kind}-master-${kind==='babayaga'?'r1':'r2'}.png`:`${kind}-waist-${expression}-r1.png`
      :master?`${kind}-master-r4.png`:`${kind}-${expression}-r6.png`);
    const source=await readFile(input),meta=await sharp(source).metadata();
    assert.equal(meta.width,kind==='ikura'?866:1024);assert.equal(meta.height,kind==='ikura'?1816:1536);assert.ok(meta.hasAlpha);
    const crop={left:0,top:0,width:meta.width,height:Math.floor(meta.width*1.25)};
    const bytes=await sharp(source).extract(crop).resize(1024,1280).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
    const output=`public/art/v100/portraits/${kind}-${expression}-stage-r1.webp`;
    if(check)assert.deepEqual(await readFile(output),bytes,output);else await writeFile(output,bytes);
    records.push({kind,expression,input,inputSha256:hash(source),crop,output,sha256:hash(bytes),bytes:bytes.length});
  }
}
const provenance={generator:'scripts/build-quality-stage-portraits.mjs',records,pixelDensity:2,designCanvas:{width:512,height:640},
  logicalBytes:records.reduce((n,r)=>n+r.bytes,0),
  scope:'Upper body dialogue packing, preserving the full source width and equipment. No face painting or semantic edits in this builder. Cards and battle unchanged.',
  acceptance:'Local candidate; likeness and in-game visual acceptance remain open.'};
const bytes=Buffer.from(JSON.stringify(provenance,null,2)+'\n'),file=base+'stage-portrait-provenance-r1.json';
if(check)assert.deepEqual(await readFile(file),bytes);else await writeFile(file,bytes);
console.log(JSON.stringify({check,count:records.length,bytes:provenance.logicalBytes}));
