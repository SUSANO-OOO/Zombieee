import assert from "node:assert/strict";
import test from "node:test";
import { createV100ShotLayer, supportBounds } from "../app/v100ShotLayer.js";

function context(canvas, attributes = { colorSpace: "srgb", alpha: true, willReadFrequently: true }) {
  const state = { transform: [2, 0, 0, 2, 7, 9], lineDash: [], fillStyle: "black", strokeStyle: "black", lineWidth: 1, lineCap: "butt", lineJoin: "miter", miterLimit: 10, lineDashOffset: 0, font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic", direction: "inherit", globalAlpha: 1, globalCompositeOperation: "source-over", shadowColor: "black", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, filter: "none", imageSmoothingEnabled: true, imageSmoothingQuality: "low", drawImages: 0, calls: [] }; const stack = [];
  const value = { canvas, state, getContextAttributes: () => attributes, getTransform: () => { const [a, b, c, d, e, f] = state.transform; return { a, b, c, d, e, f }; }, setTransform: (...args) => { state.transform = args; }, getLineDash: () => [...state.lineDash], setLineDash: (args) => { state.lineDash = [...args]; }, save: () => stack.push({ ...state, transform: [...state.transform], lineDash: [...state.lineDash] }), restore: () => { const saved = stack.pop(); if (saved) { const drawImages = state.drawImages; const calls = state.calls; Object.assign(state, saved); state.drawImages = drawImages; state.calls = calls; } }, clearRect: () => {}, drawImage: () => { state.drawImages += 1; } };
  Object.defineProperty(value, "stackDepth", { get: () => stack.length });
  for (const name of ["fillStyle", "strokeStyle", "lineWidth", "lineCap", "lineJoin", "miterLimit", "lineDashOffset", "font", "textAlign", "textBaseline", "direction", "globalAlpha", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "filter", "imageSmoothingEnabled", "imageSmoothingQuality", "globalCompositeOperation"]) Object.defineProperty(value, name, { get: () => state[name], set: (item) => { state[name] = item; } });
  for (const name of ["beginPath", "closePath", "moveTo", "lineTo", "quadraticCurveTo", "arc", "rotate", "translate", "clip"]) value[name] = (...args) => state.calls.push([name, ...args]);
  for (const name of ["stroke", "fill", "fillRect", "drawImage"]) { if (name === "drawImage") continue; value[name] = (...args) => state.calls.push([name, state.shadowBlur, ...args]); }
  value.drawImage = (...args) => { state.drawImages += 1; state.calls.push(["drawImage", state.shadowBlur, ...args]); };
  return value;
}
function canvas(width, height, attributes) { const value = { width, height }; value.getContext = () => { value.context ??= context(value, attributes); return value.context; }; return value; }
function mainCanvas(width = 100, height = 100, attributes) { const value = canvas(width, height, attributes); value.context = context(value, attributes); value.getContext = () => value.context; return value.context; }
function helper(ctx) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.shadowColor = "#8cf"; ctx.shadowBlur = 6; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, 3); ctx.quadraticCurveTo(5, 6, 9, 10); ctx.stroke(); ctx.restore(); }

test("split glow records once, reuses half surface, and restores state", () => {
  const main = mainCanvas(101, 99); const before = JSON.stringify(main.state); let calls = 0; const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) });
  layer.draw(main, (ctx) => { calls += 1; helper(ctx); }); layer.draw(main, (ctx) => { calls += 1; helper(ctx); });
  assert.equal(calls, 2); assert.equal(layer.snapshot().width, 64); assert.equal(layer.snapshot().height, 64); assert.equal(layer.snapshot().builds, 1); assert.equal(layer.snapshot().frames, 2); assert.equal(layer.snapshot().callbackCount, 2); assert.equal(layer.snapshot().draws, 2); assert.ok(main.state.calls.every((call) => call[0] !== "stroke" || call[1] === 0)); assert.equal(main.state.transform.join(","), JSON.parse(before).transform.join(",")); assert.equal(main.state.shadowBlur, JSON.parse(before).shadowBlur); assert.equal(main.state.filter, JSON.parse(before).filter);
});
test("odd dimensions resize and clear release surfaces", () => {
  const main = mainCanvas(101, 99); let made = 0; const surfaces = []; const layer = createV100ShotLayer({ createCanvas: () => { made += 1; const item = canvas(0, 0); surfaces.push(item); return item; } }); layer.draw(main, helper); assert.equal(main.state.drawImages, 1); assert.ok(surfaces[0].context.state.calls.some((call) => call[0] === "stroke" && call[1] === 3)); const composite = main.state.calls.find((call) => call[0] === "drawImage"); assert.equal(composite[9], 102); assert.equal(composite[10], 100); main.canvas.width = 121; layer.draw(main, helper); assert.equal(made, 1); assert.equal(layer.snapshot().reuses > 0, true); layer.clear(); assert.equal(layer.snapshot().bytes, 0); assert.equal(surfaces[0].height, 0);
});
test("uncertain painted geometry retains the full fallback bounds", () => {
  const result = supportBounds([{kind:"write",name:"shadowBlur",value:1},{kind:"call",name:"stroke",args:[]}],[1,0,0,1,0,0],100,100);
  assert.deepEqual(result,{bounds:{x0:0,y0:0,x1:100,y1:100},full:true,empty:false});
});
test("mixed aspect ROI growth replaces an over-budget surface after one callback", () => {
  const previousPath2D=globalThis.Path2D;
  globalThis.Path2D=class { rect() {} };
  try {
    const main=mainCanvas(200,200),surfaces=[];
    const layer=createV100ShotLayer({maxBytes:40000,createCanvas:()=>{const item=canvas(0,0);surfaces.push(item);return item;}});
    let callbacks=0;
    for(const [width,height] of [[100,40],[40,100]])layer.draw(main,ctx=>{callbacks++;ctx.shadowBlur=1;ctx.fillRect(0,0,width,height);});
    assert.equal(callbacks,2);
    assert.equal(layer.snapshot().errors,0);
    assert.equal(layer.snapshot().frames,2);
    assert.equal(surfaces.length,2);
    assert.equal(surfaces[0].width,0);
    assert.ok(layer.snapshot().bytes<=40000);
  } finally {if(previousPath2D===undefined)delete globalThis.Path2D;else globalThis.Path2D=previousPath2D;}
});
test("P3 and budget direct-fallback once", () => {
  for (const [main, options] of [[mainCanvas(20, 20, { colorSpace: "display-p3" }), {}], [mainCanvas(2000, 2000), { maxBytes: 8 }]]) { let calls = 0; const layer = createV100ShotLayer(options); layer.draw(main, () => { calls += 1; }); assert.equal(calls, 1); assert.equal(layer.snapshot().fallbacks, 1); }
  const main = mainCanvas(); let calls = 0; const layer = createV100ShotLayer({ createCanvas: () => ({ width: 0, height: 0, getContext: () => null }) }); layer.draw(main, () => { calls += 1; }); assert.equal(calls, 1); assert.equal(layer.snapshot().fallbacks, 1);
});
test("direct fallback tracks callback saves and restores caller state on throw", () => {
  const main = mainCanvas(20, 20, { colorSpace: "display-p3" }); main.save(); main.lineWidth = 5; const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) });
  assert.throws(() => layer.draw(main, (ctx) => { ctx.save(); ctx.lineWidth = 13; throw new Error("direct failure"); }), /direct failure/);
  assert.equal(main.stackDepth, 1); assert.equal(main.lineWidth, 5); assert.equal(layer.snapshot().callbackCount, 1); assert.equal(layer.snapshot().errors, 1);
});
test("callback exception does not rerun and reentry is rejected", () => {
  const main = mainCanvas(); const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); let calls = 0; assert.throws(() => layer.draw(main, () => { calls += 1; throw new Error("boom"); }), /boom/); assert.equal(calls, 1); assert.equal(layer.snapshot().errors, 1); assert.throws(() => layer.draw(main, () => layer.draw(main, () => {})), /reentry/);
});
test("unsupported callback API flushes prefix once and continues directly", () => {
  const main = mainCanvas(); const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); let calls = 0; layer.draw(main, (ctx) => { calls += 1; helper(ctx); ctx.clip(); ctx.fill(); }); assert.equal(calls, 1); assert.equal(layer.snapshot().fallbacks, 1); assert.equal(layer.snapshot().frames, 0);
});
test("known property reads return the real main value after raw flush", () => {
  const main = mainCanvas(); main.lineWidth = 7; const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); let observed; layer.draw(main, (ctx) => { ctx.beginPath(); observed = ctx.lineWidth; ctx.stroke(); }); assert.equal(observed, 7); assert.equal(layer.snapshot().fallbacks, 1); assert.equal(layer.snapshot().frames, 0);
});
test("raw save/restore preserves a caller stack and callback count", () => {
  const main = mainCanvas(); main.save(); main.lineWidth = 5; const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); layer.draw(main, (ctx) => { ctx.save(); ctx.lineWidth = 7; assert.equal(ctx.lineWidth, 7); ctx.restore(); }); assert.equal(main.stackDepth, 1); assert.equal(main.lineWidth, 5); assert.equal(layer.snapshot().callbackCount, 1); assert.equal(layer.snapshot().fallbacks, 1);
});
test("core starts with inherited shadows disabled", () => {
  const main = mainCanvas(); main.shadowBlur = 9; const surfaces = []; const layer = createV100ShotLayer({ createCanvas: () => { const item = canvas(0, 0); surfaces.push(item); return item; } }); layer.draw(main, (ctx) => { ctx.beginPath(); ctx.moveTo(1, 1); ctx.stroke(); }); assert.ok(main.state.calls.some((call) => call[0] === "stroke" && call[1] === 0)); assert.ok(surfaces[0].context.state.calls.some((call) => call[0] === "stroke" && call[1] === 4.5));
});
test("method-slot mutation is rejected after prefix flush", () => {
  const main = mainCanvas(); const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); assert.throws(() => layer.draw(main, (ctx) => { helper(ctx); ctx.save = () => {}; }), /method|setter/); assert.equal(layer.snapshot().fallbacks, 1);
});
test("command overflow forwards the triggering operation without rerun", () => {
  const main = mainCanvas(); const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); let calls = 0; layer.draw(main, (ctx) => { calls += 1; for (let i = 0; i < 9000; i += 1) ctx.beginPath(); }); assert.equal(calls, 1); assert.equal(main.state.calls.filter((call) => call[0] === "beginPath").length, 9000); assert.equal(layer.snapshot().fallbacks, 1); assert.equal(layer.snapshot().frames, 0);
});
test("overflow property writes forward their exact value", () => {
  const main = mainCanvas(); const before = main.lineWidth; let inside; const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); layer.draw(main, (ctx) => { for (let i = 0; i < 8192; i += 1) ctx.beginPath(); ctx.lineWidth = 13; inside = ctx.lineWidth; }); assert.equal(inside, 13); assert.equal(main.lineWidth, before); assert.equal(layer.snapshot().callbackCount, 1); assert.equal(layer.snapshot().fallbacks, 1);
});

test("unsupported writes include zero offsets and filter none", () => {
  for (const write of [(ctx) => { ctx.shadowOffsetX = 0; }, (ctx) => { ctx.shadowOffsetY = 0; }]) {
    const main = mainCanvas(); const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); layer.draw(main, write); assert.equal(layer.snapshot().fallbacks, 1);
  }
  const main = mainCanvas(); const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); layer.draw(main, (ctx) => { ctx.filter = "none"; }); assert.equal(layer.snapshot().fallbacks, 1);
});

test("captured method wrapper continues after unsupported bound call exactly once", () => {
  const main = mainCanvas(); const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) }); let stroke;
  layer.draw(main, (ctx) => { stroke = ctx.stroke; ctx.clip(); stroke(); });
  assert.equal(main.state.calls.filter((call) => call[0] === "stroke").length, 1); assert.equal(layer.snapshot().fallbacks, 1);
});

test("unknown writes forward undefined exactly", () => {
  const main = mainCanvas(); main.customFlag = "kept"; const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) });
  layer.draw(main, (ctx) => { ctx.clip(); ctx.customFlag = undefined; });
  assert.equal(main.customFlag, undefined); assert.equal(layer.snapshot().fallbacks, 1);
});

test("prefix failure unwinds owned raw saves without popping caller save", () => {
  const main = mainCanvas(); main.save(); const layer = createV100ShotLayer({ createCanvas: () => canvas(0, 0) });
  main.stroke = () => { throw new Error("prefix failure"); };
  assert.throws(() => layer.draw(main, (ctx) => { ctx.save(); ctx.beginPath(); ctx.stroke(); ctx.clip(); }), /prefix failure/);
  assert.equal(main.stackDepth, 1); assert.equal(layer.snapshot().callbackCount, 1); assert.equal(layer.snapshot().errors, 1);
});
