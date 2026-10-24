import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {V177_JOINT_ATLASES as atlases} from '../app/v177JointPresentation.js';

// Execute the production post-paint block: Ranger owns a weighted rig with no
// muzzle field, but still supplies a valid painted weapon socket in live play.
const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
const start=source.indexOf('  if(drewArticulatedWalk&&jointPose&&weaponSocket&&options.world){');
const end=source.indexOf('  if(drewArticulatedWalk&&jointPose&&weaponSocket&&gripSocket){',start);
assert.ok(start>0&&end>start);
const paint=new vm.Script(source.slice(start,end),{filename:'actual-post-joint-paint.tsx'});

test('actual post-paint socket handling works for the weighted Ranger and each current atlas',()=>{
  for(const [kind,jointAtlas]of Object.entries(atlases)){
    const calls=[],owner={id:7,kind,manualAbility:{activationId:3}};
    paint.runInNewContext({drewArticulatedWalk:true,jointPose:{},weaponSocket:{x:300,y:200},
      options:{world:{time:2}},jointAtlas,f:owner,renderKind:kind,manualAbilityActive:false,
      animationSample:{requestedState:'active'},direction:'right',
      resolveV105CurrentAbilityOrigin:(...args)=>calls.push(args)});
    assert.equal(calls.length,['tky','mrs-chiha','zakimiya'].includes(kind)?1:0,kind);
    if(calls.length){
      assert.deepEqual({...calls[0][3].sourcePixel},{x:jointAtlas.muzzle[0],y:jointAtlas.muzzle[1]});
      assert.equal(calls[0][3].sourceBone,jointAtlas.weaponBone);
    }
  }
});
