import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as rules from "../app/gameRules.js";
import * as recovery from "../app/commandRecovery.js";
import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { v105FistWaveSnapshot } from "../app/v105PaisenFistWave.js";

// Execute the actual frame adapter, rather than a second copy of its logic.
const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = tree.statements.filter(node => ts.isFunctionDeclaration(node)
  && ["commandRegenForGame", "advanceCommandForGame"].includes(node.name?.text));
assert.equal(functions.length, 2);
const invoke = runInNewContext(ts.transpileModule(functions.map(node => node.getText(tree)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText + "\nadvanceCommandForGame", {
  ...rules, ...recovery, CAMPAIGN_STAGE_IDS, v105FistWaveSnapshot, cards: rules.UNIT_CARDS,
});

const scene = patch => ({
  definition: { operationCategory: "campaign", stageId: "normal-v100-campaign", missionConfig: { v100StageNumber: 1 } },
  energy: 0, commandRecovery: recovery.armCommandRecovery(recovery.createCommandRecoveryRuntime()),
  selectedSupply: "drum", v100SupportId: null, supportGauge: 0, scrap: 0, supportItemCooldowns: {},
  airstrike: rules.createEmergencySupportRuntime(true), crawlerAbility: rules.createCrawlerAbilityRuntime(0, true),
  fighters: [{ id: 1, side: "zombie", kind: "walker", hp: 100 }], deployQueue: [],
  pendingWeaponHits: [], areaEffects: [], battlefieldObjects: [], formationKinds: ["kumaverson"], deployCooldowns: {},
  ...patch,
});

test("actual frame adapter handles dead-shooter human, enemy and crawler hits without undefined bindings", () => {
  for (const [weapon, defers] of [["babayaga", true], ["spitter", false], ["crawler", true]]) {
    const g = scene({ pendingWeaponHits: [{ weapon, sourceId: 999999, remainingSeconds: .5 }] });
    assert.doesNotThrow(() => invoke(g, 1, "campaign"));
    assert.equal(g.energy, defers ? 3 : 7.75);
    assert.equal(g.commandRecovery.used, !defers);
    if (defers) {
      g.pendingWeaponHits = []; invoke(g, 1, "campaign");
      assert.equal(g.commandRecovery.used, true);
    }
  }
});

test("actual adapter defers on a free incendiary input, but ignores an inert drum", () => {
  for (const [v100SupportId, defers] of [["support-incendiary-drum", true], ["support-explosive-drum", false]]) {
    const g = scene({ battlefieldObjects: [{ id: 2, kind: "drum", phase: "active", v100SupportId }] });
    invoke(g, 1, "campaign"); assert.equal(g.energy, defers ? 3 : 7.75); assert.equal(g.commandRecovery.used, !defers);
  }
});

test("actual adapter excludes other modes, paid entrants and spare vehicle support", () => {
  for (const mode of ["outbreak", "survival", "legacy", null]) {
    const g = scene(); invoke(g, 1, mode); assert.equal(g.energy, 3); assert.equal(g.commandRecovery.used, false);
  }
  for (const patch of [{ deployQueue: ["kumaverson"] }, { fighters: [{ side: "human", hp: 1, combatReady: false }, { side: "zombie", hp: 100 }] },
    { supportGauge: 85, crawlerAbility: rules.createCrawlerAbilityRuntime(1, true) }]) {
    const g = scene(patch); invoke(g, 1, "campaign"); assert.equal(g.energy, 3); assert.equal(g.commandRecovery.used, false);
  }
});
