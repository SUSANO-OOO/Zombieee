import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {spriteFrameFor} from '../app/spriteManifest.js';

test('legacy walking infected retain their complete body without the neighbouring hand', async () => {
  const path = '/art/v060/characters/legacy/infected-battle-gutter-v1.png';
  const source = await readFile(new URL('../public'+path,import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), '2b84bd0400bdd8ea1a8b4ba85e9bd5fedf508febd58a47264450fba468638e50');
  const reference = spriteFrameFor('walker','walk-b','left');
  const {data,info} = await sharp(source).extract({left:reference.x,top:reference.y,width:reference.w,height:reference.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for (const kind of ['walker','runner','turned']) for (const direction of ['left','right']) {
    const frame = spriteFrameFor(kind,'walk-b',direction);
    assert.deepEqual(frame.sourceRect,reference.sourceRect);
    assert.deepEqual(frame.anchor,reference.anchor);
    assert.equal(frame.contentRect.x+frame.contentRect.w-frame.x,320);
    let retained = 0, excluded = 0;
    for (let y=0;y<info.height;y++) for (let x=0;x<info.width;x++) {
      if (!data[(y*info.width+x)*4+3]) continue;
      const drawn = frame.drawSlices.some(s=>x>=s.x&&y>=s.y&&x<s.x+s.w&&y<s.y+s.h);
      if (x<320) { assert.equal(drawn,true,`${kind}/${direction} body pixel ${x},${y}`); retained++; }
      else { assert.equal(drawn,false,`${kind}/${direction} neighbouring fragment ${x},${y}`); excluded++; }
    }
    assert.ok(retained>=53210);
    assert.ok(excluded>=1780);
    assert.equal(spriteFrameFor(kind,'walk-a',direction).drawSlices,undefined);
    assert.equal(frame.flipX,direction==='right');
  }
});

test('source-bound frame exclusions preserve every body pixel in all affected forms and directions', async () => {
  const cases = [
    ['brawler','attack-a','f1b5149ad4d4a1cc94220b40cd336d18d38372cbe26aefbf27620ba808dee836'],
    ...['walker','runner','turned'].flatMap(kind=>['walk-b','attack-a','attack-b'].map(state=>[kind,state,'2b84bd0400bdd8ea1a8b4ba85e9bd5fedf508febd58a47264450fba468638e50'])),
    ...['walk-b','attack-a'].map(state=>['shade',state,'9b32752942adf2b925812c0cbd7c730323518f79c1de22c4eb4eef13138fb2ce']),
    ...['crusher','abomination'].flatMap(kind=>['walk-a','walk-b','attack-a'].map(state=>[kind,state,'41bf73592852dbb5e0ebe0a636a18220737dcbad170fb9b6b4985f6ab38ae8d9'])),
    ['tky','attack-a','1d1eeaa8915c1e510109d7731d9ae50235baaf047f809933d16e5edcf8e178dc'],
  ];
  const sources = new Map();
  for (const [kind,state,hash] of cases) for (const direction of ['left','right']) {
    const f=spriteFrameFor(kind,state,direction),s=f.sourceRect;
    if (!sources.has(f.path)) sources.set(f.path,await readFile(new URL('../public'+f.path,import.meta.url)));
    const bytes=sources.get(f.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
    const {data,info}=await sharp(bytes).extract({left:s.x,top:s.y,width:s.w,height:s.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const seen=new Uint8Array(info.width*info.height),components=[];
    for (let p=0;p<seen.length;p++) {
      if (seen[p]||!data[p*4+3]) continue;
      const queue=[p],pixels=[];seen[p]=1;
      while (queue.length) {
        const i=queue.pop(),x=i%info.width,y=Math.floor(i/info.width);pixels.push(i);
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
          const xx=x+dx,yy=y+dy,j=yy*info.width+xx;
          if (xx<0||xx>=info.width||yy<0||yy>=info.height||seen[j]||!data[j*4+3]) continue;
          seen[j]=1;queue.push(j);
        }
      }
      components.push(pixels);
    }
    components.sort((a,b)=>b.length-a.length);
    const covered=i=>f.drawSlices.some(r=>i%info.width>=r.x&&i%info.width<r.x+r.w&&Math.floor(i/info.width)>=r.y&&Math.floor(i/info.width)<r.y+r.h);
    assert.ok(components[0].every(covered),`${kind}/${state}/${direction} complete connected body retained`);
    assert.ok(components.slice(1).some(c=>c.length>50&&c.every(i=>!covered(i))),`${kind}/${state}/${direction} confirmed neighbour excluded`);
    assert.ok(f.drawSlices.every(r=>r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=s.w&&r.y+r.h<=s.h));
  }
  for (const kind of ['kumaverson','spitter','gunner','takuya']) {
    assert.equal(spriteFrameFor(kind,'attack-b','right').drawSlices,undefined,`${kind} attack effects stay intact`);
  }
});
