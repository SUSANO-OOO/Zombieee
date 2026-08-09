function normalizedAlphaComparison(actualRgba, expectedRgba) {
  let intersection = 0;
  let union = 0;
  let absoluteDifference = 0;
  for (let channel = 3; channel < expectedRgba.length; channel += 4) {
    const actual = actualRgba[channel] ?? 0;
    const expected = expectedRgba[channel] ?? 0;
    if (actual > 0 && expected > 0) intersection += 1;
    if (actual > 0 || expected > 0) union += 1;
    absoluteDifference += Math.abs(actual - expected);
  }
  return Object.freeze({
    maskIoU: union > 0 ? intersection / union : 1,
    normalizedAlphaL1: absoluteDifference / (255 * Math.max(1, union)),
  });
}

function colorDistance(rgba, leftChannel, other, rightChannel) {
  return Math.abs(rgba[leftChannel] - other[rightChannel])
    + Math.abs(rgba[leftChannel + 1] - other[rightChannel + 1])
    + Math.abs(rgba[leftChannel + 2] - other[rightChannel + 2]);
}

function rgbaChecksum(rgba) {
  let hash = 0x811c9dc5;
  for (const value of rgba) {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Audits real painted RGBA from the final battle canvas against isolated
 * production draws of the same unit and CRAWLER foreground layer.
 */
export function analyzeDeploymentCompositePixels({
  finalRgba,
  renderedUnitRgba,
  expectedUnitRgba,
  renderedForegroundRgba,
  expectedForegroundRgba,
  unitDrawCount = 1,
  width = 0,
  visibleFinalRgba = null,
}) {
  const lengths = [
    finalRgba?.length,
    renderedUnitRgba?.length,
    expectedUnitRgba?.length,
    renderedForegroundRgba?.length,
    expectedForegroundRgba?.length,
  ];
  if (!lengths[0] || lengths.some((length) => length !== lengths[0]) || lengths[0] % 4 !== 0) {
    throw new Error("deployment composite RGBA buffers must be equal non-empty pixel arrays");
  }

  const unitAlpha = normalizedAlphaComparison(renderedUnitRgba, expectedUnitRgba);
  const foregroundAlpha = normalizedAlphaComparison(renderedForegroundRgba, expectedForegroundRgba);
  const pixelWidth = Math.max(1, Math.floor(Number(width) || Math.sqrt(lengths[0] / 4)));
  const pixelHeight = Math.ceil(lengths[0] / 4 / pixelWidth);
  let bestAlignment = { x: 0, y: 0, pixels: 0, matches: 0, ratio: 0 };
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      let pixels = 0;
      let matches = 0;
      for (let pixel = 0; pixel < lengths[0] / 4; pixel += 1) {
        const channel = pixel * 4;
        if (renderedUnitRgba[channel + 3] < 250 || expectedForegroundRgba[channel + 3] !== 0) continue;
        const x = pixel % pixelWidth;
        const y = Math.floor(pixel / pixelWidth);
        const finalX = x + dx;
        const finalY = y + dy;
        if (finalX < 0 || finalY < 0 || finalX >= pixelWidth || finalY >= pixelHeight) continue;
        const finalChannel = (finalY * pixelWidth + finalX) * 4;
        pixels += 1;
        if (finalRgba[finalChannel + 3] >= 250
          && colorDistance(finalRgba, finalChannel, renderedUnitRgba, channel) <= 24) {
          matches += 1;
        }
      }
      const ratio = pixels > 0 ? matches / pixels : 0;
      if (ratio > bestAlignment.ratio) bestAlignment = { x: dx, y: dy, pixels, matches, ratio };
    }
  }
  const exposedOpaqueUnitPixels = bestAlignment.pixels;
  const exposedOpaqueUnitMatches = bestAlignment.matches;
  let overlapPixels = 0;
  let mixedOverlapPixels = 0;
  let fractionalForegroundPixels = 0;
  for (let channel = 0; channel < finalRgba.length; channel += 4) {
    const unitAlphaValue = renderedUnitRgba[channel + 3];
    const foregroundAlphaValue = renderedForegroundRgba[channel + 3];
    const expectedForegroundAlpha = expectedForegroundRgba[channel + 3];
    if (expectedForegroundAlpha >= 250 && foregroundAlphaValue < 250) {
      fractionalForegroundPixels += 1;
    }
    if (unitAlphaValue < 250) continue;
    if (expectedForegroundAlpha === 0) continue;
    const pixel = channel / 4;
    const x = pixel % pixelWidth;
    const y = Math.floor(pixel / pixelWidth);
    const finalX = x + bestAlignment.x;
    const finalY = y + bestAlignment.y;
    if (finalX < 0 || finalY < 0 || finalX >= pixelWidth || finalY >= pixelHeight) continue;
    const finalChannel = (finalY * pixelWidth + finalX) * 4;
    overlapPixels += 1;
    const differsFromUnit = colorDistance(finalRgba, finalChannel, renderedUnitRgba, channel) > 24;
    const differsFromForeground = colorDistance(finalRgba, finalChannel, renderedForegroundRgba, channel) > 24;
    if (differsFromUnit && differsFromForeground) mixedOverlapPixels += 1;
  }

  const exposedOpaqueUnitMatchRatio = exposedOpaqueUnitPixels > 0
    ? exposedOpaqueUnitMatches / exposedOpaqueUnitPixels
    : 0;
  const unitOpaque = unitAlpha.maskIoU >= .999 && unitAlpha.normalizedAlphaL1 <= .001;
  const foregroundOpaque = foregroundAlpha.maskIoU >= .999
    && foregroundAlpha.normalizedAlphaL1 <= .001
    && fractionalForegroundPixels === 0;
  const fullyOccludedByOpaqueForeground = exposedOpaqueUnitPixels === 0 && overlapPixels > 0;
  const finalCanvasKeepsUnitOpaque = (exposedOpaqueUnitPixels > 0
    && exposedOpaqueUnitMatchRatio >= .9)
    || fullyOccludedByOpaqueForeground;
  const singleUnitSilhouette = Number(unitDrawCount) === 1 && unitOpaque;
  return Object.freeze({
    pass: unitOpaque && foregroundOpaque && finalCanvasKeepsUnitOpaque && singleUnitSilhouette,
    unitAlpha,
    foregroundAlpha,
    unitOpaque,
    foregroundOpaque,
    finalCanvasKeepsUnitOpaque,
    fullyOccludedByOpaqueForeground,
    singleUnitSilhouette,
    unitDrawCount: Number(unitDrawCount),
    exposedOpaqueUnitPixels,
    exposedOpaqueUnitMatches,
    exposedOpaqueUnitMatchRatio,
    finalCanvasAlignment: Object.freeze(bestAlignment),
    overlapPixels,
    mixedOverlapPixels,
    fractionalForegroundPixels,
    checksums: Object.freeze({
      final: rgbaChecksum(finalRgba),
      visibleFinalCanvas: visibleFinalRgba ? rgbaChecksum(visibleFinalRgba) : null,
      unit: rgbaChecksum(renderedUnitRgba),
      expectedUnit: rgbaChecksum(expectedUnitRgba),
      foreground: rgbaChecksum(renderedForegroundRgba),
      expectedForeground: rgbaChecksum(expectedForegroundRgba),
    }),
    visibleFinalCanvasNonzeroPixels: visibleFinalRgba
      ? [...visibleFinalRgba].filter((value, index) => index % 4 === 3 && value > 0).length
      : null,
  });
}

export function assertDeploymentCompositePixels(input) {
  const audit = analyzeDeploymentCompositePixels(input);
  if (!audit.pass) {
    throw new Error(`deployment final composite pixel audit failed: ${JSON.stringify(audit)}`);
  }
  return audit;
}
