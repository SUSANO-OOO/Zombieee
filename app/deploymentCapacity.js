/** Live combatants and paid queue entries share the same deployment slots. */
export function humanDeploymentCapacity({ fighters = [], queuedUnits = 0, limit = Infinity } = {}) {
  const active = fighters.filter((fighter) => fighter.side === "human" && fighter.hp > 0).length;
  const queued = Math.max(0, Math.floor(Number(queuedUnits) || 0));
  return { active, queued, reserved: active + queued, limit, canReserve: active + queued < limit, canLaunch: active < limit };
}
