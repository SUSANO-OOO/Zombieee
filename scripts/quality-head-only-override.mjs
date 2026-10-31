import assert from 'node:assert/strict';
import sharp from 'sharp';
// Comparison-only: retain every current weapon/body pixel when the head layer
// has acquired a later, differently packed atlas. Never substitute that body.
export async function qualityHeadOnlyOverride(current,previous,head){
 const a=await sharp(current).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const b=await sharp(previous).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(const n of [head.x,head.y,head.w,head.h])assert.ok(Number.isInteger(n)&&n>=0);
 assert.ok(head.w>0&&head.h>0);for(const r of [a,b])assert.ok(head.x+head.w<=r.info.width&&head.y+head.h<=r.info.height,'Head rectangle outside its bound atlas');
 for(let y=0;y<head.h;y++)b.data.copy(a.data,((head.y+y)*a.info.width+head.x)*4,((head.y+y)*b.info.width+head.x)*4,((head.y+y)*b.info.width+head.x+head.w)*4);
 return sharp(a.data,{raw:a.info}).webp({lossless:true,effort:6}).toBuffer();
}
