import {v177JointActorKey} from './v177JointActorHistory.js';
const weaponHistory=new WeakMap();
const steelKinds=new Set(['brute','guardian','scout','zakimiya','tky','miyamoto-musashi','crazy-king','kumaverson','takuya','takuya-omega']);
const clawKinds=new Set(['crusher','abomination','gairen','futago','futago-separated-a','futago-separated-b','mugarian-president-mutated','ooguchi']);
export function v104WeaponWakeCandidate(kind,phase,held=false){
 return !held&&Number.isFinite(phase)&&phase>=.12&&phase<=.7&&(steelKinds.has(kind)||clawKinds.has(kind));
}
const ready=(objects,id)=>{const image=objects?.[id];if(!image?.complete||!image.naturalWidth)throw Error('Undecoded combat effect: '+id);return image;};
export function drawV104WeaponWake(ctx,objects,{actor,world,kind,time,tip,grip,phase,held=false}){
 const key=v177JointActorKey(actor,world),previous=weaponHistory.get(key);
 if(!tip||!grip||!Number.isFinite(time)||held||!(actor.hp>0)||(!steelKinds.has(kind)&&!clawKinds.has(kind))){weaponHistory.delete(key);return false;}
 if(previous?.time===time)return false;
 weaponHistory.set(key,{time,tip:{...tip},phase});
 if(!(phase>=.18&&phase<=.65)||!previous||!(time>previous.time&&time-previous.time<=.12))return false;
 const dx=tip.x-previous.tip.x,dy=tip.y-previous.tip.y,travel=Math.hypot(dx,dy),reach=Math.hypot(tip.x-grip.x,tip.y-grip.y);
 if(travel<.6||travel>180||reach<4)return false;
 const alpha=Math.min(.72,travel/10)*Math.min(1,(.7-phase)/.12),size=Math.max(24,Math.min(kind==='takuya-omega'?160:110,reach*1.65));
 ctx.save();ctx.shadowBlur=0;ctx.globalAlpha=alpha;
 if(kind==='tky'){
  const image=ready(objects,'v100-lightblade'),frame=Math.min(5,Math.floor((phase-.18)/.47*6));
  ctx.globalCompositeOperation='lighter';ctx.translate(tip.x,tip.y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/4);
  ctx.drawImage(image,frame%3*512,Math.floor(frame/3)*512,512,512,-size*.85,-size*.15,size,size);
 }else if(clawKinds.has(kind)){
  const image=ready(objects,'v100-claw-contact'),frame=Math.min(5,Math.floor((phase-.18)/.47*6));
  ctx.translate(tip.x,tip.y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/4);
  ctx.drawImage(image,frame%3*512,Math.floor(frame/3)*512,512,512,-size*.6,-size*.4,size,size);
 }else{
  ctx.translate(tip.x,tip.y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/4);
  ctx.drawImage(ready(objects,'v104-steel'),-size*.88,-size*.12,size,size);
 }
 ctx.restore();return true;
}
export function drawV104InfectedWake(ctx,objects,{x,y,ux,uy,trail='glob',warning=false,progress=0,impact=false}){
 if(![x,y,ux,uy,progress].every(Number.isFinite))return false;
 const mist=trail!=='glob',width=warning?18:mist?54:36,height=warning?9:mist?24:19;
 ctx.save();ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';ctx.globalAlpha=(warning?.35:mist?.66:.95)*(impact?Math.max(0,1-progress):1);
 ctx.translate(x,y);ctx.rotate(Math.atan2(uy,ux));
 if(mist)ctx.filter='grayscale(1) brightness(1.45)';
 ctx.drawImage(ready(objects,'v104-organic'),-width*.9,-height*.5,width,height);
 ctx.restore();return true;
}
export function drawV104EyeBeam(ctx,objects,{origin,target,halfWidth=18,warning=false,locked=false,progress=0}){
 if(!origin||!target||![origin.x,origin.y,target.x,target.y].every(Number.isFinite))return false;
 const dx=target.x-origin.x,dy=target.y-origin.y,length=Math.hypot(dx,dy);if(length<1)return false;
 const image=ready(objects,'v104-eye');ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(Math.atan2(dy,dx));
 ctx.globalCompositeOperation='lighter';ctx.shadowBlur=0;
 if(warning){
  // Only a modest eye charge is decorative. The existing battlefield warning
  // still shows the committed danger line and the real target footprint.
  const size=locked?34:22;ctx.globalAlpha=locked?.8:.45;
  ctx.drawImage(image,0,0,image.naturalWidth*.25,image.naturalHeight,-size*.35,-size/2,size,size);
 }else{
  const height=halfWidth*2.4;ctx.globalAlpha=Math.min(1,.72+Math.sin(progress*Math.PI)*.28);
  ctx.drawImage(image,-length*.08/.84,-height*.5,length/.84,height);
 }
 ctx.restore();return true;
}
