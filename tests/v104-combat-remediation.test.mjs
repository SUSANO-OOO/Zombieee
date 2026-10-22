import test from'node:test';import assert from'node:assert/strict';
import{V177_JOINT_ATLASES as A,v177JointPose,v177CaptureJointPose}from'../app/v177JointPresentation.js';
import{v177RangerFootPlacement}from'../app/v177RangerFootPlacement.js';
import{v177RangerLowerPose}from'../app/v177RangerLowerMotion.js';
import{v177ChoreographedAbilitySample}from'../app/v177WeaponChoreography.js';
import{combatFacingFromMotion}from'../app/enemyFacingContract.js';
import{BOSS_ANOMALY_TUNING}from'../app/bossAnomalies.js';import{KUROME_PROTOTYPE_TUNING}from'../app/kuromeBoss.js';
import{battleVoiceReady,queueV104HumanHurt}from'../app/v104CombatAudio.js';import{V100_AUDIO_MANIFEST}from'../app/productionAudio.js';
import{queueV100GuardContact}from'../app/v100CombatVfx.js';
import{readFileSync}from'node:fs';import ts from'typescript';import vm from'node:vm';
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('forced hit travel retains attention on both sides after flash while real attack/manual locks retain priority',()=>{
 for(const previousDirection of['left','right'])for(const actualXDelta of[-12,12])for(const side of['human','zombie']){
  const input={side,previousDirection,actualXDelta,recoiling:true};assert.equal(combatFacingFromMotion(input),previousDirection);
  assert.equal(combatFacingFromMotion({...input,attacking:true,targetDirection:-1}),'left');
  assert.equal(combatFacingFromMotion({...input,manualAbilityActive:true,manualDirection:1}),side==='human'?'right':previousDirection);
  assert.equal(combatFacingFromMotion({...input,recoiling:false}),actualXDelta<0?'left':'right');
 }
});
test('Ranger keeps one real ground support at original, previous-fast and new-fast travel speeds with fixed source bones',()=>{
 const rig=A.ranger.lowerRig,cycle=rig.spanPx/rig.stanceFraction;
 for(const facing of[-1,1])for(const speed of[20,29,63.8,72.5])for(const scale of[.18,.2]){
  let state,root=330,phase=0;
  for(let n=0;n<600;n++){
   const dx=facing*speed/60;root+=dx;phase+=speed/60/(scale*cycle);
   const r=v177RangerFootPlacement(rig,state,{time:n/60,root,phase,scale,settle:0,moving:true,facing});
   const previous=state;state=r.state;
   assert.ok(state.feet.some(f=>f.height<1e-8),JSON.stringify({facing,speed,scale,n}));
   const pose=v177RangerLowerPose(rig,r.phase,0,undefined,r.targets);
   for(let i=0;i<2;i++){
    const j=pose.joints[i],l=rig.legs[i];
    assert.ok(Math.abs(Math.hypot(j[2]-j[0],j[3]-j[1])-l.upperLength)<1e-8);
    assert.ok(Math.abs(Math.hypot(j[4]-j[2],j[5]-j[3])-l.lowerLength)<1e-8);
    if(previous?.feet[i].mode==='plant'&&state.feet[i].mode==='plant')assert.ok(Math.abs(previous.feet[i].x-state.feet[i].x)<1e-8);
   }
  }
 }
});
test('slash variants stay fixed across impact and all original hands remain attached throughout every weapon sweep',()=>{
 for(const kind of['tky','miyamoto-musashi','crazy-king','kumaverson','takuya','takuya-omega','babayaga'])for(let sequence=0;sequence<3;sequence++){
  const runtime={locomotionPhase:.2,locomotionSettle:1},atlas=A[kind];
  const before=v177JointPose(kind,{requestedState:'wind-up',clipProgress:1},runtime,{actor:{attackSequence:sequence,attackWindup:.001}});
  const after=v177JointPose(kind,{requestedState:'active',clipProgress:0},runtime,{actor:{attackSequence:sequence+1,attackWindup:0}});
  assert.equal(before.choreography.variant,after.choreography.variant);assert.deepEqual(before.choreography.upper,after.choreography.upper);
  for(let n=0;n<=120;n++){
   const state=n<=33?'wind-up':n<=84?'active':'recovery',clipProgress=state==='wind-up'?n/33:state==='active'?(n-33)/51:(n-84)/36;
   const p=v177JointPose(kind,{requestedState:state,clipProgress},runtime,{grounded:true,actor:{attackSequence:sequence+1,attackWindup:state==='wind-up'?1:0}}),c=v177CaptureJointPose(kind,p);
   for(const arm of atlas.armConstraints){
    const parent=c.upper[arm.parentBone],upper=c.upper[arm.upperBone],lower=c.upper[arm.lowerBone],hand=c.upper[arm.effectorBone];
    for(const[a,b]of[[point(parent,arm.shoulder),point(upper,arm.shoulder)],[point(upper,arm.elbow),point(lower,arm.elbow)],[point(lower,arm.wrist),point(hand,arm.effectorWrist??arm.wrist)]])assert.ok(distance(a,b)<.002,kind+' detached hand/arm');
   }
  }
 }
 const angles=kind=>[0,1,2].map(sequence=>{const p=v177JointPose(kind,{requestedState:'active',clipProgress:.3},{locomotionPhase:0,locomotionSettle:1},{actor:{attackSequence:sequence+1}});return Math.atan2(p.choreography.upper[A[kind].weaponBone][1],p.choreography.upper[A[kind].weaponBone][0]);});
 for(const kind of['tky','miyamoto-musashi'])assert.ok(Math.abs(angles(kind)[0]-angles(kind)[1])>1,'Successive attacks must visibly cut in different directions');
});
test('boss ability poses cover each actual warning, active and recovery clock without generic clip clamping',()=>{
 for(const kind of['kurome','takuya-omega','mother','gairen']){
  const kurome=KUROME_PROTOTYPE_TUNING,anomaly=BOSS_ANOMALY_TUNING[kind],tuning=anomaly??kurome;
  for(const[phase,key,state]of(kind==='kurome'?[['tracking','warningSeconds','wind-up'],['firing','fireSeconds','active'],['recovery','recoverySeconds','recovery']]:[['warning','warningSeconds','wind-up'],['active','activeSeconds','active'],['recovery','recoverySeconds','recovery']]))
   for(const progress of[0,.1,.5,.9,1]){
    const sample=v177ChoreographedAbilitySample(kind,{phase,remainingSeconds:tuning[key]*(1-progress)},{},{anomaly,kurome});
    assert.equal(sample.requestedState,state);assert.ok(Math.abs(sample.clipProgress-progress)<1e-12);
    assert.ok(v177JointPose(kind,sample,{locomotionPhase:0,locomotionSettle:1},{grounded:true}));
   }
 }
});

test('Omega large blade clears the painted floor without lifting the body or shortening either arm bone',()=>{
 const atlas=A['takuya-omega'],runtime={locomotionPhase:.1371,locomotionSettle:1};
 for(const state of['idle','wind-up','active','recovery'])for(let n=0;n<=600;n++){
  const plan=v177JointPose('takuya-omega',{requestedState:state,clipProgress:n/600},runtime,{grounded:true}),captured=v177CaptureJointPose('takuya-omega',plan),m=captured.upper[atlas.weaponBone];
  const bottom=Math.max(...atlas.weaponHull.map(p=>point(m,p)[1]));
  assert.ok(bottom<=atlas.weaponFloorY+1e-7,JSON.stringify({state,n,bottom}));
  for(const arm of atlas.armConstraints.filter(c=>c.effectorBone===atlas.weaponBone)){
   const shoulder=point(captured.upper[arm.parentBone],arm.shoulder),wrist=point(m,arm.effectorWrist??arm.wrist),a=distance(arm.shoulder,arm.elbow),b=distance(arm.elbow,arm.wrist),reach=distance(shoulder,wrist);
   assert.ok(reach>=Math.abs(a-b)+2-1e-7&&reach<=a+b-2+1e-7,JSON.stringify({state,n,reach}));
  }
 }
});
test('first battle calls are audible candidates, cooldowns are per actor, and armor never aliases a frying pan',()=>{
 const a={hp:100},b={hp:100};assert.equal(battleVoiceReady(a,'attack',0),true);assert.equal(battleVoiceReady(a,'attack',.5),false);assert.equal(battleVoiceReady(b,'attack',.5),true);assert.equal(battleVoiceReady(a,'attack',2.1),true);assert.equal(battleVoiceReady(a,'hurt',2.1),true);
 const assets=V100_AUDIO_MANIFEST.assets,armor=assets.find(a=>a.id==='v104-armor-hit'),pan=assets.find(a=>a.id==='weapon-pan-hit');
 assert.ok(armor.sources.every(s=>s.src.includes('/armor-hit.')));assert.ok(pan.sources.every(s=>s.src.includes('/pan-hit.')));
 for(const kind of['crazy-king','kumaverson','babayaga'])for(const event of['deploy','attack','hurt','death'])assert.ok(assets.find(a=>a.id===`voice-${kind}-${event}`).sources.every(s=>s.src.includes('/v104/')));
});

test('voice intervals survive real fighter copies; boss damage and interception queue only real surviving HP loss',()=>{
 const world={time:0,battleAudioGeneration:1,pendingBattleAudioCues:[]},actor={id:17,hp:90,kind:'guardian',x:420};
 assert.equal(queueV104HumanHurt(world,actor,100,'own-hurt'),true);
 world.time=.1;
 assert.equal(queueV104HumanHurt(world,{...actor,hp:80},90,'own-hurt'),false,'area-effect copies retain the same actor clock');
 assert.equal(queueV104HumanHurt(world,{...actor,id:18,hp:80},90,'other-hurt'),true,'other actors own separate intervals');
 assert.equal(queueV104HumanHurt(world,{...actor,id:19},90,'blocked-hurt'),false);
 assert.equal(queueV104HumanHurt(world,{...actor,id:20,hp:0},90,'dead-hurt'),false);
 assert.deepEqual(world.pendingBattleAudioCues.map(c=>c.cueId),['own-hurt','other-hurt']);
 assert.equal(battleVoiceReady(actor,'attack',0,world),true);
 assert.equal(battleVoiceReady({...actor},'attack',.1,world),false);
 assert.equal(battleVoiceReady({...actor},'attack',.1,{}),true,'new battle retires the old interval');
});

test('actual front guard contact emits the matching shield or pan sound once; miss/back/expired contact emits none',()=>{
 for(const kind of['guardian','kumaverson']){
  const world={time:1,battleAudioGeneration:1,definition:{missionConfig:{v100StageNumber:1}},pendingBattleAudioCues:[]};
  const owner={id:2,kind,side:'human',hp:100,x:400,manualAbility:{phase:'active',activationId:1,target:{direction:1}}};
  const hit={owner,attacker:{side:'zombie',x:430},incomingDamage:20,x:420,y:280};
  assert.equal(queueV100GuardContact(world,hit),true);assert.equal(queueV100GuardContact(world,hit),true);
  assert.equal(world.pendingBattleAudioCues.length,1);
  assert.equal(world.pendingBattleAudioCues[0].cueId,kind==='guardian'?'v104-armor-hit':'weapon-pan-hit');
  assert.equal(queueV100GuardContact(world,{...hit,incomingDamage:0}),false);
  assert.equal(queueV100GuardContact(world,{...hit,owner:{...owner,manualAbility:{phase:'cooldown'}}}),false);
  if(kind==='guardian')assert.equal(queueV100GuardContact(world,{...hit,attacker:{side:'zombie',x:370}}),false);
  assert.equal(world.pendingBattleAudioCues.length,1);
 }
});

test('actual render and runtime call sites release facing after knock decay ends, then follow reverse travel',()=>{
 const source=readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),expressions=[];
 function visit(n){if(ts.isPropertyAssignment(n)&&n.name.getText(tree)==='recoiling')expressions.push(n.initializer.getText(tree));ts.forEachChild(n,visit);}visit(tree);
 assert.equal(expressions.length,2);
 let knock=12;while(Math.abs(knock)>.1)knock*=.9;
 for(const expression of expressions){
  const actor={flash:0,stunned:0,knock},recoiling=vm.runInNewContext(expression,{f:actor,fighter:actor,Math});
  assert.equal(recoiling,false);assert.equal(combatFacingFromMotion({side:'human',recoiling,previousDirection:'right',actualXDelta:-1}),'left');
 }
});
