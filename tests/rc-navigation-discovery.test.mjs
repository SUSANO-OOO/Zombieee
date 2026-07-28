import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [screens, campaignCss, abilities] = await Promise.all([
  readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/campaign.css", import.meta.url), "utf8"),
  import("../app/manualAbilities.js"),
]);

test("keeps all regions in one deterministic horizontal strip", () => {
  assert.match(campaignCss, /\.map-region-tabs\s*\{[^}]*display:flex[^}]*overflow-x:auto/s);
  assert.doesNotMatch(campaignCss, /\.map-region-tabs\s*\{[^}]*grid-template-columns:repeat\(5/s);
  assert.match(campaignCss, /\.map-region-tabs button\s*\{[^}]*flex:0 0/s);
});

test("separates Survival and outbreak from the selected stage action", () => {
  const mapBlock = screens.slice(screens.indexOf("function AreaMapScreen"), screens.indexOf("function LoadoutScreen"));
  assert.match(mapBlock, /className="map-operation-tabs"/);
  assert.match(mapBlock, /className="special-operation survival-entry"/);
  assert.match(mapBlock, /className="special-operation outbreak-entry"/);
  const stageActions = mapBlock.slice(mapBlock.indexOf('className="stage-actions"'));
  assert.match(stageActions, /この作戦を編成/);
  assert.doesNotMatch(stageActions, /サバイバル|異常発生任務/);
});

test("exposes all canonical manual abilities in formation, personnel, and unit records", () => {
  assert.match(screens, /能力：\{ability\?\.displayName/);
  assert.match(screens, /section === "unit"/);
  assert.match(screens, /ability\?\.summary/);
  assert.equal(Object.keys(abilities.MANUAL_ABILITY_REGISTRY).length, 16);
  for (const definition of Object.values(abilities.MANUAL_ABILITY_REGISTRY)) {
    assert.equal(typeof definition.summary, "string");
    assert.ok(definition.summary.length >= 20, `${definition.displayName} needs a readable summary`);
  }
  assert.equal(abilities.MANUAL_ABILITY_REGISTRY.tky.displayName, "光刃解放");
});

test("makes formation membership visually explicit", () => {
  assert.match(screens, /data-selected=\{selected\}/);
  assert.match(screens, /aria-pressed=\{selected\}/);
  assert.doesNotMatch(screens, /formation-selection-mark/);
  assert.match(campaignCss, /\.formation-unit-card\[data-selected="false"\]/);
  assert.match(campaignCss, /\.formation-unit-card\[data-selected="true"\]/);
  assert.match(campaignCss, /\.formation-unit-select\[data-selected="true"\][^}]*background:/);
});
