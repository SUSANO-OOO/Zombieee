import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../scripts/p5-browser-smoke.mjs", import.meta.url), "utf8");
const ownerSource = source.slice(source.indexOf("async function withStage3FinalPresentationSuppression("),
  source.indexOf("async function closePlaywrightResource("));

function fixture({ withBridge = true, quiesced = false } = {}) {
  const runtime = { renderFrames: 10, simulationTicks: 20 };
  const snapshot = { screen: "battle", running: true, over: false, paused: true, time: 148 };
  let styleText = "color:red";
  class Element {}
  class Canvas extends Element {
    width = 1280;
    height = 720;
    getBoundingClientRect() { return { width: 1280, height: 720 }; }
  }
  const canvas = new Canvas();
  const animation = { playState: "running", pause() { this.playState = "paused"; }, play() { this.playState = "running"; } };
  const root = new Element();
  root.style = { visibility: "visible" };
  root.querySelector = () => canvas;
  root.getAttribute = () => styleText;
  root.setAttribute = (_key, value) => { styleText = value; root.style.visibility = "visible"; };
  root.removeAttribute = () => { styleText = null; root.style.visibility = "visible"; };
  root.getAnimations = () => [animation];
  class Button extends Element {
    disabled = false;
    textContent = "戦闘を再開";
    getAttribute() { return null; }
    click() { snapshot.paused = false; }
  }
  const button = new Button();
  const window = {
    __ASHFALL_RUNTIME_PERFORMANCE__: runtime,
    __ASHFALL_BATTLE_QA__: {
      getSnapshot: () => ({ ...snapshot }),
      getQaPresentationQuiescence: () => ({ active: quiesced }),
      ...(withBridge ? { setQaPresentationQuiesced() { throw Error("production draw must not be suppressed"); } } : {}),
    },
  };
  const document = {
    visibilityState: "visible",
    documentElement: { dataset: {} },
    querySelector: (selector) => selector.includes("canvas") ? canvas : root,
  };
  const context = vm.createContext({
    window, document, URLSearchParams, location: { hostname: "localhost", search: "?qa=endgame&qaHudFiniteAssets=1" },
    performance: { now: () => 123 }, HTMLElement: Element, HTMLCanvasElement: Canvas, HTMLButtonElement: Button,
    getComputedStyle: () => ({ display: "block", visibility: root.style.visibility, opacity: "1" }),
    timeout: 60_000, resumeButtonText: button.textContent, invariant: assert.ok,
  });
  const evaluate = async (fn, arg) => {
    context.arg = arg;
    try { return await vm.runInContext("(" + fn.toString() + ")(arg)", context); }
    finally { delete context.arg; }
  };
  const advance = (frames = 4) => { snapshot.time += 1; runtime.renderFrames += frames; runtime.simulationTicks += frames; };
  const page = {
    isClosed: () => false, evaluate,
    waitForFunction: async (fn, arg, options) => {
      assert.equal(options.timeout, 10_000);
      assert.equal(options.polling, 50);
      assert.equal(await evaluate(fn, arg), false, "restoration must wait for actual new paints");
      advance(3);
      const value = await evaluate(fn, arg);
      assert.ok(value);
      return { jsonValue: async () => value, dispose: async () => {} };
    },
  };
  const owner = vm.runInContext("(" + ownerSource.trim() + ")", context);
  const resumeButton = { elementHandle: async () => button };
  button.dispose = async () => {};
  return { owner, page, resumeButton, advance, root, animation, window, document, snapshot };
}

test("Stage3 candidate and base run the same live render owner and restore three actual frames", async () => {
  for (const withBridge of [false, true]) {
    const f = fixture({ withBridge });
    const result = await f.owner({ page: f.page, label: "final", resumeButton: f.resumeButton, operation: async () => {
      assert.equal(f.snapshot.paused, false);
      assert.equal(f.root.style.visibility, "hidden");
      assert.equal(f.animation.playState, "paused");
      f.advance();
      return { matched: true };
    } });
    assert.equal(result.receipt.arm.mode, "dom-suppression");
    assert.equal(result.receipt.release.releasedAtRenderFrames - result.receipt.arm.enteredAtRenderFrames, 4);
    assert.equal(result.receipt.restored.renderFrames - result.receipt.release.releasedAtRenderFrames, 3);
    assert.equal(f.root.style.visibility, "visible");
    assert.equal(f.animation.playState, "running");
    assert.equal(f.document.documentElement.dataset.p5Stage3FinalPresentationSuppressed, undefined);
  }
});

test("Stage3 preserves the primary predicate failure plus the cleanup receipt", async () => {
  const f = fixture();
  const failure = new Error("original 60s predicate deadline");
  await assert.rejects(f.owner({ page: f.page, label: "final", resumeButton: f.resumeButton, operation: async () => {
    f.advance();
    throw failure;
  } }), (error) => {
    assert.equal(error, failure);
    assert.equal(error.presentationSuppression.arm.mode, "dom-suppression");
    assert.equal(error.presentationSuppression.release.owner, "p5-stage3-final-cut");
    assert.equal(error.presentationSuppression.releaseError, null);
    return true;
  });
  assert.equal(f.root.style.visibility, "visible");
  assert.equal(f.animation.playState, "running");
  assert.equal(f.window.__P5_STAGE3_FINAL_PRESENTATION_STATE__, undefined);
});

test("Stage3 rejects a foreign presentation owner before hiding the real surface", async () => {
  const f = fixture({ quiesced: true });
  await assert.rejects(f.owner({ page: f.page, label: "final", resumeButton: f.resumeButton, operation: async () => {} }),
    /OTHER_PRESENTATION_OWNER_ACTIVE/);
  assert.equal(f.root.style.visibility, "visible");
  assert.equal(f.animation.playState, "running");
});

test("Stage3 retains arm and release even when real-frame restoration expires", async () => {
  const f = fixture();
  f.page.waitForFunction = async () => { throw Error("actual paint restoration deadline"); };
  await assert.rejects(f.owner({ page: f.page, label: "final", resumeButton: f.resumeButton,
    operation: async () => { f.advance(); return true; } }), (error) => {
    assert.match(error.message, /actual paint restoration deadline/);
    assert.equal(error.presentationSuppression.arm.mode, "dom-suppression");
    assert.equal(error.presentationSuppression.release.owner, "p5-stage3-final-cut");
    return true;
  });
  assert.equal(f.root.style.visibility, "visible");
  assert.equal(f.animation.playState, "running");
});
