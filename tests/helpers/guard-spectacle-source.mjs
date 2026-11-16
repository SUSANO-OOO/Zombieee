import assert from 'node:assert/strict';
import fs from 'node:fs';
const changes=JSON.parse(fs.readFileSync('tests/fixtures/guard-spectacle-source-changes.json','utf8'));
// Reverse only the three approved paint edits; the caller still compares the whole source.
export function restorePreGuardSpectacleSource(file,source){
 let restored=source.replaceAll('\r\n','\n');
 for(const [before,after]of [...(changes[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' guard paint edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
