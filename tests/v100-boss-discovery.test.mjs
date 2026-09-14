import test from "node:test";
import assert from "node:assert/strict";
import { V100_BOSSES } from "../app/v100Registry.js";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, deserializeV100Save } from "../app/v100Save.js";
import { v100BossVisibleInOtherModes } from "../app/v100Transactions.js";
import { v100DiscoveredBosses } from "../app/v100BossProgress.js";

const reload = save => deserializeV100Save(serializeV100Save(save)).save;
const flags = boss => ({ discoveredIds: [boss.id], compendiumIds: [boss.compendiumId], outbreakIds: [boss.outbreakId],
  survivalIds: [boss.survivalId], storyReplayStageNumbers: [boss.stageNumber], defeatCounts: { [boss.id]: 7 } });

for (const boss of V100_BOSSES) test(`${boss.id} requires its own exact Story receipt for every discovery surface`, () => {
  const save = createDefaultV100Save(); save.bosses = flags(boss);
  for (const receipts of [[], [boss.firstDefeatReceipt.replace("first-defeat", "entrance")], [boss.firstDefeatReceipt.replace("v100:", "v099:")],
    V100_BOSSES.filter(other => other.id !== boss.id).map(other => other.firstDefeatReceipt)]) {
    const restored = reload({ ...save, receipts });
    assert.equal(v100BossVisibleInOtherModes(restored, boss.id), false);
    assert.equal(restored.bosses.discoveredIds.includes(boss.id), false);
    assert.equal(restored.bosses.compendiumIds.includes(boss.compendiumId), false);
    assert.equal(restored.bosses.outbreakIds.includes(boss.outbreakId), false);
    assert.equal(restored.bosses.survivalIds.includes(boss.survivalId), false);
    assert.equal(restored.bosses.storyReplayStageNumbers.includes(boss.stageNumber), false);
    assert.equal(restored.bosses.defeatCounts[boss.id], undefined);
  }
  save.receipts = [boss.firstDefeatReceipt];
  const restored = reload(save);
  assert.deepEqual(v100DiscoveredBosses(restored.receipts).map(b => b.id), [boss.id]);
  assert.equal(v100BossVisibleInOtherModes(restored, boss.id), true);
  assert.equal(restored.bosses.defeatCounts[boss.id], 7);
  assert.equal(restored.caps, save.caps); assert.equal(restored.revision, save.revision);
  assert.deepEqual(restored.receipts, save.receipts);
});

test("a proved first victory restores missing display lists without a second reward or extra victories", () => {
  const save = createDefaultV100Save(), boss = V100_BOSSES[0];
  save.receipts = [boss.firstDefeatReceipt]; save.caps = 150; save.revision = 22;
  const normalized = normalizeV100Save(save);
  assert.deepEqual(normalized.bosses, { ...flags(boss), defeatCounts: { [boss.id]: 1 } });
  assert.equal(normalized.caps, 150); assert.equal(normalized.revision, 22);
  assert.deepEqual(normalized.receipts, save.receipts); assert.deepEqual(normalized.equipment, save.equipment);
  assert.deepEqual(reload(normalized), normalized);
});

test("prototype, unknown and prototype-like IDs remain absent even with fabricated matching flags and receipts", () => {
  const save = createDefaultV100Save();
  for (const id of ["boss-kurome-prototype", "boss-unknown", "toString", "__proto__"]) {
    save.bosses = flags({ id, compendiumId: `compendium:${id}`, outbreakId: `outbreak:${id}`, survivalId: `survival:${id}`, stageNumber: 17 });
    save.receipts = [`v100:s17:${id}:first-defeat`];
    const normalized = reload(save);
    assert.deepEqual(normalized.bosses, createDefaultV100Save().bosses);
    assert.equal(v100BossVisibleInOtherModes(normalized, id), false);
    assert.equal(v100BossVisibleInOtherModes(normalized, "boss-kurome"), false);
  }
});

test("TAKUYA and omega retain separate receipt identities and exact prior counters", () => {
  const [takuya, omega] = [V100_BOSSES.find(b => b.id === "boss-takuya"), V100_BOSSES.find(b => b.id === "boss-takuya-omega")];
  const save = createDefaultV100Save();
  save.receipts = [takuya.firstDefeatReceipt]; save.bosses.defeatCounts = { [takuya.id]: 4, [omega.id]: 100 };
  assert.deepEqual(reload(save).bosses.defeatCounts, { [takuya.id]: 4 });
  save.receipts.push(omega.firstDefeatReceipt);
  assert.deepEqual(reload(save).bosses.defeatCounts, { [takuya.id]: 4, [omega.id]: 100 });
});
