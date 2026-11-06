import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {V100_PORTRAIT_LANDMARKS} from '../app/v100DialogueComposition.js';
import {V100_EVENT_PORTRAIT_PROFILES,V100_EVENT_EXPRESSIONS,v100EventPortraitPath} from '../app/v100StoryDirection.js';
import {V080_UNIT_VISUAL_PROFILES} from '../app/visualProfiles.js';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';

test('every dialogue identity has an explicit camera, including helmets and the dog',()=>{
  const scriptedOwners=Object.values(V100_STORY_EVENTS).flatMap(e=>e.nodes.map(n=>n.portraitOwner)).filter(Boolean);
  assert.deepEqual(Object.keys(V100_PORTRAIT_LANDMARKS).sort(),[...new Set([...Object.keys(V100_EVENT_PORTRAIT_PROFILES),...scriptedOwners])].sort());
  for(const m of Object.values(V100_PORTRAIT_LANDMARKS)) {
    assert.ok(m.top>=0&&m.height>0&&m.top+m.height<640);
    assert.ok(m.center>0&&m.center<512);
  }
});
test('wide equipment and full torso dialogue variants do not replace formation or battle assets',()=>{
  for(const [kind,combatKind] of [['babayaga','babayaga'],['kumaverson','kumaverson'],['tatara','brute'],['gantetsu','guardian']]) {
    const profile=V080_UNIT_VISUAL_PROFILES[combatKind];
    assert.ok(profile,combatKind);
    assert.equal(profile.eventPortrait.path,`/art/v100/portraits/${kind}-determined-stage-r1.webp`);
    assert.ok(!profile.identityMaster.path.includes('-stage-r1'));
    for(const e of V100_EVENT_EXPRESSIONS)assert.equal(v100EventPortraitPath(`unit-${kind}`,e),`/art/v100/portraits/${kind}-${kind==='gantetsu'?'determined':e}-stage-r1.webp`);
  }
});
test('stage files retain their full source width and match both input and runtime receipts',async()=>{
  const report=JSON.parse(await readFile('assets/source/quality-20261028/identity/stage-portrait-provenance-r1.json','utf8'));
  assert.equal(report.records.length,21);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  for(const item of report.records) {
    const source=await readFile(item.input),output=await readFile(item.output);
    assert.equal(hash(source),item.inputSha256);
    assert.equal(hash(output),item.sha256);
    const before=await sharp(source).metadata(),after=await sharp(output).metadata();
    assert.equal(item.crop.left,0);assert.equal(item.crop.width,before.width);
    assert.equal(after.width,1024);assert.equal(after.height,1280);assert.ok(after.hasAlpha);
  }
});
test('extended authority and anonymous portraits retain lower-body coverage in their normalized camera',async()=>{
  const report=JSON.parse(await readFile('assets/source/quality-20261028/identity/extended-dialogue-provenance-r1.json','utf8'));
  assert.equal(report.records.length,13);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  for(const item of report.records) {
    const source=await readFile(item.input),output=await readFile(item.output);
    assert.equal(hash(source),item.inputSha256);assert.equal(hash(output),item.sha256);
    const {data,info}=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,1536);assert.equal(info.height,2048);
    let bottom=-1;
    for(let y=info.height-1;y>=0&&bottom<0;y--){
      let solid=0;for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>128)solid++;
      if(solid>=20)bottom=y;
    }
    assert.ok(bottom>=1080,`${item.kind}/${item.expression}: insufficient torso below the head`);
  }
});
