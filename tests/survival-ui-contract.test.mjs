import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ashfallSource = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
const campaignScreensSource = await readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("campaign navigation exposes Survival lobby and result screens", () => {
  assert.match(campaignScreensSource, /"survival" \| "survival-result"/);
  assert.match(campaignScreensSource, /onOpenSurvival/);
  assert.match(campaignScreensSource, />サバイバル</);
  assert.match(ashfallSource, /screen === "survival"/);
  assert.match(ashfallSource, /screen === "survival-result"/);
  assert.match(ashfallSource, /checkpointから再開/);
});

test("Survival battle HUD exposes required wave, boss, speed, and CRAWLER controls", () => {
  assert.match(ashfallSource, /className="survival-hud"/);
  assert.match(ashfallSource, />WAVE</);
  assert.match(ashfallSource, />NEXT BOSS</);
  assert.match(ashfallSource, />CRAWLER HP</);
  assert.match(ashfallSource, /changeSurvivalSpeed\(1\).*?>1倍</s);
  assert.match(ashfallSource, /changeSurvivalSpeed\(2\).*?>2倍</s);
  assert.match(ashfallSource, /survivalHud\.speedLocked/);
});

test("boss checkpoint blocks upgrade selection until its durable save completes", () => {
  assert.match(ashfallSource, /setPendingSurvivalCheckpoint\(\{ run: g\.survivalRun, checkpointId \}\)/);
  assert.match(ashfallSource, /pendingSurvivalCheckpoint \|\| survivalSavePending/);
  assert.match(ashfallSource, /retrySurvivalCheckpointSave/);
  assert.match(ashfallSource, /selectSurvivalUpgrade\(upgradeId\)/);
});

test("Survival settlement is connected as one atomic persistence boundary", () => {
  assert.match(ashfallSource, /persistSurvivalCampaignSettlement\(/);
  assert.match(ashfallSource, /setCampaignSave\(nextSave\)/);
  assert.match(ashfallSource, /setScreen\("survival-result"\)/);
  assert.match(ashfallSource, /CAPS、装備数量、last result、checkpoint削除、revision、integrity/);
  assert.match(ashfallSource, /survivalStep\.terminalReason[\s\S]*setPendingSurvivalCheckpoint\(null\)[\s\S]*setPendingSurvivalSettlement/);
  assert.match(ashfallSource, /survivalSettlementAwaitingRetry[\s\S]*setSurvivalSettlementAwaitingRetry\(true\)[\s\S]*if \(!pendingSurvivalSettlement \|\| survivalSavePending \|\| survivalSettlementAwaitingRetry\) return/);
  assert.match(ashfallSource, /failNextSurvivalSettlementSave[\s\S]*failuresRemaining \+= 1/);
  assert.match(ashfallSource, /failuresRemaining > 0[\s\S]*return \{ durable: false \}/);
});

test("Survival overlays retain 44px controls and compact landscape rules", () => {
  assert.match(styles, /\.survival-speed button,\.survival-pause \{[^}]*min-height:44px/);
  assert.match(styles, /\.campaign-overlay button \{[^}]*min-height:44px/);
  assert.match(styles, /@media \(orientation:landscape\) and \(max-height:390px\)/);
  assert.match(styles, /@media \(orientation:landscape\) and \(max-height:350px\)/);
  assert.match(styles, /@media \(max-height:430px\)[\s\S]*\.survival-hud/);
});
