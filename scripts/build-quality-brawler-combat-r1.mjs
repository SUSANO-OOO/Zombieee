// PAISEN's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/brawler-combat-r1';
const modelPath=`${dir}/combat-model-r2.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,sourceScale=Math.min(width/mw,height/mh),sourceTx=(width-mw*sourceScale)/2,sourceTy=(height-mh*sourceScale)/2;
const p=([x,y])=>[x*sourceScale+sourceTx,y*sourceScale+sourceTy];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const near={"shoulder":[334,350],"elbow":[374,517],"wrist":[536,405],"grip":[578,367]},far={"shoulder":[614,350],"elbow":[700,510],"wrist":[807,420],"grip":[841,365]};
const definitions=[["far-upper-arm","arm-1-upper",false,"model",[[579,309],[617,315],[644,340],[670,380],[690,417],[709,439],[723,463],[741,502],[737,529],[716,550],[683,560],[648,541],[621,515],[605,485],[582,448],[567,391]]],["far-forearm","arm-1-lower",false,"model",[[680,468],[727,455],[763,436],[790,409],[806,391],[829,399],[841,421],[833,449],[808,478],[773,510],[742,539],[718,555],[692,544],[676,523]]],["far-thigh","leg-0-upper",true,"model",[[514,738],[570,744],[641,748],[675,799],[700,859],[728,935],[736,976],[725,1030],[702,1059],[663,1067],[627,1046],[609,1007],[580,976],[552,943],[527,897],[507,845]]],["far-shin","leg-0-lower",true,"model",[[636,1009],[647,991],[680,982],[711,994],[727,1017],[731,1054],[728,1115],[722,1172],[724,1232],[728,1290],[727,1339],[701,1368],[659,1370],[634,1346],[624,1291],[614,1235],[604,1170],[597,1118],[607,1064]]],["far-boot","leg-0-foot",true,"model",[[625,1311],[648,1316],[670,1334],[697,1326],[715,1304],[737,1296],[759,1326],[795,1351],[835,1360],[871,1375],[893,1397],[894,1422],[871,1437],[815,1440],[756,1436],[700,1432],[640,1428],[602,1417],[597,1392],[611,1350]]],["near-thigh","leg-1-upper",true,"model",[[322,733],[391,731],[468,740],[515,763],[527,817],[516,877],[490,938],[477,1008],[436,1009],[416,1040],[392,1061],[365,1076],[336,1070],[311,1051],[295,1023],[298,980],[307,925],[311,852]]],["near-shin","leg-1-lower",true,"model",[[315,1026],[328,1006],[353,997],[379,1005],[397,1024],[403,1047],[390,1081],[373,1124],[352,1178],[331,1236],[310,1296],[302,1342],[291,1365],[268,1384],[238,1386],[212,1369],[214,1330],[218,1267],[221,1206],[224,1147],[237,1095],[274,1056]]],["near-boot","leg-1-foot",true,"model",[[205,1330],[224,1329],[246,1344],[270,1336],[285,1320],[307,1317],[324,1335],[327,1360],[348,1373],[378,1386],[414,1403],[434,1430],[436,1455],[418,1466],[366,1470],[310,1465],[265,1460],[215,1451],[170,1436],[171,1413],[184,1374]]],["pelvis","pelvis",true,"model",[[321,707],[410,712],[496,725],[572,732],[646,724],[671,771],[686,820],[650,859],[590,881],[534,870],[492,859],[436,881],[373,878],[310,863],[303,820]]],["torso","spine",false,"under",[[400,245],[445,255],[486,288],[535,310],[564,291],[609,309],[636,346],[635,395],[621,457],[609,525],[612,577],[622,637],[636,692],[648,747],[612,762],[549,761],[488,749],[414,740],[358,737],[315,754],[313,710],[327,656],[330,606],[313,546],[302,478],[308,428],[320,377],[315,333],[347,290]]],["head","head",false,"model",[[401,65],[430,28],[475,17],[526,19],[577,42],[601,73],[612,112],[610,151],[620,177],[609,192],[607,212],[604,234],[584,262],[547,267],[532,308],[486,303],[447,282],[410,253],[427,216],[411,192],[400,155],[392,108]]],["near-upper-arm","arm-0-upper",false,"model",[[302,298],[337,292],[372,312],[399,348],[418,396],[418,438],[415,483],[415,522],[400,558],[380,575],[355,567],[329,542],[309,507],[290,473],[279,442],[269,392],[264,347],[278,317]]],["near-forearm","arm-0-lower",false,"model",[[350,475],[390,455],[426,441],[469,416],[504,389],[532,374],[554,391],[566,412],[548,438],[512,462],[480,489],[444,516],[402,547],[378,567],[355,560],[340,535],[337,502]]],["free-hand","arm-0-hand",false,"model",[[520,370],[535,346],[554,321],[573,314],[590,324],[599,341],[610,354],[620,379],[613,399],[596,410],[575,420],[552,423],[531,408],[517,391]]],["weapon-and-hands","weapon-0",false,"model",[[793,344],[806,338],[818,343],[816,332],[837,325],[861,331],[871,345],[875,368],[875,388],[862,409],[842,422],[826,430],[804,420],[793,402],[789,382],[785,365]]]];
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="448"><image width="'+mw+'" height="'+mh+'" transform="matrix('+[sourceScale,0,0,sourceScale,sourceTx,sourceTy].join(' ')+')" href="data:image/png;base64,'+bytes.toString('base64')+'"/></svg>')).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=p([483,756]),headRoot=p([483,255]);
const legs=[{"hip":[588,836],"knee":[681,1017],"ankle":[677,1350],"toe":[848,1418],"offset":0,"center":268.5833333333333,"paintedPaw":"far-boot"},{"hip":[392,840],"knee":[354,1036],"ankle":[258,1360],"toe":[397,1443],"offset":0.5,"center":192.75,"paintedPaw":"near-boot"}].map(l=>({...l,hip:p(l.hip),knee:p(l.knee),ankle:p(l.ankle),toe:p(l.toe),groundAnkleY:p(l.ankle)[1]}));
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
const old=JSON.parse(await readFile('assets/source/v177/paisen/battle-r8/parts.json'));
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
  const bone=i===0?'arm-0-hand':'weapon-0',grip=a.grip;
  deform[bone]=multiply(deform.spine,at(grip,[grip[0]+(i===1?8:4)*amount,grip[1]],0));
 }
 for(const[i,a]of arms.entries()){
  const effector=i===0?'arm-0-hand':'weapon-0';
  const bend=Math.sign((a.elbow[0]-a.shoulder[0])*(a.wrist[1]-a.shoulder[1])-(a.elbow[1]-a.shoulder[1])*(a.wrist[0]-a.shoulder[0]));
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform[effector],a.wrist),bend,true);
  deform['arm-'+i+'-upper']=m.upper;deform['arm-'+i+'-lower']=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'brawler',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',atlasPartPadding:3,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/paisen-photo-master-r7.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/paisen-photo-master-r7.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[1].grip,'arm-0-hand':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{...old.referenceFrame,ty:soleY-old.referenceFrame.scale*spriteFrameFor('brawler','walk-a','right').groundAnchorPixels},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([862,360]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([483,506])],head:[headRoot,p([493,135])],legs,arms,firearm:false,weapons:[{name:'weapon-0',a:arms[1].grip,b:p([862,360]),armIndex:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:i===0?'arm-0-hand':'weapon-0',bendSign:-Math.sign((a.elbow[0]-a.shoulder[0])*(a.wrist[1]-a.shoulder[1])-(a.elbow[1]-a.shoulder[1])*(a.wrist[0]-a.shoulder[0])),...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,bendSign:-1,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenBody:'Source-bound clothed torso beneath independently moving limbs',weapon:'Each bare fist belongs to its own arm; no held weapon',sourceToLogical:{source:[mw,mh],resized:[width,height],scale:sourceScale,tx:sourceTx,ty:sourceTy,aspectPreserved:true},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'brawler',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/brawler-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-brawler-combat-r1.mjs',description:'Complete Paisen body from current generated master with hidden-cloth underpainting; each bare fist retains its independent arm transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityPaisenCombatJointData.js','// Generated complete PAISEN combat paint and deterministic 2D kinematics.\nexport const QUALITY_PAISEN_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
