// CRAZY KING's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/crazy-king-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,scale=height/mh,offsetX=(width-mw*scale)/2,p=([x,y])=>[x*scale+offsetX,y*scale];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const near={"shoulder":[423,289],"elbow":[365,441],"wrist":[493,555],"grip":[527,594]},far={"shoulder":[626,332],"elbow":[663,444],"wrist":[727,502],"grip":[740,542]};
const definitions=[["far-upper-arm","arm-1-upper",false,"model",[[600,322],[633,320],[661,355],[680,392],[696,432],[686,466],[657,481],[625,451],[606,412],[592,366]]],["far-forearm","arm-1-lower",false,"model",[[641,421],[677,414],[704,432],[731,463],[756,494],[751,513],[722,527],[696,515],[674,491],[650,464],[634,442]]],["far-thigh","leg-0-upper",true,"under",[[505,699],[556,687],[604,714],[647,751],[670,793],[700,829],[706,870],[686,911],[642,924],[609,901],[583,857],[555,809],[521,769],[495,732]]],["far-shin","leg-0-lower",true,"model",[[608,858],[652,849],[693,869],[704,905],[689,961],[677,1013],[682,1065],[685,1108],[658,1149],[604,1144],[566,1114],[571,1066],[583,1014],[580,959],[580,908]]],["far-boot","leg-0-foot",true,"model",[[570,1085],[612,1078],[666,1090],[685,1125],[692,1152],[725,1167],[757,1172],[773,1193],[769,1215],[738,1225],[652,1224],[599,1221],[568,1211],[562,1162]]],["near-thigh","leg-1-upper",true,"under",[[336,705],[390,694],[448,709],[468,747],[463,790],[445,842],[434,880],[408,916],[370,926],[330,908],[310,881],[315,844],[329,794],[329,750]]],["near-shin","leg-1-lower",true,"model",[[320,851],[361,843],[410,856],[427,883],[420,915],[394,955],[372,993],[354,1034],[345,1077],[329,1119],[287,1155],[243,1134],[232,1100],[247,1054],[260,1005],[275,957],[292,909]]],["near-boot","leg-1-foot",true,"model",[[244,1084],[287,1079],[329,1102],[341,1139],[353,1170],[385,1194],[400,1218],[389,1245],[348,1252],[298,1242],[258,1226],[227,1230],[221,1188],[218,1145]]],["pelvis","pelvis",true,"under",[[339,537],[416,539],[503,555],[585,549],[616,596],[650,663],[660,718],[649,744],[609,758],[542,773],[468,774],[398,763],[337,753],[298,745],[263,724],[279,683],[314,614]]],["torso","spine",false,"under",[[437,150],[491,173],[540,206],[601,235],[622,271],[637,320],[642,374],[625,415],[616,456],[615,509],[602,565],[597,601],[554,605],[500,603],[450,594],[395,589],[342,578],[347,543],[370,495],[387,447],[393,388],[392,337],[395,284],[390,228],[407,183]]],["head","head",false,"model",[[472,25],[511,8],[605,4],[671,23],[705,68],[709,122],[690,183],[667,231],[627,246],[605,268],[587,289],[563,272],[540,247],[513,227],[470,200],[452,162],[459,108]]],["near-upper-arm","arm-0-upper",false,"model",[[390,240],[432,230],[476,251],[496,281],[487,321],[465,359],[443,390],[424,420],[408,453],[378,475],[346,476],[314,451],[309,422],[324,378],[344,336],[361,289]]],["near-forearm","arm-0-lower",false,"model",[[324,412],[367,396],[404,412],[428,443],[454,471],[480,491],[501,522],[488,551],[467,568],[438,559],[410,538],[375,518],[346,491],[322,460],[311,435]]],["weapon-and-hands","weapon-0",false,"model",[[430,591],[448,577],[473,575],[476,543],[493,527],[520,535],[541,549],[561,576],[580,567],[590,560],[607,535],[623,519],[649,517],[692,529],[696,514],[711,494],[740,499],[761,519],[778,547],[772,568],[753,590],[746,608],[859,645],[1015,685],[1103,707],[1135,730],[1145,755],[1132,789],[1104,796],[1015,781],[875,752],[731,723],[649,725],[572,711],[516,699],[461,675],[431,656]]]];
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(bytes).resize(Math.round(mw*scale),height,{fit:'fill'}).extend({left:Math.round(offsetX),right:width-Math.round(mw*scale)-Math.round(offsetX),top:0,bottom:0,background:'#00000000'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=p([475,589]),headRoot=p([575,255]);
const legs=[{"hip":[558,706],"knee":[644,875],"ankle":[626,1130],"toe":[748,1191],"offset":0.5,"center":211.29999999999998,"paintedPaw":"far-boot"},{"hip":[382,727],"knee":[385,883],"ankle":[280,1140],"toe":[363,1224],"offset":0,"center":149.7,"paintedPaw":"near-boot"}].map(l=>({...l,center:p(l.hip)[0],hip:p(l.hip),knee:p(l.knee),ankle:p(l.ankle),toe:p(l.toe),groundAnkleY:p(l.ankle)[1]}));
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
const old=JSON.parse(await readFile('assets/source/v100/joints/crazy-king-r1/parts.json'));
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
const attack={...old.rig.attack};
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
 deform['weapon-0']=multiply(deform.spine,at(grip,[grip[0]+2*swing-3*amount,grip[1]-.5*Math.abs(swing)],-.015*swing+.04*cut));
 for(const[i,a]of arms.entries()){
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform['weapon-0'],a.wrist),-1,true);
  deform[`arm-${i}-upper`]=m.upper;deform[`arm-${i}-lower`]=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'crazy-king',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',atlasPartPadding:3,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/king-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/king-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([1120,746]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([511,350])],head:[headRoot,p([585,133])],legs,arms,firearm:false,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([1120,746]),armIndex:0,supportArm:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-0',bendSign:1,...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenBody:'Source-bound hoodie and skirt underpainting beneath moving arms and blade',weapon:'Both hands and the complete industrial chainsaw share one transform',sourceToLogical:{source:[mw,mh],uniformScale:scale,offsetX,frame:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'crazy-king',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/crazy-king-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-crazy-king-combat-r1.mjs',description:'Complete CrazyKing body from current generated master with hidden-cloth underpainting; both hands share the held weapon transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
atlas.weaponCarryPosition=[...arms[0].wrist];
await emit('app/qualityKingCombatJointData.js','// Generated complete CRAZY KING combat paint and deterministic 2D kinematics.\nexport const QUALITY_KING_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
