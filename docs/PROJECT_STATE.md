# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-26

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：**Version 0.8.0**
- Version 0.8.0 release commit：`dbc4bd7edea94fdadce094526384ea4a0f181587`
- GitHub Release tag：`v0.8.0`
- release ledger：Issue #61、completed／closed
- release PR：#67、merged／closed
- deployment workflow：`.github/workflows/github-pages-release.yml`
- public QA workflow：`.github/workflows/github-pages-public-qa.yml`

公開中の正確なversion、release SHA、request ID、Issue metadataは、作業開始時とrelease操作前後に正式URLの公開HTML metadata、tag、Release、Actionsと再照合する。

ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、復旧に使用しない。

## 2. 現在のGitHub基準

本書更新時に確認した`main`：

`dbc4bd7edea94fdadce094526384ea4a0f181587`

- repository visibility：`public`
- default branch：`main`
- Version 0.7.1 Issue #43：completed／closed
- Version 0.7.5 Issue #44：completed／closed
- Version 0.8.0 Issue #61：completed／closed
- Version 0.9.0 Issue #68：open
- save key：`nishijin-campaign-v1`
- 現行save schema：v7を基準とし、Codex開始時にコードから再確認する

現在値は作業開始時に再取得する。本書記載SHAを永久に最新として扱わない。

## 3. 現行Version 0.8.0

### Campaign／content

- Stage 1〜16
- 5つの作戦区域
- Stage 7〜16の10battle stage
- 最低5種類のmission／objective pattern
- Stageごとの背景variant、床面、walkable、objective anchor
- 既存Stage 1〜6のsave・解放・星・報酬を維持

### Playable units／progression

- プレイアブル11名
- 最大7枠
- 3 formation presets
- 全11名のRank 0〜4 progression
- capsによるunit取得・強化
- 全11名のidentity master、event、formation／personnel card、battle用途別visual profile

### Battle

- player-facing固定3laneを撤廃した連続battle space
- profile-driven ally／enemy AI
- CRAWLER door／ramp deployment
- weapon-specific animation、VFX、SE、damage event
- machine gunの複数発砲・複数damage
- Stage／missionごとのgrounding、navigation、objective interaction

### Audio／UI／QA

- BGM／SE独立volume slider
- upgrade／MAX Rank feedback
- player-facing Version identity 0.8.0統一
- Chromium／WebKit、1280×720、844×390、844×340
- 15分Chromium 844×390 performance gate
- 物理iPhoneは未確認。WebKit iPhone相当、safe area、frame time、heap／memory proxyが代替証拠

## 4. Version 0.9.0で解決する体験課題

### 戦場

- 敵が戦場中央寄りから見え始め、mapが狭く感じる
- 敵拠点、spawn、combat-ready地点、射程、sprite実表示幅を右端構図へ再整合する必要がある
- survivalでは味方が侵入口へ張り付かない防衛前線が必要

### Boss

- TAKUYA、改札喰いを含むbossの表示size・重量感・登場・攻撃予告が弱い
- 通常敵と一目で区別できるboss共通基盤が必要
- 新規boss5体を追加する

### Content量

- 本編をStage 20まで拡張する
- 新プレイアブル5名を追加し、合計16名とする
- 通常感染体designを6種追加する
- survival、異常発生任務、図鑑、詳細resultを追加する

### 育成・経済

- Rank 0〜4ではcapsの使い道と長期成長が不足
- Level 1〜50、Stage進行によるlevel cap、個人equipment2枠、戦術equipment2枠へ拡張する
- 0.9.0公開時はStage 20 clearに対応するLv25まで通常解放可能とする
- 旧caps残高は新経済用の共通開始資金へ一度だけ再編する

### UI

- `調達`を含む現在の機能分類が分かりにくい
- 出撃、部隊、補給所、記録へ再構成する
- 軍事端末70%、生体汚染ホラー30%を基準とする

## 5. 次の正式作業

### Version 0.9.0

Issue：#68  
状態：**プロデューサー承認済み・正本整備完了・Codex実装開始可能**

最上位正本：

1. `docs/PRODUCER_DECISIONS_0.9.0.md`
2. Issue #68
3. `AGENTS.md`
4. 最新`main`のコード、tests、QA記録

主対象：

- Stage 17〜20
- survival mode
- 戦場右端spawnとsurvival防衛前線
- boss共通基盤、既存boss改修、新boss5体
- 通常感染体6種
- 新プレイアブル5名
- Rank→Level 1〜50
- caps経済再編
- equipment約20種、5段階強化
- UI再構成、詳細result、boss図鑑、記録
- save migration、performance、mobile QA

新プレイアブル5名のidentity masterはプロデューサーが各1枚制作し、Codexへ直接提供する。Codexは受領portraitからcard、event portrait、battle sprite等を派生制作する。

release candidateの最終実プレイ合格前に、`integration/0.9.0 → main`のReady化、merge、`v0.9.0` tag、GitHub Release、Pages正式deployment、Issue #68 closeを行わない。

## 6. 長期方向

- 本編stage数：50を基準とするが固定上限ではない
- 将来Stage 100、150以上へ追加可能
- playable unit：30体を基準とするが固定上限ではない
- Level 50はunit基礎育成の完成点とし、Stage数へ無制限追随させない
- Level 50以降の進行はequipment、編成、新unit、敵対策、将来の横成長で作る
- Version 1.0まではbattle中心
- 長尺story量産は主対象外
- stable IDs、local save、migration、rollbackを全versionで維持

## 7. 安全境界

禁止：

- `main`直接push
- force push、共有履歴rebase・amend
- 既存tag移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- save全体の自動初期化
- ライセンス不明素材の正式採用
- ChatGPT Sites deployment
- 未確認・失敗の成功報告

重大な公開不具合は、直前の正常release SHAを確認し、通常のrevert PRまたはimmutable release再deploymentで復旧する。
