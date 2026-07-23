import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "./campaign.js";
import { enemySpawnClassFor } from "./content/enemyCatalog.js";
import { UNIT_CONTENT, UNIT_CONTENT_BY_ID } from "./content/unitCatalog.js";

export const COMMAND_MAX = 150;
export const COMMAND_INITIAL = 70;
export const COMMAND_REGEN = 3.5;
export const SUPPORT_GAUGE_MAX = 100;
// Compatibility aliases keep the current UI operational while the integration
// commit moves player-facing wording from rage to support gauge.
export const RAGE_MAX = SUPPORT_GAUGE_MAX;
export const BARRICADE_MAX_HP = 1000;
export const ENEMY_BASE_COLLAPSE_SECONDS = 1.05;
export const PREP_SECONDS = 5;
export const FIELD_OBJECT_CLEARANCE = 72;
export const CONVOY_CAPACITY = 24;
const INCOMPLETE_CONVOY_PROGRESS = 1 - Number.EPSILON;

/**
 * Advances the Sawara evacuation as durable gameplay state. Progress depends
 * on deployed escort strength and Crawler condition; elapsed battle time is
 * only the integration step, not the source of truth.
 */
export function advanceConvoyEvacuation({
  progress = 0,
  civiliansEvacuated = 0,
  dt = 0,
  humanCount = 0,
  baseHp = 0,
  baseMaxHp = 1,
  missionComplete = false,
} = {}) {
  const current = Math.max(0, Math.min(1, Number(progress) || 0));
  const step = Math.max(0, Number(dt) || 0);
  const escortReadiness = Math.max(0, Math.min(1, (Number(humanCount) || 0) / 4));
  const baseSafety = Math.max(0, Math.min(1, (Number(baseHp) || 0) / Math.max(1, Number(baseMaxHp) || 1)));
  const operationalRate = ((0.45 + escortReadiness * 0.55) * (0.7 + baseSafety * 0.3)) / 150;
  const incompleteProgress = Math.min(current, INCOMPLETE_CONVOY_PROGRESS);
  const nextProgress = missionComplete
    ? 1
    : Math.max(incompleteProgress, Math.min(INCOMPLETE_CONVOY_PROGRESS, incompleteProgress + step * operationalRate));
  return Object.freeze({
    progress: nextProgress,
    civiliansEvacuated: Math.max(
      Math.max(0, Math.trunc(Number(civiliansEvacuated) || 0)),
      Math.min(CONVOY_CAPACITY, Math.floor(nextProgress * CONVOY_CAPACITY)),
    ),
  });
}

/**
 * @typedef {{
 *   id: number,
 *   side: "human" | "zombie",
 *   kind: string,
 *   lane: number,
 *   x: number,
 *   y: number,
 *   hp: number,
 *   maxHp: number,
 *   boss?: boolean,
 *   burning?: boolean,
 *   slowMultiplier?: number,
 * }} RuleFighter
 * @typedef {{
 *   id: number,
 *   kind: string,
 *   lane: number,
 *   x: number,
 *   y: number,
 *   phase: string,
 *   phaseTime: number,
 *   hp: number,
 *   maxHp: number,
 *   blocksEnemies: boolean,
 *   targetable: boolean,
 *   landingTriggered?: boolean,
 *   detonationTriggered?: boolean,
 *   readyToLand?: boolean,
 *   remaining?: number | null,
 *   life?: number,
 *   hitFlash?: number,
 * }} RuleSupply
 * @typedef {{
 *   id: number,
 *   kind: "burn" | "healing",
 *   sourceSupplyId: number,
 *   lane: number,
 *   x: number,
 *   y: number,
 *   radius: number,
 *   amountPerSecond: number,
 *   remaining: number,
 *   phase: "active" | "expired",
 *   slowMultiplier?: number,
 * }} RuleAreaEffect
 * @typedef {{minX: number, maxX: number, minY?: number, maxY?: number, lane?: number}} ForbiddenZone
 */

// Three invisible routing bands follow the open roadway bands in battlefield-v4.
export const LANE_Y = [212, 282, 352];
// In Safari's reduced-height landscape viewport the cover-scaled world is
// cropped vertically. These compact centers keep the top route below the HUD
// while leaving the low route tappable above the combat deck.
export const MOBILE_LANDSCAPE_LANE_Y = Object.freeze([240, 285, 325]);
export const LANE_NAMES = ["TOP", "MID", "LOW"];
export const GROUND_EFFECT_VERTICAL_RATIO = .34;

export function laneCentersForViewport(width, height) {
  const compactLandscape = Number.isFinite(width) && Number.isFinite(height)
    && width > height
    && height <= 430
    && width / Math.max(1, height) > 16 / 9;
  return compactLandscape ? MOBILE_LANDSCAPE_LANE_Y : LANE_Y;
}

/**
 * Maps a pointer in the rendered, cover-scaled canvas back into the fixed
 * 960x540 battle world. Keeping this calculation pure makes safe-area and
 * rotation regressions testable without a browser event object.
 */
export function canvasPointerToWorld({
  clientX,
  clientY,
  rect,
  transform,
  worldWidth = 960,
  worldHeight = 540,
} = {}) {
  const left = Number.isFinite(rect?.left) ? rect.left : 0;
  const top = Number.isFinite(rect?.top) ? rect.top : 0;
  const scale = Number.isFinite(transform?.scale) && transform.scale > 0 ? transform.scale : 1;
  const offsetX = Number.isFinite(transform?.offsetX) ? transform.offsetX : 0;
  const offsetY = Number.isFinite(transform?.offsetY) ? transform.offsetY : 0;
  const x = ((Number(clientX) || 0) - left - offsetX) / scale;
  const y = ((Number(clientY) || 0) - top - offsetY) / scale;
  return Object.freeze({
    x: Math.max(0, Math.min(worldWidth, x)),
    y: Math.max(0, Math.min(worldHeight, y)),
  });
}

export function pointInGroundEffectEllipse(effect, point) {
  const radius = Math.max(0, Number.isFinite(effect?.radius) ? effect.radius : 0);
  if (radius <= 0) return false;
  const dx = (Number.isFinite(point?.x) ? point.x : 0) - (Number.isFinite(effect?.x) ? effect.x : 0);
  const dy = (Number.isFinite(point?.y) ? point.y : 0) - (Number.isFinite(effect?.y) ? effect.y : 0);
  return (dx * dx) / (radius * radius)
    + (dy * dy) / ((radius * GROUND_EFFECT_VERTICAL_RATIO) ** 2) <= 1;
}

// One geometry source keeps combat hit points, art placement, and deployment aligned.
const CRAWLER_GEOMETRY = Object.freeze({
  x: -112, y: 130, width: 310, height: 210, exitX: 214,
  doorX: 96, rampFootX: 148,
  commandDeckX: 64, commandDeckY: 186,
  weaponX: 108, weaponY: 224,
  damageX: 88, damageY: 250,
});
const ENEMY_BASE_GEOMETRY = Object.freeze({
  drawX: 815, drawY: 88, width: 145, height: 340,
  attackX: 875, enemySpawnMinX: 836, enemySpawnMaxX: 858,
  gateX: 900, gateY: LANE_Y[1],
});
export const WORLD_GEOMETRY = Object.freeze({
  baseX: 110,
  musterX: 205,
  musterY: LANE_Y[2],
  crawler: CRAWLER_GEOMETRY,
  enemyBase: ENEMY_BASE_GEOMETRY,
  // The old name remains until the rendering commit adopts enemyBase.
  barricade: ENEMY_BASE_GEOMETRY,
  supportMinX: 230,
  supportMaxX: 805,
  threatNearX: 310,
  threatStartX: 455,
});

export const BATTLEFIELD_SUPPLY_DEFS = Object.freeze({
  pod: Object.freeze({
    kind: "pod", name: "防護投下ポッド", key: "V", cost: 50,
    maxHp: 260, minX: 235, maxX: 805, placementClearance: FIELD_OBJECT_CLEARANCE,
    dropSeconds: .45, impactSeconds: .26, destroySeconds: .42,
    landingRadius: 92, enemyLandingDamage: 72, allyLandingDamage: 22,
    blocksEnemies: true,
  }),
  drum: Object.freeze({
    kind: "drum", name: "爆薬ドラム", key: "B", cost: 40,
    maxHp: 90, minX: 235, maxX: 805, placementClearance: 64,
    blastRadius: 112, blastDamage: 118,
    burnRadius: 88, burnDamagePerSecond: 15, burnSeconds: 4.5, slowMultiplier: .8,
    destroySeconds: .36, blocksEnemies: false,
  }),
  medical: Object.freeze({
    kind: "medical", name: "簡易救護所", key: "M", cost: 35,
    maxHp: 72, minX: 235, maxX: 805, placementClearance: 58,
    healRadius: 104, healPerSecond: 18, effectSeconds: 8,
    destroySeconds: .3, blocksEnemies: false,
  }),
});

export function enemyBaseTargetPoint(lane, laneCenters = LANE_Y) {
  const normalizedLane = Number.isInteger(lane) && lane >= 0 && lane <= 2 ? lane : 1;
  return Object.freeze({
    x: WORLD_GEOMETRY.enemyBase.attackX,
    y: (laneCenters[normalizedLane] ?? LANE_Y[normalizedLane]) - 24,
  });
}

export function bossPhaseForHp(hp, maxHp) {
  const ratio = Math.max(0, Number(hp) || 0) / Math.max(1, Number(maxHp) || 1);
  if (ratio <= .25) return Object.freeze({ phase: 3, label: "最終段階" });
  if (ratio <= .75) return Object.freeze({ phase: 2, label: "第2段階" });
  return Object.freeze({ phase: 1, label: "第1段階" });
}

export function battlefieldPlacementForbiddenZones(stageZones = []) {
  const normalizedStageZones = Array.isArray(stageZones)
    ? stageZones.filter((zone) => Number.isFinite(zone?.minX) && Number.isFinite(zone?.maxX))
    : [];
  return Object.freeze([
    // Protect the Crawler doorway itself, while allowing useful placements in
    // the rear and close to an enemy objective.
    Object.freeze({ minX: 0, maxX: WORLD_GEOMETRY.crawler.exitX + 18 }),
    ...normalizedStageZones.map((zone) => Object.freeze({ ...zone })),
  ]);
}

// Compatibility shape for the current container integration. It deliberately
// omits maxActive/maxPerLane: the tactical pod is naturally constrained by
// scrap, range, forbidden geometry, durability, and spacing.
export const CONTAINER_DEF = Object.freeze({
  ...BATTLEFIELD_SUPPLY_DEFS.pod,
  kind: "container",
  name: "防護コンテナ",
  objectClearance: BATTLEFIELD_SUPPLY_DEFS.pod.placementClearance,
});

export const AIRSTRIKE_DEF = Object.freeze({
  kind: "airstrike", gaugeCost: 60,
  minX: WORLD_GEOMETRY.supportMinX, maxX: WORLD_GEOMETRY.supportMaxX,
  radius: 132, damage: 145,
  radioSeconds: .55, targetingSeconds: .45, inboundSeconds: .75,
  impactSeconds: .12, returnSeconds: .65,
});

export const CRAWLER_BARRAGE_DEF = Object.freeze({
  kind: "crawler-barrage", lanes: Object.freeze([0, 1, 2]),
  cooldownSeconds: 36, initialCharge: .5,
  deploySeconds: .55, fireSeconds: .65, recoverSeconds: .75,
  damage: 52, bossDamageMultiplier: .55,
});

export const RENDER_ARRAY_LIMITS = Object.freeze({
  particles: 420,
  shots: 180,
  damageTexts: 140,
  areaEffectVisuals: 24,
  battleBarks: 2,
});

export const CAMERA_SHAKE_EVENTS = Object.freeze({
  podLanding: Object.freeze({ strength: 13, seconds: .18 }),
  airstrikeImpact: Object.freeze({ strength: 10, seconds: .16 }),
  crawlerBarrage: Object.freeze({ strength: 8, seconds: .22 }),
  takuyaEntrance: Object.freeze({ strength: 7, seconds: .18 }),
  takuyaHeavy: Object.freeze({ strength: 11, seconds: .2 }),
  takuyaDefeat: Object.freeze({ strength: 9, seconds: .24 }),
  enemyBaseCollapse: Object.freeze({ strength: 12, seconds: .28 }),
});

// Compatibility exports keep the current combat API stable while the canonical
// data now lives in the content catalog.
export const UNIT_CARDS = UNIT_CONTENT;
export const UNIT_BY_ID = UNIT_CONTENT_BY_ID;

export const UNIT_SPECIALS = Object.freeze({
  "crazy-king": Object.freeze({ radius: 54, secondaryMultiplier: .46, bleedDamage: 8, bleedSeconds: 2.4, push: 7 }),
  kumaverson: Object.freeze({ push: 18, stunSeconds: .72, heavyStunSeconds: .38 }),
  babayaga: Object.freeze({ specialMultiplier: 1.34, analysisMarkSeconds: 3.2, markMultiplier: 1.15 }),
});

export function unitSpecialFor(kind) {
  return UNIT_SPECIALS[kind] ?? null;
}

export const SUPPORT_DEFS = [
  { kind: "barrel", name: "爆薬ドラム", cost: 20, key: "Z", desc: "近接起爆" },
  { kind: "medkit", name: "簡易救護所", cost: 25, key: "X", desc: "範囲回復" },
  { kind: "molotov", name: "火炎瓶", cost: 35, key: "C", desc: "燃焼・減速" },
  { kind: "airstrike", name: "緊急航空支援", cost: 60, key: "Q", desc: "広域攻撃" },
];

// Compatibility export for older combat helpers. The authoritative TAKUYA
// sequence now lives in the stable campaign stage data and is projected here.
export const MISSION_EVENTS = Object.freeze(
  CAMPAIGN_STAGE_BY_ID[CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE].waves.map((wave, index) => Object.freeze({
    at: PREP_SECONDS + wave.atSeconds,
    wave: wave.waveNumber ?? index + 1,
    label: wave.label,
    ...(wave.bossOnly === true ? { bossOnly: true } : {}),
    units: Object.freeze(wave.units.map((unit) => String(Array.isArray(unit) ? unit[0] : unit))),
  })),
);

export const ENEMY_GATE_SPAWN = Object.freeze({
  revealX: WORLD_GEOMETRY.enemyBase.drawX + 18,
  interiorX: Object.freeze([836, 850, 862, 842, 856]),
  interiorY: Object.freeze([220, 250, 282, 314, 344]),
});

function enemySpawnClass(kind) {
  return enemySpawnClassFor(kind);
}

export function enemySpawnInterval({ kind, order = 0, wave = 1 }) {
  const base = kind === "takuya" || kind === "gate-eater" ? .92
    : kind === "abomination" ? .78
      : kind === "crusher" ? .64
          : kind === "spitter" || kind === "shade" || kind === "ooze" ? .5
          : kind === "runner" || kind === "sprinter" ? .34
            : .42;
  return Number((base + ((wave + order + String(kind).length) % 3) * .035).toFixed(3));
}

export function enemyGateSpawnPosition({ kind, order = 0, wave = 1, entryId = 1 }) {
  const pairCount = ENEMY_GATE_SPAWN.interiorX.length * ENEMY_GATE_SPAWN.interiorY.length;
  const pairIndex = Math.abs(wave * 7 + entryId + order) % pairCount;
  const slot = pairIndex % ENEMY_GATE_SPAWN.interiorX.length;
  const verticalBand = Math.floor(pairIndex / ENEMY_GATE_SPAWN.interiorX.length);
  const verticalSlot = (verticalBand + slot * 2 + wave) % ENEMY_GATE_SPAWN.interiorY.length;
  const spawnClass = enemySpawnClass(kind);
  const clearance = spawnClass === "boss" ? 49 : spawnClass === "heavy" ? 43 : 31;
  const entrySpeed = kind === "takuya" || kind === "gate-eater" ? 29
    : kind === "abomination" ? 32
      : kind === "crusher" ? 36
        : kind === "spitter" || kind === "shade" || kind === "ooze" ? 46
          : kind === "runner" || kind === "sprinter" ? 62
            : 52;
  return Object.freeze({
    x: ENEMY_GATE_SPAWN.interiorX[slot],
    y: ENEMY_GATE_SPAWN.interiorY[verticalSlot],
    routeIndex: (verticalSlot + wave + order) % LANE_Y.length,
    combatReadyX: ENEMY_GATE_SPAWN.revealX - clearance,
    entrySpeed,
    slot,
  });
}

export function createEnemySpawnRuntime() {
  return { pending: [], cooldown: 0, nextEntryId: 1 };
}

export function enqueueEnemyWave(runtime, { units = [], wave = 1 }) {
  let nextEntryId = runtime.nextEntryId;
  const startsIdle = runtime.pending.length === 0 && runtime.cooldown <= 0;
  const added = units.map((unit, order) => {
    const kind = String(Array.isArray(unit) ? unit[0] : unit);
    const entryId = nextEntryId++;
    const spawn = enemyGateSpawnPosition({ kind, order, wave, entryId });
    return {
      entryId,
      kind,
      lane: spawn.routeIndex,
      wave,
      order,
      delay: startsIdle && order === 0 ? 0 : enemySpawnInterval({ kind, order, wave }),
      ...spawn,
    };
  });
  return {
    ...runtime,
    pending: [...runtime.pending, ...added],
    nextEntryId,
  };
}

export function advanceEnemySpawnRuntime(runtime, seconds, paused = false) {
  if (paused || seconds <= 0 || runtime.pending.length === 0) return { runtime, spawned: [] };
  const cooldown = Math.max(0, runtime.cooldown - seconds);
  if (cooldown > 0) return { runtime: { ...runtime, cooldown }, spawned: [] };
  const [spawned, ...pending] = runtime.pending;
  return {
    runtime: { ...runtime, pending, cooldown: pending[0]?.delay ?? 0 },
    spawned: [spawned],
  };
}

export function phaseAt(time) {
  if (time < 60) return 1;
  if (time < 148) return 2;
  return 3;
}

export function advanceCommand(command, seconds) {
  return Math.min(COMMAND_MAX, command + Math.max(0, seconds) * COMMAND_REGEN);
}

export function canDeploy({ running, paused, over, command, cost, cooldown }) {
  return Boolean(running && !paused && !over && command >= cost && cooldown <= 0);
}

export function supportGaugeReward(kind) {
  return ({ walker: 4, runner: 5, spitter: 8, crusher: 14, shade: 22, abomination: 20, takuya: 25, turned: 7, grappler: 13, ooze: 11, sprinter: 8, "gate-eater": 30 })[kind] ?? 4;
}

export const rageReward = supportGaugeReward;

export function scrapReward(kind) {
  return ({ walker: 6, runner: 7, spitter: 10, crusher: 18, shade: 24, abomination: 40, takuya: 80, turned: 9, grappler: 18, ooze: 15, sprinter: 11, "gate-eater": 96 })[kind] ?? 6;
}

export function capRenderArray(items, kindOrLimit) {
  const limit = typeof kindOrLimit === "number" ? kindOrLimit : RENDER_ARRAY_LIMITS[kindOrLimit];
  if (!Number.isFinite(limit) || limit < 0) return [...items];
  const integerLimit = Math.floor(limit);
  return integerLimit === 0 ? [] : items.slice(-integerLimit);
}

export function retainActiveAreaEffects(areaEffects = []) {
  return areaEffects.filter((effect) => effect.phase !== "expired");
}

export function selectAreaEffectsForRender(areaEffects = []) {
  return capRenderArray(areaEffects, "areaEffectVisuals");
}

export function createCameraShakeRuntime() {
  return { strength: 0, remaining: 0, duration: 0 };
}

export function triggerCameraShake(runtime, event) {
  if (!event || event.strength <= 0 || event.seconds <= 0) return runtime ? { ...runtime } : createCameraShakeRuntime();
  return { strength: event.strength, remaining: event.seconds, duration: event.seconds };
}

export function advanceCameraShakeRuntime(runtime, seconds) {
  if (!runtime || runtime.remaining <= 0 || runtime.duration <= 0) return createCameraShakeRuntime();
  const remaining = Math.max(0, runtime.remaining - Math.max(0, seconds));
  return remaining === 0 ? createCameraShakeRuntime() : { ...runtime, remaining };
}

export function cameraShakeAmplitude(runtime) {
  if (!runtime || runtime.remaining <= 0 || runtime.duration <= 0) return 0;
  return runtime.strength * Math.min(1, runtime.remaining / runtime.duration);
}

export function advanceEnemyBaseCollapse({ barricadeHp, elapsed = 0, seconds = 0, duration = ENEMY_BASE_COLLAPSE_SECONDS }) {
  if (barricadeHp > 0) return { active: false, elapsed: 0, complete: false };
  const safeDuration = Math.max(0, duration);
  const nextElapsed = Math.min(safeDuration, Math.max(0, elapsed) + Math.max(0, seconds));
  return { active: true, elapsed: nextElapsed, complete: nextElapsed >= safeDuration };
}

function battlefieldSupplyDef(kind) {
  return kind === "container" ? BATTLEFIELD_SUPPLY_DEFS.pod : BATTLEFIELD_SUPPLY_DEFS[kind];
}

function worldYFor(object) {
  return Number.isFinite(object.y) ? object.y : LANE_Y[object.lane];
}

function lanePitch(laneCenters = LANE_Y) {
  const pitches = laneCenters.slice(1)
    .map((center, index) => Math.abs(center - laneCenters[index]))
    .filter((pitch) => Number.isFinite(pitch) && pitch > 0);
  return pitches.length > 0 ? Math.min(...pitches) : LANE_Y[1] - LANE_Y[0];
}

function battlefieldEffectDistance(origin, point, laneCenters = LANE_Y) {
  const standardPitch = LANE_Y[1] - LANE_Y[0];
  const verticalScale = 2 * standardPitch / lanePitch(laneCenters);
  return Math.hypot(point.x - origin.x, (worldYFor(point) - origin.y) * verticalScale);
}

function normalizedInternalLane(lane, y, laneCenters = LANE_Y) {
  if (Number.isInteger(lane) && lane >= 0 && lane < laneCenters.length) return lane;
  if (!Number.isFinite(y)) return null;
  return laneCenters.reduce((nearest, center, index) => (
    Math.abs(y - center) < Math.abs(y - laneCenters[nearest]) ? index : nearest
  ), 0);
}

function battlefieldDistance(x, y, object) {
  return Math.hypot(object.x - x, worldYFor(object) - y);
}

function supplyStillPresent(supply) {
  return supply.phase !== "expired" && supply.phase !== "destroying" && (!Number.isFinite(supply.life) || supply.life > 0);
}

/**
 * @param {{
 *   running: boolean, paused: boolean, over: boolean, scrap: number,
 *   kind?: string, supplyKind?: string, lane?: number, x: number, y?: number,
 *   supplies?: RuleSupply[], objects?: RuleSupply[], supports?: RuleSupply[],
 *   forbiddenZones?: ForbiddenZone[], laneCenters?: readonly number[],
 * }} input
 */
export function battlefieldSupplyPlacementCheck({
  running, paused, over, scrap, kind, supplyKind, lane, x, y,
  supplies = [], objects = [], supports = [], forbiddenZones = [], laneCenters = LANE_Y,
}) {
  const selectedKind = supplyKind ?? kind;
  const def = battlefieldSupplyDef(selectedKind);
  if (!def) return { ok: false, reason: "未対応の戦場物資です" };
  if (!running) return { ok: false, reason: "作戦開始後に配置できます" };
  if (paused) return { ok: false, reason: "一時停止中は配置できません" };
  if (over) return { ok: false, reason: "作戦終了後は配置できません" };
  if (scrap < def.cost) return { ok: false, reason: "スクラップが不足しています" };
  const internalLane = normalizedInternalLane(lane, y, laneCenters);
  const placementY = Number.isFinite(y) ? y : internalLane === null ? Number.NaN : laneCenters[internalLane];
  if (internalLane === null || !Number.isFinite(placementY) || !Number.isFinite(x) || x < def.minX || x > def.maxX) {
    return { ok: false, reason: "配置可能範囲外です" };
  }
  if (forbiddenZones.some((zone) => {
    if (x < zone.minX || x > zone.maxX) return false;
    if (Number.isFinite(zone.minY) && placementY < zone.minY) return false;
    if (Number.isFinite(zone.maxY) && placementY > zone.maxY) return false;
    if (!Number.isFinite(zone.minY) && !Number.isFinite(zone.maxY) && Number.isInteger(zone.lane) && zone.lane !== internalLane) return false;
    return true;
  })) return { ok: false, reason: "進行上の禁止領域です" };

  const occupied = [...supplies, ...objects, ...supports].filter(supplyStillPresent);
  if (occupied.some((existing) => {
    const existingDef = battlefieldSupplyDef(existing.kind);
    const clearance = Math.max(def.placementClearance, existingDef?.placementClearance ?? FIELD_OBJECT_CLEARANCE);
    return battlefieldDistance(x, placementY, existing) < clearance;
  })) return { ok: false, reason: "既存物資に近すぎます" };

  return { ok: true, reason: "配置できます" };
}

function createMedicalAreaEffect(supply, id) {
  const def = BATTLEFIELD_SUPPLY_DEFS.medical;
  return {
    id,
    kind: "healing",
    sourceSupplyId: supply.id,
    lane: supply.lane,
    x: supply.x,
    y: supply.y,
    radius: def.healRadius,
    amountPerSecond: def.healPerSecond,
    remaining: def.effectSeconds,
    phase: "active",
  };
}

/**
 * @param {{
 *   running: boolean, paused: boolean, over: boolean, scrap: number,
 *   kind?: string, supplyKind?: string, lane?: number, x: number, y?: number,
 *   supplies?: RuleSupply[], objects?: RuleSupply[], supports?: RuleSupply[],
 *   areaEffects?: RuleAreaEffect[], forbiddenZones?: ForbiddenZone[], laneCenters?: readonly number[],
 *   nextId?: number, nextAreaEffectId?: number,
 * }} input
 */
export function resolveBattlefieldSupplyPlacement(input) {
  const supplies = input.supplies ?? [];
  const areaEffects = input.areaEffects ?? [];
  const nextId = input.nextId ?? 0;
  const nextAreaEffectId = input.nextAreaEffectId ?? 0;
  const kind = input.supplyKind ?? input.kind;
  const def = battlefieldSupplyDef(kind);
  const check = battlefieldSupplyPlacementCheck({ ...input, kind });
  if (!check.ok) return { ...check, scrap: input.scrap, supplies, areaEffects, nextId, nextAreaEffectId };
  const laneCenters = input.laneCenters ?? LANE_Y;
  const lane = normalizedInternalLane(input.lane, input.y, laneCenters);
  const y = Number.isFinite(input.y) ? input.y : laneCenters[lane];

  const supply = {
    id: nextId,
    kind,
    lane,
    x: input.x,
    y,
    phase: kind === "pod" ? "dropping" : "active",
    phaseTime: kind === "pod" ? def.dropSeconds : 0,
    remaining: kind === "medical" ? def.effectSeconds : null,
    hp: def.maxHp,
    maxHp: def.maxHp,
    blocksEnemies: kind === "pod" ? false : def.blocksEnemies,
    targetable: kind !== "pod",
    landingTriggered: kind !== "pod",
    detonationTriggered: false,
  };
  const medicalEffect = kind === "medical" ? createMedicalAreaEffect(supply, nextAreaEffectId) : null;
  return {
    ...check,
    scrap: input.scrap - def.cost,
    supplies: [...supplies, supply],
    areaEffects: medicalEffect ? [...areaEffects, medicalEffect] : areaEffects,
    nextId: nextId + 1,
    nextAreaEffectId: nextAreaEffectId + (medicalEffect ? 1 : 0),
  };
}

/** @param {{supply: RuleSupply, fighters?: RuleFighter[], laneCenters?: readonly number[]}} input */
export function resolveBattlefieldSupplyLanding({ supply, fighters = [], laneCenters = LANE_Y }) {
  const def = battlefieldSupplyDef(supply?.kind);
  if (!supply || supply.kind !== "pod" || supply.landingTriggered || supply.phase !== "dropping" || (!supply.readyToLand && supply.phaseTime > 0)) {
    return { triggered: false, supply, fighters, hits: [] };
  }
  const hits = [];
  const nextFighters = fighters.map((fighter) => {
    const y = worldYFor(fighter);
    if (fighter.hp <= 0 || fighter.combatReady === false || battlefieldEffectDistance(supply, { ...fighter, y }, laneCenters) > def.landingRadius) return fighter;
    const damage = fighter.side === "zombie" ? def.enemyLandingDamage : def.allyLandingDamage;
    hits.push({ id: fighter.id, side: fighter.side, damage });
    return { ...fighter, hp: Math.max(0, fighter.hp - damage) };
  });
  return {
    triggered: true,
    supply: { ...supply, phase: "impact", phaseTime: def.impactSeconds, readyToLand: false, landingTriggered: true, blocksEnemies: true, targetable: true },
    fighters: nextFighters,
    hits,
  };
}

export function advanceBattlefieldSupply(supply, seconds) {
  const elapsed = Math.max(0, seconds);
  const def = battlefieldSupplyDef(supply.kind);
  if (!def || elapsed === 0 || supply.phase === "expired") return supply;
  if (supply.phase === "dropping") {
    const phaseTime = Math.max(0, supply.phaseTime - elapsed);
    return { ...supply, phaseTime, readyToLand: phaseTime === 0 };
  }
  if (supply.phase === "impact") {
    const phaseTime = Math.max(0, supply.phaseTime - elapsed);
    return phaseTime === 0 ? { ...supply, phase: "active", phaseTime: 0 } : { ...supply, phaseTime };
  }
  if (supply.phase === "destroying") {
    const phaseTime = Math.max(0, supply.phaseTime - elapsed);
    return phaseTime === 0 ? { ...supply, phase: "expired", phaseTime: 0 } : { ...supply, phaseTime };
  }
  if (supply.kind === "medical" && supply.phase === "active") {
    const remaining = Math.max(0, supply.remaining - elapsed);
    return remaining === 0
      ? { ...supply, remaining, phase: "expired", targetable: false }
      : { ...supply, remaining };
  }
  return supply;
}

export function applyBattlefieldSupplyDamage(supply, damage) {
  const def = battlefieldSupplyDef(supply.kind);
  if (!def || !supply.targetable || supply.phase === "expired" || supply.phase === "destroying") {
    return { supply, detonationRequested: false };
  }
  const hp = Math.max(0, supply.hp - Math.max(0, damage));
  if (hp > 0) return { supply: { ...supply, hp }, detonationRequested: false };
  if (supply.kind === "drum") {
    return {
      supply: { ...supply, hp: 0, phase: "detonating", targetable: false, detonationReason: "destroyed" },
      detonationRequested: true,
    };
  }
  return {
    supply: { ...supply, hp: 0, phase: "destroying", phaseTime: def.destroySeconds, blocksEnemies: false, targetable: false },
    detonationRequested: false,
  };
}

export function requestDrumDetonation(supply, reason = "manual") {
  if (!supply || supply.kind !== "drum") return { ok: false, reason: "爆薬ドラムではありません", supply };
  if (supply.detonationTriggered || supply.phase === "destroying" || supply.phase === "expired") {
    return { ok: false, reason: "起爆済みです", supply };
  }
  if (supply.phase === "detonating") return { ok: true, reason: "起爆します", supply };
  if (supply.phase !== "active") return { ok: false, reason: "まだ起爆できません", supply };
  return { ok: true, reason: "起爆します", supply: { ...supply, phase: "detonating", targetable: false, detonationReason: reason } };
}

/** @param {{supply: RuleSupply, fighters?: RuleFighter[], areaEffects?: RuleAreaEffect[], nextAreaEffectId?: number, laneCenters?: readonly number[]}} input */
export function resolveDrumDetonation({ supply, fighters = [], areaEffects = [], nextAreaEffectId = 0, laneCenters = LANE_Y }) {
  const def = BATTLEFIELD_SUPPLY_DEFS.drum;
  if (!supply || supply.kind !== "drum" || supply.phase !== "detonating" || supply.detonationTriggered) {
    return { triggered: false, supply, fighters, hits: [], areaEffects, nextAreaEffectId };
  }
  const hits = [];
  const nextFighters = fighters.map((fighter) => {
    const y = worldYFor(fighter);
    if (fighter.side !== "zombie" || fighter.hp <= 0 || fighter.combatReady === false || battlefieldEffectDistance(supply, { ...fighter, y }, laneCenters) > def.blastRadius) return fighter;
    hits.push({ id: fighter.id, damage: def.blastDamage });
    return { ...fighter, hp: Math.max(0, fighter.hp - def.blastDamage) };
  });
  const burn = {
    id: nextAreaEffectId,
    kind: "burn",
    sourceSupplyId: supply.id,
    lane: supply.lane,
    x: supply.x,
    y: supply.y,
    radius: def.burnRadius,
    amountPerSecond: def.burnDamagePerSecond,
    slowMultiplier: def.slowMultiplier,
    remaining: def.burnSeconds,
    phase: "active",
  };
  return {
    triggered: true,
    supply: { ...supply, hp: 0, phase: "destroying", phaseTime: def.destroySeconds, detonationTriggered: true, blocksEnemies: false, targetable: false },
    fighters: nextFighters,
    hits,
    areaEffects: [...areaEffects, burn],
    nextAreaEffectId: nextAreaEffectId + 1,
  };
}

/** @param {{areaEffects?: RuleAreaEffect[], fighters?: RuleFighter[], seconds: number, activeSupplyIds?: number[]}} input */
export function advanceAreaEffects({ areaEffects = [], fighters = [], seconds, activeSupplyIds }) {
  const elapsed = Math.max(0, seconds);
  const activeSources = activeSupplyIds === undefined ? null : new Set(activeSupplyIds);
  let nextFighters = fighters.map((fighter) => ({ ...fighter, burning: false, slowMultiplier: 1 }));
  const changes = [];
  const nextEffects = areaEffects.map((effect) => {
    if (effect.phase === "expired") return effect;
    const sourceMissing = effect.kind === "healing" && activeSources && !activeSources.has(effect.sourceSupplyId);
    const activeSeconds = sourceMissing ? 0 : Math.min(elapsed, Math.max(0, effect.remaining));
    if (activeSeconds > 0) {
      nextFighters = nextFighters.map((fighter) => {
        const y = worldYFor(fighter);
        if (fighter.hp <= 0 || fighter.combatReady === false || !pointInGroundEffectEllipse(effect, { x: fighter.x, y })) return fighter;
        if (effect.kind === "burn" && fighter.side === "zombie") {
          const amount = effect.amountPerSecond * activeSeconds;
          changes.push({ id: fighter.id, kind: "damage", amount });
          return { ...fighter, hp: Math.max(0, fighter.hp - amount), burning: true, slowMultiplier: effect.slowMultiplier };
        }
        if (effect.kind === "healing" && fighter.side === "human") {
          const amount = Math.min(effect.amountPerSecond * activeSeconds, Math.max(0, fighter.maxHp - fighter.hp));
          if (amount <= 0) return fighter;
          changes.push({ id: fighter.id, kind: "healing", amount });
          return { ...fighter, hp: fighter.hp + amount };
        }
        return fighter;
      });
    }
    const remaining = sourceMissing ? 0 : Math.max(0, effect.remaining - elapsed);
    return { ...effect, remaining, phase: remaining === 0 ? "expired" : "active" };
  });
  return { areaEffects: nextEffects, fighters: nextFighters, changes };
}

function overlapsFieldObject(lane, x, object) {
  return Math.hypot(object.x - x, (object.y - LANE_Y[lane]) * 2) < FIELD_OBJECT_CLEARANCE;
}

export function containerPlacementCheck({ running, paused, over, scrap, lane, x, objects = [], supports = [] }) {
  return battlefieldSupplyPlacementCheck({
    running, paused, over, scrap, supplyKind: "pod", lane, x,
    supplies: objects,
    supports,
  });
}

export function resolveContainerPlacement(input) {
  const objects = input.objects ?? [];
  const nextId = input.nextId ?? 0;
  const check = containerPlacementCheck(input);
  if (!check.ok) return { ...check, scrap: input.scrap, objects, nextId };

  const object = {
    id: nextId,
    kind: "container",
    lane: input.lane,
    x: input.x,
    y: LANE_Y[input.lane],
    phase: "dropping",
    phaseTime: .45,
    hp: CONTAINER_DEF.maxHp,
    maxHp: CONTAINER_DEF.maxHp,
    blocksEnemies: true,
    targetable: true,
    hitFlash: 0,
    landingTriggered: false,
  };
  return {
    ...check,
    scrap: input.scrap - CONTAINER_DEF.cost,
    objects: [...objects, object],
    nextId: nextId + 1,
  };
}

export function resolveContainerLanding({ fighters = [], lane, x }) {
  const result = resolveBattlefieldSupplyLanding({
    supply: {
      id: -1, kind: "pod", lane, x, y: LANE_Y[lane],
      phase: "dropping", phaseTime: 0, landingTriggered: false,
    },
    fighters,
  });
  return { fighters: result.fighters, hits: result.hits };
}

export function resolveFieldSupportPlacement({ running, paused, over, rage, cost, kind, lane, x, strikeCooldown = 0, supports = [], containers = [] }) {
  if (!running) return { ok: false, reason: "作戦開始後に配置できます", rage, x };
  if (paused) return { ok: false, reason: "一時停止中は配置できません", rage, x };
  if (over) return { ok: false, reason: "作戦終了後は配置できません", rage, x };
  if (rage < cost) return { ok: false, reason: "レイジが不足しています", rage, x };
  if (kind === "airstrike" && strikeCooldown > 0) return { ok: false, reason: "航空支援は再装填中です", rage, x };
  if (kind === "barrel" && supports.some((support) => support.kind === "barrel" && support.lane === lane)) {
    return { ok: false, reason: "同じ戦線にドラム設置済みです", rage, x };
  }

  const placedX = Math.max(WORLD_GEOMETRY.supportMinX, Math.min(WORLD_GEOMETRY.supportMaxX, x));
  if (containers.some((container) => container.phase !== "expired" && overlapsFieldObject(lane, placedX, container))) {
    return { ok: false, reason: "防護コンテナに近すぎます", rage, x: placedX };
  }
  return { ok: true, reason: "配置できます", rage: rage - cost, x: placedX };
}

export function createEmergencySupportRuntime() {
  return { phase: "idle", phaseTime: 0, targetX: null, targetLane: null, impactTriggered: false };
}

export function airstrikePlacementCheck({ running, paused, over, supportGauge, lane, x, y, laneCenters = LANE_Y, runtime = createEmergencySupportRuntime() }) {
  if (!running) return { ok: false, reason: "作戦開始後に要請できます" };
  if (paused) return { ok: false, reason: "一時停止中は要請できません" };
  if (over) return { ok: false, reason: "作戦終了後は要請できません" };
  if (runtime.phase !== "idle") return { ok: false, reason: "航空支援を実行中です" };
  if (supportGauge < AIRSTRIKE_DEF.gaugeCost) return { ok: false, reason: "支援ゲージが不足しています" };
  const internalLane = normalizedInternalLane(lane, y, laneCenters);
  const targetY = Number.isFinite(y) ? y : internalLane === null ? Number.NaN : laneCenters[internalLane];
  if (internalLane === null || !Number.isFinite(targetY) || !Number.isFinite(x)) {
    return { ok: false, reason: "目標地点が無効です" };
  }
  if (x < AIRSTRIKE_DEF.minX || x > AIRSTRIKE_DEF.maxX) {
    return { ok: false, reason: "航空支援の有効範囲外です" };
  }
  return { ok: true, reason: "航空支援目標", targetX: x, targetY, internalLane };
}

export function requestAirstrike({ running, paused, over, supportGauge, lane, x, y, laneCenters = LANE_Y, runtime = createEmergencySupportRuntime() }) {
  const check = airstrikePlacementCheck({ running, paused, over, supportGauge, lane, x, y, laneCenters, runtime });
  if (!check.ok) return { ...check, supportGauge, runtime };
  return {
    ok: true,
    reason: "航空支援を要請しました",
    supportGauge: supportGauge - AIRSTRIKE_DEF.gaugeCost,
    runtime: {
      phase: "radio",
      phaseTime: AIRSTRIKE_DEF.radioSeconds,
      targetX: check.targetX,
      targetY: check.targetY,
      targetLane: check.internalLane,
      impactTriggered: false,
    },
  };
}

function nextAirstrikePhase(runtime) {
  if (runtime.phase === "radio") return { ...runtime, phase: "targeting", phaseTime: AIRSTRIKE_DEF.targetingSeconds };
  if (runtime.phase === "targeting") return { ...runtime, phase: "inbound", phaseTime: AIRSTRIKE_DEF.inboundSeconds };
  if (runtime.phase === "inbound") return { ...runtime, phase: "impact", phaseTime: AIRSTRIKE_DEF.impactSeconds, impactTriggered: false };
  if (runtime.phase === "impact") return { ...runtime, phase: "returning", phaseTime: AIRSTRIKE_DEF.returnSeconds };
  return createEmergencySupportRuntime();
}

export function airstrikeObserverPose(runtime) {
  if (!runtime || runtime.phase === "idle") return { visible: false, rise: 0, action: "idle" };
  let rise = 1;
  if (runtime.phase === "radio") rise = 1 - runtime.phaseTime / AIRSTRIKE_DEF.radioSeconds;
  else if (runtime.phase === "returning") rise = runtime.phaseTime / AIRSTRIKE_DEF.returnSeconds;
  return {
    visible: rise > 0,
    rise: Math.max(0, Math.min(1, rise)),
    action: runtime.phase,
  };
}

export function advanceEmergencySupportRuntime(runtime, seconds) {
  let next = { ...runtime };
  let remaining = Math.max(0, seconds);
  const events = [];
  while (next.phase !== "idle" && remaining >= next.phaseTime) {
    remaining -= next.phaseTime;
    next = nextAirstrikePhase(next);
    if (next.phase === "targeting") events.push("targeting");
    if (next.phase === "inbound") events.push("inbound");
    if (next.phase === "impact") {
      events.push("impact");
      // Preserve the one-shot resolution window even when a background tab
      // resumes with a large elapsed delta.
      remaining = 0;
    }
    if (next.phase === "returning") events.push("returning");
    if (next.phase === "idle") events.push("complete");
  }
  if (next.phase !== "idle" && remaining > 0) next.phaseTime = Math.max(0, next.phaseTime - remaining);
  return { runtime: next, events };
}

/** @param {{runtime: ReturnType<typeof createEmergencySupportRuntime>, fighters?: RuleFighter[], laneCenters?: readonly number[]}} input */
export function resolveAirstrikeImpact({ runtime, fighters = [], laneCenters = LANE_Y }) {
  if (runtime.phase !== "impact" || runtime.impactTriggered) return { triggered: false, runtime, fighters, hits: [] };
  const targetY = Number.isFinite(runtime.targetY) ? runtime.targetY : laneCenters[runtime.targetLane];
  const hits = [];
  const nextFighters = fighters.map((fighter) => {
    const y = worldYFor(fighter);
    if (fighter.side !== "zombie" || fighter.hp <= 0 || fighter.combatReady === false || battlefieldEffectDistance({ x: runtime.targetX, y: targetY }, { ...fighter, y }, laneCenters) > AIRSTRIKE_DEF.radius) return fighter;
    hits.push({ id: fighter.id, damage: AIRSTRIKE_DEF.damage });
    return { ...fighter, hp: Math.max(0, fighter.hp - AIRSTRIKE_DEF.damage) };
  });
  return { triggered: true, runtime: { ...runtime, impactTriggered: true }, fighters: nextFighters, hits };
}

/** @param {number} [initialCharge] */
export function createCrawlerAbilityRuntime(initialCharge = CRAWLER_BARRAGE_DEF.initialCharge) {
  const charge = Math.max(0, Math.min(1, initialCharge));
  const cooldownRemaining = CRAWLER_BARRAGE_DEF.cooldownSeconds * (1 - charge);
  return cooldownRemaining === 0
    ? { phase: "ready", phaseTime: 0, cooldownRemaining: 0, charge: 1, damageTriggered: false }
    : { phase: "cooldown", phaseTime: cooldownRemaining, cooldownRemaining, charge, damageTriggered: false };
}

export function requestCrawlerBarrage({ running, paused, over, runtime }) {
  if (!running) return { ok: false, reason: "作戦開始後に使用できます", runtime };
  if (paused) return { ok: false, reason: "一時停止中は使用できません", runtime };
  if (over) return { ok: false, reason: "作戦終了後は使用できません", runtime };
  if (runtime.phase !== "ready") return { ok: false, reason: "一斉掃射は再装填中です", runtime };
  return {
    ok: true,
    reason: "火器を展開します",
    runtime: { ...runtime, phase: "deploying", phaseTime: CRAWLER_BARRAGE_DEF.deploySeconds, charge: 0, damageTriggered: false },
  };
}

function nextCrawlerAbilityPhase(runtime) {
  if (runtime.phase === "deploying") return { ...runtime, phase: "firing", phaseTime: CRAWLER_BARRAGE_DEF.fireSeconds, damageTriggered: false };
  if (runtime.phase === "firing") return { ...runtime, phase: "recovering", phaseTime: CRAWLER_BARRAGE_DEF.recoverSeconds };
  if (runtime.phase === "recovering") return createCrawlerAbilityRuntime(0);
  return runtime;
}

export function advanceCrawlerAbilityRuntime(runtime, seconds) {
  let next = { ...runtime };
  let remaining = Math.max(0, seconds);
  const events = [];
  if (next.phase === "cooldown") {
    const consumed = Math.min(remaining, next.cooldownRemaining);
    const cooldownRemaining = Math.max(0, next.cooldownRemaining - consumed);
    remaining -= consumed;
    next = cooldownRemaining === 0
      ? createCrawlerAbilityRuntime(1)
      : { ...next, phaseTime: cooldownRemaining, cooldownRemaining, charge: 1 - cooldownRemaining / CRAWLER_BARRAGE_DEF.cooldownSeconds };
    if (next.phase === "ready") events.push("ready");
  }
  while (["deploying", "firing", "recovering"].includes(next.phase) && remaining >= next.phaseTime) {
    remaining -= next.phaseTime;
    next = nextCrawlerAbilityPhase(next);
    if (next.phase === "firing") {
      events.push("fire");
      // Keep firing observable until resolveCrawlerBarrage consumes it.
      remaining = 0;
    }
    if (next.phase === "cooldown") events.push("cooldown");
  }
  if (["deploying", "firing", "recovering"].includes(next.phase) && remaining > 0) {
    next.phaseTime = Math.max(0, next.phaseTime - remaining);
  }
  return { runtime: next, events };
}

/** @param {{runtime: ReturnType<typeof createCrawlerAbilityRuntime>, fighters?: RuleFighter[]}} input */
export function resolveCrawlerBarrage({ runtime, fighters = [] }) {
  if (runtime.phase !== "firing" || runtime.damageTriggered) return { triggered: false, runtime, fighters, hits: [] };
  const hits = [];
  const nextFighters = fighters.map((fighter) => {
    if (fighter.side !== "zombie" || fighter.hp <= 0 || fighter.combatReady === false || !CRAWLER_BARRAGE_DEF.lanes.includes(fighter.lane)) return fighter;
    const boss = fighter.kind === "takuya" || fighter.kind === "gate-eater" || fighter.boss === true;
    const damage = Math.round(CRAWLER_BARRAGE_DEF.damage * (boss ? CRAWLER_BARRAGE_DEF.bossDamageMultiplier : 1));
    hits.push({ id: fighter.id, lane: fighter.lane, damage, boss });
    return { ...fighter, hp: Math.max(0, fighter.hp - damage) };
  });
  return { triggered: true, runtime: { ...runtime, damageTriggered: true }, fighters: nextFighters, hits };
}

export function enemyCanTargetBattlefieldSupply({ supply, enemyX, enemyY, attackRange = 0, contactPadding = 30 }) {
  if (!supply || !supply.targetable || !["active", "impact"].includes(supply.phase) || supply.hp <= 0) return false;
  if (!Number.isFinite(enemyX) || !Number.isFinite(enemyY)) return false;
  const supplyY = worldYFor(supply);
  const verticalDistance = Math.abs(enemyY - supplyY);
  if (supply.blocksEnemies) {
    return supply.x < enemyX && verticalDistance <= Math.max(30, contactPadding);
  }
  return Math.hypot(enemyX - supply.x, enemyY - supplyY)
    <= Math.max(0, attackRange) + Math.max(0, contactPadding);
}

export function damageContainer(hp, damage) {
  const nextHp = Math.max(0, hp - Math.max(0, damage));
  return { hp: nextHp, phase: nextHp <= 0 ? "destroying" : "active" };
}

export function applyContainerDamage(container, damage) {
  const result = damageContainer(container.hp, damage);
  return {
    ...container,
    hp: result.hp,
    phase: result.phase,
    phaseTime: result.phase === "destroying" ? .42 : container.phaseTime,
    blocksEnemies: result.phase === "active",
    targetable: result.phase === "active",
  };
}

export function containerBlocksEnemy({
  enemyX,
  enemyY,
  enemyRadius = 11,
  containerX,
  containerY,
  containerRadius = 24,
  phase,
}) {
  return (phase === "impact" || phase === "active")
    && Number.isFinite(enemyX)
    && Number.isFinite(enemyY)
    && Number.isFinite(containerX)
    && Number.isFinite(containerY)
    && containerX > WORLD_GEOMETRY.baseX
    && containerX < enemyX
    && Math.abs(enemyY - containerY) <= Math.max(0, enemyRadius) + Math.max(0, containerRadius);
}

/** @param {{enemyX: number, enemyY: number, enemyRadius?: number, objects?: RuleSupply[]}} input */
export function selectBlockingContainer({ enemyX, enemyY, enemyRadius = 11, objects = [] }) {
  return objects.reduce((nearest, object) => {
    if (!object.blocksEnemies || !object.targetable || !containerBlocksEnemy({
      enemyX,
      enemyY,
      enemyRadius,
      containerX: object.x,
      containerY: worldYFor(object),
      phase: object.phase,
    })) return nearest;
    return !nearest || object.x > nearest.x ? object : nearest;
  }, undefined);
}

/** @param {{enemyX: number, speed: number, seconds: number, burning?: boolean, targetFloor?: number | null}} input */
export function advanceZombieX({ enemyX, speed, seconds, burning = false, targetFloor = null }) {
  const proposedX = enemyX - speed * seconds * (burning ? .8 : 1);
  return targetFloor === null ? proposedX : Math.max(targetFloor, proposedX);
}

/**
 * Keeps normal movement outside the CRAWLER while allowing a defender that is
 * already pursuing a breach attacker to step into the doorway far enough to
 * make real melee contact. The target-derived destination remains the primary
 * limit, so this never drags an idle unit behind its normal muster line.
 */
export function humanCombatMinX({ desiredX = null, hasEnemyTarget = false } = {}) {
  const musterFloor = WORLD_GEOMETRY.musterX - 8;
  if (!hasEnemyTarget || !Number.isFinite(desiredX)) return musterFloor;
  const doorwayFloor = WORLD_GEOMETRY.crawler.exitX - 56;
  return Math.max(doorwayFloor, Math.min(musterFloor, desiredX));
}

export function objectiveFor(phase, barricadeVulnerable) {
  if (phase === 1) return "戦線を防衛";
  if (phase === 2) return "感染拠点へ前進";
  return barricadeVulnerable ? "感染拠点を破壊" : "TAKUYAを撃破";
}

export function advanceLimitFor(phase, barricadeVulnerable) {
  // Once TAKUYA falls, every ally must be able to reach the shared objective.
  if (phase >= 3 && barricadeVulnerable) return WORLD_GEOMETRY.barricade.attackX;
  return Math.min(WORLD_GEOMETRY.barricade.attackX, phase === 1 ? 550 : 800);
}

export function structureDamageMultiplier(kind) {
  return ({
    brute: 1.75,
    brawler: 1.2,
    gunner: .9,
    medic: .7,
    "crazy-king": 1.05,
    kumaverson: 1.08,
    babayaga: .9,
    guardian: .75,
    engineer: .85,
  })[kind] ?? 1;
}

export function barricadeState(hp) {
  const ratio = Math.max(0, hp) / BARRICADE_MAX_HP;
  if (ratio <= 0) return "BREACHED";
  if (ratio <= .35) return "BREACH IMMINENT";
  if (ratio <= .7) return "BUCKLING";
  return "INTACT";
}

export function enemyBaseVisualState({
  hp,
  elapsed = 0,
  maxHp = BARRICADE_MAX_HP,
  duration = ENEMY_BASE_COLLAPSE_SECONDS,
}) {
  const safeMaxHp = Math.max(1, maxHp);
  const safeHp = Math.max(0, Math.min(safeMaxHp, hp));
  if (safeHp <= 0) {
    const safeDuration = Math.max(0, duration);
    const collapseProgress = safeDuration === 0 ? 1 : Math.min(1, Math.max(0, elapsed) / safeDuration);
    return {
      phase: collapseProgress >= 1 ? "collapsed" : "collapsing",
      damageLevel: 4,
      collapseProgress,
    };
  }
  const ratio = safeHp / safeMaxHp;
  if (ratio >= 1) return { phase: "healthy", damageLevel: 0, collapseProgress: 0 };
  if (ratio > .7) return { phase: "light", damageLevel: 1, collapseProgress: 0 };
  if (ratio > .35) return { phase: "heavy", damageLevel: 2, collapseProgress: 0 };
  return { phase: "critical", damageLevel: 3, collapseProgress: 0 };
}

export function battleOutcome(baseHp, barricadeHp) {
  if (baseHp <= 0) return "lost";
  if (barricadeHp <= 0) return "won";
  return null;
}

export function laneForY(y, current = 1, hysteresis = 5) {
  let candidate = 0;
  if (Math.abs(y - LANE_Y[1]) < Math.abs(y - LANE_Y[candidate])) candidate = 1;
  if (Math.abs(y - LANE_Y[2]) < Math.abs(y - LANE_Y[candidate])) candidate = 2;
  if (candidate === current) return current;
  return Math.abs(y - LANE_Y[candidate]) + hysteresis < Math.abs(y - LANE_Y[current]) ? candidate : current;
}

export function autonomousTargetScore({ distance, claims, capacity = 1, enemyX, isCurrent = false }) {
  const claimsFromOthers = Math.max(0, claims - (isCurrent ? 1 : 0));
  const excessClaims = Math.max(0, claimsFromOthers - capacity + 1);
  const crawlerThreat = enemyX < WORLD_GEOMETRY.threatNearX ? 180 : enemyX < WORLD_GEOMETRY.threatStartX ? 55 : 0;
  return distance + excessClaims * 82 - crawlerThreat;
}

export function interceptorTargetScore({ distance, claims, capacity = 1, isCurrent = false, rearward = 0 }) {
  const claimsFromOthers = Math.max(0, claims - (isCurrent ? 1 : 0));
  const excessClaims = Math.max(0, claimsFromOthers - capacity + 1);
  return distance + Math.max(0, rearward) * 2 + excessClaims * 96;
}

export function isCrawlerRouteBlocker({ enemyX, defenderX, defenderY, routeY, lookAhead = 105, corridor = 30 }) {
  const lead = enemyX - defenderX;
  return lead >= 0 && lead <= lookAhead && Math.abs(defenderY - routeY) <= corridor;
}

export function crawlerSiegeDamage(damage, phase) {
  const multiplier = phase === 1 ? .7 : phase === 2 ? .9 : 1;
  return Math.max(1, Math.ceil(damage * multiplier));
}

export const BABAYAGA_PRIORITY_TARGET_KINDS = Object.freeze([
  "spitter",
  "shade",
  "crusher",
  "abomination",
  "takuya",
  "grappler",
  "ooze",
  "gate-eater",
  // Souki stays Scout-favored so the fast-intercept role remains distinct.
]);

export function isBabayagaPriorityTarget(targetKind) {
  return BABAYAGA_PRIORITY_TARGET_KINDS.includes(targetKind);
}

export function roleTargetBias(attackerKind, targetKind) {
  if (attackerKind === "scout" && (targetKind === "runner" || targetKind === "shade" || targetKind === "sprinter")) return -34;
  if (attackerKind === "ranger" && (targetKind === "spitter" || targetKind === "ooze")) return -42;
  if (attackerKind === "brute" && (targetKind === "crusher" || targetKind === "abomination" || targetKind === "takuya" || targetKind === "grappler" || targetKind === "gate-eater")) return -46;
  if (attackerKind === "gunner" && (targetKind === "walker" || targetKind === "runner" || targetKind === "turned")) return -12;
  if (attackerKind === "crazy-king" && (targetKind === "walker" || targetKind === "runner" || targetKind === "turned")) return -24;
  if (attackerKind === "kumaverson" && (targetKind === "runner" || targetKind === "crusher")) return -28;
  if (attackerKind === "babayaga" && isBabayagaPriorityTarget(targetKind)) return -48;
  return 0;
}

export function roleEffectForAction({
  unitKind,
  action = "attack",
  targetKind,
  targetHpRatio = 1,
  targetAlreadyMarked = false,
  holdingFrontline = false,
}) {
  if (unitKind === "medic") return action === "heal" ? "medic" : null;
  if (action === "structure") return unitKind === "brute" ? "brute" : null;
  if (action !== "attack") return null;
  if (unitKind === "scout") return targetAlreadyMarked ? null : "scout";
  if (unitKind === "ranger") return targetKind === "spitter" ? "ranger" : null;
  if (unitKind === "brute") return holdingFrontline || ["crusher", "abomination", "takuya", "grappler", "gate-eater"].includes(targetKind) ? "brute" : null;
  if (isBrawlerFinisher(unitKind, targetHpRatio)) return "brawler";
  if (unitKind === "gunner") return "gunner";
  if (unitKind === "crazy-king") return "crazy-king";
  if (unitKind === "kumaverson") return "kumaverson";
  if (unitKind === "babayaga" && isBabayagaPriorityTarget(targetKind)) return "babayaga";
  return null;
}

export function keyboardInputGate({ running, paused, over, key, repeat = false }) {
  if (repeat || !running || over) return "ignore";
  const normalized = String(key ?? "").toLowerCase();
  if (paused) return normalized === "p" || normalized === "escape" ? "toggle-pause" : "ignore";
  return "active";
}

export function isBrawlerFinisher(attackerKind, targetHpRatio = 1) {
  return attackerKind === "brawler" && targetHpRatio <= .35;
}

export function humanAttackMultiplier(attackerKind, targetKind, targetHpRatio = 1, marked = false) {
  let multiplier = 1;
  if (attackerKind === "babayaga" && isBabayagaPriorityTarget(targetKind)) {
    multiplier *= UNIT_SPECIALS.babayaga.specialMultiplier;
  }
  if (isBrawlerFinisher(attackerKind, targetHpRatio)) multiplier *= 1.35;
  if (marked) multiplier *= 1.15;
  return multiplier;
}

/**
 * Returns the deterministic secondary combat payload for the newcomer roles.
 * Applying the payload remains the battle runtime's responsibility.
 */
export function newcomerAttackPayload({ unitKind, targetKind, nearbyTargetIds = [], targetIsHeavy = false, areaRadius = null }) {
  if (unitKind === "crazy-king") {
    const special = UNIT_SPECIALS[unitKind];
    return Object.freeze({
      effect: unitKind,
      radius: Number.isFinite(Number(areaRadius)) ? Math.max(0, Number(areaRadius)) : special.radius,
      secondaryTargetIds: Object.freeze([...new Set(nearbyTargetIds)]),
      secondaryMultiplier: special.secondaryMultiplier,
      damageOverTime: Object.freeze({ damage: special.bleedDamage, seconds: special.bleedSeconds }),
      push: special.push,
      stunSeconds: 0,
      markSeconds: 0,
    });
  }
  if (unitKind === "kumaverson") {
    const special = UNIT_SPECIALS[unitKind];
    return Object.freeze({
      effect: unitKind,
      radius: 0,
      secondaryTargetIds: Object.freeze([]),
      secondaryMultiplier: 0,
      damageOverTime: null,
      push: special.push,
      stunSeconds: targetIsHeavy ? special.heavyStunSeconds : special.stunSeconds,
      markSeconds: 0,
    });
  }
  if (unitKind === "babayaga") {
    const special = UNIT_SPECIALS[unitKind];
    const specialTarget = isBabayagaPriorityTarget(targetKind);
    return Object.freeze({
      effect: specialTarget ? unitKind : null,
      radius: 0,
      secondaryTargetIds: Object.freeze([]),
      secondaryMultiplier: 0,
      damageOverTime: null,
      push: 0,
      stunSeconds: 0,
      markSeconds: specialTarget ? special.analysisMarkSeconds : 0,
    });
  }
  return Object.freeze({ effect: null, radius: 0, secondaryTargetIds: Object.freeze([]), secondaryMultiplier: 0, damageOverTime: null, push: 0, stunSeconds: 0, markSeconds: 0 });
}

export function resolveNewcomerAttackEffects({
  unitKind,
  target,
  nearbyTargets = [],
  attackDamage = 0,
  targetIsHeavy = false,
  areaRadius = null,
} = {}) {
  if (!target || target.id === undefined) throw new TypeError("A primary target is required");
  const eligibleSecondaries = new Map(
    (Array.isArray(nearbyTargets) ? nearbyTargets : [])
      .filter((candidate) => candidate && candidate.id !== undefined && candidate.id !== target.id)
      .map((candidate) => [candidate.id, candidate]),
  );
  const payload = newcomerAttackPayload({
    unitKind,
    targetKind: target.kind,
    targetIsHeavy,
    nearbyTargetIds: [...eligibleSecondaries.keys()],
    areaRadius,
  });
  const applyPrimaryStatus = (entity) => ({
    ...entity,
    bleedRemaining: payload.damageOverTime
      ? Math.max(Number(entity.bleedRemaining) || 0, payload.damageOverTime.seconds)
      : Number(entity.bleedRemaining) || 0,
    bleedDamagePerSecond: payload.damageOverTime
      ? Math.max(Number(entity.bleedDamagePerSecond) || 0, payload.damageOverTime.damage)
      : Number(entity.bleedDamagePerSecond) || 0,
    knock: Math.max(Number(entity.knock) || 0, payload.push),
    stunned: Math.max(Number(entity.stunned) || 0, payload.stunSeconds),
    marked: Math.max(Number(entity.marked) || 0, payload.markSeconds),
  });
  const secondaryDamage = Math.max(0, Number(attackDamage) || 0) * payload.secondaryMultiplier;
  const secondaryTargets = payload.secondaryTargetIds
    .map((id) => eligibleSecondaries.get(id))
    .filter(Boolean)
    .map((entity) => ({
      ...applyPrimaryStatus(entity),
      hp: (Number(entity.hp) || 0) - secondaryDamage,
      flash: Math.max(Number(entity.flash) || 0, 0.1),
    }));
  return Object.freeze({
    payload,
    target: Object.freeze(applyPrimaryStatus(target)),
    secondaryTargets: Object.freeze(secondaryTargets.map((entity) => Object.freeze(entity))),
    secondaryDamage,
  });
}

export function advanceBleedDamage(fighter, seconds) {
  const elapsed = Math.max(0, Number(seconds) || 0);
  const remaining = Math.max(0, Number(fighter?.bleedRemaining) || 0);
  const damagePerSecond = Math.max(0, Number(fighter?.bleedDamagePerSecond) || 0);
  const activeSeconds = Math.min(elapsed, remaining);
  const hp = Math.max(0, (Number(fighter?.hp) || 0) - damagePerSecond * activeSeconds);
  const bleedRemaining = Math.max(0, remaining - elapsed);
  return Object.freeze({
    ...fighter,
    hp,
    bleedRemaining,
    bleedDamagePerSecond: bleedRemaining > 0 ? damagePerSecond : 0,
  });
}

export function advanceAttackCooldown(cooldown, dt) {
  return Math.max(0, (Number(cooldown) || 0) - Math.max(0, Number(dt) || 0));
}

export function crawlerThreatLevel(nearestEnemyX) {
  if (!Number.isFinite(nearestEnemyX)) return 0;
  return Math.max(0, Math.min(1, (WORLD_GEOMETRY.threatStartX - nearestEnemyX) / 280));
}
