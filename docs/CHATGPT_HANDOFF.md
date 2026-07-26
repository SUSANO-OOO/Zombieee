# 西新世紀末物語 — 企画・仕様引き継ぎ

更新日：2026-07-26

## 1. 文書の役割

この文書は、プロデューサーとChatGPTが、西新世紀末物語の作品意図、長期構想、現在のゲーム構造を共有するための企画・仕様引き継ぎである。

詳細の所有元：

- 恒久運用・権限・QA：[`AGENTS.md`](../AGENTS.md)
- 現在のrelease・GitHub状態：[`PROJECT_STATE.md`](PROJECT_STATE.md)
- 長期ロードマップ：[`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md)
- Version 0.9.0製品判断：[`PRODUCER_DECISIONS_0.9.0.md`](PRODUCER_DECISIONS_0.9.0.md)
- Version 0.9.0実行台帳：Issue #68
- 公開・復元：[`RELEASE_BACKUP_RECOVERY.md`](RELEASE_BACKUP_RECOVERY.md)
- 人物・物語の既存履歴：`CHARACTERS_0.7.0.md`、`STORY_BIBLE_0.7.0.md`

この文書と個別Version正本が衝突する場合は、個別Version正本を優先する。

## 2. 役割分担

- プロデューサー：作品方向、機能採否、優先順位、正式人物identity、画像採否、最終実プレイ受入
- ChatGPT：企画、仕様整理、比較、ロードマップ、体験評価、GitHub正本整備、Codex指示、報告評価
- Codex：技術調査、設計、実装、承認済みasset派生、test、QA、許可されたGitHub・release操作
- サブエージェント：読み取り専用監査、限定調査、独立review

Codexの実行場所はIssueごとにLocalまたはCloudを選ぶ。同一作業を重複実行しない。Windows、物理端末、実speaker、ローカルbrowser等の環境依存確認は、利用可能な環境で別途行う。

## 3. 作品概要

西新世紀末物語（にしじんせいきまつものがたり）は、生存者が暮らす大型移動拠点CRAWLERを守りながら部隊を指揮し、西新、早良区、百道浜周辺をゲーム向けに再構成した区域で感染体を押し返すリアルタイムのCanvas戦略・防衛ゲームである。

- `アーリーアクセス版`はタイトル画面の補助表記であり、正式名称には含めない
- 0.5.0以前の`ASHFALL OUTPOST`表記は履歴として維持する
- repository名`Zombieee`は内部・履歴上維持する
- 正式公開先はGitHub Pages
- ChatGPT Sitesは旧公開先であり、新規公開・QA・正式判定に使用しない

## 4. 世界観と表現

- 西新、早良区、百道浜、地下鉄、病院、研究区画、物流線、T計画区域等を再構成した架空の終末都市
- 成人向けのゴア、血液、死体、人体融合、異形化、荒廃を扱う
- 残酷さ、格好よさ、ブラックユーモア、局所的な馬鹿馬鹿しさを共存させる
- 一般的な西洋ゾンビ作品の模倣ではなく、福岡の地域性と独自の感染体を優先する
- 見た目の気持ち悪さだけでなく、silhouette、動き、攻撃、音、counterplayで個性を作る
- 作品世界を壊すだけの露悪表現や、全敵を同じ肉塊にする量産を避ける

## 5. 現行Version 0.8.0

### Campaign

- Stage 1〜16
- 5つの作戦区域
- 感染拠点攻略、防衛、護衛、封鎖、順序制御等の複数mission pattern
- Stageごとの背景、床面、walkable、objective anchor
- 星、初回報酬、再戦報酬、順番解放、local save

### Playable units

- 11名
- 最大7枠
- 3編成preset
- 同一unit cardから複数回出撃可能
- 各unitに役割、コスト、再出撃、武器、AI profile、battle voice
- Rank 0〜4 progression
- capsによる取得・強化
- identity master、event portrait、formation／personnel card、battle spriteを用途別profileとして管理

### Battle

- 960×540の論理Canvas
- player-facing固定3laneを廃止した連続battle space
- 内部navigation、route、anchor等は性能・制御目的で使用可能
- CRAWLERから味方がdoor／rampを通って出撃
- 敵は敵側入口から段階的に侵入
- 座標、距離、範囲、line-of-sight、contactによるcombat
- profile-driven ally／enemy AI
- weapon-specific animation、VFX、SE、damage event
- 戦場物資、航空支援、CRAWLER一斉掃射
- 味方死亡、感染、汎用ゾンビ化、焼却

### Boss

- TAKUYA
- 改札喰い

既存bossは通常敵と同じ表示基盤の延長が残り、size、重量感、登場、攻撃予告が弱い。Version 0.9.0でboss共通基盤へ移行する。

## 6. 対応プラットフォーム

- 主対象：smartphone横画面
- PC横画面も正式対応
- 基準確認：844×390、844×340、1280×720
- iPhone Safariではvisual viewport、safe area、browser UI表示状態を考慮する
- `100vh`固定や単純縮小で解決しない
- characterや文字を豆粒化しない
- touch target、可読性、押しやすさ、回転、tab／lock復帰を確認する
- 物理iPhone未使用時に、実機、発熱、speaker聴感を確認済みと断定しない

## 7. 中心ゲームループ

**戦闘  
→ 報酬・caps獲得  
→ unit取得・Level up・equipment  
→ 部隊編成  
→ 本編またはSurvivalへ挑戦  
→ 新しい敵、boss、unit、equipment、図鑑を解放**

戦闘内資源と戦闘外通貨を分ける。

- 指揮力：unit出撃
- スクラップ：戦場物資
- 支援ゲージ：航空支援等
- caps：unit取得、Level、equipment、恒久解放

## 8. Campaign長期構造

- 0.8.0公開時：Stage 1〜16
- 0.9.0公開目標：Stage 1〜20
- Version 1.0基準：Stage 50
- Stage 50は固定上限ではなく、Stage 100、150以上へ追加可能
- Stage数、Level上限、save schema、map UIを同じ固定値へ結合しない
- クリア済みStageは再play可能
- 初回報酬は再戦報酬より大きくする
- threat categoryは事前表示可能だが、全敵・数・弱点を完全公開しない
- 通常戦闘、boss戦、防衛、護衛、救助、封鎖、異常発生任務等を共通battle foundationで構成する

## 9. Boss方針

- 通常敵より明確に大きく、初見でbossと認識できる
- ただしsmartphone戦場を覆い、味方、足元、telegraphを隠す大きさにはしない
- display size、body bounds、foot anchor、shadow、hitbox、attack rangeを個別data化する
- 専用HP bar、段階、登場、SE、telegraph、形態変化、固有報酬、図鑑を共通化する
- bossは全身が右端から侵入完了するまでcombat-readyにしない
- 同じbossをSurvivalで連続出現させない

Version 0.9.0の新boss作業名：

- マザー
- オオグチ
- クロメ
- ガイレン
- フタゴ

`クロメ`と`ガイレン`を優先候補とし、全5体の正式表示名はidentity確認時にプロデューサーが固定する。

## 10. 通常感染体

現行にはwalker、runner、spitter、crusher、shade、abomination、grappler、ooze、sprinter等がある。

Version 0.9.0では通常感染体designを6種増やす。

- 色替えや服替えだけで別種扱いにしない
- 顔、体格、姿勢、歩行、損傷、攻撃部位を変える
- 少なくとも3種は新しいbehavior profile
- 既存roleの再利用個体も、地域・silhouette・攻撃表現を明確に変える
- Stage 17〜20で段階的に初登場
- 初登場後にSurvivalと適合する後半Stageへ追加
- 漢字、カタカナ、現場通称を使い分けられる

## 11. Playable units

### 長期

- Version 0.8.0：11名
- Version 0.9.0：新5名、合計16名
- Version 1.0：30名を基準
- 30名を固定上限にしない

### 編成

- 所有unitから最大7種類を選ぶ
- 同じunit cardを複数slotへ登録しない
- 同じunitを戦場へ複数回出撃させる抽象表現は維持する
- 近接、射撃、重装、回復、control、boss対策、部隊支援等の投入判断を分ける
- 特定unitを本編clear必須にしない
- 新unitを既存unitの単純上位互換にしない

### Version 0.9.0新unitのidentity

新プレイアブル5名の正式portraitは、プロデューサーが各1枚制作し、Codexへ直接渡す。

- 受領portraitが唯一の人物identity master
- Codexは別人物、別顔、別衣装で穴埋めしない
- Codexはevent portrait、formation／personnel card、battle sprite／atlas、thumbnail等を派生制作する
- 顔、髪、体格、肌、衣装、装備、武器、配色、傷、アクセサリーを一致させる
- 最初の1名で派生基準を確認後、残り4名へ展開する
- 未提出unitを仮人物で埋めて0.9.0完成扱いにしない
- 画像待ち中も画像非依存工程を進める

## 12. Levelと進行

Version 0.9.0でRank 0〜4をLevel 1〜50へ統合する。

- Rank 0 → Lv1
- Rank 1 → Lv2
- Rank 2 → Lv3
- Rank 3 → Lv4
- Rank 4 → Lv5

既存unitを弱体化せず、能力と投入capsを考慮してmigrationする。

Level cap：

- 初期：Lv5
- Stage 5：Lv10
- Stage 10：Lv15
- Stage 15：Lv20
- Stage 20：Lv25
- Stage 25：Lv30
- Stage 30：Lv35
- Stage 35：Lv40
- Stage 40：Lv45
- Stage 50：Lv50

0.9.0ではLv50まで扱えるdataとUIを作るが、公開時の通常解放上限はStage 20対応のLv25。Survival waveではLevel capを解放しない。Level 50以降はequipment、編成、新unit、敵対策等の横成長を使う。

## 13. Equipment

Version 0.9.0：

- 各unitに個人equipment2枠
- 各編成presetに戦術equipment2枠
- global inventoryを共有
- equipment約20種
- 最大5段階強化
- 固定性能
- random option、rarity厳選、gacha、合成、分解なし
- 通常equipmentは補給所
- 上位equipmentはSurvival
- boss固有equipmentはboss・異常発生任務
- 全equipmentへ正式icon

個人equipmentの割当と戦術equipmentは各presetへ保存する。所持数以上に同じ一品物を同時装備しない。

## 14. Survival Mode

- 無限wave
- 5waveごとにboss
- 5wave約3〜4分
- boss撃破ごとのcheckpoint
- 敗北・撤退でも完了済みwave分を持ち帰る
- 10wave到達ごとに次回の開始地点を短縮
- 1倍／2倍
- boss撃破後の3択一時強化
- 専用map1種類、長期到達に応じて環境変化
- 最高wave、撃破、boss、編成、equipment、resultを保存
- 破壊対象の敵拠点を置かず、右端外の感染流入口から侵入
- 味方が入口へ張り付かない防衛前線を使用

## 15. UI

Version 0.9.0の主要分類：

- 出撃
- 部隊
- 補給所
- 記録

`調達`を主要名称として使用しない。

- 出撃：本編、Survival、異常発生任務
- 部隊：編成、隊員、Level、個人equipment、戦術equipment、preset
- 補給所：unit、通常equipment、強化、入手先
- 記録：敵図鑑、boss図鑑、Survival、戦績

操作構造は軍事端末70%、装飾は生体汚染ホラー30%。機能を小さいbuttonへ詰め込み、意味のない発光やgradientで豪華に見せるだけのUIを避ける。

## 16. CRAWLER

- 生存者が暮らしながら移動する大型装甲拠点
- 本編では一台の主役CRAWLERを使用
- 味方はdoor／rampから出撃
- CRAWLER HP0で敗北
- 固有攻撃と緊急支援を持つ
- 通常時は画面左側で一部を見切れさせ、戦場面積と巨大感を両立する
- 将来、装甲、火力、指揮・支援の横成長を追加可能
- 画像サイズの偶然で敗北判定・性能差を生まない

## 17. Save

- localStorageとIndexedDB
- stable ID
- schema version
- migration前snapshot
- last-known-good
- corruption recovery
- export／import
- 星、報酬、解放、通貨を同一resultで二重適用しない
- save全体を自動初期化しない

Version 0.9.0では、所有unit、Stage、星、既読、編成、設定、移行Levelを維持し、旧未使用capsだけを新経済用の共通開始資金へ一度だけ再編する。開始資金を0にせず、内容をplayerへ明示する。

## 18. Audio

- BGMとSEを独立制御
- story全文読み上げは実装しない
- 出撃、攻撃、被弾、戦闘不能の人間battle voiceを維持
- weapon sound、enemy voiceを維持
- 新unitへ既存別人物voiceを流用しない
- background／tab復帰後のloop・voice二重化0
- physical iPhone、speaker、earphoneが未確認ならその事実を明記する

## 19. 開発・公開原則

- 正式コードはGitHub `main`のrelease SHA
- feature／integration branchは候補状態
- `main`直接push、force push、共有履歴rebase・amend禁止
- 正式公開はGitHub Pagesのみ
- release candidateの最終実プレイ合格前に、最終PR Ready化、main merge、tag、Release、正式deploymentを行わない
- 公開後に重大不具合があればrevert PRまたはimmutable release再deploymentで復旧する
- 未確認・失敗を成功報告しない
