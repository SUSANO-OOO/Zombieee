# 西新世紀末物語 — Version 0.7.1／0.7.5 Codex実行ロック

更新日：2026-07-22  
状態：**最終承認済み・一括実行可能**

## 1. この文書の役割

本書は、CodexがVersion 0.7.1からVersion 0.7.5 release candidateまでを一度の開始指示で進めるための最終実行契約である。

参照順：

1. `docs/PRODUCER_DECISIONS_0.7.5.md`
2. 本書
3. `docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`
4. Issue #43
5. Issue #44
6. `AGENTS.md`
7. 工程別の実装・QA記録

本書とImplementation Directiveの実行順・権限・ゲートが衝突する場合は本書を優先する。Producer Decisionsの製品判断は変更しない。

本書の`main`反映後は、製品判断変更または実装・QAで判明した重大blockerがない限り、追加の「最終計画書」、ロードマップ、引き継ぎ書を作らない。技術上の曖昧さはCodexが裁量内で解決し、再計画へ戻らない。

## 2. 開始時点

直近の観測では`main`は次である。

`56dad345cb88a4a98fa90f28d5ecdd8be3063959`

ただし固定前提にせず、開始時と重要操作直前に再取得する。

Claude Codeへの一時移管はGitHub上で実行されていない。Claude Code由来のcommit、PR、引き継ぎbranchを待たず、現在のGitHubとローカル状態から開始する。

開始時に確認する。

- repository、remote、branch、HEAD、working tree
- GitHub `main` SHA
- open PR、Issue #43、Issue #44
- tag、GitHub Release、Actions
- 正式URLのrelease metadata
- push、PR、Issue、Release、Actions権限
- baseline test、Lint、production build、`git diff --check`

既存未commit・未追跡変更を削除、reset、上書きしない。必要なら安全な別cloneまたは隔離worktreeを使う。

## 3. 一括実行順

1. **R0：公開運用preflight**
2. **Version 0.7.1：Stage 5／Stage 6 hotfix**
3. **Version 0.7.1正式公開・公開後QA**
4. **Issue #43 completed close**
5. **Version 0.7.5開始**
6. **工程branchから`integration/0.7.5`へ段階統合**
7. **いくらちゃん、CRAWLER、敵拠点の基準デザイン確認**
8. **0.7.5 release candidate完成**
9. **プロデューサー最終実プレイ受入で停止**
10. 合格後の別承認で0.7.5正式公開

0.7.1公開後、追加開始指示を待たず0.7.5へ継続する。

# R0 — 公開運用preflight

## 4. 目的

Stage 5のコード変更より先に、現行Pages運用の固定0.7.0／Issue #37依存と、通常`main` pushによる製品版自動deploymentを解消する。

## 5. 現在公開状態の確認

- 最新`main`、tag、Release、open PR、workflow状態を再取得
- 正式URL`https://susano-ooo.github.io/Zombieee/`の公開HTMLからrelease metadataを取得
- 公開中ゲームがVersion 0.7.0正式release SHA
  `782c70351a8fe22ca4ca0daa926c31c83433653a`
  と一致するか確認
- 異なる場合、ゲームコード、既存tag、GitHub Releaseを変更せず、immutable v0.7.0を再deployment
- Actions成功だけで復旧済みとせず、匿名ブラウザ相当で正式URLを確認

## 6. release contract

release requestは最低限次を持つ。

- `version`
- `release_ref`
- `release_sha`
- `issue_number`
- `request_id`

固定値を撤廃する。

- public QA内の`0.7.0`直書き
- public QA内のIssue #37直書き
- 固定release SHAへの暗黙依存

正式deploymentは、明示的release requestまたは安全なmanual dispatchだけで実行する。

- docs-onlyを含む通常`main` pushで製品版を自動deploymentしない
- PR段階のbuild、browser smoke、release contract検証は維持
- immutable release再deployment能力は維持可能
- workflow、request、public QAの契約testを追加
- `AGENTS.md`、`PROJECT_STATE.md`、`RELEASE_BACKUP_RECOVERY.md`などの衝突記述を同じops PRで整合
- 既存tagを移動しない

## 7. R0出口ゲート

- ops専用branchとPR
- 対象test、全test、Lint、build、`git diff --check`成功
- CI成功
- 独立read-onlyレビューHigh／Medium未解消0
- 通常merge
- 正式URLがVersion 0.7.0 release SHAを配信
- 匿名アクセス、主要asset、console error 0
- Issue #43へR0結果と正確な再開位置を記録

R0完了後、追加承認を待たず0.7.1へ進む。0.7.5のB0では同じ汎用化を再実装せず、契約が維持されていることだけ確認する。

# Version 0.7.1 — Stage 5／Stage 6 hotfix

## 8. branchと範囲

- R0 merge後の最新`main`から専用hotfix branchを作成
- Issue #43を実行台帳とする
- 0.7.5のレーン撤廃、戦闘基盤、AI全面刷新、育成、量産基盤、画像刷新を混在させない
- stable ID、save、星、報酬、既読、Stage 6解放を維持

## 9. Stage 5

固定要件：

- Stage 5 stable IDを変更しない
- 必須台車護衛を撤廃
- ホーム制圧・感染拠点破壊中心の通常戦闘へ変更
- 台車は背景演出、戦闘後搬送、または敗北条件ではない副目標に限定
- 3種類以上の異なる編成で通常クリア可能
- 調達ユニット、特定ユニット、最大強化を必須にしない
- Stage 4 → Stage 5 → Stage 6を通常導線で進行可能

## 10. Stage 6ボスHP504停止

確認された現象：

- ボス「改札喰い」のHPが504まで減った後、それ以上減らず、撃破不能

固定要件：

- 公開版または同等baselineで再現
- HP表示、damage計算、target／hit判定、無敵状態、phase遷移、state同期、boss objective、勝利判定を切り分け
- `504`だけを例外処理する応急修正は禁止
- 根本原因を修正
- phase閾値が仕様なら、正しいphase遷移後に再びダメージ可能にする
- 複数のユニット・武器構成でHPが504未満へ減り、0まで到達
- ボス撃破、勝利判定、結果画面、報酬適用、マップ帰還が一度だけ成立
- 敗北、再挑戦、撤退、再読込を確認
- 公開版でも実際にボスを撃破

## 11. 0.7.1共通QA

- fresh save
- 公開版由来の既存save fixture
- Stage 4クリア後のStage 5解放
- Stage 5クリア後のStage 6解放
- Stage 5勝利、敗北、再挑戦、撤退、再読込
- Stage 6勝利、敗北、再挑戦、結果、マップ帰還
- 3種類以上の異なる編成
- PC 1280×720
- 844×390
- 844×340
- Playwright WebKit iPhone相当
- console error、page error、request failure、主要asset 404が0
- 対象test、全test、Lint、build、`git diff --check`成功
- CI成功
- 独立read-onlyレビューHigh／Medium未解消0

## 12. 0.7.1正式リリース

全ゲート通過後、Issue #43の承認範囲で連続実行できる。

1. PRのbase、head、CI、mergeabilityを再取得
2. 必要ならDraft PRをReady化
3. `main`へ通常merge
4. merge result SHAを取得
5. release SHAへ`v0.7.1` annotated tag
6. GitHub Release
7. 明示的release requestによるPages deployment
8. 正式URLのversion／release SHA確認
9. 匿名状態でタイトル、主要asset、fresh save、既存save、Stage 1開始
10. 公開版でStage 5をクリア
11. 公開版でStage 6ボスを撃破
12. 結果画面、報酬、マップ帰還を確認
13. Issue #43へ最終報告
14. Issue #43をcompletedでclose
15. 公開後確認済みbranch cleanup

0.7.1完了後、最新`main`から0.7.5へ続行する。

# Version 0.7.5 — 実装契約

## 13. branch構造

標準：

```text
main
└─ integration/0.7.5
   ├─ feat/0.7.5-repository-audit
   ├─ feat/0.7.5-content-pipeline
   ├─ feat/0.7.5-battle-space
   ├─ feat/0.7.5-ai-missions
   ├─ feat/0.7.5-progression
   ├─ feat/0.7.5-visual-animation-vfx
   ├─ feat/0.7.5-event-foundation
   └─ feat/0.7.5-performance-save-qa
```

名称は同等に明確なら変更できる。

- 工程branchのPR baseは`integration/0.7.5`
- 対象test、全体回帰、CI、独立review合格後、Codexはintegrationへ通常merge可能
- integrationへのmergeは正式リリースではない
- 各工程merge SHAをIssue #44へ記録
- `integration/0.7.5 → main`の最終PRだけは、release candidate最終実プレイ合格後の別承認までmerge禁止
- 同じファイルを複数工程branchで無調整に並行編集しない

## 14. 工程

### B0：開始・現状監査

- Issue #44と正本を確認
- 0.7.1公開状態とrelease contractを確認
- runtime、content、UI、save、assets、animation、audio、tests、workflows、docsを監査
- 現在使用中、正本、互換用、自動生成、test専用、旧版、重複候補、未使用候補へ分類
- 責任境界、移行順、risk、rollback、旧構造廃止条件を記録

### B1：content pipeline

- units、enemies、stages、missions、waves、maps、difficulty、rewards、acquisition、upgrades、events、assets、saveをデータ駆動化
- generator、schema、registry、loader、validator、migrationを実装
- ID重複、参照切れ、アセット不足、未使用候補を検出
- balance、caps economy、migration、synthetic scaleを自動化

量産基盤の実追加ドリル：

- productionへ配信しないfixtureでテスト用ユニット1体、敵1体、ステージ1件をgeneratorから作成
- dry-runまたは同等の非破壊確認
- 同じ入力から同じ成果物
- 再実行で不要差分0
- core runtimeへ対象固有コードを追加しない
- build、test、QA gallery成功
- fixture除去後にproduction差分0

### B2：battle space／placement／spawn

- プレイヤー向け固定3レーン撤廃
- 連続した戦場
- 座標、距離、形状、範囲、視線による戦闘
- 設置予告、可否、理由、最寄り有効位置補正
- スマートフォン一画面で戦況把握
- キャラクター豆粒化回避
- CRAWLER出入口、出撃演出、配置禁止範囲を再設計
- 敵拠点を細く視認しやすくし、後方・内部・画面外から自然spawn

内部の経路ノード、navigation mesh、flow field、steering、見えない移動帯は許可する。

### B3：AI／missions／Stage 1〜6

- 味方AIを前衛、重装、遊撃、射撃、制圧、支援、工兵などのprofileへ整理
- 敵AIをCRAWLER優先、最寄り、後衛、支援物、拠点防衛、突進、拘束、遠距離、汚染、範囲、召喚へ整理
- 接敵、適正距離、再索敵、迂回、詰まり解消
- 攻撃対象、投射物、ダメージ対象を一致
- Stage 1〜6を新基盤へ移行
- 0.7.1のStage 5／6修正を回帰させない
- Stage 6勝利、敗北、再挑戦、帰還を実プレイ

### B4：progression／economy／UI

人員管理：所有一覧、調達、強化。

- 購入と強化にキャップを使用
- 全11ユニットが共通基盤から強化可能
- 数段階の成長と少数の節目効果
- 後発ユニットの追いつき
- stable ID保存とmigration
- 誤投資で本編進行不能にしない
- 最大強化、特定ユニット、過剰周回を必須にしない
- 育成だけで押し切れず編成判断も必要

大規模スキルツリー、多数の固有能力、装備在庫、レアリティ、ガチャ、覚醒、限界突破、複雑なrespecは実装しない。

### B5：portraits／scale／animation／VFX

- identity master、event portrait、formation card、battle spriteを用途別profile化
- crop、focus point、scale、anchor、safe area
- 見切れ、顔欠け、極端な全身縮小、UI干渉0
- 足元、頭頂、体格、武器、影、hitbox、選択判定を標準化
- タタラを大柄な人物として自然に表示
- 可変フレームanimation clip
- 武器別VFX、SE、判定同期
- マシンガンを複数発砲・複数damageとして成立
- 単純な十字、線、×印を正式な武器軌道、衝撃、hit stop、敵反応へ置換

基準デザイン確認：

1. いくらちゃん
2. CRAWLER
3. 敵拠点

844×390／844×340の簡易実ゲームmockと共に提示し、正式統合前に確認する。待機中も画像非依存作業を継続する。

いくらちゃんはProducer Decisionsの成人、可愛さ、露出維持、世界観適合方針を厳守する。

### B6：event foundation

通常戦闘と共通部品から、戦闘中イベント、サイド任務、高難易度作戦、Challenge Mode、将来の期間イベントを登録可能にする。

0.7.5では大型イベント、新規大量アート、長尺ストーリーを制作せず、登録、表示、開始、終了、保存、復刻の差し込み口までとする。

### B7：mobile performance

0.7.1公開版と同一QA環境でbaselineを取得し、本実装前にIssue #44へbudgetを記録する。

第一目標：

- 通常戦闘median 50fps以上
- p95 frame time 33ms以下
- 15分でmedian frame time悪化10%以内
- memory指標増加25%以内
- 100ms超long taskが連続しない
- background中はsimulation、描画、不要audio更新停止
- 復帰後にgame loop、BGM、SE、voice二重化なし
- browser自動reload、進行消失、入力不能0

絶対値取得不能時は、同一環境before／after、frame time分布、long task、memory proxy、描画・AI更新回数を代替証拠とする。結果を見て説明なくbudgetを緩和しない。物理iPhone未使用なら発熱確認済みと断定しない。

### B8：save migration／integration QA

維持対象：stable unit／stage ID、所有、発見、調達、強化、編成、星、キャップ、解放、既読、設定、戦闘ボイス設定。

- migration前snapshot
- last-known-good
- localStorage／IndexedDB
- 片側破損、両側破損
- export／import
- 旧save自動初期化禁止

## 15. 音声契約

- ストーリー会話の全文読み上げ、フルボイスは実装しない
- 出撃、攻撃、被弾、戦闘不能の人間キャラクター戦闘ボイスを維持
- 武器音、身体反応音、敵ボイスを削除しない
- BGM、SE、voiceのbackground復帰後二重再生を防ぐ

## 16. 0.7.5 release candidateゲート

- Stage 1〜6通常導線
- Stage 5進行阻害0
- Stage 6ボス撃破、勝利、敗北、再挑戦、帰還
- 固定3レーンplayer-facing残存0
- CRAWLER出撃、敵自然spawn、支援配置
- event／formation画像見切れ0
- スプライト縮尺・接地
- 武器別演出、マシンガン連射
- 調達・強化
- generator／validator／実追加ドリル
- synthetic scale
- save migration
- PC、844×390、844×340、WebKit
- console error、page error、request failure、主要asset 404が0
- 全test、Lint、build、`git diff --check`、CI成功
- 独立read-onlyレビューHigh／Medium未解消0

release candidateを隔離URLまたは同等の安全な試遊経路へ出し、source SHA、変更概要、既知制約、デザイン3点、Stage 1〜6、AI、animation／VFX、調達・強化、性能、save移行を提示する。

ここで停止し、プロデューサー最終実プレイ受入を待つ。

## 17. 0.7.5正式リリース

最終実プレイ合格後の別承認を受けてのみ実行する。

1. final PRのbase、head、CI、mergeability再取得
2. Ready化
3. `main`へ通常merge
4. result SHA取得
5. `v0.7.5` annotated tag
6. GitHub Release
7. 明示的requestによるPages deployment
8. 正式URLのversion／release SHA確認
9. 匿名状態で主要導線確認
10. 公開後QA
11. `PROJECT_STATE.md`更新
12. Issue #44最終報告・completed close
13. branch cleanup

0.7.0、0.7.1のtag、Release、履歴を変更しない。

# 共通運用

## 18. 証拠と再開

各工程完了時に対象Issueへ一件の集約報告を残す。

- 工程名
- input base／開始SHA
- branch、commit SHA、PR
- 変更ファイル・module
- 対象test、全test、Lint、build、`git diff --check`
- browser QA
- 独立review
- 残存事項
- 次の正確な再開位置

使用上限、時間切れ、browser停止で中断する場合、未commit変更を破棄せず、完了工程、現在SHA、未完了項目、再開位置を記録する。

browser QA、Playwright、server、待機処理にtimeoutを設定する。同一検証が再度timeoutした場合は無限再試行せず、原因、代替証拠、影響範囲を記録する。

## 19. 停止条件

停止してプロデューサー確認を求めるのは次だけ。

1. いくらちゃん、CRAWLER、敵拠点の基準デザイン
2. 0.7.5 release candidate最終実プレイ
3. stable ID変更が不可避
4. saveを安全にmigrationできない
5. 固定製品判断変更が必要
6. repository設定、課金、secrets、外部契約、法務判断が必要
7. 大量削除、履歴破壊、force操作など不可逆変更が必要
8. 公開後の重大不具合
9. 必要なGitHub・ローカル権限がない

それ以外はCodexが技術判断して続行する。

## 20. 禁止

- `main`直接push
- force push、rebase、amend
- 既存tag移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- save自動初期化
- ライセンス不明素材の正式採用
- ChatGPT Sitesへのdeployment
- 未確認・失敗の成功報告
- 検証不能な巨大commit
- 0.7.5最終受入前の`main` merge、tag、Release、正式公開

## 21. Codexへ送る開始文

本書が`main`へ反映された後、Codexへ送る文章は次だけでよい。

> GitHubリポジトリ`SUSANO-OOO/Zombieee`の最新`main`を取得し、`docs/PRODUCER_DECISIONS_0.7.5.md`と`docs/EXECUTION_LOCK_0.7.5.md`を最上位正本、`docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`、Issue #43、Issue #44を補助正本として、一気通貫ミッションを開始してください。過去報告を信用せずGitHubとローカルの現在状態を再取得し、R0公開運用preflightから進めてください。0.7.1公開後は追加指示を待たず0.7.5 release candidateまで継続し、定められた停止条件以外では自律的に実装・検証・修正を続けてください。