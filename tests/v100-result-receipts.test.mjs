import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, deserializeV100Save } from '../app/v100Save.js';
import { V100_STAGE_IDS, V100_BOSSES, v100StageReward } from '../app/v100Registry.js';
import { createV100BattleResult, recordV100PendingResult, finalizeV100PendingResult } from '../app/v100Transactions.js';

const seed = () => normalizeV100Save({ ...createDefaultV100Save(), availableStageIds: V100_STAGE_IDS });
const result = (number, run, hp = 680) => createV100BattleResult({ stageId: V100_STAGE_IDS[number-1], battleRunId: run, won: true, objectiveComplete: true, bossDefeated: true, vehicleHp: hp, vehicleMaxHp: 680 });
const restore = save => { const parsed=deserializeV100Save(serializeV100Save(save)); assert.equal(parsed.ok,true); return parsed.save; };
const settle = (save, value) => { const pending=recordV100PendingResult(save,value); assert.equal(pending.applied,true); const final=finalizeV100PendingResult(pending.save); assert.equal(final.applied,true); return final.save; };
const unchanged = (before, actual) => { assert.equal(actual.applied,false); assert.equal(serializeV100Save(actual.save),serializeV100Save(before)); };

test('same initial result never becomes a paid replay after serialization or later results', () => {
  const firstResult=result(1,'first-s01'), first=settle(seed(),firstResult);
  assert.equal(first.caps,130);
  unchanged(first,recordV100PendingResult(first,firstResult));
  unchanged(first,finalizeV100PendingResult(first,{result:firstResult}));
  const replay=settle(restore(first),result(1,'new-replay-s01'));
  assert.equal(replay.caps,150);
  unchanged(replay,recordV100PendingResult(replay,firstResult));
  const stale=normalizeV100Save({...replay,pendingResult:firstResult});
  unchanged(stale,finalizeV100PendingResult(stale));
  assert.ok(first.receipts.includes('v100:s01:result:first-s01'));
  assert.ok(first.receipts.includes('v100:s01:first-clear'));
  assert.ok(replay.receipts.includes('v100:s01:replay:new-replay-s01'));
});

for (const boss of V100_BOSSES) test(`${boss.id} counts each unique victory once and discovers only itself`, () => {
  const firstResult=result(boss.stageNumber,`${boss.id}:first`);
  const first=settle(seed(),firstResult);
  assert.equal(first.bosses.defeatCounts[boss.id],1);
  assert.deepEqual(first.bosses.discoveredIds,[boss.id]);
  assert.deepEqual(first.bosses.outbreakIds,[boss.outbreakId]);
  assert.deepEqual(first.bosses.survivalIds,[boss.survivalId]);
  const replayResult=result(boss.stageNumber,`${boss.id}:replay`);
  const replay=settle(restore(first),replayResult);
  assert.equal(replay.caps-first.caps,v100StageReward(boss.stageNumber,'replay'));
  assert.equal(replay.bosses.defeatCounts[boss.id],2);
  assert.deepEqual(replay.bosses.discoveredIds,[boss.id]);
  assert.equal(replay.receipts.filter(r=>r===boss.firstDefeatReceipt).length,1);
  unchanged(replay,recordV100PendingResult(replay,replayResult));
  unchanged(replay,recordV100PendingResult(replay,firstResult));
  assert.equal(Object.keys(replay.bosses.defeatCounts).length,1);
});

test('a new replay can improve missing stars once while a changed duplicate cannot', () => {
  const firstResult=result(1,'low-hp-first',68), first=settle(seed(),firstResult);
  const expectedFirst=v100StageReward(1,'first-clear');
  assert.equal(first.caps,expectedFirst); assert.equal(first.bestStars[V100_STAGE_IDS[0]],1);
  unchanged(first,recordV100PendingResult(first,{...result(1,'low-hp-first'),elapsedSeconds:999}));
  const replayResult=result(1,'star-improvement'), replay=settle(first,replayResult);
  assert.equal(replay.caps,expectedFirst+v100StageReward(1,'replay')+v100StageReward(1,'star:2')+v100StageReward(1,'star:3'));
  const next=settle(replay,result(1,'another-real-replay'));
  assert.equal(next.caps-replay.caps,v100StageReward(1,'replay'));
  unchanged(next,recordV100PendingResult(next,replayResult));
});

test('known pre-fix finalized runs and replay receipts remain protected without inventing history', () => {
  const firstResult=result(3,'pre-fix-first'), first=settle(seed(),firstResult);
  const old=normalizeV100Save({...first,receipts:first.receipts.filter(r=>!r.includes(':result:'))});
  unchanged(restore(old),recordV100PendingResult(restore(old),firstResult));
  const replayResult=result(3,'pre-fix-replay'), replay=settle(old,replayResult);
  const later=settle(replay,result(1,'later-result'));
  const oldReplay=normalizeV100Save({...later,receipts:later.receipts.filter(r=>!r.includes(':result:'))});
  unchanged(oldReplay,recordV100PendingResult(oldReplay,replayResult));
});

test('settlement consumes the stored pending payload and rejects substitution or an unrecorded result', () => {
  const initial=seed(), pendingResult=result(3,'pending-owner');
  unchanged(initial,finalizeV100PendingResult(initial,{result:pendingResult}));
  const pending=recordV100PendingResult(initial,pendingResult).save;
  for(const replacement of [result(3,'other-owner'),result(5,'other-stage'),{...pendingResult,vehicleHp:1},{...pendingResult,resultId:'wrong-id'}]) unchanged(pending,finalizeV100PendingResult(pending,{result:replacement}));
  unchanged(pending,recordV100PendingResult(pending,result(1,'competing')));
  assert.equal(finalizeV100PendingResult(pending,{result:{...pendingResult}}).applied,true);
});

test('invalid identities and victory facts never enter or settle a pending result', () => {
  const initial=seed(), valid=result(3,'valid');
  const invalid=[{battleRunId:''},{battleRunId:' '.repeat(3)},{battleRunId:'x'.repeat(257)},{battleRunId:'bad\nrun'},
    {resultId:'mismatch'},{stageNumber:5},{stageId:'toString',stageNumber:undefined},{stageId:'__proto__',stageNumber:undefined},{stageId:'unregistered-stage'},{won:false},{objectiveComplete:false},{bossDefeated:false},
    {vehicleHp:0},{vehicleHp:681},{vehicleHp:NaN},{vehicleMaxHp:Infinity},{stars:1}];
  for(const patch of invalid){const value={...valid,...patch};unchanged(initial,recordV100PendingResult(initial,value));const pending=normalizeV100Save({...initial,pendingResult:value});unchanged(pending,finalizeV100PendingResult(pending));}
  const locked=recordV100PendingResult(createDefaultV100Save(),valid).save;
  unchanged(locked,finalizeV100PendingResult(locked));
});
