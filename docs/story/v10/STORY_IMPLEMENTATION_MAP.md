# v10正史台本 — 実装差分マップ

更新日：2026-08-14  
性質：**派生資料。台本本文・Producer Decisionsを上書きしない。**

## 1. 読み取った物語の方向

v10は「30個の戦闘を追加する」だけの台本ではない。

物語の核は次の三段階である。

1. 目の前の一人を助ける
2. その救助を成立させる経路・病院・物流・封鎖網を取り戻す
3. その行動を実験・商品化へ利用していたムガリアンとセガワを断ち、西新へ生活を戻す

敵側の因果は次の順で開示される。

- 発生前から、ムガリアン製薬が医薬品、病院支援、災害物流、検疫設備、警備・封鎖へ浸透
- 序盤の赤レンズ部隊がTAKUYA遺骸と戦闘dataを回収
- ムガリアン社長は限定災害の商品化を企図したが、全滅思想ではなく規模を制御できなかった
- セガワは本物の薬・情報で実際に人を救わせながら、主人公側の実戦dataを収集
- Stage 27で赤レンズ部隊の正式名RED PANTHERとTAKUYA回収の意味が判明
- Stage 29でセガワが自発的にTAKUYA-Ωを起動
- Stage 30でTAKUYA-Ωがセガワを殺害し、撃破後の中和因子が初期感染者用血清へつながる

ENDINGは世界救済ではない。西新の安全回廊、病院、食事、店の灯りが戻る一方、外部との連絡と危機の全貌は不明のまま残る。

## 2. v10自身が示すpresentation contract

- 主人公は無言。台詞選択ではなく能動行動で物語を動かす。
- 基本構成は既存背景、左右event portrait、話者名、台詞欄、短いト書き、暗転、SYSTEM表示。
- 新規CGを大量制作しない。
- 腰上portraitと背景の再利用を基本に、環境音、fade、表情差分で密度を作る。
- 主要人物の死亡、裏切り、家族再会直後へ義務的なギャグを入れない。
- ハチ、ミズチ、ナオ、タタラ、レイダー、ガンテツ、モンキー等はplayableとして残すが、本編会話へ追加しない。

したがって、asset planは「全eventを固有一枚絵にする」のではなく、**再利用portrait／背景の有限inventoryを先に固定し、どうしても通常presentationで成立しない場面だけ追加画像候補にする**。

## 3. 台本に固定された30 Stage

| Stage | 名称／場所 | 中心人物 | このStageで変わるもの | 次へ進む必然 |
| ----- | :---- | :---- | :---- | :---- |
| 1 | 商店街・薬局救出 | いくらちゃん | 四人だけの帰還が、住民救助へ変わる | 区役所の最後の避難車両から救難 |
| 2 | 区役所・最後の一台 | パイセン | パイセンが怖いまま一人を待つ | 駅員室の生存情報を得る |
| 3 | 西新防衛線・TAKUYA | 全員／パイセン | 初の大型個体を倒す。赤レンズが遺骸回収 | 駅に閉じ込められた人を追う |
| 4 | 西新駅・閉鎖改札 | パイセン | 地下恐怖から逃げず、人の声を選ぶ | ホームの生存者と医療ケース |
| 5 | 西新駅・地下ホーム | いくらちゃん | 彼女の愛嬌と危うい機転が信頼へ変わる | 保守トンネルが病院へ接続 |
| 6 | 保守トンネル・赤い足跡 | ババヤガ | 正体不明の回収班と妻の通信痕跡 | 病院から救難 |
| 7 | 大学病院・救急搬入口 | クマバーソン | 「初期感染なら時間を稼げる」を知る | 薬と職員を求め病棟内へ |
| 8 | 救急病棟・残された時間 | パイセン | 救えない現実を知り、怒りを持つ | 病院地下の不審電力を追う |
| 9 | 地下機械室・ないはずの階 | いくらちゃん | 病院と企業研究区画の二重構造が露見 | 隠し除染ゲートが開く |
| 10 | 除染ゲート・T計画 | 全員 | 西新が実証フィールドだった痕跡 | 生存反応のある隔離区画へ |
| 11 | 検体隔離区画・MOTHER | クマバーソン | 発生前から大型検体がいたと判明 | 搬送票が地上物流線を示す |
| 12 | 搬送坑道・ザキミヤ | ザキミヤ | 妻子を探す臆病な父が仲間になる | 湾岸移送の中央台帳を追う |
| 13 | 物流線・セガワ | セガワ | 本物の薬と情報で信用の土台が生まれる | 民間貨物の救難へ |
| 14 | 貨物退避場・TKY | TKY／ババヤガ | TKY加入、チハの生存記録を発見 | 湾岸回線を開く必要 |
| 15 | 外郭制御区・声 | ババヤガ | 夫婦が声だけで生存を確かめる | 中央封鎖を止めなければ救援不能 |
| 16 | 中央封鎖区・三つの門 | 全員 | 湾岸への感染流入を止める | タワーへの一本の道が開く |
| 17 | 湾岸タワー・Mrs.チハ | ババヤガ／チハ | 再会。チハの異様な認証知識を初提示 | 市民資料館の全体台帳へ |
| 18 | 市民資料館・名前 | ザキミヤ／いくら | 妻子の生存確認。社長が表へ出る | 証拠を西新側へ逃がす |
| 19 | 海浜連絡橋・七秒 | パイセン／ザキミヤ | 怖がるパイセンが証拠車を運転 | 本社より先に帰る道を守る |
| 20 | 河口防潮門・帰れる道 | クマバーソン | 商店街〜病院の安全回廊が初めて繋がる | 守った生活を壊す会社へ進む |
| 21 | 物流本部・赤レンズ | チハ | チハが旧認証を使い、疑念が生まれる | 収容者の処分手順が起動 |
| 22 | 臨床試験棟・四十三人 | ザキミヤ | 妻子と再会。チハのコードネームが漏れる | 正体を問う前に追撃部隊が迫る |
| 23 | 特殊作戦庫・二つの顔 | チハ／ババヤガ | チハが会社の専属エージェントと告白し、身分証を焼く | 内部証拠で社長のいる塔へ |
| 24 | 技術開発塔・フタゴ | チハ／社長 | 限定災害の商品化と計画外の拡大が繋がる | 社長の退路を断つ |
| 25 | 役員研究所・市場の終わり | 社長 | 社長の未承認処置が暴走し、企業支配が終わる | 残存試料の撤収通報 |
| 26 | 撤収ヤード・観測対象 | いくら／パイセン | セガワが仲間を実戦観測していたと発覚 | 転送先の私設区画へ |
| 27 | 私設研究区画・RED PANTHER | セガワ | 部隊名、TAKUYA回収、西新選定の意味が繋がる | 次の都市への散布網を発見 |
| 28 | 全国散布管制網・次の街 | ザキミヤ | 西新だけの事件では終わらないと知る | 国外への一斉起動回線と感染源原株が地下に残る |
| 29 | 特級研究中枢・原本 | 主人公／セガワ | 拡散網と原本を破壊。セガワがTAKUYA-Ωを自発起動 | 巨体が西新へ向かう |
| 30 | 西新防衛線・TAKUYA-Ω | 全員 | セガワ死亡、最終個体撃破、中和因子を回収 | 西新奪還と初期治療へ |

## 4. Boss／加入／主要開示の配置

| Stage | 戦闘・boss | 物語上の新規要素 | gameplay／asset上の主な差分 |
|---:|---|---|---|
| 1 | 通常戦 | いくらちゃん救出・通信加入 | いくらちゃんは非戦闘支援かplayableかを分離。現行guide contractとの整合が必要 |
| 3 | TAKUYA | 赤レンズ部隊が遺骸回収 | 現行TAKUYAを再利用。回収sceneと後半伏線receiptが必要 |
| 5 | 改札喰い | 医療case・病院への接続 | 既存boss／station mechanicsの再利用監査 |
| 11 | MOTHER | 発生前の大型検体 | 既存giant boss contractの再利用監査 |
| 12 | 通常戦＋ザキミヤ登場 | ザキミヤが火炎瓶で参戦 | 既存ザキミヤassetを使用。台本「加入」とCAPS雇用の整合 |
| 13 | 通常戦 | セガワ初登場・信用形成 | 新規Segawa event portrait |
| 14 | オオグチ | TKY加入、チハ生存記録 | 既存boss／TKY asset。雇用解放契約 |
| 17 | クロメ | Mrs.チハ再会・加入 | 既存boss／Chiha asset。認証能力と雇用解放 |
| 20 | ガイレン | 安全回廊成立、宮本武蔵加入 | 既存boss／Musashi asset。他mode解放との接続 |
| 21 | RED PANTHER | ムガリアン本部へ突入 | 新規人型敵family、AI、weapons、battle atlas、masked event read |
| 22 | RED PANTHER追撃 | ザキミヤ家族再会、CH-17露見 | 量産兵再利用。家族はminor portrait／radio表現を含め最小構成化 |
| 23 | RED PANTHER | チハ告白・身分証焼却 | 指揮官兵を含む敵構成。重要dialogue presentation |
| 24 | フタゴ | 社長・セガワの対立が可視化 | 既存boss＋新規社長event portrait |
| 25 | 変異ムガリアン社長 | 企業支配の終焉 | 新規boss identity、battle atlas、telegraph、compendium、defeat |
| 27 | RED PANTHER | 正式名称、セガワ黒幕、TAKUYA回収の意味 | 四兵種を正式名称で表示。Segawa主要portrait |
| 28 | 通常／施設防衛 | 全国散布網停止 | 新規stage objective／control objects |
| 29 | 研究中枢戦 | 感染源原株と国外回線破壊、TAKUYA-Ω起動 | source-strain object、network objective、escape transition |
| 30 | TAKUYA-Ω | セガワ死亡、中和因子回収 | 約2倍giant boss、既存TAKUYA identity継承、cinematic death、sample recovery、ending transition |

## 5. 現行mainとの差分

調査時点：

- live `main`：`55d796cc577d1d9f903a4d2c6b4382196511db27`
- tree：`0f8a5fb417ccca595d485d22c2c3cbe240b6ee28`
- `app/releaseIdentity.js`：Version 0.9.9.5
- `docs/PROJECT_STATE.md`：Version 0.9.9.0時点の記述が残っているため、作業開始時はlive GitHubを優先して再取得する
- 本編：20 Stage
- story script：`outbreak-origin-v8`。PROLOGUEとStage 1〜6を中心とするevent registry
- playable units：16
- current initial units：パイセン、ハチ、ミズチ、ナオ、クマバーソン、ババヤガ
- deployment cost最安：ハチ25
- unit progression：内部最大Level 50、公開上限25、Stage milestoneによる段階解放
- support：新しい`pod／drum／medical`系と互換`barrel／medkit／molotov／airstrike`系が併存
- campaign boss：TAKUYA、改札喰い、クロメ等
- outbreak boss：MOTHER、オオグチ、クロメ、ガイレン、フタゴ
- save：localStorage、IndexedDB backup、replica reconciliation、manual import/export、migration／receiptを持つ
- visual profile：既存playableといくらちゃんのidentity master／event portrait／card／battle sprite contractが存在

### 5.1 物語system

現行`storyEvents.js`を単純に長大化するだけでは不十分。

必要な設計：

- 30 Stage分のpre／mid-battle／post／defeat／retry／replay eventの有限registry
- CHAPTER、ENDING、EPILOGUEのflow
- event read receiptとscript version reset
- 主人公名入力を採用する場合の保存・表示・fallback・文字数・禁止文字
- event portrait／background／ambience／BGM／battle barkのasset dependency
- Stage内PLAYER actionと実際のbattle objectiveの一致
- skip／auto-skip read／replay時に重要unlockを飛ばさないcontract
- 45文字上限をdata validationで検査しつつ、意味の切れ目以外で機械分割しない運用

### 5.2 Campaign progression

20 Stageから30 Stageへ増やすため、次を同時に再設計する。

- stable stage IDとregion
- map position／chapter grouping
- objective type／config
- waves／enemy family／boss
- pre／post event ID
- next stage
- unit discovery／recruitable／ownership
- support unlock
- level cap milestone
- boss other-mode unlock
- compendium
- CAPS reward
- records
- save normalization
- QA fixture

既存20 StageのIDを維持できる部分と、v10の場所・任務・因果に合わず再定義が必要な部分をSolがstage-by-stageで分類する。番号だけを流用して中身の意味を変える場合は、old saveを新進行へ誤適用しないgeneration境界が必要。

### 5.3 Economy

次を一体でmodel化する。

- Stage 1〜30の総CAPS供給
- first-clear、star、replay、他mode報酬
- 初期4体のdeployment cost
- 雇用cost
- level-up cost
- support解禁／購入cost
- 7体上限による低コストunit価値
- catch-up discount
- 旧プレイヤー記念CAPS

設計出力には少なくとも三つのplayer simulationを含める。

1. 必要最低限だけ購入する初見player
2. 複数unitを試す標準player
3. replay／他modeを多く遊ぶ育成player

各章boss前の想定owned roster、median level、未使用CAPS、必要戦闘回数を示す。CAPS不足で一本道になる設計と、全員を即時購入できる過剰供給の両方を避ける。

### 5.4 7体上限

現行のdeployment処理、fighter lifecycle、death／retreat、duplicate spawn、manual ability、一時召喚を調べ、次を固定する。

- count対象
- count更新timing
- 死亡animation中のslot
- retreat中のslot
- 再召喚
- NPC／escort
- support object
- UIの現在数／上限表示
- 8体目拒否feedback
- keyboard／touch／rapid input／double tapのrace
- save pending／pause／battle resume

単なるUI disabledではなく、authoritative battle state側で8体目を拒否する。

### 5.5 Support

`BATTLEFIELD_SUPPLY_DEFS`と`SUPPORT_DEFS`の二重性を監査し、次を一本化する。

- player-facing名称
- unlock／purchase
- battle内resource
- placement
- cooldown
- object lifecycle
- damage／healing
- animation／effect／audio
- asset decode gate
- input
- tutorial
- records／QA

「回復」「ドラム缶」「火炎ドラム缶」とCRAWLER固有能力を同じ分類へ無理に押し込まない。

### 5.6 Boss unlock

現行は一部bossがOutbreak mission clear後にSurvivalへ追加される。Producer要求はStory撃破状況との連動である。

Solは各bossについて、少なくとも次を表にする。

- Story encounter Stage
- Story defeat receipt
- compendium discovery
- Outbreak mission unlock
- Survival pool unlock
- first-clear reward
- duplicate defeat count
- spoiler prevention
- replay behavior

TAKUYAとTAKUYA-Ωを同一kindへ上書きせず、identity／boss ID／reward／compendiumを分離する。

## 6. Asset inventory

### 6.1 新規必須

| Asset family | Event portrait | Identity/full-body master | Battle atlas | 補足 |
|---|---:|---:|---:|---|
| ムガリアン社長・通常 | 必須 | 推奨 | 不要 | Stage 24〜25の交渉・恐怖を表情で読ませる |
| 変異ムガリアン社長 | boss read用必須 | 必須 | 必須 | Stage 25 boss |
| セガワ | 必須 | 推奨 | 原則不要 | Stage 13、26〜30。player combatantではない |
| RED PANTHER近接兵 | 汎用masked read可 | 必須 | 必須 | survival knife |
| RED PANTHER盾兵 | 汎用masked read可 | 必須 | 必須 | shield silhouette |
| RED PANTHER SMG兵 | 汎用masked read可 | 必須 | 必須 | ranged fire |
| RED PANTHER指揮官兵 | 必須候補 | 必須 | 必須 | command read／上位個体 |
| TAKUYA-Ω | 必須 | 必須 | 必須 | 現行TAKUYA継承、約2倍 |
| ナオキ | 未決定 | 未決定 | 未決定 | 顔reference受領後も役割確定まで生成停止 |

### 6.2 既存assetを先に監査

- パイセン
- クマバーソン
- ババヤガ
- いくらちゃん
- ザキミヤ
- TKY
- Mrs.チハ
- 宮本武蔵
- マヨちゃん
- クレイジーキング
- TAKUYA
- 改札喰い
- MOTHER
- オオグチ
- クロメ
- ガイレン
- フタゴ

existing event portraitは「ファイルがある」だけで合格にしない。844×390／844×340等で顔、腰上、武器、speaker side、台詞欄との重なりを確認する。

### 6.3 Stage／scene image

Solは30 Stageを次の三分類へ分ける。

- `REUSE`：現行背景・objectでv10の場所と行動を表せる
- `RECOMPOSE`：既存背景へ新規object／lighting／damage layerを組み合わせる
- `NEW_REQUIRED`：物語・objectiveが成立せず新規stage backgroundが必要

一枚event imageは別枠で、次を満たす場合だけ`NEW_REQUIRED`にする。

- 通常の左右portrait＋背景では、誰が何をしたか誤解される
- battle runtimeへ実装できないが、物語上不可欠な一回の行動
- 既存assetのcrop／compositeでは品質が成立しない

大量の一枚絵を「豪華に見せるため」だけに追加しない。

## 7. 主な対象module

Solは最低限次をread-onlyで調査する。pathが移動している場合はlive treeを優先する。

- `app/campaign.js`
- `app/storyEvents.js`
- `app/storyFlow.js`
- `app/storyBattleBarks.js`
- `app/CampaignScreens.tsx`
- `app/AshfallGame.tsx`
- `app/content/unitCatalog.js`
- `app/content/enemyCatalog.js`
- `app/unitProgression.js`
- `app/campaignEconomy.js`
- `app/gameRules.js`
- `app/battleDefinitions.js`
- `app/bossFoundation.js`
- `app/bossAnomalies.js`
- `app/outbreakMissions.js`
- `app/survival.js`
- `app/survivalBattleRuntime.js`
- `app/visualProfiles.js`
- `app/spriteManifest.js`
- `app/productionVisuals.js`
- `app/stageObjectManifest.js`
- `app/stageGeometry.js`
- `app/battleAssetPlan.js`
- `app/campaignStorage.js`
- asset manifest／Service Worker／release identity
- campaign／story／economy／boss／save／browser QA tests

`AshfallGame.tsx`へ全機能を直書きするDesignは避け、data、state、runtime、render、asset、persistence責務を分離する。

## 8. Source上の衝突・未解決

### 8.1 主人公名

v10はPROLOGUEで主人公名入力`{{PLAYER_NAME}}`を使用する。旧Story Bibleは主人公名入力なし・UI呼称「指揮官」を固定していた。v10本文を優先するならname input systemが新規に必要だが、Producer Decisionsとしてまだ明示確定していない。

### 8.2 「加入」とCAPS購入

v10はザキミヤ、TKY、Mrs.チハ、宮本武蔵をSYSTEM上で「加入」と表示する。一方、Producerは指定時期にCAPS購入で導入する方針を示している。

可能なDesignは複数ある。

- narrative partyへ加入し、battle deployment license／装備調達をCAPS購入
- Stage clearでrecruitableになり、購入後に正式加入表示
- 一部だけstory join、他はCAPS purchase

Solは台本の意味、既存雇用UI、プレイヤー期待を比較し、推奨案をdecision packetへ返す。独自に台詞を変えない。

### 8.3 ナオキ

v10本文にはナオキが存在しない。セガワは別名・別人物として明示されている。ナオキの顔referenceを受け取っても、同一人物扱いまたは置換をしてはならない。

### 8.4 Save

Producerの「ニューゲーム前提」は旧data削除の許可ではない。旧player rewardを成立させるには旧dataが必要であり、現行のbackup／recovery契約とも衝突する。非破壊のgeneration切替が必要。

## 9. Design acceptanceの最低線

Sol Design Lockには、最低限次が必要。

- 30 Stage全件のcurrent→target mapping
- event inventory全件
- character／speaker／portrait inventory
- enemy／boss／battle asset inventory
- stage background／object／scene image classification
- economy simulation
- unlock calendar
- 7体上限contract
- support contract
- boss cross-mode contract
- save generation／legacy reward contract
- version／release boundary
- PR分割と依存順
- positive／negative／browser／PWA／save QA plan
- High-risk rollback plan
- Producer decision packet
- Luna handoff

設計上の不明点を「実装しながら考える」へ送らない。
