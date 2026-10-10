// Issue #177: opening contacts should arrive sooner and support a slightly
// denser battle. These are V1 balance changes, independent of saved levels.
export const V100_COMBAT_TUNING = Object.freeze({
  alliedDamageMultiplier: 1.12,
  alliedTravelMultiplier: 1.45,
  alliedLaneTravelMultiplier: 1.25,
  waveReinforcementRatio: .18,
});

export function v100IncreaseWaveDensity(timeline, bossKinds, { preserveEscalation = false } = {}) {
  const bosses = new Set(bossKinds);
  let remainder = .5;
  return Object.freeze(timeline.map(event => {
    const ordinary = event.units.filter(kind => !bosses.has(kind));
    if (!ordinary.length) return event;
    // Carry fractions between waves: a two-enemy wave must not receive a 50%
    // increase merely because its rounded reinforcement cannot be fractional.
    const budget = remainder + ordinary.length * V100_COMBAT_TUNING.waveReinforcementRatio;
    // Escort contacts are authored as increasing pressure. Rounding each of
    // those waves avoids a carry giving the second equal-size contact fewer
    // enemies than the first. Other missions retain the timeline-wide budget.
    const count = preserveEscalation
      ? Math.round(ordinary.length * V100_COMBAT_TUNING.waveReinforcementRatio)
      : Math.floor(budget);
    remainder = budget - count;
    if (!count) return event;
    // Commanders already summon reinforcements. Increase bodies on the field
    // without multiplying that second source of arrivals when another authored
    // kind is available. Boss identity, pair count and phase gates stay authored.
    const candidates = ordinary.filter(kind => kind !== 'red-panther-commander');
    const pool = candidates.length ? candidates : ordinary;
    const extra = Array.from({length: count}, (_, index) => pool[index % pool.length]);
    const bossAt = event.units.findIndex(kind => bosses.has(kind));
    const insertAt = bossAt < 0 ? event.units.length : bossAt;
    return Object.freeze({...event, units: Object.freeze([
      ...event.units.slice(0,insertAt), ...extra, ...event.units.slice(insertAt),
    ])});
  }));
}
