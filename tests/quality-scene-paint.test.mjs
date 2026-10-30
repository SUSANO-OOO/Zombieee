import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {inspectScenePaintContrast} from '../scripts/quality-scene-paint.mjs';

test('the scene paint guard rejects a flat or smooth empty backdrop and accepts real scene pixels',async()=>{
 const w=256,h=128,gradient=new Uint8Array(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++)gradient[(y*w+x)*3+c]=12+Math.floor(x/12)+c;
 assert.equal(inspectScenePaintContrast(new Uint8Array(w*h*3),w,h).painted,false);
 assert.equal(inspectScenePaintContrast(gradient,w,h).painted,false);
 const {data,info}=await sharp('public/art/v100/quality-20261028/scenes/s06-babayaga-old-message-r1.webp').resize(w,h).removeAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.channels,3);assert.equal(inspectScenePaintContrast(data,w,h).painted,true);
 assert.throws(()=>inspectScenePaintContrast(gradient.subarray(1),w,h));
 assert.throws(()=>inspectScenePaintContrast(gradient,0,h));
});
