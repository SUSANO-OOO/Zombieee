// Recorded motor and contact foley. Event timing, voices and mixer policy stay
// with the existing gameplay contracts; these are source replacements only.
export const CHAINSAW_RECORDING_CUES = Object.freeze({
  'weapon-chainsaw-start': 'start',
  'weapon-chainsaw-idle-loop': 'idle-loop',
  'weapon-chainsaw-attack': 'attack',
  'weapon-chainsaw-flesh-hit': 'flesh-hit',
  'weapon-chainsaw-hard-hit': 'hard-hit',
  'weapon-chainsaw-stop': 'stop',
  'ability-crazy-king-overdrive-activate': 'overdrive-activate',
  'ability-crazy-king-overdrive-active': 'overdrive-active',
});
export function withChainsawRecordings(manifest) {
  return { ...manifest, assets: manifest.assets.map(asset => {
    const name = CHAINSAW_RECORDING_CUES[asset.id];
    if (!name) return asset;
    // PCM keeps the authored cyclic splice exact; no MP3 encoder padding in
    // the continuously running motor. Other cues retain MP3/Ogg compatibility.
    const formats = name === 'idle-loop' ? [['wav', 'audio/wav']] : [['mp3', 'audio/mpeg'], ['ogg', 'audio/ogg']];
    return { ...asset, sources: formats.map(([ext, type]) => ({ src: `/audio/weapons/chainsaw/${name}.${ext}`, type })) };
  }) };
}
