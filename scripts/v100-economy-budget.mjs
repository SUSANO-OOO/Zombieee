import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  V100_LEVEL_COSTS, V100_STAGE_REWARD_TOTAL, V100_UNITS, V100_VEHICLE,
  v100StageReward,
} from "../app/v100Registry.js";

const stage = (number, stars = 3) => v100StageReward(number, "first-clear")
  + (stars >= 2 ? v100StageReward(number, "star:2") : 0)
  + (stars >= 3 ? v100StageReward(number, "star:3") : 0);
const first = (count, stars = 3) => Array.from({ length: count }, (_, index) => stage(index + 1, stars)).reduce((sum, value) => sum + value, 0);
const registration = Object.fromEntries(V100_UNITS.map((unit) => [unit.id, unit.registrationCostCaps]));
const secondLevel = V100_LEVEL_COSTS[0];
const registrationTotal = Object.values(registration).reduce((sum, cost) => sum + cost, 0);
const vehicleTotal = V100_VEHICLE.upgradeCosts.reduce((sum, cost) => sum + cost, 0);
const fullLevelOneUnit = V100_LEVEL_COSTS.reduce((sum, cost) => sum + cost, 0);

const choices = {
  afterStage1: { earned: first(1), nao: registration["unit-nao"], naoAndOneLevel: registration["unit-nao"] + secondLevel },
  afterStage2: { earned: first(2), naoAndMizuchi: registration["unit-nao"] + registration["unit-mizuchi"], naoAndFourLevels: registration["unit-nao"] + secondLevel * 4 },
  afterStage4: { earned: first(4), battleReady: registration["unit-nao"] + registration["unit-mizuchi"] + secondLevel * 4 + 50, battleReadyAndVehicle: registration["unit-nao"] + registration["unit-mizuchi"] + secondLevel * 4 + 50 + V100_VEHICLE.upgradeCosts[0] },
  fullCampaign: { earnedAtOneStar: first(30, 1), earnedAtThreeStars: first(30, 3), registrationTotal, vehicleTotal, fullLevelOneUnit, allRegistrationVehicleOneMaxUnit: registrationTotal + vehicleTotal + fullLevelOneUnit },
};
assert.equal(choices.afterStage1.earned >= choices.afterStage1.nao, true);
assert.equal(choices.afterStage1.earned < choices.afterStage1.naoAndOneLevel, true);
assert.equal(choices.afterStage2.earned < choices.afterStage2.naoAndMizuchi, true);
assert.equal(choices.afterStage2.earned >= choices.afterStage2.naoAndFourLevels, true);
assert.equal(choices.afterStage4.earned >= choices.afterStage4.battleReady, true);
assert.equal(choices.afterStage4.earned < choices.afterStage4.battleReadyAndVehicle, true);
assert.equal(choices.fullCampaign.earnedAtThreeStars, V100_STAGE_REWARD_TOTAL);
assert.equal(choices.fullCampaign.earnedAtThreeStars < choices.fullCampaign.allRegistrationVehicleOneMaxUnit, true);
assert.equal(v100StageReward(1, "replay") > 0, true, "replay reward prevents a permanent spending dead end");

const report = { status: "passed", scope: "static CAPS purchasing power; no inferred player enjoyment or battle outcome", choices };
const output = resolve(process.env.V100_ECONOMY_BUDGET_OUT ?? "outputs/completion/v100-economy-budget/report.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: report.status, choices, output })}\n`);
