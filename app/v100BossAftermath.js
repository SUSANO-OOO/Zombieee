import {combatVariation,drawRasterPlume} from './v100RasterAtmosphere.js';
import {V100_BOSS_ATTACK_ART} from './v100BossAttackArt.js';
import {V100_BOSS_FLOOR_ART} from './v100BossFloorArt.js';
import {BOSS_ANOMALY_TUNING, BOSS_AREA_DEPTH_SCALE, bossGroundWarningRadius} from './bossAnomalies.js';

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

const presidentRadius = bossGroundWarningRadius('mugarian-president-mutated');
const PRESIDENT_FLOOR_CONTACTS = [
 // Time, ground position, bearing of the fracture, relative spread.
 [0, -.43, -.42, -.64, .94], [.055, .34, -.35, 1.04, .81],
 [.115, -.40, .36, 2.30, 1.05], [.18, .40, .40, -.23, .91],
].map(([delay, x, y, angle, spread]) => ({
 delay, x: x * presidentRadius, y: y * presidentRadius / BOSS_AREA_DEPTH_SCALE, angle, spread,
}));

function releaseProfile(size, beats) {
 const offsets = beats.map(([, x]) => x);
 const depths = beats.map(([, , y = 0]) => y);
 return { size, beats, spread: Math.max(...offsets) - Math.min(...offsets),
  depthSpread: Math.max(...depths) - Math.min(...depths) };
}

const RELEASES=Object.freeze({
 mother:releaseProfile(192,[[0,-42],[.08,0],[.16,42]]),
 ooguchi:releaseProfile(220,[[0,18]]),
 gairen:releaseProfile(230,[[0,-24],[.1,24]]),
 futago:releaseProfile(238,[[0,-8],[.045,8]]),
 'mugarian-president-mutated':releaseProfile(208,PRESIDENT_FLOOR_CONTACTS.map(({delay,x,y})=>[delay,x,y])),
 'takuya-omega':releaseProfile(312,[[0,0]]),
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
  const {spread,depthSpread}=p;
  const budget=viewportWidth*viewportHeight*.18/(worldScale*worldScale);
  const widthInCells = twinStrike ? 2 * (1 - anchorX) : 1;
  // (spread + widthInCells * size) * (depthSpread + size) must fit.
  const linear=spread+widthInCells*depthSpread;
  const available=budget-spread*depthSpread;
  if(available<=0)return false;
  size=Math.min(size,(Math.sqrt(linear*linear+4*widthInCells*available)-linear)/(2*widthInCells));
 }
 // The painted debris travels right from its impact point. Place that point
 // beneath the blade's reach and mirror the burst for a leftward strike.
 const strikeX = bladeSweep ? x + direction * size * .58 : x;
 for(const [delay,offset,depth=0] of p.beats){
  const age=elapsed-delay;if(age<0||age>=.54)continue;
  const progress=age/.54,frame=Math.min(5,Math.floor(progress*6));
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=progress>.8?(1-progress)/.2:1;ctx.shadowBlur=0;
  ctx.translate(strikeX+(kind==='ooguchi'?-direction:1)*offset,y+depth+(kind==='mugarian-president-mutated'?0:4));
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

// Uneven seams in the brood nest. Positions are fractions of its ground radius.
const BROOD_SEAMS = [[-.32,.16,-2.82,2], [.43,.29,.46,3], [.21,-.46,-1.12,0]];
function drawBroodSeepage(ctx, objects, radius, progress, intensity = 1) {
 const stain = objects?.['v102-ground-stains'], secretion = objects?.['v104-organic'];
 ctx.save();
 ctx.scale(1, 1 / BOSS_AREA_DEPTH_SCALE);
 if (stain?.complete && stain.naturalWidth && stain.naturalHeight) {
  const cw = stain.naturalWidth / 2, ch = stain.naturalHeight / 2;
  const width = radius * (2.03 + .19 * progress);
  ctx.globalAlpha = intensity * (.70 + .25 * progress);
  ctx.drawImage(stain, 0, ch, cw, ch, -width * .51, -radius * .98, width, radius * 1.96);
 }
 for (const [x, y, angle, cell] of BROOD_SEAMS) {
  const swell = .5 - .5 * Math.cos(progress * Math.PI * 3 - cell * .55);
  ctx.save();
  ctx.translate(x * radius, y * radius);
  ctx.rotate(angle);
  if (stain?.complete && stain.naturalWidth && stain.naturalHeight) {
   const cw = stain.naturalWidth / 2, ch = stain.naturalHeight / 2;
   const width = radius * (1.22 + .48 * progress + .11 * swell);
   ctx.globalAlpha = intensity * (.69 + progress * .27);
   ctx.drawImage(stain, cell % 2 * cw, Math.floor(cell / 2) * ch, cw, ch,
    -width * .48, -width * .34, width, width * .68);
  }
  if (secretion?.complete && secretion.naturalWidth && secretion.naturalHeight) {
   const reach = radius * (.59 + .55 * progress + .10 * swell);
   ctx.globalCompositeOperation = 'screen';
   ctx.globalAlpha = intensity * (.74 + progress * .24);
   ctx.drawImage(secretion, -radius * .32, -radius * .45, reach, radius * (.81 + .14 * swell));
  }
  ctx.restore();
 }
 ctx.restore();
}

function bossFloorImage(objects, kind) {
 if (kind !== 'mugarian-president-mutated' && kind !== 'takuya-omega') return null;
 const image = objects?.[V100_BOSS_FLOOR_ART.id];
 const cell = V100_BOSS_FLOOR_ART.cellSize;
 return image?.complete && image.naturalWidth === 2 * cell && image.naturalHeight === cell ? image : null;
}

function drawPresidentFractures(ctx, image, radius, progress, opacity) {
 const cell = V100_BOSS_FLOOR_ART.cellSize;
 for (const [index, {x, y, angle, spread}] of PRESIDENT_FLOOR_CONTACTS.entries()) {
  const growth = Math.max(0, Math.min(1, (progress - index * .12) / .62));
  if (growth <= 0) continue;
  const width = radius * spread * (.32 + growth * .85);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 1 / BOSS_AREA_DEPTH_SCALE);
  ctx.rotate(angle);
  ctx.globalAlpha = opacity * Math.min(1, growth * 3);
  ctx.drawImage(image, 0, 0, cell, cell, -width / 2, -width / 2, width, width);
  ctx.restore();
 }
}

function drawBladeGouge(ctx, image, radius, direction, elapsed) {
 const cell = V100_BOSS_FLOOR_ART.cellSize;
 // Reveal the trench along the swing. Moving the full texture would slide the
 // stones across the street after they had already broken.
 const reveal = Math.min(1, elapsed / .18);
 if (reveal <= 0) return;
 const width = 1.62 * radius, height = .88 * radius / BOSS_AREA_DEPTH_SCALE;
 ctx.scale(direction, 1);
 ctx.drawImage(image, cell, 0, cell * reveal, cell,
  -radius * .64, -height * .55, width * reveal, height);
}

function drawGroundWarning(ctx, objects, fighter, radius) {
 const {kind, x, y, stationAbility} = fighter;
 const remaining = stationAbility.remainingSeconds;
 if (![x, y, remaining].every(Number.isFinite)) return;
 const progress = Math.max(0, Math.min(1, 1 - remaining / BOSS_ANOMALY_TUNING[kind].warningSeconds));
 const president = kind === 'mugarian-president-mutated';
 const depth = radius / BOSS_AREA_DEPTH_SCALE;
 const brood = kind === 'mother';
 const material = bossFloorImage(objects, kind);
 const pigment = brood ? '173,95,62' : president ? '227,73,61' : '255,155,53';

 ctx.save();
 ctx.translate(x, y);
 ctx.beginPath();
 ctx.ellipse(0, 0, radius, depth, 0, 0, 2 * Math.PI);
 ctx.clip();
 ctx.globalCompositeOperation = 'source-over';
 ctx.shadowBlur = 0;
 ctx.globalAlpha = brood ? .40 + progress * .13 : material ? .48 + progress * .16 : .72 + progress * .28;
 ctx.save();
 ctx.scale(1, 1 / BOSS_AREA_DEPTH_SCALE);
 const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
 wash.addColorStop(0, `rgba(${pigment},.29)`);
 wash.addColorStop(.66, `rgba(${pigment},.20)`);
 wash.addColorStop(.89, `rgba(${pigment},.38)`);
 wash.addColorStop(.97, `rgba(${pigment},.61)`);
 wash.addColorStop(1, `rgba(${pigment},0)`);
 ctx.fillStyle = wash;
 ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
 ctx.restore();

 if (brood) {
  drawBroodSeepage(ctx, objects, radius, progress);
  ctx.restore();
  return;
 }

 if (president && material) drawPresidentFractures(ctx, material, radius, progress, .79);

 // Four patches of floor dust jump under the president's arms. The blade
 // lifts a single travelling wake through the dust at Omega's feet.
 const direction = stationAbility.targetX > x ? 1 : -1;
 for (let i = 0; i < 4; i++) {
  const beat = Math.max(0, (progress - i * .07) / (1 - i * .07));
  const angle = president ? .54 + i * Math.PI / 2 : -2.7 + beat * 3.5 - i * .28;
  const distance = president ? .38 + beat * .39 : .78 - i * .10;
  drawRasterPlume(ctx, objects?.['v100-dust'], {
   x: Math.cos(angle) * radius * distance * (president ? 1 : direction),
   y: Math.sin(angle) * depth * distance,
   width: radius * (president ? .30 + .27 * beat : .63 - .06 * i),
   height: depth * (president ? .15 + .18 * beat : .24 - .03 * i),
   alpha: .16 + .30 * beat, rotation: president ? .08 * Math.sin(angle) : direction * .24 * Math.cos(angle),
   flip: i % 2 === 1,
  });
 }
 ctx.restore();
}

// Ground releases and warnings are painted before actors and health.
// Their clocks are read from the real active phase; no new event or hit is made.
export function drawV100BossReleaseFields(ctx,objects,world,viewport={}){
 if(!world?.definition?.missionConfig?.v100StageNumber||!Array.isArray(world.fighters))return 0;
 const {viewportWidth,viewportHeight,worldScale}=viewport;
 if(![viewportWidth,viewportHeight,worldScale].every(Number.isFinite)
  ||viewportWidth<=0||viewportHeight<=0||worldScale<=0)return 0;
 let drawn=0;
 for(const f of world.fighters){
  const tuning=BOSS_ANOMALY_TUNING[f.kind];
  if(!RELEASES[f.kind]||!tuning||!f.combatReady||!(f.hp>0))continue;
  if(f.stationAbility?.phase==='warning'){
   const radius=bossGroundWarningRadius(f.kind);
   if(radius && f.side==='zombie' && !f.contained)drawGroundWarning(ctx,objects,f,radius);
   continue;
  }
  if(f.stationAbility?.phase!=='active')continue;
  const elapsed=tuning.activeSeconds-f.stationAbility.remainingSeconds;
  const material = bossFloorImage(objects, f.kind);
  if (material && elapsed >= 0 && elapsed < tuning.activeSeconds && Number.isFinite(f.x) && Number.isFinite(f.y)) {
   const radius = bossGroundWarningRadius(f.kind);
   const opacity = Math.min(1, (tuning.activeSeconds - elapsed) / .36);
   ctx.save();
   ctx.globalCompositeOperation = 'source-over';
   ctx.shadowBlur = 0;
   ctx.translate(f.x, f.y);
   ctx.globalAlpha = opacity;
   if (f.kind === 'takuya-omega') {
    drawBladeGouge(ctx, material, radius, f.stationAbility.targetX > f.x ? 1 : -1, elapsed);
   } else {
    drawPresidentFractures(ctx, material, radius, 1, opacity);
   }
   ctx.restore();
  }
  if(f.kind==='mother' && elapsed>=0 && elapsed<.42 && Number.isFinite(f.x) && Number.isFinite(f.y)
   && (objects?.['v102-ground-stains']?.naturalWidth || objects?.['v104-organic']?.naturalWidth)){
   const radius=bossGroundWarningRadius('mother');
   ctx.save();
   ctx.translate(f.x,f.y);
   ctx.beginPath();
   ctx.ellipse(0,0,radius,radius/BOSS_AREA_DEPTH_SCALE,0,0,Math.PI*2);
   ctx.clip();
   drawBroodSeepage(ctx,objects,radius,1,(1-elapsed/.42)**2);
   ctx.restore();
  }
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
