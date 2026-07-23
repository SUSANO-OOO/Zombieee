import { CONTENT_COLLECTIONS } from "./schema.js";

function normalizeAlias(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("ja-JP").replace(/[\s\u3000]+/gu, "")
    : "";
}

function buildCollectionIndex(records) {
  const byId = Object.create(null);
  const aliasToId = Object.create(null);
  for (const record of records) {
    byId[record.id] = record;
    for (const alias of [record.id, ...(record.aliases ?? [])]) {
      const key = normalizeAlias(alias);
      if (key) aliasToId[key] = record.id;
    }
  }
  return Object.freeze({
    byId: Object.freeze(byId),
    aliasToId: Object.freeze(aliasToId),
  });
}

export function createContentLoader(registry) {
  const indexes = Object.freeze(Object.fromEntries(CONTENT_COLLECTIONS.map((collection) => (
    [collection, buildCollectionIndex(registry[collection] ?? [])]
  ))));

  function assertCollection(collection) {
    if (!CONTENT_COLLECTIONS.includes(collection)) {
      throw new RangeError(`Unknown content collection: ${String(collection)}`);
    }
  }

  function get(collection, idOrAlias) {
    assertCollection(collection);
    const id = indexes[collection].aliasToId[normalizeAlias(idOrAlias)];
    return id ? indexes[collection].byId[id] ?? null : null;
  }

  return Object.freeze({
    list(collection) {
      assertCollection(collection);
      return registry[collection];
    },
    resolveId(collection, idOrAlias) {
      assertCollection(collection);
      return indexes[collection].aliasToId[normalizeAlias(idOrAlias)] ?? null;
    },
    get,
    require(collection, idOrAlias) {
      const record = get(collection, idOrAlias);
      if (!record) throw new RangeError(`Unknown ${collection} content: ${String(idOrAlias)}`);
      return record;
    },
    has(collection, idOrAlias) {
      return get(collection, idOrAlias) !== null;
    },
  });
}
