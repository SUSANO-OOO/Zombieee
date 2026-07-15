# 0.6.0 アーリーアクセス版 ローカルQA記録

検証日：2026-07-14〜2026-07-15

対象：`feat/0.6.0-early-access-foundation` のDraft PR #30最終候補

方法：本番ビルドを `127.0.0.1` で配信し、ローカル実ブラウザでPC横画面、iPhone横画面相当、縦横回転、全アセットの実decodeを確認した。本記録を含む正確なcommit SHAはDraft PR #30のheadを正とする。

> 本記録はローカル実ブラウザによる受入前QAである。物理iPhone Safari、本体スピーカー、イヤホン、長時間性能、発熱、公開URL上の第三者試遊は未確認であり、ローカルQAで代替済みとは扱わない。

## 1. 最終判定

| ゲート | 結果 |
|---|---|
| 本番ビルド | 成功 |
| 自動テスト | 200件成功 / 200件、失敗・skip・todo 0 |
| ESLint | 成功 |
| production HTTP | manifest 326パスとビルド済みJS/CSSがstatus 200、非空、期待MIME |
| ブラウザ実decode | audio 270/270、portrait 11/11、production image 16/16、失敗 `[]` |
| ブラウザconsole | warning / error 0件 |
| 独立read-onlyレビュー | High 0 / Medium 0 |

## 2. 画面サイズ・Safe Area・操作領域

| 条件 | ルート | overflow | 主な確認 |
|---|---|---:|---|
| 844×390 + 左右44px / 下21px Safe Area | 844×390 | 0 | 9名編成、戦闘、会話、地図、結果、pause |
| 844×340 + 左右44px / 下21px Safe Area | 844×340 | 0 | 9名編成、戦闘HUD、横スクロール、全操作到達 |
| 390×844 → 844×340 | 縦では回転案内、横復帰後844×340 | 0 | 回転後も戦闘状態と再配置を維持 |
| PC 1280×720 | 1280×720 | 0 | キーボード、詳細HUD、9名、全支援操作 |

- 844×390と844×340の戦闘ユニットカードは9件すべてDOM上に存在し、横スクロールで全員へ到達できた。各カードの実測高さは両条件とも45pxで、44px以上を満たした。
- 編成画面は3×3で9名を表示し、名前、武器、射程、主対象、配置意図、選択状態、未解放状態を保持した。844×390と844×340で左右余白0、中心ずれ0、overflow 0、主要ボタン44px以上だった。
- 960×540 Canvasは画面中央を維持し、短い横画面では3レーン、戦場物、支援、死体、効果、出撃待ちを現在のレーン中心へ再配置した。
- 390×844では回転案内だけを全面表示し、横画面へ戻すと戦闘を維持したまま案内を消した。
- PCでは既存キー1〜6を維持し、新規三名を7〜9へ割り当てた。画面操作だけでも全員を出撃できる。

## 3. 九名、解放、セーブ

実装対象は次の9名で、stable ID、編成、出撃、AI、攻撃、死亡、感染、焼却、音響、結果、セーブを同じIDで接続した。

| 解放時点 | ユニット |
|---|---|
| 初期 | パイセン、橘 迅、黒木 凛、白石 直人 |
| 西新商店街クリア後 | 大庭 豪、クレイジーキング |
| 早良区役所クリア後 | 真壁 玲奈、クマバーソン、ババヤガ |

- schema 2からversion 3へidempotent migrationし、開始状態、処理済み結果ID、クリア、星、星報酬、補給物資、解放、最終選択、BGM/SFX、音量、reduced motion、既読event、既読自動skipを保持した。
- localhost限定QAは `通常セーブ非反映` を表示し、全解放結果を通常セーブへ書き込まない。
- 初対面・加入は初回だけ、retryは失敗後の分岐、clear後のreplayは別作戦として分離した。
- 各戦闘で新しい `resultId` を発行し、同一結果の報酬・星・解放・保存を二重適用しない。敗北と撤退では星・報酬・解放をcommitしない。

## 4. 顔・会話用ポートレートの流用防止

- 人物10名（戦闘員9名と水城奈々）は、それぞれ別path・別bytesの512×640専用v2 WebPを使用する。会話用画像は戦闘sprite sheetを参照しない。
- パイセン以外の9名は、パイセンのreference pathを参照しない。各人物の独立reference、生成source、最終WebPとSHA-256を `reference/characters/portrait-provenance-v2.json` へ固定した。
- 旧v1人物portraitはproduction出荷物から除去した。10人物の最終hashはすべて異なる。
- 不明な無線、感染体の声、TAKUYAの声、章表示は、人物の顔ではなく独立した無線端末portraitを使用する。無線端末は水城奈々portraitとも別path・別bytesである。
- 全39 story eventの全行でportrait keyがproduction画像へ解決することを自動テストした。`stage-takuya-mimic-child` は実ブラウザでも `TAKUYAの声` と無線端末画像の組み合わせを確認した。
- 3×3編成画面と会話画面を目視し、パイセンの顔を別人物の会話画像へ流用していないことを確認した。

## 5. 新規三名の戦闘実装

| stable ID | 役割・武器 | 実装した固有効果 |
|---|---|---|
| `crazy-king` | 狂戦士・チェーンソー | 密集範囲攻撃、bleed、軽い押し込み |
| `kumaverson` | 前衛打撃・フライパン | 強いknockback、上限付きstun、前線維持 |
| `babayaga` | 精密射撃・サプレッサー拳銃 | 特殊個体優先、分析mark、射線が通る隣接レーン射撃 |

- HP、速度、攻撃力、射程、攻撃間隔、出撃cost、cooldown、target priorityはconfig化し、既存六名の単純上位互換にしていない。
- ババヤガは隣接レーン候補にも実際のline-of-sight判定を使う。遮蔽物越しの候補を保持して停止せず、目標へ前進する。
- 専用lifecycle QAでクレイジーキングの固有死亡姿、クマバーソンの感染予兆、ババヤガのburning→ashを同時確認した。三名とも死亡後に別人物の姿へ置換しない。

## 6. 戦闘sprite監査

- runtime対象は17 kinds（旧味方6、敵8、新規三名）×7 states×2 directions = 238方向別frame keyである。
- 旧素材11 sheetは原本を変更せず、各source rectangleを実測したうえで、16px透明perimeterを持つ11個のlossless派生atlasへ再梱包した。画素、表示scale、center anchor、baselineを保持する。
- 新規三名は各3360×896の専用production atlasを使用し、7状態×左右を持つ。武器、死亡姿、透明ガター、縦横比、原寸、2倍、実戦表示を確認した。
- 全frameで範囲内、content rect、透明perimeter、隣接frame混入なしを自動検査した。Canvas補間を有効にした実戦表示でもbleedを確認していない。
- パイセン原本 `public/brawler-sprites-v1.png` は変更せず、SHA-256 `c2c8e5fa2241a4841c80ca817afe6efedcb235d0bccafabcad931776a8b7d3c4` を保持した。runtimeは原本を直接切り出さず、lossless派生atlasを使用する。

## 7. 序章、skip、敗北・retry・replay

- `prologue-v5` の必須36 eventとreplay 3 event、計39 eventを実装し、通常flowからすべて到達できる。
- 正本の固定会話222行とending title card 3枚を削除・要約・言い換えせず保持した。
- runner / spitter初出現、偽救難音声、感染拠点露出、救援車両、防衛節目、TAKUYA登場・HP段階・子どもの声・撃破・残存拠点、移動拠点危険、勝敗へeventを接続した。pause、回転、再描画、連打で重複発火しない。
- 会話ログ、確認付き手動skip、既読eventだけの自動skipを実装した。通常完了、手動skip、既読自動skipは同じcompletion reducerを通り、戦闘開始、加入、星、報酬、解放、保存結果が一致する。
- 通常敗北、TAKUYA撃破後敗北、retry、clear後replay、勝利後通信を分離した。早良区役所の180秒防衛も成功・敗北の両経路を検査した。

## 8. 一時停止と結果

- pauseから `作戦を再開`、`ステージを最初からやり直す`、`編成画面へ戻る`、`エリアマップへ撤退`、音量設定へ到達できる。
- restart、編成へ戻る、撤退は確認dialogを表示し、報酬・星・解放を受領しないことを明記する。
- 編成へ戻る場合は選択ステージ、編成、物資を保持する。restart / retryは新しいsessionとresult IDを使う。
- 遷移時はBGM、環境音、燃焼loop、チェーンソーloop、voice、pending timer、未完了audio/event予約、戦闘local stateを破棄する。
- 3星勝利と0星敗北を実ブラウザで確認し、表示とcampaign commitを分離した。

## 9. ステージ固有production素材

| ステージ | 背景 | 動的overlay |
|---|---:|---:|
| 西新商店街 | 1600×900 WebP | 9 |
| 早良区役所 | 1600×900 WebP | 8 |
| 西新防衛線・TAKUYA | 1600×900 WebP | 8 |

- 25個のstage overlayをproduction inventoryへ登録した。罠、救援導線、無線設備、感染拠点などのmutable slotは状態別画像と12px透明ガターを持つ。
- 配送車、自転車、店舗、救援車両、テント、医療物資、防壁、有刺鉄線、通信設備、感染組織などを背景統合、専用overlay、不可視判定のいずれかへ分類した。対応表は `docs/STAGE_OBJECT_AUDIT_0.6.0.md` に記録した。
- 三ステージは別背景・別overlay inventoryを使い、場所固有のランドマーク、照明、戦闘跡で目視識別できる。仮図形を削除しただけの項目はない。

## 10. production visual / audio

### Visual

- production visualはunique 56ファイル（WebP 16、PNG 40）。
- WebP 16点は人物・無線11、title、command、3 stageである。16/16をSharpで実decodeし、ブラウザの `Image.decode()` でも16/16を確認した。
- 人物・無線11点はブラウザの独立portrait decodeでも11/11を確認した。

### Audio

- 135論理asset（BGM 9 / SFX 126）、41 variation pool、176 cue ID、10 scene、270 source（MP3 135 + OGG 135）。aliasは0件。
- 新規三名は26個の専用cueと、専用生成master、専用MP3/OGG finalを持つ。外部sampleを使用していない。
- 全270 sourceはrepository-local、非空で、MP3 frameまたはcomplete OGG Vorbis pageを構造検査した。合計20,943,356 bytes。
- 本番ブラウザの実 `AudioContext.decodeAudioData()` で270/270をdecodeし、失敗 `[]` を確認した。
- 最初のpointerでcontext作成・resume・scene再生へつなぎ、touch重複抑止、`suspended` / `interrupted`、`pageshow`、`visibilitychange`、手動音声有効化、cancel済み予約の復活防止を自動テストした。

## 11. 自動検証と独立レビュー

- `npm.cmd test`：本番ビルド成功、200件成功 / 200件、fail / cancelled / skipped / todo 0。
- `npm.cmd run lint`：成功。
- `git diff --check`：成功。
- production HTTP test：audio 270 + visual 56 = 326 manifest pathとビルド済みJS/CSSを取得し、status 200、非空、拡張子に対応するMIMEを確認した。
- 独立read-onlyレビューは最新修正後にHigh 0 / Medium 0。対象はportrait分離、WebP/audio実decode、sprite gutter、Babayaga射線、lifecycle、44pxカード、story portrait解決を含む。

## 12. 最新の証拠画像

保存先：`qa-evidence/0.6.0-early-access-final/`

- [タイトル](../qa-evidence/0.6.0-early-access-final/iphone-844x390-title-final.png)
- [9名編成 844×390](../qa-evidence/0.6.0-early-access-final/iphone-844x390-formation-nine-final.png)
- [9名編成 844×340](../qa-evidence/0.6.0-early-access-final/iphone-844x340-formation-nine-final.png)
- [導入会話](../qa-evidence/0.6.0-early-access-final/iphone-844x390-story-opening-final.png)
- [会話skip確認](../qa-evidence/0.6.0-early-access-final/iphone-844x390-story-skip-confirm-final.png)
- [TAKUYAの声と非人物無線端末](../qa-evidence/0.6.0-early-access-final/iphone-844x390-story-takuya-radio-final.png)
- [エリアマップ](../qa-evidence/0.6.0-early-access-final/iphone-844x390-campaign-map-final.png)
- [西新商店街](../qa-evidence/0.6.0-early-access-final/iphone-844x390-stage1-nishijin-final.png)
- [早良区役所](../qa-evidence/0.6.0-early-access-final/iphone-844x390-stage2-sawara-defense-final.png)
- [西新防衛線・TAKUYA / 9名戦闘](../qa-evidence/0.6.0-early-access-final/iphone-844x390-battle-nine-roles-final.png)
- [PC 1280×720 / 9名戦闘](../qa-evidence/0.6.0-early-access-final/pc-1280x720-battle-nine-roles-final.png)
- [pause menu](../qa-evidence/0.6.0-early-access-final/iphone-844x390-pause-menu-final.png)
- [3星勝利](../qa-evidence/0.6.0-early-access-final/iphone-844x390-result-three-stars-final.png)
- [敗北](../qa-evidence/0.6.0-early-access-final/iphone-844x390-result-defeat-final.png)
- [9名の戦闘中台詞](../qa-evidence/0.6.0-early-access-final/iphone-844x390-battle-barks-nine-final.png)
- [44固定台詞audit](../qa-evidence/0.6.0-early-access-final/iphone-844x390-bark-audit-final.png)
- [238 frame sprite audit](../qa-evidence/0.6.0-early-access-final/iphone-844x390-sprite-audit-final.png)
- [ババヤガ死亡pose 原寸](../qa-evidence/0.6.0-early-access-final/iphone-844x390-babayaga-death-original-final.png)
- [ババヤガ死亡pose 2倍](../qa-evidence/0.6.0-early-access-final/iphone-844x390-babayaga-death-2x-final.png)
- [ババヤガ死亡pose 実戦](../qa-evidence/0.6.0-early-access-final/iphone-844x390-babayaga-death-battle-final.png)
- [spitter攻撃pose 実戦](../qa-evidence/0.6.0-early-access-final/iphone-844x390-spitter-attack-battle-final.png)
- [新規三名の死亡・感染・焼却](../qa-evidence/0.6.0-early-access-final/iphone-844x390-lifecycle-death-infection-cremation-final.png)
- [縦画面の回転案内](../qa-evidence/0.6.0-early-access-final/iphone-390x844-rotate-notice-final.png)

## 13. 未確認・次の承認工程

- 物理iPhone Safariでのtap、Safe Area、Safari UI、画面ロック復帰。
- 本体スピーカーとイヤホンによるBGM、効果音、voice、loop停止の聴感。
- 長時間プレイ時の性能、発熱、電池消費。
- Draft PR #30のCI `Verify`。最終push後に確認する。
- 公開URL上の第三者試遊。現実装ミッションではReady化、merge、Sites公開が禁止されているため、固定したPR/base/head SHAとmerge方式を含む別のリリース承認後に実施する。
