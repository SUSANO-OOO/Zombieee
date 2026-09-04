import { ENEMY_CONTENT } from "./content/enemyCatalog.js";
import { UNIT_CONTENT } from "./content/unitCatalog.js";
import { V100_BOSSES, V100_STAGES, V100_SUPPORTS, V100_UNITS, V100_VEHICLE } from "./v100Registry.js";

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

function combatRow({ id, family, actor, trigger, primitive, soundCue, disposition, productionVisible = true, sourceAnchor = "world-actor", identity = null, evidence = null, refineComplete = disposition !== "REFINE", replacement = null }) {
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
    evidence: evidence ?? Object.freeze({ owner: "AshfallGame", renderer: "production-combat-presentation", sequence: [...CAUSAL_SEQUENCE] }),
    ...(disposition === "REFINE" ? { refineComplete } : {}),
    ...(replacement ? { replacement } : {}),
    ...(identity ? { identity } : {}),
  };
}

const LEGACY_ALLY_ROWS = UNIT_CONTENT.map((unit) => combatRow({
  id: `ally:${unit.id}`,
  family: "ally-unit",
  actor: unit.id,
  trigger: unit.aiProfile === "marksman" || unit.aiProfile === "suppression" || unit.aiProfile === "support" ? "ranged-source-travel-impact" : "melee-windup-swing-recovery",
  primitive: unit.aiProfile === "marksman" || unit.aiProfile === "suppression" || unit.aiProfile === "support" ? "authored-trail" : "weapon-arc",
  sourceAnchor: unit.aiProfile === "marksman" || unit.aiProfile === "suppression" || unit.aiProfile === "support" ? "weapon-muzzle" : "weapon-hand",
  soundCue: `weapon-${unit.kind}-attack`,
  disposition: "KEEP",
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "drawBattleWorld/projectile-and-melee-presentation", actor: unit.kind, sequence: [...CAUSAL_SEQUENCE] }),
}));

const V100_ALLY_ROWS = V100_UNITS.map((unit) => combatRow({
  id: `v100-ally:${unit.id}`,
  family: "v100-ally-unit",
  actor: `v100:${unit.id}`,
  trigger: "deploy-and-attack",
  primitive: "authored-trail",
  sourceAnchor: "formation-card-to-combat-kind",
  soundCue: `weapon-${unit.id}-attack`,
  disposition: "KEEP",
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "v100BattleAdapter->drawBattleWorld", canonicalUnitId: unit.id, sequence: [...CAUSAL_SEQUENCE] }),
}));

const LEGACY_ENEMY_ROWS = ENEMY_CONTENT.filter((enemy) => !V100_COMBAT_VFX_PROFILES[enemy.id]).map((enemy) => combatRow({
  id: `enemy:${enemy.id}`,
  family: enemy.spawnClass === "boss" ? "boss-existing" : "infected-organic",
  actor: enemy.id,
  trigger: "attack-and-hit-reaction",
  primitive: enemy.spawnClass === "boss" ? "boss-telegraph" : "organic-pulse",
  soundCue: `enemy-${enemy.id}-attack`,
  disposition: "KEEP",
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "enemyCombatVfxSnapshot/drawEnemyCombatReadabilityVfx", canonicalEnemyId: enemy.id, sequence: [...CAUSAL_SEQUENCE] }),
}));

const BOSS_REGISTRY_ROWS = V100_BOSSES.map((boss) => combatRow({
  id: `boss:${boss.id}`,
  family: "boss-registry",
  actor: `boss:${boss.id}`,
  trigger: "boss-phase-telegraph-and-defeat",
  primitive: "boss-telegraph",
  sourceAnchor: "boss-runtime-anchor",
  soundCue: `boss-${boss.id}-attack`,
  disposition: "KEEP",
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "bossPhaseFor/drawBossTelegraph", canonicalBossId: boss.id, sequence: [...CAUSAL_SEQUENCE] }),
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
  refineComplete: true,
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "enemyCombatVfxSnapshot/drawEnemyCombatReadabilityVfx", canonicalEnemyId: profile.kind, sequence: [...CAUSAL_SEQUENCE] }),
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
  refineComplete: true,
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "support-world-drop-and-impact", canonicalSupportId: support.id, sequence: [...CAUSAL_SEQUENCE] }),
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
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "crawlerEquipmentFrame/crawlerAbilityRuntime", canonicalAbilityId: ability.id, sequence: [...CAUSAL_SEQUENCE] }),
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
  refineComplete: true,
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "mission-object-runtime-and-objective-hud", canonicalStageId: stage.id, sequence: [...CAUSAL_SEQUENCE] }),
}));

const STATUS_ROWS = [
  ["ready", "status-ready", "status-ring"],
  ["cooldown", "status-cooldown", "status-ring"],
  ["buff", "status-buff", "status-ring"],
  ["debuff", "status-debuff", "status-ring"],
  ["stun", "status-stun", "status-ring"],
  ["lock-on", "status-lock-on", "status-ring"],
  ["support-target", "status-support-target", "authored-trail"],
  ["defense", "status-defense", "shield-plane"],
  ["danger", "status-danger", "boss-telegraph"],
  ["mission-target", "status-mission-target", "world-decal"],
].map(([trigger, actor, primitive]) => combatRow({
  id: `status:${trigger}`,
  family: "status-presentation",
  actor,
  trigger,
  primitive,
  soundCue: "ui-select",
  disposition: "REFINE",
  refineComplete: true,
  evidence: Object.freeze({ owner: "AshfallGame", renderer: "battleHud/status-language", category: trigger, sequence: [...CAUSAL_SEQUENCE] }),
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
  ...LEGACY_ALLY_ROWS,
  ...V100_ALLY_ROWS,
  ...LEGACY_ENEMY_ROWS,
  ...V100_ENEMY_ROWS,
  ...BOSS_REGISTRY_ROWS,
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
  const requiredFamilies = ["ally-unit", "v100-ally-unit", "infected-organic", "human-red-panther", "boss-dedicated", "boss-registry", "support-equipment", "vehicle-ability", "mission-object", "status-presentation", "qa-diagnostic"];
  for (const id of ids.filter((value, index) => ids.indexOf(value) !== index)) errors.push(`duplicate:${String(id)}`);
  for (const entry of inventory) {
    if (!entry || typeof entry.id !== "string") { errors.push("invalid-entry"); continue; }
    if (!entry.owner || !entry.actor || !entry.trigger || !PRESENTATION_PRIMITIVES.includes(entry.primitive)) errors.push(`incomplete:${entry.id}`);
    if (!DISPOSITIONS.includes(entry.disposition)) errors.push(`disposition:${entry.id}`);
    if (entry.productionVisible !== false && entry.disposition === "QA-ONLY") errors.push(`qa-visible:${entry.id}`);
    if (entry.productionVisible !== false && !entry.soundCue) errors.push(`cue-missing:${entry.id}`);
    if (entry.disposition === "REPLACE" && !entry.replacement) errors.push(`replacement-missing:${entry.id}`);
    if (entry.productionVisible !== false && (!entry.evidence || typeof entry.evidence.owner !== "string" || typeof entry.evidence.renderer !== "string")) errors.push(`evidence-missing:${entry.id}`);
    if (entry.productionVisible !== false && entry.disposition === "REFINE" && entry.refineComplete !== true) errors.push(`refine-incomplete:${entry.id}`);
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
  const unclassifiedCount = inventory.filter((entry) => !entry?.family || !entry?.disposition || (entry?.productionVisible !== false && !entry?.evidence)).length;
  const unfinishedRefineCount = inventory.filter((entry) => entry?.productionVisible !== false && entry?.disposition === "REFINE" && entry?.refineComplete !== true).length;
  const replaceIncompleteCount = inventory.filter((entry) => entry?.disposition === "REPLACE" && !entry.replacement).length;
  if (unclassifiedCount > 0) errors.push(`unclassified:${unclassifiedCount}`);
  if (unfinishedRefineCount > 0) errors.push(`unfinished-refine:${unfinishedRefineCount}`);
  if (replaceIncompleteCount > 0) errors.push(`unfinished-replace:${replaceIncompleteCount}`);
  return freeze({
    ok: errors.length === 0,
    errors,
    total: inventory.length,
    productionVisible: productionRows.length,
    qaOnly: inventory.length - productionRows.length,
    identityErrors,
    unclassifiedCount,
    unfinishedRefineCount,
    replaceIncompleteCount,
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
