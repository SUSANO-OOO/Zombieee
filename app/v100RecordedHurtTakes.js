const takes = ["03", "04"];
const lightHurtPools = new Set([
  "human-male-light-hurt",
  "voice-babayaga-hurt-takes",
  "voice-red-panther-knife-hurt-takes",
  "voice-red-panther-smg-hurt-takes",
]);

const lightHurtFiles = takes.map(take => "/audio/quality-20261126/voices/human-male-light-hurt-" + take + ".mp3");
const heavyHurtFiles = takes.map(take => "/audio/quality-20261127/voices/human-male-heavy-hurt-" + take + ".mp3");
export const recordedHurtFiles = Object.freeze([...lightHurtFiles, ...heavyHurtFiles]);

const heavyHurtCues = new Set([
  "human-male-heavy-hurt", "voice-kumaverson-hurt", "voice-crazy-king-hurt",
  "voice-red-panther-shield-hurt", "voice-red-panther-commander-hurt",
]);
export function shortHeavyHurtPool(cueId) {
  return heavyHurtCues.has(cueId) ? cueId + "-brief" : undefined;
}

// Inherit each role's volume, priority and fallback recordings. The two new
// performances are shared physical files from the same original voice family.
export function withRecordedHurtTakes(manifest) {
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
  for (const pool of manifest.pools) {
    const id = shortHeavyHurtPool(pool.id.replace(/-takes$/, ""));
    if (!id) continue;
    const assetIds = heavyHurtFiles.map((src, index) => {
      const original = byId.get(pool.assetIds[index]);
      const assetId = id + "-" + takes[index];
      extras.push({...original, id: assetId, sources: [{src, type: "audio/mpeg"}, ...original.sources]});
      return assetId;
    });
    pools.push({...pool, id, assetIds});
  }
  return {...manifest, assets: [...manifest.assets, ...extras], pools};
}
