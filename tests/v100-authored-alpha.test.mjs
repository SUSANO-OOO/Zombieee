import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredMotionRgba} from '../scripts/v100-authored-alpha.mjs';
test('pale matte removal keeps dark opaque anatomy and enclosed white highlights',()=>{
 const width=9,bytes=Buffer.alloc(width*width*4,255);
 for(let y=2;y<7;y++)for(let x=2;x<7;x++){let i=(y*width+x)*4;bytes[i]=8;bytes[i+1]=7;bytes[i+2]=6;}
 const eye=(4*width+4)*4;bytes[eye]=bytes[eye+1]=bytes[eye+2]=250;
 const original=Buffer.from(bytes),out=authoredMotionRgba(bytes,width,width);
 assert.deepEqual(bytes,original,'Authored source never changes');
 assert.equal(out[3],0);
 for(let y=2;y<7;y++)for(let x=2;x<7;x++)assert.deepEqual(out.subarray((y*width+x)*4,(y*width+x)*4+4),bytes.subarray((y*width+x)*4,(y*width+x)*4+4));
});
test('true authored alpha including dark edge pixels and antialiasing is preserved exactly',()=>{
 const bytes=Buffer.alloc(4*4*4);
 bytes.set([9,8,7,255],0);bytes.set([250,250,250,128],4);bytes.set([210,210,210,255],20);
 assert.deepEqual(authoredMotionRgba(bytes,4,4),bytes);
});
test('unrecognized opaque backgrounds fail instead of silently erasing dark subject pixels',()=>{
 const bytes=Buffer.alloc(4*4*4,15);
 for(let i=3;i<bytes.length;i+=4)bytes[i]=255;
 assert.throws(()=>authoredMotionRgba(bytes,4,4),/not the documented pale background/);
});
