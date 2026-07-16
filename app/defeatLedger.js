export function claimDefeatResolution(resolvedIds, fighterId) {
  if (!(resolvedIds instanceof Set)) throw new TypeError("resolvedIds must be a Set");
  if (resolvedIds.has(fighterId)) return false;
  resolvedIds.add(fighterId);
  return true;
}
