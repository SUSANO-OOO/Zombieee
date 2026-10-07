# Version 1.0.0 全体品質監査 — 2026-10-03

## 2026-10-07 美術と映画編集の改訂

採用候補は病院、家族の翌朝、物資整理、セガワ記録、終幕の顔と笑みの6画像。正式identity参照・私的顔参照と採用hashはassets/source/v100/runtime/ending/film-art-r2.provenance.jsonへ保存。写真原本や私的pathはGit・公開・CI evidenceへ入れない。目・鼻・頬幅・髪と元衣装、ナオの結い髪と一本の編み込み、セガワの死亡前という因果を確認した。静止美術の独立review H/M0は画像採否や実映画の受入と区別する。

スタッフロール49カット／38画像、終幕8カット／7画像、原速の曲・波音・笑い声の3音源、起動時fiction cut、匿名のcredit／viewerへ改訂。art-framing-r12のcover表示で短画面の頭部切れを確認しcontainへ変更、shadeも軽減した。手元・喜劇・記録の入場はhard cut、復興のつながりはdissolve。2つの常設decode buffer、1／2／4倍の映像と原速の曲、早期終了時の曲fadeを維持する。

前候補13bad26のCIは24／26。カード比較はPaisen68／1728 pixel（3.935185%）で1%条件に失敗し、no-resize対照と非丸め矩形・全4時点を追加する。閾値を変更せず原因と修正後の実browser結果を待つ。能力表示は同一activationのstartとimpactが別receiptで正常に記録されるのに、QAが全receipt数1を要求したため失敗。source上の0.34／0.35／0.51／1秒の対照を保存し、単一activation／owner／kind／start1／impact最大1を検査、assert前に証拠を保存する。両QA差分の独立read-only review H/M0。元CI artifactはci-13bad26-phaseg-review／ci-13bad26-canonical-reviewへ保持した。

全test、Lint、build、content、実再生、3画面サイズ、WebKit、save／offlineと固定候補CIの新結果はIssue #172／Draft PR #171へ結び付ける。以下は旧候補の履歴で、現改訂の成功として扱わない。

本文の監査対象は修正前の`22b3b7d`。Producerの改善指示とスタッフロールの追加指示を受けた実装・検証結果は、末尾の「監査後の改善」に記録する。

最新の追加監査・修正は、末尾の「プロジェクト全体の指摘を照合した改善」を参照。途中候補で確認した不具合と失敗記録は本文に保全している。必須CIの成功だけで、作品全体のProducer受入済みとはしない。

## 結論

**この候補を完成品質として受け入れる判断は保留する。** 基本機能、保存、画面構成の土台は整っている。今回、物語の情報を早く開示する不具合を確認した。長時間の音声メモリ保持、高DPIでの性能、戦闘の視認性、育成の手応えにも対応が必要である。

人物と世界観、会話画面の読みやすさ、報酬・保存の保護には維持する価値がある。改善の優先対象は、戦闘状況の理解、支出の手応え、物語を順番に知る体験である。

## 対象と監査方法

- 候補：`22b3b7d43dc960ae4eba1566bd03617ed67fc38d`、tree `437972f29d3e20388aa26e0b4c41df0504cb42f0`。GitHub PR #171の現在値とローカルHEADを照合した。
- 正本：`AGENTS.md`、`docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`、[Issue #172の現行台帳](https://github.com/SUSANO-OOO/Zombieee/issues/172#issuecomment-5926641177)。古い性能失敗や旧候補の品質判断は現在値へ転用していない。
- 親監査と、ゲーム体験・技術保護・視覚の3つの独立した読み取り専用レビューを実施。視覚担当は保存画像27枚を原寸確認し、親も主要画像を照合した。全516画像を個別確認した意味ではない。ギャラリーの一部は変更がないソースに結び付けた旧撮影画像である。
- 今回再実行：production build、全1706 tests、Lint、content validator、`git diff --check`。いずれも成功。Lintは0 errors／既存14 warnings。
- [現在のCI 37056695995](https://github.com/SUSANO-OOO/Zombieee/actions/runs/37056695995) は26/26 jobs成功をGitHubから確認。現行artifactのPWA更新18/18・部分失敗復旧22/22、性能5窓の記録を確認した。これらは既存CIの証拠であり、今回の新規ブラウザ測定ではない。
- 正式公開版はブラウザ内のHTML metadataで `0.9.9.5`／`55d796cc577d1d9f903a4d2c6b4382196511db27` を確認。main・最新Releaseも同SHA。V1はDraft、未公開。
- **現候補の新しい実プレイは未実施。** 台帳の試遊URLはブラウザで名前解決失敗、OSのDNS照会でも「DNS名がありません」。ローカル候補への接続はブラウザが `ERR_BLOCKED_BY_CLIENT` で拒否した。制限を回避していない。操作感、動画の動き、音の聴感、物理端末の発熱を今回確認済みとはしない。

## 1. P2・不具合：未到達の地図から終盤の正体が分かる

新規saveの解放済みStageはS1だけだが、章タブは全て選択できる。第五章を選ぶと未解放のS26〜29にも正式名称を表示し、S27の「セガワ私設研究区画・RED PANTHER」が読める。最終章でもTAKUYA-Ωとボス詳細を先に知ることができる。

`stageDisplayNameFor()` が参照するのは表示対象のStage番号で、プレイヤーの到達・発見状態ではない。未解放でもnodeの見出し・ARIA・詳細に名称を渡している。出撃自体は無効なので、進行制限の突破ではない。

- 正本：`PRODUCER_DECISIONS_FINAL_RELEASE.md:52` はRED PANTHERの正式名称をStage27で初開示と指定。
- 実装：`app/V100Campaign.tsx:237`、`:881`、`:1013`、`:1033`、`:1046`、`:1055`。
- 今回の再現：[locked-map-disclosure.json](../../../outputs/whole-quality-audit-20261003/locked-map-disclosure.json)。新規saveと現行選択・名称規則を使ったソース／データ再現。ブラウザ操作の再現ではない。

**対応:** 未発見地点は仮称・伏せた情報で表示し、正式名称、背景、主目標、ボス詳細、ARIAを同じ発見条件で開示する。S1状態とS27到達後を対にして確認する。

## 2. P2・長時間利用のリスク：場面を終えても展開済みBGMを保持する

`app/audioMixer.js:890` でAudioBufferをキャッシュし、圧縮元データも残す。場面停止と全音停止では解放せず、`:1566` のdisposeまで保持する。会話・地図用のownerは `app/V100Campaign.tsx:315` でキャンペーン中存続し、戦闘移行も `:540` のstopだけである。

既存FakeAudioContextを使った独立診断を親が再実行した。7曲ロード後、stopScene＋stopAllでも展開済み7件・圧縮元7件が残り、disposeで0件になった。通常の場面順でも、同じownerにdaily、preparation、tension、relief、horror、loss、endingが渡る。

この7曲の正味合計600秒は、44.1kHz・stereo・Float32換算で約202MiB。環境音、SE、戦闘側の音、画像、canvasは別に必要になる。**これは音源長からの推定で、実ブラウザのメモリ実測ではない。FakeはPCMを実割当しない。端末での停止・クラッシュは未観測。** 実AudioContextのsample rateでも量が変わる。

証拠：[audio-retention.json](../../../outputs/whole-quality-audit-20261003/audio-retention.json)、`app/v100Music.js:6`、`app/v100EventAudio.js:91`。

**対応:** キャッシュの保持bytesを観測可能にし、現在再生中の音と次場面の音を守る容量上限を設ける。場面遷移・停止・復帰を含む連続利用で保持量と端末挙動を確認する。

## 3. P2・検証不足：高DPIの初期画質が性能gateに入っていない

現在CIの5窓は全てp95 rAF 19msで、元の33ms基準を通過している。ただし全てcanvas DPR=1だった。`scripts/v100-device-runtime-browser.mjs:352` のcontext生成にはdeviceScaleFactor指定がない。

新規saveの画質はhigh（`app/v100Save.js:36`）。highはDPR上限2（`app/renderPerformance.js:21`）で、実描画は端末のDPRを使う（`app/AshfallGame.tsx:14458`）。同じCSS寸法ならDPR2のcanvas画素数はDPR1の4倍になる。負荷やフレーム時間が正確に4倍になるという意味ではない。

証拠：[performance-evidence-scope.json](../../../outputs/whole-quality-audit-20261003/performance-evidence-scope.json)。現在artifactから必要項目を抽出したもので、新測定ではない。

**対応:** 高画質・DPR2で代表戦闘を同じ基準に通す。その後に実機の継続プレイ、発熱、復帰を確認する。現候補の実機性能が失敗したという判定はしていない。

## 4. 体験品質：戦闘は情報があるが、一目で読み取りにくい

844×340／390では暗い人物・敵と暗い瓦礫や道路の明度が近い。交戦点では回復値、被ダメージ値、状態表示が重なり、背景の細部と競合する。上端の段階・波・耐久、下端の資源・配備枠・再使用・目標も同時に読む構成である。

これは原寸静止画からの視認性評価。操作不能や実時間の見落としを再現した意味ではない。人物の輪郭と交戦点を強くし、浮遊表示の重なりを減らし、いま判断する情報を優先したい。Producerが削除を求めた常設アビリティ文章を戻す必要はない。

証拠：`outputs/dialogue-revision/quality-reopen-20261003/ci-22b/phase-g/outputs/v100-phase-g/chromium-844x340-battle-normal.png`、同`chromium-844x390-battle-normal.png`、同`chromium-844x340-battle-boss.png`。

## 5. 体験品質：報酬から育成の手応えへつながる部分が弱い

ハチは累計65 CAPSを使ってLv1→3にしても、通常ダメージは11のまま。HPは80→84になり、防御にも改善があるため「無意味な購入」ではない。攻撃が12になるのは累計110 CAPSのLv4。序盤二戦を★1で終えナオを登録した残高96 CAPSと比較すると、攻撃の変化を感じるまでの負担は大きい。

UIは次に攻撃が増えるLvを正直に表示している。問題は表示バグではなく、購入時の期待と戦闘で感じる変化の大きさである。ナオの育成でも多数の数値が同じ重さで並び、回復役としての変化が埋もれやすい。

またS2の解禁画面は「作戦記録を保存しました」が最大の見出しになっている。ミズチや回復支援の解禁と、次にできることを主役にする余地がある。

証拠：[onboarding-growth.json](../../../outputs/whole-quality-audit-20261003/onboarding-growth.json)、`app/v100Registry.js:426`、ギャラリー`g7-844x340-04-unit-nao-stats.png`／`g1-chromium-844x340-first-clear-reward-s2-settlement.png`。

**検証上の注意:** 現行の獲得予算によるS3通常入力検査は125秒で未決着でも入力があれば通過する。音楽CIの勝利はLv30 fixture、全30進行は合成戦闘結果。難易度と支出の受入は別途必要である。全30戦のAI攻略を追加条件にせず、実際に賄える編成でS3・代表章ボス・S30を有限に確認する。現在の難易度が攻略不能だとは断定しない。

## 6. 体験品質：最初の戦闘までの導入が長い

通常に読み進めると、PROLOGUE52 node＋S1前13 node＝65 nodeを送ってから最初の戦闘に入る。冒頭の日常、小物、会話は人物への愛着を作る強みだが、ゲームの遊びを知る前の操作量が多い。スキップではその文脈も飛ばす。

これは文字数から読了時間や離脱率を推測した結論ではない。初見試遊で、戦闘前の興味と集中が持続するかを評価する項目とする。改稿する場合は正史・人物の関係・イベントIDを守り、重複する説明や送りを減らす対象を限定する。

## 7. P2・提出物の問題：現行試遊URLが失効している

台帳の `das-tattoo-nose-powell.trycloudflare.com` は今回のブラウザとOSのDNS照会で解決できなかった。承認待ちの候補を、そのリンクから確認できない状態である。

一時URLを毎回作り直すとoriginが変わり、ブラウザの保存先も分かれる。旧saveが削除されたという意味ではないが、継続試遊の負担になる。

**対応:** 保存元を保った試遊先を用意し、候補SHA、起動、保存・再開、URLの有効性を提出時に照合する。既存の正式公開承認境界は維持する。

## 8. 既知Low：短い画面で保存・復元への導線が見つけにくい

844×340のデータ管理は、初期位置で書出し／復元ボタンの上辺しか見えない。スクロール後に44pxの操作へ到達し、保存データを保った検証は存在する。操作不能とは判定しない。操作列の固定か、下に続くことを示す表示が必要である。

証拠：ギャラリー`g15-3-webkit-initial.png`／`g15-4-webkit-actions-visible.png`。過去レビューのLowを今回も確認したもので、新規発見として二重計上しない。

## 分野別の評価

| 分野 | 確認できた強み | 残る課題 |
|---|---|---|
| 物語・人物 | 会話と行動で人物関係を描いている。94イベントの表示経路がある | 未解放地図の情報開示、冒頭65 nodeのテンポ |
| 戦闘・育成 | 部隊役割、費用、再配備、比較数値が見える | 交戦の読みやすさ、購入の手応え、現行予算での代表戦受入 |
| 美術・UI | 深緑・金・橙の一貫性。会話本文と主要ボタンは整理されている | 暗い戦場の人物分離、戦闘情報の密度、報酬画面の主役 |
| 音・動き | 音楽遷移と重複防止、描画因果のCI証拠がある | 音声キャッシュの保持量。聴感・動きの質は今回未判定 |
| 性能・実機 | 現行Mac WebKit／DPR1の5窓は基準内 | DPR2、連続利用、実speaker、発熱、物理操作 |
| 保存・PWA | 更新18／復旧22の現行証拠。新たな保存破壊は未発見 | データ管理の発見性、試遊origin変更時の継続導線 |
| 運用・公開 | SHA照合、失敗履歴、未公開の境界は保全 | 現行試遊リンクの失効。差分レビューH/M0を全体品質保証へ拡大しない |

## 次に優先すること

1. 未解放地図の情報漏れを修正し、試遊できる候補の提示を回復する。
2. 音声キャッシュを測定・制限し、高画質DPR2と連続利用を確認する。
3. 代表場面の戦闘視認性と、獲得CAPSによる育成・再挑戦の手応えを確認して調整する。
4. 冒頭のテンポと報酬演出を初見試遊で評価し、有限の改善対象を決める。

既存レビューのHigh／Medium 0は、その対象差分・確認条件での結果として保持する。今回の全体監査で発見した不具合や検証不足を覆う保証にはしない。新規に確認したP0／P1の進行不能・保存破壊はないが、これも全経路の不存在証明ではない。

監査実施時点では製品ソース、save、PR状態、Release、公開設定を変更していない。

## 監査後の改善 — 2026-10-03

Producerの「それも含めて改善」と、クリア後に魔王魂「追憶の幻想世界」を使うダイナミックなスタッフロールの指示に基づいて実装した。正式公開の承認境界は維持する。

| 対象 | 実装した改善 | 確認結果と限界 |
|---|---|---|
| 未発見の作戦 | 仮称を表示し、名称・背景・敵・主目標・ARIAの事前開示を防ぐ | 新規saveの純粋ロジックと、3サイズの未解放S30表示を検証 |
| 音声保持 | 64MiBを既定のLRU予算にし、decode後の圧縮bytesを解放。再生中・フェード・取得/decode待ち・復帰対象は保護 | 実サイズ相当のPCM、再取得、同時preload/playを検証。保護中の一時超過はdiagnosticsへ記録。物理端末の総メモリ測定ではない |
| 導入 | 同場面の短い地の文をまとめ、全文・順序・旧cursorを保持 | PROLOGUE 52→41ページ、初出撃前13→10ページ。物語本文とstable IDを維持 |
| 育成 | ハチLv2/3の2%分を実ダメージへ反映し、変化する能力を強調 | 攻撃11→11.22→11.44→12。表示と戦闘が同じadapterを参照。間隔.62秒と他Lvの値を維持 |
| 報酬 | 確定済みの初回報酬を主役にし、登録解禁unitをportrait付きで表示 | 購入済みとの区別、同一receiptの二重取得防止、未確定結果からの予測禁止を維持 |
| データ管理 | 本文をscrollし、書出・復元・閉じるを固定 | 1280×720／844×390／844×340で固定操作列を確認 |
| 戦闘表示 | 通常時の人物shadowを調整し、damage文字を追加時にずらす | 数字と全角statusの位置計算を検証。密集時の全重複解消や物理端末での視認性受入は未主張 |
| 高DPI | high設定・実canvas DPR2を前後照合するCI窓を追加 | p95≤33ms／median FPS≥50等の既存閾値を維持。新候補Mac CIの結果は台帳で管理 |
| 終幕 | 元のMP3をnative audioで一曲通し再生。11場面のpan/crossfade、縦スクロール、主人公名、魔王魂の常時表記、ENDING→credits→EPILOGUE | Chromiumの自然終了315.742秒・全11場面・BGM所有者1を確認。pause・縦向き・pagehide・音なし・読込失敗・保存中終了・保存失敗の手動再試行も検証 |

### 曲と配布

- [公式曲ページ](https://maou.audio/31_tsuioku_no_gensosekai/)の元MP3、6,309,936 bytes、SHA-256 `a5be98c2cba42b2d0363d433aceced2946850ec25459fd59bb36cbd2c8d98248`。音源bytesの編集なし。音量だけゲーム設定へ接続する。
- [利用規約](https://maou.audio/rule/)を確認し、「音楽：魔王魂」、曲名、森田交一・与野裕史・佐藤まさみ、公式出典・規約を表示する。曲ページの写真・画像・歌詞は転載していない。
- 配布manifestは536 logical／534 distinct、149,558,981／149,019,078 bytes。新曲1項目だけ追加し、旧素材のhashは保持。既存0.9.9.5からは414項目を再利用し、122項目／59,880,648 bytesを取得する。
- 実SW／Cache Storageの音声206・416応答と、通信socket停止後の150秒seek再生→終了、cache原本200保持をChromiumで確認。部分応答を完全assetとして保存しない。

### 検証の区別

全1721 tests・build・content validator・Lint 0 errors／15 warningsを確認。Chromiumの3サイズ×5イベント、計15 fixtureでPROLOGUE・初出撃前の全文、ENDINGからの自動開始、全11場面、EPILOGUEへの接続を確認した。独立read-only reviewは、実装ソースと新しい実画像18枚の対象範囲で未解消High／Medium 0。Windows WebKitはSW登録前の直接音声配信でもMediaError 4となり、音声合格へ転用しない。Macの固定WebKitで全曲・保存境界・offline音声を検証するCI工程を追加した。

ローカルのvinextは音声Range非対応でnative seekableが`[0,0]`になるため、音声検証は元MP3のbytes/hashを確認する専用loopback配信を使用する。これは正式Pagesの配信証拠と別である。全testがbuildを更新して撮影と競合した試行、旧fixture・旧selector・duration推定差・意図したseekのcancelは失敗／診断記録として保全した。

固定候補`3b1dd967`の最終画像reviewでは、まとめた地の文と台詞が既存gridの同じcellへ配置されるMediumを1件検出した。外枠のfits検査だけでは本文同士の重なりを検出していなかった。本文を専用の縦配置要素へまとめ、話者あり・なしの双方を修正した。本文block同士の重なりと枠内表示を検査へ追加し、修正前のbuildで同じ不具合を検出するcontrolを保全した。修正後は12文字の主人公名、3サイズ×5イベントの15 fixtureで全文と非重複を確認し、全1721 tests・build・Lintを再実行した。撮り直した実画像と新HEADの独立review結果は既存台帳へ記録する。

記録：`outputs/whole-quality-audit-20261003/`。これらはseeded presentation、native media、保存faultの証拠であり、全30作戦の通常クリア、物理iPhone、speaker聴感、発熱、Producer最終受入の完了を意味しない。新候補のexact HEAD CIと試遊URLは既存Issue #172台帳へ更新する。

### Mac CIで判明した検証契約の修正

候補`8945a141`のCI `37097483356`では、Mac固定WebKitの元MP3自然終了315.768秒・全11場面・pause/回転/pagehide、音なし、503、保存cursor復帰の4ケースが通った。保存中終了のfixtureはhold成立待ちで失敗した。元の記録にはseek後の媒体状態とIDB履歴がなく、原因は確定できない。元の失敗artifactを`mac-native-8945a14-failure/`へ保全し、合格へ読み替えない。

長い曲をnative再生するとChromiumは途中で先読みを止めることを実測したため、fixtureで場面9へ実seekし、保存完了と場面10・末尾のbuffer/seekableを確認してから場面10の実保存を保留する。native requestの`onsuccess`をown propertyで置き換えず、実successのcapture listenerで実handlerの配送だけを一時保留する。native `ended`発生時のpending=true、open→解除6秒未満、EPILOGUEへの保存と既読1回を要求する。製品timeoutを延長せず、失敗時は媒体・IDB・busy履歴を保存する。製品非依存のnative IDB controlは旧方式とcapture方式を比較し、callback1回・実DB round trip・解除前未完了を検査する。Windows固定WebKitとChromiumでcontrolが通り、Chromiumの3保存境界ケースも通った。Macの保存中終了は新候補CIの実結果を要求する。

同CIのPhase Gは、`controls`のないnative audioへ可視の幅・高さを求めて失敗した。画面5要素の可視性を維持し、audioの実要素数が正確に1個である契約へ修正した。manifest validatorでもこの証拠を必須にした。実Chromium DOMでaudio欠落・重複・画面操作非表示を拒否し、非表示audio1個と既存ENDINGは通るcontrol、credits3サイズ、関連49 testsを確認した。正式CIの55 captureとmanifest検証は維持する。

次候補`f2f621c`のPR Verifyでは、1720/1721 tests成功、既存CI契約testがartifact一覧の隣接順を検査する1件で失敗した。追加したcontrol artifactを元のreport/manifestの後へ移し、元の契約testを変更せず維持した。反映後の全1721 testsは成功した。この失敗ログも`pr-verify-f2f621c-failure.log`へ保全する。

`1cf4eaf`のMac検証では原曲の自然終了と音なしケースが通り、503ケースでnative audioのpaused=falseが残る不具合を検出した。保存3ケースとoffline/PWA工程は未実行であり、保存中終了の再失敗とは扱わない。Windows固定WebKitでも503単独の同じassert失敗を旧buildで再現し、controlを保全した。`play()`失敗はattempt一致確認の後、media errorはattempt無効化の後にaudioを明示pauseする。プレイヤーのpause状態を変えず、音なしスタッフロールは進む。新QAは503単独の範囲を明記し、defaultは元の6ケースを必須にする。各fallback失敗にも媒体状態と画像を保全する。

修正後build `7ed54c0557e35f9dd2138f855caca013812e0c580af49974a39be2b97d087d3c`で、同じWindows固定WebKitの503単独controlが成功した。これは故障音源の停止・音なしロール進行・スキップ後の保存接続の証拠であり、Windows WebKitの元MP3再生成功とは扱わない。全1721 tests・build・Lint0 errors/15 warningsと独立read-onlyの変更範囲High0/Medium0を確認し、Macのdefault6ケースとoffline/PWAは新HEADのfresh CIで要求する。

候補`57df637`のCI `37101141170`では、PR Verify、Phase Gの55 capture、Mac WebKit性能窓（high/DPR2を含む）と敵shard02〜06が成功した。native staff rollは自然終了315.768秒・音なし・503・保存cursor復帰の4ケースが成功し、保存中終了のEOF待ちで失敗した。native IDBは正常にopenし、実successを保留してpending=trueを保持していた。曲の`duration-.1`へのseek後は315.699／315.768秒、paused=false、seeking=false、readyState4、全buffer、errorなしで止まり、native endedは発生しなかった。前回のIDB hold不成立と区別し、元のreport・媒体・busy履歴・画像を保全する。残る保存失敗ケースとoffline/PWAは未実行である。

候補`46687b4`のCI `37102906308`では、製品を含まないaudioで元MP3の9.1／10.1場面相当のseek順を、末尾0.1秒／1秒とnative IDB保留あり／なしの固定条件で比較した。0.1秒の2条件に続き、IDBなし・末尾1秒でも314.829／315.768秒で時刻が止まり、trusted native endedは発生しなかった。paused=false、seeking=false、readyState4、errorなしであり、アプリと保存処理を含まない条件でも再現した。4番目のcontrolと実スタッフロール6ケースは未実行。元のreportと媒体履歴を`mac-native-46687b4-failure/`に保全し、末尾を1秒へ変更するだけでは解消しないことを記録した。Native側の内部原因は未確定である。

同CIの敵shard01は、1280×720のspitter攻撃fixtureで失敗した。直前の移動・撮影中には実描画が進んでいたが、攻撃の55 poll／2.646秒ではnative rAF request、製品render、simulation、battle timeがすべて不変だった。visible・ready・running、pause/over/saveBoundary=false、diagnostics0であり、敵の攻撃行だけの失敗とせず、元の全停止記録を保全した。撮影が原因とは断定しない。

各phaseのsetupでowned QA pageを前面化し、製品から独立したnative rAFと製品描画・simulationが各2 frame進み、ゲーム時間が増加してからactorを1回prepareする。前面化前／後とsetup成立の記録を残し、測定中は前面化・再prepare・retryを行わない。元のattack2600ms／他1500ms、asset-backed semantic、strict capture、1 attempt、全coverageを維持する。実predicateを使うWindows WebKitのcontrolは、通常進行を受理し、全rAF停止・製品のみ停止を有限12秒で拒否し、ready後の停止も元のsemantic assertで拒否した。代表spitter／1280×720の4動作は1 attemptで成功。製品コードを変えず、新候補Macの代表場面と全shardを要求する。新QAの関連15 testsとLint0 errors／既存15 warningsが成功した。

同じ`46687b4`のfresh Mac CIでは敵shard01〜06、Phase Gの55 capture、high/DPR2を含む性能窓、PR Verifyが成功した。停止した測定を合格へ読み替えず、setupの進行確認を加えた新しい1 attemptの結果で検証した。Hosted Runnerの最終集約とnative PWA工程の完了は、その時点で未確認である。

### シークに依存しない保存・EOFの検証

末尾offsetを繰り返し変える代わりに、元MP3を途中seekせず、QAだけで固定8倍／16倍速にしてnative EOFまで連続再生する。製品と通常の全曲検証は1倍速を維持する。製品非依存controlは、停止後seek／初回play前seekを診断として記録し、seekなし8倍／16倍の2条件でtrusted native ended、EOF時の実IDB保留、callback1回、実DBのwrite/read、open→解除6秒未満を必須にする。媒体の時刻・ended・storageを模擬しない。

実スタッフロールの保存中終了は、8倍速で実場面9と保存cursor9が一致してから、場面10のnative IDB successを保留する。実media clockが残り1秒相当へ進むのを待ち、元の2000msのEOF待ちと6000msの保存上限内で、trusted native ended・busy=true・seek0・EPILOGUE・既読1回を確認する。保存失敗は16倍速で場面10の保存完了を確認してから故障を注入し、実EOF、再試行の自動ループなし、手動の「続ける」での復旧を要求する。通常速度の保存cursor復帰にも、2秒以内のmedia clock増加を追加する。全曲ケースは1倍速・seek0・trusted native ended・全11場面を必須にする。

Chromiumの`natural-eof-race-controls-chromium/report.json`は、診断2条件と必須control2条件、保存境界3ケースが成功した。Controlの実IDB保留は約3,617.5ms／1,801.7ms。製品保存中終了は約3,623ms、315.742秒のtrusted EOF時pending=trueで、保存失敗は1回の試行後に待機し手動復旧した。保存位置からの通常再開も172秒付近から実時刻が増加した。これらは同じbuild `7ed54c0557e35f9dd2138f855caca013812e0c580af49974a39be2b97d087d3c`のローカル証拠であり、Macの成功とは扱わない。

Offline音声は実SW／Cache Storageと通信socket停止を維持し、初回play前の150秒seek1回の後、元のcache音源を16倍速でnative EOFまで連続再生する。追加の末尾seekは除き、15秒のEOF上限、206/416のbytes/hash、trusted native ended、元cache200・6,309,936 bytesを要求する。`offline-native-rate16-chromium/report.json`が成功した。これはRangeとoffline再生の固定fixtureであり、通常速度の聴感や全曲検証とは区別する。

変更したQA3fileの独立read-only reviewは未解消High0／Medium0。関連15 tests、Lint0 errors／既存15 warnings、`git diff --check`が成功した。製品・曲・SW・配布assetは変更していない。新HEADのfresh Mac CIで通常全曲・通常cursor再開・保存境界・offlineとPWAを要求し、物理iPhone、speaker聴感、発熱、Producer最終受入は引き続き別の未完了項目とする。

### Macの全曲・保存合格とoffline条件の区別

候補`58f6d1a`のCI `37104620147`で、Mac固定WebKitのnative staff rollは6/6ケースが成功した。元MP3を1倍速・seekなしで315.768秒まで再生し、trusted native ended、全11場面、中断・回転・pagehide、音なし、503を確認した。通常の保存cursor再開は172秒付近から実時刻が増加した。保存中終了は8倍速の実EOF時pending=true、native IDB open→解除3,718ms、EPILOGUEと既読1回を確認。16倍速の保存失敗は1回の試行後に待機して手動復旧した。必須のseekなし8/16倍controlと、停止後／初回play前seekの診断2条件も全て成功した。原reportは`mac-native-58f6d1a/staff-roll/report.json`、buildは`40af04463d367394c06c6646650362434e18e3eb6398f2101b553c11bf1a7358`である。

次のoffline工程は、通信socket停止、実SWからの206/416、部分bytes/hash、150秒位置からの再生が通り、16倍速でのEOF待ち15秒で失敗した。最終記録は299.893／315.768秒、readyState4・networkState1・errorなし。途中時刻のsamplesがなかったため、高倍速のdecode遅延と途中停止を断定していない。元の失敗は`mac-native-58f6d1a/audio-range/report.json`に保全し、旧16倍速・15秒以内完了の条件は失敗のままとする。後続のPWA更新・復旧は未実行である。

新しいoffline条件はゲームと同じ通常1倍速で、paused状態の150秒seek完了後に実gestureでplayし、残り約166秒を追加seekなしで連続再生する。play要求からtrusted native EOFまで総180秒以内、実media clockの残り1秒到達からEOFまで15秒以内を要求する。全区間rate1、seek1回、媒体エラー0、元cache200・hash/bytes、通信socket停止、206/416を維持し、成功時・失敗時のeventと250ms間隔の媒体時刻を保存する。旧高倍速条件と同じgateだとは扱わない。停止した時刻やnative endedを模擬しない。

Chromiumの初回1倍速fixtureは、約165.712秒の連続再生から315.616秒のtrusted EOFまで成功し、663 samplesが全てrate1、150秒seek1回、追加seek0、元cache200・6,309,936 bytesを確認した。総180秒のassertを追加した最終fixtureも165,719.6msで成功した。記録は`offline-native-rate1-chromium/report.json`と`offline-native-rate1-total-bound-chromium/report.json`。関連Range3 tests、Lint0 errors／既存15 warnings、`git diff --check`も成功。これはローカルの証拠であり、Macのoffline成功ではない。新HEADのfresh Mac全工程を台帳へ記録する。製品・音源・SWの変更はない。

候補`52dbebf`のCI `37106403311`でもMac staff roll6/6が成功した。Offlineの通常1倍速は、150秒から追加seekなしで315.768秒まで進み、660 samples、媒体error0、全buffer、`audio.ended=true`を記録したが、検証の結果読取でTypeErrorとなった。`audio.ended`だけで待ちを終了し、未確認のnative ended eventの`.at`を読む順序の不備である。記録時のevent一覧にはplayingまでしかなく、native eventの配送後まで観測していない。この試行をnative EOF event合格へ読み替えず、`mac-native-52dbebf/audio-range/report.json`と元ログに保全する。後続PWA工程は未実行である。

結果読取の前に、実listenerが記録したnative endedが正確に1件になるまで待つよう修正する。残り1秒からの15秒deadlineと、実play要求からの総180秒上限、trusted event、媒体のended状態、全rate1、seek1回、原本cacheの条件を維持する。失敗時もevent/sampleを再取得し、先に読んだ不完全なsnapshotを使い続けない。製品ソース、media状態、event配送を変更・模擬して通過させない。修正後のMac結果を新HEADで要求する。

## 零視点での再監査 — fe33989

**2026-10-04 更新:** 下記は修正前の再現記録。7件の修正と再検証は末尾「零視点監査の修正と再検証」に記載する。元の失敗記録は保持し、最新候補のCIと最終受入はIssue #172の既存実行台帳で管理する。

Producerの「零視点でゲーマーとして、ゲーム開発者として、日本語として全体監査」を受け、前回の合格判定から独立して確認した。**現候補を完成品質として受け入れる判断は保留する。** 確認範囲でHighは検出していないが、公開前に扱うべきMediumが重複を除いて7件残っている。確定した動作不具合と、体験・説明の改善点を以下で分ける。

### 今回の対象と実見

- 対象HEAD `fe3398994eeb619066a6bdcb156a50ba2eb87abc`、tree `ce23b26a2289ca1e9f032866a3746ee82bee0e24`。親監査と3つの独立したread-only監査で、ゲーマー、開発者、日本語の視点を担当した。台本の全編と主要UI・保存・進行の実装を読んだ。
- GitHubを再取得し、PR #171は同HEADのDraft/open/unmerged、Issue #172はopen、mainと最新Releaseは`55d796c`／`v0.9.9.5`と確認。CI `37107976643`とPages PR build `37107976464`はcompleted/success。新しい実装の合格として転用していない。
- 親が隔離Chromiumで、新規名前入力、プロローグ41画面、作戦地図、隊員・支援・装備・車両、復元、初回編成、S1戦闘・結果・作戦後・報酬・配備通知、既読再出撃、一時停止設定を実見。844×390・DPR2を使用し、初回編成は844×340も撮影した。
- 初期4隊員・Lv1・0 CAPSのS1を通常のボタン操作でクリア。138.17秒、車両498/680、★2、戦闘不能4回。作戦後の会話を経て97 CAPSとS2解放を確認した。再開はこの監査が作ったsaveの複製だけを使い、戦闘中に結果・HP・時間・資源を変更していない。自動操作による観測であり、人間の操作感の受入ではない。
- 新たな根拠は[新規UI観測](../../../outputs/zero-view-audit-20261003/observations.json)、[復元・編成・S1観測](../../../outputs/zero-view-audit-20261003/continued-observations.json)、[初回報酬の観測](../../../outputs/zero-view-audit-20261003/preference-observations.json)、[既読・設定の観測](../../../outputs/zero-view-audit-20261003/preference-continuation.json)。観測collectorのselector・再読込時PWA offer・配備通知の扱いの失敗は、元の記録を保全して必要な箇所だけ続けた。失敗report全体をPASSへ読み替えていない。
- 全30 Stageの通常攻略、全画像の新規目視、物理iPhoneの発熱・聴感・操作感を今回確認した意味ではない。S5の既存3敗は攻略不可能の証明にはしない。音源の再生・EOFの技術証拠と、音の聴感は別に扱う。

### Medium 1 — 壊れたバックアップを正常として確定し、進行不能になる

V1の正しいexport形式でも、`flowState.eventId`が未知の`v100:event:missing`だとimportが成功する。親がデータ管理の通常ファイル選択で再現した。成功通知を閉じると本文・進行・復元の操作がなく、再読み込みして「ブラウザで遊ぶ」を選んだ後も本文・ボタン0の画面になる。

`app/v100Save.js:248`は型を検証するがイベントの実在性を検証しない。`app/v100CampaignStorage.js:301–332`は正常saveとして復元し、`app/V100Campaign.tsx:869`はeventがないと本文を描かない。通常プレイがこの破損を生成するとは主張しない。**最優先で、実在するイベント・進行先の検証と、不正import時の現在saveの保持を修正する。**

根拠：[復元直後](../../../outputs/zero-view-audit-20261003/14-invalid-event-import.png)、[再読み込み後](../../../outputs/zero-view-audit-20261003/15-invalid-event-reload.png)。反例は監査専用saveで、ユーザーの保存データには触れていない。

### Medium 2 — 継承した「既読自動スキップ」が働かない

`settings.autoSkipReadStory=true`を継承・保存するが、V1のイベント進行が参照しない。親は自分のS1クリアsaveにこの設定だけを指定し、既読S1へ通常再出撃した。`readStoryEventIds`にS1 preがあるのに、未読と同じ最初の会話で止まり、手動スキップが必要だった。

`app/v100Save.js:331`、`app/v100StoryFlow.js:136`、`app/V100Campaign.tsx:668`。既読設定を実進行へ接続し、明示的な会話記録の再生と、作戦後の報酬・receipt処理を維持する必要がある。根拠：[既読再出撃](../../../outputs/zero-view-audit-20261003/24-read-preference-ignored.png)。

### Medium 3 — 操作できる「戦闘中の会話」設定がV1へ接続されていない

一時停止で「初回のみ」「通信を簡略表示」「毎回すべて表示」を選べ、保存値も変わる。一方、`app/AshfallGame.tsx:18005`はV1の該当会話処理を抜け、V1の進行・表示側もこの値を使わない。画面の選択肢と機能が一致しない。

設定の存在と値の保存は親の実見、機能未接続は呼出経路のソース確認。全設定を切り替えて同じ戦闘を何度も走らせた比較ではない。`app/AshfallGame.tsx:24012`。根拠：[一時停止設定](../../../outputs/zero-view-audit-20261003/25-pause-settings.png)、[変更後の保存値](../../../outputs/zero-view-audit-20261003/preference-continuation.json)。

### Medium 4 — 復元失敗の日本語が原因を取り違えている

JSONではないfile、別形式のfile、引き継ぎ対象外の履歴でも、一律に「セーブを書き込めませんでした」と表示する。親は`{}`のfileをV1復元へ選び、同文を実見した。選び直すべきfileの問題を、書込みの障害として伝えている。

`app/V100Campaign.tsx:357`、`app/v100CampaignStorage.js:301`。区別済みの理由へ日本語を対応させ、「対応するセーブ形式ではありません」「内容が壊れているため復元できません」等、次の操作が分かる説明が必要。根拠：[復元のエラー文](../../../outputs/zero-view-audit-20261003/13-wrong-v1-file-message.png)。

### Medium 5 — 編成枠と同時出撃・再配備の関係が伝わらない

編成は7枠と空き枠を強調するが、1枠から同じ隊員を繰り返し呼び出せる。同じ隊員の重複枠は再配備待ち時間を共有し、重複登録によって同時上限や再配備速度は増えない。初回編成にはこの意味の説明がなく、枠を埋めると部隊数・速度が増えると推測しやすい。

`app/V100Campaign.tsx:1126`、`app/AshfallGame.tsx:15319`、`:15325`、`:23891`。親のS1通常操作でも4登録から再配備を続けた。根拠：[初回編成](../../../outputs/zero-view-audit-20261003/16-first-formation.png)。前の7枠fixtureは合法な操作の記録だが、AI helperが枠数を投入目標数に使うため、改善を重複枠そのものの製品効果と判断してはいけない。

### Medium 6 — 航空支援の選択後、次に何を押すか分からない

航空支援はボタン選択後に戦場を指定する。親は初回S1で支援85のときに選択・取消を実操作した。ボタンの色は変わるが、「戦場を指定」の案内が出ない。戦場に触れるまで照準円も出ず、隣の車両砲撃はボタンだけで発動するため操作を混同しやすい。

`app/AshfallGame.tsx:13871`、`:14913`、`:15539`、`:23938`。選択中だけ、対象指定と取消方法を示す短い案内が必要。根拠：[航空支援選択中](../../../outputs/zero-view-audit-20261003/19-airstrike-selected.png)。

### Medium 7 — 結果から再挑戦の改善目標を判断しにくい

★条件は車両残耐久70%／90%だが、地図・編成・結果に条件がない。時間・戦闘不能回数も並ぶため、それらが星の条件だと推測しやすい。今回のS1は498/680で★2。画面から★3に必要な612 HP、あと114 HPを読み取れない。

S5の既存結果でも、ボス残59.92と1555.058の敗北がほぼ同じ「約204/205秒・戦闘不能13回・車両0・目標未達」になる。接戦か大差かを結果から振り返れない。敗北の原因と、操作・育成・編成のどれを見直すかにつながる情報が不足している。

`app/V100Campaign.tsx:1283`、`app/v100Registry.js:402`、`app/v100BattleReport.js`。星の条件を先に示し、ボス到達・残HP等を必要な範囲で保存・表示する改善が適切。星の数式や難易度を弱める根拠にはしない。根拠：[今回のS1結果](../../../outputs/zero-view-audit-20261003/20-first-battle-outcome.png)、既存S5結果とその元の観測report。

### 日本語・文脈のLowと、作品としての判断

- 「到達作戦」の値はクリア数なので「クリア済み作戦」が合う（`app/V100Campaign.tsx:1259`）。
- 「新しい役割を配備登録」は、登録する対象が隊員なので「新しい隊員を配備登録」が自然（同`:1276`）。
- 台本の「未着信メッセージ」は「未受信のメッセージ」が自然（改訂台本`:245`）。未定義の失敗理由をそのまま返す経路もあり、`stale-level`等の開発用語を日本語へ対応させる余地がある（同TSX`:142`）。
- 「召喚限度」「呼出部隊」「エリアマップ」「作戦地図」、「wave」と「波」の揺れを、実際の機能と世界観に合わせて整理する。
- S7の台本は患者・物資を病院へ入れる流れなのに目標は「医薬品搬出」。別便搬出も論理的には成立するため、確定矛盾とせず、文脈に合う説明へ照合する候補とする。
- S22は台本の43人とUIの43室の関係が不明。妻子同室でも空室を含めれば両立するため、数量矛盾の確定、正史・stable IDの変更根拠にはしない。

台本全編の読みでは重大な助詞・主述の破綻は検出していない。人物ごとの口調、ナオの靴、ザキミヤが手を洗う行動など、人物を説明だけに頼らず伝える場面は維持する価値がある。今回の実画面でも、会話の文字と話者、育成先への導線、初回報酬と配備費用の提示は読み取れた。

スタッフロールは11場面のパン・ズーム・クロスフェードと縦ロールで、曲の展開と個々の場面切替を結び付ける構成ではない。穏やかな戦後の余韻として成立する一方、「ダイナミックな締め」の強さはProducerの試聴で判断する。曲の再生・クレジットを確認したことだけで、演出の受入済みとはしない。

**優先順は、不正saveの受理防止 → 設定と機能・エラー文の一致 → 編成・支援・結果の説明 → Lowの日本語と演出の受入。** この追記は監査結果で、製品ソースの修正、追加CI、正式公開は行っていない。今回見つかった未解消事項を反映し、前の最終受入候補の品質判断を更新する。

## 零視点監査の修正と再検証 — 2026-10-04

上のMedium 7件を修正した。製品修正は`7a0c0e2`、`d44a278`、`d5cd943`。別途、台本の「未着信メッセージ」を「未受信のメッセージ」へ直し、正本からイベントデータを再生成した。台本SHA256は`88110351eaa4b597d221828c49f4c29abb8a77bf8180a3c128e6db9c5aa2978f`。星の70%／90%、報酬、難易度、人物identity、stable IDは維持する。

| 指摘 | 修正と確認 |
| --- | --- |
| 1. 不正backupの受理 | 実在イベントとphase・stage・result・報酬確定を照合。勝利には実ゲームと同じresult契約を使う。不正fileを通常の復元操作で拒否し、CURRENTとmirror、再読込後の進行を保持した。checksumだけ正常な未知イベントのCURRENTは復旧画面へ進み、直前の正常saveを復元できた。 |
| 2. 既読自動スキップ | 会話記録の設定を通常イベントへ接続。明示再生・初回報酬確認・スタッフロールを保持。既読preは編成へ進み、既読postは一度だけ報酬を確定。IDB書込み中断では自動再試行1回で停止し、手動操作で再開できた。 |
| 3. 作用しない会話設定 | V1一時停止から未接続の旧会話設定を除いた。既読設定は会話記録で保存できる。戦闘のBGM・SE・voice経路は維持。 |
| 4. 復元エラーの日本語 | 対応しない形式、内容の破損、書込み失敗を区別し、選ぶfileと現在saveの保全を説明する。通常のfile選択で形式・内容の案内を確認。未定義理由の開発codeを日本語の案内に置換。 |
| 5. 編成枠の説明 | 「呼び出し枠」とし、1枠から繰返し呼べること、重複枠の待ち時間共有、同時7体・待機3体を説明。3サイズで編成画面を確認。合法な重複登録は維持。 |
| 6. 航空支援の案内 | 選択中だけ戦場指定と取消方法を表示。3サイズと21px safe areaのCSS fixtureでHUDから8px離れ、取消時に消える。実機safe areaの確認とは区別。 |
| 7. 結果の改善目標 | 地図・編成・結果に星条件を表示。自分の自然S1結果498/680・★2から、★3には612 HP・あと114を表示。ボスの出現前・残HP・撃破を記録し、KUROME分身とFUTAGOの2体を扱う。短い横画面でボタンが見切れる新規不具合も修正し、44pxの操作領域を保持。 |

### 実ブラウザの証拠と限界

- [再検証report](../../../outputs/zero-view-fixes-20261004/qa.json)の先行5ケースで、不正import、設定保存と明示再生、既読pre、IDB中断と手動再開、自分の自然S1結果と初回報酬、再戦postの一度限りの確定・再読込を確認。console・page・request・HTTP errorは0。
- このreport全体は**failed**のまま。S5の初期Lv1・購入なしfixtureは146秒でボス出現前に自然敗北し、遭遇を期待したassertionが失敗した。別の合法予算fixture（490 CAPS中410使用）も131.2秒で出現前に敗北し、[元の失敗](../../../outputs/zero-view-fixes-20261004/boss-result.json)を保全した。ボス遭遇の証拠や、S5が攻略不可能という判定には使わない。
- ボス収集は[別のS30実戦](../../../outputs/zero-view-fixes-20261004/boss-result-s30.json)で確認。既存の合法予算fixture（前29作戦の★1報酬5365 CAPS中5315使用）から、通常UI操作だけで210秒・車両1000/1000・★3で勝利。実ボスTAKUYA-Ωのmax HP9200、撃破HP0を結果へ保存し、3サイズの44pxボタンが全体表示された。前29作戦の進行はseedであり、連続獲得の通常campaignや人間の操作感の証拠ではない。
- [CURRENT破損からの復旧](../../../outputs/zero-view-fixes-20261004/recovery.json)でCAPS、所有隊員、クリア進行、receipt、既読、設定を保持。利用者の保存データには触れていない。
- [短い横画面の自然S1結果](../../../outputs/zero-view-fixes-20261004/10-result-844-340.png)、[実ボス結果](../../../outputs/zero-view-fixes-20261004/20-boss-result-s30-844-340.png)を親が目視。3サイズは1280×720、844×390、844×340。物理iPhoneの聴感・発熱・操作は未確認。

### ソース検証と独立review

- 全1728 tests PASS、Lint 0 errors／既存15 warnings、production build、content validator、`git diff --check` PASS。保存の正常94 checkpoint、古いcursor形式、敗北、S30、報酬確認、破損と二重確定、ボス計測、全車両レベルの星境界を確認した。
- 新CI `37135557591`は監査helperの古いfixtureで失敗。全30のhelperがpending victoryとbattle phase、未確定報酬と確認phaseを同時に保存していたため、実製品のtransaction順序へ修正。再実行で94イベント／767ノード／30 synthetic victories／postgame-map PASS。
- Phase Gの結果fixtureも、異なるresultId・runId、612/920なのに★3、敗北をpendingに保存する不整合があった。製品のresult factoryとtransactionを使い、元HP・時間・死亡数を保持して星を計算し、敗北はlastResultへ保存。投入前にdeserializeを検査する。修正後のChromium勝利・敗北は各3サイズでPASS。これは表示用fixtureで、自然勝利とは別。
- 性能primaryの844×340は29,999msで時間gateだけ失敗した。p95 rAF20ms、中央値58.82fps、その他のgateはtrueだが、合格には扱わない。Nodeのwall clockで終わりを決めていたため、開始・終了計測と同じbrowserの`performance.now()`で30秒の下限を守る。サンプル・33ms・50fps・可視性・描画・DPRのgateを維持し、元artifactを保全。独立reviewで新規High／Mediumなし。変更後の実測はfresh CIで確認する。
- V1の撤退ボタン名を参照する4つのbrowser helperも「作戦地図へ撤退」へ合わせた。旧版専用の操作名と、保存・移行・中断・報酬のassertは維持する。
- 監査helperの修正は製品の検証・数式・閾値を緩めていない。変更後の最終候補はfresh CIで確認し、結果とrun IDを既存台帳へ記録する。失敗したCIと旧HEADの成功を新候補の合格へ転用しない。
- 読み取り専用のgameplay・integrity・visualレビューで、この修正範囲のHigh 0／Medium 0。integrityは保存契約と監査helperの保存順、gameplayは表示専用のボス計測と星境界、visualは案内と結果画面の3サイズを照合した。親が実装・Git・実browserを担当。

候補`940b412`のCI `37138369438`では、全1728 tests、Phase Gの55画面、6性能窓（各30秒以上・p95 rAF19ms）、nativeスタッフロール6ケース、PWA更新18／部分失敗復旧22ケースが成功した。原曲の通常速度・全11場面・315.768秒のtrusted native EOFと、通信socket停止後の150秒seek1回から通常速度166.303秒でのEOFを確認した。保存故障の高倍速controlやseek診断は通常全曲の証拠と区別する。

同CIのStage 3 final-candidateはsetupで失敗した。通信0の確認後、非同期の状態読取り中に効果音4件のfetchが始まり、直後のpending 4を拒否した。assetは55/55 ready、一時停止済み、console／page／request／HTTP errorsは0。通信の完了履歴がないため、製品の滞留・音声失敗とは断定しない。原summaryとlogを`outputs/zero-view-fixes-20261004/ci-940-audio-final-candidate/`に保全する。

setupのnetworkidle開始からquiet・状態採取確定までを、既存timeout（default45秒／CI60秒）一つで制限する。request開始／完了／失敗のrevisionを採取前後で照合し、採取中に通信が増えた場合は同じsetup内で250msのquietを取り直す。error履歴をresetせず、pending 0・error 0・ready・一時停止、音声semantic、測定deadline、試行1回を保持する。有限controlで採取中の開始→完了、未完了fetch、遅い503、停止した状態採取を検査し、独立reviewで新規High／Mediumなし。新候補の全必須CIが終わるまで合格としない。

変更後のローカル全1732 tests・build・Lint0 errors／既存15 warnings・diff checkが成功した。隔離ChromiumのStage 3 final routeは試行1回で完了し、setupのpending 0／error 0、ボス会話FIFO、boss→pressure BGMを確認した（`audio-setup-chromium/summary.json`）。このChromium結果をMac WebKitの代用にはしない。

### 残る受入

「到達作戦」「新しい役割」、復元理由、呼出・出撃・作戦地図・波の表記を整えた。S7の搬出／搬入、S22の43人／43室は確定した矛盾ではなく、正史を変更していない。スタッフロールの演出の強さ、S5を含む人間の難易度・操作感、物理iPhone、作品全体のProducer最終実プレイ受入は残る。正式公開・Ready・最終merge・tag・Release・Issue closeはその承認まで行わない。

## プロジェクト全体の指摘を照合した改善 — 2026-10-04

Producerの「本プロジェクトを通してのあらゆる指摘」を、直近7件だけの修正範囲として扱っていた点を訂正する。GitHubのIssue／PR 174件と関連コメント908件、本プロジェクトのローカル会話5件に残る重複を除いた人間の発言134件、参照された貼付指示、現行正本を照合した。過去会話の検討案を新しい固定判断へ優先させず、現行実装と実画面で指摘の再発を確認した。取得できない別サービスの会話まで読んだという主張ではない。

履歴の原文と添付先は非公開の監査用出力に保持した。ここには製品上の要求と修正・確認だけを記す。

| 過去を含む要求 | 現行候補での扱い・追加改善 |
| --- | --- |
| プロの作品30本以上を具体的に調べ、独自のゲーム体験へ落とす | 既存の31作品の一次資料と改善対応を再照合。今回も、隊員の存在感、作戦準備→育成→再出撃、報酬→編成、最後の余韻を実際の画面と操作へ反映した。調査本数を品質受入の根拠にはしない。 |
| 全台本を自然な日本語と人物ごとの口調で作り直す。ドラマ・笑いも成立させる | 最新の正本と生成済み94イベント／767ノードを基準にする。台本SHA256 `88110351eaa4b597d221828c49f4c29abb8a77bf8180a3c128e6db9c5aa2978f` を維持。今回の設定・保存・報酬の説明も実際の挙動に合わせた。 |
| 目に入る全て、人物・武器・敵・拠点・ボス・VFX・音を監査 | 既存の描画因果、武器socket、被弾・状態・車両、敵shard、音声ownerと各素材契約を保持。新しい編成欄は承認済み人物portraitを使い、顔・服・体格・武器を変更しない。音声の別人物流用や全文読み上げを追加しない。 |
| 単なる色替えで終わらせず、「地図上の配備」として準備画面を再構成 | 作戦と目標の横に選択隊員の大きなportrait・名前・Lv・役割・固有技を置いた。7枠は実ゲームの呼び出し枠として表示し、自由座標配置を装う図は作らない。操作・作戦情報の図は任意展開にした。 |
| 字が小さい、育成の数値や費用・役割が分からない | 選択隊員から育成へ入り、同じ編成へ直接戻れる。短い横画面でパイセンの固有技説明がはみ出す問題を追加発見し、冗長な枠表示を集約、説明欄の高さを制限して全内容へ到達できるよう修正した。全16人と長いS27名で確認した。 |
| 他モードでも編成・育成・装備がつながること | 異常発生とサバイバルへ共通の出撃編成確認・変更を接続。隊員・支援・装備から元の編成へ戻り、元のモードタブへ戻る。保存済み編成・Lv・装備・支援を出撃snapshotに渡す。 |
| 厳しいCAPSを理解し、成長や解禁・購入を明瞭にする | 既存の費用・実stat比較・役割・解禁表示を保持。サバイバルの報酬は所持上限後に実際に増えた装備数を中間記録と結果に表示し、最高制圧更新と隊員の戦果を付けた。報酬・星・費用・receiptの閾値を下げていない。 |
| 序盤の待ち時間、敵密度、弱い／強いボスを、遊んで評価する | S5の実出現timelineから突進・汚染などの行動を出撃前に説明。保存済みの有限予算fixtureで、所有済みクマバーソンの採用と固有技・支援の通常操作を確認した。敗北した以前の3試行も保持する。1回の自動操作の勝利で人間の難易度受入を代替しない。 |
| アビリティの常設文章で戦闘を隠さない | 戦闘HUDへ常設説明を戻していない。出撃前に選択隊員の役割・固有技を確認できる。 |
| 初期高画質、スマホ横画面、保存・中断復帰まで完成させる | 高画質・DPR2と既存性能gateを維持。会話・名前入力・ロール・管理画面へ共通メニューを接続し、音・画質・既読設定を明示保存。メニューの初期focus、Tab／Shift+Tab、背景inert、閉じた時のfocus復帰を追加した。 |
| 既存save・更新・復元が安全で、画面だけ整った完成扱いをしない | V1のデータ管理へPWA容量・更新・削除と保存環境を接続。起動時のworker／cache読取を12秒で区切り、失敗を空packと誤認しない。削除を先行mutationと直列化し、ACK後の有限readbackと失敗後の再確認が終わるまで画面操作を保持する。遅い更新応答は戦闘・会話中に採用せず保留する。 |
| 魔王魂「追憶の幻想世界」を使い、ダイナミックな最後を見せる | 原曲315.768秒を維持。11場面の等間隔割当をやめ、126 BPMの小節長を使った異なる尺、場面ごとのカメラ、RAFでの移動・dissolveへ変更。最後の文章を中央で止め、原曲の自然終了後に静止・暗転してエピローグへ進む。曲名・作者・演奏者・出典を表示する。歌唱句やサビの時刻を人間が聴いて検証したという主張はしない。 |

### 今回発見した追加不具合と検証

- V1からPWA管理へ到達できない導線、cache読取失敗後の永久待機を修正。起動時の拒否・無応答、明示再確認と遅延応答、保存保持を実ブラウザで確認した。
- 更新確認から約1.04秒後、出撃した戦闘へ新版manifestが届く故障controlで、manifestを保留し、同じゲームDOMと戦闘を保持した。10秒watchdogを越えた場合だけの保護ではない。
- 削除ACK後のcache読取を無応答にすると、期限後に失敗と再確認を表示し、保留中のTab／Enterで背後へ戻れない。再確認後は実cacheが0件となり、再取得案内へ進む。CURRENTは削除前と一致。実SWソースを実行する回帰testでも、削除待機中は`pwa:get-state`が旧hashを返さず、完了後に空hashを返した。
- メニュー→会話記録→明示再生中に、背後の本編スタッフロールが再開する不具合を修正。再生中は本編の曲・cursor・進行を停止し、記録を閉じると同じ時刻から再開した。
- 作戦画面の「異常発生・記録」がメニューと重なる問題を修正。`last-child`へ依存せず、入口ごとの幅を指定。3サイズでボタン文字のはみ出しと文書横overflowが0。
- サバイバルの旧run再開、装備の所持上限、実付与数、重複checkpoint／精算拒否、最高制圧更新・戦果の再読込を検証。旧形式に残らない装備内訳は不明として表示し、獲得済みと推測しない。

戦後の「ムガリアン跡地」の文章へ戦闘中の工場画像を流用していた点も改善した。元施設を基に、標章を覆い、臨時診療所と復旧中の設備を描いた人物なしの背景を追加。人物identity・戦闘背景は維持。採用WebPは1600×900、431,026 bytes、SHA256 `67209367699d5e9effdb903384333d454e359882989a6e1c45a2f89212359351`。provenanceと配信契約へ同じpath・hash・bytesを追加し、既存assetを変更していない。配信manifestは537件、distinct hash bytes 149,450,104。原曲のSHA256 `a5be98c2cba42b2d0363d433aceced2946850ec25459fd59bb36cbd2c8d98248` も維持する。

### 実プレイ・画面確認の範囲

- Windows Edge 154.0.4258.53で3サイズ15画面を確認。明示設定保存→再読込、進行・CAPS・receiptの保持、データ管理、他モード編成→育成→同じモード復帰を通過。全16人を844×340／DPR2で切替え、S1とS27の作戦名でも名前・説明の到達と画像decodeを確認した。
- プロローグのメニューを25回のTab／Shift+Tabで操作し、背景へ移らず、閉じると入口へfocusが戻った。設定・データ管理で元のcheckpointを保持し、会話中は更新・削除を無効化。ロールから会話記録を再生中は本編のnative audio時刻が停止した。
- S5は以前の490 CAPS／支出410 CAPS／残80 CAPSの同じfixtureを使用。出撃前に重複パイセン1枠を所有済みLv2クマバーソンへ0 CAPSで変更し、以後は通常の配備・固有技・航空支援・斉射だけを入力。実ボスを撃破し、約227秒、車両520/680で勝利した。戦闘state・HP・時間・結果を変更するhookは呼んでいない。前4作戦はseed、予算はその前提からのfixtureであり、新規campaignの連続獲得の証拠ではない。
- 証拠は`outputs/projectwide-brushup-20261004/`の`after/report.json`、`formation-all-characters*/report.json`、`menu-lifecycle/report.json`、`pwa-faults/report.json`、`s5-defensive-play/report.json`。初期harnessの不足したstandalone指定、不正なformation checkpoint、selector不一致は製品の不具合と分けて保持する。

ソース検証は全1740 tests成功、Lint 0 errors／16 warnings、production build、content validator、`git diff --check`成功。新規警告1件は編成欄の既存portraitを表示する`img`へのframework推奨で、画面画像は実decodeを確認した。PWA管理の追加不具合は修正後の独立読み取り専用reviewでHigh 0／Medium 0。新候補の必須CI、Mac WebKit／DPR2、native全曲とPWA実pack更新をfresh HEADで確認してから、実際に起動する試遊候補を提示する。旧21ae21dのCI成功を新HEADの受入へ流用しない。

**残る受入は作品全体のProducer試遊と、物理iPhoneの操作・聴感・発熱。** Edgeのfixture確認、合格test数、独立reviewのH／M 0を「今後一切指摘が出ない保証」へ広げない。正式公開の承認境界は維持する。

## スタッフロールの追加指示とクレジット後の映画 — 2026-10-07

### 実装した内容

- 復興・日常の35カットへ、ちはとババヤガの親密な場面、成人男性のパイセンとクマバーソンの頬へのキス、駅の台車・料理・配給・車両などの喜劇を加えた。人数・視点・顔の表情・人物の位置を変え、固定の「あなた」と場面説明panelは再導入しない。露骨な性行為の要求は未反映であり、親密さ・喜劇の追加で要求全体の完了を装わない。
- 元モデルを参照し、短髪金髪のLMGを持つレイダーを女性として描いた。キングの緑パーカー・黒プリーツスカート・赤い長靴をcredits 5枚／終幕4枚で揃えた。以前の不採用原本とtracked画像は保全し、採用manifestは新しいruntimeだけを参照する。
- 画像のdecode完了を確認してから同じnative画像要素を次のcurrentへ昇格させる。画像要素は2個を保持し、遅延・不正画像では最後にdecodeできた絵を残す。古い画像の遅着errorはtokenを照合して無視する。
- 1／2／4倍は映画・文字だけに適用。曲のplaybackRateは1、早送りでseekしない。早送りで映像が先に終わる場合とスキップは曲を1.8秒でfadeし、2.8秒で次の映画へ渡す。通常1倍はnativeの曲末を待つ。
- creditsから64秒の終幕へ進む。夜の姪浜、背後→手を伸ばす→脱ぐ→投げる→海に浮かぶヘルメット→名を伏せた人物の正面→血の付いた歯の笑みを7カットに分けた。最初の背後4カットは同じ位置と構図を保ち、動作の重複像を作らない切替と穏やかな寄りを使う。
- 「物語は、まだまだ続く...」「西新世紀末物語Ⅱ(仮称)」「COMING SOON - WINTER 2026」「最後まで遊んでくれてありがとう！！」を指定文字列のまま表示。波音と不穏曲を段階的に上げ下げし、reduced motionでは画像の寄りを止める。
- 終幕の終了後は既存のepilogue完了保存を通してpostgame-mapへ戻る。stable ID・報酬receipt・星を維持し、旧27ノードのエピローグは会話記録に保持。保存失敗では最後のお礼と「続ける」を残し、手動再試行できる。

### 素材と参照

採用35枚のcreditsは9,161,882 bytes、7枚の終幕は1,293,990 bytes。全て1600×900。追加波音はtransitkingのCC0録音4本を原本保存し、64.03秒・44.1kHz stereo・96kbps MP3へ編集、768,358 bytes／SHA256 `e89b86cb5f2cfe4c9736fcc43c1af68d78e8b9b2c3fe9a22fcf75eaef2b9297b`。既存Scott Buckley「The Old Ones」のCC BY 4.0 credit、魔王魂の作者・曲名・演奏者・規約を保持した。既存279音声と32,027,668-byte voice bundle、6,309,936-byte魔王魂音源は変更していない。

配信manifestは589件／logical 167,687,673 bytes、587 distinct hashes／167,147,770 bytes。PNG原本群71 files／178,288,428 bytes、64 distinct hashes／160,440,858 bytesはGit/PWAへ入れず、workspace内と別のprimary archiveへhash照合して保存。100MiB超の保存群を独立read-onlyで確認し、最大単体3,153,735 bytes。remote原本バックアップは未確認。provenanceは `assets/source/v100/runtime/credits/comedy-r1.provenance.json`、`ending/king-costume-r1.provenance.json`、`epilogue/post-credits-r1.provenance.json`。旧不採用WebP7枚もhashを照合してarchiveへ残した。

提供写真は本人の顔の参照として使い、正面の顔を他キャラクターと共通の描画へ作り直した。写真の公開・Git追加・別用途の採用を行っていない。半顔の皮膚剥離と筋肉露出はbuilt-in ImageGenが`400 moderation_blocked violence`を返し、生成・採用していない。拒否された生成の再試行や回避を行わない。採用中の感染の傷と血の付いた歯を、未実装の要求への合格として報告しない。

### 検証と失敗controlの区分

- `ending-test-r5.log`で変更後production buildと全1755 tests成功。`ending-lint-r6.log`は0 errors／18 warnings（既存16と常設native imgのframework推奨2）。最後のPhase G差分は該当7ファイル／133 tests成功。content validatorとdiff check成功。出力は `outputs/projectwide-brushup-20261004/design-rebuild/`。
- `ending-campaign-edge-r3/report.json`、`ending-campaign-webkit-r3/report.json`は各1280×720／844×390／844×340を成功。製品ビルドのcredits→終幕→保存→postgame-map、pause／menu／portrait／pagehide／pageshow、既読の一度限り確定、CAPS・receipt・所有・星・装備・車両の保持、旧エピローグの回想を検査した。30作戦の進行はQA所有の合成saveであり、通常30戦クリアや利用者データの操作ではない。
- Edge 844×340のlocalStorage／IDB書込故障で、お礼と「続ける」を維持し、自動再試行が増えないことと故障解除後の手動復帰を確認した。物理端末・speaker聴感・発熱の証拠ではない。
- 初回campaign reportはEdge 3サイズ成功後、未配置のWebKit revision2359により全体failed。固定Playwright1.63.0／WebKit26.6だけを準備して取り直したr2は、844×390でportrait復帰後のpagehide停止が解除されてfailed。遅着orientation通知がpagehideを上書きする製品不具合であり、独立latchを持ちpageshowだけが解除するよう両映画を修正。r3はpagehide後に回転・visibility通知を重ねても映像と音声が止まり、復帰後のみ進むことを確認した。元failed reportを保持。
- `ending-phase-g-r2/phase-g-report.json`はローカルEdgeで終幕の3画面・3 distinct hash成功。映画のfade-in完了（4.3秒以上）とcurrent画像decodeを必須にし、2 audio／2 imgの契約を維持。視覚fixtureだけ音なし。r1は配置されていないChromium headless1194で開始前failedであり、画面成功へ含めない。自動再生gestureを要求するブラウザで待ち続けるレビューMediumを解消した。
- native r2は全35枚の通常速度・seekなし・trusted曲末を確認したが、補助スクリーンショットの取得が短い1カットを飛ばしてnormal全体failed。fast4は終了後のdetached DOMを採寸してfailed。連続RAFでの全画像・cut・同じ2要素を一次条件に保持し、expected終了coverを確認してからdetached測定を止めるharness修正でr3の限定ケースを通した。元の失敗を削除せず、thresholdを下げない。lifecycle修正後の`ending-native-r4/report.json`は8ケース成功。通常1280×720と4倍844×340の35画像／34切替、各終幕の7画像／6切替、画像要素2個の維持・巻戻り／remount 0、通常原曲のtrusted EOF・seek 0、早送り時も曲速度1・途中fade、844×390の終幕カード、先頭／末尾／途中の不正画像・遅延・reduced motionを確認した。native media観測と画面記録であり、物理speaker聴感ではない。
- 独立read-onlyのvisual／integrity／typography integrationレビューの今回範囲はHigh／Medium未解消0。216原本/runtime/archive参照、42採用画像、589配信件数、旧音声hash、原本の非配信を照合。最終画像採否・台本・音の印象はProducerの試遊で判断する。

### 残る受入

固定した候補の必要CIと、全体のProducer試遊・画像採否・音響受入を台帳へ残す。旧`32dd96c`の26/26を新候補のCIへ繰り上げない。物理iPhoneの操作・speaker・発熱は未確認。ローカル試遊の起動を公式公開と扱わない。成人限定という指定を理由に未生成・未採用の要求を完了にせず、100%人間制作・AI感ゼロ・以後の指摘ゼロを保証しない。正式公開前の承認境界を維持する。

## 終幕への通し確認とオフライン再起動の追試 — 2026-10-07

- 固定`09d4e15`の`full-ui-09-r2/report.json`は全94イベント／767ノード／30 synthetic結果／35保存・再読込／error 0。名前入力から、全作戦の本編会話・実UI報酬確定・ENDING・通常速度のnative staff roll・新しい7カットの終幕・postgame-map・旧27ノードの回想へ到達。原曲は1倍、seek 0、trusted EOF 315.742041秒。映画は35／7画像、34／6切替、同じ2画像要素、巻戻り・remount・未decode表示0。指定4行を実表示し、回想でも保存進行を保持した。通常30戦の勝利・物理端末の受入を意味しない。
- r1の失敗は、authored nodeが0のfirst-clear-post報酬画面に会話nodeの範囲条件を当てたharness fault。報酬画面の正確な初期checkpoint、canonical finalization、重複receipt拒否、実UI buttonを検査し、同じ候補のnative保存地点からr2へ再開。元report、保存、画像とdriverを保持し、会話全文・画像・音声・error条件を変更していない。
- CI run`37602748111`のMac WebKit native PWA artifact`11474695862`を取得し、`ci-09d4e15-native-pwa-integrity-r2.json`で10 source hashesと6 reportsを確認した。Cache Storage 2ケース、native save hold 2ケース、staff roll 7ケース、元MP3のcached native range／1倍EOF、旧版415→新589の更新18/18、部分失敗復旧23/23。新終幕7画像と波音も更新transportに含まれ、全589 logical assetsが保持・復旧される。23番目を含む現行sourceの全チェックを検査し、旧集計22へ丸めない。旧版はimmutable tagのlocal rebuild、Mac CI buildはMac内で一致するdist hashであり、公開済みPagesバイトやWindows buildのバイト同一性を装わない。
- `ending-offline-09-r1/report.json`では完全pack保存後にサーバーを実切断し、終幕7画像と2音声のnative SW取得・再生・地図復帰を確認したが、HTMLが読むRSC生成`assets/index-D9BHNL8D.css`が16件のshell listから漏れて`ERR_FAILED`になったため全体failed。さらに検証用hard reloadによるオンライン2音声の`ERR_ABORTED`を記録した。映画の成功でCSSの失敗を隠さない。
- 修正は`pwa-shell-files.mjs`で実生成JS／MJS／CSSを列挙し、buildとPages検証で同じ集合を使う。両HTMLのJS/CSS依存がその集合に含まれることも必須にした。画像・音声・app source・save・589配信assetは維持。回帰testはVite manifestから省略されたRSC CSS、shell空集合、不正filenameを検査する。
- `ending-offline-shell-r2/report.json`は修正後ローカルbuildの17 shell filesと終幕9 assetsのCache Storage内bytes/hash、接続不能negative control、native SW offline relaunch、7画像6切替・2常設要素・巻戻り0、波音／不穏曲のnative時刻・速度1、終了後の地図復帰・既読1回・CAPS／receipt等保持、error 0を確認。media mount前に通信を切り、検証側のhard reloadで演奏中の音声を中断しない。全errorを記録し、filterやdeadline延長で合格にしていない。未commitのbuild差分を使った証拠であり、次候補のCIではない。
- `ending-test-r7.log`はproduction buildと1758/1758、`ending-lint-r7.log`は0 errors／既存18 warnings。content・diffも成功。最初の31 focused testsはWindows sandboxのMSYS object作成権限により1件を開始できず、製品のfailureではない。許可済み通常権限のfull testsで同じstrict shell testを含めて成功。4ファイルの独立read-only reviewはH0／M0／L0。

新固定headの必要CIとProducer最終受入は引き続き台帳で管理する。露骨な性行為・半顔の皮膚剥離と筋肉露出は未反映で、要求全体の完了を装わない。
