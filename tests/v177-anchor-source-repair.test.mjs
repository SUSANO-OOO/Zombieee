import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {generateAnchorBloomSource} from '../scripts/build-v177-anchor-source.mjs';
import {V177_ANCHOR_SPRITE_REPLACEMENTS} from '../scripts/v177-anchor-repair-asset-contract.mjs';

test('Anchor original RGB and all eight owned source poses retain pale root paint and the raised root across old cell boundaries',async()=>{
 const r=await generateAnchorBloomSource(),original=await sharp(r.spec.original).removeAlpha().raw().toBuffer(),source=await sharp(r.source).ensureAlpha().raw().toBuffer();
 for(let p=0;p<1536*1024;p++)assert.ok(source[p*4]===original[p*3]&&source[p*4+1]===original[p*3+1]&&source[p*4+2]===original[p*3+2],'AI repaint RGB must never enter the original source');
 assert.equal(source[3],0,'Original neutral exterior remains transparent');assert.equal(r.poses.length,8);
 let paleRootPixels=0;
 for(const bytes of r.poses){const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let y=Math.floor(info.height*.78);y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4,a=data[i+3],rgb=[...data.subarray(i,i+3)],lum=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;if(a>=230&&lum>=112&&Math.max(...rgb)-Math.min(...rgb)<=44)paleRootPixels++;}}
 assert.ok(paleRootPixels>1000,'Do not restore destructive floor-band transparency on pale root tips');
 for(const [index,oldBoundary]of [[5,395],[2,768]]){const b=r.bindings[index],{data,info}=await sharp(r.poses[index]).ensureAlpha().raw().toBuffer({resolveWithObject:true});let crossing=0;for(let y=0;y<info.height;y++)for(let x=0;x<Math.min(info.width,oldBoundary-b.tightRect.x);x++)if(data[(y*info.width+x)*4+3]>=32)crossing++;assert.ok(crossing>100,'Owned raised/side root must survive the old rectangular cell boundary');}
 const png=await readFile('public/art/v0995/enemies/anchor-bloom-battle-v2.png'),webp=await readFile('public/pwa-optimized/art/v0995/enemies/anchor-bloom-battle-v2.webp');assert.deepEqual(png,r.atlas);assert.deepEqual(webp,r.transport);
 const a=await sharp(png).ensureAlpha().raw().toBuffer(),b=await sharp(webp).ensureAlpha().raw().toBuffer();assert.equal(a.length,b.length);for(let i=0;i<a.length;i+=4){assert.equal(a[i+3],b[i+3]);if(a[i+3])assert.ok(a[i]===b[i]&&a[i+1]===b[i+1]&&a[i+2]===b[i+2],'PWA transport preserves visible repaired paint');}
 assert.equal(r.spec.poseIndexes.length,7);assert.deepEqual(r.spec.poseIndexes,[0,1,1,2,3,5,7]);
});

test('Anchor source generation refuses a changed alpha guide and pins the exact installed replacement payload',async()=>{
 const source='assets/source/v100/anchor-bloom-repair-r1',out=await mkdtemp(path.join(tmpdir(),'v177-anchor-source-'));
 await copyFile(path.join(source,'provenance.json'),path.join(out,'provenance.json'));const guide=await readFile(path.join(source,'alpha-guide.png'));guide[guide.length-1]^=1;await writeFile(path.join(out,'alpha-guide.png'),guide);
 await assert.rejects(generateAnchorBloomSource(out),{code:'ERR_ASSERTION'});
 const [replacement]=V177_ANCHOR_SPRITE_REPLACEMENTS;assert.equal(replacement.previous.bytes,1727262);assert.equal(replacement.next.bytes,1641792);assert.equal(replacement.delta,-85470);
 const manifest=JSON.parse(await readFile('public/asset-manifest.json')),entry=manifest.assets.find(a=>a.path===replacement.path);assert.equal(entry.bytes,replacement.next.bytes);assert.equal(entry.hash,replacement.next.hash);
});
