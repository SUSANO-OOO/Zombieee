import { CAMPAIGN_UNITS } from "../app/campaign.js";
import {
  V090_STARTER_EQUIPMENT_BUDGET,
  economyAffordabilitySnapshot,
  reorganizeLegacyCaps,
} from "../app/campaignEconomy.js";
import { unitLevelCost } from "../app/unitProgression.js";

const legacyBalances = [0, 100, 1_000, 10_000, Number.MAX_SAFE_INTEGER];
const earlyLevelCosts = [2, 3, 4, 5].map(unitLevelCost);
const allUnitsToLevel25 = CAMPAIGN_UNITS.length
  * Array.from({ length: 24 }, (_, index) => unitLevelCost(index + 2))
    .reduce((total, cost) => total + cost, 0);

const cases = legacyBalances.map((legacyCaps) => {
  const migration = reorganizeLegacyCaps(legacyCaps);
  const affordability = economyAffordabilitySnapshot({
    startingCaps: migration.nextCaps,
    levelCosts: earlyLevelCosts,
    starterEquipmentCost: V090_STARTER_EQUIPMENT_BUDGET,
  });
  return { legacyCaps, migration, affordability };
});

if (cases[0].affordability.affordableLevelUps < 3) {
  throw new Error("The minimum migration grant cannot fund starter equipment plus multiple Level ups");
}
if (cases.some(({ migration }) => migration.nextCaps >= allUnitsToLevel25)) {
  throw new Error("A migrated balance can instantly max the complete current roster");
}
if (cases.some(({ migration }, index) => index > 0 && migration.nextCaps < cases[index - 1].migration.nextCaps)) {
  throw new Error("Legacy balance migration is not monotonic");
}

console.log(JSON.stringify({
  rosterSize: CAMPAIGN_UNITS.length,
  earlyLevelCosts,
  starterEquipmentBudget: V090_STARTER_EQUIPMENT_BUDGET,
  allUnitsToLevel25,
  cases,
}, null, 2));
