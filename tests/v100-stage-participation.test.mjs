import test from 'node:test';
import assert from 'node:assert/strict';
import {V100_STAGE_IDS,V100_INITIAL_UNIT_IDS} from '../app/v100Registry.js';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {v100AvailableFormation,v100StageAbsenceReason} from '../app/v100StageParticipation.js';
import {v100ProductionSessionFor} from '../app/v100BattleAdapter.js';

test('Paisen rescues inside S01/S02; the other initial allies can protect the route',()=>{
  for(const id of V100_STAGE_IDS.slice(0,2)){
    assert.match(v100StageAbsenceReason(id,'unit-paisen'),/救助中/u);
    assert.deepEqual(v100AvailableFormation(id,V100_INITIAL_UNIT_IDS),['unit-hachi','unit-kumaverson','unit-babayaga']);
    const session=v100ProductionSessionFor({save:createDefaultV100Save(),stageId:id});
    assert.ok(!session.formationKinds.includes('brawler'));
    assert.ok(!session.barkSpeakerKinds.includes('brawler'),'Off-field rescue must not produce battlefield Paisen barks');
    assert.equal(session.formationKinds.length,3);
  }
});

test('mission exclusion never removes saved ownership, training, equipment or duplicate slots',()=>{
  const save=normalizeV100Save({...createDefaultV100Save(),caps:1234,unitLevels:{'unit-paisen':5},
    formationSlots:['unit-paisen','unit-hachi','unit-paisen','unit-babayaga',null,null,null]});
  const bytes=serializeV100Save(save);
  const session=v100ProductionSessionFor({save,stageId:V100_STAGE_IDS[0]});
  assert.deepEqual(session.formationUnitIds,['unit-hachi','unit-babayaga']);
  assert.equal(serializeV100Save(save),bytes);
  const resumed=normalizeV100Save(JSON.parse(bytes));
  assert.deepEqual(resumed.formationSlots,save.formationSlots);
  for(const id of V100_STAGE_IDS.slice(2)){
    assert.equal(v100StageAbsenceReason(id,'unit-paisen'),null);
    const later=v100ProductionSessionFor({save:resumed,stageId:id});
    assert.deepEqual(later.formationUnitIds,['unit-paisen','unit-hachi','unit-paisen','unit-babayaga']);
    assert.equal(later.formationKinds.filter(k=>k==='brawler').length,2);
  }
  assert.deepEqual(v100AvailableFormation(null,save.formationSlots),['unit-paisen','unit-hachi','unit-paisen','unit-babayaga'],'Shared mode preparation remains unrestricted');
});

test('a legacy Paisen-only sortie is empty without silently inserting another unit',()=>{
  const save={...createDefaultV100Save(),formationSlots:Array(7).fill('unit-paisen')};
  const before=JSON.stringify(save);
  const session=v100ProductionSessionFor({save,stageId:V100_STAGE_IDS[1]});
  assert.deepEqual(session.formationKinds,[]);
  assert.equal(JSON.stringify(save),before);
});
