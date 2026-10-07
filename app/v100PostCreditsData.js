// Producer-directed finale. The existing epilogue event/save ID remains stable.
export const V100_POST_CREDITS_SHOTS = Object.freeze([
  { id: "king-back", start: 2.2, src: "/art/v100/epilogue/meinohama-king-back-r2.webp", description: "真夜中の姪浜漁港。クレイジーキングが海に向かって立つ後ろ姿。" },
  { id: "king-reach", start: 8.2, src: "/art/v100/epilogue/meinohama-king-reach-r2.webp", description: "キングが両手をヘルメットへ伸ばす。" },
  { id: "king-remove", start: 12.3, src: "/art/v100/epilogue/meinohama-king-remove-r2.webp", description: "同じ構図のまま、キングがヘルメットを脱ぐ。" },
  { id: "king-throw", start: 16.4, src: "/art/v100/epilogue/meinohama-king-throw-r2.webp", description: "キングがヘルメットを海へ投げ捨てる。" },
  { id: "helmet-afloat", start: 19.8, src: "/art/v100/epilogue/meinohama-helmet-afloat-r1.webp", description: "黄色いヘルメットが暗い波間に浮かぶ。" },
  { id: "ogata-reveal", start: 25.2, src: "/art/v100/epilogue/meinohama-ogata-reveal-r2.webp", description: "キングの素顔は、感染し傷を負った緒方海人。奇妙な表情で正面を見つめる。" },
  { id: "ogata-grin", start: 31, src: "/art/v100/epilogue/meinohama-ogata-grin-r1.webp", description: "海人が不気味に笑う。歯には血が付いている。" },
].map(Object.freeze));
export const V100_POST_CREDITS_AUDIO = Object.freeze({
  waves: "/audio/v100/epilogue/meinohama-waves-r1.mp3",
  music: "/audio/v100/score/horror.mp3",
});
export const V100_POST_CREDITS_TITLES = Object.freeze({
  continuation: "物語は、まだまだ続く...",
  sequel: "西新世紀末物語Ⅱ(仮称)",
  season: "COMING SOON - WINTER 2026",
  thanks: "最後まで遊んでくれてありがとう！！",
});
export const V100_POST_CREDITS_DURATION = 64;
const clamp = value => Math.max(0, Math.min(1, value));
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
  const cameraProgress = shotIndex < 4 ? clamp((elapsed - 2.2) / 17.6)
    : shotIndex === 4 ? clamp((elapsed - 19.8) / 5.4) : clamp((elapsed - 25.2) / 12.8);
  return { elapsed, shotIndex, nextShotIndex, blend: 0, text, titleOpacity,
    imageOpacity: envelope(elapsed, 2.2, 39, 2, 2.2),
    scale: reducedMotion ? 1 : 1 + cameraProgress * (shotIndex < 4 ? .025 : shotIndex === 4 ? .035 : .045),
    wavesGain: envelope(elapsed, 0, 40, 2.2, 3),
    musicGain: envelope(elapsed, 0, 55.5, 5, 3.5),
    ended: elapsed >= V100_POST_CREDITS_DURATION };
}
