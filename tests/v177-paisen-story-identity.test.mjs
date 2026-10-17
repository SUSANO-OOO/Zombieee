import {mkdtemp,mkdir,copyFile,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryDirectionFor} from '../app/v100StoryDirection.js';
import {inspectPaisenStoryCuts} from '../scripts/build-v177-paisen-story-cuts.mjs';

const manifest = JSON.parse(fs.readFileSync('assets/source/v177/paisen/cuts/registered-story-r1/runtime-adoption-r1.json'));

test('the nine photo-identity story scenes are used by real final R9 nodes at their existing URLs', () => {
  const actual = new Set(Object.values(V100_STORY_EVENTS).flatMap(event => event.nodes
    .map((node,index) => v100StoryDirectionFor(event.id,index,node).backgroundPath)).filter(Boolean));
  assert.equal(manifest.entries.length,9);
  for (const entry of manifest.entries) assert.ok(actual.has(entry.runtimePath), 'Unused scene '+entry.sceneId);
  assert.equal(manifest.identityMasterSha256,'a1d5517fc1a500c4e949b0ec6c522efa0404ebd4ddd3b548994713a918983257');
  assert.equal(manifest.visibleAppearances,10,'foreground and CCTV Paisen are both included');
});

test('the nine runtime story images retain original pixels outside the actor masks and reproduce losslessly', async () => {
  const result = await inspectPaisenStoryCuts({assetRoot:'public'});
  assert.equal(result.sceneCount,9);
  assert.ok(result.entries.every(entry => entry.outsideRegisteredRegion === 0 && entry.losslessPixelExact));
});

test('the ordinary R9 source generator reproduces all17 current scenes without reverting photo identity or unrelated art', async () => {
  const root=process.cwd(),plan=JSON.parse(fs.readFileSync('assets/source/v100/story-r9/scene-sources.json'));
  const fixture=await mkdtemp(path.join(os.tmpdir(),'z177-r9-'));
  try {
    const files=new Set(['assets/source/v100/story-r9/scene-sources.json','scripts/build-v100-r9-scenes.mjs',
      'scripts/rejected-v100-art.mjs','assets/source/v100/takuya/takuya-vest-v2.provenance.json','app/v100R9SceneAssets.js']);
    for(const scene of plan.scenes) {
      files.add(scene.authoringMaster??'assets/source/v100/story-r9/'+scene.id+'.png');
      files.add(scene.prompt??'assets/source/v100/story-r9/'+scene.id+'-prompt.txt');
      for(const reference of scene.references??[])files.add(reference);
    }
    for(const file of files) {
      assert.ok(!path.isAbsolute(file)&&!file.split(/[\\/]/u).includes('..'));
      await mkdir(path.dirname(path.join(fixture,file)),{recursive:true});
      await copyFile(path.join(root,file),path.join(fixture,file));
    }
    fs.writeFileSync(path.join(fixture,'package.json'),JSON.stringify({type:'module'}));
    await symlink(fs.realpathSync(path.join(root,'node_modules')),path.join(fixture,'node_modules'),process.platform==='win32'?'junction':'dir');
    execFileSync(process.execPath,['scripts/build-v100-r9-scenes.mjs'],{cwd:fixture,timeout:60_000,maxBuffer:2e6});
    for(const scene of plan.scenes) {
      const file='public/art/v100/story-r9/cuts/'+scene.id+'.webp';
      assert.ok(fs.readFileSync(path.join(fixture,file)).equals(fs.readFileSync(path.join(root,file))),scene.id);
    }
    assert.ok(fs.readFileSync(path.join(fixture,'app/v100R9SceneAssets.js')).equals(fs.readFileSync('app/v100R9SceneAssets.js')));
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith('z177-r9-'));
    await rm(fixture,{recursive:true,force:true});
  }
});
