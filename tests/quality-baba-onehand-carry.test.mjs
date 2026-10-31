import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
import {v177WeaponChoreography} from '../app/v177WeaponChoreography.js';
const atlas=V177_JOINT_ATLASES.babayaga;
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function sample(state,progress=0,phase=.25,settle=1){
 const base=v177JointPose('babayaga',{requestedState:state,clipProgress:progress},{moving:state==='move',locomotionPhase:phase,locomotionSettle:settle});
 const plan=v177WeaponChoreography('babayaga',atlas,{...base,paintLocomotion:{phase,settle}});
 return{plan,pose:v177CaptureJointPose('babayaga',plan).upper};
}
test('Baba lowers his pistol during travel and wait, raises for the shot, and lowers continuously afterwards',()=>{
 for(const state of ['move','idle']){const{pose}=sample(state);assert.ok(Math.atan2(pose['weapon-0'][1],pose['weapon-0'][0])>1.2,'muzzle points down while not firing');}
 for(let n=0;n<=40;n++){const{pose}=sample('active',n/40);assert.ok(Math.abs(Math.atan2(pose['weapon-0'][1],pose['weapon-0'][0]))<1e-8,'active shot remains aimed');}
 for(const[a,ap,b,bp]of [['wind-up',1,'active',0],['active',1,'recovery',0],['recovery',1,'idle',0]]){
  const x=sample(a,ap).pose,y=sample(b,bp).pose;
  for(const bone of ['weapon-0','arm-0-upper','arm-0-lower','arm-1-upper','arm-1-lower'])for(let i=0;i<6;i++)assert.ok(Math.abs(x[bone][i]-y[bone][i])<.002,bone+' handoff');
 }
});
test('the independent left wrist swings while walking and both rigid arms keep shoulder/elbow/wrist joins',()=>{
 const a=sample('move',0,.25,0),b=sample('move',0,.75,0),free=atlas.armConstraints[1];
 assert.ok(dist(point(a.pose[free.lowerBone],free.wrist),point(b.pose[free.lowerBone],free.wrist))>15,'left hand visibly counter-swings rather than staying glued to pistol');
 for(const state of ['move','idle','wind-up','active','recovery'])for(let n=0;n<=60;n++){
  const{plan,pose}=sample(state,n/60,n/60,state==='move'?0:1);
  for(const c of plan.choreography.arms){
   const shoulder=point(pose[c.parentBone],c.shoulder),elbow=point(pose[c.upperBone],c.elbow),wrist=point(pose[c.lowerBone],c.wrist);
   assert.ok(dist(point(pose[c.upperBone],c.shoulder),shoulder)<.001);
   assert.ok(dist(elbow,point(pose[c.lowerBone],c.elbow))<.001);
   assert.ok(Math.abs(dist(shoulder,elbow)-dist(c.shoulder,c.elbow))<.001);
   assert.ok(Math.abs(dist(elbow,wrist)-dist(c.elbow,c.wrist))<.001);
   if(c.effectorBone==='arm-1-hand')assert.ok(elbow[0]<wrist[0]+2,'free elbow never folds ahead of hand');
  }
 }
});

test('the shipped free forearm contains an exposed hand below the sleeve, connected at its wrist',async()=>{
 const p=atlas.parts.find(p=>p.name==='far-forearm'),s=p.source,d=p.destination;
 const raw=await sharp('public'+atlas.path).extract({left:s.x,top:s.y,width:s.w,height:s.h}).ensureAlpha().raw().toBuffer();
 let hand=0,wrist=0;for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){const i=(y*s.w+x)*4,lx=d.x+(x+.5)*d.w/s.w,ly=d.y+(y+.5)*d.h/s.h;if(raw[i+3]<32)continue;if(ly>228&&raw[i]-raw[i+1]>10&&raw[i]-raw[i+2]>15)hand++;if(Math.abs(lx-278)<3&&Math.abs(ly-221)<3)wrist++;}
 assert.ok(hand>=10,'A sleeve fragment is not an exposed free hand');assert.ok(wrist>=3,'No detached wrist at the cuff');
});
