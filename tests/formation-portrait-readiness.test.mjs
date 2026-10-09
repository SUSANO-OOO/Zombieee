import assert from "node:assert/strict";
import test from "node:test";
import { inspectFormationPortraits } from "../scripts/formation-portrait-readiness.mjs";

function fixture({ loaded = "true", visibility = "visible", parentOpacity = "1", outside = false } = {}) {
  const bounds = { left: outside ? 900 : 10, top: 10, right: outside ? 960 : 70, bottom: 80 };
  const parent = { parentElement: null, getBoundingClientRect: () => bounds, style: { display: "block", visibility: "visible", opacity: parentOpacity, overflowX: "hidden", overflowY: "hidden" } };
  const image = { complete: true, naturalWidth: 500, naturalHeight: 800, dataset: loaded ? { loaded } : {}, parentElement: parent,
    getBoundingClientRect: () => bounds, getAttribute: () => "/art/portrait.webp", style: { display: "block", visibility, opacity: "1" } };
  const card = { querySelectorAll: () => [image] };
  globalThis.document = { querySelectorAll: () => [card] };
  globalThis.getComputedStyle = element => element.style;
  globalThis.innerWidth = 844; globalThis.innerHeight = 340;
  return image;
}

test("complete media is not accepted while decode/frame presentation is pending", () => {
  fixture({ loaded: null, visibility: "hidden" });
  assert.equal(inspectFormationPortraits("wait"), false);
  const state = inspectFormationPortraits();
  assert.equal(state.images[0].complete, true);
  assert.equal(state.images[0].naturalWidth, 500);
  assert.equal(state.images[0].loaded, null);
  assert.equal(state.images[0].visibility, "hidden");
});
test("the same loaded image becomes acceptable only after visible presentation", () => {
  const image = fixture({ loaded: null, visibility: "hidden" });
  assert.equal(inspectFormationPortraits("wait"), false);
  image.dataset.loaded = "true"; image.style.visibility = "visible";
  assert.equal(inspectFormationPortraits("wait"), true);
  const state = inspectFormationPortraits();
  assert.equal(state.images[0].drawnWidth, 60); assert.equal(state.images[0].drawnHeight, 70);
});
test("a decoded image hidden by its parent or outside the viewport is rejected", () => {
  fixture({ parentOpacity: "0" }); assert.equal(inspectFormationPortraits("wait"), false);
  fixture({ outside: true }); assert.equal(inspectFormationPortraits("wait"), false);
});
test("an empty portrait slot needs no image while failed image decoding is rejected", () => {
  const image = fixture(); image.naturalWidth = 0;
  assert.equal(inspectFormationPortraits("wait"), false);
  globalThis.document.querySelectorAll = () => [];
  assert.deepEqual(inspectFormationPortraits(), { ready: true, filledSlots: 0, malformed: [], images: [] });
});
test("a filled slot with a missing or duplicate portrait cannot pass as an empty slot", () => {
  const image = fixture();
  const card = { querySelectorAll: () => [] };
  globalThis.document.querySelectorAll = () => [card];
  assert.equal(inspectFormationPortraits("wait"), false);
  assert.deepEqual(inspectFormationPortraits().malformed, [{ slot: 1, imageCount: 0 }]);
  card.querySelectorAll = () => [image, image];
  assert.equal(inspectFormationPortraits("wait"), false);
  assert.deepEqual(inspectFormationPortraits().malformed, [{ slot: 1, imageCount: 2 }]);
});
