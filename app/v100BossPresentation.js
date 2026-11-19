// Preserve giant proportions without hiding the head or the front route under
// phone controls. The entire scene and input share one transform; combat is unchanged.
export function mugarianPresidentCompactScale({ compact, shortViewport } = {}) {
  return compact && shortViewport ? .82 : 1;
}

export function phoneLateBossCameraOffsetY({ stageNumber, compact, shortViewport, scale } = {}) {
  if (!compact || ![25, 30].includes(stageNumber) || !Number.isFinite(scale) || scale <= 0) return 0;
  // At the two canonical phone heights, the front-route soles remain above
  // the command cards. Scale this framing with the same world as pointer input.
  return (shortViewport ? 35 : 60) * 960 / 844 * scale;
}
