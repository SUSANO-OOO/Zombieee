# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-29

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：**Version 0.9.0**
- game release commit：annotated tag `v0.9.0^{commit}`とGitHub Release targetを正本として都度再取得
- GitHub Release tag：`v0.9.0`
- release ledger：Issue #68、completed／closed
- release request ID：`v0.9.0-formal-release-20260729`
- release request方式：`main`からの明示的`workflow_dispatch`
- deployment workflow：`.github/workflows/github-pages-release.yml`
- public QA workflow：`.github/workflows/github-pages-public-qa.yml`

公開中の正確なversion、release SHA、request ID、Issue metadataは、作業開始時とrelease操作前後に正式URLの公開HTML metadata、tag、Release、Actionsと再照合する。

ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、復旧に使用しない。

## 2. 現在のGitHub基準

- Version 0.8.0 game release baseline：`dbc4bd7edea94fdadce094526384ea4a0f181587`
- Version 0.9.0 integration release-prep baseline：`ec6b25706e234d4c916c7d90730eaba35344243b`
- repository visibility：`public`
- default branch：`main`
- Version 0.7.1 Issue #43：completed／closed
- Version 0.7.5 Issue #44：completed／closed
- Version 0.8.0 Issue #61：completed／closed
- Version 0.9.0 Issue #68：completed／closed
- save key：`nishijin-campaign-v1`
- 現行save schema：v13

`main`はdocs、ops、hotfix等でも進むため、現在SHAを本書へ永久固定しない。作業開始時、PR操作直前、merge直前、release直前にGitHubの現在値を再取得する。正式公開game sourceは、単なる最新`main`ではなく公開HTML metadata、tag、GitHub Release、release requestと照合する。

## 3. 現行Version 0.9.0

### Campaign／content

- Stage 1〜20
- Survival Mode
- 異常発生任務5件
- mission別の右端・右端外spawn profile
- Stageごとの背景variant、床面、walkable、objective anchor
- 既存Stage 1〜6のsave・解放・星・報酬を維持

### Playable units／progression

- プレイアブル16名
- 最大7枠
- 3 formation presets
- 全16体の個体別手動アビリティと頭上ready icon
- Level 1〜50のdata／UI基盤。Stage 20時点の通常解放上限はLv25
- 個人equipment2枠、preset別の戦術equipment2枠
- 約20種・5段階強化のequipment inventory
- capsによるunit取得、Level、equipment強化
- 新5名を含む全16名の正式identityとplayer-facing visual

### Battle

- player-facing固定3laneを撤廃した連続battle space
- profile-driven ally／enemy AI
- CRAWLER door／ramp deployment
- 出現完了まで攻撃・被弾・collisionを禁止するcombat-ready契約
- Survival専用防衛前線
- weapon-specific animation、VFX、SE、damage event
- machine gunの複数発砲・複数damage
- Stage／missionごとのgrounding、navigation、objective interaction
- boss共通基盤、TAKUYA／改札喰い改修、新boss5体
- 通常感染体6種

### Audio／UI／QA

- 出撃、部隊、補給所、記録へ主要UIを再構成
- 詳細result、敵図鑑、boss図鑑、Survival記録、戦績
- BGM／SE独立volume slider
- player-facing Version identity 0.9.0統一
- Chromium／WebKit、1280×720、844×390、844×340
- 15分Chromium 844×390 performance gate
- 物理iPhoneは未確認。WebKit iPhone相当、safe area、frame time、heap／memory proxyが代替証拠

## 4. Version 0.9.0で統合した体験

### 戦場

- 敵の出現位置、combat-ready、射程、sprite実表示幅を右端構図へ再整合
- Survivalで味方が侵入口へ張り付かない防衛前線を導入
- Stage背景とgroundingを整合し、空中歩行や扉付近の不自然な透過を修正

### Boss

- 通常敵と一目で区別できるboss共通基盤を導入
- TAKUYA、改札喰いの表示、登場、攻撃予告を改修
- 新boss5体と異常発生任務を追加

### Content量

- 本編をStage 20まで拡張
- 新プレイアブル5名を追加し合計16名へ拡張
- 通常感染体6種、Survival、異常発生任務、図鑑、詳細resultを追加

### 育成・経済

- Rank 0〜4をLevel 1〜50へ移行
- Stage進行によるlevel cap、個人equipment2枠、戦術equipment2枠へ拡張
- Stage 20 clearでLv25まで通常解放
- 旧caps残高を新経済用の共通開始資金へ一度だけ再編

### UI

- 出撃、部隊、補給所、記録へ再構成
- 本編、Survival、異常発生任務の入口を分離
- 軍事端末70%、生体汚染ホラー30%の基準を維持

## 5. 次の正式作業

Version 0.9.0の正式公開後に着手する次Versionは未決定。新しいIssueとプロデューサー判断なしに、Version 0.9.1／1.0の実装範囲を推測して開始しない。

公開後の作業は、公開metadata、主要asset、fresh save、Version 0.8.0 save migration、主要game loopの監視と、確認された不具合に対する通常PRに限定する。

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
