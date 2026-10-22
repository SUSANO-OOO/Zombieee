import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {drawV104EyeBeam} from '../app/v104CombatVfx.js';
import {V177_JOINT_ATLASES as atlases,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
import {queueV100ClawContact,getV100ClawContactSnapshot} from '../app/v100CombatVfx.js';

const source=readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const point=(matrix,p)=>[matrix[0]*p[0]+matrix[2]*p[1]+matrix[4],matrix[1]*p[0]+matrix[3]*p[1]+matrix[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('Kurome normal damage records one visual eye pulse with the actual committed source and target, adding no damage path',()=>{
  const matches=[];const visit=node=>{if(ts.isIfStatement(node)&&node.expression.getText(tree)==='f.kind === "kurome" && g.definition.missionConfig.v100StageNumber')matches.push(node);ts.forEachChild(node,visit);};visit(tree);assert.equal(matches.length,1);
  const shots=[],g={definition:{missionConfig:{v100StageNumber:17}}},f={id:45,kind:'kurome',hp:2100},target={id:3,x:480,y:340,hp:62};
  const before=structuredClone({f,target}),muzzle={x:690,y:220};
  const run=new Function('g','f','target','weaponAnchorForTarget','addShot',matches[0].thenStatement.getText(tree));
  run(g,f,target,(owner,victim)=>{assert.equal(owner,f);assert.equal(victim,target);return muzzle;},(...args)=>shots.push(args));
  assert.equal(shots.length,1);assert.deepEqual(shots[0],[g,690,220,480,312,.18,'zombie',.18,'projectile','kurome',undefined,45,3]);
  assert.deepEqual({f,target},before);
});

test('short melee strikes extend the actual hands while every original arm length and planted lower remains intact',()=>{
  for(const kind of ['walker','runner','turned','grappler','futago-separated-a','futago-separated-b','zakimiya'])for(let sequence=0;sequence<2;sequence++){
    const atlas=atlases[kind],runtime={locomotionPhase:.37,locomotionSettle:1};
    for(const state of ['wind-up','active','recovery'])for(let frame=0;frame<=60;frame++){
      const plan=v177JointPose(kind,{requestedState:state,clipProgress:frame/60},runtime,{grounded:true,actor:{attackSequence:sequence+1,attackWindup:state==='wind-up'?1:0}});
      const captured=v177CaptureJointPose(kind,plan),bare={...plan};delete bare.choreography;
      const lower=v177CaptureJointPose(kind,bare).lower;assert.deepEqual(captured.lower,lower,kind+' planted lower');
      for(const arm of atlas.armConstraints){
        const shoulder=point(captured.upper[arm.parentBone],arm.shoulder),elbow=point(captured.upper[arm.upperBone],arm.elbow),wrist=point(captured.upper[arm.effectorBone],arm.effectorWrist??arm.wrist);
        assert.ok(Math.abs(distance(shoulder,elbow)-distance(arm.shoulder,arm.elbow))<.002,kind+' upper arm');
        assert.ok(Math.abs(distance(elbow,wrist)-distance(arm.elbow,arm.wrist))<.002,kind+' lower arm');
        assert.ok(wrist.every(Number.isFinite));
      }
    }
    const contact=v177CaptureJointPose(kind,v177JointPose(kind,{requestedState:'active',clipProgress:0},runtime,{grounded:true,actor:{attackSequence:sequence+1}}));
    const lead=atlas.armConstraints.filter((_,index)=>kind==='zakimiya'?index===0:kind==='grappler'||kind.startsWith('futago-')||index===sequence);
    for(const arm of lead){const shoulder=point(contact.upper[arm.parentBone],arm.shoulder),wrist=point(contact.upper[arm.effectorBone],arm.effectorWrist??arm.wrist);
      assert.ok(wrist[0]-shoulder[0]>(distance(arm.shoulder,arm.elbow)+distance(arm.elbow,arm.wrist))*.75,kind+' hand must reach in front at impact');}
  }
});

test('the pan rises above the arm then brings its bowl in front of the torso through contact',()=>{
  const kind='kumaverson',atlas=atlases[kind],runtime={locomotionPhase:0,locomotionSettle:1};
  const pose=(state,progress)=>v177CaptureJointPose(kind,v177JointPose(kind,{requestedState:state,clipProgress:progress},runtime,{grounded:true,actor:{attackSequence:1,attackWindup:state==='wind-up'?1:0}}));
  const windup=pose('wind-up',.2/.28),arm=atlas.armConstraints[0],lifted=point(windup.upper[atlas.weaponBone],atlas.muzzle),shoulder=point(windup.upper[arm.parentBone],arm.shoulder);
  assert.ok(lifted[1]<shoulder[1]-30,'the bowl must actually rise, not only turn at the waist');
  for(const progress of [0,.25,.5,.75]){const contact=pose('active',progress),tip=point(contact.upper[atlas.weaponBone],atlas.muzzle),waist=point(contact.upper.spine,atlas.interpolationPivots.spine);
    assert.ok(tip[0]-waist[0]>40,'the bowl must strike in front rather than drop behind the hips');}
});

test('turned and split Futago claw contact requires real surviving damage and retains guard and miss exclusions',()=>{
  for(const kind of ['turned','futago']){
    const world={time:3,definition:{missionConfig:{v100StageNumber:24}}},attacker={id:7,kind,side:'zombie',x:580,attackSequence:3};
    const target={id:2,kind:'guardian',side:'human',x:540,y:340,hp:80};
    assert.equal(queueV100ClawContact(world,{attacker,target,hpBefore:100,attackKind:'melee'}),true);
    assert.equal(getV100ClawContactSnapshot(world)[0].sourceId,7);
    for(const invalid of [{target:{...target,hp:100}},{attackKind:'ranged'},{target:{...target,manualAbility:{phase:'active'}}}]){
      assert.equal(queueV100ClawContact(world,{attacker,target,hpBefore:100,attackKind:'melee',...invalid}),false);
    }
  }
});

test('normal eye pulse paints the authored beam between its committed endpoints in both directions',()=>{
  const fn=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='drawAuthoredShotVfx');assert.ok(fn);
  const draw=vm.runInNewContext(ts.transpileModule(fn.getText(tree)+'\ndrawAuthoredShotVfx;',{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{drawV104EyeBeam});
  const image={complete:true,naturalWidth:512,naturalHeight:128};
  for(const direction of [-1,1]){
    const events=[],ctx={save(){},restore(){},translate:(...values)=>events.push(['origin',...values]),rotate:angle=>events.push(['angle',angle]),drawImage:(...values)=>events.push(['image',...values])};
    const shot={x:600,y:220,tx:600+direction*210,ty:312,sourceId:45,targetId:3,life:.18,style:'projectile'};
    assert.equal(draw(ctx,shot,{p:.5,duration:.18,impactProgress:0,weapon:'kurome',weaponProfile:{trail:'contact-arc'},v100StageObjects:{'v104-eye':image}}),true);
    assert.deepEqual(events[0],['origin',600,220]);assert.equal(events[1][1],Math.atan2(92,direction*210));
    const sprite=events[2];assert.equal(sprite[1],image);assert.equal(sprite.at(-1),12);assert.ok(sprite.at(-2)>210);
  }
});
