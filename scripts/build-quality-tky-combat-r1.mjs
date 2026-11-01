// TKY's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/tky-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,p=([x,y])=>[x*width/mw,y*height/mh];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const near={shoulder:[478,279],elbow:[534,443],wrist:[622,521],grip:[686,570]};
const far={shoulder:[766,306],elbow:[750,466],wrist:[719,535],grip:[734,562]};
const definitions=[
 ['far-upper-arm','arm-1-upper',false,'model',[[746,256],[792,265],[819,308],[825,370],[806,429],[786,475],[751,490],[707,474],[695,443],[719,388],[719,326]]],
 ['far-forearm','arm-1-lower',false,'model',[[706,455],[782,459],[776,498],[756,544],[721,566],[693,541],[697,501]]],
 ['coat-far','coat-far',false,'under',[[479,488],[558,521],[543,584],[506,641],[463,700],[402,756],[334,815],[266,888],[220,944],[166,909],[107,848],[84,813],[130,761],[267,679],[349,624],[420,555]]],
 ['coat-near','coat-near',false,'under',[[620,610],[729,594],[779,629],[828,710],[849,800],[810,880],[736,920],[651,933],[558,967],[490,897],[534,789],[562,693]]],
 ['far-thigh','leg-0-upper',true,'under',[[624,577],[712,598],[766,659],[825,716],[867,778],[872,830],[839,872],[783,875],[741,828],[700,781],[635,730],[597,683]]],
 ['far-shin','leg-0-lower',true,'under',[[783,794],[859,784],[880,838],[910,909],[932,969],[919,1008],[874,1024],[832,989],[806,924],[777,855]]],
 ['far-boot','leg-0-foot',true,'model',[[857,983],[925,973],[942,1026],[963,1068],[1011,1096],[1073,1106],[1090,1153],[1030,1172],[928,1168],[852,1156],[838,1127],[847,1085],[843,1046]]],
 ['near-thigh','leg-1-upper',true,'under',[[496,572],[571,570],[625,623],[606,692],[567,749],[506,811],[460,867],[417,913],[367,909],[329,873],[351,815],[395,753],[438,693],[467,636]]],
 ['near-shin','leg-1-lower',true,'model',[[357,832],[428,843],[447,891],[407,935],[359,986],[328,1033],[295,1063],[235,1059],[218,1032],[242,976],[285,921],[318,863]]],
 ['near-boot','leg-1-foot',true,'model',[[228,978],[308,993],[325,1021],[305,1079],[284,1116],[281,1174],[266,1206],[169,1206],[138,1188],[144,1151],[167,1091],[188,1044]]],
 ['pelvis','pelvis',true,'under',[[500,522],[671,523],[746,560],[754,621],[717,676],[648,704],[585,694],[509,675],[471,622]]],
 ['torso','spine',false,'under',[[510,150],[603,151],[650,213],[714,217],[776,208],[806,251],[772,304],[751,364],[730,413],[733,479],[770,554],[753,588],[695,573],[620,569],[562,552],[491,571],[443,599],[408,589],[436,537],[477,470],[489,407],[502,344],[466,280],[438,239],[453,207],[520,191]]],
 ['head','head',false,'model',[[580,173],[576,108],[582,62],[632,24],[705,12],[772,27],[799,70],[805,120],[785,158],[769,196],[735,215],[693,222],[665,252],[628,271],[597,250],[589,217]]],
 ['near-upper-arm','arm-0-upper',false,'model',[[442,206],[490,206],[524,245],[528,293],[526,335],[546,375],[570,413],[554,452],[522,477],[488,457],[466,421],[442,368],[427,323],[411,278],[417,239]]],
 ['near-forearm','arm-0-lower',false,'model',[[502,412],[551,414],[574,442],[610,469],[645,492],[651,524],[621,552],[594,535],[557,517],[518,493],[494,470],[487,440]]],
 ['weapon-and-hands','weapon-0',false,'model',[[596,493],[636,495],[670,513],[704,535],[725,517],[752,521],[793,503],[878,444],[979,363],[1075,271],[1175,164],[1255,61],[1283,82],[1271,124],[1197,219],[1101,321],[1002,409],[912,480],[811,549],[782,570],[759,590],[743,619],[707,629],[673,613],[624,614],[580,627],[564,609],[573,586],[612,572],[614,549],[590,527]]],
];
// The source rear boot faces the camera. Reuse TKY's own side-facing boot
// at the rear ankle once, so both toes face the battle direction.
const bootPoly=definitions.find(d=>d[0]==='far-boot')[4];
const bootPaint=await clip(model,bootPoly);
const registeredBoot=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+mw+'" height="'+mh+'"><image width="'+mw+'" height="'+mh+'" transform="translate(-642 26)" href="data:image/png;base64,'+bootPaint.toString('base64')+'"/></svg>')).png().toBuffer();
const rearBoot=definitions.find(d=>d[0]==='near-boot');rearBoot[3]='registeredBoot';rearBoot[4]=null;
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=source==='registeredBoot'?{paint:registeredBoot,matrix:[1,0,0,1,-642,26]}:null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(bytes).resize(width,height,{fit:'fill'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=[239,207],headRoot=p([633,248]);
const legs=[
 {hip:p([671,629]),knee:p([820,813]),ankle:p([889,1045]),toe:p([1040,1130]),offset:.5,center:225,paintedPaw:'far-boot'},
 {hip:p([549,632]),knee:p([396,864]),ankle:p([247,1071]),toe:p([398,1156]),offset:0,center:275,paintedPaw:'near-boot'},
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
const old=JSON.parse(await readFile('assets/source/v100/joints/tky-r1/parts.json'));
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
 deform['weapon-0']=multiply(deform.spine,at(grip,[grip[0]+2*swing+4*cut,grip[1]-12-.5*Math.abs(swing)-5*amount],-.015*swing+.8*cut));
 for(const [name,pivot,gain] of [['coat-far',p([516,572]),.028],['coat-near',p([680,644]),-.022]])deform[name]=multiply(deform.spine,at(pivot,pivot,gain*swing));
 for(const[i,a]of arms.entries()){
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform['weapon-0'],a.wrist),-1,true);
  deform[`arm-${i}-upper`]=m.upper;deform[`arm-${i}-lower`]=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'tky',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/tky-89-warm-r1.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/tky-89-warm-r1.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:[462.5,31.5],weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([660,300])],head:[headRoot,p([699,125])],legs,arms,firearm:false,weapons:[{name:'weapon-0',a:arms[0].grip,b:[462.5,31.5],armIndex:0,supportArm:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-0',...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenBody:'Source-bound chest, belt and coat underpainting beneath moving arms and blade',weapon:'Both hands and complete katana share one transform',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'tky',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/tky-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-tky-combat-r1.mjs',description:'Complete TKY body from approved artistic89 mask master with hidden-cloth underpainting; both hands share katana transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityTkyCombatJointData.js','// Generated complete TKY combat paint and deterministic 2D kinematics.\nexport const QUALITY_TKY_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
