const freezeContract = (value) => Object.freeze({
  ...value,
  timeline: Object.freeze({ ...(value.timeline ?? {}) }),
});

export const V099_READY_AUDIO_CUES = Object.freeze([
  { id: "ability-ready-melee", folder: "sfx", category: "ui", loop: false, gain: 0.62, priority: 64, cooldownMs: 180, maxInstances: 1 },
  { id: "ability-ready-ranged", folder: "sfx", category: "ui", loop: false, gain: 0.60, priority: 64, cooldownMs: 180, maxInstances: 1 },
  { id: "ability-ready-support", folder: "sfx", category: "ui", loop: false, gain: 0.58, priority: 64, cooldownMs: 180, maxInstances: 1 },
]);

export const V099_ABILITY_ROOT_AUDIO_CUES = Object.freeze([
  "ability-brawler-kiai-activate",
  "ability-scout-intercept-activate",
  "ability-ranger-precision-activate",
  "ability-medic-emergency-activate",
  "ability-brute-groundbreak-activate",
  "ability-crazy-king-overdrive-activate",
  "ability-kumaverson-iron-pan-activate",
  "ability-babayaga-appraise-activate",
  "ability-gunner-suppression-activate",
  "ability-guardian-shieldwall-activate",
  "ability-engineer-trap-arm-activate",
  "ability-zakimiya-molotov-activate",
].map((id) => ({
  id,
  folder: "sfx",
  category: "weapons",
  loop: false,
  gain: 0.70,
  priority: 82,
  cooldownMs: 260,
  maxInstances: 1,
})));

export const V099_TIMELINE_AUDIO_CUES = Object.freeze([
  { id: "ability-brawler-kiai-combo-impact", category: "melee", gain: 0.74, priority: 82, cooldownMs: 80, maxInstances: 2 },
  { id: "ability-scout-intercept-impact", category: "melee", gain: 0.70, priority: 82, cooldownMs: 90, maxInstances: 2 },
  { id: "ability-ranger-precision-shot", category: "weapons", gain: 0.72, priority: 82, cooldownMs: 100, maxInstances: 2 },
  { id: "ability-ranger-precision-impact", category: "melee", gain: 0.74, priority: 84, cooldownMs: 90, maxInstances: 2 },
  { id: "ability-medic-treatment", category: "support", gain: 0.60, priority: 76, cooldownMs: 180, maxInstances: 1 },
  { id: "ability-brute-groundbreak-impact", category: "melee", gain: 0.80, priority: 86, cooldownMs: 120, maxInstances: 2 },
  { id: "ability-crazy-king-overdrive-active", category: "weapons", gain: 0.64, priority: 78, cooldownMs: 260, maxInstances: 1 },
  { id: "ability-kumaverson-stance", category: "melee", gain: 0.64, priority: 78, cooldownMs: 260, maxInstances: 1 },
  { id: "ability-babayaga-appraise-shot", category: "weapons", gain: 0.70, priority: 82, cooldownMs: 100, maxInstances: 2 },
  { id: "ability-babayaga-appraise-mark", category: "support", gain: 0.60, priority: 76, cooldownMs: 180, maxInstances: 1 },
  { id: "ability-gunner-suppression-muzzle", category: "weapons", gain: 0.66, priority: 78, cooldownMs: 74, maxInstances: 2 },
  { id: "ability-gunner-suppression-impact", category: "weapons", gain: 0.68, priority: 80, cooldownMs: 90, maxInstances: 2 },
  { id: "ability-guardian-shieldwall-hold", category: "support", gain: 0.62, priority: 78, cooldownMs: 220, maxInstances: 1 },
  { id: "ability-engineer-trap-spring", category: "support", gain: 0.62, priority: 78, cooldownMs: 160, maxInstances: 1 },
  { id: "ability-zakimiya-molotov-throw", category: "weapons", gain: 0.66, priority: 80, cooldownMs: 140, maxInstances: 1 },
  { id: "ability-zakimiya-molotov-impact", category: "weapons", gain: 0.76, priority: 84, cooldownMs: 120, maxInstances: 2 },
  { id: "ability-zakimiya-molotov-burn", category: "support", gain: 0.64, priority: 76, cooldownMs: 220, maxInstances: 1 },
  { id: "ability-musashi-fallback-cross", category: "melee", gain: 0.78, priority: 86, cooldownMs: 140, maxInstances: 1 },
].map((spec) => ({
  folder: "sfx",
  loop: false,
  ...spec,
})));

export const V099_MUSIC_AUDIO_CUES = Object.freeze([
  { id: "music-v099-pressure-surface", folder: "music", category: "bgm", loop: true, gain: 0.64, priority: 900, cooldownMs: 0, maxInstances: 1 },
  { id: "music-v099-pressure-station", folder: "music", category: "bgm", loop: true, gain: 0.66, priority: 900, cooldownMs: 0, maxInstances: 1 },
  { id: "music-v099-boss", folder: "music", category: "bgm", loop: true, gain: 0.70, priority: 900, cooldownMs: 0, maxInstances: 1 },
]);

export const V099_BATTLE_AUDIO_ASSET_SPECS = Object.freeze([
  ...V099_MUSIC_AUDIO_CUES,
  ...V099_ABILITY_ROOT_AUDIO_CUES,
  ...V099_TIMELINE_AUDIO_CUES,
  ...V099_READY_AUDIO_CUES,
].map((spec) => Object.freeze({ ...spec })));

export function v099AudioSource(spec) {
  return [{
    src: `/audio/v099/${spec.folder}/${spec.id}.mp3`,
    type: "audio/mpeg",
  }];
}

export const V099_MANUAL_ABILITY_AUDIO_CONTRACTS = Object.freeze({
  brawler: freezeContract({ readyCue: "ability-ready-melee", activationRoot: "ability-brawler-kiai-activate", timeline: { impact: "ability-brawler-kiai-combo-impact" } }),
  scout: freezeContract({ readyCue: "ability-ready-melee", activationRoot: "ability-scout-intercept-activate", timeline: { impact: "ability-scout-intercept-impact" } }),
  ranger: freezeContract({ readyCue: "ability-ready-ranged", activationRoot: "ability-ranger-precision-activate", timeline: { shot: "ability-ranger-precision-shot", impact: "ability-ranger-precision-impact" } }),
  medic: freezeContract({ readyCue: "ability-ready-support", activationRoot: "ability-medic-emergency-activate", timeline: { success: "ability-medic-treatment" } }),
  brute: freezeContract({ readyCue: "ability-ready-melee", activationRoot: "ability-brute-groundbreak-activate", timeline: { impact: "ability-brute-groundbreak-impact" } }),
  "crazy-king": freezeContract({ readyCue: "ability-ready-melee", activationRoot: "ability-crazy-king-overdrive-activate", timeline: { active: "ability-crazy-king-overdrive-active" } }),
  kumaverson: freezeContract({ readyCue: "ability-ready-support", activationRoot: "ability-kumaverson-iron-pan-activate", timeline: { stance: "ability-kumaverson-stance" } }),
  babayaga: freezeContract({ readyCue: "ability-ready-ranged", activationRoot: "ability-babayaga-appraise-activate", timeline: { shot: "ability-babayaga-appraise-shot", mark: "ability-babayaga-appraise-mark" } }),
  gunner: freezeContract({ readyCue: "ability-ready-ranged", activationRoot: "ability-gunner-suppression-activate", timeline: { muzzle: "ability-gunner-suppression-muzzle", impact: "ability-gunner-suppression-impact" } }),
  guardian: freezeContract({ readyCue: "ability-ready-support", activationRoot: "ability-guardian-shieldwall-activate", timeline: { hold: "ability-guardian-shieldwall-hold" } }),
  engineer: freezeContract({ readyCue: "ability-ready-support", activationRoot: "ability-engineer-trap-arm-activate", timeline: { spring: "ability-engineer-trap-spring" } }),
  zakimiya: freezeContract({ readyCue: "ability-ready-ranged", activationRoot: "ability-zakimiya-molotov-activate", timeline: { throw: "ability-zakimiya-molotov-throw", impact: "ability-zakimiya-molotov-impact", burn: "ability-zakimiya-molotov-burn" } }),
  tky: freezeContract({ readyCue: "ability-ready-melee", activationRoot: "ability-tky-light-blade-charge", timeline: { release: "ability-tky-light-blade-release", impact: "ability-tky-light-blade-impact" } }),
  "mrs-chiha": freezeContract({ readyCue: "ability-ready-ranged", activationRoot: "ability-mrs-chiha-salvo-activate", timeline: { cylinder: "ability-mrs-chiha-salvo-cylinder", shot: "ability-mrs-chiha-salvo-shot", flight: "weapon-mrs-chiha-grenade-flight", impact: "ability-mrs-chiha-salvo-impact", final: "ability-mrs-chiha-salvo-final", stow: "weapon-mrs-chiha-launcher-stow" } }),
  "miyamoto-musashi": freezeContract({ readyCue: "ability-ready-melee", activationRoot: "ability-musashi-cross-guard", timeline: { counter: "ability-musashi-counter", fallbackCross: "ability-musashi-fallback-cross" } }),
  "mayo-chan": freezeContract({ readyCue: "ability-ready-support", activationRoot: "ability-mayo-feral-start", timeline: { rush: "ability-mayo-feral-rush", end: "ability-mayo-feral-end" } }),
});

export const V099_SUPPORT_POD_AUDIO_CONTRACT = Object.freeze({
  inbound: "support-pod-inbound",
  landing: "support-pod-landing-impact",
  activation: "support-pod-activation",
  complete: "support-pod-complete",
});

export const V099_ABILITY_UNIT_KINDS = Object.freeze(Object.keys(V099_MANUAL_ABILITY_AUDIO_CONTRACTS));

export const V099_PHYSICAL_AUDIO_ASSET_COUNT = 36;
