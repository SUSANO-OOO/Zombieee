import { AIRSTRIKE_DEF } from '../app/gameRules.js';

// This function is serialized into the browser. Keep all pixel-reading inputs
// inside it; do not read game state, seeds, clocks, gauges or result setters.
export function readVisibleBattleHealthBars(canvasOrFrame) {
  const live = typeof canvasOrFrame?.getContext === 'function';
  let frame, rect;
  try {
    frame = live
      ? canvasOrFrame.getContext('2d').getImageData(0, 0, canvasOrFrame.width, canvasOrFrame.height)
      : canvasOrFrame;
    rect = live ? canvasOrFrame.getBoundingClientRect()
      : frame?.rect ?? { x: 0, y: 0, width: frame?.width, height: frame?.height };
  } catch { return { status: 'unavailable', bars: [] }; }
  const { data, width, height } = frame ?? {};
  if (!data || !Number.isInteger(width) || !Number.isInteger(height)
    || width <= 0 || height <= 0 || data.length !== width * height * 4
    || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)
    || rect.width <= 0 || rect.height <= 0) return { status: 'invalid', bars: [] };
  // These are the actual painted human, enemy and Kurome-clone health bars.
  const colors = [
    { kind: 'enemy', rgb: [203, 80, 55] },
    { kind: 'clone', rgb: [98, 232, 239] },
    { kind: 'human', rgb: [233, 198, 90] },
  ];
  const groups = [];
  for (let y = 0; y < height; y++) {
    for (const color of colors) {
      let start = -1;
      for (let x = 0; x <= width; x++) {
        const i = (y * width + x) * 4;
        const match = x < width && data[i + 3] > 240
          && color.rgb.every((v, n) => Math.abs(data[i + n] - v) <= 5);
        if (match && start < 0) start = x;
        if (!match && start >= 0) {
          const length = x - start;
          if (length >= 4) {
            const previous = groups.find(g => g.kind === color.kind && g.bottom === y
              && Math.abs(g.left - start) <= 2 && Math.abs(g.right - x) <= 2);
            if (previous) {
              previous.bottom = y + 1;
              previous.left = Math.min(previous.left, start);
              previous.right = Math.max(previous.right, x);
              previous.pixels += length;
            } else groups.push({ kind: color.kind, left: start, right: x, top: y, bottom: y + 1, pixels: length });
          }
          start = -1;
        }
      }
    }
  }
  const sx = rect.width / width, sy = rect.height / height, bars = [];
  for (const g of groups) {
    const w = (g.right - g.left) * sx, h = (g.bottom - g.top) * sy;
    if (w < 5 || h < 1.4 || h > 8 || w / h < 2.3
      || g.pixels / ((g.right - g.left) * (g.bottom - g.top)) < .75) continue;
    const x = (g.left + g.right) / 2 * sx, y = (g.top + g.bottom) / 2 * sy;
    if (live && globalThis.document?.elementFromPoint(rect.x + x, rect.y + y) !== canvasOrFrame) continue;
    bars.push({ kind: g.kind, x, y, width: w, height: h,
      bitmapRect: { left: g.left, top: g.top, width: g.right - g.left, height: g.bottom - g.top } });
  }
  return { status: 'read', width: rect.width, height: rect.height,
    bitmapWidth: width, bitmapHeight: height, bars,
    canvas: live ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      worldScale: Number(canvasOrFrame.dataset.worldScale),
      worldOffsetX: Number(canvasOrFrame.dataset.worldOffsetX),
      worldOffsetY: Number(canvasOrFrame.dataset.worldOffsetY) } : undefined };
}

export function visibleAirstrikeTarget(canvas, frame, {
  radius = AIRSTRIKE_DEF.radius, minX = AIRSTRIKE_DEF.minX, maxX = AIRSTRIKE_DEF.maxX,
} = {}) {
  if (frame?.status !== 'read' || !canvas
    || !['x', 'y', 'worldScale', 'worldOffsetX', 'worldOffsetY'].every(key => Number.isFinite(canvas[key]))
    || canvas.worldScale <= 0) return null;
  // Approximate feet below the visible bars. This is a visible targeting
  // estimate, not a claim that a later impact hit a hidden fighter.
  const targets = frame.bars.filter(b => (b.kind === 'enemy' || b.kind === 'clone')
    && Number.isFinite(b.x) && Number.isFinite(b.y)).map(b => ({
    x: (b.x - canvas.worldOffsetX) / canvas.worldScale,
    y: (b.y - canvas.worldOffsetY) / canvas.worldScale + 90,
  }));
  if (!targets.length) return null;
  const centers = targets.map(t => ({ ...t }));
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      if (Math.hypot(targets[i].x - targets[j].x, (targets[i].y - targets[j].y) * 2) <= radius * 2) {
        centers.push({ x: (targets[i].x + targets[j].x) / 2, y: (targets[i].y + targets[j].y) / 2 });
      }
    }
  }
  const choices = centers.map(t => {
    const x = Math.max(minX + 1, Math.min(maxX - 1, t.x - 24)), y = t.y;
    const covered = targets.filter(p => Math.hypot(p.x - x, (p.y - y) * 2) <= radius);
    return { x, y, covered };
  }).sort((a, b) => b.covered.length - a.covered.length || a.x - b.x);
  const best = choices[0];
  return {
    point: { x: canvas.x + canvas.worldOffsetX + best.x * canvas.worldScale,
      y: canvas.y + canvas.worldOffsetY + best.y * canvas.worldScale },
    worldPoint: { x: best.x, y: best.y }, visibleEnemyBars: targets.length,
    expectedVisibleBarsInRadius: best.covered.length,
    source: 'visible native canvas health bars; estimated feet; no game state or result writes',
  };
}
