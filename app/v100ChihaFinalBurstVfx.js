// Authored final-round burst with an installed-pack compatibility path.
// Existing textures only; no event, damage, sound, timer or RNG ownership.
import {combatVariation,drawRasterPlume} from "./v100RasterAtmosphere.js";
import {drawV100Explosion,v100ExplosionFrame} from "./v100CombatVfx.js";
export const V100_CHIHA_FINAL_BURST_DURATION=.90;
export const V100_CHIHA_FINAL_ENVELOPE=Object.freeze({left:-88,top:-152,width:260,height:170});
const TIMES=Object.freeze([0,.065,.16,.29,.46,.66]);
function ready(objects,id){
 const source=objects?.[id];
 if(!source?.complete||!source.naturalWidth||!source.naturalHeight)
  return null;
 return source;
}
export function v100ChihaFinalPaintScale({viewportWidth,viewportHeight,worldScale}={}){
 if(![viewportWidth,viewportHeight,worldScale].every(Number.isFinite)
   ||viewportWidth<=0||viewportHeight<=0||worldScale<=0)return 0;
 // Per burst, all draw rectangles together fit within this one envelope.
 return Math.min(1,Math.sqrt(.105*viewportWidth*viewportHeight/(260*170*worldScale*worldScale)));
}
// Old installed packs may lack the dedicated sheet. Keep their existing
// painted final explosion at its original age/duration, never restart it.
function drawLegacyPaintedFinal(ctx,objects,effect,paintScale){
 const source=ready(objects,"v100-explosion"),t=effect.elapsed,duration=.6;
 if(!source||t<0||t>=duration)return false;
 ctx.save();ctx.globalCompositeOperation="source-over";ctx.shadowBlur=0;ctx.globalAlpha=1;
 ctx.translate(effect.x,effect.y);ctx.scale(paintScale,paintScale);
 const companions=["v100-dust","v100-smoke-a","v100-smoke-b"];
 if(companions.every(id=>ready(objects,id))){
  drawV100Explosion(ctx,objects,{x:0,y:0,elapsed:t,duration,scale:"medium"},0,0,.6,1);
 }else{
  // Secondary decode failure must not pass undefined into drawImage.
  // The ready original fire sheet can still paint its unchanged old cell.
  const frame=v100ExplosionFrame({elapsed:t,duration}),size=220*.6;
  if(frame!==null){
   ctx.globalAlpha=Math.max(0,Math.min(1,(1-t/duration)/.18));
   ctx.drawImage(source,frame%6*128,Math.floor(frame/6)*128,128,128,
    -size/2,-size*.85,size,size);
  }
 }
 ctx.restore();return true;
}

export function drawV100ChihaFinalBurst(ctx,objects,effect,paintScale){
 const t=effect.elapsed;
 if(effect.type!=="mrs-grenade-impact"||effect.finalRound!==true
  ||![effect.x,effect.y,t,effect.duration,effect.ownerId,effect.activationId,effect.shotIndex,paintScale].every(Number.isFinite)
  ||t<0||t>=effect.duration||paintScale<=0)return false;
 const source=ready(objects,"quality-boss-blast");
 if(!source)return drawLegacyPaintedFinal(ctx,objects,effect,paintScale);
 const dust=ready(objects,"v100-dust");
 const cw=source.naturalWidth/3,ch=source.naturalHeight/2;
 let first=5,blend=0;
 for(let i=0;i<5;i++)if(t<TIMES[i+1]){
  first=i;blend=(t-TIMES[i])/(TIMES[i+1]-TIMES[i]);break;
 }
 const fade=t<=.66?1:Math.max(0,(effect.duration-t)/Math.max(.01,effect.duration-.66));
 const seed=effect.ownerId*37+effect.activationId*101+effect.shotIndex*17;
 ctx.save();ctx.globalCompositeOperation="source-over";ctx.shadowBlur=0;
 ctx.translate(effect.x,effect.y);
 // Lean inward without moving the actual ground impact.
 ctx.scale((effect.x>480?-1:1)*paintScale,paintScale);
 for(const [frame,weight]of [[first,1-blend],[Math.min(5,first+1),blend]]){
  if(weight<=0)continue;ctx.globalAlpha=weight*fade;
  ctx.drawImage(source,frame%3*cw,Math.floor(frame/3)*ch,cw,ch,
   -96/512*210,-460/512*168,210,168);
 }
 const dustAge=(t-.03)/.39;
 if(dust&&dustAge>=0&&dustAge<1)for(let i=0;i<2;i++){
  const side=i?-1:1;
  drawRasterPlume(ctx,dust,{x:side*(12+dustAge*34),y:4-dustAge*2,
   width:38+dustAge*22,height:12+dustAge*6,
   alpha:.22*(1-dustAge)**2,rotation:0,flip:i===1});
 }
 const smokeAge=(t-.26)/Math.max(.01,effect.duration-.26);
 if(smokeAge>=0&&smokeAge<1){
  const smoke=ready(objects,combatVariation(seed,4)<.5?"v100-smoke-a":"v100-smoke-b");
  if(smoke)drawRasterPlume(ctx,smoke,{x:55+smokeAge*8,y:-52-smokeAge*24,
   width:70+smokeAge*30,height:48+smokeAge*24,
   alpha:.16*Math.sin(Math.PI*smokeAge)*fade,rotation:0,flip:combatVariation(seed,5)<.5});
 }
 ctx.restore();return true;
}
