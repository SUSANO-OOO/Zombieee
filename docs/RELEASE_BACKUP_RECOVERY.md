# リリース・バックアップ・復元手順

更新日：2026-07-17

## 1. 正式公開経路

唯一の正式公開先はGitHub Pages。

- repository：`SUSANO-OOO/Zombieee`
- branch：`main`
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- workflow：`.github/workflows/github-pages-release.yml`
- `main` pushでbuild、browser smoke、Pages deploymentを実行

ChatGPT Sitesは旧公開先。今後のdeployment、正式QA、障害切り分け、公開判定に使用しない。

## 2. リリース前ゲート

対象ミッションで明示された全ゲートを満たすまで、Ready化・merge・tag・Releaseへ進まない。

最低条件：

- PRのbase、head、mergeabilityを最新状態で再取得
- CI `Verify`成功
- build、test、Lint、diff check成功
- 未解決の重大・中程度レビュー0
- 未承認アセット0
- 欠落asset・参照切れ0
- save migrationと復旧テスト成功
- 指定されたスマートフォン受入成功
- 公開を阻害する既知不具合0

承認済みの具体的なPR、tag、Release名、公開権限は対応Issueと実行ランブックを正式所有元とする。

## 3. マージとリリース

1. PR番号、base、head、CI、mergeabilityを再照合。
2. 条件成立後にDraftをReady化。
3. PR経由で通常merge。`main`直接pushは禁止。
4. GitHub `main`とPR result SHAを再取得。
5. result SHAをrelease SHAとして固定。
6. annotated tagをrelease SHAへ作成。
7. `tag^{commit}`がrelease SHAと一致することを確認。
8. tagだけを通常push。
9. remote tagを再取得し、targetを確認。
10. 同じtag・release SHAでGitHub Releaseを作成。
11. `main` pushで起動したGitHub Pages workflowを確認。
12. build、browser smoke、deploy成功後、正式URLを確認。

既存tagの移動、上書き、削除は禁止。失敗時もforce操作を使わない。

## 4. GitHub Pages公開確認

公開成功には次が必要。

- workflow build：success
- browser smoke：success
- deploy：success
- Pagesが返したURLが正式URLと一致
- 公開HTMLのrelease SHAがrelease SHAと一致
- 主要assetのHTTP 404が0
- console errorが0
- fresh saveと既存saveの基本導線が動作

workflowの実行成功だけで、ゲーム公開成功と断定しない。

## 5. 公開後QA

対応Issueで定めた端末・導線を正式URL上で確認する。

最低限：

- タイトルとversion
- fresh save
- 既存save続行
- 主要画面遷移
- 全公開ステージ
- 再読込後の進行保持
- 音声有効化、BGM、SE
- 指定スマートフォンviewport
- console error 0
- 主要asset 404 0

完了後、IssueとGitHub Releaseへrelease SHA、tag、workflow run、正式URL、QA結果を記録する。

## 6. ロールバック

重大不具合時：

1. 対応Issueを再open。
2. 直前の正常release SHAとtagを確認。
3. 問題mergeを打ち消す通常のrevert PRを作成。
4. CIと必須QAを通す。
5. revert PRを通常merge。
6. GitHub Pages deployment成功を確認。
7. 正式URLで復旧確認。

禁止：

- force push
- `main`の巻き戻しpush
- tagの移動
- Releaseの履歴改変で問題を隠す

## 7. 正式bundle

必要なリリースでは、release SHAとannotated tagを基準にbundleを作成できる。

- clean mirror cloneまたはbare repositoryを入力元にする
- 日常checkoutで`--all`を使わない
- `refs/heads/main`と対象tagだけを明示
- `main`と`tag^{commit}`がrelease SHAに一致することを事前確認
- repository外の新規パスへ出力
- 既存bundleを上書きしない
- `git bundle verify`成功
- `git bundle list-heads`でmainとtagを確認
- SHA-256、サイズ、作成日時、release SHAを記録

例：

```bash
git bundle create <new-path>.bundle refs/heads/main refs/tags/vX.Y.Z
git bundle verify <new-path>.bundle
git bundle list-heads <new-path>.bundle
sha256sum <new-path>.bundle
```

同一PC内だけのbundleは独立バックアップではない。必要な場合は別デバイスまたは別の非公開保存先へ複製し、SHA-256を再照合する。

## 8. bundleからの復元

- 既存checkoutを上書きしない
- 新規ディレクトリへ隔離clone
- SHA-256、`bundle verify`、`bundle list-heads`を先に確認
- `main`と`tag^{commit}`を期待するrelease SHAと照合
- GitHubを別remoteとして追加し、読み取り比較
- 復元確認とGitHubへのpushを別操作として扱う
- dependencies、test、Lint、buildを再実行
- GitHub Pagesの再公開は正常なPRと`main` mergeで行う

## 9. 記録先

- 製品判断：対応するプロデューサー決定台帳
- 実行順・権限：対応する実行ランブック
- 現在のrelease SHA、tag、Release、GitHub Pages URL：`PROJECT_STATE.md`
- 実行ログ、QA、承認、障害：対応Issue・PR
- 公開配布物とrelease notes：GitHub Release
