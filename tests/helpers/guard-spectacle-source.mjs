import assert from 'node:assert/strict';
import fs from 'node:fs';
const gunEdits=JSON.parse(fs.readFileSync('tests/fixtures/gun-finish-source-changes.json','utf8'));
export function restoreGunFinishSource(file,source){
 let restored=source.replaceAll('\r\n','\n');
 for(const [before,after]of [...(gunEdits[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' gun source edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
const changes=JSON.parse(fs.readFileSync('tests/fixtures/guard-spectacle-source-changes.json','utf8'));
const clearBannerChanges=JSON.parse(fs.readFileSync('tests/fixtures/phone-boss-clear-banner-source-changes.json','utf8'));
const tacticsUiChanges=JSON.parse(fs.readFileSync('tests/fixtures/manual-tactics-ui-source-changes.json','utf8'));
const corpseAtmosphereChanges=JSON.parse(fs.readFileSync('tests/fixtures/corpse-atmosphere-source-changes.json','utf8'));
const battleCardPanChanges=JSON.parse(fs.readFileSync('tests/fixtures/battle-card-pan-source-changes.json','utf8'));
const bossReleases=JSON.parse(fs.readFileSync('tests/fixtures/boss-release-paint-source-changes.json','utf8'));
const twinWording=JSON.parse(fs.readFileSync('tests/fixtures/twin-ability-wording-source-changes.json','utf8'));
const musashiPaint=JSON.parse(fs.readFileSync('tests/fixtures/musashi-manual-paint-source-changes.json','utf8'));
const mayoFeralChanges=JSON.parse(fs.readFileSync('tests/fixtures/mayo-feral-ground-source-changes.json','utf8'));
const lateBossScaleChanges=JSON.parse(fs.readFileSync('tests/fixtures/phone-late-boss-scale-source-changes.json','utf8'));
export function restorePreLateBossScaleSource(file,source){
 let restored=restoreGunFinishSource(file,source);
 for(const [before,after]of [...(lateBossScaleChanges[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' Unlisted source change: phone boss scale edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
export function restorePreMayoFeralSource(file,source){
 let restored=restorePreLateBossScaleSource(file,source);
 for(const [before,after]of [...(mayoFeralChanges[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' Unlisted source change: Mayo ground edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
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
 let restored=restorePreBattleCardPanSource(file,source);
 for(const [before,after]of [...(corpseAtmosphereChanges[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' corpse paint edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}

export function restorePreBattleCardPanSource(file,source){
 let restored=restorePreMayoFeralSource(file,source);
 for(const [before,after]of [...(clearBannerChanges[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' phone boss clear banner edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 for(const [before,after]of [...(tacticsUiChanges[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' manual tactics UI edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 for(const [before,after]of [...(battleCardPanChanges[file]??[])].reverse()){
  assert.equal(restored.split(after).length,2,file+' battle card pan edit must occur exactly once');
  restored=restored.replace(after,before);
 }
 return restored;
}
