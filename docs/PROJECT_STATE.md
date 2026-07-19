# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-19

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：Version 0.7.0
- 0.7.0ゲーム本体のrelease基準：`782c70351a8fe22ca4ca0daa926c31c83433653a`
- deployment：`.github/workflows/github-pages-release.yml`
- 公開後QA：`.github/workflows/github-pages-public-qa.yml`

公開中の正確なrelease SHAは、GitHub Pages workflow結果と公開HTMLの`github-pages-release`メタ情報を照合する。

GitHub Actions成功だけでは一般公開成功と断定しない。GitHub未ログインの新規ブラウザ相当で、認証要求なし、HTTP成功、主要asset取得、fresh save開始、Stage 1開始を確認する。

ChatGPT Sitesは0.6.5以前の旧公開先であり、0.7.0以降のdeployment、QA、正式判定に使用しない。

## 2. 現在のGitHub基準

本書更新時にGitHubで確認した`main`：

`c5c58493c789aae5ca105d5042b5e13b3abae1c9`

- repository visibility：`public`
- default branch：`main`
- PR #38：0.7.0ゲーム本体、merge済み
- PR #40：Pages権限修正、merge済み
- PR #41：immutable release再公開経路、merge済み
- PR #42：公開後QA、merge済み
- Issue #37：0.7.0完了としてclosed
- save key：`nishijin-campaign-v1`
- 現行save schema：v5

`main`の現在値は作業開始時にGitHub APIまたは更新済みremote refで再取得する。本書記載SHAを永久に最新として扱わない。

## 3. 現在の公開運用上の課題

PR #41のimmutable release再公開能力は利用価値がある。

一方、現在の公開後QAは次を0.7.0向けに固定している。

- `.github/pages-release-request.json`の0.7.0 release SHA
- 表示文の`0.7.0`
- 報告先Issue #37

このまま0.7.1以降へ流用しない。Version、release SHA、報告先Issue、QA対象をrelease単位で指定できる汎用方式へ0.7.5開始工程で整理する。

## 4. 次の正式作業

### Version 0.7.1

Issue：[Issue #43](https://github.com/SUSANO-OOO/Zombieee/issues/43)

目的：

- Stage 5「西新駅・ホーム／線路区域」の進行阻害を先行修正
- 必須台車護衛を撤廃
- ホーム制圧・感染拠点破壊中心へ再設計
- Stage 6へ通常進行可能にする
- 既存save、星、報酬、既読、解放を維持

状態：**正式承認済み・未実装**

### Version 0.7.5

Issue：[Issue #44](https://github.com/SUSANO-OOO/Zombieee/issues/44)

正式名称：**コンテンツ量産基盤・戦闘品質再構築**

最上位正本：

1. `docs/PRODUCER_DECISIONS_0.7.5.md`
2. `docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`
3. Issue #44

状態：**正式承認済み・0.7.1公開後に開始**

## 5. 0.7.0実プレイで確認された主な課題

- Stage 5の必須台車護衛が進行不能級
- Stage 6はStage 5阻害によりプロデューサー実プレイ未到達
- 固定3レーンと配置制限が直感性を損なう
- プレイフィールドが狭く見える
- 味方・敵の出現位置が手前すぎる、または不自然
- CRAWLERから味方が自然に出撃せず、縦線からワープして見える
- CRAWLER周辺の設置禁止範囲が広すぎる
- 敵拠点が大きく、戦場を圧迫する
- 新キャラクターのイベント画像・編成画像が用途に合わず、見切れや全身縮小がある
- タタラを含む戦闘スプライトの縮尺・接地が不統一
- 戦闘AIに改善余地がある
- 攻撃VFXが単純図形に見える
- マシンガン等の連射表現、音、複数ダメージが一致しない
- 固定フレーム前提でアニメーション拡張性が不足
- iPhone実プレイで発熱傾向がある
- いくらちゃんは可愛さと露出を維持しつつ、世界観へ適合する再調整が必要

これらは0.7.5で単発修正ではなく、共通基盤として再構築する。

## 6. Codexの権限と確認地点

Issue #43およびIssue #44、0.7.5正本により、Codexへ次を委任する。

- 調査、設計、実装、文書、対象アセット
- 内部構造、アルゴリズム、データ形式、テスト方式の自律決定
- feature／integration branchへの通常commit・通常push
- Draft PR作成・更新
- CI、実ブラウザQA、独立read-onlyレビュー、修正
- Issue #43の公開前ゲート通過後の0.7.1正式リリース
- Issue #44の0.7.5 release candidate作成

プロデューサー確認地点：

1. いくらちゃん、CRAWLER、敵拠点の基準デザイン3点
2. 0.7.5 release candidateの最終実プレイ受入

0.7.5のReady化、merge、tag、Release、正式公開は、最終実プレイ受入後の明示承認まで行わない。

## 7. スマートフォン基準

スマートフォン横画面を正式な第一基準とする。

最低確認：

- 844×390
- 844×340
- Playwright WebKitのiPhone相当profile
- touch、safe area、回転
- 画面ロック・復帰、タブ復帰
- BGM、SE、戦闘ボイス
- save再読込
- console error、asset 404
- 長時間frame time、memory、入力遅延

物理iPhone 14 Pro Max相当が利用可能なら10〜15分以上の連続戦闘と発熱傾向を確認する。利用不能な場合は温度を確認済みと断定せず、WebKitと性能計測を代替証拠として報告する。

## 8. 安全境界

禁止：

- `main`への直接push
- force push
- 共有履歴のrebase・amend
- 既存tagの移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- saveの自動初期化
- ChatGPT Sitesへの新規deployment
- 未確認・失敗を成功として報告

重大な公開不具合は、直前release SHAを確認し、通常のrevert PRで復旧する。

## 9. 歴史的リリース

### v0.5.0

- release SHA：`466cec62230e774ee4f25d31988906400412e228`
- annotated tag：`v0.5.0`
- GitHub Release：`https://github.com/SUSANO-OOO/Zombieee/releases/tag/v0.5.0`

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

- `docs/RELEASE_BACKUP_RECOVERY.md`に従う
- 既存checkoutを上書きせず、新規cloneまたは隔離復元を使用する
- release SHAと`tag^{commit}`を照合する
- GitHub Pages再公開は正常なPRと`main` mergeで行う
- ChatGPT Sitesを復元経路として使用しない

## 11. 記録の所有元

- 製品判断：バージョン別プロデューサー決定台帳
- 実行順と権限：バージョン別実行ランブック
- 現在のrelease・公開状態：本書
- 長期実装順：`docs/PRODUCT_ROADMAP.md`
- 実装・承認・QAログ：対象Issue・PR
- 公開配布物：GitHub Release
- deployment：GitHub Actions／GitHub Pages
