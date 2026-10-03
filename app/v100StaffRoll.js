import { V100_UNITS } from "./v100Registry.js";
import { V100_MUSIC_TRACKS } from "./v100Music.js";

export const V100_CREDITS_SONG = Object.freeze({
  title: "追憶の幻想世界",
  artist: "魔王魂",
  src: "/audio/v100/credits/maou_31_tsuioku_no_gensosekai.mp3",
  page: "https://maou.audio/31_tsuioku_no_gensosekai/",
  terms: "https://maou.audio/rule/",
  duration: 315.7681632653061,
  sha256: "a5be98c2cba42b2d0363d433aceced2946850ec25459fd59bb36cbd2c8d98248",
});

export function v100StaffRollSections(playerName = "指揮官") {
  return [
    { title: "企画・制作", lines: ["SUSANO-OOO"] },
    { title: "開発協力", lines: ["Codex", "ChatGPT"] },
    { title: "西新で出会った仲間たち", lines: V100_UNITS.map(unit => unit.displayName) },
    { title: "最後まで指揮を執ったあなた", lines: [playerName] },
    { title: "エンディングテーマ", lines: ["追憶の幻想世界", "音楽：魔王魂", "作詞・作曲・歌・ベース・ギター　森田交一", "ドラム　与野裕史", "ピアノ　佐藤まさみ"] },
    { title: "場面別の音楽", lines: ["Scott Buckley / CC BY 4.0", ...V100_MUSIC_TRACKS.filter((track, index, all) => all.findIndex(other => other.file === track.file) === index).map(track => track.title)] },
    { title: "効果音・エフェクト素材", lines: ["Vincent Sevedge (Tabasco) / CC BY 3.0", "Kenney / CC0", "Joth / CC0", "rubberduck / CC0"] },
    { title: "THANK YOU FOR PLAYING", lines: ["西新世紀末物語", "最後まで指揮してくれて、ありがとう。"] },
  ];
}

// The original song is 126 BPM. Uneven cuts use bar-length intervals after the
// opening, giving reconstruction shots more time and holding the final scene
// through the original musical tail. Native duration can vary by decoder.
export const V100_CREDITS_CUES = Object.freeze([0, 23.55, 46.407143, 76.883333, 107.359524, 145.454762, 175.930952, 206.407143, 244.502381, 274.978571, 297.835714]);
export const V100_CREDITS_CAMERAS = Object.freeze([
  [2, -2, 0, 0, 1.12, 1.04], [-2, 1, -1, 0, 1.06, 1.12], [2, -1, 0, 1, 1.1, 1.04],
  [-1, 2, 1, -1, 1.04, 1.12], [2, -2, -1, 1, 1.11, 1.04], [1, -2, 0, 0, 1.06, 1.12],
  [-2, 2, -1, 0, 1.09, 1.04], [1, -1, 0, 0, 1.04, 1.1], [-2, 1, 0, -1, 1.12, 1.05],
  [2, -2, 1, 0, 1.12, 1.04], [1, 0, 0, 0, 1.04, 1.08],
].map(camera => Object.freeze(camera)));
function cueStarts(count, length) {
  return count === V100_CREDITS_CUES.length ? V100_CREDITS_CUES.map(time => time * length / V100_CREDITS_SONG.duration)
    : Array.from({ length: count }, (_, index) => index * length / count);
}
export function v100StaffRollCamera(index, progress = 0) {
  const camera = V100_CREDITS_CAMERAS[index] ?? V100_CREDITS_CAMERAS[0];
  const phase = Math.max(0, Math.min(1, (progress - .08) / .72));
  const eased = phase * phase * (3 - 2 * phase);
  const mix = (from, to) => from + (to - from) * eased;
  return { x: mix(camera[0], camera[1]), y: mix(camera[2], camera[3]), scale: mix(camera[4], camera[5]) };
}
export function v100StaffRollFrame(elapsed, duration, sceneCount) {
  const length = Number.isFinite(duration) && duration > 0 ? duration : V100_CREDITS_SONG.duration;
  const count = Math.max(1, Math.floor(sceneCount) || 1);
  const time = Math.max(0, Math.min(length, Number(elapsed) || 0));
  const starts = cueStarts(count, length);
  const index = Math.max(0, starts.findLastIndex(start => start <= time));
  const span = (starts[index + 1] ?? length) - starts[index];
  const withinScene = Math.min(1, (time - starts[index]) / span);
  const dissolve = index === count - 2 ? 3 : [3, 5, 7].includes(index) ? 1.6 : .85;
  return { elapsed: time, progress: time / length, index, nextIndex: Math.min(count - 1, index + 1),
    blend: index === count - 1 ? 0 : Math.max(0, Math.min(1, (withinScene * span - (span - dissolve)) / dissolve)),
    withinScene, ended: time >= length };
}

export function v100StaffRollResumeSeconds(nodeIndex, sceneCount, duration = V100_CREDITS_SONG.duration) {
  const count = Math.max(1, Math.floor(sceneCount) || 1);
  const length = Number.isFinite(duration) && duration > 0 ? duration : V100_CREDITS_SONG.duration;
  return cueStarts(count, length)[Math.max(0, Math.min(count - 1, Math.floor(Number(nodeIndex) || 0)))];
}
