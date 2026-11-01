// Mizuchi repaint registered to the existing continuous cloth/manual-aim rig.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {V177_JOINT_ATLASES} from '../app/v177JointData.js';
import {createV177RangerLowerPainter,paintV177RangerLower} from '../app/v177RangerLowerPaint.js';
import {v177RangerLowerBob} from '../app/v177RangerLowerMotion.js';
const dir='assets/source/quality-20261028/rigs/ranger-combat-r1',check=process.argv.includes('--check');
const sha=b=>createHash('sha256').update(b).digest('hex');
const emit=async(file,data)=>{const b=Buffer.from(data);if(check)assert.deepEqual(await readFile(file),b,file);else await writeFile(file,b);};
const model=await readFile(`${dir}/combat-model-r1.png`),under=await readFile(`${dir}/body-underpainting-r1.png`);
const primaryPath='assets/source/quality-20261028/identity/mizuchi-master-r4.png',primary=await readFile(primaryPath);
const meta=await sharp(model).metadata(),masterMeta=await sharp(primary).metadata();
assert.equal(meta.width,1298);assert.equal(meta.height,1212);
const underRegistered=await sharp(under).resize(meta.width,meta.height,{fit:'fill'}).png().toBuffer();
const old=V177_JOINT_ATLASES.ranger,sourceDefinition=JSON.parse(await readFile('assets/source/v100/joints/ranger-r1/parts.json'));
const p=([x,y])=>[x/1298*480,y/1212*448];
function inverse([a,b,c,d,e,f]){const det=a*d-b*c;assert.ok(Math.abs(det)>1e-8);return[d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];}
function mul(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function registration(src,dst){
 if(src.length===3){const basis=v=>[v[1][0]-v[0][0],v[1][1]-v[0][1],v[2][0]-v[0][0],v[2][1]-v[0][1],...v[0]];return mul(basis(dst),inverse(basis(src)));}
 const[a,b]=src,[c,d]=dst,angle=Math.atan2(d[1]-c[1],d[0]-c[0])-Math.atan2(b[1]-a[1],b[0]-a[0]);
 const scale=Math.hypot(d[0]-c[0],d[1]-c[1])/Math.hypot(b[0]-a[0],b[1]-a[1]),co=Math.cos(angle)*scale,si=Math.sin(angle)*scale;
 return[co,si,-si,co,c[0]-co*a[0]+si*a[1],c[1]-si*a[0]-co*a[1]];
}
const bodySrc=[[590,290],[760,290],[650,610]],bodyDst=[[208,110],[253,114],[232.5,228.5]];
const masterPoint=([x,y])=>[x/856*masterMeta.width,y/1812*masterMeta.height];
// Retarget cloth through the original strip mesh; a single three-point affine
// would shear the complete trouser leg when the authored knee bend differs.
async function registerCloth(bytes,name,anchors){
 const leg=old.lowerRig.legs.find(l=>l.name===name),target=leg.sourcePositions,source=[];
 const [hip,knee,ankle]=anchors.map(p),rings=[-.3,0,.2,.4,.6,.8,1,.2,.4,.6,.8,1,1.2];
 for(let row=0;row<13;row++){
  const upper=row<=6,a=upper?hip:knee,b=upper?knee:ankle,t=rings[row],center=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  let dx=b[0]-a[0],dy=b[1]-a[1];if(row===6){dx=ankle[0]-hip[0];dy=ankle[1]-hip[1];}
  const length=Math.hypot(dx,dy),oldCenter=[target[row*10+4],target[row*10+5]];
  for(let col=0;col<5;col++){const at=row*10+col*2,distance=Math.hypot(target[at]-oldCenter[0],target[at+1]-oldCenter[1])*Math.sign(col-2);source.push(center[0]+distance*dy/length,center[1]-distance*dx/length);}
 }
 const input=await sharp(bytes).resize(480,448,{fit:'fill'}).ensureAlpha().raw().toBuffer(),out=Buffer.alloc(input.length);
 for(let t=0;t<leg.triangles.length;t+=3){
  const ids=leg.triangles.slice(t,t+3),v=ids.map(i=>[target[i*2],target[i*2+1]]),s=ids.map(i=>[source[i*2],source[i*2+1]]);
  const [a,b,c]=v,det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-9)continue;
  for(let y=Math.max(0,Math.floor(Math.min(...v.map(q=>q[1]))));y<Math.min(448,Math.ceil(Math.max(...v.map(q=>q[1]))));y++)for(let x=Math.max(0,Math.floor(Math.min(...v.map(q=>q[0]))));x<Math.min(480,Math.ceil(Math.max(...v.map(q=>q[0]))));x++){
   const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/det,w=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/det,z=1-u-w;if(Math.min(u,w,z)<-1e-7)continue;
   const sx=u*s[0][0]+w*s[1][0]+z*s[2][0]-.5,sy=u*s[0][1]+w*s[1][1]+z*s[2][1]-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
   let alpha=0;const color=[0,0,0];for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){if(ix+xx<0||ix+xx>=480||iy+yy<0||iy+yy>=448)continue;const at=((iy+yy)*480+ix+xx)*4,weight=(xx?fx:1-fx)*(yy?fy:1-fy)*input[at+3]/255;alpha+=weight;for(let k=0;k<3;k++)color[k]+=input[at+k]*weight;}
   const to=(y*480+x)*4;for(let k=0;k<3;k++)out[to+k]=alpha?Math.round(color[k]/alpha):0;out[to+3]=Math.round(alpha*255);
  }
 }
 return sharp(out,{raw:{width:480,height:448,channels:4}}).png().toBuffer();
}
const definitions=[
 ['far-upper-arm','primary',[[548,366],[631,353],[661,430],[662,583],[643,634],[564,630],[550,550]],[[595,402],[610,620]],[[253,114],[260,173]]],
 ['far-forearm','primary',[[554,609],[650,601],[658,702],[655,803],[646,886],[580,893],[566,796],[563,702]],[[610,635],[617,880]],[[260,173],[283,191]]],
 ['far-pants','under',[[556,555],[665,565],[705,637],[656,731],[615,810],[579,873],[519,930],[456,1015],[433,1043],[376,1015],[406,937],[447,856],[492,770],[530,687]],[[598,640],[548,837],[397,1102]],[[224,227],[202,306],[158,398]]],
 ['far-boot','model',[[353,987],[437,985],[452,1016],[444,1075],[452,1115],[470,1132],[511,1134],[525,1187],[455,1207],[327,1187],[323,1151],[340,1081]],[[397,1102],[478,1175]],[[158,398],[197,428]]],
 ['near-pants','under',[[552,553],[649,546],[703,598],[728,666],[758,738],[791,790],[803,830],[786,896],[805,959],[832,1005],[817,1040],[750,1052],[705,989],[690,915],[688,853],[658,803],[616,744],[572,680],[545,615]],[[643,611],[746,830],[815,1104]],[[241,230],[260,307],[290,398]]],
 ['near-boot','model',[[750,1011],[826,992],[848,1026],[852,1090],[887,1125],[945,1138],[976,1176],[969,1199],[908,1211],[768,1199],[755,1163],[764,1110]],[[815,1104],[926,1175]],[[290,398],[328,428]]],
 ['pelvis','under',[[546,495],[710,493],[778,550],[754,594],[721,626],[699,664],[611,657],[553,626],[536,580],[528,537]],bodySrc,bodyDst],
 ['torso','under',[[575,220],[643,195],[693,202],[751,222],[789,266],[807,324],[796,382],[763,437],[753,505],[787,557],[726,565],[686,539],[642,549],[573,544],[524,519],[551,479],[581,442],[585,384],[567,336],[553,278]],bodySrc,bodyDst],
 ['head','model',[[617,192],[609,142],[622,91],[657,51],[713,34],[766,47],[804,69],[808,114],[798,145],[790,166],[786,193],[767,210],[739,217],[722,239],[696,245],[670,218]],[[700,217],[719,90]],[[230.5,99],[245,48]]],
 ['near-upper-arm','model',[[554,275],[591,268],[617,295],[601,335],[579,370],[559,411],[549,435],[510,443],[478,426],[472,400],[493,350],[526,302]],[[579,292],[513,414]],[[208,110],[188,144]]],
 ['near-forearm','model',[[488,388],[528,386],[574,408],[620,416],[642,431],[632,461],[602,475],[552,460],[509,443],[480,422]],[[513,414],[635,446]],[[188,144],[224,158]]],
 ['weapon','model',[[576,343],[615,300],[650,326],[701,379],[750,399],[789,397],[819,425],[851,473],[878,492],[874,526],[902,569],[933,617],[947,658],[982,693],[1018,729],[1065,774],[1059,801],[1035,805],[1005,778],[966,740],[940,703],[920,669],[889,644],[859,633],[829,624],[802,604],[790,581],[768,602],[744,621],[702,599],[723,538],[702,515],[674,511],[644,499],[633,477],[618,453],[609,439],[588,424],[577,391],[562,371]],[[635,446],[822,560],[1043,786]],[[224,158],[283,191],[358,260]]],
];
const parts=[],layers=[];
for(const[name,which,polygon,anchors,target]of definitions){
 const primarySource=which==='primary',source=primarySource?primary:which==='under'?underRegistered:model;
 const dims=primarySource?masterMeta:meta,poly=primarySource?polygon.map(masterPoint):polygon;
 const mask=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}"><polygon fill="white" points="${poly.map(v=>v.join(',')).join(' ')}"/></svg>`);
 const clipped=await sharp(source).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
 const matrix=registration(primarySource?anchors.map(masterPoint):anchors,target);
 const bytes=name.endsWith('-pants')?await registerCloth(clipped,name,anchors):await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="448"><image width="${dims.width}" height="${dims.height}" transform="matrix(${matrix.join(' ')})" href="data:image/png;base64,${clipped.toString('base64')}"/></svg>`)).png().toBuffer();
 await emit(`${dir}/${name}.png`,bytes);layers.push({input:bytes});
 parts.push({...sourceDefinition.parts.find(v=>v.name===name),file:`${name}.png`,sha256:sha(bytes),original:false,source:which,masterPolygon:polygon,registration:{method:name.endsWith('-pants')?'width-preserving-source-strip':'affine',anchors,target,...(name.endsWith('-pants')?{}:{matrix})}});
}
await emit(`${dir}/combat-ready-reconstruction.png`,await sharp({create:{width:480,height:448,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());
await emit(`${dir}/parts.json`,JSON.stringify({...sourceDefinition,parts,sourceSha256:sha(model),identityBinding:{primary:primaryPath,primarySha256:sha(primary),combatModel:`${dir}/combat-model-r1.png`,combatSha256:sha(model)},geometrySource:'assets/source/v100/joints/ranger-r1/parts.json',note:'New complete paint registered to original hybrid geometry; original photo/reference not distributed.'},null,2)+'\n');

// Build crops first. Geometry, IK, foot-history, manual aim and bounded painter remain intact.
const rows=[];
for(const part of parts){
 const bytes=await readFile(`${dir}/${part.file}`),raw=await sharp(bytes).ensureAlpha().raw().toBuffer();let x0=480,y0=448,x1=-1,y1=-1;
 for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(raw[(y*480+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 assert.ok(x1>=x0&&y1>=y0,part.name);x0=Math.max(0,x0-2);y0=Math.max(0,y0-2);x1=Math.min(479,x1+2);y1=Math.min(447,y1+2);
 const destination={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1},lower=sourceDefinition.lowerLayers.includes(part.name),scale=lower?1:.5;
 const w=Math.ceil(destination.w*scale),h=Math.ceil(destination.h*scale);
 const pixels=await sharp(bytes).extract({left:x0,top:y0,width:destination.w,height:destination.h}).resize(w,h,{kernel:'cubic'}).raw().toBuffer();
 rows.push({name:part.name,bone:part.bone??null,destination,source:{x:0,y:0,w,h},lower,pixels});
}
function pack(items){let x=2,y=2,rowH=0;for(const row of [...items].sort((a,b)=>b.source.h-a.source.h)){const s=row.source;assert.ok(s.w+4<=1024);if(x+s.w+2>1024){x=2;y+=rowH+2;rowH=0;}s.x=x;s.y=y;x+=s.w+2;rowH=Math.max(rowH,s.h);}const height=y+rowH+2,rgba=Buffer.alloc(1024*height*4);for(const r of items)for(let yy=0;yy<r.source.h;yy++)r.pixels.copy(rgba,((r.source.y+yy)*1024+r.source.x)*4,yy*r.source.w*4,(yy+1)*r.source.w*4);return{width:1024,height,rgba};}
const crops=pack(rows),lowerRig={...structuredClone(old.lowerRig),parts:rows.filter(r=>r.lower).map(({pixels,lower,...r})=>{void pixels;void lower;return r;})};
function surface(){const canvas={width:0,height:0,data:null};let crop;const ctx={clearRect(){},drawImage(image,x,y,w,h){crop={image,x,y,w,h};},getImageData(){const data=new Uint8ClampedArray(crop.w*crop.h*4);for(let y=0;y<crop.h;y++)for(let x=0;x<crop.w;x++){const at=((crop.y+y)*crop.image.naturalWidth+crop.x+x)*4;data.set(crop.image.pixels.subarray(at,at+4),(y*crop.w+x)*4);}return{data};},createImageData(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},putImageData(d){canvas.data=d;}};canvas.getContext=()=>ctx;return canvas;}
const painter=createV177RangerLowerPainter({naturalWidth:1024,naturalHeight:crops.height,pixels:crops.rgba},lowerRig,surface),frames=[];
for(let settleIndex=0;settleIndex<4;settleIndex++)for(let i=0;i<30;i++){
 let frame;const scale=.4,ctx={canvas:{width:480,height:448},getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),save(){},restore(){},setTransform(){},drawImage(canvas,sx,sy,w,h,x,y){void sx;void sy;const pixels=Buffer.alloc(w*h*4);for(let yy=0;yy<h;yy++)Buffer.from(canvas.data.data.buffer).copy(pixels,yy*w*4,yy*canvas.data.width*4,yy*canvas.data.width*4+w*4);frame={source:{x:0,y:0,w,h},destination:{x:x/scale,y:y/scale,w:w/scale,h:h/scale},pixels};}};
 const receipt=paintV177RangerLower(painter,ctx,i/30,settleIndex/3,0,0,480*scale,448*scale);assert.equal(receipt.mode,'continuous-weighted-mesh');assert.ok(frame);frames.push(frame);
}
// Every legacy fallback is repainted, including the upper fallback frames.
for(const pose of old.upperRig.poses){
 const images=await Promise.all(rows.filter(r=>!r.lower).map(async r=>{const bytes=await readFile(`${dir}/${r.name}.png`);return `<image width="480" height="448" transform="matrix(${pose[r.bone].join(' ')})" href="data:image/png;base64,${bytes.toString('base64')}"/>`;}));
 const png=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="448">${images.join('')}</svg>`)).trim().png().toBuffer({resolveWithObject:true});
 const w=Math.ceil(png.info.width*.4),h=Math.ceil(png.info.height*.4),pixels=await sharp(png.data).resize(w,h).raw().toBuffer();
 frames.push({source:{x:0,y:0,w,h},destination:{x:-png.info.trimOffsetLeft,y:-png.info.trimOffsetTop,w:png.info.width,h:png.info.height},pixels});
}
assert.equal(frames.length,152);const atlas=pack([...rows,...frames]);assert.ok(atlas.rgba.length<=6*1024*1024);
const strip=({pixels,lower,...r})=>{void pixels;void lower;return r;};
lowerRig.parts=rows.filter(r=>r.lower).map(strip);
const upperRig={...structuredClone(old.upperRig),parts:rows.filter(r=>!r.lower).map(r=>({...strip(r),upper:true}))};
const path='/art/v100/joints/ranger-combat-r1.webp',asset=await sharp(atlas.rgba,{raw:{width:atlas.width,height:atlas.height,channels:4}}).webp({lossless:true,exact:true,effort:6}).toBuffer();
const result={...structuredClone(old),path,decodedWidth:atlas.width,decodedHeight:atlas.height,decodedBytes:atlas.rgba.length,upperRig,lowerRig,frames:frames.map(strip),pelvisOffsets:Array.from({length:4},(_,s)=>Array.from({length:30},(_,i)=>v177RangerLowerBob(i/30,s/3)))};
const data=Buffer.from('// Generated by scripts/build-quality-ranger-combat-r1.mjs; complete Mizuchi paint on preserved hybrid geometry.\nexport const QUALITY_RANGER_COMBAT_ATLAS='+JSON.stringify(result)+';\n');
await emit('public'+path,asset);await emit('app/qualityRangerCombatJointData.js',data);
await emit(`${dir}/provenance.json`,JSON.stringify({schema:'zombieee-quality-ranger-hybrid/1',primary:{path:primaryPath,sha256:sha(primary)},modelSha256:sha(model),underpaintingSha256:sha(under),geometrySource:'app/v177JointData.js',geometrySha256:sha(await readFile('app/v177JointData.js')),asset:{path,bytes:asset.length,sha256:sha(asset),decodedBytes:atlas.rgba.length},parts:parts.map(({name,file,sha256,source,registration})=>({name,file,sha256,source,registration})),fallbacks:{lower:120,upper:32,allRepainted:true},generatorSha256:sha(await readFile(new URL(import.meta.url))),runtimeAcceptance:false,humanAcceptance:false},null,2)+'\n');
console.log(JSON.stringify({check,path,bytes:asset.length,sha256:sha(asset),decoded:[atlas.width,atlas.height],frames:frames.length,parts:parts.length}));
