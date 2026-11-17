import assert from 'node:assert/strict';
import fs from 'node:fs';
const changes=JSON.parse(fs.readFileSync('tests/fixtures/guard-spectacle-source-changes.json','utf8'));
const bossReleases=JSON.parse(fs.readFileSync('tests/fixtures/boss-release-paint-source-changes.json','utf8'));
const gunEdits=JSON.parse(fs.readFileSync('tests/fixtures/gun-finish-source-changes.json','utf8'));
// Reverse only declared gun, boss-release and guard edits; callers still compare the whole source.
export function restoreGunFinishSource(file,source){
 let restored=source.replaceAll('\r\n','\n');
 for(const [before,after]of [...(gunEdits[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' gun source edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
export function restorePreGuardSpectacleSource(file,source){
 let restored=restoreGunFinishSource(file,source);
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
