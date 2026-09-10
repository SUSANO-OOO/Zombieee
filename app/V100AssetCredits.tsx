import { V100_MUSIC_TRACKS } from "./v100Music.js";
export function V100AssetCredits() {
  return <details className="v100-asset-credits"><summary>制作・素材クレジット</summary>
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
