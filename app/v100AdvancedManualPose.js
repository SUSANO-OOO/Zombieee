import { manualAbilityDefinitionFor } from "./manualAbilities.js";

const SUPPORTED_KINDS = Object.freeze(["scout", "tky", "mrs-chiha", "miyamoto-musashi", "zakimiya"]);
const STABLE_POSE = Object.freeze({
  offsetX: 0,
  offsetY: 0,
  rotationRadians: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  movement: false,
  bodyScale: 1,
});

const result = (spriteState) => Object.freeze({ spriteState, pose: STABLE_POSE });

function finiteRuntime(runtime) {
  return Boolean(runtime
    && SUPPORTED_KINDS.includes(runtime.kind)
    && Number.isFinite(runtime.activationId)
    && runtime.activationId > 0
    && Number.isFinite(runtime.abilityElapsed)
    && Number.isFinite(runtime.windupRemaining)
    && runtime.windupRemaining >= 0);
}

function recoveryElapsed(runtime, definition) {
  return Math.max(0, definition.recoverySeconds - runtime.windupRemaining);
}

function ordinaryRecoveryPose(runtime, definition, activeCell) {
  const elapsed = recoveryElapsed(runtime, definition);
  const recoveryWindow = runtime.kind === "zakimiya"
    ? .1
    : activeCell === "attack-a" && runtime.kind === "miyamoto-musashi"
    ? .12
    : Math.min(.1, definition.recoverySeconds * .65);
  return elapsed < recoveryWindow
    ? result(activeCell)
    : result("idle");
}

function mrsSalvoPose(runtime, definition) {
  const elapsed = runtime.abilityElapsed;
  const points = Array.isArray(runtime.target?.points) ? runtime.target.points : [];
  for (let index = 0; index < points.length; index += 1) {
    const launchAt = definition.windupSeconds + definition.salvoIntervalSeconds * index;
    if (elapsed >= launchAt && elapsed < launchAt + .08) return result("attack-b");
  }
  return result("attack-a");
}

/**
 * Returns the authored cell and stable presentation contract for the three
 * advanced V1 manual abilities. The caller remains responsible for selecting
 * the atlas/direction and for applying ordinary damage and movement.
 */
export function v100AdvancedManualPose(runtime, { hp = 1 } = {}) {
  if (!(Number.isFinite(hp) && hp > 0) || !finiteRuntime(runtime)) return null;
  const definition = manualAbilityDefinitionFor(runtime.kind);
  if (!definition || definition.runtimeStatus !== "integrated") return null;
  if (runtime.phase === "windup") {
    if (runtime.kind === "tky" || runtime.kind === "miyamoto-musashi") return result("attack-b");
    if (runtime.kind === "zakimiya") return definition.windupSeconds - runtime.windupRemaining < .4 ? result("attack-a") : result("attack-b");
    if (runtime.kind === "scout") {
      const elapsed = definition.windupSeconds - runtime.windupRemaining;
      if (runtime.windupRemaining > .18) return result("attack-a");
      return ((elapsed - .06) % .15) < .075 ? result("walk-a") : result("walk-b");
    }
    return result("attack-a");
  }
  if (runtime.kind === "mrs-chiha" && runtime.phase === "salvo") return mrsSalvoPose(runtime, definition);
  if (runtime.kind === "miyamoto-musashi" && runtime.phase === "guard") return result("attack-b");
  if (runtime.phase === "recovery") {
    if (runtime.kind === "mrs-chiha") {
      return recoveryElapsed(runtime, definition) < .18 ? result("attack-a") : result("idle");
    }
    return ordinaryRecoveryPose(runtime, definition, runtime.kind === "tky" || runtime.kind === "miyamoto-musashi" ? "attack-a" : "attack-b");
  }
  return null;
}

export const V100_ADVANCED_MANUAL_POSE_STABLE = STABLE_POSE;
