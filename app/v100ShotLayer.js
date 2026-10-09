const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const SCALE = 0.5;
const GLOW_SHIFT = 16384;
const CLEAR_COLOR = "rgba(0,0,0,0)";
const PROPERTIES = ["fillStyle", "globalAlpha", "globalCompositeOperation", "lineCap", "lineJoin", "lineWidth", "miterLimit", "font", "textAlign", "textBaseline", "direction", "strokeStyle", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "filter", "imageSmoothingEnabled", "imageSmoothingQuality", "lineDashOffset"];
const METHODS = ["arc", "beginPath", "closePath", "drawImage", "fill", "fillRect", "lineTo", "moveTo", "quadraticCurveTo", "restore", "rotate", "save", "stroke", "translate"];
const PAINT = new Set(["fill", "fillRect", "drawImage", "stroke"]);
const PATH_PAINT = new Set(["fill", "stroke"]);
const finite = (v) => Number.isFinite(v);
const tp = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
const mm = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
export function supportBounds(commands, initial, width, height, initialState = {}) {
  try {
    const full = { x0: 0, y0: 0, x1: width, y1: height }, box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    if (!Array.isArray(initial) || initial.length < 6 || ![...initial.slice(0,6), width, height].every(finite) || width <= 0 || height <= 0) return { bounds: full, full: true, empty: false };
    let m = initial.slice(0,6).map(v => v * SCALE), blur = initialState?.shadowBlur ?? 0, lineWidth = initialState?.lineWidth ?? 1, miter = initialState?.miterLimit ?? 10;
    if (![blur,lineWidth,miter].every(finite) || blur < 0 || lineWidth <= 0 || miter <= 0) return { bounds: full, full: true, empty: false };
    let stack = [], maxPad = 0, hasPaint = false;
    const add = (x,y) => { const p = tp(m,x,y); if (![p.x,p.y].every(finite)) throw new Error('nonfinite geometry'); box.x0=Math.min(box.x0,p.x); box.y0=Math.min(box.y0,p.y); box.x1=Math.max(box.x1,p.x); box.y1=Math.max(box.y1,p.y); };
    const rect = (x,y,w,h) => { if (![x,y,w,h].every(finite) || w < 0 || h < 0) throw new Error('invalid rect'); add(x,y); add(x+w,y); add(x,y+h); add(x+w,y+h); };
    const paint = () => { if (blur > 0) { hasPaint = true; maxPad = Math.max(maxPad, 4 * blur * SCALE + 4 + (lineWidth / 2) * Math.hypot(m[0],m[1],m[2],m[3]) * Math.max(1,miter)); } };
    for (const op of commands) {
      if (!op || typeof op.name !== 'string' || (op.kind !== 'write' && op.kind !== 'call')) throw new Error('unsupported op');
      const a = op.args ?? [];
      if (op.kind === 'write') { if (op.name === 'shadowBlur') { if (!finite(op.value) || op.value < 0) throw new Error('invalid blur'); blur=op.value; } else if (op.name === 'lineWidth') { if (!finite(op.value) || op.value <= 0) throw new Error('invalid width'); lineWidth=op.value; } else if (op.name === 'miterLimit') { if (!finite(op.value) || op.value <= 0) throw new Error('invalid miter'); miter=op.value; } continue; }
      if (op.name === 'save') { stack.push({m:[...m],blur,lineWidth,miter}); continue; }
      if (op.name === 'restore') { const st=stack.pop(); if (!st) throw new Error('restore underflow'); ({m,blur,lineWidth,miter}=st); continue; }
      if (op.name === 'beginPath' || op.name === 'closePath') continue;
      if (op.name === 'translate') { if (a.length<2 || !a.slice(0,2).every(finite)) throw new Error('translate'); m=mm(m,[1,0,0,1,a[0],a[1]]); continue; }
      if (op.name === 'rotate') { if (!finite(a[0])) throw new Error('rotate'); const c=Math.cos(a[0]), s=Math.sin(a[0]); m=mm(m,[c,s,-s,c,0,0]); continue; }
      if (op.name === 'moveTo' || op.name === 'lineTo') { if (a.length<2 || !a.slice(0,2).every(finite)) throw new Error('point'); add(a[0],a[1]); continue; }
      if (op.name === 'quadraticCurveTo') { if (a.length<4 || !a.slice(0,4).every(finite)) throw new Error('quadratic'); add(a[0],a[1]); add(a[2],a[3]); continue; }
      if (op.name === 'arc') { if (a.length<5 || !a.slice(0,5).every(finite) || a[2]<0) throw new Error('arc'); const cx=tp(m,a[0],a[1]), rx=a[2]*Math.hypot(m[0],m[2]), ry=a[2]*Math.hypot(m[1],m[3]); if (![cx.x,cx.y,rx,ry].every(finite)) throw new Error('arc'); box.x0=Math.min(box.x0,cx.x-rx); box.y0=Math.min(box.y0,cx.y-ry); box.x1=Math.max(box.x1,cx.x+rx); box.y1=Math.max(box.y1,cx.y+ry); continue; }
      if (op.name === 'fillRect') { if (a.length<4) throw new Error('fillRect'); rect(...a.slice(0,4)); paint(); continue; }
      if (op.name === 'drawImage') { if (a.length>=9) rect(a[5],a[6],a[7],a[8]); else if (a.length>=5) rect(a[1],a[2],a[3],a[4]); else if (a.length>=3) { const image=a[0]; const iw=image?.naturalWidth ?? image?.width, ih=image?.naturalHeight ?? image?.height; if (!image || !finite(iw) || !finite(ih)) throw new Error('image'); rect(a[1],a[2],iw,ih); } else throw new Error('drawImage'); paint(); continue; }
      if (op.name === 'fill' || op.name === 'stroke') { if (a.length && a[0] !== 'nonzero' && a[0] !== 'evenodd') throw new Error('Path2D'); paint(); continue; }
      throw new Error('unsupported op');
    }
    if (stack.length) throw new Error("unbalanced save/restore");
    if (hasPaint && ![box.x0,box.y0,box.x1,box.y1].every(finite)) throw new Error("nonfinite painted bounds");
    if (!hasPaint || box.x1 < box.x0 || box.y1 < box.y0) return { bounds:{x0:0,y0:0,x1:0,y1:0}, full:false, empty:true };
    const bounds = { x0:Math.max(0,Math.floor(box.x0-maxPad)), y0:Math.max(0,Math.floor(box.y0-maxPad)), x1:Math.min(width,Math.ceil(box.x1+maxPad)), y1:Math.min(height,Math.ceil(box.y1+maxPad)) };
    if (![maxPad,bounds.x0,bounds.y0,bounds.x1,bounds.y1].every(finite)) return { bounds:full, full:true, empty:false };
    if (bounds.x1 <= bounds.x0 || bounds.y1 <= bounds.y0) return { bounds:{x0:0,y0:0,x1:0,y1:0}, full:false, empty:true };
    return { bounds, full:false, empty:false };
  } catch { return { bounds:{x0:0,y0:0,x1:width,y1:height}, full:true, empty:false }; }
}
function recorder(onFallback) {
  const commands = [], target = Object.create(null); let mode = "recording", depth = 0, pathKnown = false;
  const activate = (reason) => { if (mode === "recording") { mode = "fallback"; onFallback(reason); } };
  const call = (name, args) => {
    if (mode !== "recording") return onFallback("forward call", { kind: "call", name, args });
    if (PATH_PAINT.has(name) && !pathKnown) { activate("current path state unsupported"); return onFallback("current path call", { kind: "call", name, args }); }
    if (commands.length >= 8192) { activate("command budget exceeded (8192)"); return onFallback("overflow call", { kind: "call", name, args }); }
    if (name === "beginPath") pathKnown = true;
    if (name === "save") depth += 1;
    if (name === "restore") { if (depth < 1) { activate("restore underflow"); return onFallback("restore call", { kind: "call", name, args }); } depth -= 1; }
    commands.push({ kind: "call", name, args });
  };
  for (const name of PROPERTIES) Object.defineProperty(target, name, { configurable: false, enumerable: true,
    get: () => { activate(`unsupported read: ${name}`); return onFallback("read", { kind: "read", name }); },
    set: (value) => {
      const unsupported = name === "shadowOffsetX" || name === "shadowOffsetY" || name === "filter" || (name === "globalCompositeOperation" && value !== "lighter") || ((name === "fillStyle" || name === "strokeStyle") && typeof value !== "string");
      if (unsupported) { activate(`unsupported write: ${name}`); onFallback("write", { kind: "write", name, value }); return; }
      if (mode === "recording" && commands.length < 8192) commands.push({ kind: "write", name, value });
      else { if (mode === "recording") activate("command budget exceeded (8192)"); onFallback("write", { kind: "write", name, value }); }
    },
  });
  for (const name of METHODS) target[name] = (...args) => call(name, args);
  const proxy = new Proxy(target, { get: (object, property) => { if (Object.prototype.hasOwnProperty.call(object, property)) return object[property]; activate(`unsupported getter: ${String(property)}`); return onFallback("getter", { kind: "read", name: property }); }, set: (object, property, value) => { if (METHODS.includes(property)) { activate(`method mutation: ${String(property)}`); throw new TypeError(`recorded method mutation unsupported: ${String(property)}`); } if (!Object.prototype.hasOwnProperty.call(object, property)) { activate(`unsupported setter: ${String(property)}`); onFallback("setter", { kind: "write", name: property, value }); return true; } object[property] = value; return true; } });
  return { proxy, commands, get mode() { return mode; }, get depth() { return depth; } };
}

function replay(commands, target, mode, scale, transform, originX = 0, originY = 0) {
  const [a, b, c, d, e, f] = transform; target.setTransform(mode === "glow" ? a * scale : a, mode === "glow" ? b * scale : b, mode === "glow" ? c * scale : c, mode === "glow" ? d * scale : d, mode === "glow" ? e * scale - GLOW_SHIFT - originX : e, mode === "glow" ? f * scale - originY : f);
  let blur = Number(target.shadowBlur) || 0; const stack = []; if (mode === "glow") target.shadowBlur = blur * scale;
  const assign = (name, value) => { if (name === "shadowBlur") { blur = Number(value) || 0; target.shadowBlur = mode === "glow" ? blur * scale : mode === "core" ? 0 : blur; } else if (name === "shadowColor") target[name] = mode === "core" ? CLEAR_COLOR : value; else target[name] = value; };
  try { for (const op of commands) { if (op.kind === "write") { assign(op.name, op.value); continue; } if (op.name === "save") stack.push(blur); if (op.name === "restore") blur = stack.pop() ?? blur; if (mode === "glow" && blur === 0 && PAINT.has(op.name)) continue; target[op.name](...op.args); } } finally { while (stack.length) { try { target.restore(); } catch {} stack.pop(); } }
}

export function createV100ShotLayer({ createCanvas = () => document.createElement("canvas"), maxBytes = DEFAULT_MAX_BYTES } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 0) throw new TypeError("bounded additive surface budget required");
  let surface = null, context = null, bytes = 0, builds = 0, frames = 0, draws = 0, callbackCount = 0, commandPeak = 0, fallbacks = 0, errors = 0, drawing = false, surfaceColorSpace = null, fullBlitPixels = 0, actualBlitPixels = 0, boundedBlits = 0, fullBoundsFallbacks = 0, replayFullPixels = 0, replayClipPixels = 0, replayClippedFrames = 0, capacityWidth = 0, capacityHeight = 0, activeX = 0, activeY = 0, activeWidth = 0, activeHeight = 0, resizes = 0, reuses = 0, surfaceAllocations = 0;
  const release = () => { if (surface) { surface.width = 0; surface.height = 0; } surface = null; context = null; bytes = 0; surfaceColorSpace = null; capacityWidth = 0; capacityHeight = 0; activeX = 0; activeY = 0; activeWidth = 0; activeHeight = 0; };
  const clear = () => { if (drawing) throw new Error("additive shot layer clear during draw"); release(); };
  const snapshot = () => ({ bytes, width: surface?.width ?? 0, height: surface?.height ?? 0, capacityWidth, capacityHeight, activeX, activeY, activeWidth, activeHeight, resizes, reuses, surfaceAllocations, maxBytes, builds, frames, draws, callbackCount, commandPeak, fallbacks, errors, fullBlitPixels, actualBlitPixels, boundedBlits, fullBoundsFallbacks, replayFullPixels, replayClipPixels, replayClippedFrames, actualContextAttributes: context?.getContextAttributes?.() ?? null });
  const copyState = (to, from, transform) => { to.setTransform(...transform); for (const name of ["lineWidth", "lineCap", "lineJoin", "miterLimit", "lineDashOffset", "font", "textAlign", "textBaseline", "direction", "fillStyle", "strokeStyle", "globalAlpha", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "imageSmoothingEnabled", "imageSmoothingQuality", "globalCompositeOperation"]) if (name in to && name in from) to[name] = from[name]; /* Keep the offscreen filter untouched: Chromium software shadows disappear when filter='none' is assigned, even though the getter remains 'none'. */ if (typeof from.getLineDash === "function" && typeof to.setLineDash === "function") to.setLineDash(from.getLineDash()); };
  const directFallback = (main, drawShots) => {
    fallbacks += 1; callbackCount += 1; drawing = true; let ownerDepth = 0;
    const execute = (kind, name, value, args = []) => {
      if (kind === "read") { const item = main[name]; return typeof item === "function" ? (...callArgs) => execute("call", name, undefined, callArgs) : item; }
      if (kind === "write") { main[name] = value; return main[name]; }
      if (name === "restore" && ownerDepth <= 1) return undefined;
      const fn = main[name]; if (typeof fn !== "function") return fn;
      const result = fn.apply(main, args); if (name === "save") ownerDepth += 1; if (name === "restore") ownerDepth = Math.max(1, ownerDepth - 1); return result;
    };
    const receiver = new Proxy(Object.create(null), { get: (_target, name) => execute("read", name), set: (_target, name, value) => { execute("write", name, value); return true; } });
    try { if (typeof main.save === "function" && typeof main.restore === "function") { main.save(); ownerDepth = 1; } drawShots(receiver); }
    catch (error) { errors += 1; throw error; }
    finally { while (ownerDepth > 1) { try { main.restore(); } catch {} ownerDepth -= 1; } if (ownerDepth) { try { main.restore(); } catch {} ownerDepth = 0; } drawing = false; }
  };
  const draw = (main, drawShots) => {
    if (typeof drawShots !== "function") throw new TypeError("drawShots callback required"); if (drawing) throw new Error("additive shot layer reentry");
    if (typeof main.getTransform !== "function" || typeof main.save !== "function" || typeof main.restore !== "function" || typeof main.drawImage !== "function") { release(); directFallback(main, drawShots); return; }
    const t = main.getTransform(); const transform = [t.a, t.b, t.c, t.d, t.e, t.f]; const width = Number(main.canvas?.width), height = Number(main.canvas?.height); const attrs = main.getContextAttributes?.() ?? {}; const colorSpace = attrs.colorSpace ?? "srgb"; const glowWidth = Math.ceil(width * SCALE), glowHeight = Math.ceil(height * SCALE), nextBytes = glowWidth * glowHeight * 4, fullCapacityWidth = Math.ceil(glowWidth / 64) * 64, fullCapacityHeight = Math.ceil(glowHeight / 64) * 64;
    if (colorSpace !== "srgb" || !(width > 0 && height > 0) || width > 4096 || height > 4096 || !Number.isFinite(nextBytes) || nextBytes > maxBytes || fullCapacityWidth > 2048 || fullCapacityHeight > 2048 || Number(main.shadowOffsetX) !== 0 || Number(main.shadowOffsetY) !== 0 || (main.filter ?? "none") !== "none") { release(); directFallback(main, drawShots); return; }
    let callbackStarted = false, surfaceGuard = false, record = null, ownerDepth = 0, flushed = false, resizing = false;
    const executeRaw = (op) => { if (op.kind === "read") { const value = main[op.name]; return typeof value === "function" ? (...args) => executeRaw({ kind: "call", name: op.name, args }) : value; } if (op.kind === "write") { main[op.name] = op.value; return main[op.name]; } if (op.name === "restore" && ownerDepth <= 1) return undefined; const fn = main[op.name]; if (typeof fn !== "function") return fn; const result = fn.apply(main, op.args); if (op.name === "save") ownerDepth += 1; if (op.name === "restore") ownerDepth = Math.max(1, ownerDepth - 1); return result; };
    const flush = () => { if (flushed) return; flushed = true; fallbacks += 1; main.save(); ownerDepth = 1; try { for (const op of record.commands) executeRaw(op); } catch (error) { while (ownerDepth > 1) { try { main.restore(); } catch {} ownerDepth -= 1; } try { main.restore(); } catch {} ownerDepth = 0; throw error; } };
    const onFallback = (reason, op) => { if (!flushed) flush(reason); return op ? executeRaw(op) : undefined; };
    const configureSurface = () => { context.save(); surfaceGuard = true; context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, capacityWidth, capacityHeight); copyState(context, main, transform); context.globalCompositeOperation = "lighter"; context.globalAlpha = 1; context.shadowOffsetX = GLOW_SHIFT; context.shadowOffsetY = 0; };
    const ensureSurface = (targetW, targetH) => { const requestedWidth = Math.max(1, Math.ceil(targetW / 64) * 64), requestedHeight = Math.max(1, Math.ceil(targetH / 64) * 64); if (requestedWidth > fullCapacityWidth || requestedHeight > fullCapacityHeight) throw new Error("ROI glow surface bounds exceeded"); const exactWidth = Math.max(1, Math.ceil(targetW)), exactHeight = Math.max(1, Math.ceil(targetH)); const roundedBytes = requestedWidth * requestedHeight * 4; const exactBytes = exactWidth * exactHeight * 4; const useRounded = roundedBytes <= maxBytes; const neededWidth = useRounded ? requestedWidth : exactWidth, neededHeight = useRounded ? requestedHeight : exactHeight; if (!Number.isFinite(exactBytes) || exactBytes > maxBytes || neededWidth > fullCapacityWidth || neededHeight > fullCapacityHeight) throw new Error("ROI glow surface budget exceeded"); const hadSurface = !!surface; const nextWidth = hadSurface ? Math.max(capacityWidth, neededWidth) : neededWidth, nextHeight = hadSurface ? Math.max(capacityHeight, neededHeight) : neededHeight; if (nextWidth * nextHeight * 4 > maxBytes) { if (hadSurface && !surfaceGuard) { release(); return ensureSurface(targetW,targetH); } throw new Error("ROI glow surface budget exceeded"); } if (!surface) { surface = createCanvas(); surfaceAllocations += 1; } const needsResize = capacityWidth !== nextWidth || capacityHeight !== nextHeight || surfaceColorSpace !== colorSpace; if (needsResize) { if (surfaceGuard) { context.restore(); surfaceGuard = false; } resizing = true; surface.width = nextWidth; surface.height = nextHeight; context = surface.getContext("2d", { alpha: true, willReadFrequently: false, colorSpace }); if (!context) throw new Error("additive surface context unavailable"); if (hadSurface) resizes += 1; else builds += 1; capacityWidth = nextWidth; capacityHeight = nextHeight; bytes = nextWidth * nextHeight * 4; surfaceColorSpace = colorSpace; resizing = false; } else if (hadSurface) reuses += 1; };
    try {
      drawing = true; ensureSurface(1, 1); context.save(); surfaceGuard = true;
      record = recorder(onFallback); callbackStarted = true; callbackCount += 1; drawShots(record.proxy); commandPeak = Math.max(commandPeak, record.commands.length);
      if (record.mode === "fallback") { if (surfaceGuard) { context.restore(); surfaceGuard = false; } while (ownerDepth > 1) { main.restore(); ownerDepth -= 1; } if (ownerDepth) { main.restore(); ownerDepth = 0; } release(); return; }
      if (record.depth !== 0) throw new Error("unbalanced save/restore"); if (surfaceGuard) { context.restore(); surfaceGuard = false; } const initialState = { shadowBlur: Number(main.shadowBlur), lineWidth: Number(main.lineWidth), miterLimit: Number(main.miterLimit) }; const rawCrop = supportBounds(record.commands, transform, glowWidth, glowHeight, initialState); const roi = !rawCrop.full && typeof Path2D === "function" && surface?.getContext && typeof context.clip === "function"; const crop = roi ? rawCrop : { bounds: { x0: 0, y0: 0, x1: glowWidth, y1: glowHeight }, full: true, empty: false }; const x = roi && !crop.empty ? crop.bounds.x0 : 0, y = roi && !crop.empty ? crop.bounds.y0 : 0, w = roi ? Math.max(0, crop.bounds.x1 - crop.bounds.x0) : glowWidth, h = roi ? Math.max(0, crop.bounds.y1 - crop.bounds.y0) : glowHeight;
      activeX = x; activeY = y; activeWidth = w; activeHeight = h; ensureSurface(roi ? w : glowWidth, roi ? h : glowHeight); configureSurface(); if (roi) { context.save(); try { context.setTransform(1, 0, 0, 1, 0, 0); const path = new Path2D(); path.rect(0, 0, w, h); context.clip(path); replay(record.commands, context, "glow", SCALE, transform, x, y); replayClipPixels += w * h; replayClippedFrames += 1; } finally { context.restore(); } } else { replay(record.commands, context, "glow", SCALE, transform); replayFullPixels += glowWidth * glowHeight; } context.restore(); surfaceGuard = false;
      main.save(); try { main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = 1; main.shadowColor = CLEAR_COLOR; main.shadowBlur = 0; main.shadowOffsetX = 0; main.shadowOffsetY = 0; main.filter = "none"; main.globalCompositeOperation = "lighter"; fullBlitPixels += glowWidth * glowHeight; if (crop.full) { fullBoundsFallbacks += 1; main.drawImage(surface, 0, 0, w, h, 0, 0, w / SCALE, h / SCALE); actualBlitPixels += w * h; } else if (!crop.empty && w > 0 && h > 0) { boundedBlits += 1; main.drawImage(surface, 0, 0, w, h, x / SCALE, y / SCALE, w / SCALE, h / SCALE); actualBlitPixels += w * h; } } finally { main.restore(); }
      main.save(); try { main.shadowColor = CLEAR_COLOR; main.shadowBlur = 0; main.shadowOffsetX = 0; main.shadowOffsetY = 0; main.filter = "none"; replay(record.commands, main, "core", 1, transform); } finally { main.restore(); } frames += 1; draws += 1;
    } catch (error) { if (surfaceGuard) { try { context?.restore(); } catch {} surfaceGuard = false; } if (ownerDepth) { while (ownerDepth > 1) { try { main.restore(); } catch {} ownerDepth -= 1; } try { main.restore(); } catch {} ownerDepth = 0; } if (!callbackStarted) { release(); directFallback(main, drawShots); return; } if (record?.mode === "fallback" || resizing) release(); errors += 1; throw error; } finally { drawing = false; }
  };
  return Object.freeze({ draw, clear, snapshot });
}
