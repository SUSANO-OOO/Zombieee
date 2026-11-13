// An optional painted finale may replace an existing painted fallback only
// after its bounded load resolves. A late onReady callback after rejection
// must never publish an image into the live renderer.
export function optionalBattleArtworkJobs({ objects, load, isCurrent, onReady }) {
  return objects.filter(object => object.optional).map(object => ({
    path: object.path,
    category: object.category,
    run: async signal => {
      let decoded = null;
      await load(object, image => { decoded = image; }, signal);
      if (!signal?.aborted && isCurrent() && decoded) onReady(object, decoded);
    },
  }));
}
