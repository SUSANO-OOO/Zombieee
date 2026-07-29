import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  acquireRenderObject,
  capRenderObjectsInPlace,
  clearRenderObjects,
  compactActiveRenderObjects,
  createRenderObjectPool,
  renderObjectPoolSnapshot,
} from "../app/renderObjectPool.js";

test("render objects are returned and reused by identity without replacing the active array", () => {
  const pool = createRenderObjectPool(3);
  const first = acquireRenderObject(pool, ["life", "optional"]);
  first.life = 1;
  first.optional = "old";
  const second = acquireRenderObject(pool, ["life", "optional"]);
  second.life = 0;
  const items = [first, second];
  const originalArray = items;
  const releasedObject = items[1];

  assert.equal(compactActiveRenderObjects(items, pool, (item) => item.life > 0), originalArray);
  assert.equal(items.length, 1);
  const reused = acquireRenderObject(pool, ["life", "optional"]);
  reused.life = 2;
  assert.equal(reused, releasedObject);
  assert.equal(reused.optional, undefined);
  assert.deepEqual(renderObjectPoolSnapshot(pool), {
    capacity: 3,
    available: 0,
    created: 2,
    reused: 1,
    released: 1,
    discarded: 0,
  });
});

test("in-place caps retain newest objects and bound the available pool", () => {
  const pool = createRenderObjectPool(2);
  const items = [0, 1, 2, 3].map((id) => {
    const object = acquireRenderObject(pool, ["id"]);
    object.id = id;
    return object;
  });
  const originalArray = items;
  assert.equal(capRenderObjectsInPlace(items, pool, 2), originalArray);
  assert.deepEqual(items.map(({ id }) => id), [2, 3]);
  assert.equal(renderObjectPoolSnapshot(pool).available, 2);

  clearRenderObjects(items, pool);
  assert.equal(items.length, 0);
  const snapshot = renderObjectPoolSnapshot(pool);
  assert.equal(snapshot.available, 2);
  assert.equal(snapshot.discarded, 2);
});

test("hot render-generation paths populate pooled objects without payload object literals", () => {
  const source = fs.readFileSync(
    new URL("../app/AshfallGame.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /add(?:DamageText|Shot)\(\s*g,\s*\{/);
  assert.doesNotMatch(
    source,
    /acquireRenderObject\(\s*g\.renderObjectPools\.[^,]+,\s*\{/,
  );
  assert.match(source, /particle\.x = x;/);
  assert.match(source, /text\.value = value;/);
  assert.match(source, /shot\.damageTargetId = damageTargetId;/);
});
