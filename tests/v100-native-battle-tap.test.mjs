import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { nativeBattleTap, readNativeBattleControl } from "../scripts/v100-normal-tactical-input.mjs";

function fixture({ unitCard = false, covered = false, disabledAfterScroll = false } = {}) {
  const calls = [], phases = [];
  const element = {
    disabled: false,
    getAttribute: () => null,
    matches: () => unitCard,
    getBoundingClientRect: () => ({ x: 10, y: 20, width: 60, height: 30 }),
  };
  const document = { elementFromPoint: () => ({ closest: () => covered ? {} : element }) };
  const locator = {
    evaluateAll: async callback => {
      calls.push("observe");
      return vm.runInNewContext(`(${callback.toString()})(elements)`, { document, elements: [element] });
    },
    scrollIntoViewIfNeeded: async ({ timeout }) => {
      calls.push(["scroll", timeout]);
      if (disabledAfterScroll) element.disabled = true;
    },
  };
  const page = { mouse: Object.fromEntries(["move", "down", "up"].map(name => [name, async (...args) => { calls.push([name, ...args]); }])) };
  return { calls, phases, element, locator, page };
}

test("live ability eligibility and hit owner use one read before native move/down/up", async () => {
  const f = fixture();
  assert.equal(await nativeBattleTap(f.page, f.locator, f.phases), true);
  assert.deepEqual(f.calls, ["observe", ["move", 40, 35], ["down"], ["up"]]);
  assert.deepEqual(f.phases.map(phase => phase.name), ["observe-control", "move", "down", "up"]);
  assert.ok(f.phases.every(phase => phase.status === "completed" && phase.endedAt >= phase.startedAt));
});

test("covered, absent, ambiguous and disabled controls cannot receive a pointer", async () => {
  const f = fixture({ covered: true });
  assert.equal(await nativeBattleTap(f.page, f.locator), false);
  assert.deepEqual(f.calls, ["observe"]);
  assert.equal(readNativeBattleControl([]), null);
  assert.equal(readNativeBattleControl([{}, {}]), null);
  assert.equal(readNativeBattleControl([{ disabled: true }]), null);
  assert.equal(readNativeBattleControl([{ disabled: false, getAttribute: () => "true" }]), null);
});

test("unit cards retain the 750 ms scroll and refresh current eligibility afterward", async () => {
  const f = fixture({ unitCard: true, disabledAfterScroll: true });
  assert.equal(await nativeBattleTap(f.page, f.locator, f.phases), false);
  assert.deepEqual(f.calls, ["observe", ["scroll", 750], "observe"]);
  assert.deepEqual(f.phases.map(phase => phase.name), ["observe-control", "scroll-control", "refresh-control"]);
});

test("failed native move is recorded and never sends a later down or up", async () => {
  const f = fixture();
  f.page.mouse.move = async () => { throw new Error("native move rejected"); };
  await assert.rejects(nativeBattleTap(f.page, f.locator, f.phases), /native move rejected/);
  assert.deepEqual(f.calls, ["observe"]);
  assert.equal(f.phases.at(-1).name, "move");
  assert.equal(f.phases.at(-1).status, "error");
  assert.match(f.phases.at(-1).error, /native move rejected/);
});
