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

export const WEAPON_PROFILE_IDS = Object.freeze([
  "unarmed",
  "blunt",
  "chainsaw",
  "handgun",
  "rifle",
  "sniper",
  "machine-gun",
  "crossbow",
  "deployable",
  "heal-support",
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
    frame("hit", .08),
  ]),
};

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

const PRESENTATION_KINDS = Object.freeze([
  "brawler",
  "scout",
  "ranger",
  "medic",
  "brute",
  "gunner",
  "guardian",
  "engineer",
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
  takuya: 1.2,
  "gate-eater": 1.16,
});

function clipsForKind(kind) {
  const bodyScale = BODY_SCALE_BY_KIND[kind] ?? 1;
  return Object.fromEntries(COMBAT_CLIP_STATES.map((state) => {
    const source = kind === "gunner" && state === "active"
      ? MACHINE_GUN_ACTIVE
      : kind === "gunner" && state === "recovery"
        ? MACHINE_GUN_RECOVERY
        : STANDARD_CLIPS[state];
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
  crossbow: {
    id: "crossbow",
    trail: "bolt",
    trailColor: "#d8d19b",
    impact: "bolt-stick",
    impactRadius: 8,
    hitStopSeconds: .026,
    recoil: .12,
    casing: false,
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
  engineer: "crossbow",
});

export function combatPresentationFor(kind) {
  return COMBAT_PRESENTATION_PROFILES[kind] ?? COMBAT_PRESENTATION_PROFILES.walker;
}

export function animationClipFor(kind, state) {
  if (!COMBAT_CLIP_STATES.includes(state)) {
    throw new RangeError(`Unknown combat clip state: ${String(state)}`);
  }
  return combatPresentationFor(kind).clips[state];
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
      ?? offsetSeconds;
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
