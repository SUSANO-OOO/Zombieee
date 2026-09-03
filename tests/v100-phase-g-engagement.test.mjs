import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { createV100PhaseGProofMachine } from "../scripts/v100-phase-g-proof-machine.mjs";

// Execute the actual collector, not a second model, with only browser I/O and
// clocks substituted. No browser, production entrypoint, or wording regex runs.
const source = await readFile(new URL("../scripts/v100-phase-g-production-matrix.mjs", import.meta.url), "utf8");
const start = source.indexOf("async function collectCombatCausalProof(");
const end = source.indexOf("async function saveScreenshot(", start);
assert.ok(start >= 0 && end > start, "actual collector source must be present");
const collectorSource = source.slice(start, end);
const machine = createV100PhaseGProofMachine();
const receipt = (overrides = {}) => ({
  schema: machine.receiptSchema,
  battleGeneration: 2,
  sourceId: 3,
  sourceSide: "zombie",
  sourceKind: "spitter",
  attackSequence: 1,
  targetId: 1,
  targetSide: "human",
  targetKind: "ranger",
  impactOrdinal: 0,
  mode: "projectile",
  committedAtBattleTime: 30,
  contactAtBattleTime: 30.2,
  reactionOutcome: "hit",
  audioCueId: "spitter-attack",
  audioReceiptId: "combat-attack:2:3:1",
  audioRequestObserved: true,
  ...overrides,
});
const ranger = (overrides = {}) => receipt({
  sourceId: 1, sourceSide: "human", sourceKind: "ranger",
  targetId: 3, targetSide: "zombie", targetKind: "spitter",
  audioCueId: "ranger-shot", audioReceiptId: "combat-attack:2:1:1",
  ...overrides,
});

function fixture(getReceipts, { readStatus = null, readDelayMs = () => 0, snapshotOverrides = () => ({}), pageOffset = () => 0 } = {}) {
  let now = 0;
  let reads = 0;
  const rpcBounds = [];
  const collect = vm.runInNewContext(`${collectorSource}\ncollectCombatCausalProof`, {
    phaseGProofMachine: machine,
    battleTimeout: 150_000,
    COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS: 2_000,
    Date: { now: () => now },
    setTimeout: (callback, ms) => { now += ms; callback(); },
    invariant: (condition, message) => assert.ok(condition, message),
    observePromiseWithin: async (promise, ms) => {
      rpcBounds.push(ms);
      const value = await promise;
      now += readDelayMs(reads);
      return readStatus?.(reads) ?? { status: "fulfilled", value };
    },
  });
  const page = {
    evaluate: async () => {
      reads += 1;
      return {
        pageNow: 10_000 + now + pageOffset(now),
        snapshot: {
          schema: "v100-phase-g-combat-snapshot/v1",
          screen: "battle",
          battleGeneration: 2,
          time: 20 + now / 1_000,
          completedAttackImpacts: getReceipts(now, reads),
          ...snapshotOverrides(now, reads),
        },
      };
    },
  };
  return {
    run: (options = {}) => collect(page, {
      durationMs: 12_000,
      requiredCompletedImpactActorKeys: ["zombie:spitter", "human:ranger"],
      ...options,
    }),
    elapsed: () => now,
    advance: (ms) => { now += ms; },
    reads: () => reads,
    rpcBounds,
  };
}

test("pre-engagement movement does not consume the unchanged 12-second proof window", async () => {
  const f = fixture((now) => now < 30_000 ? [] : now < 30_240 ? [receipt()] : [receipt(), ranger()]);
  const result = await f.run();
  assert.equal(result.ok, true);
  assert.equal(result.completedImpactProof.startedAtPageTime, 40_000);
  assert.equal(result.completedImpactProof.startedAtBattleTime, 30);
  assert.equal(result.completedImpactProof.deadlineAtPageTime, 52_000);
  assert.equal(result.collection.engagement.setupBudgetMs, 45_000);
  assert.equal(result.collection.engagement.anchorImpactKey, machine.impactKeyFor(receipt()));
  assert.deepEqual(result.completedImpactProof.receiptsByActor["zombie:spitter"], receipt());
  assert.deepEqual(result.completedImpactProof.receiptsByActor["human:ranger"], ranger());
});

test("baseline, stale-generation, and wrong-kind receipts cannot start engagement", async () => {
  const baseline = receipt({ attackSequence: 9, audioReceiptId: "combat-attack:2:3:9" });
  const stale = receipt({ battleGeneration: 1, audioReceiptId: "combat-attack:1:3:1" });
  const unrelated = receipt({ sourceId: 8, sourceKind: "walker", audioReceiptId: "combat-attack:2:8:1" });
  const f = fixture((now) => now === 0 ? [baseline] : now < 4_080
    ? [baseline, stale, unrelated] : [baseline, stale, unrelated, receipt(), ranger()]);
  const result = await f.run();
  assert.equal(result.ok, true);
  assert.equal(result.completedImpactProof.startedAtPageTime, 14_080);
  assert.deepEqual([...result.collection.engagement.baselineImpactKeys], [machine.impactKeyFor(baseline)]);
  assert.equal(result.completedImpactProof.receiptsByActor["zombie:spitter"].attackSequence, 1);
});

test("new in-flight completion seeds the same snapshot but never reuses a baseline impact", async () => {
  const oldRanger = ranger({ committedAtBattleTime: 19.5, contactAtBattleTime: 19.8 });
  const impact = receipt({ committedAtBattleTime: 19, contactAtBattleTime: 20.1 });
  const newRanger = ranger({ attackSequence: 2, audioReceiptId: "combat-attack:2:1:2", committedAtBattleTime: 20.2, contactAtBattleTime: 20.3 });
  const f = fixture((now) => now === 0 ? [oldRanger] : now < 360 ? [oldRanger, impact] : [oldRanger, impact, newRanger]);
  const result = await f.run();
  assert.equal(result.ok, true);
  assert.equal(result.completedImpactProof.startedAtBattleTime, 19);
  assert.equal(result.completedImpactProof.startedAtPageTime, 10_120);
  assert.equal(result.completedImpactProof.acceptedAtPageTime, 10_360);
  assert.equal(result.completedImpactProof.receiptsByActor["human:ranger"].attackSequence, 2);
  assert.equal(result.completedImpactProof.seenImpactValues[machine.impactKeyFor(oldRanger)], undefined);
});

test("no required completed attack stops at one 45-second setup deadline without retry", async () => {
  for (const getReceipts of [() => [], (now) => now ? [receipt({ sourceKind: "walker" })] : []]) {
    const f = fixture(getReceipts);
    await assert.rejects(f.run(), { code: "COMBAT_ENGAGEMENT_DEADLINE_EXCEEDED" });
    assert.equal(f.elapsed(), 45_000);
    assert.equal(f.reads(), 375);
    assert.ok(f.rpcBounds.every((ms) => ms > 0 && ms <= 2_000));
  }
});

test("invalid audio/reaction/identity and conflicting impacts fail before opening a proof", async () => {
  for (const impacts of [
    [receipt({ audioReceiptId: "combat-attack:2:99:1" })],
    [receipt({ reactionOutcome: null })],
    [receipt({ sourceId: 0 })],
    [receipt({ targetSide: "zombie" })],
    [receipt(), receipt({ audioCueId: "another-cue" })],
  ]) {
    const f = fixture((now) => now ? impacts : []);
    await assert.rejects(f.run(), { code: impacts.length > 1 ? "CONFLICTING_IMPACT_IDENTITY" : "COMPLETED_IMPACT_RECEIPT_INVALID" });
    assert.equal(f.elapsed(), 120);
  }
});

test("generation, route, snapshot and clock loss cannot restart the setup epoch", async () => {
  for (const override of [{ battleGeneration: 3 }, { screen: "result" }, { time: NaN }, { completedAttackImpacts: null }, { schema: "other" }]) {
    const f = fixture(() => [], { snapshotOverrides: (now) => now ? override : {} });
    await assert.rejects(f.run(), { code: "COMBAT_ENGAGEMENT_SNAPSHOT_INVALID" });
    assert.equal(f.reads(), 2);
  }
  const late = fixture((now) => now ? [receipt(), ranger()] : [], { pageOffset: (now) => now ? 45_001 : 0 });
  await assert.rejects(late.run(), { code: "COMBAT_ENGAGEMENT_DEADLINE_EXCEEDED" });
});

test("one completed actor cannot reset or extend the proof deadline for a missing second actor", async () => {
  const f = fixture((now) => now >= 1_080 ? [receipt()] : []);
  const result = await f.run();
  assert.equal(result.ok, false);
  assert.equal(result.completedImpactProof.failure.code, "PROOF_DEADLINE_EXCEEDED");
  assert.equal(result.completedImpactProof.deadlineAtPageTime, 23_080);
  assert.equal(f.elapsed(), 13_080);
});

test("Stage 24 keeps 4800 ms and the existing screenshot and cleanup acceptance", async () => {
  const commander = receipt({ sourceKind: "red-panther-commander", mode: "direct" });
  const f = fixture((now) => now >= 30_000 ? [commander] : []);
  const result = await f.run({ durationMs: 4_800, requiredCompletedImpactActorKeys: ["zombie:red-panther-commander"] });
  assert.equal(result.ok, true);
  assert.equal(result.completedImpactProof.deadlineAtPageTime, 44_800);
  const screenshot = { path: "production.png", sha256: "exact-production-png", bytes: 2_000 };
  const bound = machine.attachScreenshot(result.completedImpactProof, { screenshot, pageNow: 40_300 });
  assert.equal(bound.state, "SCREENSHOT_BOUND");
  assert.equal(machine.complete(bound, { pageNow: 40_310, observerStopped: true }).state, "COMPLETE");
  assert.equal(machine.attachScreenshot(result.completedImpactProof, { screenshot, pageNow: 44_801 }).failure.code, "SCREENSHOT_DEADLINE_EXCEEDED");
});

test("engagement RPC loss seals page calls and stops without a retry", async () => {
  for (const status of ["timeout", "rejected"]) {
    const f = fixture(() => [], { readStatus: (reads) => reads === 2 ? { status } : null });
    await assert.rejects(f.run(), (error) => error.phaseGCausalNoFurtherPageRpc === true
      && error.code === (status === "timeout" ? "PHASE_G_CAUSAL_TRANSACTION_TIMEOUT" : "PHASE_G_CAUSAL_TRANSACTION_REJECTED"));
    assert.equal(f.reads(), 2);
  }
});

test("setup expiry retains baseline and last successful read without a post-deadline RPC", async () => {
  const f = fixture(() => []);
  await assert.rejects(f.run(), (error) => {
    assert.equal(error.code, "COMBAT_ENGAGEMENT_DEADLINE_EXCEEDED");
    assert.equal(error.phaseGCausalNoFurtherPageRpc, true);
    const evidence = error.phaseGCausalTransaction;
    assert.equal(evidence.setupBudgetMs, 45000);
    assert.equal(evidence.baseline.pageNow, 10000);
    assert.equal(evidence.latest.pageNow, 54880);
    assert.equal(evidence.readCount, 375);
    assert.equal(evidence.lastRead.status, "fulfilled");
    assert.deepEqual([...evidence.requiredActorKeys], ["zombie:spitter", "human:ranger"]);
    return true;
  });
  assert.equal(f.elapsed(), 45000);
  assert.equal(f.reads(), 375);
  assert.equal(Math.min(...f.rpcBounds), 120);
});

test("a final short-budget RPC expiry is classified as setup expiry, not a WebKit stall", async () => {
  const f = fixture(() => [], {
    readDelayMs: (reads) => reads === 375 ? 120 : 0,
    readStatus: (reads) => reads === 375 ? { status: "timeout" } : null,
  });
  await assert.rejects(f.run(), (error) => {
    assert.equal(error.code, "COMBAT_ENGAGEMENT_DEADLINE_EXCEEDED");
    assert.equal(error.phaseGCausalTransaction.lastRead.budgetMs, 120);
    assert.equal(error.phaseGCausalTransaction.lastRead.elapsedMs, 120);
    assert.equal(error.phaseGCausalTransaction.latest.pageNow, 54760);
    return true;
  });
  assert.equal(f.elapsed(), 45000);
  assert.equal(f.reads(), 375);
});

test("an early actual two-second RPC timeout stays distinct and retains its previous success", async () => {
  const f = fixture(() => [], {
    readDelayMs: (reads) => reads === 2 ? 2000 : 0,
    readStatus: (reads) => reads === 2 ? { status: "timeout" } : null,
  });
  await assert.rejects(f.run(), (error) => {
    assert.equal(error.code, "PHASE_G_CAUSAL_TRANSACTION_TIMEOUT");
    assert.equal(error.phaseGCausalTransaction.lastRead.budgetMs, 2000);
    assert.equal(error.phaseGCausalTransaction.lastRead.elapsedMs, 2000);
    assert.equal(error.phaseGCausalTransaction.latest.pageNow, 10000);
    return true;
  });
  assert.equal(f.reads(), 2);
});

test("lanes without required completed-impact actor keys retain their existing epoch", async () => {
  const f = fixture(() => [receipt()]);
  const result = await f.run({ requiredCompletedImpactActorKeys: [] });
  assert.equal(result.ok, true);
  assert.equal(result.collection.engagement, null);
  assert.equal(result.completedImpactProof.startedAtPageTime, 10_000);
  assert.equal(f.reads(), 1);
});
