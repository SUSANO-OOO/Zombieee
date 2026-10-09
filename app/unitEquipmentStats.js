/**
 * Shared combat and preparation calculation. Keep the order and rounding of the
 * runtime formula: only HP is rounded here; damage and timing retain precision.
 * @template {{ hp: number, damage: number, range: number, speed: number, laneSpeed: number, attackEvery: number, deployCooldown: number, defense?: number, healingMultiplier?: number }} T
 * @param {T} card
 * @param {ReturnType<typeof import("./equipment.js").aggregateEquipmentEffects>} equipmentEffects
 * @param {{ attackMultiplier?: number, rangeMultiplier?: number, defenseMultiplier?: number, healingMultiplier?: number }} [survivalEffects]
 */
export function applyUnitEquipmentEffects(card, equipmentEffects, survivalEffects = {}) {
  const {
    attackMultiplier = 1,
    rangeMultiplier = 1,
    defenseMultiplier = 1,
    healingMultiplier = 1,
  } = survivalEffects;
  return {
    ...card,
    hp: Math.max(1, Math.round(card.hp * equipmentEffects.hpMultiplier)),
    damage: card.damage * attackMultiplier * equipmentEffects.damageMultiplier,
    range: card.range * rangeMultiplier * equipmentEffects.rangeMultiplier,
    speed: card.speed * equipmentEffects.speedMultiplier,
    laneSpeed: card.laneSpeed * equipmentEffects.speedMultiplier,
    attackEvery: card.attackEvery * equipmentEffects.attackEveryMultiplier,
    defense: Math.min(.75,
      1 - (1 - Math.min(.75, (card.defense ?? 0) + equipmentEffects.defenseFlat))
        * defenseMultiplier),
    healingMultiplier: (card.healingMultiplier ?? 1) * healingMultiplier * equipmentEffects.healingMultiplier,
    deployCooldown: card.deployCooldown * equipmentEffects.redeployMultiplier,
  };
}
