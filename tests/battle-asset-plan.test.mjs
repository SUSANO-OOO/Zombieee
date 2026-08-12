import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_CRAWLER_ASSET_PATHS,
  BATTLE_SUPPORT_ASSET_PATHS,
  requiredBattleAssetPlan,
} from "../app/battleAssetPlan.js";
import { CAMPAIGN_STAGES, CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { STAGE_OBJECT_MANIFEST } from "../app/stageObjectManifest.js";

test("all 20 campaign stages have a closed required visual plan", () => {
  assert.equal(CAMPAIGN_STAGES.length, 20);
  for (const stage of CAMPAIGN_STAGES) {
    const plan = requiredBattleAssetPlan({
      stageId: stage.id,
      formationKinds: ["brawler", "engineer"],
      enemyKinds: stage.enemyKinds,
    });
    assert.equal(plan.stageId, stage.id);
    assert.ok(plan.background.path.startsWith("/"), `${stage.id}/background`);
    assert.ok(plan.sprites.some(({ kind }) => kind === "brawler"), `${stage.id}/formation`);
    assert.ok(plan.sprites.some(({ kind }) => kind === "turned"), `${stage.id}/turned`);
    for (const enemyKind of stage.enemyKinds) {
      assert.ok(plan.sprites.some(({ kind }) => kind === enemyKind), `${stage.id}/${enemyKind}`);
    }
    assert.deepEqual(
      new Set(plan.persistent.map(({ key }) => key)),
      new Set([...Object.keys(BATTLE_CRAWLER_ASSET_PATHS), ...Object.keys(BATTLE_SUPPORT_ASSET_PATHS)]),
    );
    assert.equal(plan.paths.length, new Set(plan.paths).size, `${stage.id}/dedupe`);
    assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.paths));
  }
});

test("every authored stage object state and mission-render source is required", () => {
  for (const [stageId, manifest] of Object.entries(STAGE_OBJECT_MANIFEST)) {
    const plan = requiredBattleAssetPlan({ stageId });
    const plannedIds = new Set(plan.stageObjects.map(({ id }) => id));
    for (const object of manifest.objects) assert.ok(plannedIds.has(object.id), `${stageId}/${object.id}`);
    for (const object of manifest.objects.filter(({ runtimeUsage }) => runtimeUsage === "mission-render-source")) {
      const planned = plan.stageObjects.find(({ id }) => id === object.id);
      assert.equal(planned?.category, "mission", `${stageId}/${object.id}`);
    }
  }
  for (const stageId of [CAMPAIGN_STAGE_IDS.HOSPITAL_EVACUATION_ROUTE, CAMPAIGN_STAGE_IDS.RESEARCH_FREIGHT_PASSAGE]) {
    const escort = requiredBattleAssetPlan({ stageId });
    assert.ok(escort.stageObjects.some(({ id }) => id === "maintenance-cart"), stageId);
  }
  const tunnel = requiredBattleAssetPlan({ stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL });
  assert.ok(tunnel.stageObjects.some(({ id }) => id === "station-tunnel-mission-art-source"));
});

test("later-wave enemies are not demoted behind a first-wave boundary", () => {
  const plan = requiredBattleAssetPlan({
    stageId: CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE,
    formationKinds: ["scout"],
    enemyKinds: ["walker", "cagewalker", "spindle", "gairen"],
  });
  assert.deepEqual(
    plan.sprites.map(({ kind }) => kind),
    ["scout", "walker", "cagewalker", "spindle", "gairen", "turned"],
  );
  assert.ok(plan.stageObjects.some(({ id }) => id === "coastal-power-rig"));
});
