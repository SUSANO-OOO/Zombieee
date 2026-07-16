/**
 * Audited sprite source geometry for the 0.6.0 renderer and localhost QA.
 *
 * Legacy producer sheets are read-only six-cell inputs.  Production rendering
 * uses deterministic derived atlases that isolate every authored cell behind a
 * 16px transparent gutter, preventing adjacent-frame interpolation bleed.  The
 * three 0.6.0 newcomers use a purpose-built seven-column/two-direction atlas.
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

function newcomerManifestEntry(kind) {
  const path = `/art/v060/characters/${kind}-battle-v1.png`;
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
  scout: legacyManifestEntry("scout", "right"),
  ranger: legacyManifestEntry("ranger", "right"),
  medic: legacyManifestEntry("medic", "right"),
  brute: legacyManifestEntry("brute", "right", { battleScale: 1.12 }),
  gunner: legacyManifestEntry("gunner", "right"),
  walker: legacyManifestEntry("infected", "left"),
  runner: legacyManifestEntry("infected", "left"),
  turned: legacyManifestEntry("infected", "left"),
  spitter: legacyManifestEntry("spitter", "left"),
  shade: legacyManifestEntry("shade", "left"),
  crusher: legacyManifestEntry("crusher", "left"),
  abomination: legacyManifestEntry("crusher", "left"),
  takuya: legacyManifestEntry("takuya", "left"),
  "crazy-king": newcomerManifestEntry("crazy-king"),
  kumaverson: newcomerManifestEntry("kumaverson"),
  babayaga: newcomerManifestEntry("babayaga"),
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
  brawler: "/art/v060/characters/portraits/brawler-portrait-v2.webp",
  scout: "/art/v060/characters/portraits/scout-portrait-v2.webp",
  ranger: "/art/v060/characters/portraits/ranger-portrait-v2.webp",
  medic: "/art/v060/characters/portraits/medic-portrait-v2.webp",
  brute: "/art/v060/characters/portraits/brute-portrait-v2.webp",
  gunner: "/art/v060/characters/portraits/gunner-portrait-v2.webp",
  "crazy-king": "/art/v060/characters/portraits/crazy-king-portrait-v2.webp",
  kumaverson: "/art/v060/characters/portraits/kumaverson-portrait-v2.webp",
  babayaga: "/art/v060/characters/portraits/babayaga-portrait-v2.webp",
  guide: "/art/v060/characters/portraits/guide-portrait-v2.webp",
});

export const RADIO_PORTRAIT_ART = "/art/v060/characters/portraits/radio-terminal-portrait-v1.webp";

export const PORTRAIT_ART = Object.freeze({
  ...CHARACTER_PORTRAIT_ART,
  radio: RADIO_PORTRAIT_ART,
});
