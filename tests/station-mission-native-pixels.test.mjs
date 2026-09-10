import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile("app/AshfallGame.tsx", "utf8");
const parsed = ts.createSourceFile("app.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "stationMissionFinalCanvasAudit") functions.push(node);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(functions.length, 1);
const compiled = ts.transpileModule(functions[0].getText(parsed),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function rgba(count, color = 220, alpha = 255) {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < data.length; i += 4) data.set([color, color, color, alpha], i);
  return data;
}

function fixture(options = {}) {
  const worldExpected = options.worldExpected ?? rgba(800, 100);
  const worldActual = options.worldActual ?? rgba(800);
  const nativeExpected = options.nativeExpected ?? rgba(200);
  const nativeActual = options.nativeActual ?? rgba(200);
  const transform = options.transform ?? { scale: .5, offsetX: -3, offsetY: 2 };
  const dpr = options.dpr ?? 1;
  const draws = [], transforms = [], nativeReads = [], surfaces = [];
  const game = { definition: { missionType: options.missionType ?? "sequential-seal" },
    stageMission: { powerActivated: options.power ?? 0 }, researchContainer: { exposed: options.power === 3 } };
  const assets = { "station-tunnel-mission-art-source": { complete: !options.missingSource, naturalWidth: 1600, naturalHeight: 900 } };
  const initialGame = JSON.stringify(game), initialAssets = JSON.stringify(assets);
  const finalCanvas = { width: 20, height: 10, dataset: { dpr: String(dpr) },
    getContext() { return options.missingNativeContext ? null : {
      getImageData(...args) { nativeReads.push(args); return { data: nativeActual }; },
    }; } };
  const sandbox = vm.createContext({ W: 40, H: 20,
    STATION_MISSION_TYPES: { SEQUENTIAL_SEAL: "sequential-seal" },
    document: { createElement(tag) {
      assert.equal(tag, "canvas");
      const id = surfaces.length;
      let native = false;
      const context = {
        drawImage() {},
        setTransform(...args) { native = true; transforms.push(args); },
        getImageData() { return { data: id === 0 ? worldExpected : native ? nativeExpected : worldActual }; },
      };
      const surface = { getContext() { return options.missingScratchContext ? null : context; } };
      surfaces.push(surface);
      return surface;
    } },
    drawStationMission(context, currentGame, currentAssets, fallback) {
      assert.equal(currentGame, game); assert.equal(currentAssets, assets); assert.equal(fallback, false);
      draws.push(context);
    },
  });
  vm.runInContext(compiled, sandbox);
  const result = sandbox.stationMissionFinalCanvasAudit(finalCanvas, transform, game, assets);
  assert.equal(JSON.stringify(game), initialGame);
  assert.equal(JSON.stringify(assets), initialAssets);
  return { result: JSON.parse(JSON.stringify(result)), draws, transforms, nativeReads, surfaces };
}

test("correct native content is not rejected by unrelated world-grid color resampling", () => {
  const f = fixture();
  assert.equal(f.result.pass, true);
  assert.equal(f.result.authoredPixelCount, 800);
  assert.equal(f.result.finalPaintedCount, 800);
  assert.equal(f.result.finalPaintRatio, 1);
  assert.equal(f.result.finalNearMatchRatio, 1);
  assert.equal(f.result.finalPixelMatchCount, 200);
  assert.equal(f.result.nativeColorGrid.opaquePixelCount, 200);
  assert.equal(f.surfaces.length, 2); assert.equal(f.draws.length, 2);
  assert.notEqual(f.draws[0], f.draws[1]);
  assert.deepEqual(f.nativeReads, [[0, 0, 20, 10]]);
  assert.equal(f.surfaces[1].width, 20); assert.equal(f.surfaces[1].height, 10);
});

test("reference uses exact native scale, offset and DPR without modifying production data", () => {
  const f = fixture({ transform: { scale: .7, offsetX: -5, offsetY: 3 }, dpr: 2, power: 3 });
  assert.deepEqual(f.transforms, [[1.4, 0, 0, 1.4, -10, 6]]);
  assert.deepEqual(f.result.nativeColorGrid, { width: 20, height: 10, opaquePixelCount: 200, scale: 1.4, offsetX: -10, offsetY: 6 });
  assert.deepEqual(f.result.missionState, { powerActivated: 3, researchContainerExposed: true });
});

test("world-space opaque count and clipped-pixel coverage retain original fail-closed boundaries", () => {
  for (const [missing, pass] of [[8, true], [9, false], [800, false]]) {
    const worldActual = rgba(800);
    for (let i = 0; i < missing; i++) worldActual[i * 4 + 3] = 0;
    const result = fixture({ worldActual }).result;
    assert.equal(result.pass, pass);
    assert.equal(result.finalPaintRatio, (800 - missing) / 800);
    assert.equal(result.finalNearMatchRatio, 1);
  }
  for (const [count, pass] of [[500, false], [501, true]]) {
    const worldExpected = rgba(800, 100, 244);
    for (let i = 0; i < count; i++) worldExpected[i * 4 + 3] = 245;
    const result = fixture({ worldExpected }).result;
    assert.equal(result.authoredPixelCount, count); assert.equal(result.pass, pass);
  }
});

test("empty or incorrect native content fails, preserving alpha245 and RGB18/60/near0.72", () => {
  assert.equal(fixture({ nativeExpected: rgba(200, 220, 244) }).result.pass, false);
  assert.equal(fixture({ nativeActual: rgba(200, 0) }).result.pass, false);
  for (const [matches, pass] of [[143, false], [144, true]]) {
    const nativeActual = rgba(200, 0);
    for (let i = 0; i < matches; i++) nativeActual.set([200, 200, 200, 255], i * 4);
    const result = fixture({ nativeExpected: rgba(200, 220, 245), nativeActual }).result;
    assert.equal(result.finalNearMatchRatio, matches / 200); assert.equal(result.pass, pass);
    assert.equal(result.finalPixelMatchCount, 0);
  }
  assert.equal(fixture({ nativeActual: rgba(200, 199) }).result.pass, false);
  assert.equal(fixture({ nativeActual: rgba(200, 214) }).result.finalPixelMatchCount, 200);
  assert.equal(fixture({ nativeActual: rgba(200, 213) }).result.finalPixelMatchCount, 0);
});

test("world authored signature and independent mission state survive color-grid correction", () => {
  const a = fixture().result;
  const b = fixture({ nativeActual: rgba(200, 0), power: 1 }).result;
  assert.equal(a.authoredStateSignature, b.authoredStateSignature);
  assert.notEqual(a.authoredStateSignature, fixture({ worldExpected: rgba(800, 101) }).result.authoredStateSignature);
  assert.deepEqual(b.missionState, { powerActivated: 1, researchContainerExposed: false });
});

test("unavailable source or canvas cannot produce accepted evidence", () => {
  assert.equal(fixture({ missingSource: true }).result.pass, false);
  assert.equal(fixture({ missionType: "other" }).result.applicable, false);
  assert.throws(() => fixture({ missingNativeContext: true }), /native final-canvas audit unavailable/);
  assert.throws(() => fixture({ missingScratchContext: true }), /expected audit canvas unavailable/);
});
