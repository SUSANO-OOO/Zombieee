import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {V177_INSTALLED_ASSET_CONTRACT,v177InstalledSourceReplacementsMatch} from './v177-installed-asset-contract.mjs';
import {V100_RELEASE_ASSET_CONTRACT,V100_WEBKIT_CARD_REPLACEMENT} from './v100-release-asset-contract.mjs';

const ordered=rows=>rows.slice().sort((a,b)=>a.path.localeCompare(b.path));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const qualityAssetDigest=rows=>createHash('sha256').update(JSON.stringify(stable(ordered(rows)))).digest('hex');
const transportSame=(a,b)=>a&&b&&a.hash===b.hash&&a.bytes===b.bytes&&(a.sourcePath??null)===(b.sourcePath??null)&&(a.bundlePath??null)===(b.bundlePath??null);

// Compose two source-bound contracts: the frozen installed release -> v1.0.5,
// then the explicitly reviewed quality delta. Never infer approval from the
// candidate's own counts or forgive unrelated media/transport changes.
export function assertQualityInstalledAssetTransition({oldManifest,baseline,candidate,oldVersion,delta}){
 const contract=V177_INSTALLED_ASSET_CONTRACT[oldVersion];assert.ok(contract,'unknown installed release');
 assert.equal(delta.base,'ff5dba24e88c810182cda1f044bd26dfc3e512c1');
 assert.equal(baseline.version,'1.0.5');assert.equal(qualityAssetDigest(baseline.assets),delta.baseAssetsSha256,'immutable v1.0.5 asset source');
 assert.equal(oldManifest.version,oldVersion);assert.equal(oldManifest.assets.length,contract.assets);
 const oldHashes=new Set(oldManifest.assets.map(row=>row.hash)),baseHashes=new Set(baseline.assets.map(row=>row.hash));
 assert.equal(oldHashes.size,contract.distinct);assert.equal(baseline.assets.length,V100_RELEASE_ASSET_CONTRACT.count);
 assert.equal(baseHashes.size,V100_RELEASE_ASSET_CONTRACT.distinctHashes);
 const baseByPath=new Map(baseline.assets.map(row=>[row.path,row]));assert.equal(baseByPath.size,baseline.assets.length);
 const replaced=oldManifest.assets.filter(row=>!transportSame(row,baseByPath.get(row.path))).map(row=>row.path).sort();
 assert.deepEqual(replaced,contract.replaced.slice().sort());
 assert.equal(v177InstalledSourceReplacementsMatch(oldManifest,baseline,oldVersion),true);
 assert.equal(baseByPath.get(V100_WEBKIT_CARD_REPLACEMENT.path)?.hash,V100_WEBKIT_CARD_REPLACEMENT.hash);
 const baseNew=baseline.assets.filter(row=>!oldHashes.has(row.hash)),bundled=baseNew.filter(row=>row.bundlePath);
 assert.equal(baseNew.length,contract.additions);assert.equal(new Set(baseNew.map(row=>row.hash)).size,baseNew.length);
 assert.equal(baseNew.reduce((n,row)=>n+row.bytes,0),contract.bytes);
 if(contract.changed)assert.deepEqual(ordered(baseNew.map(({path,bytes,hash})=>({path,bytes,hash}))),ordered(contract.changed.map(({path,bytes,hash})=>({path,bytes,hash}))));
 assert.equal(bundled.length,contract.bundled);assert.ok(bundled.every(row=>row.bundlePath===V100_RELEASE_ASSET_CONTRACT.audioBundlePath));
 assert.equal(new Set(baseNew.map(row=>row.bundlePath??row.sourcePath??row.path)).size,contract.network);

 const expected=new Map(baseByPath),retired=new Set(),added=new Set(),relocated=new Set();
 for(const row of delta.retired){assert.ok(!retired.has(row.path),'duplicate retirement');retired.add(row.path);assert.deepEqual(baseByPath.get(row.path),row,'retired source differs');expected.delete(row.path);}
 for(const row of delta.added){assert.ok(!added.has(row.path)&&!baseByPath.has(row.path),'duplicate or non-new quality path');added.add(row.path);assert.match(row.hash,/^sha256-[0-9a-f]{64}$/u);assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>0);expected.set(row.path,row);}
 for(const row of delta.transportChanges??[]){
  assert.ok(!relocated.has(row.path)&&!retired.has(row.path)&&!added.has(row.path),'duplicate or conflicting audio relocation');relocated.add(row.path);
  assert.deepEqual(baseByPath.get(row.path),row.previous,'relocation must bind its exact old source');
  assert.equal(row.next.path,row.path);assert.ok(row.previous.bundlePath&&row.next.bundlePath===row.previous.bundlePath);
  const unchanged=asset=>Object.fromEntries(Object.entries(asset).filter(([key])=>!['bundleOffset','bundleLength'].includes(key)));
  assert.deepEqual(unchanged(row.next),unchanged(row.previous),'audio relocation must retain content, role and preferred source');
  assert.ok(Number.isSafeInteger(row.next.bundleOffset)&&row.next.bundleOffset>=0&&Number.isSafeInteger(row.next.bundleLength)&&row.next.bundleLength>0);
  assert.ok(row.next.bundleOffset+row.next.bundleBytes<=row.next.bundleLength);
  expected.set(row.path,row.next);
 }
 assert.equal(candidate.version,baseline.version);assert.equal(new Set(candidate.assets.map(row=>row.path)).size,candidate.assets.length,'duplicate candidate path');
 assert.deepEqual(ordered(candidate.assets),ordered([...expected.values()]),'candidate must equal the complete reviewed baseline plus delta');
 const byteCounts=new Map();for(const row of candidate.assets){if(byteCounts.has(row.hash))assert.equal(row.bytes,byteCounts.get(row.hash),'aliases must describe identical content');else byteCounts.set(row.hash,row.bytes);}
 return {oldAssets:oldManifest.assets.length,baselineAssets:baseline.assets.length,candidateAssets:candidate.assets.length,qualityAdded:delta.added.length,qualityRetired:delta.retired.length,retainedAudioRelocations:relocated.size,changedHashes:new Set(candidate.assets.filter(row=>!oldHashes.has(row.hash)).map(row=>row.hash)).size};
}
