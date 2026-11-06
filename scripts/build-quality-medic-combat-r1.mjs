// Nao's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/medic-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,p=([x,y])=>[x*width/mw,y*height/mh];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const sleeve=[[573,237],[607,229],[641,248],[638,294],[620,350],[608,399],[582,434],[551,464],[526,453],[506,420],[519,375],[536,315],[546,272]];
const forearm=[[566,411],[600,418],[644,438],[685,447],[687,476],[656,477],[616,467],[580,466],[554,458],[553,435]];
const near={shoulder:[592,280],elbow:[555,436],wrist:[674,462],grip:[711,474]};
const far={shoulder:[740,282],elbow:[759,430],wrist:[811,502],grip:[834,508]};
// Occluded limbs use this same jacket/skin registered once to their far-side joints.
// No runtime limb stretch and no unrelated character paint.
async function register(poly,a,b,c,d){
 const angle=Math.atan2(d[1]-c[1],d[0]-c[0])-Math.atan2(b[1]-a[1],b[0]-a[0]);
 const scale=Math.hypot(d[0]-c[0],d[1]-c[1])/Math.hypot(b[0]-a[0],b[1]-a[1]);
 const co=Math.cos(angle)*scale,si=Math.sin(angle)*scale;
 const matrix=[co,si,-si,co,c[0]-co*a[0]+si*a[1],c[1]-si*a[0]-co*a[1]];
 const bytes=await clip(model,poly);
 const paint=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><image width="${mw}" height="${mh}" transform="matrix(${matrix.join(' ')})" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>`)).png().toBuffer();
 return{paint,matrix};
}
const farSleeve=await register(sleeve,near.shoulder,near.elbow,far.shoulder,far.elbow);
const farForearm=await register(forearm,near.elbow,near.wrist,far.elbow,far.wrist);
const boot=[[671,1052],[730,1051],[744,1089],[754,1121],[790,1140],[822,1143],[837,1186],[795,1203],[726,1205],[666,1192],[670,1150],[660,1102]];
const farBoot=await register(boot,[704,1069],[800,1178],[625,1070],[721,1179]);
const definitions=[
 ['far-upper-arm','arm-1-upper',false,'farSleeve',null],
 ['far-forearm','arm-1-lower',false,'farForearm',null],
 ['far-thigh','leg-0-upper',true,'model',[[609,545],[696,547],[730,626],[715,726],[678,811],[654,870],[612,866],[599,814],[593,723],[585,635]]],
 ['far-shin','leg-0-lower',true,'model',[[616,811],[683,813],[691,870],[670,963],[665,1032],[645,1076],[595,1076],[593,1037],[594,972],[606,913]]],
 ['far-boot','leg-0-foot',true,'farBoot',null],
 ['near-thigh','leg-1-upper',true,'model',[[626,538],[717,535],[752,589],[752,681],[762,735],[781,802],[774,850],[727,881],[682,851],[661,794],[634,727],[607,655]]],
 ['near-shin','leg-1-lower',true,'model',[[692,793],[767,798],[779,842],[746,928],[740,990],[734,1047],[717,1078],[677,1078],[661,1041],[659,980],[664,910],[675,851]]],
 ['near-boot','leg-1-foot',true,'model',boot],
 ['pelvis','pelvis',true,'under',[[615,488],[756,493],[787,568],[785,706],[753,710],[719,654],[650,665],[589,626],[586,564]]],
 ['torso','spine',false,'under',[[615,186],[672,196],[710,219],[741,224],[775,289],[795,329],[783,363],[796,441],[791,512],[738,523],[677,505],[623,518],[548,498],[571,453],[590,399],[604,339],[595,291],[571,257],[587,230]]],
 ['bag-straps','spine',false,'under',[[533,412],[545,424],[514,467],[475,526],[451,546],[433,546],[463,503],[498,455]]],
 ['medical-bag','spine',false,'model',[[446,524],[493,520],[547,533],[596,552],[618,585],[613,642],[601,706],[584,767],[572,818],[542,843],[486,850],[435,832],[388,805],[353,775],[344,746],[358,682],[396,587]]],
 ['head','head',false,'model',[[428,351],[417,286],[457,243],[496,219],[543,175],[565,136],[573,75],[611,20],[663,12],[700,44],[757,54],[792,108],[798,154],[768,191],[737,228],[696,228],[652,207],[650,182],[616,174],[580,226],[535,259],[496,282],[493,328],[470,349]]],
 ['near-upper-arm','arm-0-upper',false,'model',sleeve],
 ['near-forearm','arm-0-lower',false,'model',forearm],
 ['weapon-and-hands','weapon-0',false,'model',[[621,344],[703,383],[731,393],[777,386],[785,378],[818,384],[852,410],[850,434],[898,465],[949,504],[951,539],[897,519],[863,513],[856,531],[823,535],[797,518],[782,555],[746,548],[742,506],[724,494],[715,502],[684,499],[658,478],[653,449],[674,443],[687,448],[695,423],[642,402],[603,419],[596,405]]],
];
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=source==='farSleeve'?farSleeve:source==='farForearm'?farForearm:source==='farBoot'?farBoot:null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(bytes).resize(width,height,{fit:'fill'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=[240,193],headRoot=p([665,207]);
const legs=[
 {hip:p([638,565]),knee:p([645,843]),ankle:p([625,1070]),toe:p([678,1174]),offset:.5,paintedPaw:'far-boot'},
 {hip:p([688,565]),knee:p([725,829]),ankle:p([704,1069]),toe:p([800,1178]),offset:0,paintedPaw:'near-boot'},
].map(l=>({...l,center:l.ankle[0],groundAnkleY:l.ankle[1]}));
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
const old=JSON.parse(await readFile('assets/source/v100/joints/medic-r1/parts.json'));
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
const attack={...old.rig.attack,aimAngle:-Math.atan2(519-387,941-691)};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function evaluate(phase,settle,firing=false){
 const walk=firing?0:1-settle,swing=Math.sin(phase*Math.PI*2)*walk,bob=standingDrop+(landingDrop-standingDrop-1.1*(1-Math.cos(phase*4*Math.PI)))*walk;
 const amount=!firing?0:phase<.28?smooth(phase/.28):phase<.7?1:1-smooth((phase-.7)/.3);
 const recoil=firing&&phase>=.28&&phase<=.41?3*Math.sin(Math.PI*(phase-.28)/.13):0;
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
 deform['weapon-0']=multiply(deform.spine,at(grip,[grip[0]+2*swing+attack.aimShift[0]*amount-recoil,grip[1]-.5*Math.abs(swing)+attack.aimShift[1]*amount],-.012*swing+attack.aimAngle*amount));
 for(const[i,a]of arms.entries()){
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform['weapon-0'],a.wrist),-1,true);
  deform[`arm-${i}-upper`]=m.upper;deform[`arm-${i}-lower`]=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'medic',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/nao-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/nao-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([939,521]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[240,173]],spine:[waist,p([670,285])],head:[headRoot,p([703,130])],legs,arms,firearm:true,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([939,521]),armIndex:0,supportArm:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-0',...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenArms:'Own near jacket sleeve and forearm registered once onto occluded far anatomy',hiddenBoot:'Own complete near boot translated to far ankle, retaining the toe occluded by the near boot',weapon:'Both hands and complete carbine share one transform',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'medic',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/medic-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-medic-combat-r1.mjs',description:'Complete Nao body from adopted master-r4 with hidden-cloth underpainting; both hands share firearm transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityMedicCombatJointData.js','// Generated complete Nao combat paint and deterministic 2D kinematics.\nexport const QUALITY_MEDIC_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
