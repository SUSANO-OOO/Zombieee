import { deepFreeze } from "./content/freeze.js";

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, finite(value, minimum)));
const distance = (a, b) => Math.hypot(finite(a?.x) - finite(b?.x), finite(a?.y) - finite(b?.y));

export const V090_INFECTED_KINDS = deepFreeze([
  "resonator",
  "cagewalker",
  "spindle",
  "choir-knot",
  "pall-manta",
  "anchor-bloom",
]);

export const V090_INFECTED_DEFINITIONS = deepFreeze({
  resonator: {
    displayName: "裂声体",
    classification: "共鳴器官・前方衝撃型",
    abilityId: "rupture-howl",
    warningSeconds: 0.9,
    activeSeconds: 0.2,
    recoverySeconds: 0.72,
    cooldownSeconds: 7.2,
    counterplay: "胸郭と喉腔を開く予告中に移動阻害または怯み",
    compendiumAsset: "/art/v090/enemies/resonator-compendium-v1.webp",
  },
  cagewalker: {
    displayName: "骨檻",
    classification: "多脚檻・生体障害物型",
    abilityId: "rib-barricade",
    warningSeconds: 0.76,
    activeSeconds: 2.5,
    recoverySeconds: 0.82,
    cooldownSeconds: 6.4,
    counterplay: "旋回中に吊り下がった中枢へ側面攻撃",
    compendiumAsset: "/art/v090/enemies/cagewalker-compendium-v1.webp",
  },
  spindle: {
    displayName: "脊走り",
    classification: "多脚脊柱・後衛跳躍型",
    abilityId: "coil-vault",
    warningSeconds: 0.66,
    activeSeconds: 0.36,
    recoverySeconds: 0.7,
    cooldownSeconds: 6.8,
    counterplay: "脊柱を輪状に圧縮する予告中に集中攻撃",
    compendiumAsset: "/art/v090/enemies/spindle-compendium-v1.webp",
  },
  "choir-knot": {
    displayName: "百面瘤",
    classification: "多面擬声・注意誘導型",
    abilityId: "familiar-chorus",
    warningSeconds: 1.12,
    activeSeconds: 0.34,
    recoverySeconds: 0.78,
    cooldownSeconds: 7.6,
    counterplay: "顔が順番に標的へ向く間に三脚を崩す",
    compendiumAsset: "/art/v090/enemies/choir-knot-compendium-v1.webp",
  },
  "pall-manta": {
    displayName: "皮幕",
    classification: "皮膜天蓋・射線遮断型",
    abilityId: "dermal-canopy",
    warningSeconds: 0.86,
    activeSeconds: 2.9,
    recoverySeconds: 0.74,
    cooldownSeconds: 8.2,
    counterplay: "天蓋展開中の下面または側面へ接近",
    compendiumAsset: "/art/v090/enemies/pall-manta-compendium-v1.webp",
  },
  "anchor-bloom": {
    displayName: "掌根",
    classification: "五肢定着・生体補強型",
    abilityId: "root-reinforcement",
    warningSeconds: 1.08,
    activeSeconds: 3.5,
    recoverySeconds: 0.84,
    cooldownSeconds: 8.8,
    counterplay: "定着中に持ち上がる中央核を攻撃",
    compendiumAsset: "/art/v090/enemies/anchor-bloom-compendium-v1.webp",
  },
});

export function isV090InfectedKind(kind) {
  return V090_INFECTED_KINDS.includes(kind);
}

export function v090InfectedDefinition(kind) {
  return V090_INFECTED_DEFINITIONS[kind] ?? null;
}

export function createV090InfectedRuntime(kind) {
  if (!isV090InfectedKind(kind)) return deepFreeze({
    kind: null,
    phase: "idle",
    remainingSeconds: 0,
    targetIds: [],
    resolved: false,
  });
  return deepFreeze({
    kind,
    phase: "idle",
    remainingSeconds: 0,
    targetIds: [],
    originX: null,
    originY: null,
    targetX: null,
    targetY: null,
    resolved: false,
  });
}

export function selectV090InfectedTargets({ kind, attacker, candidates }) {
  if (!isV090InfectedKind(kind) || !attacker || !Array.isArray(candidates)) return deepFreeze([]);
  const livingHumans = candidates
    .filter((candidate) => candidate?.side === "human" && finite(candidate?.hp) > 0 && candidate?.combatReady !== false)
    .sort((left, right) => (
      distance(attacker, left) - distance(attacker, right)
      || String(left.id).localeCompare(String(right.id))
    ));
  if (kind === "spindle") {
    return deepFreeze(livingHumans
      .filter((candidate) => distance(attacker, candidate) <= 330)
      .sort((left, right) => finite(left.x) - finite(right.x) || String(left.id).localeCompare(String(right.id)))
      .slice(0, 1)
      .map(({ id }) => String(id)));
  }
  if (kind === "choir-knot") {
    return deepFreeze(livingHumans.slice(0, 2).map(({ id }) => String(id)));
  }
  if (kind === "anchor-bloom") {
    return deepFreeze(candidates
      .filter((candidate) => candidate?.side === "zombie"
        && candidate.id !== attacker.id
        && finite(candidate?.hp) > 0
        && distance(attacker, candidate) <= 170)
      .sort((left, right) => (
        finite(left.hp) / Math.max(1, finite(left.maxHp, 1))
        - finite(right.hp) / Math.max(1, finite(right.maxHp, 1))
        || distance(attacker, left) - distance(attacker, right)
        || String(left.id).localeCompare(String(right.id))
      ))
      .slice(0, 2)
      .map(({ id }) => String(id)));
  }
  return deepFreeze(livingHumans.slice(0, 1).map(({ id }) => String(id)));
}

export function beginV090InfectedAbility({ kind, attacker, candidates }) {
  const definition = v090InfectedDefinition(kind);
  if (!definition || !attacker) return deepFreeze({ ok: false, runtime: createV090InfectedRuntime(kind) });
  const targetIds = selectV090InfectedTargets({ kind, attacker, candidates });
  if (kind !== "pall-manta" && targetIds.length === 0) {
    return deepFreeze({ ok: false, runtime: createV090InfectedRuntime(kind) });
  }
  const primary = candidates?.find((candidate) => String(candidate?.id) === targetIds[0]) ?? null;
  return deepFreeze({
    ok: true,
    runtime: {
      kind,
      phase: "warning",
      remainingSeconds: definition.warningSeconds,
      targetIds,
      originX: finite(attacker.x),
      originY: finite(attacker.y),
      targetX: primary ? finite(primary.x) : finite(attacker.x),
      targetY: primary ? finite(primary.y) : finite(attacker.y),
      resolved: false,
    },
  });
}

export function advanceV090InfectedAbility(runtime, elapsedSeconds) {
  const definition = v090InfectedDefinition(runtime?.kind);
  if (!definition || runtime?.phase === "idle") {
    return deepFreeze({ runtime: createV090InfectedRuntime(runtime?.kind), events: [] });
  }
  let remainingElapsed = Math.max(0, finite(elapsedSeconds));
  let next = { ...runtime };
  const events = [];
  while (remainingElapsed > 0 && next.phase !== "idle") {
    const consumed = Math.min(remainingElapsed, Math.max(0, finite(next.remainingSeconds)));
    next.remainingSeconds = Math.max(0, finite(next.remainingSeconds) - consumed);
    remainingElapsed -= consumed;
    if (next.remainingSeconds > 1e-9) break;
    next.remainingSeconds = 0;
    if (next.phase === "warning") {
      next.phase = "active";
      next.remainingSeconds = definition.activeSeconds;
      next.resolved = false;
      events.push("activate");
    } else if (next.phase === "active") {
      next.phase = "recovery";
      next.remainingSeconds = definition.recoverySeconds;
      events.push("recover");
    } else {
      next = { ...createV090InfectedRuntime(next.kind) };
      events.push("finish");
    }
    if (consumed === 0 && next.remainingSeconds > 0) break;
  }
  return deepFreeze({ runtime: next, events });
}

export function resonatorHowlTargets({ attacker, candidates }) {
  if (!attacker || !Array.isArray(candidates)) return deepFreeze([]);
  return deepFreeze(candidates.filter((target) => {
    if (target?.side !== "human" || finite(target.hp) <= 0) return false;
    const forward = finite(attacker.x) - finite(target.x);
    if (forward < 0 || forward > 168) return false;
    return Math.abs(finite(target.y) - finite(attacker.y)) <= 34 + forward * 0.22;
  }).map(({ id }) => String(id)));
}

export function cagewalkerFrontDamageMultiplier({ phase, attackerX, targetX }) {
  const incomingFromFront = finite(attackerX) <= finite(targetX);
  return phase === "active" && incomingFromFront ? 0.3 : 1;
}

export function spindleLandingPoint({ attacker, target, minimumX = 120, maximumX = 900 }) {
  if (!attacker || !target) return null;
  return deepFreeze({
    x: clamp(finite(target.x) + 38, minimumX, maximumX),
    y: finite(target.y),
  });
}

export function pallMantaProjectileMultiplier({ phase, shooter, target, manta }) {
  if (phase !== "active" || !shooter || !target || !manta) return 1;
  const horizontallyCovered = finite(shooter.x) < finite(manta.x)
    && finite(manta.x) < finite(target.x);
  const verticallyCovered = Math.abs(finite(target.y) - finite(manta.y)) <= 72;
  const closeEnough = distance(manta, target) <= 178;
  return horizontallyCovered && verticallyCovered && closeEnough ? 0.32 : 1;
}

export function anchorBloomReinforcement({ phase, anchor, target }) {
  const active = phase === "active"
    && anchor
    && target
    && anchor.id !== target.id
    && target.side === "zombie"
    && distance(anchor, target) <= 178;
  return deepFreeze({
    active,
    incomingDamageMultiplier: active ? 0.7 : 1,
    healingPerSecond: active ? 7 : 0,
  });
}
