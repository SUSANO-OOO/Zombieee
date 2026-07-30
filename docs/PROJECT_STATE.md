# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-31

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：**Version 0.9.0**
- release SHA：`f2633c538756385f13d166d3adbcdd39b3a08b21`
- annotated tag：`v0.9.0`、同release SHA
- GitHub Release：Version 0.9.0、同release SHA
- request ID：`v0.9.0-formal-release-20260729`
- release ledger：Issue #68、closed
- deployment workflow：GitHub Pages Release #150、success
- public QA workflow：GitHub Pages Public QA #116、success
- 公開HTML metadata：version `0.9.0`、release SHA `f2633c538756385f13d166d3adbcdd39b3a08b21`、Issue `68`

上記は2026-07-29のVersion 0.9.5 docs-only開始時にlive再取得した値である。公開中の正確なversion、release SHA、request ID、Issue metadataは、作業開始時とrelease操作前後に正式URLの公開HTML metadata、tag、Release、Actionsと再照合する。

ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、復旧に使用しない。

## 2. 現在のGitHub基準

- repository：`SUSANO-OOO/Zombieee`
- repository visibility：`public`
- default branch：`main`
- Version 0.9.5 docs-only merge result／latest `main`：`76b9168d03109fbb473df7632f0f201d9612f13d`
- Version 0.9.5 integration branch：`integration/0.9.5`
- RC開始時integration SHA：`9c576b1acb89c5b05a47213fa0c8f450b8d6136c`
- docs-only PR：#97、工程PR：#98〜#106、通常merge済み
- Version 0.9.5 RC branch：`codex/0.9.5-rc`
- Version 0.9.5 ledger：Issue #96、open
- Version 0.9.5最上位製品正本：`docs/PRODUCER_DECISIONS_0.9.5.md`
- save key：`nishijin-campaign-v1`
- Version 0.9.5 save schema：v14

`main`はdocs、ops、hotfix等でも進むため、現在SHAを本書へ永久固定しない。作業開始時、PR操作直前、merge直前、release直前にGitHubの現在値を再取得する。正式公開game sourceは、単なる最新`main`ではなく公開HTML metadata、tag、GitHub Release、release requestと照合する。

## 3. Version 0.9.0公開内容

### Campaign／content

- Stage 1〜20
- Survival Mode
- 異常発生任務5件
- mission別の右端・右端外spawn profile
- Stageごとの背景variant、床面、walkable、objective anchor
- 既存Stage 1〜16のsave、解放、星、報酬を維持

### Playable units／progression

- プレイアブル16名
- 最大7枠、3 formation presets
- 全16体の個体別manual abilityと頭上ready icon
- Level 1〜50のdata／UI基盤。Stage 20時点の通常解放上限はLv25
- 個人equipment2枠、preset別の戦術equipment2枠
- 約20種・5段階強化のequipment inventory
- capsによるunit取得、Level、equipment強化
- 新5名を含む全16名の正式identityとplayer-facing visual

### Battle

- player-facing固定3laneを廃止した連続battle space
- profile-driven ally／enemy AI
- CRAWLER door／ramp deployment
- 出現完了まで攻撃、被弾、collisionを禁止するcombat-ready契約
- Survival専用防衛前線
- weapon-specific animation、VFX、SE、damage event
- boss共通基盤、TAKUYA／改札喰い改修、新boss5体
- 通常感染体6種

### UI／save／QA

- 出撃、部隊、補給所、記録へ主要UIを再構成
- 詳細result、敵図鑑、boss図鑑、Survival記録、戦績
- BGM／SE独立volume slider
- save schema v13
- localStorage／IndexedDB、migration snapshot、last-known-good、recovery、export／import
- Chromium／WebKit、1280×720、844×390、844×340
- 物理iPhoneは未確認。WebKit iPhone相当、safe area、frame time、heap／memory proxyが代替証拠

## 4. Version 0.9.5 release candidate状態

状態：**RC・Producer acceptance correction統合済み・release preparation中**

- correction PR：#108、通常merge済み
- correction統合SHA：`cca0b63cf5a83f6000b3a4599bf0912659f8ed98`
- release identity：Version 0.9.5
- release SHA：final `integration/0.9.5 → main` PRのmerge resultへ固定予定
- formal release authority：Issue #96監査改訂済み最新コメント（issue comment `5124971857`）

目的：

- smartphone横画面全般の発熱、描画、memory負荷を低減
- 全16体の戦闘アニメーションをplayer-facingで刷新
- VFX、攻撃演出、敵、boss、CRAWLER、戦場描画を改善
- Version 0.9.0残存表示・出撃不具合を横断修正
- 「雇用」、雇用可能popup、マヨちゃんSurvival Wave 20到達解放を統合
- save migrationとorigin別saveを検証

Version 0.9.0 baseline：

- `npm.cmd test`：695 tests pass、production build pass
- `npm.cmd run lint`：pass
- `npm.cmd run content:validate`：pass
- `git diff --check`：pass
- content：16 units、23 enemies、20 stages、20 missions、179 waves、20 equipment、514 assets
- Version 0.9.0 release-prep記録：asset decode 399/399 audio、34/34 portraits、57/57 images
- Version 0.9.0 release-prep記録：save migration matrix 44/44、progression browser matrix 6/6

RC・Producer acceptance correction：

- `npm.cmd test`：758 tests pass、production build pass
- `npm.cmd run lint`、`npm.cmd run content:validate`、`git diff --check`：pass
- 全16体出撃：576/576 pass、technical RC `5bc0d6b`とのaligned before／after 192 frame、修正版opacity 96/96で1
- 全16体walk／turn／attack：technical RC `5bc0d6b`とのaligned before／after 192 frame、全source frameをSHA-256 lock
- 残存攻撃不具合：96/96 pass、unit／enemyの接地・方向・攻撃timing failure 0
- AI任務：Stage 1〜20で120/120 pass
- CRAWLER defense：240/240、pass-through 0、objective direct 0
- route／cart：12/12
- save migration／origin：v13→v14、78/78、一度だけ適用・idempotent
- 雇用：6/6、マヨちゃんSurvival Wave 20到達解放：2/2
- asset decode：399/399 audio、34/34 portraits、58/58 images
- performance gate：3/3、同一scenarioの省電力render-work proxyはAuto比76.74%減
- 独立read-only review：High／Medium／Low 0
- canonical correction証拠：`docs/qa/v095/acceptance-corrections/README.md`
- RC証拠：`docs/qa/v095/rc/README.md`、`docs/qa/v095/rc/rc-summary.json`

Producerは物理smartphoneでStage 1〜13を確認済み。Stage 14〜20はbrowser regressionで補完する。物理speaker、native Safari、残存発熱、物理touch／回転／lock復帰を自動QAで確認済みとは断定しない。これらの既知境界はRelease NotesとIssue #96へ明示し、Issue comment `5124971857`の正式release承認を置き換えない。

## 5. Version 0.9.5の実装順

詳細と進捗はIssue #96が所有する。

1. docs-only正本整備
2. Version 0.9.0公開版のperformance、save、visual baseline
3. mobile render、lifecycle、memory最適化
4. animation state、anchor、event基盤
5. 代表6体vertical slice
6. 残り10体、敵、boss、CRAWLER、VFXへ横展開
7. 残存不具合修正
8. 雇用copy、unlock popup、マヨ解放、save migration
9. 全体QA、独立review、RC

各工程を工程branch／Draft PRへ分け、focused tests、全tests、production build、Lint、`git diff --check`、browser QA、独立read-only reviewを通してから`integration/0.9.5`へ通常mergeする。

## 6. Version 0.9.5 release境界

RCとProducer acceptance correctionで`integration/0.9.5`へ次を揃えた。

- 全工程PRとintegration latest SHA
- 全tests、build、Lint、review結果
- browser QA
- 0.9.0とのperformance／memory比較
- 全16体animation改善一覧と実画面証拠
- VFX、描画、enemy、boss、CRAWLER改善証拠
- 残存不具合のroot causeと修正証拠
- 雇用、unlock popup、マヨ解放、save migration、origin別save結果
- LAN試遊URL
- 物理smartphone確認手順
- 未解決High／Medium／Low 0

Issue #96の監査改訂済み最新コメントに従い、release preparation、final main PR、annotated tag、GitHub Release、Pages manual dispatch、自動Public QAの順で進める。`.github/pages-release-request.json`は変更しない。公開metadataがVersion 0.9.5とfinal main merge result SHAへ切り替わり、自動Public QAが成功する前にIssue #96をcloseしない。

## 7. 長期方向

- Version 0.9.6：PWA、Service Worker、offline／install対応の分離候補
- 本編stage数：50を基準とするが固定上限ではない
- 将来Stage 100、150以上へ追加可能
- playable unit：30体を基準とするが固定上限ではない
- Level 50はunit基礎育成の完成点とし、Stage数へ無制限追随させない
- Level 50以降の進行はequipment、編成、新unit、敵対策、将来の横成長で作る
- Version 1.0まではbattle中心
- stable IDs、local save、migration、rollbackを全Versionで維持

## 8. 安全境界

恒久禁止：

- `main`直接push
- force push、共有履歴rebase・amend
- 既存tag移動・上書き
- branch cleanup
- PWA、Service Worker、offline／install対応の0.9.5混在
- 新Stage、新unit、新boss
- engine全面書き直し
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- save全体の自動初期化
- ライセンス不明素材の正式採用
- ChatGPT Sites deployment

Issue comment `5124971857`が承認するrelease操作も、release preparationと全gate成功後に順番どおり実行する。final main merge前のtag／Release／deployment、Public QA成功前のIssue closeは禁止する。
- 未確認・失敗の成功報告

重大な公開不具合は、直前の正常release SHAを確認し、通常のrevert PRまたはimmutable release再deploymentで復旧する。
