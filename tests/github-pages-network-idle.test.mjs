import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { settlePublicMapNetwork } from "../scripts/github-pages-network-idle.mjs";

function simulation(events = [], pending = new Set()) {
  let now = 0, cursor = 0;
  const network = { pending, lastActivity: 0 };
  const page = { waitForTimeout: async milliseconds => {
    const until = now + milliseconds;
    while (cursor < events.length && events[cursor].at <= until) {
      const event = events[cursor++]; network.lastActivity = event.at;
      if (event.action === "request") network.pending.add(event.request);
      else network.pending.delete(event.request);
    }
    now = until;
  } };
  const result = vm.runInNewContext(`(${settlePublicMapNetwork.toString()})(page, network)`, { page, network, Date: { now: () => now } });
  return { result, clock: () => now, network };
}

test("a request that starts and finishes between polls resets the quiet interval", async () => {
  const request = { url: () => "portrait.webp" };
  const { result, clock } = simulation([{ at: 475, action: "request", request }, { at: 490, action: "finished", request }]);
  const audit = await result;
  assert.ok(clock() >= 990);
  assert.ok(audit.quietMilliseconds >= 500);
  assert.equal(audit.lastActivity, 490);
});

test("failed requests reset the quiet interval and remain available to diagnostics", async () => {
  const request = { url: () => "failed.webp" };
  const { result, clock } = simulation([{ at: 400, action: "request", request }, { at: 700, action: "failed", request }]);
  const audit = await result;
  assert.equal(clock(), 1200);
  assert.equal(audit.lastActivity, 700);
  assert.equal(request.url(), "failed.webp");
});

test("a permanently pending request fails at the original fixed 30-second deadline", async () => {
  const request = { url: () => "blocked.webp" };
  const { result, clock } = simulation([], new Set([request]));
  await assert.rejects(result, /did not settle.*blocked\.webp/u);
  assert.equal(clock(), 30000);
});
