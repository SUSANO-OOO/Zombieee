import { V100_UNITS } from "./v100Registry.js";
import { V100_MUSIC_TRACKS } from "./v100Music.js";
import { V100_CREDITS_FILM } from "./v100CreditsFilm.js";
import { V100_SOUND_CREDITS, V100_BUNDLED_LEGACY_CREDITS, V100_STORY_CAST_CREDITS } from "./v100CreditSources.js";

export const V100_CREDITS_SONG = Object.freeze({
  title: "追憶の幻想世界",
  artist: "魔王魂",
  src: "/audio/v100/credits/maou_31_tsuioku_no_gensosekai.mp3",
  page: "https://maou.audio/31_tsuioku_no_gensosekai/",
  terms: "https://maou.audio/rule/",
  duration: 315.7681632653061,
  sha256: "a5be98c2cba42b2d0363d433aceced2946850ec25459fd59bb36cbd2c8d98248",
});

export function v100StaffRollSections(playerName = "") {
  const name = String(playerName ?? "").trim();
  return [
    { title: "企画・原案・制作・監修", lines: ["SUSANO-OOO"] },
    { title: "シナリオ構成・編集", lines: ["SUSANO-OOO", "ChatGPT", "Codex"] },
    { title: "ゲーム実装・UI・戦闘演出", lines: ["Codex"] },
    { title: "背景・人物・エフェクト画像制作", lines: ["OpenAI ImageGen", "画像加工・ゲーム用素材制作　Codex"] },
    { title: "オリジナル音響設計・音源加工", lines: ["Codex"] },
    { title: "品質確認", lines: ["Codex"] },
    { title: "西新で出会った仲間たち", lines: V100_UNITS.map(unit => unit.displayName) },
    ...V100_STORY_CAST_CREDITS,
    ...(name ? [{ title: "指揮官", lines: [name] }] : []),
    { title: "エンディングテーマ", lines: ["追憶の幻想世界", "音楽：魔王魂", "作詞・作曲・歌・ベース・ギター", "森田交一", "ドラム", "与野裕史", "ピアノ", "佐藤まさみ"] },
    { title: "場面別の音楽", lines: ["Scott Buckley / CC BY 4.0", ...V100_MUSIC_TRACKS.filter((track, index, all) => all.findIndex(other => other.file === track.file) === index).map(track => track.title)] },
    ...V100_SOUND_CREDITS.map(credit => ({ title: credit.role, lines: [credit.author, ...credit.works, credit.license] })),
    { title: "旧版から継承・同梱した音源", lines: V100_BUNDLED_LEGACY_CREDITS.flatMap(credit => [credit.author, credit.work]) },
  ];
}

// The original song is 126 BPM. Uneven cuts use bar-length intervals after the
// opening, giving reconstruction shots more time and holding the final scene
// through the original musical tail. Native duration can vary by decoder.
export const V100_CREDITS_CUES = Object.freeze([0, 23.55, 46.407143, 76.883333, 107.359524, 145.454762, 175.930952, 206.407143, 244.502381, 274.978571, 286.407143]);
function cueStarts(count, length) {
  return count === V100_CREDITS_CUES.length ? V100_CREDITS_CUES.map(time => time * length / V100_CREDITS_SONG.duration)
    : Array.from({ length: count }, (_, index) => index * length / count);
}
function filmCueStarts(count, length) {
  const starts = cueStarts(count, length);
  if (count !== V100_CREDITS_CUES.length) return starts;
  const bar = 240 / 126 * length / V100_CREDITS_SONG.duration;
  return starts.flatMap((start, index) => {
    const span = (starts[index + 1] ?? length) - start;
    const shots = V100_CREDITS_FILM.filter(shot => shot.sceneIndex === index);
    const totalWeight = shots.reduce((sum, shot) => sum + (shot.durationWeight ?? 1), 0);
    let weight = 0;
    return shots.map((shot, shotIndex) => {
      const offset = shotIndex === 0 ? 0 : Math.max(span * .04, Math.min(span * .96, Math.round(span * weight / totalWeight / bar) * bar));
      weight += shot.durationWeight ?? 1;
      return start + offset;
    });
  });
}
export function v100StaffRollFrame(elapsed, duration, sceneCount) {
  const length = Number.isFinite(duration) && duration > 0 ? duration : V100_CREDITS_SONG.duration;
  const count = Math.max(1, Math.floor(sceneCount) || 1);
  const time = Math.max(0, Math.min(length, Number(elapsed) || 0));
  const starts = cueStarts(count, length);
  const index = Math.max(0, starts.findLastIndex(start => start <= time));
  const span = (starts[index + 1] ?? length) - starts[index];
  const withinScene = Math.min(1, (time - starts[index]) / span);
  const filmStarts = filmCueStarts(count, length);
  const shotIndex = Math.max(0, filmStarts.findLastIndex(start => start <= time));
  const shotSpan = (filmStarts[shotIndex + 1] ?? length) - filmStarts[shotIndex];
  const withinShot = Math.min(1, (time - filmStarts[shotIndex]) / shotSpan);
  const dissolve = shotIndex === filmStarts.length - 2 ? 2.4 : 1.15;
  return { elapsed: time, progress: time / length, index, nextIndex: Math.min(count - 1, index + 1),
    shotIndex, nextShotIndex: Math.min(filmStarts.length - 1, shotIndex + 1), withinShot,
    blend: shotIndex === filmStarts.length - 1 ? 0 : Math.max(0, Math.min(1, (withinShot * shotSpan - (shotSpan - dissolve)) / dissolve)),
    withinScene, ended: time >= length };
}

export function v100StaffRollResumeSeconds(nodeIndex, sceneCount, duration = V100_CREDITS_SONG.duration) {
  const count = Math.max(1, Math.floor(sceneCount) || 1);
  const length = Number.isFinite(duration) && duration > 0 ? duration : V100_CREDITS_SONG.duration;
  return cueStarts(count, length)[Math.max(0, Math.min(count - 1, Math.floor(Number(nodeIndex) || 0)))];
}
