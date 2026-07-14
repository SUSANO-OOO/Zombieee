# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-14

## 1. この文書の読み方

この文書は、公開版、正式リリース、開発状態、検証記録、未完了作業、復元時の照合事項など、継続的な照合に必要な事実を管理する。

- 恒久的な運用規則：[AGENTS.md](../AGENTS.md)
- 作品意図と承認済みゲーム仕様：[CHATGPT_HANDOFF.md](CHATGPT_HANDOFF.md)
- 0.6.0の候補仕様と検証境界：[PRODUCT_SPEC_0.6.0.md](PRODUCT_SPEC_0.6.0.md)
- 実装順と依存関係：[PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md)
- リリース・バックアップ・復元手順：[RELEASE_BACKUP_RECOVERY.md](RELEASE_BACKUP_RECOVERY.md)
- セットアップと実行コマンド：[README.md](../README.md)
- 個別タスクの議論・判断・報告：対応するGitHub Issue

GitHub `main`の現在のHEADはリモートrefで都度確認する。この文書に記録するSHAは、正式リリース、公開、検証、個別工程などを復元するための固定基準であり、変動する`main`の最新値を追記し続けるためのものではない。

## 2. 0.5.0正式リリースと公開状態

- 0.5.0正式製品受入：完了
- 0.5.0固定復元基準SHA：`466cec62230e774ee4f25d31988906400412e228`
- GitHub `main`：0.6.0実装ミッション開始時は`d7b7cbe1adc42b53e2e286e7654eaab3d196a83c`。0.5.0固定復元基準とは分離する
- annotated tag：`v0.5.0`
- tagのdereference先：上記SHA
- GitHub Release：[v0.5.0](https://github.com/SUSANO-OOO/Zombieee/releases/tag/v0.5.0)
- Release状態：公開済み、非Draft、非prerelease、targetは上記SHA
- 公開URL：https://ashfall-outpost-defense.paopao9.chatgpt.site/
- Sites project状態：active
- ChatGPT Sites version：20
- Sites v20のsource commit：上記SHA
- Issue #19：completed・closed
- PR #21：merged・closed
- PR #22：merged・closed

GitHubへのpush、`main`へのマージ、GitHub Release、ChatGPT Sites公開は別の状態である。正式受入では、各状態と同じ固定復元基準SHAを照合済みである。

## 3. 0.5.0ローカルbundle

- パス：`C:\Users\okait\Documents\Codex\2026-07-11\Zombieee-v0.5.0-466cec62230e.bundle`
- サイズ：26,922,356 bytes
- SHA-256：`fbbf5af79180353391336fe5bbf09ee99cab0e056ce1846a5e8476580704161f`
- `git bundle verify`：成功
- verify結果：complete history、bundle is okay
- `v0.5.0`：bundle内に存在し、dereference先は0.5.0固定復元基準SHA
- `refs/remotes/origin/main`：bundle内で0.5.0固定復元基準SHA

このbundleは復元可能だが、ref監査で次の不整合を確認した。

- bundle内`refs/heads/main`：`56caa295f87d3d62cf3220e168a0f0476c2e76ee`
- bundle内`HEAD`：`b8a1a19acfcafab17c3949121672357a98f950a4`
- どちらも0.5.0固定復元基準SHAの祖先だが、clone後の暗黙の`main`または`HEAD`を0.5.0基準として使用できない

一時ディレクトリへの実地cloneでは、`fix/0.5.0-enemy-gate-spawn`が`HEAD`として選択され、ローカル`main`は作成されず、`origin/main`は`56caa295f87d3d62cf3220e168a0f0476c2e76ee`になった。一方、`v0.5.0^{commit}`から作成した回収用branchは0.5.0固定復元基準SHAと一致した。検証用cloneは照合後に削除し、リポジトリへ残していない。

復元時は、まずSHA-256、`git bundle verify`、`git bundle list-heads`を確認し、`v0.5.0^{commit}`とexact SHAを0.5.0基準にする。新しい復元先でtagから回収用branchを明示作成し、既存checkoutやGitHubを上書きしない。詳細は[RELEASE_BACKUP_RECOVERY.md](RELEASE_BACKUP_RECOVERY.md)に従う。

このbundleはリポジトリ外にあるが同一PC上のローカル復元スナップショットである。オフデバイスの独立バックアップへの複製は未確認であり、GitHub Release assetにもbundleは存在しない。

## 4. 0.6.0アーリーアクセス基盤の候補状態

- 親Issue：[Issue #29](https://github.com/SUSANO-OOO/Zombieee/issues/29)
- 実装ミッションの固定base SHA：`d7b7cbe1adc42b53e2e286e7654eaab3d196a83c`
- 作業branch：`feat/0.6.0-early-access-foundation`
- 状態：featureブランチ上の候補。`main`、tag、Release、Sites公開版には未反映
- 正式名称：`西新世紀末物語`。`アーリーアクセス版`は補助表記
- 0.5.0以前の旧名称、Release、Sites v20、既存公開URLは履歴・現行公開状態として維持

候補コードには、場所を識別できる3ステージのキャンペーン、画面遷移、イベント基盤、初期4人・進行解放2人、星・報酬・解放の一度限り適用、開始・続行・確認付き初期化、schema version 2のローカルセーブ、約25%の戦場拡張、標的制約、敵死亡・灰化、非数値表現の味方感染・汎用ゾンビ化・火炎焼却、日本語主体の主要表示、iPhone Safariのvisual viewport・safe area対応が含まれる。数値、候補方式、暫定表現、実ブラウザの検証基準は[PRODUCT_SPEC_0.6.0.md](PRODUCT_SPEC_0.6.0.md)を参照する。

パイセンの元素材は`public/brawler-sprites-v1.png`であり、Git blob SHA、SHA-256、寸法、worktree外バックアップの照合記録はIssue #29を正式所有元とする。repository内へバックアップコピーを追加せず、候補実装は元素材を変更しない。

この節は機能の候補範囲を示すものであり、自動テスト、CI、実ブラウザQA、独立レビュー、Draft PR、製品受入の完了証拠ではない。成立した結果はIssue #29と対象Draft PRへ記録し、公開状態は実際のリリース・Sites操作後にだけ更新する。

## 5. Codex自走運用基盤の記録方針

- Codex自走運用基盤の導入に関する履歴と判断記録は、[Issue #26](https://github.com/SUSANO-OOO/Zombieee/issues/26)と[PR #27](https://github.com/SUSANO-OOO/Zombieee/pull/27)を正式所有元とする。
- PR #27は0.6.0実装ミッション開始前にmerged・closed、Issue #28はcompleted・closedであることを確認済み。詳細なresult SHAとcheck結果はGitHub上の記録を参照する。
- PR #27で、[AGENTS.md](../AGENTS.md)の二段階承認方式、GitHub Actions CI、[RELEASE_BACKUP_RECOVERY.md](RELEASE_BACKUP_RECOVERY.md)のリリース・バックアップ・復元手順を導入した。
- CIの実装は[ci.yml](../.github/workflows/ci.yml)、required status checkの確認手順は[RELEASE_BACKUP_RECOVERY.md](RELEASE_BACKUP_RECOVERY.md)を参照し、現在のrun結果はGitHubから確認する。
- branch protection／repository rulesetの変更はPR #27へ含めず、対象と操作を特定した別の専用承認で扱う。
- ゲーム名変更、Combat Polish、Audioは、それぞれ[Issue #25](https://github.com/SUSANO-OOO/Zombieee/issues/25)、[Issue #23](https://github.com/SUSANO-OOO/Zombieee/issues/23)、[Issue #24](https://github.com/SUSANO-OOO/Zombieee/issues/24)の範囲であり、PR #27には含めていない。

## 6. GitHub保護・merge設定の監査結果

2026-07-14の読み取り監査結果：

- `main`：`protected: false`
- legacy branch protection rule：0件
- required pull request、required status checks、conversation resolution、stale approval dismissal、admin enforcement：未設定
- direct push、force push、branch deletionを保護設定で禁止する構成：未設定
- repository管理権限：確認済み
- repository ruleset一覧：権限不足ではなく、非公開リポジトリの現在プラン制約によりAPIが403。休止中rulesetの有無は確認不能
- `main`に適用中の保護：なし
- merge commit、squash merge、rebase merge：すべて有効
- auto merge：無効
- update branch：無効
- merge後の自動branch削除：無効

保護設定は変更していない。マージ後の推奨候補と、単独アカウント運用でapproval必須化すると自己ロックする注意点は[RELEASE_BACKUP_RECOVERY.md](RELEASE_BACKUP_RECOVERY.md)に記録する。

## 7. 未実装・後続Issue

- [Issue #23](https://github.com/SUSANO-OOO/Zombieee/issues/23) Combat Polish：open。0.6.0関連の標的・射程・死亡表現はIssue #29の候補範囲に含むが、Issue #23全体の完了を意味しない
- [Issue #24](https://github.com/SUSANO-OOO/Zombieee/issues/24) Audio：open・未実装
- [Issue #25](https://github.com/SUSANO-OOO/Zombieee/issues/25) Branding：open。正式名称`西新世紀末物語`は0.6.0候補へ反映するが、公開版0.5.0の表示は変更しない
- 戦闘品質の後続改善：Issue #29の候補範囲外は未実装
- 正式BGM・正式SE素材と端末聴感QA：未実装

0.5.0までの履歴と現行公開表示では、ゲーム名をASHFALL OUTPOSTとして維持する。0.6.0候補の正式名称表示と、現在公開中の表示を混同しない。

## 8. 検証記録の扱い

0.5.0の実装、PC横画面、844×390、タッチ相当、ゲーム進行、音声制御、console、性能、Sites公開、最終受入の詳細はIssue #19、PR #21、PR #22、Release v0.5.0の記録を参照する。

Codex自走運用基盤の変更候補は文書・CI中心であり、ゲームコード、画像、ゲーム仕様テストを変更しない。ローカル検証、Actions結果、独立レビューはIssue #26とPR #27へ記録し、ゲームプレイ確認を行っていない場合は未実施と明記する。

0.6.0候補は、PC 1280×720以上、844×390、Safari UI表示相当の低いvisual viewport、回転直後、Safari UI表示・縮小の両状態を分けて確認する。左右余白、中央配置、上下の切れ、全ユニット・物資ボタンの操作可否、console warning/errorを証拠付きで記録し、静的な844×390表示だけを実機表示確認の代替にしない。

## 9. 別PC復元時の照合事項

1. [RELEASE_BACKUP_RECOVERY.md](RELEASE_BACKUP_RECOVERY.md)の手順でGitHubまたは検証済みbundleから新規cloneする。
2. 0.5.0固定復元基準SHA、`v0.5.0^{commit}`、必要branchを照合する。
3. [README.md](../README.md)に従い`npm ci`、Lint、testを行う。
4. この文書のRelease、Sites v20、公開URL、未実装Issueを確認する。
5. Sitesの再公開、GitHubへのpush、refの修正は復元確認と分離し、必要な明示承認後に行う。

`node_modules`、`dist`、`work`、`outputs`などの生成フォルダは正式なソースバックアップではなく、必要に応じて再生成する。

## 10. 更新条件

次の場合に、対象ファイルを含む実装ミッションまたはリリース承認の範囲内でこの文書を更新する。

- 正式リリース、tag、Release、Sites version、公開基準が変わった
- 検証対象、環境、範囲、結果を正式記録する必要がある
- 未完了作業の追加、完了、優先順位変更が承認された
- bundle、オフデバイス保存、復元条件が変わった

コミット前、push前、公開前に、まだ完了していない工程を完了済みとして書かない。現在の`main` HEADを追うためだけの更新は行わない。
