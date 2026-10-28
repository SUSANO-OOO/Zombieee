import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gaitSourceHash } from '../scripts/gait-source-hash.mjs';
import { V177_AUTHORED_GAITS } from '../app/v177GaitSourceData.js';
import { V177_JOINT_ATLASES as atlases, v177JointPose, v105BipedFootPlan, v177CaptureJointPose, drawV177JointPose } from '../app/v177JointPresentation.js';
import { v177WeaponChoreography } from '../app/v177WeaponChoreography.js';

test('every runtime biped uses phase and stance metadata from its matching source anatomy',async()=>{
  for(const [kind,atlas] of Object.entries(atlases)){
    if(atlas.type!=='rigid-parts'||atlas.legConstraints?.length!==2)continue;
    const gait=V177_AUTHORED_GAITS[kind]; assert.ok(gait,kind);
    for(const source of gait.sources){
      const bytes=await readFile(source.file),d=JSON.parse(bytes);
      assert.equal(source.hashEncoding,'utf8-lf',kind);
      assert.equal(gaitSourceHash(bytes),source.sha256,kind);
      assert.deepEqual(d.legConstraints,atlas.legConstraints,kind);
      assert.equal(gait.stanceFraction,d.motion.walk.stanceFraction,kind);
      for(const [index,leg]of atlas.legConstraints.entries())assert.equal(gait.offsets[leg.effectorBone],d.rig.legs[index].offset,kind);
    }
  }
});

const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
test('running actors entering in flight keep both feet moving, land at a stop, and resume from painted feet',()=>{
  const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
  for(const kind of Object.keys(V177_AUTHORED_GAITS).filter(k=>V177_AUTHORED_GAITS[k].stanceFraction<.5)){
    for(const stopImmediately of [false,true]){
      const actor={id:1,kind,hp:100,x:300,y:300,knock:0},world={time:0};let previous;
      for(let n=0;n<85;n++){
        const moving=n===0||(!stopImmediately&&n<18)||n>=60;
        const phase=.49+(n>=60?(n-59)*.012:!stopImmediately?Math.min(n,17)*.012:0);
        actor.x=300+(n>=60?(n-59)*.4:!stopImmediately?Math.min(n,17)*.4:0);
        world.time=n/60;
        const runtime=actor.animationPresentation={moving,locomotionPhase:phase,locomotionSettle:moving?0:1,direction:'right'};
        let plan=v177JointPose(kind,{requestedState:moving?'move':'idle',clipProgress:phase},runtime,{grounded:true,actor,world});
        plan=v105BipedFootPlan(kind,plan,{actor,world,width:100,frame:{anchorX:.5},direction:'right'});
        assert.ok(plan.bipedFeet,kind);
        for(const [i,foot]of plan.bipedFeet.feet.entries()){
          if(foot.mode==='plant')assert.equal(foot.height,0,`${kind} ${n} no airborne plant`);
          if(n>0&&previous.feet[i].height>0&&foot.height>0){
            assert.ok(foot.flight,`${kind} ${n} airborne foot owns landing`);
            assert.ok(foot.height!==previous.feet[i].height||foot.x!==previous.feet[i].x,`${kind} ${n} no frozen airborne foot`);
          }
          if(n===59)assert.equal(foot.height,0,`${kind} completes stop`);
        }
        drawV177JointPose(ctx,{naturalWidth:100},kind,plan,0,0,100,100,{actor,world});
        previous=plan.bipedFeet;
      }
    }
  }
});
test('walk carry reaches attack entry continuously and fades before the strike',()=>{
  for(const kind of ['babayaga','kumaverson','crazy-king','takuya-omega']){
    const atlas=atlases[kind],base={phase:.125,paintLocomotion:{phase:.125,settle:0},attackPhase:null};
    const walk=v177WeaponChoreography(kind,atlas,base).choreography;
    const entry=v177WeaponChoreography(kind,atlas,{...base,attackPhase:0}).choreography;
    const epsilon=v177WeaponChoreography(kind,atlas,{...base,attackPhase:1e-8}).choreography;
    for(const bone of ['spine',atlas.weaponBone]){
      for(let i=0;i<6;i++){
        assert.ok(Math.abs(walk.upper[bone][i]-entry.upper[bone][i])<.002,kind+' entry '+bone);
        assert.ok(Math.abs(entry.upper[bone][i]-epsilon.upper[bone][i])<.002,kind+' epsilon '+bone);
      }
    }
    assert.equal(v177WeaponChoreography(kind,atlas,{...base,attackPhase:.3}).choreography.walkingCarry,undefined);
  }
});
test('walking carry moves both held and free wrists while all shoulder/elbow/grip attachments remain joined',()=>{
  for(const kind of ['babayaga','kumaverson','crazy-king','takuya-omega']){
    const atlas=atlases[kind],poses=[];
    for(const phase of [.125,.375,.625,.875]){
      const runtime={moving:true,locomotionPhase:phase,locomotionSettle:0,direction:'right'};
      const actor={id:1,kind,hp:100,x:300,y:300,animationPresentation:runtime},world={time:phase};
      let plan=v177JointPose(kind,{requestedState:'move',clipProgress:phase},runtime,{grounded:true,actor,world});
      plan=v105BipedFootPlan(kind,plan,{actor,world,width:100,frame:{anchorX:.5},direction:'right'});
      assert.equal(plan.choreography.walkingCarry,true,kind);
      const captured=v177CaptureJointPose(kind,plan);poses.push(captured);
      for(const arm of plan.choreography.arms){
        for(const [a,b] of [
          [point(captured.upper[arm.parentBone],arm.shoulder),point(captured.upper[arm.upperBone],arm.shoulder)],
          [point(captured.upper[arm.upperBone],arm.elbow),point(captured.upper[arm.lowerBone],arm.elbow)],
          [point(captured.upper[arm.lowerBone],arm.wrist),point(captured.upper[arm.effectorBone],arm.effectorWrist??arm.wrist)],
        ])assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.002,kind+' continuous arm/grip');
      }
    }
    for(const arm of atlas.armConstraints){
      const points=poses.map(p=>point(p.upper[arm.effectorBone],arm.effectorWrist??arm.wrist));
      assert.ok(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))>1,kind+' wrist follows walking');
    }
    const runtime={moving:false,locomotionPhase:.25,locomotionSettle:1,direction:'right'};
    const idle=v177JointPose(kind,{requestedState:'idle'},runtime,{actor:{kind,animationPresentation:runtime}});
    assert.equal(idle.choreography.walkingCarry,undefined,'standing carry remains unchanged');
  }
});

test('gait source identity ignores only checkout CRLF while rejecting authored changes',()=>{
  const lf=Buffer.from('{\n  "stance": 0.62\n}\n');
  assert.equal(gaitSourceHash(lf),gaitSourceHash(Buffer.from(lf.toString().replaceAll('\n','\r\n'))));
  assert.notEqual(gaitSourceHash(lf),gaitSourceHash(Buffer.from(lf.toString().replace('0.62','0.63'))));
  assert.notEqual(gaitSourceHash(lf),gaitSourceHash(Buffer.from(lf.toString().replace('  "stance"',' "stance"'))));
});
