import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import test from 'node:test';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {v100HumanWalkFrame} from '../app/v100HumanWalk.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('Omega original contact planes and original cleaver contact survive actual native-frame scaling and facing; atlas loads only with its enemy',async()=>{
 for(const kind of ['takuya-omega']){
  const atlas=V177_JOINT_ATLASES[kind],d=JSON.parse(await readFile('assets/source/v100/joints/'+kind+'-r1/parts.json'));
  const bytes=await readFile('public'+atlas.path),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path),meta=await sharp(bytes).metadata();
  assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+hash(bytes),expected.hash);assert.equal(meta.width*meta.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
  for(const [pose,binding]of Object.entries(d.poseBindings)){const frame=spriteFrameFor(kind,pose,'right');assert.equal(frame.path,binding.path);assert.deepEqual(frame.sourceRect,binding.sourceRect);assert.equal(frame.flipX,false);}
  for(const direction of ['left','right'])for(const scale of [.12,.2]){
   let m=[1,0,0,1,300,500];const stack=[],calls=[];const mul=b=>{const a=m;m=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
   const ctx={save(){stack.push([...m]);},restore(){m=stack.pop();},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},translate(x,y){mul([1,0,0,1,x,y]);},scale(x,y){mul([x,0,0,y,0,0]);},transform(...a){mul(a);},drawImage(){calls.push([...m]);}};
   const frame=v100HumanWalkFrame(spriteFrameFor(kind,'walk-a','right'),direction);assert.equal(frame.flipX,direction==='left');if(frame.flipX)ctx.scale(-1,1);
   assert.equal(atlas.referenceFrame.width,frame.sourceRect.w,'Production uses walk-a width, not idle width');assert.equal(atlas.referenceFrame.height,frame.sourceRect.h,'Production uses walk-a height, not idle height');
   const size={w:frame.sourceRect.w*scale,h:frame.sourceRect.h*scale},plan=v177JointPose(kind,{requestedState:'active',clipProgress:.26},{locomotionPhase:.1371,locomotionSettle:1});
   assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h));assert.equal(calls.length,d.parts.length);
   for(const matrix of calls){assert.ok(Math.abs(Math.hypot(matrix[0],matrix[1])-scale)<1e-10,'Native production drawing never stretches a limb horizontally');assert.ok(Math.abs(Math.hypot(matrix[2],matrix[3])-scale)<1e-10,'Native production drawing preserves the same vertical scale');}
   const contact=transform(calls[atlas.parts.findIndex(p=>p.bone===atlas.weaponBone)],atlas.muzzle),socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});assert.ok(distance(contact,[socket.x,socket.y])<1e-10);
   for(const leg of d.rig.legs){const p=[leg.ankle[0],leg.ankle[1]+leg.paintGroundY-leg.groundAnkleY],matrix=calls[atlas.parts.findIndex(p=>p.name===leg.paintedPaw)];
    const expectedY=500+((leg.paintGroundY-d.referenceFrame.ty)/d.referenceFrame.scale-frame.anchorY*d.referenceFrame.height)*scale;
    assert.ok(Math.abs(transform(matrix,p)[1]-expectedY)<.001,'Each original perspective contact plane is retained without stretching a leg');
   }
  }
  const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,formationKinds:['ranger'],enemyKinds:[kind,kind]},plan=requiredBattleAssetPlan(input);
  assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);
  assert.ok(!requiredBattleAssetPlan({...input,enemyKinds:[]}).paths.includes(atlas.path));assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 }
});
