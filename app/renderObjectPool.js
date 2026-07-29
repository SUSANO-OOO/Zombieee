export function createRenderObjectPool(capacity) {
  return {
    capacity: Math.max(0, Math.floor(Number(capacity) || 0)),
    available: [],
    stats: {
      created: 0,
      reused: 0,
      released: 0,
      discarded: 0,
    },
  };
}

export function acquireRenderObject(pool, stableKeys) {
  const reused = pool.available.length > 0;
  const object = reused ? pool.available.pop() : {};
  if (reused) pool.stats.reused += 1;
  else pool.stats.created += 1;
  for (const key of stableKeys) object[key] = undefined;
  return object;
}

export function releaseRenderObject(pool, object) {
  if (!object || typeof object !== "object") return;
  if (pool.available.length >= pool.capacity) {
    pool.stats.discarded += 1;
    return;
  }
  pool.available.push(object);
  pool.stats.released += 1;
}

export function compactActiveRenderObjects(items, pool, isActive) {
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < items.length; readIndex += 1) {
    const object = items[readIndex];
    if (isActive(object)) {
      items[writeIndex] = object;
      writeIndex += 1;
    } else {
      releaseRenderObject(pool, object);
    }
  }
  items.length = writeIndex;
  return items;
}

export function capRenderObjectsInPlace(items, pool, limit) {
  const boundedLimit = Math.max(0, Math.floor(Number(limit) || 0));
  const overflow = Math.max(0, items.length - boundedLimit);
  if (overflow === 0) return items;
  for (let index = 0; index < overflow; index += 1) {
    releaseRenderObject(pool, items[index]);
  }
  items.copyWithin(0, overflow);
  items.length -= overflow;
  return items;
}

export function clearRenderObjects(items, pool) {
  for (const object of items) releaseRenderObject(pool, object);
  items.length = 0;
  return items;
}

export function renderObjectPoolSnapshot(pool) {
  return {
    capacity: pool.capacity,
    available: pool.available.length,
    created: pool.stats.created,
    reused: pool.stats.reused,
    released: pool.stats.released,
    discarded: pool.stats.discarded,
  };
}
