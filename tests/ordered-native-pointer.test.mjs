import assert from "node:assert/strict";
import test from "node:test";
import { orderedNativePointer } from "../scripts/ordered-native-pointer.mjs";

test("native pointer waits for each protocol acknowledgement with one down/up", async () => {
  const calls = [], phases = [], acknowledgements = [];
  const mouse = Object.fromEntries(["move", "down", "up"].map(name => [name, (...args) => {
    calls.push({ name, args });
    return new Promise(resolve => acknowledgements.push(resolve));
  }]));
  const result = orderedNativePointer({ mouse }, { x: 698.64, y: 628.2 }, phases);
  for (let index = 0; index < 3; index++) {
    assert.equal(calls.length, index + 1);
    assert.equal(phases[index].status, "pending");
    acknowledgements[index]();
    await Promise.resolve();
  }
  await result;
  assert.deepEqual(calls, [{ name: "move", args: [698.64, 628.2] }, { name: "down", args: [] }, { name: "up", args: [] }]);
  assert.ok(phases.every(phase => phase.status === "completed"));
});

test("a failed protocol operation stops the transaction without a duplicate click", async () => {
  const calls = [], phases = [];
  await assert.rejects(orderedNativePointer({ mouse: {
    move: async () => { calls.push("move"); },
    down: async () => { calls.push("down"); throw new Error("protocol disconnected"); },
    up: async () => { calls.push("up"); },
  } }, { x: 1, y: 2 }, phases), /protocol disconnected/);
  assert.deepEqual(calls, ["move", "down"]);
  assert.equal(phases[1].status, "error");
});
