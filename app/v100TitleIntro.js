export const V100_TITLE_VOICE = Object.freeze({
  src: "/audio/v100/title/k4ito-title-call-r1.wav",
  author: "K4ITo",
  duration: 2.8373015873015874,
  bytes: 250294,
  sha256: "70c351145b92e108f5fc7ff879dd5c70de014fe99bff7ff385673a06fac471f2",
  gain: .72,
});
export const V100_TITLE_INTRO_END = 3.65;
const smooth = value => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };
export function v100TitleIntroFrame(seconds, reducedMotion = false) {
  const time = Math.max(0, Math.min(V100_TITLE_INTRO_END, Number(seconds) || 0));
  const reveal = smooth((time - .16) / 1.8);
  const sweep = Math.max(0, Math.min(1, (time - 2.35) / .63));
  return {
    elapsed: time,
    reveal: reducedMotion ? 1 : reveal,
    rise: reducedMotion ? 0 : (1 - reveal) * 8,
    flash: reducedMotion || sweep === 0 || sweep === 1 ? 0 : Math.sin(sweep * Math.PI) ** 2,
    sweep: -65 + sweep * 230,
    blood: reducedMotion ? .36 : smooth((time - 2.48) / .5) * .36,
    version: reducedMotion ? 1 : smooth((time - .85) / .9),
    menu: reducedMotion ? 1 : smooth((time - 2.88) / .68),
    complete: time >= V100_TITLE_INTRO_END,
  };
}
