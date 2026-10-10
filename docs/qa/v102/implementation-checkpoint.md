# Version 1.0.2 — 実装時点の確認

対象正本は `docs/PRODUCER_DECISIONS_1.0.2.md`、台帳はIssue #177。
公開1.0.1 `634f8de4b0fb15df902a7dd5983ea94237cfea9d`からの差分である。

## 実装

- 音声：両ミキサーの再生カテゴリをplaybackに統一。前景復帰は既存の再生要求だけを一度回復する。消音、終了、中断継続中、別の音声所有者への干渉を防ぐ。録音ファイルへの音声収録成功は未確認。
- 動作：48種の描画形態を対応表へ固定。15人の人型歩行は同一原画の関節切り出しで組み立てる。移動距離から足運びと歩行画像の周期を決める。汎用動作の伸縮、接地中の上下浮遊、ポーズごとの拡大縮小を除く。専用の盾、連続技、boss能力、撤退は既存の武器socketを維持する。
- Gore：実際に減ったHPをstable IDで一回だけ観測する。範囲効果がfighter objectを置換しても見失わない。銃撃、斬撃、チェーンソー、打撃、爆発、出血を描き分け、火傷のtickでは血を噴かせない。敵の切断片は同じ死亡原画から描き、死体の透明度・灰化・除去を共有する。味方の復帰、報酬、damage計算、saveには書き込まない。
- 傷口：新規の配布画像は1枚、20,952 bytes。[出典・生成prompt・hash](combat-gore-provenance.json)。写真原本を使用・配布しない。
- QA：Windowsで起動前に拒否する遠隔ブラウザ用scriptを追加。3画面サイズ、全48形態、実際のdamageから死亡・切断までを検査する。通常のtouch出撃から敵のwindup/contactも別に観測する。

## この時点で確認したこと

Windows、Node 24.19。ゲーム・ブラウザ・音声・ローカル配信serverは起動していない。

- `npm test`：buildを含め1922/1922成功。
- Lint：製品・script・testsは0 errors、既存25 warnings。ローカルの未追跡`output/`に保存済みのbundleはvendor lint errorsを含むため、全件ログを保持し、ソース検証では当該生成物のみ除外した。CIの通常Lintは変更していない。
- content validator、asset manifest検査、103枚のlossless raster derivative検査に成功。後者は差分0、可視pixel差分0、alpha差分0。
- R5原稿と保管原稿のSHA-256は両方 `c324ba3783074ecabe80716d971c35d73028a7f98f2a8069760153b1c8b17cd6`。
- manifestは681 assets、177,926,708 bytes。1.0.1からの追加downloadは上記20,952 bytesのみ、既存assetの削除・再downloadなしをtestした。

## 残る確認

遠隔Chromium・native WebKit、実際のPNG/video、描画性能、保存済みPWAの更新、独立review、正式公開後の取得確認は、この文書を書いた時点では未完了。物理iPhoneの保存録画の音声、実speaker聴感、発熱も未確認。上記の静的・Node結果をそれらの成功へ読み替えない。

## 初回遠隔検査と修正

固定候補 `68a91cf44199e656e63aaac8949126875280e1e5` の[CI 38013816771](https://github.com/SUSANO-OOO/Zombieee/actions/runs/38013816771)は失敗。新しい動作adapterからcatalogを先に評価するimportにより、分割されたcampaignの初期化が循環し白画面になった。PR Verify job `114099585910` の実ブラウザ例外は `Cannot read properties of undefined (reading 'mother')`。Chromium／WebKitの新combat jobもタイトル待機で停止した。公開版は変更していない。

独立reviewはこの候補をHigh 1／Medium 1／Low 1と判定。Highは上記起動不良、Mediumは半径外に外れた手榴弾の元targetが同tickの燃焼だけで死亡しても爆発切断扱いになる誤帰属、Lowはupright頭部切断の傷口が首の断面からずれること。

修正では敵の180ms定数をcatalog非依存のleaf moduleへ分離した。ビルド済みの両client entryを、DOM・描画・server・browser・mediaの生成なしで別Node processから読み込む回帰検査を追加。Gore contextは実際に適用した正のdamageを必須にし、pending hitの登録を各命中判定後へ移動した。実dispatchと実area-effectを組み合わせ、外れた手榴弾による燃焼死の誤切断がないことを検査した。頭部の傷口を切断面へ寄せ、斬撃と爆発・粉砕の切断領域を分け、反転frameの切断片もworld方向と一致させた。

修正後のローカル検査はbuild＋1925/1925 tests成功、source Lint 0 errors／既存25 warnings。新しい候補の遠隔検証と独立reviewが完了するまで、初回失敗を解決済みの遠隔結果とは扱わない。

## 2回目の遠隔検査

候補 `42b5f1809dcecad5e1349bc0453cc8f6f0b26485` は独立review High／Medium／Low 0。Pages PR buildとブラウザ起動に成功した。新combat検査はChromium／WebKitとも戦闘開始時に `Assault objective states must be decoded before battle starts` で停止した（[CI 38014986717](https://github.com/SUSANO-OOO/Zombieee/actions/runs/38014986717)）。

原因は新scriptのURLに付けた `qa=mission` が旧campaignの全asset検査を選び、V1の拠点画像を除外したこと。通常のV1 routeでは当該画像が必須decode対象となり、localhostの検査bridgeも使用できる。scriptを通常の `/v100` から開始するよう修正した。必須assetのdecode guard・製品側asset plan・48形態と死亡切断の検査条件は維持した。代表6形態は静止姿勢に加えて攻撃姿勢のPNGも保存する。遠隔での再確認は修正後候補を対象とする。

## 描画receiptと検査操作の競合

候補 `7829a3d0a3dc7fecdadfa02cf58c241563f35d18` の[CI 38015679756](https://github.com/SUSANO-OOO/Zombieee/actions/runs/38015679756)は通常V1戦闘へ入り、Chromiumは10形態後に左右のassertで停止した。保存reportではscout・guardianのwind-upが直前のstart-move、engineerのstopがhit-lightの描画receiptを取得していた。描画sequenceの読取りと操作を別RPCで行う間に、旧姿勢の描画が進む競合があった。

sequence読取りと操作を同じJS taskへまとめ、その後の描画更新を待つ。左右・解剖比率のassertを維持し、構え・攻撃・復帰・被弾でも要求したactionの描画receiptであることを追加検査する。失敗した形態と操作のsampleもassert前にreportへ保存する。製品の動作code・asset・saveは変更していない。
