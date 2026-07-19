# 西新世紀末物語 — Version 0.7.1／0.7.5 実行ランブック

更新日：2026-07-19  
状態：Stage 5先行hotfixから0.7.5 release candidateまでの実行正本

## 1. 最初に読むもの

開始時に読むのは次の2点だけ。

1. `docs/PRODUCER_DECISIONS_0.7.5.md`
2. 本書

実行台帳：

- Issue #43：`[0.7.1] Stage 5進行阻害hotfix`
- Issue #44：`[0.7.5] コンテンツ量産基盤・戦闘品質再構築`

詳細文書、既存コード、過去のIssue・PRは、該当フェーズで必要な箇所だけ読む。旧稿、過去の会話、古いロードマップが最上位正本と衝突する場合は採用しない。

文書、CI、preview、simulationだけでは完成としない。実ゲーム、save、スマートフォン、公開後QA、プロデューサー受入を必要なゲートで確認する。

## 2. リポジトリと公開先

- repository：`SUSANO-OOO/Zombieee`
- 正式branch：`main`
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 正式公開：GitHub Pages
- 旧公開先：ChatGPT Sites。新規deployment、QA、正式判定に使用しない
- save key：開始時に現行コードと公開版から再取得し、既存値を維持する

文書記載SHAを現在値として固定しない。開始時、PR操作直前、merge直前、tag作成直前、公開後にGitHubの最新状態を再取得する。

## 3. 一気通貫ミッションの構造

本ミッションは一つの統合依頼として実行できるが、成果物、Issue、PR、tag、Release、完了判定を分離する。

### 成果物A

Version 0.7.1：Stage 5進行阻害hotfix

- 実行台帳：Issue #43
- 専用feature branch
- 専用PR
- `v0.7.1` annotated tag
- GitHub Release
- GitHub Pages公開
- 公開後QA

### 成果物B

Version 0.7.5：コンテンツ量産基盤・戦闘品質再構築

- 実行台帳：Issue #44
- 0.7.1公開後の最新`main`から開始
- integration branchを使用
- 検証可能な工程単位のcommit・PR
- release candidateでプロデューサー最終受入まで進める
- 最終受入後の明示承認を受けて正式公開

0.7.1完了後、ユーザーの追加開始指示を待たず、Issue #44へ状態を引き継ぎ、0.7.5のP0から継続してよい。

## 4. Codexの裁量

`PRODUCER_DECISIONS_0.7.5.md`の固定判断と安全境界を維持する限り、Codexは次を確認なしで決定できる。

- 内部アーキテクチャ
- フォルダ、モジュール、ファイル分割
- JSON、TypeScript、YAML等のデータ形式
- schema、registry、loader、generator、validator
- AI、経路探索、衝突、描画、音響、VFXの方式
- レベル、Rank、併用等の強化方式
- 初期バランス数値と許容範囲内の調整
- animation clipの形式
- performance最適化方式
- migration内部方式
- テスト、seed、fixture、simulation、証拠形式
- 非依存タスクの並行順と工程内順序
- connector、`gh`、通常gitの安全な使い分け

停止して確認するのは次に限る。

- いくらちゃん、CRAWLER、敵拠点の基準デザイン3点
- 0.7.5 release candidate最終実プレイ受入
- stable ID変更が必要
- 既存saveを安全にmigrationできない
- 固定済み製品判断を変更する必要がある
- repository visibility、課金、secrets、外部契約、法務・ライセンス判断が必要
- 大量削除、履歴破壊、force操作など不可逆な変更が必要
- 公開後に重大不具合を検出

上記以外の技術的迷い、軽微なUI調整、不具合修正、内部構造変更では逐次質問せず、実装、検証、修正を継続する。

## 5. 使用量、再開、証拠

- Issue #43またはIssue #44を対象工程の唯一の実行台帳とする
- 完了済み工程を、依存変更がない限り最初から再調査しない
- コード検索、diff、対象moduleから入り、無目的な全repository再読込を避ける
- 対象testを先に実行し、全test・build・browser matrixは工程出口でまとめる
- 状態変化のないコメント、空commit、重複文書、重複調査を作らない
- 同じファイルを複数エージェントへ無調整で並行編集させない
- 安全な依存関係、browser、生成物cacheは再利用できる
- 品質問題は原則として発見工程内で修正し、未解消High／Mediumを後工程へ送らない

各工程完了時にIssueへ一件の集約報告を残す。

報告項目：

- 工程名
- 入力base／開始SHA
- 完了commit SHA
- 変更ファイル・モジュール
- 対象test／全test／Lint／build／diff check
- browser QA
- 独立review結果
- 残存事項
- 次の再開位置

使用上限、時間切れ、ブラウザ停止で中断する場合、未commit変更を破棄せず、完了済み工程、現在SHA、未完了項目、再開コマンドをIssueへ記録する。

ブラウザQA、Playwright、server、待機処理には明示的なtimeoutを設定する。同一検証が再度timeoutした場合は無限再試行せず、原因、代替証拠、影響範囲を記録する。

## 6. 共通安全境界

禁止：

- `main`への直接push
- force push
- 共有履歴のrebase・amend
- 既存tagの移動・上書き
- repository visibilityの変更
- 課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除、reset、上書き
- saveの自動初期化
- ライセンス不明素材の正式採用
- 未確認・失敗を成功として報告
- 検証不能な一つの巨大commit
- ChatGPT Sitesへの新規deployment

削除候補は、import、runtime、build、asset manifest、文書、test参照を検索し、対象test、全test、build、実ブラウザQAを通過した後にのみ削除できる。

重大な公開不具合は、直前のrelease SHAを確認し、通常のrevert PRで復旧する。`main`のforce巻き戻し、tag移動、Release履歴改変は禁止する。

# Part A — Version 0.7.1 Stage 5 hotfix

## A0. プレフライト

1. GitHubから現在のrepository visibility、`main` SHA、公開中release SHA、tag、Release、open PR、open Issueを再取得
2. ローカルbranch、HEAD、remote、未commit・未追跡・stage済み変更を確認
3. Issue #43本文と本書の一致を確認
4. 現行Stage 5のデータ、runtime、AI、勝敗条件、Stage 6解放、saveを特定
5. baselineとして全test、Lint、build、diff checkを実行
6. fresh save、既存save、Stage 4〜6導線、PC、844×390、844×340、WebKitの現状を記録

出口証拠：開始SHA、公開SHA、baseline、Stage 5再現、対象module、既存変更保護。

## A1. Stage 5再設計

固定判断：

- Stage 5 stable IDを変更しない
- 必須台車護衛を撤廃
- ホーム制圧・感染拠点破壊中心へ変更
- 台車は背景演出、戦闘後搬送、または失敗条件でない副目標に限定
- 報酬、星、既読、Stage 6解放、save互換を維持
- 0.7.5の大規模基盤変更を混在させない

Codexが決定すること：

- 具体的な敵構成
- 台車の残し方
- 目的文、UI表現
- 数値調整
- テスト方式

必須検証：

- 3種類以上の異なる編成でクリア
- 調達ユニットなしで本筋進行可能
- 特定ユニット必須0
- Stage 4クリア後にStage 5解放
- Stage 5クリア後にStage 6解放
- 敗北、再挑戦、撤退、再読込
- fresh save、既存save

## A2. 0.7.1 release gate

- 対象test成功
- 全test成功
- Lint成功
- production build成功
- `git diff --check`成功
- PC、844×390、844×340、WebKit成功
- console error、page error、request failure、主要asset 404が0
- 独立read-onlyレビューHigh／Medium未解消0
- PRのbase、head、CI、mergeabilityを操作直前に再取得

全ゲート通過後、Issue #43の承認範囲で次を連続実行できる。

1. Draft PRをReady化
2. `main`へ通常merge
3. result SHAを取得
4. `v0.7.1` annotated tag
5. GitHub Release
6. GitHub Pages公開
7. 正式URLのrelease SHA確認
8. 匿名状態でタイトル、fresh save、Stage 1開始、既存saveを確認
9. Stage 5／Stage 6進行を公開版で確認
10. Issue #43へ最終報告
11. completedでclose
12. 公開後確認済みbranchを安全に削除

# Part B — Version 0.7.5 本体

## B0. 0.7.5開始・正本・公開運用

0.7.1公開後の最新`main`から開始する。

作業：

1. Issue #44本文、本書、Producer Decisionsを確認
2. `integration/0.7.5`または同等の明確なintegration branchを作成
3. 現在の`PROJECT_STATE.md`を公開済み0.7.1と0.7.5開始状態へ更新
4. `PRODUCT_ROADMAP.md`を現在の50ステージ、30ユニット、1.0まで戦闘中心、Challenge Mode方向へ更新
5. GitHub Pages release／public QAのversion、release SHA、報告先Issueをrelease単位で指定できるよう汎用化
6. 0.7.0、0.7.1、Issue #37への固定依存を今後のrelease pathから除去
7. immutable release再公開能力は、安全で必要なら維持

過去のIssue、PR、tag、Release履歴は書き換えない。

出口証拠：正本所有関係、汎用release contract、文書とGitHub現状の一致。

## B1. リポジトリ監査と移行設計

監査対象：

- runtimeコード
- campaign／unit／enemy／mission／saveデータ
- UI
- asset manifest
- sprite／animation
- audio
- tests／QA evidence
- workflows
- docs

分類：

- 現在使用中
- 正本
- 互換用
- 自動生成物
- テスト専用
- 旧版
- 重複候補
- 未使用候補

設計条件：

- runtimeとcontentの責任分離
- stable IDと表示名の分離
- aliasとmigration維持
- 段階移行
- 既存ゲームを動かしたまま移す
- 旧構造の廃止条件を定義
- 全面書き直しを前提にしない

Codexは複数案を内部比較できるが、製品判断を変えない限り、最適案を自律採用して実装へ進める。

出口証拠：現状図、責任境界、移行順、リスク、rollback、旧構造廃止条件。

## B2. データ駆動・量産基盤

最低限の対象：

- units
- enemies
- stages
- missions
- waves／spawn
- maps／battle spaces
- difficulty
- rewards／unlock
- acquisition
- upgrades
- battle events
- side／challenge／future timed events
- assets／portraits／sprites／animation／VFX／audio
- save／migration

最低限の自動化：

- 新規コンテンツ雛形生成
- schema検証
- ID重複検出
- 参照切れ検出
- アセット不足検出
- 未使用候補検出
- balance simulation
- caps economy simulation
- save migration matrix
- synthetic scale test

合成データで100ユニット、100敵、100ステージ相当を検証する。実際のコンテンツを100件制作する必要はない。

出口証拠：generator実行例、validator結果、合成規模試験、既存content移行率、runtime広範囲編集不要の実例。

## B3. 戦場空間、配置、CRAWLER、敵拠点

製品要求：

- プレイヤー向け固定3レーン撤廃
- 連続した戦場
- 座標、距離、形状、範囲、視線による戦闘
- 支援物の設置予告、可否、理由、必要に応じた補正
- 一画面で戦況を把握できるスマートフォン構図
- キャラクター豆粒化を避ける

内部の経路ノード、navigation mesh、flow field、見えない移動帯は許可する。

CRAWLER：

- 明確な出入口
- 味方が実際の出口から出撃
- 縦線ワープ撤去
- ドア、照明、足音、走り出しを同期
- 本体と最小安全域以外へ支援物を置ける

敵拠点：

- 細く、視認しやすく、戦場を隠さない
- HP、破損、崩壊が理解できる
- 敵が後方、内部、画面外から自然に出現

基準デザイン3点の停止：

- いくらちゃん
- CRAWLER
- 敵拠点

3点は、基準案と844×390／844×340簡易モックをまとめて提示し、プロデューサー確認を待つ。画像非依存作業は継続する。

出口証拠：空間方式比較、配置QA、spawn QA、実ゲームモック、性能計測。

## B4. AI、標的、ミッション、Stage 1〜6移行

味方AIを役割プロファイル化する。

- 前衛
- 重装
- 遊撃
- 射撃
- 制圧
- 支援
- 工兵

敵AIを行動プロファイル化する。

- CRAWLER優先
- 最寄り味方
- 後衛
- 支援物
- 拠点防衛
- 突進
- 拘束
- 遠距離
- 汚染
- 範囲攻撃
- 召喚

必須：

- 接敵、適正距離、再索敵、迂回、詰まり解消
- 攻撃対象、投射物、ダメージ対象の一致
- CRAWLER危機への反応
- 特定ユニット必須0
- 複数の対応手段
- Stage 1〜6を新基盤へ移行
- Stage 5の0.7.1修正を回帰させない
- Stage 6の勝利、敗北、再挑戦、帰還を実プレイ

出口証拠：決定的AIテスト、seed反復、WebKit反復、Stage 1〜6実プレイ、編成差比較。

## B5. 人員管理、購入、強化、難易度、経済

画面：

- 所有一覧
- 調達
- 強化

固定：

- 購入と強化にキャップを使用
- 後半は育成と編成判断の双方が必要
- 最大強化、特定ユニット、過剰周回を本編必須にしない
- 後発ユニットに追いつき措置
- 購入・強化の誤選択で進行不能にしない
- stable IDで保存

Codexが決定：

- レベル、Rank、併用
- 最大値
- 価格曲線
- 節目能力
- キャップ収支
- respec／返還の必要性

ステージ情報：

- 推奨育成水準
- 主要脅威
- 敵特性
- 有効になりやすい能力
- 特殊ルール

固定正解編成や役割人数を表示しない。

出口証拠：経済simulation、進行不能検査、後発追いつき、複数編成・複数育成水準の実測。

## B6. キャラクター表示、縮尺、アニメーション、VFX

用途別表示：

- identity master
- event portrait
- formation card
- battle sprite
- 必要ならencyclopedia

crop、focus point、scale、anchor、safe areaを用途別に定義する。

必須：

- イベント全身押し込みによる見切れ0
- 編成カードの顔位置・余白・倍率統一
- タタラを含む自然な体格差
- 足元、頭頂、影、hitbox、選択判定の整合

animation clip：

- 可変フレーム数
- idle、move、wind-up、active、recovery、hit、incapacitated、death、専用行動
- フレーム時間、判定、投射物位置、SE、VFX、loop、接地、scale

武器プロファイル：

- 素手、鈍器、チェーンソー、拳銃、ライフル、狙撃銃、マシンガン、クロスボウ、設置武器、回復・支援

マシンガン：

- 構え、反動、銃口発光、連射音、弾道、薬莢、複数ダメージ、着弾、被弾反応を同期

近接：

- ×印などの仮図形を正式な武器軌道、衝撃、接触、ヒットストップへ置換

いくらちゃん：

- Producer Decisionsの露出維持方針を厳守
- 基準デザイン確認後、用途別cropと統合を進める

出口証拠：全用途ギャラリー、実ゲーム画面、frame／event同期test、武器別QA、スマートフォン比較。

## B7. イベント基盤

通常戦闘と共通の部品から次を登録できるようにする。

- 戦闘中イベント
- サイド任務
- 高難易度作戦
- Challenge Mode
- 将来の期間イベント

共通利用：units、enemies、maps、missions、waves、difficulty、battle events、rewards、formation、save。

0.7.5では大型イベント、新規大量アート、長尺ストーリーを制作しない。登録、表示、開始、終了、保存、復刻の差し込み口までとする。

出口証拠：最小fixtureイベント、常設／期間指定、終了／復刻、save互換。

## B8. スマートフォン性能

対象：

- 844×390
- 844×340
- WebKit iPhone相当
- PC回帰

計測：

- FPS／frame time
- 入力遅延
- AI更新回数
- 描画数
- particle／shot／damage text
- audio同時再生
- memory増加
- background／tab／lock復帰
- browser reload

最適化候補：

- 画面外描画停止
- object pooling
- particle再利用
- 不要なReact再描画削減
- AI更新頻度適正化
- 高DPI内部解像度上限
- effect品質調整
- audio多重制御
- background時更新停止
- memory解放

物理iPhone 14 Pro Max相当を利用可能なら10〜15分以上の連続戦闘と発熱傾向を確認する。利用不能なら温度確認済みと断定せず、代替計測を報告する。

出口証拠：before／after計測、長時間run、WebKit、物理端末または未確認明記。

## B9. save migrationと回帰

維持対象：

- stable unit／stage ID
- 所有
- 発見
- 調達
- 強化
- 編成プリセット
- 星
- キャップ
- 解放
- 既読イベント
- 設定
- 戦闘ボイス設定

必要ならschemaを更新する。

必須：

- migration前snapshot
- last-known-good
- localStorage／IndexedDB
- 片側破損、両側破損
- export／import
- 旧save自動初期化禁止

出口証拠：migration matrix、公開版save fixture、破損復旧、前後データdiff。

## B10. 統合QAとrelease candidate

必須：

- Stage 1〜6通常導線
- Stage 5進行阻害0
- Stage 6勝利、敗北、再挑戦
- 固定3レーンplayer-facing残存0
- CRAWLER出撃
- 敵自然出現
- 支援配置
- event／formation画像見切れ0
- スプライト縮尺・接地
- 武器種別演出
- マシンガン連射
- 調達・強化
- generator／validator
- synthetic scale
- save migration
- PC、844×390、844×340、WebKit
- console error、page error、request failure、主要asset 404が0
- 全test、Lint、build、diff check、CI
- 独立read-onlyレビューHigh／Medium未解消0

release candidateを隔離URLまたは同等の安全な試遊経路へ公開し、プロデューサーへ次を提示する。

- source SHA
- 変更概要
- 既知制約
- いくらちゃん、CRAWLER、敵拠点
- Stage 1〜6
- Stage 5／6
- 支援配置
- AI
- animation／VFX
- 調達・強化
- 性能結果
- save移行結果

ここで停止し、プロデューサーの最終実プレイ受入を待つ。

## B11. 0.7.5正式リリース

最終実プレイ合格後の明示承認を受けて、次を連続実行する。

1. PRのbase、head、CI、mergeability再取得
2. Draft PR Ready化
3. `main`への通常merge
4. result SHA取得
5. `v0.7.5` annotated tag
6. GitHub Release
7. GitHub Pages build、browser smoke、deploy
8. 正式URLのversion／release SHA確認
9. 匿名状態でタイトル、主要asset、fresh save、既存save、Stage 1開始を確認
10. 公開後QA
11. `PROJECT_STATE.md`更新
12. Issue #44最終報告
13. completedでclose
14. 公開後確認済みbranch cleanup

0.7.0、0.7.1のtag、Release、履歴を変更しない。
