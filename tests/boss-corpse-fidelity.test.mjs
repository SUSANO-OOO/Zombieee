import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {V100_BOSSES} from '../app/v100Registry.js';
import {V177_CORPSE_JOINT_DATA} from '../app/v177CorpseJointData.js';
import {rememberV177BossCorpsePaint,pruneV177BossCorpsePaints,v177BossCorpsePresentation,drawV177BossCorpsePaint,V177_CONTINUOUS_BOSS_CORPSE_KINDS as kinds} from '../app/v177BossCorpsePresentation.js';
import {restorePreBossCorpseFidelitySource} from './helpers/guard-spectacle-source.mjs';

function fixture(kind='gate-eater',id=7){
 const probe={reads:0},image={name:kind,naturalWidth:1024,ownerDocument:{createElement(){
  const canvas={width:0,height:0};canvas.getContext=()=>({save(){},restore(){},translate(){},rotate(){},scale(){},transform(){},setTransform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},fill(){},drawImage(){},
   getImageData(_x,_y,w,h){probe.reads++;const data=new Uint8ClampedArray(w*h*4);for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++)data[(y*w+x)*4+3]=255;return{data};}});return canvas;
 }}};
 const actor={id,kind,side:'zombie',hp:620},corpse={id,kind,side:'zombie',x:620,y:282.5};
 const world={time:12.5,fighters:[actor],corpses:[]};
 const paint={image,plan:null,frame:{path:'/actual/'+kind+'.webp',sourceRect:{x:11,y:7,w:100,h:160},anchorX:.5,anchorY:1},
  width:100,height:160,pixelScale:1,root:{x:620.75,y:280.3,angle:.035,scaleX:1.02,scaleY:.99,flipX:true}};
 return {kind,id,actor,corpse,world,paint,probe};
}
const sample=(f,progress=0,extra={})=>v177BossCorpsePresentation(f.world,f.corpse,f.kind,{progress,fallDirection:-1,...extra});

test('the support list is exactly the registered boss forms without the existing three articulated corpse owners',()=>{
 const expected=V100_BOSSES.flatMap(b=>b.id==='boss-futago'?['futago-separated-a','futago-separated-b']:[b.id.slice(5)]).filter(k=>!V177_CORPSE_JOINT_DATA[k]);
 assert.deepEqual([...kinds].sort(),expected.sort());assert.equal(new Set(kinds).size,kinds.length);
});
test('each boss falls from its exact last image, size, facing and root instead of borrowing another creature',()=>{
 for(const kind of kinds){const f=fixture(kind),before=structuredClone(f.world);rememberV177BossCorpsePaint(f.world,f.actor,kind,f.paint);
  const first=sample(f);assert.ok(first);assert.equal(first.paint.image,f.paint.image);assert.equal(first.paint.kind,kind);assert.equal(first.paint.corpseSource,'last-painted');assert.equal(first.paint.paintedAt,12.5);
  assert.deepEqual(first.paint.frame,f.paint.frame);assert.deepEqual(first.root,f.paint.root);assert.equal(first.paint.width,100);assert.equal(first.paint.height,160);
  const calls=[],ctx={save(){calls.push('save');},restore(){calls.push('restore');},transform(...m){calls.push(m);},drawImage(...a){calls.push(a);}};
  assert.equal(drawV177BossCorpsePaint(ctx,first),true);assert.equal(calls[0],'save');assert.equal(calls.at(-1),'restore');assert.equal(calls[2][0],f.paint.image);
  assert.deepEqual(f.world,before,'Render caches never change gameplay or death clocks');
 }
});
test('capture is once per corpse and the source stays frozen through a continuous grounded fall and ash scaling',()=>{
 const f=fixture();rememberV177BossCorpsePaint(f.world,f.actor,f.kind,f.paint);const first=sample(f),originalRoot={...f.paint.root};
 f.paint.root.x=999;f.paint.frame.sourceRect.x=999;
 let previous=first;for(let i=1;i<=84;i++){
  const current=sample(f,i/84);assert.ok(Math.abs(current.root.angle-previous.root.angle)<.04);previous=current;
 }
 assert.equal(previous.root.angle,-Math.PI/2);assert.ok(Math.abs(previous.groundError)<1e-9);assert.equal(f.probe.reads,1);
 const ash=sample(f,1,{ashScaleX:.82,ashScaleY:.52});assert.equal(ash.paint.image,f.paint.image);assert.ok(Math.abs(ash.groundError)<1e-9);
 assert.equal(ash.paint.root.scaleX,originalRoot.scaleX*.82);assert.equal(ash.root.scaleY,originalRoot.scaleY*.52);assert.equal(ash.paint.frame.sourceRect.x,11);
 assert.equal(sample(f).paint.root.x,originalRoot.x);assert.equal(f.probe.reads,1);
});
test('a never-painted controlled corpse can use its own current rest rig without claiming last-frame continuity',()=>{
 const f=fixture('kurome');let calls=0;
 const r=sample(f,.2,{fallbackPaint(){calls++;return f.paint;}});assert.ok(r);assert.equal(r.paint.kind,'kurome');assert.equal(r.paint.image.name,'kurome');
 assert.equal(r.paint.corpseSource,'source-rest');assert.equal(r.paint.paintedAt,null);
 sample(f,.5,{fallbackPaint(){calls++;throw Error('must not recapture');}});assert.equal(calls,1);assert.equal(f.probe.reads,1);
});
test('world and actor ownership are isolated, missing paint clears stale images, and removal releases both caches',()=>{
 const f=fixture();rememberV177BossCorpsePaint(f.world,f.actor,f.kind,f.paint);
 assert.equal(v177BossCorpsePresentation({time:12.5,fighters:[],corpses:[]},f.corpse,f.kind,{progress:.2}),null);
 assert.equal(v177BossCorpsePresentation(f.world,{...f.corpse,id:999},f.kind,{progress:.2}),null);
 assert.equal(v177BossCorpsePresentation(f.world,f.corpse,'kurome',{progress:.2}),null);
 rememberV177BossCorpsePaint(f.world,f.actor,f.kind,null);assert.equal(sample(f),null);
 rememberV177BossCorpsePaint(f.world,f.actor,f.kind,f.paint);assert.ok(sample(f));
 f.world.fighters=[];f.world.corpses=[];pruneV177BossCorpsePaints(f.world);assert.equal(sample(f),null);
});
test('human, ordinary enemy and existing articulated boss bodies keep their own paths',()=>{
 const f=fixture();for(const kind of ['brawler','walker','takuya','mugarian-president-mutated','takuya-omega']){
  rememberV177BossCorpsePaint(f.world,f.actor,kind,f.paint);assert.equal(v177BossCorpsePresentation(f.world,f.corpse,kind,{fallbackPaint(){throw Error('must stay on original path');}}),null);
 }
 rememberV177BossCorpsePaint(f.world,{...f.actor,side:'human'},f.kind,f.paint);assert.equal(sample(f),null);
 rememberV177BossCorpsePaint(f.world,{...f.actor,hp:0},f.kind,f.paint);assert.equal(sample(f),null);
});
test('failed current-image capture remains a failure and does not manufacture a replacement body',()=>{
 const f=fixture();f.paint.pixelScale=100;rememberV177BossCorpsePaint(f.world,f.actor,f.kind,f.paint);
 assert.equal(sample(f),null);assert.equal(f.probe.reads,0);assert.equal(drawV177BossCorpsePaint({},null),false);
});
test('only the five declared App integrations differ from the accepted phone-framing source, including negative controls',()=>{
 const file='app/AshfallGame.tsx',source=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
 const before=execFileSync('git',['show','c9f7fbedd7f52c17263417b262373db1110ada58:'+file],{maxBuffer:4e6}).toString().replaceAll('\r\n','\n');
 assert.equal(restorePreBossCorpseFidelitySource(file,source),before);
 for(const bad of [source.replace('progress:jointFallProgress,fallDirection,ashScaleX:1-jointAshProgress*.18','progress:1,fallDirection,ashScaleX:1-jointAshProgress*.18'),
  source.replace('rememberV177BossCorpsePaint(options.world,f,renderKind','rememberV177BossCorpsePaint({},f,renderKind'),source+'\ng.corpses=[];\n']){
  assert.notEqual(bad,source);assert.throws(()=>assert.equal(restorePreBossCorpseFidelitySource(file,bad),before));
 }
});

test('all seven actual current articulated boss plans can be frozen and repainted without a legacy death cell',async()=>{
 const {V177_JOINT_ATLASES,v177JointPose}=await import('../app/v177JointPresentation.js');
 const {spriteFrameFor}=await import('../app/spriteManifest.js'),{v100HumanWalkFrame}=await import('../app/v100HumanWalk.js');
 for(const kind of kinds){
  const f=fixture(kind),atlas=V177_JOINT_ATLASES[kind];assert.ok(atlas);
  f.paint.frame=v100HumanWalkFrame(spriteFrameFor(kind,'walk-a','right'),'left');
  f.paint.width=f.paint.frame.sourceRect.w*.2;f.paint.height=f.paint.frame.sourceRect.h*.2;
  f.paint.plan=v177JointPose(kind,{requestedState:'active',clipProgress:.4},{locomotionPhase:.2,locomotionSettle:1},{grounded:true});assert.ok(f.paint.plan);
  rememberV177BossCorpsePaint(f.world,f.actor,kind,f.paint);const s=sample(f,.5);assert.ok(s,kind+' must retain the actual articulated source');
  assert.notEqual(s.paint.plan,f.paint.plan);assert.equal(s.paint.kind,kind);assert.equal(s.paint.image.name,kind);assert.equal(f.probe.reads,1);
 }
});
