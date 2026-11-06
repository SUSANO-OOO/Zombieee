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

// Presentation offsets survive while a label floats, but never enter the save
// or simulation. A pooled object starts fresh on every insertion.
const paintOffsets = new WeakMap();
export function resetV100DamageTextPaint(label) { paintOffsets.delete(label); }

export function layoutV100DamageTextPaint(labels, { measure, obstacles = [], bounds }) {
  const placed = [], occupied = [...obstacles], gap = 4;
  for (const label of labels) {
    let state = paintOffsets.get(label);
    if (!state) {
      const metrics = measure(label.value);
      state = { dx: 0, dy: 0,
        left: Math.max(0, metrics.actualBoundingBoxLeft ?? metrics.width / 2),
        right: Math.max(0, metrics.actualBoundingBoxRight ?? metrics.width / 2),
        ascent: Math.max(0, metrics.actualBoundingBoxAscent ?? 14),
        descent: Math.max(0, metrics.actualBoundingBoxDescent ?? 3) };
      paintOffsets.set(label, state);
    }
    const { left, right, ascent, descent } = state;
    const preferred = { x: label.x + state.dx, y: label.y + state.dy };
    const valid = (x, y) => x - left >= bounds.left + gap && x + right <= bounds.right - gap
      && y - ascent >= bounds.top + gap && y + descent <= bounds.bottom - gap
      && !occupied.some(r => x + right > r.x - gap && x - left < r.x + r.width + gap
        && y + descent > r.y - gap && y - ascent < r.y + r.height + gap);
    let position = preferred;
    if (!valid(position.x, position.y)) {
      // Prefer vertical separation near the hit. Horizontal edge positions are
      // a fallback for a full column, including cropped mobile viewports.
      const xs = [...new Set([preferred.x, bounds.left + left + gap, bounds.right - right - gap,
        Math.max(bounds.left + left + gap, Math.min(bounds.right - right - gap, preferred.x)),
        ...occupied.flatMap(r => [r.x - right - gap, r.x + r.width + left + gap])])]
        .sort((a, b) => Math.abs(a - preferred.x) - Math.abs(b - preferred.x));
      let bestScore = Infinity;
      for (const x of xs) {
        const horizontalCost = Math.abs(x - preferred.x) * 3;
        if (horizontalCost >= bestScore) break;
        if (x - left < bounds.left + gap || x + right > bounds.right - gap) continue;
        // Merge blocked vertical intervals once per column, instead of trying
        // every x/y/obstacle combination during a large simultaneous burst.
        const intervals = occupied.filter(r => x + right > r.x - gap && x - left < r.x + r.width + gap)
          .map(r => [r.y - descent - gap, r.y + r.height + ascent + gap]).sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const interval of intervals) {
          const last = merged.at(-1);
          if (last && interval[0] < last[1]) last[1] = Math.max(last[1], interval[1]);
          else merged.push([...interval]);
        }
        const minY = bounds.top + ascent + gap, maxY = bounds.bottom - descent - gap;
        const y0 = Math.max(minY, Math.min(maxY, preferred.y));
        const blocked = merged.find(([a, b]) => y0 > a && y0 < b);
        for (const y of blocked ?? [y0]) {
          if (y < minY || y > maxY) continue;
          const score = horizontalCost + Math.abs(y - preferred.y);
          if (score < bestScore && valid(x, y)) { position = { x, y }; bestScore = score; }
        }
      }
    }
    state.dx = position.x - label.x; state.dy = position.y - label.y;
    const rect = { x: position.x - left, y: position.y - ascent, width: left + right, height: ascent + descent };
    occupied.push(rect);
    placed.push({ label, ...position, rect });
  }
  return placed;
}
