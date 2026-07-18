# 西新世紀末物語 — 開発運用ルール

更新日：2026-07-17

## 1. 適用範囲と優先順位

この文書は、このリポジトリで作業するCodex、ChatGPT、サブエージェント、作業確認者に適用する恒久ルールである。

参照順：

1. 対象Issueまたはプロデューサー決定台帳の最新明示指示
2. 対象バージョンの実行ランブック
3. 本書
4. 工程別の詳細文書

個別ミッションが対象、権限、ゲート、公開先を明示している場合、その範囲で本書の通常停止地点を上書きできる。

相談、仮説、検討案は正式決定として扱わない。確定事項はGitHubの所有文書またはIssueへ記録する。

## 2. 正しい情報源

- 正式コード：GitHub `main`上のrelease SHA
- 作業中コード：指定feature branch
- 正式公開版：GitHub Pagesで稼働するrelease SHA
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 現在のrelease・公開状態：`docs/PROJECT_STATE.md`
- リリース・復元：`docs/RELEASE_BACKUP_RECOVERY.md`
- 個別判断・承認・実行ログ：対象Issue・PR
- 実環境固有挙動：対象環境で行った最新QA

ChatGPT Sitesは旧公開先であり、正式公開・QA・障害判定の情報源にしない。

`main`の現在値は、作業開始時にGitHub APIまたは更新済みremote refで確認する。古い文書記載SHAを現在値として扱わない。

## 3. 役割

- プロデューサー：製品方向、採否、固定判断、承認
- ChatGPT：企画、仕様整理、整合監査、Codex指示、結果評価
- Codex：調査、設計、実装、画像制作、テスト、QA、承認済み範囲のリリース作業
- サブエージェント：読み取り監査、限定調査、独立レビュー。権限拡張は不可

Codexは、技術的に同等な実装方法、構造、初期数値、テスト方法を自律決定できる。固定済みの製品判断を変更する場合だけ確認する。

## 4. ミッションの種類

### 4.1 実装ミッション

明示された範囲で次を連続実行できる。

- 調査、設計、実装、文書、対象アセット
- テスト、Lint、build、実ブラウザQA
- 問題修正と再検証
- 通常commit
- feature branchへの通常push
- Draft PR作成・更新
- Issue・PR報告

通常の停止地点は、リリース可能なDraft PRと検証報告。

### 4.2 一気通貫ミッション

プロデューサーが、対象PR、公開先、リリースゲート、許可操作を明示した場合、実装から正式公開までを一つのミッションとして実行できる。

ゲート通過後に許可される操作：

- Draft PRのReady化
- PRを通した`main`への通常merge
- result SHAの取得
- annotated tag
- GitHub Release
- GitHub Pages deployment確認
- 正式URLでの公開後QA
- Issue close
- 公開後確認済みfeature branchの安全な削除

途中でbase/head移動、CI失敗、未承認画像、公開阻害不具合が発生した場合は、その工程だけ停止する。解決可能な技術問題はfeature branch上で修正し、ゲートを再実行する。

## 5. 画像承認

個別ミッションで一枚承認制が指定された場合：

- 一度に一枚だけ提示
- 明示承認前に正式採用・派生制作・統合・次画像提示をしない
- 修正版は同Asset IDの新revision
- 却下画像を再利用しない
- 承認履歴をIssue・PR・manifestへ記録

画像承認待ちを理由に、save、AI、UI、ロジック、テストなど画像非依存作業を停止しない。

## 6. GitHub運用

- `main`はPR経由でのみ変更
- feature branchへの通常pushのみ許可
- force push禁止
- 共有履歴のrebase・amend禁止
- PRのbase、head、CI、mergeabilityを操作直前に再取得
- merge後はhead SHAではなくresult SHAをrelease SHAとする
- tag・Releaseはrelease SHAへ固定
- 既存tagの移動・上書き禁止
- 状態変化がない進捗コメントを連投しない
- 同じ変動値を複数文書へ複製せず、正式所有元へリンク

## 7. 公開

唯一の正式公開経路はGitHub Pages。

- `main` pushでGitHub Pages workflowを起動
- build、browser smoke、deployの全成功を確認
- 正式URL上のrelease SHAを確認
- 公開後QAを実施
- workflow成功だけで製品受入完了と断定しない

ChatGPT Sitesへのdeployment、保存、更新、QAを新規ミッションへ含めない。

## 8. スマートフォンQA

スマートフォン横画面を主対象とする。

最低確認：

- 844×390
- 844×340
- safe area
- ブラウザUI表示中
- タッチ領域
- 回転・画面ロック・タブ復帰
- BGM・SE開始と残留音
- save再読込
- console error・asset 404

PCは基本回帰を確認する。

個別ミッションで物理iPhoneがリリースゲートに指定された場合、完了証拠が揃うまで公開しない。

## 9. 安全原則

- 作業開始時にGit状態、対象Issue、対象ファイルを確認
- 既存未コミット変更を勝手に消さない
- 過去報告から現在状態を推測しない
- 必要以上の全面リファクタリングを先行しない
- プレイヤー体験単位で分割し、検証不能な巨大差分にしない
- ライセンス不明素材を追加しない
- secrets、認証、課金、本番データ、repository設定を暗黙に変更しない
- 未確認・失敗を成功扱いしない
- 複数エージェントが同じファイルを無調整で並行編集しない

## 10. ロールバック

重大な公開不具合は、直前release SHAを確認し、通常のrevert PRで復旧する。

禁止：

- `main`のforce巻き戻し
- tag移動
- Release履歴の改変による隠蔽

復旧後もGitHub Pages workflowと正式URLを再確認する。

## 11. 文書の所有関係

- `README.md`：作品入口、正式URL、セットアップ、文書案内
- `AGENTS.md`：恒久運用ルール
- `docs/PROJECT_STATE.md`：現在のrelease・公開状態
- `docs/RELEASE_BACKUP_RECOVERY.md`：公開、tag、Release、rollback、bundle
- バージョン別プロデューサー決定台帳：変更不可の製品判断
- バージョン別実行ランブック：工程、ゲート、権限
- Product Spec：システム詳細
- Characters：人物・内部ID
- Story／Scenario：物語詳細
- GitHub Issue・PR：実行ログ、承認、QA、完了報告
