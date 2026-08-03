import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  V099_BOSS_DEFEAT_TIMELINE,
  V099_EXPLOSION_PROFILES,
  V099_PRESENTATION_LIMITS,
  advanceBattlePresentationRuntime,
  battleResultPresentationPending,
  battlePresentationSnapshot,
  crawlerGroundingSnapshot,
  createBattlePresentationRuntime,
  drumArrivalPose,
  queueSemanticBattlePresentation,
  resetBattlePresentationRuntime,
} from "../app/battlePresentationV099.js";
import {
  BATTLEFIELD_SUPPLY_DEFS,
  BATTLEFIELD_SUPPLY_COOLDOWN_SECONDS,
  advanceBattlefieldSupply,
  requestDrumDetonation,
  resolveBattlefieldSupplyPlacement,
} from "../app/gameRules.js";

test("semantic receipts create one bounded visual without owning audio or gameplay", () => {
  let runtime = createBattlePresentationRuntime(7);
  const event = {
    generation: 7,
    semantic: "explosion-result",
    receiptId: "drum:12:detonation",
    ownerId: "drum:12",
    kind: "explosion",
    scale: "medium",
    x: 420,
    y: 280,
  };
  const first = queueSemanticBattlePresentation(runtime, event);
  assert.equal(first.accepted, true);
  runtime = first.runtime;
  const duplicate = queueSemanticBattlePresentation(runtime, event);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "duplicate");
  assert.equal(duplicate.runtime.effects.length, 1);
  assert.equal("audio" in first.effect, false);
  assert.equal("damage" in first.effect, false);
  assert.equal("save" in first.effect, false);
});

test("presentation generation and capacity fail closed without eviction", () => {
  let runtime = createBattlePresentationRuntime(3);
  assert.equal(queueSemanticBattlePresentation(runtime, {
    generation: 2, semantic: "boss-entrance", receiptId: "old", kind: "boss-entrance", x: 1, y: 1,
  }).reason, "generation");
  for (let index = 0; index < V099_PRESENTATION_LIMITS.activeEffects; index += 1) {
    const next = queueSemanticBattlePresentation(runtime, {
      generation: 3,
      semantic: "explosion-result",
      receiptId: `effect:${index}`,
      kind: "explosion",
      scale: "small",
      x: index,
      y: 200,
    });
    assert.equal(next.accepted, true);
    runtime = next.runtime;
  }
  const overflow = queueSemanticBattlePresentation(runtime, {
    generation: 3, semantic: "explosion-result", receiptId: "overflow", kind: "explosion", scale: "small", x: 1, y: 1,
  });
  assert.equal(overflow.reason, "capacity");
  assert.equal(overflow.runtime.effects.length, V099_PRESENTATION_LIMITS.activeEffects);
  const reset = resetBattlePresentationRuntime(overflow.runtime, 4);
  assert.equal(reset.generation, 4);
  assert.equal(reset.effects.length, 0);
  assert.equal(reset.semanticReceipts.length, 0);
});

test("small, medium, large, and boss explosions remain distinct within one render cap", () => {
  assert.deepEqual(Object.keys(V099_EXPLOSION_PROFILES), ["small", "medium", "large", "boss"]);
  assert.ok(V099_EXPLOSION_PROFILES.small.fireballRadius < V099_EXPLOSION_PROFILES.medium.fireballRadius);
  assert.ok(V099_EXPLOSION_PROFILES.medium.fireballRadius < V099_EXPLOSION_PROFILES.large.fireballRadius);
  assert.ok(V099_EXPLOSION_PROFILES.large.fireballRadius < V099_EXPLOSION_PROFILES.boss.fireballRadius);
  for (const density of [1, .72, .48]) {
    for (const scale of Object.keys(V099_EXPLOSION_PROFILES)) {
      const snapshot = battlePresentationSnapshot({
        kind: scale === "boss" ? "boss-defeat" : "explosion",
        scale,
        elapsed: V099_EXPLOSION_PROFILES[scale].durationSeconds * .34,
        duration: V099_EXPLOSION_PROFILES[scale].durationSeconds,
      }, density);
      assert.ok(snapshot.sparkCount <= V099_EXPLOSION_PROFILES[scale].sparks);
      assert.ok(snapshot.debrisCount <= V099_EXPLOSION_PROFILES[scale].debris);
      assert.ok(snapshot.fireballRadius > 0);
      assert.ok(snapshot.shockwaveRadius > 0);
    }
  }
});

test("boss defeat stages stop, chain, major burst, and residue without damage output", () => {
  const effect = {
    kind: "boss-defeat",
    scale: "boss",
    duration: V099_BOSS_DEFEAT_TIMELINE.durationSeconds,
  };
  const stages = [
    [.05, "stagger"],
    [.3, "small-chain"],
    [.9, "medium"],
    [1.08, "major"],
    [1.7, "residue"],
  ];
  for (const [elapsed, stage] of stages) {
    const snapshot = battlePresentationSnapshot({ ...effect, elapsed });
    assert.equal(snapshot.bossStage, stage);
    assert.equal(snapshot.majorBurstActive, elapsed >= V099_BOSS_DEFEAT_TIMELINE.majorBurst.at);
    assert.equal(snapshot.majorBurstElapsed, Math.max(0, elapsed - V099_BOSS_DEFEAT_TIMELINE.majorBurst.at));
  }
});

test("pause freezes simulation presentation while resume expires it", () => {
  const queued = queueSemanticBattlePresentation(createBattlePresentationRuntime(1), {
    generation: 1, semantic: "boss-entrance", receiptId: "boss:1", kind: "boss-entrance", x: 820, y: 250,
  }).runtime;
  assert.equal(advanceBattlePresentationRuntime(queued, 0), queued);
  const advanced = advanceBattlePresentationRuntime(queued, .8);
  assert.equal(advanced.effects.length, 1);
  assert.equal(advanced.effects[0].elapsed, .8);
  assert.equal(advanceBattlePresentationRuntime(advanced, 1).effects.length, 0);
});

test("terminal result waits for both boss defeat and enemy base presentation", () => {
  const queued = queueSemanticBattlePresentation(createBattlePresentationRuntime(9), {
    generation: 9,
    semantic: "boss-defeat",
    receiptId: "fighter:91",
    kind: "boss-defeat",
    x: 740,
    y: 260,
  }).runtime;
  assert.equal(battleResultPresentationPending(queued), true);
  assert.equal(battleResultPresentationPending(createBattlePresentationRuntime(9), {
    enemyBaseCollapsePending: true,
  }), true);
  assert.equal(battleResultPresentationPending(advanceBattlePresentationRuntime(queued, 2.59)), true);
  assert.equal(battleResultPresentationPending(advanceBattlePresentationRuntime(queued, 2.6)), false);
  assert.equal(battleResultPresentationPending(createBattlePresentationRuntime(9)), false);
});

test("drum arrival is airborne, bounces, then becomes visually settled", () => {
  const airborne = drumArrivalPose({ phase: "dropping", phaseTime: .62, dropSeconds: .62 });
  const nearGround = drumArrivalPose({ phase: "dropping", phaseTime: .05, dropSeconds: .62 });
  const impact = drumArrivalPose({ phase: "impact", phaseTime: .12, impactSeconds: .24 });
  const active = drumArrivalPose({ phase: "active" });
  assert.equal(airborne.airborne, true);
  assert.ok(airborne.height > nearGround.height);
  assert.ok(impact.bounce > 0);
  assert.ok(impact.dustAlpha > 0);
  assert.deepEqual(active, { airborne: false, height: 0, rotation: 0, shadowScale: 1, dustAlpha: 0, sparkAlpha: 0, bounce: 0 });
});

test("drum cannot detonate before the presentation arrival and keeps accepted gameplay values", () => {
  const placement = resolveBattlefieldSupplyPlacement({
    running: true,
    paused: false,
    over: false,
    scrap: 100,
    supplyKind: "drum",
    lane: 1,
    x: 440,
    supplies: [],
    areaEffects: [],
    nextId: 1,
    nextAreaEffectId: 1,
  });
  const dropping = placement.supplies[0];
  assert.equal(requestDrumDetonation(dropping).ok, false);
  const impact = advanceBattlefieldSupply(dropping, BATTLEFIELD_SUPPLY_DEFS.drum.dropSeconds);
  assert.equal(impact.phase, "impact");
  assert.equal(requestDrumDetonation(impact).ok, false);
  const active = advanceBattlefieldSupply(impact, BATTLEFIELD_SUPPLY_DEFS.drum.impactSeconds);
  assert.equal(requestDrumDetonation(active).ok, true);
  assert.deepEqual({
    cost: BATTLEFIELD_SUPPLY_DEFS.drum.cost,
    hp: active.hp,
    blastRadius: BATTLEFIELD_SUPPLY_DEFS.drum.blastRadius,
    blastDamage: BATTLEFIELD_SUPPLY_DEFS.drum.blastDamage,
    burnRadius: BATTLEFIELD_SUPPLY_DEFS.drum.burnRadius,
    burnDamagePerSecond: BATTLEFIELD_SUPPLY_DEFS.drum.burnDamagePerSecond,
    burnSeconds: BATTLEFIELD_SUPPLY_DEFS.drum.burnSeconds,
    cooldown: BATTLEFIELD_SUPPLY_COOLDOWN_SECONDS.drum,
  }, { cost: 40, hp: 90, blastRadius: 112, blastDamage: 118, burnRadius: 88, burnDamagePerSecond: 15, burnSeconds: 4.5, cooldown: 12 });
});

test("CRAWLER grounding keeps wheels, dust, suspension, hatch, and antenna in one vehicle pose", () => {
  for (const density of [1, .72, .48]) {
    const stored = crawlerGroundingSnapshot({ time: 1.2, phase: "cooldown", effectDensity: density });
    const firing = crawlerGroundingSnapshot({ time: 1.2, phase: "firing", effectDensity: density });
    assert.equal(stored.wheelCompression.length, 4);
    assert.equal(stored.roofHatchOpen, false);
    assert.equal(firing.roofHatchOpen, true);
    assert.ok(firing.dustPuffs >= stored.dustPuffs);
    assert.notEqual(firing.antennaSwing, stored.antennaSwing);
    assert.ok(Math.abs(firing.antennaSwing) <= .08);
  }
});

test("presentation module owns no audio, save, service worker, or gameplay damage channel", async () => {
  const source = await readFile(new URL("../app/battlePresentationV099.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /AudioMixer|play(?:Cue|ProductionCue)|persistCampaignSave|serviceWorker|navigator\.serviceWorker/);
  assert.doesNotMatch(source, /\bdamage\s*:/);
});
