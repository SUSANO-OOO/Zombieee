// RAIDER's complete combat paint, with source-bound hidden cloth and fixed-length joints.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {buildRigidJointAtlas} from './build-v177-rigid-joint-atlas.mjs';

const check=process.argv.includes('--check');
const dir='assets/source/quality-20261028/rigs/gunner-combat-r1';
const modelPath=`${dir}/combat-model-r1.png`,underPath=`${dir}/body-underpainting-r1.png`;
const model=await readFile(modelPath),under=await readFile(underPath);
const {width:mw,height:mh}=await sharp(model).metadata();
const underRegistered=await sharp(under).resize(mw,mh,{fit:'fill'}).png().toBuffer();
const width=480,height=448,p=([x,y])=>[x*width/mw,y*height/mh];
const hash=b=>createHash('sha256').update(b).digest('hex');
const emit=async(f,b)=>{b=Buffer.from(b);if(check)assert.deepEqual(await readFile(f),b,f);else await writeFile(f,b);};
const mask=points=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><polygon fill="white" points="${points.map(p=>p.join(',')).join(' ')}"/></svg>`);
const clip=async(source,poly)=>sharp(source).composite([{input:mask(poly),blend:'dest-in'}]).png().toBuffer();
const near={"shoulder":[454,260],"elbow":[391,418],"wrist":[532,464],"grip":[607,493]},far={"shoulder":[708,290],"elbow":[757,450],"wrist":[866,552],"grip":[891,577]};
const definitions=[["far-upper-arm","arm-1-upper",false,"model",[[688,238],[718,247],[741,276],[745,316],[750,359],[769,405],[796,433],[787,461],[760,472],[729,456],[709,414],[698,365],[688,322]]],["far-forearm","arm-1-lower",false,"farForearm",null],["far-thigh","leg-0-upper",true,"model",[[568,573],[630,565],[681,599],[715,653],[760,700],[804,741],[839,785],[844,834],[824,868],[781,886],[742,861],[697,815],[652,766],[609,717],[557,653]]],["far-shin","leg-0-lower",true,"model",[[762,811],[827,810],[850,852],[857,907],[861,955],[879,1008],[879,1055],[843,1082],[789,1086],[768,1053],[744,1002],[736,949],[730,902],[737,858]]],["far-boot","leg-0-foot",true,"model",[[783,1054],[863,1043],[877,1083],[902,1113],[951,1114],[983,1135],[1000,1165],[977,1186],[891,1183],[822,1182],[769,1167],[765,1139],[777,1095]]],["near-thigh","leg-1-upper",true,"model",[[442,557],[514,549],[565,588],[583,631],[571,685],[544,739],[521,791],[500,846],[469,886],[426,893],[395,877],[390,836],[405,792],[410,738],[415,678],[420,616]]],["near-shin","leg-1-lower",true,"model",[[408,818],[468,824],[505,859],[481,904],[440,944],[400,993],[367,1042],[338,1069],[293,1057],[275,1030],[280,990],[312,940],[354,891]]],["near-boot","leg-1-foot",true,"registeredBoot",null],["pelvis","pelvis",true,"under",[[434,461],[517,476],[589,499],[661,508],[696,539],[703,589],[673,634],[618,661],[557,663],[492,644],[435,661],[395,629],[391,576],[410,510]]],["torso","spine",false,"under",[[503,189],[551,188],[590,209],[627,218],[658,212],[698,233],[694,292],[706,337],[702,386],[688,433],[672,469],[677,513],[641,528],[574,519],[518,503],[460,484],[448,466],[474,418],[481,369],[463,333],[471,282],[479,236]]],["head","head",false,"model",[[513,188],[501,144],[507,97],[533,50],[577,21],[633,15],[680,36],[714,69],[721,105],[707,147],[694,177],[672,198],[641,217],[614,244],[578,232],[553,205],[533,197]]],["near-upper-arm","arm-0-upper",false,"model",[[427,223],[463,213],[493,236],[492,278],[470,321],[445,358],[424,396],[405,431],[378,444],[351,429],[343,409],[359,363],[383,317],[403,270]]],["near-forearm","arm-0-lower",false,"model",[[365,389],[398,384],[432,410],[476,425],[514,432],[540,448],[542,475],[517,489],[481,478],[442,469],[404,456],[367,443],[348,426],[348,410]]],["weapon-and-hands","weapon-0",false,"model",[[451,356],[479,345],[507,363],[585,391],[655,416],[669,382],[693,379],[714,404],[713,425],[790,454],[818,460],[831,476],[871,489],[880,516],[1040,585],[1063,582],[1082,600],[1108,620],[1149,634],[1177,644],[1176,665],[1152,673],[1100,650],[1069,639],[1039,644],[1020,627],[936,598],[918,615],[886,616],[852,599],[834,582],[822,617],[807,657],[760,670],[698,644],[680,623],[696,573],[707,535],[679,521],[653,526],[637,514],[614,542],[573,531],[538,515],[514,493],[494,471],[494,436],[475,415],[449,411]]]];
async function register(poly,a,b,c,d){
 const angle=Math.atan2(d[1]-c[1],d[0]-c[0])-Math.atan2(b[1]-a[1],b[0]-a[0]);
 const scale=Math.hypot(d[0]-c[0],d[1]-c[1])/Math.hypot(b[0]-a[0],b[1]-a[1]);
 const co=Math.cos(angle)*scale,si=Math.sin(angle)*scale;
 const matrix=[co,si,-si,co,c[0]-co*a[0]+si*a[1],c[1]-si*a[0]-co*a[1]];
 const bytes=await clip(model,poly);
 const paint=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}"><image width="${mw}" height="${mh}" transform="matrix(${matrix.join(' ')})" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>`)).png().toBuffer();
 return{paint,matrix};
}

const farForearm=await register(definitions.find(d=>d[0]==='near-forearm')[4],near.elbow,near.wrist,far.elbow,far.wrist);
const bootPaint=await clip(model,definitions.find(d=>d[0]==='far-boot')[4]);
const registeredBoot=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+mw+'" height="'+mh+'"><image width="'+mw+'" height="'+mh+'" transform="translate(-520 12)" href="data:image/png;base64,'+bootPaint.toString('base64')+'"/></svg>')).png().toBuffer();
const parts=[],layers=[];
for(const[name,bone,lower,source,polygon]of definitions){
 const registered=source==='registeredBoot'?{paint:registeredBoot,matrix:[1,0,0,1,-520,12]}:source==='farForearm'?farForearm:null;
 const bytes=registered?.paint??await clip(source==='under'?underRegistered:model,polygon);
 const clipped=await sharp(bytes).resize(width,height,{fit:'fill'}).png().toBuffer();
 await emit(`${dir}/${name}.png`,clipped);layers.push({input:clipped});
 parts.push({name,bone,file:`${name}.png`,sha256:hash(clipped),source,masterPolygon:polygon,lower,...(registered?{sourceTransform:registered.matrix}:{})});
}
await emit(`${dir}/identity-reference.png`,model);
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
const waist=p([567,524]),headRoot=p([603,220]);
const legs=[{"hip":[633,622],"knee":[801,817],"ankle":[824,1092],"toe":[965,1160],"offset":0.5,"center":293,"paintedPaw":"far-boot"},{"hip":[482,612],"knee":[446,859],"ankle":[304,1104],"toe":[445,1172],"offset":0,"center":180,"paintedPaw":"near-boot"}].map(l=>({...l,hip:p(l.hip),knee:p(l.knee),ankle:p(l.ankle),toe:p(l.toe),groundAnkleY:p(l.ankle)[1]}));
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
const old=JSON.parse(await readFile('assets/source/v100/joints/gunner-r1/parts.json'));
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
 const recoil=firing&&phase>.28&&phase<.7?5*Math.sin(Math.PI*(phase-.28)/.42):0;
 deform['weapon-0']=multiply(deform.spine,at(grip,[grip[0]-10+2*swing+8*amount-recoil,grip[1]-10-.5*Math.abs(swing)-14*amount],-.015*swing-.34*amount));
 for(const[i,a]of arms.entries()){
  const m=chain(a.shoulder,a.elbow,a.wrist,point(deform.spine,a.shoulder),point(deform['weapon-0'],a.wrist),-1,true);
  deform[`arm-${i}-upper`]=m.upper;deform[`arm-${i}-lower`]=m.lower;
 }
 return{bones:{root:{head:[240,432]},pelvis:{head:[waist[0],waist[1]+bob]}},deform};
}
const descriptor={schema:'zombieee-authored-combat-parts/1',kind:'gunner',status:'candidate-not-motion-or-producer-accepted',width,height,paintStyle:'source-pixel-combat-model',sourceSha256:hash(model),sheetSha256:hash(under),modelSource:modelPath,
 parts:parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='lower'))),order:parts.map(p=>p.name),lowerLayers:parts.filter(p=>p.lower).map(p=>p.name),pelvisY:waist[1],upperFollowsPelvis:true,reserveBipedLanding:true,atlasPacking:'height-descending-shelves',atlasPartPadding:3,
 identityBinding:{...old.identityBinding,modelSource:'assets/source/quality-20261028/identity/raider-master-r4.png',modelSha256:hash(await readFile('assets/source/quality-20261028/identity/raider-master-r4.png')),combatSource:modelPath,combatSha256:hash(model)},
 interpolationPivots:{spine:waist,head:headRoot,'weapon-0':arms[0].grip},parentAttachments:{head:{parent:'spine',pivot:headRoot}},
 referenceFrame:{width,height,scale:1,tx:0,ty:soleY-432},
 motion:{walk:{spanPx:span,liftPx:lift,stanceFraction:stance,groundY:soleY},paintBounds:{x:0,y:0,w:width,h:height}},muzzle:p([1154,647]),weaponBone:'weapon-0',
 rig:{root:[240,432],pelvis:[waist,[235,183]],spine:[waist,p([567,344])],head:[headRoot,p([633,130])],legs,arms,firearm:true,weapons:[{name:'weapon-0',a:arms[0].grip,b:p([1154,647]),armIndex:0,supportArm:1}],attack},
 armConstraints:arms.map((a,i)=>({parentBone:'spine',upperBone:`arm-${i}-upper`,lowerBone:`arm-${i}-lower`,effectorBone:'weapon-0',...a})),
 legConstraints:legs.map((l,i)=>({parentBone:'pelvis',parentUpper:false,upperBone:`leg-${i}-upper`,lowerBone:`leg-${i}-lower`,effectorBone:`leg-${i}-foot`,hip:l.hip,knee:l.knee,ankle:l.ankle})),
 sourceOperation:{body:'Complete adopted-model repaint, not a head-only replacement',underpainting:underPath,underpaintingSha256:hash(under),hiddenBody:'Source-bound chest, belt and coat underpainting beneath moving arms and blade',weapon:'Both hands and the complete belt-fed machine gun share one transform',sourceToLogical:{source:[mw,mh],resized:[width,height]},acceptance:false},
};
const actions=['walk','settle-1','settle-2','settle-3'].map((name,i)=>({name,frames:Array.from({length:60},(_,n)=>evaluate(n/60,i/3))}));
actions.push({name:'attack',frames:Array.from({length:61},(_,n)=>evaluate(n/60,1,true))});
await emit(`${dir}/parts.json`,JSON.stringify(descriptor,null,2)+'\n');
await emit(`${dir}/motion.json.gz`,gzipSync(JSON.stringify({kind:'gunner',motion:descriptor.motion,rig:descriptor.rig,actions})));
let atlas;
const result=await buildRigidJointAtlas({sourceDirectory:dir,assetPath:'/art/v100/joints/gunner-combat-r1.webp',captureAtlas:a=>atlas=a,generator:'scripts/build-quality-gunner-combat-r1.mjs',description:'Complete Raider body from current generated master with hidden-cloth underpainting; both hands share the held weapon transform. Deterministic fixed-length 2D kinematics, not Blender execution. Motion and human acceptance pending.',check});
await emit('app/qualityRaiderCombatJointData.js','// Generated complete RAIDER combat paint and deterministic 2D kinematics.\nexport const QUALITY_RAIDER_COMBAT_ATLAS = '+JSON.stringify(atlas)+';\n');
console.log(JSON.stringify({check,...result}));
