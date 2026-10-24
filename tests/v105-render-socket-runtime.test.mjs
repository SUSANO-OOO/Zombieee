import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {V177_JOINT_ATLASES as atlases} from '../app/v177JointPresentation.js';
import {beginV090InfectedAbility} from '../app/v090Infected.js';

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

test('Anchor recording supplies a real eligible ally without injecting ability state or changing original stats',()=>{
  const a=source.indexOf('        let reinforcementId:number|null=null;');
  const b=source.indexOf('        if(reactionProof){',a);assert.ok(a>0&&b>a);
  const prepare=new vm.Script(source.slice(a,b).replace('let reinforcementId:number|null=null;','let reinforcementId=null;')+'result=reinforcementId;');
  for(const [form,phase]of [['anchor-bloom','ability'],['anchor-bloom','move'],['spindle','ability']]){
    const actor={id:1,kind:form,side:'zombie',x:620,y:282,hp:350,speed:14,damage:9,stationAbility:{phase:'idle'}},copy=structuredClone(actor);
    let calls=0;const originalAlly={id:2,kind:'walker',side:'zombie',hp:80,maxHp:80,speed:29,laneSpeed:17,damage:6,abilityCooldown:9,stationAbility:{phase:'idle'}};
    const ctx={form,phase,actor,lane:1,g:{fighters:[actor]},result:null,
      createCombatAnimationRuntime:p=>({...p}),spawnEnemy:()=>{calls++;return ctx.ally={...originalAlly};}};
    prepare.runInNewContext(ctx);assert.deepEqual(actor,copy);
    assert.equal(calls,form==='anchor-bloom'&&phase==='ability'?1:0);
    if(calls){
      for(const k of ['hp','maxHp','speed','laneSpeed','damage','abilityCooldown','stationAbility'])assert.deepEqual(ctx.ally[k],originalAlly[k]);
      assert.equal(ctx.result,2);assert.equal(beginV090InfectedAbility({kind:form,attacker:actor,candidates:[actor,ctx.ally]}).ok,true);
      assert.equal(actor.stationAbility.phase,'idle','Only the normal game loop may start the ability');
    }
  }
});
