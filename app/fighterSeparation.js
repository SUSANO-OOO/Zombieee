const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function sameSideSeparationStep({
  id = 0,
  side = "human",
  x,
  y,
  bodyRadius,
  otherX,
  otherY,
  otherBodyRadius,
  spawnGrace = 0,
  laneMinY = Number.NEGATIVE_INFINITY,
  laneMaxY = Number.POSITIVE_INFINITY,
} = {}) {
  const dx = finite(x) - finite(otherX);
  const dy = finite(y) - finite(otherY);
  const separation = Math.max(0, finite(bodyRadius)) + Math.max(0, finite(otherBodyRadius));
  const gap = Math.hypot(dx, dy);
  if (separation <= 0 || gap >= separation) return Object.freeze({ dx: 0, dy: 0, separated: false });
  const direction = Math.trunc(finite(id)) % 2 ? 1 : -1;
  const ux = gap > .1 ? dx / gap : direction * .35;
  const uy = gap > .1 ? dy / gap : direction;
  const push = Math.min(2.2, (separation - gap) * (finite(spawnGrace) > 0 ? .2 : .08));
  if (side === "human") {
    return Object.freeze({ dx: ux * push, dy: uy * push, separated: true });
  }
  const canFanOut = (uy < 0 && finite(y) > finite(laneMinY) + 3)
    || (uy > 0 && finite(y) < finite(laneMaxY) - 3);
  return Object.freeze({
    dx: canFanOut || finite(x) < finite(otherX) ? 0 : push * .45,
    dy: canFanOut ? uy * push * 1.25 : 0,
    separated: true,
  });
}
