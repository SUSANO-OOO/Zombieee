import sharp from 'sharp';
import {createHash} from 'node:crypto';
import { AIRSTRIKE_DEF } from '../app/gameRules.js';

// Scan an observed native PNG on the host; never read the live canvas context.
export function readVisibleBattleHealthBars(frame) {
  const {width, height} = frame ?? {};
  const rect = frame?.rect ?? {x:0, y:0, width, height};
  const { data } = frame ?? {};
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
          && Math.abs(data[i] - color.rgb[0]) <= 5
          && Math.abs(data[i + 1] - color.rgb[1]) <= 5
          && Math.abs(data[i + 2] - color.rgb[2]) <= 5;
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
    bars.push({ kind: g.kind, x, y, width: w, height: h,
      bitmapRect: { left: g.left, top: g.top, width: g.right - g.left, height: g.bottom - g.top } });
  }
  return { status: 'read', width: rect.width, height: rect.height,
    bitmapWidth: width, bitmapHeight: height, bars };
}

function readCanvasProjectionAndOwners(element, points) {
  if (element.tagName !== 'CANVAS') return {projection:null, owned:[]};
  const r = element.getBoundingClientRect();
  return {
    projection: {x:r.x, y:r.y, width:r.width, height:r.height,
      worldScale:Number(element.dataset.worldScale),
      worldOffsetX:Number(element.dataset.worldOffsetX),
      worldOffsetY:Number(element.dataset.worldOffsetY)},
    owned: points.map(point => document.elementFromPoint(r.x + point.x, r.y + point.y) === element),
  };
}

export async function observeVisibleBattleHealthBars(canvasLocator) {
  const {projection} = await canvasLocator.evaluate(readCanvasProjectionAndOwners, []);
  const keys = ['x','y','width','height','worldScale','worldOffsetX','worldOffsetY'];
  if (!projection || !keys.every(key => Number.isFinite(projection[key]))
    || projection.width <= 0 || projection.height <= 0 || projection.worldScale <= 0) {
    return {status:'unavailable', bars:[]};
  }
  const png = await canvasLocator.screenshot({type:'png', animations:'allow', scale:'css', timeout:2_000});
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const frame = readVisibleBattleHealthBars({data, width:info.width, height:info.height,
    rect:{x:0,y:0,width:projection.width,height:projection.height}});
  const current = await canvasLocator.evaluate(readCanvasProjectionAndOwners,
    frame.bars.map(bar => ({x:bar.x,y:bar.y})));
  if (!current.projection || !keys.every(key => current.projection[key] === projection[key])) {
    return {status:'stale', bars:[]};
  }
  return {...frame, bars:frame.bars.filter((bar,index) => current.owned[index]), canvas:projection,
    png, pngSha256:createHash('sha256').update(png).digest('hex'),
    source:'native PNG screenshot, host pixel scan, fresh visible ownership; no canvas context access'};
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
