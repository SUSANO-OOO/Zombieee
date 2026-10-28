// Separate recorded discharges, not pitch variants of one waveform.
// A cue contains one shot; gameplay continues to own every burst's cadence.
export const RECORDED_WEAPON_TAKES = Object.freeze({
  'weapon-rifle-01': { source: 'D_32P.wav', start: .55, duration: .55, cutoff: 9200, reference: 'audio/v100/foley/rifle.mp3' },
  'weapon-rifle-02': { source: 'D_32P.wav', start: 5.5, duration: .55, cutoff: 9200, reference: 'audio/v100/foley/rifle.mp3' },
  'weapon-gunner-01': { source: 'C_28P.wav', start: .45, duration: .5, cutoff: 8400, reference: 'audio/v100/foley/rifle.mp3' },
  'weapon-gunner-02': { source: 'C_28P.wav', start: 3.1, duration: .5, cutoff: 8400, reference: 'audio/v100/foley/rifle.mp3' },
  'weapon-smg-01': { source: 'G_31P.wav', start: .15, duration: .38, cutoff: 9000, reference: 'audio/v100/foley/rifle.mp3' },
  'weapon-smg-02': { source: 'G_31P.wav', start: 3.35, duration: .38, cutoff: 9000, reference: 'audio/v100/foley/rifle.mp3' },
  'v104-handgun': { source: 'X_39P.wav', start: 1.25, duration: .42, cutoff: 9500, reference: 'audio/v104/combat/handgun.mp3' },
});
export const recordedWeaponSources = id => ['mp3', 'ogg'].map(ext => ({
  src: `/audio/weapons/recorded/${id}.${ext}`, type: ext === 'mp3' ? 'audio/mpeg' : 'audio/ogg',
}));
export function withRecordedWeapons(manifest) {
  return { ...manifest, assets: manifest.assets.map(asset => RECORDED_WEAPON_TAKES[asset.id]
    ? { ...asset, sources: recordedWeaponSources(asset.id) } : asset) };
}
