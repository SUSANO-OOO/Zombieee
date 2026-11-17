import {combatVariation} from './v100RasterAtmosphere.js';
import {allyCorpseVisualCue} from './corpseVisuals.js';
import {V100_GROUND_FIRE_BED_ART} from './v100GroundFireArt.js';

// The simulation replaces corpse records. Bind images to the battle and id;
// late decoding must not change an already-visible effect halfway through it.
const battles=new WeakMap();
const ready=image=>image?.complete&&image.naturalWidth>0&&image.naturalHeight>0;
const clamp=value=>Math.max(0,Math.min(1,value));
function paint(ctx,image,cell,x,y,width,height,alpha,flip=false,anchorY=.72){
 if(!image||!(alpha>0)||![x,y,width,height,alpha].every(Number.isFinite)||width<=0||height<=0)return 0;
 ctx.save();
 try{
  ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;ctx.filter='none';ctx.globalAlpha=clamp(alpha);
  ctx.translate(x,y);if(flip)ctx.scale(-1,1);
  ctx.drawImage(image,cell.x,cell.y,cell.w,cell.h,-width/2,-height*anchorY,width,height);
 }finally{ctx.restore();}
 return 1;
}
const full=image=>({x:0,y:0,w:image.naturalWidth,h:image.naturalHeight});
function select(record,key,choose){if(!Object.hasOwn(record,key))record[key]=choose();return record[key];}
export function clearV100CorpseAtmosphere(world){battles.delete(world);}
export function drawV100CorpseAtmosphere(ctx,objects,world,{enemyTimings={},density=1}={}){
 if(!world||typeof world!=='object'||!Number.isFinite(world.time)||!Array.isArray(world.corpses))return 0;
 let state=battles.get(world);
 if(!state||state.generation!==world.battleAudioGeneration||world.time<state.time){
  state={generation:world.battleAudioGeneration,time:world.time,records:new Map()};battles.set(world,state);
 }
 state.time=world.time;
 const active=new Set(world.corpses.map(c=>c.id));for(const id of state.records.keys())if(!active.has(id))state.records.delete(id);
 let draws=0;
 for(const corpse of world.corpses){
  if(![corpse.id,corpse.x,corpse.y].every(Number.isFinite)||corpse.state==='removed')continue;
  const cue=corpse.side==='human'?allyCorpseVisualCue(corpse,world.time):null;
  const enemyAsh=corpse.side==='zombie'&&corpse.state==='ashing';
  if(!enemyAsh&&!(cue?.smokePuffs>0)&&!(cue?.flameTongues>0))continue;
  let record=state.records.get(corpse.id);
  if(!record){record={seed:combatVariation(corpse.id,61),phase:combatVariation(corpse.id,62),flip:combatVariation(corpse.id,63)>.5};state.records.set(corpse.id,record);}
  if(cue?.flameTongues>0){
   const art=select(record,'fire',()=>{
    const primary=objects?.[V100_GROUND_FIRE_BED_ART.burn.id];
    if(ready(primary)&&primary.naturalWidth===768&&primary.naturalHeight===512)return {image:primary,columns:3,rows:2,frames:6};
    const fallback=objects?.['v100-ground-fire'];
    return ready(fallback)&&fallback.naturalWidth%6===0&&fallback.naturalHeight%5===0?{image:fallback,columns:6,rows:5,frames:30}:null;
   });
   if(art){
    const period=.88+record.seed*.34,phase=((world.time/period+record.phase)%1+1)%1*art.frames,index=Math.floor(phase),blend=phase-index;
    const baseWidth=['brute','brawler','crazy-king','kumaverson'].includes(corpse.kind)?92:corpse.kind==='scout'?58:76;
    const width=baseWidth*(.9+record.seed*.2),height=width*(.54+record.phase*.12),alpha=.68+Math.sin(world.time*2.1+record.phase*6.28)*.07;
    const cellW=art.image.naturalWidth/art.columns,cellH=art.image.naturalHeight/art.rows;
    for(const [frame,weight]of [[index,1-blend],[(index+1)%art.frames,blend]]){
     if(weight<=0)continue;
     draws+=paint(ctx,art.image,{x:frame%art.columns*cellW,y:Math.floor(frame/art.columns)*cellH,w:cellW,h:cellH},corpse.x,corpse.y+4,width,height,alpha*weight,record.flip,V100_GROUND_FIRE_BED_ART.burn.anchorY);
    }
   }
  }else if(enemyAsh||corpse.state==='ash'){
   const image=select(record,'dust',()=>ready(objects?.['v100-dust'])?objects['v100-dust']:null);
   if(image){
    const duration=enemyTimings[corpse.deathClass??'normal']?.ashingSeconds;
    const progress=enemyAsh&&Number.isFinite(duration)&&duration>0?clamp(corpse.phaseElapsed/duration):0;
    const fade=enemyAsh?1-progress*.72:clamp((corpse.life??0)/2);
    const count=density<.7?1:2;
    for(let i=0;i<count;i++){
     const drift=Math.sin(world.time*(.8+i*.13)+record.phase*6.28+i*2.1),rise=enemyAsh?progress*(18+i*7):(world.time*(7+i*2)+record.seed*11)%18;
     const width=(corpse.deathClass==='boss'?44:26)+record.seed*9+i*5;
     draws+=paint(ctx,image,full(image),corpse.x+drift*(8+i*4),corpse.y-7-rise,width,width*.85,(enemyAsh?.28:.18)*fade/(1+i*.4),i===0&&record.flip);
    }
   }
  }else if(cue?.smokePuffs>0){
   const image=select(record,'smoke',()=>{
    const first=objects?.[record.flip?'v100-smoke-a':'v100-smoke-b'],second=objects?.[record.flip?'v100-smoke-b':'v100-smoke-a'];
    return ready(first)?first:ready(second)?second:null;
   });
   if(image){
    const count=Math.min(density<.7?1:2,cue.smokePuffs);
    for(let i=0;i<count;i++){
     const phase=(world.time*(.45+i*.08)+record.phase+i*.41)%1,width=22+record.seed*9+i*7;
     draws+=paint(ctx,image,full(image),corpse.x+Math.sin(world.time*1.4+record.phase*6.28+i)*6,corpse.y-9-phase*19,width,width*1.25,(cue.smokePuffs>1?.22:.14)*(.55+Math.sin(phase*Math.PI)*.45),record.flip);
    }
   }
  }
 }
 return draws;
}
