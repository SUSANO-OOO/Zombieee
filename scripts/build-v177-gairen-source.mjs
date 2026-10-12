import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const digest=b=>createHash('sha256').update(b).digest('hex');
export async function generateGairenSource(sourceDirectory='assets/source/v100/gairen-repair-r1'){
 const spec=JSON.parse(await readFile(path.join(sourceDirectory,'provenance.json'))),before=await readFile(path.join(sourceDirectory,'canonical-before.png')),guide=await readFile(path.join(sourceDirectory,'edit-guide.png'));assert.equal(digest(before),spec.beforeSha256);assert.equal(digest(guide),spec.guideSha256);
 const {data:all,info}=await sharp(before).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[3360,896]);
 const next=await sharp(before).extract({left:1920,top:448,width:480,height:448}).ensureAlpha().raw().toBuffer(),mask=await sharp(guide).resize(480,448).ensureAlpha().raw().toBuffer();let changed=0;
 for(let y=324;y<448;y++)for(let x=204;x<286;x++){const i=(y*480+x)*4;if(mask[i+3]<16&&next[i+3]){next[i+3]=0;changed++;}}
 assert.equal(changed,5409);for(let y=395;y<448;y++)for(let x=204;x<290;x++)assert.equal(next[(y*480+x)*4+3],0,'Extra center foot is completely removed');
 const left=await sharp(next,{raw:{width:480,height:448,channels:4}}).png().toBuffer(),mirror=await sharp(left).flop().ensureAlpha().raw().toBuffer();for(let y=0;y<448;y++){mirror.copy(all,(y*3360+1920)*4,y*480*4,(y+1)*480*4);next.copy(all,((y+448)*3360+1920)*4,y*480*4,(y+1)*480*4);}
 const atlas=await sharp(all,{raw:{width:3360,height:896,channels:4}}).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer(),transport=await sharp(atlas).webp({lossless:true,effort:6}).toBuffer();assert.equal(digest(atlas),spec.png.sha256);assert.equal(atlas.length,spec.png.bytes);assert.equal(digest(transport),spec.webp.sha256);assert.equal(transport.length,spec.webp.bytes);
 return {atlas,transport,spec,changed};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=await generateGairenSource();await writeFile('public/art/v090/bosses/gairen-battle-r1.png',r.atlas);await writeFile('public/pwa-optimized/art/v090/bosses/gairen-battle-r1.webp',r.transport);console.log(JSON.stringify({kind:'gairen',onlyAlphaChanged:true,removedPixelsPerFacing:r.changed,png:r.spec.png,webp:r.spec.webp}));}
