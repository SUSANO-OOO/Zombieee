import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultV100Save,serializeV100Save} from '../app/v100Save.js';
import {inspectV177InstalledSaveTransition} from '../scripts/v177-installed-save-contract.mjs';

function installedFixture(cursor=false){
  const old=JSON.parse(serializeV100Save(createDefaultV100Save({playerName:'保存確認'})));
  delete old.readStoryVersions;delete old.flowState.scriptVersion;
  if(cursor)old.eventCursor={eventId:'v100:event:prologue',phase:'event',nodeIndex:7,nodeKey:'v100:event:prologue:7'};
  const raw=JSON.stringify(old),native={record:{format:1,serialized:raw,checksum:'source-bound-old-record',legacyVerified:true}};
  return {mirror:old,raw,native};
}
function candidate(before){
  const raw=serializeV100Save(before.mirror);
  return {mirror:JSON.parse(raw),raw,native:structuredClone(before.native)};
}
test('first R5 read adds only empty R9 metadata and keeps the exact durable record',()=>{
  for(const cursor of [false,true]){
    const before=installedFixture(cursor),after=candidate(before),result=inspectV177InstalledSaveTransition(before,after);
    assert.equal(result.preserved,true);assert.equal(result.durablePreserved,true);
    assert.deepEqual(result.changedPaths,[]);
    assert.equal(result.addedFields.length,cursor?4:2);
    assert.equal(inspectV177InstalledSaveTransition(after,structuredClone(after)).preserved,true);
    assert.equal(inspectV177InstalledSaveTransition(after,structuredClone(after)).addedFields.length,0);
  }
});
test('the R9 update contract rejects progression, rewards, settings, cursor and durable changes',()=>{
  const before=installedFixture(true),expected=candidate(before);
  const changes=[
    after=>{after.mirror.caps+=1;},after=>{after.mirror.revision+=1;},
    after=>{after.mirror.receipts.push('duplicate-gift');},
    after=>{after.mirror.settings.bgmEnabled=!after.mirror.settings.bgmEnabled;},
    after=>{after.mirror.ownedUnitIds.pop();},after=>{after.mirror.formationSlots[0]=null;},
    after=>{after.mirror.eventCursor.nodeIndex=0;},
    after=>{after.mirror.readStoryVersions['v100:event:prologue']='producer-r9';},
    after=>{after.mirror.unapprovedMetadata=true;},
    after=>{after.native.record.serialized+=' ';},
  ];
  for(const mutate of changes){const after=structuredClone(expected);mutate(after);assert.equal(inspectV177InstalledSaveTransition(before,after).preserved,false);}
  const whitespace=structuredClone(expected);whitespace.raw+=' ';
  assert.equal(inspectV177InstalledSaveTransition(expected,whitespace).preserved,false,'subsequent reads retain exact mirror bytes');
});
