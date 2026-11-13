import {V099_BOSS_DEFEAT_TIMELINE as TIMELINE} from './battlePresentationV099.js';
import {combatVariation,drawRasterPlume} from './v100RasterAtmosphere.js';

// The semantic event still owns one defeat, the same audio beats and the same
// result wait. Profiles only stage the painted collapse inside that lifetime.
const PROFILES=Object.freeze({
 takuya:{spread:1.05,major:1.15,plume:1.1},
 'gate-eater':{spread:1.1,major:1.05,plume:1.15},
 kurome:{spread:.9,major:1.08,plume:.95},
 mother:{spread:1.35,major:1.12,plume:1.25},
 ooguchi:{spread:1.5,major:1.18,plume:1.05},
 gairen:{spread:1.2,major:1.2,plume:1.15},
 futago:{spread:1.4,major:1.05,plume:1.05},
 'mugarian-president-mutated':{spread:1.25,major:1.22,plume:1.2},
 'takuya-omega':{spread:1.65,major:1.32,plume:1.35},
});
function drawBossBlast(ctx,objects,effect,x,y,size){
 const source=objects?.['quality-boss-blast'];
 if(!source?.complete||!source.naturalWidth||!source.naturalHeight)throw new Error('Boss blast must decode before battle');
 const elapsed=effect.elapsed,duration=effect.duration;
 if(elapsed<0||elapsed>=duration)return;
 // Fast ignition, then a longer curling smoke tail. Blend adjacent painted
 // poses rather than stretching six static cells across the result wait.
 const phase=Math.min(5,elapsed<.25?elapsed/.25*2:2+(elapsed-.25)/Math.max(.01,duration-.25)*3);
 const first=Math.floor(phase),blend=phase-first,cw=source.naturalWidth/3,ch=source.naturalHeight/2;
 const fade=Math.min(1,(duration-elapsed)/.25);
 const width=390*size,height=220*size;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
 ctx.translate(x,y);if(x>480)ctx.scale(-1,1);
 for(const [frame,weight] of [[first,1-blend],[Math.min(5,first+1),blend]]){
  if(weight<=0)continue;
  ctx.globalAlpha=weight*fade;
  ctx.drawImage(source,frame%3*cw,Math.floor(frame/3)*ch,cw,ch,-96/512*width,-460/512*height,width,height);
 }
 ctx.restore();
}

export function drawV100BossDefeat(ctx,objects,effect,density=1){
 if(effect?.kind!=='boss-defeat'||![effect.x,effect.y,effect.elapsed,effect.duration,effect.seed,density].every(Number.isFinite)
  ||effect.duration<=0||effect.elapsed<0||effect.elapsed>=effect.duration||density<=0)return false;
 const p=PROFILES[effect.label]??PROFILES.takuya;
 const seed=effect.seed,t=effect.elapsed;
 const small=TIMELINE.smallBursts;
 for(let i=0;i<small.length;i++){
  const b=small[i],age=t-b.at;
  if(age<0||age>=.72)continue;
  drawBossBlast(ctx,objects,{elapsed:age,duration:.72},
   effect.x+b.dx*p.spread,effect.y+b.dy,b.scale*.38);
 }
 const medium=TIMELINE.mediumBurst,mediumAge=t-medium.at;
 if(mediumAge>=0&&mediumAge<1.05)drawBossBlast(ctx,objects,{elapsed:mediumAge,duration:1.05},effect.x+medium.dx*p.spread,effect.y+medium.dy,medium.scale*.65);
 const major=TIMELINE.majorBurst,majorAge=t-major.at;
 if(majorAge>=0)drawBossBlast(ctx,objects,{elapsed:majorAge,duration:effect.duration-major.at},effect.x,effect.y,p.major);
 // Secondary tears travel sideways after the primary rupture; they are
 // aftermath, not additional semantic explosions, damage or audio requests.
 for(let i=0;i<Math.min(4,Math.max(2,Math.round(4*density)));i++){
  const start=.36+i*.17,age=t-start;
  if(age<0||age>.6)continue;
  const r=combatVariation(seed,i),progress=age/.6;
  const dust=objects?.['v100-dust'];
  drawRasterPlume(ctx,dust,{x:effect.x+(i%2?1:-1)*(22+progress*115*p.spread),
   y:effect.y+8-progress*(12+r*18),width:(55+progress*80)*p.plume,height:24+progress*28,
   alpha:.42*(1-progress),rotation:(r-.5)*.2,flip:i%2===0});
 }
 if(t>=.65){
  const age=(t-.65)/(effect.duration-.65),fade=Math.sin(Math.min(1,age)*Math.PI);
  for(let i=0;i<3;i++){
   const r=combatVariation(seed,i+15),smoke=objects?.[i%2?'v100-smoke-a':'v100-smoke-b'];
   drawRasterPlume(ctx,smoke,{x:effect.x+(i-1)*(25+age*46)*p.spread,
    y:effect.y-24-age*(50+r*38),width:(78+age*125)*p.plume,height:(65+age*145)*p.plume,
    alpha:fade*(.24+r*.07),flip:i%2===0});
  }
 }
 return true;
}
