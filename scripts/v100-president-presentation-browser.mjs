import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const useCurrentWebKit = process.env.NEW_V100_NATIVE_CURRENT_WEBKIT === "1";
const { chromium, webkit } = await import(useCurrentWebKit ? "./pwa-native-runtime/node_modules/playwright/index.mjs" : "playwright");
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const engineName = process.env.V100_PRESIDENT_PRESENTATION_ENGINE ?? "chromium";
const output = process.env.V100_PRESIDENT_PRESENTATION_OUT;
function presentationVideoRecordingEnabled(value) { return value !== "0"; }
const recordVideo = presentationVideoRecordingEnabled(process.env.V100_PRESIDENT_RECORD_VIDEO);
const baselineOnly = process.env.V100_PRESIDENT_BASELINE_ONLY === "1";
const renderProfile = process.env.V100_PRESIDENT_RENDER_PROFILE === "1";
const compositeAblation = process.env.V100_PRESIDENT_COMPOSITE_ABLATION === "1";
const backgroundBlitAblation = process.env.V100_PRESIDENT_BACKGROUND_BLIT_ABLATION === "1";
const shadowBlurAblation = process.env.V100_PRESIDENT_SHADOW_BLUR_ABLATION === "1";
const rasterGroupAblation = process.env.V100_PRESIDENT_RASTER_GROUP_ABLATION === "1";
const hudVisibilityAblation = process.env.V100_PRESIDENT_HUD_VISIBILITY_ABLATION === "1";
const rafCallbackProfile = process.env.V100_PRESIDENT_RAF_CALLBACK_PROFILE === "1";
const rafProfileViewport = process.env.V100_PRESIDENT_RAF_PROFILE_VIEWPORT ?? null;
const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(output); assert.ok(["chromium", "webkit"].includes(engineName));
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
assert.ok(!backgroundBlitAblation || (baselineOnly && !recordVideo && !renderProfile && !compositeAblation && !rafCallbackProfile), "background blit ablation requires baseline-only, no recording, and no concurrent probes");
assert.ok(!shadowBlurAblation || (baselineOnly && !recordVideo && !renderProfile && !compositeAblation && !rafCallbackProfile && !backgroundBlitAblation), "shadow blur ablation requires baseline-only, no recording, and no concurrent probes");
assert.ok(!rasterGroupAblation || (baselineOnly && !recordVideo && !renderProfile && !compositeAblation && !rafCallbackProfile && !backgroundBlitAblation && !shadowBlurAblation), "raster group ablation requires baseline-only, no recording, and no concurrent probes");
assert.ok(!hudVisibilityAblation || (baselineOnly && !recordVideo && !renderProfile && !compositeAblation && !rafCallbackProfile && !backgroundBlitAblation && !shadowBlurAblation && !rasterGroupAblation), "HUD visibility ablation requires baseline-only, no recording, and no concurrent probes");
const allViewports = [{ width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 844, height: 340 }];
assert.ok(!rafProfileViewport || rafProfileViewport === "1280x720", "RAF callback profile viewport must be 1280x720");
const viewports = backgroundBlitAblation || shadowBlurAblation || rasterGroupAblation || hudVisibilityAblation ? [{ width: 1280, height: 720 }] : (rafProfileViewport ? allViewports.filter(viewport => `${viewport.width}x${viewport.height}` === rafProfileViewport) : allViewports);
assert.ok(!backgroundBlitAblation || (viewports.length === 1 && viewports[0].width === 1280 && viewports[0].height === 720), "background blit ablation requires 1280x720");
const sourcePath = "/art/v100/bosses/mugarian-president-mutated-battle-v2.png";
const sourceFile = new URL(`../public${sourcePath}`, import.meta.url);
const expectedManifestHash = "6f38bd9479fa2ab739fedfc383525398185519bebd64befaec271fb3eb3c9e5a";

function fixture() {
  const base = createDefaultV100Save({ playerName: "S25 president presentation" });
  const owned = [...new Set([...base.ownedUnitIds, "unit-gantetsu", "unit-babayaga", "unit-mizuchi", "unit-raider"] )];
  const unitLevels = Object.fromEntries(Object.keys(base.unitLevels).map(id => [id, 25]));
  return normalizeV100Save({ ...base, campaignStarted: true, revision: 12, availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, 24), ownedUnitIds: owned, registeredUnitIds: owned, unitLevels, levelCap: 30, ownedSupportIds: ["support-healing", "support-explosive-drum", "support-incendiary-drum"], supportPurchaseUnlockedIds: ["support-healing", "support-explosive-drum", "support-incendiary-drum"], equippedSupportId: "support-healing", vehicle: { upgradeLevel: 5, maxHp: 0, upgradeReceipts: ["v100:vehicle:1", "v100:vehicle:2", "v100:vehicle:3", "v100:vehicle:4", "v100:vehicle:5"] }, formationSlots: ["unit-gantetsu", "unit-babayaga", "unit-mizuchi", "unit-raider", null, null, null], flowState: { phase: "formation", stageId: V100_STAGE_IDS[24], stageNumber: 25, destination: "formation", nodeIndex: 0, firstClear: false, finalized: true } });
}

async function sourceAlphaBounds() {
  const bytes = await readFile(sourceFile);
  const metadata = JSON.parse(await readFile(new URL("../public/art/v100/bosses/mugarian-president-mutated-battle-v2-metadata.json", import.meta.url), "utf8"));
  assert.equal(metadata.groundAnchorPixels, 496, "President v2 metadata ground anchor drifted");
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest, expectedManifestHash, "checked-in President v2 PNG hash drifted");
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cache = new Map();
  return { digest, bounds(rect) {
    const key = rect.join(","); if (cache.has(key)) return cache.get(key);
    const [sx, sy, sw, sh] = rect.map(Number); let left = sw, top = sh, right = -1, bottom = -1;
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) {
      const px = Math.floor(sx + x), py = Math.floor(sy + y);
      if (px < 0 || py < 0 || px >= info.width || py >= info.height || data[(py * info.width + px) * 4 + 3] === 0) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    const value = right < 0 ? null : { left, top, right, bottom }; cache.set(key, value); return value;
  } };
}

function installSaveFixture({ save }) {
  for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, save);
}

function installCanvasAudit({ save, sourcePath }) {
  for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, save);
  const audit = { active: false, bypass: false, drawCalls: [], counts: {} }; window.__V100_PRESIDENT_PRESENTATION__ = audit;
  const original = CanvasRenderingContext2D.prototype.drawImage;
  const lineage = new WeakMap();
  const sizeOf = image => ({ width: image?.naturalWidth || image?.width || 0, height: image?.naturalHeight || image?.height || 0 });
  const rectFor = (image, args) => args.length === 4 ? [0, 0, sizeOf(image).width, sizeOf(image).height, ...args] : args.length === 8 ? args : null;
  CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
    if (audit.bypass) return original.call(this, image, ...args);
    const src = image?.currentSrc || image?.src || ""; const sourceRect = rectFor(image, args); const production = document.querySelector(".game-shell canvas");
    const direct = src.includes(sourcePath) && sourceRect ? { path: sourcePath, sourceRect: sourceRect.slice(0, 4) } : null;
    const prior = image instanceof HTMLCanvasElement && image !== production ? lineage.get(image) : null;
    const source = direct || prior;
    if (source && sourceRect && this.canvas !== production) lineage.set(this.canvas, source); else if (!source) lineage.delete(this.canvas);
    if (audit.active && source && sourceRect && this.canvas === production) {
      audit.counts[source.path] = (audit.counts[source.path] ?? 0) + 1;
      const m = this.getTransform(); const call = { sourcePath: source.path, sourceRect: source.sourceRect, destination: sourceRect.slice(4, 8), alpha: this.globalAlpha, transform: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f }, canvas: { width: this.canvas.width, height: this.canvas.height } };
      if (audit.drawCalls.length < 300) audit.drawCalls.push(call);
    }
    return original.call(this, image, ...args);
  };
}

function installBackgroundBlitAblation({ color = "#20252d" } = {}) {
  const production = document.querySelector(".game-shell canvas");
  const state = { installed: true, enabled: true, productionCanvas: Boolean(production), color, windows: [], calls: 0, hits: 0, mismatches: 0, overflow: 0, maxCalls: 180, firstSource: null, firstSourceSize: null, mode: "original", restored: false, restore: null };
  if (!production) { state.enabled = false; state.errors = ["production-canvas-missing"]; window.__V100_PRESIDENT_BACKGROUND_BLIT_ABLATION__ = state; return state; }
  const original = CanvasRenderingContext2D.prototype.drawImage;
  const sourceOf = (image, args) => {
    const width = image?.width ?? 0; const height = image?.height ?? 0;
    if (!(image instanceof HTMLCanvasElement) || image === production || args.length !== 4 || args[0] !== 0 || args[1] !== 0 || args[2] !== width || args[3] !== height || !(width > 0 && height > 0)) return null;
    return { image, width, height };
  };
  CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
    const candidate = sourceOf(image, args);
    if (candidate) {
      if (!state.firstSource) { state.firstSource = candidate.image; state.firstSourceSize = { width: candidate.width, height: candidate.height }; }
      if (candidate.image !== state.firstSource || candidate.width !== state.firstSourceSize.width || candidate.height !== state.firstSourceSize.height) state.mismatches += 1;
      else {
        if (this.canvas === production) { state.hits += 1; if (state.windows.length < state.maxCalls) state.windows.push({ mode: state.mode, width: candidate.width, height: candidate.height, at: performance.now() }); else state.overflow += 1; }
        if (state.mode === "flat" && this.canvas === production) { this.save(); try { this.fillStyle = state.color; this.fillRect(0, 0, candidate.width, candidate.height); } finally { this.restore(); } return; }
      }
    }
    return original.call(this, image, ...args);
  };
  state.setMode = mode => { if (!["original", "flat", "restored"].includes(mode)) throw new RangeError("invalid background ablation mode"); state.mode = mode; return { mode, firstSource: Boolean(state.firstSource) }; };
  state.restore = () => { CanvasRenderingContext2D.prototype.drawImage = original; state.restored = true; return { ...state, restore: undefined, firstSource: Boolean(state.firstSource) }; };
  window.__V100_PRESIDENT_BACKGROUND_BLIT_ABLATION__ = state; return state;
}

function restoreBackgroundBlitAblation() { const state = window.__V100_PRESIDENT_BACKGROUND_BLIT_ABLATION__; return state?.restore ? state.restore() : { restored: false }; }

function installShadowBlurAblation() {
  const production = document.querySelector(".game-shell canvas"); const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "shadowBlur"); const productionContext = production?.getContext?.("2d") ?? null; const initialBlur = productionContext?.shadowBlur;
  const state = { installed: true, enabled: Boolean(production && productionContext && descriptor?.set), productionCanvas: Boolean(production), requestedNonzero: 0, forcedZero: 0, windows: [], mode: "original", restored: false, descriptorPresent: Boolean(descriptor), initialBlur: Number.isFinite(initialBlur) ? initialBlur : null, descriptorRestored: false, blurValueRestored: false };
  if (!state.enabled) { state.errors = ["production-canvas-or-shadowBlur-missing"]; window.__V100_PRESIDENT_SHADOW_BLUR_ABLATION__ = state; return state; }
  const originalSet = descriptor.set; const originalGet = descriptor.get;
  Object.defineProperty(CanvasRenderingContext2D.prototype, "shadowBlur", { ...descriptor, set(value) { if (this.canvas === production) { if (Number(value) > 0) state.requestedNonzero += 1; if (state.mode === "flat") { state.forcedZero += 1; return originalSet.call(this, 0); } } return originalSet.call(this, value); }, get() { return originalGet ? originalGet.call(this) : undefined; } });
  state.setMode = mode => { if (!["original", "flat", "restored"].includes(mode)) throw new RangeError("invalid shadow blur ablation mode"); state.mode = mode; return { mode }; };
  state.restore = () => { if (state.initialBlur !== null) originalSet.call(productionContext, state.initialBlur); Object.defineProperty(CanvasRenderingContext2D.prototype, "shadowBlur", descriptor); const current = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "shadowBlur"); state.descriptorRestored = current?.get === descriptor.get && current?.set === descriptor.set && current?.configurable === descriptor.configurable && current?.enumerable === descriptor.enumerable; state.blurValueRestored = state.initialBlur === null ? false : productionContext.shadowBlur === state.initialBlur; state.restored = state.descriptorRestored && state.blurValueRestored; return { ...state, set: undefined, get: undefined, setMode: undefined, restore: undefined }; };
  window.__V100_PRESIDENT_SHADOW_BLUR_ABLATION__ = state; return state;
}

function restoreShadowBlurAblation() { const state = window.__V100_PRESIDENT_SHADOW_BLUR_ABLATION__; return state?.restore ? state.restore() : { restored: false }; }

function installRasterGroupAblation() {
  const production = document.querySelector(".game-shell canvas"); const methods = { images: ["drawImage"], geometryText: ["fill", "fillRect", "stroke", "strokeRect", "fillText", "strokeText"], all: ["drawImage", "fill", "fillRect", "stroke", "strokeRect", "fillText", "strokeText", "clearRect"] }; const originals = new Map(); const state = { installed: true, enabled: Boolean(production), productionCanvas: Boolean(production), mode: "original", hits: Object.fromEntries(Object.values(methods).flat().map(method => [method, 0])), suppressed: Object.fromEntries(Object.values(methods).flat().map(method => [method, 0])), windows: [], restored: false, restore: null };
  if (!production) { state.enabled = false; state.errors = ["production-canvas-missing"]; window.__V100_PRESIDENT_RASTER_GROUP_ABLATION__ = state; return state; }
  for (const method of new Set(Object.values(methods).flat())) { const original = CanvasRenderingContext2D.prototype[method]; if (typeof original !== "function") continue; originals.set(method, original); CanvasRenderingContext2D.prototype[method] = function(...args) { if (this.canvas === production) { state.hits[method] += 1; const muted = state.mode === "images-muted" && methods.images.includes(method) || state.mode === "geometry-text-muted" && methods.geometryText.includes(method) || state.mode === "all-muted"; if (muted) { state.suppressed[method] += 1; return undefined; } } return Reflect.apply(original, this, args); }; }
  state.setMode = mode => { if (!["original", "images-muted", "geometry-text-muted", "all-muted", "restored"].includes(mode)) throw new RangeError("invalid raster group mode"); state.mode = mode; return { mode }; };
  state.restore = () => { const methodRestored = {}; for (const [method, original] of originals) { CanvasRenderingContext2D.prototype[method] = original; methodRestored[method] = CanvasRenderingContext2D.prototype[method] === original; } state.methodRestored = methodRestored; state.restored = Object.values(methodRestored).every(Boolean); return { ...state, setMode: undefined, restore: undefined }; }; window.__V100_PRESIDENT_RASTER_GROUP_ABLATION__ = state; return state;
}
function restoreRasterGroupAblation() { const state = window.__V100_PRESIDENT_RASTER_GROUP_ABLATION__; return state?.restore ? state.restore() : { restored: false }; }
function installHudVisibilityAblation() { const canvas = document.querySelector(".game-shell canvas"); const style = document.createElement("style"); const rect = canvas?.getBoundingClientRect?.(); const state = { installed: true, enabled: Boolean(canvas), windows: [], mode: "original", restored: false, style, canvas, originalVisibility: canvas ? window.getComputedStyle(canvas).visibility : null, originalRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null, originalBacking: canvas ? { width: canvas.width, height: canvas.height } : null, hudVisibility: null, restore: null }; if (!canvas) { state.enabled = false; state.errors = ["production-canvas-missing"]; return state; } style.textContent = `body,body *,body::before,body::after,body *::before,body *::after{visibility:hidden!important}.game-shell canvas{visibility:visible!important}`; style.disabled = true; (document.head || document.documentElement).appendChild(style); state.setMode = mode => { if (!["original", "hud-hidden", "hud-hidden-all-raster-muted", "restored"].includes(mode)) throw new RangeError("invalid HUD mode"); state.mode = mode; style.disabled = mode === "original" || mode === "restored"; return { mode }; }; state.read = () => { const r = canvas.getBoundingClientRect(); return { canvas: { width: canvas.width, height: canvas.height, visibility: window.getComputedStyle(canvas).visibility, x: r.x, y: r.y, cssWidth: r.width, cssHeight: r.height }, hudVisibility: [...document.querySelectorAll(".v100-boss-center,.top-hud,.battle-message-stack")].slice(0, 3).map(node => window.getComputedStyle(node).visibility) }; }; state.restore = () => { style.remove(); const r = canvas.getBoundingClientRect(); state.restored = !document.contains(style) && window.getComputedStyle(canvas).visibility === state.originalVisibility && state.originalRect && r.x === state.originalRect.x && r.y === state.originalRect.y && r.width === state.originalRect.width && r.height === state.originalRect.height; return { ...state, setMode: undefined, read: undefined, restore: undefined, style: undefined, canvas: undefined }; }; window.__V100_PRESIDENT_HUD_VISIBILITY_ABLATION__ = state; return state; }
function restoreHudVisibilityAblation() { const state = window.__V100_PRESIDENT_HUD_VISIBILITY_ABLATION__; return state?.restore ? state.restore() : { restored: false }; }

function runSaveFixtureControl() {
  const values = new Map(); const storage = { setItem(key, value) { values.set(key, value); } };
  const serialized = Function("localStorage", `return (${installSaveFixture.toString()})`)(storage);
  serialized({ save: "fixture" });
  assert.deepEqual([...values.keys()].sort(), ["nishijin-campaign-v100", "nishijin-campaign-v100:last-known-good", "nishijin-campaign-v100:mirror"].sort());
  assert.deepEqual([...values.values()], ["fixture", "fixture", "fixture"]);
  return { passed: true, checks: ["serialized save fixture init", "three save keys"] };
}

function runPresentationBypassLineageControl() {
  const sourcePath = "/art/v100/bosses/mugarian-president-mutated-battle-v2.png";
  const originalCalls = [];
  class FakeCanvas { constructor(width = 544, height = 512) { this.width = width; this.height = height; } }
  class FakeContext { constructor(canvas) { this.canvas = canvas; this.globalAlpha = 1; } drawImage(...args) { originalCalls.push(args); } getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; } }
  const production = new FakeCanvas(); const intermediate = new FakeCanvas(); const unrelated = { src: "/unrelated.png", width: 544, height: 512 };
  const documentRef = { querySelector: () => production }; const localStorageRef = { setItem() {} }; const windowRef = {};
  const serialized = Function("CanvasRenderingContext2D", "HTMLCanvasElement", "document", "localStorage", "window", `return (${installCanvasAudit.toString()})`)(FakeContext, FakeCanvas, documentRef, localStorageRef, windowRef);
  serialized({ save: "fixture", sourcePath });
  const source = { src: sourcePath, naturalWidth: 544, naturalHeight: 512 };
  const sourceContext = new FakeContext(intermediate); const productionContext = new FakeContext(production); const audit = windowRef.__V100_PRESIDENT_PRESENTATION__;
  audit.bypass = true; sourceContext.drawImage(source, 0, 0, 544, 512, 0, 0, 544, 512);
  audit.bypass = false; audit.active = true; productionContext.drawImage(intermediate, 0, 0, 544, 512, 0, 0, 544, 512);
  assert.equal(audit.counts[sourcePath] ?? 0, 0, "bypass-created cache hit must be untracked until lineage is rebuilt");
  sourceContext.drawImage(source, 0, 0, 544, 512, 0, 0, 544, 512);
  productionContext.drawImage(intermediate, 0, 0, 544, 512, 0, 0, 544, 512);
  assert.equal(audit.counts[sourcePath], 1, "lineage must recover after bypass");
  const unrelatedContext = new FakeContext(intermediate); unrelatedContext.drawImage(unrelated, 0, 0, 544, 512, 0, 0, 544, 512);
  productionContext.drawImage(intermediate, 0, 0, 544, 512, 0, 0, 544, 512);
  assert.equal(audit.counts[sourcePath], 1, "unrelated redraw must clear lineage");
  assert.equal(originalCalls.length, 6, "control must exercise bypass, cache hit, lineage rebuild, production, and unrelated draws");
  return { passed: true, checks: ["serialized bypass direct path", "bypass-created cache-hit loss", "post-bypass source lineage rebuild", "unrelated redraw lineage rejection"] };
}

function fixturePoint(matrix, x, y) { return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f }; }

export function reducePresidentPresentation({ calls, canvasRect, hudRects, alphaBoundsFor, groundAnchorPixels = 496 }) {
  const visibleHudRects = hudRects.filter(rect => rect.width > 0 && rect.height > 0 && Number.isFinite(rect.bottom));
  const hudBottom = visibleHudRects.length ? Math.max(...visibleHudRects.map(rect => rect.bottom)) : NaN;
  const bounds = calls.map(call => {
    const [sx, sy, sw, sh] = call.sourceRect; const b = alphaBoundsFor(call.sourceRect); if (!b) return null;
    const [dx, dy, dw, dh] = call.destination;
    const points = [[dx + b.left / sw * dw, dy + b.top / sh * dh], [dx + b.right / sw * dw, dy + b.top / sh * dh], [dx + b.left / sw * dw, dy + b.bottom / sh * dh], [dx + b.right / sw * dw, dy + b.bottom / sh * dh]].map(([x, y]) => fixturePoint(call.transform, x, y));
    const css = points.map(p => ({ x: canvasRect.left + p.x * canvasRect.width / call.canvas.width, y: canvasRect.top + p.y * canvasRect.height / call.canvas.height }));
    const sourceCellX = 544; const sourceCellY = 512;
    const cellLocalX = (sourceCellX / 2) - (sx % sourceCellX);
    const cellLocalY = groundAnchorPixels - (sy % sourceCellY);
    const foot = fixturePoint(call.transform, dx + cellLocalX / sw * dw, dy + cellLocalY / sh * dh);
    return { alphaBounds: { left: Math.min(...css.map(p => p.x)), top: Math.min(...css.map(p => p.y)), right: Math.max(...css.map(p => p.x)), bottom: Math.max(...css.map(p => p.y)) }, footY: canvasRect.top + foot.y * canvasRect.height / call.canvas.height, opacity: call.alpha, sourceRect: call.sourceRect, destination: call.destination, transform: call.transform };
  }).filter(Boolean);
  const finite = bounds.every(entry => Object.values(entry.alphaBounds).every(Number.isFinite) && Number.isFinite(entry.footY));
  const bodyTop = bounds.length ? Math.min(...bounds.map(entry => entry.alphaBounds.top)) : NaN;
  const bodyBottom = bounds.length ? Math.max(...bounds.map(entry => entry.alphaBounds.bottom)) : NaN;
  return { visibleHudRects, hudBottom, bounds, bodyTop, bodyBottom, finite, pass: bounds.length >= 30 && visibleHudRects.length > 0 && finite && bounds.every(entry => entry.opacity === 1) && bodyTop >= hudBottom + 4 };
}

function runPresentationMathControls() {
  const call = { sourceRect: [0, 0, 544, 512], destination: [0, 0, 544, 512], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, canvas: { width: 544, height: 512 }, alpha: 1 };
  const hud = [{ className: "v100-boss-center", top: 0, bottom: 50, left: 0, right: 500, width: 500, height: 50 }];
  const bounds = () => ({ left: 0, top: 80, right: 100, bottom: 300 });
  const pass = reducePresidentPresentation({ calls: Array.from({ length: 30 }, () => call), canvasRect: { left: 0, top: 0, width: 544, height: 512 }, hudRects: hud, alphaBoundsFor: bounds });
  assert.ok(pass.pass && pass.hudBottom === 50 && pass.bodyTop === 80);
  assert.equal(reducePresidentPresentation({ calls: Array.from({ length: 30 }, () => call), canvasRect: { left: 0, top: 0, width: 544, height: 512 }, hudRects: hud, alphaBoundsFor: () => ({ left: 0, top: 40, right: 100, bottom: 300 }) }).pass, false);
  assert.equal(reducePresidentPresentation({ calls: Array.from({ length: 30 }, () => ({ ...call, alpha: .5 })), canvasRect: { left: 0, top: 0, width: 544, height: 512 }, hudRects: hud, alphaBoundsFor: bounds }).pass, false);
  const secondRow = reducePresidentPresentation({ calls: [{ ...call, sourceRect: [0, 512, 544, 512] }], canvasRect: { left: 0, top: 0, width: 544, height: 512 }, hudRects: hud, alphaBoundsFor: bounds });
  assert.equal(secondRow.bounds[0].footY, 496);
  return { passed: true, checks: ["visible HUD and finite body bbox", "HUD overlap rejection", "opacity rejection", "second-row ground anchor"] };
}

function presentationCaptureReady(elapsedMs, actualDrawCount) { return elapsedMs >= 1000 && actualDrawCount >= 30; }
function presentationPerformanceDelta(start, end) {
  return Object.fromEntries(["renderFrames", "simulationTicks", "rafRequests", "hiddenFrameCallbacks"].map(key => [key, Number(end?.[key] ?? 0) - Number(start?.[key] ?? 0)]));
}
function runPresentationCollectionControls() {
  assert.equal(presentationCaptureReady(1000, 20), false, "time-only capture is insufficient");
  assert.equal(presentationCaptureReady(900, 30), false, "draw-count-only capture is insufficient");
  assert.equal(presentationCaptureReady(1000, 30), true, "one-second and 30-draw capture is sufficient");
  assert.equal(presentationCaptureReady(3000, 29), false, "hard-cap timeout cannot pass missing draws");
  return { passed: true, checks: ["time-only rejection", "draw-count-only rejection", "one-second plus 30-draw acceptance", "hard-cap missing-draw rejection"] };
}
function runPresentationPerformanceControls() {
  assert.deepEqual(presentationPerformanceDelta({ renderFrames: 100, simulationTicks: 400, rafRequests: 110, hiddenFrameCallbacks: 0 }, { renderFrames: 127, simulationTicks: 508, rafRequests: 139, hiddenFrameCallbacks: 2 }), { renderFrames: 27, simulationTicks: 108, rafRequests: 29, hiddenFrameCallbacks: 2 });
  return { passed: true, checks: ["runtime render/simulation/RAF deltas remain separate from draw-hook count"] };
}
function runPresentationContextControls(videoEnabled = true) {
  const enabled = value => value !== "0";
  assert.equal(enabled("0"), false);
  assert.equal(enabled(undefined), true);
  return { passed: true, recordVideo: videoEnabled, checks: ["record-video context option follows V100_PRESIDENT_RECORD_VIDEO"] };
}

function runBackgroundBlitAblationControls() {
  class FakeCanvas { constructor(width = 544, height = 512) { this.width = width; this.height = height; } }
  class FakeContext { constructor(canvas) { this.canvas = canvas; this.calls = []; this.fillStyle = ""; } drawImage(...args) { this.calls.push(["draw", args]); return "draw-return"; } save() { this.calls.push(["save"]); } restore() { this.calls.push(["restore"]); } fillRect(...args) { this.calls.push(["fill", args]); } }
  const production = new FakeCanvas(); const offscreen = new FakeCanvas(); const other = new FakeCanvas(640, 480); const contexts = new Map([[production, new FakeContext(production)], [offscreen, new FakeContext(offscreen)]]); const documentRef = { querySelector: () => production }; const windowRef = {};
  const originalDraw = FakeContext.prototype.drawImage; const install = Function("CanvasRenderingContext2D", "HTMLCanvasElement", "document", "window", `return (${installBackgroundBlitAblation.toString()})`)(FakeContext, FakeCanvas, documentRef, windowRef); const restore = Function("CanvasRenderingContext2D", "window", `return (${restoreBackgroundBlitAblation.toString()})`)(FakeContext, windowRef); const state = install({ color: "#123456" });
  assert.equal(state.productionCanvas, true); const source = offscreen; const productionContext = contexts.get(production); const sourceContext = contexts.get(offscreen); state.setMode("original"); sourceContext.drawImage(source, 0, 0, 544, 512); productionContext.drawImage(source, 0, 0, 544, 512); assert.equal(state.hits, 1); state.setMode("flat"); productionContext.drawImage(source, 0, 0, 544, 512); assert.deepEqual(productionContext.calls.at(-3)?.[0], "save"); assert.equal(productionContext.calls.at(-2)?.[0], "fill"); assert.deepEqual(productionContext.calls.at(-1)?.[0], "restore"); productionContext.drawImage(other, 0, 0, 640, 480); assert.equal(state.mismatches, 1); state.setMode("restored"); productionContext.drawImage(source, 0, 0, 544, 512); assert.equal(productionContext.calls.at(-1)?.[0], "draw"); const restored = restore(); assert.equal(restored.restored, true); assert.equal(FakeContext.prototype.drawImage, originalDraw); const missingInstall = Function("CanvasRenderingContext2D", "HTMLCanvasElement", "document", "window", `return (${installBackgroundBlitAblation.toString()})`)(FakeContext, FakeCanvas, { querySelector: () => null }, {}); assert.equal(missingInstall().enabled, false);
  return { passed: true, checks: ["serialized original/flat/restored dispatch", "fixed offscreen source and dimension mismatch", "state-safe fillRect replacement", "missing production target diagnostic", "restore and bounded metadata"] };
}

function runShadowBlurAblationControls() {
  const descriptor = { configurable: true, enumerable: true, get() { return this._blur ?? 0; }, set(value) { this._blur = value; } };
  class FakeCanvas { getContext() { return this.context; } } class FakeContext { constructor(canvas) { this.canvas = canvas; } }
  Object.defineProperty(FakeContext.prototype, "shadowBlur", descriptor); const production = new FakeCanvas(); const offscreen = new FakeCanvas(); const documentRef = { querySelector: () => production }; const windowRef = {}; const originalDescriptor = Object.getOwnPropertyDescriptor(FakeContext.prototype, "shadowBlur"); const productionContext = new FakeContext(production); const offscreenContext = new FakeContext(offscreen); production.context = productionContext; offscreen.context = offscreenContext; productionContext.shadowBlur = 3;
  const install = Function("CanvasRenderingContext2D", "document", "window", `return (${installShadowBlurAblation.toString()})`)(FakeContext, documentRef, windowRef); const restore = Function("CanvasRenderingContext2D", "window", `return (${restoreShadowBlurAblation.toString()})`)(FakeContext, windowRef); const state = install(); assert.equal(state.enabled, true); const prod = productionContext; const other = offscreenContext; state.setMode("original"); prod.shadowBlur = 6; other.shadowBlur = 9; state.setMode("flat"); prod.shadowBlur = 8; assert.equal(prod.shadowBlur, 0); assert.equal(other.shadowBlur, 9); assert.equal(state.requestedNonzero, 2); assert.equal(state.forcedZero, 1); state.setMode("restored"); prod.shadowBlur = 4; const restored = restore(); assert.equal(restored.restored, true); assert.equal(restored.descriptorRestored, true); assert.equal(restored.blurValueRestored, true); assert.deepEqual(Object.getOwnPropertyDescriptor(FakeContext.prototype, "shadowBlur"), originalDescriptor);
  const missing = Function("CanvasRenderingContext2D", "document", "window", `return (${installShadowBlurAblation.toString()})`)(FakeContext, { querySelector: () => null }, {}); assert.equal(missing().enabled, false); let invalid = false; try { state.setMode("bad"); } catch { invalid = true; } assert.equal(invalid, true);
  return { passed: true, checks: ["production-only setter forcing", "offscreen isolation", "requested/hit counters", "descriptor restore", "missing target and invalid mode diagnostics"] };
}

function runRasterGroupAblationControls() {
  const methods = ["drawImage", "fill", "fillRect", "stroke", "strokeRect", "fillText", "strokeText", "clearRect"]; class FakeCanvas {} class FakeContext { constructor(canvas) { this.canvas = canvas; } }
  for (const method of methods) FakeContext.prototype[method] = function() { return `${method}-ok`; }; const production = new FakeCanvas(); const offscreen = new FakeCanvas(); const documentRef = { querySelector: () => production }; const windowRef = {}; const original = Object.fromEntries(methods.map(method => [method, FakeContext.prototype[method]])); const state = Function("CanvasRenderingContext2D", "document", "window", `return (${installRasterGroupAblation.toString()})()`)(FakeContext, documentRef, windowRef); assert.equal(state.enabled, true); const prod = new FakeContext(production); const other = new FakeContext(offscreen); for (const method of methods) { prod[method](); other[method](); } state.setMode("images-muted"); assert.equal(prod.drawImage(), undefined); assert.equal(other.drawImage(), "drawImage-ok"); state.setMode("geometry-text-muted"); assert.equal(prod.fillRect(), undefined); assert.equal(other.fillRect(), "fillRect-ok"); state.setMode("all-muted"); assert.equal(prod.clearRect(), undefined); const restored = Function("CanvasRenderingContext2D", "window", `return (${restoreRasterGroupAblation.toString()})()`)(FakeContext, windowRef); assert.equal(restored.restored, true); assert.deepEqual(restored.methodRestored, Object.fromEntries(methods.map(method => [method, true]))); for (const method of methods) assert.equal(FakeContext.prototype[method], original[method]); const missing = Function("CanvasRenderingContext2D", "document", "window", `return (${installRasterGroupAblation.toString()})`)(FakeContext, { querySelector: () => null }, {}); assert.equal(missing().enabled, false); assert.throws(() => state.setMode("bad")); return { passed: true, checks: ["production-only method suppression", "offscreen isolation", "five mode dispatch", "full method identity restore", "missing target/invalid mode diagnostics"] };
}
function runHudVisibilityAblationControls() { const nodes = [{ style: {}, computed: { visibility: "visible" } }]; const canvas = { width: 10, height: 10, style: {}, getContext() { return {}; }, getBoundingClientRect() { return { x: 0, y: 0, width: 10, height: 10 }; } }; const documentRef = { querySelector: () => canvas, createElement: () => ({ remove() { this.removed = true; } }), head: { appendChild() {} }, documentElement: {}, contains: node => !node.removed, querySelectorAll: () => nodes }; const windowRef = { getComputedStyle: () => ({ visibility: "visible" }) }; const install = Function("document", "window", `return (${installHudVisibilityAblation.toString()})()`)(documentRef, windowRef); assert.equal(install.enabled, true); install.setMode("hud-hidden"); assert.equal(install.read().canvas.width, 10); install.setMode("hud-hidden-all-raster-muted"); assert.throws(() => install.setMode("invalid")); const restored = Function("window", `return (${restoreHudVisibilityAblation.toString()})()`)(windowRef); assert.equal(restored.restored, true); return { passed: true, checks: ["serialized HUD modes", "canvas geometry readback", "invalid mode rejection", "style removal restore"] }; }

function installRafCallbackProfile({ maxEntries = 180 } = {}) {
  const original = window.requestAnimationFrame; const state = { installed: true, entries: [], overflow: 0, invalidTimestamps: 0, maxEntries, restored: false, restore: null };
  let previousTimestamp = null;
  window.requestAnimationFrame = function (callback) { return original.call(this, timestamp => { const started = window.performance.now(); try { return callback.call(this, timestamp); } finally { const cost = Math.max(0, window.performance.now() - started); if (!Number.isFinite(timestamp) || (previousTimestamp !== null && timestamp < previousTimestamp)) state.invalidTimestamps += 1; previousTimestamp = timestamp; if (state.entries.length < state.maxEntries) state.entries.push(cost); else state.overflow += 1; } }); };
  state.restore = () => { window.requestAnimationFrame = original; state.restored = true; };
  window.__V100_PRESIDENT_RAF_CALLBACK_PROFILE__ = state; return state;
}

function restoreRafCallbackProfile() { const state = window.__V100_PRESIDENT_RAF_CALLBACK_PROFILE__; if (state?.restore) state.restore(); return state ? { ...state, restore: undefined } : null; }

function runRafCallbackProfileControls() {
  const callbacks = []; const original = function (callback) { callbacks.push(callback); return callbacks.length; }; const windowRef = { requestAnimationFrame: original, performance: { now: (() => { let value = 0; return () => ++value; })() } };
  const install = Function("window", `return (${installRafCallbackProfile.toString()})`)(windowRef); const restore = Function("window", `return (${restoreRafCallbackProfile.toString()})`)(windowRef); const originalRaf = windowRef.requestAnimationFrame; const state = install({ maxEntries: 2 }); let callbackCalls = 0; windowRef.requestAnimationFrame.call({ marker: true }, timestamp => { callbackCalls += timestamp; if (timestamp === 9) throw new Error("expected callback failure"); }); const wrapped = callbacks.at(-1); wrapped(10); try { wrapped(9); } catch (error) { assert.equal(error.message, "expected callback failure"); } wrapped(11); assert.equal(callbackCalls, 30); assert.equal(state.entries.length, 2); assert.equal(state.overflow, 1); assert.equal(state.invalidTimestamps, 1); assert.equal(restore().restored, true); assert.equal(windowRef.requestAnimationFrame, originalRaf);
  const disabled = originalRaf; assert.equal(disabled, original); return { passed: true, checks: ["serialized callback forwarding/return", "throw/finally cost capture and monotonic validation", "bounded overflow", "restore and disabled branch"] };
}

function installCanvasRenderProfileProbe({ maxCalls = 100000 } = {}) {
  const production = document.querySelector(".game-shell canvas");
  const methods = ["drawImage", "fillRect", "clearRect", "stroke", "fill"];
  const state = { installed: true, productionCanvas: Boolean(production), errors: production ? [] : ["production-canvas-missing"], calls: 0, overflow: 0, counts: {}, durationsMs: {}, maxCalls, rafIntervalsMs: [], rafOverflow: 0, lastRafTimestamp: null, rafId: null, restore: null };
  const originals = new Map();
  for (const method of methods) {
    const original = CanvasRenderingContext2D.prototype[method];
    if (typeof original !== "function") continue;
    originals.set(method, original);
    state.counts[method] = { production: 0, offscreen: 0 };
    state.durationsMs[method] = { production: 0, offscreen: 0 };
    CanvasRenderingContext2D.prototype[method] = function (...args) {
      const surface = this.canvas === production ? "production" : "offscreen";
      const started = window.performance.now();
      try { return Reflect.apply(original, this, args); }
      finally {
        if (state.calls < state.maxCalls) {
          state.calls += 1;
          state.counts[method][surface] += 1;
          state.durationsMs[method][surface] += Math.max(0, window.performance.now() - started);
        } else state.overflow += 1;
      }
    };
  }
  const onFrame = timestamp => { if (state.lastRafTimestamp !== null) { if (state.rafIntervalsMs.length < 180) state.rafIntervalsMs.push(timestamp - state.lastRafTimestamp); else state.rafOverflow += 1; } state.lastRafTimestamp = timestamp; state.rafId = window.requestAnimationFrame(onFrame); };
  state.rafId = window.requestAnimationFrame(onFrame);
  state.restore = () => { if (state.rafId !== null) window.cancelAnimationFrame(state.rafId); for (const [method, original] of originals) CanvasRenderingContext2D.prototype[method] = original; state.restored = true; };
  window.__V100_PRESIDENT_RENDER_PROFILE__ = state;
}

function restoreCanvasRenderProfileProbe() {
  const state = window.__V100_PRESIDENT_RENDER_PROFILE__;
  if (state?.restore) state.restore();
  return state ? { ...state, restore: undefined } : null;
}

function maybeInstallCanvasRenderProfileProbe(enabled, installer) { return enabled ? installer() : undefined; }

function applyCompositeAblation(mode) {
  const root = document.documentElement; const token = { mode, rootAttr: root.getAttribute("data-v100-composite-ablation"), styleElement: null };
  window.__V100_COMPOSITE_ABLATION__ = token; root.setAttribute("data-v100-composite-ablation", mode);
  const style = document.createElement("style"); style.textContent = `html[data-v100-composite-ablation="vignette"] .game-frame::after{display:none!important}html[data-v100-composite-ablation="filter"] .game-frame,html[data-v100-composite-ablation="filter"] .game-frame *{filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}html[data-v100-composite-ablation="canvas-opacity"] .game-shell canvas{opacity:0!important}`; token.styleElement = style; (document.head || root).appendChild(style);
  return { mode, applied: true, cssText: style.textContent };
}

function restoreCompositeAblation() {
  const token = window.__V100_COMPOSITE_ABLATION__; if (!token) return { restored: false };
  if (token.styleElement?.remove) token.styleElement.remove(); else token.styleElement?.parentNode?.removeChild?.(token.styleElement);
  const root = document.documentElement; if (token.rootAttr === null) root.removeAttribute("data-v100-composite-ablation"); else root.setAttribute("data-v100-composite-ablation", token.rootAttr);
  delete window.__V100_COMPOSITE_ABLATION__; return { restored: true, mode: token.mode };
}

function runCompositeAblationControls() {
  const element = () => { const attrs = {}; return { style: {}, querySelectorAll: () => [], getAttribute: name => attrs[name] ?? null, setAttribute: (name, value) => { attrs[name] = value; }, removeAttribute: name => { delete attrs[name]; } }; }; const root = element(); const frame = element(); const canvas = element(); const styleNodes = []; const documentRef = { documentElement: root, head: { appendChild: node => { styleNodes.push(node); node.parentNode = documentRef.head; }, removeChild: node => { const index = styleNodes.indexOf(node); if (index >= 0) styleNodes.splice(index, 1); } }, createElement: () => ({ textContent: "", remove() { const index = styleNodes.indexOf(this); if (index >= 0) styleNodes.splice(index, 1); } }), querySelector: selector => selector === ".game-frame" ? frame : selector === ".game-shell canvas" ? canvas : null, querySelectorAll: () => [] }; const windowRef = {};
  const apply = Function("document", "window", `return (${applyCompositeAblation.toString()})`)(documentRef, windowRef); const restore = Function("document", "window", `return (${restoreCompositeAblation.toString()})`)(documentRef, windowRef);
  const originalAttr = root.getAttribute("data-v100-composite-ablation"); for (const mode of ["vignette", "filter", "canvas-opacity"]) { const result = apply(mode); assert.equal(result.applied, true); assert.match(result.cssText, new RegExp(mode === "canvas-opacity" ? "canvas" : mode === "vignette" ? "::after" : "backdrop-filter")); assert.equal(styleNodes.length, 1); assert.equal(restore().restored, true); assert.equal(styleNodes.length, 0); assert.equal(root.getAttribute("data-v100-composite-ablation"), originalAttr); }
  root.setAttribute("data-v100-composite-ablation", "preexisting"); let threw = false; try { apply("filter"); } catch { threw = true; } finally { restore(); } assert.equal(threw, false); assert.equal(root.getAttribute("data-v100-composite-ablation"), "preexisting");
  assert.equal(windowRef.__V100_COMPOSITE_ABLATION__, undefined); assert.equal(styleNodes.length, 0);
  const disabled = { ...documentRef, createElement: () => { throw new Error("disabled must not install"); } }; assert.equal(styleNodes.length, 0); assert.equal(disabled.documentElement.getAttribute("data-v100-composite-ablation"), "preexisting");
  const throwingDocument = { ...documentRef, createElement: () => { throw new Error("expected style failure"); } }; const throwingApply = Function("document", "window", `return (${applyCompositeAblation.toString()})`)(throwingDocument, windowRef); let styleThrew = false; try { throwingApply("vignette"); } catch { styleThrew = true; } finally { restore(); } assert.equal(styleThrew, true); assert.equal(root.getAttribute("data-v100-composite-ablation"), "preexisting");
  root.removeAttribute("data-v100-composite-ablation"); return { passed: true, checks: ["serialized vignette/filter/canvas CSS rules", "single style element lifecycle", "exact preexisting root attribute restoration", "disabled path leaves style untouched", "exception finally restores root/style"] };
}

function runRenderProfileControls() {
  class FakeCanvas { constructor(name) { this.name = name; } }
  const production = new FakeCanvas("production"); const offscreen = new FakeCanvas("offscreen"); const calls = [];
  class FakeContext { constructor(canvas) { this.canvas = canvas; } drawImage(...args) { calls.push([this.canvas, args]); return "draw-return"; } fillRect() {} clearRect() {} stroke() { throw new Error("expected probe exception"); } fill() {} }
  const rafQueue = []; const documentRef = { querySelector: () => production }; const now = { value: 0 }; const windowRef = { performance: { now: () => ++now.value }, requestAnimationFrame: callback => { rafQueue.push(callback); return rafQueue.length; }, cancelAnimationFrame: id => { rafQueue[id - 1] = null; } };
  const serializedInstall = Function("CanvasRenderingContext2D", "HTMLCanvasElement", "document", "window", `return (${installCanvasRenderProfileProbe.toString()})`)(FakeContext, FakeCanvas, documentRef, windowRef);
  const serializedRestore = Function("CanvasRenderingContext2D", "window", `return (${restoreCanvasRenderProfileProbe.toString()})`)(FakeContext, windowRef);
  const serializedMaybe = Function("installer", `return (${maybeInstallCanvasRenderProfileProbe.toString()})`)(serializedInstall); const originalDraw = FakeContext.prototype.drawImage; serializedMaybe(false, () => { throw new Error("wrong-mode installed"); }); assert.equal(FakeContext.prototype.drawImage, originalDraw);
  const missingInstall = Function("CanvasRenderingContext2D", "HTMLCanvasElement", "document", "window", `return (${installCanvasRenderProfileProbe.toString()})`)(FakeContext, FakeCanvas, { querySelector: () => null }, windowRef); missingInstall({ maxCalls: 1 }); const missing = windowRef.__V100_PRESIDENT_RENDER_PROFILE__; assert.equal(missing.productionCanvas, false); assert.deepEqual(missing.errors, ["production-canvas-missing"]); missing.restore();
  serializedMaybe(true, () => serializedInstall({ maxCalls: 2 })); const installed = windowRef.__V100_PRESIDENT_RENDER_PROFILE__; const productionContext = new FakeContext(production); const offscreenContext = new FakeContext(offscreen);
  assert.equal(productionContext.drawImage(1, 2), "draw-return"); offscreenContext.fillRect(1, 2, 3, 4); try { productionContext.stroke(); } catch (error) { assert.equal(error.message, "expected probe exception"); } assert.equal(installed.counts.drawImage.production, 1); assert.equal(installed.counts.fillRect.offscreen, 1); assert.equal(installed.counts.stroke.production, 0); assert.equal(installed.overflow, 1); assert.ok(installed.durationsMs.drawImage.production >= 0); assert.ok(installed.calls <= installed.maxCalls); assert.equal("records" in installed, false); assert.equal(calls[0][0], production); assert.deepEqual(calls[0][1], [1, 2]); assert.equal(installed.errors.length, 0);
  let callbackIndex = 0; for (let index = 0; index < 183; index += 1) { while (callbackIndex < rafQueue.length && !rafQueue[callbackIndex]) callbackIndex += 1; const callback = rafQueue[callbackIndex++]; assert.equal(typeof callback, "function"); callback(10 + index * 16); } assert.equal(installed.rafIntervalsMs.length, 180); assert.ok(installed.rafOverflow > 0);
  let restored; try { productionContext.stroke(); } catch (error) { assert.equal(error.message, "expected probe exception"); } finally { restored = serializedRestore(); } assert.equal(restored.restored, true); assert.equal(restored.rafId !== null, true); assert.equal(FakeContext.prototype.drawImage, originalDraw); assert.equal(windowRef.__V100_PRESIDENT_RENDER_PROFILE__.rafOverflow > 0, true); assert.equal(typeof originalDraw, "function");
  return { passed: true, checks: ["serialized enabled/disabled production branch", "missing production canvas error", "production/offscreen aggregation", "exception-safe finally restoration", "max-call overflow", "183-callback bounded rAF overflow/cancel", "serialized return/this/args delegation"] };
}

if (process.env.V100_PRESIDENT_CONTROL_ONLY === "1") {
  console.log(JSON.stringify({ renderProfile: runRenderProfileControls(), compositeAblation: runCompositeAblationControls(), rafCallbackProfile: runRafCallbackProfileControls(), backgroundBlitAblation: runBackgroundBlitAblationControls(), shadowBlurAblation: runShadowBlurAblationControls(), rasterGroupAblation: runRasterGroupAblationControls(), hudVisibilityAblation: runHudVisibilityAblationControls() }));
  process.exit(0);
}

const alpha = await sourceAlphaBounds();
const saveObject = fixture(); const save = serializeV100Save(saveObject);
const report = { engine: engineName, runtimeChoice: useCurrentWebKit ? "current-webkit-runtime" : "default-playwright-runtime", videoRecording: recordVideo, mode: baselineOnly ? (hudVisibilityAblation ? "baseline-only-hud-visibility-ablation" : (rasterGroupAblation ? "baseline-only-raster-group-ablation" : (shadowBlurAblation ? "baseline-only-shadow-blur-ablation" : (backgroundBlitAblation ? "baseline-only-background-blit-ablation" : (renderProfile ? "baseline-only-render-profile" : "baseline-only"))))) : "presentation", renderProfileRequested: renderProfile, renderProfileApplied: baselineOnly && renderProfile, compositeAblationRequested: compositeAblation, backgroundBlitAblationRequested: backgroundBlitAblation, backgroundBlitAblationApplied: false, shadowBlurAblationRequested: shadowBlurAblation, shadowBlurAblationApplied: false, rasterGroupAblationRequested: rasterGroupAblation, rasterGroupAblationApplied: false, rafCallbackProfileRequested: rafCallbackProfile, rafProfileViewport, build: await productionBuildIdentity(), stage: 25, viewportOrder: viewports, sourcePath, sourceSha256: alpha.digest, sourceGroundAnchorPixels: 496, sourceCellHeight: 512, controls: { saveFixture: runSaveFixtureControl(), math: runPresentationMathControls(), collection: runPresentationCollectionControls(), performance: runPresentationPerformanceControls(), context: runPresentationContextControls(recordVideo), bypassLineage: runPresentationBypassLineageControl(), renderProfile: runRenderProfileControls(), compositeAblation: runCompositeAblationControls(), rafCallbackProfile: runRafCallbackProfileControls(), backgroundBlitAblation: runBackgroundBlitAblationControls(), shadowBlurAblation: runShadowBlurAblationControls(), rasterGroupAblation: runRasterGroupAblationControls() }, scope: "S25 isolated normalized level-25 roster, vehicle upgrade 5, natural President entry. Native normal tactical input only; no actor/time/HP/result setters. Visual presentation proof, not campaign/balance acceptance or FPS/performance acceptance.", inputs: [], errors: [], cases: [], status: "running" };
await mkdir(output, { recursive: false });
const browser = await ({ chromium, webkit }[engineName]).launch({ headless: true });
const context = await browser.newContext({ viewport: viewports[0], isMobile: true, hasTouch: true, ...(recordVideo ? { recordVideo: { dir: path.join(output, "videos"), size: viewports[0] } } : {}) });
const page = await context.newPage(); page.setDefaultTimeout(15000);
for (const [name, handler] of [["pageerror", e => report.errors.push(String(e))], ["console", m => { if (m.type() === "error") report.errors.push(m.text()); }], ["requestfailed", r => report.errors.push(`${r.url()}: ${r.failure()?.errorText ?? "failed"}`)]]) page.on(name, handler);
try {
  report.fixture = { levelCap: saveObject.levelCap, unitLevels: saveObject.unitLevels, vehicle: saveObject.vehicle, formationSlots: saveObject.formationSlots };
  await page.addInitScript(installSaveFixture, { save });
  if (!baselineOnly) await page.addInitScript(installCanvasAudit, { save, sourcePath });
  await page.goto(new URL("v100", origin).href);
  const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); const start = page.getByRole("button", { name: "戦闘へ", exact: true }); await play.or(start).first().waitFor(); if (await play.isVisible().catch(() => false)) await play.click(); await start.click();
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
  const timelineEnd = Math.max(...createBattleDefinition(V100_STAGE_IDS[24], { v100: true }).timeline.map(event => Number(event.at) || 0), 0); const deadline = Date.now() + (timelineEnd + 180) * 1000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot()); const president = s.fighters.find(f => f.kind === "mugarian-president-mutated" && f.hp > 0 && f.combatReady && !f.gateEntering && f.renderAudit?.assetReady);
    if (president) { report.ready = { time: s.time, hp: president.hp, maxHp: president.maxHp, y: president.y, renderAudit: president.renderAudit }; break; }
    if (!s.running || s.over) break; await normalTacticalInput(page, report); await page.waitForTimeout(350);
  }
  assert.ok(report.ready, "President did not naturally reach live ready state within finite budget");
  const viewportFailures = [];
  for (const viewport of viewports) {
    try {
    await page.setViewportSize(viewport);
    const expectedId = viewport.width === 1280 ? "standard" : `${viewport.width}x${viewport.height}`;
    await page.waitForFunction(expected => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().geometry?.viewportId === expected, expectedId);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (baselineOnly) {
      const readBaselineDiagnostic = () => page.evaluate(() => {
        const bridge = window.__ASHFALL_BATTLE_QA__; const snapshot = bridge?.getSnapshot?.() ?? {};
        const p = bridge?.getPerformanceSnapshot?.() ?? {};
        const canvas = document.querySelector(".game-shell canvas");
        const rect = canvas?.getBoundingClientRect();
        const pools = p.renderObjectPools ?? {};
        return {
          measuredAt: performance.now(),
          renderFrames: p.renderFrames ?? 0, simulationTicks: p.simulationTicks ?? 0, rafRequests: p.rafRequests ?? 0, hiddenFrameCallbacks: p.hiddenFrameCallbacks ?? 0,
          canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
          cssRect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
          devicePixelRatio: window.devicePixelRatio,
          graphicsProfile: p.graphicsProfile ?? null,
          staticBackgroundCache: p.staticBackgroundCache ?? null,
          imageSamplingCache: p.imageSamplingCache ?? null,
          renderObjectPools: { particles: pools.particles?.active ?? 0, shots: pools.shots?.active ?? 0, damageTexts: pools.damageTexts?.active ?? 0 },
          snapshotCounts: { fighters: snapshot.fighters?.length ?? 0, livingFighters: snapshot.fighters?.filter(fighter => fighter.hp > 0).length ?? 0, areaEffects: snapshot.areaEffects?.length ?? 0, manualAbilityVfx: snapshot.manualAbilityVfx?.length ?? 0, battlePresentationEffects: snapshot.battlePresentation?.effects?.length ?? 0, corpses: snapshot.corpses?.length ?? 0 },
        };
      });
      const start = await readBaselineDiagnostic();
      await page.waitForTimeout(1000);
      const end = await readBaselineDiagnostic();
      const baselineCase = { viewport, expectedId, mode: "baseline-only", requestedDurationMs: 1000, durationMs: end.measuredAt - start.measuredAt, runtimePerformanceStart: start, runtimePerformanceEnd: end, runtimePerformanceDelta: presentationPerformanceDelta(start, end), visualAcceptance: false };
      if (hudVisibilityAblation) { let probe = null; const windows = []; try { probe = await page.evaluate(installHudVisibilityAblation); assert.ok(probe?.enabled, "HUD ablation target missing"); const read = () => page.evaluate(() => { const a = window.__V100_PRESIDENT_HUD_VISIBILITY_ABLATION__; const p = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? {}; return { measuredAt: performance.now(), renderFrames: p.renderFrames ?? 0, rafRequests: p.rafRequests ?? 0, read: a?.read?.() ?? null }; }); for (const mode of ["original", "hud-hidden", "hud-hidden-all-raster-muted", "restored"]) { await page.evaluate(next => window.__V100_PRESIDENT_HUD_VISIBILITY_ABLATION__?.setMode(next), mode); if (mode === "hud-hidden-all-raster-muted") await page.evaluate(installRasterGroupAblation); const before = await read(); await page.waitForTimeout(2000); const after = await read(); if (mode === "hud-hidden-all-raster-muted") await page.evaluate(restoreRasterGroupAblation); windows.push({ mode, requestedDurationMs: 2000, actualDurationMs: after.measuredAt - before.measuredAt, frameDelta: after.renderFrames - before.renderFrames, rafDelta: after.rafRequests - before.rafRequests, canvasBefore: before.read?.canvas ?? null, canvasAfter: after.read?.canvas ?? null, hudVisibility: after.read?.hudVisibility ?? [], visualAcceptance: false }); await page.screenshot({ path: path.join(output, `president-hud-visibility-${mode}.png`) }); } assert.ok(windows.every(item => item.actualDurationMs >= 1900 && item.actualDurationMs <= 2600)); assert.ok(windows.every(item => item.frameDelta > 0)); baselineCase.hudVisibilityAblationDiagnostic = { windows, visualAcceptance: false }; } finally { const restored = await page.evaluate(restoreHudVisibilityAblation).catch(() => ({ restored: false })); baselineCase.hudVisibilityAblationDiagnostic ??= {}; baselineCase.hudVisibilityAblationDiagnostic.restored = restored.restored === true; assert.equal(restored.restored, true); } report.cases.push(baselineCase); continue; }
      if (!backgroundBlitAblation && !shadowBlurAblation && !rasterGroupAblation && !hudVisibilityAblation && !renderProfile && !compositeAblation && !rafCallbackProfile) {
        const layout = await page.evaluate(() => {
          const selectors = [".enable-audio-button", ".audio-unlock-inline", ".v100-boss-center", ".phase-block", ".battle-controls-zone", ".battle-controls-zone .icon-btn:not(.audio-unlock-inline)"];
          const items = selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(node => {
            const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
            return { selector, label: (node.textContent ?? node.getAttribute("aria-label") ?? "").trim().slice(0, 120), state: node.getAttribute("data-state"), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }, visible: rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 };
          }));
          const visible = items.filter(item => item.visible); const overlaps = (left, right) => left.rect.x < right.rect.right && left.rect.right > right.rect.x && left.rect.y < right.rect.bottom && left.rect.bottom > right.rect.y;
          const unlocks = visible.filter(item => [".enable-audio-button", ".audio-unlock-inline"].includes(item.selector)); const inline = visible.find(item => item.selector === ".audio-unlock-inline"); const retry = inline?.state === "failed" ? inline : null; const controlsNode = document.querySelector(".battle-controls-zone"); const controlsRect = controlsNode?.getBoundingClientRect?.(); const targets = visible.filter(item => [".v100-boss-center", ".phase-block"].includes(item.selector) || item.selector === ".battle-controls-zone .icon-btn:not(.audio-unlock-inline)");
          return { viewport: { width: window.innerWidth, height: window.innerHeight }, items, visibleUnlockCount: unlocks.length, floatingBannerVisible: visible.some(item => item.selector === ".enable-audio-button"), retryFailed: Boolean(retry), retryWithinViewport: !retry || (retry.rect.x >= 0 && retry.rect.y >= 0 && retry.rect.right <= window.innerWidth && retry.rect.bottom <= window.innerHeight), retryTargetOverlaps: retry ? targets.filter(target => overlaps(retry, target)).map(target => target.selector) : [], retryInsideControls: !retry || Boolean(controlsRect && retry.rect.x >= controlsRect.x && retry.rect.y >= controlsRect.y && retry.rect.right <= controlsRect.right && retry.rect.bottom <= controlsRect.bottom) };
        });
        baselineCase.layout = layout; baselineCase.layoutPng = path.join(output, `president-layout-${viewport.width}x${viewport.height}.png`); await page.screenshot({ path: baselineCase.layoutPng }); report.layout ??= []; report.layout.push(layout); report.cases.push(baselineCase);
        assert.ok(layout.visibleUnlockCount <= 1); assert.equal(layout.floatingBannerVisible, false); if (layout.retryFailed) { assert.equal(layout.visibleUnlockCount, 1); assert.equal(layout.retryWithinViewport, true); assert.equal(layout.retryInsideControls, true); assert.deepEqual(layout.retryTargetOverlaps, []); }
        continue;
      }
      if (rasterGroupAblation) {
        let probe = null; const windows = []; const readProbe = () => page.evaluate(() => { const a = window.__V100_PRESIDENT_RASTER_GROUP_ABLATION__; const p = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? {}; return { measuredAt: performance.now(), renderFrames: p.renderFrames ?? 0, rafRequests: p.rafRequests ?? 0, hits: { ...a?.hits }, suppressed: { ...a?.suppressed }, mode: a?.mode ?? null }; });
        try { probe = await page.evaluate(installRasterGroupAblation); assert.ok(probe?.productionCanvas && probe.enabled, "raster group ablation target missing"); for (const mode of ["original", "images-muted", "geometry-text-muted", "all-muted", "restored"]) { await page.evaluate(nextMode => window.__V100_PRESIDENT_RASTER_GROUP_ABLATION__?.setMode(nextMode), mode); const before = await readProbe(); await page.waitForTimeout(2000); const after = await readProbe(); const delta = (values, key, baseline) => (values[key] ?? 0) - (baseline[key] ?? 0); const record = { mode, requestedDurationMs: 2000, actualDurationMs: after.measuredAt - before.measuredAt, frameDelta: after.renderFrames - before.renderFrames, rafDelta: after.rafRequests - before.rafRequests, hitDelta: Object.fromEntries(Object.keys(after.hits).map(key => [key, delta(after.hits, key, before.hits)])), suppressedDelta: Object.fromEntries(Object.keys(after.suppressed).map(key => [key, delta(after.suppressed, key, before.suppressed)])), visualAcceptance: false }; windows.push(record); await page.screenshot({ path: path.join(output, `president-raster-group-${mode}.png`) }); } assert.ok(windows.every(record => record.actualDurationMs >= 1900 && record.actualDurationMs <= 2600)); assert.ok(windows.every(record => Object.values(record.hitDelta).some(value => value > 0)), "raster ablation window had zero production draws"); assert.ok(windows.some(record => Object.values(record.suppressedDelta).some(value => value > 0)), "raster ablation suppressed no production draws"); report.rasterGroupAblationApplied = true; baselineCase.rasterGroupAblationDiagnostic = { mode: "baseline-only-raster-group-ablation", windows, visualAcceptance: false }; } finally { const restored = await page.evaluate(restoreRasterGroupAblation).catch(() => ({ restored: false })); baselineCase.rasterGroupAblationDiagnostic ??= {}; baselineCase.rasterGroupAblationDiagnostic.restored = restored.restored === true; baselineCase.rasterGroupAblationDiagnostic.methodRestored = restored.methodRestored ?? null; assert.equal(restored.restored, true); assert.ok(restored.methodRestored && Object.values(restored.methodRestored).every(Boolean)); } report.cases.push(baselineCase); continue;
      }
      if (shadowBlurAblation) {
        let probe = null; const windows = [];
        const readProbe = () => page.evaluate(() => { const a = window.__V100_PRESIDENT_SHADOW_BLUR_ABLATION__; const p = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? {}; return { measuredAt: performance.now(), renderFrames: p.renderFrames ?? 0, rafRequests: p.rafRequests ?? 0, requestedNonzero: a?.requestedNonzero ?? 0, forcedZero: a?.forcedZero ?? 0, mode: a?.mode ?? null }; });
        try {
          probe = await page.evaluate(installShadowBlurAblation); assert.ok(probe?.productionCanvas && probe.enabled, "shadow blur ablation target missing");
          for (const mode of ["original", "flat", "restored"]) {
            await page.evaluate(nextMode => window.__V100_PRESIDENT_SHADOW_BLUR_ABLATION__?.setMode(nextMode), mode); const before = await readProbe(); await page.waitForTimeout(2000); const after = await readProbe(); const windowRecord = { mode, requestedDurationMs: 2000, actualDurationMs: after.measuredAt - before.measuredAt, frameDelta: after.renderFrames - before.renderFrames, rafDelta: after.rafRequests - before.rafRequests, requestedNonzeroDelta: after.requestedNonzero - before.requestedNonzero, forcedZeroDelta: after.forcedZero - before.forcedZero, visualAcceptance: false }; windows.push(windowRecord); await page.screenshot({ path: path.join(output, `president-shadow-blur-${mode}.png`) });
          }
          assert.ok(windows.every(windowRecord => windowRecord.actualDurationMs >= 1900 && windowRecord.actualDurationMs <= 2600), "shadow blur ablation window timing invalid"); assert.ok(windows.every(windowRecord => windowRecord.requestedNonzeroDelta > 0), "shadow blur setter was not exercised in every window"); assert.ok(windows[1].forcedZeroDelta > 0); report.shadowBlurAblationApplied = true; baselineCase.shadowBlurAblationDiagnostic = { mode: "baseline-only-shadow-blur-ablation", windows, visualAcceptance: false };
        } finally { const restored = await page.evaluate(restoreShadowBlurAblation).catch(() => ({ restored: false })); baselineCase.shadowBlurAblationDiagnostic ??= {}; baselineCase.shadowBlurAblationDiagnostic.restored = restored.restored === true; baselineCase.shadowBlurAblationDiagnostic.descriptorRestored = restored.descriptorRestored === true; baselineCase.shadowBlurAblationDiagnostic.blurValueRestored = restored.blurValueRestored === true; assert.equal(restored.restored, true); assert.equal(restored.descriptorRestored, true); assert.equal(restored.blurValueRestored, true); }
        report.cases.push(baselineCase); continue;
      }
      if (backgroundBlitAblation) {
        let probe = null; const windows = [];
        const readProbe = () => page.evaluate(() => { const a = window.__V100_PRESIDENT_BACKGROUND_BLIT_ABLATION__; const p = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? {}; return { measuredAt: performance.now(), renderFrames: p.renderFrames ?? 0, rafRequests: p.rafRequests ?? 0, hits: a?.hits ?? 0, mismatches: a?.mismatches ?? 0, overflow: a?.overflow ?? 0, sourceSize: a?.firstSourceSize ?? null, mode: a?.mode ?? null }; });
        try {
          probe = await page.evaluate(installBackgroundBlitAblation, { color: "#20252d" }); assert.ok(probe?.productionCanvas && probe.enabled, "background ablation production canvas missing");
          for (const mode of ["original", "flat", "restored"]) {
            await page.evaluate(nextMode => window.__V100_PRESIDENT_BACKGROUND_BLIT_ABLATION__?.setMode(nextMode), mode); const before = await readProbe(); await page.waitForTimeout(2000); const after = await readProbe();
            const windowRecord = { mode, requestedDurationMs: 2000, actualDurationMs: after.measuredAt - before.measuredAt, frameDelta: after.renderFrames - before.renderFrames, rafDelta: after.rafRequests - before.rafRequests, hitDelta: after.hits - before.hits, mismatchDelta: after.mismatches - before.mismatches, overflow: after.overflow, sourceSize: after.sourceSize, visualAcceptance: false }; windows.push(windowRecord); await page.screenshot({ path: path.join(output, `president-background-${mode}.png`) });
          }
          assert.ok(windows.every(windowRecord => windowRecord.actualDurationMs >= 1900 && windowRecord.actualDurationMs <= 2600), "background ablation window timing invalid"); assert.ok(windows.every(windowRecord => windowRecord.hitDelta > 0), "background blit source was not observed in every window"); assert.ok(windows.every(windowRecord => windowRecord.mismatchDelta === 0)); assert.ok(windows.every(windowRecord => windowRecord.sourceSize?.width > 0 && windowRecord.sourceSize?.height > 0)); report.backgroundBlitAblationApplied = true; baselineCase.backgroundBlitAblationDiagnostic = { mode: "baseline-only-background-blit-ablation", windows, maxRetainedCalls: probe.maxCalls, visualAcceptance: false };
        } finally { const restored = await page.evaluate(restoreBackgroundBlitAblation).catch(() => ({ restored: false })); baselineCase.backgroundBlitAblationDiagnostic ??= {}; baselineCase.backgroundBlitAblationDiagnostic.restored = restored.restored === true; assert.equal(restored.restored, true); }
        report.cases.push(baselineCase); continue;
      }
      report.cases.push(baselineCase);
      if (renderProfile) {
        const cacheStableReadings = []; const stabilityStartedAt = Date.now(); let stableReads = 0; let previousCacheKey = null;
        while (Date.now() - stabilityStartedAt < 3000 && stableReads < 2) {
          await page.waitForTimeout(100); const reading = await readBaselineDiagnostic(); const cache = reading.staticBackgroundCache ?? {}; const sampler = reading.imageSamplingCache ?? {}; const valid = cache.ready === true && Number.isFinite(cache.rebuilds) && Number.isFinite(sampler.builds); const cacheKey = `${cache.rebuilds}|${sampler.builds}`; stableReads = valid ? (cacheKey === previousCacheKey ? stableReads + 1 : 1) : 0; previousCacheKey = valid ? cacheKey : null; cacheStableReadings.push({ measuredAt: reading.measuredAt, cacheKey, valid, staticBackgroundCache: cache, imageSamplingCache: sampler });
        }
        const warmWindows = [];
        for (let index = 0; index < 2; index += 1) { const warmStart = await readBaselineDiagnostic(); await page.waitForTimeout(1000); const warmEnd = await readBaselineDiagnostic(); warmWindows.push({ index: index + 1, requestedDurationMs: 1000, durationMs: warmEnd.measuredAt - warmStart.measuredAt, start: warmStart, end: warmEnd, delta: presentationPerformanceDelta(warmStart, warmEnd) }); }
        let probe = null; let instrumentStart = null; let instrumentEnd = null; try { await maybeInstallCanvasRenderProfileProbe(renderProfile, () => page.evaluate(installCanvasRenderProfileProbe)); instrumentStart = await readBaselineDiagnostic(); await page.waitForTimeout(1000); } finally { probe = await page.evaluate(restoreCanvasRenderProfileProbe).catch(() => null); } instrumentEnd = await readBaselineDiagnostic(); assert.ok(probe?.productionCanvas, "render profile production canvas missing");
        baselineCase.renderProfileDiagnostic = { mode: "baseline-only-render-profile", cacheStable: stableReads >= 2 && cacheStableReadings.slice(-2).every(reading => reading.staticBackgroundCache?.ready === true && Number.isFinite(reading.staticBackgroundCache?.rebuilds) && Number.isFinite(reading.imageSamplingCache?.builds)), cacheStableReadings: cacheStableReadings.slice(-8), warmWindows, instrumentedWindow: { requestedDurationMs: 1000, durationMs: instrumentEnd.measuredAt - instrumentStart.measuredAt, start: instrumentStart, end: instrumentEnd, delta: presentationPerformanceDelta(instrumentStart, instrumentEnd), canvasProbe: probe, visualAcceptance: false } };
        if (rafCallbackProfile && viewport.width === 1280) {
          let profile = null; let profileStart; let profileEnd;
          try { await page.evaluate(installRafCallbackProfile, { maxEntries: 180 }); profileStart = await readBaselineDiagnostic(); await page.waitForTimeout(2000); } finally { profile = await page.evaluate(restoreRafCallbackProfile).catch(() => null); }
          profileEnd = await readBaselineDiagnostic(); const entries = Array.isArray(profile?.entries) ? profile.entries : []; const sorted = [...entries].sort((left, right) => left - right); const percentile = fraction => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] : null;
          baselineCase.rafCallbackDiagnostic = { mode: "baseline-only-raf-callback-profile", requestedDurationMs: 2000, durationMs: profileEnd.measuredAt - profileStart.measuredAt, runtimePerformanceStart: profileStart, runtimePerformanceEnd: profileEnd, entriesRecorded: entries.length, overflow: profile?.overflow ?? null, invalidTimestamps: profile?.invalidTimestamps ?? null, totalMs: entries.reduce((sum, value) => sum + value, 0), p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: sorted.at(-1) ?? null, restored: profile?.restored === true, visualAcceptance: false };
        }
        if (compositeAblation && viewport.width === 1280) {
          const styleSignature = () => page.evaluate(() => { const frame = document.querySelector(".game-frame"); const canvas = document.querySelector(".game-shell canvas"); const read = element => element ? { filter: getComputedStyle(element).filter, backdropFilter: getComputedStyle(element).backdropFilter } : null; const after = frame ? getComputedStyle(frame, "::after") : null; const filterSamples = frame ? [frame, ...Array.from(frame.querySelectorAll("*")).slice(0, 8)].map(element => read(element)) : []; return { frame: read(frame), canvas: canvas ? { ...read(canvas), opacity: getComputedStyle(canvas).opacity } : null, filterSamples, after: after ? { display: after.display, backgroundImage: after.backgroundImage } : null, rootAttr: document.documentElement.getAttribute("data-v100-composite-ablation") }; });
          const originalSignature = await styleSignature(); const sequence = ["base", "vignette", "base", "filter", "base", "canvas-opacity", "base"]; const windows = []; baselineCase.compositeAblationDiagnostic = { enabled: true, sequence: windows, originalSignature, visualAcceptance: false };
          for (const mode of sequence) {
            let applied = false; let before; let after; let restored;
            let appliedComputed; let restoredComputed;
            try { if (mode !== "base") { applied = await page.evaluate(applyCompositeAblation, mode); appliedComputed = await styleSignature(); if (mode === "vignette") assert.equal(appliedComputed.after.display, "none"); if (mode === "canvas-opacity") assert.equal(appliedComputed.canvas.opacity, "0"); if (mode === "filter") assert.ok(appliedComputed.filterSamples.every(sample => sample.filter === "none" && (sample.backdropFilter === "none" || sample.backdropFilter === "rgba(0, 0, 0, 0)"))); } before = await readBaselineDiagnostic(); await page.waitForTimeout(1000); after = await readBaselineDiagnostic(); } finally { if (mode !== "base") restored = await page.evaluate(restoreCompositeAblation).catch(() => ({ restored: false })); restoredComputed = await styleSignature(); }
            windows.push({ mode, requestedDurationMs: 1000, durationMs: after.measuredAt - before.measuredAt, before, after, applied, appliedComputed, restoredComputed, signatureRestoredMatches: JSON.stringify(restoredComputed) === JSON.stringify(originalSignature), delta: presentationPerformanceDelta(before, after), restored: mode === "base" ? true : restored?.restored === true, visualAcceptance: false });
          }
          const finalSignature = await styleSignature(); assert.deepEqual(finalSignature, originalSignature);
          baselineCase.compositeAblationDiagnostic.finalSignature = finalSignature; baselineCase.compositeAblationDiagnostic.signatureRestoredMatches = JSON.stringify(finalSignature) === JSON.stringify(originalSignature); assert.equal(baselineCase.compositeAblationDiagnostic.signatureRestoredMatches, true);
        }
      }
      continue;
    }
    await page.evaluate(() => { const a = window.__V100_PRESIDENT_PRESENTATION__; a.active = true; a.bypass = false; a.drawCalls = []; a.counts = {}; });
    const runtimePerformanceStart = await page.evaluate(() => {
      const p = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? {};
      return { renderFrames: p.renderFrames ?? 0, simulationTicks: p.simulationTicks ?? 0, rafRequests: p.rafRequests ?? 0, hiddenFrameCallbacks: p.hiddenFrameCallbacks ?? 0 };
    });
    const captureStartedAt = Date.now();
    let captureElapsedMs = 0;
    let captureDrawCount = 0;
    while (Date.now() - captureStartedAt < 3000) {
      await page.waitForTimeout(Math.min(100, Math.max(1, 3000 - (Date.now() - captureStartedAt))));
      const captureState = await page.evaluate(() => {
        const audit = window.__V100_PRESIDENT_PRESENTATION__;
        return { drawCount: audit.counts?.["/art/v100/bosses/mugarian-president-mutated-battle-v2.png"] ?? 0 };
      });
      captureElapsedMs = Date.now() - captureStartedAt;
      captureDrawCount = captureState.drawCount;
      if (presentationCaptureReady(captureElapsedMs, captureDrawCount)) break;
    }
    const evidence = await page.evaluate(({ viewport, expectedId }) => {
      const canvas = document.querySelector(".game-shell canvas"); const rect = canvas.getBoundingClientRect(); const s = window.__ASHFALL_BATTLE_QA__.getSnapshot(); const calls = window.__V100_PRESIDENT_PRESENTATION__.drawCalls; const p = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? {};
      const hudRects = [...document.querySelectorAll(".v100-boss-center,.phase-block,.top-hud,.battle-brand-zone,.battle-message-stack,.battle-controls-zone")].map(node => { const r = node.getBoundingClientRect(); return { className: String(node.className), top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; });
      const president = s.fighters.find(f => f.kind === "mugarian-president-mutated");
      return { viewport, expectedId, actualViewportId: s.geometry?.viewportId, canvasRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, hudRects, body: calls, runtimePerformance: { renderFrames: p.renderFrames ?? 0, simulationTicks: p.simulationTicks ?? 0, rafRequests: p.rafRequests ?? 0, hiddenFrameCallbacks: p.hiddenFrameCallbacks ?? 0 }, snapshot: president ? { time: s.time, hp: president.hp, maxHp: president.maxHp, y: president.y, combatReady: president.combatReady, gateEntering: president.gateEntering, renderAudit: president.renderAudit } : null };
    }, { viewport, expectedId });
    assert.equal(evidence.actualViewportId, expectedId); assert.ok(evidence.snapshot && evidence.snapshot.hp > 0 && evidence.snapshot.maxHp === 6200 && evidence.snapshot.combatReady && !evidence.snapshot.gateEntering); assert.ok(evidence.snapshot.renderAudit?.spritePath?.includes("mugarian-president-mutated-battle-v2.png")); assert.equal(evidence.snapshot.renderAudit?.effectiveOpacity, 1); assert.ok(evidence.hudRects.some(rect => rect.className.includes("v100-boss-center") && rect.width > 0 && rect.height > 0));
    await page.evaluate(() => { window.__V100_PRESIDENT_PRESENTATION__.active = false; });
    const rawBody = evidence.body.filter(call => call.sourcePath === sourcePath);
    const invalidRawCalls = rawBody.filter(call => ![call.sourceRect, call.destination].every(rect => Array.isArray(rect) && rect.length === 4 && rect.every(Number.isFinite)) || !call.transform || !Object.values(call.transform).every(Number.isFinite) || !call.canvas || !Object.values(call.canvas).every(Number.isFinite));
    const reduced = reducePresidentPresentation({ calls: rawBody, canvasRect: evidence.canvasRect, hudRects: evidence.hudRects, alphaBoundsFor: rect => alpha.bounds(rect) });
    const captureWindowMs = Math.min(captureElapsedMs, 3000);
    evidence.captureWallClockMs = captureElapsedMs; evidence.captureWindowMs = captureWindowMs; evidence.rawDrawTotal = captureDrawCount; evidence.rawDrawCount = rawBody.length; evidence.invalidRawCalls = invalidRawCalls.length; evidence.reducerFinite = reduced.finite; evidence.reducerBoundCount = reduced.bounds.length; evidence.runtimePerformanceStart = runtimePerformanceStart; evidence.runtimePerformanceEnd = evidence.runtimePerformance; evidence.runtimePerformanceDelta = presentationPerformanceDelta(runtimePerformanceStart, evidence.runtimePerformance); delete evidence.runtimePerformance; evidence.body = reduced.bounds.slice(-60); evidence.drawCount = reduced.bounds.length; evidence.bodyTop = reduced.bodyTop; evidence.bodyBottom = reduced.bodyBottom; evidence.hudBottom = reduced.hudBottom; evidence.footY = reduced.bounds.at(-1)?.footY ?? null; evidence.pass = reduced.pass; evidence.capture = `${output}/president-${viewport.width}x${viewport.height}.png`; report.cases.push(evidence); await page.screenshot({ path: evidence.capture });
    assert.ok(captureWindowMs <= 3000 && captureDrawCount >= 30, `President capture window insufficient for ${expectedId}: windowMs=${captureWindowMs} wallMs=${captureElapsedMs} totalDraws=${captureDrawCount} retained=${rawBody.length}`);
    assert.ok(reduced.finite && reduced.bounds.length >= 30, `President body evidence insufficient for ${expectedId}: raw=${rawBody.length} bounds=${reduced.bounds.length} invalidRaw=${invalidRawCalls.length} finite=${reduced.finite}`);
    } catch (error) {
      viewportFailures.push({ viewport, error: String(error.stack ?? error) });
      const existing = report.cases.findLast?.(item => item.viewport?.width === viewport.width && item.viewport?.height === viewport.height);
      if (existing) existing.error = String(error.stack ?? error);
      else report.cases.push({ viewport, error: String(error.stack ?? error), pass: false });
      await page.screenshot({ path: `${output}/president-${viewport.width}x${viewport.height}-failure.png` }).catch(() => {});
    } finally {
      await page.evaluate(() => { const a = window.__V100_PRESIDENT_PRESENTATION__; if (a) { a.active = false; a.bypass = false; } }).catch(() => {});
    }
  }
  assert.equal(report.cases.length, viewports.length); assert.deepEqual(viewportFailures, [], `President viewport diagnostics failed: ${JSON.stringify(viewportFailures)}`); if (!baselineOnly) assert.ok(report.cases.every(c => c.pass), "President body must remain below the upper HUD in all viewports");
  assert.deepEqual(report.errors, [], "native presentation run emitted runtime errors");
  report.status = baselineOnly ? "baseline-only" : "passed";
} catch (error) { report.status = "failed"; report.error = String(error.stack ?? error); await page.screenshot({ path: `${output}/failure.png` }).catch(() => {}); throw error; } finally { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await context.close(); await browser.close(); }
console.log(JSON.stringify({ status: report.status, cases: report.cases.length }));
