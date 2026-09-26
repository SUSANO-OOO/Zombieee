const SUPPORT_MANUAL_KINDS = Object.freeze(["medic", "brute", "engineer"]);

// Keep the support-unit body on authored, neutral atlas poses while its real
// manual ability advances. The runtime's abilityElapsed is the source of
// truth for recovery progress; this helper does not create a second timer.
export function v100SupportManualPose(runtime, definition, { hp = 1 } = {}) {
  const kind = runtime?.kind;
  if (!SUPPORT_MANUAL_KINDS.includes(kind) || !definition || definition.runtimeStatus !== "integrated") return null;
  if (!(Number.isFinite(hp) && hp > 0)) return null;
  if (!(Number.isFinite(definition.windupSeconds) && Number.isFinite(definition.recoverySeconds) && definition.windupSeconds >= 0 && definition.recoverySeconds >= 0)) return null;
  if (runtime.phase === "windup") return Number.isFinite(runtime.windupRemaining) ? "attack-a" : null;
  if (runtime.phase !== "recovery") return null;
  const abilityElapsed = Number(runtime.abilityElapsed);
  if (!Number.isFinite(abilityElapsed)) return null;
  const recoveryElapsed = abilityElapsed - definition.windupSeconds;
  if (recoveryElapsed < 0) return null;
  const attackBWindow = Math.min(.10, definition.recoverySeconds * .65);
  return recoveryElapsed + 1e-9 < attackBWindow ? "attack-b" : "idle";
}

export const V100_SUPPORT_MANUAL_STABLE_POSE = Object.freeze({
  offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1, opacity: 1,
});
