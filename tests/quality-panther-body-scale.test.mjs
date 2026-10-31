import test from 'node:test';
import assert from 'node:assert/strict';
import {measurePantherBody} from '../scripts/measure-quality-panther-body.mjs';
import {V177_PANTHER_JOINT_ATLASES as original} from '../app/v177PantherJointData.js';
import {withQualityPantherBodyScale} from '../app/qualityPantherBodyScale.js';
import {V177_JOINT_ATLASES as atlases,v177JointPose,v177RenderedJointWeaponSocket,v177CaptureJointPose} from '../app/v177JointPresentation.js';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {v102BattleDisplaySize} from '../app/v102BattleScale.js';

const targets={'red-panther-knife':{w:54,h:68},'red-panther-shield':{w:62,h:70}};
test('painted knife and shield soldiers match their authored idle body height and floor, excluding equipment',async()=>{
  for(const [kind,maximum] of Object.entries(targets)) {
    const body=await measurePantherBody(kind),r=atlases[kind].referenceFrame;
    const frame=spriteFrameFor(kind,'idle','right'),size=v102BattleDisplaySize(kind,frame,maximum);
    assert.ok(Math.abs(body.height/r.scale*size.h/r.height-maximum.h)<1e-8,kind);
    const old=original[kind].referenceFrame;
    assert.ok(Math.abs(r.ty+r.scale*frame.groundAnchorPixels-old.ty-old.scale*frame.groundAnchorPixels)<1e-8,kind+' authored floor');
    assert.ok(Math.abs(((body.sole-r.ty)/r.scale/r.height-frame.anchorY)*size.h)<.5,kind+' idle painted boot stays within half a display pixel of the authored floor');
    assert.ok(body.height/old.scale*size.h/old.height<maximum.h*.85,'fixture reproduces undersizing');
    assert.equal(frame.authoredCell.h,468);
    assert.deepEqual(body.parts,['far-boot','near-boot','head']);
  }
});

test('only projection changes; weapon size, bones, textures and other soldiers retain original data',()=>{
  for(const [kind,source] of Object.entries(original)) {
    const fixed=atlases[kind];
    if(!targets[kind]){assert.equal(fixed,source);continue;}
    for(const key of Object.keys(source).filter(k=>k!=='referenceFrame'))assert.equal(fixed[key],source[key],key);
    const wider={...source,parts:source.parts.map(p=>p.bone===source.weaponBone?{...p,destination:{...p.destination,w:p.destination.w*2}}:p)};
    assert.deepEqual(withQualityPantherBodyScale(kind,wider).referenceFrame,fixed.referenceFrame);
    const a=source.referenceFrame,b=fixed.referenceFrame;
    assert.ok(Math.abs(a.tx+a.scale*a.width/2-b.tx-b.scale*b.width/2)<1e-10);
  }
});

test('both facings and action weapon sockets use the same calibrated projection as the visible weapon',()=>{
  for(const [kind,maximum] of Object.entries(targets))for(const direction of ['left','right'])
    for(const requestedState of ['idle','move','active','recovery','hit-heavy']) {
      const atlas=atlases[kind],r=atlas.referenceFrame;
      const frame=spriteFrameFor(kind,'idle',direction),size=v102BattleDisplaySize(kind,frame,maximum);
      const plan=v177JointPose(kind,{requestedState,clipProgress:.37},{locomotionPhase:.21,locomotionSettle:0});
      if(requestedState==='hit-heavy') {
        assert.equal(plan,null,'heavy hit uses the existing painted fallback');
        const hit=spriteFrameFor(kind,'hit',direction),fallback=v102BattleDisplaySize(kind,hit,maximum);
        assert.equal(fallback.h/hit.sourceRect.h,size.h/frame.sourceRect.h,'fallback retains the same authored pixel scale');
        continue;
      }
      assert.ok(plan,kind+'/'+requestedState);
      const root={x:200,y:180,angle:0,scaleX:1,scaleY:1,flipX:frame.flipX};
      const sourcePoint=atlas.muzzle,sourceBone=atlas.weaponBone;
      const socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,x:root.x,y:root.y,
        pose:{scaleX:1,scaleY:1,rotationRadians:0,offsetX:0,offsetY:0},sourcePoint,sourceBone,allowIdle:true});
      const m=v177CaptureJointPose(kind,plan).upper[sourceBone];
      const px=m[0]*sourcePoint[0]+m[2]*sourcePoint[1]+m[4],py=m[1]*sourcePoint[0]+m[3]*sourcePoint[1]+m[5];
      assert.ok(Math.abs(socket.x-(root.x+((px-r.tx)/r.scale/r.width-frame.anchorX)*size.w*(frame.flipX?-1:1)))<1e-8);
      assert.ok(Math.abs(socket.y-(root.y+((py-r.ty)/r.scale/r.height-frame.anchorY)*size.h))<1e-8);
    }
});
