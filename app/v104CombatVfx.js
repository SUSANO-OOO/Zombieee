import {v177JointActorKey} from './v177JointActorHistory.js';
const weaponHistory=new WeakMap();
const steelKinds=new Set(['brute','guardian','gate-eater','red-panther-shield','scout','zakimiya','tky','miyamoto-musashi','crazy-king','kumaverson','takuya','takuya-omega','red-panther-knife']);
const clawKinds=new Set(['walker','runner','turned','sprinter','grappler','crusher','abomination','gairen','futago','futago-separated-a','futago-separated-b','mugarian-president-mutated']);
const fistKinds=new Set(['brawler','shade']);
export function v104WeaponWakeCandidate(kind,phase,held=false){
 return !held&&Number.isFinite(phase)&&phase>=.12&&phase<=.7&&(steelKinds.has(kind)||clawKinds.has(kind)||fistKinds.has(kind));
}
const ready=(objects,id)=>{const image=objects?.[id];if(!image?.complete||!image.naturalWidth)throw Error('Undecoded combat effect: '+id);return image;};
function textureTriangle(ctx,image,source,a,b,c,second=false){
 const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 if(Math.abs(area)<.01)return false;
 ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();
 // Map the texture's two triangles onto the actual swept blade/hand, rather
 // than rotating a square effect beside its current endpoint.
 if(second)ctx.transform(b.x-c.x,b.y-c.y,c.x-a.x,c.y-a.y,a.x,a.y);
 else ctx.transform(b.x-a.x,b.y-a.y,c.x-b.x,c.y-b.y,a.x,a.y);
 ctx.drawImage(image,...source,0,0,1,1);ctx.restore();return true;
}
export function drawV104WeaponWake(ctx,objects,{actor,world,kind,time,tip,grip,phase,channel='primary',sequence,held=false}){
 const key=v177JointActorKey(actor,world),history=weaponHistory.get(key)??new Map(),previous=history.get(channel);
 if(!tip||!grip||!Number.isFinite(time)||held||!(actor.hp>0)||(!steelKinds.has(kind)&&!clawKinds.has(kind)&&!fistKinds.has(kind))){history.delete(channel);return false;}
 if(previous?.time===time)return false;
 history.set(channel,{time,tip:{...tip},grip:{...grip},phase,sequence});weaponHistory.set(key,history);
 if(!(phase>=.18&&phase<=.65)||!previous||phase<previous.phase||sequence!==previous.sequence||!(time>previous.time&&time-previous.time<=.12))return false;
 const dx=tip.x-previous.tip.x,dy=tip.y-previous.tip.y,travel=Math.hypot(dx,dy),reach=Math.hypot(tip.x-grip.x,tip.y-grip.y);
 if(travel<.6||travel>180||reach<.5)return false;
 const organic=clawKinds.has(kind),fist=fistKinds.has(kind),frame=Math.min(5,Math.floor((phase-.18)/.47*6));
 const id=kind==='tky'?'v100-lightblade':organic?'v100-claw-contact':fist?'v100-dust':'v104-steel';
 const image=ready(objects,id),source=['v100-lightblade','v100-claw-contact'].includes(id)
  ?[frame%3*512,Math.floor(frame/3)*512,512,512]:[0,0,image.naturalWidth,image.naturalHeight];
 const inset=kind==='zakimiya'?.7:organic?.55:.18;
 const inner=(t,g)=>({x:g.x+(t.x-g.x)*inset,y:g.y+(t.y-g.y)*inset});
 let a=inner(previous.tip,previous.grip),b=previous.tip,c=tip,d=inner(tip,grip);
 if(fist||reach<5){
  const thickness=Math.min(3,Math.max(1,reach*.45)),nx=-dy/travel*thickness,ny=dx/travel*thickness;
  a={x:previous.tip.x-nx,y:previous.tip.y-ny};b={x:previous.tip.x+nx,y:previous.tip.y+ny};
  c={x:tip.x+nx,y:tip.y+ny};d={x:tip.x-nx,y:tip.y-ny};
 }
 ctx.save();ctx.shadowBlur=0;ctx.globalAlpha=Math.min(kind==='tky'?.82:fist?.3:.6,travel/8)*Math.min(1,(.7-phase)/.12);
 if(kind==='tky')ctx.globalCompositeOperation='lighter';
 if(kind==='zakimiya')ctx.globalAlpha*=.55;
 const first=textureTriangle(ctx,image,source,a,b,c),second=textureTriangle(ctx,image,source,a,c,d,true);
 if(!first&&!second){
  // A perfectly straight thrust still has a narrow textured motion strip.
  const n={x:-dy/travel,y:dx/travel},w=1;
  const aa={x:previous.tip.x-n.x*w,y:previous.tip.y-n.y*w},bb={x:previous.tip.x+n.x*w,y:previous.tip.y+n.y*w};
  const cc={x:tip.x+n.x*w,y:tip.y+n.y*w},dd={x:tip.x-n.x*w,y:tip.y-n.y*w};
  textureTriangle(ctx,image,source,aa,bb,cc);textureTriangle(ctx,image,source,aa,cc,dd,true);
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
