import { V100_MUSIC_TRACKS } from "./v100Music.js";
import { V100_CREDITS_SONG } from "./v100StaffRoll.js";
export function V100AssetCredits({ expanded = false }: { expanded?: boolean }) {
  return <details className="v100-asset-credits" open={expanded}><summary>制作・素材クレジット</summary>
    <p>エンディングテーマ：<a href={V100_CREDITS_SONG.page} target="_blank" rel="noreferrer">「追憶の幻想世界」</a>。
      音楽：魔王魂。作詞・作曲・歌・ベース・ギター：森田交一、ドラム：与野裕史、ピアノ：佐藤まさみ。
      <a href={V100_CREDITS_SONG.terms} target="_blank" rel="noreferrer">魔王魂の利用規約</a>に基づいて使用。原曲を使用し、再生音量をゲーム用に調整。</p>
    <p>場面別BGM：Scott Buckley ／
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>。
      抜粋、ループの継ぎ目、音量をゲーム用に調整。</p>
    <ul>{V100_MUSIC_TRACKS.filter((track, index, all) => all.findIndex(other => other.file === track.file) === index).map(track =>
      <li key={track.file}><a href={`https://www.scottbuckley.com.au/library/${track.page}/`} target="_blank" rel="noreferrer">{track.title}</a></li>)}</ul>
    <p>銃声：Vincent Sevedge（Tabasco）「Gunshot Sounds」。
      <a href="https://opengameart.org/content/gunshot-sounds" target="_blank" rel="noreferrer">配布元</a> ／
      <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>。
      切り出し、フィルター、音量、フェードを調整。</p>
    <p>操作音・物音・土煙：<a href="https://kenney.nl/" target="_blank" rel="noreferrer">Kenney</a>（CC0）。
      爆発音：<a href="https://opengameart.org/content/chunky-explosion" target="_blank" rel="noreferrer">Joth — Chunky Explosion</a>（CC0）。</p>
    <p>爆発の連続画像：<a href="https://opengameart.org/content/25-special-effects-rendered-with-blender" target="_blank" rel="noreferrer">rubberduck</a>（CC0）。
      ゲーム用の配置・再生時間・煙の重なりを調整。</p>
  </details>;
}
