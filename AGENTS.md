# 西新世紀末物語 — 開発運用ルール

更新日：2026-07-26

## 1. 適用範囲

本書は、このリポジトリで作業するCodex、ChatGPT、Claude Code、サブエージェント、レビュー担当に適用する恒久ルールである。

個別Versionの製品判断と実行手順は、対象Versionの正本を優先する。

### 現行Versionの参照順

1. 対象Versionの`docs/PRODUCER_DECISIONS_<version>.md`
2. 対象Versionの実行台帳Issue
3. 対象Versionに専用Execution Lock／Implementation Directiveがある場合はその順序
4. 本書
5. 最新`main`のコード、tests、QA記録
6. 工程別Issue、PR、実装・QA記録

Version 0.9.0では次を使用する。

1. `docs/PRODUCER_DECISIONS_0.9.0.md`
2. Issue #68
3. 本書
4. 最新`main`のコード、tests、QA記録

製品判断はProducer Decisions、実行台帳は対象Issue、恒久安全境界は本書が所有する。過去コメント、旧PR、旧ロードマップ、会話上の検討案が現行正本と衝突する場合は採用しない。

## 2. 正しい情報源

- 正式コード：GitHub `main`上のrelease SHA
- 作業中コード：指定feature／integration branch
- 正式公開版：GitHub Pagesで配信中のrelease SHA
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 現在状態：`docs/PROJECT_STATE.md`
- 長期方向：`docs/PRODUCT_ROADMAP.md`
- 公開・復元：`docs/RELEASE_BACKUP_RECOVERY.md`
- 実行ログ・承認・QA：対象IssueとPR
- 実環境固有挙動：最新の実ブラウザQA

作業開始時、PR操作直前、merge直前、tag作成直前、公開後にGitHubの現在値を再取得する。文書記載SHAや過去報告を永久に最新として扱わない。

ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、障害復旧に使用しない。

## 3. 役割

- プロデューサー：製品方向、固定判断、正式人物identity、画像採否、最終実プレイ受入
- ChatGPT：要件整理、GitHub正本整備、整合監査、Codex指示、結果評価
- Codex：調査、設計、実装、承認済み対象asset、test、QA、許可範囲のGitHub・release操作
- Claude Code：明示された限定範囲だけの一時代行
- サブエージェント：読み取り専用監査、限定調査、独立review

Codexは、固定済み製品判断と安全境界を守る限り、内部構造、data形式、algorithm、初期数値、test方式を自律決定する。技術方式の選択だけを理由に逐次質問しない。

## 4. 作業開始

開始時に最低限確認する。

- repository、remote、branch、HEAD
- `main`の最新SHA
- working treeと未追跡file
- open PR、対象Issue
- tag、GitHub Release、Actions
- 正式URLのrelease metadata
- push、PR、Issue、Release、Actions権限
- baseline test、Lint、build、`git diff --check`
- 対象Version正本と旧文書の衝突

既存未commit・未追跡変更を削除、reset、上書きしない。安全な別cloneまたは隔離worktreeを使用できる。

## 5. GitHub運用

- `main`はPR経由でのみ変更
- feature／integration branchへの通常pushのみ許可
- force push禁止
- 共有履歴のrebase・amend禁止
- PRのbase、head、CI、mergeabilityを操作直前に再取得
- merge後はhead SHAではなくmerge result SHAをrelease SHAとする
- tagとGitHub Releaseはrelease SHAへ固定
- 既存tagの移動・上書き禁止
- 状態変化のないcomment、空commit、重複文書を作らない
- 同じfileを複数agentで無調整に並行編集しない
- 旧Issueを削除・改変して現在の矛盾を隠さない
- 完了済み旧Issueをcloseする場合、後続実装・正本への移行先と完了根拠を最終commentへ残す

対象Versionでintegration branchが指定されている場合、工程branchをintegration向けPRとして段階統合できる。最終`integration/<version> → main`のReady化・mergeは、対象Version正本のrelease境界に従う。

Version 0.9.0では`integration/0.9.0`を使用し、release candidate最終実プレイ合格前に最終PRをReady化・`main` mergeしない。

## 6. 公開契約

正式deploymentは、明示的release requestまたは安全なmanual dispatchだけで実行する。

release requestは最低限次を持つ。

- `version`
- `release_ref`
- `release_sha`
- `issue_number`
- `request_id`

通常の`main` pushやdocs-only mergeで製品版を自動deploymentしない。PR段階のbuild、browser smoke、release contract検証は維持する。

`.github/pages-release-request.json`を状態文書の更新だけを理由に変更しない。変更によるdeployment triggerを理解せず触れない。

公開完了条件：

- production build成功
- static Pages build成功
- browser smoke成功
- Pages deploy成功
- 公開HTMLのversion／release SHAがrequestと一致
- 匿名browser相当で認証要求・404なし
- 主要asset取得成功
- fresh saveと既存saveの必須導線成功
- 対象Issueへの公開後QA記録

Actions成功だけで一般公開成功と断定しない。

## 7. 一気通貫ミッション

対象Issue、正本、公開先、停止条件、許可操作が明示されている場合、Codexは次を一つのミッションとして実行できる。

- 調査、設計、実装、対象文書・asset
- test、Lint、build、実browser QA
- 不具合修正と再検証
- 通常commit・通常push
- Draft PR作成・更新
- integration branchへの承認済み工程merge
- 独立read-only review
- 対象正本で承認済みのReady化、通常merge
- 対象正本で承認済みのannotated tag、GitHub Release
- 明示的requestによるPages deployment
- 公開後QA、Issue close、確認済みbranch cleanup

使用上限や時間切れで中断する場合は、完了工程、現在SHA、未完了項目、正確な再開位置を対象Issueへ記録する。依存変更がない完了工程を最初からやり直さない。

## 8. 画像・identity

- 個別Versionでidentity masterの提供者が指定された場合、その責任分界を優先する
- プロデューサー提供の人物identity masterを、Codexが独自生成した別人物で置き換えない
- portraitからcard、event、battle sprite等を派生する場合、顔、髪、体格、衣装、武器、傷、配色を同一人物として維持する
- 最初の1体で派生基準を確認するよう指定されている場合、基準確定前に残りを量産しない
- 画像確認待ち中も、画像非依存のfoundation、save、AI、data、test、performance作業を継続する
- 未提出画像を仮人物で埋めて完成扱いにしない
- ライセンス不明素材を正式採用しない

## 9. 音声

ストーリー会話の全文読み上げを実装しないことと、戦闘中character voiceを削除することを混同しない。出撃、攻撃、被弾、戦闘不能の人間character voice、weapon sound、enemy voiceは明示変更がない限り維持する。

新unitへ別人物のvoiceを流用しない。正式voiceが未用意の場合は、対象Version正本に従ってtext bark、weapon sound、無voiceの状態を明示し、別人物voiceで穴埋めしない。

## 10. Save・migration

- stable IDを維持する
- migration前snapshot、last-known-good、localStorage／IndexedDB、破損復旧、export／importを維持する
- migrationを複数回適用しない
- 星、報酬、解放、通貨、equipmentを同一receiptで二重取得させない
- save全体の自動初期化は禁止
- 個別Version正本が通貨残高等の限定的再編を明示承認している場合、その対象だけを一度限りのmigrationとして実施できる
- 限定再編でも所有unit、stage進行、星、既読、編成、設定等の非対象dataを消さない
- 破壊的migration内容はplayerへ明示する

## 11. テスト・QA

テスト本数だけで完成としない。実ゲームの成立を確認する。

最低基準：

- 対象test、全test、Lint、build、`git diff --check`
- content validator、generator、必要なbalance／economy simulation
- console error、page error、request failure、主要asset 404が0
- 1280×720、844×390、844×340
- Playwright WebKit iPhone相当
- touch、safe area、回転、tab・画面lock復帰
- BGM、SE、戦闘voice、二重再生なし
- fresh save、公開版由来既存save、migration、破損復旧
- 対象Versionの新機能を実ゲームで確認
- independent read-only review High／Medium未解消0

物理iPhoneを利用できない場合、発熱、実speaker聴感、物理端末操作を確認済みと断定しない。frame time、memory、WebKit結果を代替証拠として明記する。

## 12. 安全境界

禁止：

- `main`直接push
- force push、共有履歴rebase・amend
- 既存tag移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- save全体の自動初期化
- ライセンス不明素材の正式採用
- 未確認・失敗の成功報告
- 検証不能な巨大commit・巨大差分
- ChatGPT Sitesへの新規deployment
- 対象Versionの非対象機能を便乗実装

重大な公開不具合は、直前の正常release SHAを確認し、通常のrevert PRで復旧する。`main`のforce巻戻し、tag移動、Release履歴改変は禁止する。

## 13. 設計打ち切り

GitHub正本が承認済みで、開始前提に変化がない場合、同じ要件について新しい「最終計画書」を追加しない。実装を伴わない再監査、状態変化のない追加review、完了工程の無目的な再読込を禁止する。

計画を変更できるのは、プロデューサー判断の変更、実装・計測・QAで判明した重大事実、save・公開・法務・安全blockerがある場合だけとする。その場合も既存計画を全面再作成せず、対象Issueへ差分を記録する。
