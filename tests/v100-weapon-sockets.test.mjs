import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {V100_WEAPON_SOCKETS,v100RenderedWeaponSocket} from '../app/v100WeaponSockets.js';
import {spriteFrameFor,fitSpriteBattleDisplaySize,spriteBattleDisplaySizeFor} from '../app/spriteManifest.js';
const pose={offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0};
test('source-bound weapon sockets meet the visible barrel in both authored firing poses',async()=>{
 for(const [kind,definition] of Object.entries(V100_WEAPON_SOCKETS)){
  const {data,info}=await sharp('public'+definition.path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const direction of ['left','right'])for(const state of ['attack-a','attack-b']){
   const frame=spriteFrameFor(kind,state,direction),point=definition[direction][state==='attack-b'?1:0];
   assert.equal(frame.path,definition.path);
   let visible=0;
   for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const x=frame.sourceRect.x+point[0]+dx,y=frame.sourceRect.y+point[1]+dy;
    visible=Math.max(visible,data[(y*info.width+x)*4+3]);
   }
   assert.ok(visible>128,kind+' '+direction+' '+state+' socket must touch authored opaque equipment');
   const size=fitSpriteBattleDisplaySize(kind,frame,spriteBattleDisplaySizeFor(kind));
   const socket=v100RenderedWeaponSocket({kind,state,direction,frame,size,pose,x:500,y:250});
   assert.ok(socket.y<210&&socket.y>140,kind+' '+direction+' must emit above the torso hitbox');
   assert.ok(direction==='left'?socket.x<500:socket.x>500,kind+' '+direction);
  }
 }
});
test('the weapon socket follows the actual scale, recoil rotation, bob and facing transform',()=>{
 const frame=spriteFrameFor('babayaga','attack-a','right');
 const base={kind:'babayaga',state:'attack-a',direction:'right',frame,size:{w:480,h:448},pose,x:0,y:0};
 assert.deepEqual(v100RenderedWeaponSocket(base),{x:122,y:-313});
 const transformed=v100RenderedWeaponSocket({...base,x:30,y:40,bob:2,depthScale:.5,pose:{offsetX:10,offsetY:4,scaleX:2,scaleY:.5,rotationRadians:Math.PI/2}});
 assert.ok(Math.abs(transformed.x-191.5)<1e-8);
 assert.ok(Math.abs(transformed.y-284)<1e-8);
 const mirrored=v100RenderedWeaponSocket({...base,frame:{...frame,flipX:true}});
 assert.deepEqual(mirrored,{x:-122,y:-313});
 assert.equal(v100RenderedWeaponSocket({...base,state:'idle'}),null);
 assert.throws(()=>v100RenderedWeaponSocket({...base,frame:{...frame,path:'/different-art.png'}}),/Recalibrate/);
});
