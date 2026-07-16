import assert from "node:assert/strict";
import test from "node:test";

import { claimDefeatResolution } from "../app/defeatLedger.js";

test("one enemy id can grant kill, scrap, and support only once", () => {
  const resolved = new Set();
  const rewards = { kills: 0, scrap: 0, support: 0 };
  const award = (id) => {
    if (!claimDefeatResolution(resolved, id)) return;
    rewards.kills += 1;
    rewards.scrap += 12;
    rewards.support += 5;
  };

  award(41);
  award(41);
  assert.deepEqual(rewards, { kills: 1, scrap: 12, support: 5 });
});

test("a turned survivor receives a new id and its later defeat resolves once", () => {
  const resolved = new Set();
  assert.equal(claimDefeatResolution(resolved, 8), true);
  assert.equal(claimDefeatResolution(resolved, 8), false);
  assert.equal(claimDefeatResolution(resolved, 19), true);
  assert.equal(claimDefeatResolution(resolved, 19), false);
  assert.deepEqual([...resolved], [8, 19]);
});
