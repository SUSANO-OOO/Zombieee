import assert from "node:assert/strict";
import test from "node:test";

import {
  clearViewportSafeAreaInlineOverride,
  resolveViewportSafeArea,
} from "../app/viewportSafeArea.js";
import { mobileBattleHudLayout } from "../app/battleHudLayout.js";

function fixture(computedInsets = {}) {
  const values = new Map();
  const dataset = {};
  const root = {
    dataset,
    style: {
      setProperty: (name, value) => values.set(name, value),
      removeProperty: (name) => values.delete(name),
      getPropertyValue: (name) => values.get(name) ?? "",
    },
    appendChild: () => {},
  };
  let removed = false;
  const probe = {
    style: {},
    setAttribute: () => {},
    remove: () => { removed = true; },
  };
  const document = {
    body: { appendChild: () => {} },
    createElement: () => probe,
  };
  return {
    root,
    document,
    values,
    probe,
    removed: () => removed,
    getComputedStyle: () => ({
      paddingTop: `${computedInsets.top ?? 0}px`,
      paddingRight: `${computedInsets.right ?? 0}px`,
      paddingBottom: `${computedInsets.bottom ?? 0}px`,
      paddingLeft: `${computedInsets.left ?? 0}px`,
    }),
  };
}

test("production safe area remains CSS-env-owned while JS receives resolved pixels", () => {
  const dom = fixture({ top: 0, right: 47, bottom: 23, left: 47 });
  for (const edge of ["top", "right", "bottom", "left"]) {
    dom.values.set(`--app-viewport-safe-${edge}`, "0px");
  }
  const safeArea = resolveViewportSafeArea({ ...dom, qaSafeArea: null });
  assert.deepEqual(safeArea, { top: 0, right: 47, bottom: 23, left: 47 });
  assert.equal(dom.values.size, 0, "production must not leave a 0px inline override");
  assert.equal(dom.removed(), true);
  assert.equal(dom.probe.style.paddingRight, "env(safe-area-inset-right, 0px)");

  const layout = mobileBattleHudLayout({
    width: 844,
    height: 390,
    safeAreaTop: safeArea.top,
    safeAreaRight: safeArea.right,
    safeAreaBottom: safeArea.bottom,
    safeAreaLeft: safeArea.left,
  });
  assert.deepEqual(layout.content, { x: 47, y: 0, width: 750, height: 367 });
});

test("the localhost iPhone preset is the only inline override and preserves 0/44/21/44", () => {
  const dom = fixture({ top: 9, right: 9, bottom: 9, left: 9 });
  const safeArea = resolveViewportSafeArea({
    ...dom,
    qaSafeArea: { top: 0, right: 44, bottom: 21, left: 44 },
  });
  assert.deepEqual(safeArea, { top: 0, right: 44, bottom: 21, left: 44 });
  assert.deepEqual(Object.fromEntries(dom.values), {
    "--app-viewport-safe-top": "0px",
    "--app-viewport-safe-right": "44px",
    "--app-viewport-safe-bottom": "21px",
    "--app-viewport-safe-left": "44px",
  });
  assert.equal(dom.root.dataset.safeAreaSource, "local-qa-iphone-landscape");

  clearViewportSafeAreaInlineOverride(dom.root);
  assert.equal(dom.values.size, 0);
  assert.equal("safeAreaSource" in dom.root.dataset, false);
});
