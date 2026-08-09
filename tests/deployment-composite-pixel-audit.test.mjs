import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeDeploymentCompositePixels,
  assertDeploymentCompositePixels,
} from "../app/deploymentCompositePixelAudit.js";

const PIXELS = 16;
const rgba = () => new Uint8ClampedArray(PIXELS * 4);
const paint = (buffer, pixel, [r, g, b, a = 255]) => {
  buffer.set([r, g, b, a], pixel * 4);
};

function validFixture() {
  const finalRgba = rgba();
  const renderedUnitRgba = rgba();
  const expectedUnitRgba = rgba();
  const renderedForegroundRgba = rgba();
  const expectedForegroundRgba = rgba();
  for (const pixel of [5, 6, 9, 10]) {
    paint(renderedUnitRgba, pixel, [220, 90, 40]);
    paint(expectedUnitRgba, pixel, [220, 90, 40]);
    paint(finalRgba, pixel, [220, 90, 40]);
  }
  return {
    finalRgba,
    renderedUnitRgba,
    expectedUnitRgba,
    renderedForegroundRgba,
    expectedForegroundRgba,
    unitDrawCount: 1,
    width: 4,
  };
}

test("actual final-canvas pixels pass only for one alpha-1 unit silhouette", () => {
  const audit = assertDeploymentCompositePixels(validFixture());
  assert.equal(audit.pass, true);
  assert.equal(audit.exposedOpaqueUnitMatchRatio, 1);
  assert.equal(audit.singleUnitSilhouette, true);
});

test("negative RGBA fixtures catch fractional foreground, mixed unit alpha, duplicates, and ghost pixels", () => {
  const fractionalForeground = validFixture();
  paint(fractionalForeground.renderedForegroundRgba, 0, [80, 90, 100, 120]);
  paint(fractionalForeground.expectedForegroundRgba, 0, [80, 90, 100, 255]);
  assert.equal(analyzeDeploymentCompositePixels(fractionalForeground).foregroundOpaque, false);

  const mixedFinalUnit = validFixture();
  paint(mixedFinalUnit.finalRgba, 5, [110, 45, 20, 255]);
  paint(mixedFinalUnit.finalRgba, 6, [110, 45, 20, 255]);
  paint(mixedFinalUnit.finalRgba, 9, [110, 45, 20, 255]);
  paint(mixedFinalUnit.finalRgba, 10, [110, 45, 20, 255]);
  assert.equal(analyzeDeploymentCompositePixels(mixedFinalUnit).finalCanvasKeepsUnitOpaque, false);

  const duplicateOffset = validFixture();
  paint(duplicateOffset.renderedUnitRgba, 11, [220, 90, 40, 255]);
  assert.equal(analyzeDeploymentCompositePixels(duplicateOffset).singleUnitSilhouette, false);

  const ghost = validFixture();
  paint(ghost.renderedUnitRgba, 5, [220, 90, 40, 96]);
  assert.equal(analyzeDeploymentCompositePixels(ghost).unitOpaque, false);

  const duplicateDraw = validFixture();
  duplicateDraw.unitDrawCount = 2;
  assert.throws(() => assertDeploymentCompositePixels(duplicateDraw), /final composite pixel audit failed/u);
});

test("an alpha-1 unit may be fully hidden only by the authored opaque foreground", () => {
  const fixture = validFixture();
  for (const pixel of [5, 6, 9, 10]) {
    paint(fixture.renderedForegroundRgba, pixel, [40, 50, 60, 255]);
    paint(fixture.expectedForegroundRgba, pixel, [40, 50, 60, 255]);
    paint(fixture.finalRgba, pixel, [40, 50, 60, 255]);
  }
  const audit = assertDeploymentCompositePixels(fixture);
  assert.equal(audit.fullyOccludedByOpaqueForeground, true);
  assert.equal(audit.unitOpaque, true);
  assert.equal(audit.foregroundOpaque, true);
});
