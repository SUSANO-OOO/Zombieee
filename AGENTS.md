# 西新世紀末物語 — 開発運用ルール

更新日：2026-07-22

## 1. 適用範囲

本書は、このリポジトリで作業するCodex、ChatGPT、Claude Code、サブエージェント、レビュー担当に適用する恒久ルールである。

個別バージョンの製品判断と実行手順は、対象バージョンの正本を優先する。

Version 0.7.1／0.7.5の参照順：

1. `docs/PRODUCER_DECISIONS_0.7.5.md`
2. `docs/EXECUTION_LOCK_0.7.5.md`
3. `docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`
4. Issue #43またはIssue #44の最新本文・最新差分
5. 本書
6. 工程別の実装・QA記録

製品判断はProducer Decisions、実行順と権限はExecution Lock、詳細工程はImplementation Directiveが所有する。過去コメント、旧PR、旧ロードマップ、会話上の検討案が正本と矛盾する場合は採用しない。

## 2. 正しい情報源

- 正式コード：GitHub `main`上のrelease SHA
- 作業中コード：指定feature／integration branch
- 正式公開版：GitHub Pagesで配信中のrelease SHA
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 現在状態：`docs/PROJECT_STATE.md`
- 公開・復元：`docs/RELEASE_BACKUP_RECOVERY.md`
- 実行ログ・承認・QA：対象IssueとPR
- 実環境固有挙動：最新の実ブラウザQA

作業開始時、PR操作直前、merge直前、tag作成直前、公開後にGitHubの現在値を再取得する。文書記載SHAや過去報告を永久に最新として扱わない。

ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、障害復旧に使用しない。

## 3. 役割

- プロデューサー：製品方向、固定判断、画像採否、最終実プレイ受入
- ChatGPT：要件整理、GitHub正本整備、整合監査、Codex指示、結果評価
- Codex：調査、設計、実装、対象アセット、テスト、QA、承認済み範囲のGitHub・release操作
- Claude Code：明示された限定範囲だけの一時代行
- サブエージェント：読み取り専用監査、限定調査、独立レビュー

Codexは、固定済み製品判断と安全境界を守る限り、内部構造、データ形式、アルゴリズム、初期数値、テスト方式を自律決定する。技術方式の選択だけを理由に逐次質問しない。

## 4. 作業開始

開始時に最低限確認する。

- repository、remote、branch、HEAD
- `main`の最新SHA
- working treeと未追跡ファイル
- open PR、対象Issue
- tag、GitHub Release、Actions
- 正式URLのrelease metadata
- push、PR、Issue、Release、Actions権限
- baseline test、Lint、build、`git diff --check`

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
- 状態変化のないコメント、空commit、重複文書を作らない
- 同じファイルを複数エージェントで無調整に並行編集しない

Version 0.7.5では、工程branchを`integration/0.7.5`向けPRとして統合できる。`integration/0.7.5 → main`の最終PRは、release candidateのプロデューサー受入後までmergeしない。

## 6. 公開契約

正式deploymentは、明示的なrelease requestまたは安全なmanual dispatchだけで実行する。

release requestは最低限次を持つ。

- `version`
- `release_ref`
- `release_sha`
- `issue_number`
- `request_id`

通常の`main` pushやdocs-only mergeで製品版を自動deploymentしない。PR段階のbuild、browser smoke、release contract検証は維持する。

公開完了条件：

- production build成功
- static Pages build成功
- browser smoke成功
- Pages deploy成功
- 公開HTMLのversion／release SHAがrequestと一致
- 匿名ブラウザ相当で認証要求・404なし
- 主要asset取得成功
- fresh saveと既存saveの必須導線成功
- 対象Issueへの公開後QA記録

Actions成功だけで一般公開成功と断定しない。

## 7. 一気通貫ミッション

対象Issue、正本、公開先、停止条件、許可操作が明示されている場合、Codexは次を一つのミッションとして実行できる。

- 調査、設計、実装、対象文書・アセット
- test、Lint、build、実ブラウザQA
- 不具合修正と再検証
- 通常commit・通常push
- Draft PR作成・更新
- 独立read-onlyレビュー
- 承認済み範囲のReady化、通常merge
- annotated tag、GitHub Release
- 明示的requestによるPages deployment
- 公開後QA、Issue close、確認済みbranch cleanup

使用上限や時間切れで中断する場合は、完了工程、現在SHA、未完了項目、正確な再開位置を対象Issueへ記録する。依存変更がない完了工程を最初からやり直さない。

## 8. テスト・QA

テスト本数だけで完成としない。実ゲームの成立を確認する。

最低基準：

- 対象test、全test、Lint、build、`git diff --check`
- console error、page error、request failure、主要asset 404が0
- 1280×720、844×390、844×340
- Playwright WebKitのiPhone相当
- touch、safe area、回転、タブ・画面ロック復帰
- BGM、SE、戦闘ボイス、二重再生なし
- fresh save、既存save、migration、破損復旧
- 独立read-onlyレビューHigh／Medium未解消0

物理iPhoneを利用できない場合、発熱確認済みと断定しない。frame time、memory、WebKit結果を代替証拠として明記する。

## 9. 画像・音声

個別ミッションで基準デザイン確認が指定された場合、その画像だけは正式統合前に確認する。確認待ちの間も、画像非依存の基盤、save、AI、データ、テスト、性能作業は続行する。

ストーリー会話の全文読み上げを実装しないことと、戦闘中キャラクターボイスを削除することを混同しない。出撃、攻撃、被弾、戦闘不能の人間キャラクターボイス、武器音、敵ボイスは明示変更がない限り維持する。

## 10. 安全境界

禁止：

- `main`直接push
- force push、共有履歴rebase・amend
- 既存tag移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- saveの自動初期化
- ライセンス不明素材の正式採用
- 未確認・失敗の成功報告
- 検証不能な巨大commit・巨大差分
- ChatGPT Sitesへの新規deployment

重大な公開不具合は、直前の正常release SHAを確認し、通常のrevert PRで復旧する。`main`のforce巻戻し、tag移動、Release履歴改変は禁止する。

## 11. 設計打ち切り

GitHub正本が承認済みで、開始前提に変化がない場合、同じ要件について新しい「最終計画書」を追加しない。実装を伴わない再監査、状態変化のない追加レビュー、完了工程の無目的な再読込を禁止する。

計画を変更できるのは、プロデューサー判断の変更、実装・計測・QAで判明した重大事実、セーブ・公開・法務・安全blockerがある場合だけとする。その場合も既存計画を全面再作成せず、対象Issueへ差分を記録する。