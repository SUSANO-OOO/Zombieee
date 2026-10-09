import { manualAbilityDefinitionFor } from "./manualAbilities.js";

const SCOUT_KIND = "scout";
const SCOUT_MOVING_SECONDS = .18;

function finitePoint(value) {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y);
}

/**
 * Advances only the presentation approach during Scout's windup.
 * Combat state, target state, and the caller's objects remain untouched.
 */
export function v100ScoutApproachStep(owner, target, dt) {
  const manual = owner?.manualAbility;
  const definition = manualAbilityDefinitionFor(SCOUT_KIND);
  if (owner?.kind !== SCOUT_KIND || !(Number.isFinite(owner.hp) && owner.hp > 0) || owner.combatReady !== true
    || manual?.phase !== "windup" || !definition
    || !(Number.isFinite(dt) && dt > 0)
    || !(Number.isFinite(manual.windupRemaining) && manual.windupRemaining > 0)
    || !finitePoint(owner) || !finitePoint(target)
    || target.side !== "zombie" || !(Number.isFinite(target.hp) && target.hp > 0) || target.combatReady !== true
    || !Number.isFinite(target.lane)
    || !(Number.isFinite(target.bodyRadius) && target.bodyRadius > 0)
    || !(Number.isFinite(owner.bodyRadius) && owner.bodyRadius > 0)) return null;
  const targetId = manual.target?.targetId;
  if (targetId !== target.id) return null;
  const remaining = manual.windupRemaining;
  const available = Math.min(dt, remaining);
  const movingSeconds = Math.max(0, available - Math.max(0, remaining - SCOUT_MOVING_SECONDS));
  const moveRemaining = Math.min(remaining, SCOUT_MOVING_SECONDS);
  if (!(movingSeconds > 0) || !(moveRemaining > 0)) return null;
  const blend = movingSeconds / Math.max(movingSeconds, moveRemaining);
  const lockedDirection = Number(manual.target?.direction);
  const direction = Number.isFinite(lockedDirection) && lockedDirection !== 0
    ? Math.sign(lockedDirection)
    : Math.sign(target.x - owner.x) || 1;
  const landingX = target.x - direction * (target.bodyRadius + definition.stopDistance);
  return Object.freeze({
    x: owner.x + (landingX - owner.x) * blend,
    y: owner.y + (target.y - owner.y) * blend,
    lane: target.lane,
    direction,
  });
}

export const V100_SCOUT_APPROACH_MOVING_SECONDS = SCOUT_MOVING_SECONDS;
