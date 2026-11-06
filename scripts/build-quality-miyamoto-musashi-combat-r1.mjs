// Musashi's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/miyamoto-musashi-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,p=([x,y])=>[x*width/mw,y*height/mh];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const near={shoulder:[706,370],elbow:[772,509],wrist:[822,570],grip:[851,594]};
const far={shoulder:[650,323],elbow:[777,385],wrist:[850,377],grip:[878,377]};
const definitions=[
 ['far-upper-arm','arm-1-upper',false,'under',[[603,295],[650,292],[697,318],[749,344],[796,362],[800,398],[764,415],[719,393],[670,367],[617,346]]],
 ['far-forearm','arm-1-lower',false,'model',[[772,350],[800,345],[838,343],[865,351],[868,379],[844,401],[808,419],[775,409],[756,385]]],
 ['far-sword-hand','weapon-1',false,'model',[[841,342],[871,328],[878,309],[910,312],[944,292],[1042,204],[1132,110],[1208,27],[1238,24],[1252,47],[1223,97],[1154,164],[1074,243],[985,312],[925,363],[916,388],[884,401],[849,412],[820,434],[799,419],[816,393],[837,382]]],
 ['far-thigh','leg-0-upper',true,'model',[[559,594],[630,611],[720,671],[809,735],[896,790],[969,846],[1018,918],[966,933],[912,926],[900,963],[849,978],[803,971],[762,924],[696,869],[633,810],[590,735],[539,665]]],
 ['far-shin','leg-0-lower',true,'model',[[795,893],[866,906],[884,943],[900,981],[924,1011],[943,1060],[917,1090],[863,1080],[834,1049],[812,1004],[791,958],[774,917]]],
 ['far-boot','leg-0-foot',true,'model',[[850,1024],[922,1030],[945,1058],[982,1087],[1024,1101],[1051,1124],[1065,1155],[1013,1173],[942,1166],[881,1153],[836,1140],[818,1116],[831,1071]]],
 ['near-thigh','leg-1-upper',true,'model',[[427,568],[500,582],[560,642],[550,736],[515,826],[481,888],[447,950],[398,979],[341,983],[306,959],[238,946],[174,910],[145,862],[177,795],[248,734],[333,659]]],
 ['near-shin','leg-1-lower',true,'model',[[191,904],[255,914],[298,934],[281,976],[252,1015],[233,1059],[214,1097],[162,1106],[141,1077],[157,1025],[174,970]]],
 ['near-boot','leg-1-foot',true,'model',[[149,1039],[218,1053],[240,1083],[235,1122],[215,1147],[152,1172],[97,1183],[54,1172],[48,1152],[75,1118],[111,1085]]],
 ['pelvis','pelvis',true,'model',[[412,470],[482,473],[555,495],[627,512],[677,557],[711,616],[732,666],[673,697],[598,697],[544,677],[493,656],[432,669],[389,632],[396,565]]],
 ['torso','spine',false,'under',[[465,210],[520,212],[565,240],[597,277],[649,267],[698,291],[731,323],[734,371],[710,412],[688,462],[696,498],[656,539],[597,542],[534,522],[486,506],[438,498],[405,478],[426,439],[440,390],[424,333],[428,273]]],
 ['head','head',false,'model',[[498,218],[500,164],[516,137],[512,100],[535,54],[576,28],[614,44],[644,88],[679,96],[710,109],[733,144],[759,175],[740,210],[724,250],[706,279],[664,293],[634,293],[603,320],[567,297],[549,263],[524,239]]],
 ['near-upper-arm','arm-0-upper',false,'model',[[659,278],[703,281],[743,310],[769,352],[794,399],[825,438],[861,481],[866,516],[825,548],[781,554],[743,530],[722,492],[700,455],[672,426],[648,395],[631,351],[634,311]]],
 ['near-forearm','arm-0-lower',false,'model',[[759,485],[793,483],[818,507],[838,533],[847,559],[839,586],[811,591],[779,564],[759,538],[750,509]]],
 ['near-sword-hand','weapon-0',false,'model',[[805,557],[842,548],[861,549],[869,532],[893,527],[915,536],[956,522],[1073,469],[1180,416],[1267,364],[1297,364],[1297,398],[1248,437],[1171,475],[1075,519],[982,560],[921,585],[913,614],[882,629],[838,629],[814,621],[781,641],[754,643],[745,623],[776,603],[805,596]]],
];
const bootPaint=await clip(model,definitions.find(d=>d[0]==='far-boot')[4]);
const registeredBoot=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+mw+'" height="'+mh+'"><image width="'+mw+'" height="'+mh+'" transform="translate(-708 27)" href="data:image/png;base64,'+bootPaint.toString('base64')+'"/></svg>')).png().toBuffer();
const rearBoot=definitions.find(d=>d[0]==='near-boot');rearBoot[3]='registeredBoot';rearBoot[4]=null;
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=source==='registeredBoot'?{paint:registeredBoot,matrix:[1,0,0,1,-708,27]}:null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(bytes).resize(width,height,{fit:'fill'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=p([554,535]),headRoot=p([600,283]);
const legs=[
 {hip:p([611,650]),knee:p([830,925]),ankle:p([888,1070]),toe:p([1010,1144]),offset:.5,center:274,paintedPaw:'far-boot'},
 {hip:p([448,650]),knee:p([235,934]),ankle:p([180,1097]),toe:p([302,1171]),offset:0,center:154,paintedPaw:'near-boot'},
].map(l=>({...l,groundAnkleY:l.ankle[1]}));
let soleY=0;
for(const leg of legs){
 const pixels=await sharp(`${dir}/${leg.paintedPaw}.png`).ensureAlpha().raw().toBuffer();
 let bottom=0;for(let i=0;i<width*height;i++)if(pixels[i*4+3]>=32)bottom=Math.max(bottom,Math.floor(i/width)+1);
 leg.paintedSoleY=bottom;soleY=Math.max(soleY,bottom);
}
for(const leg of legs)leg.groundAnkleY+=soleY-leg.paintedSoleY;
const arms=[near,far].map(a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,p(v)])));
const bones=[...new Set(parts.map(p=>p.bone))];
const at=(a,b,angle=0)=>{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,b[0]-c*a[0]+s*a[1],b[1]-s*a[0]-c*a[1]];};
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function chain(h,k,a,hip,target,side=1,strict=false){
 const A=Math.hypot(k[0]-h[0],k[1]-h[1]),B=Math.hypot(a[0]-k[0],a[1]-k[1]);
 const dx=target[0]-hip[0],dy=target[1]-hip[1],distance=Math.hypot(dx,dy);
 if(strict)assert.ok(distance<A+B&&distance>Math.abs(A-B),JSON.stringify({reason:'Fixed limb must reach its unmodified target',h,k,a,hip,target,distance,reach:A+B}));
 const len=Math.max(Math.abs(A-B)+.001,Math.min(A+B-.001,distance));
 const end=[hip[0]+dx/distance*len,hip[1]+dy/distance*len];
 const ux=dx/distance,uy=dy/distance,along=(A*A+len*len-B*B)/(2*len),rise=Math.sqrt(Math.max(0,A*A-along*along));
 const knee=[hip[0]+ux*along+uy*rise*side,hip[1]+uy*along-ux*rise*side];
 return{upper:at(h,hip,Math.atan2(knee[1]-hip[1],knee[0]-hip[0])-Math.atan2(k[1]-h[1],k[0]-h[0])),lower:at(k,knee,Math.atan2(end[1]-knee[1],end[0]-knee[0])-Math.atan2(a[1]-k[1],a[0]-k[0])),end};
}
const old=JSON.parse(await readFile('assets/source/v100/joints/miyamoto-musashi-r1/parts.json'));
const span=old.motion.walk.spanPx,stance=old.motion.walk.stanceFraction,lift=old.motion.walk.liftPx;
const landingDrop=Math.max(0,...legs.map(l=>{
 const reach=Math.hypot(l.knee[0]-l.hip[0],l.knee[1]-l.hip[1])+Math.hypot(l.ankle[0]-l.knee[0],l.ankle[1]-l.knee[1])-1.2;
 const dx=Math.abs(l.center-l.hip[0])+span*.5;
 return l.groundAnkleY-l.hip[1]-Math.sqrt(reach*reach-dx*dx)+2.2;
}));
const standingDrop=Math.max(0,...legs.map(l=>{
 const reach=Math.hypot(l.knee[0]-l.hip[0],l.knee[1]-l.hip[1])+Math.hypot(l.ankle[0]-l.knee[0],l.ankle[1]-l.knee[1])-.6;
 return l.groundAnkleY-l.hip[1]-Math.sqrt(reach*reach-(l.center-l.hip[0])**2);
}));
const attack={...old.rig.attack,windupEnd:.28,activeEnd:.55};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function evaluate(phase,settle,firing=false){
 const walk=firing?0:1-settle,swing=Math.sin(phase*Math.PI*2)*walk,bob=standingDrop+(landingDrop-standingDrop-1.1*(1-Math.cos(phase*4*Math.PI)))*walk;
 const amount=!firing?0:phase<.28?smooth(phase/.28):phase<.7?1:1-smooth((phase-.7)/.3);
 const cut=firing?(phase<.28?-smooth(phase/.28):phase<.55?-1+2*smooth((phase-.28)/.27):1-smooth((phase-.55)/.45)):0;
 const deform=Object.fromEntries(bones.map(b=>[b,[1,0,0,1,0,0]]));
 // Runtime adds the currently settled lower-body offset to attack uppers.
 // Author attack uppers at the neutral waist so this offset is applied once.
 deform.pelvis=at(waist,[waist[0],waist[1]+bob]);deform.spine=at(waist,[waist[0],waist[1]+(firing?0:bob)],.008*swing);
 deform.head=at(headRoot,point(deform.spine,headRoot),.006*swing);
 for(const[i,l]of legs.entries()){
  const q=(phase+l.offset)%1,t=Math.max(0,(q-stance)/(1-stance));
  const target=[l.center+span*(q>stance?-.5+smooth(t):.5-q/stance)*walk,l.groundAnkleY-(q>stance?lift*Math.sin(Math.PI*t)*walk:0)];
  const m=chain(l.hip,l.knee,l.ankle,point(deform.pelvis,l.hip),target,1,true);
  deform[`leg-${i}-upper`]=m.upper;deform[`leg-${i}-lower`]=m.lower;deform[`leg-${i}-foot`]=at(l.ankle,m.end,q>stance?-.10*Math.sin(Math.PI*t)*walk:0);
 }
 for(const[i,a]of arms.entries()){
  const rotation=(i===0?.85:-.7)*cut-.012*swing;
  deform['weapon-'+i]=multiply(deform.spine,at(a.grip,[a.grip[0]-(i===0?12:18)+2*swing,a.grip[1]-(i===0?8:-8)-4*amount],rotation));
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform['weapon-'+i],a.wrist),-1,true);
  deform['arm-'+i+'-upper']=m.upper;deform['arm-'+i+'-lower']=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'miyamoto-musashi',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',atlasPartPadding:3,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/musashi-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/musashi-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip,'weapon-1':arms[1].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([1256,393]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([585,320])],head:[headRoot,p([660,165])],legs,arms,firearm:false,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([1256,393]),armIndex:0},{name:'weapon-1',a:arms[1].grip,b:p([1212,66]),armIndex:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-'+i,...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenBody:'Source-bound chest, belt and coat underpainting beneath moving arms and blade',weapon:'Each sword and its gripping hand share their own independent weapon transform',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'miyamoto-musashi',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/miyamoto-musashi-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-miyamoto-musashi-combat-r1.mjs',description:'Complete Musashi body from current generated master with hidden-cloth underpainting; each sword has its own hand and transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityMusashiCombatJointData.js','// Generated complete MUSASHI combat paint and deterministic 2D kinematics.\nexport const QUALITY_MUSASHI_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
