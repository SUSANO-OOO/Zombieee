import { CONTENT_SCHEMA_VERSION } from "./schema.js";
import { deepFreeze } from "./freeze.js";

export const CONTENT_MIGRATION_VERSION = 1;

function normalizeAliases(record) {
  return [...new Set((record.aliases ?? [])
    .filter((alias) => typeof alias === "string" && alias.trim())
    .map((alias) => alias.trim()))].sort((left, right) => left.localeCompare(right, "ja"));
}

export function migrateContentRecord(rawRecord, { collection, fromVersion = 0 } = {}) {
  if (!rawRecord || typeof rawRecord !== "object" || Array.isArray(rawRecord)) {
    throw new TypeError(`Invalid ${String(collection)} content record`);
  }
  if (fromVersion > CONTENT_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported future content schema: ${fromVersion}`);
  }
  const id = String(rawRecord.id ?? rawRecord.kind ?? "").trim();
  if (!id) throw new RangeError(`Content record is missing a stable id in ${String(collection)}`);
  const displayName = String(rawRecord.displayName ?? rawRecord.name ?? id).trim();
  return deepFreeze({
    ...rawRecord,
    id,
    displayName,
    aliases: normalizeAliases(rawRecord),
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
  });
}

export function migrateContentCollection(records, options) {
  if (!Array.isArray(records)) throw new TypeError("Content collection must be an array");
  return deepFreeze(records.map((record) => migrateContentRecord(record, options)));
}
