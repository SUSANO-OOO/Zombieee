// GANTETSU's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/guardian-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,sourceScale=Math.min(width/mw,height/mh),sourceTx=(width-mw*sourceScale)/2,sourceTy=(height-mh*sourceScale)/2;
const p=([x,y])=>[x*sourceScale+sourceTx,y*sourceScale+sourceTy];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const near={"shoulder":[430,332],"elbow":[492,510],"wrist":[665,520],"grip":[695,520]},far={"shoulder":[629,345],"elbow":[619,520],"wrist":[681,591],"grip":[700,600]};
const definitions=[["coat-far","coat-far",false,"under",[[621,634],[652,663],[690,760],[750,892],[803,1016],[846,1134],[788,1116],[729,1135],[679,1029],[633,872],[597,745]]],["far-upper-arm","arm-1-upper",false,"farUpper",null],["far-forearm","arm-1-lower",false,"farForearm",null],["far-thigh","leg-0-upper",true,"under",[[567,697],[615,687],[653,742],[687,798],[720,867],[757,941],[770,993],[750,1043],[697,1074],[659,1068],[625,1015],[595,935],[563,857],[542,778]]],["far-shin","leg-0-lower",true,"under",[[646,977],[699,967],[753,994],[755,1056],[743,1117],[756,1185],[777,1257],[778,1301],[739,1326],[691,1332],[665,1308],[655,1251],[636,1194],[609,1116],[614,1040]]],["far-boot","leg-0-foot",true,"model",[[675,1273],[743,1267],[780,1290],[805,1307],[837,1319],[887,1323],[918,1338],[930,1366],[920,1392],[887,1399],[790,1398],[707,1390],[655,1384],[657,1352],[666,1313]]],["near-thigh","leg-1-upper",true,"under",[[477,694],[554,695],[596,748],[607,813],[618,872],[614,930],[602,1005],[576,1074],[532,1104],[480,1099],[452,1068],[447,1003],[454,930],[455,850],[456,769]]],["near-shin","leg-1-lower",true,"model",[[473,989],[552,987],[601,1033],[583,1091],[539,1142],[498,1191],[462,1256],[445,1321],[432,1354],[389,1365],[332,1356],[313,1333],[319,1281],[335,1238],[356,1193],[382,1144],[421,1084]]],["near-boot","leg-1-foot",true,"model",[[325,1329],[423,1322],[447,1351],[448,1371],[468,1392],[515,1403],[551,1414],[574,1441],[580,1466],[552,1485],[492,1488],[427,1479],[358,1466],[294,1455],[288,1431],[299,1385]]],["pelvis","pelvis",true,"under",[[475,603],[540,600],[619,633],[647,681],[652,744],[618,800],[554,823],[490,807],[456,760],[444,693]]],["coat-near","coat-near",false,"under",[[363,542],[431,543],[535,602],[511,708],[480,827],[436,946],[396,1067],[350,1178],[305,1265],[263,1246],[211,1209],[156,1189],[103,1140],[118,1090],[171,1010],[222,889],[278,752],[322,634]]],["torso","spine",false,"under",[[417,164],[472,169],[531,201],[571,247],[621,262],[641,316],[652,397],[650,473],[634,546],[636,610],[612,687],[565,709],[510,689],[455,650],[397,622],[360,580],[349,526],[348,464],[369,400],[387,339],[373,271],[359,230],[382,189]]],["head","head",false,"model",[[451,75],[487,44],[541,34],[589,39],[644,59],[673,90],[688,135],[696,161],[691,207],[674,236],[660,264],[636,278],[608,258],[565,239],[536,220],[494,208],[471,180],[456,137]]],["near-upper-arm","arm-0-upper",false,"model",[[366,281],[404,264],[448,264],[489,288],[511,337],[526,381],[551,420],[571,462],[562,504],[525,539],[478,547],[442,518],[420,477],[398,430],[372,380],[346,330]]],["near-forearm","arm-0-lower",false,"model",[[457,465],[504,453],[545,462],[582,477],[621,478],[653,477],[675,490],[679,536],[665,561],[634,576],[582,579],[532,571],[491,551],[457,525],[447,496]]],["weapon-and-hands","weapon-0",false,"model",[[712,208],[749,202],[792,222],[854,241],[894,260],[907,295],[913,389],[912,1080],[905,1128],[887,1146],[742,1161],[710,1154],[689,1134],[685,1086],[691,624],[662,618],[649,592],[651,569],[671,554],[662,528],[652,499],[649,477],[646,454],[656,431],[672,406],[690,405],[695,288],[698,240]]]];
async function register(poly,a,b,c,d){
 const angle=Math.atan2(d[1]-c[1],d[0]-c[0])-Math.atan2(b[1]-a[1],b[0]-a[0]);
 const scale=Math.hypot(d[0]-c[0],d[1]-c[1])/Math.hypot(b[0]-a[0],b[1]-a[1]);
 const co=Math.cos(angle)*scale,si=Math.sin(angle)*scale;
 const matrix=[co,si,-si,co,c[0]-co*a[0]+si*a[1],c[1]-si*a[0]-co*a[1]];
 const bytes=await clip(model,poly);
 const paint=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><image width="${mw}" height="${mh}" transform="matrix(${matrix.join(' ')})" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>`)).png().toBuffer();
 return{paint,matrix};
}

const farUpper=await register(definitions.find(d=>d[0]==='near-upper-arm')[4],near.shoulder,near.elbow,far.shoulder,far.elbow);
const farForearm=await register(definitions.find(d=>d[0]==='near-forearm')[4],near.elbow,near.wrist,far.elbow,far.wrist);
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=source==='farUpper'?farUpper:source==='farForearm'?farForearm:null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="448"><image width="'+mw+'" height="'+mh+'" transform="matrix('+[sourceScale,0,0,sourceScale,sourceTx,sourceTy].join(' ')+')" href="data:image/png;base64,'+bytes.toString('base64')+'"/></svg>')).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=p([562,690]),headRoot=p([568,238]);
const legs=[{"hip":[610,770],"knee":[701,1000],"ankle":[711,1310],"toe":[858,1370],"offset":0.5,"center":282,"paintedPaw":"far-boot"},{"hip":[517,780],"knee":[552,1033],"ankle":[374,1365],"toe":[510,1453],"offset":0,"center":238,"paintedPaw":"near-boot"}].map(l=>({...l,hip:p(l.hip),knee:p(l.knee),ankle:p(l.ankle),toe:p(l.toe),groundAnkleY:p(l.ankle)[1]}));
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
const old=JSON.parse(await readFile('assets/source/v100/joints/guardian-r1/parts.json'));
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
 const grip=arms[0].grip;
 deform['weapon-0']=multiply(deform.spine,at(grip,[grip[0]+2*swing+8*amount,grip[1]-.5*Math.abs(swing)],-.01*swing+.025*amount));
 for(const[name,pivot,gain]of [['coat-far',p([630,680]),.018],['coat-near',p([445,630]),-.022]])deform[name]=multiply(deform.spine,at(pivot,pivot,gain*swing));
 for(const[i,a]of arms.entries()){
  const effector='weapon-0';
  const bend=Math.sign((a.elbow[0]-a.shoulder[0])*(a.wrist[1]-a.shoulder[1])-(a.elbow[1]-a.shoulder[1])*(a.wrist[0]-a.shoulder[0]));
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform[effector],a.wrist),bend,true);
  deform['arm-'+i+'-upper']=m.upper;deform['arm-'+i+'-lower']=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'guardian',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',atlasPartPadding:5,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/gantetsu-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/gantetsu-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([888,680]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([562,440])],head:[headRoot,p([578,118])],legs,arms,firearm:false,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([888,680]),armIndex:0,supportArm:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-0',bendSign:-Math.sign((a.elbow[0]-a.shoulder[0])*(a.wrist[1]-a.shoulder[1])-(a.elbow[1]-a.shoulder[1])*(a.wrist[0]-a.shoulder[0])),...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenBody:'Source-bound clothed torso beneath independently moving limbs',weapon:'Both shield grips share the original shield transform',sourceToLogical:{source:[mw,mh],resized:[width,height],scale:sourceScale,tx:sourceTx,ty:sourceTy,aspectPreserved:true},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'guardian',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/guardian-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-guardian-combat-r1.mjs',description:'Complete Gantetsu body from current generated master with hidden-cloth underpainting; both hands share the held shield transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityGantetsuCombatJointData.js','// Generated complete GANTETSU combat paint and deterministic 2D kinematics.\nexport const QUALITY_GANTETSU_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
