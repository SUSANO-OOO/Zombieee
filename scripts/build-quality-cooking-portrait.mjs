import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const check=process.argv.includes('--check');
const input='assets/source/quality-20261028/identity/kumaverson-cooking-warm-r1.png';
const output='public/art/v100/portraits/kumaverson-cooking-warm-stage-r1.webp';
const source=await readFile(input),meta=await sharp(source).metadata();
assert.equal(meta.width,1024);assert.equal(meta.height,1536);assert.ok(meta.hasAlpha);
// Use the same camera and crop as the adopted stage portraits. No semantic
// painting or face replacement takes place in this distribution builder.
const crop={left:0,top:0,width:1024,height:1280};
const bytes=await sharp(source).extract(crop).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipt={generator:'scripts/build-quality-cooking-portrait.mjs',input,inputSha256:hash(source),crop,output,sha256:hash(bytes),bytes:bytes.length,pixelDensity:2,designCanvas:{width:512,height:640},scope:'Kumaverson warm daily/soup dialogue, both speaker and listener. Battle, cards, other expressions and canonical screenplay unchanged.'};
const receiptPath='assets/source/quality-20261028/identity/cooking-portrait-provenance-r1.json';
const receiptBytes=Buffer.from(JSON.stringify(receipt,null,2)+'\n');
if(check){assert.deepEqual(await readFile(output),bytes);assert.deepEqual(await readFile(receiptPath),receiptBytes);}
else{await writeFile(output,bytes);await writeFile(receiptPath,receiptBytes);}
console.log(JSON.stringify({check,...receipt}));
