// Track the painted head, including the body's lift and the current joint pose.
// The supplied local transform is the same one used by the part painter.
export function recordV177PaintedHeadTop(receipt, destination, matrix, local) {
  const root = receipt?.headRoot;
  if (!root) return;
  const rootX = root.scaleX * root.sin;
  const rootY = root.scaleY * root.cos;
  const mx = local.scaleX * rootX;
  const my = local.scaleY * rootY;
  const dx = matrix[0] * mx + matrix[1] * my;
  const dy = matrix[2] * mx + matrix[3] * my;
  // A linear transform reaches its minimum at one of the rectangle's corners.
  const top = root.y + local.x * rootX + local.y * rootY
    + matrix[4] * mx + matrix[5] * my
    + dx * (destination.x + (dx < 0 ? destination.w : 0))
    + dy * (destination.y + (dy < 0 ? destination.h : 0));
  if (Number.isFinite(top)) receipt.headTopY = Math.min(receipt.headTopY ?? Infinity, top);
}

export function v177ClearHeadHealthBarY(anchorY, headTopY, barHeight, gap = 4) {
  return Number.isFinite(headTopY)
    ? Math.min(anchorY, headTopY - barHeight - gap)
    : anchorY;
}
