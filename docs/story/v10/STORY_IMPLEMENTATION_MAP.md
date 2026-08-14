# v10正史台本 — Version 1.0.0実装差分マップ

更新日：2026-08-14  
性質：**派生資料。台本本文・Producer Decisions・最新Design Lockを上書きしない。**

## 1. 物語の方向

v10は「30個の戦闘を追加する」だけの台本ではない。

物語の核は次の三段階である。

1. 目の前の一人を助ける
2. 救助を成立させる経路、病院、物流、封鎖網を取り戻す
3. その行動を実験・商品化へ利用したムガリアンとセガワを断ち、西新へ生活を戻す

敵側の因果は次の順で開示される。

- 発生前からムガリアン製薬が医薬品、病院支援、災害物流、検疫設備、警備・封鎖へ浸透
- 序盤の赤レンズ部隊がTAKUYA遺骸と戦闘dataを回収
- ムガリアン社長は限定災害の商品化を企図したが、規模を制御できなかった
- セガワは本物の薬・情報で人を救わせながら、主人公側の実戦dataを収集
- Stage 27で赤レンズ部隊の正式名RED PANTHERとTAKUYA回収の意味が判明
- Stage 29でセガワが自発的にTAKUYA-Ωを起動
- Stage 30でTAKUYA-Ωがセガワを殺害し、撃破後の中和因子が初期感染者用血清へつながる

ENDINGは世界救済ではない。西新の安全回廊、病院、食事、店の灯りが戻る一方、外部との連絡と危機の全貌は不明のまま残る。

## 2. Presentation contract

- 主人公は無言。台詞選択ではなく能動行動で物語を動かす。
- ニューゲーム時に主人公名を入力する。未入力／skip時は`指揮官`、最大12 grapheme。
- `{{PLAYER_NAME}}`／`{{PLAYER_NAME_SAN}}`はsave、event、ENDING／EPILOGUE、export／import、accessibilityで同一contractを使用する。
- 基本構成は既存背景、左右event portrait、話者名、台詞欄、短いト書き、暗転、SYSTEM表示。
- 新規CGを大量制作しない。
- 腰上portraitと背景の再利用を基本に、環境音、fade、表情差分で密度を作る。
- 主要人物の死亡、裏切り、家族再会直後へ義務的なギャグを入れない。
- ハチ、ミズチ、ナオ、タタラ、レイダー、ガンテツ、モンキー等はplayableとして残すが、本編会話へ無理に追加しない。

asset planは、再利用portrait／背景の有限inventoryを先に固定し、通常presentationでは意味が欠落する場面だけ追加画像対象にする。

## 3. 台本に固定された30 Stage

| Stage | 名称／場所 | 中心人物 | このStageで変わるもの | 次へ進む必然 |
|---:|---|---|---|---|
| 1 | 商店街・薬局救出 | いくらちゃん | 四人だけの帰還が住民救助へ変わる | 区役所の最後の避難車両から救難 |
| 2 | 区役所・最後の一台 | パイセン | 怖いまま最後の一人を待つ | 駅員室の生存情報を得る |
| 3 | 西新防衛線・TAKUYA | 全員／パイセン | 初の大型個体を倒し、赤レンズが遺骸回収 | 駅に閉じ込められた人を追う |
| 4 | 西新駅・閉鎖改札 | パイセン | 地下恐怖から逃げず、人の声を選ぶ | ホームの生存者と医療case |
| 5 | 西新駅・地下ホーム | いくらちゃん | 愛嬌と危うい機転が信頼へ変わる | 保守トンネルが病院へ接続 |
| 6 | 保守トンネル・赤い足跡 | ババヤガ | 正体不明の回収班と妻の通信痕跡 | 病院から救難 |
| 7 | 大学病院・救急搬入口 | クマバーソン | 初期感染なら時間を稼げると知る | 薬と職員を求め病棟内へ |
| 8 | 救急病棟・残された時間 | パイセン | 救えない現実を知り、怒りを持つ | 病院地下の不審電力を追う |
| 9 | 地下機械室・ないはずの階 | いくらちゃん | 病院と企業研究区画の二重構造が露見 | 隠し除染gateが開く |
| 10 | 除染ゲート・T計画 | 全員 | 西新が実証fieldだった痕跡 | 生存反応のある隔離区画へ |
| 11 | 検体隔離区画・MOTHER | クマバーソン | 発生前から大型検体がいたと判明 | 搬送票が地上物流線を示す |
| 12 | 搬送坑道・ザキミヤ | ザキミヤ | 妻子を探す臆病な父が合流 | 湾岸移送の中央台帳を追う |
| 13 | 物流線・セガワ | セガワ | 本物の薬と情報で信用の土台が生まれる | 民間貨物の救難へ |
| 14 | 貨物退避場・TKY | TKY／ババヤガ | TKY合流、チハの生存記録を発見 | 湾岸回線を開く必要 |
| 15 | 外郭制御区・声 | ババヤガ | 夫婦が声だけで生存を確かめる | 中央封鎖を止めなければ救援不能 |
| 16 | 中央封鎖区・三つの門 | 全員 | 湾岸への感染流入を止める | タワーへの一本の道が開く |
| 17 | 湾岸タワー・Mrs.チハ | ババヤガ／チハ | 再会。チハの異様な認証知識を提示 | 市民資料館の全体台帳へ |
| 18 | 市民資料館・名前 | ザキミヤ／いくら | 妻子の生存確認。社長が表へ出る | 証拠を西新側へ逃がす |
| 19 | 海浜連絡橋・七秒 | パイセン／ザキミヤ | 怖がるパイセンが証拠車を運転 | 本社より先に帰る道を守る |
| 20 | 河口防潮門・帰れる道 | クマバーソン | 商店街〜病院の安全回廊が繋がる | 守った生活を壊す会社へ進む |
| 21 | 物流本部・赤レンズ | チハ | 旧認証を使い、疑念が生まれる | 収容者の処分手順が起動 |
| 22 | 臨床試験棟・四十三人 | ザキミヤ | 妻子と再会。チハのcode nameが漏れる | 追撃部隊が迫る |
| 23 | 特殊作戦庫・二つの顔 | チハ／ババヤガ | 旧専属agentと告白し、身分証を焼く | 内部証拠で社長のいる塔へ |
| 24 | 技術開発塔・フタゴ | チハ／社長 | 限定災害の商品化と計画外拡大が繋がる | 社長の退路を断つ |
| 25 | 役員研究所・市場の終わり | 社長 | 未承認処置が暴走し、企業支配が終わる | 残存試料の撤収通報 |
| 26 | 撤収ヤード・観測対象 | いくら／パイセン | セガワが仲間を実戦観測していたと発覚 | 転送先の私設区画へ |
| 27 | 私設研究区画・RED PANTHER | セガワ | 部隊名、TAKUYA回収、西新選定が繋がる | 次の都市への散布網を発見 |
| 28 | 全国散布管制網・次の街 | ザキミヤ | 西新だけの事件では終わらない | 国外一斉起動回線と感染源原株が残る |
| 29 | 特級研究中枢・原本 | 主人公／セガワ | 拡散網と原株を破壊。TAKUYA-Ω起動 | 巨体が西新へ向かう |
| 30 | 西新防衛線・TAKUYA-Ω | 全員 | セガワ死亡、最終個体撃破、中和因子回収 | 西新奪還と初期治療へ |

## 4. Boss／合流／主要開示

| Stage | 戦闘・boss | 物語上の新規要素 | gameplay／asset上の主な差分 |
|---:|---|---|---|
| 1 | 通常戦 | いくらちゃん救出 | guide contract。ナオの戦闘配備登録を解禁 |
| 3 | TAKUYA | 赤レンズ部隊が遺骸回収 | 現行TAKUYA再利用、回収scene、後半伏線receipt |
| 5 | 改札喰い | 医療case、病院接続 | 既存boss／station mechanics再利用監査 |
| 11 | MOTHER | 発生前の大型検体 | 既存giant boss contract再利用監査 |
| 12 | 通常戦＋ザキミヤ | 火炎瓶で参戦、物語上合流 | 既存asset、Stage clear後に戦闘配備登録を解禁 |
| 13 | 通常戦 | セガワ初登場、信用形成 | 添付face referenceから新規event portrait |
| 14 | オオグチ | TKY合流、チハ生存記録 | 既存boss／TKY asset、戦闘配備登録を解禁 |
| 17 | クロメ | Mrs.チハ再会 | 既存boss／Chiha asset、戦闘配備登録を解禁 |
| 20 | ガイレン | 安全回廊成立、宮本武蔵合流 | 既存boss／Musashi asset、戦闘配備登録を解禁 |
| 21 | 赤レンズ人型部隊 | ムガリアン本部へ突入 | 新規human enemy family、spoiler-safe label |
| 22 | 赤レンズ追撃 | 家族再会、CH-17露見 | 量産兵再利用、家族portraitは最小構成 |
| 23 | 赤レンズ部隊 | 告白、身分証焼却 | 指揮官兵を含む構成、重要dialogue |
| 24 | フタゴ | 社長・セガワの対立 | 既存boss＋社長event portrait |
| 25 | 変異ムガリアン社長 | 企業支配の終焉 | 新規boss identity／atlas／telegraph／defeat |
| 27 | RED PANTHER | 正式名称、セガワ黒幕、TAKUYA回収 | 正式名解禁receipt、Segawa portrait |
| 29 | 通常戦／中枢破壊 | 感染源原株破壊、TAKUYA-Ω起動 | 原株object、起動演出、final transition |
| 30 | TAKUYA-Ω | セガワ死亡、中和因子 | 新規giant boss、ENDING／EPILOGUE接続 |

## 5. 正式balance差分

### 5.1 初期編成

現行initial 6体から次の4体へ変更する。

- ハチ／skirmisher
- パイセン／frontline
- クマバーソン／heavy
- ババヤガ／marksman

ハチは低cost枠として確定。ナオはStage 1 clear後、Stage 1 first-clear CAPSだけで登録可能にする。

### 5.2 Class access

一次roleは7系統。

- frontline
- heavy
- skirmisher
- marksman
- suppression
- support
- engineer

suppressionはStage 4まで、engineer／controlはStage 6まで、追加heavy／breakerはStage 8までに少なくとも1体を解禁し、Stage 8開始時点で全7 roleへアクセス可能にする。

classはhard quotaではなく、enemy threatとobjectiveから自然に複数roleが必要になるソフト必須設計とする。exact named unit必須は禁止する。

### 5.3 Formation／active cap

- formation最大7体
- battle active最大7体
- 同じ固有characterは同時に1体
- support／装甲車両／NPC／enemyは7枠外
- 独立target／HP／damageを持つplayer-controlled summonは7枠内
- 8体目、同一character 2体目をbattle stateでatomic reject

現行の無制限deploymentと同一character spamを廃止する。

### 5.4 Support

正式支援は3種。

- 回復支援：Stage 2〜3で解禁
- 爆薬ドラム缶：Stage 5〜7で解禁
- 火炎ドラム缶：Stage 9〜11で解禁

exact Stageは他のmajor unlockと重複しないようSolが固定する。1 sortieへ1種装備。CAPSは恒久unlock、battle内はlocal resource＋cooldown。航空支援／一斉砲撃は装甲車両固有abilityとして別systemにする。

### 5.5 Level cap

- New Game：5
- Stage 5：10
- Stage 10：15
- Stage 15：20
- Stage 20：25
- Stage 25：30

Version 1.0.0 campaignの表示最大levelは30。内部50基盤は将来／他mode用に保全し、campaign UIからLevel 31〜50へ到達させない。

### 5.6 Difficulty／viable composition

- 単一のhardcore-but-fair campaign。hidden runtime DDA／player level連動hidden scalingは禁止。
- tutorial以外の通常Stageは3種類以上、専門bossは2種類以上の明確に異なる合法編成でrecommended cap内clear可能にする。
- 1 starで次Stageを解禁。2／3 starは任意mastery。
- retryは無料。敗北でCAPS、unit、装備、story progressを失わない。
- exact enemy compositionは隠し、脅威categoryと推奨role／counter tagを2〜4件表示する。

## 6. Boss cross-mode

Story bossごとに次を別state／receiptへ分離する。

- encounter
- Story defeat
- compendium partial／full reveal
- rematch
- Outbreak unlock
- Survival pool unlock
- first-clear reward
- repeat reward
- defeat count
- replay behavior
- spoiler prevention

TAKUYAとTAKUYA-Ωを同一kindへ上書きせず、identity、boss ID、reward、compendiumを分離する。

## 7. Asset inventory

### 7.1 新規必須

| Asset family | Event portrait | Identity/full-body master | Battle atlas | 補足 |
|---|---:|---:|---:|---|
| ムガリアン社長・通常 | 必須 | 推奨 | 不要 | Stage 24〜25の交渉と恐怖 |
| 変異ムガリアン社長 | boss read用必須 | 必須 | 必須 | Stage 25 boss |
| セガワ | 必須 | 推奨 | 不要 | 添付写真はセガワ専用private face reference。原写真はrepo／Issue／PR／CI artifact非保存 |
| 赤レンズ近接兵 | 汎用masked read可 | 必須 | 必須 | survival knife |
| 赤レンズ盾兵 | 汎用masked read可 | 必須 | 必須 | shield silhouette |
| 赤レンズSMG兵 | 汎用masked read可 | 必須 | 必須 | ranged fire |
| 赤レンズ指揮官兵 | 必須候補 | 必須 | 必須 | command read／上位個体 |
| TAKUYA-Ω | 必須 | 必須 | 必須 | 現行TAKUYA継承、約2倍 |

`ナオキ`という別character、alias、ID、画像対象は存在しない。

### 7.2 既存assetを先に監査

- パイセン
- ハチ
- クマバーソン
- ババヤガ
- いくらちゃん
- ナオ
- ミズチ
- タタラ
- レイダー
- ガンテツ
- モンキー
- クレイジーキング
- ザキミヤ
- TKY
- Mrs.チハ
- 宮本武蔵
- マヨちゃん
- TAKUYA
- 改札喰い
- MOTHER
- オオグチ
- クロメ
- ガイレン
- フタゴ

existing assetは「ファイルがある」だけで合格にせず、identity、性別、顔、武器、腰上crop、speaker side、844×390／844×340での読みを確認する。

### 7.3 Stage／scene image

全Stageを次へ分類する。

- `REUSE`：現行背景・objectで場所と行動を表せる
- `RECOMPOSE`：既存背景へ新規object／lighting／damage layerを組み合わせる
- `NEW_REQUIRED`：物語・objectiveが成立せず新規背景が必要
- `OPTIONAL`：品質向上候補だがrelease blockerではない

一枚event imageは、通常の左右portrait＋背景で行動が誤解される、battle runtimeへ実装できない不可欠な一回行動、既存compositeで品質不成立のいずれかに限る。

## 8. 合流／CAPS／主人公名の解決

### 8.1 合流とCAPS

- 物語上の参加は`合流`。
- gameplayで戦闘使用条件が開くことは`戦闘配備登録が解禁`。
- CAPS支払いactionは`配備登録`。
- CAPSは武器、装備、訓練、医療、輸送、補給を含む戦力化cost。
- 人間の忠誠をCAPSで買う表現にしない。
- 初期4体以外は原則、合流／発見後にCAPSで配備登録する。

### 8.2 主人公名

- v10の名前入力を採用する。
- 未入力／skipは`指揮官`。
- 最大12 grapheme、安全なtext描画、制御文字／bidi制御／悪用zero-width文字拒否。
- token、save、export／import、ENDING／EPILOGUE、accessibilityで同一値を使う。

### 8.3 セガワface reference

- 添付写真はセガワ本人用。ナオキではない。
- 原写真、metadata、撮影背景をpublic repository、runtime、Issue、PR、CI artifact、QA evidenceへ保存しない。
- derived Segawa authoring master／event portraitだけを正式asset候補にできる。

## 9. Save

ニューゲーム前提は旧data削除の許可ではない。

- 旧20 Stage進行は新30 Stageへ変換しない
- 旧save／backup／manual exportを保持
- 新campaign generation／namespaceを使用
- 旧player eligibilityをread-only検出
- 記念CAPSをpopup付きで一度だけ付与
- reload／replica／multiple tabs／import／recoveryで二重付与不可
- resetは新campaignだけを対象
- settingsだけを安全に分離できる場合は引き継いでよい

## 10. 現行mainとの差分

baseline作成時点：

- live `main`：`55d796cc577d1d9f903a4d2c6b4382196511db27`
- tree：`0f8a5fb417ccca595d485d22c2c3cbe240b6ee28`
- release identity：Version 0.9.9.5
- 本編：20 Stage
- story script：`outbreak-origin-v8`。PROLOGUEとStage 1〜6中心
- playable：16体
- current initial：6体
- current campaign progression：内部Level 50／公開上限25
- support：`pod／drum／medical`と互換`barrel／medkit／molotov／airstrike`が併存
- save：localStorage、IndexedDB backup、replica reconciliation、manual import／export、migration／receiptあり

20→30 Stage、4 initial、7 role、active 7、unique unit、Level 30、三支援、human enemy、new bosses、新campaign generationへ統合する。

## 11. 主な対象module

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

`AshfallGame.tsx`へ全機能を直書きせず、data、state、runtime、render、asset、persistence責務を分離する。

## 12. Design acceptance最低線

Sol Design Lockには最低限次が必要。

- 30 Stage current→target mapping
- event inventory全件
- character／speaker／portrait inventory
- enemy／boss／battle asset inventory
- stage background／object／scene classification
- role／counter matrix
- minimal／standard／completionist economy simulation
- unlock／配備登録calendar
- formation 7＋active 7＋same-character 1 contract
- normal Stage 3編成／boss Stage 2編成のviability evidence
- support contract
- boss cross-mode contract
- save generation／legacy reward contract
- Version 1.0.0 release boundary
- PR分割と依存順
- positive／negative／browser／PWA／save QA
- rollback／stop conditions
- Segawa identity／portrait contract
- asset generation prompts／selected authoring masters
- Luna Handoff

本書とProducer Decisionsで解決済みの事項を、再びProducer decision packetへ戻さない。設計上の不明点を「実装しながら考える」へ送らない。