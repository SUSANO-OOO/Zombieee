import { V100_MUSIC_TRACKS } from "./v100Music.js";
import { V100_CREDITS_SONG } from "./v100StaffRoll.js";
import { V100_SOUND_CREDITS, V100_BUNDLED_LEGACY_CREDITS, V100_PRODUCTION_TOOLS } from "./v100CreditSources.js";
export function V100AssetCredits({ expanded = false }: { expanded?: boolean }) {
  return <details className="v100-asset-credits" open={expanded}><summary>制作・素材クレジット</summary>
    <p>エンディングテーマ：<a href={V100_CREDITS_SONG.page} target="_blank" rel="noreferrer">「追憶の幻想世界」</a>。
      音楽：魔王魂。作詞・作曲・歌・ベース・ギター：森田交一、ドラム：与野裕史、ピアノ：佐藤まさみ。
      <a href={V100_CREDITS_SONG.terms} target="_blank" rel="noreferrer">魔王魂の利用規約</a>に基づいて使用。原曲を使用し、再生音量をゲーム用に調整。</p>
    <p>タイトルコール：K4ITo。制作者提供の録音を使用。</p>
    <p>タイトル・場面別BGM：Scott Buckley ／
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>。
      抜粋、ループの継ぎ目、音量をゲーム用に調整。</p>
    <ul>{V100_MUSIC_TRACKS.filter((track, index, all) => all.findIndex(other => other.file === track.file) === index).map(track =>
      <li key={track.file}><a href={`https://www.scottbuckley.com.au/library/${track.page}/`} target="_blank" rel="noreferrer">{track.title}</a></li>)}</ul>
    <h3>音楽素材</h3>
    <ul>{V100_SOUND_CREDITS.filter(credit => credit.role === "ボス戦音楽").map(credit => <li key={credit.author}><a href={credit.page} target="_blank" rel="noreferrer">{credit.author} — {credit.works.join(" / ")}</a> ／ <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">{credit.license}</a></li>)}</ul>
    <h3>効果音・ボイス・エフェクト素材</h3>
    <ul>{V100_SOUND_CREDITS.filter(credit => credit.role !== "ボス戦音楽").map(credit => <li key={credit.author}>
      <a href={credit.page} target="_blank" rel="noreferrer">{credit.author}</a>
      <br />{credit.works.join(" / ")} ／
      <a href={credit.license === "CC0" ? "https://creativecommons.org/publicdomain/zero/1.0/" : "https://creativecommons.org/licenses/by/3.0/"} target="_blank" rel="noreferrer">{credit.license}</a>
    </li>)}</ul>
    <p>戦闘ボイス・効果音は切り出し、フィルター、音量、フェードを調整。エフェクト画像はゲーム用の配置・再生時間・煙の重なりを調整。</p>
    <p>画面本文：BIZ UDPGothic。見出し・ボタン：Zen Kaku Gothic New。英数字：Rajdhani。タイトル：New Tegomin。Google Fontsで配布される書体を使用。著作権表示とSIL Open Font License 1.1全文を同梱。</p>
    <p>旧版から継承・同梱した音源（CC0）：</p>
    <ul>{V100_BUNDLED_LEGACY_CREDITS.map(credit => <li key={credit.author}><a href={credit.page} target="_blank" rel="noreferrer">{credit.author} — {credit.work}</a></li>)}</ul>
    <p>企画・制作・監修：K4ITo。開発・シナリオ構成・品質確認：Codex / ChatGPT。背景・人物・エフェクト画像制作支援：OpenAI ImageGen。</p>
    <h3>使用ツール</h3>
    {V100_PRODUCTION_TOOLS.map(section => <p key={section.title}><strong>{section.title}</strong><br />{section.lines.join(" / ")}</p>)}
  </details>;
}
