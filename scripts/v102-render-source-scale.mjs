import assert from 'node:assert/strict';

// A logical pose can use a different crop from the frame actually painted by
// the joint renderer. Measure the paint receipt, never infer its crop by pose.
export function renderedSourcePixelScale(receipt) {
  const rect = receipt?.sourceRect;
  assert.ok(rect && ['x', 'y', 'w', 'h'].every(key => Number.isFinite(rect[key])), 'Actual painted source rectangle is required');
  assert.ok(rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0, 'Actual painted source rectangle must be positive');
  assert.equal(rect.y, receipt.sourceRow, 'Paint receipt row and crop agree');
  assert.ok(Number.isFinite(receipt.renderWidth) && receipt.renderWidth > 0
    && Number.isFinite(receipt.renderHeight) && receipt.renderHeight > 0, 'Actual painted dimensions are required');
  const xScale = receipt.renderWidth / rect.w, yScale = receipt.renderHeight / rect.h;
  assert.ok(Math.abs(xScale - yScale) < 1e-8, 'Actual painted source pixels retain equal horizontal and vertical scale');
  return yScale;
}
