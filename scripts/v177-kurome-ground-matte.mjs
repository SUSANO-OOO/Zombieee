import assert from "node:assert/strict";

// Only the neutral floor paint in this fixed, reviewed Kurome source may lose
// opacity. Colored claws, bones, dark outlines and their one-pixel edges stay.
export function removeKuromeGroundMatte(data, info) {
  assert.equal(info.width, 3360);
  assert.equal(info.height, 896);
  assert.equal(info.channels, 4);
  const rgba = Buffer.from(data);
  const records = [];
  const isPaleGround = offset => {
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    return Math.min(r, g, b) >= 130 && Math.max(r, g, b) - Math.min(r, g, b) <= 32;
  };
  for (let row = 0; row < 2; row++) for (let column = 0; column < 7; column++) {
    const protectedPixels = new Uint8Array(480 * 448);
    for (let y = 388; y < 448; y++) for (let x = 0; x < 480; x++) {
      const offset = ((row * 448 + y) * info.width + column * 480 + x) * 4;
      if (data[offset + 3] < 50 || isPaleGround(offset)) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < 480 && ny >= 0 && ny < 448) protectedPixels[ny * 480 + nx] = 1;
      }
    }
    let removed = 0;
    for (let y = 390; y < 432; y++) for (let x = 0; x < 480; x++) {
      const offset = ((row * 448 + y) * info.width + column * 480 + x) * 4;
      if (!data[offset + 3] || protectedPixels[y * 480 + x] || !isPaleGround(offset)) continue;
      rgba[offset + 3] = 0;
      removed++;
    }
    records.push({row, column, removed});
  }
  const expected = [1816, 1657, 2356, 2260, 2475, 2234, 1317];
  assert.deepEqual(records.map(row => row.removed), [...expected, ...expected],
    "Kurome matte source drift: review the original paint before changing the mask");
  return {rgba, records};
}
