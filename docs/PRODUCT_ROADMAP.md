# 西新世紀末物語 — PRODUCT ROADMAP

更新日：2026-07-22

## 1. 役割

本書は、現在からVersion 1.0までの長期目標、実装順、依存関係、対象・非対象を管理する。

詳細の所有元：

- 現在状態：`docs/PROJECT_STATE.md`
- 0.7.1／0.7.5製品判断：`docs/PRODUCER_DECISIONS_0.7.5.md`
- 実行順・権限・停止条件：`docs/EXECUTION_LOCK_0.7.5.md`
- 技術工程：`docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`
- 実行ログ：Issue #43、Issue #44、対象PR

本書は現在SHAや詳細仕様を重複して所有しない。個別バージョンの正本と矛盾する場合は、個別正本を優先する。

## 2. 長期製品目標

- 本編ステージ数は50を基準とする
- プレイアブルユニットは30体を基準とする
- 50ステージ、30体を固定上限にせず、将来アップデートで追加可能にする
- 1.0までは戦闘中心で開発する
- 長尺ストーリーイベントの量産は1.0までの主対象にしない
- 短文会話、戦闘中イベント、将来のストーリー差し込み口は維持する
- 全ユニットを本編ストーリーへ登場させる必要はない
- ユニット追加は、役割、編成、操作上の楽しさを優先できる
- 敵勢力は将来、人間敵を含めて拡張可能にする
- PC横画面とスマートフォン横画面へ対応し、スマートフォンを第一基準とする
- stable ID、local save、migration、rollback可能性を全バージョンで維持する

## 3. Challenge Mode

Challenge Modeは本編とは別枠とする。

将来目標：

- 1セッション3ステージ
- 約6セッション
- 本編と同じunits、enemies、maps、missions、difficulty、rewards、saveを再利用
- Challenge専用の別戦闘エンジンを作らない
- 連戦、特殊ルール、撤退判断、報酬を共通event foundationから構成

実装時期と最終ルールは、0.7.5の量産・event foundation完成後に確定する。

## 4. 実装依存関係

1. 公開運用、save、rollback
2. 公開中の進行阻害・撃破不能hotfix
3. runtimeとcontentの責任分離
4. generator、validator、simulation
5. battle space、AI、target、placement
6. acquisition、upgrade、economy
7. stage、enemy、unit量産
8. side mission、Challenge、future event
9. 50 stages、30 unitsを含むVersion 1.0統合

番号を守ること自体を目的にせず、完成体験、安全な移行、プレイヤー受入を優先する。

## 5. 完了済みの主要段階

### Version 0.5.0

- TAKUYA戦を準備、戦闘、敵拠点破壊、結果、再挑戦まで統合
- 戦場物資、航空支援、CRAWLER一斉掃射を導入
- スマートフォン横画面対応の基礎を確立

### Version 0.6.0

- タイトル、area map、Stage 1〜3、formation、battle、stars、rewards、unlock、local saveを統合
- 正式名称を「西新世紀末物語」へ変更
- stable ID、migration、corruption fallbackを導入

### Version 0.6.5

- スマートフォン主基準のHUD、placement、support、AI、save、audioを改善
- Safari保存拒否・消失対策を追加

### Version 0.7.0

- プレイアブル11名
- 最大7枠、3 presets
- caps、owned、discovered、acquisition、join state
- Stage 4〜6「西新駅地下編」
- 新敵、地下背景、event、audio
- save schema v5
- GitHub Pages正式公開

0.7.0実プレイで確認された問題は、0.7.1と0.7.5で解消する。

## 6. Version 0.7.1 — 進行阻害hotfix

Issue：#43

### 目的

公開中Version 0.7.0の進行阻害を、0.7.5の大規模基盤変更と分離して先行修正する。

### 対象

#### R0公開運用

- release requestをversion／SHA／Issue単位へ汎用化
- public QAの固定Version 0.7.0／Issue #37依存を撤廃
- 通常`main` pushやdocs-only mergeによる製品版自動deploymentを撤廃
- 明示的requestまたはmanual dispatchを正式deploymentとする

#### Stage 5

- stable ID維持
- 必須台車護衛を撤廃
- ホーム制圧・感染拠点破壊中心へ再設計
- 台車は背景演出、戦闘後搬送、または敗北条件でない副目標に限定
- save、stars、rewards、read state、Stage 6 unlock維持
- 3種類以上の編成でクリア可能

#### Stage 6

- ボスHPが504で停止する撃破不能不具合を再現・根本修正
- `504`だけを例外処理する応急修正は禁止
- damage、target／hit、invulnerability、phase、state、objective、victoryを切り分け
- 複数編成でHP0、victory、result、reward、map returnまで確認

### 非対象

- 固定3レーン撤廃
- 大規模AI刷新
- CRAWLER・敵拠点全面再設計
- acquisition／upgrade
- animation基盤刷新
- repository大規模整理

これらは0.7.5で行う。

## 7. Version 0.7.5 — コンテンツ量産基盤・戦闘品質再構築

Issue：#44

### 目的

- 50 stages、30 units以上へ拡張可能な製造ラインを作る
- 0.7.0実プレイの品質問題を共通基盤として解決する
- Codexの開発時間、使用量、変更漏れ、回帰不具合を減らす

### 主要対象

#### Repository／content pipeline

- runtimeとcontentの責任分離
- stable ID、display name、alias、migration整理
- units、enemies、stages、missions、waves、difficulty、rewards、acquisition、upgrades、events、assets、saveのデータ駆動化
- generator、schema、registry、loader、validator
- ID、references、assets、balance、economy、migration、synthetic scale tests
- fixtureによるunit／enemy／stage実追加ドリル

#### Battle space

- player-facing固定3レーン撤廃
- 連続した戦闘空間
- coordinate、distance、shape、area、line-of-sightによるcombat
- support placement preview、validity、reason、correction
- CRAWLERとenemy base再設計
- 味方・敵の自然な出撃・spawn
- smartphone一画面で把握しやすい構図

内部性能のためのpath node、navigation mesh、flow field、見えない移動帯は許可する。

#### AI／missions

- 味方・敵のbehavior profile
- contact、preferred range、priority、reroute、retarget、stuck recovery
- Stage 1〜6を新基盤へ移行
- Version 0.7.1のStage 5／6修正を回帰させない

#### Acquisition／progression

- 人員管理画面
- owned roster、acquisition、upgrade
- purchaseとupgradeへcapsを使用
- 全11 units共通のminimum viable progression
- 後発unit追いつき
- 最大強化、特定unit、過剰周回を本編必須にしない
- economy simulation

#### Visual／animation／VFX

- identity master、event portrait、formation card、battle sprite
- crop、focus、scale、anchor、safe area
- 新旧character表示統一
- タタラを含むscale・grounding標準化
- 可変frame animation clip
- weapon-specific VFX、SE、damage event同期
- machine gunの実連射・複数damage

#### いくらちゃん

- 18歳の成人女性
- 可愛さと現行r7以上の露出度を維持
- 露出量を減らさない
- 世界観適合は色調、素材、装備、通信端末、汚れ、擦れ、補修、使用感で行う

#### Event foundation

- battle event、side mission、high-difficulty、Challenge Mode、future timed eventを共通基盤で登録
- 別戦闘エンジンを作らない
- 0.7.5では大型eventや長尺storyを量産せず、入口と保存までを作る

#### Smartphone performance

- 844×390、844×340、WebKitを第一基準
- 0.7.1公開版baselineからperformance budgetを固定
- frame time、memory、long task、render、AI、audioを計測
- background停止、復帰後二重loop・二重audio 0

#### Save／audio

- stable IDs、owned、discovered、acquisition、upgrade、formation、stars、caps、unlock、read state、settingsを維持
- localStorage／IndexedDB、snapshot、last-known-good、corruption recovery、export／import
- story全文読み上げ／full voiceは実装しない
- 出撃、攻撃、被弾、戦闘不能の人間キャラクター戦闘voice、weapon sound、enemy voiceを維持

### 非対象

- 新規大量stage・unit制作
- 長尺story量産
- 大規模skill tree
- equipment inventory／rarity／gacha／覚醒／限界突破
- cloud save
- 無目的なengine全面書き直し
- 旧構造と新構造の永久二重管理

### 確認地点

1. いくらちゃん、CRAWLER、敵拠点の基準デザイン
2. release candidate最終実プレイ

最終実プレイ前に0.7.5を`main`へmerge、tag、Release、正式deploymentしない。

## 8. Version 0.8以降

0.7.5基盤完成後、次を段階的に進める。

- 新stage、enemy、unitの量産
- acquisition／upgrade balance拡張
- side missions
- Challenge Mode実装
- 新地域、病院、T計画中枢、人間敵を含むcampaign拡張
- 30 units、50 stagesへ向けたcontent production

各versionの対象と非対象は、着手時のProducer Decisionsで固定する。

## 9. Version 1.0

Version 1.0では、次を一つの完成ループとして統合する。

- 本編50 stagesを基準とするcampaign
- 30 playable unitsを基準とするroster
- acquisition、upgrade、formation、battle、rewards、save
- multiple missions、bosses、events
- smartphone／PC横画面
- local saveとmigration
- update可能なcontent pipeline

cloud save、DLC、追加CRAWLER等は、完成度、運用費、販売方針を別途判断する。
