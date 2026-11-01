// Zakimiya's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/zakimiya-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,p=([x,y])=>[x*width/mw,y*height/mh];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const near={shoulder:[501,249],elbow:[398,442],wrist:[367,550],grip:[389,593]};
const far={shoulder:[791,304],elbow:[852,498],wrist:[938,585],grip:[960,624]};
const definitions=[
 ['far-upper-arm','arm-1-upper',false,'model',[[767,253],[814,271],[831,326],[849,375],[871,415],[907,462],[912,504],[885,541],[847,548],[820,514],[800,466],[772,421],[754,355],[747,299]]],
 ['far-forearm','arm-1-lower',false,'model',[[837,488],[881,476],[907,511],[929,544],[955,565],[963,594],[938,612],[913,588],[885,568],[849,546],[826,518]]],
 ['far-thigh','leg-0-upper',true,'under',[[678,604],[738,586],[800,623],[851,651],[888,723],[913,786],[922,859],[888,899],[826,900],[790,864],[761,817],[727,777],[693,733],[665,683]]],
 ['far-shin','leg-0-lower',true,'under',[[805,817],[893,810],[924,849],[923,908],[944,960],[962,1006],[953,1038],[874,1054],[852,1002],[833,955],[801,908],[787,863]]],
 ['far-boot','leg-0-foot',true,'model',[[857,1006],[947,997],[970,1038],[977,1071],[990,1096],[1020,1119],[1067,1130],[1089,1162],[1084,1192],[998,1202],[896,1185],[863,1180],[861,1148],[874,1106],[865,1057]]],
 ['near-thigh','leg-1-upper',true,'under',[[511,568],[589,566],[656,608],[659,672],[630,726],[603,777],[590,828],[572,867],[523,890],[467,872],[437,830],[456,777],[471,718],[478,657]]],
 ['near-shin','leg-1-lower',true,'model',[[462,795],[529,818],[570,861],[541,911],[504,949],[466,998],[439,1036],[394,1037],[349,1010],[356,978],[392,934],[420,873],[435,828]]],
 ['near-boot','leg-1-foot',true,'model',[[355,999],[427,1018],[441,1057],[423,1103],[427,1135],[456,1168],[468,1208],[401,1211],[331,1201],[302,1175],[303,1133],[324,1081],[337,1034]]],
 ['pelvis','pelvis',true,'under',[[488,513],[597,506],[706,505],[778,503],[817,532],[832,597],[807,657],[770,691],[718,706],[656,700],[597,678],[533,690],[473,721],[436,677],[454,607]]],
 ['torso','spine',false,'under',[[584,160],[632,168],[647,207],[703,225],[741,210],[783,239],[813,284],[824,336],[817,397],[781,428],[783,483],[808,530],[762,549],[703,533],[647,533],[588,529],[528,546],[481,563],[446,533],[462,489],[488,430],[506,375],[478,348],[458,318],[456,279],[475,235],[523,203],[555,192]]],
 ['head','head',false,'model',[[624,178],[617,126],[619,71],[661,27],[716,10],[779,22],[822,55],[822,96],[803,131],[801,160],[781,192],[751,214],[720,225],[681,242],[648,231],[631,210]]],
 ['near-upper-arm','arm-0-upper',false,'model',[[468,210],[507,198],[546,226],[552,272],[527,319],[497,352],[475,392],[449,441],[422,470],[379,461],[351,438],[359,400],[376,360],[399,322],[420,274],[444,236]]],
 ['near-forearm','arm-0-lower',false,'model',[[368,425],[416,423],[434,450],[416,479],[407,515],[401,554],[383,577],[350,574],[336,551],[343,517],[350,481],[356,452]]],
 ['free-hand','arm-1-hand',false,'model',[[917,573],[950,568],[974,588],[997,607],[1003,635],[992,660],[969,681],[940,677],[936,659],[953,642],[940,643],[930,628],[924,605]]],
 ['weapon-and-hands','weapon-0',false,'model',[[338,537],[373,538],[395,555],[412,584],[440,592],[466,617],[494,653],[514,674],[510,702],[481,719],[449,710],[419,680],[396,649],[379,624],[352,625],[336,610],[320,640],[314,682],[304,689],[292,658],[296,608],[304,567]]],
];
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(bytes).resize(width,height,{fit:'fill'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=p([643,548]),headRoot=p([676,220]);
const legs=[
 {hip:p([738,649]),knee:p([851,849]),ankle:p([920,1082]),toe:p([1054,1160]),offset:.5,center:280,paintedPaw:'far-boot'},
 {hip:p([560,646]),knee:p([498,847]),ankle:p([381,1091]),toe:p([422,1170]),offset:0,center:215,paintedPaw:'near-boot'},
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
const old=JSON.parse(await readFile('assets/source/v100/joints/zakimiya-r1/parts.json'));
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
 const grip=arms[0].grip;
 deform['weapon-0']=multiply(deform.spine,at(grip,[grip[0]+8*swing+4*cut,grip[1]-16-2*Math.abs(swing)-8*amount],-.04*swing+.8*cut));
 deform['arm-1-hand']=multiply(deform.spine,at(arms[1].wrist,[arms[1].wrist[0]-10*swing,arms[1].wrist[1]-6-Math.abs(swing)-8*amount],.04*swing));
 for(const[i,a]of arms.entries()){
  const effector=i===0?'weapon-0':'arm-1-hand';
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform[effector],a.wrist),i===0?-1:1,true);
  deform[`arm-${i}-upper`]=m.upper;deform[`arm-${i}-lower`]=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'zakimiya',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',atlasPartPadding:3,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/zakimiya-canonical-master-r1.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/zakimiya-canonical-master-r1.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([489,681]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([657,304])],head:[headRoot,p([743,116])],legs,arms,firearm:false,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([489,681]),armIndex:0}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:i===0?'weapon-0':'arm-1-hand',...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenBody:'Source-bound jacket, shirt and belt underpainting beneath both moving arms',weapon:'Holding hand and complete whisky bottle share one transform; free hand moves independently',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'zakimiya',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/zakimiya-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-zakimiya-combat-r1.mjs',description:'Complete Zakimiya body from canonical face and costume master; held bottle stays with its gripping hand, free hand has independent motion. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityZakimiyaCombatJointData.js','// Generated complete Zakimiya combat paint and deterministic 2D kinematics.\nexport const QUALITY_ZAKIMIYA_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
