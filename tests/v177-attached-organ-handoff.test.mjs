import test from 'node:test';
import assert from 'node:assert/strict';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from '../app/v177JointPresentation.js';

const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function painted(kind,sample,runtime){
 const atlas=V177_JOINT_ATLASES[kind],raw=[];
 const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},transform(...m){raw.push(m);},drawImage(){}};
 assert.ok(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,v177JointPose(kind,sample,runtime),0,0,480,448));
 return Object.fromEntries(atlas.parts.map((part,i)=>[part.bone,raw[i]]));
}

test('Every attached head and organ crosses settled idle, attack entry and recovery without a visible jump',()=>{
 let checked=0;
 for(const [kind,atlas]of Object.entries(V177_JOINT_ATLASES))if(atlas.parentAttachments){
  for(let p=0;p<16;p++){
   const runtime={locomotionPhase:(p+.1371)/16,locomotionSettle:1},idle=painted(kind,{requestedState:'idle'},runtime);
   for(const [requestedState,clipProgress]of [['wind-up',0],['recovery',1]]){
    const raw=painted(kind,{requestedState,clipProgress},runtime);
    for(const bone of Object.keys(atlas.parentAttachments))for(const part of atlas.parts.filter(part=>part.bone===bone)){
     const {x,y,w,h}=part.destination;
     for(const point of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]])assert.ok(distance(transform(raw[bone],point),transform(idle[bone],point))<.001,kind+' '+bone+' handoff stays continuous');
     checked++;
    }
   }
  }
 }
 assert.ok(checked>=32);
});

test('Kurome retains walking fin sway while that sway settles to rest',()=>{
 const kind='kurome',point=[184,201],initial=painted(kind,{requestedState:'move'},{locomotionPhase:0,locomotionSettle:0});
 let moving=0,settled=0;
 for(let p=0;p<32;p++){
  const phase=p/32,walk=painted(kind,{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:0}),rest=painted(kind,{requestedState:'idle'},{locomotionPhase:phase,locomotionSettle:1});
  const local=m=>Math.atan2(m['back-fin'][1],m['back-fin'][0])-Math.atan2(m.spine[1],m.spine[0]);
  moving=Math.max(moving,Math.abs(local(walk)-local(initial)));settled=Math.max(settled,Math.abs(local(rest)));
  assert.ok(distance(transform(rest['back-fin'],[219,155]),transform(rest.spine,[219,155]))<.001);
  assert.ok(transform(walk['back-fin'],point).every(Number.isFinite));
 }
 assert.ok(moving>.014,'Walking keeps the authored fin motion');assert.ok(settled<.000001,'Walking sway stops with locomotion');
});
