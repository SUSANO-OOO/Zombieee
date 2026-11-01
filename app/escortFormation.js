const SUPPORT_ESCORT_KINDS = new Set(["medic", "engineer"]);

function aliveEscort(unit) {
  return unit
    && unit.side === "human"
    && Number(unit.hp) > 0
    && unit.combatReady === true
    && unit.gateEntering !== true
    && unit.contained !== true
    && (Number(unit.stunned) || 0) <= 0;
}

function escortPriority(unit) {
  if (SUPPORT_ESCORT_KINDS.has(unit.kind)) return 0;
  if (Number(unit.range) > 64) return 1;
  return 2;
}

// Pursuit is bounded by the moving objective, not by a guard that can drift
// farther away with every retarget. An anchor must still clear intruders:
// blindly holding its formation point can strand a melee escort indefinitely.
export function escortMayPursueTarget({
  unit, humans = [], target, duty, cartX, cartY, leash, config = {},
} = {}) {
  if (!aliveEscort(unit) || !target || target.hp <= 0 || target.contained === true
    || !Number.isFinite(target.x) || !Number.isFinite(target.y)
    || !Number.isFinite(cartX) || !Number.isFinite(cartY)
    || !(Number(leash) > 0) || Math.abs(target.x - cartX) > leash) return false;
  if (duty !== 'escort-anchor') return true;
  if (humans.filter(aliveEscort).length === 1) return true;
  const radiusX = Number(config.threatRadiusX) > 0 ? Number(config.threatRadiusX) : 90;
  const radiusY = Number(config.threatRadiusY) > 0 ? Number(config.threatRadiusY) : 55;
  return ((target.x - cartX) / radiusX) ** 2 + ((target.y - cartY) / radiusY) ** 2 <= 1;
}

export function escortFormationDestination({
  unit,
  humans = [],
  cartX = 0,
  cartLane = 1,
  laneCount = 3,
} = {}) {
  if (!unit) return null;
  const available = humans
    .filter(aliveEscort)
    .sort((left, right) => (
      escortPriority(left) - escortPriority(right)
      || Number(left.id) - Number(right.id)
    ));
  const anchor = available.find((candidate) => escortPriority(candidate) < 2)
    ?? available[0];
  if (anchor && String(anchor.id) === String(unit.id)) {
    const meleeOnlyAnchor = escortPriority(anchor) === 2;
    return Object.freeze({
      x: Number(cartX) + (meleeOnlyAnchor ? 86 : -10),
      lane: Number(cartLane),
      duty: "escort-anchor",
    });
  }

  const stableId = Math.abs(Math.floor(Number(unit.id) || 0));
  const slot = available.findIndex((candidate) => String(candidate.id) === String(unit.id));
  const ranged = Number(unit.range) > 64;
  const support = SUPPORT_ESCORT_KINDS.has(unit.kind);
  const forwardOffset = support
    ? 28 + (stableId % 2) * 12
    : ranged
      ? 54 + (stableId % 3) * 13
      : 86 + (stableId % 3) * 14;
  const lanes = Math.max(1, Math.floor(Number(laneCount) || 3));
  const lane = (stableId + Math.max(0, slot)) % lanes;
  return Object.freeze({
    x: Number(cartX) + forwardOffset,
    lane,
    duty: support ? "support-screen" : ranged ? "ranged-screen" : "front-screen",
  });
}
