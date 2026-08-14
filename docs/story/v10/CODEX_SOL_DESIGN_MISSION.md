# Codex Sol Design Mission — v10正史・30 Stage正式リリース

この文書は、最初のSol threadへ送るDesign missionの正本である。  
この段階ではproduction implementation、merge、releaseを行わない。

---

`/goal`

`ROLE_LOCK: SOL_DESIGN`

## MISSION

`西新世紀末物語`のv10正史台本を、PROLOGUEからStage 30、ENDING、EPILOGUEまで一括実装できる**正式リリース用Design Lock**へ変換してください。

これは台本貼付やStage追加だけのmissionではありません。現行game全体を調査し、story、battle、campaign progression、CAPS economy、unit recruitment、level progression、support、boss cross-mode unlock、art、animation、effect、audio、save、PWA、QA、release boundaryを30 Stage構成へ統合してください。

## 1. 最初に読む正本

次を順番どおり読み、live repositoryと照合してください。

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_SOL_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. `docs/story/v10/README.md`
6. `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`
7. `docs/story/v10/STORY_SCRIPT_V10.md`
8. `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`
9. `docs/ASSET_STORAGE_POLICY.md`
10. 関連する現行code、tests、asset manifests、QA scripts、open Issue／PR

`docs/PROJECT_STATE.md`の記述を永久に最新とは見なさず、作業開始時に`main`、release、open PR、workflow、current versionをlive GitHubから再取得してください。

このmission作成時に観測した`main`は次です。

- HEAD：`55d796cc577d1d9f903a4d2c6b4382196511db27`
- tree：`0f8a5fb417ccca595d485d22c2c3cbe240b6ee28`
- release identity：Version 0.9.9.5

開始時に値が変わっていればlive値を採用し、Design Lockへactual baselineを記録してください。

## 2. 最初の返答

最初の進行報告で必ず次を示してください。

- `ROLE_LOCK: SOL_DESIGN`
- actual baseline branch／HEAD／tree
- current release identity
- 読み込んだ正本一覧
- open PR／branch conflict
- このDesign missionでcode実装を行わないこと
- 最初に調査するmodule群
- 既に検出したsource conflictがあれば、その一覧

調査可能な事項をProducerへ質問して止まらず、repository、台本、tests、assetsから先に解決してください。

## 3. 物語上の絶対条件

- v10本文を正本とする。
- 主人公は無言だが、扉を開ける、最後の一人を待つ、証拠を複製する、避難路の前に立つ等の能動行動で物語を動かす。
- 物語の中心は、世界規模の陰謀説明ではなく、目の前の人を助けて西新へ生活を戻すこと。
- ムガリアン製薬を、医薬品、病院支援、災害物流、検疫設備、警備・封鎖へ浸透した企業として段階的に理解させる。
- RED PANTHERの正式名称はStage 27まで伏せる。
- ムガリアン社長は限定災害を市場化しようとした経営者であり、人類絶滅主義者へ改変しない。
- 真の黒幕はネコ殺しのセガワ特級博士。
- セガワは本物の薬と情報で人を救わせながら実戦dataを収集し、Stage 30でTAKUYA-Ωに殺される。
- Mrs.チハの旧ムガリアンagent設定、告白、身分証焼却、ババヤガとの関係を維持する。
- 完全変異の治療は不可能。TAKUYA-Ωの中和因子から、感染初期に限る試験血清へ到達する。
- ENDINGで世界が救済済みとはしない。
- ハチ、ミズチ、ナオ、タタラ、レイダー、ガンテツ、モンキー等を本編会話へ無理に追加しない。
- 新規CG大量制作を前提にしない。reusable background＋左右腰上portrait＋dialogue＋短い演出を主軸にする。

## 4. Producer固定要件

### 4.1 初期unit

初期使用可能unitは4体だけです。

- ババヤガ
- クマバーソン
- パイセン
- 低コストunit 1体

現行codeではハチがcost 25で最安のため第一候補ですが、正式名はProducer未確定です。repository上の役割、Stage 1 balance、既存identityを検査し、ハチを推奨するか、別案が必要かをdecision packetへ返してください。

### 4.2 同時出撃上限

playable unitの戦場同時出撃上限を7体にします。

Design Lockでは次を明示してください。

- authoritative count source
- spawn、death、retreat、revive、re-deployのslot timing
- NPC、escort、temporary summon、support objectの扱い
- touch／keyboard／rapid input／double actionのrace防止
- 8体目のreject UI／SE
- test contract

UIだけでなくbattle stateで強制してください。

### 4.3 Unit recruitment

- Story characterは指定の物語timingでCAPS購入導線を開く。
- Story外unitも適切なStageでCAPS購入可能にする。
- 回復役は早期に解禁する。
- 同一Stageへ大きなunlockを重複配置しない。
- 台本の「加入」とCAPS購入制の意味を整合させる。
- 台本をsilent rewriteせず、必要ならProducer decisionとして差分を返す。

### 4.4 Support

Stage進行とCAPS購入で次を解禁します。

- 回復
- ドラム缶
- 火炎ドラム缶

現行の`pod／drum／medical`と`barrel／medkit／molotov／airstrike`の二重系を調査し、最終player-facing contract、CRAWLER固有能力、battle内cost、cooldown、placement、animation、effect、audio、assetを一本化してください。

### 4.5 Level cap／economy

level cap、CAPS額、unlock timingを推測で固定しないでください。

30 Stage、7体上限、雇用費、level-up費、support、boss、他mode、旧player rewardを一つのeconomy modelで試算し、次を出してください。

- Stage別base／first-clear／star／replay CAPS
- unit別recruitment cost
- unit別deployment cost／cooldown
- chapter別level cap
- Stageごとの想定owned roster／median level／残CAPS
- minimal、standard、completionistの三simulation
- 推奨案と代案
- grind、過剰供給、一本道化のrisk
- 実機playtestで調整できるtuning surface

### 4.6 Boss cross-mode unlock

Story撃破状況に合わせてbossを他modeへ追加します。

TAKUYA、改札喰い、MOTHER、オオグチ、クロメ、ガイレン、フタゴ、変異ムガリアン社長、TAKUYA-Ωについて、次を表にしてください。

- Story Stage／defeat receipt
- compendium unlock
- Outbreak unlock
- Survival pool unlock
- spoiler prevention
- first reward／repeat reward
- defeat count
- replay挙動

TAKUYAとTAKUYA-Ωを同一boss kindで上書きしないでください。

### 4.7 Save

旧Stage進行を新しい30 Stageへmigrationして継続させる必要はありません。ニューゲーム前提です。

ただし次を守ってください。

- 旧localStorage／IndexedDB／backup／manual exportを削除しない
- 旧player eligibilityを非破壊で検出
- 新campaign generationまたはnamespaceでfresh progressを開始
- 正式リリース記念CAPSをpopup付きで一度だけ付与
- reload、replica recovery、multiple tabs、importで二重付与不可
- reward額はeconomy simulationから推奨し、Producer decisionへ返す
- rollback／last-known-good／corrupt recoveryを壊さない

「save引継ぎ不要」を「save削除許可」と解釈しないでください。

## 5. Art／asset Design

### 5.1 先にinventoryを作る

全30 Stageと全eventについて、次をfinite inventoryにしてください。

- speaker
- event portrait
- expression／side／crop
- background
- stage object
- one-off scene image
- battle unit／enemy／boss
- identity master
- battle atlas states
- VFX
- animation
- audio／ambience
- provenance
- runtime bytes
- required decode gate

各assetを`REUSE／RECOMPOSE／NEW_REQUIRED／OPTIONAL`へ分類してください。

### 5.2 既存portrait

既存主要キャラはまず現行event portraitを監査してください。ファイルが存在するだけで合格にせず、腰上、顔、武器、identity、左右配置、844×390／844×340等での読みを確認してください。

### 5.3 RED PANTHER

共通：

- human
- red-lens gas mask
- black／gray base、limited red accent
- grounded tactical equipment
- no excessive sci-fi
- unified faction language
- distinct body type、armor、loadout、silhouette

必要な四兵種：

1. survival knife melee
2. shield
3. submachine gun
4. commander

四兵種はbattle participantなのでbattle atlas必須です。近接兵のknifeは安価なgeneric propに見せず、groundedで魅力のあるsurvival knifeとして設計してください。

### 5.4 TAKUYA-Ω

- existing TAKUYA identityを継承
- current visual sizeのおよそ2倍
- final bossとして一目で読めるchaotic silhouette
- v10の橙色安全vest残骸、人工armor、背面投薬管をmotif化
- separate giant boss ID
- event／compendium read
- entrance／phase／telegraph／attack／defeat／sample recovery
- full body、foot anchor、body bounds、hitbox、shadow
- no unrelated redesign

### 5.5 その他

- ムガリアン社長：通常event portrait
- 変異ムガリアン社長：identity master＋boss atlas＋event／compendium read
- セガワ：主要event portrait。script上player combatantではないためbattle atlasは原則不要
- ナオキ：このprompt送信時にProducerが顔referenceを添付予定。ただしv10には登場しません。role、Stage、combat有無、セガワとの関係をProducer decisionなしで決めず、画像生成を先行しない
- existing bosses／units：current identity、sex、weapon、roleを上書きしない

### 5.6 実際の画像生成

この最初の`SOL_DESIGN`では、identity lock、asset specification、generation prompt、acceptance、storage path、provenanceまでを固定してください。

Design Lock承認後、ProducerがSolへasset production checkpointを明示した場合だけ生成へ進みます。未承認の大量生成、同一characterの無秩序なvariant、runtimeへの直接投入は禁止です。

## 6. 必須調査範囲

最低限、次をread-onlyで調査してください。live treeで移動していればactual pathを使用してください。

- campaign／stage／region／unlock／reward
- story event registry／story flow／battle bark
- Campaign UI／map／loadout／employment／upgrade／result
- unit catalog／role mechanics／manual abilities
- enemy catalog／human enemy対応可否
- battle definitions／objective mechanics／wave／spawn
- boss foundation／boss anomaly／compendium
- Outbreak／Survival
- level progression／campaign economy
- support／CRAWLER abilities
- event portrait／sprite manifest／production visuals
- stage background／object／geometry
- asset plan／manifest／PWA／Service Worker
- campaign storage／migration／backup／recovery／import/export
- release identity／release workflow
- unit／story／stage／economy／boss／save／browser QA tests

`AshfallGame.tsx`の巨大化を加速させず、data、state、runtime、render、asset、persistence責務を分離するarchitectureを設計してください。

## 7. Source conflictsとして必ず処理する項目

1. v10の主人公名入力と、旧Story Bibleの「名前入力なし」
2. v10の「加入」SYSTEM表示と、CAPS購入制
3. Producerが挙げたナオキがv10本文に存在しない
4. 旧Stage ID／save progressと、新30 Stageの意味変更
5. `PROJECT_STATE.md`の記載とlive 0.9.9.5
6. support systemの二重性
7. current Level 50基盤と、正式リリース用上限再決定
8. current 6 initial unitsと、target 4 initial units
9. current boss unlockと、Story defeat連動
10. Solがasset生成まで担当するProducer意図と、現行`SOL_DESIGN`の実装禁止境界

各項目を、`FACT／PRODUCER_DECISION／DESIGN_INFERENCE／PRODUCER_DECISION_REQUIRED`へ分類してください。

## 8. Design Lockの必須出力

最低限、以下を一つのversioned Design Lockにしてください。

1. Design ID／revision
2. actual baseline branch／HEAD／tree
3. player-facing goal
4. current-state audit
5. 30 Stage implementation matrix
6. event／speaker／portrait matrix
7. stage background／object matrix
8. unit unlock calendar
9. support unlock calendar
10. CAPS economy model
11. level progression model
12. 7-unit cap contract
13. RED PANTHER combat family contract
14. new boss contracts
15. boss cross-mode unlock matrix
16. save generation／legacy reward design
17. asset generation inventory／identity locks／prompts／provenance
18. architecture／module ownership
19. data／state／event／asset contracts
20. positive／negative tests
21. browser／PWA／save／performance／accessibility QA
22. PR decomposition and dependency graph
23. non-goals／protected files／rollback
24. Producer decision packet
25. Luna Handoff

## 9. PR分割の原則

巨大な一括diffへしない一方、player-facing incomplete stateをmainへmergeしないでください。

Designでは、少なくとも次の依存群を検討してください。

- canonical data／schema／save generation
- story event pipeline
- campaign Stage 1〜30／map／objectives
- economy／recruitment／level／support／7 cap
- RED PANTHER human enemy foundation
- new bosses
- asset production／manifest／decode
- event presentation／audio／animation／VFX
- cross-mode boss unlock
- integration／end-to-end QA
- release candidate／public QA

分割branchを使う場合も、正式リリース用integration branchへ集約し、Stage 1〜30が一つのrelease candidateとして通るまでmainへ断片mergeしない方式を提案してください。

## 10. Release gate

次が全て揃うまで`READY_FOR_LUNA_IMPLEMENTATION`を出さないでください。

- Source conflictが分類済み
- Producer decision requiredが一覧化済み
- Lunaが設計推測せず実装できる
- 全30 StageとENDING／EPILOGUEがinventory化済み
- asset missingが有限化済み
- economy simulation済み
- save／legacy rewardが非破壊
- 7体上限のauthoritative contractあり
- all boss cross-mode mappingあり
- tests／runtime QA／PWA QAが具体的
- rollbackとstop conditionあり

Design Lock完成後はproduction codeを書かず、Producer／司令塔へDesign summary、decision packet、Luna Handoffを返してください。
