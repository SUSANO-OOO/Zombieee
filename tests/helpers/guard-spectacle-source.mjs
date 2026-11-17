import assert from 'node:assert/strict';
import fs from 'node:fs';
const changes=JSON.parse(fs.readFileSync('tests/fixtures/guard-spectacle-source-changes.json','utf8'));
const corpseAtmosphereChanges=JSON.parse(fs.readFileSync('tests/fixtures/corpse-atmosphere-source-changes.json','utf8'));
const bossReleases=JSON.parse(fs.readFileSync('tests/fixtures/boss-release-paint-source-changes.json','utf8'));
const twinWording=JSON.parse(fs.readFileSync('tests/fixtures/twin-ability-wording-source-changes.json','utf8'));
const musashiPaint=JSON.parse(fs.readFileSync('tests/fixtures/musashi-manual-paint-source-changes.json','utf8'));
export function restorePreMusashiManualSource(file,source){
 let restored=restorePreTwinWordingSource(file,source);
 for(const [before,after]of [...(musashiPaint[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' Musashi paint edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
// Reverse only the declared boss-release and guard paint edits; callers compare the whole source.
export function restorePreGuardSpectacleSource(file,source){
 let restored=restorePreMusashiManualSource(file,source);
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

export function restorePreTwinWordingSource(file,source){
 let restored=restorePreCorpseAtmosphereSource(file,source);
 for(const [before,after]of [...(twinWording[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' twin presentation edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}

export function restorePreCorpseAtmosphereSource(file,source){
 let restored=source.replaceAll('\r\n','\n');
 for(const [before,after]of [...(corpseAtmosphereChanges[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' corpse paint edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
