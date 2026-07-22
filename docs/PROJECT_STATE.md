# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-22

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：Version 0.7.0
- Version 0.7.0ゲーム本体release SHA：`782c70351a8fe22ca4ca0daa926c31c83433653a`
- deployment workflow：`.github/workflows/github-pages-release.yml`
- public QA workflow：`.github/workflows/github-pages-public-qa.yml`

公開中の正確なversion／release SHAは、Actions結果だけでなく、正式URLの公開HTMLに埋め込まれたrelease metadataと照合する。

ChatGPT Sitesは旧公開先であり、0.7.1以降のdeployment、QA、正式判定、復旧に使用しない。

## 2. 現在のGitHub基準

本書更新時に確認した`main`：

`e6e0580146164270dafba9b75cf6fcea5322e2fb`

- repository visibility：`public`
- default branch：`main`
- PR #38：Version 0.7.0ゲーム本体、merge済み
- PR #40：Pages権限修正、merge済み
- PR #41：immutable release再deployment経路、merge済み
- PR #42：公開後QA、merge済み
- PR #45：0.7.1／0.7.5正本、merge済み
- PR #46：最終実行ロック、merge済み
- PR #47：Codexミッション正本統合、merge済み
- Issue #37：Version 0.7.0完了としてclosed
- Issue #43：Version 0.7.1、open
- Issue #44：Version 0.7.5、open
- save key：`nishijin-campaign-v1`
- 現行save schema：v5

現在値は作業開始時に再取得する。本書記載SHAを永久に最新として扱わない。

GitHub上で確認できるClaude Code由来のcommit、PR、引き継ぎbranchはない。未pushのローカル作業を存在する前提にせず、CodexはGitHubと現在のローカル状態を独立確認して開始する。

## 3. 公開運用契約

Pages Releaseはversion非依存の明示的release contractを使用する。

- 通常の`main` pushとdocs-only mergeではdeploymentしない
- `.github/pages-release-request.json`の明示変更、または5項目を指定したmanual dispatchだけを正式requestとして扱う
- `version`、`release_ref`、`release_sha`、`issue_number`、`request_id`を共通validatorで検証する
- annotated tag、GitHub Release、release SHA、対象Issueの一致後にimmutable sourceをbuildする
- 公開HTMLへversion、release SHA、request ID、Issue metadataを埋め込む
- Public QAはdeploy元runのvalidated contract artifactを取得し、同じidentityと対象Issueを使用する
- PR段階ではproduction build、static Pages build、browser smoke、contract testだけを行いdeploymentしない

`.github/pages-release-request.json`はimmutable Version 0.7.0の復元requestとして維持する。Version 0.7.1以降の通常releaseは、merge result SHAへのannotated tagとGitHub Releaseを作成した後、安全なmanual dispatchで実行できる。

## 4. 次の正式作業

### Version 0.7.1

Issue：#43  
状態：**正式承認済み・未実装**

対象：

1. R0公開運用preflight
2. Stage 5必須台車護衛の撤廃
3. Stage 5をホーム制圧・感染拠点破壊中心へ再設計
4. Stage 6ボスHPが504で停止する撃破不能不具合の根本修正
5. save、星、報酬、既読、Stage 6解放の維持
6. Version 0.7.1正式公開と公開後QA

Stage 6では、表示だけでなくdamage計算、target／hit判定、無敵状態、phase遷移、state同期、boss objective、勝利判定を切り分ける。`504`だけを特別扱いする応急処置は禁止する。

### Version 0.7.5

Issue：#44  
正式名称：**コンテンツ量産基盤・戦闘品質再構築**  
状態：**正式承認済み・0.7.1公開後に開始**

最上位正本：

1. `docs/PRODUCER_DECISIONS_0.7.5.md`
2. `docs/EXECUTION_LOCK_0.7.5.md`
3. `docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`
4. Issue #44

0.7.1公開後、追加開始指示を待たず0.7.5へ進む。0.7.5はrelease candidateまで自律実行し、最終実プレイ受入で停止する。

## 5. 0.7.0実プレイで確認された課題

### 0.7.1で先行修正

- Stage 5の必須台車護衛が進行不能級
- Stage 6ボスHPが504で停止し撃破不能

### 0.7.5で基盤修正

- 固定3レーンと配置制限が直感性を損なう
- プレイフィールドが狭く見える
- 味方・敵の出現位置が不自然
- CRAWLERから味方が自然に出撃せず、縦線からワープして見える
- CRAWLER周辺の設置禁止範囲が広すぎる
- 敵拠点が大きく戦場を圧迫
- イベント画像・編成画像の見切れ、全身縮小
- タタラを含む戦闘スプライトの縮尺・接地不統一
- 戦闘AIの改善不足
- 攻撃VFXが単純図形に見える
- マシンガンの連射表現、音、複数damageが一致しない
- 固定フレーム前提でanimation拡張性不足
- iPhone実プレイで発熱傾向
- いくらちゃんは可愛さと露出を維持しつつ世界観適合が必要

## 6. 長期方向

- 本編ステージ数：50を基準、将来追加可能
- プレイアブルユニット：30体を基準、将来追加可能
- Challenge Mode：1セッション3ステージ、約6セッションを将来目標
- 1.0までは戦闘中心
- 長尺ストーリー量産は主対象外
- 戦闘中イベント、短文会話、将来のストーリー差し込み口は維持

## 7. Codexの権限と確認地点

Codexへ委任：

- 調査、設計、実装、対象文書・アセット
- 内部構造、データ形式、アルゴリズム、テスト方式の自律決定
- feature／integration branchへの通常commit・通常push
- PR作成・更新
- CI、実ブラウザQA、独立read-onlyレビュー、修正
- Issue #43の全ゲート通過後の0.7.1正式リリース
- Issue #44の0.7.5 release candidate作成
- 工程PRの`integration/0.7.5`への通常merge

プロデューサー確認地点：

1. いくらちゃん、CRAWLER、敵拠点の基準デザイン3点
2. 0.7.5 release candidateの最終実プレイ受入

0.7.5の`main` merge、tag、Release、正式公開は最終実プレイ合格後の別承認まで行わない。

## 8. 安全境界

禁止：

- `main`直接push
- force push、rebase、amend
- 既存tag移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- saveの自動初期化
- ChatGPT Sitesへのdeployment
- 未確認・失敗の成功報告

重大な公開不具合は、直前release SHAを確認し、通常のrevert PRで復旧する。

## 9. 歴史的リリース

### v0.5.0

- release SHA：`466cec62230e774ee4f25d31988906400412e228`

### v0.6.5基準

- merge SHA：`706dd0ffaa51346bd061b2b4e72b4ce033537771`
- Safari save修正後基準：`f4cf603e8e003c8fa14b2b7368700ed7a6501261`

### v0.7.0

- game release SHA：`782c70351a8fe22ca4ca0daa926c31c83433653a`
- Issue #37：closed
- PR #38：merged
- 正式公開先：GitHub Pages

歴史情報は復元用であり、現在の`main`や次回作業baseを意味しない。

## 10. 復元

`docs/RELEASE_BACKUP_RECOVERY.md`に従う。既存checkoutを上書きせず、新規cloneまたは隔離worktreeを使用する。
