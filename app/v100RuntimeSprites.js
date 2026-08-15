import { V100_SPRITE_MANIFEST, v100SpriteFrameFor } from "./spriteManifest.js";
import { V100_RUNTIME_ASSET_MANIFEST } from "./v100RuntimeAssetManifest.js";

const BOSS_STATES = Object.freeze(["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"]);
const ROLE_STATES = Object.freeze(["idle", "move", "attack", "hit", "death"]);
const DIRECTIONS = Object.freeze(["right", "left"]);
const BOSS_COLUMNS = 8;
const ROLE_COLUMNS = 5;
const PAISEN_CELL_WIDTH = 384;
const CUSTOM_CELL_WIDTH = 1280;
const CELL_HEIGHT = 512;

const RUNTIME_SPRITES = Object.freeze({
  paisen: Object.freeze({ states: V100_SPRITE_MANIFEST.paisen.states, path: V100_SPRITE_MANIFEST.paisen.path, kind: "paisen" }),
  "boss-mugarian-president-mutated": Object.freeze({ states: BOSS_STATES, path: V100_RUNTIME_ASSET_MANIFEST.bosses["boss-mugarian-president-mutated"], kind: "boss", columns: BOSS_COLUMNS, cellWidth: CUSTOM_CELL_WIDTH }),
  "boss-takuya-omega": Object.freeze({ states: BOSS_STATES, path: V100_RUNTIME_ASSET_MANIFEST.bosses["boss-takuya-omega"], kind: "boss", columns: BOSS_COLUMNS, cellWidth: CUSTOM_CELL_WIDTH }),
  "red-panther-knife": Object.freeze({ states: ROLE_STATES, path: V100_RUNTIME_ASSET_MANIFEST.redPanther.knife, kind: "role", columns: ROLE_COLUMNS, cellWidth: CUSTOM_CELL_WIDTH }),
  "red-panther-shield": Object.freeze({ states: ROLE_STATES, path: V100_RUNTIME_ASSET_MANIFEST.redPanther.shield, kind: "role", columns: ROLE_COLUMNS, cellWidth: CUSTOM_CELL_WIDTH }),
  "red-panther-smg": Object.freeze({ states: ROLE_STATES, path: V100_RUNTIME_ASSET_MANIFEST.redPanther.smg, kind: "role", columns: ROLE_COLUMNS, cellWidth: CUSTOM_CELL_WIDTH }),
  "red-panther-commander": Object.freeze({ states: ROLE_STATES, path: V100_RUNTIME_ASSET_MANIFEST.redPanther.commander, kind: "role", columns: ROLE_COLUMNS, cellWidth: CUSTOM_CELL_WIDTH }),
});

function validateDirection(direction) {
  if (!DIRECTIONS.includes(direction)) throw new RangeError(`Unknown V1.0.0 runtime sprite direction: ${String(direction)}`);
}

function validateDefinition(definition, kind, state) {
  if (!definition) throw new RangeError(`Unknown V1.0.0 runtime sprite kind: ${String(kind)}`);
  if (!definition.states.includes(state)) throw new RangeError(`Unknown V1.0.0 runtime sprite state: ${String(state)}`);
}

function atlasFrame(definition, state, direction) {
  const stateIndex = definition.states.indexOf(state);
  const directionIndex = direction === "right" ? 0 : 1;
  const cellWidth = definition.cellWidth ?? PAISEN_CELL_WIDTH;
  const x = stateIndex * cellWidth;
  const y = directionIndex * CELL_HEIGHT;
  return Object.freeze({
    kind: definition.kind,
    state,
    direction,
    path: definition.path,
    sheetWidth: cellWidth * definition.columns,
    sheetHeight: CELL_HEIGHT * 2,
    sourceRect: Object.freeze({ x, y, w: cellWidth, h: CELL_HEIGHT }),
    authoredCell: Object.freeze({ w: cellWidth, h: CELL_HEIGHT }),
    visible: Object.freeze({ x: 0, y: 0, w: cellWidth, h: CELL_HEIGHT }),
  });
}

export const V100_RUNTIME_SPRITE_KINDS = Object.freeze(Object.keys(RUNTIME_SPRITES));

export function v100RuntimeSpriteFrameFor(kind, state, direction = "right") {
  validateDirection(direction);
  if (kind === "paisen") return v100SpriteFrameFor(kind, state, direction);
  const definition = RUNTIME_SPRITES[kind];
  validateDefinition(definition, kind, state);
  return atlasFrame(definition, state, direction);
}

export function v100RuntimeSpriteStatesFor(kind) {
  const definition = RUNTIME_SPRITES[kind];
  if (!definition) throw new RangeError(`Unknown V1.0.0 runtime sprite kind: ${String(kind)}`);
  return definition.states;
}

export function v100RuntimeSpriteDefinitionFor(kind) {
  const definition = RUNTIME_SPRITES[kind];
  if (!definition) throw new RangeError(`Unknown V1.0.0 runtime sprite kind: ${String(kind)}`);
  return definition;
}
