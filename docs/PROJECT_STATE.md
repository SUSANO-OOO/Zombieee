# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-17

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- source：GitHub `main`のrelease SHA
- deployment：`.github/workflows/github-pages-release.yml`
- 公開成功条件：build、browser smoke、deploy、正式URLの公開後QA

公開中の正確なrelease SHAは、GitHub Pages workflow結果と公開HTMLの`github-pages-release`メタ情報を照合して確認する。

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

## 3. Version 0.7.0作業状態

- Issue：[Issue #37](https://github.com/SUSANO-OOO/Zombieee/issues/37)
- PR：[Draft PR #38](https://github.com/SUSANO-OOO/Zombieee/pull/38)
- branch：`feat/0.7.0-unit-collection`
- target schema：v5
- 実行方式：実装、画像承認、QA、正式公開まで同じ一気通貫ミッション

最上位文書：

1. `PRODUCER_DECISIONS_0.7.0.md`
2. `IMPLEMENTATION_DIRECTIVE_0.7.0.md`
3. Issue #37の実行タスク台帳

現在の正確な状態：

- 製品判断：ロック済み
- 公開権限：ゲート通過後のGitHub Pages公開までCodexへ委任済み
- 実行タスク：P0〜P7、R1〜R4へ分解済み
- 画像品質：一枚承認、identity lock、派生同一性、実ゲーム統合品質を固定済み
- ゲームコード実装：未開始
- 正式画像制作：未開始
- Stage 4〜6実装：未開始
- PR #38：文書、台本、運用、CI、GitHub Pages設定が中心

0.7.0の正式リリースまでは、feature branchの内容を公開済みまたは実装完了として扱わない。

## 4. Codexの最初の工程

1. リモート最新状態を取得
2. PR #38のbase、head、draft、mergeability、CIを確認
3. 最新`origin/main`をfeature branchへ通常merge
4. PR #39のSafari保存修正取込みを確認
5. baseline build、test、Lint、diff check
6. 現行Stage 1〜3のfresh save、既存save、音響、844×390、844×340を確認
7. 変更予定モジュールと既知不具合をPR #38へ記録

P0完了前に本実装へ入らない。

## 5. 0.7.0公開権限

公開前ゲート通過後、Codexへ次を委任する。

- PR Ready化
- PRを通した通常merge
- release SHAの確定
- `v0.7.0` annotated tag
- GitHub Release
- GitHub Pages deployment確認
- 正式URLでの公開後QA
- 物理iPhone Safari確認
- 成功後のIssue #37 close
- 公開後確認済みbranchの安全な削除

ChatGPT Sitesへのdeploymentは委任範囲に含めない。

## 6. 公開前阻害条件

- P0〜P7未完了
- R1〜R4のHighまたはMedium未解消
- 未承認画像がある
- identity lockまたは派生同一性が未確認
- 承認画像の実ゲーム統合品質が未確認
- build、test、Lint、diff check、CI失敗
- 欠落asset、参照切れ、console error
- save migration・破損復旧失敗
- 既存所有・進行消失
- 手動戦術UI・入力・状態が残る
- TAKUYA撃破後を含む敵素通り
- 表示とhitboxの不一致
- Stage 1〜6の進行不能
- ユニット役割の重複・無価値化
- コスト上限拡張による難度崩壊
- 844×390、844×340受入未完了
- WebKit iPhone相当profile、touch、safe area、回転受入未完了

物理iPhone Safariは正式URL公開後、Issue closeとbranch削除の前に必須確認する。重大不具合時は通常のrevert PRで復旧する。

## 7. 画像承認記録

- machine-readable manifest：`docs/ASSET_APPROVALS_0.7.0.json`
- 承認記録：Asset ID、revision、承認者、承認日時、承認コメント、commit、最終パス
- 人物基準アート承認後はidentity lock
- 派生画像は元の承認済み画像との比較証拠を必須とする
- 個別画像承認だけで実ゲーム統合を合格にしない

## 8. 公開後状態の更新

0.7.0公開後に次を記録する。

- merge result／release SHA
- annotated tag
- GitHub Release URL
- GitHub Pages workflow run
- 正式URL
- 公開HTMLのrelease SHA
- P0〜P7完了表
- R1〜R4レビュー結果
- 公開後QA
- 物理iPhone Safari結果
- rollbackの要否
- Issue #37・PR #38の最終状態
- branch cleanup

未完了工程を完了済みとして先書きしない。

## 9. 歴史的リリース

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

## 10. 復元

- `docs/RELEASE_BACKUP_RECOVERY.md`に従う
- 既存checkoutを上書きせず、新規cloneまたは隔離復元
- release SHAと`tag^{commit}`を照合
- bundle利用時はSHA-256、`bundle verify`、`bundle list-heads`を確認
- GitHub Pages再公開は正常なPRと`main` mergeで行う
- ChatGPT Sitesを復元経路として使用しない

## 11. 記録の所有元

- 製品判断：バージョン別プロデューサー決定台帳
- 実行順と権限：バージョン別実行ランブック
- 実行進捗：Issue #37
- 現在の公開状態：本書
- 実装・承認・QA・release証拠：PR #38
- 公開配布物：GitHub Release
- deployment：GitHub Actions／GitHub Pages
