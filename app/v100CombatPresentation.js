import { ENEMY_CONTENT } from "./content/enemyCatalog.js";
import { V100_STAGES, V100_SUPPORTS, V100_VEHICLE } from "./v100Registry.js";

const PRESENTATION_PRIMITIVES = Object.freeze([
  "authored-trail",
  "organic-pulse",
  "weapon-arc",
  "muzzle-burst",
  "tracer-impact",
  "shield-plane",
  "boss-telegraph",
  "world-decal",
  "status-ring",
  "debug-marker",
]);
const DISPOSITIONS = Object.freeze(["KEEP", "REFINE", "REPLACE", "QA-ONLY"]);
const CAUSAL_SEQUENCE = Object.freeze(["source", "prep", "travel", "contact", "impact", "target-reaction", "aftermath"]);

const V100_COMBAT_VFX_PROFILES = Object.freeze({
  "red-panther-knife": Object.freeze({
    kind: "red-panther-knife",
    family: "human-red-panther",
    role: "knife-footwork",
    accentColor: "#d55b48",
    primitive: "weapon-arc",
    sourceAnchor: "right-hand-knife",
    soundCue: "enemy-red-panther-knife-attack",
    boss: false,
    projectile: null,
    movementPuffs: 3,
    hitSparks: 4,
    disposition: "REFINE",
  }),
  "red-panther-shield": Object.freeze({
    kind: "red-panther-shield",
    family: "human-red-panther",
    role: "shield-block",
    accentColor: "#e0a04e",
    primitive: "shield-plane",
    sourceAnchor: "left-arm-shield",
    soundCue: "enemy-red-panther-shield-attack",
    boss: false,
    projectile: null,
    movementPuffs: 2,
    hitSparks: 5,
    disposition: "REFINE",
  }),
  "red-panther-smg": Object.freeze({
    kind: "red-panther-smg",
    family: "human-red-panther",
    role: "socket-smg",
    accentColor: "#c74b4b",
    primitive: "tracer-impact",
    sourceAnchor: "weapon-muzzle",
    soundCue: "enemy-red-panther-smg-attack",
    boss: false,
    projectile: null,
    movementPuffs: 2,
    hitSparks: 4,
    disposition: "REFINE",
  }),
  "red-panther-commander": Object.freeze({
    kind: "red-panther-commander",
    family: "human-red-panther",
    role: "rally-telegraph",
    accentColor: "#d8b25c",
    primitive: "boss-telegraph",
    sourceAnchor: "commander-radio",
    soundCue: "enemy-red-panther-commander-attack",
    boss: false,
    projectile: null,
    movementPuffs: 3,
    hitSparks: 5,
    disposition: "REFINE",
  }),
  "mugarian-president-mutated": Object.freeze({
    kind: "mugarian-president-mutated",
    family: "boss-dedicated",
    role: "four-rooted-arm-sweep",
    accentColor: "#d85d49",
    primitive: "boss-telegraph",
    sourceAnchor: "four-rooted-arms",
    soundCue: "enemy-mugarian-president-mutated-attack",
    identityArmCount: 4,
    identityHandCount: 4,
    boss: true,
    projectile: null,
    movementPuffs: 5,
    hitSparks: 7,
    disposition: "REFINE",
  }),
  "takuya-omega": Object.freeze({
    kind: "takuya-omega",
    family: "boss-dedicated",
    role: "giant-weapon-sweep",
    accentColor: "#e4ad55",
    primitive: "weapon-arc",
    sourceAnchor: "two-rooted-arms-greatsword",
    soundCue: "enemy-takuya-omega-attack",
    identityArmCount: 2,
    identityHandCount: 2,
    giantWeapon: true,
    boss: true,
    projectile: null,
    movementPuffs: 5,
    hitSparks: 7,
    disposition: "REFINE",
  }),
});

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function combatRow({ id, family, actor, trigger, primitive, soundCue, disposition, productionVisible = true, sourceAnchor = "world-actor", identity = null }) {
  return {
    id,
    family,
    actor,
    owner: "AshfallGame",
    trigger,
    primitive,
    sourceAnchor,
    soundCue,
    disposition,
    productionVisible,
    causalSequence: [...CAUSAL_SEQUENCE],
    syncContract: ["damage", "hitbox", "audio", "target-reaction"],
    gameplayInvariant: "timing-damage-hitbox-ai-balance-unchanged",
    ...(identity ? { identity } : {}),
  };
}

const LEGACY_ENEMY_ROWS = ENEMY_CONTENT.filter((enemy) => !V100_COMBAT_VFX_PROFILES[enemy.id]).map((enemy) => combatRow({
  id: `enemy:${enemy.id}`,
  family: enemy.spawnClass === "boss" ? "boss-existing" : "infected-organic",
  actor: enemy.id,
  trigger: "attack-and-hit-reaction",
  primitive: enemy.spawnClass === "boss" ? "boss-telegraph" : "organic-pulse",
  soundCue: `enemy-${enemy.id}-attack`,
  disposition: "KEEP",
}));

const V100_ENEMY_ROWS = Object.values(V100_COMBAT_VFX_PROFILES).map((profile) => combatRow({
  id: `enemy:${profile.kind}`,
  family: profile.family,
  actor: profile.kind,
  trigger: profile.role,
  primitive: profile.primitive,
  sourceAnchor: profile.sourceAnchor,
  soundCue: profile.soundCue,
  disposition: profile.disposition,
  identity: profile.identityArmCount ? {
    rootedArmCount: profile.identityArmCount,
    rootedHandCount: profile.identityHandCount,
    giantWeapon: profile.giantWeapon ?? false,
  } : null,
}));

const SUPPORT_ROWS = V100_SUPPORTS.map((support) => combatRow({
  id: `support:${support.id}`,
  family: "support-equipment",
  actor: support.id,
  trigger: "player-activation",
  primitive: "authored-trail",
  sourceAnchor: "support-world-drop",
  soundCue: support.id === "support-healing" ? "support-heal" : "support-explosion",
  disposition: "REFINE",
}));

const VEHICLE_ROWS = V100_VEHICLE.abilities.map((ability) => combatRow({
  id: `vehicle:${ability.id}`,
  family: "vehicle-ability",
  actor: ability.id,
  trigger: "player-activation",
  primitive: ability.id.includes("airstrike") ? "tracer-impact" : "muzzle-burst",
  sourceAnchor: "vehicle-weapon-muzzle",
  soundCue: ability.id.includes("airstrike") ? "support-airstrike" : "weapon-barrage",
  disposition: "KEEP",
}));

const MISSION_ROWS = V100_STAGES.map((stage) => combatRow({
  id: `mission:${stage.id}`,
  family: "mission-object",
  actor: stage.id,
  trigger: "objective-state-change",
  primitive: stage.missionType === "boss" ? "boss-telegraph" : "world-decal",
  sourceAnchor: "mission-object-bounds",
  soundCue: "sfx-v070-terminal-confirm",
  disposition: "REFINE",
}));

const STATUS_ROWS = [
  ["ready", "status-ready", "status-ring"],
  ["cooldown", "status-cooldown", "status-ring"],
  ["buff", "status-buff", "status-ring"],
  ["debuff", "status-debuff", "status-ring"],
  ["stun", "status-stun", "status-ring"],
  ["lock-on", "status-lock-on", "status-ring"],
  ["defense", "status-defense", "shield-plane"],
  ["danger", "status-danger", "boss-telegraph"],
].map(([trigger, actor, primitive]) => combatRow({
  id: `status:${trigger}`,
  family: "status-presentation",
  actor,
  trigger,
  primitive,
  soundCue: "ui-select",
  disposition: "REFINE",
}));

const QA_ROW = combatRow({
  id: "qa:hitbox-marker",
  family: "qa-diagnostic",
  actor: "hitbox-and-spawn-debug",
  trigger: "qa-only",
  primitive: "debug-marker",
  soundCue: null,
  disposition: "QA-ONLY",
  productionVisible: false,
});

export const V100_COMBAT_FX_INVENTORY = freeze([
  ...LEGACY_ENEMY_ROWS,
  ...V100_ENEMY_ROWS,
  ...SUPPORT_ROWS,
  ...VEHICLE_ROWS,
  ...MISSION_ROWS,
  ...STATUS_ROWS,
  QA_ROW,
]);

export function validateV100CombatPresentationInventory({ inventory = V100_COMBAT_FX_INVENTORY } = {}) {
  const errors = [];
  const ids = inventory.map((entry) => entry?.id);
  const requiredKinds = Object.keys(V100_COMBAT_VFX_PROFILES);
  const productionRows = inventory.filter((entry) => entry?.productionVisible !== false && entry?.disposition !== "QA-ONLY");
  const byActor = new Map(inventory.map((entry) => [entry?.actor, entry]));
  const requiredFamilies = ["infected-organic", "human-red-panther", "boss-dedicated", "support-equipment", "vehicle-ability", "mission-object", "status-presentation", "qa-diagnostic"];
  for (const id of ids.filter((value, index) => ids.indexOf(value) !== index)) errors.push(`duplicate:${String(id)}`);
  for (const entry of inventory) {
    if (!entry || typeof entry.id !== "string") { errors.push("invalid-entry"); continue; }
    if (!entry.owner || !entry.actor || !entry.trigger || !PRESENTATION_PRIMITIVES.includes(entry.primitive)) errors.push(`incomplete:${entry.id}`);
    if (!DISPOSITIONS.includes(entry.disposition)) errors.push(`disposition:${entry.id}`);
    if (entry.productionVisible !== false && entry.disposition === "QA-ONLY") errors.push(`qa-visible:${entry.id}`);
    if (entry.productionVisible !== false && !entry.soundCue) errors.push(`cue-missing:${entry.id}`);
    if (entry.disposition === "REPLACE" && !entry.replacement) errors.push(`replacement-missing:${entry.id}`);
    if (JSON.stringify(entry.causalSequence) !== JSON.stringify(CAUSAL_SEQUENCE)) errors.push(`causal-sequence:${entry.id}`);
  }
  for (const family of requiredFamilies) if (!inventory.some((entry) => entry.family === family)) errors.push(`family-missing:${family}`);
  for (const kind of requiredKinds) if (!byActor.has(kind)) errors.push(`actor-missing:${kind}`);
  const identityErrors = [];
  const president = byActor.get("mugarian-president-mutated");
  const omega = byActor.get("takuya-omega");
  if (president?.identity?.rootedArmCount !== 4 || president?.identity?.rootedHandCount !== 4) identityErrors.push("mugarian-president-mutated:4-rooted-arms-4-hands");
  if (omega?.identity?.rootedArmCount !== 2 || omega?.identity?.rootedHandCount !== 2 || omega?.identity?.giantWeapon !== true) identityErrors.push("takuya-omega:2-rooted-arms-2-hands-giant-weapon");
  errors.push(...identityErrors);
  const statusActors = STATUS_ROWS.map((entry) => entry.actor);
  const statusDuplicates = statusActors.filter((actor, index) => statusActors.indexOf(actor) !== index);
  errors.push(...statusDuplicates.map((actor) => `status-duplicate:${actor}`));
  return freeze({
    ok: errors.length === 0,
    errors,
    total: inventory.length,
    productionVisible: productionRows.length,
    qaOnly: inventory.length - productionRows.length,
    identityErrors,
    unclassifiedCount: inventory.filter((entry) => !entry?.family || !entry?.disposition).length,
    replaceIncompleteCount: inventory.filter((entry) => entry?.disposition === "REPLACE" && !entry.replacement).length,
    requiredFamilies,
    requiredKinds,
  });
}

export const V100_COMBAT_FX_AUDIT = validateV100CombatPresentationInventory();

export {
  DISPOSITIONS as V100_COMBAT_FX_DISPOSITIONS,
  PRESENTATION_PRIMITIVES as V100_COMBAT_FX_PRIMITIVES,
  V100_COMBAT_VFX_PROFILES,
};
