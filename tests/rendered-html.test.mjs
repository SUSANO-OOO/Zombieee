import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  AIRSTRIKE_DEF,
  airstrikePlacementCheck,
  BARRICADE_MAX_HP,
  BATTLEFIELD_SUPPLY_DEFS,
  CAMERA_SHAKE_EVENTS,
  COMMAND_MAX,
  COMMAND_REGEN,
  CONTAINER_DEF,
  CRAWLER_BARRAGE_DEF,
  ENEMY_GATE_SPAWN,
  ENEMY_BASE_COLLAPSE_SECONDS,
  FIELD_OBJECT_CLEARANCE,
  LANE_NAMES,
  LANE_Y,
  MOBILE_LANDSCAPE_LANE_Y,
  MISSION_EVENTS,
  PREP_SECONDS,
  RAGE_MAX,
  RENDER_ARRAY_LIMITS,
  SUPPORT_GAUGE_MAX,
  SUPPORT_DEFS,
  TACTIC_MODES,
  UNIT_CARDS,
  WORLD_GEOMETRY,
  advanceAreaEffects,
  advanceBattlefieldSupply,
  advanceCameraShakeRuntime,
  advanceCrawlerAbilityRuntime,
  advanceEmergencySupportRuntime,
  advanceEnemyBaseCollapse,
  advanceEnemySpawnRuntime,
  advanceZombieX,
  advanceCommand,
  advanceLimitFor,
  applyBattlefieldSupplyDamage,
  applyContainerDamage,
  airstrikeObserverPose,
  autonomousTargetScore,
  barricadeState,
  battlefieldPlacementForbiddenZones,
  battleOutcome,
  battlefieldSupplyPlacementCheck,
  bossPhaseForHp,
  cameraShakeAmplitude,
  canvasPointerToWorld,
  canDeploy,
  capRenderArray,
  containerBlocksEnemy,
  containerPlacementCheck,
  createCameraShakeRuntime,
  createCrawlerAbilityRuntime,
  createEmergencySupportRuntime,
  createEnemySpawnRuntime,
  crawlerSiegeDamage,
  crawlerThreatLevel,
  damageContainer,
  enemyCanTargetBattlefieldSupply,
  enemyBaseTargetPoint,
  enemyBaseVisualState,
  enemyGateSpawnPosition,
  enemySpawnInterval,
  enqueueEnemyWave,
  humanAttackMultiplier,
  humanCombatMinX,
  isBrawlerFinisher,
  interceptorTargetScore,
  isCrawlerRouteBlocker,
  keyboardInputGate,
  laneCentersForViewport,
  laneForY,
  objectiveFor,
  phaseAt,
  rageReward,
  requestAirstrike,
  requestCrawlerBarrage,
  requestDrumDetonation,
  retainActiveAreaEffects,
  resolveAirstrikeImpact,
  resolveBattlefieldSupplyLanding,
  resolveBattlefieldSupplyPlacement,
  resolveContainerPlacement,
  resolveContainerLanding,
  resolveCrawlerBarrage,
  resolveDrumDetonation,
  resolveFieldSupportPlacement,
  roleEffectForAction,
  roleTargetBias,
  selectAreaEffectsForRender,
  selectBlockingContainer,
  structureDamageMultiplier,
  supportGaugeReward,
  tacticTargetBias,
  triggerCameraShake,
} from "../app/gameRules.js";
import {
  APPROVED_BATTLE_BARK_LINES,
  BATTLE_BARK_CONFIG,
  BATTLE_BARK_TRIGGER_IDS,
  LOCAL_QA_BATTLE_BARK_LINES,
  advanceBattleBarkRuntime,
  battleBarkPassesProbability,
  createBattleBarkRuntime,
  queueBattleBark,
} from "../app/battleBarks.js";
import { LOCAL_QA_MODES, resolveLocalQaMode } from "../app/localQa.js";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function assertClose(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not close to ${expected}`);
}

test("server-renders the 0.6.0 campaign title as the formal entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>西新世紀末物語｜アーリーアクセス版 0\.6\.0<\/title>/);
  const viewportMetas = html.match(/<meta name="viewport"[^>]*>/g) ?? [];
  assert.equal(viewportMetas.length, 1);
  assert.match(viewportMetas[0], /content="[^"]*width=device-width[^"]*viewport-fit=cover[^"]*initial-scale=1[^"]*"/);
  assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/);
  await access(new URL("../public/favicon.svg", import.meta.url));
  assert.match(html, /<main class="game-shell" data-screen="title" data-stage-id="stage-nishijin-shopping-street">/);
  assert.match(html, /aria-label="西新世紀末物語 ゲーム"/);
  assert.match(html, /<canvas[^>]*width="960"[^>]*height="540"/);
  assert.match(html, /class="battlefield  inactive" aria-label="3レーン戦場" aria-hidden="true"/);
  assert.match(html, /class="campaign-overlay title-screen-v060"[^>]*title-key-visual-v1\.webp[^>]*aria-label="西新世紀末物語 タイトル画面"/);
  assert.match(html, /<small>にしじんせいきまつものがたり<\/small>/);
  assert.match(html, /<h1><span>西新<\/span><b>世紀末物語<\/b><\/h1>/);
  assert.match(html, /<p>アーリーアクセス版<\/p>/);
  assert.match(html, /<span>物語を始める<\/span><small>序章　新たな世界の始まり<\/small>/);
  assert.doesNotMatch(html, /BOSS STAGE LOADOUT|CRAWLER SYSTEM CHECK|Three-lane wasteland battlefield/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("separates start, continue, confirmed reset, unlocks, and local-QA progression", async () => {
  const [game, screens, campaign] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/campaign.js", import.meta.url), "utf8"),
  ]);

  assert.match(screens, /hasCampaignSave \? "物語を続ける" : "物語を始める"/);
  assert.match(screens, /hasCampaignSave && <button[^>]*onClick=\{onRestartCampaign\}>最初から始める/);
  assert.match(game, /hasCampaignSave=\{campaignSave\.campaignStarted\}/);
  assert.match(game, /const beginCampaign[\s\S]*if \(campaignSave\.campaignStarted\)[\s\S]*setScreen\("map"\)[\s\S]*markCampaignStarted\(current\)/);
  const beginBlock = game.slice(game.indexOf("const beginCampaign"), game.indexOf("const openLoadout"));
  assert.doesNotMatch(beginBlock, /createDefaultCampaignSave|localStorage\.removeItem|localStorage\.clear/);
  assert.match(game, /window\.confirm\("現在のセーブデータを初期化して、物語を最初から始めますか？"\)/);
  assert.match(game, /window\.confirm\("セーブデータを初期化しますか？ 星・報酬・解放状態は元に戻せません。"\)/);

  assert.match(campaign, /INITIAL_UNIT_IDS = deepFreeze\(CAMPAIGN_UNITS\.filter\(\(unit\) => unit\.unlock\.type === "initial"\)/);
  assert.match(game, /permittedFormation = qaAllUnlocked[\s\S]*requestedFormation\.filter\(\(kind\) => isUnitUnlocked\(campaignSave, kind\)\)/);
  assert.match(screens, /unit\.unlocked \? `\$\{unit\.weaponName\}・\$\{unit\.rangeBand\}・\$\{unit\.primaryTarget\}` : unit\.unlockHint/);
  assert.match(screens, /unit\.unlocked \? selected \? "選択中" : "待機" : "未解放"/);
  assert.match(screens, /className="result-unlocks"[\s\S]*新たな戦力を解放/);
  assert.match(game, /newlyUnlockedUnitIds\.map/);
  assert.match(game, /newlyUnlockedStageIds\.map/);
  assert.match(game, /resolveStageResult\(campaignSave,[\s\S]*if \(!localQaResult\) \{[\s\S]*writeCampaignSave\(campaignStorageFor\(window\), "nishijin-campaign-v1", serializeCampaignSave\(resolved\.save\)\)[\s\S]*setCampaignSave\(resolved\.save as CampaignSave\)/);

  assert.match(game, /if \(resolveLocalQaMode\(window\.location\.hostname, window\.location\.search\)[\s\S]*resolveLocalQaScenario\(window\.location\.hostname, window\.location\.search\)\) return;/);
  assert.match(game, /unlocked: Boolean\(qaMode \|\| qaScenario\) \|\| isUnitUnlocked/);
  assert.match(game, /if \(!qaMode && !qaScenario && !isUnitUnlocked\(campaignSave, kind\)\) return/);
  assert.match(game, /className=\{`qa-badge \$\{screen === "battle" \? "" : "campaign-qa-badge"\}`\}/);
  assert.match(game, /通常セーブ非反映/);
  assert.match(game, /\{screen === "battle" && <>/);
  assert.ok(game.indexOf("campaign-qa-badge") < game.indexOf('{screen === "battle" && <>'));
});

test("keeps the main player-facing battle and result UI Japanese-first", async () => {
  const [game, screens, campaign, story] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/campaign.js", import.meta.url), "utf8"),
    readFile(new URL("../app/storyEvents.js", import.meta.url), "utf8"),
  ]);
  const battleUi = game.slice(game.indexOf("const healthPct"));
  assert.match(battleUi, />移動拠点</);
  assert.match(battleUi, /第\{hud\.phase\}段階/);
  assert.match(battleUi, /aria-label="生存者ユニット"/);
  assert.match(battleUi, /移動拠点一斉掃射/);
  assert.match(battleUi, />一時停止</);
  assert.doesNotMatch(battleUi, />CRAWLER<|>PAUSED<|>SEC<|aria-label="Survivor units"/);
  assert.match(screens, /作戦時間[\s\S]*撃破数[\s\S]*移動拠点HP[\s\S]*戦闘不能/);
  assert.match(game, /★ 作戦成功・移動拠点HP 1%以上/);
  assert.doesNotMatch(screens, />LOCK<|>TIME<|>KILLS<|>CRAWLER<|>LOSSES<|TAP TO RELOAD|CRAWLER SYSTEM CHECK/);
  assert.doesNotMatch(campaign, /label: "(?:WAVE|WARNING|BOSS)\b/);
  assert.match(story, /STORY_SCRIPT_VERSION = "prologue-v5"/);
  assert.match(story, /中心が開きました。今です/);
});

test("draws three unmistakably different stage environments", async () => {
  const [game, objectManifest] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/stageObjectManifest.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(game, /function drawStageEnvironment/);
  assert.match(game, /STAGE_OBJECT_MANIFEST, stageObjectsFor/);
  assert.match(game, /function drawStageObjectOverlays[\s\S]*ctx\.drawImage/);
  assert.match(game, /trapSprung[\s\S]*evac-ready[\s\S]*nest-destroyed/);
  assert.match(game, /compact && g\.definition\.stageId === CAMPAIGN_STAGE_IDS\.SAWARA_WARD_OFFICE[\s\S]*naturalHeight \* \.24[\s\S]*ctx\.drawImage/);
  assert.match(game, /else if \(g\.definition\.stageId === CAMPAIGN_STAGE_IDS\.SAWARA_WARD_OFFICE\)[\s\S]*naturalHeight \* \.2[\s\S]*ctx\.drawImage/);
  const backgroundDraw = game.slice(game.indexOf("function drawStageBackground"), game.indexOf("function drawWorld"));
  assert.match(backgroundDraw, /compact && g\.definition\.stageId === CAMPAIGN_STAGE_IDS\.NISHIJIN_DEFENSE_LINE[\s\S]*naturalHeight \* \.2/);
  assert.match(backgroundDraw, /else if \(g\.definition\.stageId === CAMPAIGN_STAGE_IDS\.NISHIJIN_DEFENSE_LINE\)[\s\S]*naturalHeight \* \.17/);

  const worldDraw = game.slice(game.indexOf("function drawWorld"), game.indexOf("export function AshfallGame"));
  const drawOrder = [
    'drawStageObjectOverlays(ctx, activeStageObjects, stageObjects, ["rear-scenery"])',
    "drawCrawler(ctx, g, sprites)",
    "drawEnemyBase(ctx, g, enemyBaseSprite)",
    'drawStageObjectOverlays(ctx, activeStageObjects, stageObjects, ["objective"])',
    "const renderables = [",
    'drawStageObjectOverlays(ctx, activeStageObjects, stageObjects, ["foreground-prop"])',
  ].map((needle) => worldDraw.indexOf(needle));
  assert.ok(drawOrder.every((index) => index >= 0), `missing draw step: ${drawOrder.join(",")}`);
  assert.ok(drawOrder.every((index, position) => position === 0 || index > drawOrder[position - 1]), "background, gate, objective, fighters, and foreground preserve depth order");
  assert.match(worldDraw, /if \(g\.definition\.enemyBaseMode !== "scenery"\) \{\s*drawEnemyBase/);
  assert.match(objectManifest, /stage-nishijin-shopping-street[\s\S]*wire-trap[\s\S]*fire-shutter/);
  assert.match(objectManifest, /stage-sawara-ward-office[\s\S]*rescue-van[\s\S]*upper-window[\s\S]*lunch-crate/);
  assert.match(objectManifest, /stage-nishijin-defense-line-takuya[\s\S]*transmitter[\s\S]*spawn-marker[\s\S]*infection-nest/);
});

test("ships the three-route battlefield art with stage-aware objectives and the preserved Pasen sprite", async () => {
  const [game, campaign, css, layout, screens, spriteManifest] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/campaign.js", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/spriteManifest.js", import.meta.url), "utf8"),
  ]);

  await Promise.all([
    access(new URL("../public/battlefield-v4.png", import.meta.url)),
    access(new URL("../public/infected-checkpoint-v1.png", import.meta.url)),
    access(new URL("../public/crawler-fortress-v1.png", import.meta.url)),
    access(new URL("../public/takuya-boss-sprites-v2.png", import.meta.url)),
    access(new URL("../public/ranger-sprites-v1.png", import.meta.url)),
    access(new URL("../public/brawler-sprites-v1.png", import.meta.url)),
    access(new URL("../public/scout-sprites-v2.png", import.meta.url)),
    access(new URL("../public/breaker-sprites-v2.png", import.meta.url)),
    access(new URL("../public/gunner-sprites-v1.png", import.meta.url)),
    access(new URL("../public/medic-sprites-v1.png", import.meta.url)),
    access(new URL("../public/tactical-drop-pod-v1.png", import.meta.url)),
    access(new URL("../public/explosive-drum-v1.png", import.meta.url)),
    access(new URL("../public/medical-supply-station-v1.png", import.meta.url)),
  ]);

  assert.match(game, /loadImage\("\/infected-checkpoint-v1\.png"/);
  assert.match(game, /crawler: "\/crawler-fortress-v1\.png"/);
  assert.match(game, /pod: "\/tactical-drop-pod-v1\.png"/);
  assert.match(game, /drum: "\/explosive-drum-v1\.png"/);
  assert.match(game, /medical: "\/medical-supply-station-v1\.png"/);
  assert.match(game, /drawBattlefieldSupply\(ctx, renderable\.object, sprites\)/);
  assert.match(game, /function drawEnemyBase/);
  assert.match(game, /infected checkpoint closes all three routes/);
  assert.match(game, /barricadeHp: number/);
  assert.match(game, /barricadeHp: definition\.enemyBaseMaxHp/);
  assert.match(game, /g\.barricadeHp = Math\.max\(0, g\.barricadeHp - structureDamage\)/);
  assert.match(game, /const outcome = g\.paused \? null : battleOutcomeFor\(g\.definition, g\)/);
  assert.match(game, /TAKUYA撃破 — 感染拠点が露出/);
  assert.match(game, /感染拠点 \/\/ 損傷/);
  assert.match(game, /感染拠点 \/\/ 大破/);
  assert.match(game, /hud\.missionType === "timed-defense" \? "救援区域" : "感染拠点"/);
  assert.match(screens, /result\.won \? "作戦成功" : "戦線崩壊"/);
  assert.match(screens, /過去最高星<\/small><b>\{stars\(result\.previousBestStars\)\}/);
  assert.match(campaign, /最終機会 — 感染拠点を破壊/);
  assert.match(css, /\.barrier-health/);
  assert.match(css, /\.barrier-health\.vulnerable/);
  assert.match(css, /\.barrier-health\.hit/);
  assert.match(layout, /title: "西新世紀末物語｜アーリーアクセス版 0\.6\.0"/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.doesNotMatch(layout, /images: \[.*\/og\.png/);
  assert.match(layout, /rel="preload" as="image" href="\/infected-checkpoint-v1\.png"/);
  assert.match(game, /spriteKinds\.map\(\(kind\) => \[kind, spriteSheetPath\(kind\)\]\)/);
  assert.match(spriteManifest, /brawler:[\s\S]*"\/brawler-sprites-v1\.png"/);
  assert.match(spriteManifest, /"crazy-king": newcomerManifestEntry[\s\S]*kumaverson: newcomerManifestEntry[\s\S]*babayaga: newcomerManifestEntry/);
});

test("keeps the battlefield centered in the visual viewport while routing across three roadway bands", async () => {
  const [game, css, layout] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(game, /no lane-map overlay is drawn over the battlefield/);
  assert.doesNotMatch(game, /fillText\(`0\$\{lane \+ 1\}/);
  assert.doesNotMatch(game, /fillText\("MUSTER"/);
  assert.doesNotMatch(game, /ctx\.arc\(BASE_X, y, 16/);
  assert.match(game, /anchorLane: Lane \| null/);
  assert.match(game, /targetId: number \| null/);
  assert.match(game, /import \{ decideAllyIntent \} from "\.\/allyAi\.js"/);
  assert.match(game, /decideAllyIntent\(\{/);
  assert.match(game, /targetClaims/);
  assert.match(game, /interceptorTargetScore/);
  assert.match(game, /routeBlockers/);
  assert.match(game, /isCrawlerRouteBlocker/);
  assert.match(game, /fighterDistance\(f, target\)/);
  assert.match(game, /new ResizeObserver\(configureCanvas\)/);
  assert.match(game, /window\.devicePixelRatio/);
  assert.match(game, /const viewport = window\.visualViewport/);
  assert.match(game, /viewport\?\.width \?\? window\.innerWidth/);
  assert.match(game, /viewport\?\.height \?\? window\.innerHeight/);
  assert.match(game, /viewport\?\.offsetLeft \?\? 0/);
  assert.match(game, /viewport\?\.offsetTop \?\? 0/);
  assert.match(game, /window\.addEventListener\("orientationchange", syncVisualViewport\)/);
  assert.match(game, /window\.visualViewport\?\.addEventListener\("resize", configureCanvas\)/);
  assert.match(game, /const scale = Math\.max\(rect\.width \/ W, rect\.height \/ H\)/);
  assert.match(game, /const offsetX = \(rect\.width - W \* scale\) \/ 2/);
  assert.match(game, /const offsetY = \(rect\.height - H \* scale\) \/ 2/);
  assert.deepEqual(laneCentersForViewport(844, 390), MOBILE_LANDSCAPE_LANE_Y);
  assert.deepEqual(laneCentersForViewport(844, 340), MOBILE_LANDSCAPE_LANE_Y);
  assert.equal(laneCentersForViewport(1280, 720), LANE_Y);
  assert.equal(laneCentersForViewport(390, 844), LANE_Y);
  assert.deepEqual(MOBILE_LANDSCAPE_LANE_Y, [240, 285, 325]);
  assert.match(game, /for \(const fighter of g\.fighters\) fighter\.y \+= shiftForLane\(fighter\.lane\)/);
  assert.match(game, /for \(const object of g\.battlefieldObjects\) object\.y \+= shiftForLane\(object\.lane\)/);
  assert.match(game, /for \(const effect of g\.areaEffects\) effect\.y \+= shiftForLane\(effect\.lane\)/);
  assert.match(game, /laneCenters: activeLaneCenters/);
  assert.match(game, /resolveBattlefieldSupplyLanding\(\{ supply: object, fighters: g\.fighters, laneCenters: activeLaneCenters \}\)/);
  assert.match(game, /resolveDrumDetonation\(\{ supply: object, fighters: g\.fighters, areaEffects: g\.areaEffects, nextAreaEffectId: g\.nextAreaEffectId, laneCenters: activeLaneCenters \}\)/);
  assert.match(game, /resolveAirstrikeImpact\(\{ runtime: g\.airstrike, fighters: g\.fighters, laneCenters: activeLaneCenters \}\)/);
  assert.match(game, /canvas\.dataset\.laneLayout = nextLaneCenters === LANE_Y \? "standard" : "compact-landscape"/);
  assert.match(game, /canvasPointerToWorld\(\{ clientX: event\.clientX, clientY: event\.clientY, rect, transform, worldWidth: W, worldHeight: H \}\)/);
  assert.match(game, /<span>戦場をタップ<\/span>/);
  assert.match(game, /className="placement-cancel"[\s\S]*配置をキャンセル/);
  assert.match(css, /\.placement-hint \{[^}]*max-height:44px;[^}]*pointer-events:none;/);
  assert.match(css, /\.placement-cancel \{[^}]*pointer-events:auto;/);
  assert.match(game, /onPointerDown=\{handleBattlefieldPointerDown\}[\s\S]*onPointerUp=\{handleBattlefieldPointerUp\}/);
  assert.match(game, /handleBattlefieldPointerDown[\s\S]*setPointerCapture[\s\S]*handleBattlefieldPointerMove/);
  assert.doesNotMatch(game, /executeSelectedInLane|className="lane-targets?"/);
  assert.doesNotMatch(css, /\.lane-targets?\b/);

  const coverTransform = (width, height) => {
    const scale = Math.max(width / 960, height / 540);
    return { scale, offsetX: (width - 960 * scale) / 2, offsetY: (height - 540 * scale) / 2 };
  };
  const reducedHeightTransform = coverTransform(844, 340);
  const reducedHeightHudTop = 340 - 21 - 14 - 60;
  const reducedHeightLowLaneBoundary = ((MOBILE_LANDSCAPE_LANE_Y[1] + MOBILE_LANDSCAPE_LANE_Y[2]) / 2) * reducedHeightTransform.scale + reducedHeightTransform.offsetY;
  assert.ok(reducedHeightHudTop - reducedHeightLowLaneBoundary >= 44);
  const assertCoverRoundTrip = ({ width, height, left, top }, worldPoint) => {
    const transform = coverTransform(width, height);
    const mapped = canvasPointerToWorld({
      clientX: left + transform.offsetX + worldPoint.x * transform.scale,
      clientY: top + transform.offsetY + worldPoint.y * transform.scale,
      rect: { left, top, width, height },
      transform,
      worldWidth: 960,
      worldHeight: 540,
    });
    assertClose(mapped.x, worldPoint.x);
    assertClose(mapped.y, worldPoint.y);
  };
  assertCoverRoundTrip({ width: 844, height: 390, left: 17, top: 6 }, { x: 760, y: MOBILE_LANDSCAPE_LANE_Y[1] });
  assertCoverRoundTrip({ width: 844, height: 340, left: 41, top: 9 }, { x: 760, y: MOBILE_LANDSCAPE_LANE_Y[2] });
  // A visual-viewport resize during rotation must not retain portrait offsets.
  assertCoverRoundTrip({ width: 390, height: 844, left: 7, top: 23 }, { x: 480, y: 270 });
  assertCoverRoundTrip({ width: 844, height: 390, left: 23, top: 7 }, { x: 480, y: 270 });

  const stageObjectiveZones = [0, 1, 2].map((lane) => ({ lane, minX: 772, maxX: 928 }));
  const placementBase = {
    running: true, paused: false, over: false, scrap: 100,
    supplyKind: "pod", lane: 1, x: 760, supplies: [], areaEffects: [],
    forbiddenZones: battlefieldPlacementForbiddenZones(stageObjectiveZones),
  };
  assert.deepEqual(battlefieldSupplyPlacementCheck(placementBase), { ok: true, reason: "配置できます" });
  assert.equal(battlefieldSupplyPlacementCheck({ ...placementBase, x: 780 }).reason, "進行上の禁止領域です");
  assert.equal(battlefieldSupplyPlacementCheck({ ...placementBase, lane: 0, x: 780 }).reason, "進行上の禁止領域です");
  assert.equal(battlefieldSupplyPlacementCheck({ ...placementBase, lane: 0, x: 760 }).ok, true);
  assert.equal(battlefieldPlacementForbiddenZones()[0].maxX, WORLD_GEOMETRY.crawler.exitX + 18);

  const indicatorFactory = game.slice(game.indexOf("function placementIndicatorFor"), game.indexOf("type Fighter"));
  assert.match(indicatorFactory, /landingRadius[\s\S]*blastRadius[\s\S]*healRadius[\s\S]*AIRSTRIKE_DEF\.radius/);
  assert.match(indicatorFactory, /innerRadius: supplyDefs\.drum\.burnRadius/);
  const indicatorDraw = game.slice(game.indexOf("function drawPlacementIndicator"), game.indexOf("function drawAirstrikeObserver"));
  assert.match(indicatorDraw, /ctx\.ellipse\(0, 4, radius, radius \* \.34/);
  assert.match(indicatorDraw, /indicator\.innerRadius[\s\S]*ctx\.ellipse/);
  assert.match(indicatorDraw, /ctx\.lineWidth = 1\.4[\s\S]*ctx\.moveTo\(-9, 0\)[\s\S]*labelX = Math\.max/);
  assert.match(game, /g\.banner = placementReasonLabel\(result\.reason\); g\.bannerTime = \.75/);
  assert.match(game, /const compactScale = activeLaneCenters === LANE_Y \? 1 : 1\.1/);
  assert.match(game, /const bannerY = compact \? 132 : 70/);
  for (const label of ["投下ポッド", "爆薬ドラム", "救護所", "航空支援", "一斉掃射"]) assert.match(game, new RegExp(label));
  assert.match(css, /battle-nishijin-shopping-street-v1\.webp/);
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(css, new RegExp(`--app-viewport-safe-${edge}:env\\(safe-area-inset-${edge},0px\\)`));
  }
  assert.match(css, /@supports \(height:100dvh\) \{ :root \{ --app-viewport-height:100dvh; \} \}/);
  assert.match(css, /\.game-shell\[data-screen="battle"\] \.enable-audio-button \{ top:var\(--app-viewport-safe-top\); right:calc\(8px \+ var\(--app-viewport-safe-right\)\); left:auto;[^}]*width:88px;[^}]*height:44px;/);
  assert.match(game, /className="audio-unlock-short"/);
  assert.match(css, /\.game-shell \{ position:fixed; top:var\(--app-viewport-top\); left:var\(--app-viewport-left\); width:var\(--app-viewport-width\); height:var\(--app-viewport-height\)/);
  assert.match(css, /\.game-frame \{ position:relative; width:100%; height:100%/);
  assert.match(css, /\.bottom-hud \{[^}]*var\(--app-viewport-safe-bottom\)[^}]*var\(--app-viewport-safe-right\)[^}]*var\(--app-viewport-safe-left\)/);
  assert.match(css, /\.crawler-alert \{[^}]*left:calc\(2% \+ var\(--app-viewport-safe-left\)\)/);
  assert.match(css, /\.battle-barks \{[^}]*left:calc\(2% \+ var\(--app-viewport-safe-left\)\)/);
  assert.match(css, /\.qa-badge \{[^}]*right:calc\(1\.5% \+ var\(--app-viewport-safe-right\)\)/);
  assert.doesNotMatch(css, /height:100vh/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /width: "device-width, viewport-fit=cover" as "device-width"/);
  assert.doesNotMatch(layout, /<meta name="viewport"/);
  assert.doesNotMatch(css, /mask-image/);
  assert.doesNotMatch(css, /repeating-linear-gradient\(0deg/);
  assert.match(css, /orientation:portrait/);
});

test("provides stage-aware preparation and phase banners with a three-slot bay and selectable tactics", async () => {
  const [game, css] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.equal(PREP_SECONDS, 5);
  assert.deepEqual(TACTIC_MODES, ["defend", "balanced", "assault"]);
  assert.match(game, /g\.time < g\.definition\.prepSeconds/);
  assert.match(game, /`出撃準備 \/\/ \$\{Math\.max\(1, Math\.ceil\(g\.definition\.prepSeconds - g\.time\)\)\}`/);
  assert.match(game, /const nextPhase = phaseForBattle\(g\.definition, g\.time\)/);
  assert.match(game, /g\.banner = phaseBannerForBattle\(g\.definition, nextPhase\)/);
  assert.match(game, /deployQueue: UnitKind\[\]/);
  assert.match(game, /g\.deployQueue\.length >= 3/);
  assert.match(game, /格納庫満員 \/\/ 3/);
  assert.match(game, /g\.deployQueue\.shift\(\)/);
  assert.match(game, /格納庫 \{hud\.deployQueue\}\/3/);
  assert.match(game, /const setTactic/);
  assert.match(game, /const cycleTactic/);
  assert.match(game, /作戦方針 \/\//);
  assert.match(game, /normalizedKey === "r"/);
  assert.match(game, /aria-label=\{`作戦方針を切り替え（現在：\$\{tacticName\}）`\}/);
  assert.match(game, /advanceLimitFor\(g\.tactic, g\.phase, g\.barricadeVulnerable\)/);
  assert.match(game, /tacticTargetBias\(g\.tactic, enemy\.x\)/);
  assert.match(css, /\.tactic-cycle\.defend/);
  assert.match(css, /\.tactic-cycle\.assault/);
});

test("applies the COMMAND economy, deployment gates, and shared world geometry", () => {
  assert.equal(COMMAND_MAX, 100);
  assert.equal(COMMAND_REGEN, 3.5);
  assert.equal(SUPPORT_GAUGE_MAX, 100);
  assert.equal(RAGE_MAX, 100);
  assert.equal(BARRICADE_MAX_HP, 1000);
  assert.equal(advanceCommand(55, 10), 90);
  assert.equal(advanceCommand(95, 10), 100);
  assert.equal(advanceCommand(40, -5), 40);

  const ready = { running: true, paused: false, over: false, command: 45, cost: 45, cooldown: 0 };
  assert.equal(canDeploy(ready), true);
  assert.equal(canDeploy({ ...ready, running: false }), false);
  assert.equal(canDeploy({ ...ready, paused: true }), false);
  assert.equal(canDeploy({ ...ready, over: true }), false);
  assert.equal(canDeploy({ ...ready, command: 44.99 }), false);
  assert.equal(canDeploy({ ...ready, cooldown: 0.01 }), false);

  assert.deepEqual(LANE_NAMES, ["TOP", "MID", "LOW"]);
  assert.deepEqual(LANE_Y, [212, 282, 352]);
  assert.equal(new Set(LANE_Y).size, 3);
  assert.equal(laneForY(LANE_Y[0], 1), 0);
  assert.equal(laneForY(250, 1), 1);
  assert.equal(laneForY(240, 1), 0);
  assert.equal(laneForY(LANE_Y[2], 1), 2);
  assert.deepEqual(WORLD_GEOMETRY, {
    baseX: 110,
    musterX: 205,
    musterY: 352,
    crawler: {
      x: -112, y: 170, width: 310, height: 210, exitX: 214,
      commandDeckX: 64, commandDeckY: 186, weaponX: 108, weaponY: 224,
      damageX: 88, damageY: 250,
    },
    enemyBase: {
      drawX: 770, drawY: 88, width: 190, height: 340,
      attackX: 875, enemySpawnMinX: 805, enemySpawnMaxX: 833,
      gateX: 880, gateY: 282,
    },
    barricade: {
      drawX: 770, drawY: 88, width: 190, height: 340,
      attackX: 875, enemySpawnMinX: 805, enemySpawnMaxX: 833,
      gateX: 880, gateY: 282,
    },
    supportMinX: 230,
    supportMaxX: 805,
    threatNearX: 310,
    threatStartX: 455,
  });
  assert.ok(WORLD_GEOMETRY.barricade.drawY < LANE_Y[0]);
  assert.ok(WORLD_GEOMETRY.barricade.drawY + WORLD_GEOMETRY.barricade.height > LANE_Y[2]);
  assert.ok(WORLD_GEOMETRY.barricade.drawX <= WORLD_GEOMETRY.barricade.enemySpawnMinX);
  assert.ok(WORLD_GEOMETRY.barricade.enemySpawnMaxX <= WORLD_GEOMETRY.barricade.drawX + WORLD_GEOMETRY.barricade.width);
  assert.ok(WORLD_GEOMETRY.barricade.drawX <= WORLD_GEOMETRY.barricade.attackX);
  assert.ok(WORLD_GEOMETRY.barricade.attackX <= WORLD_GEOMETRY.barricade.drawX + WORLD_GEOMETRY.barricade.width);
  assert.equal(WORLD_GEOMETRY.enemyBase, WORLD_GEOMETRY.barricade);
  assert.ok(WORLD_GEOMETRY.musterX < WORLD_GEOMETRY.crawler.exitX);
  assert.ok(WORLD_GEOMETRY.crawler.exitX < WORLD_GEOMETRY.supportMinX);
  assert.equal((WORLD_GEOMETRY.enemyBase.attackX - WORLD_GEOMETRY.baseX) / (800 - 188), 1.25);

  for (const lane of [0, 1, 2]) {
    assert.deepEqual(enemyBaseTargetPoint(lane), { x: 875, y: LANE_Y[lane] - 24 });
    assert.deepEqual(enemyBaseTargetPoint(lane, MOBILE_LANDSCAPE_LANE_Y), { x: 875, y: MOBILE_LANDSCAPE_LANE_Y[lane] - 24 });
  }
  assert.deepEqual(enemyBaseTargetPoint(99), enemyBaseTargetPoint(1));
  assert.deepEqual(bossPhaseForHp(100, 100), { phase: 1, label: "第1段階" });
  assert.deepEqual(bossPhaseForHp(75, 100), { phase: 2, label: "第2段階" });
  assert.deepEqual(bossPhaseForHp(25, 100), { phase: 3, label: "最終段階" });
});

test("bounds advance by phase, vulnerability, and tactical posture", () => {
  assert.equal(advanceLimitFor("defend", 1, false), 510);
  assert.equal(advanceLimitFor("balanced", 1, false), 550);
  assert.equal(advanceLimitFor("assault", 1, false), 590);
  assert.equal(advanceLimitFor("defend", 2, false), 760);
  assert.equal(advanceLimitFor("balanced", 2, false), 800);
  assert.equal(advanceLimitFor("assault", 2, false), 840);
  assert.equal(advanceLimitFor("defend", 3, false), 760);
  assert.equal(advanceLimitFor("balanced", 3, false), 800);
  assert.equal(advanceLimitFor("assault", 3, false), 840);
  assert.equal(advanceLimitFor("defend", 3, true), 875);
  assert.equal(advanceLimitFor("balanced", 3, true), 875);
  assert.equal(advanceLimitFor("assault", 3, true), 875);

  assert.equal(tacticTargetBias("defend", 400), -70);
  assert.equal(tacticTargetBias("defend", 500), 20);
  assert.equal(tacticTargetBias("balanced", 700), 0);
  assert.equal(tacticTargetBias("assault", 600), 15);
  assert.equal(tacticTargetBias("assault", 601), -45);
});

test("applies role focus, marking, finishing, and structure-breach multipliers", () => {
  assert.equal(roleTargetBias("scout", "runner"), -34);
  assert.equal(roleTargetBias("scout", "shade"), -34);
  assert.equal(roleTargetBias("ranger", "spitter"), -42);
  assert.equal(roleTargetBias("ranger", "walker"), 0);
  assert.equal(roleTargetBias("gunner", "crusher"), -34);
  assert.equal(roleTargetBias("gunner", "abomination"), -34);

  assert.equal(humanAttackMultiplier("gunner", "crusher"), 1.3);
  assert.equal(isBrawlerFinisher("brawler", .351), false);
  assert.equal(isBrawlerFinisher("brawler", .35), true);
  assert.equal(isBrawlerFinisher("scout", .2), false);
  assert.equal(humanAttackMultiplier("brawler", "walker", .351), 1);
  assert.equal(humanAttackMultiplier("brawler", "walker", .35), 1.35);
  assert.equal(humanAttackMultiplier("scout", "runner", 1, true), 1.15);
  assertClose(humanAttackMultiplier("brawler", "walker", .2, true), 1.5525);
  assertClose(humanAttackMultiplier("gunner", "crusher", 1, true), 1.495);

  assert.equal(structureDamageMultiplier("scout", "balanced"), 1);
  assert.equal(structureDamageMultiplier("brute", "balanced"), 1.5);
  assert.equal(structureDamageMultiplier("brawler", "balanced"), 1.2);
  assert.equal(structureDamageMultiplier("gunner", "balanced"), 1.1);
  assert.equal(structureDamageMultiplier("medic", "balanced"), .7);
  assertClose(structureDamageMultiplier("brute", "assault"), 1.68);
  assertClose(structureDamageMultiplier("brute", "defend"), 1.35);

  assert.equal(roleEffectForAction({ unitKind: "scout", targetKind: "runner", targetAlreadyMarked: false }), "scout");
  assert.equal(roleEffectForAction({ unitKind: "scout", targetKind: "runner", targetAlreadyMarked: true }), null);
  assert.equal(roleEffectForAction({ unitKind: "ranger", targetKind: "spitter" }), "ranger");
  assert.equal(roleEffectForAction({ unitKind: "ranger", targetKind: "walker" }), null);
  assert.equal(roleEffectForAction({ unitKind: "brute", targetKind: "walker", holdingFrontline: true }), "brute");
  assert.equal(roleEffectForAction({ unitKind: "brute", targetKind: "walker", holdingFrontline: false }), null);
  assert.equal(roleEffectForAction({ unitKind: "brute", action: "structure" }), "brute");
  assert.equal(roleEffectForAction({ unitKind: "brawler", targetKind: "walker", targetHpRatio: .35 }), "brawler");
  assert.equal(roleEffectForAction({ unitKind: "brawler", targetKind: "walker", targetHpRatio: .351 }), null);
  assert.equal(roleEffectForAction({ unitKind: "gunner", targetKind: "crusher" }), "gunner");
  assert.equal(roleEffectForAction({ unitKind: "gunner", targetKind: "abomination" }), "gunner");
  assert.equal(roleEffectForAction({ unitKind: "gunner", targetKind: "walker" }), null);
  assert.equal(roleEffectForAction({ unitKind: "medic", action: "heal" }), "medic");
  assert.equal(roleEffectForAction({ unitKind: "medic", action: "attack", targetKind: "walker" }), null);
});

test("tracks one barricade condition and resolves the battle from either structure", () => {
  assert.equal(barricadeState(1000), "INTACT");
  assert.equal(barricadeState(701), "INTACT");
  assert.equal(barricadeState(700), "BUCKLING");
  assert.equal(barricadeState(351), "BUCKLING");
  assert.equal(barricadeState(350), "BREACH IMMINENT");
  assert.equal(barricadeState(1), "BREACH IMMINENT");
  assert.equal(barricadeState(0), "BREACHED");
  assert.equal(barricadeState(-1), "BREACHED");

  assert.deepEqual(enemyBaseVisualState({ hp: 1000 }), { phase: "healthy", damageLevel: 0, collapseProgress: 0 });
  assert.deepEqual(enemyBaseVisualState({ hp: 999 }), { phase: "light", damageLevel: 1, collapseProgress: 0 });
  assert.deepEqual(enemyBaseVisualState({ hp: 701 }), { phase: "light", damageLevel: 1, collapseProgress: 0 });
  assert.deepEqual(enemyBaseVisualState({ hp: 700 }), { phase: "heavy", damageLevel: 2, collapseProgress: 0 });
  assert.deepEqual(enemyBaseVisualState({ hp: 351 }), { phase: "heavy", damageLevel: 2, collapseProgress: 0 });
  assert.deepEqual(enemyBaseVisualState({ hp: 350 }), { phase: "critical", damageLevel: 3, collapseProgress: 0 });
  assert.deepEqual(enemyBaseVisualState({ hp: 1 }), { phase: "critical", damageLevel: 3, collapseProgress: 0 });
  assert.deepEqual(enemyBaseVisualState({ hp: 0 }), { phase: "collapsing", damageLevel: 4, collapseProgress: 0 });
  const collapsingBase = enemyBaseVisualState({ hp: 0, elapsed: ENEMY_BASE_COLLAPSE_SECONDS / 2 });
  assert.equal(collapsingBase.phase, "collapsing");
  assert.equal(collapsingBase.damageLevel, 4);
  assertClose(collapsingBase.collapseProgress, .5);
  assert.deepEqual(enemyBaseVisualState({ hp: 0, elapsed: ENEMY_BASE_COLLAPSE_SECONDS }), { phase: "collapsed", damageLevel: 4, collapseProgress: 1 });
  assert.deepEqual(enemyBaseVisualState({ hp: -1, elapsed: 99 }), { phase: "collapsed", damageLevel: 4, collapseProgress: 1 });
  assert.deepEqual(enemyBaseVisualState({ hp: 1100 }), { phase: "healthy", damageLevel: 0, collapseProgress: 0 });

  assert.equal(battleOutcome(100, BARRICADE_MAX_HP), null);
  assert.equal(battleOutcome(0, 500), "lost");
  assert.equal(battleOutcome(100, 0), "won");
  assert.equal(battleOutcome(0, 0), "lost");

  assert.deepEqual(advanceEnemyBaseCollapse({ barricadeHp: 100, elapsed: .4, seconds: .2 }), { active: false, elapsed: 0, complete: false });
  assert.deepEqual(advanceEnemyBaseCollapse({ barricadeHp: 0, elapsed: 0, seconds: .4 }), { active: true, elapsed: .4, complete: false });
  assert.deepEqual(advanceEnemyBaseCollapse({ barricadeHp: 0, elapsed: .8, seconds: .4 }), { active: true, elapsed: 1.05, complete: true });
});

test("scores autonomous targets without collapsing every unit onto one enemy", () => {
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 700 }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 1, enemyX: 700 }), 382);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 1, enemyX: 700, isCurrent: true }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 2, enemyX: 700 }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 455 }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 454 }), 245);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 310 }), 245);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 309 }), 120);
});

test("distributes enemy interceptors and only blocks the active Crawler route", () => {
  assert.equal(interceptorTargetScore({ distance: 120, claims: 0, capacity: 1 }), 120);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 1, capacity: 1 }), 216);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 1, capacity: 1, isCurrent: true }), 120);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 2, capacity: 2 }), 216);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 0, capacity: 1, rearward: 12 }), 144);

  const route = { enemyX: 700, defenderX: 620, routeY: LANE_Y[0] };
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderY: LANE_Y[0] }), true);
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderY: LANE_Y[2] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderX: 590, defenderY: LANE_Y[0] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderX: 710, defenderY: LANE_Y[0] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderY: LANE_Y[0] + 31 }), false);
});

test("returns phases, new objectives, siege scaling, rewards, and support costs", () => {
  assert.equal(phaseAt(0), 1);
  assert.equal(phaseAt(59.999), 1);
  assert.equal(phaseAt(60), 2);
  assert.equal(phaseAt(147.999), 2);
  assert.equal(phaseAt(148), 3);

  assert.equal(objectiveFor(1, false), "3レーンを防衛");
  assert.equal(objectiveFor(2, false), "感染拠点へ前進");
  assert.equal(objectiveFor(3, false), "TAKUYAを撃破");
  assert.equal(objectiveFor(3, true), "感染拠点を破壊");

  assert.equal(crawlerSiegeDamage(15, 1), 11);
  assert.equal(crawlerSiegeDamage(15, 2), 14);
  assert.equal(crawlerSiegeDamage(15, 3), 15);
  assert.equal(crawlerThreatLevel(Infinity), 0);
  assert.equal(crawlerThreatLevel(WORLD_GEOMETRY.threatStartX), 0);
  assert.equal(crawlerThreatLevel(315), .5);
  assert.equal(crawlerThreatLevel(175), 1);

  const gaugeRewards = { walker: 4, runner: 5, spitter: 8, crusher: 14, shade: 22, abomination: 20, takuya: 25, turned: 7 };
  assert.deepEqual(
    Object.fromEntries(Object.keys(gaugeRewards).map((kind) => [kind, supportGaugeReward(kind)])),
    gaugeRewards,
  );
  assert.equal(rageReward("crusher"), supportGaugeReward("crusher"));
  assert.deepEqual(Object.values(BATTLEFIELD_SUPPLY_DEFS).map(({ kind, cost }) => [kind, cost]), [
    ["pod", 50],
    ["drum", 40],
    ["medical", 35],
  ]);
  assert.equal("maxActive" in BATTLEFIELD_SUPPLY_DEFS.pod, false);
  assert.equal("maxPerLane" in BATTLEFIELD_SUPPLY_DEFS.pod, false);
  assert.deepEqual(SUPPORT_DEFS.map(({ kind, cost }) => [kind, cost]), [
    ["barrel", 20],
    ["medkit", 25],
    ["molotov", 35],
    ["airstrike", 60],
  ]);
  assert.deepEqual(UNIT_CARDS.map(({ kind, desc }) => [kind, desc]), [
    ["scout", "遊撃手・高速迎撃"],
    ["ranger", "射撃手・遠距離射撃"],
    ["brute", "破砕兵・前線維持"],
    ["brawler", "格闘家・素手近接"],
    ["gunner", "制圧射手・大型制圧"],
    ["medic", "衛生兵・回復支援"],
    ["crazy-king", "狂戦士・密集殲滅"],
    ["kumaverson", "前衛打撃・足止め"],
    ["babayaga", "精密射撃・特殊排除"],
  ]);
});

test("models all three battlefield supplies without fixed pod count or lane caps", () => {
  const base = {
    running: true, paused: false, over: false, scrap: 100,
    supplyKind: "pod", lane: 1, x: 440, supplies: [], areaEffects: [],
    nextId: 10, nextAreaEffectId: 30,
  };
  assert.deepEqual(battlefieldSupplyPlacementCheck(base), { ok: true, reason: "配置できます" });
  assert.equal(battlefieldSupplyPlacementCheck({ ...base, running: false }).ok, false);
  assert.equal(battlefieldSupplyPlacementCheck({ ...base, scrap: 49 }).reason, "スクラップが不足しています");
  assert.equal(battlefieldSupplyPlacementCheck({ ...base, x: 234 }).reason, "配置可能範囲外です");
  assert.equal(battlefieldSupplyPlacementCheck({ ...base, forbiddenZones: [{ lane: 1, minX: 420, maxX: 460 }] }).reason, "進行上の禁止領域です");

  const podPlacement = resolveBattlefieldSupplyPlacement(base);
  assert.equal(podPlacement.ok, true);
  assert.equal(podPlacement.scrap, 50);
  assert.equal(podPlacement.supplies[0].kind, "pod");
  assert.equal(podPlacement.supplies[0].phase, "dropping");
  assert.equal(podPlacement.nextId, 11);
  assert.deepEqual(battlefieldSupplyPlacementCheck({ ...base, supplies: [podPlacement.supplies[0]], x: 500 }), { ok: false, reason: "既存物資に近すぎます" });
  assert.deepEqual(battlefieldSupplyPlacementCheck({ ...base, supplies: [podPlacement.supplies[0]], x: 700 }), { ok: true, reason: "配置できます" });
  assert.deepEqual(battlefieldSupplyPlacementCheck({ ...base, supplies: [
    { ...podPlacement.supplies[0], lane: 0, x: 300, y: LANE_Y[0] },
    { ...podPlacement.supplies[0], id: 11, lane: 2, x: 600, y: LANE_Y[2] },
  ] }), { ok: true, reason: "配置できます" });

  const readyToLand = advanceBattlefieldSupply(podPlacement.supplies[0], BATTLEFIELD_SUPPLY_DEFS.pod.dropSeconds);
  assert.equal(podPlacement.supplies[0].targetable, false);
  assert.equal(podPlacement.supplies[0].blocksEnemies, false);
  assert.equal(resolveBattlefieldSupplyLanding({ supply: podPlacement.supplies[0], fighters: [] }).triggered, false);
  assert.equal(readyToLand.readyToLand, true);
  const landing = resolveBattlefieldSupplyLanding({
    supply: readyToLand,
    fighters: [
      { id: 1, side: "zombie", lane: 1, x: 450, y: LANE_Y[1], hp: 100, maxHp: 100 },
      { id: 2, side: "human", lane: 1, x: 430, y: LANE_Y[1], hp: 100, maxHp: 100 },
      { id: 3, side: "zombie", lane: 1, x: 700, y: LANE_Y[1], hp: 100, maxHp: 100 },
    ],
  });
  assert.equal(landing.triggered, true);
  assert.equal(landing.supply.targetable, true);
  assert.equal(landing.supply.blocksEnemies, true);
  assert.deepEqual(landing.hits.map(({ side, damage }) => [side, damage]), [["zombie", 72], ["human", 22]]);
  assert.equal(resolveBattlefieldSupplyLanding({ supply: landing.supply, fighters: landing.fighters }).triggered, false);
  const activePod = advanceBattlefieldSupply(landing.supply, BATTLEFIELD_SUPPLY_DEFS.pod.impactSeconds);
  assert.equal(activePod.phase, "active");
  const destroyedPod = applyBattlefieldSupplyDamage(activePod, activePod.hp + 1);
  assert.equal(destroyedPod.supply.phase, "destroying");
  assert.equal(advanceBattlefieldSupply(destroyedPod.supply, BATTLEFIELD_SUPPLY_DEFS.pod.destroySeconds).phase, "expired");

  const drumPlacement = resolveBattlefieldSupplyPlacement({ ...base, supplyKind: "drum", scrap: 100, nextId: 20 });
  const manual = requestDrumDetonation(drumPlacement.supplies[0]);
  assert.equal(manual.ok, true);
  const explosion = resolveDrumDetonation({
    supply: manual.supply,
    fighters: [
      { id: 4, side: "zombie", lane: 1, x: 450, y: LANE_Y[1], hp: 150, maxHp: 150 },
      { id: 5, side: "human", lane: 1, x: 450, y: LANE_Y[1], hp: 100, maxHp: 100 },
    ],
    nextAreaEffectId: 40,
  });
  assert.equal(explosion.triggered, true);
  assert.deepEqual(explosion.hits, [{ id: 4, damage: BATTLEFIELD_SUPPLY_DEFS.drum.blastDamage }]);
  assert.equal(explosion.areaEffects[0].kind, "burn");
  assert.equal(explosion.nextAreaEffectId, 41);
  assert.equal(resolveDrumDetonation({ supply: explosion.supply }).triggered, false);
  const burned = advanceAreaEffects({ areaEffects: explosion.areaEffects, fighters: explosion.fighters, seconds: 1 });
  assert.equal(burned.fighters[0].hp, 150 - BATTLEFIELD_SUPPLY_DEFS.drum.blastDamage - BATTLEFIELD_SUPPLY_DEFS.drum.burnDamagePerSecond);
  assert.equal(burned.fighters[1].hp, 100);
  assert.equal(burned.fighters[0].slowMultiplier, BATTLEFIELD_SUPPLY_DEFS.drum.slowMultiplier);
  assert.equal(advanceAreaEffects({ areaEffects: explosion.areaEffects, fighters: [], seconds: BATTLEFIELD_SUPPLY_DEFS.drum.burnSeconds }).areaEffects[0].phase, "expired");

  const destroyedDrum = applyBattlefieldSupplyDamage(drumPlacement.supplies[0], 999);
  assert.equal(destroyedDrum.detonationRequested, true);
  assert.equal(destroyedDrum.supply.phase, "detonating");
  assert.equal(destroyedDrum.supply.detonationReason, "destroyed");

  const medicalPlacement = resolveBattlefieldSupplyPlacement({ ...base, supplyKind: "medical", scrap: 100, nextId: 50, nextAreaEffectId: 60 });
  assert.equal(medicalPlacement.areaEffects[0].kind, "healing");
  const healed = advanceAreaEffects({
    areaEffects: medicalPlacement.areaEffects,
    activeSupplyIds: [50],
    seconds: 1,
    fighters: [
      { id: 6, side: "human", lane: 1, x: 440, y: LANE_Y[1], hp: 50, maxHp: 100 },
      { id: 7, side: "zombie", lane: 1, x: 440, y: LANE_Y[1], hp: 50, maxHp: 100 },
    ],
  });
  assert.equal(healed.fighters[0].hp, 68);
  assert.equal(healed.fighters[1].hp, 50);
  assert.equal(advanceBattlefieldSupply(medicalPlacement.supplies[0], BATTLEFIELD_SUPPLY_DEFS.medical.effectSeconds).phase, "expired");
  const missingSource = advanceAreaEffects({ areaEffects: medicalPlacement.areaEffects, activeSupplyIds: [], fighters: healed.fighters, seconds: 1 });
  assert.equal(missingSource.areaEffects[0].phase, "expired");
  assert.equal(missingSource.changes.length, 0);

  const manyEffects = Array.from({ length: 32 }, (_, index) => ({
    id: 100 + index,
    kind: index % 2 === 0 ? "burn" : "healing",
    sourceSupplyId: 500 + index,
    lane: 1,
    x: 440,
    y: LANE_Y[1],
    radius: 100,
    amountPerSecond: 1,
    remaining: 3,
    phase: "active",
    slowMultiplier: .8,
  }));
  const manyEffectStep = advanceAreaEffects({
    areaEffects: manyEffects,
    seconds: 1,
    fighters: [
      { id: 80, side: "zombie", lane: 1, x: 440, y: LANE_Y[1], hp: 100, maxHp: 100 },
      { id: 81, side: "human", lane: 1, x: 440, y: LANE_Y[1], hp: 50, maxHp: 100 },
    ],
  });
  assert.equal(manyEffectStep.areaEffects.length, 32);
  assert.ok(manyEffectStep.areaEffects.every((effect) => effect.phase === "active"));
  assert.equal(manyEffectStep.changes.length, 32);
  assert.equal(manyEffectStep.fighters[0].hp, 84);
  assert.equal(manyEffectStep.fighters[1].hp, 66);
  const retained = retainActiveAreaEffects([...manyEffectStep.areaEffects, { ...manyEffectStep.areaEffects[0], id: 999, phase: "expired" }]);
  assert.equal(retained.length, 32);
  const visibleEffects = selectAreaEffectsForRender(retained);
  assert.equal(visibleEffects.length, RENDER_ARRAY_LIMITS.areaEffectVisuals);
  assert.equal(retained.length, 32);

  const leftBurn = advanceAreaEffects({ areaEffects: burned.areaEffects, fighters: burned.fighters.map((fighter) => ({ ...fighter, x: 900 })), seconds: 1 });
  assert.equal(leftBurn.fighters[0].burning, false);
  assert.equal(leftBurn.fighters[0].slowMultiplier, 1);
  assert.equal(enemyCanTargetBattlefieldSupply({ supply: landing.supply, enemyX: 600, enemyLane: 1, attackRange: 20 }), true);
  assert.equal(enemyCanTargetBattlefieldSupply({ supply: drumPlacement.supplies[0], enemyX: 600, enemyLane: 1, attackRange: 20 }), false);
  assert.equal(enemyCanTargetBattlefieldSupply({ supply: drumPlacement.supplies[0], enemyX: 480, enemyLane: 1, attackRange: 20 }), true);
});

test("keeps supplies, area effects, and airstrikes aligned and lane-isolated in standard and compact layouts", () => {
  for (const laneCenters of [LANE_Y, MOBILE_LANDSCAPE_LANE_Y]) for (const lane of [0, 1, 2]) {
    const base = {
      running: true, paused: false, over: false, scrap: 200,
      lane, x: 500, supplies: [], areaEffects: [],
      nextId: lane * 10, nextAreaEffectId: lane * 10 + 1,
      laneCenters,
    };
    const fighters = (idBase, side) => [0, 1, 2].map((fighterLane) => ({
      id: idBase + fighterLane, side, lane: fighterLane, x: 500,
      y: laneCenters[fighterLane], hp: side === "human" ? 50 : 500, maxHp: side === "human" ? 100 : 500,
    }));

    const pod = resolveBattlefieldSupplyPlacement({ ...base, supplyKind: "pod" });
    assert.equal(pod.supplies[0].y, laneCenters[lane]);
    const landed = resolveBattlefieldSupplyLanding({
      supply: advanceBattlefieldSupply(pod.supplies[0], BATTLEFIELD_SUPPLY_DEFS.pod.dropSeconds),
      fighters: fighters(100, "zombie"),
      laneCenters,
    });
    assert.deepEqual(landed.hits.map(({ id }) => id), [100 + lane]);

    const drum = resolveBattlefieldSupplyPlacement({ ...base, supplyKind: "drum" });
    const explosion = resolveDrumDetonation({
      supply: requestDrumDetonation(drum.supplies[0]).supply,
      fighters: fighters(200, "zombie"),
      laneCenters,
    });
    assert.deepEqual(explosion.hits.map(({ id }) => id), [200 + lane]);
    assert.equal(explosion.areaEffects[0].y, laneCenters[lane]);
    const burned = advanceAreaEffects({ areaEffects: explosion.areaEffects, fighters: explosion.fighters, seconds: 1 });
    assert.deepEqual(burned.changes.map(({ id }) => id), [200 + lane]);

    const medical = resolveBattlefieldSupplyPlacement({ ...base, supplyKind: "medical" });
    assert.equal(medical.supplies[0].y, laneCenters[lane]);
    assert.equal(medical.areaEffects[0].y, laneCenters[lane]);
    const healed = advanceAreaEffects({
      areaEffects: medical.areaEffects,
      activeSupplyIds: [medical.supplies[0].id],
      seconds: 1,
      fighters: fighters(300, "human"),
    });
    assert.deepEqual(healed.changes.map(({ id }) => id), [300 + lane]);

    const airstrike = resolveAirstrikeImpact({
      runtime: { ...createEmergencySupportRuntime(), phase: "impact", targetX: 500, targetLane: lane },
      laneCenters,
      fighters: fighters(400, "zombie"),
    });
    assert.deepEqual(airstrike.hits.map(({ id }) => id), [400 + lane]);

    if (laneCenters === MOBILE_LANDSCAPE_LANE_Y) {
      for (const item of [pod.supplies[0], drum.supplies[0], medical.supplies[0], medical.areaEffects[0]]) {
        const standardY = item.y + (LANE_Y[lane] - MOBILE_LANDSCAPE_LANE_Y[lane]);
        const compactAgain = standardY + (MOBILE_LANDSCAPE_LANE_Y[lane] - LANE_Y[lane]);
        assert.equal(standardY, LANE_Y[lane]);
        assert.equal(compactAgain, MOBILE_LANDSCAPE_LANE_Y[lane]);
      }
    }
  }
});

test("models airstrike request and one-at-a-time emergency-support transitions", () => {
  const idle = createEmergencySupportRuntime();
  assert.deepEqual(idle, { phase: "idle", phaseTime: 0, targetX: null, targetLane: null, impactTriggered: false });
  const insufficient = requestAirstrike({ running: true, paused: false, over: false, supportGauge: AIRSTRIKE_DEF.gaugeCost - 1, lane: 1, x: 500, runtime: idle });
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.supportGauge, AIRSTRIKE_DEF.gaugeCost - 1);

  assert.deepEqual(
    airstrikePlacementCheck({ running: true, paused: false, over: false, supportGauge: 100, lane: 1, x: 999, runtime: idle }),
    { ok: false, reason: "航空支援の有効範囲外です" },
  );
  assert.equal(requestAirstrike({ running: true, paused: false, over: false, supportGauge: 100, lane: 1, x: 999, runtime: idle }).ok, false);
  const requested = requestAirstrike({ running: true, paused: false, over: false, supportGauge: 100, lane: 1, x: AIRSTRIKE_DEF.maxX, runtime: idle });
  assert.equal(requested.ok, true);
  assert.equal(requested.supportGauge, 40);
  assert.equal(requested.runtime.phase, "radio");
  assert.equal(requested.runtime.targetX, AIRSTRIKE_DEF.maxX);
  assert.equal(requestAirstrike({ running: true, paused: false, over: false, supportGauge: 100, lane: 1, x: 500, runtime: requested.runtime }).ok, false);
  assert.deepEqual(airstrikeObserverPose(idle), { visible: false, rise: 0, action: "idle" });
  assertClose(airstrikeObserverPose({ ...requested.runtime, phaseTime: AIRSTRIKE_DEF.radioSeconds / 2 }).rise, .5);

  const targeting = advanceEmergencySupportRuntime(requested.runtime, AIRSTRIKE_DEF.radioSeconds);
  assert.equal(targeting.runtime.phase, "targeting");
  assert.deepEqual(targeting.events, ["targeting"]);
  assert.deepEqual(airstrikeObserverPose(targeting.runtime), { visible: true, rise: 1, action: "targeting" });
  const inbound = advanceEmergencySupportRuntime(targeting.runtime, AIRSTRIKE_DEF.targetingSeconds);
  assert.equal(inbound.runtime.phase, "inbound");
  assert.deepEqual(inbound.events, ["inbound"]);
  assert.deepEqual(airstrikeObserverPose(inbound.runtime), { visible: true, rise: 1, action: "inbound" });
  const impact = advanceEmergencySupportRuntime(inbound.runtime, AIRSTRIKE_DEF.inboundSeconds);
  assert.equal(impact.runtime.phase, "impact");
  assert.deepEqual(impact.events, ["impact"]);
  assert.deepEqual(airstrikeObserverPose(impact.runtime), { visible: true, rise: 1, action: "impact" });
  const largeDeltaImpact = advanceEmergencySupportRuntime(requested.runtime, 99);
  assert.equal(largeDeltaImpact.runtime.phase, "impact");
  assert.deepEqual(largeDeltaImpact.events, ["targeting", "inbound", "impact"]);
  const resolved = resolveAirstrikeImpact({
    runtime: impact.runtime,
    fighters: [
      { id: 1, side: "zombie", lane: 1, x: AIRSTRIKE_DEF.maxX, y: LANE_Y[1], hp: 200 },
      { id: 2, side: "human", lane: 1, x: AIRSTRIKE_DEF.maxX, y: LANE_Y[1], hp: 200 },
      { id: 3, side: "zombie", lane: 0, x: 300, y: LANE_Y[0], hp: 200 },
    ],
  });
  assert.equal(resolved.triggered, true);
  assert.deepEqual(resolved.hits, [{ id: 1, damage: AIRSTRIKE_DEF.damage }]);
  assert.equal(resolveAirstrikeImpact({ runtime: resolved.runtime, fighters: resolved.fighters }).triggered, false);
  const returning = advanceEmergencySupportRuntime(resolved.runtime, AIRSTRIKE_DEF.impactSeconds);
  assert.equal(returning.runtime.phase, "returning");
  assert.deepEqual(returning.events, ["returning"]);
  assertClose(airstrikeObserverPose({ ...returning.runtime, phaseTime: AIRSTRIKE_DEF.returnSeconds / 2 }).rise, .5);
  const complete = advanceEmergencySupportRuntime(returning.runtime, AIRSTRIKE_DEF.returnSeconds);
  assert.equal(complete.runtime.phase, "idle");
  assert.deepEqual(complete.events, ["complete"]);
  assert.deepEqual(airstrikeObserverPose(complete.runtime), { visible: false, rise: 0, action: "idle" });
});

test("models the independently charged all-lane Crawler barrage with boss mitigation", () => {
  const half = createCrawlerAbilityRuntime();
  assert.equal(half.phase, "cooldown");
  assert.equal(half.charge, .5);
  assert.equal(half.cooldownRemaining, CRAWLER_BARRAGE_DEF.cooldownSeconds / 2);
  const ready = advanceCrawlerAbilityRuntime(half, CRAWLER_BARRAGE_DEF.cooldownSeconds / 2);
  assert.equal(ready.runtime.phase, "ready");
  assert.deepEqual(ready.events, ["ready"]);
  const requested = requestCrawlerBarrage({ running: true, paused: false, over: false, runtime: ready.runtime });
  assert.equal(requested.ok, true);
  assert.equal(requested.runtime.phase, "deploying");
  const firing = advanceCrawlerAbilityRuntime(requested.runtime, CRAWLER_BARRAGE_DEF.deploySeconds);
  assert.equal(firing.runtime.phase, "firing");
  assert.deepEqual(firing.events, ["fire"]);
  const largeDeltaFiring = advanceCrawlerAbilityRuntime(requested.runtime, 99);
  assert.equal(largeDeltaFiring.runtime.phase, "firing");
  assert.deepEqual(largeDeltaFiring.events, ["fire"]);

  const barrage = resolveCrawlerBarrage({
    runtime: firing.runtime,
    fighters: [
      { id: 1, side: "zombie", kind: "walker", lane: 0, hp: 100 },
      { id: 2, side: "zombie", kind: "takuya", lane: 1, hp: 200 },
      { id: 3, side: "zombie", kind: "crusher", lane: 2, hp: 100 },
      { id: 4, side: "human", kind: "scout", lane: 1, hp: 100 },
    ],
  });
  assert.equal(barrage.triggered, true);
  assert.deepEqual(barrage.hits.map(({ lane }) => lane), [0, 1, 2]);
  assert.equal(barrage.hits[0].damage, CRAWLER_BARRAGE_DEF.damage);
  assert.equal(barrage.hits[1].damage, Math.round(CRAWLER_BARRAGE_DEF.damage * CRAWLER_BARRAGE_DEF.bossDamageMultiplier));
  assert.equal(barrage.fighters[3].hp, 100);
  assert.equal(resolveCrawlerBarrage({ runtime: barrage.runtime, fighters: barrage.fighters }).triggered, false);

  const recovering = advanceCrawlerAbilityRuntime(barrage.runtime, CRAWLER_BARRAGE_DEF.fireSeconds);
  assert.equal(recovering.runtime.phase, "recovering");
  const cooldown = advanceCrawlerAbilityRuntime(recovering.runtime, CRAWLER_BARRAGE_DEF.recoverSeconds);
  assert.equal(cooldown.runtime.phase, "cooldown");
  assert.equal(cooldown.runtime.charge, 0);
  assert.deepEqual(cooldown.events, ["cooldown"]);
});

test("renders causal weapon tracers and vehicle-origin Crawler fire without screen-wide placeholder beams", async () => {
  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  const crawlerMuzzle = game.slice(game.indexOf("function drawCrawlerBarrage"), game.indexOf("function stageObjectStatesForGame"));
  assert.match(crawlerMuzzle, /WORLD_GEOMETRY\.crawler/);
  assert.match(crawlerMuzzle, /const muzzleX = crawler\.weaponX \+ 45/);
  assert.match(crawlerMuzzle, /createRadialGradient\(muzzleX, muzzleY/);
  assert.doesNotMatch(crawlerMuzzle, /scanline|repeating|for \(const lane/);

  const barrageStart = game.indexOf('if (crawlerStep.events.includes("fire"))');
  const barrageResolution = game.slice(barrageStart, game.indexOf("for (const object of g.battlefieldObjects)", barrageStart));
  assert.match(barrageResolution, /const visualHitsByLane = \[0, 0, 0\]/);
  assert.match(barrageResolution, /visualHitsByLane\[fighter\.lane\] < 3/);
  assert.match(barrageResolution, /x: WORLD_GEOMETRY\.crawler\.weaponX \+ 45[\s\S]*tx: fighter\.x[\s\S]*ty: fighter\.y - 24/);
  assert.match(barrageResolution, /style: "crawler",\s*weapon: "crawler"/);
  assert.match(barrageResolution, /addParticles\(g, fighter\.x, fighter\.y - 22/);

  const shotDraw = game.slice(game.indexOf("for (const shot of g.shots)"), game.indexOf("ctx.shadowBlur = 0;", game.indexOf("for (const shot of g.shots)")));
  assert.match(shotDraw, /const weapon = shot\.weapon \?\? shot\.effect/);
  assert.match(shotDraw, /weapon === "ranger"[\s\S]*weapon === "gunner"[\s\S]*weapon === "spitter"[\s\S]*weapon === "crawler"/);
  assert.match(shotDraw, /const tailLength = weapon === "crawler" \? 46[\s\S]*ctx\.moveTo\(x - ux \* tailLength, y - uy \* tailLength\);\s*ctx\.lineTo\(x, y\)/);
  assert.match(shotDraw, /if \(p < \.3\)[\s\S]*const muzzle =/);
  assert.match(shotDraw, /if \(p > \.62\)[\s\S]*ctx\.arc\(shot\.tx, shot\.ty/);
  assert.doesNotMatch(shotDraw, /ctx\.moveTo\(shot\.x, shot\.y\);\s*ctx\.lineTo\(shot\.tx, shot\.ty\)/);
});

test("caps transient render arrays and limits camera shake to major events", () => {
  assert.deepEqual(RENDER_ARRAY_LIMITS, { particles: 420, shots: 180, damageTexts: 140, areaEffectVisuals: 24, battleBarks: 2 });
  assert.deepEqual(capRenderArray([1, 2, 3, 4], 2), [3, 4]);
  assert.deepEqual(capRenderArray([1, 2, 3], 0), []);
  assert.deepEqual(capRenderArray([1, 2, 3], "battleBarks"), [2, 3]);
  assert.deepEqual(Object.keys(CAMERA_SHAKE_EVENTS), ["podLanding", "airstrikeImpact", "crawlerBarrage", "takuyaEntrance", "takuyaHeavy", "takuyaDefeat", "enemyBaseCollapse"]);
  assert.equal("normalAttack" in CAMERA_SHAKE_EVENTS, false);
  assert.ok(Object.values(CAMERA_SHAKE_EVENTS).every(({ strength, seconds }) => strength >= 0 && seconds > 0));
  const startedShake = triggerCameraShake(createCameraShakeRuntime(), CAMERA_SHAKE_EVENTS.takuyaHeavy);
  assert.equal(cameraShakeAmplitude(startedShake), CAMERA_SHAKE_EVENTS.takuyaHeavy.strength);
  const halfShake = advanceCameraShakeRuntime(startedShake, CAMERA_SHAKE_EVENTS.takuyaHeavy.seconds / 2);
  assertClose(cameraShakeAmplitude(halfShake), CAMERA_SHAKE_EVENTS.takuyaHeavy.strength / 2);
  assert.equal(cameraShakeAmplitude(advanceCameraShakeRuntime(halfShake, CAMERA_SHAKE_EVENTS.takuyaHeavy.seconds / 2)), 0);
  assert.equal(cameraShakeAmplitude(triggerCameraShake(createCameraShakeRuntime(), { strength: 0, seconds: .2 })), 0);
  const collapseAfterPod = triggerCameraShake(triggerCameraShake(createCameraShakeRuntime(), CAMERA_SHAKE_EVENTS.podLanding), CAMERA_SHAKE_EVENTS.enemyBaseCollapse);
  assert.equal(collapseAfterPod.duration, CAMERA_SHAKE_EVENTS.enemyBaseCollapse.seconds);
  assert.equal(collapseAfterPod.strength, CAMERA_SHAKE_EVENTS.enemyBaseCollapse.strength);
  const defeatAfterHeavy = triggerCameraShake(triggerCameraShake(createCameraShakeRuntime(), CAMERA_SHAKE_EVENTS.takuyaHeavy), CAMERA_SHAKE_EVENTS.takuyaDefeat);
  assert.equal(defeatAfterHeavy.duration, CAMERA_SHAKE_EVENTS.takuyaDefeat.seconds);
  assert.equal(defeatAfterHeavy.strength, CAMERA_SHAKE_EVENTS.takuyaDefeat.strength);

  assert.equal(keyboardInputGate({ running: true, paused: false, over: false, key: "1" }), "active");
  assert.equal(keyboardInputGate({ running: true, paused: true, over: false, key: "1" }), "ignore");
  assert.equal(keyboardInputGate({ running: true, paused: true, over: false, key: "p" }), "toggle-pause");
  assert.equal(keyboardInputGate({ running: true, paused: true, over: false, key: "Escape" }), "toggle-pause");
  assert.equal(keyboardInputGate({ running: true, paused: false, over: true, key: "1" }), "ignore");
  assert.equal(keyboardInputGate({ running: true, paused: false, over: false, key: "1", repeat: true }), "ignore");
  assert.equal(keyboardInputGate({ running: false, paused: false, over: false, key: "1" }), "ignore");
});

test("validates, damages, and releases the battlefield container without changing Crawler priority", async () => {
  const base = { running: true, paused: false, over: false, scrap: CONTAINER_DEF.cost, lane: 1, x: 440, objects: [], fighters: [], supports: [], nextId: 40 };
  assert.equal(CONTAINER_DEF.objectClearance, FIELD_OBJECT_CLEARANCE);
  assert.deepEqual(containerPlacementCheck(base), { ok: true, reason: "配置できます" });
  assert.equal(containerPlacementCheck({ ...base, running: false }).ok, false);
  assert.equal(containerPlacementCheck({ ...base, paused: true }).reason, "一時停止中は配置できません");
  assert.equal(containerPlacementCheck({ ...base, scrap: CONTAINER_DEF.cost - 1 }).reason, "スクラップが不足しています");
  assert.equal(containerPlacementCheck({ ...base, x: CONTAINER_DEF.minX - 1 }).reason, "配置可能範囲外です");
  assert.equal(containerPlacementCheck({ ...base, objects: [{ lane: 1, x: 500, y: LANE_Y[1], phase: "active" }] }).reason, "既存物資に近すぎます");
  assert.deepEqual(containerPlacementCheck({ ...base, objects: [
    { lane: 0, x: 300, y: LANE_Y[0], phase: "active" },
    { lane: 2, x: 600, y: LANE_Y[2], phase: "dropping" },
  ] }), { ok: true, reason: "配置できます" });
  assert.deepEqual(containerPlacementCheck({ ...base, objects: [{ lane: 1, x: 700, y: LANE_Y[1], phase: "active" }] }), { ok: true, reason: "配置できます" });
  assert.deepEqual(containerPlacementCheck({ ...base, fighters: [{ x: 450, y: LANE_Y[1], hp: 10 }] }), { ok: true, reason: "配置できます" });

  const placed = resolveContainerPlacement(base);
  assert.equal(placed.ok, true);
  assert.equal(placed.scrap, 0);
  assert.equal(placed.objects.length, 1);
  assert.equal(placed.objects[0].id, 40);
  assert.equal(placed.objects[0].phase, "dropping");
  assert.equal(placed.objects[0].landingTriggered, false);

  const landing = resolveContainerLanding({
    lane: 1, x: 440,
    fighters: [
      { id: 1, side: "zombie", x: 450, y: LANE_Y[1], hp: 100 },
      { id: 2, side: "human", x: 430, y: LANE_Y[1], hp: 100 },
      { id: 3, side: "zombie", x: 700, y: LANE_Y[1], hp: 100 },
    ],
  });
  assert.deepEqual(landing.hits, [
    { id: 1, side: "zombie", damage: CONTAINER_DEF.enemyLandingDamage },
    { id: 2, side: "human", damage: CONTAINER_DEF.allyLandingDamage },
  ]);
  assert.equal(landing.fighters[0].hp, 100 - CONTAINER_DEF.enemyLandingDamage);
  assert.equal(landing.fighters[1].hp, 100 - CONTAINER_DEF.allyLandingDamage);
  assert.equal(landing.fighters[2].hp, 100);
  assert.ok(CONTAINER_DEF.enemyLandingDamage > CONTAINER_DEF.allyLandingDamage);

  const invalid = resolveContainerPlacement({ ...base, x: CONTAINER_DEF.minX - 1 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.scrap, CONTAINER_DEF.cost);
  assert.equal(invalid.objects.length, 0);

  const activeSupport = { id: 7, kind: "medkit", lane: 1, x: 440, y: LANE_Y[1], life: 5 };
  const containerOnSupport = resolveContainerPlacement({ ...base, supports: [activeSupport] });
  assert.equal(containerOnSupport.ok, false);
  assert.equal(containerOnSupport.reason, "既存物資に近すぎます");
  assert.equal(containerOnSupport.scrap, CONTAINER_DEF.cost);
  assert.equal(containerOnSupport.objects.length, 0);

  const activeContainer = { ...placed.objects[0], phase: "active" };
  const supportOnContainer = resolveFieldSupportPlacement({
    running: true, paused: false, over: false, rage: 30, cost: 20, kind: "barrel", lane: 1, x: 440,
    supports: [], containers: [activeContainer],
  });
  assert.equal(supportOnContainer.ok, false);
  assert.equal(supportOnContainer.reason, "防護コンテナに近すぎます");
  assert.equal(supportOnContainer.rage, 30);

  assert.deepEqual(damageContainer(CONTAINER_DEF.maxHp, 35), { hp: CONTAINER_DEF.maxHp - 35, phase: "active" });
  assert.deepEqual(damageContainer(20, 35), { hp: 0, phase: "destroying" });
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 1, containerX: 440, containerLane: 1, phase: "active" }), true);
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 1, containerX: 440, containerLane: 1, phase: "impact" }), true);
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 0, containerX: 440, containerLane: 1, phase: "active" }), false);
  assert.equal(containerBlocksEnemy({ enemyX: 400, enemyLane: 1, containerX: 440, containerLane: 1, phase: "active" }), false);
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 1, containerX: 440, containerLane: 1, phase: "destroying" }), false);

  const rearContainer = { ...activeContainer, id: 41, x: 360 };
  const blocking = selectBlockingContainer({ enemyX: 600, enemyLane: 1, objects: [rearContainer, activeContainer] });
  assert.equal(blocking.id, activeContainer.id);

  const destroyed = applyContainerDamage({ ...activeContainer, hp: 20 }, 35);
  assert.equal(destroyed.hp, 0);
  assert.equal(destroyed.phase, "destroying");
  assert.equal(destroyed.blocksEnemies, false);
  assert.equal(destroyed.targetable, false);
  assert.equal(selectBlockingContainer({ enemyX: 600, enemyLane: 1, objects: [destroyed] }), undefined);
  assert.equal(advanceZombieX({ enemyX: 600, speed: 20, seconds: 1 }), 580);
  assert.equal(battleOutcome(0, 0), "lost");

  const normalHumanFloor = humanCombatMinX();
  const breachPursuitFloor = humanCombatMinX({ desiredX: 169, hasEnemyTarget: true });
  assert.ok(breachPursuitFloor < normalHumanFloor);
  assert.ok(breachPursuitFloor <= 169);

  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(game, /battlefieldObjects: BattlefieldObject\[\]/);
  assert.match(game, /targetObjectId: number \| null/);
  assert.match(game, /resolveBattlefieldSupplyPlacement\(\{/);
  assert.match(game, /requestAirstrike\(\{/);
  assert.match(game, /requestCrawlerBarrage\(\{/);
  assert.match(game, /placeBattlefieldSupply\(kind, lane, x\)/);
  assert.match(game, /if \(deployAirstrike\(lane, x\)\) chooseAction\(null\)/);
  assert.match(game, /const routeLane = f\.lane/);
  assert.match(game, /selectBlockingContainer\(\{/);
  assert.match(game, /physicalContact \?\? \(blockingSupply \? undefined/);
  assert.match(game, /chooseCommittedEnemyLane\(\{[\s\S]*hasTarget: Boolean\(target\)[\s\S]*hasObjectTarget: Boolean\(objectTarget\)[\s\S]*inContact: Boolean\(physicalContact\)/);
  assert.match(game, /advanceZombieX\(\{ enemyX: f\.x,[\s\S]*targetFloor: zombieTargetFloor \}\)/);
  assert.match(game, /const humanMinX = humanCombatMinX\(\{/);
  assert.ok((game.match(/Math\.max\(humanMinX,/g) ?? []).length >= 3);
  assert.doesNotMatch(game, /Math\.max\(MUSTER_X - 8,/);
  assert.match(game, /allyIntent\?\.reason !== "crawler-under-attack"[\s\S]*BARRICADE_X - f\.x/);
  assert.match(game, /objectTarget \? Math\.abs\(f\.x - objectTarget\.x\)/);
  assert.match(game, /applyBattlefieldSupplyDamage\(objectTarget, f\.damage\)/);
  assert.match(game, /resolveBattlefieldSupplyLanding\(\{/);
  assert.match(game, /resolveDrumDetonation\(\{/);
  assert.match(game, /advanceAreaEffects\(\{/);
  assert.match(game, /索敵マーク/);
  assert.match(game, /対・毒吐き/);
  assert.match(game, /前線保持/);
  assert.match(game, /フィニッシュ/);
  assert.match(game, /重装破砕/);
  assert.match(game, /value: "救護"/);
  assert.doesNotMatch(game, /effect: f\.kind as RoleEffect/);
  assert.match(game, /roleEffectForAction\(\{[\s\S]*targetAlreadyMarked: target\.marked > 0[\s\S]*holdingFrontline: f\.kind === "brute" && target\.targetId === f\.id/);
  assert.match(game, /effect: roleEffect \?\? undefined, emphasized, style: ranged \? "projectile" : "melee", weapon: f\.kind/);
  assert.match(game, /roleEffect === "brawler" \? "フィニッシュ"/);
  assert.match(game, /action: "structure"[\s\S]*if \(roleEffect\)[\s\S]*playCue\(`role-\$\{roleEffect\}` as SfxCueId\)/);
  assert.match(game, /action: "heal"[\s\S]*playCue\("role-medic"\)/);
  assert.doesNotMatch(game, /g\.areaEffects = capRenderArray/);
  assert.match(game, /g\.areaEffects = retainActiveAreaEffects\(areaStep\.areaEffects\)/);
  assert.match(game, /selectAreaEffectsForRender\(g\.areaEffects\)/);
  assert.match(game, /function drawAirstrikeObserver/);
  assert.match(game, /pose\.action === "radio"[\s\S]*pose\.action === "targeting"[\s\S]*pose\.action === "inbound" \|\| pose\.action === "impact"/);
  const enemyBaseDraw = game.slice(game.indexOf("function drawEnemyBase"), game.indexOf("function drawEmergencySupport"));
  assert.match(enemyBaseDraw, /enemyBaseVisualState\(\{ hp: g\.barricadeHp, elapsed: g\.enemyBaseCollapse \}\)/);
  assert.match(enemyBaseDraw, /ctx\.rect\(barrier\.drawX \+ 2, barrier\.drawY \+ 2, barrier\.width - 4, barrier\.height - 4\);[\s\S]*ctx\.clip\(\)/);
  assert.doesNotMatch(enemyBaseDraw, /fillRect\(-34, -54, 68, 108\)|strokeRect\(-34, -54, 68, 108\)/);
  assert.doesNotMatch(enemyBaseDraw, /fillRect\(-13, -15, 28, 31\)|strokeRect\(-13, -15, 28, 31\)/);
  assert.doesNotMatch(enemyBaseDraw, /LANE_Y/);
  assert.match(enemyBaseDraw, /const hitX = barrier\.attackX;[\s\S]*createRadialGradient\(hitX,[\s\S]*fillRect\(hitX - 55/);
  assert.match(enemyBaseDraw, /breached[\s\S]*感染拠点 破壊/);
  assert.match(game, /const enemyBaseDestroyed = g\.barricadeHp <= 0[\s\S]*g\.resultPresented = !enemyBaseDestroyed/);
  assert.match(game, /const outcome = g\.paused \? null : battleOutcomeFor\(g\.definition, g\)/);
  assert.match(game, /g\.resultPresented = !enemyBaseDestroyed/);
  assert.match(game, /advanceEnemyBaseCollapse\(\{ barricadeHp: g\.barricadeHp[\s\S]*setEnd\(\{ resultId: g\.resultId, stageId: g\.definition\.stageId, won: g\.won/);
  assert.match(game, /resolveStageResult\(campaignSave, \{[\s\S]*resultId: end\.resultId,[\s\S]*stageId: end\.stageId,[\s\S]*baseMaxHp: end\.baseMaxHp/);
  assert.match(game, /if \(!end \|\| finalizedEndRef\.current === end\) return;[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*if \(finalizedEndRef\.current === end\) return;[\s\S]*finalizedEndRef\.current = end/);
  assert.match(game, /setCampaignSave\(resolved\.save as CampaignSave\)[\s\S]*setScreen\("result"\)/);
  assert.match(game, /const combatLocked = !!end \|\| hud\.baseHp <= 0 \|\| hud\.barricadeHp <= 0/);
  assert.match(game, /const chooseActionWithCue[\s\S]*if \(!g\.running \|\| g\.paused \|\| g\.over\) return/);
  assert.match(game, /function prepareRolesQa/);
  assert.match(game, /prepareQaMode\(fresh, qaMode\)/);
  assert.match(game, /resolveLocalQaMode\(window\.location\.hostname, window\.location\.search\)/);
  assert.match(game, /advanceZombieX\(\{/);
  assert.match(game, /supplyDefs\[objectTarget\.kind\]\.name}破壊/);
  assert.match(game, /drawPlacementIndicator/);
  assert.match(game, /supplyDefs\[selectedSupply\]\.cost/);
});

test("models state-linked production radio with rotating variants, QA isolation, expiry, cooldowns, and priority", () => {
  const requiredTriggers = Object.values(BATTLE_BARK_TRIGGER_IDS);
  assert.ok(APPROVED_BATTLE_BARK_LINES.length >= 50);
  assert.equal(new Set(APPROVED_BATTLE_BARK_LINES.map(({ id }) => id)).size, APPROVED_BATTLE_BARK_LINES.length);
  for (const trigger of requiredTriggers) {
    const lines = APPROVED_BATTLE_BARK_LINES.filter((line) => line.trigger === trigger);
    assert.ok(lines.length >= 2, `${trigger} has nonrepeating variants`);
  }
  for (const speakerKind of ["brawler", "scout", "ranger", "medic", "brute", "gunner"]) {
    assert.ok(APPROVED_BATTLE_BARK_LINES.filter((line) => line.trigger === "role-cue" && line.speakerKind === speakerKind).length >= 3);
  }
  assert.ok(APPROVED_BATTLE_BARK_LINES.every((line) => line.probability === 1 && line.weight === 1 && line.tone === "radio"));
  assert.ok(APPROVED_BATTLE_BARK_LINES.every((line) => Array.from(line.text).length <= 24));
  assert.ok(APPROVED_BATTLE_BARK_LINES.every((line) => !line.text.includes("QA //")));
  const infectionWarnings = APPROVED_BATTLE_BARK_LINES.filter(({ trigger }) => trigger === "infection-warning");
  assert.ok(infectionWarnings.every(({ text }) => !/[0-9０-９]|秒|分|カウント|タイマー|進捗/.test(text)));
  assert.equal(BATTLE_BARK_CONFIG.maxVisible, 2);
  assert.equal(LOCAL_QA_BATTLE_BARK_LINES.length, 13);
  assert.ok(LOCAL_QA_BATTLE_BARK_LINES.every((line) => line.probability === 1 && line.weight === 1 && line.tone === "qa"));
  assert.equal(battleBarkPassesProbability(.5, .49), true);
  assert.equal(battleBarkPassesProbability(.5, .5), false);
  const initial = createBattleBarkRuntime();
  const normal = queueBattleBark({ runtime: initial, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 1 } });
  assert.equal(normal.shown, true);
  assert.equal(normal.bark.speaker, "橘 迅");
  assert.equal(normal.bark.speakerKind, "scout");
  const normalDuplicate = queueBattleBark({ runtime: normal.runtime, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 1 } });
  assert.equal(normalDuplicate.reason, "duplicate-active");
  const rotated = queueBattleBark({
    runtime: advanceBattleBarkRuntime(normal.runtime, BATTLE_BARK_CONFIG.speakerCooldown),
    event: { trigger: "role-cue", speakerKind: "scout", speakerId: 1 },
  });
  assert.equal(rotated.shown, true);
  assert.notEqual(rotated.bark.lineId, normal.bark.lineId);

  const normalCritical = queueBattleBark({ runtime: initial, event: { trigger: "crawler-critical", speakerKind: "crawler", speakerId: "crawler" } });
  assert.equal(normalCritical.shown, true);
  assert.equal(normalCritical.bark.speaker, "水城 奈々");
  assert.equal(normalCritical.bark.speakerKind, "guide");

  const scout = queueBattleBark({ runtime: initial, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 1 }, qa: true });
  assert.equal(scout.shown, true);
  assert.equal(scout.bark.text, "QA // SCOUT ROLE CUE");
  const duplicate = queueBattleBark({ runtime: scout.runtime, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 1 }, qa: true });
  assert.equal(duplicate.reason, "duplicate-active");
  const globalBlocked = queueBattleBark({ runtime: scout.runtime, event: { trigger: "role-cue", speakerKind: "ranger", speakerId: 2 }, qa: true });
  assert.equal(globalBlocked.reason, "global-cooldown");
  assert.deepEqual(globalBlocked.runtime, scout.runtime);

  const afterActive = advanceBattleBarkRuntime(scout.runtime, 2.3);
  assert.equal(afterActive.active.length, 0);
  const independentSpeaker = queueBattleBark({ runtime: afterActive, event: { trigger: "role-cue", speakerKind: "ranger", speakerId: 1 }, qa: true });
  assert.equal(independentSpeaker.shown, true);
  const lineBlocked = queueBattleBark({ runtime: afterActive, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 99 }, qa: true });
  assert.equal(lineBlocked.reason, "line-cooldown");

  const afterGlobal = advanceBattleBarkRuntime(scout.runtime, BATTLE_BARK_CONFIG.globalCooldown);
  const ranger = queueBattleBark({ runtime: afterGlobal, event: { trigger: "role-cue", speakerKind: "babayaga", speakerId: 2 }, qa: true });
  assert.equal(ranger.runtime.active.length, 2);
  const critical = queueBattleBark({ runtime: ranger.runtime, event: { trigger: "crawler-critical", speakerKind: "crawler", speakerId: "crawler" }, qa: true });
  assert.equal(critical.shown, true);
  assert.equal(critical.runtime.active.length, 2);
  assert.ok(critical.runtime.active.some((bark) => bark.lineId === "qa-crawler-critical"));
  assert.ok(critical.runtime.active.every((bark) => bark.lineId !== "qa-role-scout"));
  const majorPair = queueBattleBark({ runtime: critical.runtime, event: { trigger: "takuya-down", speakerKind: "crawler", speakerId: "tactical" }, qa: true });
  assert.equal(majorPair.reason, "speaker-cooldown");
  const afterMajorGlobal = advanceBattleBarkRuntime(majorPair.runtime, BATTLE_BARK_CONFIG.globalCooldown);
  const lowerPriority = queueBattleBark({ runtime: afterMajorGlobal, event: { trigger: "role-cue", speakerKind: "medic", speakerId: 6 }, qa: true });
  assert.equal(lowerPriority.reason, "lower-priority");
  assert.deepEqual(lowerPriority.runtime, afterMajorGlobal);
  assert.equal(advanceBattleBarkRuntime(critical.runtime, 10).active.length, 0);
});

test("exposes localhost-only QA routes and wires deterministic battle and lifecycle scenarios", async () => {
  assert.deepEqual(LOCAL_QA_MODES, ["endgame", "roles", "supplies", "airstrike", "crawler", "loadout", "dialogue", "stress", "lifecycle", "barks", "sprites"]);
  for (const mode of LOCAL_QA_MODES) {
    assert.equal(resolveLocalQaMode("localhost", `?qa=${mode}`), mode);
    assert.equal(resolveLocalQaMode("127.0.0.1", `?qa=${mode}`), mode);
  }
  assert.equal(resolveLocalQaMode("ashfall.example", "?qa=endgame"), null);
  assert.equal(resolveLocalQaMode("localhost.example", "?qa=roles"), null);
  assert.equal(resolveLocalQaMode("localhost", "?qa=unknown"), null);
  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(game, /qaMode === "roles" \|\| qaMode === "dialogue"\) prepareRolesQa\(g\)/);
  assert.match(game, /qaMode === "endgame"\) prepareEndgameQa\(g\)/);
  assert.match(game, /qaMode === "supplies"\) prepareSuppliesQa\(g\)/);
  assert.match(game, /qaMode === "airstrike"\) prepareAirstrikeQa\(g\)/);
  assert.match(game, /qaMode === "crawler"\) prepareCrawlerQa\(g\)/);
  assert.match(game, /qaMode === "stress"\) prepareStressQa\(g\)/);
  assert.match(game, /qaMode === "lifecycle"\) prepareLifecycleQa\(g\)/);
  assert.match(game, /function prepareLifecycleQa[\s\S]*advanceEnemyLifecycle[\s\S]*advanceAllyLifecycle[\s\S]*QA 表現確認/);
  assert.match(game, /if \(qaMode === "dialogue"\)[\s\S]*emitBattleBark\(g, "role-cue"/);
  assert.match(game, /placeQaSupply\(g, "pod", 0, 430\)/);
  assert.match(game, /placeQaSupply\(g, "drum", 1, 535\)/);
  assert.match(game, /placeQaSupply\(g, "medical", 2, 640\)/);
  assert.match(game, /g\.supportGauge = SUPPORT_GAUGE_MAX/);
  assert.match(game, /for \(const lane of \[0, 1, 2\] as Lane\[\]\)[\s\S]*index < 3/);
  assert.match(game, /g\.crawlerAbility = createCrawlerAbilityRuntime\(1\)/);
  assert.match(game, /function prepareStressQa[\s\S]*index < 5[\s\S]*index < 8[\s\S]*index < 18/);
  assert.match(game, /g\.supportGauge = 0/);
  assert.match(game, /takuya\.hp = 420/);
  assert.match(game, /takuya\.abilityCooldown = 0/);
  assert.match(game, /g\.barricadeHp = 760/);
  assert.match(game, /g\.phase = 3/);
  assert.match(game, /g\.wave = 8/);
  for (const kind of ["scout", "ranger", "brute", "brawler", "gunner", "medic"]) assert.match(game, new RegExp(`\\["${kind}",`));
  assert.match(game, /aria-live="polite" aria-label="戦闘台詞"/);
  assert.match(css, /\.battle-barks \{ position:absolute; z-index:16; top:32%; left:calc\(2% \+ var\(--app-viewport-safe-left\)\); width:min\(270px,29%\);/);
  assert.match(css, /\.start-screen,\.pause-screen,\.end-screen \{ position:absolute; z-index:15;/);
  assert.match(css, /\.game-frame:has\(\.start-screen\) \.qa-badge \{ top:4%; left:50%; right:auto; bottom:auto; transform:translateX\(-100%\); \}/);
  assert.match(css, /\.game-frame:has\(\.pause-screen\) \.battle-barks \{ display:none; \}/);
  assert.match(css, /\.game-frame:has\(\.end-screen\) \.battle-barks \{ top:4%; left:calc\(2% \+ var\(--app-viewport-safe-left\)\); \}/);
  assert.match(css, /\.game-frame:has\(\.pause-screen\) \.qa-badge,\.game-frame:has\(\.end-screen\) \.qa-badge/);
  assert.match(css, /\.pause-screen button,\.end-screen button \{ min-height:44px; \}/);
  assert.match(css, /\.unit-cards \{ gap:2px; scrollbar-width:none; \}\.unit-cards::-webkit-scrollbar \{ display:none; \}\.unit-card \{[^}]*flex-basis:78px; min-width:78px; height:100%; min-height:44px; \}/);
  assert.match(css, /\.bottom-hud \{ height:60px; min-height:60px; max-height:60px;/);
  assert.match(css, /\.combat-deck \{ display:grid; grid-template-columns:minmax\(300px,1\.35fr\) minmax\(260px,1fr\); grid-template-rows:minmax\(0,1fr\)/);
  assert.match(css, /\.support-btn small \{ display:none; \}/);
  assert.match(css, /\.card-copy small \{ display:none; \}/);
  assert.match(css, /\.placement-hint \{ right:calc\(7px \+ var\(--app-viewport-safe-right\)\); bottom:calc\(90px \+ var\(--app-viewport-safe-bottom\)\);[^}]*height:44px; min-height:44px;/);
  assert.match(css, /\.placement-cancel \{ min-width:58px; height:44px; min-height:44px; margin-block:-1px;/);
  assert.match(css, /\.crawler-alert \{ position:absolute; z-index:17;/);
  assert.match(css, /\.battle-barks \{ top:calc\(104px \+ var\(--app-viewport-safe-top\)\);/);
  assert.match(css, /\.cooldown-mask small \{ display:block;[^}]*font-size:6px;/);
  assert.match(css, /\.qa-badge \{ bottom:34%; \}/);
  assert.match(game, /const bossPhase = bossPhaseForHp\(hud\.bossHp, hud\.bossMax\)/);
  assert.match(game, /TAKUYA \/\/ \{bossPhase\.label\}[\s\S]*\{Math\.ceil\(hud\.bossHp\)\} \/ \{hud\.bossMax\}/);
  assert.match(css, /\.boss-hud \{[^}]*top:18%; right:calc\(2% \+ var\(--app-viewport-safe-right\)\); width:23%/);
  assert.match(css, /\.boss-hud \{ top:78px; right:calc\(8px \+ var\(--app-viewport-safe-right\)\); width:24%/);
});

test("keeps BGM and production SFX lifecycle bounded across pause, mute, retry, and map return", async () => {
  const [game, screens] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(game, /type SfxCategory = "ui" \| "combat" \| "ambient" \| "major"/);
  assert.match(game, /const SFX_CUES = \{/);
  assert.match(game, /"airstrike-impact"[\s\S]*priority: 100[\s\S]*duck:/);
  assert.match(game, /"crawler-barrage"[\s\S]*priority: 95[\s\S]*duck:/);
  assert.match(game, /"takuya-slam"[\s\S]*priority: 95[\s\S]*duck:/);
  assert.match(game, /const fallback = \(\) => productionMixer\.playTestTone\(/);
  assert.match(game, /maxInstances: cue\.category === "major" \? 2 : 5/);
  assert.match(game, /duck: cue\.duck \?/);
  assert.match(game, /onLoadFailure: guardedFallback/);
  assert.match(game, /master\.connect\(ensureSfxRuntime\(audio\)\.buses\.ui\)/);
  assert.match(game, /const stopSfx = useCallback/);
  assert.match(game, /window\.clearTimeout\(startCueTimerRef\.current\)/);
  assert.match(game, /window\.clearInterval\(music\.timer\)/);
  assert.match(game, /runtime\.active\.clear\(\)/);
  assert.match(game, /runtime\.lastPlayedAt\.clear\(\)/);
  assert.match(game, /for \(const bus of Object\.values\(runtime\.buses\)\)/);
  assert.match(game, /productionMixer\.stopAll\(\{ category, fadeMs: 35 \}\)/);
  assert.match(game, /sfxMutedRef\.current = next/);
  assert.match(game, /if \(g\.paused\) \{[\s\S]*g\.battleBarks = createBattleBarkRuntime\(\)[\s\S]*stopMusic\(\); stopJingle\(\); stopSfx\(\);/);
  assert.match(game, /stopMusic\(\); stopSfx\(\);[\s\S]*playCue\(g\.won \? "victory" : "defeat"\);[\s\S]*playEndJingle\(g\.won\)/);
  assert.match(game, /const disposeBattleRuntime = useCallback\(\(\) => \{[\s\S]*stopMusic\(\);[\s\S]*stopJingle\(\);[\s\S]*stopSfx\(\)/);
  const returnToMapBlock = game.slice(game.indexOf("const returnToMap"), game.indexOf("const handleEventComplete"));
  assert.notEqual(returnToMapBlock, "");
  assert.match(returnToMapBlock, /disposeBattleRuntime\(\);[\s\S]*setScreen\("map"\)/);
  assert.match(game, /data-muted=\{bgmMuted\}/);
  assert.match(game, /data-muted=\{sfxMuted\}/);
  assert.match(screens, /同じ編成で再戦/);
  assert.match(screens, /result\.won \? "作戦後の通信へ" : "エリアマップへ"/);
  assert.match(screens, /← 地図へ/);
  for (const cue of [
    "ui-confirm", "ui-cancel", "pod-descent", "pod-hit", "pod-destroy", "burn-start", "medical-heal",
    "airstrike-targeting", "airstrike-inbound", "airstrike-return", "melee-hit", "role-scout", "role-ranger",
    "role-brute", "role-brawler", "role-gunner", "role-medic", "takuya-down", "base-damaged", "base-critical",
    "base-collapse", "victory", "defeat", "retry",
  ]) assert.match(game, new RegExp(`(?:"${cue}"|${cue}): \\{[^}]*cooldown: \\.?\\d+`));
  assert.match(game, /if \(kind === "pod"\) playCue\("pod-descent"\)/);
  assert.match(game, /airstrikeStep\.events\.includes\("targeting"\)[\s\S]*playCue\("airstrike-targeting"\)/);
  assert.match(game, /areaStep\.changes\.some\(\(change\) => change\.kind === "healing"\)[\s\S]*playCue\("medical-heal"\)/);
  assert.match(game, /if \(roleEffect && !\["crazy-king", "kumaverson", "babayaga"\]\.includes\(f\.kind\)\) playCue\(`role-\$\{roleEffect\}` as SfxCueId\)/);
  const deployAudioStart = game.indexOf("if (g.deployQueue.length");
  const deployAudio = game.slice(deployAudioStart, game.indexOf("const crawlerStep =", deployAudioStart));
  assert.match(deployAudio, /playProductionCue\("support-pod-deploy", MUSTER_X,[\s\S]*volume: kind === "brute" \? \.42 : \.32[\s\S]*maxInstances: 1/);
  assert.doesNotMatch(deployAudio, /weaponCueForUnit\(kind\)/);
  const newcomerAudio = game.slice(game.indexOf("const weaponEvent ="), game.indexOf('if (f.kind === "scout"'));
  assert.match(newcomerAudio, /const contactAudioX = f\.kind === "crazy-king" \|\| f\.kind === "kumaverson" \? \(f\.x \+ target\.x\) \/ 2 : f\.x/);
  assert.match(newcomerAudio, /volume: f\.kind === "crazy-king" \? \.66 : f\.kind === "kumaverson" \? \.52 : undefined/);
  assert.match(newcomerAudio, /f\.kind === "crazy-king"[\s\S]*"fleshHit"[\s\S]*maxInstances: 1/);
  assert.doesNotMatch(newcomerAudio, /unitAudioCueFor\(f\.kind, "weapon", "hardHit"\)/);
  const chainsawLoopStarts = [...game.matchAll(/playProductionCue\(BATTLE_AUDIO_LOOP_CONTRACTS\.crazyKingChainsaw\.cueId, W \/ 2,/g)];
  assert.equal(chainsawLoopStarts.length, 2);
  assert.match(game, /fighter\.kind === "takuya"[\s\S]*playCue\("takuya-down"\)/);
  assert.match(game, /const retrying = gameRef\.current\.over[\s\S]*if \(retrying\) playCue\("retry"\)/);
  assert.match(game, /keyboardInputGate\(\{ running: g\.running, paused: g\.paused, over: g\.over, key: event\.key, repeat: event\.repeat \}\)/);
  assert.match(game, /if \(inputGate === "ignore"\) return/);
  assert.doesNotMatch(game, /if \(f\.kind === "takuya"\) g\.shake/);
  assert.match(game, /CAMERA_SHAKE_EVENTS\.takuyaEntrance/);
  assert.match(game, /CAMERA_SHAKE_EVENTS\.takuyaHeavy/);
  assert.match(game, /CAMERA_SHAKE_EVENTS\.takuyaDefeat/);
  assert.doesNotMatch(game, /\btone\(/);
  assert.doesNotMatch(game, /["'][^"']+\.(?:mp3|ogg|wav|m4a)["']/i);
});

test("queues each wave into staggered multi-height enemy gate entries", () => {
  const wave = MISSION_EVENTS.find(({ wave: value }) => value === 8);
  const initial = createEnemySpawnRuntime();
  const queued = enqueueEnemyWave(initial, wave);

  assert.equal(initial.pending.length, 0);
  assert.equal(queued.pending.length, wave.units.length);
  assert.deepEqual(queued.pending.map(({ kind, lane }) => [kind, lane]), wave.units);
  assert.equal(queued.pending[0].delay, 0);
  assert.ok(queued.pending.slice(1).every(({ delay }) => delay > 0));
  assert.equal(new Set(queued.pending.map(({ x, y }) => `${x}:${y}`)).size, wave.units.length);
  assert.ok(queued.pending.every(({ x }) => ENEMY_GATE_SPAWN.interiorX.includes(x)));
  assert.ok(queued.pending.every(({ lane, y }) => Math.abs(y - LANE_Y[lane]) <= 17));
  assert.ok(enemySpawnInterval({ kind: "crusher", lane: 0, order: 1 }) > enemySpawnInterval({ kind: "runner", lane: 0, order: 1 }));
  assert.ok(enemySpawnInterval({ kind: "takuya", lane: 1, order: 2 }) > enemySpawnInterval({ kind: "crusher", lane: 1, order: 2 }));

  const upperA = enemyGateSpawnPosition({ kind: "walker", lane: 0, order: 0, wave: 3 });
  const upperB = enemyGateSpawnPosition({ kind: "runner", lane: 0, order: 1, wave: 3 });
  assert.notDeepEqual([upperA.x, upperA.y], [upperB.x, upperB.y]);

  const firstFrame = advanceEnemySpawnRuntime(queued, 1 / 60);
  assert.equal(firstFrame.spawned.length, 1);
  assert.equal(firstFrame.runtime.pending.length, wave.units.length - 1);
  const sameFrame = advanceEnemySpawnRuntime(firstFrame.runtime, 0);
  assert.equal(sameFrame.spawned.length, 0);
  assert.deepEqual(sameFrame.runtime, firstFrame.runtime);

  const paused = advanceEnemySpawnRuntime(firstFrame.runtime, 30, true);
  assert.equal(paused.spawned.length, 0);
  assert.deepEqual(paused.runtime, firstFrame.runtime);

  const spawned = [...firstFrame.spawned];
  let runtime = firstFrame.runtime;
  while (runtime.pending.length) {
    const step = advanceEnemySpawnRuntime(runtime, 30);
    assert.ok(step.spawned.length <= 1);
    spawned.push(...step.spawned);
    runtime = step.runtime;
  }
  assert.equal(spawned.length, wave.units.length);
  assert.equal(new Set(spawned.map(({ entryId }) => entryId)).size, wave.units.length);
  assert.deepEqual(spawned.map(({ kind, lane }) => [kind, lane]), wave.units);
  assert.deepEqual(createEnemySpawnRuntime(), { pending: [], cooldown: 0, nextEntryId: 1 });
});

test("keeps gate-entering enemies immune until combat-ready", () => {
  const hiddenEnemy = { id: 91, side: "zombie", kind: "walker", lane: 1, x: 520, y: LANE_Y[1], hp: 100, maxHp: 100, combatReady: false };
  const readyEnemy = { ...hiddenEnemy, id: 92, combatReady: true };
  const airstrike = resolveAirstrikeImpact({
    runtime: { ...createEmergencySupportRuntime(), phase: "impact", targetX: 520, targetLane: 1, impactTriggered: false },
    fighters: [hiddenEnemy, readyEnemy],
  });
  assert.equal(airstrike.fighters[0].hp, 100);
  assert.equal(airstrike.fighters[1].hp, 0);
  assert.deepEqual(airstrike.hits.map(({ id }) => id), [92]);

  const barrage = resolveCrawlerBarrage({
    runtime: { ...createCrawlerAbilityRuntime(1), phase: "firing", damageTriggered: false },
    fighters: [hiddenEnemy, readyEnemy],
  });
  assert.equal(barrage.fighters[0].hp, 100);
  assert.ok(barrage.fighters[1].hp < 100);

  const landing = resolveBattlefieldSupplyLanding({
    supply: {
      id: 70, kind: "pod", lane: 1, x: 520, y: LANE_Y[1], phase: "dropping", phaseTime: 0,
      hp: 260, maxHp: 260, blocksEnemies: false, targetable: false, landingTriggered: false, readyToLand: true,
    },
    fighters: [hiddenEnemy, readyEnemy],
  });
  assert.equal(landing.fighters[0].hp, 100);
  assert.ok(landing.fighters[1].hp < 100);

  const burning = advanceAreaEffects({
    areaEffects: [{ id: 3, kind: "burn", sourceSupplyId: 70, lane: 1, x: 520, y: LANE_Y[1], radius: 80, amountPerSecond: 15, remaining: 2, phase: "active", slowMultiplier: .8 }],
    fighters: [hiddenEnemy, readyEnemy],
    seconds: 1,
  });
  assert.equal(burning.fighters[0].hp, 100);
  assert.equal(burning.fighters[1].hp, 85);
});

test("integrates the enemy gate queue without changing direct QA or turned placement", async () => {
  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(game, /enemySpawn: createEnemySpawnRuntime\(\)/);
  assert.match(game, /g\.enemySpawn = \(enqueueEnemyWave as unknown as \(runtime: EnemySpawnRuntime, input: \{ units: \[string, Lane\]\[\]; wave: number \}\) => EnemySpawnRuntime\)\(g\.enemySpawn, \{ units: mission\.units, wave: mission\.wave \}\)/);
  assert.doesNotMatch(game, /mission\.units\.forEach\(\(\[kind, lane\]/);
  assert.match(game, /advanceEnemySpawnRuntime\(g\.enemySpawn, dt, g\.paused\)/);
  assert.match(game, /if \(f\.gateEntering\)[\s\S]*f\.combatReady = true;[\s\S]*continue;/);
  assert.match(game, /fighterById = new Map\(g\.fighters\.filter\(\(fighter\) => fighter\.hp > 0 && fighter\.combatReady\)/);
  assert.match(game, /enemy\.side === "zombie" && enemy\.hp > 0 && enemy\.combatReady/);
  assert.match(game, /other\.hp <= 0 \|\| !other\.combatReady/);
  assert.match(game, /kind !== "turned" && gateEntry !== null/);
  assert.match(game, /combatReady: true, gateEntering: false/);
  assert.match(game, /ctx\.rect\(0, 0, ENEMY_GATE_SPAWN\.revealX, H\);[\s\S]*ctx\.clip\(\)/);
  assert.match(game, /includesTakuya[\s\S]*playCue\(includesTakuya \? "boss-warning" : "wave-contact"\)[\s\S]*CAMERA_SHAKE_EVENTS\.takuyaEntrance/);
  assert.match(game, /bossActiveOrIncoming[\s\S]*g\.enemySpawn\.pending\.some\(\(entry\) => entry\.kind === "takuya"\)[\s\S]*syncMusicMode\(bossActiveOrIncoming \? "boss"/);
});

test("integrates attack identity, corpse phases, infection, cremation, and generic turning into the battle loop", async () => {
  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");

  assert.match(game, /supportCohesion as unknown as[\s\S]*needsRegroup[\s\S]*f\.targetId = null;[\s\S]*continue;/);
  assert.match(game, /const assignedPeers = livingAllies\.filter[\s\S]*assignedPeers\.length > 1[\s\S]*allies: assignedPeers/);
  assert.doesNotMatch(game, /assignedPeers\.length > 1 \? assignedPeers : livingAllies/);
  assert.match(game, /createAttackTransaction as unknown as[\s\S]*candidates: g\.fighters\.filter\(\(candidate\) => candidate\.side !== f\.side && candidate\.hp > 0 && candidate\.combatReady\)[\s\S]*f\.targetId = transaction\?\.targetId/);
  assert.match(game, /fighter\.side === "zombie"[\s\S]*beginEnemyDeath\(createEnemyLifecycle[\s\S]*beginAllyDeath\(createAllyLifecycle/);
  assert.doesNotMatch(game, /reviveIn/);
  assert.match(game, /igniteAllyCorpsesInFire as unknown as[\s\S]*fireAreas: g\.areaEffects[\s\S]*playCue\("burn-start"\)/);
  assert.match(game, /advanceEnemyLifecycle\(corpse, dt, \{ offscreen: corpse\.x < -80 \|\| corpse\.x > W \+ 80 \}\)/);
  assert.match(game, /advanceAllyLifecycle\(corpse, dt\)[\s\S]*next\.state === "generic-zombie"[\s\S]*createGenericZombieSpawn\(next\)/);
  assert.match(game, /kind: "turned"[\s\S]*combatReady: true, gateEntering: false/);
  assert.doesNotMatch(game, /INFECTION CREMATED|SURVIVOR TURNED|感染\s*\d/);
  const corpseDraw = game.slice(game.indexOf("for (const corpse of g.corpses)"), game.indexOf("const renderables = ["));
  assert.match(corpseDraw, /allyCorpseVisualCue\(corpse, g\.time\)/);
  assert.match(corpseDraw, /fitSpriteBattleDisplaySize\(corpse\.kind, frame, spriteDisplaySize\(corpse\.kind\)\)/);
  assert.match(corpseDraw, /const authoredDeathPose = frame\.derivedFrom !== "hit"/);
  assert.match(corpseDraw, /const fallAngle = authoredDeathPose \? 0/);
  assert.match(corpseDraw, /eyeGlint[\s\S]*smokePuffs[\s\S]*flameTongues[\s\S]*corpse\.state === "ash"/);
  assert.doesNotMatch(corpseDraw, /infectionRemaining|fillText|strokeRect|setLineDash/i);
  assert.match(game, /enforceEnemyCorpseCaps\(nextCorpses\.filter\(\(corpse\) => corpse\.side === "zombie"\)\)/);
});

test("defines an ordered mission timeline after the five-second preparation window", () => {
  const eventTimes = MISSION_EVENTS.map(({ at }) => at);
  assert.deepEqual(eventTimes, [5, 17, 35, 52, 70, 89, 108, 125, 131, 152, 174, 201]);
  assert.equal(new Set(eventTimes).size, MISSION_EVENTS.length);
  assert.equal(new Set(MISSION_EVENTS.map(({ at, label }) => `${at}:${label}`)).size, MISSION_EVENTS.length);
  assert.ok(eventTimes.every((at, index) => index === 0 || at > eventTimes[index - 1]));
  assert.ok(MISSION_EVENTS.every(({ units }) => units.every(([, lane]) => Number.isInteger(lane) && lane >= 0 && lane < 3)));
  assert.deepEqual(MISSION_EVENTS[0].units, [["walker", 0], ["walker", 1], ["walker", 2]]);

  const takuyaEvents = MISSION_EVENTS.filter(({ units }) => units.some(([kind]) => kind === "takuya"));
  assert.equal(takuyaEvents.length, 1);
  assert.equal(takuyaEvents[0].at, 131);
  assert.equal(takuyaEvents[0].wave, 8);
  assert.deepEqual(takuyaEvents[0].units.find(([kind]) => kind === "takuya"), ["takuya", 1]);

  const warning = MISSION_EVENTS.find(({ at }) => at === 125);
  assert.deepEqual(warning?.units, []);
  const enrage = MISSION_EVENTS.find(({ at }) => at === 174);
  assert.equal(enrage?.bossOnly, true);
  assert.equal(MISSION_EVENTS.at(-1)?.label, "最終機会 — 感染拠点を破壊");
});
