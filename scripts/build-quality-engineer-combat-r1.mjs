// Monkey's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/engineer-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,p=([x,y])=>[x*width/mw,y*height/mh];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const sleeve=[[511,254],[551,231],[578,253],[580,299],[569,351],[558,393],[548,425],[511,459],[476,461],[452,432],[451,402],[475,346],[494,288]];
const forearm=[[518,395],[544,393],[567,416],[590,433],[610,443],[600,474],[574,473],[545,464],[519,457],[498,440],[502,413]];
const near={shoulder:[538,291],elbow:[513,428],wrist:[596,456],grip:[650,493]};
const far={shoulder:[774,311],elbow:[803,486],wrist:[813,558],grip:[833,583]};
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
const boot=[[601,1066],[666,1060],[675,1105],[695,1135],[718,1170],[717,1207],[668,1210],[600,1198],[576,1180],[578,1148],[590,1100]];
const farBoot=await register(boot,[642,1092],[680,1188],[715,1090],[753,1186]);
const definitions=[
 ['far-upper-arm','arm-1-upper',false,'farSleeve',null],
 ['far-forearm','arm-1-lower',false,'farForearm',null],
 ['far-thigh','leg-0-upper',true,'model',[[646,556],[732,561],[756,624],[770,699],[783,774],[792,845],[778,898],[728,913],[704,883],[699,826],[681,751],[658,665]]],
 ['far-shin','leg-0-lower',true,'model',[[724,849],[778,852],[787,903],[769,958],[763,1010],[755,1067],[739,1095],[691,1098],[678,1068],[686,1003],[704,930]]],
 ['far-boot','leg-0-foot',true,'farBoot',null],
 ['near-thigh','leg-1-upper',true,'model',[[557,554],[642,555],[709,609],[731,681],[745,747],[751,803],[732,876],[691,900],[651,888],[624,842],[615,788],[589,730],[554,662],[540,606]]],
 ['near-shin','leg-1-lower',true,'model',[[625,835],[707,837],[727,897],[705,963],[693,1025],[687,1066],[662,1095],[605,1099],[588,1077],[583,1026],[587,963],[604,895]]],
 ['near-boot','leg-1-foot',true,'model',boot],
 ['pelvis','pelvis',true,'under',[[550,511],[750,509],[762,574],[753,620],[715,648],[638,655],[578,636],[545,586]]],
 ['torso','spine',false,'under',[[594,205],[648,206],[707,234],[748,224],[783,250],[803,285],[797,329],[784,374],[771,414],[760,473],[755,526],[688,532],[615,522],[553,535],[527,504],[531,453],[551,398],[566,355],[561,313],[543,273],[561,243]]],
 ['head','head',false,'model',[[591,211],[579,171],[583,111],[591,55],[623,29],[675,18],[728,22],[775,46],[793,89],[793,125],[780,156],[759,180],[747,203],[714,220],[697,253],[674,268],[649,248],[641,211],[610,210]]],
 ['near-upper-arm','arm-0-upper',false,'model',sleeve],
 ['near-forearm','arm-0-lower',false,'model',forearm],
 ['weapon-and-hands','weapon-0',false,'model',[[595,437],[632,438],[669,449],[690,464],[725,474],[785,504],[828,512],[874,518],[949,524],[964,516],[985,527],[993,552],[984,583],[976,606],[987,618],[980,639],[951,640],[922,626],[876,631],[838,641],[810,630],[792,612],[793,593],[769,568],[720,543],[687,529],[655,532],[630,522],[603,510],[587,484],[577,462]]],
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
const waist=[235,203],headRoot=p([674,244]);
const legs=[
 {hip:p([698,610]),knee:p([751,859]),ankle:p([715,1090]),toe:p([753,1186]),offset:.5,paintedPaw:'far-boot'},
 {hip:p([625,610]),knee:p([681,845]),ankle:p([642,1092]),toe:p([680,1188]),offset:0,paintedPaw:'near-boot'},
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
const old=JSON.parse(await readFile('assets/source/v100/joints/engineer-r1/parts.json'));
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
const attack={...old.rig.attack,aimAngle:-Math.atan2(612-480,974-650)};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function evaluate(phase,settle,firing=false){
 const walk=firing?0:1-settle,swing=Math.sin(phase*Math.PI*2)*walk,bob=standingDrop+(landingDrop-standingDrop-1.1*(1-Math.cos(phase*4*Math.PI)))*walk;
 const amount=!firing?0:phase<.28?smooth(phase/.28):phase<.7?1:1-smooth((phase-.7)/.3);
 const recoil=firing&&phase>=.28&&phase<=.41?attack.recoilPx*Math.sin(Math.PI*(phase-.28)/.13):0;
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
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'engineer',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/monkey-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/monkey-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([974,612]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([660,300])],head:[headRoot,p([699,125])],legs,arms,firearm:true,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([974,612]),armIndex:0,supportArm:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-0',...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenArms:'Own near jacket sleeve and forearm registered once onto occluded far anatomy',hiddenBoot:'Own complete near boot translated to far ankle, retaining the toe occluded by the near boot',weapon:'Both hands and complete crossbow share one transform',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'engineer',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/engineer-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-engineer-combat-r1.mjs',description:'Complete Monkey body from adopted master-r4 with hidden-cloth underpainting; both hands share crossbow transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityEngineerCombatJointData.js','// Generated complete Monkey combat paint and deterministic 2D kinematics.\nexport const QUALITY_ENGINEER_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
