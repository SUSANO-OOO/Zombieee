import { V075_VISUAL_PROFILES, V080_UNIT_VISUAL_PROFILES } from "./visualProfiles.js";

/**
 * Audited sprite source geometry for the 0.6.0 renderer and localhost QA.
 *
 * Legacy producer sheets are read-only six-cell inputs.  Production rendering
 * uses deterministic derived atlases that isolate every authored cell behind a
 * 16px transparent gutter, preventing adjacent-frame interpolation bleed.  The
 * Approved 0.6.0 newcomers and 0.7.0 replacements use purpose-built
 * seven-column/two-direction atlases.
 */

export const SPRITE_STATES = Object.freeze([
  "idle",
  "walk-a",
  "walk-b",
  "attack-a",
  "attack-b",
  "hit",
  "death",
]);

export const SPRITE_DIRECTIONS = Object.freeze(["left", "right"]);

const STATE_FRAME_INDEX = Object.freeze({
  idle: 0,
  "walk-a": 1,
  "walk-b": 2,
  "attack-a": 3,
  "attack-b": 4,
  hit: 5,
  death: 5,
});

const STANDARD_LEGACY_CELL_EDGES = Object.freeze([0, 362, 724, 1086, 1448, 1810, 2172]);
const GUNNER_LEGACY_CELL_EDGES = Object.freeze([0, 361, 723, 1085, 1446, 1808, 2170]);

// Each measured tuple is [left, top, right, bottom] inside its authored cell.
// These values come from the decoded PNG alpha channel, not visual estimates.
const LEGACY_SHEET_AUDIT = Object.freeze({
  brawler: {
    path: "/brawler-sprites-v1.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[49, 93, 316, 586], [48, 97, 331, 587], [28, 97, 340, 587], [19, 110, 362, 589], [0, 117, 362, 589], [0, 118, 304, 589]],
  },
  scout: {
    path: "/scout-sprites-v2.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[84, 129, 315, 609], [40, 131, 307, 609], [1, 136, 362, 609], [0, 150, 362, 609], [0, 203, 317, 609], [8, 168, 296, 609]],
  },
  ranger: {
    path: "/ranger-sprites-v1.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[67, 94, 319, 600], [24, 95, 362, 600], [0, 102, 308, 600], [22, 113, 331, 600], [0, 116, 362, 600], [0, 114, 341, 600]],
  },
  brute: {
    path: "/breaker-sprites-v2.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[61, 123, 348, 589], [53, 125, 349, 589], [34, 127, 353, 589], [38, 27, 362, 589], [0, 242, 362, 590], [0, 166, 360, 589]],
  },
  gunner: {
    path: "/gunner-sprites-v1.png", width: 2170, height: 725,
    edges: GUNNER_LEGACY_CELL_EDGES,
    visible: [[86, 106, 318, 587], [41, 107, 318, 591], [11, 119, 311, 590], [25, 116, 338, 587], [18, 115, 362, 585], [0, 120, 350, 587]],
  },
  medic: {
    path: "/medic-sprites-v1.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[81, 100, 323, 585], [43, 106, 332, 587], [22, 114, 329, 587], [48, 117, 348, 587], [22, 116, 362, 587], [0, 119, 346, 587]],
  },
  infected: {
    path: "/infected-sprites-v1.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[68, 127, 318, 590], [56, 131, 324, 590], [45, 130, 362, 590], [0, 151, 362, 590], [0, 194, 362, 589], [0, 135, 323, 590]],
  },
  spitter: {
    path: "/spitter-sprites-v1.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[97, 127, 312, 577], [43, 140, 316, 576], [58, 138, 307, 577], [84, 117, 362, 578], [0, 163, 343, 580], [20, 96, 313, 580]],
  },
  shade: {
    path: "/shade-raider-sprites-v1.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[49, 119, 309, 573], [2, 152, 362, 571], [0, 158, 362, 560], [0, 148, 359, 571], [3, 275, 332, 569], [37, 174, 314, 573]],
  },
  crusher: {
    path: "/crusher-sprites-v1.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[74, 139, 362, 585], [0, 150, 362, 585], [0, 157, 359, 587], [12, 100, 362, 590], [0, 216, 362, 595], [0, 179, 329, 589]],
  },
  takuya: {
    path: "/takuya-boss-sprites-v2.png", width: 2172, height: 724,
    edges: STANDARD_LEGACY_CELL_EDGES,
    visible: [[43, 126, 362, 588], [0, 137, 362, 593], [0, 137, 362, 591], [0, 45, 362, 590], [0, 31, 358, 601], [35, 175, 330, 592]],
  },
});

const LEGACY_PADDED_CELL = Object.freeze({
  width: 394,
  height: 757,
  innerWidth: 362,
  innerHeight: 725,
  gutter: 16,
});

const NEWCOMER_VISIBLE = Object.freeze({
  scout: {
    right: [[107, 16, 373, 432], [98, 16, 382, 432], [116, 16, 364, 432], [132, 16, 348, 432], [24, 16, 455, 432], [96, 16, 383, 432], [80, 285, 399, 432]],
    left: [[107, 16, 373, 432], [98, 16, 382, 432], [116, 16, 364, 432], [132, 16, 348, 432], [24, 16, 455, 432], [96, 16, 383, 432], [80, 285, 399, 432]],
  },
  ranger: {
    right: [[136, 16, 344, 432], [115, 16, 364, 432], [121, 16, 359, 432], [105, 16, 375, 432], [117, 27, 362, 432], [111, 50, 368, 432], [86, 303, 393, 432]],
    left: [[136, 16, 344, 432], [115, 16, 364, 432], [121, 16, 359, 432], [105, 16, 375, 432], [117, 27, 362, 432], [111, 50, 368, 432], [86, 303, 393, 432]],
  },
  medic: {
    right: [[148, 16, 332, 432], [133, 16, 347, 432], [139, 16, 341, 432], [127, 16, 353, 432], [126, 16, 354, 432], [120, 43, 359, 432], [95, 320, 385, 432]],
    left: [[148, 16, 332, 432], [133, 16, 347, 432], [139, 16, 341, 432], [127, 16, 353, 432], [126, 16, 354, 432], [120, 43, 359, 432], [95, 320, 385, 432]],
  },
  brute: {
    right: [[101, 16, 378, 432], [113, 16, 366, 432], [124, 16, 356, 432], [144, 16, 335, 432], [16, 86, 464, 432], [89, 16, 390, 432], [74, 273, 405, 432]],
    left: [[101, 16, 378, 432], [113, 16, 366, 432], [124, 16, 356, 432], [144, 16, 335, 432], [16, 86, 464, 432], [89, 16, 390, 432], [74, 273, 405, 432]],
  },
  gunner: {
    right: [[122, 59, 358, 432], [131, 79, 349, 432], [119, 83, 360, 432], [117, 94, 362, 432], [97, 94, 383, 432], [111, 100, 369, 432], [81, 312, 399, 432]],
    left: [[122, 59, 358, 432], [131, 79, 349, 432], [119, 83, 360, 432], [117, 94, 362, 432], [97, 94, 383, 432], [111, 100, 369, 432], [81, 312, 399, 432]],
  },
  guardian: {
    right: [[137, 74, 343, 432], [133, 91, 346, 432], [140, 90, 340, 432], [126, 155, 354, 432], [80, 150, 399, 432], [135, 139, 345, 432], [92, 309, 388, 432]],
    left: [[137, 74, 343, 432], [133, 91, 346, 432], [140, 90, 340, 432], [126, 155, 354, 432], [80, 150, 399, 432], [135, 139, 345, 432], [92, 309, 388, 432]],
  },
  engineer: {
    right: [[131, 16, 350, 432], [127, 17, 350, 426], [133, 18, 350, 432], [147, 21, 370, 424], [160, 26, 386, 413], [121, 22, 316, 425], [75, 237, 414, 429]],
    left: [[131, 16, 350, 432], [121, 17, 344, 426], [141, 18, 358, 432], [134, 21, 357, 424], [135, 26, 361, 413], [148, 22, 343, 425], [67, 237, 406, 429]],
  },
  "crazy-king": {
    right: [[140, 84, 340, 432], [138, 94, 342, 432], [119, 115, 361, 432], [121, 59, 358, 432], [56, 129, 424, 432], [87, 109, 393, 432], [58, 290, 422, 432]],
    left: [[140, 84, 340, 432], [138, 94, 342, 432], [119, 115, 361, 432], [121, 59, 358, 432], [56, 129, 424, 432], [87, 109, 393, 432], [58, 290, 422, 432]],
  },
  kumaverson: {
    right: [[130, 98, 349, 432], [115, 102, 364, 432], [104, 90, 376, 432], [120, 54, 359, 432], [112, 108, 368, 432], [70, 78, 410, 432], [35, 290, 445, 432]],
    left: [[130, 98, 349, 432], [115, 102, 364, 432], [104, 90, 376, 432], [120, 54, 359, 432], [112, 108, 368, 432], [70, 78, 410, 432], [35, 290, 445, 432]],
  },
  babayaga: {
    right: [[179, 43, 301, 432], [133, 48, 347, 432], [125, 53, 355, 432], [114, 61, 365, 432], [94, 58, 386, 432], [75, 77, 405, 432], [57, 328, 423, 432]],
    left: [[181, 57, 299, 432], [127, 61, 353, 432], [127, 65, 352, 432], [112, 70, 367, 432], [92, 82, 388, 432], [50, 77, 429, 432], [28, 282, 452, 432]],
  },
  grappler: {
    right: [[137, 16, 342, 432], [128, 16, 351, 432], [139, 16, 340, 432], [78, 62, 401, 432], [44, 57, 435, 432], [102, 16, 378, 432], [62, 306, 418, 432]],
    left: [[137, 16, 342, 432], [128, 16, 351, 432], [139, 16, 340, 432], [78, 62, 401, 432], [44, 57, 435, 432], [102, 16, 378, 432], [62, 306, 418, 432]],
  },
  ooze: {
    right: [[134, 116, 346, 432], [106, 120, 373, 432], [117, 116, 363, 432], [111, 214, 369, 432], [45, 146, 434, 432], [139, 104, 341, 432], [92, 302, 388, 432]],
    left: [[134, 116, 346, 432], [106, 120, 373, 432], [117, 116, 363, 432], [111, 214, 369, 432], [45, 146, 434, 432], [139, 104, 341, 432], [92, 302, 388, 432]],
  },
  sprinter: {
    right: [[102, 44, 377, 432], [56, 65, 424, 432], [44, 25, 436, 432], [100, 209, 379, 432], [28, 122, 451, 432], [134, 84, 346, 432], [33, 304, 447, 432]],
    left: [[102, 44, 377, 432], [56, 65, 424, 432], [44, 25, 436, 432], [100, 209, 379, 432], [28, 122, 451, 432], [134, 84, 346, 432], [33, 304, 447, 432]],
  },
  "gate-eater": {
    right: [[122, 16, 358, 432], [111, 16, 368, 432], [108, 16, 372, 432], [103, 16, 377, 432], [54, 65, 425, 432], [88, 37, 392, 432], [51, 265, 428, 432]],
    left: [[122, 16, 358, 432], [111, 16, 368, 432], [108, 16, 372, 432], [103, 16, 377, 432], [54, 65, 425, 432], [88, 37, 392, 432], [51, 265, 428, 432]],
  },
});

function frameRecord({ path, sheetWidth, sheetHeight, source, visible, nativeDirection, direction, derivedFrom, authoredCell, anchorX = 0.5 }) {
  const [left, top, right, bottom] = visible;
  // Anchor the sprite on the measured bottom-most authored pixel.  Legacy
  // sheets intentionally keep a large transparent strip below the feet, so a
  // fixed near-1.0 anchor would make those characters float above the lane.
  const anchorY = bottom / source.h;
  const contentRect = Object.freeze({
    x: source.x + left,
    y: source.y + top,
    w: right - left,
    h: bottom - top,
  });
  const gutter = Object.freeze({
    top,
    right: source.w - right,
    bottom: source.h - bottom,
    left,
  });
  return Object.freeze({
    path,
    sheetWidth,
    sheetHeight,
    x: source.x,
    y: source.y,
    w: source.w,
    h: source.h,
    sourceRect: Object.freeze({ ...source }),
    contentRect,
    gutter,
    anchorX,
    anchorY,
    anchor: Object.freeze({ x: anchorX, y: anchorY }),
    flipX: nativeDirection !== direction,
    ...(authoredCell ? { authoredCell: Object.freeze({ ...authoredCell }) } : {}),
    ...(derivedFrom ? { derivedFrom } : {}),
  });
}

function legacyManifestEntry(auditKey, nativeDirection, { battleScale = 1 } = {}) {
  const audit = LEGACY_SHEET_AUDIT[auditKey];
  const path = `/art/v060/characters/legacy/${auditKey}-battle-gutter-v1.png`;
  const sourceCellWidths = audit.edges.slice(1).map((edge, index) => edge - audit.edges[index]);
  const sourceYOffset = LEGACY_PADDED_CELL.gutter
    + Math.floor((LEGACY_PADDED_CELL.innerHeight - audit.height) / 2);
  const frames = {};
  for (const state of SPRITE_STATES) {
    const index = STATE_FRAME_INDEX[state];
    const authoredWidth = sourceCellWidths[index];
    const sourceXOffset = LEGACY_PADDED_CELL.gutter
      + Math.floor((LEGACY_PADDED_CELL.innerWidth - authoredWidth) / 2);
    const source = {
      x: index * LEGACY_PADDED_CELL.width,
      y: 0,
      w: LEGACY_PADDED_CELL.width,
      h: LEGACY_PADDED_CELL.height,
    };
    const visible = [
      sourceXOffset + audit.visible[index][0],
      sourceYOffset + audit.visible[index][1],
      sourceXOffset + audit.visible[index][2],
      sourceYOffset + audit.visible[index][3],
    ];
    frames[state] = {};
    for (const direction of SPRITE_DIRECTIONS) {
      frames[state][direction] = frameRecord({
        path,
        sheetWidth: LEGACY_PADDED_CELL.width * 6,
        sheetHeight: LEGACY_PADDED_CELL.height,
        source,
        visible,
        nativeDirection,
        direction,
        authoredCell: { x: sourceXOffset, y: sourceYOffset, w: authoredWidth, h: audit.height },
        anchorX: (sourceXOffset + authoredWidth / 2) / LEGACY_PADDED_CELL.width,
        derivedFrom: state === "death" ? "hit" : undefined,
      });
    }
    Object.freeze(frames[state]);
  }
  return Object.freeze({
    path,
    sheet: Object.freeze({
      width: LEGACY_PADDED_CELL.width * 6,
      height: LEGACY_PADDED_CELL.height,
      layout: "six-derived-transparent-gutter-cells",
      cellWidth: LEGACY_PADDED_CELL.width,
      cellHeight: LEGACY_PADDED_CELL.height,
      gutter: LEGACY_PADDED_CELL.gutter,
    }),
    sourceSheet: Object.freeze({
      path: audit.path,
      width: audit.width,
      height: audit.height,
      cellEdges: audit.edges,
      cellWidths: Object.freeze(sourceCellWidths),
    }),
    battleContentHeight: null,
    // A uniform per-character multiplier preserves authored pose proportions,
    // transparent gutters, and the measured foot baseline across every state.
    battleScale,
    nativeDirection,
    states: SPRITE_STATES,
    directions: SPRITE_DIRECTIONS,
    frames: Object.freeze(frames),
  });
}

function explicitAtlasManifestEntry(kind, path) {
  const frames = {};
  for (let index = 0; index < SPRITE_STATES.length; index += 1) {
    const state = SPRITE_STATES[index];
    frames[state] = {};
    for (const direction of SPRITE_DIRECTIONS) {
      const row = direction === "right" ? 0 : 1;
      frames[state][direction] = frameRecord({
        path,
        sheetWidth: 3360,
        sheetHeight: 896,
        source: { x: index * 480, y: row * 448, w: 480, h: 448 },
        visible: NEWCOMER_VISIBLE[kind][direction][index],
        nativeDirection: direction,
        direction,
      });
    }
    Object.freeze(frames[state]);
  }
  return Object.freeze({
    path,
    sheet: Object.freeze({ width: 3360, height: 896, layout: "seven-horizontal-by-two-explicit-directions", cellWidth: 480, cellHeight: 448 }),
    // The authored atlas cells reserve much more transparent composition room
    // than legacy sheets. Normalize the visible body to the established battle
    // silhouette height while still drawing the complete source cell.
    battleContentHeight: 68,
    nativeDirection: "explicit-both",
    states: SPRITE_STATES,
    directions: SPRITE_DIRECTIONS,
    frames: Object.freeze(frames),
  });
}

export const SPRITE_MANIFEST = Object.freeze({
  brawler: legacyManifestEntry("brawler", "right"),
  scout: explicitAtlasManifestEntry("scout", "/art/v070/characters/scout-battle-v1.png"),
  ranger: explicitAtlasManifestEntry("ranger", "/art/v070/characters/ranger-battle-v1.png"),
  medic: explicitAtlasManifestEntry("medic", "/art/v070/characters/medic-battle-v1.png"),
  brute: explicitAtlasManifestEntry("brute", "/art/v070/characters/brute-battle-v1.png"),
  gunner: explicitAtlasManifestEntry("gunner", "/art/v070/characters/gunner-battle-v1.png"),
  guardian: explicitAtlasManifestEntry("guardian", "/art/v070/characters/guardian-battle-v1.png"),
  engineer: explicitAtlasManifestEntry("engineer", "/art/v080/characters/monkey-battle-r2.png"),
  walker: legacyManifestEntry("infected", "left"),
  runner: legacyManifestEntry("infected", "left"),
  turned: legacyManifestEntry("infected", "left"),
  spitter: legacyManifestEntry("spitter", "left"),
  shade: legacyManifestEntry("shade", "left"),
  crusher: legacyManifestEntry("crusher", "left"),
  abomination: legacyManifestEntry("crusher", "left"),
  takuya: legacyManifestEntry("takuya", "left"),
  grappler: explicitAtlasManifestEntry("grappler", "/art/v070/characters/grappler-battle-v1.png"),
  ooze: explicitAtlasManifestEntry("ooze", "/art/v070/characters/ooze-battle-v1.png"),
  sprinter: explicitAtlasManifestEntry("sprinter", "/art/v070/characters/sprinter-battle-v1.png"),
  "gate-eater": explicitAtlasManifestEntry("gate-eater", "/art/v070/characters/gate-eater-battle-v1.png"),
  "crazy-king": explicitAtlasManifestEntry("crazy-king", "/art/v060/characters/crazy-king-battle-v1.png"),
  kumaverson: explicitAtlasManifestEntry("kumaverson", "/art/v060/characters/kumaverson-battle-v1.png"),
  babayaga: explicitAtlasManifestEntry("babayaga", "/art/v060/characters/babayaga-battle-v1.png"),
});

/** Stable ordered list for the localhost all-frame QA gallery. */
export const spriteKinds = Object.freeze(Object.keys(SPRITE_MANIFEST));

export function spriteStatesFor(kind) {
  const entry = SPRITE_MANIFEST[kind];
  if (!entry) throw new RangeError(`Unknown sprite kind: ${String(kind)}`);
  return entry.states;
}

export function spriteSheetPath(kind) {
  const entry = SPRITE_MANIFEST[kind];
  if (!entry) throw new RangeError(`Unknown sprite kind: ${String(kind)}`);
  return entry.path;
}

export function spriteFrameFor(kind, state, direction = "right") {
  const entry = SPRITE_MANIFEST[kind];
  if (!entry) throw new RangeError(`Unknown sprite kind: ${String(kind)}`);
  if (!SPRITE_STATES.includes(state)) throw new RangeError(`Unknown sprite state: ${String(state)}`);
  if (!SPRITE_DIRECTIONS.includes(direction)) throw new RangeError(`Unknown sprite direction: ${String(direction)}`);
  return entry.frames[state][direction];
}

/** Fits an authored source cell inside a battle-size box without distortion. */
export function fitSpriteDisplaySize(frame, maximum = {}) {
  const sourceWidth = Number(frame?.sourceRect?.w ?? frame?.w);
  const sourceHeight = Number(frame?.sourceRect?.h ?? frame?.h);
  const maxWidth = Number(maximum.w);
  const maxHeight = Number(maximum.h);
  if (![sourceWidth, sourceHeight, maxWidth, maxHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new TypeError("A positive source frame and display box are required");
  }
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return Object.freeze({ w: sourceWidth * scale, h: sourceHeight * scale });
}

export function fitSpriteBattleDisplaySize(kind, frame, maximum = {}) {
  const entry = SPRITE_MANIFEST[kind];
  if (!entry) throw new RangeError(`Unknown sprite kind: ${String(kind)}`);
  const sourceWidth = Number(frame?.sourceRect?.w ?? frame?.w);
  const sourceHeight = Number(frame?.sourceRect?.h ?? frame?.h);
  const authoredWidth = Number(frame?.authoredCell?.w);
  const authoredHeight = Number(frame?.authoredCell?.h);
  if ([authoredWidth, authoredHeight].every((value) => Number.isFinite(value) && value > 0)) {
    const maxWidth = Number(maximum.w);
    const maxHeight = Number(maximum.h);
    if (![sourceWidth, sourceHeight, maxWidth, maxHeight].every((value) => Number.isFinite(value) && value > 0)) {
      throw new TypeError("A positive source frame and display box are required");
    }
    const scale = Math.min(maxWidth / authoredWidth, maxHeight / authoredHeight) * entry.battleScale;
    return Object.freeze({ w: sourceWidth * scale, h: sourceHeight * scale });
  }
  if (!Number.isFinite(entry.battleContentHeight)) return fitSpriteDisplaySize(frame, maximum);
  const contentWidth = Number(frame?.contentRect?.w);
  const contentHeight = Number(frame?.contentRect?.h);
  const maxContentWidth = Number(maximum.w);
  const maxSourceHeight = Number(maximum.h);
  const targetContentHeight = Math.min(entry.battleContentHeight, maxSourceHeight);
  if (![sourceWidth, sourceHeight, contentWidth, contentHeight, maxContentWidth, targetContentHeight]
    .every((value) => Number.isFinite(value) && value > 0)) {
    throw new TypeError("A positive source frame, content rect, and display box are required");
  }
  const scale = Math.min(maxContentWidth / contentWidth, targetContentHeight / contentHeight);
  return Object.freeze({ w: sourceWidth * scale, h: sourceHeight * scale });
}

export const CHARACTER_PORTRAIT_ART = Object.freeze({
  ...Object.fromEntries(Object.entries(V080_UNIT_VISUAL_PROFILES)
    .map(([kind, profile]) => [kind, profile.eventPortrait.path])),
  guide: V075_VISUAL_PROFILES.ikura.eventPortrait.path,
});

export const FORMATION_CARD_ART = Object.freeze(Object.fromEntries(
  Object.entries(V080_UNIT_VISUAL_PROFILES)
    .map(([kind, profile]) => [kind, profile.formationCard.path]),
));

export const PERSONNEL_CARD_ART = Object.freeze(Object.fromEntries(
  Object.entries(V080_UNIT_VISUAL_PROFILES)
    .map(([kind, profile]) => [kind, profile.personnelCard.path]),
));

export const RADIO_PORTRAIT_ART = "/art/v060/characters/portraits/radio-terminal-portrait-v1.webp";

export const PORTRAIT_ART = Object.freeze({
  ...CHARACTER_PORTRAIT_ART,
  radio: RADIO_PORTRAIT_ART,
});
