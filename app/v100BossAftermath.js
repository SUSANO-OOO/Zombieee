import {combatVariation,drawRasterPlume} from './v100RasterAtmosphere.js';
import {V100_BOSS_ATTACK_ART} from './v100BossAttackArt.js';
import {BOSS_ANOMALY_TUNING} from './bossAnomalies.js';

// Simulation ticks clone fighters. Keep the art stable for this strike and
// sample the available sheets again when the boss activates its next attack.
const releaseChoices=new WeakMap();
export function bossAttackReleaseSource(objects,kind,world,ownerId){
 const fallback={art:null,image:objects?.['v100-ground-impact']};
 if(!world||typeof world!=='object'||!Array.isArray(world.fighters)||!Number.isSafeInteger(ownerId)||ownerId<0)return fallback;
 const rawGeneration=world.battlePresentation?.generation,generation=Number.isFinite(rawGeneration)?rawGeneration:0;
 let state=releaseChoices.get(world);
 if(!state||state.generation!==generation){state={generation,choices:new Map()};releaseChoices.set(world,state);}
 const liveFighters=new Map(world.fighters.filter(f=>f.hp>0).map(f=>[f.id,f]));
 for(const [key,choice]of state.choices)if(!liveFighters.has(choice.ownerId))state.choices.delete(key);
 const owner=liveFighters.get(ownerId);
 if(!owner)return fallback;
 const key=JSON.stringify([ownerId,kind]);
 const choice=state.choices.get(key);
 if(!choice||choice.attackSequence!==owner.attackSequence){
  const art=V100_BOSS_ATTACK_ART[kind],image=art&&objects?.[art.id];
  const valid=art&&image?.complete&&Number.isFinite(image.naturalWidth)&&Number.isFinite(image.naturalHeight)
   &&image.naturalWidth>0&&image.naturalHeight>0&&image.naturalWidth%art.columns===0
   &&image.naturalHeight%art.rows===0&&image.naturalWidth/art.columns===image.naturalHeight/art.rows;
  state.choices.set(key,{ownerId,attackSequence:owner.attackSequence,source:valid?{art,image}:fallback});
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
 mother:{size:192,beats:[[0,-42],[.08,0],[.16,42]]},
 ooguchi:{size:220,beats:[[0,18]]},
 gairen:{size:230,beats:[[0,-24],[.1,24]]},
 futago:{size:238,beats:[[0,-8],[.045,8]]},
 'mugarian-president-mutated':{size:208,beats:[[0,-62],[.04,-20],[.08,20],[.12,62]]},
 'takuya-omega':{size:312,beats:[[0,0]]},
});
function drawRelease(ctx,objects,{kind,x,y,elapsed,direction,world,ownerId,viewport}){
 const p=RELEASES[kind];
 if(!p||!p.beats.some(([delay])=>elapsed>=delay&&elapsed-delay<.54))return false;
 const {art,image:source}=bossAttackReleaseSource(objects,kind,world,ownerId);
 if(!source?.complete||!source.naturalWidth||!source.naturalHeight)return false;
 const cw=source.naturalWidth/3,ch=source.naturalHeight/2;
 const bladeSweep = kind === 'takuya-omega' && Boolean(art);
 const twinStrike = kind === 'futago' && Boolean(art);
 const anchorX = bladeSweep ? .35 : twinStrike ? .33 : art?.anchorX ?? .5;
 // The sheet is a square painted camera. Keep its height and the authored
 // ground anchor instead of flattening every burst into a shallow ellipse.
 // Bound the union of staggered beats, not each individual image.
 let size=p.size;
 if(viewport){
  const {viewportWidth,viewportHeight,worldScale}=viewport;
  const offsets=p.beats.map(([,offset])=>offset),spread=Math.max(...offsets)-Math.min(...offsets);
  const budget=viewportWidth*viewportHeight*.18/(worldScale*worldScale);
  const widthInCells = twinStrike ? 2 * (1 - anchorX) : 1;
  size=Math.min(size,(Math.sqrt(spread*spread+4*widthInCells*budget)-spread)/(2*widthInCells));
 }
 // The painted debris travels right from its impact point. Place that point
 // beneath the blade's reach and mirror the burst for a leftward strike.
 const strikeX = bladeSweep ? x + direction * size * .58 : x;
 for(const [delay,offset] of p.beats){
  const age=elapsed-delay;if(age<0||age>=.54)continue;
  const progress=age/.54,frame=Math.min(5,Math.floor(progress*6));
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=progress>.8?(1-progress)/.2:1;ctx.shadowBlur=0;
  ctx.translate(strikeX+(kind==='ooguchi'?-direction:1)*offset,y+4);
  if ((bladeSweep && direction < 0) || (kind === 'futago' && offset < 0)) ctx.scale(-1, 1);
  if(art){
   const position=progress*5,first=Math.floor(position),next=Math.min(5,first+1),blend=position-first;
   const fade=ctx.globalAlpha;
   for(const [cell,weight]of [[first,1-blend],[next,blend]]){
    if(weight<=0)continue;ctx.globalAlpha=fade*weight;
    ctx.drawImage(source,cell%3*cw,Math.floor(cell/3)*ch,cw,ch,-size*anchorX,-size*art.anchorY,size,size);
   }
  }else ctx.drawImage(source,frame%3*cw,Math.floor(frame/3)*ch,cw,ch,-size/2,-size*360/512,size,size);
  ctx.restore();
 }
 return true;
}

// Ground releases are painted before actors, hazard warnings and health.
// Their clocks are read from the real active phase; no new event or hit is made.
export function drawV100BossReleaseFields(ctx,objects,world,viewport={}){
 if(!world?.definition?.missionConfig?.v100StageNumber||!Array.isArray(world.fighters))return 0;
 const {viewportWidth,viewportHeight,worldScale}=viewport;
 if(![viewportWidth,viewportHeight,worldScale].every(Number.isFinite)
  ||viewportWidth<=0||viewportHeight<=0||worldScale<=0)return 0;
 let drawn=0;
 for(const f of world.fighters){
  const tuning=BOSS_ANOMALY_TUNING[f.kind];
  if(!RELEASES[f.kind]||!tuning||!f.combatReady||!(f.hp>0)||f.stationAbility?.phase!=='active')continue;
  const elapsed=tuning.activeSeconds-f.stationAbility.remainingSeconds;
  // Futago damages the locked crossing point. Its darker movement dust still
  // follows the fighters' feet in the actor pass.
  const x = f.kind === 'futago' ? Number(f.stationAbility.targetX) || f.x : f.x;
  const y = f.kind === 'futago' ? Number(f.stationAbility.targetY) || f.y : f.y;
  if(![x,y,elapsed].every(Number.isFinite)||elapsed<0)continue;
  if(drawRelease(ctx,objects,{kind:f.kind,x,y,elapsed,world,ownerId:f.id,viewport,
   direction:f.kind==='ooguchi'?-1:Number(f.stationAbility.targetX)>f.x?1:-1}))drawn++;
 }
 return drawn;
}

export function drawV100BossAftermath(ctx,objects,{kind,x,y,elapsed,duration,phase,direction=-1,seed=0,world,ownerId,includeRelease=true}={}) {
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
 if(!recovery&&includeRelease)drawRelease(ctx,objects,{kind,x,y,elapsed,direction,world,ownerId});
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
