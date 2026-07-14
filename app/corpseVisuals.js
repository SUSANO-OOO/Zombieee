function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Returns world-space animation cues only. Infection timing remains in the
 * lifecycle model and is deliberately never exposed as text, progress, or a
 * countdown in this render contract.
 */
export function allyCorpseVisualCue(lifecycle = {}, worldTime = 0) {
  const state = typeof lifecycle.state === "string" ? lifecycle.state : "ally-corpse";
  const warningLevel = lifecycle.warningLevel === "strong"
    ? "strong"
    : lifecycle.warningLevel === "light"
      ? "light"
      : "none";
  const warning = state === "infection-warning";
  const strong = warning && warningLevel === "strong";
  const phase = finiteNumber(worldTime) + finiteNumber(lifecycle.id) * 0.37 + finiteNumber(lifecycle.variant) * 0.83;
  const tremorWave = warning ? Math.sin(phase * (strong ? 24 : 11)) : 0;
  const breathWave = Math.sin(phase * 3.2);

  return Object.freeze({
    tremorX: warning ? tremorWave * (strong ? 2.2 : 0.7) : 0,
    tremorY: warning ? Math.abs(tremorWave) * (strong ? 0.9 : 0.25) : 0,
    postureJitter: warning ? tremorWave * (strong ? 0.065 : 0.024) : 0,
    skinTint: state === "burning" ? "charred" : state === "ash" ? "ash" : strong ? "strong" : warning ? "light" : "none",
    eyeGlint: strong && breathWave > -0.2,
    smokePuffs: state === "burning" ? 3 : strong ? 2 : warning ? 1 : state === "ash" ? 1 : 0,
    flameTongues: state === "burning" ? 4 : 0,
    bodyScaleY: state === "ash" ? 0.42 : state === "burning" ? 0.9 : 1,
  });
}
