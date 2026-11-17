import assert from 'node:assert/strict';
import fs from 'node:fs';
const changes=JSON.parse(fs.readFileSync('tests/fixtures/guard-spectacle-source-changes.json','utf8'));
const bossReleases=JSON.parse(fs.readFileSync('tests/fixtures/boss-release-paint-source-changes.json','utf8'));
// Reverse only the declared boss-release and guard paint edits; callers compare the whole source.
export function restorePreGuardSpectacleSource(file,source){
 let restored=source.replaceAll('\r\n','\n');
 for(const [before,after]of [...(bossReleases[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' boss release paint edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 for(const [before,after]of [...(changes[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' guard paint edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
