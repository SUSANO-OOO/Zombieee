// Complete Hachi paint with explicitly authored part ownership. No private photos.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/scout-combat-r1';
const modelPath=`${dir}/combat-model-r2.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
if(!check)await mkdir(dir,{recursive:true});
const width=480,height=448,mw=1298,mh=1212;
const p=([x,y])=>[x*width/mw,y*height/mh];
const polygonMask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const sleeve=[[666,238],[713,230],[753,263],[768,330],[755,405],[758,470],[773,522],[738,546],[680,565],[651,535],[633,485],[635,415],[627,355],[637,290]];
// Hidden far sleeve uses the same jacket sleeve, registered to its own shoulder
// and elbow before baking. It is paint, not a runtime length-changing bone.
const a=[690,300],b=[710,510],c=[590,350],d=[510,626];
const theta=Math.atan2(d[1]-c[1],d[0]-c[0])-Math.atan2(b[1]-a[1],b[0]-a[0]);
const ratio=Math.hypot(d[0]-c[0],d[1]-c[1])/Math.hypot(b[0]-a[0],b[1]-a[1]);
const cs=Math.cos(theta)*ratio,sn=Math.sin(theta)*ratio;
const sleeveTransform=[cs,sn,-sn,cs,c[0]-cs*a[0]+sn*a[1],c[1]-sn*a[0]-cs*a[1]];
const sleeveBytes=await sharp(model).composite([{input:polygonMask(sleeve),blend:'dest-in'}]).png().toBuffer();
const farSleeve=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><image width="${mw}" height="${mh}" transform="matrix(${sleeveTransform.join(' ')})" href="data:image/png;base64,${sleeveBytes.toString('base64')}"/></svg>`)).png().toBuffer();
const definitions=[
 ['far-upper-arm','arm-1-upper',false,'sleeve',null],
 ['far-forearm','arm-1-lower',false,'model',[[482,621],[541,634],[516,692],[501,720],[458,703],[458,667]]],
 ['far-hand','arm-1-hand',false,'model',[[462,674],[509,684],[524,726],[516,769],[484,785],[453,764],[438,731]]],
 ['far-thigh','leg-0-upper',true,'under',[[558,595],[688,602],[749,674],[719,756],[650,842],[571,948],[487,960],[454,924],[487,823],[526,737]]],
 ['far-shin','leg-0-lower',true,'under',[[478,848],[591,906],[558,964],[460,1015],[410,1050],[341,1026],[329,984],[376,926]]],
 ['far-boot','leg-0-foot',true,'under',[[324,970],[387,985],[415,1034],[412,1080],[447,1127],[451,1174],[408,1198],[352,1176],[305,1126],[250,1080],[244,1030],[280,993]]],
 ['near-thigh','leg-1-upper',true,'under',[[649,610],[741,611],[799,680],[835,750],[908,796],[917,856],[925,916],[867,951],[800,934],[778,873],[714,831],[660,756]]],
 ['near-shin','leg-1-lower',true,'under',[[786,871],[916,858],[922,931],[946,991],[969,1047],[936,1088],[878,1080],[847,1018],[823,954]]],
 ['near-boot','leg-1-foot',true,'under',[[887,1023],[949,1024],[974,1063],[1029,1074],[1106,1105],[1122,1150],[1077,1180],[963,1207],[895,1208],[874,1163],[861,1110],[860,1073]]],
 ['pelvis','pelvis',true,'under',[[552,588],[752,584],[785,687],[744,768],[672,791],[577,752],[531,692]]],
 ['torso','spine',false,'under',[[548,155],[660,148],[746,171],[783,227],[864,310],[840,376],[812,446],[784,494],[775,573],[789,640],[690,620],[629,617],[568,638],[536,679],[502,738],[477,797],[446,886],[387,858],[341,880],[289,924],[230,987],[204,961],[202,903],[211,821],[188,739],[221,699],[307,642],[318,584],[299,550],[291,513],[321,468],[368,447],[397,377],[439,318],[500,280],[542,245]]],
 ['near-upper-arm','arm-0-upper',false,'model',sleeve],
 ['head','head',false,'model',[[718,36],[982,35],[984,212],[944,247],[890,292],[840,300],[794,277],[752,248],[714,207]]],
 ['near-forearm','arm-0-lower',false,'model',[[680,522],[739,512],[766,558],[796,608],[819,641],[793,674],[754,676],[724,628],[698,583]]],
 ['crowbar-and-hand','weapon-0',false,'model',[[754,642],[798,630],[827,647],[844,669],[850,716],[1037,866],[1091,894],[1110,931],[1117,974],[1075,965],[1056,926],[1018,901],[829,753],[797,766],[761,745],[731,705],[731,677]]],
];
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const bytes=source==='sleeve'?farSleeve:await sharp(source==='under'?under:model).composite([{input:polygonMask(polygon),blend:'dest-in'}]).png().toBuffer();
 const clipped=await sharp(bytes).resize(width,height,{fit:'fill'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),original:source==='model',source,masterPolygon:polygon,lower,...(source==='sleeve'?{sourceTransform:sleeveTransform}:{} )});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=p([650,645]),headRoot=p([779,248]);
const legs=[
 {hip:p([638,684]),knee:p([534,882]),ankle:p([371,1010]),toe:p([416,1150]),center:229,offset:.5,paintedPaw:'far-boot'},
 {hip:p([708,677]),knee:p([847,866]),ankle:p([921,1048]),toe:p([1080,1140]),center:259,offset:0,paintedPaw:'near-boot'},
].map(l=>({...l,groundAnkleY:l.ankle[1]}));
const arms=[
 {shoulder:p(a),elbow:p(b),wrist:p([786,651]),grip:p([809,707])},
 {shoulder:p(c),elbow:p(d),wrist:p([484,690]),grip:p([484,740])},
];
const bones=[...new Set(parts.map(p=>p.bone))];
const at=(a,b,angle=0)=>{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,b[0]-c*a[0]+s*a[1],b[1]-s*a[0]-c*a[1]];};
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
function chain(h,k,a,hip,target,side=1){
 const A=Math.hypot(k[0]-h[0],k[1]-h[1]),B=Math.hypot(a[0]-k[0],a[1]-k[1]);
 const dx=target[0]-hip[0],dy=target[1]-hip[1],distance=Math.hypot(dx,dy),len=Math.max(Math.abs(A-B)+.001,Math.min(A+B-.001,distance));
 const end=[hip[0]+dx/distance*len,hip[1]+dy/distance*len];
 const ux=dx/distance,uy=dy/distance,along=(A*A+len*len-B*B)/(2*len),rise=Math.sqrt(Math.max(0,A*A-along*along));
 const knee=[hip[0]+ux*along+uy*rise*side,hip[1]+uy*along-ux*rise*side];
 return{upper:at(h,hip,Math.atan2(knee[1]-hip[1],knee[0]-hip[0])-Math.atan2(k[1]-h[1],k[0]-h[0])),lower:at(k,knee,Math.atan2(end[1]-knee[1],end[0]-knee[0])-Math.atan2(a[1]-k[1],a[0]-k[0])),end};
}
const span=94,stance=.62;
function evaluate(phase,settle){
 const walk=1-settle,swing=Math.sin(phase*Math.PI*2)*walk,bob=-1.1*(1-Math.cos(phase*4*Math.PI))*walk;
 const deform=Object.fromEntries(bones.map(b=>[b,[1,0,0,1,0,0]]));
 deform.pelvis=at(waist,[waist[0],waist[1]+bob]);deform.spine=at(waist,[waist[0],waist[1]+bob],.012*swing);
 deform.head=at(headRoot,point(deform.spine,headRoot),.008*swing);
 for(const[i,l]of legs.entries()){
  const q=(phase+l.offset)%1,t=Math.max(0,(q-stance)/(1-stance)),s=t*t*(3-2*t);
  const target=[l.center+span*(q>stance?-.5+s:.5-q/stance)*walk,l.groundAnkleY-(q>stance?13*Math.sin(Math.PI*t)*walk:0)];
  const m=chain(l.hip,l.knee,l.ankle,point(deform.pelvis,l.hip),target);
  deform[`leg-${i}-upper`]=m.upper;deform[`leg-${i}-lower`]=m.lower;deform[`leg-${i}-foot`]=at(l.ankle,m.end,q>stance?-.10*Math.sin(Math.PI*t)*walk:0);
 }
 for(const[i,a]of arms.entries()){
  const target=point(deform.spine,[a.wrist[0]+(i?-12:8)*swing,a.wrist[1]-2*Math.abs(swing)]);
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),target,i?1:-1);
  deform[`arm-${i}-upper`]=m.upper;deform[`arm-${i}-lower`]=m.lower;deform[i?'arm-1-hand':'weapon-0']=at(a.wrist,m.end,(i?.10:-.04)*swing);
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const old=JSON.parse(await readFile('assets/source/v100/joints/scout-r1/parts.json'));
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'scout',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/hachi-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/hachi-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].wrist,'arm-1-hand':arms[1].wrist},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 motion:{walk:{spanPx:span,liftPx:13,stanceFraction:stance,groundY:442},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([1100,941]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[waist[0],waist[1]-20]],spine:[waist,p([690,310])],head:[headRoot,p([850,130])],legs,arms,attack:old.rig.attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:i?'arm-1-hand':'weapon-0',...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete generated paint, not head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),farSleeve:'Same orange sleeve registered once to hidden far shoulder/elbow',weapon:'Plain steel crowbar; decorative hook in generated master corrected to canonical role',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
// Runtime weapon choreography owns anticipation/contact/recovery; this is its rest base.
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'scout',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/scout-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-scout-combat-r1.mjs',description:'Complete Hachi body matching adopted master-r4; plain steel crowbar correction; explicit hidden-cloth underpainting and part masks. Deterministic 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityScoutCombatJointData.js','// Generated complete Hachi combat paint and deterministic 2D kinematics.\nexport const QUALITY_SCOUT_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
