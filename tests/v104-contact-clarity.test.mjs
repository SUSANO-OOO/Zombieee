import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {drawV104EyeBeam,drawV104BiteContact,v104MeleeImpactPoint} from '../app/v104CombatVfx.js';
import {V177_JOINT_ATLASES as atlases,v177JointPose,v177CaptureJointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {queueV100ClawContact,getV100ClawContactSnapshot,queueV100Contact,drawV100ContactQueue} from '../app/v100CombatVfx.js';

const source=readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const point=(matrix,p)=>[matrix[0]*p[0]+matrix[2]*p[1]+matrix[4],matrix[1]*p[0]+matrix[3]*p[1]+matrix[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('Mayo contact dust starts with its damage shot and fades without waiting for projectile travel',()=>{
 const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='drawAuthoredShotVfx');assert.ok(fn);
 const draw=vm.runInNewContext(ts.transpileModule(fn.getText(tree)+'\ndrawAuthoredShotVfx;',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{drawV104BiteContact,V100_CONTACT_WEAPONS:[]});
 const image={complete:true,naturalWidth:512,naturalHeight:512};
 for(const direction of [-1,1]){
  const strengths=[];
  for(const elapsed of [0,1/60,.16,.26]){
   const points=[],ctx={save(){},restore(){},translate:(x,y)=>points.push([x,y]),rotate(){},drawImage(asset){assert.equal(asset,image);strengths.push(this.globalAlpha);}};
   const shot={x:400,y:280,tx:400+direction*35,ty:270,sourceId:3,targetId:7,life:.26-elapsed,style:'melee'};
   const before=structuredClone(shot);
   assert.equal(draw(ctx,shot,{elapsed,duration:.26,impactProgress:-1,weapon:'mayo-chan',weaponProfile:{trail:'bite-lunge'},v100StageObjects:{'v100-dust':image}}),true);
   assert.deepEqual(points,[[shot.tx,shot.ty]]);assert.deepEqual(shot,before);
  }
  assert.ok(strengths[0]>.7&&strengths[0]>strengths[1]&&strengths[1]>strengths[2]);assert.equal(strengths[3],0);
 }
});

test('the real impact resolver binds the current strike and pins the burst to its painted contact point',()=>{
 const arrows=[];const visit=n=>{if(ts.isArrowFunction(n)&&n.parameters[0]?.name.getText(tree)==='contact'&&n.body.getText(tree).includes('v104MeleeImpactPoint'))arrows.push(n);ts.forEachChild(n,visit);};visit(tree);assert.equal(arrows.length,1);
 const owner={id:7,kind:'brute',attackSequence:3},target={id:8,x:430,y:300},g={time:1,definition:{missionConfig:{v100StageNumber:1}},fighters:[owner,target]},fighterJointWeapons=new Map();
 fighterJointWeapons.set(owner,[{kind:'brute',striking:true,tip:{x:426,y:242},grip:{x:405,y:251}}]);
 const resolve=vm.runInNewContext(ts.transpileModule('const resolve='+arrows[0].getText(tree)+';resolve;',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{g,fighterJointWeapons,v104MeleeImpactPoint});
 const contact={ownerId:7,targetId:8,kind:'brute',attackSequence:3,resolvedSocket:false};
 assert.equal(resolve({...contact,attackSequence:2}),null);assert.equal(resolve({...contact,kind:'kumaverson'}),null);
 assert.deepEqual(resolve(contact),{x:426,y:242});
 const points=[],ctx={save(){},restore(){},translate:(x,y)=>points.push([x,y]),scale(){},drawImage(){}},objects={'v100-contact':{complete:true,naturalWidth:1536}};
 queueV100Contact(g,{x:430,y:272,meleeContact:contact});
 drawV100ContactQueue(ctx,objects,g,null,null,null,()=>null);assert.equal(points.length,0,'an unresolved owner cannot paint at the old abdomen fallback');
 drawV100ContactQueue(ctx,objects,g,null,null,null,()=>({x:NaN,y:1}));assert.equal(points.length,0,'invalid painted geometry cannot authorize a burst');
 drawV100ContactQueue(ctx,objects,g,null,null,null,resolve);assert.deepEqual(points,[[426,242]]);
 fighterJointWeapons.get(owner)[0].tip={x:470,y:280};g.time+=.05;
 drawV100ContactQueue(ctx,objects,g,null,null,null,resolve);assert.deepEqual(points.at(-1),[426,242],'an existing burst stays at the impact rather than chasing the weapon');
 g.time+=.2;drawV100ContactQueue(ctx,objects,g,null,null,null,resolve);assert.equal(points.length,2);
});

test('the actual impact resolver follows the striking fist on both alternating Paisen attacks',()=>{
 let arrow;const visit=n=>{if(ts.isArrowFunction(n)&&n.parameters[0]?.name.getText(tree)==='contact'&&n.body.getText(tree).includes('v104MeleeImpactPoint'))arrow=n;ts.forEachChild(n,visit);};visit(tree);
 for(const attackSequence of [1,2]){
  const kind='brawler',atlas=atlases[kind],owner={id:7,kind,hp:100,attackSequence},target={id:8,x:450,y:300},g={fighters:[owner,target]},fighterJointWeapons=new Map();
  const plan=v177JointPose(kind,{requestedState:'active',clipProgress:0},{locomotionPhase:.2,locomotionSettle:1},{actor:owner,grounded:true});
  assert.equal(plan.choreography.strikeBones.length,1);
  const options={kind,plan,direction:'right',frame:{anchorX:.5,anchorY:1,flipX:false},size:{w:atlas.width,h:atlas.height},pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:400,y:500};
  const strokes=atlas.armConstraints.map(arm=>({kind,channel:arm.effectorBone,striking:plan.choreography.strikeBones.includes(arm.effectorBone),
   tip:v177RenderedJointWeaponSocket({...options,sourceBone:arm.effectorBone,sourcePoint:arm.grip}),
   grip:v177RenderedJointWeaponSocket({...options,sourceBone:arm.effectorBone,sourcePoint:arm.effectorWrist??arm.wrist})}));
  fighterJointWeapons.set(owner,strokes);
  const resolve=vm.runInNewContext(ts.transpileModule('const resolve='+arrow.getText(tree)+';resolve;',{
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{g,fighterJointWeapons,v104MeleeImpactPoint});
  const expected=strokes.find(s=>s.striking).tip,other=strokes.find(s=>!s.striking).tip;
  assert.ok(distance([expected.x,expected.y],[other.x,other.y])>25);
  assert.deepEqual(resolve({ownerId:7,targetId:8,kind,attackSequence}),expected);
 }
});

test('pan and hammer contacts use their striking surface; long blades intersect the victim along the actual edge',()=>{
 const tip={x:500,y:220},grip={x:400,y:260},target={x:440,y:300};
 for(const kind of ['brute','kumaverson'])assert.deepEqual(v104MeleeImpactPoint({kind,tip,grip,target}),tip);
 for(const kind of ['tky','miyamoto-musashi','takuya-omega']){
  assert.deepEqual(v104MeleeImpactPoint({kind,tip,grip,target}),{x:440,y:244});
  assert.deepEqual(v104MeleeImpactPoint({kind,tip:{x:300,y:220},grip,target:{x:360}}),{x:360,y:244});
 }
 assert.equal(v104MeleeImpactPoint({kind:'brute',tip:{x:NaN,y:0}}),null);
});

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
