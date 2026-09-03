import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  advancePendingWeaponHits,
  cancelPendingWeaponTransaction,
  createCompletedAttackImpactReceipt,
} from "../app/combatPresentation.js";

const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const found = [];
function walk(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "appendCompletedAttackImpact") found.push(["helper", node]);
  if (ts.isForOfStatement(node)) {
    const expression = ts.isAsExpression(node.expression) ? node.expression.expression : node.expression;
    if (ts.isPropertyAccessExpression(expression)
      && ts.isIdentifier(expression.expression) && expression.expression.text === "pendingWeaponStep"
      && expression.name.text === "due") found.push(["dispatch", node]);
  }
  if (ts.isIfStatement(node) && ts.isBinaryExpression(node.expression)) {
    const left = node.expression.left;
    if (ts.isPropertyAccessExpression(left)
      && ts.isIdentifier(left.expression) && left.expression.text === "attackObservationBase"
      && left.name.text === "mode" && ts.isStringLiteral(node.expression.right)
      && node.expression.right.text === "direct") found.push(["direct", node]);
  }
  ts.forEachChild(node, walk);
}
walk(tree);
const textFor = (key) => {
  const nodes = found.filter(([name]) => name === key);
  assert.equal(nodes.length, 1, `one actual ${key} owner must exist`);
  return nodes[0][1].getText(tree);
};
const helper = textFor("helper");
const dispatch = textFor("dispatch");
const direct = textFor("direct");
const compile = (body) => ts.transpileModule(`${helper}\n${body}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const dispatchCode = compile(dispatch);
const directCode = compile(direct);

const observation = (mode) => ({
  battleGeneration: 2,
  sourceId: 3,
  sourceSide: mode === "enemy-projectile" ? "zombie" : "human",
  sourceKind: mode === "enemy-projectile" ? "spitter" : mode === "grenade" ? "mrs-chiha" : "gunner",
  attackSequence: 7,
  targetId: 1,
  targetSide: mode === "enemy-projectile" ? "human" : "zombie",
  targetKind: mode === "enemy-projectile" ? "ranger" : "walker",
  impactOrdinal: 0,
  mode: mode === "grenade" ? "delayed" : "projectile",
  committedAtBattleTime: 1,
  audioCueId: "exact-production-cue",
  audioReceiptId: "combat-attack:2:3:7",
});

function runContact(mode, options = {}) {
  const original = observation(mode);
  const observed = options.observed === false ? undefined : { ...original, ...options.observation };
  const primary = {
    id: 1, side: original.targetSide, kind: original.targetKind,
    x: options.outsideRadius ? 100 : 0, y: 0,
    hp: options.hp ?? 70, combatReady: true,
    contained: options.contained === true, flash: 0, knock: 0,
  };
  const secondary = { ...primary, id: 2, x: 0, hp: 70, contained: false };
  const requests = options.requests ?? [{
    cueId: original.audioCueId, receiptId: original.audioReceiptId,
    ownerId: original.sourceId, activationId: original.attackSequence,
  }];
  const g = {
    time: 2, battleAudioGeneration: options.generation ?? 2,
    completedAttackImpacts: [], pendingWeaponHits: [],
    fighters: options.missingTarget ? [secondary] : [primary, secondary],
    roleMetrics: { raiderSuppressionApplications: 0, raiderPierceHits: 0 },
  };
  const hits = Array.from({ length: options.hits ?? 1 }, (_, shotIndex) => ({
    eventKind: options.eventKind ?? "impact", applyDamage: options.applyDamage !== false,
    remainingSeconds: 0, transactionId: `3:7:fighter:1:${shotIndex}`,
    targetKind: "fighter", targetSide: original.targetSide, targetId: 1,
    sourceId: 3, weapon: original.sourceKind,
    targetX: 0, targetY: -28, originX: 0,
    damageMode: mode, damage: 13, shotIndex, recoil: 0,
    raiderLineHit: mode === "direct",
    attackObservation: observed ? { ...observed, impactOrdinal: shotIndex } : undefined,
  }));
  const effects = [];
  const record = (kind) => (...args) => { effects.push([kind, ...args]); };
  const context = {
    g, pendingWeaponStep: { due: hits }, canceledWeaponTransactions: new Set(),
    createCompletedAttackImpactReceipt, cancelPendingWeaponTransaction,
    productionCueQaLogRef: { current: requests },
    productionMixerRef: { current: true },
    Math: Object.assign(Object.create(Math), { random: () => { effects.push(["rng"]); return .9; } }),
    applyIncomingHumanDamage: (_game, target, damage) => {
      target.hp = Math.max(0, target.hp - damage);
      return { targetDamage: damage };
    },
    enemyProjectilePresentationFor: () => ({ color: "acid" }),
    MANUAL_ABILITY_REGISTRY: { "mrs-chiha": { grenadeRadius: 50, grenadeSplashMultiplier: .5 } },
    effectDistance: (target, point) => Math.hypot(target.x - point.x, target.y - point.y),
    applyRaiderSuppression: () => ({ stacks: 1, remainingSeconds: 1, speedMultiplier: .8 }),
    recordUnitDamage: (_game, ...args) => record("unit-damage")(...args),
    addDamageText: (_game, ...args) => record("damage-text")(...args),
    addParticles: (_game, ...args) => record("particles")(...args),
    addSemanticBattlePresentation: (_game, ...args) => record("semantic-vfx")(...args),
    addWeaponShot: (_game, ...args) => record("weapon-vfx")(...args),
    playProductionCue: record("production-audio"),
    playCue: record("fallback-audio"),
    humanVoiceCueForUnit: () => "human-hurt",
    enemyVoiceCue: () => "enemy-hurt",
    unitAudioCueFor: (_kind, _category, event) => event,
  };
  vm.runInNewContext(dispatchCode, context);
  return JSON.parse(JSON.stringify({
    receipts: g.completedAttackImpacts,
    gameplay: { fighters: g.fighters, roleMetrics: g.roleMetrics, effects, pendingCount: g.pendingWeaponHits.length },
  }));
}

for (const mode of ["enemy-projectile", "grenade", "direct"]) {
  test(`${mode}: actual contact emits one exact receipt for normal and lethal impact without gameplay changes`, () => {
    for (const hp of [70, 5]) {
      const active = runContact(mode, { hp });
      const inactive = runContact(mode, { hp, observed: false });
      assert.deepEqual(active.gameplay, inactive.gameplay);
      assert.equal(inactive.receipts.length, 0);
      assert.equal(active.receipts.length, 1);
      assert.deepEqual(active.receipts[0], createCompletedAttackImpactReceipt({
        ...observation(mode), contactAtBattleTime: 2,
        reactionOutcome: hp === 5 ? "defeated" : "hit", audioRequestObserved: true,
      }));
    }
  });

  test(`${mode}: missing/dead/contained exact targets and non-damage events emit no borrowed receipt`, () => {
    for (const options of [{ missingTarget: true }, { hp: 0 }, { contained: true }, { applyDamage: false }]) {
      const active = runContact(mode, options);
      assert.equal(active.receipts.length, 0);
      assert.deepEqual(active.gameplay, runContact(mode, { ...options, observed: false }).gameplay);
    }
  });

  test(`${mode}: missing or mixed audio identity and stale generation fail closed`, () => {
    const original = observation(mode);
    const good = { cueId: original.audioCueId, receiptId: original.audioReceiptId, ownerId: 3, activationId: 7 };
    for (const requests of [[], [{ ...good, cueId: "other" }], [{ ...good, receiptId: "combat-attack:2:3:8" }],
      [{ ...good, ownerId: 9 }], [{ ...good, activationId: 8 }]]) {
      const active = runContact(mode, { requests });
      assert.equal(active.receipts.length, 0);
      assert.deepEqual(active.gameplay, runContact(mode, { requests, observed: false }).gameplay);
    }
    assert.equal(runContact(mode, { generation: 3 }).receipts.length, 0);
  });
}

test("grenade secondary-only contact cannot become evidence for the original primary target", () => {
  for (const options of [{ outsideRadius: true }, { missingTarget: true }, { hp: 0 }, { contained: true }]) {
    const result = runContact("grenade", options);
    assert.equal(result.receipts.length, 0);
    assert.equal(result.gameplay.fighters.find((fighter) => fighter.id === 2).hp, 63.5);
    assert.deepEqual(result.gameplay, runContact("grenade", { ...options, observed: false }).gameplay);
  }
});

test("primary burst multi-hit preserves one attack identity and distinct exact impact ordinals", () => {
  const result = runContact("direct", { hits: 3 });
  assert.equal(result.receipts.length, 3);
  assert.deepEqual(result.receipts.map(({ sourceId, attackSequence, targetId, impactOrdinal }) =>
    [sourceId, attackSequence, targetId, impactOrdinal]), [[3, 7, 1, 0], [3, 7, 1, 1], [3, 7, 1, 2]]);
  assert.deepEqual(result.gameplay, runContact("direct", { hits: 3, observed: false }).gameplay);
});

test("canceled muzzle still produces neither damage nor a completed contact", () => {
  const result = runContact("direct", { eventKind: "muzzle", applyDamage: false });
  assert.equal(result.receipts.length, 0);
  assert.equal(result.gameplay.fighters[0].hp, 70);
  assert.deepEqual(result.gameplay.effects, []);
  const delayed = [{ eventKind: "impact", remainingSeconds: .22, damage: 13 }];
  assert.equal(advancePendingWeaponHits(delayed, .1).due.length, 0);
  assert.equal(advancePendingWeaponHits(delayed, .22).due.length, 1);
});

test("the unchanged normal direct contact owner emits only its exact post-reaction target", () => {
  for (const hp of [57, 0]) {
    const observed = { ...observation("direct"), mode: "direct" };
    const g = { time: 2, battleAudioGeneration: 2, completedAttackImpacts: [] };
    vm.runInNewContext(directCode, {
      g, target: { hp }, attackObservationBase: observed,
      createCompletedAttackImpactReceipt,
      productionCueQaLogRef: { current: [{ cueId: observed.audioCueId,
        receiptId: observed.audioReceiptId, ownerId: 3, activationId: 7 }] },
    });
    assert.equal(g.completedAttackImpacts.length, 1);
    assert.equal(g.completedAttackImpacts[0].reactionOutcome, hp === 0 ? "defeated" : "hit");
    assert.equal(g.completedAttackImpacts[0].targetId, 1);
  }
});
