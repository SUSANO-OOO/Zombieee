# 西新世紀末物語 — Version 0.7.1／0.7.5 技術実行ランブック

更新日：2026-07-22  
状態：**Execution Lock配下の技術工程正本**

## 1. 役割と参照順

本書は、`docs/EXECUTION_LOCK_0.7.5.md`で確定した実行順を、実装・検証工程へ落とす技術ランブックである。

参照順：

1. `docs/PRODUCER_DECISIONS_0.7.5.md`
2. `docs/EXECUTION_LOCK_0.7.5.md`
3. 本書
4. Issue #43またはIssue #44の最新本文・差分
5. `AGENTS.md`
6. 工程別の実装・QA記録

製品判断はProducer Decisions、実行順・権限・停止条件はExecution Lockが所有する。本書と上位正本が衝突する場合は上位正本を優先する。

Codexは開始時に上位2文書と対象Issueを先に読み、本書は該当工程の技術詳細として参照する。過去コメント、旧稿、古いSHAを現在値として採用しない。

## 2. 共通開始確認

作業開始時、重要操作直前、公開後に現在値を再取得する。

- repository、remote、branch、HEAD、working tree
- GitHub `main` SHA
- open PR、Issue #43、Issue #44
- tag、GitHub Release、Actions
- 正式URLのversion／release SHA metadata
- push、PR、Issue、Release、Actions権限
- Node・browser・画像処理等の利用可能性
- baseline test、Lint、production build、`git diff --check`

既存未commit・未追跡変更を削除、reset、上書きしない。必要なら安全な別cloneまたは隔離worktreeを使用する。

各browser、server、Playwright、待機処理へ明示timeoutを設定する。同一検証が再度timeoutした場合は無限再試行せず、原因、代替証拠、影響範囲を記録する。

# Part A — R0とVersion 0.7.1

## A0. R0公開運用preflight

### 目的

Stage 5／6のゲームコードへ触る前に、現行Pages運用をversion非依存の明示的release contractへ移行する。

### 調査

- `.github/workflows/github-pages-release.yml`
- `.github/workflows/github-pages-public-qa.yml`
- `.github/pages-release-request.json`
- Pages build type、permissions、environment
- `AGENTS.md`
- `docs/PROJECT_STATE.md`
- `docs/RELEASE_BACKUP_RECOVERY.md`
- build／smoke／public QA scriptsとtests

### 実装契約

release requestは最低限次を持つ。

- `version`
- `release_ref`
- `release_sha`
- `issue_number`
- `request_id`

必須：

- public QA内の固定`0.7.0`、Issue #37、固定SHA依存を撤廃
- 通常`main` push、docs-only mergeで製品版を自動deploymentしない
- 明示的release requestまたは安全なmanual dispatchだけで正式deployment
- PR段階のproduction build、static build、browser smoke、contract testを維持
- requestのversion／ref／SHA／Issue／request IDを検証
- 公開HTMLへversion／release SHA metadataを埋め込む
- public QAが同じrequest identityを使用
- 対象Issueへ成功・失敗を報告
- immutable release再deploymentを維持
- 既存tagを移動しない
- 恒久運用文書の衝突記述を同じops PRで整合

### 公開状態保全

- 正式URLの公開HTMLを匿名ブラウザ相当で確認
- Version 0.7.0正式release SHA `782c70351a8fe22ca4ca0daa926c31c83433653a`と一致しない場合、tag・Release・ゲームコードを変更せずimmutable v0.7.0を再deployment
- Actions成功だけで復旧済みと断定しない

### 出口ゲート

- ops専用branch、PR
- contract test、全test、Lint、build、`git diff --check`成功
- CI成功
- independent read-only review High／Medium未解消0
- 通常merge
- 正式URLのversion／release SHA一致
- 匿名アクセス、主要asset、console／page／request error 0
- Issue #43へ入力SHA、commit、PR、merge SHA、QA、次の再開位置を記録

R0完了後、追加承認を待たずA1へ進む。

## A1. Stage 5再設計

### 調査対象

- Stage 5 content定義
- maintenance cart runtime
- mission／victory／failure判定
- unit AIの護衛追従
- enemy spawn／waves
- Stage 6 unlock
- save、star、reward、read event
- balance simulationと実browser導線

### 固定要件

- Stage 5 stable ID維持
- 必須台車護衛を撤廃
- ホーム制圧・感染拠点破壊中心の通常戦闘へ変更
- 台車は背景演出、戦闘後搬送、または敗北条件ではない副目標に限定
- save、星、報酬、既読、Stage 6解放を維持
- 3種類以上の異なる編成で通常クリア可能
- 調達ユニット、特定ユニット、最大強化を必須にしない
- 0.7.5のレーン撤廃、AI全面刷新、育成、量産基盤、画像刷新を混在させない

### 必須test

- Stage 4クリアでStage 5解放
- Stage 5勝利でStage 6解放
- Stage 5勝利、敗北、再挑戦、撤退、再読込
- fresh save、公開版由来の既存save fixture
- 3種類以上の編成
- 調達ユニットなし
- reward／star／unlock二重適用0

## A2. Stage 6ボスHP504停止

### 再現と切り分け

- 公開版または同等baselineでHP504停止を再現
- UI表示値とauthoritative stateを比較
- damage計算
- target selection／hit判定
- invulnerability／damage immunity
- phase threshold／phase state
- objective sequence
- boss registry／entity replacement
- state reducer／simulation tick／React同期
- death／victory／reward／return transition

### 修正契約

- `504`という値だけを例外処理しない
- 根本原因を修正
- phase閾値が意図された仕様なら、正しいphase遷移・演出・再標的化後にdamage可能にする
- 複数のユニット・武器構成でHPが504未満、0へ到達
- death／victory／result／reward／map returnが一度だけ成立
- boss entity、objective、event、audioが重複しない

### 必須test

- deterministic unit test
- phase境界直前・直後
- overkill、DoT、範囲、連射、近接、支援damage
- victory、defeat、retry、withdraw、reload
- Stage 5から通常導線でStage 6へ進行
- 公開版で実際にボス撃破

## A3. Version 0.7.1統合QA

最低対象：

- 1280×720
- 844×390
- 844×340
- Chromium
- Playwright WebKit iPhone相当
- touch、safe area、回転、tab／lock復帰
- fresh save、既存save、再読込
- BGM、SE、戦闘ボイス、二重再生0
- console error、page error、request failure、主要asset 404が0
- 対象test、全test、Lint、build、`git diff --check`
- CI
- independent read-only review High／Medium未解消0

公開後QAでは正式URL上でStage 5をクリアし、Stage 6ボスを撃破し、結果画面、報酬、マップ帰還まで確認する。

## A4. Version 0.7.1正式リリース

全ゲート通過後、Issue #43の承認範囲で実行する。

1. PR base／head／CI／mergeability再取得
2. Ready化
3. 通常merge
4. merge result SHA取得
5. `v0.7.1` annotated tag
6. GitHub Release
7. 明示的release requestによるPages deployment
8. 正式URLのversion／release SHA確認
9. 匿名公開後QA
10. Issue #43最終報告・completed close
11. 確認済みbranch cleanup

その後、追加開始指示を待たず最新`main`からPart Bへ進む。

# Part B — Version 0.7.5

## B0. integration開始とリポジトリ監査

- `integration/0.7.5`作成
- runtime、content、UI、save、assets、animation、audio、tests、workflows、docsを監査
- 現在使用中、正本、互換用、自動生成、test専用、旧版、重複候補、未使用候補へ分類
- module責任、依存関係、移行順、risk、rollback、旧構造廃止条件を記録
- R0 release contractと0.7.1公開状態を確認し、同じ汎用化を再実装しない

出口証拠：現状図、責任境界、移行計画、rollback、旧構造削除条件。

## B1. content pipeline／generator／validator

対象：

- units、enemies、stages、missions、waves／spawn
- maps／battle spaces、difficulty、rewards／unlock
- acquisition、upgrades、battle events
- side／challenge／future timed events
- assets、portraits、sprites、animation、VFX、audio
- save／migration

必須：

- schema、registry、loader、generator、validator
- stable IDと表示名分離
- alias、migration維持
- ID重複、参照切れ、アセット不足、未使用候補検出
- balance、caps economy、save migration、synthetic scale test
- 100 units／100 enemies／100 stages相当の合成規模試験

実追加ドリル：

- productionへ配信しないfixtureでtest unit 1、enemy 1、stage 1をgeneratorから作成
- dry-runまたは同等の非破壊確認
- 同じ入力から同じ成果物
- 再実行不要差分0
- core runtimeへ対象固有コードを追加しない
- build、test、QA gallery成功
- fixture除去後のproduction差分0

## B2. battle space／placement／spawn

- player-facing固定3レーン撤廃
- contentの固定lane番号依存を撤廃
- 座標、距離、形状、範囲、視線による戦闘
- placement preview、可否、理由、nearest valid position補正
- smartphone一画面で戦況把握
- character豆粒化回避
- CRAWLERの出入口、door、lighting、footstep、run-outを同期
- CRAWLER本体と最小安全域以外へ支援物を配置可能
- enemy baseを細く視認しやすくし、damage／破損／崩壊を表示
- enemyはbase後方、内部、画面外から自然spawn

内部経路ノード、navigation mesh、flow field、steering、見えない移動帯は許可する。

出口証拠：方式比較、placement QA、spawn QA、実game mock、performance計測。

## B3. AI／missions／Stage 1〜6

味方profile例：frontline、heavy、skirmisher、marksman、suppression、support、engineer。

敵profile例：CRAWLER priority、nearest unit、backline、support object、base defense、charge、grab、ranged、contamination、area、summon。

必須：

- contact、preferred range、retarget、reroute、stuck recovery
- attack target、projectile、damage target一致
- CRAWLER危機への反応
- 主要脅威へ複数の対応方法
- 特定ユニット必須0
- Stage 1〜6新基盤移行
- 0.7.1 Stage 5／6修正を回帰させない
- Stage 6 victory、defeat、retry、returnを実browser確認

出口証拠：deterministic AI tests、seed反復、WebKit反復、Stage 1〜6実プレイ、編成差比較。

## B4. progression／economy／UI

画面：owned roster、acquisition、upgrade。

minimum viable progression vertical slice：

- 全11ユニットが共通基盤から強化可能
- キャップ消費
- 数段階の成長
- 役割を壊さない少数の節目効果
- 後発ユニット追いつき
- stable ID保存、migration
- 誤投資で本編進行不能にしない
- 最大強化、特定ユニット、過剰周回を本編必須にしない
- 育成だけで押し切れず編成判断も必要

Codexが決定：level／rank／併用、段階数、価格曲線、節目効果、caps収支。

対象外：大規模skill tree、多数の固有能力、装備在庫、rarity、gacha、覚醒、限界突破、複雑なrespec。

出口証拠：economy simulation、進行不能検査、後発追いつき、複数編成・育成水準の実測。

## B5. portraits／scale／animation／VFX

用途別profile：identity master、event portrait、formation card、battle sprite、必要ならencyclopedia。

- crop、focus point、scale、anchor、safe area
- event全身押し込みによる見切れ0
- formation cardの顔位置、余白、倍率統一
- 足元、頭頂、体格、武器、影、hitbox、selection一致
- 小柄、標準、大柄、重装の自然な差
- タタラを大柄として自然に表示

animation clip：可変frame数、idle、move、wind-up、active、recovery、hit、incapacitated、death、special。

clip data：frame duration、loop、hit event、projectile origin、weapon tip、SE、VFX、movement、recovery、direction、ground anchor、body scale。

weapon profile：unarmed、blunt、chainsaw、handgun、rifle、sniper、machine gun、crossbow、deployable、heal／support。

- machine gunは反動、muzzle flash、連射音、trajectory、case、複数damage、impact、hit reactionを同期
- 単純な十字、線、×印を正式なweapon trail、impact、contact、hit stop、enemy reactionへ置換

基準デザイン確認：いくらちゃん、CRAWLER、敵拠点。844×390／844×340の簡易実game mockと共に提示する。待機中も画像非依存作業を継続する。

出口証拠：用途別gallery、実game screen、frame／event同期test、weapon QA、smartphone比較。

## B6. event foundation

通常戦闘と共通部品から次を登録可能にする。

- battle event
- side mission
- high-difficulty operation
- Challenge Mode
- future timed event

0.7.5では大型イベント、新規大量アート、長尺storyを制作しない。registration、display、start、end、save、rerun／revivalの入口までを対象とする。

出口証拠：minimal fixture event、permanent／timed、end／rerun、save互換。

## B7. mobile performance

0.7.1公開版と同一QA環境でbaselineを取得し、本実装前にIssue #44へbudgetを記録する。

第一目標：

- median 50fps以上
- p95 frame time 33ms以下
- 15分でmedian frame time悪化10%以内
- memory指標増加25%以内
- 100ms超long taskが連続しない
- background中simulation、render、不要audio更新停止
- 復帰後game loop、BGM、SE、voice二重化0
- browser auto reload、進行消失、入力不能0

絶対値取得不能時は、同一環境before／after、frame time分布、long task、memory proxy、render／AI更新数を代替証拠とする。結果を見て説明なくbudgetを緩和しない。物理iPhone未使用なら発熱確認済みと断定しない。

## B8. save migration／integration QA

維持：stable unit／stage ID、owned、discovered、acquisition、upgrade、formation、stars、caps、unlock、read events、settings、battle voice settings。

必須：

- migration前snapshot
- last-known-good
- localStorage／IndexedDB独立検証
- 片側破損、両側破損
- export／import
- 旧save自動初期化禁止
- 表示名、画像、crop、animation、class変更だけでsaveを壊さない

音声：story全文読み上げ／full voiceは実装しない。人間キャラクターの出撃、攻撃、被弾、戦闘不能voice、weapon sound、body reaction、enemy voiceを維持する。

## B9. release candidate統合QA

- Stage 1〜6通常導線
- Stage 5進行阻害0
- Stage 6ボス撃破、victory、defeat、retry、return
- fixed 3-lane player-facing残存0
- CRAWLER出撃、enemy自然spawn、support placement
- event／formation画像見切れ0
- sprite scale／grounding
- weapon-specific VFX、machine-gun burst
- acquisition／upgrade
- generator／validator／実追加ドリル
- synthetic scale、save migration
- 1280×720、844×390、844×340、WebKit
- console error、page error、request failure、主要asset 404が0
- 全test、Lint、build、`git diff --check`、CI
- independent review High／Medium未解消0

隔離URLまたは同等の安全な試遊経路へrelease candidateを出し、source SHA、変更概要、既知制約、デザイン3点、Stage 1〜6、AI、animation／VFX、progression、performance、save移行を提示する。

ここで停止し、プロデューサー最終実プレイ受入を待つ。

## B10. 正式リリース

最終実プレイ合格後の別承認を受けてのみ実行する。

1. final PR base／head／CI／mergeability再取得
2. Ready化
3. `main`へ通常merge
4. result SHA取得
5. `v0.7.5` annotated tag
6. GitHub Release
7. 明示的release requestによるPages deployment
8. 正式URLのversion／release SHA確認
9. 匿名公開後QA
10. `PROJECT_STATE.md`更新
11. Issue #44最終報告・completed close
12. branch cleanup

0.7.0、0.7.1のtag、Release、履歴を変更しない。

# 共通証拠・レビュー

## 3層レビュー

各主要工程で次を分離する。

1. 実装者self-check
2. independent read-only review
3. browser／simulation／save evidence

High／Medium未解消を次工程やreleaseへ送らない。

## Issue報告

各工程完了時に対象Issueへ一件に集約する。

- 工程名
- input base／開始SHA
- branch、commit、PR、merge SHA
- 変更module
- 対象test、全test、Lint、build、`git diff --check`
- browser QA
- independent review
- remaining work
- exact next action

使用上限・時間切れで停止する場合、未commit変更を破棄せず、現在SHAと正確な再開地点を記録する。
