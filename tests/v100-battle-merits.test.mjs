import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { v100BattleMeritsFor } from "../app/v100BattleReport.js";
import { V100_STAGE_IDS, V100_UNITS, v100StarsForVehicle } from "../app/v100Registry.js";
import { createDefaultV100Save } from "../app/v100Save.js";
import { createV100BattleResult, finalizeV100PendingResult, recordV100PendingResult } from "../app/v100Transactions.js";

const current = (patch = {}) => ({ stageId: V100_STAGE_IDS[0], battleRunId: "current", won: true, objectiveComplete: true,
  vehicleHp: 68, vehicleMaxHp: 680, unitDeaths: 2, elapsedSeconds: 70, ...patch });
const previous = (patch = {}) => current({ battleRunId: "previous", unitDeaths: 4, elapsedSeconds: 100, ...patch });
const ids = (r, p) => v100BattleMeritsFor(r, p).map(m => m.id);
const report = units => ({ wave: 5, kills: 23, units });
const row = (unitId, damage, healing = 0) => ({ unitId, damage, damageTaken: 10, healing });
const settle = (save, r) => { const now = 1793476800000; const pending = recordV100PendingResult(save, r, { now }); assert.equal(pending.applied, true);
  const final = finalizeV100PendingResult(pending.save, { now }); assert.equal(final.applied, true); return final.save; };

test("a one-star clear can celebrate no casualties independently of vehicle stars", () => {
  const value = current({ unitDeaths: 0 });
  assert.equal(v100StarsForVehicle(value), 1);
  assert.equal(v100BattleMeritsFor(value)[0].title, "戦闘不能なし");
  assert.equal(v100StarsForVehicle(value), 1);
  assert.deepEqual(ids(current({ vehicleHp: 680, unitDeaths: 2 })), []);
});

test("the actual retained S01 result names only a measured contributor, without inventing improvement", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/quality-earned-replay-result-s01-e412.json", import.meta.url)));
  const { pendingResult, lastResult } = fixture.save;
  const before = structuredClone(fixture.save);
  const merits = v100BattleMeritsFor(pendingResult, lastResult);
  assert.ok(merits.some(m => m.id === "damage" && m.unitIds.every(id => pendingResult.battleReport.units.some(u => u.unitId === id && u.damage > 0))));
  assert.ok(!merits.some(m => ["no-down", "fewer-downs", "faster-clear"].includes(m.id)));
  assert.deepEqual(fixture.save, before);
});

test("the same stage's immediately previous win supports fewer casualties and a faster clear", () => {
  assert.deepEqual(ids(current(), previous()), ["fewer-downs", "faster-clear"]);
  const merits = v100BattleMeritsFor(current(), previous());
  assert.equal(merits[0].detail, "前回4回 → 今回2回");
  assert.equal(merits[1].title, "前回より速く突破");
  const noDown = v100BattleMeritsFor(current({ unitDeaths: 0 }), previous());
  assert.equal(noDown[0].id, "no-down");
  assert.equal(noDown[0].detail, "前回4回 → 今回0回");
  assert.ok(!noDown.some(m => m.id === "fewer-downs"));
});

test("another stage, loss, incomplete result, same run or legacy run cannot imply a personal improvement", () => {
  for (const patch of [{ stageId: V100_STAGE_IDS[1] }, { won: false }, { objectiveComplete: false },
    { battleRunId: "current" }, { battleRunId: null }, { battleRunId: "" }]) {
    assert.deepEqual(ids(current(), previous(patch)), [], JSON.stringify(patch));
  }
  assert.deepEqual(ids(current({ battleRunId: undefined }), previous()), []);
});

test("rounded result seconds cannot contradict a separate claimed reduction", () => {
  const merit = v100BattleMeritsFor(current({ elapsedSeconds: 99.4 }), previous({ elapsedSeconds: 100.6 })).find(m => m.id === "faster-clear");
  assert.equal(merit.title, "前回より速く突破");
  assert.equal(merit.detail, "前回101秒 → 今回99秒");
});

test("invalid and missing measurements never become zero casualties or a positive clear time", () => {
  for (const value of [undefined, null, "0", false, -1, Infinity, NaN, .5]) {
    assert.ok(!ids(current({ unitDeaths: value }), previous({ elapsedSeconds: 1 })).includes("no-down"));
  }
  for (const time of [undefined, null, "60", 0, -1, Infinity, NaN]) {
    assert.ok(!ids(current({ elapsedSeconds: time }), previous()).includes("faster-clear"));
    assert.ok(!ids(current(), previous({ elapsedSeconds: time })).includes("faster-clear"));
  }
  assert.ok(!ids(current({ elapsedSeconds: 100.2 }), previous()).includes("faster-clear"));
  assert.ok(!ids(current({ elapsedSeconds: 99.2 }), previous()).includes("faster-clear"));
  assert.ok(!ids(current({ elapsedSeconds: 100 }), previous()).includes("faster-clear"));
});

test("losses, unfinished objectives and unknown stages never receive victory merits", () => {
  for (const value of [null, {}, current({ won: false }), current({ objectiveComplete: false }),
    current({ stageId: "unknown" }), current({ won: 1 })]) assert.deepEqual(v100BattleMeritsFor(value, previous()), []);
});

test("attack and healing credit use actual roster measurements and preserve joint leaders", () => {
  const [a, b, c] = V100_UNITS.map(u => u.id);
  const value = current({ battleReport: report([row(a, 100), row(b, 100, 44.4), row(c, 90, 44.4)]) });
  const merits = v100BattleMeritsFor(value);
  assert.deepEqual(merits.map(m => m.id), ["damage", "healing"]);
  assert.deepEqual(merits[0].unitIds, [a, b]);
  assert.equal(merits[0].detail, "100 ダメージずつ");
  assert.deepEqual(merits[1].unitIds, [b, c]);
  assert.equal(merits[1].detail, "44 HP回復ずつ（自分への回復も含む）");
  const many = v100BattleMeritsFor(current({ battleReport: report([row(a, 25), row(b, 25), row(c, 25)]) }));
  assert.equal(many[0].title, "攻撃を支えた 3人");
  assert.deepEqual(many[0].unitIds, [a, b, c]);
});

test("zero, invalid and unregistered contributions cannot manufacture an award or participant", () => {
  const a = V100_UNITS[0].id;
  assert.deepEqual(ids(current({ battleReport: report([row(a, 0)]) })), []);
  assert.deepEqual(ids(current({ battleReport: report([row("unit-vehicle", 999999, 999999), row(a, NaN, 99)]) })), []);
  assert.deepEqual(ids(current({ battleReport: null })), []);
});

test("every stage retains exact stars, CAPS, receipts and stored measurements after presentation", () => {
  for (const stageId of V100_STAGE_IDS) {
    const r = createV100BattleResult({ ...current({ stageId, unitDeaths: 0 }), bossDefeated: true });
    const save = createDefaultV100Save();
    save.availableStageIds = [...V100_STAGE_IDS];
    const before = structuredClone(r);
    const untouched = settle(structuredClone(save), r);
    assert.equal(v100BattleMeritsFor(r)[0].id, "no-down");
    const displayed = settle(structuredClone(save), r);
    // Separate settlements have their own top-level write timestamps.
    assert.deepEqual({ ...displayed, updatedAt: null }, { ...untouched, updatedAt: null });
    assert.deepEqual(r, before);
  }
});
