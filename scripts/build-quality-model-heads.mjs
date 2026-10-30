import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {QUALITY_CHARACTER_BASE_ATLASES as bases} from '../app/qualityCharacterAtlases.js';

const root='assets/source/quality-20261028/identity/battle-heads-r3';
const plan=JSON.parse(await readFile(`${root}/source-plan.json`,'utf8'));
const check=process.argv.includes('--check');
const review=process.env.QUALITY_MODEL_HEAD_REVIEW_OUT??'output/quality-20261028/model-heads-r3';
await mkdir(review,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function emit(file,bytes){if(check)assert.deepEqual(await readFile(file),bytes,file);else await writeFile(file,bytes);}
assert.equal(plan.entries.length,12);assert.equal(new Set(plan.entries.map(row=>row.kind)).size,12);
assert.equal(plan.reusedKinds.length,4);
assert.deepEqual([...plan.entries.map(row=>row.kind),...plan.reusedKinds].sort(),Object.keys(bases).sort());
const entries=[];
for(const row of plan.entries){
 const atlas=bases[row.kind];assert.ok(atlas,row.kind);
 const parts=atlas.parts??atlas.upperRig?.parts;
 const head=parts?.find(part=>part.bone==='head');assert.ok(head,`${row.kind}: head part`);
 const model=await readFile(row.model);assert.equal(digest(model),row.modelSha256,`${row.kind}: selected primary model`);
 if(row.beforeAssetPath)assert.equal(digest(await readFile('public'+row.beforeAssetPath)),row.beforeAssetSha256,`${row.kind}: retained previous candidate`);
 const reference=await readFile(row.primaryReference);assert.equal(digest(reference),row.primaryReferenceSha256);
 assert.deepEqual(await sharp(model).extract(row.primaryCrop).png().toBuffer(),reference,`${row.kind}: primary-model crop`);
 const source=await readFile(row.sourceHead);assert.equal(digest(source),row.sourceHeadSha256,`${row.kind}: selected head source`);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=-1,bottom=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 assert.ok(left>0&&top>0&&right<info.width-1&&bottom<info.height-1,`${row.kind}: unclipped source head`);
 const visibleBounds={left,top,width:right-left+1,height:bottom-top+1};assert.deepEqual(visibleBounds,row.visibleBounds);
 const crop=await sharp(source).extract(visibleBounds).png().toBuffer();
 const tile=await sharp(crop).resize(head.source.w,head.source.h,{fit:'contain',position:'bottom',background:'#00000000'}).ensureAlpha().raw().toBuffer();
 const base=await readFile('public'+atlas.path),raw=await sharp(base).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let y=0;y<head.source.h;y++)tile.copy(raw.data,((head.source.y+y)*raw.info.width+head.source.x)*4,y*head.source.w*4,(y+1)*head.source.w*4);
 const packed=await sharp(raw.data,{raw:raw.info}).webp({lossless:true,effort:6}).toBuffer();
 // Preserve exact alpha and visible RGB outside the head rectangle, including
 // the ranger's lower mesh and legacy cells. RGB under zero alpha may be
 // canonicalized by WebP; the original authored atlas remains byte-exact.
 const original=await sharp(base).ensureAlpha().raw().toBuffer(),actual=await sharp(packed).ensureAlpha().raw().toBuffer();
 let visible=0;
 for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++){
  if(x>=head.source.x&&x<head.source.x+head.source.w&&y>=head.source.y&&y<head.source.y+head.source.h)continue;
  const i=(y*raw.info.width+x)*4;assert.equal(actual[i+3],original[i+3],`${row.kind}: non-head alpha`);
  if(original[i+3]){visible++;for(let channel=0;channel<3;channel++)assert.equal(actual[i+channel],original[i+channel],`${row.kind}: non-head visible RGB`);}
 }
 const assetPath=`/art/v100/joints/${row.kind}-quality-model-r3.webp`;
 await emit('public'+assetPath,packed);
 await writeFile(`${review}/${row.kind}-head.png`,crop);
 entries.push({...row,basePath:atlas.path,baseSha256:digest(base),assetPath,bytes:packed.length,sha256:digest(packed),headSource:head.source,headDestination:head.destination,headRig:atlas.parts?'standard':'ranger-upper',unchangedVisibleNonHeadPixels:visible});
}
const provenance={generator:'scripts/build-quality-model-heads.mjs',creator:'OpenAI built-in image_gen under Producer direction; deterministic atlas packing by this script',license:'Generated project derivative; no third-party stock license. Formal rights review remains open before final asset adoption.',rightsScope:'No new purchase, third-party license or external contract. Commercial use, modification and redistribution remain subject to the existing pinned source rights and final rights review.',primaryReference:'Existing generated character models selected in source-plan.json. Original art and private photographs are identity drift checks; no private photograph is included.',operation:'Twelve head-only derivatives made with built-in image_gen using each selected model; source-bound bottom-aligned resize and lossless atlas packing. Four previously integrated head candidates retained.',permissions:'Producer requested integration of the generated models into the playable candidate. Final likeness, body, weapon, movement and physical-device acceptance remain open.',scope:'All 16 normal battle-head assignments: twelve new textures and four reused. Existing body paint, source geometry, animation and intentional transformed variants are retained; their whole-product appearance is not accepted by this build.',reusedKinds:plan.reusedKinds,entries};
await emit(`${root}/runtime-provenance.json`,Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
console.log(JSON.stringify({check,heads:entries.length,bytes:entries.reduce((sum,row)=>sum+row.bytes,0),review}));
