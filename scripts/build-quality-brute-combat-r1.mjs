// TATARA's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/brute-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,p=([x,y])=>[x*width/mw,y*height/mh];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const near={"shoulder":[372,294],"elbow":[278,430],"wrist":[350,568],"grip":[379,605]},far={"shoulder":[692,327],"elbow":[788,526],"wrist":[740,497],"grip":[730,495]};
const definitions=[["far-upper-arm","arm-1-upper",false,"model",[[641,260],[691,261],[735,286],[767,334],[783,378],[788,414],[795,459],[780,481],[742,485],[700,450],[671,410],[643,366],[621,312]]],["far-forearm","arm-1-lower",false,"model",[[751,463],[784,454],[814,480],[820,518],[810,551],[784,578],[751,577],[726,557],[710,534],[716,505]]],["far-thigh","leg-0-upper",true,"model",[[563,571],[622,576],[672,616],[721,656],[762,709],[806,756],[838,805],[832,854],[800,887],[757,894],[710,860],[666,811],[623,773],[570,715],[537,658]]],["far-shin","leg-0-lower",true,"model",[[738,824],[813,820],[841,857],[845,909],[850,950],[854,990],[825,1022],[768,1030],[731,1005],[710,963],[705,916],[719,873]]],["far-boot","leg-0-foot",true,"model",[[736,978],[832,970],[853,1011],[859,1062],[893,1096],[941,1107],[976,1131],[989,1166],[947,1181],[856,1176],[783,1174],[720,1157],[720,1124],[732,1077]]],["near-thigh","leg-1-upper",true,"under",[[432,552],[507,560],[552,614],[543,672],[498,730],[444,789],[409,843],[370,889],[321,909],[270,883],[243,848],[268,792],[306,739],[358,673],[397,607]]],["near-shin","leg-1-lower",true,"model",[[280,819],[355,835],[392,872],[363,913],[331,957],[298,1003],[258,1032],[201,1016],[173,990],[176,953],[203,910],[239,859]]],["near-boot","leg-1-foot",true,"model",[[185,983],[273,993],[277,1037],[267,1071],[292,1104],[345,1106],[380,1126],[391,1164],[360,1181],[278,1180],[208,1171],[141,1155],[139,1125],[152,1082],[166,1028]]],["pelvis","pelvis",true,"under",[[409,456],[505,472],[596,476],[651,493],[671,553],[707,603],[717,651],[669,681],[600,688],[537,673],[475,674],[412,665],[377,619],[386,552]]],["torso","spine",false,"under",[[443,200],[494,208],[530,239],[580,256],[626,227],[664,245],[696,288],[692,345],[681,399],[652,450],[651,492],[604,521],[542,514],[479,503],[424,489],[376,474],[374,431],[383,389],[369,340],[350,297],[363,251],[398,215]]],["head","head",false,"model",[[449,212],[438,170],[443,125],[471,86],[521,55],[575,57],[626,79],[659,109],[681,145],[665,193],[653,231],[623,252],[584,271],[557,292],[522,282],[496,253],[479,226]]],["near-upper-arm","arm-0-upper",false,"model",[[339,229],[385,215],[420,245],[415,292],[392,339],[359,377],[339,419],[319,453],[281,464],[242,447],[217,418],[234,374],[262,325],[289,275]]],["near-forearm","arm-0-lower",false,"model",[[240,398],[293,386],[327,410],[343,452],[361,490],[380,530],[372,566],[347,583],[314,568],[294,535],[265,495],[238,452],[225,420]]],["weapon-and-hands","weapon-0",false,"model",[[69,704],[92,676],[159,633],[181,620],[295,589],[315,561],[345,540],[380,548],[408,563],[420,575],[678,493],[675,469],[696,453],[725,442],[755,442],[782,459],[920,382],[1009,322],[985,275],[946,209],[917,164],[929,136],[1061,46],[1100,45],[1161,136],[1183,184],[1217,216],[1245,278],[1290,352],[1290,388],[1184,466],[1138,481],[1097,422],[1062,365],[1013,373],[796,494],[784,524],[753,543],[707,541],[693,526],[428,614],[407,640],[378,651],[340,646],[323,627],[213,674],[183,683],[157,718],[122,751],[81,765],[68,747]]]];
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
const waist=p([535,540]),headRoot=p([549,250]);
const legs=[{"hip":[620,640],"knee":[782,841],"ankle":[802,1070],"toe":[946,1142],"offset":0.5,"center":280,"paintedPaw":"far-boot"},{"hip":[466,640],"knee":[329,851],"ankle":[232,1072],"toe":[358,1147],"offset":0,"center":170,"paintedPaw":"near-boot"}].map(l=>({...l,hip:p(l.hip),knee:p(l.knee),ankle:p(l.ankle),toe:p(l.toe),groundAnkleY:p(l.ankle)[1]}));
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
const old=JSON.parse(await readFile('assets/source/v100/joints/brute-r1/parts.json'));
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
 deform['weapon-0']=multiply(deform.spine,at(grip,[grip[0]+2*swing+20*amount,grip[1]-.5*Math.abs(swing)],-.015*swing+.08*cut));
 for(const[i,a]of arms.entries()){
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform['weapon-0'],a.wrist),i===1?1:-1,true);
  deform[`arm-${i}-upper`]=m.upper;deform[`arm-${i}-lower`]=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'brute',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',atlasPartPadding:3,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/tatara-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/tatara-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([1245,371]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([535,360])],head:[headRoot,p([579,160])],legs,arms,firearm:false,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([1245,371]),armIndex:0,supportArm:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-0',bendSign:i===1?-1:1,...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenBody:'Source-bound chest, belt and coat underpainting beneath moving arms and blade',weapon:'Both hands and the complete industrial hammer share one transform',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'brute',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/brute-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-brute-combat-r1.mjs',description:'Complete Tatara body from current generated master with hidden-cloth underpainting; both hands share the held weapon transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityTataraCombatJointData.js','// Generated complete TATARA combat paint and deterministic 2D kinematics.\nexport const QUALITY_TATARA_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
