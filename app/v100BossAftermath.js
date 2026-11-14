import {combatVariation,drawRasterPlume} from './v100RasterAtmosphere.js';
import {V100_BOSS_ATTACK_ART} from './v100BossAttackArt.js';

// Simulation ticks clone fighters. The stable battle, generation and fighter
// id own the visual choice, so a late decode cannot replace a running effect.
const releaseChoices=new WeakMap();
export function bossAttackReleaseSource(objects,kind,world,ownerId){
 const fallback={art:null,image:objects?.['v100-ground-impact']};
 if(!world||typeof world!=='object'||!Array.isArray(world.fighters)||!Number.isSafeInteger(ownerId)||ownerId<0)return fallback;
 const rawGeneration=world.battlePresentation?.generation,generation=Number.isFinite(rawGeneration)?rawGeneration:0;
 let state=releaseChoices.get(world);
 if(!state||state.generation!==generation){state={generation,choices:new Map()};releaseChoices.set(world,state);}
 const liveIds=new Set(world.fighters.filter(f=>f.hp>0).map(f=>f.id));
 for(const [key,choice]of state.choices)if(!liveIds.has(choice.ownerId))state.choices.delete(key);
 if(!liveIds.has(ownerId))return fallback;
 const key=JSON.stringify([ownerId,kind]);
 if(!state.choices.has(key)){
  const art=V100_BOSS_ATTACK_ART[kind],image=art&&objects?.[art.id];
  const valid=art&&image?.complete&&Number.isFinite(image.naturalWidth)&&Number.isFinite(image.naturalHeight)
   &&image.naturalWidth>0&&image.naturalHeight>0&&image.naturalWidth%art.columns===0
   &&image.naturalHeight%art.rows===0&&image.naturalWidth/art.columns===image.naturalHeight/art.rows;
  state.choices.set(key,{ownerId,source:valid?{art,image}:fallback});
 }
 return state.choices.get(key).source;
}

// These are disturbances from the real body motion, not independent damage or
// contact effects. Keep Mother’s socket-owned emission and all hit queues.
const PROFILES=Object.freeze({
 mother:{spread:112,size:76,count:6,lift:18,trail:0,smoke:.18},
 ooguchi:{spread:150,size:72,count:5,lift:10,trail:105,smoke:.12},
 gairen:{spread:94,size:92,count:6,lift:9,trail:18,smoke:.22},
 futago:{spread:114,size:66,count:6,lift:22,trail:0,smoke:.14},
 'mugarian-president-mutated':{spread:100,size:98,count:7,lift:38,trail:0,smoke:.25},
 'takuya-omega':{spread:182,size:118,count:8,lift:35,trail:0,smoke:.3},
});

const RELEASES=Object.freeze({
 mother:{width:132,height:90,beats:[[0,-42],[.08,0],[.16,42]]},
 ooguchi:{width:190,height:100,beats:[[0,18]]},
 gairen:{width:200,height:100,beats:[[0,-24],[.1,24]]},
 futago:{width:178,height:108,beats:[[0,-30],[.12,30]]},
 'mugarian-president-mutated':{width:160,height:102,beats:[[0,-62],[.04,-20],[.08,20],[.12,62]]},
 'takuya-omega':{width:380,height:238,beats:[[0,0]]},
});
function drawRelease(ctx,objects,{kind,x,y,elapsed,direction,world,ownerId}){
 const p=RELEASES[kind];
 if(!p||!p.beats.some(([delay])=>elapsed>=delay&&elapsed-delay<.54))return;
 const {art,image:source}=bossAttackReleaseSource(objects,kind,world,ownerId);
 if(!source?.complete||!source.naturalWidth||!source.naturalHeight)return;
 const cw=source.naturalWidth/3,ch=source.naturalHeight/2;
 for(const [delay,offset] of p.beats){
  const age=elapsed-delay;if(age<0||age>=.54)continue;
  const progress=age/.54,frame=Math.min(5,Math.floor(progress*6));
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=progress>.8?(1-progress)/.2:1;ctx.shadowBlur=0;
  ctx.translate(x+(kind==='ooguchi'?-direction:1)*offset,y+4);
  if(kind==='futago'&&offset<0)ctx.scale(-1,1);
  if(art){
   const position=progress*5,first=Math.floor(position),next=Math.min(5,first+1),blend=position-first;
   const fade=ctx.globalAlpha;
   for(const [cell,weight]of [[first,1-blend],[next,blend]]){
    if(weight<=0)continue;ctx.globalAlpha=fade*weight;
    ctx.drawImage(source,cell%3*cw,Math.floor(cell/3)*ch,cw,ch,-p.width*art.anchorX,-p.height*art.anchorY,p.width,p.height);
   }
  }else ctx.drawImage(source,frame%3*cw,Math.floor(frame/3)*ch,cw,ch,-p.width/2,-p.height*360/512,p.width,p.height);
  ctx.restore();
 }
}

export function drawV100BossAftermath(ctx,objects,{kind,x,y,elapsed,duration,phase,direction=-1,seed=0,world,ownerId}={}) {
 const p=PROFILES[kind];
 if(!p||![x,y,elapsed,duration,direction,seed].every(Number.isFinite)||duration<=0||elapsed<0||elapsed>=duration||!['active','recovery'].includes(phase))return false;
 const dust=objects?.['v100-dust'];
 if(!dust?.complete||!dust.naturalWidth||!dust.naturalHeight)throw new Error('Boss ground dust must decode before battle');
 const recovery=phase==='recovery',progress=elapsed/duration;
 // One fast release, then settling motion. Long guard/cross-strike phases
 // must not replay a fresh impact every loop.
 const age=recovery?1+progress*.3:Math.min(1,elapsed/.7);
 const release=recovery?(1-progress)**2*.32:Math.min(1,elapsed/.075)*(1-progress*.68);
 for(let i=0;i<p.count;i++){
  const r=combatVariation(seed,i),side=i%2?-1:1;
  const stagger=(i%3)*.025,local=Math.max(0,age-stagger);
  const paired=kind==='futago'?side*(18+local*p.spread*.6):(i/(p.count-1)-.5)*p.spread*(.35+local*.95);
  const trailing=p.trail?-direction*(15+i/p.count*p.trail)*(.2+local):0;
  const w=p.size*(.46+local*.8+r*.2),h=w*(.27+r*.13);
  drawRasterPlume(ctx,dust,{x:x+paired+trailing,y:y+4-local*p.lift*(.3+r),
   width:w,height:h,alpha:release*(.32-r*.1),rotation:(r-.5)*.22,flip:i%2===0});
 }
 if(!recovery)drawRelease(ctx,objects,{kind,x,y,elapsed,direction,world,ownerId});
 const smoke=objects?.[kind==='gairen'?'v100-smoke-b':'v100-smoke-a'];
 if(smoke?.complete&&smoke.naturalWidth&&smoke.naturalHeight){
  for(let i=0;i<2;i++){
   const rise=recovery?1+progress*.35:Math.min(1,(elapsed+i*.1)/Math.max(.45,duration));
   drawRasterPlume(ctx,smoke,{x:x+(i?1:-1)*p.spread*.2-direction*p.trail*rise*.3,
    y:y-8-rise*p.lift,width:p.size*(.8+rise*.9),height:p.size*(.5+rise*.55),
    alpha:release*p.smoke*(.3+rise*.7),flip:i===0});
  }
 }
 return true;
}
