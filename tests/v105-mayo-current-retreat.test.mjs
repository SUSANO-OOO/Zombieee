import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {V177_JOINT_ATLASES as atlases,v177JointPose,v177CaptureJointPose,drawV177JointPose} from '../app/v177JointPresentation.js';
import {createV177LifecyclePresentation} from '../app/v177LifecyclePresentation.js';
import {animationClipFor,sampleAnimationClip} from '../app/combatPresentation.js';
import {createMayoRetreatRuntime,advanceMayoRetreat,mayoBattleRenderKind,mayoRetreatSpriteState,MAYO_RETREAT_TIMING} from '../app/mayoLifecycle.js';
import {v177JointActorKey} from '../app/v177JointActorHistory.js';
const {v177MayoRetreatSample:sample}=createV177LifecyclePresentation({animationClipFor,sampleAnimationClip,mayoRetreatSpriteState,v177JointActorKey,
  atlasFor:kind=>atlases[kind],v177CaptureJointPose});
const source=readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let declaration;const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='beginMayoRetreat')declaration=node;else ts.forEachChild(node,visit);};visit(tree);
const begin=vm.runInNewContext(ts.transpileModule(declaration.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText+'\nbeginMayoRetreat',
  {mayoBattleRenderKind,createMayoRetreatRuntime,cards:[{kind:'mayo-chan',deployCooldown:24}],addParticles(){}});
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function paint(kind,plan,actor,world){
  let m=[1,0,0,1,0,0];const stack=[],calls=[],image={naturalWidth:atlases[kind].decodedWidth,path:atlases[kind].path};
  const ctx={canvas:{width:1280,height:720},save(){stack.push([...m]);},restore(){m=stack.pop();},
    translate(x,y){m=multiply(m,[1,0,0,1,x,y]);},scale(x,y){m=multiply(m,[x,0,0,y,0,0]);},transform(...t){m=multiply(m,t);},
    drawImage(img,...rect){calls.push({path:img.path,matrix:[...m],rect});},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}};
  assert.equal(drawV177JointPose(ctx,image,kind,plan,0,0,480,448,{actor,world}),true);assert.equal(stack.length,0);
  assert.equal(calls.length,atlases[kind].parts.length);assert.ok(calls.every(c=>c.path===atlases[kind].path));return calls;
}

test('real Mayo ability/injury retreat paints the same current form through moving knees, fall, rise and run',()=>{
 for(const [phase,reason]of [['ready','injury'],['feral','injury'],['feral','ability']]){
  const actor={id:7,kind:'mayo-chan',side:'human',hp:160,maxHp:160,x:420,y:280,manualAbility:{kind:'mayo-chan',phase,activationId:1,activeRemaining:3},
    animationPresentation:{locomotionPhase:.371,locomotionSettle:1,moving:false,direction:'right'}};
  const world={time:20,fighters:[actor],manualAbilityVfx:[],deployCooldowns:{},corpses:[]};
  const kind=mayoBattleRenderKind(actor),atlas=atlases[kind],runtime=actor.animationPresentation;
  const original=v177JointPose(kind,{requestedState:'idle'},runtime,{actor,world,grounded:true});const before=paint(kind,original,actor,world);
  actor.hp=reason==='ability'?20.6:0;const retreatHp=Math.max(1,actor.hp);
  assert.equal(begin(world,actor,reason),true);assert.equal(mayoBattleRenderKind(actor),kind);
  const phases=new Set(),spines=[];let first=true;
  for(let tick=0;tick<38;tick++){
    if(tick){const step=advanceMayoRetreat(actor.mayoRetreat,1/60,{x:actor.x,baseX:128});actor.mayoRetreat=step.runtime;actor.x=step.x;world.time+=1/60;}
    const animation=sample(actor),ownedPose=actor.mayoRetreat.phase!=='run',saved=structuredClone(actor);
    const plan=v177JointPose(kind,animation,runtime,{actor,world,grounded:true,ownedPose});assert.ok(plan,`${kind}/${actor.mayoRetreat.phase}`);
    const calls=paint(kind,plan,actor,world);assert.deepEqual(structuredClone(actor),saved,'Presentation cannot modify the retreat or gameplay');
    if(first){assert.deepEqual(calls,before,'The first protected fall starts at the actual last painted body');first=false;}
    phases.add(actor.mayoRetreat.phase);const pose=v177CaptureJointPose(kind,plan);spines.push(pose.upper.spine[5]);
    if(ownedPose){
      assert.equal(plan.mayoRetreatJoint.phase,actor.mayoRetreat.phase);assert.equal(plan.mayoRetreatJoint.elapsed,actor.mayoRetreat.phaseElapsed);
      assert.equal(plan.mayoRetreatJoint.sourceAtlas,atlas.path);assert.ok(plan.mayoRetreatJoint.drop>10);
      for(const leg of atlas.legConstraints){
        const hip=point(pose[leg.parentUpper===false?'lower':'upper'][leg.parentBone],leg.hip);
        const upperKnee=point(pose.lower[leg.upperBone],leg.knee),lowerKnee=point(pose.lower[leg.lowerBone],leg.knee);
        const ankle=point(pose.lower[leg.effectorBone],leg.ankle),shinEnd=point(pose.lower[leg.lowerBone],leg.ankle);
        assert.ok(distance(upperKnee,lowerKnee)<1e-6,'Original knee attachment');assert.ok(distance(ankle,shinEnd)<1e-6,'Original paw attachment');
        assert.ok(Math.abs(distance(hip,upperKnee)-distance(leg.hip,leg.knee))<1e-6,'Original thigh length');
        assert.ok(Math.abs(distance(lowerKnee,ankle)-distance(leg.knee,leg.ankle))<1e-6,'Original shin length');
      }
    }else assert.equal(plan.mayoRetreatJoint,undefined,'The normal current walking owner resumes');
  }
  assert.deepEqual([...phases],['fall','rise','run']);assert.ok(Math.max(...spines)-Math.min(...spines)>10,'The body really lowers and rises');
  assert.deepEqual(MAYO_RETREAT_TIMING,{fallSeconds:.34,riseSeconds:.22,runSpeed:190});assert.equal(actor.hp,retreatHp);assert.equal(world.corpses.length,0);
 }
});

test('Mayo retains the same frozen numeric clock without importing the campaign initialization graph',()=>{
 const lifecycle=readFileSync('app/mayoLifecycle.js','utf8');
 assert.doesNotMatch(lifecycle,/from\s+['"]\.\/content\//u);
 assert.equal(Object.isFrozen(MAYO_RETREAT_TIMING),true);
 assert.deepEqual(MAYO_RETREAT_TIMING,{fallSeconds:.34,riseSeconds:.22,runSpeed:190});
});
