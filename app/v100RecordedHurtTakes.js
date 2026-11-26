const takes = ["03", "04"];
const lightHurtPools = new Set([
  "human-male-light-hurt",
  "voice-red-panther-knife-hurt-takes",
  "voice-red-panther-smg-hurt-takes",
]);

export const lightHurtFiles = Object.freeze(takes.map(take =>
  "/audio/quality-20261126/voices/human-male-light-hurt-" + take + ".mp3"
));

// Inherit each role's volume, priority and fallback recordings. The two new
// performances are shared physical files from the same original voice family.
export function withRecordedLightHurtTakes(manifest) {
  const byId = new Map(manifest.assets.map(asset => [asset.id, asset]));
  const extras = [];
  const pools = manifest.pools.map(pool => {
    if (!lightHurtPools.has(pool.id)) return pool;
    const order = pool.id === "voice-red-panther-smg-hurt-takes" ? [1,0] : [0,1];
    const added = order.map((takeIndex, index) => {
      const original = byId.get(pool.assetIds[index]);
      const takeId = pool.id + "-" + takes[takeIndex];
      extras.push({...original, id: takeId, sources: [
        { src: lightHurtFiles[takeIndex], type: "audio/mpeg" }, ...original.sources,
      ]});
      return takeId;
    });
    return {...pool, assetIds: [...pool.assetIds, ...added]};
  });
  return {...manifest, assets: [...manifest.assets, ...extras], pools};
}
