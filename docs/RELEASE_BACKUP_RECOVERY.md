# リリース・バックアップ・復元手順

## 1. 役割と承認境界

この文書は、ASHFALL OUTPOSTの正式リリース、annotated tag、GitHub Release、ChatGPT Sites、Git bundle、オフデバイス保存、復元確認の手順を管理する。権限と二段階承認方式は[AGENTS.md](../AGENTS.md)、現在の版・SHA・Sites・bundleの実測値は[PROJECT_STATE.md](PROJECT_STATE.md)、個別作業の承認と結果は対応するGitHub Issueを正式な所有元とする。

この手順を読むだけでは、マージ、tag、Release、Sites公開、Issueクローズ、ブランチ削除、GitHub設定変更は許可されない。[AGENTS.md](../AGENTS.md)で定めるリリース承認、または対象操作を特定した専用の明示承認が必要である。

## 2. CIと保護設定候補

### 2.1 CI

- workflow名：`CI`
- job ID：`verify`
- job表示名：`Verify`
- required status check候補：`CI / Verify`
- トリガー：`main`向け`pull_request`、対象作業ブランチへの`push`、`workflow_dispatch`
- 実行：差分のwhitespace確認、`npm ci`、`npm run lint`、`npm test`
- `npm test`が本番ビルドを含むため、別の`npm run build`は実行しない
- 現在のコードでは独立typecheckが成功しないため、CIへ追加しない
- 権限：`contents: read`のみ。secrets、Sites公開、GitHubへの書き込みは行わない

required status checkへ登録する名前は、Draft PRの実runで表示されたcontextと完全一致することを確認する。推測した名前を先に登録しない。

### 2.2 Draft PRマージ後の保護設定候補

branch protectionまたはrepository rulesetを変更する場合は、専用の明示承認を得たうえで次を候補とする。

- `main`への変更はpull request必須
- 実測済みの`CI / Verify`をrequired status checkにし、最新baseとの一致を必須にする
- unresolved conversationがある場合はマージ禁止
- force pushとbranch deletionを禁止
- 管理者にも適用し、通常のbypassを設けない
- auto mergeは無効を維持
- 自動branch削除は無効を維持し、独立承認後に削除する
- update branchはstrict check運用と合わせて有効化を検討する
- 独立reviewerがいる場合は1 approvalとstale approval dismissalを候補にする。単独アカウント運用では自己ロックを避け、reviewer体制ができるまでapproval必須化を行わない
- merge履歴を単純化する場合はsquash mergeのみを候補にする。採否はプロデューサーが決定する
- 利用可能なら`v*` tagのupdateとdeletionを禁止するrulesetを別途検討する

非公開リポジトリのプラン制約で保護機能を利用できない場合は、公開化を回避策として自動採用しない。現在の制約と未設定項目を[PROJECT_STATE.md](PROJECT_STATE.md)へ記録し、運用規則とリリース前照合で補う。

## 3. リリース承認前の固定条件

リリース承認には、少なくとも次を含める。

- PR番号
- baseブランチとbase SHA
- headブランチとhead SHA
- merge方式
- tag名とRelease名
- Sites公開の有無
- bundle作成、Issueクローズ、ブランチ削除を行うか
- 各操作の停止条件

実行直前に、GitHub APIまたはGitHub画面でPR、base、head、CI、review、mergeabilityを再取得する。承認後にbaseまたはheadが移動した場合、CIが失敗または未完了の場合、未解決事項がある場合は停止し、条件を更新した再承認を待つ。

## 4. マージから正式リリースまで

1. 承認済みPRの番号、base、base SHA、head、head SHA、merge方式、CIを再照合する。
2. 承認に含まれる場合だけDraft PRをReadyにし、PR経由で通常マージする。`main`へ直接pushしない。
3. マージ後、GitHub `main`のリモートrefとPRのresult SHAを再取得する。
4. 以降のrelease SHAは、マージ前headではなく、確認したresult SHAに固定する。
5. release SHAを明示してannotated tagを作成する。
6. tagのdereference先がrelease SHAと一致することを確認してからtagだけを通常pushする。
7. remote tagがannotated tag objectであり、そのtag objectがrelease SHAのcommitを指すことをAPIで再確認する。
8. 同じtagとrelease SHAでGitHub Releaseを作成し、draft／prereleaseの意図、URL、公開結果を再取得する。
9. 承認に含まれる場合だけ、同じrelease SHAを基準にSites versionを保存・公開し、version番号、commit SHA、公開URL、deployment結果を確認する。
10. Release、Issue、[PROJECT_STATE.md](PROJECT_STATE.md)へ、release SHA、tag、Release、Sites version、検証結果、未確認事項を責務に応じて記録する。

annotated tagの例：

```powershell
$Tag = "vX.Y.Z"
$ReleaseSha = "<verified-result-sha>"
git tag -a $Tag $ReleaseSha -m "ASHFALL OUTPOST X.Y.Z"
if ($LASTEXITCODE -ne 0) { throw "tag creation failed" }
$TaggedSha = (git rev-parse "$Tag^{commit}").Trim()
if ($TaggedSha -ne $ReleaseSha) { throw "tag target mismatch" }
git push origin "refs/tags/$Tag"
if ($LASTEXITCODE -ne 0) { throw "tag push failed" }
```

既存tagの移動・上書き、既存Releaseの変更・削除は通常リリース操作に含めず、別の明示承認なしに行わない。

## 5. 正式bundleの作成

### 5.1 入力元と出力先

- 更新済みのfresh mirror cloneまたはclean bare repositoryを入力元にする
- 日常の作業checkoutで`--all`を使わない
- tagまたはrelease SHAを必須入力にする
- `refs/heads/main`とannotated tagのdereference先が同じrelease SHAであることを作成前に確認する
- 必要なrefだけを明示し、一時ref、worktree ref、古いローカルbranchを含めない
- 出力先はリポジトリ外の新規パスに限定し、既存ファイルを上書きしない

PowerShellでの例：

```powershell
$Tag = "vX.Y.Z"
$ReleaseSha = "<verified-release-sha>"
$BundlePath = "D:\Backups\Zombieee-vX.Y.Z-<short-sha>.bundle"

if (Test-Path -LiteralPath $BundlePath) { throw "bundle already exists" }
$MainSha = (git rev-parse refs/heads/main).Trim()
$TagSha = (git rev-parse "$Tag^{commit}").Trim()
if ($MainSha -ne $ReleaseSha -or $TagSha -ne $ReleaseSha) {
  throw "main or tag does not match release SHA"
}

git bundle create $BundlePath refs/heads/main "refs/tags/$Tag"
if ($LASTEXITCODE -ne 0) { throw "bundle creation failed" }
git bundle verify $BundlePath
if ($LASTEXITCODE -ne 0) { throw "bundle verification failed" }
git bundle list-heads $BundlePath
if ($LASTEXITCODE -ne 0) { throw "bundle ref listing failed" }
Get-FileHash -Algorithm SHA256 -LiteralPath $BundlePath
```

POSIX環境では、同じ事前照合と明示refを使ってbundleを作成し、`sha256sum <bundle-path>`でSHA-256を取得する。

### 5.2 成功条件

次がすべて揃うまで正式bundleを成功扱いしない。

- `git bundle create`が成功
- `git bundle verify`が成功
- `git bundle list-heads`で意図した`main`とtagが確認できる
- 復元確認で`main`と`tag^{commit}`がrelease SHAと一致
- SHA-256、ファイル名、サイズ、作成日時、release SHAを記録
- bundleや検証生成物がGitのstage対象に入っていない

## 6. オフデバイス保存

リポジトリ外にあるだけ、または同一PC内にあるだけのbundleは、ローカル復元スナップショットであって独立バックアップではない。外部ストレージまたは別の非公開保存先へ複製し、複製後のSHA-256を元の記録と再照合する。

bundleをGitHub Release assetへ置くかどうかは、リポジトリの非公開性、容量、アクセス権、保管先の独立性を評価して別途決定する。秘密情報をbundle名、Release本文、assetへ含めない。

## 7. bundleからの復元

復元は既存checkoutを上書きせず、新しいディレクトリで行う。

1. bundleコピーのSHA-256を記録値と照合する。
2. `git bundle verify <bundle-path>`と`git bundle list-heads <bundle-path>`を実行する。
3. `main`とtagが期待するrelease SHAで一致する正式bundleなら、`git clone --branch main <bundle-path> <new-directory>`で新規cloneする。不一致があるbundleは`--no-checkout`で隔離cloneし、tagから回収用branchを作る。
4. 復元先で`main`または回収用branchと`vX.Y.Z^{commit}`を期待するrelease SHAと照合する。暗黙の`HEAD`だけを証拠にしない。
5. 必要なbranchとtagを照合する。
6. bundle由来remoteを`bundle-source`などへrenameし、GitHubを別の`origin`として追加・fetchする。
7. GitHub `main`、tag、必要branchとの差異を読み取り確認する。GitHubへのpushは復元確認とは別操作であり、明示承認なしに行わない。
8. `npm ci`、Lint、test、必要な環境依存確認を行う。
9. [PROJECT_STATE.md](PROJECT_STATE.md)の公開版とSites復元用versionを照合する。Sitesの再公開は別の明示承認を必要とする。

監査でbundle内の`main`または`HEAD`がrelease SHAと一致しない場合は、通常の復元成功扱いにしない。新規復元先でannotated tagのdereference先とexact SHAを確認し、そのtagから回収用branchを明示作成してから再検証する。既存checkoutやGitHub `main`を上書きしない。

## 8. GitHub履歴とbundleの違い

- GitHubは正式な共同開発履歴、PR、Issue、review、Release、Actions、設定を管理する
- bundleは指定refのGit objectを保存する時点スナップショットであり、GitHubのPR、Issue、Release本文、Actionsログ、branch protection、rulesetを保存しない
- Sites versionとdeploymentはGit bundle外であり、version番号と基準SHAを別に記録する
- `.env`、token、credential、secrets、外部DB、外部サービス、課金状態、ライセンス証跡はGit履歴だけでは復元できない
- D1、R2、認証、外部保存先を導入した場合は、各サービス固有のbackup／export／restore手順を別途整備する

## 9. 記録先

- 恒久ルールと承認境界：[AGENTS.md](../AGENTS.md)
- 手順と保護設定候補：この文書
- 現在のrelease SHA、tag、Release、Sites、bundle、未確認事項：[PROJECT_STATE.md](PROJECT_STATE.md)
- 個別の承認、実行ログ、判断、完了要約：対応するGitHub Issue
- 公開配布物とrelease notes：GitHub Release
