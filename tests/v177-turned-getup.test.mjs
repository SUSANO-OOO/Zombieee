import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { ALLY_DEATH_CONFIG, ENEMY_DEATH_CONFIG, advanceAllyLifecycle, beginAllyDeath, createAllyLifecycle, createGenericZombieSpawn } from '../app/combatLifecycle.js';
import * as lifecycle from '../app/combatLifecycle.js';
import { createCombatAnimationRuntime, advanceCombatAnimationRuntime, combatFacingDirection, animationClipFor } from '../app/combatPresentation.js';
import { bossControlMultiplier } from '../app/bossFoundation.js';
import { createNavigationRecoveryState } from '../app/combatAiProfiles.js';
import { advanceAreaEffects } from '../app/gameRules.js';
import { enemyStatsForWave } from '../app/content/enemyCatalog.js';
import { V177_JOINT_ATLASES as atlases, v177JointPose, v177CaptureJointPose, drawV177JointPose, v177JointCycleDistance } from '../app/v177JointPresentation.js';
import { V177_WALKER_FLOOR_DATA as data } from '../app/v177WalkerFloorData.js';
import { v177LiveJointGroundLift, rememberV177CorpseJointPose, v177CorpseJointPresentation, drawV177CorpseJointPresentation,
  pruneV177CorpseJointPoses } from '../app/v177CorpseJointPresentation.js';
import { beginV102GoreStep, noteV102GoreImpact, finishV102GoreStep, v102GoreWeaponStyle } from '../app/v102CombatGore.js';
import { rememberV177TurnedCorpsePaint, rememberV177TurnedBirth, v177TurnedGetupPose, v177TurnedGetupDirection,
  readV177TurnedBirthPresentation, pruneV177TurnedCorpsePaints, createV177TurnedRiseCorpseRig } from '../app/v177TurnedGetupPresentation.js';
import { spriteFrameFor, spriteBattleDisplaySizeFor, fitSpriteBattleDisplaySize, COMPACT_BATTLE_SPRITE_SCALE } from '../app/spriteManifest.js';
import { v100EnemyContactSize } from '../app/v100EnemyContactPresentation.js';
import { v100HumanWalkFrame } from '../app/v100HumanWalk.js';
import { v102BattleBodyScale } from '../app/v102CombatMotion.js';
import { v102BattleDisplaySize } from '../app/v102BattleScale.js';
import { v102CorpseFallingPose, v102HasFallingDeathFrame } from '../app/v102CorpsePose.js';
import { createTurnedGetupDeathSampler } from '../app/v177TurnedGetupDeath.js';
import { allyCorpseVisualCue } from '../app/corpseVisuals.js';
import { stageGeometryFor, STAGE_VIEWPORT_IDS, battlefieldDepthScale } from '../app/stageGeometry.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';

const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const find=predicate=>{const rows=[];const visit=n=>{if(predicate(n))rows.push(n);ts.forEachChild(n,visit);};visit(tree);assert.equal(rows.length,1);return rows[0];};
const birthNode=find(n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='next.state === "generic-zombie"');
const compiled=ts.transpileModule('(g,original,next,revived)=>{for(const corpse of [original]){'+birthNode.getText(tree)+'}return revived[0];}',
  {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const cueCalls=[];
const actualBirth=new Function('createGenericZombieSpawn','enemyStatsForWave','enemyContentFor','bodyRadiusFor','enemyLaneSpeedFor',
  'createCombatAnimationRuntime','createNavigationRecoveryState','createStationAbilityRuntime','createUnitRoleRuntime',
  'rememberV177TurnedBirth','addParticles','playCue','return '+compiled)(createGenericZombieSpawn,enemyStatsForWave,()=>({aiProfile:'nearest'}),
  ()=>18,()=>70,createCombatAnimationRuntime,createNavigationRecoveryState,()=>({phase:'idle'}),()=>({}),rememberV177TurnedBirth,
  (...args)=>cueCalls.push(['particles',...args.slice(1)]),(...args)=>cueCalls.push(['cue',...args]));
function fixture({remaining=.02,delta=.02,angle=-1.57,paint=true,sourceBound=true}={}) {
  const original={...beginAllyDeath(createAllyLifecycle({id:9,kind:'ranger',x:450,y:300,lane:1,variant:0,hp:0})),
    state:'infection-warning',infectionRemaining:remaining,deathAge:12-remaining};
  const world={time:10,nextId:100,wave:1,battleAudioGeneration:4,fighters:[],corpses:[original]};
  if(paint)rememberV177TurnedCorpsePaint(world,original,{frame:spriteFrameFor('ranger','death','right'),
    x:450,y:287,angle,scaleY:1,flipX:false,sourceBound,sourceSha256:'fixture-source',supportY:18});
  const next=advanceAllyLifecycle(original,delta),actor=actualBirth(world,original,next,[]);
  if(actor)world.fighters.push(actor);
  return {world,original,next,actor};
}
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function trace(kind,plan,r,actor,world) {
  let matrix=[1,0,0,1,0,0];const stack=[],draws=[];
  const ctx={save:()=>stack.push([...matrix]),restore:()=>{matrix=stack.pop();},
    translate:(x,y)=>{matrix=multiply(matrix,[1,0,0,1,x,y]);},scale:(x,y)=>{matrix=multiply(matrix,[x,0,0,y,0,0]);},
    transform:(...m)=>{matrix=multiply(matrix,m);},drawImage:(image,...rect)=>draws.push({matrix:[...matrix],rect})};
  ctx.translate(r.x,r.y);ctx.scale(r.flipX?-1:1,1);
  assert.equal(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,-r.width*r.frame.anchorX,-r.height*r.frame.anchorY,r.width,r.height,{actor,world}),true);
  assert.equal(stack.length,0);assert.equal(draws.length,15);
  return draws;
}
const bottom=draws=>Math.max(...data.outlines.flatMap((o,i)=>o.hull.map(p=>point(draws[i].matrix,p)[1])));
function contexts() {
  const frame=spriteFrameFor('turned','walk-a','right'),size=v100EnemyContactSize('turned',frame,'right',spriteBattleDisplaySizeFor('turned'));
  return Object.values(STAGE_VIEWPORT_IDS).flatMap(viewport=>{
    const geo=stageGeometryFor(V100_STAGE_IDS[0],viewport),depth=battlefieldDepthScale(geo,geo.lanes[1].y);
    const scale=(viewport===STAGE_VIEWPORT_IDS.STANDARD?1:COMPACT_BATTLE_SPRITE_SCALE)*depth*v102BattleBodyScale('turned');
    return [false,true].map(flipX=>({viewport,frame,width:size.w*scale,height:size.h*scale,x:450,y:300,angle:0,scaleX:1,scaleY:1,flipX}));
  });
}

test('the actual infection branch registers its new object and ID with the original overshoot, generic kit, cue and action clocks',()=>{
  for(const delta of [.02,.02666666666666667,.06,.81]) {
    cueCalls.length=0;const {world,original,next,actor}=fixture({delta});
    assert.equal(actor.id,100);assert.equal(world.nextId,101);assert.equal(actor.kind,'turned');assert.equal(actor.side,'zombie');
    assert.equal(actor.spawnGrace,next.riseLockRemaining);assert.equal(actor.cooldown,Math.max(.4,next.riseLockRemaining));
    assert.equal(actor.hp,enemyStatsForWave('turned',1).hp);assert.equal(actor.animationPresentation.state,'idle');
    assert.equal(actor.animationPresentation.direction,'left');assert.equal(actor.weapon,undefined);assert.equal(actor.sourceAllyId,undefined);
    const birth=readV177TurnedBirthPresentation(world,actor);assert.equal(birth.corpseId,original.id);assert.equal(birth.actorId,100);
    assert.equal(birth.source.recordedAfterPaint,true);assert.equal(birth.source.physicalFloorY,305);assert.equal(birth.source.paintedFloorY,305);
    assert.deepEqual(cueCalls.map(c=>c[0]),['particles','cue']);assert.deepEqual(cueCalls[1],['cue','turned']);
    const plan=v177TurnedGetupPose(world,actor);
    if(actor.spawnGrace>0)assert.ok(Math.abs(plan.getupProgress-(delta-.02)/ALLY_DEATH_CONFIG.riseLockSeconds)<1e-12);
    else assert.equal(plan,null,'expired rise is not restarted or extended by first paint');
  }
  const {actor}=fixture({delta:.01});assert.equal(actor,undefined);
});

test('ordinary grace, an unpainted corpse, failed ownership and dead actors cannot borrow a rise or another world',()=>{
  const {world,actor,original}=fixture();
  assert.equal(v177TurnedGetupPose({...world},actor),null);
  assert.equal(v177TurnedGetupPose(world,{...actor,id:101}),null);
  assert.equal(v177TurnedGetupPose(world,{...actor,hp:0}),null);
  for(const owner of [{attack:.12},{attackWindup:.2},{abilityWindup:.2},{contained:true},{gateEntering:true},
    {stationAbility:{phase:'active'}},{manualAbility:{phase:'active'}}]) {
    const own=fixture();Object.assign(own.actor,owner);
    assert.equal(v177TurnedGetupPose(own.world,own.actor),null);
    assert.equal(v177TurnedGetupDirection(own.world,own.actor,'right'),'right');
    Object.assign(own.actor,{attack:0,attackWindup:0,abilityWindup:0,contained:false,gateEntering:false,
      stationAbility:{phase:'idle'},manualAbility:null});
    assert.equal(v177TurnedGetupPose(own.world,own.actor),null,'an owned action permanently retires the interrupted rise');
    assert.equal(v177TurnedGetupDirection(own.world,own.actor,'right'),'right');
  }
  const owned=fixture();assert.equal(v177TurnedGetupPose(owned.world,owned.actor,{ownedPose:true}),null);
  assert.equal(v177TurnedGetupPose(owned.world,owned.actor),null);
  assert.equal(v177TurnedGetupDirection(world,actor,'right',{enabled:false}),'right');
  assert.equal(v177TurnedGetupDirection(world,null,'right'),'right');
  assert.equal(v177TurnedGetupPose(world,{...actor,side:'human'}),null);
  const ordinary={...actor,id:102};assert.equal(v177TurnedGetupPose(world,ordinary),null);
  const unseen=fixture({paint:false});assert.equal(readV177TurnedBirthPresentation(unseen.world,unseen.actor).source,null);
  assert.ok(v177TurnedGetupPose(unseen.world,unseen.actor),'late first display follows the existing clock without inventing source-paint evidence');
  world.corpses=[];pruneV177TurnedCorpsePaints(world);
  const next={...actor,id:103};rememberV177TurnedBirth(world,original,next);
  assert.equal(readV177TurnedBirthPresentation(world,next).source,null);
});

test('a lying authored bitmap cannot choose a different rise from the sign of its infection twitch',()=>{
  for(const angle of [-.065,-.024,0,.024,.065]) {
    const {world,actor}=fixture({angle,sourceBound:false}),birth=readV177TurnedBirthPresentation(world,actor);
    assert.equal(birth.variant,'forward');assert.equal(birth.variantBasis,'stable-fallback');
    assert.equal(birth.source.paintedFloorY,null);assert.equal(v177TurnedGetupPose(world,actor).getupSourcePaintBound,false);
  }
});

test('actual source-body rise paints all15 parts on the same floor through both directions, three viewports and mirrors',()=>{
  const baseline=JSON.stringify(atlases.turned),rows=contexts();let samples=0;
  for(const angle of [-1.57,1.57]) {
    const {world,actor}=fixture({angle});
    for(let i=0;i<1000;i++) {
      const p=i/1000;actor.spawnGrace=.75*(1-p);const plan=v177TurnedGetupPose(world,actor);
      assert.equal(plan.getupVariant,angle<0?'forward':'back');
      assert.equal(Object.keys(v177CaptureJointPose('turned',plan).lower).length,15);
      for(const r of rows) {
        const floor=r.y+5,correction=v177LiveJointGroundLift('turned',plan,r,floor),draws=trace('turned',plan,{...r,y:r.y-correction},actor,world);
        assert.ok(Math.abs(bottom(draws)-floor)<1e-9);
        for(let j=0;j<15;j++)assert.deepEqual(draws[j].rect.slice(0,4),Object.values(atlases.turned.parts[j].source));
        samples++;
      }
    }
  }
  assert.equal(samples,12000);assert.equal(JSON.stringify(atlases.turned),baseline);
});

test('real Fighter replacement, pause, hit and stun do not restart or freeze the birth clock or accumulate body transforms',()=>{
  for(const angle of [-1.57,1.57]) {
    const {world}=fixture({angle});let actor=world.fighters[0];
    for(const p of [.05,.15,.3,.5,.7,.9,.99]) {
      world.fighters=advanceAreaEffects({areaEffects:[],fighters:world.fighters,seconds:1/60}).fighters;actor=world.fighters[0];
      Object.assign(actor,{spawnGrace:.75*(1-p),flash:.09,stunned:.42,knock:12});
      const before=JSON.stringify(actor),plan=v177TurnedGetupPose(world,actor);assert.ok(Math.abs(plan.getupProgress-p)<1e-12);
      for(let n=0;n<3;n++)assert.deepEqual(v177TurnedGetupPose(world,actor),plan);
      assert.equal(JSON.stringify(actor),before);assert.equal(v177TurnedGetupDirection(world,actor,'right'),'left');
    }
    actor.spawnGrace=0;assert.equal(v177TurnedGetupPose(world,actor),null);
    assert.equal(v177TurnedGetupDirection(world,actor,'right'),'left','forced recoil keeps facing across lock expiry');
    actor.knock=0;actor.flash=0;actor.stunned=0;assert.equal(v177TurnedGetupDirection(world,actor,'right'),'right');
    actor.knock=12;assert.equal(v177TurnedGetupDirection(world,actor,'right'),'right','a retired birth cannot own a later normal hit');
  }
});

test('incoming recoil follows the live rise with fixed contacts and original lengths, without repaint or re-hit accumulation',()=>{
  for(const angle of [-1.57,1.57]) {
    const {world,actor}=fixture({angle}),base=fixture({angle}),rows=contexts();let observed=0;
    for(let i=0;i<250;i++) {
      const p=i/250;actor.spawnGrace=base.actor.spawnGrace=.75*(1-p);actor.flash=.12;actor.stunned=.42;
      const before=JSON.stringify(actor),plan=v177TurnedGetupPose(world,actor),pose=v177CaptureJointPose('turned',plan).lower;
      const normal=v177CaptureJointPose('turned',v177TurnedGetupPose(base.world,base.actor)).lower;
      for(const bone of ['pelvis','arm-0-hand','arm-1-hand','leg-0-foot','leg-1-foot'])assert.deepEqual(pose[bone],normal[bone]);
      for(const [constraints,parent]of [[atlases.turned.armConstraints,'spine'],[atlases.turned.legConstraints,'pelvis']])for(const chain of constraints) {
        const A=chain.shoulder??chain.hip,B=chain.elbow??chain.knee,C=chain.wrist??chain.ankle;
        for(const [a,b]of [[point(pose[parent],A),point(pose[chain.upperBone],A)],
          [point(pose[chain.upperBone],B),point(pose[chain.lowerBone],B)],
          [point(pose[chain.lowerBone],C),point(pose[chain.effectorBone],C)]])assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-9);
        for(const bone of [chain.upperBone,chain.lowerBone,chain.effectorBone])assert.ok(Math.abs(Math.hypot(pose[bone][0],pose[bone][1])-1)<1e-12);
      }
      if(plan.getupReactionAmplitude>0){observed++;assert.notDeepEqual(pose.spine,normal.spine);}
      for(const r of rows) {
        const floor=r.y+5,correction=v177LiveJointGroundLift('turned',plan,r,floor);
        assert.ok(Math.abs(bottom(trace('turned',plan,{...r,y:r.y-correction},actor,world))-floor)<1e-9);
      }
      assert.deepEqual(v177TurnedGetupPose(world,actor),plan);assert.equal(JSON.stringify(actor),before);
      actor.stunned=.5;assert.deepEqual(v177TurnedGetupPose(world,actor),plan,'a same-phase re-hit enters at the previous amplitude');
    }
    assert.ok(observed>200);
    actor.flash=0;actor.stunned=0;assert.equal(v177TurnedGetupPose(world,actor).getupReactionAmplitude,0);
  }
});

test('getup terminal paint tends to the same source ready, then original status and travel selectors own the live body',()=>{
  for(const angle of [-1.57,1.57]) {
    const {world,actor}=fixture({angle}),r=contexts()[0],runtime={locomotionPhase:0,locomotionSettle:1};
    actor.spawnGrace=.75e-9;const last=v177TurnedGetupPose(world,actor);trace('turned',last,r,actor,world);
    actor.spawnGrace=0;const ready=v177JointPose('turned',{requestedState:'idle'},runtime,{grounded:true,actor,world});
    const a=v177CaptureJointPose('turned',last),b=v177CaptureJointPose('turned',ready);
    for(const part of atlases.turned.parts)for(let j=0;j<6;j++)assert.ok(Math.abs(a[part.upper?'upper':'lower'][part.bone][j]-b[part.upper?'upper':'lower'][part.bone][j])<1e-9);
    const move=v177JointPose('turned',{requestedState:'move'},{locomotionPhase:.12,locomotionSettle:.2},{actor,world});
    assert.notEqual(move.turnedGetup,true);assert.ok(Math.abs(move.phase-.12)<1e-12);
    const stunned=v177JointPose('turned',{requestedState:'incapacitated'},runtime,{actor,world,stunRemaining:.2});
    assert.equal(stunned.liveStun,true);assert.equal(stunned.turnedGetup,undefined);
  }
});

test('the rise lands into the current nonzero gait and settled lift in actual world paint without resetting runtime',()=>{
  const rows=contexts();let samples=0;
  for(const angle of [-1.57,1.57]) {
    const {world,actor}=fixture({angle});
    for(const phase of [-.044,-.004,0,.004,.044,.25,.5,.75])for(const settle of [0,.3125,1]) {
      actor.animationPresentation={...actor.animationPresentation,locomotionPhase:phase,locomotionSettle:settle};
      const before=JSON.stringify(actor.animationPresentation);actor.spawnGrace=.75e-9;
      const rising=v177TurnedGetupPose(world,actor),ordinary=v177JointPose('turned',{requestedState:'idle'},actor.animationPresentation,{grounded:true});
      assert.equal(rising.phase,ordinary.phase);assert.equal(rising.settleIndex,ordinary.settleIndex);
      for(const r of rows) {
        const floor=r.y+5;
        const a=trace('turned',rising,{...r,y:r.y-v177LiveJointGroundLift('turned',rising,r,floor)},actor,world);
        const b=trace('turned',ordinary,{...r,y:r.y-v177LiveJointGroundLift('turned',ordinary,r,floor)},actor,world);
        assert.ok(Math.abs(bottom(a)-floor)<1e-9);assert.ok(Math.abs(bottom(b)-floor)<1e-9);
        for(let part=0;part<15;part++)for(const p of data.outlines[part].hull) {
          const x=point(a[part].matrix,p),y=point(b[part].matrix,p);
          assert.ok(Math.hypot(x[0]-y[0],x[1]-y[1])<1e-8);
        }
        samples++;
      }
      assert.equal(JSON.stringify(actor.animationPresentation),before);
    }
  }
  assert.equal(samples,288);
});

test('real App connects postpaint, birth, direction and resolved pose before its successful original15-part draw',()=>{
  const hook=find(n=>ts.isCallExpression(n)&&n.expression.getText(tree)==='rememberV177TurnedCorpsePaint'
    &&ts.isObjectLiteralExpression(n.arguments[2])&&n.arguments[2].properties.some(p=>ts.isShorthandPropertyAssignment(p)&&p.name.text==='frame'));
  let block=hook;while(block&&!ts.isBlock(block))block=block.parent;
  const statements=block.statements.map(n=>n.getText(tree));
  assert.ok(statements.findIndex(s=>s.startsWith('endV102CorpseSever('))<statements.findIndex(s=>s.includes('rememberV177TurnedCorpsePaint')));
  const continuous=find(n=>ts.isCallExpression(n)&&n.expression.getText(tree)==='rememberV177TurnedCorpsePaint'
    &&ts.isObjectLiteralExpression(n.arguments[2])&&n.arguments[2].properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(tree)==='frame'&&p.initializer.getText(tree)==='paint.frame'));
  assert.ok(ts.isIfStatement(continuous.parent.parent)&&continuous.parent.parent.expression.getText(tree)==='drawn',
    'a failed continuous body draw must not become an infection source');
  const branch=birthNode.thenStatement.getText(tree);assert.ok(branch.indexOf('const revivedFighter')<branch.indexOf('rememberV177TurnedBirth(g,corpse,revivedFighter)'));
  assert.ok(branch.indexOf('rememberV177TurnedBirth(g,corpse,revivedFighter)')<branch.indexOf('revived.push(revivedFighter)'));
  const declaration=find(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='jointPose');
  assert.ok(declaration.initializer.getText(tree).indexOf('v177TurnedGetupPose')<declaration.initializer.getText(tree).indexOf('v177JointPose'));
  const direction=find(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='direction'&&n.initializer?.getText(tree).startsWith('v177TurnedGetupDirection(options.world,f,'));
  assert.ok(direction.initializer.getText(tree).includes('options.world,f,'));
  assert.equal(v100HumanWalkFrame(spriteFrameFor('turned','walk-a','right'),'left').flipX,true);
});

test('the actual runtime-facing selector keeps a late knocked birth facing its original opponent while real travel advances signed gait',()=>{
  const direction=find(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='direction'
    &&n.initializer?.getText(tree).startsWith('v177TurnedGetupDirection(g,fighter,'));
  const expression=ts.transpileModule('return '+direction.initializer.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const choose=new Function('g','fighter','actualXDeltaByFighterId','facingTarget','manualAbilityActive','v177TurnedGetupDirection','combatFacingDirection',expression);
  const knock=find(n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='Math.abs(f.knock) > .1');
  const applyKnock=new Function('f','dt','bossControlMultiplier',ts.transpileModule(knock.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText);
  for(const stunned of [false,true]) {
    const {world,actor}=fixture(),r=contexts()[0];world.definition={missionConfig:{v100StageNumber:1}};
    const distance=v177JointCycleDistance('turned',r.width/r.frame.sourceRect.w),dt=1/60;let negative=false,released=false;
    for(let tick=0;tick<120;tick++) {
      if(tick===42){actor.knock=12;actor.flash=.12;actor.stunned=stunned ? .42 : 0;}
      actor.spawnGrace=Math.max(0,actor.spawnGrace-dt);actor.flash=Math.max(0,actor.flash-dt);actor.stunned=Math.max(0,actor.stunned-dt);
      const x=actor.x;applyKnock(actor,dt,bossControlMultiplier);const dx=actor.x-x;
      const direction=choose(world,actor,new Map([[actor.id,dx]]),undefined,false,v177TurnedGetupDirection,combatFacingDirection);
      const status=actor.flash>0?'hit-light':actor.stunned>0?'incapacitated':undefined;
      const next=advanceCombatAnimationRuntime(actor.animationPresentation,{kind:'turned',x:actor.x,y:actor.y,direction,
        state:status,locomotionCycleDistance:distance},dt);
      const isForced=actor.spawnGrace>0||actor.flash>0||actor.stunned>0||actor.knock>.1;
      if(isForced)assert.equal(direction,'left');else released=true;
      if(dx>.05&&!status){negative=true;assert.ok(next.locomotionPhase<actor.animationPresentation.locomotionPhase);}
      actor.animationPresentation=next;
      assert.equal(v177TurnedGetupDirection(world,actor,direction),direction);
    }
    assert.ok(actor.x>450);assert.equal(negative,true);assert.equal(released,true);
    assert.equal(readV177TurnedBirthPresentation(world,actor).facingReleased,true);
  }
});

test('the actual App draw receipt is published only after all15 joint parts paint successfully',()=>{
  const draw=find(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='drewArticulatedWalk');
  const post=find(n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='fighterRenderAuditEnabled&&recordAudit&&jointPose?.turnedGetup');
  const genericPost=find(n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='fighterRenderAuditEnabled&&recordAudit'
    &&n.thenStatement.getText(tree).includes('jointDrawSucceeded=Boolean'));
  const compiled=ts.transpileModule('(ctx,jointImage,renderKind,jointPose,size,frame,f,options)=>{const articulatedWalk=false;'
    +'const drewArticulatedWalk='+draw.initializer.getText(tree)+';'+genericPost.getText(tree)+post.getText(tree)+'return drewArticulatedWalk;}',
  {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const history=new WeakMap();
  const paint=new Function('drawV177JointPose','v177CaptureJointPose','fighterRenderAuditEnabled','recordAudit','fighterRenderAudit',
    'return '+compiled)(drawV177JointPose,v177CaptureJointPose,true,true,history);
  for(const imageReady of [true,false]) {
    const {world,actor}=fixture(),plan=v177TurnedGetupPose(world,actor),r=contexts()[0],drawn=[];
    const receipt={jointGetupProgress:plan.getupProgress,jointGetupDrawSucceeded:false};history.set(actor,receipt);
    const ctx={save(){},restore(){},translate(){},scale(){},transform(){},drawImage(...args){drawn.push(args);}};
    assert.equal(paint(ctx,{naturalWidth:imageReady?512:0},'turned',plan,{w:r.width,h:r.height},r.frame,actor,{world}),imageReady);
    assert.equal(receipt.jointGetupDrawSucceeded,imageReady);
    assert.equal(receipt.jointDrawSucceeded,imageReady);
    if(imageReady) {
      assert.equal(drawn.length,15);assert.equal(receipt.jointGetupPaintedAt,world.time);
      assert.equal(receipt.jointPaintedAt,world.time);
      assert.deepEqual(receipt.jointGetupPaintedPose,v177CaptureJointPose('turned',plan));
      assert.equal(receipt.jointGetupReactionAmplitude,plan.getupReactionAmplitude);
    }else {
      assert.equal(drawn.length,0);assert.equal(receipt.jointGetupPaintedAt,undefined);
      assert.equal(receipt.jointGetupPaintedPose,undefined);
      assert.equal(receipt.jointPaintedAt,undefined);
    }
  }
});

test('the actual human corpse branch records its painted transform before the new birth, and fails closed on incomplete drawing',()=>{
  const image=find(n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='sprite?.complete && sprite.naturalWidth'
    &&n.thenStatement.getText(tree).includes('rememberV177TurnedCorpsePaint'));
  const branch=ts.transpileModule('if('+image.expression.getText(tree)+')'+image.thenStatement.getText(tree),
    {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  function paintAndBirth({kind='ranger',time=10,variant=0,throwDraw=false,throwEnd=false,ready=true,naturalWidth=4096,v100=true}={}) {
    const corpse={...beginAllyDeath(createAllyLifecycle({id:9,kind,x:450,y:300,lane:1,variant,hp:0})),
      state:'infection-warning',warningLevel:'strong',infectionRemaining:.01,deathAge:11.99,life:2.1,deathClass:'normal'};
    const world={time,wave:1,nextId:100,fighters:[],corpses:[corpse],definition:{missionConfig:{v100StageNumber:v100?1:0}}};
    const events=[],draws=[];let matrix=[1,0,0,1,0,0];
    const ctx={globalAlpha:1,filter:'none',translate(x,y){matrix=multiply(matrix,[1,0,0,1,x,y]);},
      rotate(a){matrix=multiply(matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
      scale(x,y){matrix=multiply(matrix,[x,0,0,y,0,0]);},drawImage(){events.push('draw');
        if(throwDraw)throw Error('draw failed');draws.push([...matrix]);}};
    const bindings={ctx,g:world,corpse,corpseRenderKind:kind,sprite:{complete:ready,naturalWidth},
      allyCue:allyCorpseVisualCue(corpse,time),fallDirection:variant%2===0?-1:1,stageObjects:{},
      spriteFrameFor,spriteDisplaySize:spriteBattleDisplaySizeFor,v102BattleDisplaySize,fitSpriteBattleDisplaySize,
      compactSpriteScale:()=>1,compactBattleViewport:()=>false,activeBattlefieldDepthScale:()=>1,COMPACT_BATTLE_SPRITE_SCALE,
      v102BattleBodyScale,v102CorpseFallingPose,v102HasFallingDeathFrame,animationClipFor,ENEMY_DEATH_CONFIG,
      fighterRenderAuditEnabled:false,v102CorpseSeverPlan:()=>null,beginV102CorpseSever:()=>{},
      endV102CorpseSever:()=>{events.push('sever-end');if(throwEnd)throw Error('sever failed');},
      v100ImageSampler:{draw:(context,image,...args)=>context.drawImage(image,...args)},
      rememberV177TurnedCorpsePaint:(w,c,r)=>{events.push('postpaint');rememberV177TurnedCorpsePaint(w,c,r);}};
    const draw=new Function(...Object.keys(bindings),branch);let error=null;
    try{draw(...Object.values(bindings));}catch(failure){error=String(failure);}
    const actor=actualBirth(world,corpse,advanceAllyLifecycle(corpse,1/60),[]);events.push('born');
    return {error,draws,events,birth:readV177TurnedBirthPresentation(world,actor)};
  }
  for(const options of [{},{throwDraw:true},{throwEnd:true},{ready:false},{naturalWidth:0},{v100:false}]) {
    const result=paintAndBirth(options),success=!result.error&&result.draws.length>0&&options.v100!==false;
    assert.equal(result.events.includes('postpaint'),success);assert.equal(result.birth.source!==null,success);
    if(success) {
      assert.ok(result.events.indexOf('draw')<result.events.indexOf('sever-end'));
      assert.ok(result.events.indexOf('sever-end')<result.events.indexOf('postpaint'));
      assert.ok(result.events.indexOf('postpaint')<result.events.indexOf('born'));
      const matrix=result.draws.at(-1);assert.equal(result.birth.source.root.x,matrix[4]);assert.equal(result.birth.source.root.y,matrix[5]);
    }
  }
  for(const time of [10,10+2/60])assert.equal(paintAndBirth({time}).birth.variant,'forward');
  for(const variant of [0,1]) {
    const result=paintAndBirth({kind:'brawler',variant});assert.equal(result.error,null);assert.equal(result.birth.source.sourceBound,true);
    assert.equal(result.birth.variant,variant===0?'forward':'back');assert.equal(result.birth.variantBasis,'source-bound-fall');
    assert.equal(Math.sign(-result.draws.at(-1)[2]),Math.sign(Math.sin(result.birth.source.root.angle)));
  }
});

test('the actual postpaint, death and corpse branches retain a killed rise at F0 and preserve all original Gore styles',()=>{
  const js=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const remember=find(n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='options.v100AuthoredPresentation&&options.world'
    &&n.thenStatement.getText(tree).includes('rememberV177CorpseJointPose'));
  const retain=new Function('rememberV177CorpseJointPose',js('return(options,f,renderKind,jointPose,drewArticulatedWalk,frame,size,pose,depthScale,facingSign,bob)=>{'
    +remember.getText(tree)+'};'))(rememberV177CorpseJointPose);
  const death=find(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='lifecycle'&&n.initializer?.getText(tree).includes('beginEnemyDeath(createEnemyLifecycle'));
  const deathStatement=death.parent.parent,block=deathStatement.parent.statements,push=block[block.indexOf(deathStatement)+1];
  assert.ok(push.getText(tree).includes('g.corpses.push'));
  const die=new Function(...Object.keys(lifecycle),'isKuromeClone',js('return(g,fighter)=>{'+deathStatement.getText(tree)+push.getText(tree)
    +'return g.corpses.at(-1);};'))(...Object.values(lifecycle),()=>false);
  const names=['jointTiming','jointFallProgress','jointAshProgress','jointCorpse','jointCorpseImage','drewJointCorpse'];
  const declarations=names.map(name=>find(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)===name).parent.parent.getText(tree)).join('\n');
  const corpseDraw=find(n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='jointCorpse&&jointCorpseImage?.complete&&jointCorpseImage.naturalWidth');
  const paint=new Function('ENEMY_DEATH_CONFIG','v177CorpseJointPresentation','drawV177CorpseJointPresentation',
    js('return(ctx,g,corpse,corpseRenderKind,sprites,fallDirection,stageObjects)=>{const fighterRenderAuditEnabled=false;'
      +declarations+corpseDraw.getText(tree)+'return{jointCorpse,drewJointCorpse};};'))
    (ENEMY_DEATH_CONFIG,v177CorpseJointPresentation,drawV177CorpseJointPresentation);
  const stableAtlas=JSON.stringify(atlases.turned),rows=contexts();let samples=0;
  for(const angle of [-1.57,1.57])for(const progress of [0,.075,.2,.35,.6,.84,.9,.98])for(const weapon of [null,'tky','crazy-king','grenade','brute'])for(const r of rows) {
    const {world,actor}=fixture({angle});world.definition={missionConfig:{v100StageNumber:1}};world.corpses=[];
    actor.spawnGrace=.75*(1-progress);const plan=v177TurnedGetupPose(world,actor),floor=actor.y+5;
    const lift=v177LiveJointGroundLift('turned',plan,r,floor),living=trace('turned',plan,{...r,y:r.y-lift},actor,world);
    const frame={...r.frame,flipX:r.flipX},pose={offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1};
    retain({world,v100AuthoredPresentation:true},actor,'turned',plan,true,frame,{w:r.width,h:r.height},pose,1,1,lift);
    if(weapon) {
      const step=beginV102GoreStep(world,{heightFor:()=>r.height});assert.equal(noteV102GoreImpact(world,actor,{weapon,originX:actor.x-20,damage:actor.hp}),true);
      actor.hp=0;assert.equal(finishV102GoreStep(world,step),1);
    }else actor.hp=0;
    const corpse=die(world,actor);assert.equal(corpse.id,actor.id);assert.equal(corpse.kind,'turned');assert.equal(corpse.state,'dying');
    assert.equal(v177TurnedGetupPose(world,actor),null);world.fighters=[];pruneV177CorpseJointPoses(world);
    let entryBody=null;
    for(const deathProgress of [0,1/60/ENEMY_DEATH_CONFIG.timings.normal.dyingSeconds,.2,.5,.8,1]) {
      const age=deathProgress*ENEMY_DEATH_CONFIG.timings.normal.dyingSeconds;world.time=10+age;
      const current={...corpse,phaseElapsed:age},draws=[],stack=[];let matrix=[1,0,0,1,0,0];
      const target={globalAlpha:1,filter:'none',save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
        transform(...m){matrix=multiply(matrix,m);},translate(x,y){matrix=multiply(matrix,[1,0,0,1,x,y]);},
        scale(x,y){matrix=multiply(matrix,[x,0,0,y,0,0]);},drawImage(image,...rect){draws.push({matrix:[...matrix],rect});}};
      const ctx=new Proxy(target,{get:(object,key)=>key in object?object[key]:()=>{}});
      const result=paint(ctx,world,current,'turned',{[atlases.turned.key]:{complete:true,naturalWidth:512}},corpse.variant%2===0?-1:1,{});
      assert.equal(result.drewJointCorpse,true);assert.equal(draws.length,15);assert.equal(stack.length,0);
      const corpseBottom=Math.max(...draws.flatMap(draw=>{
        const index=atlases.turned.parts.findIndex(part=>Object.values(part.source).every((value,i)=>value===draw.rect[i]));
        assert.ok(index>=0);return data.outlines[index].hull.map(p=>point(draw.matrix,p)[1]);
      }));
      assert.ok(corpseBottom<=floor+1e-9,JSON.stringify({angle,progress,weapon,viewport:r.viewport,flipX:r.flipX,deathProgress,corpseBottom,floor}));
      if(!weapon) {
        const paintedPoint=(bone,pixel)=>{
          const part=atlases.turned.parts.find(p=>p.bone===bone);
          const draw=draws.find(d=>Object.values(part.source).every((value,i)=>value===d.rect[i]));
          assert.ok(draw);return point(draw.matrix,pixel);
        };
        const headHull=data.outlines.find(part=>part.bone==='head').hull.map(p=>paintedPoint('head',p)[1]);
        const top=Math.min(...draws.flatMap(draw=>{
          const index=atlases.turned.parts.findIndex(part=>Object.values(part.source).every((value,i)=>value===draw.rect[i]));
          return data.outlines[index].hull.map(p=>point(draw.matrix,p)[1]);
        }));
        const body={headCenter:(Math.min(...headHull)+Math.max(...headHull))/2,
          neck:paintedPoint('spine',data.neck)[1],waist:paintedPoint('spine',data.waist)[1],top};
        entryBody??=body;
        if(deathProgress===1)for(const key of Object.keys(body))assert.ok(body[key]>=entryBody[key]-1e-9,
          JSON.stringify({key,angle,progress,viewport:r.viewport,flipX:r.flipX,deathProgress,body,entryBody}));
      }
      if(weapon){
        const sample=result.jointCorpse;
        assert.equal(sample.state.severPlan.style,v102GoreWeaponStyle(weapon));assert.ok(sample.fragment);
        if(['blast','crush'].includes(sample.state.severPlan.style)) {
          const arm=atlases.turned.armConstraints.find(c=>c.lowerBone==='arm-0-lower');assert.ok(arm);
          const paintedPoint=bone=>{
            const part=atlases.turned.parts.find(p=>p.bone===bone);
            const draw=draws.find(d=>Object.values(part.source).every((value,i)=>value===d.rect[i]));
            assert.ok(draw);return point(draw.matrix,arm.elbow);
          };
          assert.equal(sample.bodyWounds.length,1);assert.equal(sample.fragment.wounds.length,1);
          for(const [actual,expected]of [[sample.bodyWounds[0],paintedPoint(arm.upperBone)],
            [sample.fragment.wounds[0],paintedPoint(arm.lowerBone)]])
            assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<1e-9);
        }
      }
      else assert.equal(result.jointCorpse.fragment,null);
      if(deathProgress===0) {
        const bySource=new Map(living.map(d=>[d.rect.slice(0,4).join(','),d]));
        for(const draw of draws){const previous=bySource.get(draw.rect.slice(0,4).join(','));assert.ok(previous);
          for(let i=0;i<6;i++)assert.ok(Math.abs(draw.matrix[i]-previous.matrix[i])<1e-9);}
      }
      samples++;
    }
  }
  assert.equal(samples,2880);assert.equal(JSON.stringify(atlases.turned),stableAtlas);
});

test('ordinary turned deaths and an invalidated or completed rise cannot borrow a stale birth corpse pose',()=>{
  const {world,actor}=fixture(),r=contexts()[0],plan=v177TurnedGetupPose(world,actor);
  const rendered={frame:r.frame,width:r.width,height:r.height,x:r.x,y:r.y,angle:0,scaleX:1,scaleY:1,flipX:r.flipX};
  const corpse={id:actor.id,kind:'turned',side:'zombie',x:actor.x,y:actor.y,state:'dying'};
  const ordinary=v177JointPose('turned',{requestedState:'idle'},actor.animationPresentation);
  for(const next of [null,ordinary]) {
    rememberV177CorpseJointPose(world,actor.id,'turned',plan,rendered);
    rememberV177CorpseJointPose(world,actor.id,'turned',next,rendered);
    assert.equal(v177CorpseJointPresentation(world,corpse,'turned',{progress:0,fallDirection:-1}),null);
  }
  const otherWorld={...world};rememberV177CorpseJointPose(otherWorld,actor.id,'turned',ordinary,rendered);
  assert.equal(v177CorpseJointPresentation(otherWorld,corpse,'turned',{progress:0,fallDirection:-1}),null);
});

test('released death limbs retain their original bone lengths and attachments through the full fold without fixed-end IK',()=>{
  const atlas=atlases.turned;
  for(const angle of [-1.57,1.57])for(const phase of [0,.2,.6,.9]) {
    const {world,actor}=fixture({angle});actor.spawnGrace=.75*(1-phase);
    const captured=v177CaptureJointPose('turned',v177TurnedGetupPose(world,actor));
    const initialPose=Object.fromEntries(atlas.parts.map(part=>[part.bone,captured[part.upper?'upper':'lower'][part.bone]]));
    const fallenPose=createV177TurnedRiseCorpseRig(captured).finalPose;
    const before=JSON.stringify({initialPose,fallenPose}),sample=createTurnedGetupDeathSampler({initialPose,fallenPose,
      waist:data.waist,neck:data.neck,armConstraints:atlas.armConstraints,legConstraints:atlas.legConstraints});
    assert.deepEqual(sample(0),initialPose);assert.deepEqual(sample(1),fallenPose);
    for(let i=1;i<100;i++) {
      const pose=sample(i/100);
      for(const c of [...atlas.armConstraints,...atlas.legConstraints]) {
        const A=c.shoulder??c.hip,B=c.elbow??c.knee,C=c.wrist??c.ankle;
        for(const [a,b]of [[point(pose[c.parentBone],A),point(pose[c.upperBone],A)],
          [point(pose[c.upperBone],B),point(pose[c.lowerBone],B)],[point(pose[c.lowerBone],C),point(pose[c.effectorBone],C)]])
          assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-9);
      }
      for(const m of Object.values(pose))assert.ok(Math.abs(Math.hypot(m[0],m[1])-1)<1e-12&&Math.abs(Math.hypot(m[2],m[3])-1)<1e-12);
    }
    const changed=sample(.5);changed.spine[4]+=100;assert.notDeepEqual(sample(.5),changed);
    assert.equal(JSON.stringify({initialPose,fallenPose}),before);
  }
});

test('an actually painted post-rise held hit or stun retains the same corpse source until a normal pose takes ownership',()=>{
  for(const state of ['hit-light','incapacitated']) {
    const {world,actor}=fixture(),r=contexts()[0],rise=v177TurnedGetupPose(world,actor);
    const rendered={frame:r.frame,width:r.width,height:r.height,x:r.x,y:r.y,angle:0,scaleX:1,scaleY:1,flipX:r.flipX};
    trace('turned',rise,r,actor,world);rememberV177CorpseJointPose(world,actor.id,'turned',rise,rendered);
    actor.spawnGrace=0;const held=v177JointPose('turned',{requestedState:state},actor.animationPresentation,{actor,world,stunRemaining:.42});
    trace('turned',held,r,actor,world);rememberV177CorpseJointPose(world,actor.id,'turned',held,rendered);
    const corpse={id:actor.id,kind:'turned',side:'zombie',x:actor.x,y:actor.y,state:'dying'};
    assert.ok(v177CorpseJointPresentation(world,corpse,'turned',{progress:0,fallDirection:-1}));
  }
});
