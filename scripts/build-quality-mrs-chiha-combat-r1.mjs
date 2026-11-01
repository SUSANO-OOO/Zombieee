// Chiha's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/mrs-chiha-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,p=([x,y])=>[x*width/mw,y*height/mh];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const sleeve=[[445,213],[484,205],[514,235],[510,276],[482,323],[454,357],[439,391],[419,416],[390,419],[366,400],[367,373],[385,329],[408,279],[426,237]];
const forearm=[[383,368],[420,364],[455,378],[491,384],[525,390],[551,404],[553,441],[525,466],[494,454],[456,443],[416,430],[382,413],[365,397]];
const near={shoulder:[465,255],elbow:[409,390],wrist:[549,426],grip:[595,438]};
const far={shoulder:[685,292],elbow:[780,455],wrist:[911,522],grip:[929,522]};
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
const definitions=[
 ['far-upper-arm','arm-1-upper',false,'farSleeve',null],
 ['far-forearm','arm-1-lower',false,'farForearm',null],
 ['coat-far','coat-far',false,'under',[[617,543],[667,552],[695,639],[697,736],[705,823],[710,909],[722,1008],[692,1020],[645,983],[600,956],[536,951],[534,914],[555,863],[568,781],[588,671]]],
 ['coat-near','coat-near',false,'under',[[451,491],[499,481],[537,509],[550,557],[525,633],[493,708],[461,783],[424,860],[386,899],[348,918],[312,939],[262,972],[233,1011],[205,1020],[180,992],[149,955],[129,896],[119,866],[189,814],[261,753],[335,675],[395,588]]],
 ['far-thigh','leg-0-upper',true,'model',[[585,546],[647,525],[711,552],[742,617],[781,671],[812,718],[832,765],[823,811],[792,842],[753,839],[715,809],[676,769],[637,725],[593,677],[562,618]]],
 ['far-shin','leg-0-lower',true,'model',[[745,758],[807,756],[830,794],[831,853],[847,912],[866,963],[874,1001],[847,1030],[792,1033],[775,999],[775,954],[760,897],[738,846],[730,802]]],
 ['far-boot','leg-0-foot',true,'model',[[787,993],[867,984],[891,1016],[889,1055],[913,1093],[952,1117],[967,1144],[960,1174],[890,1173],[836,1150],[814,1146],[804,1164],[783,1158],[782,1105],[786,1064]]],
 ['near-thigh','leg-1-upper',true,'under',[[479,538],[536,535],[596,562],[614,597],[587,659],[563,717],[533,765],[501,812],[468,840],[424,824],[411,790],[431,747],[446,694],[458,632]]],
 ['near-shin','leg-1-lower',true,'model',[[431,770],[487,779],[513,810],[493,860],[453,913],[409,975],[386,1017],[344,1040],[308,1016],[319,976],[345,922],[374,858],[402,809]]],
 ['near-boot','leg-1-foot',true,'model',[[310,999],[384,1012],[385,1053],[375,1087],[400,1132],[440,1154],[449,1186],[441,1211],[365,1207],[321,1188],[307,1177],[305,1192],[281,1190],[277,1131],[287,1091],[295,1050]]],
 ['pelvis','pelvis',true,'under',[[478,456],[562,445],[655,448],[701,461],[727,541],[740,604],[697,652],[634,652],[591,624],[539,632],[490,614],[455,576]]],
 ['torso','spine',false,'under',[[510,179],[553,174],[590,189],[633,181],[660,203],[689,223],[707,261],[718,314],[713,351],[699,400],[698,444],[709,476],[660,493],[599,488],[538,474],[487,500],[452,516],[485,462],[518,410],[509,371],[472,353],[448,320],[435,273],[441,231],[471,210]]],
 ['head','head',false,'model',[[480,170],[465,136],[469,101],[488,61],[522,33],[563,10],[616,8],[656,35],[679,66],[683,102],[669,138],[668,164],[646,188],[615,201],[591,214],[551,201],[526,188],[494,188]]],
 ['near-upper-arm','arm-0-upper',false,'model',sleeve],
 ['near-forearm','arm-0-lower',false,'model',forearm],
 ['weapon-and-hands','weapon-0',false,'model',[[541,358],[580,354],[591,337],[660,340],[713,346],[761,358],[795,338],[800,325],[847,326],[896,339],[949,353],[954,386],[944,400],[1002,409],[1056,416],[1075,440],[1075,493],[1066,526],[1014,534],[968,514],[960,538],[935,560],[911,554],[890,545],[867,568],[822,571],[765,556],[704,536],[679,496],[649,474],[625,469],[609,490],[570,492],[551,475],[551,462],[537,455],[533,420],[545,402]]],
];
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=source==='farSleeve'?farSleeve:source==='farForearm'?farForearm:null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(bytes).resize(width,height,{fit:'fill'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=p([590,475]),headRoot=p([574,193]);
const legs=[
 {hip:p([651,590]),knee:p([779,795]),ankle:p([838,1067]),toe:p([939,1138]),offset:.5,center:273,paintedPaw:'far-boot'},
 {hip:p([528,593]),knee:p([460,799]),ankle:p([336,1083]),toe:p([409,1174]),offset:0,center:214,paintedPaw:'near-boot'},
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
const old=JSON.parse(await readFile('assets/source/v100/joints/mrs-chiha-r1/parts.json'));
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
const attack={...old.rig.attack,aimAngle:-.15,aimShift:[9,-14]};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function evaluate(phase,settle,firing=false,bash=false){
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
 const hit=bash?(phase<.28?-smooth(phase/.28):phase<.7?-1+2*smooth((phase-.28)/.42):1-smooth((phase-.7)/.3)):0;
 deform['weapon-0']=multiply(deform.spine,at(grip,[grip[0]-16+2*swing+(bash?24*hit:attack.aimShift[0]*amount-recoil),grip[1]-16-.5*Math.abs(swing)+(bash?-4*amount:attack.aimShift[1]*amount)],-.012*swing+(bash?.22*hit:attack.aimAngle*amount)));
 for(const [name,pivot,gain] of [['coat-far',p([636,575]),.018],['coat-near',p([489,539]),-.018]])deform[name]=multiply(deform.spine,at(pivot,pivot,gain*swing));
 for(const[i,a]of arms.entries()){
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform['weapon-0'],a.wrist),-1,true);
  deform[`arm-${i}-upper`]=m.upper;deform[`arm-${i}-lower`]=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'mrs-chiha',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',atlasPartPadding:3,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/chiha-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/chiha-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([1055,491]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[240,173]],spine:[waist,p([597,270])],head:[headRoot,p([615,111])],legs,arms,firearm:true,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([1055,491]),armIndex:0,supportArm:1}],attack,attackVariants:old.rig.attackVariants},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-0',...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenArms:'Own near jacket sleeve and forearm registered once onto occluded far anatomy',weapon:'Both hands and complete rotary launcher share one transform',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
actions.push({name:'launcher-bash',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'mrs-chiha',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/mrs-chiha-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-mrs-chiha-combat-r1.mjs',description:'Complete Chiha body from adopted master-r4 with hidden-cloth underpainting; both hands share firearm transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityChihaCombatJointData.js','// Generated complete Chiha combat paint and deterministic 2D kinematics.\nexport const QUALITY_CHIHA_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
