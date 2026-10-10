// R9 physical sounds are composite recordings/filtered noise, not UI tones.
// Bake layers into one cue so skip, hide and route changes cancel all of it.
const rpg = name => `kenney-rpg/${name}.ogg`;
const impact = name => `kenney-impact/${name}.ogg`;
const layer = (file,gain,delay=0,rate=1) => ({file,gain,delay,rate});
const noise = (color,gain,cutoff,start=.02,end=.12) => ({color,gain,cutoff,start,end});
export const V100_R9_SOUND_RECIPES = Object.freeze({
 'chair-scrape':{duration:1.1,layers:[layer(impact('impactWood_heavy_000'),.55),layer(rpg('cloth2'),.35,130,.75)],noise:noise('pink',.12,2400,.03,.45)},
 'extinguisher':{duration:2.6,layers:[layer(rpg('metalLatch'),.4)],noise:noise('white',.55,6800,.08,.35)},
 'cargo-door':{duration:1.25,layers:[layer(rpg('doorClose_1'),.5),layer(impact('impactMetal_heavy_000'),.3,260,.8)]},
 'shutter-open':{duration:2.4,layers:[layer(rpg('metalLatch'),.35),layer(impact('impactMetal_light_000'),.22,420,.85),layer(impact('impactMetal_medium_000'),.3,1940,.8)],noise:noise('brown',.8,1700,.18,.3)},
 'shutter-jam':{duration:1.5,layers:[layer(impact('impactMetal_heavy_000'),.4,700,.75),layer(rpg('metalLatch'),.32,810)],noise:noise('brown',.6,2000,.08,.55)},
 'cable-disconnect':{duration:.7,layers:[layer(rpg('cloth3'),.45),layer(rpg('metalLatch'),.27,160,1.18)]},
 'glass-knock':{duration:.95,layers:[layer(impact('impactGlass_heavy_000'),.26,0,.85),layer(impact('impactGlass_heavy_000'),.22,320,.9)]},
 'ceiling-fall':{duration:1.8,layers:[layer(impact('impactWood_heavy_000'),.5,0,.7),layer(impact('impactMetal_medium_000'),.4,180,.7),layer(impact('impactSoft_heavy_000'),.45,600,.8)],noise:noise('pink',.18,3600,.02,.7)},
 'oxygen-valve':{duration:2.3,layers:[layer(rpg('metalLatch'),.35),layer(rpg('metalPot2'),.15,280,.7)],noise:noise('pink',.48,4600,.24,.65)},
 'rail-strain':{duration:1.7,layers:[layer(rpg('metalPot2'),.35,0,.65),layer(impact('impactMetal_heavy_000'),.32,660,.7)],noise:noise('brown',.65,1600,.12,.4)},
 'coupler-release':{duration:1.3,layers:[layer(rpg('metalLatch'),.5),layer(impact('impactMetal_medium_000'),.35,230,.8),layer(impact('impactMetal_light_000'),.2,600)]},
 'barrier-raise':{duration:1.6,layers:[layer(rpg('metalLatch'),.35),layer(impact('impactMetal_light_000'),.25,1110,.8)],noise:noise('brown',.6,1400,.15,.3)},
 'engine-pass':{duration:3.1,layers:[layer(impact('impactGeneric_light_000'),.16,500,.6)],noise:noise('brown',1.5,1100,.35,.8)},
 'vehicle-collision':{duration:1.45,layers:[layer(impact('impactMetal_heavy_000'),.58,0,.7),layer(impact('impactMetal_medium_000'),.32,130,.8)],noise:noise('pink',.2,2600,.02,.65)},
 'door-battering':{duration:1.55,layers:[layer(impact('impactMetal_heavy_000'),.43,0,.75),layer(impact('impactMetal_heavy_000'),.37,620,.7),layer(rpg('metalLatch'),.25,780,.8)]},
 'card-burnout':{duration:1.25,layers:[layer(impact('impactGeneric_light_000'),.22,80,1.3),layer(rpg('bookFlip2'),.18,400,1.4)],noise:noise('white',.22,5200,.02,.8)},
 'weapon-handle':{duration:.8,layers:[layer(rpg('metalLatch'),.36),layer(rpg('cloth4'),.3,160)]},
 'sample-lids':{duration:1.5,layers:[layer(impact('impactMetal_light_000'),.24),layer(impact('impactMetal_light_000'),.22,400,1.08),layer(impact('impactMetal_light_000'),.24,860,.94),layer(rpg('cloth3'),.2,100)]},
 'case-close':{duration:1.1,layers:[layer(rpg('bookClose'),.35,0,.8),layer(rpg('metalLatch'),.4,320),layer(rpg('metalLatch'),.35,600,1.06)]},
 'fire-catch':{duration:2.4,layers:[layer(rpg('bookFlip2'),.25,0,1.25)],noise:noise('pink',.45,4500,.12,.45)},
 'gas-ignition':{duration:1.7,layers:[layer(rpg('metalLatch'),.25,0,1.4),layer(impact('impactGeneric_light_000'),.2,180,1.3)],noise:noise('white',.22,3900,.25,.75)},
 'plate-stack':{duration:1.2,layers:[layer(rpg('metalPot1'),.22,0,1.2),layer(rpg('metalPot1'),.18,420,1.28)]},
 'lab-air':{duration:24,loop:true,layers:[],noise:noise('brown',.25,720,.12,.12)},
 'bridge-wind':{duration:24,loop:true,layers:[],noise:noise('pink',.13,1700,.12,.12)},
 'vehicle-idle':{duration:24,loop:true,layers:[layer(rpg('cloth2'),.05,8200,.7),layer(impact('impactMetal_light_000'),.035,17200,.75)],noise:noise('brown',.5,480,.12,.12)},
 'kitchen-air':{duration:24,loop:true,layers:[layer(rpg('metalPot1'),.07,6100,1.2),layer(rpg('cloth2'),.07,14700)],noise:noise('pink',.1,1350,.12,.12)},
});

export const V100_R9_AUDIO_SCENES = Object.freeze([
 {id:'s01-rescue',base:'v100-score-s01-post',role:'relief',air:'vehicle-idle'},
 {id:'s06-old-message',base:'v100-score-s06-pre',role:'loss',air:'lab-air'},
 {id:'s09-transfer',base:'v100-score-s09-post',role:'horror',air:'lab-air'},
 {id:'s11-oxygen',base:'v100-score-s11-pre',role:'tension',air:'lab-air'},
 {id:'s14-couplers',base:'v100-score-s14-pre',role:'tension',air:'bridge-wind'},
 {id:'s17-reunion',base:'v100-score-s17-post',role:'relief',air:'bridge-wind'},
 {id:'s19-crossing',base:'v100-score-s19-post',role:'tension',air:'bridge-wind'},
 {id:'s20-meal',base:'v100-score-s20-post',role:'daily',air:'bridge-wind'},
 {id:'s22-family',base:'v100-score-s22-post',role:'relief',air:'lab-air'},
 {id:'s23-confession',base:'v100-score-s23-pre',role:'loss',air:'lab-air'},
 {id:'s23-send',base:'v100-score-s23-pre',role:'tension',air:'lab-air'},
 {id:'s27-recording',base:'v100-score-s27-post',role:'horror',air:'lab-air'},
 {id:'s28-controls',base:'v100-score-s28-pre',role:'tension',air:'lab-air'},
 {id:'s30-farewell',base:'v100-score-s30-post',role:'loss',air:'bridge-wind'},
 {id:'ending-treatment',base:'v100-ending-hospital',role:'relief',air:'lab-air'},
 {id:'ending-trust',base:'v100-ending-kumaya',role:'loss',air:'kitchen-air'},
 {id:'ending-meal',base:'v100-ending-kumaya',role:'ending',air:'kitchen-air'},
]);
export function withV100R9SoundDesign(base) {
 const assets=Object.entries(V100_R9_SOUND_RECIPES).map(([name,recipe])=>({
  id:`v100-r9-${name}`,category:recipe.loop?'ambience':'melee',loop:recipe.loop??false,
  sources:['mp3','ogg'].map(ext=>({src:`/audio/v100/r9/${name}.${ext}`,type:ext==='mp3'?'audio/mpeg':'audio/ogg'})),
  gain:recipe.loop?.55:.72,preload:'lazy',priority:recipe.loop?30:54,cooldownMs:120,maxInstances:1,
 }));
 const scenes=V100_R9_AUDIO_SCENES.map(scene=>{
  const original=base.scenes.find(item=>item.id===scene.base);
  if(!original)throw new Error(`Missing R9 sound scene source: ${scene.base}`);
  return {...original,id:`v100-r9-${scene.id}`,bgm:`music-v100-score-${scene.role}`,ambience:[`v100-r9-${scene.air}`],preload:[],crossfadeMs:1400};
 });
 return {...base,assets:[...base.assets,...assets],scenes:[...base.scenes,...scenes]};
}
