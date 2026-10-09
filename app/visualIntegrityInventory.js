import { BOSS_DEFINITIONS } from "./bossFoundation.js";
import { CAMPAIGN_STAGES, CAMPAIGN_UNITS } from "./campaign.js";
import { ENEMY_CONTENT } from "./content/enemyCatalog.js";
import {
  FORMATION_CARD_ART,
  PORTRAIT_ART,
  SPRITE_STATES,
  spriteFrameFor,
  spriteSheetPath,
} from "./spriteManifest.js";
import { EVENT_PORTRAIT_PROFILES } from "./visualProfiles.js";
import { V100_COMBAT_FX_AUDIT, V100_COMBAT_FX_INVENTORY } from "./v100CombatPresentation.js";

export const PRODUCTION_FALLBACK_RENDERERS = Object.freeze([
  Object.freeze({ owner: "fighter-sprite", productionPolicy: "required-blocking", qaFallback: "local-qa-only" }),
  Object.freeze({ owner: "stage-background", productionPolicy: "required-blocking", qaFallback: "local-qa-only" }),
  Object.freeze({ owner: "crawler-body", productionPolicy: "required-blocking", qaFallback: "local-qa-only" }),
  Object.freeze({ owner: "station-power-source", productionPolicy: "required-blocking", qaFallback: "local-qa-only" }),
  Object.freeze({ owner: "station-controller-source", productionPolicy: "required-blocking", qaFallback: "local-qa-only" }),
  Object.freeze({ owner: "battlefield-support", productionPolicy: "required-blocking", qaFallback: "local-qa-only" }),
]);

export function productionVisualIntegrityInventory() {
  const enemyKinds = [...new Set([
    ...ENEMY_CONTENT.map(({ id }) => id),
    ...BOSS_DEFINITIONS.map(({ enemyKind }) => enemyKind),
  ])];
  return Object.freeze({
    units: Object.freeze(CAMPAIGN_UNITS.map((unit) => Object.freeze({
      id: unit.id,
      kind: unit.combatKind,
      card: FORMATION_CARD_ART[unit.combatKind],
      portrait: PORTRAIT_ART[unit.combatKind],
      battleSprite: spriteSheetPath(unit.combatKind),
    }))),
    events: Object.freeze(Object.entries(EVENT_PORTRAIT_PROFILES).map(([id, profile]) => Object.freeze({
      id,
      path: profile.path,
    }))),
    stages: Object.freeze(CAMPAIGN_STAGES.map((stage) => stage.id)),
    enemies: Object.freeze(enemyKinds.map((kind) => Object.freeze({
      kind,
      sheet: spriteSheetPath(kind),
      states: Object.freeze(SPRITE_STATES.map((state) => Object.freeze({
        state,
        left: spriteFrameFor(kind, state, "left"),
        right: spriteFrameFor(kind, state, "right"),
      }))),
    }))),
    combatFx: V100_COMBAT_FX_INVENTORY,
    combatFxAudit: V100_COMBAT_FX_AUDIT,
    fallbackRenderers: PRODUCTION_FALLBACK_RENDERERS,
  });
}
