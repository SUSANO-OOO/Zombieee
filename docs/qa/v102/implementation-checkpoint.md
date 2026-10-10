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

Windows、Node 24.19。ゲーム画面・ブラウザ・音声は起動していない。全test内の既存HTTP検査は、一時loopback serverでassetを取得し終了する。

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

## 通常戦闘の観測上限

候補 `bbed51a64c227506cecae39f47682ec05c58300a` の[CI 38016444082](https://github.com/SUSANO-OOO/Zombieee/actions/runs/38016444082)ではChromium・WebKitとも全48形態と実damageによるGore検査に成功し、WebKitは通常touch出撃からwalker・crusherのwindup/contactも確認した。Chromiumの通常戦闘検査は失敗。保存した5,000行のうちcrusher 1,977行は全て移動であり、simulation 62.3秒で記録上限へ達した。walkerのwindup 156行・contact 46行は記録済みだが、後続crusherの攻撃を判定できなかった。

観測行を実際のwindup・attack中へ限定し、同一個体でwindupとcontact 2 frameを保存済みの敵種は記録を止める。5,000行・80秒の上限、180msの攻撃時間に対するcontact窓、描画姿勢・固定scaleのassert、通常touchのみの操作は維持する。完成済みの敵種が後から現れる敵の記録枠を使い切らないことを、browserやmediaを生成しないobserverの回帰検査で確認する。

限定差分の独立reviewはHigh／Medium／Low 0。observer回帰2件とCI契約6件、対象Lint、構文検査、diff checkに成功。製品codeは変更していない。修正後候補での遠隔再検証は別途確認する。

## 通常動作と敵の体格倍率

上記WebKitの実戦描画を読み戻すと、crusherの移動時はbodyScale 1・cell高さ128.815、windup/contactは専用poseでbodyScale 1.1・高さ141.697だった。新adapterの一律bodyScale 1が、元から固定されていた人物・敵固有の倍率を消していた。mother 2.38、gairen 2.45等の大型敵にも影響する製品回帰であり、描画のassert成功とは別に修正する。

通常sampleの人物固有倍率を維持し、同じ倍率を歩幅・Gore高さ・V1 corpseへ使用する。corpseのcompact倍率も生前と同じ関数へ統一。専用guard・連続技などの既存明示倍率と武器socket計算を維持する。Babayagaの左右idleのfit差（約3.73%）は、camera基準をright idleへ固定して解消する。legacy routeのcorpse計算は変更しない。

全48形態の左右・通常7action間と生前／死亡のsource-pixel scale一致を遠隔検査へ追加。実sourceから抽出したcorpse・Gore高さ・歩幅の計算を、全48形態・3viewport・depth・両sideで無音Node検証する。追加差分の独立reviewはHigh／Medium／Low 0、対象10件成功。修正後の遠隔描画・性能は新候補で確認する。

## 通常touch出撃の配置と現候補の検査

候補 `fe4e30bf60a1e9bad702efdf452b06892898c200` の[CI 38017716352](https://github.com/SUSANO-OOO/Zombieee/actions/runs/38017716352)は、両engineの48形態・GoreとChromiumの通常contactに成功。WebKitの通常contactは80秒内にwalkerのみ記録し失敗した。歩行除外2,518件、攻撃22行、出撃3回。旧reportには最終状態・配置の履歴がなく、crusher未接触の原因確定はできない。

driverの生存2体上限は、製品のleast-populated順 `[1,0,2]` に対して3laneを覆う保証がない。生存＋待機queueの合計3体まで通常tapで出撃するよう修正した。contact完了は同一個体の非flash windup後に2 contact frameが必要。80秒・5,000行・contact窓・attack-b・固定scaleのassertを維持し、simulation秒ごとの90件×最大64体の配置履歴と最終snapshotを保存する。actor・時刻・HP・結果setterは使用しない。

体格修正と配置driverを含む現候補はbuild＋全1,932/1,932 tests成功、source Lint 0 errors／既存25 warnings、diff check成功。前回の全test中のGit Bash OS object権限エラーは、同じ検査を許可された実行環境で行い解消した。判定やtestの内容は変更していない。配置・体格の限定独立reviewはHigh／Medium／Low 0、対象13件成功。遠隔検証・公開・実機録画の成功はまだ主張しない。

## 死亡検査の生前・死後描画待機

候補 `6dcad4bc4e12ee5486a6cc86d35823928808f6db` の[CI 38019302976](https://github.com/SUSANO-OOO/Zombieee/actions/runs/38019302976)は、Chromium・WebKitとも1280×720の全48形態とGoreに成功した後、844×390の死亡描画receipt不足で停止した。旧reportは失敗個体をassert前に保存していないため、生前・死後のどちらが欠けたかは確定できない。Pages PR buildは成功した。

検査factoryの実命中待ちは80msで、描画前のcatch-upが最大5×1/60秒（83.33ms）進むと、生存時の初回描画を失う経路がある。同じJS task内で生成直後に既存の検査pauseを設定し、生存HPと実paintを確認してから再開する。実damage・切断woundとcorpseの実paintを待ち、失敗sampleもassert前に保存する。実scriptのcallback、実frame schedule、実pending hit処理を組み合わせた無音Node検査で、旧手順の失敗と新手順の両receiptを再現する。

製品code・命中時間・HP計算・描画scaleの判定条件は変更していない。限定独立reviewはHigh／Medium／Low 0、対象14/14 tests、構文・Lint・diff checkに成功。build＋全1,933/1,933 tests成功。初回は同じGit Bash OS object権限エラー1件で失敗し、原logを保持したまま許可された環境で同じ全検査を実行した。修正後候補の遠隔確認は別途必要。
