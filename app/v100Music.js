// Reusable scene score. The producer approved the normal/daily direction on
// 2026-09-09; boss recordings and intentionally silent title cuts stay intact.
export const V100_MUSIC_TRACKS = Object.freeze([
  { role: 'normal', title: 'Simulacra', file: 'Simulacra', page: 'simulacra', start: 30, duration: 98, gain: .72 },
  { role: 'pressure', title: 'Simulacra', file: 'Simulacra', page: 'simulacra', start: 134, duration: 82, gain: .72 },
  { role: 'daily', title: 'Amberlight', file: 'Amberlight', page: 'amberlight', start: 10, duration: 98, gain: .64 },
  { role: 'preparation', title: 'Artemis', file: 'Artemis', page: 'artemis', start: 12, duration: 82, gain: .62 },
  { role: 'tension', title: 'Intervention (No Piano Melody)', file: 'Intervention', page: 'intervention', start: 28, duration: 82, gain: .62 },
  { role: 'horror', title: 'The Old Ones', file: 'TheOldOnes', page: 'the-old-ones', start: 24, duration: 98, gain: .62 },
  { role: 'relief', title: 'A Kind Of Hope', file: 'AKindOfHope', page: 'a-kind-of-hope', start: 20, duration: 82, gain: .64 },
  { role: 'loss', title: 'The Long Dark', file: 'TheLongDark', page: 'the-long-dark', start: 20, duration: 74, gain: .62 },
  { role: 'ending', title: 'The Restoration', file: 'TheRestoration', page: 'the-restoration', start: 10, duration: 98, gain: .66 },
]);
export const v100ScoreAssetId = role => 'music-v100-score-' + role;
// Source-bound decisions, not keyword matching on dialogue. One pair per S01–S30.
export const V100_STORY_SCORE_ROLES = Object.freeze([
  ['tension','relief'], ['tension','relief'], ['horror','loss'],
  ['horror','relief'], ['horror','relief'], ['tension','tension'],
  ['tension','relief'], ['horror','loss'], ['tension','tension'],
  ['tension','tension'], ['horror','loss'], ['tension','loss'],
  ['tension','relief'], ['horror','tension'], ['tension','relief'],
  ['horror','relief'], ['horror','relief'], ['preparation','relief'],
  ['tension','tension'], ['preparation','relief'], ['tension','tension'],
  ['horror','relief'], ['tension','tension'], ['horror','horror'],
  ['horror','loss'], ['tension','tension'], ['horror','horror'],
  ['tension','tension'], ['horror','horror'], ['tension','ending'],
].map(pair => Object.freeze(pair)));
export const V100_STORY_SCORE_CUTS = Object.freeze([
  { stage: 2, line: 471, role: 'tension' },
  { stage: 3, line: 546, role: 'horror' },
  { stage: 20, line: 1617, role: 'preparation' },
]);
export function v100StoryScoreScene(eventId, sourceLine = 0) {
  const match = /^v100:event:s(\d{2}):(pre|post|first-clear-post)$/u.exec(eventId ?? '');
  if (!match || !V100_STORY_SCORE_ROLES[Number(match[1]) - 1]) return null;
  const phase = match[2] === 'pre' ? 'pre' : 'post';
  const cut = phase === 'post' && V100_STORY_SCORE_CUTS.find(c => c.stage === Number(match[1]) && sourceLine >= c.line);
  return 'v100-score-s' + match[1] + '-' + phase + (cut ? '-cut' : '');
}
function baseStoryScene(number, phase) {
  if (number > 20) return 'v100-s' + number + '-' + phase;
  const family = number <= 3 ? 'stage' + number
    : number === 4 ? 'station-gate' : number === 5 ? 'station-platform'
      : number === 6 || (number >= 10 && number <= 16) ? 'station-tunnel'
        : number <= 9 ? 'stage2' : 'stage3';
  if (phase === 'post' && (family === 'station-tunnel' || number >= 17)) return 'story-station-return';
  return 'story-' + family + '-' + phase;
}
const sceneRoles = Object.freeze({
  title: 'preparation', intro: 'tension', map: 'preparation', loadout: 'preparation',
  victory: 'relief', defeat: 'loss',
  'story-kumaya-daily': 'daily', 'story-kumaya-crisis': 'tension',
  'story-collapse-montage': 'horror', 'story-crawler-montage': 'preparation',
  'story-crawler-signal': 'preparation', 'story-station-briefing': 'preparation',
  'story-chapter-ending': 'ending', 'v100-story-soup-break': 'daily',
  'story-station-return': 'relief',
});
export function withV100Music(base) {
  const score = (scene, role, id = scene.id) => ({ ...scene, id, bgm: v100ScoreAssetId(role),
    preload: (scene.preload ?? []).filter(id => !id.startsWith('music-')),
    crossfadeMs: role === 'normal' || role === 'pressure' ? 1000 : 1600 });
  const scenes = base.scenes.map(scene => {
    if (scene.bgm === 'music-boss' || scene.id.startsWith('silence-')) return scene;
    const role = sceneRoles[scene.id]
      ?? (scene.id.startsWith('v100-credits-') ? 'ending' : null)
      ?? (scene.bgm === 'music-v099-normal' ? 'normal' : null)
      ?? (scene.bgm?.startsWith('music-v099-pressure-') ? 'pressure' : null);
    return role ? score(scene, role) : scene;
  });
  V100_STORY_SCORE_ROLES.forEach((roles, index) => {
    for (const [phaseIndex, phase] of ['pre', 'post'].entries()) {
      const number = index + 1, id = 'v100-score-s' + String(number).padStart(2,'0') + '-' + phase;
      const original = base.scenes.find(scene => scene.id === baseStoryScene(number, phase));
      if (!original) throw new Error('Missing story ambience: ' + number + ' ' + phase);
      scenes.push(score(original, roles[phaseIndex], id));
      const cut = phase === 'post' && V100_STORY_SCORE_CUTS.find(c => c.stage === number);
      if (cut) scenes.push(score(original, cut.role, id + '-cut'));
    }
  });
  return { ...base, scenes, assets: [...base.assets, ...V100_MUSIC_TRACKS.map(track => ({
    id: v100ScoreAssetId(track.role), category: 'bgm', preload: 'scene', loop: true,
    gain: track.gain, priority: 900, cooldownMs: 0, maxInstances: 1,
    sources: ['mp3','ogg'].map(ext => ({ src: '/audio/v100/score/' + track.role + '.' + ext,
      type: ext === 'mp3' ? 'audio/mpeg' : 'audio/ogg' })),
  }))] };
}
// The shell owns preparation/result music; the combat engine owns battle music.
// Keeping the same scene ID across preparation tabs also preserves playback.
export function v100SurfaceScore({ ready = false, battleActive = false, modeResult = null, phase = '', won = null } = {}) {
  if (!ready || battleActive || !['name','title','map','formation','result'].includes(phase)) return null;
  const sceneId = modeResult === 'victory' || modeResult === 'defeat' ? modeResult
    : phase === 'result' ? won === false ? 'defeat' : 'victory' : 'map';
  return { eventId: 'v100:surface:' + sceneId, nodeIndex: 0, sceneId, category: 'surface',
    cueId: null, dialogueDucking: false, transition: 'scene-crossfade' };
}
