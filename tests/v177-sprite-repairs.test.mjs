import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { spriteFrameFor,fitSpriteBattleDisplaySize } from '../app/spriteManifest.js';
import { v102BattleDisplaySize } from '../app/v102BattleScale.js';
import { V177_SPRITE_REPLACEMENTS } from '../scripts/v177-sprite-repair-asset-contract.mjs';

const sourceRoot = new URL('../assets/source/v100/sprite-repairs/', import.meta.url);
const provenance = JSON.parse(await readFile(new URL('provenance.json', sourceRoot), 'utf8'));
const raw = async file => sharp(await readFile(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const sha = data => createHash('sha256').update(data).digest('hex');
function inside(x,y,polygon) { let answer=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])answer=!answer;}return answer; }

test('both boss sheets remove enclosed white backgrounds without changing a single RGB byte', async () => {
  for (const row of provenance.records.filter(r => r.name !== 'musashi')) {
    const before = await raw(new URL(`${row.name}-published-1.0.3.png`,sourceRoot));
    const after = await raw(new URL(`../public${row.path}`,import.meta.url));
    assert.deepEqual(after.info,before.info);
    let changed=0;
    for(let i=0;i<after.data.length;i+=4){
      assert.equal(after.data[i],before.data[i]); assert.equal(after.data[i+1],before.data[i+1]); assert.equal(after.data[i+2],before.data[i+2]);
      assert.ok(after.data[i+3]<=before.data[i+3],`${row.name}: opacity may only decrease`);
      if(after.data[i+3]!==before.data[i+3])changed++;
    }
    assert.ok(changed>1000,`${row.name}: actual background repair`);
    const entranceGaps=row.name==='omega'?[[218,208],[212,81],[149,176]]:[[398,195],[411,213],[131,229],[202,385]];
    for(const [x,y]of entranceGaps){
      assert.ok(before.data[(y*after.info.width+x)*4+3]>0,'published entrance contains the reported white pocket');
      assert.equal(after.data[(y*after.info.width+x)*4+3],0,`${row.name}: entrance gap ${x},${y}`);
      assert.equal(after.data[((512+y)*after.info.width+543-x)*4+3],0,'left entrance mirrors the same transparency repair');
    }
    for(const removed of row.removed){const [x,y]=removed.seed;
      const right=(y*after.info.width+removed.column*544+x)*4+3;
      const left=((512+y)*after.info.width+removed.column*544+543-x)*4+3;
      assert.ok(before.data[right]>0); assert.equal(after.data[right],0); assert.equal(after.data[left],0);
    }
    for(let column=0;column<8;column++)assert.ok(row.removed.some(r=>r.column===column),`${row.name}: all authored states checked`);
  }
});

test('Musashi loses the rear stray blade and adjacent cloak while the rest of his identity and poses stay byte-identical',async()=>{
  const row=provenance.records.find(r=>r.name==='musashi');
  const before=await raw(new URL('musashi-published-1.0.3.png',sourceRoot)),after=await raw(new URL(`../public${row.path}`,import.meta.url));
  for(let y=0;y<896;y++)for(let x=0;x<3360;x++){
    const col=Math.floor(x/480),localX=y<448?x%480:479-x%480,localY=y%448;
    const editable=col===1?inside(localX+.5,localY+.5,row.bladeMask):col===0&&inside(localX+.5,localY+.5,row.neighbourMask);
    if(editable)continue;const p=(y*3360+x)*4;
    assert.ok(after.data.subarray(p,p+4).equals(before.data.subarray(p,p+4)),`unrelated pixel ${x},${y}`);
  }
  const at=(x,y,col=1)=>(y*3360+col*480+x)*4;
  assert.ok(before.data[at(119,251)+3]>0); assert.equal(after.data[at(119,251)+3],0,'stray blade outside cloak removed');
  assert.ok(after.data[at(190,309)+3]>200,'cloth behind old blade restored');
  for(const [x,y] of [[215,248],[265,296],[334,351]])assert.ok(after.data.subarray(at(x,y),at(x,y)+4).equals(before.data.subarray(at(x,y),at(x,y)+4)),'real hand and katana preserved');
  for(const direction of ['left','right']){
    const frame=spriteFrameFor('miyamoto-musashi','idle',direction);
    assert.ok(frame.gutter.left>=16&&frame.gutter.right>=16,'complete second blade remains inside cell');
  }
  const idle=spriteFrameFor('miyamoto-musashi','idle','right');
  const publishedFit=fitSpriteBattleDisplaySize('miyamoto-musashi',{...idle,contentRect:{...idle.contentRect,w:324}},{w:67,h:106});
  const publishedScale=publishedFit.w/idle.sourceRect.w;
  for(const state of ['idle','walk-a','walk-b','attack-a','attack-b','hit','death']){
    const frame=spriteFrameFor('miyamoto-musashi',state,'right'),size=v102BattleDisplaySize('miyamoto-musashi',frame,{w:67,h:106});
    assert.ok(Math.abs(size.w/frame.sourceRect.w-publishedScale)<1e-10,'restoring the complete blade preserves Musashi body scale');
  }
});

test('sprite fixes are source-bound, lossless in the PWA, and distributed with their actual hashes',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url),'utf8'));
  for(const row of provenance.records){
    for(const input of row.inputs)assert.equal(sha(await readFile(new URL(input.file,sourceRoot))),input.sha256,input.file);
    const png=await readFile(new URL(`../public${row.path}`,import.meta.url)),webp=await readFile(new URL(`../public${row.sourcePath}`,import.meta.url));
    assert.equal(sha(png),row.pngSha256);
    const originalPixels=await sharp(png).ensureAlpha().raw().toBuffer(),transportPixels=await sharp(webp).ensureAlpha().raw().toBuffer();
    assert.equal(originalPixels.length,transportPixels.length);
    for(let i=0;i<originalPixels.length;i+=4){assert.equal(originalPixels[i+3],transportPixels[i+3]);if(originalPixels[i+3])assert.ok(originalPixels.subarray(i,i+3).equals(transportPixels.subarray(i,i+3)),'transport preserves every visible RGB byte');}
    const expected=V177_SPRITE_REPLACEMENTS.find(r=>r.path===row.path).next,actual=manifest.assets.find(a=>a.path===row.path);
    assert.equal(actual.bytes,webp.length);assert.equal(actual.hash,`sha256-${sha(webp)}`);assert.equal(actual.hash,expected.hash);
  }
});
