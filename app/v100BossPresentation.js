// The late bosses need both a larger silhouette and room above their heads.
// Keep the combat world unchanged and frame the whole scene lower on phones.
export function mugarianPresidentCompactScale({ compact, shortViewport } = {}) {
  return compact && shortViewport ? .9 : 1;
}

export function phoneLateBossCameraOffsetY({ stageNumber, compact, scale } = {}) {
  if (!compact || ![25, 30].includes(stageNumber) || !Number.isFinite(scale) || scale <= 0) return 0;
  // 60 CSS pixels at the canonical 844-wide phone, scaled with the world.
  // Paint, placement pointers and status overlays consume the same transform.
  return 60 * 960 / 844 * scale;
}
