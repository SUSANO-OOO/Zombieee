function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const V075_VISUAL_PROFILES = deepFreeze({
  ikura: {
    identityMaster: {
      path: "/art/v075/characters/reference/ikura-identity-master-r1.png",
      revision: "r1",
    },
    eventPortrait: {
      path: "/art/v075/characters/portraits/ikura-event-portrait-v4.webp",
      revision: "v4",
      focus: { x: 0.57, y: 0.28 },
      safeArea: { top: 0.02, right: 0.04, bottom: 0, left: 0.08 },
      minFacePixelsAt844x340: 38,
    },
    identityLock: [
      "warm-amber-eyes",
      "pink-twin-buns-and-voluminous-twin-tails",
      "black-amber-tactical-headset",
      "teal-pink-cropped-jacket-and-white-structured-top",
      "rugged-map-tablet",
    ],
  },
  crawler: {
    identityMaster: {
      path: "/art/v075/crawler/crawler-command-base-identity-r1.png",
      revision: "r1",
    },
    closed: {
      path: "/art/v075/crawler/crawler-command-base-closed-v1.png",
      revision: "v1",
    },
    open: {
      path: "/art/v075/crawler/crawler-command-base-open-v2.png",
      revision: "v2",
    },
    anchor: { x: 0.5, y: 0.9 },
    identityLock: [
      "right-facing-multi-axle-armored-command-base",
      "front-quarter-side-troop-door",
      "roof-turret-and-communications-array",
      "dark-weathered-armor-with-amber-lights",
    ],
  },
  enemyBase: {
    identityMaster: {
      path: "/art/v075/enemy-base/enemy-stronghold-identity-r1.png",
      revision: "r1",
    },
    intact: {
      path: "/art/v075/enemy-base/enemy-stronghold-intact-v2.png",
      revision: "v2",
    },
    anchor: { x: 0.5, y: 0.98 },
    identityLock: [
      "slender-asymmetrical-infected-communications-spire",
      "broken-sail-and-antenna-crown",
      "rusted-industrial-frame-and-organic-tendrils",
      "orange-infected-core-and-rooted-rubble-base",
    ],
  },
});
