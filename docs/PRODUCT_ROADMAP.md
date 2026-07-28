# 西新世紀末物語 — PRODUCT ROADMAP

更新日：2026-07-29

## 1. 役割

本書は、現在からVersion 1.0以降までの長期目標、実装順、依存関係、対象・非対象を管理する。

詳細の所有元：

- 現在状態：`docs/PROJECT_STATE.md`
- Version 0.9.0製品判断：`docs/PRODUCER_DECISIONS_0.9.0.md`
- Version 0.9.0実行台帳：Issue #68
- 恒久運用：`AGENTS.md`
- 公開・復元：`docs/RELEASE_BACKUP_RECOVERY.md`
- 過去Version判断：各`PRODUCER_DECISIONS_*`、Issue、PR

本書は現在SHAや詳細実装を重複して所有しない。個別Versionの正本と衝突する場合は、個別正本を優先する。

## 2. 長期製品目標

- 本編stage数は50を基準とする
- 50stageを固定上限にせず、将来Stage 100、150以上へ追加可能にする
- playable unitは30体を基準とする
- 30体を固定上限にせず、役割と品質が成立する限り追加可能にする
- Version 1.0まではbattle中心で開発する
- 長尺story eventの量産はVersion 1.0までの主対象にしない
- 短文会話、battle event、将来story差し込み口は維持する
- 全unitを本編storyへ登場させる必要はない
- unit追加は、役割、編成、操作上の楽しさを優先できる
- 敵勢力は感染体だけでなく、将来は人間敵を含めて拡張可能
- smartphone横画面を第一基準、PC横画面を正式対応とする
- stable ID、local save、migration、rollback可能性を全Versionで維持する

## 3. 完了済みの主要Version

### Version 0.5.0

- TAKUYA boss stageを準備、戦闘、敵拠点破壊、結果、再挑戦まで統合
- 戦場物資、航空支援、CRAWLER一斉掃射を導入
- smartphone横画面対応の基礎を確立

### Version 0.6.0／0.6.5

- タイトル、area map、Stage 1〜3、formation、battle、stars、rewards、unlock、local saveを統合
- 正式名称を「西新世紀末物語」へ変更
- smartphone主基準のHUD、placement、support、AI、save、audioを改善
- Safari保存拒否・消失対策を追加

### Version 0.7.0／0.7.1

- playable 11名
- 最大7枠、3presets
- caps、owned、discovered、acquisition、join state
- Stage 4〜6「西新駅地下編」
- 新敵、改札喰い、地下背景、event、audio
- Stage 5進行阻害、Stage 6 boss撃破不能をhotfix
- GitHub Pages正式公開

### Version 0.7.5

- data-driven content／event foundation
- generator、schema、registry、loader、validator、migration
- player-facing固定3laneを撤廃した連続battle space
- profile-driven ally／enemy AI
- 全11unitのRank 0〜4 progressionとcaps economy
- CRAWLER door／ramp deployment
- weapon-specific animation、VFX、SE、damage event
- machine gunの複数発砲・複数damage
- save recovery、export／import、mobile performance QA

### Version 0.8.0

- Stage 7〜16の10battle stage
- 5つの作戦区域
- 最低5種類のmission／objective pattern
- Stageごとの背景variant、grounding、walkable、objective interaction
- CRAWLER出撃・拠点防衛AIの改善
- モンキー再設計
- 全11unitの用途別visual profileとcard統一
- event portrait ghost表示修正
- BGM／SE独立volume
- upgrade／MAX Rank feedback
- player-facing Version identity統一
- 15分mobile performance gate

### Version 0.9.0

- Stage 17〜20、Survival Mode、異常発生任務5件
- mission別の右端・右端外spawnとSurvival防衛前線
- boss共通基盤、TAKUYA／改札喰い改修、新boss5体
- 通常感染体6種
- 新プレイアブル5名を追加し合計16名へ拡張
- 全16体の個体別手動アビリティと頭上ready icon
- Level 1〜50基盤、Stage進行によるlevel cap、Stage 20時点でLv25解放
- caps経済再編、個人equipment2枠、戦術equipment2枠、約20種の装備
- 出撃、部隊、補給所、記録のUIと、詳細result、図鑑、戦績
- save schema v13、旧save migration、mobile／performance QA

## 4. Version 0.9.0 — 戦闘・育成・サバイバル統合（RC受入済み）

Issue：#68

状態：**実装・RC受入・正式公開承認済み。公開結果はlive metadataとIssue #68で確定**

最上位正本：`docs/PRODUCER_DECISIONS_0.9.0.md`

### 目的

- 本編、育成、装備、boss、survivalを一つの反復ループへ接続する
- Stage 20、16 playable units、通常感染体6種、boss追加によってbattle量と編成幅を増やす
- capsを継続的に使う理由を作る
- smartphoneで戦場を広く、bossを大きく、UIを明確に見せる

### 固定範囲

#### Campaign

- Stage 17〜20を4件追加
- Stage 16 clearから順番に解放
- 最低3種類のmission／objective pattern
- Stage 20を0.9.0追加分の締めとする

#### Survival

- 無限wave
- 5waveごとにboss
- 5wave約3〜4分
- boss撃破ごとのcheckpoint
- 敗北・撤退でも完了分の報酬を持ち帰る
- 10waveごとの開始地点短縮
- 1倍／2倍
- boss撃破後の3択一時強化
- 専用map 1種類と段階的環境変化

#### Battlefield／Boss

- mission別の右端・右端外spawn profile
- survival用の防衛前線
- boss共通dataと大型表示
- TAKUYA、改札喰い改修
- 新boss5体
- bossごとの異常発生任務5件

#### Enemies

- 通常感染体design 6種
- 少なくとも3つの新behavior profile
- Stage 17〜20で段階的に初登場
- 初登場後にsurvivalと適合する後半stageへ展開

#### Playable units

- 新unit5名、合計16名
- 新5名のidentity master portraitはプロデューサーが各1枚制作しCodexへ直接提供
- Codexは受領portraitからevent、card、battle sprite等を派生制作
- 未提出unitを別人物で埋めない

#### Progression／Economy

- Rank 0〜4をLevel 1〜50へ統合
- 0.9.0公開時はStage 20 clearに対応するLv25まで通常解放可能
- Stage 50 clearでLv50を将来解放
- Level 50をstage数へ無制限追随させない
- 旧未使用capsを新経済用の共通開始資金へ一度だけ再編

#### Equipment

- 各unitに個人equipment 2枠
- 各presetに戦術equipment 2枠
- equipment約20種
- 最大5段階強化
- random option、rarity厳選、gacha、合成、分解なし
- 全equipmentへ正式icon

#### UI／Record

- 出撃、部隊、補給所、記録
- survival専用HUD
- 詳細result
- 敵図鑑、boss図鑑、survival最高記録

### 非対象

- Stage 21〜50の一括制作
- Stage 100／150の実制作
- 長尺story量産
- online ranking
- PvP、guild、daily mission
- 新恒久通貨
- random equipment、rarity、gacha、覚醒、限界突破
- cloud save
- 無目的なengine全面書き直し

## 5. Version 0.9.0以降

### 本編拡張

- Stage 21〜50を複数Versionへ分けて追加
- 新地域、百道浜、海岸線、病院深層、T計画関連区域、人間敵勢力
- Stage 50到達後もStage 100、150へ拡張可能なmap／save／content構造を維持

### Unit／Enemy拡張

- playable 30体を基準に役割を増やす
- 感染体、人間敵、機械・環境hazardを段階追加
- 同じ数値違いだけで量産しない

### 横成長

- Level 50以降はequipment、編成synergy、新unit、敵対策、mission固有ruleで攻略幅を増やす
- Levelをstage数へ比例して無制限に増やさない

### Challenge系

Challenge Modeは本編と別枠とする。

- 本編と同じunits、enemies、maps、missions、difficulty、rewards、saveを再利用
- Challenge専用の別battle engineを作らない
- 連戦、特殊rule、撤退判断、報酬を共通event foundationから構成
- boss rushはsurvival完成後の派生候補とし、0.9.0へ混在させない

## 6. Version 1.0

Version 1.0では、次を一つの完成ループとして統合する。

- 本編50stageを基準とするcampaign
- 30 playable unitsを基準とするroster
- acquisition、Level、equipment、formation、battle、rewards、save
- multiple missions、bosses、events
- survival／Challenge等の継続battle
- smartphone／PC横画面
- local saveとmigration
- update可能なcontent pipeline

50stage、30unitはVersion 1.0の完成基準であり、将来上限ではない。

## 7. 実装依存関係

1. 公開運用、save、rollback
2. data-driven content pipeline
3. continuous battle space、AI、target、placement
4. stage、enemy、unit量産
5. survival、boss foundation、checkpoint
6. Level、equipment、economy
7. UI、result、図鑑、record
8. Stage 20、16unit、通常感染体6種、新boss5体を含む0.9.0統合
9. Stage 21〜50、30unitを含むVersion 1.0統合
10. Stage 100、150以降の継続拡張

番号を守ること自体を目的にせず、完成体験、安全なmigration、プレイヤー受入を優先する。
