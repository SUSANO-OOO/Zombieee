# 西新世紀末物語 — PRODUCT ROADMAP

更新日：2026-07-29

## 1. 役割

本書は、現在からVersion 1.0以降までの長期目標、実装順、依存関係、対象・非対象を管理する。

詳細の所有元：

- 現在状態：`docs/PROJECT_STATE.md`
- Version 0.9.5製品判断：`docs/PRODUCER_DECISIONS_0.9.5.md`
- Version 0.9.5実行台帳：Issue #96
- 恒久運用：`AGENTS.md`
- 公開・復元：`docs/RELEASE_BACKUP_RECOVERY.md`
- 過去Version判断：`docs/PRODUCER_DECISIONS_0.9.0.md`を含む各`PRODUCER_DECISIONS_*`、Issue、PR

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
- release SHA `f2633c538756385f13d166d3adbcdd39b3a08b21`をannotated `v0.9.0`、GitHub Release、GitHub Pagesへ正式公開
- GitHub Pages Release #150、Public QA #116成功

## 4. Version 0.9.5 — Mobile・animation・VFX・雇用品質更新

Issue：#96

状態：**製品判断承認済み・docs-only工程中**

最上位正本：`docs/PRODUCER_DECISIONS_0.9.5.md`

### 目的

- smartphone横画面全般で長時間遊びやすいrender、lifecycle、memory特性へ改善する
- 全16体の通常戦闘とmanual abilityを、接地、方向、weapon anchor、VFX、SE、damage timingまで含めて刷新する
- enemy、boss、CRAWLER、戦場描画とVersion 0.9.0残存不具合を横断修正する
- unit取得を「雇用」体験として統一し、解放の発見性とsave安全性を改善する

### 固定範囲

- 自動／高画質／省電力の3段階とgameplay不変契約
- 代表6体vertical sliceから全16体へ展開するanimation品質基準
- 通常攻撃、manual ability、telegraph、impact、hit stop、camera shakeのVFX／SE同期
- 通常敵、boss、CRAWLER、door／ramp、戦場backgroundのplayer-facing改善
- 連続frame captureを使う0.9.0残存不具合のroot cause修正
- 「調達」から「雇用」へのcopy変更
- safe screenで一度だけ表示する雇用可能popup
- マヨちゃんのSurvival Wave 20到達解放
- 必要に応じたv13→v14 migrationとorigin別save調査
- 0.9.0とのperformance／memory比較、全16体animation証拠、VFX証拠、LAN試遊URL

### 非対象

- PWA、manifest、Service Worker、offline／install
- App Store／Google Play／Capacitor
- 新Stage、新unit、新boss、新通貨
- cloud save、account、online ranking
- economy／difficultyの感覚的再調整
- Spine／DragonBones／全面bone化
- engine全面書き直し

### Release境界

docs-only merge resultから`integration/0.9.5`を作成し、工程branch／Draft PRを段階統合する。`integration/0.9.5 → main`、`v0.9.5` tag、GitHub Release、GitHub Pages正式deployment、Issue #96 closeは別承認まで行わない。

## 5. Version 0.9.5以降

### Version 0.9.6候補

- PWA、manifest、Service Worker、offline cache、install prompt
- 0.9.5のmobile performance／save／lifecycle結果を前提に別Issue・別正本で扱う
- App Store／Google Play／Capacitorを自動的に同一scopeへ含めない

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
- boss rushは0.9.0で未実装のSurvival派生候補であり、Version 0.9.5にも混在させない

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
9. mobile performance、全16体animation、VFX、雇用、saveを含む0.9.5品質更新
10. PWA／offline／installを扱う場合は0.9.6で分離
11. Stage 21〜50、30unitを含むVersion 1.0統合
12. Stage 100、150以降の継続拡張

番号を守ること自体を目的にせず、完成体験、安全なmigration、プレイヤー受入を優先する。
