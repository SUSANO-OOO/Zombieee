const crowbarPoolId = 'weapon-crowbar';
const slicePoolId = 'weapon-red-panther-knife-slice';
const recordings = ['hachi-crowbar-01', 'hachi-crowbar-02'].map(id => ({
  id, src: '/audio/quality-20261126/foley/' + id + '.mp3',
}));

export function withV100HachiCrowbar(manifest, verifiedPaths) {
  if (!recordings.every(recording => verifiedPaths.has(recording.src))) return manifest;
  const original = manifest.pools.find(pool => pool.id === crowbarPoolId);
  const assets = recordings.map(({ id, src }, index) => {
    const take = manifest.assets.find(asset => asset.id === original.assetIds[index]);
    return { ...take, id, sources: [{ src, type: 'audio/mpeg' }, ...take.sources] };
  });
  return {
    ...manifest,
    assets: [...manifest.assets, ...assets],
    pools: [
      ...manifest.pools.map(pool => pool === original ? { ...pool, assetIds: assets.map(asset => asset.id) } : pool),
      { ...original, id: slicePoolId },
    ],
    aliases: manifest.aliases.map(alias => alias.id === 'enemy-red-panther-knife-attack'
      ? { ...alias, targetId: slicePoolId } : alias),
  };
}
