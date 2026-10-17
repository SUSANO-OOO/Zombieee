import { withV100Music } from './v100Music.js';
import { withV100R9SoundDesign } from './v100R9SoundDesign.js';
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
export const V100_EVENT_FOLEY_RECIPES = Object.freeze({
  dish: ['kenney-rpg/metalPot1.ogg', .55, .38, 5800],
  'door-open': ['kenney-rpg/doorOpen_1.ogg', .9, .55, 5600],
  'door-close': ['kenney-rpg/doorClose_1.ogg', .75, .5, 4800],
  glass: ['kenney-impact/impactGlass_heavy_000.ogg', .65, .5, 6500],
  paper: ['kenney-rpg/bookFlip2.ogg', .45, .4, 5000],
  fabric: ['kenney-rpg/cloth3.ogg', .55, .4, 4000],
  pan: ['kenney-rpg/metalPot2.ogg', .65, .42, 6000],
  latch: ['kenney-rpg/metalLatch.ogg', .4, .45, 5000],
  footsteps: ['kenney-impact/footstep_concrete_000.ogg', .45, .5, 4300],
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
  const storyAssets = Object.keys(V100_EVENT_FOLEY_RECIPES).map(role => ({
    id: `v100-story-${role}`, category: "melee", sources: v100SoundSources('foley', `story-${role}`),
    preload: "lazy", loop: false, gain: .65, priority: 52, cooldownMs: 120, maxInstances: 1,
  }));
  return withV100R9SoundDesign(withV100Music({ ...base, assets: [...base.assets.map(asset => {
    const foley = v100FoleyRole(asset.id), ambience = v100AmbienceRole(asset.id);
    const uiRole = {'ui-cancel':'cancel','ui-confirm':'confirm','ui-error':'reject','ui-hover':'navigate','ui-select':'navigate','radio-open':'confirm','radio-close':'cancel'}[asset.id];
    return uiRole ? {...asset,sources:v100SoundSources('ui','v100-ui-'+uiRole),gain:.65}
      : foley ? { ...asset, sources: v100SoundSources('foley', foley) }
      : ambience ? { ...asset, sources: v100SoundSources('ambience', ambience), gain: .65 }
      : asset;
  }), ...storyAssets] }));
}
