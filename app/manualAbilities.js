import { deepFreeze } from "./content/freeze.js";

export const MANUAL_ABILITY_REGISTRY = deepFreeze({
  brawler: { unitId: "unit-paisen", displayName: "気合連打", iconMotif: "fist-combo", runtimeStatus: "foundation" },
  scout: { unitId: "unit-hachi", displayName: "疾駆迎撃", iconMotif: "crowbar-dash", runtimeStatus: "foundation" },
  ranger: { unitId: "unit-mizuchi", displayName: "精密排除", iconMotif: "rifle-crosshair", runtimeStatus: "foundation" },
  medic: { unitId: "unit-nao", displayName: "緊急処置", iconMotif: "medical-cross", runtimeStatus: "foundation" },
  brute: { unitId: "unit-tatara", displayName: "地砕衝", iconMotif: "hammer-impact", runtimeStatus: "foundation" },
  "crazy-king": { unitId: "unit-crazy-king", displayName: "狂王暴走", iconMotif: "chainsaw-crown", runtimeStatus: "foundation" },
  kumaverson: { unitId: "unit-kumaverson", displayName: "鉄鍋仁王立ち", iconMotif: "pan-guard", runtimeStatus: "foundation" },
  babayaga: { unitId: "unit-babayaga", displayName: "弱点査定", iconMotif: "weak-point-ledger", runtimeStatus: "foundation" },
  gunner: { unitId: "unit-raider", displayName: "制圧掃射", iconMotif: "machine-gun-fan", runtimeStatus: "foundation" },
  guardian: { unitId: "unit-gantetsu", displayName: "鉄壁展開", iconMotif: "shield-wall", runtimeStatus: "foundation" },
  engineer: { unitId: "unit-monkey", displayName: "即席捕縛罠", iconMotif: "tripwire-trap", runtimeStatus: "foundation" },
  zakimiya: {
    unitId: "unit-zakimiya",
    displayName: "火酒投擲",
    iconMotif: "burning-whisky-bottle-arc",
    runtimeStatus: "integrated",
    cooldownSeconds: 14,
    windupSeconds: .56,
    throwRange: 270,
    effectRadius: 82,
    impactDamage: 42,
    burnDamagePerSecond: 8,
    burnSeconds: 5,
  },
  tky: { unitId: "unit-tky", displayName: "光刃解放", iconMotif: "released-light-blade", runtimeStatus: "foundation" },
  "mrs-chiha": { unitId: "unit-mrs-chiha", displayName: "全弾制圧", iconMotif: "rotary-gun-sweep", runtimeStatus: "foundation" },
  "miyamoto-musashi": { unitId: "unit-miyamoto-musashi", displayName: "二天一流・無空", iconMotif: "crossed-dual-blades", runtimeStatus: "foundation" },
  "mayo-chan": { unitId: "unit-mayo-chan", displayName: "凶暴マヨ", iconMotif: "chihuahua-infection-bloom", runtimeStatus: "foundation" },
});

export function manualAbilityDefinitionFor(kind) {
  return MANUAL_ABILITY_REGISTRY[kind] ?? null;
}

export function createManualAbilityRuntime(kind) {
  const definition = manualAbilityDefinitionFor(kind);
  if (!definition) return null;
  return Object.freeze({
    kind,
    phase: "ready",
    cooldownRemaining: 0,
    windupRemaining: 0,
    activationId: 0,
    target: null,
  });
}

function livingTarget(candidate) {
  return candidate?.side === "zombie"
    && Number(candidate.hp) > 0
    && candidate.combatReady === true
    && candidate.contained !== true
    && candidate.targetable !== false;
}

function distance(left, right) {
  return Math.hypot(Number(left.x) - Number(right.x), Number(left.y) - Number(right.y));
}

export function selectZakimiyaAbilityTarget({
  owner,
  fighters = [],
  throwRange = MANUAL_ABILITY_REGISTRY.zakimiya.throwRange,
  effectRadius = MANUAL_ABILITY_REGISTRY.zakimiya.effectRadius,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .filter((candidate) => distance(owner, candidate) <= throwRange);
  if (candidates.length === 0) return null;
  const ranked = candidates.map((candidate) => {
    const hits = candidates.filter((other) => distance(candidate, other) <= effectRadius);
    const totalHp = hits.reduce((sum, target) => sum + Math.max(0, Number(target.hp) || 0), 0);
    return {
      targetId: candidate.id,
      x: Number(candidate.x),
      y: Number(candidate.y),
      lane: candidate.lane,
      hitCount: hits.length,
      totalHp,
      ownerDistance: distance(owner, candidate),
    };
  }).sort((left, right) => (
    right.hitCount - left.hitCount
    || right.totalHp - left.totalHp
    || left.ownerDistance - right.ownerDistance
    || String(left.targetId).localeCompare(String(right.targetId))
  ));
  return Object.freeze(ranked[0]);
}

export function canActivateManualAbility({ fighter, fighters = [] } = {}) {
  if (!fighter?.manualAbility
    || fighter.manualAbility.phase !== "ready"
    || fighter.side !== "human"
    || Number(fighter.hp) <= 0
    || fighter.combatReady !== true
    || fighter.gateEntering === true) return false;
  if (fighter.kind === "zakimiya") {
    return selectZakimiyaAbilityTarget({ owner: fighter, fighters }) !== null;
  }
  return false;
}

export function beginManualAbility(runtime, target) {
  const definition = manualAbilityDefinitionFor(runtime?.kind);
  if (!definition || definition.runtimeStatus !== "integrated" || runtime.phase !== "ready" || !target) {
    return Object.freeze({ ok: false, runtime, activationId: runtime?.activationId ?? 0 });
  }
  const activationId = runtime.activationId + 1;
  return Object.freeze({
    ok: true,
    activationId,
    runtime: Object.freeze({
      ...runtime,
      phase: "windup",
      windupRemaining: definition.windupSeconds,
      activationId,
      target: Object.freeze({ ...target }),
    }),
  });
}

export function advanceManualAbility(runtime, seconds) {
  const definition = manualAbilityDefinitionFor(runtime?.kind);
  if (!definition || definition.runtimeStatus !== "integrated") {
    return Object.freeze({ runtime, events: Object.freeze([]) });
  }
  const elapsed = Math.max(0, Number(seconds) || 0);
  if (elapsed === 0 || runtime.phase === "ready") {
    return Object.freeze({ runtime, events: Object.freeze([]) });
  }
  if (runtime.phase === "windup") {
    const remaining = runtime.windupRemaining - elapsed;
    if (remaining > 0) {
      return Object.freeze({
        runtime: Object.freeze({ ...runtime, windupRemaining: remaining }),
        events: Object.freeze([]),
      });
    }
    const overflow = Math.max(0, -remaining);
    return Object.freeze({
      runtime: Object.freeze({
        ...runtime,
        phase: overflow >= definition.cooldownSeconds ? "ready" : "cooldown",
        windupRemaining: 0,
        cooldownRemaining: Math.max(0, definition.cooldownSeconds - overflow),
        target: null,
      }),
      events: Object.freeze([Object.freeze({
        type: "impact",
        kind: runtime.kind,
        activationId: runtime.activationId,
        target: runtime.target,
      })]),
    });
  }
  const cooldownRemaining = Math.max(0, runtime.cooldownRemaining - elapsed);
  return Object.freeze({
    runtime: Object.freeze({
      ...runtime,
      phase: cooldownRemaining > 0 ? "cooldown" : "ready",
      cooldownRemaining,
    }),
    events: Object.freeze([]),
  });
}

function normalizeRect(rect) {
  const x = Number(rect?.x ?? rect?.left) || 0;
  const y = Number(rect?.y ?? rect?.top) || 0;
  const width = Math.max(0, Number(rect?.width ?? (Number(rect?.right) - x)) || 0);
  const height = Math.max(0, Number(rect?.height ?? (Number(rect?.bottom) - y)) || 0);
  return Object.freeze({ x, y, width, height });
}

function overlaps(left, right, gap = 4) {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y;
}

const ICON_OFFSETS = Object.freeze([
  Object.freeze([0, -14]),
  Object.freeze([-36, -12]),
  Object.freeze([36, -12]),
  Object.freeze([-62, -4]),
  Object.freeze([62, -4]),
  Object.freeze([-36, -54]),
  Object.freeze([36, -54]),
  Object.freeze([0, -70]),
  Object.freeze([-90, 20]),
  Object.freeze([90, 20]),
  Object.freeze([-90, -34]),
  Object.freeze([90, -34]),
]);

export function layoutManualAbilityIcons({
  fighters = [],
  obstacles = [],
  worldWidth = 960,
  worldHeight = 540,
  displayWidth,
  displayHeight,
  safeInsets = {},
  hitSize = 44,
} = {}) {
  const width = Math.max(hitSize, Number(displayWidth) || worldWidth);
  const height = Math.max(hitSize, Number(displayHeight) || worldHeight);
  const leftInset = Math.max(0, Number(safeInsets.left) || 0);
  const rightInset = Math.max(0, Number(safeInsets.right) || 0);
  const topInset = Math.max(0, Number(safeInsets.top) || 0);
  const bottomInset = Math.max(0, Number(safeInsets.bottom) || 0);
  const blocked = obstacles.map(normalizeRect);
  const result = [];
  const ordered = [...fighters].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  for (const fighter of ordered) {
    const anchorX = Number.isFinite(Number(fighter.screenX))
      ? Number(fighter.screenX)
      : Number(fighter.x) / worldWidth * width;
    const anchorY = Number.isFinite(Number(fighter.screenY))
      ? Number(fighter.screenY)
      : Number(fighter.headY ?? fighter.y) / worldHeight * height;
    let placed = null;
    for (const [offsetX, offsetY] of ICON_OFFSETS) {
      const x = Math.max(leftInset, Math.min(width - rightInset - hitSize, anchorX - hitSize / 2 + offsetX));
      const y = Math.max(topInset, Math.min(height - bottomInset - hitSize, anchorY - hitSize + offsetY));
      const rect = { x, y, width: hitSize, height: hitSize };
      if (blocked.some((obstacle) => overlaps(rect, obstacle))) continue;
      placed = rect;
      break;
    }
    if (!placed) continue;
    blocked.push(placed);
    result.push(Object.freeze({
      fighterId: fighter.id,
      kind: fighter.kind,
      x: placed.x,
      y: placed.y,
      hitSize,
      anchorX,
      anchorY,
    }));
  }
  return Object.freeze(result);
}
