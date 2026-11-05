import test from 'node:test';
import assert from 'node:assert/strict';
import { V100_NODE_PROFILES } from '../app/v100MissionNodes.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';
import { v100BattleDefinitionFor } from '../app/v100BattleAdapter.js';
import { v100BattleReportFor, normalizeV100BattleReport, v100DeviceResultText } from '../app/v100BattleReport.js';
import { createV100BattleResult } from '../app/v100Transactions.js';
import { createDefaultV100Save, serializeV100Save, deserializeV100Save } from '../app/v100Save.js';

const raw = (stageId, powerActivated) => ({ stageId, wave: 5, kills: 13,
  unitStats: { damageByUnit: { medic: 213 }, damageTakenByUnit: { medic: 308 }, healingByUnit: { medic: 284 } },
  missionRuntime: { missionType: 'sequential-seal', powerActivated, completed: false, sealed: false },
});
const result = (input, battleReport = v100BattleReportFor(input)) => createV100BattleResult({
  stageId: input.stageId, battleRunId: 'device-result', won: false, objectiveComplete: false,
  vehicleHp: 0, vehicleMaxHp: 680, elapsedSeconds: 85.73333333332975, unitDeaths: 6, battleReport,
});

test('all four device objectives retain measured counts through result/save without changing outcome or economy', () => {
  for (const [stageId, profile] of Object.entries(V100_NODE_PROFILES)) {
    const definition = v100BattleDefinitionFor(stageId), total = definition.missionConfig.powerCount;
    assert.equal(definition.missionType, 'sequential-seal');
    for (const count of [0, total - 1, total]) {
      const input = raw(stageId, count), before = structuredClone(input), value = result(input);
      assert.deepEqual(input, before);
      const { battleReport, ...facts } = value;
      assert.deepEqual(facts, result(input, null));
      const seed = { ...createDefaultV100Save(), lastResult: value };
      const parsed = deserializeV100Save(serializeV100Save(seed));
      assert.equal(parsed.ok, true);
      assert.deepEqual(parsed.save.lastResult.battleReport, battleReport);
      for (const key of ['caps', 'receipts', 'bestStars', 'completedStageIds', 'formationSlots', 'equipment', 'unitLevels']) assert.deepEqual(parsed.save[key], seed[key]);
      const text = v100DeviceResultText(parsed.save.lastResult);
      assert.equal(text.progress, `${profile.label} ${count}/${total}基を${profile.verb}`);
      assert.equal(text.detail, count === total ? '装置の操作後も、敵の掃討と全員帰還が必要' : `残り${total - count}基の${profile.label}を${profile.verb}`);
      assert.equal(parsed.save.lastResult.won, false);
      assert.equal(parsed.save.lastResult.objectiveComplete, false);
    }
  }
});

test('S09 full activation is progress, not a completed mission or invented return receipt', () => {
  const value = result(raw('stage-hospital-evacuation-route', 3));
  assert.deepEqual(value.battleReport.deviceProgress, { stageId: value.stageId, powerActivated: 3 });
  assert.deepEqual(v100DeviceResultText(value), {
    progress: '電源 3/3基を起動', detail: '装置の操作後も、敵の掃討と全員帰還が必要',
  });
});

test('old saves, wrong stages and malformed counts do not invent device progress', () => {
  const input = raw('stage-hospital-evacuation-route', 3), value = result(input);
  for (const progress of [null, {}, { stageId: 'toString', powerActivated: 0 },
    ...[-1, 4, 1.5, Infinity, NaN, '3', undefined].map(powerActivated => ({ stageId: input.stageId, powerActivated }))]) {
    const report = normalizeV100BattleReport({ ...value.battleReport, deviceProgress: progress });
    assert.equal(report.deviceProgress, undefined);
    assert.equal(v100DeviceResultText({ ...value, battleReport: report }), null);
  }
  assert.equal(v100DeviceResultText({ ...value, won: true }), null);
  assert.equal(v100DeviceResultText({ ...value, stageId: V100_STAGE_IDS[0] }), null);
  assert.equal(v100DeviceResultText({ ...value, battleReport: undefined }), null);
  assert.equal(v100BattleReportFor({ ...input, missionRuntime: undefined }).deviceProgress, undefined);
  assert.equal(v100BattleReportFor({ ...input, missionRuntime: { ...input.missionRuntime, missionType: 'escort' } }).deviceProgress, undefined);
  for (const stageId of V100_STAGE_IDS.filter(id => !Object.hasOwn(V100_NODE_PROFILES, id))) {
    assert.equal(v100BattleReportFor({ ...input, stageId }).deviceProgress, undefined);
  }
});
