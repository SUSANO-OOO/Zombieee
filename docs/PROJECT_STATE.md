# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-17

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- source：GitHub `main`のrelease SHA
- deployment：`.github/workflows/github-pages-release.yml`
- 公開成功条件：build、browser smoke、deploy、正式URLの公開後QA、匿名アクセス確認

公開中の正確なrelease SHAは、GitHub Pages workflow結果と公開HTMLの`github-pages-release`メタ情報を照合して確認する。

GitHub Actionsの成功だけでは、一般プレイヤーが匿名でアクセス可能とは断定しない。正式公開後、GitHubへログインしていない新規ブラウザ相当でURLを開き、HTTP成功、主要asset取得、fresh save開始を確認する。

ChatGPT Sitesは0.6.5以前の旧公開先である。

- 旧URL：`https://ashfall-outpost-defense.paopao9.chatgpt.site/`
- 0.7.0以降は更新、deployment、QA、正式判定に使用しない
- GitHub Pages切替後は正式URLとして案内しない
- 非公開化できない場合も旧履歴として凍結する

## 2. 現在のGitHub基準

確認時の`main`：`f4cf603e8e003c8fa14b2b7368700ed7a6501261`

- PR #39のSafari save永続化修正を含む
- save key：`nishijin-campaign-v1`
- 0.7.0開始前の公開schema：v4

`main`の現在値は作業開始時にGitHub APIまたは更新済みremote refで再取得する。この文書のSHAを永久に最新として扱わない。

## 3. Version 0.7.0候補

- Issue：[Issue #37](https://github.com/SUSANO-OOO/Zombieee/issues/37)
- PR：[Draft PR #38](https://github.com/SUSANO-OOO/Zombieee/pull/38)
- branch：`feat/0.7.0-unit-collection`
- target schema：v5
- 状態：実装・画像承認・QA・公開を同じミッションで進める候補

最上位文書：

1. `PRODUCER_DECISIONS_0.7.0.md`
2. `IMPLEMENTATION_DIRECTIVE_0.7.0.md`

0.7.0の正式リリースまでは、feature branchの内容を公開済みとして扱わない。

## 4. 0.7.0公開権限

Issue #37と0.7.0実行ランブックにより、公開前ゲート通過後の次の操作をCodexへ委任する。

- PR Ready化
- PRを通した通常merge
- release SHAの確定
- `v0.7.0` annotated tag
- GitHub Release
- GitHub Pages deployment確認
- 正式URLでの公開後QA
- 匿名ブラウザ相当での一般公開確認
- 物理iPhone Safari確認
- 成功後のIssue #37 close
- 公開後確認済みbranchの安全な削除

ChatGPT Sitesへのdeploymentは委任範囲に含めない。

## 5. 公開前阻害条件

- 未承認画像がある
- build、test、Lint、diff check、CI失敗
- 欠落asset、参照切れ、console error
- save migration・破損復旧失敗
- 既存所有・進行消失
- 手動戦術UI・入力・状態が残る
- TAKUYA撃破後を含む敵素通り
- 表示とhitboxの不一致
- Stage 1〜6の進行不能
- identity lockまたは実ゲーム視覚統合が未確認
- ユニット役割分離またはバランス実測が未完了
- 844×390、844×340受入未完了
- WebKit iPhone相当profile、touch、safe area、回転受入未完了
- 独立review HighまたはMedium未解消
- GitHub Pagesを一般プレイヤーへ公開可能かの事前確認が未実施

物理iPhone Safariは正式URL公開後、Issue closeとbranch削除の前に必須確認する。重大不具合時は通常のrevert PRで復旧する。

## 6. 公開後阻害条件

次のいずれかが成立しない場合、Issueを閉じず正式公開完了扱いにしない。

- GitHub Pages deployment success
- 正式URLのrelease SHAがmerge resultと一致
- GitHub未ログインの新規ブラウザ相当でHTTP成功
- 匿名状態でタイトル、主要asset、fresh save開始、Stage 1開始が可能
- fresh saveと既存saveの続行・再読込が可能
- 主要asset 404、console error 0
- 物理iPhone Safari確認完了

アクセス制限、404、認証要求などで一般プレイヤーが開けない場合は、公開成功と報告しない。Pages設定・repository plan・visibilityを確認し、解決できなければIssueをopenのまま停止理由を報告する。

## 7. 実装前品質契約

CodexはIssue #37を唯一の実行タスク台帳として使用し、P0〜P7とR1〜R4を順番に完了する。

- 各フェーズは入力、作業、出口証拠が揃うまで完了扱いにしない
- R1〜R4は独立read-onlyレビューを使用し、High／Medium未解消0を要求
- 画像は一枚ごとに明示承認
- 承認済み基準アートのidentity lockを派生画像へ維持
- 個別画像承認だけで合格にせず、844×390と844×340の実ゲーム統合証拠を必須化
- バランス目標帯は調整前に記録し、結果を見た後に無断変更しない
- 文書・CI・preview成功だけで0.7.0完成としない

## 8. Codex利用量と進行効率

品質を落とさず使用量を抑えるため、次を適用する。

- 開始時に読むのはプロデューサー決定台帳と実行ランブックの2点だけ
- Product Spec、Characters、Story、Scenario、Release文書は該当フェーズで必要な箇所だけ読む
- 完了済みフェーズの全文を、依存仕様が変わらない限り毎回読み直さない
- 旧Issueコメント・旧PRコメント・旧稿を探索対象にしない
- コード検索、差分、対象モジュールから入り、全repositoryの無目的な再読込を避ける
- フェーズ中は対象testを優先し、全test・build・browser matrixは出口ゲートでまとめて実行
- Issueのチェック更新と証拠コメントはフェーズ完了時に一件へ集約
- 状態変化のない進捗コメント、空commit、重複文書を作らない
- 複数エージェントへ同じ調査・同じファイル編集を重複依頼しない
- 画像は未承認の派生を先回り生成せず、一枚の承認結果を待つ
- browser、依存関係、生成物のcacheを安全に再利用できる場合は再利用
- 品質問題を後工程へ持ち越さず、見つけたフェーズ内で修正・再検証する

## 9. 公開後状態の更新

0.7.0公開後に次を記録する。

- merge result／release SHA
- annotated tag
- GitHub Release URL
- GitHub Pages workflow run
- 正式URL
- 公開HTMLのrelease SHA
- 匿名アクセス確認
- 公開後QA
- 物理iPhone Safari結果
- rollbackの要否
- Issue #37・PR #38の最終状態
- branch cleanup

未完了工程を完了済みとして先書きしない。

## 10. 歴史的リリース

### v0.5.0

- release SHA：`466cec62230e774ee4f25d31988906400412e228`
- annotated tag：`v0.5.0`
- GitHub Release：`https://github.com/SUSANO-OOO/Zombieee/releases/tag/v0.5.0`
- 当時の公開先：ChatGPT Sites v20

この情報は復元用の履歴であり、現在の正式公開経路を意味しない。

### v0.6.5基準

- merge SHA：`706dd0ffaa51346bd061b2b4e72b4ce033537771`
- Safari save修正後の`main`：`f4cf603e8e003c8fa14b2b7368700ed7a6501261`
- GitHub Pages workflowは`main` pushで自動公開する

正確な現在公開SHAはworkflowと正式URLで確認する。

## 11. 復元

- `docs/RELEASE_BACKUP_RECOVERY.md`に従う
- 既存checkoutを上書きせず、新規cloneまたは隔離復元
- release SHAと`tag^{commit}`を照合
- bundle利用時はSHA-256、`bundle verify`、`bundle list-heads`を確認
- GitHub Pages再公開は正常なPRと`main` mergeで行う
- ChatGPT Sitesを復元経路として使用しない

## 12. 記録の所有元

- 製品判断：バージョン別プロデューサー決定台帳
- 実行順と権限：バージョン別実行ランブック
- 現在の公開状態：本書
- 実装・承認・QAログ：対象Issue・PR
- 公開配布物：GitHub Release
- deployment：GitHub Actions／GitHub Pages
