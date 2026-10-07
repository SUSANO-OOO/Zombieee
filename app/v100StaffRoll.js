import { V100_UNITS } from "./v100Registry.js";
import { V100_MUSIC_TRACKS } from "./v100Music.js";
import { V100_CREDITS_FILM } from "./v100CreditsFilm.js";
import { V100_CREDITS_SCENE_STARTS } from "./v100CreditsFilmEdit.js";
import { V100_SOUND_CREDITS, V100_BUNDLED_LEGACY_CREDITS, V100_STORY_CAST_CREDITS, V100_PRODUCTION_TOOLS } from "./v100CreditSources.js";

export const V100_CREDITS_SONG = Object.freeze({
  title: "追憶の幻想世界",
  artist: "魔王魂",
  src: "/audio/v100/credits/maou_31_tsuioku_no_gensosekai.mp3",
  page: "https://maou.audio/31_tsuioku_no_gensosekai/",
  terms: "https://maou.audio/rule/",
  duration: 315.7681632653061,
  sha256: "a5be98c2cba42b2d0363d433aceced2946850ec25459fd59bb36cbd2c8d98248",
});

// The Producer's edit starts the original-speed song fade at 1:46.
// Film/credit time is separate from the decoder's full MP3 duration.
export const V100_CREDITS_DURATION = 106;
export const V100_CREDITS_FADE_SECONDS = 2.4;
export const V100_CREDITS_OUTRO_SECONDS = 3.2;
export const V100_CREDITS_MIX_GAIN = .48;
export function v100CreditsOutroFrame(seconds) {
  const time = Math.max(0, Number(seconds) || 0);
  const phase = Math.min(1, time / V100_CREDITS_FADE_SECONDS);
  return { gain: phase === 1 ? 0 : Math.cos(phase * Math.PI / 2) ** 2,
    curtain: Math.max(0, Math.min(1, (time - 1.5) / 1.7)), ended: time >= V100_CREDITS_OUTRO_SECONDS };
}

export function v100StaffRollSections() {
  const section = (title, lines, columns = 1, kind = "names", entries = null) => ({ title, lines, columns, kind, entries });
  const materials = (title, credits) => section(title,
    credits.flatMap(credit => [credit.author + " · " + credit.license, ...credit.works]), 1, "materials", credits);
  return [
    section("企画・原案・制作・監修", ["K4ITo"], 1, "producer"),
    section("制作支援", ["ChatGPT / Codex", "シナリオ構成・実装・演出・音響・品質確認", "OpenAI ImageGen", "背景・人物・エフェクト画像"]),
    section("登場人物", V100_UNITS.map(unit => unit.displayName), 2),
    ...V100_STORY_CAST_CREDITS.map(credit => section(credit.title, [...credit.lines], 2)),
    section("エンディングテーマ", ["追憶の幻想世界", "音楽：魔王魂", "作詞・作曲・歌・ベース・ギター", "森田交一", "ドラム：与野裕史", "ピアノ：佐藤まさみ", "魔王魂の利用規約に基づいて使用"]),
    section("音楽素材", ["Scott Buckley · CC BY 4.0", ...V100_MUSIC_TRACKS.filter((track, index, all) => all.findIndex(other => other.file === track.file) === index).map(track => track.title)], 1),
    materials("音楽素材", V100_SOUND_CREDITS.filter(credit => credit.role === "ボス戦音楽")),
    materials("効果音・ボイス・エフェクト素材", V100_SOUND_CREDITS.filter(credit => credit.role !== "ボス戦音楽")),
    materials("旧版から継承・同梱した音源", V100_BUNDLED_LEGACY_CREDITS.map(credit => ({ ...credit, works: [credit.work], license: "CC0" }))),
    ...V100_PRODUCTION_TOOLS.slice(1).map(credit => section("使用ツール — " + credit.title, [...credit.lines], 2)),
    section("使用書体", ["BIZ UDPGothic", "Zen Kaku Gothic New", "Rajdhani", "SIL Open Font License 1.1"]),
  ];
}

// Scene boundaries follow the original 126 BPM bars; the final table holds
// through 1:46. All eleven stored scene indices remain in their original order.
export const V100_CREDITS_CUES = V100_CREDITS_SCENE_STARTS;
// An insert cut may describe a closer view of the same drawing. Keep one
// camera trajectory across that drawing so the insert never resets its crop.
const filmCameraPaths = V100_CREDITS_FILM.map((shot, index, film) => {
  let first = index, last = index;
  while (first > 0 && film[first - 1].src === shot.src && film[first - 1].sceneIndex === shot.sceneIndex) first--;
  while (last + 1 < film.length && film[last + 1].src === shot.src && film[last + 1].sceneIndex === shot.sceneIndex) last++;
  const from = film[first].camera, to = film[last].camera;
  return { first, last, camera: first === last ? from : { ...from, to: Math.min(to.to, from.from + .09), toX: to.x, toY: to.y,
    toPositionX: to.positionX, toPositionY: to.positionY } };
});
function cueStarts(count, length) {
  return count === V100_CREDITS_CUES.length ? V100_CREDITS_CUES.map(time => time * length / V100_CREDITS_DURATION)
    : Array.from({ length: count }, (_, index) => index * length / count);
}
function filmCueStarts(count, length) {
  const starts = cueStarts(count, length);
  if (count !== V100_CREDITS_CUES.length) return starts;
  return starts.flatMap((start, index) => {
    const span = (starts[index + 1] ?? length) - start;
    const shots = V100_CREDITS_FILM.filter(shot => shot.sceneIndex === index);
    const totalWeight = shots.reduce((sum, shot) => sum + (shot.durationWeight ?? 1), 0);
    let weight = 0;
    return shots.map((shot, shotIndex) => {
      const offset = Number.isFinite(shot.sceneOffset) ? shot.sceneOffset * length / V100_CREDITS_DURATION
        : shotIndex === 0 ? 0 : span * weight / totalWeight;
      weight += shot.durationWeight ?? 1;
      return start + offset;
    });
  });
}

// A single continuous track keeps every credit. Measure the actual wrapped
// content; settle the closing signature four seconds before the audio fade.
export function v100CreditScrollFrame(seconds, contentHeight, windowHeight, footerHeight = 80) {
  const time = Math.max(0, Math.min(102, Number(seconds) || 0));
  const height = Math.max(0, Number(contentHeight) || 0), view = Math.max(0, Number(windowHeight) || 0);
  const fraction = time < 2 ? time * time / 400 : time > 100 ? 1 - (102 - time) ** 2 / 400 : (time - 1) / 100;
  const from = view * .45, to = view * .5 - height + Math.max(0, Number(footerHeight) || 0) / 2;
  return { progress: fraction, offset: from + (to - from) * fraction };
}
export function v100StaffRollFrame(elapsed, duration, sceneCount) {
  const length = Number.isFinite(duration) && duration > 0 ? Math.min(duration, V100_CREDITS_DURATION) : V100_CREDITS_DURATION;
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
  const cameraPath = count === V100_CREDITS_CUES.length ? filmCameraPaths[shotIndex] : null;
  const cameraStart = cameraPath ? filmStarts[cameraPath.first] : filmStarts[shotIndex];
  const cameraEnd = filmStarts[(cameraPath?.last ?? shotIndex) + 1] ?? length;
  const cameraProgress = Math.min(1, (time - cameraStart) / (cameraEnd - cameraStart));
  // Each shot chooses how it enters, including the close-ups and visual gags.
  const dissolve = V100_CREDITS_FILM[shotIndex + 1]?.transition === "cut" ? 0 : Math.min(shotSpan * .3, .55);
  return { elapsed: time, progress: time / length, index, nextIndex: Math.min(count - 1, index + 1),
    shotIndex, nextShotIndex: Math.min(filmStarts.length - 1, shotIndex + 1), withinShot,
    camera: cameraPath?.camera, cameraProgress,
    blend: shotIndex === filmStarts.length - 1 || dissolve === 0 ? 0 : Math.max(0, Math.min(1, (withinShot * shotSpan - (shotSpan - dissolve)) / dissolve)),
    withinScene, ended: time >= length };
}

export function v100StaffRollResumeSeconds(nodeIndex, sceneCount, duration = V100_CREDITS_DURATION) {
  const count = Math.max(1, Math.floor(sceneCount) || 1);
  const length = Number.isFinite(duration) && duration > 0 ? Math.min(duration, V100_CREDITS_DURATION) : V100_CREDITS_DURATION;
  return cueStarts(count, length)[Math.max(0, Math.min(count - 1, Math.floor(Number(nodeIndex) || 0)))];
}
