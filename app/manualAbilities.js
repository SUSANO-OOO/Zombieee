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
  tky: {
    unitId: "unit-tky",
    displayName: "光刃解放",
    iconMotif: "released-light-blade",
    runtimeStatus: "integrated",
    cooldownSeconds: 16,
    windupSeconds: .62,
    reach: 190,
    effectHalfHeight: 76,
    impactDamage: 70,
    knockback: 22,
    stunSeconds: 1.1,
  },
  "mrs-chiha": {
    unitId: "unit-mrs-chiha",
    displayName: "全弾制圧",
    iconMotif: "rotary-gun-sweep",
    runtimeStatus: "integrated",
    cooldownSeconds: 19,
    windupSeconds: 1.05,
    minRange: 55,
    maxRange: 310,
    launcherBashRange: 55,
    launcherBashDamageMultiplier: .72,
    grenadeRadius: 54,
    grenadeSplashMultiplier: .5,
    effectRadius: 70,
    salvoCount: 4,
    salvoIntervalSeconds: .22,
    projectileTravelSeconds: .18,
    recoverySeconds: .3,
    impactDamage: 32,
    finalDamageMultiplier: 1.45,
    finalKnockback: 26,
  },
  "miyamoto-musashi": {
    unitId: "unit-miyamoto-musashi",
    displayName: "二天一流・無空",
    iconMotif: "crossed-dual-blades",
    runtimeStatus: "integrated",
    cooldownSeconds: 20,
    windupSeconds: .22,
    guardSeconds: 3.2,
    fallbackRange: 135,
    counterDamage: 88,
    bossDamageMultiplier: 1.65,
    counterStunSeconds: .9,
  },
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
    guardRemaining: 0,
    salvoIndex: 0,
    abilityElapsed: 0,
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

function facingDirection(owner) {
  return Number(owner?.aiMoveDirection) < -.05 ? -1 : 1;
}

export function selectTkyAbilityTarget({
  owner,
  fighters = [],
  reach = MANUAL_ABILITY_REGISTRY.tky.reach,
  effectHalfHeight = MANUAL_ABILITY_REGISTRY.tky.effectHalfHeight,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const direction = facingDirection(owner);
  const candidates = fighters.filter(livingTarget).filter((candidate) => {
    const forward = (Number(candidate.x) - Number(owner.x)) * direction;
    return forward >= -8
      && forward <= reach
      && Math.abs(Number(candidate.y) - Number(owner.y)) <= effectHalfHeight;
  });
  if (candidates.length === 0) return null;
  const orderedIds = candidates.map(({ id }) => id).sort((left, right) => String(left).localeCompare(String(right)));
  return Object.freeze({
    x: Number(owner.x) + direction * reach * .58,
    y: Number(owner.y),
    lane: owner.lane,
    originX: Number(owner.x),
    originY: Number(owner.y),
    direction,
    targetIds: Object.freeze(orderedIds),
  });
}

export function selectMrsChihaAbilityTarget({
  owner,
  fighters = [],
  minRange = MANUAL_ABILITY_REGISTRY["mrs-chiha"].minRange,
  maxRange = MANUAL_ABILITY_REGISTRY["mrs-chiha"].maxRange,
  effectRadius = MANUAL_ABILITY_REGISTRY["mrs-chiha"].effectRadius,
  salvoCount = MANUAL_ABILITY_REGISTRY["mrs-chiha"].salvoCount,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .filter((candidate) => {
      const range = distance(owner, candidate);
      return range >= minRange && range <= maxRange;
    });
  if (candidates.length === 0) return null;
  const ranked = candidates.map((candidate) => {
    const hits = candidates.filter((other) => distance(candidate, other) <= effectRadius);
    return {
      targetId: candidate.id,
      x: Number(candidate.x),
      y: Number(candidate.y),
      lane: candidate.lane,
      hitCount: hits.length,
      totalHp: hits.reduce((sum, target) => sum + Math.max(0, Number(target.hp) || 0), 0),
      ownerDistance: distance(owner, candidate),
    };
  }).sort((left, right) => (
    right.hitCount - left.hitCount
    || right.totalHp - left.totalHp
    || left.ownerDistance - right.ownerDistance
    || String(left.targetId).localeCompare(String(right.targetId))
  ));
  const points = [];
  for (const candidate of ranked) {
    if (points.some((point) => distance(point, candidate) < effectRadius * .72)) continue;
    points.push(Object.freeze(candidate));
    if (points.length >= salvoCount) break;
  }
  while (points.length < salvoCount) points.push(points[points.length % Math.max(1, points.length)]);
  return Object.freeze({
    x: points[0].x,
    y: points[0].y,
    lane: points[0].lane,
    points: Object.freeze(points),
  });
}

export function selectMusashiAbilityTarget({
  owner,
  fighters = [],
  fallbackRange = MANUAL_ABILITY_REGISTRY["miyamoto-musashi"].fallbackRange,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .filter((candidate) => distance(owner, candidate) <= fallbackRange)
    .map((candidate) => ({
      targetId: candidate.id,
      x: Number(candidate.x),
      y: Number(candidate.y),
      lane: candidate.lane,
      isBoss: candidate.isBoss === true || candidate.boss === true || ["takuya", "gate-eater"].includes(candidate.kind),
      ownerDistance: distance(owner, candidate),
    }))
    .sort((left, right) => (
      Number(right.isBoss) - Number(left.isBoss)
      || left.ownerDistance - right.ownerDistance
      || String(left.targetId).localeCompare(String(right.targetId))
    ));
  return candidates.length > 0 ? Object.freeze(candidates[0]) : null;
}

export function selectManualAbilityTarget({ owner, fighters = [] } = {}) {
  if (owner?.kind === "zakimiya") return selectZakimiyaAbilityTarget({ owner, fighters });
  if (owner?.kind === "tky") return selectTkyAbilityTarget({ owner, fighters });
  if (owner?.kind === "mrs-chiha") return selectMrsChihaAbilityTarget({ owner, fighters });
  if (owner?.kind === "miyamoto-musashi") return selectMusashiAbilityTarget({ owner, fighters });
  return null;
}

export function canActivateManualAbility({ fighter, fighters = [] } = {}) {
  if (!fighter?.manualAbility
    || fighter.manualAbility.phase !== "ready"
    || fighter.side !== "human"
    || Number(fighter.hp) <= 0
    || fighter.combatReady !== true
    || fighter.gateEntering === true) return false;
  return selectManualAbilityTarget({ owner: fighter, fighters }) !== null;
}

export function manualAbilityLocksNormalAction(runtime) {
  return ["windup", "salvo", "guard", "recovery"].includes(runtime?.phase);
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
      guardRemaining: 0,
      salvoIndex: 0,
      abilityElapsed: 0,
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
  if (runtime.kind === "mrs-chiha") {
    return advanceMrsChihaAbility(runtime, elapsed);
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
    if (runtime.kind === "miyamoto-musashi") {
      if (overflow < definition.guardSeconds) {
        return Object.freeze({
          runtime: Object.freeze({
            ...runtime,
            phase: "guard",
            windupRemaining: 0,
            guardRemaining: definition.guardSeconds - overflow,
          }),
          events: Object.freeze([Object.freeze({
            type: "guard-start",
            kind: runtime.kind,
            activationId: runtime.activationId,
            target: runtime.target,
          })]),
        });
      }
      const cooldownOverflow = overflow - definition.guardSeconds;
      return Object.freeze({
        runtime: Object.freeze({
          ...runtime,
          phase: cooldownOverflow >= definition.cooldownSeconds ? "ready" : "cooldown",
          windupRemaining: 0,
          guardRemaining: 0,
          cooldownRemaining: Math.max(0, definition.cooldownSeconds - cooldownOverflow),
          target: null,
        }),
        events: Object.freeze([Object.freeze({
          type: "impact",
          kind: runtime.kind,
          mode: "fallback",
          activationId: runtime.activationId,
          target: runtime.target,
        })]),
      });
    }
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
  if (runtime.phase === "guard") {
    const remaining = runtime.guardRemaining - elapsed;
    if (remaining > 0) {
      return Object.freeze({
        runtime: Object.freeze({ ...runtime, guardRemaining: remaining }),
        events: Object.freeze([]),
      });
    }
    const overflow = Math.max(0, -remaining);
    return Object.freeze({
      runtime: Object.freeze({
        ...runtime,
        phase: overflow >= definition.cooldownSeconds ? "ready" : "cooldown",
        guardRemaining: 0,
        cooldownRemaining: Math.max(0, definition.cooldownSeconds - overflow),
        target: null,
      }),
      events: Object.freeze([Object.freeze({
        type: "impact",
        kind: runtime.kind,
        mode: "fallback",
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

function advanceMrsChihaAbility(runtime, elapsedSeconds) {
  const definition = MANUAL_ABILITY_REGISTRY["mrs-chiha"];
  if (runtime.phase === "cooldown") {
    const cooldownRemaining = Math.max(0, runtime.cooldownRemaining - elapsedSeconds);
    return Object.freeze({
      runtime: Object.freeze({
        ...runtime,
        phase: cooldownRemaining > 0 ? "cooldown" : "ready",
        cooldownRemaining,
        abilityElapsed: cooldownRemaining > 0 ? runtime.abilityElapsed : 0,
      }),
      events: Object.freeze([]),
    });
  }
  const currentElapsed = Math.max(0, Number(runtime.abilityElapsed) || 0);
  const nextElapsed = currentElapsed + elapsedSeconds;
  const points = runtime.target?.points ?? [];
  const timeline = points.flatMap((point, salvoIndex) => {
    const launchAt = definition.windupSeconds + definition.salvoIntervalSeconds * salvoIndex;
    const impactAt = launchAt + definition.projectileTravelSeconds;
    return [
      { type: "launch", at: launchAt, point, salvoIndex, finalRound: false },
      { type: "impact", at: impactAt, point, salvoIndex, finalRound: salvoIndex === points.length - 1 },
    ];
  }).sort((left, right) => left.at - right.at || left.type.localeCompare(right.type));
  const events = timeline
    .filter(({ at }) => at > currentElapsed + Number.EPSILON && at <= nextElapsed + Number.EPSILON)
    .map(({ type, at, point, salvoIndex, finalRound }) => Object.freeze({
      type,
      kind: runtime.kind,
      activationId: runtime.activationId,
      salvoIndex,
      finalRound,
      timelineAt: at,
      target: point,
    }));
  const finalLaunchAt = definition.windupSeconds
    + definition.salvoIntervalSeconds * Math.max(0, points.length - 1);
  const finalImpactAt = finalLaunchAt + definition.projectileTravelSeconds;
  const recoveryEndAt = finalImpactAt + definition.recoverySeconds;
  const launchedCount = timeline.filter(({ type, at }) => type === "launch" && at <= nextElapsed + Number.EPSILON).length;
  let nextRuntime;
  if (nextElapsed < definition.windupSeconds) {
    nextRuntime = {
      ...runtime,
      phase: "windup",
      windupRemaining: definition.windupSeconds - nextElapsed,
      abilityElapsed: nextElapsed,
    };
  } else if (nextElapsed < finalImpactAt) {
    nextRuntime = {
      ...runtime,
      phase: "salvo",
      windupRemaining: Math.max(0, finalImpactAt - nextElapsed),
      salvoIndex: Math.min(points.length, launchedCount),
      abilityElapsed: nextElapsed,
    };
  } else if (nextElapsed < recoveryEndAt) {
    nextRuntime = {
      ...runtime,
      phase: "recovery",
      windupRemaining: recoveryEndAt - nextElapsed,
      salvoIndex: points.length,
      abilityElapsed: nextElapsed,
    };
  } else {
    const cooldownOverflow = nextElapsed - recoveryEndAt;
    const cooldownRemaining = Math.max(0, definition.cooldownSeconds - cooldownOverflow);
    nextRuntime = {
      ...runtime,
      phase: cooldownRemaining > 0 ? "cooldown" : "ready",
      windupRemaining: 0,
      salvoIndex: 0,
      cooldownRemaining,
      abilityElapsed: cooldownRemaining > 0 ? recoveryEndAt : 0,
      target: null,
    };
  }
  return Object.freeze({ runtime: Object.freeze(nextRuntime), events: Object.freeze(events) });
}

export function triggerMusashiCounter(runtime) {
  const definition = MANUAL_ABILITY_REGISTRY["miyamoto-musashi"];
  if (runtime?.kind !== "miyamoto-musashi" || runtime.phase !== "guard") {
    return Object.freeze({ ok: false, runtime, event: null });
  }
  return Object.freeze({
    ok: true,
    runtime: Object.freeze({
      ...runtime,
      phase: "cooldown",
      guardRemaining: 0,
      cooldownRemaining: definition.cooldownSeconds,
      target: null,
    }),
    event: Object.freeze({
      type: "impact",
      kind: runtime.kind,
      mode: "counter",
      activationId: runtime.activationId,
      target: runtime.target,
    }),
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
  Object.freeze([-118, -8]),
  Object.freeze([118, -8]),
  Object.freeze([-76, -88]),
  Object.freeze([76, -88]),
  Object.freeze([0, -108]),
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
    if (!placed) {
      const grid = [];
      const gap = 6;
      for (let y = topInset; y <= height - bottomInset - hitSize; y += hitSize + gap) {
        for (let x = leftInset; x <= width - rightInset - hitSize; x += hitSize + gap) {
          grid.push({
            x,
            y,
            width: hitSize,
            height: hitSize,
            distance: Math.hypot(x + hitSize / 2 - anchorX, y + hitSize / 2 - anchorY),
          });
        }
      }
      grid.sort((left, right) => left.distance - right.distance || left.y - right.y || left.x - right.x);
      const fallback = grid.find((rect) => !blocked.some((obstacle) => overlaps(rect, obstacle)));
      if (fallback) placed = {
        x: fallback.x,
        y: fallback.y,
        width: fallback.width,
        height: fallback.height,
      };
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
