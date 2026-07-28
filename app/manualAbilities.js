import { deepFreeze } from "./content/freeze.js";

export const MANUAL_ABILITY_REGISTRY = deepFreeze({
  brawler: {
    unitId: "unit-paisen",
    displayName: "気合連打",
    summary: "最寄りの敵へ踏み込み連続拳打。最終打で周囲を押し戻す。",
    iconMotif: "fist-combo",
    runtimeStatus: "integrated",
    cooldownSeconds: 12,
    windupSeconds: .26,
    range: 150,
    impactDamage: 56,
    hitCount: 5,
    finalKnockback: 19,
    finalKnockbackRadius: 82,
  },
  scout: {
    unitId: "unit-hachi",
    displayName: "疾駆迎撃",
    summary: "高速型や突破中の敵を優先して急接近し、バールで怯ませる。",
    iconMotif: "crowbar-dash",
    runtimeStatus: "integrated",
    cooldownSeconds: 13,
    windupSeconds: .24,
    maxRange: 300,
    impactDamage: 58,
    stunSeconds: 1.2,
    stopDistance: 34,
  },
  ranger: {
    unitId: "unit-mizuchi",
    displayName: "精密排除",
    summary: "遠距離・特殊・高HPの敵を自動選択し、高威力の貫通射撃を行う。",
    iconMotif: "rifle-crosshair",
    runtimeStatus: "integrated",
    cooldownSeconds: 16,
    windupSeconds: .5,
    maxRange: 390,
    effectHalfHeight: 34,
    impactDamage: 92,
    penetrationMultiplier: .65,
  },
  medic: {
    unitId: "unit-nao",
    displayName: "緊急処置",
    summary: "射程内でHP割合が最も低い味方を回復し、短時間守る。",
    iconMotif: "medical-cross",
    runtimeStatus: "integrated",
    cooldownSeconds: 15,
    windupSeconds: .35,
    range: 240,
    healRatio: .32,
    protectionSeconds: 4,
    protectionMultiplier: .72,
  },
  brute: {
    unitId: "unit-tatara",
    displayName: "地砕衝",
    summary: "前方へ踏み込み地面を叩き、範囲ダメージ・怯み・装甲低下を与える。",
    iconMotif: "hammer-impact",
    runtimeStatus: "integrated",
    cooldownSeconds: 18,
    windupSeconds: .55,
    range: 115,
    effectRadius: 102,
    impactDamage: 78,
    stunSeconds: 1.1,
    armorBreakSeconds: 5,
    structureImpactMultiplier: .65,
  },
  "crazy-king": {
    unitId: "unit-crazy-king",
    displayName: "狂王暴走",
    summary: "短時間、移動と攻撃を高速化し、近接範囲を切り裂き続ける。",
    iconMotif: "chainsaw-crown",
    runtimeStatus: "integrated",
    cooldownSeconds: 22,
    windupSeconds: .45,
    range: 210,
    activeSeconds: 5.2,
    damageMultiplier: 1.35,
    moveSpeedMultiplier: 1.45,
    attackIntervalMultiplier: .62,
    areaRadius: 70,
    knockResistanceMultiplier: .22,
  },
  kumaverson: {
    unitId: "unit-kumaverson",
    displayName: "鉄鍋仁王立ち",
    summary: "周囲の敵を引きつけ、被ダメージを抑えながら徐々に回復する。",
    iconMotif: "pan-guard",
    runtimeStatus: "integrated",
    cooldownSeconds: 20,
    windupSeconds: .35,
    activeSeconds: 6,
    tauntRadius: 180,
    damageTakenMultiplier: .55,
    healRatioPerSecond: .025,
  },
  babayaga: {
    unitId: "unit-babayaga",
    displayName: "弱点査定",
    summary: "危険な敵を自動査定して狙撃し、一定時間弱点を露出させる。",
    iconMotif: "weak-point-ledger",
    runtimeStatus: "integrated",
    cooldownSeconds: 17,
    windupSeconds: .4,
    maxRange: 360,
    impactDamage: 65,
    markSeconds: 6,
  },
  gunner: {
    unitId: "unit-raider",
    displayName: "制圧掃射",
    summary: "前方の敵群を連続射撃し、移動と攻撃の勢いを抑える。",
    iconMotif: "machine-gun-fan",
    runtimeStatus: "integrated",
    cooldownSeconds: 18,
    windupSeconds: .55,
    range: 330,
    effectHalfHeight: 35,
    impactDamage: 22,
    burstCount: 5,
    suppressionSeconds: 3,
    suppressionMultiplier: .55,
  },
  guardian: {
    unitId: "unit-gantetsu",
    displayName: "鉄壁展開",
    summary: "敵を引きつけ、自身と周囲の味方の被ダメージを軽減する。",
    iconMotif: "shield-wall",
    runtimeStatus: "integrated",
    cooldownSeconds: 22,
    windupSeconds: .45,
    activeSeconds: 6,
    tauntRadius: 190,
    protectionRadius: 170,
    selfDamageTakenMultiplier: .42,
    allyDamageTakenMultiplier: .68,
  },
  engineer: {
    unitId: "unit-monkey",
    displayName: "即席捕縛罠",
    summary: "敵の進路へ罠を自動設置し、捕縛後も移動を鈍らせる。",
    iconMotif: "tripwire-trap",
    runtimeStatus: "integrated",
    cooldownSeconds: 16,
    windupSeconds: .35,
    range: 280,
    effectRadius: 58,
    bindSeconds: 1.35,
    slowSeconds: 3.2,
  },
  zakimiya: {
    unitId: "unit-zakimiya",
    displayName: "火酒投擲",
    summary: "敵が最も密集する地点へ火酒を投げ、炎上領域を残す。",
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
    summary: "光刃を巨大化して前方を薙ぎ払い、群体を押し戻して怯ませる。",
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
    summary: "複数の敵密集地点へ榴弾を連射し、最終弾で強く押し戻す。",
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
    summary: "近接・予告攻撃を受け流して交差斬り。未被弾時は踏み込み斬り。",
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
  "mayo-chan": {
    unitId: "unit-mayo-chan",
    displayName: "凶暴マヨ",
    summary: "HPを消耗しながら高速化して敵を連続攻撃し、安全下限で退避する。",
    iconMotif: "chihuahua-infection-bloom",
    runtimeStatus: "integrated",
    cooldownSeconds: 34,
    windupSeconds: .3,
    activeSeconds: 6.2,
    moveSpeedMultiplier: 1.75,
    attackIntervalMultiplier: .48,
    hpDrainPerSecond: 7,
    safeHpRatio: .2,
    biteSlowMultiplier: .72,
    biteSlowSeconds: 1.1,
  },
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
    activeRemaining: 0,
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

function livingAlly(candidate) {
  return candidate?.side === "human"
    && Number(candidate.hp) > 0
    && candidate.combatReady === true
    && candidate.targetable !== false
    && !candidate.mayoRetreat;
}

function distance(left, right) {
  return Math.hypot(Number(left.x) - Number(right.x), Number(left.y) - Number(right.y));
}

function stableId(left, right) {
  return String(left).localeCompare(String(right));
}

function bossTarget(candidate) {
  return candidate?.isBoss === true
    || candidate?.boss === true
    || ["takuya", "gate-eater", "kurome", "mother", "ooguchi", "gairen", "futago"].includes(candidate?.kind);
}

const FAST_ENEMY_KINDS = Object.freeze(["runner", "sprinter", "turned", "spindle", "pall-manta"]);
const RANGED_SPECIAL_KINDS = Object.freeze([
  "spitter",
  "ooze",
  "shade",
  "resonator",
  "choir-knot",
  "anchor-bloom",
]);

function threatPriority(candidate) {
  if (bossTarget(candidate)) return 4;
  if (RANGED_SPECIAL_KINDS.includes(candidate?.kind)) return 3;
  if (FAST_ENEMY_KINDS.includes(candidate?.kind)) return 2;
  return ["crusher", "abomination", "grappler", "cagewalker"].includes(candidate?.kind) ? 1 : 0;
}

function forwardCandidates(owner, fighters, range, effectHalfHeight = Infinity) {
  const direction = facingDirection(owner);
  return fighters.filter(livingTarget).filter((candidate) => {
    const forward = (Number(candidate.x) - Number(owner.x)) * direction;
    return forward >= -8
      && forward <= range
      && Math.abs(Number(candidate.y) - Number(owner.y)) <= effectHalfHeight;
  });
}

export function manualAbilityCheckpointCooldown(runtime) {
  const definition = manualAbilityDefinitionFor(runtime?.kind);
  if (!definition || runtime?.phase === "ready") return 0;
  if (runtime.phase === "cooldown") {
    return Math.max(0, Number(runtime.cooldownRemaining) || 0);
  }
  let remaining = Math.max(0, Number(definition.cooldownSeconds) || 0);
  if (runtime.phase === "windup") {
    remaining += Math.max(0, Number(runtime.windupRemaining) || 0);
    if (["crazy-king", "kumaverson", "guardian"].includes(runtime.kind)) {
      remaining += Math.max(0, Number(definition.activeSeconds) || 0);
    } else if (runtime.kind === "miyamoto-musashi") {
      remaining += Math.max(0, Number(definition.guardSeconds) || 0);
    } else if (runtime.kind === "mayo-chan") {
      remaining += Math.max(0, Number(definition.activeSeconds) || 0);
    } else if (runtime.kind === "mrs-chiha") {
      remaining += Math.max(0,
        Number(definition.salvoIntervalSeconds) * Math.max(0, Number(definition.salvoCount) - 1)
        + Number(definition.projectileTravelSeconds)
        + Number(definition.recoverySeconds),
      );
    }
  } else if (["active", "feral"].includes(runtime.phase)) {
    remaining += Math.max(0, Number(runtime.activeRemaining) || 0);
  } else if (runtime.phase === "guard") {
    remaining += Math.max(0, Number(runtime.guardRemaining) || 0);
  } else if (runtime.kind === "mrs-chiha" && ["salvo", "recovery"].includes(runtime.phase)) {
    const finalImpactAt = definition.windupSeconds
      + definition.salvoIntervalSeconds * Math.max(0, definition.salvoCount - 1)
      + definition.projectileTravelSeconds
      + definition.recoverySeconds;
    remaining += Math.max(0, finalImpactAt - (Number(runtime.abilityElapsed) || 0));
  }
  return Math.round(Math.min(3_600, remaining) * 1_000) / 1_000;
}

export function restoreManualAbilityCooldown(kind, seconds) {
  const runtime = createManualAbilityRuntime(kind);
  if (!runtime) return null;
  const cooldownRemaining = Math.max(0, Math.min(3_600, Number(seconds) || 0));
  if (cooldownRemaining <= 0) return runtime;
  return Object.freeze({
    ...runtime,
    phase: "cooldown",
    cooldownRemaining,
    target: null,
  });
}

function targetSnapshot(candidate, owner, extra = {}) {
  return {
    targetId: candidate.id,
    x: Number(candidate.x),
    y: Number(candidate.y),
    lane: candidate.lane,
    direction: Number(candidate.x) < Number(owner.x) ? -1 : 1,
    ownerDistance: distance(owner, candidate),
    ...extra,
  };
}

export function selectBrawlerAbilityTarget({
  owner,
  fighters = [],
  range = MANUAL_ABILITY_REGISTRY.brawler.range,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = forwardCandidates(owner, fighters, range)
    .map((candidate) => targetSnapshot(candidate, owner))
    .sort((left, right) => left.ownerDistance - right.ownerDistance || stableId(left.targetId, right.targetId));
  return candidates.length > 0 ? Object.freeze(candidates[0]) : null;
}

export function selectScoutAbilityTarget({
  owner,
  fighters = [],
  maxRange = MANUAL_ABILITY_REGISTRY.scout.maxRange,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .filter((candidate) => distance(owner, candidate) <= maxRange)
    .map((candidate) => targetSnapshot(candidate, owner, {
      fast: FAST_ENEMY_KINDS.includes(candidate.kind),
      breachDistance: Number(candidate.x),
      speed: Math.max(0, Number(candidate.speed) || 0),
    }))
    .sort((left, right) => (
      Number(right.fast) - Number(left.fast)
      || right.speed - left.speed
      || left.breachDistance - right.breachDistance
      || left.ownerDistance - right.ownerDistance
      || stableId(left.targetId, right.targetId)
    ));
  return candidates.length > 0 ? Object.freeze(candidates[0]) : null;
}

export function selectRangerAbilityTarget({
  owner,
  fighters = [],
  maxRange = MANUAL_ABILITY_REGISTRY.ranger.maxRange,
  effectHalfHeight = MANUAL_ABILITY_REGISTRY.ranger.effectHalfHeight,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .filter((candidate) => distance(owner, candidate) <= maxRange);
  if (candidates.length === 0) return null;
  const ranked = candidates.map((candidate) => targetSnapshot(candidate, owner, {
    priority: threatPriority(candidate),
    hp: Math.max(0, Number(candidate.hp) || 0),
  })).sort((left, right) => (
    right.priority - left.priority
    || right.hp - left.hp
    || left.ownerDistance - right.ownerDistance
    || stableId(left.targetId, right.targetId)
  ));
  const primary = ranked[0];
  const direction = primary.direction;
  const lineTargetIds = candidates
    .filter((candidate) => {
      const forward = (Number(candidate.x) - Number(owner.x)) * direction;
      return forward >= -8
        && forward <= maxRange
        && Math.abs(Number(candidate.y) - primary.y) <= effectHalfHeight;
    })
    .sort((left, right) => (
      (Number(left.x) - Number(owner.x)) * direction - (Number(right.x) - Number(owner.x)) * direction
      || stableId(left.id, right.id)
    ))
    .map(({ id }) => id);
  return Object.freeze({
    ...primary,
    targetIds: Object.freeze(lineTargetIds),
  });
}

export function selectMedicAbilityTarget({
  owner,
  fighters = [],
  range = MANUAL_ABILITY_REGISTRY.medic.range,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingAlly)
    .filter((candidate) => Number(candidate.hp) < Number(candidate.maxHp))
    .filter((candidate) => distance(owner, candidate) <= range)
    .map((candidate) => targetSnapshot(candidate, owner, {
      hpRatio: Number(candidate.hp) / Math.max(1, Number(candidate.maxHp) || 1),
      missingHp: Math.max(0, Number(candidate.maxHp) - Number(candidate.hp)),
    }))
    .sort((left, right) => (
      left.hpRatio - right.hpRatio
      || right.missingHp - left.missingHp
      || left.ownerDistance - right.ownerDistance
      || stableId(left.targetId, right.targetId)
    ));
  return candidates.length > 0 ? Object.freeze(candidates[0]) : null;
}

export function selectBruteAbilityTarget({
  owner,
  fighters = [],
  range = MANUAL_ABILITY_REGISTRY.brute.range,
  effectRadius = MANUAL_ABILITY_REGISTRY.brute.effectRadius,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = forwardCandidates(owner, fighters, range);
  if (candidates.length === 0) return null;
  const ranked = candidates.map((candidate) => {
    const hits = fighters.filter(livingTarget).filter((other) => distance(candidate, other) <= effectRadius);
    return targetSnapshot(candidate, owner, {
      targetIds: hits.map(({ id }) => id).sort(stableId),
      hitCount: hits.length,
      heavyCount: hits.filter((target) => threatPriority(target) > 0).length,
    });
  }).sort((left, right) => (
    right.hitCount - left.hitCount
    || right.heavyCount - left.heavyCount
    || left.ownerDistance - right.ownerDistance
    || stableId(left.targetId, right.targetId)
  ));
  return Object.freeze({
    ...ranked[0],
    targetIds: Object.freeze(ranked[0].targetIds),
  });
}

function selectSustainedFrontTarget({ owner, fighters, range, targetMode }) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .filter((candidate) => distance(owner, candidate) <= range)
    .map((candidate) => targetSnapshot(candidate, owner, { priority: threatPriority(candidate) }))
    .sort((left, right) => (
      right.priority - left.priority
      || left.ownerDistance - right.ownerDistance
      || stableId(left.targetId, right.targetId)
    ));
  if (candidates.length === 0) return null;
  return Object.freeze({
    ...candidates[0],
    mode: targetMode,
    targetIds: Object.freeze(candidates.map(({ targetId }) => targetId)),
  });
}

export function selectCrazyKingAbilityTarget({
  owner,
  fighters = [],
  range = MANUAL_ABILITY_REGISTRY["crazy-king"].range,
} = {}) {
  return selectSustainedFrontTarget({ owner, fighters, range, targetMode: "overdrive" });
}

export function selectKumaversonAbilityTarget({
  owner,
  fighters = [],
  tauntRadius = MANUAL_ABILITY_REGISTRY.kumaverson.tauntRadius,
} = {}) {
  return selectSustainedFrontTarget({ owner, fighters, range: tauntRadius, targetMode: "taunt" });
}

export function selectBabayagaAbilityTarget({
  owner,
  fighters = [],
  maxRange = MANUAL_ABILITY_REGISTRY.babayaga.maxRange,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .filter((candidate) => distance(owner, candidate) <= maxRange)
    .map((candidate) => targetSnapshot(candidate, owner, {
      priority: threatPriority(candidate),
      hp: Math.max(0, Number(candidate.hp) || 0),
    }))
    .sort((left, right) => (
      right.priority - left.priority
      || right.hp - left.hp
      || left.ownerDistance - right.ownerDistance
      || stableId(left.targetId, right.targetId)
    ));
  return candidates.length > 0 ? Object.freeze(candidates[0]) : null;
}

export function selectGunnerAbilityTarget({
  owner,
  fighters = [],
  range = MANUAL_ABILITY_REGISTRY.gunner.range,
  effectHalfHeight = MANUAL_ABILITY_REGISTRY.gunner.effectHalfHeight,
} = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const direction = facingDirection(owner);
  const targets = forwardCandidates(owner, fighters, range, effectHalfHeight)
    .sort((left, right) => (
      (Number(left.x) - Number(owner.x)) * direction - (Number(right.x) - Number(owner.x)) * direction
      || stableId(left.id, right.id)
    ));
  if (targets.length === 0) return null;
  return Object.freeze({
    ...targetSnapshot(targets[0], owner),
    originX: Number(owner.x),
    originY: Number(owner.y),
    direction,
    targetIds: Object.freeze(targets.map(({ id }) => id)),
  });
}

export function selectGuardianAbilityTarget({
  owner,
  fighters = [],
  tauntRadius = MANUAL_ABILITY_REGISTRY.guardian.tauntRadius,
} = {}) {
  return selectSustainedFrontTarget({ owner, fighters, range: tauntRadius, targetMode: "shield-wall" });
}

export function selectEngineerAbilityTarget({
  owner,
  fighters = [],
  range = MANUAL_ABILITY_REGISTRY.engineer.range,
} = {}) {
  if (!owner
    || Number(owner.hp) <= 0
    || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .filter((candidate) => distance(owner, candidate) <= range)
    .map((candidate) => targetSnapshot(candidate, owner, {
      fast: FAST_ENEMY_KINDS.includes(candidate.kind),
      speed: Math.max(0, Number(candidate.speed) || 0),
    }))
    .sort((left, right) => (
      Number(right.fast) - Number(left.fast)
      || right.speed - left.speed
      || left.x - right.x
      || left.ownerDistance - right.ownerDistance
      || stableId(left.targetId, right.targetId)
    ));
  if (candidates.length === 0) return null;
  const target = candidates[0];
  return Object.freeze({
    ...target,
    x: target.x - target.direction * 34,
    trapX: target.x - target.direction * 34,
    trapLane: target.lane,
  });
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
      isBoss: bossTarget(candidate),
      ownerDistance: distance(owner, candidate),
    }))
    .sort((left, right) => (
      Number(right.isBoss) - Number(left.isBoss)
      || left.ownerDistance - right.ownerDistance
      || String(left.targetId).localeCompare(String(right.targetId))
    ));
  return candidates.length > 0 ? Object.freeze(candidates[0]) : null;
}

const MAYO_PRIORITY_KINDS = Object.freeze(["runner", "turned", "sprinter", "walker"]);

export function selectMayoAbilityTarget({ owner, fighters = [] } = {}) {
  if (!owner || Number(owner.hp) <= 0 || owner.combatReady !== true) return null;
  const candidates = fighters
    .filter(livingTarget)
    .map((candidate) => ({
      targetId: candidate.id,
      x: Number(candidate.x),
      y: Number(candidate.y),
      lane: candidate.lane,
      direction: Number(candidate.x) < Number(owner.x) ? -1 : 1,
      priority: MAYO_PRIORITY_KINDS.includes(candidate.kind) ? 0 : candidate.isBoss === true || candidate.boss === true ? 2 : 1,
      ownerDistance: distance(owner, candidate),
    }))
    .sort((left, right) => (
      left.priority - right.priority
      || left.ownerDistance - right.ownerDistance
      || String(left.targetId).localeCompare(String(right.targetId))
    ));
  return candidates.length > 0 ? Object.freeze(candidates[0]) : null;
}

export function selectManualAbilityTarget({ owner, fighters = [] } = {}) {
  if (owner?.kind === "brawler") return selectBrawlerAbilityTarget({ owner, fighters });
  if (owner?.kind === "scout") return selectScoutAbilityTarget({ owner, fighters });
  if (owner?.kind === "ranger") return selectRangerAbilityTarget({ owner, fighters });
  if (owner?.kind === "medic") return selectMedicAbilityTarget({ owner, fighters });
  if (owner?.kind === "brute") return selectBruteAbilityTarget({ owner, fighters });
  if (owner?.kind === "crazy-king") return selectCrazyKingAbilityTarget({ owner, fighters });
  if (owner?.kind === "kumaverson") return selectKumaversonAbilityTarget({ owner, fighters });
  if (owner?.kind === "babayaga") return selectBabayagaAbilityTarget({ owner, fighters });
  if (owner?.kind === "gunner") return selectGunnerAbilityTarget({ owner, fighters });
  if (owner?.kind === "guardian") return selectGuardianAbilityTarget({ owner, fighters });
  if (owner?.kind === "engineer") return selectEngineerAbilityTarget({ owner, fighters });
  if (owner?.kind === "zakimiya") return selectZakimiyaAbilityTarget({ owner, fighters });
  if (owner?.kind === "tky") return selectTkyAbilityTarget({ owner, fighters });
  if (owner?.kind === "mrs-chiha") return selectMrsChihaAbilityTarget({ owner, fighters });
  if (owner?.kind === "miyamoto-musashi") return selectMusashiAbilityTarget({ owner, fighters });
  if (owner?.kind === "mayo-chan") return selectMayoAbilityTarget({ owner, fighters });
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
      activeRemaining: 0,
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
  if (runtime.kind === "mayo-chan") {
    return advanceMayoAbility(runtime, elapsed);
  }
  if (["crazy-king", "kumaverson", "guardian"].includes(runtime.kind)) {
    return advanceSustainedAbility(runtime, elapsed);
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

function advanceSustainedAbility(runtime, elapsedSeconds) {
  const definition = MANUAL_ABILITY_REGISTRY[runtime.kind];
  if (runtime.phase === "windup") {
    const remaining = runtime.windupRemaining - elapsedSeconds;
    if (remaining > 0) {
      return Object.freeze({
        runtime: Object.freeze({ ...runtime, windupRemaining: remaining }),
        events: Object.freeze([]),
      });
    }
    const overflow = Math.max(0, -remaining);
    const startEvent = Object.freeze({
      type: "active-start",
      kind: runtime.kind,
      activationId: runtime.activationId,
      target: runtime.target,
    });
    if (overflow < definition.activeSeconds) {
      return Object.freeze({
        runtime: Object.freeze({
          ...runtime,
          phase: "active",
          windupRemaining: 0,
          activeRemaining: definition.activeSeconds - overflow,
        }),
        events: Object.freeze([startEvent]),
      });
    }
    const cooldownOverflow = overflow - definition.activeSeconds;
    const cooldownRemaining = Math.max(0, definition.cooldownSeconds - cooldownOverflow);
    return Object.freeze({
      runtime: Object.freeze({
        ...runtime,
        phase: cooldownRemaining > 0 ? "cooldown" : "ready",
        windupRemaining: 0,
        activeRemaining: 0,
        cooldownRemaining,
        target: null,
      }),
      events: Object.freeze([
        startEvent,
        Object.freeze({
          type: "active-end",
          kind: runtime.kind,
          activationId: runtime.activationId,
          target: runtime.target,
        }),
      ]),
    });
  }
  if (runtime.phase === "active") {
    const remaining = runtime.activeRemaining - elapsedSeconds;
    if (remaining > 0) {
      return Object.freeze({
        runtime: Object.freeze({ ...runtime, activeRemaining: remaining }),
        events: Object.freeze([]),
      });
    }
    const overflow = Math.max(0, -remaining);
    const cooldownRemaining = Math.max(0, definition.cooldownSeconds - overflow);
    return Object.freeze({
      runtime: Object.freeze({
        ...runtime,
        phase: cooldownRemaining > 0 ? "cooldown" : "ready",
        activeRemaining: 0,
        cooldownRemaining,
        target: null,
      }),
      events: Object.freeze([Object.freeze({
        type: "active-end",
        kind: runtime.kind,
        activationId: runtime.activationId,
        target: runtime.target,
      })]),
    });
  }
  const cooldownRemaining = Math.max(0, runtime.cooldownRemaining - elapsedSeconds);
  return Object.freeze({
    runtime: Object.freeze({
      ...runtime,
      phase: cooldownRemaining > 0 ? "cooldown" : "ready",
      cooldownRemaining,
    }),
    events: Object.freeze([]),
  });
}

function advanceMayoAbility(runtime, elapsedSeconds) {
  const definition = MANUAL_ABILITY_REGISTRY["mayo-chan"];
  if (runtime.phase === "cooldown") {
    const cooldownRemaining = Math.max(0, runtime.cooldownRemaining - elapsedSeconds);
    return Object.freeze({
      runtime: Object.freeze({
        ...runtime,
        phase: cooldownRemaining > 0 ? "cooldown" : "ready",
        cooldownRemaining,
      }),
      events: Object.freeze([]),
    });
  }
  if (runtime.phase === "windup") {
    const remaining = runtime.windupRemaining - elapsedSeconds;
    if (remaining > 0) {
      return Object.freeze({
        runtime: Object.freeze({ ...runtime, windupRemaining: remaining }),
        events: Object.freeze([]),
      });
    }
    const overflow = Math.max(0, -remaining);
    if (overflow < definition.activeSeconds) {
      return Object.freeze({
        runtime: Object.freeze({
          ...runtime,
          phase: "feral",
          windupRemaining: 0,
          activeRemaining: definition.activeSeconds - overflow,
        }),
        events: Object.freeze([Object.freeze({
          type: "feral-start",
          kind: runtime.kind,
          activationId: runtime.activationId,
          target: runtime.target,
        })]),
      });
    }
    return Object.freeze({
      runtime: Object.freeze({
        ...runtime,
        phase: "retreat",
        windupRemaining: 0,
        activeRemaining: 0,
      }),
      events: Object.freeze([
        Object.freeze({
          type: "feral-start",
          kind: runtime.kind,
          activationId: runtime.activationId,
          target: runtime.target,
        }),
        Object.freeze({
          type: "retreat",
          kind: runtime.kind,
          activationId: runtime.activationId,
          target: runtime.target,
        }),
      ]),
    });
  }
  if (runtime.phase === "feral") {
    const remaining = runtime.activeRemaining - elapsedSeconds;
    if (remaining > 0) {
      return Object.freeze({
        runtime: Object.freeze({ ...runtime, activeRemaining: remaining }),
        events: Object.freeze([]),
      });
    }
    return Object.freeze({
      runtime: Object.freeze({
        ...runtime,
        phase: "retreat",
        activeRemaining: 0,
      }),
      events: Object.freeze([Object.freeze({
        type: "retreat",
        kind: runtime.kind,
        activationId: runtime.activationId,
        target: runtime.target,
      })]),
    });
  }
  return Object.freeze({ runtime, events: Object.freeze([]) });
}

export function mayoAbilityHpStep({
  hp,
  maxHp,
  seconds,
  drainPerSecond = MANUAL_ABILITY_REGISTRY["mayo-chan"].hpDrainPerSecond,
  safeHpRatio = MANUAL_ABILITY_REGISTRY["mayo-chan"].safeHpRatio,
} = {}) {
  const normalizedMaxHp = Math.max(1, Number(maxHp) || 1);
  const safeHp = Math.max(1, normalizedMaxHp * Math.max(0, Math.min(1, Number(safeHpRatio) || 0)));
  const nextHp = Math.max(safeHp, Math.max(0, Number(hp) || 0) - Math.max(0, Number(seconds) || 0) * Math.max(0, Number(drainPerSecond) || 0));
  return Object.freeze({
    hp: nextHp,
    safeHp,
    forceRetreat: nextHp <= safeHp + Number.EPSILON,
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
  return Object.freeze({ x, y, width, height, ownerId: rect?.ownerId ?? null });
}

function overlaps(left, right, gap = 4) {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y;
}

const ICON_OFFSETS = Object.freeze([
  // The ready control belongs to the fighter's HP bar. Crowding may move it
  // within this small local crown only; passive banners must never send it
  // across the battlefield.
  Object.freeze([0, 8]),
  Object.freeze([-46, 8]),
  Object.freeze([46, 8]),
  Object.freeze([-23, -38]),
  Object.freeze([23, -38]),
  Object.freeze([-69, -38]),
  Object.freeze([69, -38]),
  // A fighter pressed against the top HUD cannot use the upper crown. These
  // lower rows keep every duplicate-instance control independently tappable
  // without the former ±92px horizontal drift.
  Object.freeze([-23, 58]),
  Object.freeze([23, 58]),
  Object.freeze([-69, 58]),
  Object.freeze([69, 58]),
  Object.freeze([0, -84]),
  Object.freeze([-46, -84]),
  Object.freeze([46, -84]),
  Object.freeze([0, 104]),
  Object.freeze([-46, 104]),
  Object.freeze([46, 104]),
  Object.freeze([-23, -130]),
  Object.freeze([23, -130]),
  Object.freeze([-69, -130]),
  Object.freeze([69, -130]),
  Object.freeze([0, 150]),
  Object.freeze([-46, 150]),
  Object.freeze([46, 150]),
  Object.freeze([-23, 196]),
  Object.freeze([23, 196]),
  Object.freeze([-69, 196]),
  Object.freeze([69, 196]),
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
  const staticBlocked = obstacles.map(normalizeRect);
  const placementTopInset = staticBlocked.reduce((inset, obstacle) => (
    obstacle.y <= topInset + 4
      && obstacle.x <= leftInset
      && obstacle.x + obstacle.width >= width - rightInset
      ? Math.max(inset, obstacle.y + obstacle.height)
      : inset
  ), topInset);
  const visibleInset = Math.max(0, (hitSize - 28) / 2);
  const visibleRect = (rect) => ({
    x: rect.x + visibleInset,
    y: rect.y + visibleInset,
    width: Math.max(1, rect.width - visibleInset * 2),
    height: Math.max(1, rect.height - visibleInset * 2),
  });
  const anchorFor = (fighter) => ({
    x: Number.isFinite(Number(fighter.screenX))
      ? Number(fighter.screenX)
      : Number(fighter.x) / worldWidth * width,
    y: Number.isFinite(Number(fighter.screenY))
      ? Number(fighter.screenY)
      : Number(fighter.headY ?? fighter.y) / worldHeight * height,
  });
  const offsetCandidatesFor = (fighter) => {
    const anchor = anchorFor(fighter);
    return ICON_OFFSETS.map(([offsetX, offsetY]) => ({
      x: Math.max(leftInset, Math.min(width - rightInset - hitSize, anchor.x - hitSize / 2 + offsetX)),
      y: Math.max(placementTopInset, Math.min(height - bottomInset - hitSize, anchor.y - hitSize + offsetY)),
      width: hitSize,
      height: hitSize,
    }));
  };
  const candidateRectsFor = (fighter) => {
    const localCandidates = offsetCandidatesFor(fighter);
    const unblocked = localCandidates.filter((rect) => !staticBlocked.some((obstacle) => (
        (obstacle.ownerId === null || String(obstacle.ownerId) !== String(fighter.id))
        && overlaps(visibleRect(rect), obstacle)
      )));
    // If the fighter is pressed against a HUD edge, the ready control still
    // owns input priority. Keep every fallback in the same local crown rather
    // than teleporting it elsewhere or stacking duplicate-instance controls.
    return [...unblocked, ...localCandidates.filter((rect) => !unblocked.includes(rect))];
  };
  const pending = [...fighters]
    .sort((left, right) => (
      anchorFor(left).x - anchorFor(right).x
      || anchorFor(left).y - anchorFor(right).y
      || String(left.id).localeCompare(String(right.id))
    ))
    .map((fighter) => ({ fighter, candidates: candidateRectsFor(fighter) }));
  const assigned = new Map();
  for (const { fighter, candidates } of pending) {
    const placed = candidates.find((rect) => (
      ![...assigned.values()].some((other) => overlaps(rect, other, 2))
    )) ?? candidates[0] ?? offsetCandidatesFor(fighter)[0];
    assigned.set(fighter.id, placed);
  }
  const result = [];
  for (const { fighter } of pending) {
    const placed = assigned.get(fighter.id);
    if (!placed) continue;
    const { x: anchorX, y: anchorY } = anchorFor(fighter);
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
