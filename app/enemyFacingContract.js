const entry = ({ family, sourcePath, sourceFacing, semanticLandmark = null }) => Object.freeze({
  family,
  sourcePath,
  sourceFacing,
  semanticLandmark: semanticLandmark ? Object.freeze({ ...semanticLandmark }) : null,
});

/**
 * Semantic facing of every production enemy/boss authoring source.
 *
 * This is deliberately independent from atlas row order.  Generators must use
 * the declaration to place an authored pose into the matching semantic row;
 * they may not assume that the source faces right.  `front-symmetric` is
 * reserved for bodies whose authored front/back silhouette has no directional
 * head, mouth, or weapon landmark.
 */
export const PRODUCTION_ENEMY_SOURCE_FACING = Object.freeze({
  walker: entry({ family: "legacy-v060", sourcePath: "/infected-sprites-v1.png", sourceFacing: "left" }),
  runner: entry({ family: "legacy-v060", sourcePath: "/infected-sprites-v1.png", sourceFacing: "left" }),
  turned: entry({ family: "legacy-v060", sourcePath: "/infected-sprites-v1.png", sourceFacing: "left" }),
  spitter: entry({ family: "legacy-v060", sourcePath: "/spitter-sprites-v1.png", sourceFacing: "left" }),
  shade: entry({ family: "legacy-v060", sourcePath: "/shade-raider-sprites-v1.png", sourceFacing: "left" }),
  crusher: entry({ family: "legacy-v060", sourcePath: "/crusher-sprites-v1.png", sourceFacing: "left" }),
  abomination: entry({ family: "legacy-v060", sourcePath: "/crusher-sprites-v1.png", sourceFacing: "left" }),
  takuya: entry({ family: "legacy-v060", sourcePath: "/takuya-boss-sprites-v2.png", sourceFacing: "left" }),

  grappler: entry({ family: "explicit-v070", sourcePath: "/art/v070/characters/grappler-battle-v1.png", sourceFacing: "right" }),
  ooze: entry({ family: "explicit-v070", sourcePath: "/art/v070/characters/ooze-battle-v1.png", sourceFacing: "right" }),
  sprinter: entry({ family: "explicit-v070", sourcePath: "/art/v070/characters/sprinter-battle-v1.png", sourceFacing: "right" }),
  "gate-eater": entry({ family: "explicit-v070", sourcePath: "/art/v070/characters/gate-eater-battle-v1.png", sourceFacing: "right" }),

  kurome: entry({ family: "explicit-v090-boss", sourcePath: "assets/source/v090-prototypes/bosses/kurome-pose-sheet-candidate-r1.png", sourceFacing: "left" }),
  mother: entry({ family: "explicit-v090-boss", sourcePath: "assets/source/v090/bosses/mother-pose-sheet-candidate-r1.png", sourceFacing: "left" }),
  ooguchi: entry({ family: "explicit-v090-boss", sourcePath: "assets/source/v090/bosses/ooguchi-pose-sheet-candidate-r1.png", sourceFacing: "left" }),
  gairen: entry({ family: "explicit-v090-boss", sourcePath: "assets/source/v090/bosses/gairen-pose-sheet-candidate-r1.png", sourceFacing: "left" }),
  futago: entry({ family: "explicit-v090-boss", sourcePath: "assets/source/v090/bosses/futago-pose-sheet-candidate-r1.png", sourceFacing: "left" }),

  resonator: entry({
    family: "explicit-v0995-infected",
    sourcePath: "assets/source/v090/enemies/resonator-infected-pose-sheet-r1.png",
    sourceFacing: "left",
    semanticLandmark: { kind: "mouth", x: 0.36, y: 0.3, radius: 0.07 },
  }),
  cagewalker: entry({
    family: "explicit-v0995-infected",
    sourcePath: "assets/source/v090/enemies/cagewalker-infected-pose-sheet-r1.png",
    sourceFacing: "left",
    semanticLandmark: { kind: "head", x: 0.31, y: 0.64, radius: 0.07 },
  }),
  spindle: entry({
    family: "explicit-v0995-infected",
    sourcePath: "assets/source/v090/enemies/spindle-infected-pose-sheet-r1.png",
    sourceFacing: "left",
    semanticLandmark: { kind: "head", x: 0.23, y: 0.75, radius: 0.06 },
  }),
  "choir-knot": entry({
    family: "explicit-v0995-infected",
    sourcePath: "assets/source/v090/enemies/choir-knot-infected-pose-sheet-r1.png",
    sourceFacing: "front-symmetric",
  }),
  "pall-manta": entry({
    family: "explicit-v0995-infected",
    sourcePath: "assets/source/v090/enemies/pall-manta-infected-pose-sheet-r1.png",
    sourceFacing: "front-symmetric",
  }),
  "anchor-bloom": entry({
    family: "explicit-v0995-infected",
    sourcePath: "assets/source/v090/enemies/anchor-bloom-infected-pose-sheet-r1.png",
    sourceFacing: "front-symmetric",
  }),
});

export const V0995_INFECTED_FACING_KINDS = Object.freeze([
  "resonator",
  "cagewalker",
  "spindle",
  "choir-knot",
  "pall-manta",
  "anchor-bloom",
]);

export function semanticAtlasRowPlan(sourceFacing) {
  if (sourceFacing === "left") {
    return Object.freeze({ right: "mirror", left: "source" });
  }
  if (sourceFacing === "right" || sourceFacing === "front-symmetric") {
    return Object.freeze({ right: "source", left: "mirror" });
  }
  throw new RangeError(`Missing or invalid semantic source facing: ${String(sourceFacing)}`);
}

export function combatFacingFromMotion({
  side,
  actualXDelta = 0,
  aiMoveDirection = 0,
  entryDirection = 0,
  targetDirection = 0,
  manualDirection = 0,
  manualAbilityActive = false,
  attacking = false,
} = {}) {
  if (side === "human" && manualAbilityActive && Number(manualDirection) !== 0) {
    return Number(manualDirection) < 0 ? "left" : "right";
  }
  if (attacking && Number(targetDirection) !== 0) {
    return Number(targetDirection) < 0 ? "left" : "right";
  }
  if (Number(actualXDelta) > .05) return "right";
  if (Number(actualXDelta) < -.05) return "left";
  if (Number(aiMoveDirection) > .05) return "right";
  if (Number(aiMoveDirection) < -.05) return "left";
  if (Number(targetDirection) !== 0) return Number(targetDirection) < 0 ? "left" : "right";
  if (side === "human") return "right";
  return Number(entryDirection) > 0 ? "right" : "left";
}
