import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,writeFile,copyFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import sharp from 'sharp';
import {generateGairenSource} from '../scripts/build-v177-gairen-source.mjs';
import {V177_GAIREN_SPRITE_REPLACEMENTS} from '../scripts/v177-gairen-repair-asset-contract.mjs';
test('Gairen dedicated shell attack removes only the extra middle leg; every RGB byte, both proper legs and all other source poses remain exact',async()=>{
 const r=await generateGairenSource(),before=await sharp('assets/source/v100/gairen-repair-r1/canonical-before.png').ensureAlpha().raw().toBuffer(),after=await sharp(r.atlas).ensureAlpha().raw().toBuffer();let changed=0,outerPaint=0;
 for(let y=0;y<896;y++)for(let x=0;x<3360;x++){const i=(y*3360+x)*4;assert.ok(before[i]===after[i]&&before[i+1]===after[i+1]&&before[i+2]===after[i+2],'No AI recoloring or replacement identity');if(before[i+3]!==after[i+3]){changed++;const xx=x-1920,yy=y%448;assert.ok(xx>=0&&xx<480&&yy>=324);assert.ok(y>=448?xx>=204&&xx<286:xx>=194&&xx<276);assert.equal(after[i+3],0,'Only transparency erasure is authorized');}if(y>=838&&y<880&&x>=2057&&x<2121&&before[i+3]>=32){assert.deepEqual(after.subarray(i,i+4),before.subarray(i,i+4));outerPaint++;}}
 assert.equal(changed,10818);assert.ok(outerPaint>500,'Opaque proper left foot survives');
 for(const [row,lo,hi]of [[448,204,290],[0,190,276]])for(let y=395;y<448;y++)for(let x=lo;x<hi;x++)assert.equal(after[((row+y)*3360+1920+x)*4+3],0,'No middle foot or isolated source residue');
 assert.deepEqual(await readFile('public/art/v090/bosses/gairen-battle-r1.png'),r.atlas);assert.deepEqual(await readFile('public/pwa-optimized/art/v090/bosses/gairen-battle-r1.webp'),r.transport);
 const spec=JSON.parse(await readFile('assets/source/v100/joints/gairen-r1/parts.json'));assert.equal(spec.rig.legs.length,2);assert.equal(spec.rig.arms.length,2);for(const b of Object.values(spec.poseBindings))assert.equal(b.sourceSha256,r.spec.png.sha256);
});
test('Gairen repair rejects a changed AI guide and refreshes the exact frozen installed source payload',async()=>{
 const source='assets/source/v100/gairen-repair-r1',out=await mkdtemp(path.join(tmpdir(),'v177-gairen-source-'));for(const f of ['provenance.json','canonical-before.png'])await copyFile(path.join(source,f),path.join(out,f));const guide=await readFile(path.join(source,'edit-guide.png'));guide[guide.length-1]^=1;await writeFile(path.join(out,'edit-guide.png'),guide);await assert.rejects(generateGairenSource(out),{code:'ERR_ASSERTION'});
 const [r]=V177_GAIREN_SPRITE_REPLACEMENTS,m=JSON.parse(await readFile('public/asset-manifest.json')),a=m.assets.find(a=>a.path===r.path);assert.equal(r.previous.bytes,2261268);assert.equal(r.next.bytes,2239632);assert.equal(r.delta,-21636);assert.equal(a.bytes,r.next.bytes);assert.equal(a.hash,r.next.hash);
});
