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

  const lanes = Math.max(1, Math.floor(Number(laneCount) || 3));
  // Reserve the coverage post too: the old independent ID/modulo choices
  // sent multiple guards (sometimes even the anchor) to the same point.
  const occupied = anchor ? [{
    x: escortPriority(anchor) === 2 ? 86 : -10,
    lane: Number(cartLane),
  }] : [];
  const screens = available.filter(candidate => candidate !== anchor);
  // Preserve a destination for callers observing a unit not ready to move.
  if (!screens.some(candidate => String(candidate.id) === String(unit.id))) screens.push(unit);
  const preferences = screens.map(candidate => {
    const stableId = Math.abs(Math.floor(Number(candidate.id) || 0));
    const slot = Math.max(0, available.findIndex(other => String(other.id) === String(candidate.id)));
    const ranged = Number(candidate.range) > 64;
    const support = SUPPORT_ESCORT_KINDS.has(candidate.kind);
    return {id:String(candidate.id),available:available.includes(candidate),
      x:support ? 28 + (stableId % 2) * 12 : ranged ? 54 + (stableId % 3) * 13 : 86 + (stableId % 3) * 14,
      lane:(stableId + slot) % lanes,duty:support ? 'support-screen' : ranged ? 'ranged-screen' : 'front-screen'};
  });
  // A duplicate's escape must not occupy a later guard's already-clear post.
  const original = [...occupied,...preferences.filter(preference => preference.available)];
  const clear = new Set(preferences.filter(preference => preference.available
    && original.every(other => other === preference || other.lane !== preference.lane
      || Math.abs(other.x - preference.x) >= 28)).map(preference => preference.id));
  occupied.push(...preferences.filter(preference => clear.has(preference.id)));
  for (const preference of preferences) {
    let post = clear.has(preference.id) ? preference : null;
    for (let column = 0; !post; column++) {
      for (let offset = 0; offset < lanes; offset++) {
        if (column === 0 && offset > 0) continue;
        // Keep a clear original post. For a clash, try one step forward in
        // the same lane before moving sideways, without stretching one file.
        const x = preference.x + (offset === 0 ? column : column - 1) * 28;
        const lane = (preference.lane + offset) % lanes;
        if (occupied.some(other => other.lane === lane && Math.abs(other.x - x) < 28)) continue;
        post = { x, lane }; break;
      }
    }
    if (!clear.has(preference.id)) occupied.push(post);
    if (preference.id === String(unit.id)) return Object.freeze({
      x: Number(cartX) + post.x,
      lane: post.lane,
      duty: preference.duty,
    });
  }
}
