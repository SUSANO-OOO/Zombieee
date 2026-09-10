import { withV100Music } from './v100Music.js';
// V1 sound families. Source recordings and deterministic adaptations are
// documented by build-v100-sound-design.mjs; character voices stay untouched.
export const V100_FOLEY_RECIPES = Object.freeze({
  swing: ['kenney-rpg/knifeSlice.ogg', .3, .7, 7000],
  metal: ['kenney-impact/impactMetal_medium_000.ogg', .45, .7, 6500],
  'heavy-metal': ['kenney-rpg/metalPot2.ogg', .65, .35, 5000],
  body: ['kenney-impact/impactSoft_heavy_000.ogg', .36, .9, 4300],
  fall: ['kenney-impact/impactWood_heavy_000.ogg', .7, .6, 4200],
  mechanism: ['kenney-rpg/metalLatch.ogg', .32, .6, 6500],
  treatment: ['kenney-rpg/cloth4.ogg', .7, .7, 4300],
  rifle: ['opengameart/sks.wav', .72, .7, 7400],
  pistol: ['opengameart/cz.wav', .5, .55, 5000],
  explosion: ['opengameart/chunky-explosion.mp3', 2.1, .8, 6500],
});
export const V100_AMBIENCE_RECIPES = Object.freeze({
  room: { lowpass: 520, gain: .25, foley: [['kenney-rpg/bookClose.ogg', 9100, .055], ['kenney-rpg/cloth1.ogg', 17300, .075]] },
  kitchen: { lowpass: 1050, gain: .21, foley: [['kenney-rpg/metalPot1.ogg', 7600, .055], ['kenney-rpg/cloth2.ogg', 16800, .07]] },
  receiver: { lowpass: 1800, gain: .12, foley: [] },
  medical: { lowpass: 680, gain: .19, foley: [['kenney-rpg/cloth4.ogg', 14200, .07]] },
});
export const v100SoundSources = (folder, name) => ['mp3', 'ogg'].map(ext => ({
  src: `/audio/v100/${folder}/${name}.${ext}`, type: ext === 'mp3' ? 'audio/mpeg' : 'audio/ogg',
}));
export function v100FoleyRole(id) {
  if (/^weapon-(melee-swing|pan-swing|crowbar)-/.test(id) || id === 'weapon-pan-swing') return 'swing';
  if (/^weapon-(melee-impact|unarmed)-/.test(id)) return 'body';
  if (/^weapon-hammer-/.test(id) || ['weapon-pan-heavy-hit', 'weapon-pan-stun'].includes(id)) return 'heavy-metal';
  if (id === 'weapon-pan-hit' || id === 'weapon-suppressed-hit') return 'metal';
  if (/^weapon-(rifle|gunner)-/.test(id)) return 'rifle';
  if (/^weapon-barrage-/.test(id) || ['support-explosion', 'support-pod-impact'].includes(id)) return 'explosion';
  if (id === 'weapon-suppressed-pistol') return 'pistol';
  if (id === 'weapon-suppressed-reload' || id === 'support-pod-deploy') return 'mechanism';
  if (id === 'support-heal') return 'treatment';
  return null;
}
export function v100AmbienceRole(id) {
  if (['ambience-v070-crawler-ops-loop', 'ambience-v070-stage2-engine-loop'].includes(id)) return 'room';
  if (['ambience-v070-kumaya-daily-loop', 'ambience-v070-crawler-canteen-loop'].includes(id)) return 'kitchen';
  if (id === 'ambience-v070-medical-bay-loop') return 'medical';
  if (id === 'ambience-v070-radio-signal-loop') return 'receiver';
  return null;
}
export function v100AudioDesignCandidate(base) {
  return withV100Music({ ...base, assets: base.assets.map(asset => {
    const foley = v100FoleyRole(asset.id), ambience = v100AmbienceRole(asset.id);
    return foley ? { ...asset, sources: v100SoundSources('foley', foley) }
      : ambience ? { ...asset, sources: v100SoundSources('ambience', ambience), gain: .65 }
      : asset;
  }) });
}
