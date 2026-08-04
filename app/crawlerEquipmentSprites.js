const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

export const CRAWLER_BARRAGE_SPRITE_PHASES = deepFreeze([
  "stowed",
  "hatch-open",
  "turret-rise",
  "aim",
  "firing",
  "recoil",
  "retract",
]);

export const CRAWLER_AIRSTRIKE_SPRITE_PHASES = deepFreeze([
  "stowed",
  "mast-deploy",
  "antenna-extend",
  "targeting",
  "inbound-signal",
  "impact-confirmation",
  "retract",
]);

export const V099_CRAWLER_RUNTIME_PROFILE = deepFreeze({
  revision: "v1",
  identityMaster: {
    path: "/art/v075/crawler/crawler-command-base-identity-r1.png",
    revision: "r1",
  },
  equipmentHost: {
    closed: {
      path: "/art/v099/crawler/crawler-command-base-closed-equipment-host-v1.png",
      revision: "v1",
      frame: { width: 1536, height: 1024 },
    },
  },
  deployment: {
    baseInterior: {
      path: "/art/v099/crawler/crawler-deployment-base-interior-v1.png",
      revision: "v1",
      frame: { width: 1536, height: 1024 },
    },
    foregroundMask: {
      path: "/art/v099/crawler/crawler-deployment-foreground-mask-v1.png",
      revision: "v1",
      frame: { width: 1536, height: 1024 },
    },
    sourceCrop: { x: 25, y: 90, width: 1486, height: 821 },
    doorwayInterior: { x: 965, y: 495, width: 153, height: 215 },
    drawOrder: ["base-interior", "deploying-unit-alpha-1", "foreground-mask"],
    outsideDrawOrder: ["base-interior", "foreground-mask", "deployed-unit-alpha-1"],
  },
  equipment: {
    barrage: {
      sheet: {
        path: "/art/v099/crawler/crawler-barrage-module-sheet-v1.png",
        revision: "v1",
        columns: 7,
        frameWidth: 256,
        frameHeight: 128,
      },
      sourcePlacement: { x: 918, y: 304 },
      vehicleAnchor: { x: 1036, y: 398 },
      muzzleByPhase: {
        aim: { x: 1112, y: 353 },
        firing: { x: 1118, y: 353 },
        recoil: { x: 1104, y: 353 },
      },
      phases: CRAWLER_BARRAGE_SPRITE_PHASES,
    },
    airstrike: {
      sheet: {
        path: "/art/v099/crawler/crawler-airstrike-module-sheet-v1.png",
        revision: "v1",
        columns: 7,
        frameWidth: 64,
        frameHeight: 288,
      },
      sourcePlacement: { x: 488, y: 70 },
      vehicleAnchor: { x: 520, y: 330 },
      signalByPhase: {
        targeting: { x: 516, y: 112 },
        "inbound-signal": { x: 516, y: 104 },
        "impact-confirmation": { x: 516, y: 96 },
      },
      phases: CRAWLER_AIRSTRIKE_SPRITE_PHASES,
    },
  },
});

export function resolveCrawlerEquipmentFrame(kind, phase) {
  const profile = V099_CRAWLER_RUNTIME_PROFILE.equipment[kind];
  if (!profile || typeof phase !== "string") return null;
  const frame = profile.phases.indexOf(phase);
  if (frame < 0) return null;
  return Object.freeze({
    kind,
    phase,
    frame,
    source: Object.freeze({
      x: frame * profile.sheet.frameWidth,
      y: 0,
      width: profile.sheet.frameWidth,
      height: profile.sheet.frameHeight,
    }),
    destination: Object.freeze({
      x: profile.sourcePlacement.x,
      y: profile.sourcePlacement.y,
      width: profile.sheet.frameWidth,
      height: profile.sheet.frameHeight,
    }),
  });
}

const normalizedProgress = (remaining, duration) => (
  Math.max(0, Math.min(1, 1 - (Number(remaining) || 0) / Math.max(.001, Number(duration) || 0)))
);

export function crawlerBarrageSpritePhase(runtime, timings) {
  if (!runtime || !timings) return "stowed";
  if (["ready", "cooldown", "idle"].includes(runtime.phase)) return "stowed";
  if (runtime.phase === "deploying") {
    const progress = normalizedProgress(runtime.phaseTime, timings.deploySeconds);
    if (progress < 1 / 3) return "hatch-open";
    if (progress < 2 / 3) return "turret-rise";
    return "aim";
  }
  if (runtime.phase === "firing") {
    return normalizedProgress(runtime.phaseTime, timings.fireSeconds) < .58 ? "firing" : "recoil";
  }
  if (runtime.phase === "recovering") return "retract";
  return "stowed";
}

export function crawlerAirstrikeSpritePhase(runtime, timings) {
  if (!runtime || !timings || runtime.phase === "idle") return "stowed";
  if (runtime.phase === "radio") {
    return normalizedProgress(runtime.phaseTime, timings.radioSeconds) < .5
      ? "mast-deploy"
      : "antenna-extend";
  }
  if (runtime.phase === "targeting") return "targeting";
  if (runtime.phase === "inbound") return "inbound-signal";
  if (runtime.phase === "impact") return "impact-confirmation";
  if (runtime.phase === "returning") return "retract";
  return "stowed";
}
