import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { V100_STORY_EVENTS, V100_STORY_SCRIPT_VERSION } from "../app/v100StoryEvents.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { v100StoryPageFor } from "../app/v100StoryPages.js";
import { v100DialogueSlots } from "../app/v100DialogueComposition.js";
import { readV177StoryPortraitPaint } from "../scripts/v177-story-portrait-paint.mjs";

const source = await readFile("scripts/v100-phase-g-production-matrix.mjs", "utf8");
const parsed = ts.createSourceFile("matrix.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const targets = parsed.statements.find(node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(entry => entry.name.getText(parsed) === "dialogueEvidenceTargets"));
const functions = ["eventSave", "storyPage"].map(name => parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name));
assert.ok(targets && functions.every(Boolean), "exercise the matrix's actual target selection and callers");

function harness({ wrong = null, images = "ready", events = V100_STORY_EVENTS } = {}) {
  let displayed, seeded, imageChecks = 0;
  const waits = [];
  const page = { locator(selector) { return { async waitFor(options) {
    waits.push({ selector, ...options });
    assert.equal(options.state, "visible");
    assert.equal(options.timeout, 60_000);
    if (!displayed?.has(selector)) throw new Error(`unmatched-visible-selector: ${selector}`);
  } }; }, async waitForFunction(predicate, argument, options) {
    imageChecks++;
    if (argument !== null) assert.equal(argument, `[data-v100-event-id="${seeded.eventId}"]`);
    assert.equal(options.timeout, 60_000);
    class HTMLImageElement {
      complete = images !== "incomplete";
      naturalWidth = images === "broken" ? 0 : 320;
      naturalHeight = images === "broken" ? 0 : 480;
      currentSrc = "/portrait.webp";
      getBoundingClientRect() { return { width: 320, height: 480 }; }
      getAnimations() { return images === "transition" ? [{ animationName: "arriving", pending: true, playState: "running" }] : []; }
    }
    const list = images === "missing" ? [] : [new HTMLImageElement(), new HTMLImageElement()];
    const ready = vm.runInNewContext(`(${predicate.toString()})(argument)`, {
      HTMLImageElement, argument,
      getComputedStyle: () => ({ opacity: images === "transparent" ? "0" : "1", visibility: images === "hidden" ? "hidden" : "visible", display: "block" }),
      document: { querySelectorAll(selector) {
        assert.equal(selector, ".v100-story-node .v100-portrait");
        return list;
      }, querySelector(selector) {
        assert.equal(selector, `[data-v100-event-id="${seeded.eventId}"]`);
        return { isConnected: true, querySelectorAll: kind => kind === ".v100-portrait" ? list : [] };
      } },
    });
    if (!ready) throw new Error("unready-portrait");
  } };
  const api = vm.runInNewContext([targets, ...functions].map(node => node.getText(parsed)).join("\n")
    + "\n({ targets: dialogueEvidenceTargets, storyPage })", {
    V100_STORY_EVENTS: events, V100_STORY_SCRIPT_VERSION, V100_STAGE_IDS,
    v100StoryPageFor, v100DialogueSlots, readV177StoryPortraitPaint, timeout: 60_000,
    fullSave: overrides => overrides,
    openRoute: async (_page, save) => {
      seeded = save.flowState;
      const event = events[seeded.eventId];
      const rendered = v100StoryPageFor(event.id, event.nodes, seeded.nodeIndex);
      const slots = v100DialogueSlots(event.nodes, rendered.nodeIndex);
      const side = slots.right?.portraitOwner === rendered.node.portraitOwner ? "right" : "left";
      const index = wrong === "index" ? rendered.nodeIndex + 1 : rendered.nodeIndex;
      const visibleSide = wrong === "side" ? side === "left" ? "right" : "left" : side;
      displayed = new Set([
        `[data-v100-event-id="${event.id}"][data-v100-node-index="${index}"]`,
        `[data-v100-state="dialogue-${visibleSide}"]`,
      ]);
    },
  });
  return { ...api, page, waits, seeded: () => seeded, imageChecks: () => imageChecks };
}

test("the old left fixture waits for node 1 although the game displays merged node 2 on the right", () => {
  const event = V100_STORY_EVENTS["v100:event:prologue"];
  const page = v100StoryPageFor(event.id, event.nodes, 1);
  assert.equal(page.nodeIndex, 2);
  assert.equal(event.nodes[1].portraitOwner, "unit-kumaverson");
  assert.equal(page.node.portraitOwner, "unit-paisen");
  assert.equal(v100DialogueSlots(event.nodes, page.nodeIndex).right.portraitOwner, page.node.portraitOwner);
});

for (const side of ["left", "right"]) {
  test(`the actual matrix opens a canonical ${side} page and waits for its rendered node`, async () => {
    const h = harness();
    await h.storyPage(h.page, `dialogue-${side}`);
    const target = h.targets[side];
    assert.equal(h.seeded().nodeIndex, target.startIndex);
    const event = V100_STORY_EVENTS[target.eventId];
    const page = v100StoryPageFor(event.id, event.nodes, target.startIndex);
    assert.equal(target.nodeIndex, page.nodeIndex);
    assert.equal(target.portraitOwner, page.node.portraitOwner);
    assert.equal(v100DialogueSlots(event.nodes, page.nodeIndex)[side].portraitOwner, target.portraitOwner);
    let cursor = 0;
    while (cursor < target.startIndex) cursor = v100StoryPageFor(event.id, event.nodes, cursor).endIndex + 1;
    assert.equal(cursor, target.startIndex, "the fixture starts on a page reachable by ordinary Next inputs");
    assert.equal(h.waits.length, 2);
    assert.equal(h.imageChecks(), 2);
  });
  for (const wrong of ["index", "side"]) {
    test(`a visible conversation with the wrong ${wrong} cannot satisfy the ${side} capture`, async () => {
      const h = harness({ wrong });
      await assert.rejects(h.storyPage(h.page, `dialogue-${side}`), /unmatched-visible-selector/);
    });
  }
}

for (const images of ["missing", "incomplete", "broken", "transparent", "hidden", "transition"]) {
  test(`a matching dialogue page with ${images} portraits is rejected`, async () => {
    const h = harness({ images });
    await assert.rejects(h.storyPage(h.page, "dialogue-right"), /unready-portrait/);
  });
}

test("missing canonical dialogue evidence fails instead of choosing an unrelated visible screen", () => {
  assert.throws(() => harness({ events: {} }), /No canonical left dialogue evidence target exists/);
});
