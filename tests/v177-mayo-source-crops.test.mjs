import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import {V177_MAYO_HIT_SOURCE_BOUNDS} from '../scripts/v177-mayo-source-crops.mjs';
import {V177_MAYO_SPRITE_REPLACEMENTS} from '../scripts/v177-mayo-repair-asset-contract.mjs';
import {spriteFrameFor} from '../app/spriteManifest.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
const sourceRoot=new URL('../assets/source/v090/characters/',import.meta.url);
const proof=JSON.parse(await readFile(new URL('../assets/source/v100/sprite-repairs/mayo-hit-source-provenance.json',import.meta.url),'utf8'));
test('default source regeneration reproduces both repaired sheets and retains approved portrait/card bytes',async()=>{
  const scratch=await mkdtemp(path.join(os.tmpdir(),'zombieee-mayo-replay-'));
  try{
    const input=path.join(scratch,'assets/source/v090/characters'),output=path.join(scratch,'public/art/v090/characters');await mkdir(input,{recursive:true});
    for(const file of ['mayo-chan-combat-poses-source-r1.png','mayo-chan-feral-poses-source-r1.png','mayo-chan-identity-master-r1.png'])await copyFile(new URL(file,sourceRoot),path.join(input,file));
    const identities=[['cards/mayo-chan-formation-card-r1.webp','911cfc0587cc5de1d125ffd5ab5d5e04f3dcdd08003c905e0499c20598b145d4'],['portraits/mayo-chan-event-portrait-r1.webp','1d8dae611c7c78de0f3ec5afd0914fbd33dc7e7126fd219402790de3d9d65990']];
    for(const [file,hash]of identities){const data=await readFile(new URL('../public/art/v090/characters/'+file,import.meta.url));assert.equal(sha(data),hash);await mkdir(path.dirname(path.join(output,file)),{recursive:true});await copyFile(new URL('../public/art/v090/characters/'+file,import.meta.url),path.join(output,file));}
    execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build-v090-mayo-assets.mjs',import.meta.url))],{cwd:scratch,maxBuffer:1024*1024,timeout:60000});
    for(const [file,hash]of identities)assert.equal(sha(await readFile(path.join(output,file))),hash,'A battle repair must not regenerate independently approved identity derivatives');
    for(const row of proof.rows)assert.equal('sha256-'+sha(await readFile(path.join(scratch,'public'+row.path))),row.nextPng.hash);
  }finally{
    const parent=path.resolve(os.tmpdir()),target=path.resolve(scratch);assert.equal(path.dirname(target),parent);assert.ok(path.basename(target).startsWith('zombieee-mayo-replay-'));await rm(target,{recursive:true,force:true});
  }
});
for(const [index,id,filename,sourceHash,count,oldRight]of [
  [0,'normal','mayo-chan-combat-poses-source-r1.png','fe9c29393e8da17ba6f72be33498a96b6ea3212ffb0125f738ab10aac453ff63',29530,1805],
  [1,'feral','mayo-chan-feral-poses-source-r1.png','b6e86d70fcd761ed80197a20c0ee386eeab45ea3820815bc25db8856b2e5aa74',37610,1800],
]){
  test(`${id} hit contains the complete connected original face and body, without repainting or adjacent poses`,async()=>{
    const source=await readFile(new URL(filename,sourceRoot));assert.equal(sha(source),sourceHash);
    const {data,info}=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true}),n=info.width*info.height,alpha=new Uint8Array(n),seen=new Uint8Array(n),q=new Int32Array(n),bodies=[];
    for(let p=0;p<n;p++){const d=Math.hypot(data[p*3],data[p*3+1],255-data[p*3+2]);alpha[p]=d<=48?0:d>=124?255:Math.round((d-48)*255/76);}
    for(let start=0;start<n;start++){
      if(seen[start]||alpha[start]<=12)continue;let head=0,tail=0,minX=info.width;q[tail++]=start;seen[start]=1;
      while(head<tail){const p=q[head++],x=p%info.width,y=Math.floor(p/info.width);minX=Math.min(minX,x);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=info.width||yy<0||yy>=info.height)continue;const next=yy*info.width+xx;if(seen[next]||alpha[next]<=12)continue;seen[next]=1;q[tail++]=next;}}
      if(tail>20000)bodies.push({minX,pixels:Int32Array.from(q.subarray(0,tail))});
    }
    bodies.sort((a,b)=>a.minX-b.minX);assert.equal(bodies.length,7);const hit=bodies[5];assert.equal(hit.pixels.length,count);
    const [left,width]=V177_MAYO_HIT_SOURCE_BOUNDS[id];let previouslyClipped=0;const rgba=Buffer.alloc(n*4);
    for(const p of hit.pixels){const x=p%info.width;assert.ok(x>=left&&x<left+width,'The crop must retain every proper original body pixel');if(x>=oldRight)previouslyClipped++;
      rgba[p*4]=data[p*3];rgba[p*4+1]=data[p*3+1];rgba[p*4+2]=Math.min(data[p*3+2],Math.max(data[p*3],data[p*3+1])+(alpha[p]===255?18:2));rgba[p*4+3]=alpha[p];}
    assert.ok(previouslyClipped>100,'The former crop actually discarded the reported face');
    const posed=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).trim({threshold:3}).resize({width:448,height:416,fit:'inside',kernel:sharp.kernel.lanczos3}).png().toBuffer(),meta=await sharp(posed).metadata(),x=Math.round((480-meta.width)/2),y=432-meta.height;
    const r=V177_MAYO_SPRITE_REPLACEMENTS[index],sheet=await readFile(new URL('../public'+r.path,import.meta.url));assert.equal('sha256-'+sha(sheet),proof.rows[index].nextPng.hash);assert.equal(sheet.length,proof.rows[index].nextPng.bytes);
    const kind=index?'mayo-chan-feral':'mayo-chan';
    for(const [row,direction]of [[0,'right'],[1,'left']]){
      const expected=await sharp({create:{width:480,height:448,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:row?await sharp(posed).flop().png().toBuffer():posed,left:x,top:y}]).ensureAlpha().raw().toBuffer();
      const actual=await sharp(sheet).extract({left:2400,top:row*448,width:480,height:448}).ensureAlpha().raw().toBuffer();assert.deepEqual(actual,expected,'All retained paint comes from this original pose');
      const f=spriteFrameFor(kind,'hit',direction);assert.equal(f.path,r.path);assert.equal(f.contentRect.y+f.contentRect.h-f.y,432,'Recovered face retains the original planted baseline');
    }
    for(const cell of proof.rows[index].cells.filter(c=>c.column!==5)){const actual=await sharp(sheet).extract({left:cell.column*480,top:cell.row*448,width:480,height:448}).ensureAlpha().raw().toBuffer();assert.equal(sha(actual),cell.oldRgbaSha256,'Every non-hit pose and frozen rig reference stays unchanged');}
  });
}
