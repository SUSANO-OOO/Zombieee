# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-17

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- source：GitHub `main`のrelease SHA
- deployment：`.github/workflows/github-pages-release.yml`
- 公開成功条件：build、browser smoke、deploy、公開後QA、匿名アクセス確認

公開中の正確なrelease SHAは、GitHub Pages workflow結果と公開HTMLの`github-pages-release`メタ情報を照合する。

GitHub Actions成功だけでは一般公開成功と断定しない。GitHub未ログインの新規ブラウザ相当で、認証要求なし、HTTP成功、主要asset取得、fresh save開始、Stage 1開始を確認する。

ChatGPT Sitesは0.6.5以前の旧公開先。

- 旧URL：`https://ashfall-outpost-defense.paopao9.chatgpt.site/`
- 0.7.0以降は更新、deployment、QA、正式判定に使用しない
- GitHub Pages切替後は正式URLとして案内しない
- 非公開化できない場合も旧履歴として凍結する

## 2. 現在のGitHub基準

確認時の`main`：`f4cf603e8e003c8fa14b2b7368700ed7a6501261`

- PR #39のSafari save永続化修正を含む
- save key：`nishijin-campaign-v1`
- 0.7.0開始前の公開schema：v4

`main`の現在値は作業開始時にGitHub APIまたは更新済みremote refで再取得する。このSHAを永久に最新として扱わない。

repository visibility：`private`。

privateのままGitHub Pagesを匿名公開できるかは、P0でPages API、repository plan、visibility、実際の匿名アクセス見込みを確認する。匿名公開できない場合、Codexはvisibilityを変更せず、Issue #37をopenのまま原因と安全な選択肢を報告する。

## 3. Version 0.7.0候補

- Issue：[Issue #37](https://github.com/SUSANO-OOO/Zombieee/issues/37)
- PR：[Draft PR #38](https://github.com/SUSANO-OOO/Zombieee/pull/38)
- branch：`feat/0.7.0-unit-collection`
- target schema：v5
- 状態：実装、画像承認、QA、正式公開を同じミッションで進める候補

最上位文書：

1. `PRODUCER_DECISIONS_0.7.0.md`
2. `IMPLEMENTATION_DIRECTIVE_0.7.0.md`

0.7.0の正式リリースまでは、feature branchの内容を公開済みとして扱わない。

## 4. Codexの権限と裁量

Issue #37と0.7.0正本により、Codexへ次を委任する。

- 調査、設計、実装、画像制作、テスト、修正
- 内部構造、アルゴリズム、テスト方式、許容範囲内の数値、限定refactorの自律決定
- feature branchへの通常commit・通常push
- 画像一枚ごとの承認依頼
- 段階reviewと修正
- 公開前ゲート通過後のPR Ready化
- PRを通した通常merge
- release SHA確定、`v0.7.0` annotated tag、GitHub Release
- GitHub Pages deployment確認
- 正式URLでの公開後QAと匿名アクセス確認
- 成功後のIssue #37 closeとbranch削除

確認が必要なのは、固定済み製品判断変更、許容範囲外の数値、一枚画像承認、visibility・課金・secrets・外部契約・法務、不可逆操作、匿名公開不能時に限る。

ChatGPT Sites deployment、force push、`main`直接push、repository visibility変更は委任しない。

## 5. 公開前阻害条件

- 未承認画像がある
- identity lockまたは実ゲーム統合品質が未確認
- build、test、Lint、diff check、CI失敗
- 欠落asset、参照切れ、console error
- save migration・破損復旧失敗
- 既存所有・進行消失
- 手動戦術UI・入力・stateが残る
- TAKUYA撃破後を含む敵素通り
- 表示とhitboxの不一致
- Stage 1〜6の進行不能
- ユニット役割分離またはbalance実測未完了
- 844×390、844×340、WebKit受入未完了
- 独立review HighまたはMedium未解消
- GitHub Pagesの匿名公開見込み未確認

## 6. 実機と代替ゲート

スマートフォン主対象の公開前必須確認：

- 844×390
- 844×340
- Playwright WebKitのiPhone相当profile
- touch、safe area、回転
- 画面ロック・復帰、タブ復帰
- 主要タップ領域、scroll、切れ、音響、save

物理iPhoneまたは実機クラウドが利用可能なら確認する。

利用不能な場合は、上記WebKit検証の全成功を正式代替ゲートとし、公開、Issue close、branch削除まで進めてよい。最終報告には物理実機未確認と代替証拠を明記する。

物理実機で重大不具合を確認した場合はIssueを閉じず、通常のrevert PRで復旧する。

## 7. 公開後阻害条件

次のいずれかが成立しない場合、Issueを閉じず正式公開完了扱いにしない。

- GitHub Pages deployment success
- 正式URLのrelease SHAがmerge resultと一致
- GitHub未ログインの新規ブラウザ相当で認証要求なし・HTTP成功
- 匿名状態でタイトル、主要asset、fresh save開始、Stage 1開始が可能
- fresh saveと既存saveの続行・再読込が可能
- 主要asset 404、console error 0
- 物理実機または定義済みWebKit代替ゲートの完了

アクセス制限、404、認証要求などで一般プレイヤーが開けない場合は公開成功と報告しない。private repositoryのvisibilityは変更せず、Pages設定・plan・visibilityの確認結果をIssueへ報告する。

## 8. 実装前品質契約

CodexはIssue #37を唯一のタスク台帳として、P0〜P7とR1〜R4を完了する。

- 各フェーズは入力、作業、出口証拠が揃うまで完了扱いにしない
- R1〜R4は独立read-onlyレビュー、High／Medium未解消0
- 画像は一枚ごとに明示承認
- 承認済み基準アートのidentity lockを派生へ維持
- 844×390と844×340の実ゲーム統合証拠を必須化
- balance目標帯は調整前に記録し、結果後に無断変更しない
- 文書、CI、preview成功だけで0.7.0完成としない

## 9. Codex利用量と進行効率

- 開始時に読むのはプロデューサー決定台帳と実行ランブックの2点
- 詳細文書は該当フェーズで必要な箇所だけ読む
- 完了済みフェーズを依存変更なしに再調査しない
- 旧Issue・PRコメント、旧稿を探索しない
- コード検索、diff、対象moduleから入り、無目的な全repository再読込を避ける
- フェーズ中は対象testを優先し、全suiteは出口ゲートで実行
- Issue更新と証拠コメントはフェーズ完了時に一件へ集約
- 状態変化のないコメント、空commit、重複文書、重複調査を作らない
- 画像は未承認派生を先回り生成しない
- 安全なcacheを再利用する
- 品質問題を発見フェーズ内で修正・再検証する

## 10. 公開後状態の更新

0.7.0公開後に次を記録する。

- merge result／release SHA
- annotated tag
- GitHub Release URL
- GitHub Pages workflow run
- 正式URLと公開HTMLのrelease SHA
- 匿名アクセス確認
- 公開後QA
- 物理iPhone・実機クラウド結果、またはWebKit代替証拠
- rollback要否
- Issue #37・PR #38の最終状態
- branch cleanup

未完了工程を完了済みとして先書きしない。

## 11. 歴史的リリース

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

## 12. 復元

- `docs/RELEASE_BACKUP_RECOVERY.md`に従う
- 既存checkoutを上書きせず、新規cloneまたは隔離復元
- release SHAと`tag^{commit}`を照合
- bundle利用時はSHA-256、`bundle verify`、`bundle list-heads`を確認
- GitHub Pages再公開は正常なPRと`main` mergeで行う
- ChatGPT Sitesを復元経路として使用しない

## 13. 記録の所有元

- 製品判断：プロデューサー決定台帳
- 実行順と権限：実行ランブック
- 現在の公開状態：本書
- 実装・承認・QAログ：Issue・PR
- 公開配布物：GitHub Release
- deployment：GitHub Actions／GitHub Pages
