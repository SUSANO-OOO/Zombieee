const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

export const COMBAT_CLIP_STATES = Object.freeze([
  "idle",
  "move",
  "wind-up",
  "active",
  "recovery",
  "hit",
  "incapacitated",
  "death",
  "special",
]);

export const COMBAT_OPTIONAL_CLIP_STATES = Object.freeze([
  "deploy",
  "start-move",
  "stop-move",
  "turn",
  "reload",
  "weapon-cycle",
  "hit-light",
  "hit-heavy",
  "down",
  "get-up",
  "retreat",
  "phase-change",
]);

export const COMBAT_ANIMATION_STATES = Object.freeze([
  ...COMBAT_CLIP_STATES,
  ...COMBAT_OPTIONAL_CLIP_STATES,
]);

export const COMBAT_CLIP_FALLBACKS = Object.freeze({
  deploy: "idle",
  "start-move": "move",
  "stop-move": "idle",
  turn: "idle",
  reload: "recovery",
  "weapon-cycle": "recovery",
  "hit-light": "hit",
  "hit-heavy": "hit",
  down: "incapacitated",
  "get-up": "incapacitated",
  retreat: "move",
  "phase-change": "special",
});

export const WEAPON_PROFILE_IDS = Object.freeze([
  "unarmed",
  "blunt",
  "chainsaw",
  "handgun",
  "rifle",
  "sniper",
  "machine-gun",
  "suppressed-carbine",
  "deployable",
  "heal-support",
  "plasma-blade",
  "grenade",
  "dual-katana",
  "bite",
]);

const frame = (spriteState, durationSeconds, events = []) => ({
  spriteState,
  durationSeconds,
  events,
});

const clip = (frames, {
  loop = false,
  movement = false,
  recovery = false,
  directional = true,
  groundAnchor = 1,
  bodyScale = 1,
} = {}) => ({
  frames,
  loop,
  movement,
  recovery,
  directional,
  groundAnchor,
  bodyScale,
  durationSeconds: frames.reduce((total, current) => total + current.durationSeconds, 0),
});

const STANDARD_CLIPS = {
  idle: clip([
    frame("idle", .24),
    frame("idle", .31),
  ], { loop: true }),
  move: clip([
    frame("walk-a", .1, [{ type: "footstep", at: .075 }]),
    frame("walk-b", .12),
    frame("walk-a", .09),
  ], { loop: true, movement: true }),
  "wind-up": clip([
    frame("attack-a", .09, [{ type: "weapon-ready", at: .02 }]),
  ]),
  active: clip([
    frame("attack-b", .07, [{ type: "hit", at: 0 }, { type: "weapon-vfx", at: 0 }]),
  ]),
  recovery: clip([
    frame("attack-a", .07),
    frame("idle", .08),
  ], { recovery: true }),
  hit: clip([
    frame("hit", .12, [{ type: "hit-reaction", at: 0 }]),
  ]),
  incapacitated: clip([
    frame("hit", .16),
    frame("death", .24),
  ]),
  death: clip([
    frame("death", .42),
  ]),
  special: clip([
    frame("attack-a", .08, [{ type: "special-ready", at: 0 }]),
    frame("attack-b", .11, [{ type: "special-active", at: 0 }]),
    frame("idle", .08),
  ]),
};

const OPTIONAL_CLIPS = {
  deploy: clip([
    frame("idle", .08, [{ type: "deploy-brace", at: 0 }]),
    frame("walk-a", .12, [{ type: "deploy-step", at: .06 }]),
    frame("idle", .12, [{ type: "deploy-settle", at: .08 }]),
  ]),
  "start-move": clip([
    frame("idle", .055, [{ type: "locomotion-start", at: 0 }]),
    frame("walk-a", .09, [{ type: "footstep", at: .065 }]),
  ], { movement: true }),
  "stop-move": clip([
    frame("walk-b", .075),
    frame("idle", .105, [{ type: "locomotion-stop", at: .035 }]),
  ]),
  turn: clip([
    frame("walk-a", .075, [{ type: "turn-cross", at: .04 }]),
    frame("idle", .075, [{ type: "turn-settle", at: .04 }]),
  ]),
  reload: clip([
    frame("attack-a", .14, [{ type: "reload-open", at: .03 }]),
    frame("attack-b", .16, [{ type: "reload-cycle", at: .08 }]),
    frame("idle", .1, [{ type: "reload-ready", at: .05 }]),
  ], { recovery: true }),
  "weapon-cycle": clip([
    frame("attack-b", .11, [{ type: "weapon-cycle", at: .05 }]),
    frame("attack-a", .1),
    frame("idle", .08, [{ type: "weapon-ready", at: .03 }]),
  ], { recovery: true }),
  "hit-light": clip([
    frame("hit", .105, [{ type: "hit-reaction-light", at: 0 }]),
  ]),
  "hit-heavy": clip([
    frame("hit", .13, [{ type: "hit-reaction-heavy", at: 0 }]),
    frame("hit", .08, [{ type: "knockback-settle", at: .035 }]),
  ]),
  down: clip([
    frame("hit", .12, [{ type: "down-start", at: 0 }]),
    frame("death", .24, [{ type: "down-contact", at: .08 }]),
  ]),
  "get-up": clip([
    frame("death", .12, [{ type: "get-up-start", at: 0 }]),
    frame("hit", .14),
    frame("idle", .12, [{ type: "get-up-ready", at: .07 }]),
  ]),
  retreat: clip([
    frame("walk-a", .085, [{ type: "retreat-step", at: .055 }]),
    frame("walk-b", .095),
  ], { loop: true, movement: true }),
  "phase-change": clip([
    frame("idle", .11, [{ type: "phase-change-warning", at: 0 }]),
    frame("attack-a", .16, [{ type: "phase-change-active", at: .04 }]),
    frame("attack-b", .18),
    frame("idle", .12, [{ type: "phase-change-complete", at: .07 }]),
  ]),
};

export function combatFacingDirection({
  side,
  aiMoveDirection = 0,
  entryDirection = 0,
  manualDirection = 0,
  manualAbilityActive = false,
} = {}) {
  if (side === "human") {
    if (manualAbilityActive && Number(manualDirection) !== 0) {
      return Number(manualDirection) < 0 ? "left" : "right";
    }
    return Number(aiMoveDirection) < -.05 ? "left" : "right";
  }
  if (Number(aiMoveDirection) > .05) return "right";
  if (Number(aiMoveDirection) < -.05) return "left";
  return Number(entryDirection) > 0 ? "right" : "left";
}

const MACHINE_GUN_ACTIVE = clip([
  frame("attack-a", .055, [
    { type: "muzzle", at: 0, shotIndex: 0 },
    { type: "casing", at: .018, shotIndex: 0 },
    { type: "hit", at: .055, shotIndex: 0 },
  ]),
  frame("attack-b", .055, [
    { type: "muzzle", at: 0, shotIndex: 1 },
    { type: "casing", at: .018, shotIndex: 1 },
    { type: "hit", at: .055, shotIndex: 1 },
  ]),
  frame("attack-a", .055, [
    { type: "muzzle", at: 0, shotIndex: 2 },
    { type: "casing", at: .018, shotIndex: 2 },
    { type: "hit", at: .055, shotIndex: 2 },
  ]),
]);

const MACHINE_GUN_RECOVERY = clip([
  frame("attack-b", .045),
  frame("idle", .065),
], { recovery: true });

const MRS_CHIHA_ATTACK_ACTIVE = clip([
  frame("attack-a", .12, [{ type: "launcher-retrieve", at: .02 }]),
  frame("attack-b", .18, [{ type: "launcher-aim", at: .04 }]),
  frame("attack-b", .08, [{ type: "muzzle", at: .02, shotIndex: 0 }, { type: "grenade-launch", at: .02 }]),
]);

const MRS_CHIHA_ATTACK_RECOVERY = clip([
  frame("attack-a", .14, [{ type: "launcher-stow", at: .02 }]),
  frame("idle", .08),
], { recovery: true });

const MRS_CHIHA_LAUNCHER_BASH = clip([
  frame("attack-b", .1, [{ type: "launcher-bash-windup", at: .01 }]),
  frame("attack-a", .08, [{ type: "launcher-bash-contact", at: .03 }]),
  frame("idle", .09, [{ type: "launcher-bash-recover", at: .01 }]),
]);

const MANUAL_ABILITY_SPECIAL_CLIPS = {
  tky: clip([
    frame("attack-a", .2, [{ type: "light-blade-charge", at: 0 }]),
    frame("attack-b", .28, [{ type: "light-blade-extend", at: 0 }]),
    frame("attack-b", .14, [{ type: "light-blade-release", at: .14 }]),
  ]),
  "mrs-chiha": clip([
    frame("attack-a", .28, [{ type: "launcher-retrieve", at: .02 }]),
    frame("attack-b", .55, [{ type: "launcher-aim", at: .04 }]),
    frame("attack-a", .22, [{ type: "salvo-rotate", at: 0 }, { type: "salvo-shot", at: .22, shotIndex: 0 }]),
    frame("attack-b", .22, [{ type: "salvo-shot", at: .22, shotIndex: 1 }]),
    frame("attack-a", .22, [{ type: "salvo-shot", at: .22, shotIndex: 2 }]),
    frame("attack-b", .22, [{ type: "salvo-shot", at: .22, shotIndex: 3 }]),
    frame("attack-a", .18, [{ type: "launcher-stow", at: .02 }]),
    frame("idle", .12),
  ]),
  "miyamoto-musashi": clip([
    frame("attack-a", .22, [{ type: "cross-guard-ready", at: .02 }]),
    frame("attack-b", .36, [{ type: "cross-guard-hold", at: 0 }]),
  ]),
  "mayo-chan": clip([
    frame("attack-a", .12, [{ type: "feral-surge", at: 0 }]),
    frame("attack-b", .16, [{ type: "infection-bloom", at: .04 }]),
    frame("walk-a", .08, [{ type: "feral-rush", at: 0 }]),
  ], { movement: true }),
};

const PRESENTATION_KINDS = Object.freeze([
  "brawler",
  "scout",
  "ranger",
  "medic",
  "brute",
  "gunner",
  "guardian",
  "engineer",
  "zakimiya",
  "tky",
  "mrs-chiha",
  "miyamoto-musashi",
  "mayo-chan",
  "mayo-chan-feral",
  "walker",
  "runner",
  "turned",
  "spitter",
  "shade",
  "crusher",
  "abomination",
  "takuya",
  "grappler",
  "ooze",
  "sprinter",
  "gate-eater",
  "kurome",
  "mother",
  "ooguchi",
  "gairen",
  "futago",
  "resonator",
  "cagewalker",
  "spindle",
  "choir-knot",
  "pall-manta",
  "anchor-bloom",
  "crazy-king",
  "kumaverson",
  "babayaga",
]);

const BODY_SCALE_BY_KIND = Object.freeze({
  scout: .96,
  medic: .96,
  babayaga: .97,
  brute: 1.12,
  guardian: 1.14,
  kumaverson: 1.08,
  crusher: 1.1,
  abomination: 1.13,
  takuya: 1.3,
  "gate-eater": 1.67,
  kurome: 1.95,
  mother: 2.38,
  ooguchi: 1.89,
  gairen: 2.45,
  futago: 2.36,
  "mayo-chan": .82,
  "mayo-chan-feral": .82,
});

function clipsForKind(kind) {
  const bodyScale = BODY_SCALE_BY_KIND[kind] ?? 1;
  return Object.fromEntries(COMBAT_ANIMATION_STATES.map((state) => {
    const source = kind === "gunner" && state === "active"
      ? MACHINE_GUN_ACTIVE
      : kind === "gunner" && state === "recovery"
        ? MACHINE_GUN_RECOVERY
        : kind === "mrs-chiha" && state === "active"
          ? MRS_CHIHA_ATTACK_ACTIVE
          : kind === "mrs-chiha" && state === "recovery"
            ? MRS_CHIHA_ATTACK_RECOVERY
            : state === "special" && MANUAL_ABILITY_SPECIAL_CLIPS[kind]
              ? MANUAL_ABILITY_SPECIAL_CLIPS[kind]
              : OPTIONAL_CLIPS[state]
                ?? STANDARD_CLIPS[COMBAT_CLIP_FALLBACKS[state]]
                ?? STANDARD_CLIPS[state];
    return [state, {
      ...source,
      bodyScale,
      frames: source.frames.map((current) => ({
        ...current,
        events: current.events.map((event) => ({ ...event })),
      })),
    }];
  }));
}

export const COMBAT_PRESENTATION_PROFILES = deepFreeze(Object.fromEntries(
  PRESENTATION_KINDS.map((kind) => [kind, {
    kind,
    bodyClass: BODY_SCALE_BY_KIND[kind] > 1.1
      ? "large"
      : BODY_SCALE_BY_KIND[kind] < 1
        ? "small"
        : "standard",
    clips: clipsForKind(kind),
  }]),
));

export const WEAPON_PROFILES = deepFreeze({
  unarmed: {
    id: "unarmed",
    trail: "contact-arc",
    trailColor: "#f1c38a",
    impact: "body-jolt",
    impactRadius: 9,
    hitStopSeconds: .028,
    recoil: 0,
    casing: false,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  blunt: {
    id: "blunt",
    trail: "weighted-swing",
    trailColor: "#ffc070",
    impact: "debris-burst",
    impactRadius: 15,
    hitStopSeconds: .052,
    recoil: 0,
    casing: false,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  chainsaw: {
    id: "chainsaw",
    trail: "toothed-sweep",
    trailColor: "#ff7652",
    impact: "flesh-spray",
    impactRadius: 17,
    hitStopSeconds: .036,
    recoil: .08,
    casing: false,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  handgun: {
    id: "handgun",
    trail: "ballistic",
    trailColor: "#ffe18a",
    impact: "spark",
    impactRadius: 7,
    hitStopSeconds: .018,
    recoil: .18,
    casing: true,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  rifle: {
    id: "rifle",
    trail: "ballistic",
    trailColor: "#b7efff",
    impact: "spark",
    impactRadius: 8,
    hitStopSeconds: .022,
    recoil: .24,
    casing: true,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  sniper: {
    id: "sniper",
    trail: "high-velocity",
    trailColor: "#eee7cb",
    impact: "precision-burst",
    impactRadius: 13,
    hitStopSeconds: .05,
    recoil: .42,
    casing: true,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  "machine-gun": {
    id: "machine-gun",
    trail: "burst-tracer",
    trailColor: "#ffd067",
    impact: "suppression-spark",
    impactRadius: 8,
    hitStopSeconds: .014,
    recoil: .34,
    casing: true,
    damageWeights: [.34, .33, .33],
    shotOffsetsSeconds: [0, .055, .11],
  },
  "suppressed-carbine": {
    id: "suppressed-carbine",
    trail: "ballistic",
    trailColor: "#7ee8ea",
    impact: "precision-burst",
    impactRadius: 8,
    hitStopSeconds: .022,
    recoil: .2,
    casing: true,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  deployable: {
    id: "deployable",
    trail: "placement",
    trailColor: "#d9c16d",
    impact: "mechanical-lock",
    impactRadius: 12,
    hitStopSeconds: 0,
    recoil: 0,
    casing: false,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  "heal-support": {
    id: "heal-support",
    trail: "support-pulse",
    trailColor: "#79efac",
    impact: "healing-wave",
    impactRadius: 14,
    hitStopSeconds: 0,
    recoil: 0,
    casing: false,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
  "plasma-blade": {
    id: "plasma-blade",
    trail: "energy-arc",
    trailColor: "#ff4dca",
    impact: "energy-burst",
    impactRadius: 13,
    hitStopSeconds: .03,
    recoil: 0,
    casing: false,
    damageWeights: [.56, .44],
    shotOffsetsSeconds: [0, .08],
  },
  grenade: {
    id: "grenade",
    trail: "ballistic-arc",
    trailColor: "#d4a85b",
    impact: "explosive-burst",
    impactRadius: 20,
    hitStopSeconds: .038,
    recoil: .48,
    casing: false,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
    projectileTravelSeconds: .28,
  },
  "dual-katana": {
    id: "dual-katana",
    trail: "cross-cut",
    trailColor: "#d9e4ed",
    impact: "precision-burst",
    impactRadius: 12,
    hitStopSeconds: .04,
    recoil: 0,
    casing: false,
    damageWeights: [.52, .48],
    shotOffsetsSeconds: [0, .07],
  },
  bite: {
    id: "bite",
    trail: "bite-lunge",
    trailColor: "#f0cd77",
    impact: "infection-snap",
    impactRadius: 8,
    hitStopSeconds: .024,
    recoil: 0,
    casing: false,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
  },
});

export const UNIT_WEAPON_PROFILE = deepFreeze({
  brawler: "unarmed",
  scout: "handgun",
  ranger: "rifle",
  brute: "blunt",
  gunner: "machine-gun",
  medic: "heal-support",
  "crazy-king": "chainsaw",
  kumaverson: "blunt",
  babayaga: "sniper",
  guardian: "blunt",
  engineer: "suppressed-carbine",
  zakimiya: "blunt",
  tky: "plasma-blade",
  "mrs-chiha": "grenade",
  "miyamoto-musashi": "dual-katana",
  "mayo-chan": "bite",
});

export const COMBAT_WEAPON_ANCHORS = deepFreeze({
  brawler: { forward: 13, up: 34 },
  scout: { forward: 18, up: 39 },
  ranger: { forward: 22, up: 42 },
  medic: { forward: 18, up: 38 },
  brute: { forward: 18, up: 31 },
  gunner: { forward: 25, up: 39 },
  guardian: { forward: 16, up: 34 },
  engineer: { forward: 20, up: 39 },
  "crazy-king": { forward: 20, up: 29 },
  kumaverson: { forward: 18, up: 32 },
  babayaga: { forward: 23, up: 43 },
  zakimiya: { forward: 17, up: 32 },
  tky: { forward: 23, up: 43 },
  "mrs-chiha": { forward: 23, up: 43 },
  "miyamoto-musashi": { forward: 19, up: 34 },
  "mayo-chan": { forward: 13, up: 24 },
  spitter: { forward: 18, up: 30 },
  ooze: { forward: 20, up: 27 },
  "choir-knot": { forward: 22, up: 36 },
  resonator: { forward: 18, up: 38 },
});

export function combatWeaponAnchor({
  kind,
  x = 0,
  y = 0,
  direction = 1,
  shotIndex = 0,
  recoil = 0,
} = {}) {
  const anchor = COMBAT_WEAPON_ANCHORS[kind] ?? { forward: 14, up: 32 };
  const facing = Number(direction) < 0 ? -1 : 1;
  const index = Math.max(0, Number(shotIndex) || 0);
  return Object.freeze({
    x: Number(x) + facing * (anchor.forward - Math.max(0, Number(recoil) || 0) * index * 2),
    y: Number(y) - anchor.up + index * 1.5,
  });
}

export function combatPresentationFor(kind) {
  return COMBAT_PRESENTATION_PROFILES[kind] ?? COMBAT_PRESENTATION_PROFILES.walker;
}

export function animationClipFor(kind, state) {
  if (!COMBAT_ANIMATION_STATES.includes(state)) {
    throw new RangeError(`Unknown combat clip state: ${String(state)}`);
  }
  const profile = combatPresentationFor(kind);
  return profile.clips[state]
    ?? profile.clips[COMBAT_CLIP_FALLBACKS[state]]
    ?? profile.clips.idle;
}

function combatProceduralPose(state, progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const pulse = Math.sin(Math.PI * p);
  switch (state) {
    case "deploy":
      return { offsetX: -2.2 * (1 - p), offsetY: 0, rotationRadians: -.035 * (1 - p), scaleX: .96 + .04 * p, scaleY: .88 + .12 * p, opacity: .72 + .28 * p };
    case "start-move":
      return { offsetX: 1.8 * pulse, offsetY: 0, rotationRadians: .045 * pulse, scaleX: 1.02, scaleY: 1 - .035 * pulse, opacity: 1 };
    case "stop-move":
      return { offsetX: .8 * (1 - p), offsetY: 0, rotationRadians: -.035 * pulse, scaleX: 1, scaleY: 1 - .025 * pulse, opacity: 1 };
    case "turn":
      return { offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: .84 + .16 * Math.abs(2 * p - 1), scaleY: 1, opacity: .92 + .08 * Math.abs(2 * p - 1) };
    case "reload":
    case "weapon-cycle":
      return { offsetX: -1.2 * pulse, offsetY: 0, rotationRadians: -.025 * pulse, scaleX: 1, scaleY: 1 - .02 * pulse, opacity: 1 };
    case "hit-light":
      return { offsetX: -2.4 * (1 - p), offsetY: 0, rotationRadians: -.055 * (1 - p), scaleX: 1.025, scaleY: .975, opacity: 1 };
    case "hit-heavy":
      return { offsetX: -4.8 * (1 - p), offsetY: 0, rotationRadians: -.095 * (1 - p), scaleX: 1.04, scaleY: .93 + .07 * p, opacity: .94 + .06 * p };
    case "down":
      return { offsetX: -3 * p, offsetY: 0, rotationRadians: -.12 * p, scaleX: 1.06, scaleY: 1 - .16 * p, opacity: 1 };
    case "get-up":
      return { offsetX: -2 * (1 - p), offsetY: 0, rotationRadians: -.1 * (1 - p), scaleX: 1.04 - .04 * p, scaleY: .84 + .16 * p, opacity: 1 };
    case "retreat":
      return { offsetX: -1.8 * pulse, offsetY: 0, rotationRadians: -.055, scaleX: 1.025, scaleY: .975, opacity: 1 };
    case "phase-change":
      return { offsetX: 0, offsetY: 0, rotationRadians: .018 * Math.sin(p * Math.PI * 4), scaleX: 1 + .055 * pulse, scaleY: 1 + .055 * pulse, opacity: .9 + .1 * Math.abs(Math.cos(p * Math.PI * 2)) };
    default:
      return { offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1, opacity: 1 };
  }
}

export function sampleAnimationClip(kind, state, elapsedSeconds = 0) {
  const current = animationClipFor(kind, state);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const local = current.loop && current.durationSeconds > 0
    ? elapsed % current.durationSeconds
    : Math.min(elapsed, Math.max(0, current.durationSeconds - Number.EPSILON));
  let cursor = 0;
  for (let index = 0; index < current.frames.length; index += 1) {
    const currentFrame = current.frames[index];
    const end = cursor + currentFrame.durationSeconds;
    if (local < end || index === current.frames.length - 1) {
      return Object.freeze({
        state,
        frameIndex: index,
        spriteState: currentFrame.spriteState,
        frameElapsedSeconds: local - cursor,
        frameDurationSeconds: currentFrame.durationSeconds,
        clipDurationSeconds: current.durationSeconds,
        events: currentFrame.events,
        movement: current.movement,
        recovery: current.recovery,
        directional: current.directional,
        groundAnchor: current.groundAnchor,
        bodyScale: current.bodyScale,
        requestedState: state,
        resolvedState: combatPresentationFor(kind).clips[state]
          ? state
          : COMBAT_CLIP_FALLBACKS[state] ?? "idle",
        pose: Object.freeze(combatProceduralPose(
          state,
          current.durationSeconds > 0 ? local / current.durationSeconds : 0,
        )),
      });
    }
    cursor = end;
  }
  throw new RangeError(`Combat clip has no frames: ${kind}/${state}`);
}

export function sampleAttackPresentation(kind, elapsedSeconds = 0) {
  const active = animationClipFor(kind, "active");
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  if (elapsed < active.durationSeconds) return sampleAnimationClip(kind, "active", elapsed);
  return sampleAnimationClip(kind, "recovery", elapsed - active.durationSeconds);
}

export function attackPresentationDuration(kind) {
  return animationClipFor(kind, "active").durationSeconds
    + animationClipFor(kind, "recovery").durationSeconds;
}

export function combatClipEventsFor(kind, state) {
  const current = animationClipFor(kind, state);
  let frameStart = 0;
  const events = [];
  for (const currentFrame of current.frames) {
    for (const event of currentFrame.events) {
      events.push(Object.freeze({
        ...event,
        at: frameStart + Math.max(0, Number(event.at) || 0),
      }));
    }
    frameStart += currentFrame.durationSeconds;
  }
  return Object.freeze(events);
}

export function combatClipEventsBetween(kind, state, fromSeconds = 0, toSeconds = 0) {
  const current = animationClipFor(kind, state);
  const start = Math.max(0, Number(fromSeconds) || 0);
  const end = Math.max(start, Number(toSeconds) || 0);
  if (end <= start && start > 0) return Object.freeze([]);
  const timeline = combatClipEventsFor(kind, state);
  if (!current.loop || current.durationSeconds <= 0) {
    return Object.freeze(timeline
      .filter((event) => (start === 0 ? event.at >= 0 : event.at > start) && event.at <= end)
      .map((event) => Object.freeze({ ...event, cycle: 0, absoluteAt: event.at })));
  }
  const firstCycle = Math.floor(start / current.durationSeconds);
  const lastCycle = Math.floor(end / current.durationSeconds);
  const events = [];
  for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
    for (const event of timeline) {
      const absoluteAt = cycle * current.durationSeconds + event.at;
      if ((start === 0 ? absoluteAt >= 0 : absoluteAt > start) && absoluteAt <= end) {
        events.push(Object.freeze({ ...event, cycle, absoluteAt }));
      }
    }
  }
  return Object.freeze(events);
}

const TRANSIENT_LOCOMOTION_STATES = new Set([
  "start-move",
  "stop-move",
  "turn",
]);

function normalizedDirection(direction, fallback = "right") {
  if (direction === "left" || Number(direction) < 0) return "left";
  if (direction === "right" || Number(direction) > 0) return "right";
  return fallback === "left" ? "left" : "right";
}

export function createCombatAnimationRuntime({
  direction = "right",
  deploying = false,
  x = 0,
  y = 0,
} = {}) {
  return {
    state: deploying ? "deploy" : "idle",
    elapsedSeconds: 0,
    direction: normalizedDirection(direction),
    moving: false,
    deployCompleted: false,
    transitionCount: 0,
    eventCount: 0,
    eventCursorInitialized: false,
    lastEvents: [],
    lastX: Number(x) || 0,
    lastY: Number(y) || 0,
  };
}

export function advanceCombatAnimationRuntime(runtime, observation = {}, elapsedSeconds = 0) {
  const previous = runtime ?? createCombatAnimationRuntime(observation);
  const dt = Math.max(0, Number(elapsedSeconds) || 0);
  const x = Number.isFinite(Number(observation.x)) ? Number(observation.x) : previous.lastX;
  const y = Number.isFinite(Number(observation.y)) ? Number(observation.y) : previous.lastY;
  const movedDistance = Math.hypot(x - previous.lastX, y - previous.lastY);
  const moving = observation.moving === undefined
    ? movedDistance > Math.max(.05, dt * 2)
    : Boolean(observation.moving) || movedDistance > Math.max(.05, dt * 2);
  const direction = normalizedDirection(observation.direction, previous.direction);
  const requestedState = COMBAT_ANIMATION_STATES.includes(observation.state)
    ? observation.state
    : null;
  const deploying = Boolean(observation.deploying);
  const directionChanged = direction !== previous.direction;
  const deployCompleted = previous.deployCompleted === true
    || (previous.state === "deploy"
      && previous.elapsedSeconds + dt >= animationClipFor("walker", "deploy").durationSeconds);
  const wantsDeploy = deploying && !deployCompleted;
  let desiredState = requestedState
    ?? (wantsDeploy
      ? "deploy"
      : moving && !previous.moving
        ? "start-move"
        : !moving && previous.moving
          ? "stop-move"
          : directionChanged
            ? "turn"
            : moving
              ? "move"
              : "idle");
  let state = previous.state;
  let stateElapsed = previous.elapsedSeconds + dt;
  const previousClip = animationClipFor("walker", state);
  const transientActive = TRANSIENT_LOCOMOTION_STATES.has(state)
    && stateElapsed < previousClip.durationSeconds;
  if (requestedState || wantsDeploy || !transientActive) {
    if (state !== desiredState) {
      state = desiredState;
      stateElapsed = 0;
    }
  } else {
    desiredState = state;
  }
  if (!requestedState && !wantsDeploy
    && TRANSIENT_LOCOMOTION_STATES.has(state)
    && stateElapsed >= animationClipFor("walker", state).durationSeconds) {
    state = moving ? "move" : "idle";
    stateElapsed = 0;
  }
  const stateChanged = state !== previous.state;
  const eventStart = stateChanged || previous.eventCursorInitialized !== true
    ? 0
    : previous.elapsedSeconds === 0
      ? Number.EPSILON
      : previous.elapsedSeconds;
  const lastEvents = combatClipEventsBetween(
    observation.kind ?? "walker",
    state,
    eventStart,
    stateElapsed,
  );
  return {
    state,
    elapsedSeconds: stateElapsed,
    direction,
    moving,
    deployCompleted,
    transitionCount: previous.transitionCount + (stateChanged ? 1 : 0),
    eventCount: previous.eventCount + lastEvents.length,
    eventCursorInitialized: true,
    lastEvents: lastEvents.map(({ type, absoluteAt }) => ({ type, at: absoluteAt })),
    lastX: x,
    lastY: y,
  };
}

export function weaponProfileForUnit(kind) {
  return WEAPON_PROFILES[UNIT_WEAPON_PROFILE[kind] ?? "unarmed"];
}

export function weaponProfileForAction(kind, action = "attack") {
  if (kind === "engineer" && action === "deploy") return WEAPON_PROFILES.deployable;
  if (kind === "medic" && action === "heal") return WEAPON_PROFILES["heal-support"];
  return weaponProfileForUnit(kind);
}

export function weaponDamageEventsFor(kind, damage = 0) {
  const profile = weaponProfileForUnit(kind);
  const total = Math.max(0, Number(damage) || 0);
  const activeEvents = combatClipEventsFor(kind, "active");
  const muzzleEvents = activeEvents.filter((event) => event.type === "muzzle");
  const hitEvents = activeEvents.filter((event) => event.type === "hit");
  let assigned = 0;
  return Object.freeze(profile.damageWeights.map((weight, index) => {
    const eventDamage = index === profile.damageWeights.length - 1
      ? Math.max(0, total - assigned)
      : total * weight;
    assigned += eventDamage;
    const offsetSeconds = muzzleEvents.find((event) => event.shotIndex === index)?.at
      ?? profile.shotOffsetsSeconds[index]
      ?? 0;
    const hitOffsetSeconds = hitEvents.find((event) => event.shotIndex === index)?.at
      ?? offsetSeconds + Math.max(0, Number(profile.projectileTravelSeconds) || 0);
    return Object.freeze({
      shotIndex: index,
      offsetSeconds,
      hitOffsetSeconds,
      travelSeconds: Number(Math.max(0, hitOffsetSeconds - offsetSeconds).toFixed(6)),
      damage: eventDamage,
      muzzle: true,
      projectile: profile.trail,
      casing: profile.casing,
      impact: profile.impact,
      hitReaction: true,
      hitStopSeconds: profile.hitStopSeconds,
      recoil: profile.recoil,
    });
  }));
}

export function sampleMrsChihaLauncherBash(elapsedSeconds = 0) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const local = Math.min(elapsed, Math.max(0, MRS_CHIHA_LAUNCHER_BASH.durationSeconds - Number.EPSILON));
  let cursor = 0;
  for (let index = 0; index < MRS_CHIHA_LAUNCHER_BASH.frames.length; index += 1) {
    const currentFrame = MRS_CHIHA_LAUNCHER_BASH.frames[index];
    const end = cursor + currentFrame.durationSeconds;
    if (local < end || index === MRS_CHIHA_LAUNCHER_BASH.frames.length - 1) {
      return Object.freeze({
        state: "launcher-bash",
        frameIndex: index,
        spriteState: currentFrame.spriteState,
        frameElapsedSeconds: local - cursor,
        frameDurationSeconds: currentFrame.durationSeconds,
        clipDurationSeconds: MRS_CHIHA_LAUNCHER_BASH.durationSeconds,
        events: currentFrame.events,
        movement: false,
        recovery: index === MRS_CHIHA_LAUNCHER_BASH.frames.length - 1,
        directional: true,
        groundAnchor: 1,
        bodyScale: BODY_SCALE_BY_KIND["mrs-chiha"] ?? 1,
      });
    }
    cursor = end;
  }
  throw new RangeError("Mrs. Chiha launcher bash clip has no frames");
}

export function mrsChihaLauncherBashDuration() {
  return MRS_CHIHA_LAUNCHER_BASH.durationSeconds;
}

export function advancePendingWeaponHits(events = [], elapsedSeconds = 0) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const due = [];
  const pending = [];
  for (const event of Array.isArray(events) ? events : []) {
    const remainingSeconds = Math.max(0, Number(event?.remainingSeconds) || 0) - elapsed;
    if (remainingSeconds <= 0) due.push(Object.freeze({ ...event, remainingSeconds: 0 }));
    else pending.push(Object.freeze({ ...event, remainingSeconds }));
  }
  return Object.freeze({
    due: Object.freeze(due),
    pending: Object.freeze(pending),
  });
}
