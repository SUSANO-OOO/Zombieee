export const TAKUYA_SLAM_PRESENTATION = Object.freeze({
  impactSeconds: .24,
  strikeSeconds: .14,
  recoverySeconds: .10,
});
export const TAKUYA_STABLE_POSE = Object.freeze({
  offsetX: 0,
  offsetY: 0,
  rotationRadians: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

export function takuyaSlamPresentationPose({ kind, abilityWindup = 0, remaining = 0, hp = 1 } = {}) {
  if (kind !== "takuya" || hp <= 0) return null;
  if (abilityWindup > 0) return Object.freeze({ spriteState: "attack-a", clip: "wind-up", elapsed: 0 });
  if (remaining <= 0) return null;
  const elapsed = TAKUYA_SLAM_PRESENTATION.impactSeconds - remaining;
  const striking = remaining > TAKUYA_SLAM_PRESENTATION.recoverySeconds;
  return Object.freeze({
    spriteState: striking ? "attack-b" : "walk-a",
    clip: striking ? "active" : "recovery",
    elapsed: Math.max(0, elapsed),
  });
}
