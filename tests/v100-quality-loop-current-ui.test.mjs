import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { V100_STORY_EVENTS } from "../app/v100StoryEvents.js";
import { v100EventPresentationFor } from "../app/v100EventPresentation.js";
import { isV100StoryBackdropReady } from "../scripts/v100-story-backdrop-ready.mjs";

const file = "scripts/v100-quality-loop-browser.mjs";
const source = await readFile(file, "utf8");
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const calls = [];
function visit(node) { if (ts.isCallExpression(node)) calls.push(node); ts.forEachChild(node, visit); }
visit(parsed);
const declaration = name => {
  const node = parsed.statements.find(x => ts.isFunctionDeclaration(x) && x.name?.text === name);
  assert.ok(node, "exercise actual driver " + name);
  assert.ok(calls.some(x => x.expression.getText(parsed) === name), "driver is wired into a real capture");
  return node.getText(parsed);
};

for (const missingPlan of [false, true]) test(`briefing uses the current dialog and its operation tab: missing=${missingPlan}`, async () => {
  let opened = false, operation = false;
  const taps = [];
  const plan = { available: !missingPlan, tap: async () => { operation = true; taps.push("operation"); } };
  const popup = { kind: "page" };
  const dialog = {
    async waitFor(options) { assert.equal(options.state, "visible"); assert.equal(opened, true); },
    getByRole(role, options) { assert.equal(role, "button"); assert.deepEqual({ ...options }, { name: "作戦", exact: true }); return plan; },
    locator(selector) { assert.equal(selector, ".v100-briefing-page"); assert.equal(operation, true); return popup; },
  };
  const page = { getByRole(role, options) {
    assert.deepEqual({ ...options }, { name: "作戦と戦い方", exact: true });
    if (role === "dialog") return dialog;
    assert.equal(role, "button");
    return { available: true, tap: async () => { opened = true; taps.push("open"); } };
  } };
  const run = vm.runInNewContext(declaration("openCurrentQualityBriefing") + "\nopenCurrentQualityBriefing", {
    within: async (locator, minimum) => { assert.equal(minimum, 44); assert.equal(locator.available, true, "requested control is absent"); },
  });
  if (missingPlan) await assert.rejects(run(page), /requested control is absent/);
  else { const result = await run(page); assert.equal(result.dialog, dialog); assert.equal(result.popup, popup); assert.deepEqual(taps, ["open", "operation"]); }
});

for (const wrongSource of [false, true]) test(`cinematic checks the currently bound foreground instead of an obsolete filename: wrong=${wrongSource}`, async () => {
  const eventId = "v100:event:s23:pre", event = V100_STORY_EVENTS[eventId];
  const index = event.nodes.findIndex(node => node.cutId === "chiha-confession");
  assert.ok(index >= 0);
  const background = v100EventPresentationFor({ eventId, phase: "event", node: event.nodes[index], nodeIndex: index }).backgroundPath;
  assert.ok(background.includes("/quality-20261028/scenes/"));
  const image = { complete: true, naturalWidth: 1200, naturalHeight: 600,
    currentSrc: "http://127.0.0.1:59180" + (wrongSource ? "/wrong.webp" : background),
    getBoundingClientRect: () => ({ width: 844, height: 340 }) };
  const backdrop = { querySelector: () => image };
  const page = { async waitForFunction(predicate, argument) {
    assert.equal(predicate, isV100StoryBackdropReady);
    assert.equal(argument.selector, `[data-v100-event-id="${eventId}"]`);
    const result = vm.runInNewContext(`(${predicate.toString()})(argument)`, { argument, URL,
      document: { baseURI: "http://127.0.0.1:59180/", querySelector: () => ({ querySelector: () => backdrop }) },
      getComputedStyle: element => element === backdrop ? { backgroundImage: "none" }
        : { display: "block", visibility: "visible", opacity: "1", objectFit: "contain" },
    });
    assert.equal(result, true, "wrong foreground rejected");
  } };
  const run = vm.runInNewContext(declaration("waitForCurrentQualityBackdrop") + "\nwaitForCurrentQualityBackdrop", {
    assert, V100_STORY_EVENTS, v100EventPresentationFor, isV100StoryBackdropReady,
  });
  if (wrongSource) await assert.rejects(run(page, eventId, index), /wrong foreground rejected/);
  else await run(page, eventId, index);
});

const runCases = calls.filter(x => x.expression.getText(parsed) === "runCase");
const resultWork = runCases.find(x => x.arguments[3].getText(parsed).includes("'result-'")).arguments.at(-1);
const next = resultWork.body.statements.find(x => ts.isVariableStatement(x) && x.declarationList.declarations.some(d => d.name.getText(parsed) === "next"));
assert.ok(next);
for (const won of [false, true]) test(`result navigation keeps its intended action: won=${won}`, () => {
  const expected = won ? "次の場面へ" : "編成を見直す";
  const run = () => vm.runInNewContext(next.getText(parsed) + "\nnext", { won, page: {
    getByRole(role, options) { assert.equal(role, "button"); assert.deepEqual({ ...options }, { name: expected, exact: true }); return expected; },
  } });
  assert.equal(run(), expected);
});

const nativeWork = runCases.find(x => x.arguments[3].getText(parsed).includes("early-budget-native")).arguments.at(-1);
const upgrade = nativeWork.body.statements.find(x => ts.isExpressionStatement(x) && x.getText(parsed).includes(".v100-personnel-focus") && x.getText(parsed).includes(".tap()"));
assert.ok(upgrade);
for (const missingUpgrade of [false, true]) test(`native growth picks upgrade among two primary controls: missing=${missingUpgrade}`, async () => {
  const taps = [];
  const page = { locator(selector) {
    assert.equal(selector, ".v100-personnel-focus");
    return { getByRole(role, options) {
      assert.equal(role, "button"); assert.deepEqual({ ...options }, { name: "Lv.2へ強化 / 30 CAPS", exact: true });
      return { async tap() { assert.equal(missingUpgrade, false, "upgrade absent; preparation must not be tapped"); taps.push("upgrade"); } };
    } };
  } };
  const run = vm.runInNewContext("(async()=>{" + upgrade.getText(parsed) + "})", { page });
  if (missingUpgrade) { await assert.rejects(run(), /upgrade absent/); assert.deepEqual(taps, []); }
  else { await run(); assert.deepEqual(taps, ["upgrade"]); }
});


test('smartphone presentation keeps both requested sizes and adds no implicit PC case',()=>{
  const sizes=[{width:844,height:390},{width:844,height:340}];
  for(const id of ['formation-long-name','formation-empty-slots']){
    const call=runCases.find(x=>x.arguments[3].getText(parsed).includes(id));assert.ok(call);
    let loop=call.parent;while(loop&&!ts.isForOfStatement(loop))loop=loop.parent;assert.ok(loop);
    for(const [sections,expected] of [[['presentation'],sizes],[[],[]]]){
      const actual=vm.runInNewContext(loop.expression.getText(parsed),{sections,sizes});
      assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
    }
  }
});

for (const mode of ['readable', 'hidden', 'horizontal-only', 'tail-clipped', 'controls-moved', 'save-changed']) {
  test('formation detail guard rejects inaccessible reading or side effects: ' + mode, async () => {
    const hooks = calls.filter(call => call.expression.getText(parsed) === 'formationDetailsReachable');
    assert.equal(hooks.length, 2);
    assert.ok(hooks.every(call => ts.isAwaitExpression(call.parent)), 'Both real formation cases await the guard');
    let top = 0, controlReads = 0, saveReads = 0;
    const captures = [], leaf = {};
    const copy = { lastElementChild: leaf };
    const element = {
      scrollHeight: 373, clientHeight: 168,
      get scrollTop() { return top; },
      set scrollTop(value) { top = Math.max(0, Math.min(205, value)); },
      getBoundingClientRect: () => ({ top: 66, bottom: 234, width: 177, height: 168 }),
      querySelector: () => copy,
    };
    const pane = { evaluate: async (callback, argument) => callback(element, argument) };
    const names = ['戦闘へ', 'ユニットの育成', '枠を空ける', 'ステージ選択へ'];
    const page = {
      locator(selector) { assert.equal(selector, '.v100-field-map-pane'); return pane; },
      getByRole(role, options) { assert.equal(role, 'button'); assert.ok(names.includes(options.name)); assert.equal(options.exact, true); return options.name; },
    };
    const run = vm.runInNewContext(declaration('formationDetailsReachable') + '\nformationDetailsReachable', {
      assert,
      getComputedStyle: () => ({ overflowY: mode === 'hidden' ? 'hidden' : 'auto', touchAction: mode === 'horizontal-only' ? 'pan-x' : 'pan-y' }),
      document: { createRange: () => ({
        selectNodeContents(node) { assert.equal(node, leaf); },
        getClientRects: () => [{ top: 418.78 - top, bottom: mode === 'tail-clipped' ? 242 : 430.78 - top, width: 75, height: 12 }],
      }) },
      within: async (locator, minimum) => {
        assert.equal(minimum, 44);
        if (locator === pane) return { x: 13, y: 66, width: 177, height: 168 };
        const moved = mode === 'controls-moved' && controlReads >= 4;
        controlReads++;
        return { x: 13 + (moved ? 7 : 0), y: 288, width: 220, height: 44, reachable: true };
      },
      rawSave: async () => ({ caps: mode === 'save-changed' && saveReads++ > 0 ? 4999 : 5000, receipts: ['retained'] }),
      capture: async (_page, _row, name) => { captures.push(name); },
    });
    const row = {};
    if (mode === 'readable') {
      await run(page, { width: 844, height: 340 }, row);
      assert.equal(row.formationDetailScroll.after.readable, true);
      assert.equal(top, 0, 'Reading observation restores its initial scroll position');
      assert.deepEqual(captures, ['details-end']);
    } else {
      const messages = { hidden: /user-scrollable area/, 'horizontal-only': /Vertical touch/, 'tail-clipped': /final line/, 'controls-moved': /actions remain fixed/, 'save-changed': /does not change the save/ };
      await assert.rejects(run(page, { width: 844, height: 340 }, row), messages[mode]);
      assert.deepEqual(captures, []);
    }
  });
}
