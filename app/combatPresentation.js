import { combatFacingFromMotion } from "./enemyFacingContract.js";

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
  "crowbar",
  "chainsaw",
  "handgun",
  "rifle",
  "sniper",
  "machine-gun",
  "suppressed-carbine",
  "crossbow",
  "deployable",
  "heal-support",
  "plasma-blade",
  "grenade",
  "dual-katana",
  "bite",
]);

export const REPRESENTATIVE_SIX_KINDS = Object.freeze([
  "scout",
  "gunner",
  "crazy-king",
  "tky",
  "mrs-chiha",
  "mayo-chan",
]);

export const REMAINING_TEN_KINDS = Object.freeze([
  "brawler",
  "ranger",
  "medic",
  "brute",
  "kumaverson",
  "babayaga",
  "guardian",
  "engineer",
  "zakimiya",
  "miyamoto-musashi",
]);

export const PLAYABLE_COMBAT_KINDS = Object.freeze([
  ...REPRESENTATIVE_SIX_KINDS,
  ...REMAINING_TEN_KINDS,
]);

export function attackCooldownAfterPresentationWindup(kind, intendedCooldown) {
  const cooldown = Math.max(0, Number(intendedCooldown) || 0);
  return Math.max(0, cooldown - animationClipFor(kind, "wind-up").durationSeconds);
}

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
  actualXDelta = 0,
  aiMoveDirection = 0,
  entryDirection = 0,
  targetDirection = 0,
  manualDirection = 0,
  manualAbilityActive = false,
  attacking = false,
} = {}) {
  return combatFacingFromMotion({
    side,
    actualXDelta,
    aiMoveDirection,
    entryDirection,
    targetDirection,
    manualDirection,
    manualAbilityActive,
    attacking,
  });
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
  scout: clip([
    frame("attack-a", .09, [{ type: "intercept-brace", at: 0 }]),
    frame("walk-a", .06, [{ type: "intercept-dash", at: 0 }]),
    frame("attack-b", .09, [{ type: "intercept-impact", at: .09 }]),
    frame("attack-a", .08, [{ type: "intercept-recover", at: .02 }]),
    frame("idle", .06, [{ type: "intercept-ready", at: .06 }]),
  ], { movement: true }),
  gunner: clip([
    frame("attack-a", .18, [{ type: "suppression-aim", at: .02 }]),
    frame("attack-b", .074, [
      { type: "suppression-muzzle", at: 0, shotIndex: 0 },
      { type: "suppression-hit", at: .055, shotIndex: 0 },
    ]),
    frame("attack-a", .074, [
      { type: "suppression-muzzle", at: 0, shotIndex: 1 },
      { type: "suppression-hit", at: .055, shotIndex: 1 },
    ]),
    frame("attack-b", .074, [
      { type: "suppression-muzzle", at: 0, shotIndex: 2 },
      { type: "suppression-hit", at: .055, shotIndex: 2 },
    ]),
    frame("attack-a", .074, [
      { type: "suppression-muzzle", at: 0, shotIndex: 3 },
      { type: "suppression-hit", at: .055, shotIndex: 3 },
    ]),
    frame("attack-b", .074, [
      { type: "suppression-muzzle", at: 0, shotIndex: 4 },
      { type: "suppression-hit", at: .055, shotIndex: 4 },
    ]),
    frame("attack-a", .07, [{ type: "suppression-recover", at: .02 }]),
    frame("idle", .09, [{ type: "suppression-ready", at: .09 }]),
  ]),
  "crazy-king": clip([
    frame("attack-a", .14, [{ type: "chainsaw-prime", at: .02 }]),
    frame("attack-b", .16, [{ type: "chainsaw-rev", at: .03 }]),
    frame("attack-a", .15, [{ type: "chainsaw-engage", at: .15 }]),
    frame("attack-b", .08, [{ type: "chainsaw-recover", at: .02 }]),
    frame("idle", .1, [{ type: "chainsaw-overdrive-ready", at: .1 }]),
  ]),
  tky: clip([
    frame("attack-a", .18, [{ type: "light-blade-charge", at: 0 }]),
    frame("attack-b", .18, [{ type: "light-blade-extend", at: 0 }]),
    frame("attack-a", .14, [{ type: "light-blade-sweep", at: .02 }]),
    frame("attack-b", .12, [{ type: "light-blade-release", at: .12 }]),
    frame("attack-a", .07, [{ type: "light-blade-recover", at: .02 }]),
    frame("idle", .09, [{ type: "light-blade-ready", at: .09 }]),
  ]),
  "mrs-chiha": clip([
    frame("attack-a", .28, [{ type: "launcher-retrieve", at: .02 }]),
    frame("attack-b", .55, [{ type: "launcher-aim", at: .04 }]),
    frame("attack-a", .22, [{ type: "salvo-rotate", at: 0 }, { type: "salvo-shot", at: .22, shotIndex: 0 }]),
    frame("attack-b", .22, [{ type: "salvo-shot", at: .22, shotIndex: 1 }]),
    frame("attack-a", .22, [{ type: "salvo-shot", at: .22, shotIndex: 2 }]),
    frame("attack-b", .22, [{ type: "salvo-shot", at: .22, shotIndex: 3 }]),
    frame("attack-b", .18, [{ type: "salvo-final-impact", at: .18 }]),
    frame("attack-a", .18, [{ type: "launcher-stow", at: .02 }]),
    frame("idle", .12, [{ type: "launcher-ready", at: .12 }]),
  ]),
  "miyamoto-musashi": clip([
    frame("attack-a", .22, [{ type: "cross-guard-ready", at: .02 }]),
    frame("attack-b", .36, [{ type: "cross-guard-hold", at: 0 }]),
    frame("attack-a", .08, [{ type: "cross-cut-release", at: .02 }]),
    frame("attack-b", .06, [{ type: "cross-cut-impact", at: .04 }]),
    frame("idle", .04, [{ type: "cross-cut-ready", at: .04 }]),
  ]),
  "mayo-chan": clip([
    frame("attack-a", .1, [{ type: "feral-surge", at: 0 }]),
    frame("attack-b", .12, [{ type: "infection-bloom", at: .04 }]),
    frame("walk-a", .08, [{ type: "feral-rush", at: .08 }]),
    frame("attack-b", .07, [{ type: "feral-recover", at: .02 }]),
    frame("idle", .09, [{ type: "feral-ready", at: .09 }]),
  ], { movement: true }),
};

const REMAINING_MANUAL_ABILITY_SPECIAL_CLIPS = {
  brawler: clip([
    frame("attack-a", .08, [{ type: "fist-combo-brace", at: .02 }]),
    frame("attack-b", .035, [{ type: "fist-combo-hit", at: .025, hitIndex: 0 }]),
    frame("attack-a", .035, [{ type: "fist-combo-hit", at: .025, hitIndex: 1 }]),
    frame("attack-b", .035, [{ type: "fist-combo-hit", at: .025, hitIndex: 2 }]),
    frame("attack-a", .035, [{ type: "fist-combo-hit", at: .025, hitIndex: 3 }]),
    frame("attack-b", .04, [{ type: "fist-combo-finish", at: .035, hitIndex: 4 }]),
    frame("attack-a", .06, [{ type: "fist-combo-recover", at: .02 }]),
    frame("idle", .08, [{ type: "fist-combo-ready", at: .08 }]),
  ], { movement: true }),
  ranger: clip([
    frame("attack-a", .28, [{ type: "precision-kneel", at: .02 }]),
    frame("attack-b", .22, [{ type: "precision-lock", at: .11 }]),
    frame("attack-b", .06, [{ type: "precision-shot", at: .01 }]),
    frame("attack-a", .08, [{ type: "precision-bolt", at: .03 }]),
    frame("idle", .1, [{ type: "precision-ready", at: .1 }]),
  ]),
  medic: clip([
    frame("attack-a", .19, [{ type: "triage-scan", at: .02 }]),
    frame("attack-b", .16, [{ type: "triage-apply", at: .14 }]),
    frame("attack-a", .07, [{ type: "triage-stow", at: .02 }]),
    frame("idle", .09, [{ type: "triage-ready", at: .09 }]),
  ]),
  brute: clip([
    frame("attack-a", .3, [{ type: "ground-breaker-lift", at: .02 }]),
    frame("walk-a", .12, [{ type: "ground-breaker-step", at: .05 }]),
    frame("attack-b", .13, [{ type: "ground-breaker-impact", at: .12 }]),
    frame("attack-a", .1, [{ type: "ground-breaker-extract", at: .03 }]),
    frame("idle", .12, [{ type: "ground-breaker-ready", at: .12 }]),
  ], { movement: true }),
  kumaverson: clip([
    frame("attack-a", .18, [{ type: "pan-guard-plant", at: .02 }]),
    frame("attack-b", .17, [{ type: "pan-guard-lock", at: .15 }]),
    frame("attack-b", .1, [{ type: "pan-guard-flare", at: .02 }]),
    frame("attack-a", .08, [{ type: "pan-guard-recover", at: .02 }]),
    frame("idle", .1, [{ type: "pan-guard-ready", at: .1 }]),
  ]),
  babayaga: clip([
    frame("attack-a", .22, [{ type: "audit-sight", at: .02 }]),
    frame("attack-b", .18, [{ type: "audit-lock", at: .16 }]),
    frame("attack-b", .055, [{ type: "audit-shot", at: .01 }]),
    frame("attack-a", .07, [{ type: "audit-cycle", at: .025 }]),
    frame("idle", .09, [{ type: "audit-ready", at: .09 }]),
  ]),
  guardian: clip([
    frame("attack-a", .22, [{ type: "shield-wall-brace", at: .02 }]),
    frame("walk-a", .1, [{ type: "shield-wall-step", at: .06 }]),
    frame("attack-b", .13, [{ type: "shield-wall-lock", at: .11 }]),
    frame("attack-a", .09, [{ type: "shield-wall-recover", at: .025 }]),
    frame("idle", .11, [{ type: "shield-wall-ready", at: .11 }]),
  ]),
  engineer: clip([
    frame("attack-a", .18, [{ type: "trap-prime", at: .02 }]),
    frame("walk-a", .08, [{ type: "trap-step", at: .04 }]),
    frame("attack-b", .09, [{ type: "trap-deploy", at: .08 }]),
    frame("attack-a", .07, [{ type: "trap-check", at: .02 }]),
    frame("idle", .09, [{ type: "trap-ready", at: .09 }]),
  ], { movement: true }),
  zakimiya: clip([
    frame("attack-a", .29, [{ type: "fire-bottle-light", at: .03 }]),
    frame("walk-a", .11, [{ type: "fire-bottle-step", at: .06 }]),
    frame("attack-b", .16, [{ type: "fire-bottle-throw", at: .14 }]),
    frame("attack-a", .09, [{ type: "fire-bottle-follow", at: .025 }]),
    frame("idle", .11, [{ type: "fire-bottle-ready", at: .11 }]),
  ], { movement: true }),
};

const authoredPlayableClips = ({
  prefix,
  idle = .24,
  stride = .1,
  windup = .12,
  active = .08,
  recovery = .15,
  heavy = false,
  movement = false,
}) => ({
  idle: clip([
    frame("idle", idle),
    frame("idle", idle * .78, [{ type: `${prefix}-ready-shift`, at: idle * .31 }]),
  ], { loop: true }),
  move: clip([
    frame("walk-a", stride, [{ type: heavy ? "footstep-heavy" : "footstep", at: stride * .7 }]),
    frame("walk-b", stride * 1.08),
    frame("walk-a", stride * .9, [{ type: `${prefix}-gear`, at: stride * .44 }]),
  ], { loop: true, movement: true }),
  "wind-up": clip([
    frame("attack-a", windup, [{ type: `${prefix}-ready`, at: Math.min(.02, windup * .2) }]),
  ]),
  active: clip([
    frame("attack-b", active, [
      { type: `${prefix}-contact`, at: 0 },
      { type: "weapon-vfx", at: 0 },
    ]),
  ], { movement }),
  recovery: clip([
    frame("attack-a", recovery * .48, [{ type: `${prefix}-recover`, at: recovery * .14 }]),
    frame("idle", recovery * .52, [{ type: `${prefix}-reacquire`, at: recovery * .36 }]),
  ], { recovery: true }),
});

const REMAINING_TEN_CLIP_OVERRIDES = {
  brawler: authoredPlayableClips({
    prefix: "fist", idle: .2, stride: .08, windup: .085, active: .08, recovery: .11, movement: true,
  }),
  ranger: authoredPlayableClips({
    prefix: "rifle", idle: .31, stride: .125, windup: .15, active: .1, recovery: .18,
  }),
  medic: authoredPlayableClips({
    prefix: "medical-rifle", idle: .27, stride: .11, windup: .13, active: .1, recovery: .16,
  }),
  brute: authoredPlayableClips({
    prefix: "hammer", idle: .3, stride: .14, windup: .19, active: .11, recovery: .22, heavy: true, movement: true,
  }),
  kumaverson: authoredPlayableClips({
    prefix: "iron-pan", idle: .25, stride: .12, windup: .15, active: .09, recovery: .18, heavy: true,
  }),
  babayaga: authoredPlayableClips({
    prefix: "suppressed-pistol", idle: .33, stride: .115, windup: .14, active: .09, recovery: .16,
  }),
  guardian: authoredPlayableClips({
    prefix: "shield", idle: .32, stride: .145, windup: .18, active: .1, recovery: .2, heavy: true, movement: true,
  }),
  engineer: authoredPlayableClips({
    prefix: "carbine", idle: .26, stride: .105, windup: .115, active: .09, recovery: .15,
  }),
  zakimiya: authoredPlayableClips({
    prefix: "pan", idle: .22, stride: .1, windup: .12, active: .1, recovery: .19, movement: true,
  }),
  "miyamoto-musashi": authoredPlayableClips({
    prefix: "dual-katana", idle: .29, stride: .095, windup: .13, active: .1, recovery: .18, movement: true,
  }),
};

const REPRESENTATIVE_CLIP_OVERRIDES = {
  scout: {
    idle: clip([
      frame("idle", .2),
      frame("idle", .16, [{ type: "ready-shift", at: .08 }]),
    ], { loop: true }),
    move: clip([
      frame("walk-a", .075, [{ type: "footstep", at: .055 }]),
      frame("walk-b", .075),
      frame("walk-a", .065, [{ type: "gear-rattle", at: .04 }]),
    ], { loop: true, movement: true }),
    "wind-up": clip([
      frame("attack-a", .105, [{ type: "crowbar-ready", at: .015 }]),
    ]),
    active: clip([
      frame("attack-b", .075, [{ type: "crowbar-impact", at: 0 }, { type: "weapon-vfx", at: 0 }]),
    ]),
    recovery: clip([
      frame("attack-a", .06),
      frame("idle", .065, [{ type: "reacquire", at: .03 }]),
    ], { recovery: true }),
  },
  gunner: {
    idle: clip([
      frame("idle", .28),
      frame("idle", .24, [{ type: "aim-check", at: .1 }]),
    ], { loop: true }),
    move: clip([
      frame("walk-a", .13, [{ type: "footstep", at: .095 }]),
      frame("walk-b", .14),
      frame("walk-a", .12),
    ], { loop: true, movement: true }),
    "wind-up": clip([
      frame("attack-a", .11, [{ type: "machine-gun-shoulder", at: .02 }]),
    ]),
    active: MACHINE_GUN_ACTIVE,
    recovery: MACHINE_GUN_RECOVERY,
    reload: clip([
      frame("attack-a", .13, [{ type: "feed-cover-open", at: .025 }]),
      frame("attack-b", .18, [{ type: "belt-seat", at: .08 }]),
      frame("attack-a", .13, [{ type: "feed-cover-lock", at: .055 }]),
      frame("idle", .1, [{ type: "reload-ready", at: .045 }]),
    ], { recovery: true }),
  },
  "crazy-king": {
    idle: clip([
      frame("idle", .2),
      frame("idle", .18, [{ type: "engine-idle", at: .06 }]),
    ], { loop: true }),
    move: clip([
      frame("walk-a", .105, [{ type: "footstep-heavy", at: .075 }]),
      frame("walk-b", .115),
      frame("walk-a", .095),
    ], { loop: true, movement: true }),
    "wind-up": clip([
      frame("attack-a", .12, [{ type: "chainsaw-lift", at: .015 }]),
    ]),
    active: clip([
      frame("attack-b", .09, [
        { type: "chainsaw-contact", at: 0 },
        { type: "weapon-vfx", at: 0 },
      ]),
    ]),
    recovery: clip([
      frame("attack-b", .055, [{ type: "chainsaw-extract", at: .025 }]),
      frame("attack-a", .065),
      frame("idle", .065, [{ type: "engine-settle", at: .03 }]),
    ], { recovery: true }),
  },
  tky: {
    idle: clip([
      frame("idle", .3),
      frame("idle", .22, [{ type: "blade-hum", at: .08 }]),
    ], { loop: true }),
    move: clip([
      frame("walk-a", .105, [{ type: "footstep", at: .075 }]),
      frame("walk-b", .115),
      frame("walk-a", .1),
    ], { loop: true, movement: true }),
    "wind-up": clip([
      frame("attack-a", .12, [{ type: "plasma-guard", at: .02 }]),
    ]),
    active: clip([
      frame("attack-b", .08, [{ type: "blade-first-contact", at: 0 }, { type: "weapon-vfx", at: 0 }]),
      frame("attack-a", .08, [{ type: "blade-second-contact", at: .08 }]),
    ]),
    recovery: clip([
      frame("attack-b", .08, [{ type: "blade-decelerate", at: .02 }]),
      frame("idle", .09),
    ], { recovery: true }),
  },
  "mrs-chiha": {
    idle: clip([
      frame("idle", .31),
      frame("idle", .25, [{ type: "launcher-balance", at: .08 }]),
    ], { loop: true }),
    move: clip([
      frame("walk-a", .14, [{ type: "footstep", at: .1 }]),
      frame("walk-b", .15),
      frame("walk-a", .13),
    ], { loop: true, movement: true }),
    active: MRS_CHIHA_ATTACK_ACTIVE,
    recovery: MRS_CHIHA_ATTACK_RECOVERY,
    "weapon-cycle": clip([
      frame("attack-b", .14, [{ type: "cylinder-index", at: .04 }]),
      frame("attack-a", .12, [{ type: "launcher-check", at: .055 }]),
      frame("idle", .1),
    ], { recovery: true }),
  },
  "mayo-chan": {
    idle: clip([
      frame("idle", .18),
      frame("idle", .14, [{ type: "alert-sniff", at: .055 }]),
    ], { loop: true }),
    move: clip([
      frame("walk-a", .075, [{ type: "paw-contact", at: .05 }]),
      frame("walk-b", .08),
      frame("walk-a", .07, [{ type: "paw-contact", at: .05 }]),
    ], { loop: true, movement: true }),
    "wind-up": clip([
      frame("attack-a", .075, [{ type: "bite-crouch", at: .015 }]),
    ]),
    active: clip([
      frame("attack-b", .08, [{ type: "bite-contact", at: 0 }, { type: "weapon-vfx", at: 0 }]),
    ]),
    recovery: clip([
      frame("walk-a", .055),
      frame("idle", .075, [{ type: "bite-reset", at: .03 }]),
    ], { recovery: true }),
    retreat: clip([
      frame("walk-a", .065, [{ type: "retreat-paw", at: .045 }]),
      frame("walk-b", .07),
    ], { loop: true, movement: true }),
  },
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
    const manualSpecial = MANUAL_ABILITY_SPECIAL_CLIPS[kind]
      ?? REMAINING_MANUAL_ABILITY_SPECIAL_CLIPS[kind];
    const source = REMAINING_TEN_CLIP_OVERRIDES[kind]?.[state]
      ?? REPRESENTATIVE_CLIP_OVERRIDES[kind]?.[state]
      ?? (state === "special" && manualSpecial
        ? manualSpecial
        : OPTIONAL_CLIPS[state]
          ?? STANDARD_CLIPS[COMBAT_CLIP_FALLBACKS[state]]
          ?? STANDARD_CLIPS[state]);
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
  crowbar: {
    id: "crowbar",
    trail: "hooked-crowbar-arc",
    trailColor: "#7ee7e4",
    impact: "crowbar-snap",
    impactRadius: 11,
    hitStopSeconds: .038,
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
    projectileTravelSeconds: .12,
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
    projectileTravelSeconds: .12,
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
    projectileTravelSeconds: .12,
  },
  crossbow: {
    id: "crossbow",
    trail: "bolt",
    trailColor: "#8bd7d9",
    impact: "precision-burst",
    impactRadius: 8,
    hitStopSeconds: .022,
    recoil: .08,
    casing: false,
    damageWeights: [1],
    shotOffsetsSeconds: [0],
    projectileTravelSeconds: .12,
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
    projectileTravelSeconds: .12,
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
  scout: "crowbar",
  ranger: "rifle",
  brute: "blunt",
  gunner: "machine-gun",
  medic: "heal-support",
  "crazy-king": "chainsaw",
  kumaverson: "blunt",
  babayaga: "sniper",
  guardian: "blunt",
  engineer: "crossbow",
  zakimiya: "blunt",
  tky: "plasma-blade",
  "mrs-chiha": "grenade",
  "miyamoto-musashi": "dual-katana",
  "mayo-chan": "bite",
});

export const COMBAT_WEAPON_ANCHORS = deepFreeze({
  brawler: { forward: 13, up: 34 },
  scout: { forward: 25, up: 34 },
  ranger: { forward: 22, up: 42 },
  medic: { forward: 18, up: 38 },
  brute: { forward: 18, up: 31 },
  gunner: { forward: 31, up: 40 },
  guardian: { forward: 16, up: 34 },
  engineer: { forward: 20, up: 39 },
  "crazy-king": { forward: 31, up: 28 },
  kumaverson: { forward: 18, up: 32 },
  babayaga: { forward: 23, up: 43 },
  zakimiya: { forward: 17, up: 32 },
  tky: { forward: 32, up: 44 },
  "mrs-chiha": { forward: 34, up: 42 },
  "miyamoto-musashi": { forward: 19, up: 34 },
  "mayo-chan": { forward: 18, up: 24 },
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

function semanticProceduralPose(state, progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const pulse = Math.sin(Math.PI * p);
  switch (state) {
    case "deploy":
      // Door and ramp geometry own deployment occlusion. Fading the sprite
      // here makes the revealed body blend through the CRAWLER and stage.
      return { offsetX: -2.2 * (1 - p), offsetY: 0, rotationRadians: -.035 * (1 - p), scaleX: .96 + .04 * p, scaleY: .88 + .12 * p, opacity: 1 };
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

const REMAINING_TEN_POSE_TUNING = Object.freeze({
  brawler: { stride: 2.5, lean: .075, recoil: 3.8, brace: .065, special: 5.2 },
  ranger: { stride: .8, lean: .018, recoil: -3.6, brace: .028, special: -4.4 },
  medic: { stride: 1, lean: .022, recoil: -2.2, brace: .032, special: 1.2 },
  brute: { stride: 1.4, lean: .052, recoil: 4.7, brace: .09, special: 5.8 },
  kumaverson: { stride: 1.1, lean: .038, recoil: -1.2, brace: .055, special: -2.8 },
  babayaga: { stride: .72, lean: .014, recoil: -3, brace: .02, special: -3.6 },
  guardian: { stride: .9, lean: .032, recoil: 2.2, brace: .07, special: 3.1 },
  engineer: { stride: 1.15, lean: .028, recoil: -2.7, brace: .035, special: 3.8 },
  zakimiya: { stride: 1.75, lean: .045, recoil: 4.1, brace: .06, special: 5 },
  "miyamoto-musashi": { stride: 1.9, lean: .055, recoil: 4.8, brace: .072, special: 6.2 },
});

const LOCOMOTION_POSE_TUNING = Object.freeze({
  scout: { stride: 2.4, lean: .046 },
  ranger: { stride: 1.75, lean: .031 },
  brute: { stride: 1.8, lean: .052 },
  brawler: { stride: 2.7, lean: .068 },
  gunner: { stride: 1.9, lean: .036 },
  medic: { stride: 1.85, lean: .034 },
  "crazy-king": { stride: 2.05, lean: .043 },
  kumaverson: { stride: 1.75, lean: .044 },
  babayaga: { stride: 1.8, lean: .032 },
  guardian: { stride: 1.7, lean: .041 },
  engineer: { stride: 1.85, lean: .036 },
  zakimiya: { stride: 2.05, lean: .049 },
  tky: { stride: 2.15, lean: .047 },
  "mrs-chiha": { stride: 1.8, lean: .034 },
  "miyamoto-musashi": { stride: 2.25, lean: .058 },
  "mayo-chan": { stride: 2.9, lean: .064 },
});

const LOCOMOTION_STRIDE_DISTANCE = Object.freeze({
  scout: 12,
  ranger: 14,
  brute: 17,
  brawler: 13,
  gunner: 16,
  medic: 15,
  "crazy-king": 14,
  kumaverson: 17,
  babayaga: 15,
  guardian: 17,
  engineer: 15,
  zakimiya: 14,
  tky: 13,
  "mrs-chiha": 16,
  "miyamoto-musashi": 13,
  "mayo-chan": 9,
});

function playableProceduralPose(kind, state, progress) {
  if (!PLAYABLE_COMBAT_KINDS.includes(kind)) return null;
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const pulse = Math.sin(Math.PI * p);
  const stride = Math.sin(Math.PI * p * 2);
  const rapid = Math.sin(Math.PI * p * 10);
  const locomotion = LOCOMOTION_POSE_TUNING[kind];
  if (state === "move" && locomotion) {
    const contact = Math.abs(Math.cos(Math.PI * p * 2));
    return {
      offsetX: locomotion.stride * stride,
      offsetY: 0,
      rotationRadians: locomotion.lean * stride,
      scaleX: 1.012 + (1 - contact) * .018,
      scaleY: .988 - (1 - contact) * .018,
      opacity: 1,
    };
  }
  const tuning = REMAINING_TEN_POSE_TUNING[kind];
  if (tuning) {
    if (state === "idle") {
      return {
        offsetX: .22 * tuning.stride * pulse,
        offsetY: 0,
        rotationRadians: -.006 * tuning.lean / .05 * pulse,
        scaleX: 1 + .007 * pulse,
        scaleY: 1 - .009 * pulse,
        opacity: 1,
      };
    }
    if (state === "move") {
      return {
        offsetX: tuning.stride * stride,
        offsetY: 0,
        rotationRadians: tuning.lean + tuning.lean * .28 * stride,
        scaleX: 1.015 + Math.abs(tuning.lean) * .18,
        scaleY: .985 - Math.abs(tuning.lean) * .12,
        opacity: 1,
      };
    }
    if (state === "wind-up") {
      return {
        offsetX: -Math.abs(tuning.recoil) * .62 * pulse,
        offsetY: 0,
        rotationRadians: -tuning.brace * pulse,
        scaleX: 1.018,
        scaleY: .982,
        opacity: 1,
      };
    }
    if (state === "active") {
      return {
        offsetX: tuning.recoil * (1 - p),
        offsetY: 0,
        rotationRadians: tuning.lean * 1.35 * (1 - p),
        scaleX: 1.035,
        scaleY: .965,
        opacity: 1,
      };
    }
    if (state === "recovery") {
      return {
        offsetX: tuning.recoil * .38 * (1 - p),
        offsetY: 0,
        rotationRadians: tuning.lean * .55 * (1 - p),
        scaleX: 1.012,
        scaleY: .988,
        opacity: 1,
      };
    }
    if (state === "special") {
      const release = Math.max(0, (p - .45) / .55);
      return {
        offsetX: tuning.special * (pulse * .55 + release * .45),
        offsetY: 0,
        rotationRadians: tuning.brace * (pulse + release * .45),
        scaleX: 1 + .045 * pulse,
        scaleY: 1 - .035 * pulse,
        opacity: 1,
      };
    }
  }
  if (kind === "scout") {
    if (state === "idle") return { offsetX: -.35 * pulse, offsetY: 0, rotationRadians: -.008 * pulse, scaleX: 1 + .008 * pulse, scaleY: 1 - .012 * pulse, opacity: 1 };
    if (state === "move") return { offsetX: 2.2 * stride, offsetY: 0, rotationRadians: .042 + .012 * stride, scaleX: 1.035, scaleY: .965, opacity: 1 };
    if (state === "wind-up") return { offsetX: -2.8 * pulse, offsetY: 0, rotationRadians: -.07 * pulse, scaleX: 1.02, scaleY: .98, opacity: 1 };
    if (state === "active") return { offsetX: 5.4 * (1 - p), offsetY: 0, rotationRadians: .09 * (1 - p), scaleX: 1.055, scaleY: .95, opacity: 1 };
    if (state === "recovery") return { offsetX: 1.8 * (1 - p), offsetY: 0, rotationRadians: .035 * (1 - p), scaleX: 1.015, scaleY: .985, opacity: 1 };
    if (state === "special") return { offsetX: 6.5 * pulse, offsetY: 0, rotationRadians: .08 * pulse, scaleX: 1.065, scaleY: .94, opacity: 1 };
  }
  if (kind === "gunner") {
    if (state === "idle") return { offsetX: 0, offsetY: 0, rotationRadians: -.006 * pulse, scaleX: 1, scaleY: 1 - .008 * pulse, opacity: 1 };
    if (state === "move") return { offsetX: .65 * stride, offsetY: 0, rotationRadians: .012 * stride, scaleX: 1.005, scaleY: .995, opacity: 1 };
    if (state === "wind-up") return { offsetX: -1.2 * (1 - p), offsetY: 0, rotationRadians: -.02 * (1 - p), scaleX: 1, scaleY: 1, opacity: 1 };
    if (state === "active") return { offsetX: -3.4 * Math.max(0, rapid), offsetY: 0, rotationRadians: -.035 * Math.max(0, rapid), scaleX: 1.012, scaleY: .988, opacity: 1 };
    if (state === "recovery") return { offsetX: -1.5 * (1 - p), offsetY: 0, rotationRadians: -.018 * (1 - p), scaleX: 1, scaleY: 1, opacity: 1 };
    if (state === "special") return { offsetX: -3.8 * Math.max(0, rapid), offsetY: 0, rotationRadians: -.04 * Math.max(0, rapid), scaleX: 1.018, scaleY: .982, opacity: 1 };
  }
  if (kind === "crazy-king") {
    if (state === "idle") return { offsetX: .35 * rapid, offsetY: 0, rotationRadians: .008 * rapid, scaleX: 1.005, scaleY: .995, opacity: 1 };
    if (state === "move") return { offsetX: 1.45 * stride, offsetY: 0, rotationRadians: .025 + .016 * stride, scaleX: 1.025, scaleY: .975, opacity: 1 };
    if (state === "wind-up") return { offsetX: -2.2 * pulse, offsetY: 0, rotationRadians: -.065 * pulse, scaleX: 1.025, scaleY: .975, opacity: 1 };
    if (state === "active") return { offsetX: 4.6 * (1 - p), offsetY: 0, rotationRadians: .075 * (1 - p), scaleX: 1.045, scaleY: .955, opacity: 1 };
    if (state === "recovery") return { offsetX: 2 * (1 - p), offsetY: 0, rotationRadians: .035 * (1 - p), scaleX: 1.02, scaleY: .98, opacity: 1 };
    if (state === "special") return { offsetX: .8 * rapid + 2.4 * p, offsetY: 0, rotationRadians: .018 * rapid + .035 * p, scaleX: 1.025 + .02 * pulse, scaleY: .975, opacity: 1 };
  }
  if (kind === "tky") {
    if (state === "idle") return { offsetX: 0, offsetY: 0, rotationRadians: -.006 * pulse, scaleX: 1 + .008 * pulse, scaleY: 1 - .01 * pulse, opacity: 1 };
    if (state === "move") return { offsetX: 1.1 * stride, offsetY: 0, rotationRadians: .018 * stride, scaleX: 1.012, scaleY: .988, opacity: 1 };
    if (state === "wind-up") return { offsetX: -2.1 * pulse, offsetY: 0, rotationRadians: -.055 * pulse, scaleX: 1.02, scaleY: .98, opacity: 1 };
    if (state === "active") return { offsetX: 4.2 * pulse, offsetY: 0, rotationRadians: .11 * stride, scaleX: 1.045, scaleY: .955, opacity: 1 };
    if (state === "recovery") return { offsetX: 1.5 * (1 - p), offsetY: 0, rotationRadians: .045 * (1 - p), scaleX: 1.015, scaleY: .985, opacity: 1 };
    if (state === "special") {
      const release = Math.max(0, (p - .55) / .45);
      return { offsetX: 5.2 * release, offsetY: 0, rotationRadians: .115 * release, scaleX: 1 + .065 * pulse, scaleY: 1 - .045 * pulse, opacity: 1 };
    }
  }
  if (kind === "mrs-chiha") {
    if (state === "idle") return { offsetX: 0, offsetY: 0, rotationRadians: -.004 * pulse, scaleX: 1, scaleY: 1 - .008 * pulse, opacity: 1 };
    if (state === "move") return { offsetX: .7 * stride, offsetY: 0, rotationRadians: .012 * stride, scaleX: 1.005, scaleY: .995, opacity: 1 };
    if (state === "wind-up") return { offsetX: -1.8 * pulse, offsetY: 0, rotationRadians: -.025 * pulse, scaleX: 1.012, scaleY: .988, opacity: 1 };
    if (state === "active") return { offsetX: -3.8 * Math.max(0, Math.sin(Math.PI * p * 2)), offsetY: 0, rotationRadians: -.04 * pulse, scaleX: 1.02, scaleY: .98, opacity: 1 };
    if (state === "recovery") return { offsetX: -1.6 * (1 - p), offsetY: 0, rotationRadians: -.02 * (1 - p), scaleX: 1.008, scaleY: .992, opacity: 1 };
    if (state === "special") {
      const salvoPulse = Math.max(0, Math.sin(Math.PI * p * 8));
      return { offsetX: -3.6 * salvoPulse, offsetY: 0, rotationRadians: -.038 * salvoPulse, scaleX: 1.015, scaleY: .985, opacity: 1 };
    }
  }
  if (kind === "mayo-chan") {
    if (state === "idle") return { offsetX: .25 * pulse, offsetY: 0, rotationRadians: .006 * pulse, scaleX: 1 + .018 * pulse, scaleY: 1 - .018 * pulse, opacity: 1 };
    if (state === "move") return { offsetX: 2.7 * stride, offsetY: 0, rotationRadians: .055 * stride, scaleX: 1.065, scaleY: .94, opacity: 1 };
    if (state === "wind-up") return { offsetX: -2.4 * pulse, offsetY: 0, rotationRadians: -.075 * pulse, scaleX: 1.04, scaleY: .91, opacity: 1 };
    if (state === "active") return { offsetX: 5.6 * (1 - p), offsetY: 0, rotationRadians: .08 * (1 - p), scaleX: 1.08, scaleY: .91, opacity: 1 };
    if (state === "recovery") return { offsetX: 1.4 * (1 - p), offsetY: 0, rotationRadians: .035 * (1 - p), scaleX: 1.025, scaleY: .975, opacity: 1 };
    if (state === "special") return { offsetX: 3.8 * pulse, offsetY: 0, rotationRadians: .07 * pulse, scaleX: 1.09, scaleY: .9, opacity: 1 };
    if (state === "retreat") return { offsetX: -2.8 * stride, offsetY: 0, rotationRadians: -.06 + .025 * stride, scaleX: 1.07, scaleY: .93, opacity: 1 };
  }
  return null;
}

function combatProceduralPose(kind, state, progress) {
  const pose = playableProceduralPose(kind, state, progress)
    ?? semanticProceduralPose(state, progress);
  if (!PLAYABLE_COMBAT_KINDS.includes(kind) || pose.opacity === 1) return pose;
  return { ...pose, opacity: 1 };
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
        clipElapsedSeconds: local,
        clipProgress: current.durationSeconds > 0 ? local / current.durationSeconds : 0,
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
          kind,
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
    stateTravelDistance: 0,
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
  const stateTravelDistance = state === "move"
    ? stateChanged
      ? movedDistance
      : Math.max(0, Number(previous.stateTravelDistance) || 0) + movedDistance
    : 0;
  if (state === "move") {
    const current = animationClipFor(observation.kind ?? "walker", state);
    const strideDistance = LOCOMOTION_STRIDE_DISTANCE[observation.kind]
      ?? Math.max(10, current.durationSeconds * 44);
    stateElapsed = strideDistance > 0
      ? stateTravelDistance / strideDistance * current.durationSeconds
      : 0;
  }
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
    stateTravelDistance,
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

export function linkedWeaponTransactionId({
  sourceId,
  attackSequence,
  targetKind,
  targetId = null,
  targetObjectId = null,
  shotIndex = 0,
} = {}) {
  return [
    Math.floor(Number(sourceId) || 0),
    Math.floor(Number(attackSequence) || 0),
    String(targetKind ?? "unknown"),
    targetId ?? targetObjectId ?? "none",
    Math.floor(Number(shotIndex) || 0),
  ].join(":");
}

export function cancelPendingWeaponTransaction(events = [], transactionId = null) {
  if (!transactionId) return Object.freeze([...(Array.isArray(events) ? events : [])]);
  return Object.freeze((Array.isArray(events) ? events : []).filter(
    (event) => event?.transactionId !== transactionId,
  ));
}

export function capPendingWeaponTransactions(events = [], maximumEvents = 64) {
  const source = Array.isArray(events) ? events : [];
  const limit = Math.max(0, Math.floor(Number(maximumEvents) || 0));
  if (source.length <= limit) return Object.freeze([...source]);
  if (limit === 0) return Object.freeze([]);
  const selectedIndexes = new Set();
  const selectedTransactions = new Set();
  for (let index = source.length - 1; index >= 0 && selectedIndexes.size < limit; index -= 1) {
    const transactionId = source[index]?.transactionId;
    if (!transactionId) {
      selectedIndexes.add(index);
      continue;
    }
    if (selectedTransactions.has(transactionId)) continue;
    const transactionIndexes = source
      .map((event, eventIndex) => event?.transactionId === transactionId ? eventIndex : -1)
      .filter((eventIndex) => eventIndex >= 0);
    if (selectedIndexes.size > 0 && selectedIndexes.size + transactionIndexes.length > limit) continue;
    for (const transactionIndex of transactionIndexes) selectedIndexes.add(transactionIndex);
    selectedTransactions.add(transactionId);
  }
  return Object.freeze(source.filter((_event, index) => selectedIndexes.has(index)));
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
