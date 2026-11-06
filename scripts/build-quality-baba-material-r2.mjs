import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {QUALITY_CHARACTER_HEAD_ATLASES} from '../app/qualityCharacterAtlases.js';
import {withQualitySidearmAtlas} from '../app/qualitySidearmAtlas.js';
const root='assets/source/quality-20261028/babayaga-material-r2',oldRoot='assets/source/v100/joints/babayaga-r1';
const d=JSON.parse(await readFile(oldRoot+'/parts.json')),atlas=withQualitySidearmAtlas('babayaga',QUALITY_CHARACTER_HEAD_ATLASES.babayaga),hash=b=>createHash('sha256').update(b).digest('hex');
const tie=[[250,120],[258,120],[263,141],[266,165],[272,187],[274,207],[268,211],[261,201],[256,179],[252,154]];
function inside(x,y){let yes=false;for(let i=0,j=tie.length-1;i<tie.length;j=i++){const a=tie[i],b=tie[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const ref=await sharp(oldRoot+'/identity-reference.png').ensureAlpha().raw().toBuffer(),torso=await sharp(oldRoot+'/torso.png').ensureAlpha().raw().toBuffer();
for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(inside(x+.5,y+.5))ref.copy(torso,(y*480+x)*4,(y*480+x)*4,(y*480+x+1)*4);
const frames={torso:await sharp(torso,{raw:{width:480,height:448,channels:4}}).png().toBuffer()};
for(const name of ['far-upper-arm','far-forearm']){
 const p=d.parts.find(p=>p.name===name),r=p.studyRect,a=p.sourceAxis,b=p.restAxis;
 const cell=await sharp(oldRoot+'/'+p.studyFile).extract({left:r[0],top:r[1],width:r[2],height:r[3]}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const sx=a[1][0]-a[0][0],sy=a[1][1]-a[0][1],sl=Math.hypot(sx,sy),u=[sx/sl,sy/sl],v=[-u[1],u[0]],tx=b[1][0]-b[0][0],ty=b[1][1]-b[0][1],tl=Math.hypot(tx,ty),U=[tx/tl,ty/tl],V=[-U[1],U[0]];
 let lo=Infinity,hi=-Infinity;for(let y=0;y<r[3];y++)for(let x=0;x<r[2];x++)if(cell.data[(y*r[2]+x)*4+3]>=32){const q=(x+r[0]-a[0][0])*v[0]+(y+r[1]-a[0][1])*v[1];lo=Math.min(lo,q);hi=Math.max(hi,q);}
 const L=tl/sl,W=p.targetWidth/(hi-lo),m=[U[0]*u[0]*L+V[0]*v[0]*W,U[1]*u[0]*L+V[1]*v[0]*W,U[0]*u[1]*L+V[0]*v[1]*W,U[1]*u[1]*L+V[1]*v[1]*W];
 m.push(b[0][0]-m[0]*(a[0][0]-r[0])-m[2]*(a[0][1]-r[1]),b[0][1]-m[1]*(a[0][0]-r[0])-m[3]*(a[0][1]-r[1]));
 const png=await sharp(cell.data,{raw:cell.info}).png().toBuffer();frames[name]=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="480" height="448"><image width="${r[2]}" height="${r[3]}" transform="matrix(${m.join(' ')})" xlink:href="data:image/png;base64,${png.toString('base64')}"/></svg>`)).png().toBuffer();
}
const gunPath=root+'/tti-style-suppressed-pistol-r2.png',gun=await readFile(gunPath),info=await sharp(gun).metadata(),fromA=[422,500],fromB=[1760,224],toA=d.armConstraints[0].grip,toB=atlas.muzzle;
const sx=fromB[0]-fromA[0],sy=fromB[1]-fromA[1],dx=toB[0]-toA[0],dy=toB[1]-toA[1],den=sx*sx+sy*sy,A=(dx*sx+dy*sy)/den,B=(dy*sx-dx*sy)/den,M=[A,B,-B,A,toA[0]-A*fromA[0]+B*fromA[1],toA[1]-B*fromA[0]-A*fromA[1]];
frames['weapon-and-hands']=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="480" height="448"><image width="${info.width}" height="${info.height}" transform="matrix(${M.join(' ')})" xlink:href="data:image/png;base64,${gun.toString('base64')}"/></svg>`)).png().toBuffer();
// The free left wrist keeps its original same-person hand, rather than a
// second wrist pretending to grip the single hand painted with the pistol.
const free=await sharp(frames['far-forearm']).ensureAlpha().raw().toBuffer();
const handPolygon=[[186,234],[197,233],[204,239],[208,244],[205,252],[201,265],[196,267],[190,259],[183,252],[181,243]];
const handMask=await sharp(Buffer.from('<svg width="480" height="448"><polygon points="'+handPolygon.map(p=>p.join(',')).join(' ')+'" fill="white"/></svg>')).ensureAlpha().raw().toBuffer();
const hand=Buffer.from(ref);for(let i=0;i<hand.length;i+=4){const skin=ref[i]>70&&ref[i]-ref[i+1]>10&&ref[i]-ref[i+2]>15;hand[i+3]=skin?Math.round(ref[i+3]*handMask[i+3]/255):0;}
const handPng=await sharp(hand,{raw:{width:480,height:448,channels:4}}).png().toBuffer();
// Original own near hand, mirrored for the far wrist. Its source wrist is
// explicitly registered; no skin fragment is left inside the sleeve.
const sourceHandWrist=[194,234],targetHandWrist=[278,221],handScale=.65;
const handMatrix=[-handScale,0,0,handScale,targetHandWrist[0]+handScale*sourceHandWrist[0],targetHandWrist[1]-handScale*sourceHandWrist[1]];
const freeHand=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="480" height="448"><image width="480" height="448" transform="matrix('+handMatrix.join(' ')+')" xlink:href="data:image/png;base64,'+handPng.toString('base64')+'"/></svg>')).ensureAlpha().raw().toBuffer();
for(let y=0;y<448;y++)for(let x=0;x<480;x++)if((x-278)*7+(y-221)*48>48)free[(y*480+x)*4+3]=0;
frames['far-forearm']=await sharp(free,{raw:{width:480,height:448,channels:4}}).composite([{input:await sharp(freeHand,{raw:{width:480,height:448,channels:4}}).png().toBuffer()}]).png().toBuffer();
const outputs=[];
for(const[name,png]of Object.entries(frames)){
 await writeFile(root+'/'+name+'-source-frame.png',png);
 const part=atlas.parts.find(p=>p.name===name),s=part.source,t=name==='far-forearm'?{...part.destination,h:77}:part.destination,file=root+'/'+name+'.png';
 const tile=await sharp(png).extract({left:t.x,top:t.y,width:t.w,height:t.h}).resize(s.w,name==='far-forearm'?39:s.h,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();await writeFile(file,tile);outputs.push({name,file,sha256:hash(tile),width:s.w,height:name==='far-forearm'?39:s.h,...(name==='far-forearm'?{destination:t}:{} )});
}
const weapon=await sharp(frames['weapon-and-hands']).ensureAlpha().raw().toBuffer();assert.ok(weapon[(toB[1]*480+toB[0])*4+3]>=32,'muzzle remains on painted suppressor');
await writeFile(root+'/provenance.json',JSON.stringify({sourceMaster:gunPath,sourceSha256:hash(gun),creator:'OpenAI image generation; project part authoring',license:'Generated asset under service terms; existing source rights retained',producerAuthorization:'2026-10-31 explicit TTI-style pistol and tie/strap correction request',producerAcceptance:'pending',tieSpinePolygon:tie,freeHandRegistration:{source:oldRoot+'/identity-reference.png',sourceHandWrist,targetHandWrist,handScale,handMatrix,handPolygon},occludedSleeves:'Original hidden-parts-study cells 8 and 9; no borrowed character parts',handRegistration:{sourceGrip:fromA,sourceMuzzle:fromB,targetGrip:toA,targetMuzzle:toB,matrix:M},outputs},null,2)+'\n');
console.log(JSON.stringify({outputs:outputs.map(x=>x.name),muzzle:toB,wrist:toA}));
