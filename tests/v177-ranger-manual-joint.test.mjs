import assert from 'node:assert/strict';
import test from 'node:test';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177RenderedWeightedLowerReceipt} from '../app/v177JointPresentation.js';
import {MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,beginManualAbility,advanceManualAbility} from '../app/manualAbilities.js';

// Unit Canvas port exercises actual draw/history code. Its RGBA is a mock;
// this suite does not claim original pixels, browser timing or native playback.
const atlas=V177_JOINT_ATLASES.ranger,definition=MANUAL_ABILITY_REGISTRY.ranger;
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function surface(){const canvas={width:0,height:0};const ctx={clearRect(){},drawImage(){},getImageData:(_x,_y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}};canvas.getContext=()=>ctx;return canvas;}
const image={naturalWidth:atlas.decodedWidth,naturalHeight:atlas.decodedHeight,ownerDocument:{createElement:surface}};
function canvas(){let m=[1,0,0,1,422,318];const stack=[],calls=[];return {calls,ctx:{canvas:{width:844,height:340},getTransform:()=>Object.fromEntries(['a','b','c','d','e','f'].map((k,i)=>[k,m[i]])),save(){stack.push([...m]);},restore(){m=stack.pop();},setTransform(...v){m=v;},transform(...v){m=multiply(m,v);},translate(x,y){m=multiply(m,[1,0,0,1,x,y]);},scale(x,y){m=multiply(m,[x,0,0,y,0,0]);},drawImage(_i,...rect){calls.push({matrix:[...m],rect});}}};}
function paint(f,q,img=image,c=canvas()){assert.equal(drawV177JointPose(c.ctx,img,'ranger',q,-48,-86,96,89.6,{actor:f.actor,world:f.world}),true);return {calls:c.calls,receipt:v177RenderedWeightedLowerReceipt(f.actor,f.world)};}
function fixture({draw=true,state='move',progress=0}={}){const runtime={state,locomotionPhase:.371,locomotionSettle:.4},actor={id:9,kind:'ranger',side:'human',hp:107,stationAbility:{phase:'idle'},animationPresentation:runtime,manualAbility:createManualAbilityRuntime('ranger')},world={time:20,fighters:[actor]},f={actor,runtime,world},normal=v177JointPose('ranger',{requestedState:state,clipProgress:progress},runtime,{actor,world});f.normal=normal;if(draw)f.paint=paint(f,normal);actor.manualAbility=beginManualAbility(actor.manualAbility,{direction:1,targetId:321,x:500,y:160}).runtime;f.start=actor.manualAbility;return f;}
const plan=f=>v177JointPose('ranger',{requestedState:'special'},f.runtime,{actor:f.actor,world:f.world,ownedPose:true,rangerManualOwner:true,rangerManualDefinition:definition});
const at=(f,seconds)=>{const advanced=advanceManualAbility(f.start,seconds);f.actor.manualAbility=advanced.runtime;return advanced;};

test('real manual activation starts from last actually drawn walking/ordinary attack',()=>{
 for(const[state,progress]of[['move',0],['active',.37],['recovery',.61]]){const f=fixture({state,progress}),before=JSON.stringify(f.actor),q=plan(f);assert(q);const drawn=paint(f,q);assert.deepEqual(drawn.calls,f.paint.calls);assert.equal(drawn.receipt.mode,'continuous-weighted-mesh');assert.equal(drawn.receipt.meshVertices,130);assert.equal(drawn.receipt.meshTriangles,192);assert.equal(JSON.stringify(f.actor),before);}
});
test('original .5 impact/.18 recovery own recoil clock and return to ordinary pose',()=>{
 const f=fixture();paint(f,plan(f));for(const seconds of[0,.2,.499999]){assert.equal(at(f,seconds).events.length,0);assert.equal(plan(f).rangerManualJoint.presentationPhase,'aim');}
 const impact=at(f,.5);assert(impact.events.some(e=>e.type==='impact'));assert.equal(plan(f).rangerManualJoint.presentationPhase,'recoil');at(f,.57);assert.equal(plan(f).rangerManualJoint.presentationPhase,'return');at(f,.6799999999);const end=paint(f,plan(f));at(f,.68);assert.equal(f.actor.manualAbility.phase,'cooldown');const normal=paint(f,v177JointPose('ranger',{requestedState:'idle'},f.runtime,{actor:f.actor,world:f.world}));for(let i=1;i<8;i++)for(let j=0;j<6;j++)assert(Math.abs(end.calls[i].matrix[j]-normal.calls[i].matrix[j])<1e-7);
});
test('missing actual history, foreign world and other owners cannot enter manual joints',()=>{
 assert.equal(plan(fixture({draw:false})),null);
 for(const mutate of[f=>f.world={time:20,fighters:[f.actor]},f=>f.actor.side='zombie',f=>f.actor.stationAbility.phase='active',f=>f.actor.hp=0]){const f=fixture();mutate(f);assert.equal(plan(f),null);}
 const f=fixture();assert.equal(v177JointPose('ranger',{requestedState:'special'},f.runtime,{actor:f.actor,world:f.world,ownedPose:true,rangerManualOwner:false,rangerManualDefinition:definition}),null);
 for(const kind of ['mrs-chiha','engineer','guardian'])assert.equal(v177JointPose(kind,{requestedState:'special'},f.runtime,{actor:{...f.actor,kind},world:f.world,ownedPose:true,rangerManualOwner:true,rangerManualDefinition:definition}),null);
});
test('actual failed image and actual lower fallback cannot manufacture an entry',()=>{
 const f=fixture(),q=plan(f),c=canvas();c.ctx.scale(0,1);const draw=paint(f,q,image,c);assert.equal(draw.receipt.mode,'legacy-cell-fallback');assert.equal(plan(f),null);
 const g=fixture(),p=plan(g);assert.equal(drawV177JointPose(canvas().ctx,{naturalWidth:0},'ranger',p,-48,-86,96,89.6,{actor:g.actor,world:g.world}),false);assert.equal(plan(g),null);
});
test('unpainted plans never publish start time; painted entry survives sampling without mutation',()=>{
 const f=fixture();plan(f);at(f,.2);assert.equal(plan(f).rangerManualJoint.entry.elapsed,.2);const q=plan(f);paint(f,q);const before=JSON.stringify(q.rangerManualJoint.entry);at(f,.3);const next=plan(f);assert.equal(next.rangerManualJoint.entry.elapsed,.2);assert.equal(JSON.stringify(q.rangerManualJoint.entry),before);assert.equal(plan(f).rangerManualJoint.entry.elapsed,.2);
});
test('ordinary states stay available and hit/living-stun inherit the actual manual endpoint',()=>{
 const f=fixture();paint(f,plan(f));at(f,.679);const last=plan(f);paint(f,last);at(f,.68);const hit=v177JointPose('ranger',{requestedState:'hit-light'},f.runtime,{actor:f.actor,world:f.world});assert.equal(hit.reactionHeld,true);assert.deepEqual(hit.rangerManualUpperPose,last.rangerManualUpperPose);paint(f,hit);const stun=v177JointPose('ranger',{requestedState:'incapacitated'},f.runtime,{actor:f.actor,world:f.world,stunRemaining:.42});assert(stun.liveStun);assert.deepEqual(stun.rangerStunUpperPose,last.rangerManualUpperPose);
 for(const requestedState of ['idle','move','wind-up','active','recovery','reload'])assert(v177JointPose('ranger',{requestedState,clipProgress:.3},f.runtime));
});