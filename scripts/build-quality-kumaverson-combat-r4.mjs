import {spriteFrameFor} from '../app/spriteManifest.js';
// One complete combat model owns the face, neck, shoulder paint and equipment.
// Only the cloth hidden by the pan uses a separate saved underpainting.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/kumaverson-combat-r4';
const masterPath=`${dir}/combat-model-r4.png`,identityPath='assets/source/quality-20261028/identity/kumaverson-master-r2.png';
const master=await readFile(masterPath),under=await readFile(`${dir}/trouser-underpainting-r4.png`);
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{const bytes=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),bytes,f);else await writeFile(f,bytes);};
if(!check)await mkdir(dir,{recursive:true});
await emit(`${dir}/identity-reference.png`,master);
const width=480,height=448,mw=1298,mh=1212,rw=428,rh=400,tx=29,ty=7;
const p=([x,y])=>[x*rw/mw+tx,y*rh/mh+ty];
const svg=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon points="${points.map(x=>x.join(',')).join(' ')}" fill="white"/></svg>`);
const repair=[[376,654],[430,631],[484,625],[541,638],[582,676],[609,728],[615,780],[583,834],[534,861],[465,870],[404,857],[370,823],[350,767],[356,710]];
const repairedCrop=await sharp(under).resize(700,400,{fit:'fill'}).png().toBuffer();
const repaired=await sharp({create:{width:mw,height:mh,channels:4,background:'#00000000'}})
 .composite([{input:repairedCrop,left:350,top:610}]).png().toBuffer();
const maskedRepair=await sharp(repaired).composite([{input:svg(repair),blend:'dest-in'}]).png().toBuffer();
const body=await sharp(master).composite([{input:svg(repair),blend:'dest-out'},{input:maskedRepair}]).png().toBuffer();
const waist=p([660,650]),headRoot=p([780,270]);
const legs=[
 {hip:p([560,706]),knee:p([465,905]),ankle:p([285,1104]),toe:p([223,1159]),offset:.5,paintedPaw:'far-boot'},
 {hip:p([770,706]),knee:p([930,825]),ankle:p([1015,1105]),toe:p([1125,1156]),offset:0,paintedPaw:'near-boot'},
].map((leg,i)=>({...leg,center:leg.ankle[0]+(i===0?30:-20),groundAnkleY:leg.ankle[1]}));
const arms=[
 {shoulder:p([515,330]),elbow:p([385,479]),wrist:p([354,600]),grip:p([383,676])},
 {shoulder:p([871,398]),elbow:p([930,543]),wrist:p([982,521]),grip:p([1015,523])},
];
// Shoulder caps overlap inside the same shirt. Sleeves are not cut off at a
// bare edge. The two neck layers overlap in skin; the collar belongs to torso.
const definitions=[
 ['far-thigh','leg-0-upper',true,[[451,631],[661,637],[758,697],[735,774],[621,887],[498,981],[347,943],[334,889],[340,830],[431,757]]],
 ['far-shin','leg-0-lower',true,[[347,854],[553,879],[489,984],[429,1089],[379,1119],[233,1122],[220,1042],[256,982]]],
 ['far-boot','leg-0-foot',true,[[263,1063],[335,1068],[357,1113],[349,1162],[298,1193],[164,1195],[161,1140],[214,1080]]],
 ['far-upper-arm','arm-1-upper',false,[[824,282],[898,288],[929,359],[960,429],[973,473],[942,530],[935,567],[893,579],[845,558],[832,518],[817,469],[812,404],[801,354]]],
 ['far-forearm','arm-1-lower',false,[[897,504],[959,477],[990,485],[1003,530],[1005,581],[973,600],[944,596],[912,578],[887,550]]],
 ['free-hand','arm-1-hand',false,[[961,469],[1021,453],[1069,469],[1081,514],[1065,565],[1003,583],[970,555],[957,510]]],
 ['pelvis','pelvis',true,[[451,626],[811,614],[863,695],[799,798],[686,812],[598,802],[447,774]]],
 ['near-thigh','leg-1-upper',true,[[650,647],[818,625],[957,699],[1000,813],[1009,947],[889,973],[783,884],[661,791]]],
 ['near-shin','leg-1-lower',true,[[820,805],[997,812],[1030,934],[1081,1054],[1061,1137],[870,1131],[861,1035],[833,965],[810,895]]],
 ['near-boot','leg-1-foot',true,[[931,1063],[1041,1060],[1062,1091],[1136,1107],[1178,1147],[1182,1204],[1028,1211],[898,1194],[888,1139],[909,1097]]],
 ['torso','spine',false,[[698,180],[733,221],[765,250],[797,260],[841,270],[885,285],[929,404],[956,475],[865,536],[818,493],[774,552],[815,598],[826,650],[700,668],[573,649],[432,650],[438,603],[458,552],[475,477],[514,410],[498,350],[478,300],[482,255],[554,214]]],
 ['near-upper-arm','arm-0-upper',false,[[552,232],[600,287],[620,345],[583,400],[522,427],[493,467],[450,489],[435,513],[355,529],[328,482],[339,431],[364,390],[366,363],[436,310],[488,269]]],
 ['head','head',false,[[671,0],[1004,0],[1018,159],[969,229],[920,267],[868,289],[818,290],[780,300],[739,270],[706,227],[681,172]]],
 ['near-forearm','arm-0-lower',false,[[346,460],[420,456],[444,518],[394,588],[400,628],[330,642],[306,603],[318,535],[329,482]]],
 ['weapon-and-hands','weapon-0',false,[[311,575],[375,580],[398,618],[411,652],[442,635],[486,626],[545,641],[588,679],[622,729],[627,783],[590,837],[538,861],[465,875],[403,858],[367,823],[352,770],[356,720],[379,695],[364,714],[321,710],[292,686],[277,648],[290,608]]],
];
const parts=[],layers=[];let paintedSoleY=0;
for(const[name,bone,lower,polygon]of definitions){
 const clipped=await sharp(lower?body:master).composite([{input:svg(polygon),blend:'dest-in'}]).png().toBuffer();
 const masked=await sharp(clipped).resize(rw,rh,{fit:'fill'}).extend({left:tx,right:width-rw-tx,top:ty,bottom:height-rh-ty,background:'#00000000'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,masked);layers.push({input:masked});
 if(bone.endsWith('-foot')){
  const pixels=await sharp(masked).ensureAlpha().raw().toBuffer();
  for(let i=0;i<width*height;i++)if(pixels[i*4+3]>=32)paintedSoleY=Math.max(paintedSoleY,Math.floor(i/width)+1);
 }
 parts.push({name,bone,file:name+'.png',sha256:hash(masked),original:!lower,modelSource:masterPath,masterPolygon:polygon,lower});
}
const composite=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
await emit(`${dir}/combat-ready-reconstruction.png`,composite);
const expected=await sharp(master).resize(rw,rh,{fit:'fill'}).extend({left:tx,right:width-rw-tx,top:ty,bottom:height-rh-ty,background:'#00000000'}).ensureAlpha().raw().toBuffer();
const actual=await sharp(composite).ensureAlpha().raw().toBuffer();
const missing=[];
for(let i=0;i<width*height;i++)if(expected[i*4+3]>=220&&actual[i*4+3]<190)missing.push([i%width,Math.floor(i/width)]);
const coverage={source:masterPath,sourceSha256:hash(master),test:'Opaque source coverage after material separation, not naturalness acceptance',missingOpaquePixels:missing.length,
 missingBounds:missing.length?[Math.min(...missing.map(x=>x[0])),Math.min(...missing.map(x=>x[1])),Math.max(...missing.map(x=>x[0])),Math.max(...missing.map(x=>x[1]))]:null,
 sourceToLogical:{source:[mw,mh],resized:[rw,rh],translation:[tx,ty]}};
await emit(`${dir}/part-coverage.json`,JSON.stringify(coverage,null,2)+'\n');
assert.equal(missing.length,0,JSON.stringify(coverage));

const I=()=>[1,0,0,1,0,0];
const at=(a,b,angle=0)=>{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,b[0]-c*a[0]+s*a[1],b[1]-s*a[0]-c*a[1]];};
const point=(m,a)=>[m[0]*a[0]+m[2]*a[1]+m[4],m[1]*a[0]+m[3]*a[1]+m[5]];
const bones=[...new Set(parts.map(x=>x.bone))],span=64,stance=.62;
function chain(h,k,a,worldHip,target){
 const A=Math.hypot(k[0]-h[0],k[1]-h[1]),B=Math.hypot(a[0]-k[0],a[1]-k[1]);
 const dx=target[0]-worldHip[0],dy=target[1]-worldHip[1],d=Math.hypot(dx,dy);
 assert.ok(d<A+B&&d>Math.abs(A-B),'Authored combat step must remain reachable');
 const along=(A*A+d*d-B*B)/(2*d),rise=Math.sqrt(Math.max(0,A*A-along*along));
 const mid=[worldHip[0]+dx/d*along+dy/d*rise,worldHip[1]+dy/d*along-dx/d*rise];
 return[at(h,worldHip,Math.atan2(mid[1]-worldHip[1],mid[0]-worldHip[0])-Math.atan2(k[1]-h[1],k[0]-h[0])),
  at(k,mid,Math.atan2(target[1]-mid[1],target[0]-mid[0])-Math.atan2(a[1]-k[1],a[0]-k[0]))];
}
function evaluate(phase,settle,attack=false){
 const deform=Object.fromEntries(bones.map(b=>[b,I()])),walk=1-settle;
 const feet=legs.map(leg=>{const q=(phase+leg.offset)%1,t=Math.max(0,(q-stance)/(1-stance)),s=t*t*(3-2*t);
  return{q,t,target:[(leg.center+span*(q>stance?-.5+s:.5-q/stance))*walk+leg.ankle[0]*settle,
   leg.groundAnkleY-(q>stance?9*Math.sin(Math.PI*t)*walk:0)]};});
 let bob=-1.3*(1-Math.cos(phase*4*Math.PI))*walk;
 for(const[i,leg]of legs.entries()){
  const length=Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1])+Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])-.001;
  const dx=feet[i].target[0]-leg.hip[0];assert.ok(Math.abs(dx)<length);
  bob=Math.max(bob,feet[i].target[1]-leg.hip[1]-Math.sqrt(length*length-dx*dx));
 }
 const roll=.008*Math.sin(phase*2*Math.PI)*walk;
 deform.pelvis=at(waist,[waist[0],waist[1]+bob]);deform.spine=at(waist,[waist[0],waist[1]+bob],roll);
 deform.head=at(headRoot,point(deform.spine,headRoot),roll+.004*Math.sin(phase*4*Math.PI)*walk);
 for(const[i,leg]of legs.entries()){
  const m=chain(leg.hip,leg.knee,leg.ankle,point(deform.pelvis,leg.hip),feet[i].target);
  deform[`leg-${i}-upper`]=m[0];deform[`leg-${i}-lower`]=m[1];
  deform[`leg-${i}-foot`]=at(leg.ankle,feet[i].target,feet[i].q>stance?-.09*Math.sin(Math.PI*feet[i].t)*walk:0);
 }
 for(const[i]of arms.entries()){
  deform[`arm-${i}-upper`]=[...deform.spine];deform[`arm-${i}-lower`]=[...deform.spine];deform[i===0?'weapon-0':'arm-1-hand']=[...deform.spine];
 }
 if(attack){deform.spine=I();deform.head=I();}
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const old=JSON.parse(await readFile('assets/source/v100/joints/kumaverson-r1/parts.json'));
// Register the new painting against the canonical combat-ready footprint.
// Reusing the walking study's old frame left the new sneakers above the road.
const referencePixels=await sharp(`${dir}/combat-ready-reference.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let referenceTop=Infinity,referenceBottom=-Infinity,sourceTop=Infinity;
for(let i=0;i<referencePixels.info.width*referencePixels.info.height;i++)if(referencePixels.data[i*4+3]>=128){
 const y=Math.floor(i/referencePixels.info.width);referenceTop=Math.min(referenceTop,y);referenceBottom=Math.max(referenceBottom,y+1);
}
for(let i=0;i<width*height;i++)if(expected[i*4+3]>=128)sourceTop=Math.min(sourceTop,Math.floor(i/width));
const referenceScale=(paintedSoleY-sourceTop)/(referenceBottom-referenceTop);
const canonicalWaistX=(old.rig.spine[0][0]-old.referenceFrame.tx)/old.referenceFrame.scale;
const referenceFrame={...old.referenceFrame,scale:referenceScale,tx:waist[0]-referenceScale*canonicalWaistX,ty:paintedSoleY-referenceScale*old.referenceFrame.height*spriteFrameFor('kumaverson','walk-a','right').anchorY};
const portrait='/art/v100/portraits/kumaverson-warm-stage-r1.webp';
const d={schema:'zombieee-authored-combat-parts/1',kind:'kumaverson',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',
 sourceSha256:hash(master),sheetSha256:hash(under),modelSource:masterPath,parts:parts.map(part=>Object.fromEntries(Object.entries(part).filter(([key])=>key!=='lower'))),order:parts.map(x=>x.name),lowerLayers:parts.filter(x=>x.lower).map(x=>x.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,
 identityBinding:{path:portrait,sourceSha256:hash(await readFile('public'+portrait)),modelSource:identityPath,modelSha256:hash(await readFile(identityPath)),combatSource:masterPath,combatSha256:hash(master)},
 referenceFrame,interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].wrist,'arm-1-hand':arms[1].wrist},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 motion:{walk:{spanPx:span,liftPx:9,stanceFraction:stance,groundY:paintedSoleY},paintBounds:{x:0,y:0,w:width,h:height}},
 muzzle:p([579,782]),weaponBone:'weapon-0',rig:{root:[240,432],pelvis:[waist,[waist[0],waist[1]-20]],spine:[waist,p([754,327])],head:[headRoot,p([847,138])],legs,arms,attack:old.rig.attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:i===0?'weapon-0':'arm-1-hand',shoulder:a.shoulder,elbow:a.elbow,wrist:a.wrist,grip:a.grip})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{modelRoles:'Adopted master-r2 identity; producer-master-v2 combat design and ready pose. One generated combat model supplies all visible body paint.',
  faceNeckShoulders:'Same combat-model pixels; collar retained in torso, neck overlaps within skin, shoulder caps overlap within shirt.',
  clothRepair:'Saved built-in edit only in declared pan-occluded trouser polygon with seam overlap.',sourceToLogical:coverage.sourceToLogical,repairPolygon:repair,
  frameRegistration:{paintedSoleY,sourceTop,canonicalReadyTop:referenceTop,canonicalReadyBottom:referenceBottom,canonicalWaistX},
  locomotion:'Combat step retains rear/lead ordering; rear centre advances30 and lead centre retreats20 logical pixels from their ready ankles.',acceptance:false}};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(d,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'kumaverson',status:'source-pixel-2d-combat-candidate',motion:d.motion,rig:d.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/kumaverson-combat-r4.webp',dataFile:null,captureAtlas:a=>{atlas=a;},generator:'scripts/build-quality-kumaverson-combat-r4.mjs',
 description:'Generated coherent combat model bound to adopted master-r2 identity and original producer combat clothing/ready stance. Deterministic 2D kinematics, not a Blender execution. Visible head/neck/shoulder paint retained from one combat source; only hidden trouser repair is separate. Motion, all48, normal-play and human acceptance pending.',check});
await emit('app/qualityKumaversonCombatJointData.js','// Generated coherent combat model; deterministic 2D kinematics, not Blender.\nexport const QUALITY_KUMAVERSON_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
