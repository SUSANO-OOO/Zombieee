const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

export const V099_PRESENTATION_LIMITS = deepFreeze({
  activeEffects: 24,
  semanticReceipts: 512,
});

export const V099_EXPLOSION_PROFILES = deepFreeze({
  small: {
    durationSeconds: .72, fireballRadius: 24, smokeRadius: 34,
    shockwaveRadius: 44, sparks: 7, debris: 3, flash: .14,
  },
  medium: {
    durationSeconds: 1.05, fireballRadius: 42, smokeRadius: 58,
    shockwaveRadius: 76, sparks: 12, debris: 6, flash: .22,
  },
  large: {
    durationSeconds: 1.42, fireballRadius: 72, smokeRadius: 92,
    shockwaveRadius: 126, sparks: 18, debris: 9, flash: .34,
  },
  boss: {
    durationSeconds: 2.6, fireballRadius: 94, smokeRadius: 132,
    shockwaveRadius: 158, sparks: 24, debris: 14, flash: .4,
  },
});

export const V099_BOSS_DEFEAT_TIMELINE = deepFreeze({
  durationSeconds: V099_EXPLOSION_PROFILES.boss.durationSeconds,
  staggerEnd: .18,
  smallBursts: [
    { at: .22, dx: -26, dy: -46, scale: .48 },
    { at: .42, dx: 24, dy: -28, scale: .56 },
    { at: .61, dx: -8, dy: -66, scale: .64 },
  ],
  mediumBurst: { at: .82, dx: 16, dy: -43, scale: .82 },
  majorBurst: { at: 1.03, dx: 0, dy: -38, scale: 1 },
  residueAt: 1.16,
});

export const V099_BOSS_ENTRANCE_DURATION_SECONDS = 1.6;

const durationFor = (kind, scale) => {
  if (kind === "boss-entrance") return V099_BOSS_ENTRANCE_DURATION_SECONDS;
  if (kind === "boss-defeat") return V099_BOSS_DEFEAT_TIMELINE.durationSeconds;
  return V099_EXPLOSION_PROFILES[scale]?.durationSeconds ?? V099_EXPLOSION_PROFILES.small.durationSeconds;
};

export function createBattlePresentationRuntime(generation = 0) {
  return {
    generation: Math.max(0, Math.trunc(Number(generation) || 0)),
    nextEffectId: 1,
    effects: [],
    semanticReceipts: [],
    rejected: { duplicate: 0, capacity: 0, generation: 0, invalid: 0 },
  };
}

export function resetBattlePresentationRuntime(runtime, generation = null) {
  const nextGeneration = generation === null
    ? Math.max(0, Math.trunc(Number(runtime?.generation) || 0)) + 1
    : Math.max(0, Math.trunc(Number(generation) || 0));
  return createBattlePresentationRuntime(nextGeneration);
}

const rejected = (runtime, reason) => ({
  accepted: false,
  reason,
  runtime: {
    ...runtime,
    rejected: {
      ...runtime.rejected,
      [reason]: (runtime.rejected?.[reason] ?? 0) + 1,
    },
  },
  effect: null,
});

export function queueSemanticBattlePresentation(runtime, input = {}) {
  const current = runtime ?? createBattlePresentationRuntime();
  const receiptId = String(input.receiptId ?? "").trim();
  const semantic = String(input.semantic ?? "").trim();
  const generation = Math.max(0, Math.trunc(Number(input.generation) || 0));
  const x = Number(input.x);
  const y = Number(input.y);
  const kind = input.kind ?? (semantic === "boss-entrance"
    ? "boss-entrance"
    : semantic === "boss-defeat" ? "boss-defeat" : "explosion");
  const scale = kind === "boss-defeat" ? "boss" : input.scale ?? "small";
  if (!receiptId || !semantic || !Number.isFinite(x) || !Number.isFinite(y)
    || !["boss-entrance", "boss-defeat", "explosion"].includes(kind)
    || (kind === "explosion" && !V099_EXPLOSION_PROFILES[scale])) {
    return rejected(current, "invalid");
  }
  if (generation !== current.generation) return rejected(current, "generation");
  if (current.semanticReceipts.includes(receiptId)) return rejected(current, "duplicate");
  if (current.semanticReceipts.length >= V099_PRESENTATION_LIMITS.semanticReceipts
    || current.effects.length >= V099_PRESENTATION_LIMITS.activeEffects) {
    return rejected(current, "capacity");
  }
  const effect = {
    id: current.nextEffectId,
    generation,
    semantic,
    receiptId,
    ownerId: input.ownerId ?? null,
    kind,
    scale,
    x,
    y,
    label: String(input.label ?? ""),
    seed: Math.max(1, Math.trunc(Number(input.seed) || current.nextEffectId * 7919)),
    elapsed: 0,
    duration: durationFor(kind, scale),
  };
  return {
    accepted: true,
    reason: "accepted",
    effect,
    runtime: {
      ...current,
      nextEffectId: current.nextEffectId + 1,
      effects: [...current.effects, effect],
      semanticReceipts: [...current.semanticReceipts, receiptId],
    },
  };
}

export function advanceBattlePresentationRuntime(runtime, seconds = 0) {
  const current = runtime ?? createBattlePresentationRuntime();
  const elapsed = Math.max(0, Number(seconds) || 0);
  if (elapsed === 0 || current.effects.length === 0) return current;
  return {
    ...current,
    effects: current.effects
      .map((effect) => ({ ...effect, elapsed: Math.min(effect.duration, effect.elapsed + elapsed) }))
      .filter((effect) => effect.elapsed < effect.duration),
  };
}

export function battleResultPresentationPending(runtime, {
  enemyBaseCollapsePending = false,
} = {}) {
  return Boolean(enemyBaseCollapsePending)
    || (runtime?.effects ?? []).some((effect) => effect.kind === "boss-defeat");
}

const smoothstep = (value) => {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  return t * t * (3 - 2 * t);
};

export function battlePresentationSnapshot(effect, effectDensity = 1) {
  const density = Math.max(.48, Math.min(1, Number(effectDensity) || 1));
  const progress = Math.max(0, Math.min(1, effect.elapsed / Math.max(.001, effect.duration)));
  if (effect.kind === "boss-entrance") {
    const arrive = smoothstep(Math.min(1, progress / .42));
    const release = 1 - smoothstep(Math.max(0, (progress - .68) / .32));
    return {
      kind: effect.kind,
      progress,
      alpha: Math.min(arrive, release),
      focusRadius: 116 - arrive * 58,
      warningPulse: .55 + Math.sin(effect.elapsed * 24) * .18,
      label: effect.label,
    };
  }
  const profile = V099_EXPLOSION_PROFILES[effect.scale] ?? V099_EXPLOSION_PROFILES.small;
  const ignition = smoothstep(Math.min(1, progress / .16));
  const fireFade = 1 - smoothstep(Math.max(0, (progress - .28) / .42));
  const smokeRise = smoothstep(Math.min(1, progress / .72));
  return {
    kind: effect.kind,
    scale: effect.scale,
    progress,
    fireballRadius: profile.fireballRadius * (.18 + ignition * .82) * Math.max(.28, fireFade),
    fireAlpha: ignition * fireFade,
    smokeRadius: profile.smokeRadius * (.32 + smokeRise * .68),
    smokeAlpha: Math.min(.72, smoothstep(progress / .24)) * (1 - progress * .42),
    shockwaveRadius: profile.shockwaveRadius * smoothstep(Math.min(1, progress / .48)),
    shockwaveAlpha: Math.max(0, .72 - progress * 1.35),
    flashAlpha: profile.flash * Math.max(0, 1 - progress * 5.2),
    sparkCount: Math.max(3, Math.round(profile.sparks * density)),
    debrisCount: Math.max(2, Math.round(profile.debris * density)),
    residueAlpha: effect.kind === "boss-defeat" && effect.elapsed >= V099_BOSS_DEFEAT_TIMELINE.residueAt
      ? Math.min(.7, (effect.elapsed - V099_BOSS_DEFEAT_TIMELINE.residueAt) * .9)
      : 0,
    majorBurstActive: effect.kind === "boss-defeat"
      && effect.elapsed >= V099_BOSS_DEFEAT_TIMELINE.majorBurst.at,
    majorBurstElapsed: effect.kind === "boss-defeat"
      ? Math.max(0, effect.elapsed - V099_BOSS_DEFEAT_TIMELINE.majorBurst.at)
      : 0,
    bossStage: effect.kind !== "boss-defeat" ? null
      : effect.elapsed < V099_BOSS_DEFEAT_TIMELINE.staggerEnd ? "stagger"
        : effect.elapsed < V099_BOSS_DEFEAT_TIMELINE.mediumBurst.at ? "small-chain"
          : effect.elapsed < V099_BOSS_DEFEAT_TIMELINE.majorBurst.at ? "medium"
            : effect.elapsed < V099_BOSS_DEFEAT_TIMELINE.residueAt ? "major"
              : "residue",
  };
}

export function drumArrivalPose({ phase, phaseTime = 0, dropSeconds = .62, impactSeconds = .24 } = {}) {
  if (phase === "dropping") {
    const progress = 1 - Math.max(0, Math.min(1, phaseTime / Math.max(.001, dropSeconds)));
    const eased = smoothstep(progress);
    return {
      airborne: true,
      height: (1 - eased) * 178,
      rotation: (1 - eased) * -.42 + Math.sin(progress * Math.PI * 2) * .08,
      shadowScale: .42 + eased * .58,
      dustAlpha: 0,
      sparkAlpha: 0,
      bounce: 0,
    };
  }
  if (phase === "impact") {
    const progress = 1 - Math.max(0, Math.min(1, phaseTime / Math.max(.001, impactSeconds)));
    return {
      airborne: false,
      height: Math.sin(progress * Math.PI) * 11 * (1 - progress),
      rotation: Math.sin(progress * Math.PI) * .08,
      shadowScale: 1 - Math.sin(progress * Math.PI) * .12,
      dustAlpha: Math.max(0, 1 - progress),
      sparkAlpha: Math.max(0, 1 - progress * 1.45),
      bounce: Math.sin(progress * Math.PI),
    };
  }
  return { airborne: false, height: 0, rotation: 0, shadowScale: 1, dustAlpha: 0, sparkAlpha: 0, bounce: 0 };
}

export function crawlerGroundingSnapshot({ time = 0, phase = "cooldown", effectDensity = 1, movingUnits = 0 } = {}) {
  const density = Math.max(.48, Math.min(1, Number(effectDensity) || 1));
  const firing = phase === "firing";
  const deploying = phase === "deploying";
  const activity = firing ? 1 : deploying ? .62 : Math.min(1, Math.max(0, Number(movingUnits) || 0) / 4);
  return {
    chassisOffsetY: Math.sin(time * 2.3) * .65 + (firing ? Math.sin(time * 42) * .75 : 0),
    suspensionRoll: Math.sin(time * 1.7) * .006 + (firing ? -.012 : 0),
    wheelCompression: [0, 1, 2, 3].map((index) => .94 + Math.sin(time * 2.6 + index * 1.4) * .025),
    contactGlow: .18 + activity * .28,
    dustPuffs: Math.max(1, Math.round((1.5 + activity * 3.5) * density)),
    antennaSwing: Math.sin(time * (firing ? 8 : 3.2)) * (firing ? .08 : .035),
    roofHatchOpen: phase !== "cooldown",
  };
}
