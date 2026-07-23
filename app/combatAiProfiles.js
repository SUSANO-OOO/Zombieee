import { deepFreeze } from "./content/freeze.js";

export const ALLY_AI_PROFILE_IDS = deepFreeze([
  "frontline",
  "heavy",
  "skirmisher",
  "marksman",
  "suppression",
  "support",
  "engineer",
]);

export const ENEMY_AI_PROFILE_IDS = deepFreeze([
  "crawler-priority",
  "nearest",
  "backline",
  "support-object",
  "base-defense",
  "charge",
  "grab",
  "ranged",
  "contamination",
  "area",
  "summon",
]);

export const ALLY_AI_PROFILES = deepFreeze({
  frontline: {
    id: "frontline",
    maxPursuersPerEnemy: 3,
    localThreatRadius: 190,
    rangePadding: 7,
    retargetSeconds: .3,
    defenseLeash: 245,
  },
  heavy: {
    id: "heavy",
    maxPursuersPerEnemy: 4,
    localThreatRadius: 175,
    rangePadding: 4,
    retargetSeconds: .44,
    defenseLeash: 230,
  },
  skirmisher: {
    id: "skirmisher",
    maxPursuersPerEnemy: 1,
    localThreatRadius: 245,
    rangePadding: 10,
    retargetSeconds: .22,
    defenseLeash: 275,
  },
  marksman: {
    id: "marksman",
    maxPursuersPerEnemy: 1,
    localThreatRadius: 275,
    rangePadding: 18,
    retargetSeconds: .5,
    defenseLeash: 260,
  },
  suppression: {
    id: "suppression",
    maxPursuersPerEnemy: 3,
    localThreatRadius: 245,
    rangePadding: 14,
    retargetSeconds: .26,
    defenseLeash: 255,
  },
  support: {
    id: "support",
    maxPursuersPerEnemy: 1,
    localThreatRadius: 175,
    rangePadding: 20,
    retargetSeconds: .58,
    defenseLeash: 205,
  },
  engineer: {
    id: "engineer",
    maxPursuersPerEnemy: 2,
    localThreatRadius: 205,
    rangePadding: 14,
    retargetSeconds: .4,
    defenseLeash: 225,
  },
});

export const ENEMY_AI_PROFILES = deepFreeze({
  "crawler-priority": {
    id: "crawler-priority",
    engagementRadius: 105,
    maxPursuersPerTarget: 2,
    retargetSeconds: .34,
    routeCooldown: .72,
    routeSwitchMargin: 6,
    humanPursuit: false,
    supportObjectPriority: 0,
  },
  nearest: {
    id: "nearest",
    engagementRadius: 155,
    maxPursuersPerTarget: 2,
    retargetSeconds: .48,
    routeCooldown: .9,
    routeSwitchMargin: 8,
    humanPursuit: true,
    supportObjectPriority: 0,
  },
  backline: {
    id: "backline",
    engagementRadius: 285,
    maxPursuersPerTarget: 1,
    retargetSeconds: .3,
    routeCooldown: .64,
    routeSwitchMargin: 5,
    humanPursuit: true,
    backlineWeight: .68,
    supportKindBonus: 42,
    supportObjectPriority: 0,
  },
  "support-object": {
    id: "support-object",
    engagementRadius: 130,
    maxPursuersPerTarget: 2,
    retargetSeconds: .62,
    routeCooldown: 1.18,
    routeSwitchMargin: 12,
    humanPursuit: false,
    supportObjectPriority: 95,
  },
  "base-defense": {
    id: "base-defense",
    engagementRadius: 255,
    maxPursuersPerTarget: 4,
    retargetSeconds: .46,
    routeCooldown: 1.4,
    routeSwitchMargin: 15,
    humanPursuit: true,
    forwardThreatWeight: .32,
    supportObjectPriority: 30,
  },
  charge: {
    id: "charge",
    engagementRadius: 235,
    maxPursuersPerTarget: 1,
    retargetSeconds: .24,
    routeCooldown: .58,
    routeSwitchMargin: 4,
    humanPursuit: true,
    backlineWeight: .28,
    woundedBonus: 70,
    supportObjectPriority: 0,
  },
  grab: {
    id: "grab",
    engagementRadius: 205,
    maxPursuersPerTarget: 1,
    retargetSeconds: .42,
    routeCooldown: .82,
    routeSwitchMargin: 7,
    humanPursuit: true,
    durableTargetBonus: 58,
    supportObjectPriority: 0,
  },
  ranged: {
    id: "ranged",
    engagementRadius: 225,
    maxPursuersPerTarget: 2,
    retargetSeconds: .56,
    routeCooldown: 1.05,
    routeSwitchMargin: 10,
    humanPursuit: true,
    preferredRange: 108,
    supportKindBonus: 18,
    supportObjectPriority: 18,
  },
  contamination: {
    id: "contamination",
    engagementRadius: 215,
    maxPursuersPerTarget: 2,
    retargetSeconds: .68,
    routeCooldown: 1.12,
    routeSwitchMargin: 11,
    humanPursuit: true,
    clusterBonus: 34,
    supportObjectPriority: 45,
  },
  area: {
    id: "area",
    engagementRadius: 185,
    maxPursuersPerTarget: 3,
    retargetSeconds: .72,
    routeCooldown: 1.24,
    routeSwitchMargin: 13,
    humanPursuit: true,
    clusterBonus: 52,
    supportObjectPriority: 25,
  },
  summon: {
    id: "summon",
    engagementRadius: 175,
    maxPursuersPerTarget: 3,
    retargetSeconds: .78,
    routeCooldown: 1.3,
    routeSwitchMargin: 14,
    humanPursuit: true,
    forwardThreatWeight: .2,
    supportObjectPriority: 35,
  },
});

export const ALLY_AI_PROFILE_BY_KIND = deepFreeze({
  scout: "skirmisher",
  ranger: "marksman",
  brute: "heavy",
  brawler: "frontline",
  gunner: "suppression",
  medic: "support",
  "crazy-king": "frontline",
  kumaverson: "heavy",
  babayaga: "marksman",
  guardian: "heavy",
  engineer: "engineer",
});

export const ENEMY_AI_PROFILE_BY_KIND = deepFreeze({
  walker: "nearest",
  runner: "crawler-priority",
  spitter: "ranged",
  crusher: "support-object",
  shade: "backline",
  abomination: "area",
  turned: "nearest",
  takuya: "summon",
  grappler: "grab",
  ooze: "contamination",
  sprinter: "charge",
  "gate-eater": "base-defense",
});

export function allyAiProfileFor(kind) {
  return ALLY_AI_PROFILES[ALLY_AI_PROFILE_BY_KIND[kind]] ?? ALLY_AI_PROFILES.frontline;
}

export function enemyAiProfileFor(kind) {
  return ENEMY_AI_PROFILES[ENEMY_AI_PROFILE_BY_KIND[kind]] ?? ENEMY_AI_PROFILES.nearest;
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function targetHpRatio(target) {
  const maxHp = Math.max(1, finite(target?.maxHp, 1));
  return Math.max(0, Math.min(1, finite(target?.hp, maxHp) / maxHp));
}

export function enemyTargetScore({
  profile,
  enemy,
  target,
  distance,
  claims = 0,
  capacity = 1,
  currentTargetId = null,
  inContact = false,
  blocksRoute = false,
  nearbyAllies = 0,
} = {}) {
  const resolved = typeof profile === "string"
    ? ENEMY_AI_PROFILES[profile] ?? ENEMY_AI_PROFILES.nearest
    : profile ?? ENEMY_AI_PROFILES.nearest;
  const safeDistance = Math.max(0, finite(distance, Math.hypot(
    finite(enemy?.x) - finite(target?.x),
    finite(enemy?.y) - finite(target?.y),
  )));
  const rearwardDistance = Math.max(0, finite(enemy?.x) - finite(target?.x));
  const forwardThreat = Math.max(0, finite(target?.x));
  const supportTarget = target?.kind === "medic" || target?.kind === "engineer";
  const durableTarget = target?.kind === "guardian" || target?.kind === "brute" || target?.kind === "kumaverson";
  const overCapacity = Math.max(0, finite(claims) - Math.max(1, finite(capacity, 1)) + 1);
  return safeDistance
    + overCapacity * 400
    - (inContact ? 100000 : 0)
    - (blocksRoute ? 20000 : 0)
    - (target?.id === currentTargetId ? 26 : 0)
    - rearwardDistance * finite(resolved.backlineWeight)
    - forwardThreat * finite(resolved.forwardThreatWeight)
    - (supportTarget ? finite(resolved.supportKindBonus) : 0)
    - (durableTarget ? finite(resolved.durableTargetBonus) : 0)
    - (1 - targetHpRatio(target)) * finite(resolved.woundedBonus)
    - Math.max(0, finite(nearbyAllies)) * finite(resolved.clusterBonus)
    + (Number.isFinite(resolved.preferredRange) ? Math.abs(safeDistance - resolved.preferredRange) * .72 : 0);
}

export function chooseEnemyTargetForProfile({
  kind,
  enemy,
  candidates = [],
  claims = new Map(),
  currentTargetId = null,
} = {}) {
  const profile = enemyAiProfileFor(kind);
  const claimCount = (targetId) => claims instanceof Map
    ? finite(claims.get(targetId))
    : finite(claims?.[targetId]);
  const eligible = candidates
    .filter((candidate) => candidate
      && candidate.id !== undefined
      && candidate.alive !== false
      && !(Number.isFinite(candidate.hp) && candidate.hp <= 0))
    .map((candidate) => {
      const distance = Math.max(0, finite(candidate.distance, Math.hypot(
        finite(enemy?.x) - finite(candidate.x),
        finite(enemy?.y) - finite(candidate.y),
      )));
      const inContact = candidate.inContact === true;
      const blocksRoute = candidate.blocksRoute === true;
      const current = candidate.id === currentTargetId;
      const claimed = claimCount(candidate.id);
      const capacity = Math.max(1, finite(candidate.capacity, profile.maxPursuersPerTarget));
      const pursuable = inContact
        || blocksRoute
        || current
        || (profile.humanPursuit && distance <= profile.engagementRadius);
      if (!pursuable || (!inContact && !blocksRoute && !current && claimed >= capacity)) return null;
      return {
        candidate,
        score: enemyTargetScore({
          profile,
          enemy,
          target: candidate,
          distance,
          claims: claimed,
          capacity,
          currentTargetId,
          inContact,
          blocksRoute,
          nearbyAllies: candidate.nearbyAllies,
        }),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score
      || String(left.candidate.id).localeCompare(String(right.candidate.id), "en"));
  return eligible[0]?.candidate ?? null;
}

function recoveryLaneFor(lane, laneCount, seed) {
  const current = Math.max(0, Math.min(laneCount - 1, Math.floor(finite(lane, 1))));
  if (laneCount <= 1) return current;
  const direction = Math.abs(Math.floor(finite(seed))) % 2 === 0 ? 1 : -1;
  const preferred = current + direction;
  if (preferred >= 0 && preferred < laneCount) return preferred;
  return current - direction;
}

export function createNavigationRecoveryState({ x = 0, y = 0, lane = 1 } = {}) {
  return Object.freeze({
    lastX: finite(x),
    lastY: finite(y),
    stuckSeconds: 0,
    recoverySeconds: 0,
    recoveryLane: null,
    originalLane: Math.max(0, Math.floor(finite(lane, 1))),
    recoveryCount: 0,
  });
}

export function advanceNavigationRecovery({
  state,
  x = 0,
  y = 0,
  desiredX = x,
  desiredY = y,
  lane = 1,
  laneCount = 3,
  seed = 0,
  seconds = 0,
  moving = false,
  engaged = false,
  displacementEpsilon = .05,
  destinationTolerance = 3,
  stuckThresholdSeconds = .72,
  recoveryDurationSeconds = .95,
} = {}) {
  const previous = state ?? createNavigationRecoveryState({ x, y, lane });
  const safeSeconds = Math.max(0, finite(seconds));
  const currentX = finite(x);
  const currentY = finite(y);
  const displacement = Math.hypot(currentX - finite(previous.lastX, currentX), currentY - finite(previous.lastY, currentY));
  const destinationDistance = Math.hypot(finite(desiredX, currentX) - currentX, finite(desiredY, currentY) - currentY);
  let recoverySeconds = Math.max(0, finite(previous.recoverySeconds) - safeSeconds);
  let recoveryLane = recoverySeconds > 0 ? previous.recoveryLane : null;
  let stuckSeconds = finite(previous.stuckSeconds);
  let recoveryCount = Math.max(0, Math.floor(finite(previous.recoveryCount)));
  let originalLane = Math.max(0, Math.floor(finite(previous.originalLane, lane)));

  if (!moving || engaged || destinationDistance <= Math.max(0, finite(destinationTolerance, 3))) {
    stuckSeconds = 0;
    recoverySeconds = 0;
    recoveryLane = null;
    originalLane = Math.max(0, Math.floor(finite(lane, 1)));
  } else if (recoverySeconds > 0) {
    stuckSeconds = 0;
  } else {
    stuckSeconds = displacement <= Math.max(0, finite(displacementEpsilon, .05))
      ? stuckSeconds + safeSeconds
      : 0;
    if (stuckSeconds + 1e-9 >= Math.max(0, finite(stuckThresholdSeconds, .72))) {
      originalLane = Math.max(0, Math.floor(finite(lane, 1)));
      recoveryLane = recoveryLaneFor(originalLane, Math.max(1, Math.floor(finite(laneCount, 3))), finite(seed) + recoveryCount);
      recoverySeconds = Math.max(0, finite(recoveryDurationSeconds, .95));
      recoveryCount += 1;
      stuckSeconds = 0;
    }
  }

  return Object.freeze({
    lastX: currentX,
    lastY: currentY,
    stuckSeconds,
    recoverySeconds,
    recoveryLane,
    originalLane,
    recoveryCount,
  });
}
