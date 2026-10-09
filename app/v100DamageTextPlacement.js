// Position is chosen once, when the pooled label is inserted. Avoid adding
// layout work to every render frame or changing a hit's value/lifetime.
export function v100DamageTextPosition(x, y, value, existing) {
  const labelWidth = text => Math.min(220, Math.max(24, Array.from(String(text)).reduce((sum, char) => sum + (char.codePointAt(0) <= 127 ? 9 : 14), 8)));
  const width = labelWidth(value);
  const candidates = [[0, 0], [0, -16], [0, 16], [0, -32], [0, 32], [-32, -16], [32, -16], [0, -48]];
  for (const [dx, dy] of candidates) {
    const px = x + dx, py = y + dy;
    const occupied = existing.some(label => label.life > .12 && Math.abs(label.y - py) < 15
      && Math.abs(label.x - px) < (width + labelWidth(label.value)) / 2);
    if (!occupied) return { x: px, y: py };
  }
  return { x, y: y - 48 };
}
