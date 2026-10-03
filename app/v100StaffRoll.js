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

export function v100StaffRollFrame(elapsed, duration, sceneCount) {
  const length = Number.isFinite(duration) && duration > 0 ? duration : V100_CREDITS_SONG.duration;
  const count = Math.max(1, Math.floor(sceneCount) || 1);
  const time = Math.max(0, Math.min(length, Number(elapsed) || 0));
  const span = length / count;
  const index = Math.min(count - 1, Math.floor(time / span));
  const withinScene = Math.min(1, (time - index * span) / span);
  return { elapsed: time, progress: time / length, index, nextIndex: Math.min(count - 1, index + 1),
    blend: index === count - 1 ? 0 : Math.max(0, Math.min(1, (withinScene * span - (span - 2.5)) / 2.5)),
    withinScene, ended: time >= length };
}

export function v100StaffRollResumeSeconds(nodeIndex, sceneCount, duration = V100_CREDITS_SONG.duration) {
  const count = Math.max(1, Math.floor(sceneCount) || 1);
  return Math.max(0, Math.min(count - 1, Math.floor(Number(nodeIndex) || 0))) * duration / count;
}
