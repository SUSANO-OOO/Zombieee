// Producer-directed finale. The existing epilogue event/save ID remains stable.
export const V100_POST_CREDITS_SHOTS = Object.freeze([
  { id: "king-back", start: 2.2, src: "/art/v100/epilogue/meinohama-king-back-r3.webp", description: "真夜中の漁港。クレイジーキングが海に向かって立つ後ろ姿。" },
  { id: "king-reach", start: 8.2, src: "/art/v100/epilogue/meinohama-king-reach-r3.webp", description: "キングが両手をヘルメットへ伸ばす。" },
  { id: "king-remove", start: 12.3, src: "/art/v100/epilogue/meinohama-king-remove-r3.webp", description: "同じ構図のまま、キングがヘルメットを脱ぐ。" },
  { id: "king-throw", start: 16.4, src: "/art/v100/epilogue/meinohama-king-throw-r3.webp", description: "キングがヘルメットを海へ投げ捨てる。" },
  { id: "helmet-afloat", start: 19.8, src: "/art/v100/epilogue/meinohama-helmet-afloat-r2.webp", description: "黄色いヘルメットが暗い波間に浮かぶ。" },
  { id: "king-turn", start: 23.2, src: "/art/v100/epilogue/king-turn-r1.webp", description: "海へ向けた背中はそのままに、男が肩越しに振り返る。月明かりが濁った目をかすめる。" },
  { id: "ogata-reveal", start: 26.2, src: "/art/v100/epilogue/king-monster-reveal-r6.webp", description: "暗がりから、男の異様に変色した顔が現れる。片側の皮膚が隆起し、濁った目がこちらを見つめる。" },
  { id: "infected-eyes", start: 29, src: "/art/v100/epilogue/king-infected-eyes-r1.webp", description: "濁った両目がこちらへ合う。片側のまぶたがわずかに狭まり、こめかみに異様な隆起が広がる。" },
  { id: "crooked-smile", start: 31.6, src: "/art/v100/epilogue/king-crooked-smile-r1.webp", description: "片方の口角が先に上がり、唇の間から不揃いの歯が覗き始める。" },
  { id: "ogata-grin", start: 34.2, src: "/art/v100/epilogue/king-monster-grin-r5.webp", description: "男が奇妙な笑みを浮かべる。低い笑い声が静かな港に響き、顔が闇へ沈む。" },
].map(Object.freeze));
export const V100_POST_CREDITS_AUDIO = Object.freeze({
  waves: "/audio/v100/epilogue/meinohama-waves-r1.mp3",
  music: "/audio/v100/score/horror.mp3",
  laugh: "/audio/v100/epilogue/king-laugh-r1.mp3",
});
export const V100_POST_CREDITS_LAUGH_CUE = 32.5;
export const V100_POST_CREDITS_PICTURE_END = 39;
export const V100_POST_CREDITS_MUSIC_END = 55.5;
export const V100_POST_CREDITS_MIX = Object.freeze({ music: .95, waves: .3, laugh: .72 });
export const V100_POST_CREDITS_TITLES = Object.freeze({
  continuation: "物語は、まだまだ続く...",
  sequel: "西新世紀末物語Ⅱ(仮称)",
  season: "COMING SOON - WINTER 2026",
  thanks: "最後まで遊んでくれてありがとう！！",
});
export const V100_POST_CREDITS_DURATION = 64;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const time = clamp(value); return time * time * (3 - 2 * time); };
const envelope = (time, start, end, fadeIn, fadeOut) => clamp((time - start) / fadeIn) * clamp((end - time) / fadeOut);
export function v100PostCreditsFrame(seconds, reducedMotion = false) {
  const elapsed = Math.max(0, Math.min(V100_POST_CREDITS_DURATION, Number(seconds) || 0));
  const shotIndex = Math.max(0, V100_POST_CREDITS_SHOTS.findLastIndex(shot => shot.start <= elapsed));
  const nextShotIndex = Math.min(V100_POST_CREDITS_SHOTS.length - 1, shotIndex + 1);
  const text = elapsed >= 56.5 ? "thanks" : elapsed >= 47.5 ? "sequel" : elapsed >= 40 ? "continuation" : null;
  const titleOpacity = text === "thanks" ? envelope(elapsed, 56.5, 62, 1.2, 1.5)
    : text === "sequel" ? envelope(elapsed, 47.5, 55, 1.3, 1.5)
    : text === "continuation" ? envelope(elapsed, 40, 46.5, 1.5, 1) : 0;
  // Consecutive rear poses share one continuous camera movement. Never
  // dissolve between hands/helmet poses or reset the camera on those cuts.
  const cameraProgress = shotIndex < 4 ? ease((elapsed - 2.2) / 17.6)
    : shotIndex === 4 ? ease((elapsed - 19.8) / 3.4) : ease((elapsed - 23.2) / 15.8);
  // The close-ups are separately drawn performances. One restrained camera
  // movement continues through them; no rapid magnification or black flash.
  const scale = 1 + cameraProgress * (shotIndex < 4 ? .025 : shotIndex === 4 ? .02 : .035);
  const laughGain = envelope(elapsed, V100_POST_CREDITS_LAUGH_CUE, 38, .1, 1.5);
  const laughDucking = 1 - .45 * laughGain;
  return { elapsed, shotIndex, nextShotIndex, blend: 0, text, titleOpacity,
    imageOpacity: envelope(elapsed, 2.2, V100_POST_CREDITS_PICTURE_END, 2, 2.2),
    scale: reducedMotion ? 1 : scale,
    focus: "50% 50%",
    brightness: 1,
    wavesGain: envelope(elapsed, 0, V100_POST_CREDITS_PICTURE_END, 2.2, 2.2) * (1 - .3 * laughGain),
    musicGain: envelope(elapsed, 0, V100_POST_CREDITS_MUSIC_END, 5, 3.5) * laughDucking,
    laughGain,
    ended: elapsed >= V100_POST_CREDITS_DURATION };
}
