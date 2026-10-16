import {V177_PAISEN_STORY_REPLACEMENTS, V177_PAISEN_STORY_EXISTING_REPLACEMENTS} from '../scripts/v177-paisen-story-asset-contract.mjs';
import { V177_PAISEN_CREDITS_REPLACEMENTS } from '../scripts/v177-paisen-credits-asset-contract.mjs';
import { V177_PAISEN_ASSET_ADDITIONS, V177_PAISEN_RETIRED_ASSETS, V177_PAISEN_LEGACY_RETIREMENTS } from '../scripts/v177-paisen-asset-contract.mjs';
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { V177_INSTALLED_ASSET_CONTRACT, v177InstalledSourceReplacementsMatch } from "../scripts/v177-installed-asset-contract.mjs";
import { V100_RELEASE_ASSET_CONTRACT } from "../scripts/v100-release-asset-contract.mjs";

const candidate = JSON.parse(readFileSync(new URL("../public/asset-manifest.json", import.meta.url)));
const record = ({path, bytes, hash}) => ({path, bytes, hash});
const ordered = assets => assets.map(record).sort((a, b) => a.path.localeCompare(b.path));
const baselines = [
  // Same asset count; the same-source Ranger hybrid adds exactly54088 bytes.
  ["1.0.1", "634f8de4b0fb15df902a7dd5983ea94237cfea9d", 119, 51619760, 93],
  ["1.0.2", "cd246a3d8e93b69d8cb6b370d40f28924a0d86b6", 118, 51598808, 92],
  ["1.0.3", "99f9c193ab1e35531db39225c839138cdb1c33cd", 118, 51598808, 92],
];
for (const [version, sha, count, bytes, network] of baselines) {
  test(`the frozen installed ${version} pack downloads exactly the R9, score and sprite delta`, () => {
    const old = JSON.parse(execFileSync("git", ["show", `${sha}:public/asset-manifest.json`], {encoding:"utf8",maxBuffer:4*1024*1024}));
    const expected = V177_INSTALLED_ASSET_CONTRACT[version];
    assert.equal(v177InstalledSourceReplacementsMatch(old,candidate,version),true);
    assert.equal(old.version, version);
    assert.equal(old.assets.length, expected.assets);
    const oldHashes = new Set(old.assets.map(asset => asset.hash));
    assert.equal(oldHashes.size, expected.distinct);
    const changed = candidate.assets.filter(asset => !oldHashes.has(asset.hash));
    assert.deepEqual(ordered(changed), ordered(expected.changed), "unexpected download or missing approved media");
    assert.equal(changed.length, count);
    assert.equal(expected.additions, count);
    assert.equal(changed.reduce((sum, asset) => sum + asset.bytes, 0), bytes);
    assert.equal(expected.bytes, bytes);
    assert.equal(changed.filter(asset => asset.bundlePath).length, 27);
    assert.equal(expected.bundled, 27);
    assert.equal(new Set(changed.map(asset => asset.bundlePath ?? asset.sourcePath ?? asset.path)).size, network);
    assert.equal(expected.network, network);
    const next = new Map(candidate.assets.map(asset => [asset.path, asset]));
    const replaced = [];
    for (const asset of old.assets) {
      const retirement = expected.sourceRetirements.find(bound=>bound.path===asset.path);
      if(retirement) {
        assert.deepEqual(record(asset),record(retirement),'only the exact previous Paisen image may retire');
        assert.equal(next.has(asset.path),false);
        replaced.push(asset.path);
        continue;
      }
      const replacement = next.get(asset.path);
      assert.ok(replacement, `installed asset removed: ${asset.path}`);
      if (replacement.hash !== asset.hash) replaced.push(asset.path);
      else {
        assert.equal(replacement.bytes, asset.bytes);
        assert.equal(replacement.sourcePath, asset.sourcePath);
        assert.equal(replacement.bundlePath, asset.bundlePath);
      }
    }
    assert.deepEqual(replaced.sort(), expected.replaced);
  });
}
test("the frozen 0.9.9.5 delta includes the source-bound sprite repairs and the existing card replacement", () => {
  const old = JSON.parse(execFileSync("git", ["show", "55d796cc577d1d9f903a4d2c6b4382196511db27:public/asset-manifest.json"], {encoding:"utf8",maxBuffer:4*1024*1024}));
  const expected=V177_INSTALLED_ASSET_CONTRACT['0.9.9.5'];
  assert.equal(old.assets.length,expected.assets);
  assert.equal(v177InstalledSourceReplacementsMatch(old,candidate,'0.9.9.5'),true);
  const hashes = new Set(old.assets.map(asset => asset.hash));
  const changed = candidate.assets.filter(asset => !hashes.has(asset.hash));
  assert.equal(changed.length, V100_RELEASE_ASSET_CONTRACT.additionsFromV0995);
  assert.equal(changed.reduce((sum, asset) => sum + asset.bytes, 0), V100_RELEASE_ASSET_CONTRACT.bytesFromV0995);
  assert.equal(changed.filter(asset => asset.bundlePath).length, V100_RELEASE_ASSET_CONTRACT.bundledAudioAdditionsFromV0995);
  assert.equal(new Set(changed.map(asset => asset.bundlePath ?? asset.sourcePath ?? asset.path)).size, V100_RELEASE_ASSET_CONTRACT.networkSourcesFromV0995);
  const next = new Map(candidate.assets.map(asset => [asset.path, asset]));
  assert.deepEqual(old.assets.filter(asset => next.get(asset.path)?.hash !== asset.hash).map(asset => asset.path).sort(), [
    "/art/v060/characters/kumaverson-battle-v1.png",
    "/art/v080/characters/cards/kumaverson-formation-card-r2.webp",
    "/art/v090-prototypes/bosses/kurome-battle-candidate-r1.png",
    "/art/v090/bosses/gairen-battle-r1.png",
    "/art/v090/characters/mayo-chan-battle-r1.png",
    "/art/v090/characters/mayo-chan-feral-battle-r1.png",
    "/art/v090/characters/miyamoto-musashi-battle-r1.png",
    "/art/v090/characters/mrs-chiha-battle-r1.png",
    "/art/v090/characters/zakimiya-battle-r1.png",
    "/art/v0995/enemies/anchor-bloom-battle-v2.png",
    ...V177_PAISEN_LEGACY_RETIREMENTS.map(asset=>asset.path),
  ].sort());
  assert.deepEqual(expected.replaced,old.assets.filter(asset=>next.get(asset.path)?.hash!==asset.hash).map(asset=>asset.path).sort());
  assert.equal(expected.additions,changed.length);assert.equal(expected.bytes,changed.reduce((sum,asset)=>sum+asset.bytes,0));
  assert.equal(expected.bundled,changed.filter(asset=>asset.bundlePath).length);
  assert.equal(expected.network,new Set(changed.map(asset=>asset.bundlePath??asset.sourcePath??asset.path)).size);
  for(const binding of expected.sourceReplacements){
    for(const key of ['hash','bytes','sourcePath']){
      const altered=structuredClone(candidate),asset=altered.assets.find(a=>a.path===binding.path);
      asset[key]=key==='bytes'?asset.bytes+1:'unapproved';
      assert.equal(v177InstalledSourceReplacementsMatch(old,altered,'0.9.9.5'),false,`${binding.path}/${key}`);
    }
    const alteredOld=structuredClone(old);alteredOld.assets.find(a=>a.path===binding.path).hash='unapproved';
    assert.equal(v177InstalledSourceReplacementsMatch(alteredOld,candidate,'0.9.9.5'),false,'the old source hash must also match');
  }
  assert.equal(v177InstalledSourceReplacementsMatch(old,candidate,'unknown'),false);
});

test('Paisen identity updates pin all old and new image bytes and reject stale resurrection', () => {
  const old=JSON.parse(execFileSync('git',['show','cd246a3d8e93b69d8cb6b370d40f28924a0d86b6:public/asset-manifest.json'],{encoding:'utf8',maxBuffer:4*1024*1024}));
  for(const binding of V177_PAISEN_ASSET_ADDITIONS) {
    const altered=structuredClone(candidate);
    altered.assets.find(asset=>asset.path===binding.path).hash='unapproved';
    assert.equal(v177InstalledSourceReplacementsMatch(old,altered,'1.0.2'),false);
    const missing=structuredClone(candidate);
    missing.assets=missing.assets.filter(asset=>asset.path!==binding.path);
    assert.equal(v177InstalledSourceReplacementsMatch(old,missing,'1.0.2'),false);
  }
  for(const retired of V177_PAISEN_RETIRED_ASSETS) {
    const resurrected=structuredClone(candidate);
    resurrected.assets.push({...retired});
    assert.equal(v177InstalledSourceReplacementsMatch(old,resurrected,'1.0.2'),false);
    const changedOld=structuredClone(old);
    changedOld.assets.find(asset=>asset.path===retired.path).bytes+=1;
    assert.equal(v177InstalledSourceReplacementsMatch(changedOld,candidate,'1.0.2'),false);
  }
});

test('each photo credits replacement rejects old-image resurrection and a changed installed source', () => {
  const old = JSON.parse(execFileSync('git', ['show', '99f9c193ab1e35531db39225c839138cdb1c33cd:public/asset-manifest.json'], {encoding:'utf8',maxBuffer:4*1024*1024}));
  for (const row of V177_PAISEN_CREDITS_REPLACEMENTS) {
    const resurrected = structuredClone(candidate); Object.assign(resurrected.assets.find(asset => asset.path === row.path), row.previous);
    assert.equal(v177InstalledSourceReplacementsMatch(old,resurrected,'1.0.3'),false);
    const alteredOld = structuredClone(old); alteredOld.assets.find(asset => asset.path === row.path).bytes++;
    assert.equal(v177InstalledSourceReplacementsMatch(alteredOld,candidate,'1.0.3'),false);
  }
});

test('every R9 photo scene rejects stale image bytes and pins the two original installed R5 sources', () => {
  const old = JSON.parse(execFileSync('git',['show','99f9c193ab1e35531db39225c839138cdb1c33cd:public/asset-manifest.json'],{encoding:'utf8',maxBuffer:4*1024*1024}));
  for (const row of V177_PAISEN_STORY_REPLACEMENTS) {
    const stale = structuredClone(candidate);
    Object.assign(stale.assets.find(asset => asset.path === row.path), row.previous);
    assert.equal(v177InstalledSourceReplacementsMatch(old,stale,'1.0.3'),false);
    const altered = structuredClone(candidate);
    altered.assets.find(asset => asset.path === row.path).bytes++;
    assert.equal(v177InstalledSourceReplacementsMatch(old,altered,'1.0.3'),false);
    if (row.path.includes('/story-r9/')) {
      const invented = structuredClone(old); invented.assets.push({...row.previous});
      assert.equal(v177InstalledSourceReplacementsMatch(invented,candidate,'1.0.3'),false);
    }
  }
  assert.equal(V177_PAISEN_STORY_EXISTING_REPLACEMENTS.length,2);
  for (const row of V177_PAISEN_STORY_EXISTING_REPLACEMENTS) {
    const changedOld = structuredClone(old);
    changedOld.assets.find(asset => asset.path === row.path).hash = 'unapproved';
    assert.equal(v177InstalledSourceReplacementsMatch(changedOld,candidate,'1.0.3'),false);
  }
});
