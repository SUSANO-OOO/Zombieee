# Codex Sol Design Mission — Version 1.0.0／v10正史／30 Stage完成リリース

この文書は、Producerが最初のSol threadへ送る一回限りの正式Design mission正本である。  
このmissionは、Design Lock、静的balance tuning、必要assetの候補生成・選定、Luna Handoffまでを一つのgoalとして扱う。production code実装、merge、Release、Pages公開は行わない。

---

`/goal`

`ROLE_LOCK: SOL_DESIGN`

## 1. MISSION

`西新世紀末物語`のv10正史台本を、PROLOGUEからStage 30、ENDING、EPILOGUEまで未完成箇所なく実装できるVersion 1.0.0用Design Lockへ変換してください。

これは台本貼付やStage追加だけのmissionではありません。現行game全体をlive repositoryから調査し、story、battle、class composition、campaign progression、CAPS economy、unit recruitment、level progression、support、human enemy、boss cross-mode unlock、art、animation、effect、audio、save、PWA、QA、release boundaryを30 Stage構成へ統合してください。

Producerは、本文末尾の停止条件に該当しない限り、数値調整やStory外unitの配置をSolへ委任します。本書とProducer Decisionsの制約内で成立する判断を、追加承認待ちとして止めないでください。

## 2. 最初に読む正本

次を順番どおり読み、live repositoryと照合してください。

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_SOL_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. `docs/story/v10/README.md`
6. `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`
7. `docs/story/v10/STORY_SCRIPT_V10.md`
8. 復元されたv10 Markdown全文
9. `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`
10. `docs/ASSET_STORAGE_POLICY.md`
11. 関連する現行code、tests、asset manifests、QA scripts、open Issue／PR

`PROJECT_STATE.md`やこの文書に書かれたSHAを永久に最新とは見なさず、開始時、branch作成前、PR作成前にlive値を再取得してください。

## 3. 台本全文の必須復元

Design開始前に次を実行してください。

```bash
python docs/story/v10/reconstruct_story_v10.py /tmp/STORY_SCRIPT_V10.md
```

次と一致することを確認してください。

```text
UTF-8 bytes: 138747
Lines: 2681
SHA-256: c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4
```

その後、復元された全文をPROLOGUEからStage 30、ENDING、EPILOGUEまで読んでください。`STORY_IMPLEMENTATION_MAP.md`や本missionだけを読み、台本本文を確認した扱いにすることを禁止します。

## 4. 同時添付される写真

このpromptには、Producerが**セガワのface model写真**を添付します。

- 添付写真はセガワ本人のface identity referenceです。
- `ナオキ`ではありません。ナオキというcharacter、alias、ID、置換関係を作らないでください。
- セガワ以外の人物へ流用しないでください。
- 原写真をpublic repository、runtime、Issue、PRへcommit／uploadしないでください。
- metadata、撮影情報、不要な背景情報を保存しないでください。
- derived assetはセガワのevent portraitに使用します。
- v10ではセガワはplayerが戦う相手ではないため、battle atlasを作らないでください。

写真が欠落・破損している場合だけ、identity blockerとして明示してください。それ以外のSegawa designは本mission内で完了してください。

## 5. Producer Lock

`docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`を製品判断の最上位正本とします。少なくとも次は再提案・再確認待ちにせず固定してください。

- 正式releaseはVersion 1.0.0。
- 初期unitはハチ、パイセン、クマバーソン、ババヤガの4体。
- balance classは`frontline／heavy／skirmisher／marksman／suppression／support／engineer`の7系統。
- 編成最大7体、戦場active最大7体、同じ固有characterは同時に1体だけ。
- classはソフト必須。hard quota、特定character必須、単一counter、永久免疫を禁止。
- 各Stageは異なる2編成以上でclear可能にする。
- hidden runtime dynamic difficulty adjustmentは禁止。自動調整は開発時の静的tuningのみ。
- player名入力は追加せず、`{{PLAYER_NAME}}`は`指揮官`へ解決。
- Stage 1でナオ、Stage 12でザキミヤ、Stage 14でTKY、Stage 17でMrs.チハ、Stage 20で宮本武蔵を配属可能にする。
- Stage 6 clearまでに7 classへアクセス可能、Stage 20 clearまでに現行16 unitを発見済みまたは配属可能にする。
- 支援物資は回復、爆薬ドラム缶、火炎ドラム缶の3種。1 sortieにつき1種装備。CAPSは恒久unlock、battle内はlocal resource＋cooldown。
- 回復支援はStage 2、爆薬ドラム缶はStage 6、火炎ドラム缶はStage 13 clear後に購入可能。
- level capは5→10→15→20→25→30、Stage 30 clear後postgame 35。Stage 30はcap 30でbalance。
- 旧進行migrationは不要だが、旧save／backup削除は禁止。新generationでfresh startし、旧player記念CAPSを一度だけ付与。
- RED PANTHER正式名はStage 27までplayerへ伏せる。
- TAKUYAとTAKUYA-Ωは別boss identity／ID。
- 未配置、placeholder、未完成animation／effect／audioを完成扱いしない。

本書の要約とProducer Decisionsが衝突した場合はProducer Decisionsを優先してください。

## 6. Solへ委任する調整

次はProducerへ数値承認を戻さず、simulation、runtime evidence、既存identityを根拠にSolが自律確定してください。

- 全unitのdeployment cost／cooldown／combat stat
- recruitment cost／upgrade cost
- Story外unitの正確なunlock Stage
- Stage別base／first-clear／star／replay CAPS
- supportのunlock price／battle-local cost／cooldown／effect
- wave／spawn／enemy stat／objective pressure
- boss stat／phase threshold／telegraph window
- bossのSurvival／異常発生追加先とthreshold
- 旧player記念CAPS額
- Stageごとの推奨class／threat tag
- 必要な既存unit catch-up調整

調整時は、既存unitのidentity、武器、primary class、signature ability、物語上の役割を維持してください。単一combat statを現行値から30%超変更する場合は、理由、before／after、simulation、回帰riskをDesign Lockへ残してください。

## 7. Balance Design

### 7.1 Class composition

- 7 classの責務、重複、counter relationを定義してください。
- 同じclass内でもcharacterごとの用途を区別し、strictly dominatedなunitを残さないでください。
- 単一class spamが有利になり続けず、複数class編成が自然に安定する敵・objective設計にしてください。
- 特定unitを購入していないplayerにも、初期unit、別class、支援物資、配置判断のうち最低2 routeを残してください。
- Stage select／loadoutでthreat tagと推奨roleを表示し、spoiler、過剰説明、hard lockを避けてください。

### 7.2 Difficulty

- 本編は一つのcanonical difficultyとして設計してください。新difficulty selectorは作りません。
- 新mechanicは低圧導入→混合→応用の順で教えてください。
- major attackは844×390／844×340でも予兆を識別できるようにしてください。
- 不可避即死、画面外攻撃、読めないstatus、damage spongeだけの難化を禁止します。
- 想定attemptはProducer Decisionsの範囲をtuning targetにしてください。
- 敗北後の原因feedback、既読story skip、loadout変更、即再戦を短い導線へしてください。

### 7.3 Seven-active contract

以下をdata／state／event／render／input contractとして一つに固定してください。

- authoritative active count source
- deployment開始、alive、downed、retreat、remove、redeployのslot timing
- same-character duplicate prevention
- ability summonのcount rule
- touch／keyboard／rapid input／double action race prevention
- rejection UI／SE
- save／pause／result遷移時のcleanup
- positive／negative／stress test

UI表示だけの制限は禁止します。

## 8. Economy／progression Design

最低限次の3 profileをdeterministicにsimulationしてください。

- `minimal`
- `standard`
- `completionist`

各Stageについて次を出してください。

- clear reward／first-clear reward／star reward／replay reward
- unlock済みunit／support／level cap
- 想定owned roster
- 主力7体のlevel帯
- 残CAPS
- 次Stage推奨power帯
- 購入ミスからのrecovery経路

Producer Decisionsの供給条件、grind禁止、completionistのpostgame余地、旧player reward上限を満たしてください。単に収入と価格を並べるだけでなく、30 Stageを順にsimulationし、CAPS不足・過剰供給・一択購入を検出してください。

## 9. 30 Stage implementation matrix

PROLOGUE、Stage 1〜30、ENDING、EPILOGUEの全eventを有限inventory化してください。

各Stageで最低限次を固定してください。

- stable Stage ID／region／map position
- pre／mid／post／defeat／retry／replay event
- objective／clear／fail／star source
- enemy family／wave／boss
- stage background／geometry／object／damage layer
- required speaker／portrait／side／expression／crop
- music／ambience／battle bark／warning
- story receipt／unlock／CAPS／compendium／other-mode receipt
- required assetとdecode gate
- positive／negative／mobile acceptance
- next destinationと因果接続

台本の一行を実装しただけでStage完成としないでください。

## 10. Human enemy／RED PANTHER

次の四兵種を同一human enemy familyとして設計してください。

1. survival knife melee
2. shield
3. submachine gun
4. commander

共通identity：赤レンズgas mask、black／gray、限定red accent、grounded tactical、過剰なsci-fi禁止。

固定するもの：

- stable enemy kind／faction ID
- infectedとのdamage／targeting／status差
- AI profile／range／coverまたはlane behavior
- weapon／telegraph／projectile／melee contact
- body bounds／hitbox／foot anchor／shadow
- idle／move／attack／hit／defeat atlas state
- VFX／audio／bark／masked event read
- pre-Stage 27 spoiler-safe label
- four-class silhouette differentiation
- survival knifeの具体的で魅力あるgrounded design

四兵種はbattle participantなのでbattle atlas必須です。

## 11. Boss Design

TAKUYA、改札喰い、MOTHER、オオグチ、クロメ、ガイレン、フタゴ、変異ムガリアン社長、TAKUYA-Ωについて次を固定してください。

- Story encounter／defeat receipt
- full compendium reveal
- rematch／Outbreak／Survival unlock
- spoiler boundary
- first／repeat reward
- defeat count
- replay behavior
- entrance／phase／telegraph／attack／defeat
- atlas／VFX／audio／asset decode

### TAKUYA-Ω

- existing TAKUYA identityを継承
- current visualのおよそ2倍
- 橙色安全vest残骸、人工armor、背面投薬管
- chaotic final-boss silhouette
- separate giant boss ID
- full body／foot anchor／body bounds／hitbox／shadow
- entrance／phase／telegraph／attack／defeat／中和因子回収
- no unrelated redesign

### 変異ムガリアン社長

- 通常portraitとの同一人物性
- mutation onset presentation
- boss atlas／telegraph／attack／defeat／compendium
- Stage 25での物語因果

## 12. Save／PWA

旧progressを新30 Stageへ変換しません。ただし旧dataを破壊してはいけません。

Design Lockでは次を固定してください。

- new campaign generation／namespace／schema
- old-player eligibility detection
- one-time reward receipt
- localStorage／IndexedDB replica
- multiple tabs／reload／import／recovery duplicate prevention
- reset boundary
- last-known-good／corrupt recovery／manual export／import
- PWA manifest／Service Worker／cache generation／rollback
- old releaseからVersion 1.0.0へのupdate path
- partial-failed update／offline／decode failure

`save引継ぎ不要`を`save削除許可`と解釈しないでください。

## 13. Asset inventoryと生成

全assetを次へ分類してください。

- `REUSE`
- `RECOMPOSE`
- `NEW_REQUIRED`
- `OPTIONAL`

最低限inventoryへ含めるもの：

- event portrait
- identity master
- formation／personnel card
- battle atlas
- background
- stage object
- one-off scene image
- VFX
- animation
- audio／ambience
- provenance
- runtime bytes
- required decode gate

既存portraitは存在確認だけで合格にせず、identity、腰上crop、weapon read、左右配置、844×390／844×340で監査してください。

### Asset productionの事前承認

本mission自体を、Design Lock完成後のasset candidate production checkpointとしてProducerが事前承認します。

Design Lockにasset inventory、identity lock、prompt、output spec、acceptance、storage path、provenanceが固定され、Producer blockerが0なら、追加promptを待たず次へ進んでください。

- new character／boss／RED PANTHERのidentity candidateを必要数だけ生成
- 同じcharacterの無秩序な大量variantを作らない
- 1画像1キャラ、全身透過、文字なし、装備切れなし
- Segawaは添付face referenceを使用
- existing characterは現行identityを上書きしない
- candidateをidentity／silhouette／weapon／mobile readで自己監査
- 採用authoring masterと不採用理由を記録
- authoring masterとderived runtime候補を分離
- production code／manifestへ統合しない

画像生成機能が利用できない場合は、asset inventory、generation prompts、output contract、acceptance、保存先まで完成させ、利用不能を明示してください。代替の無断placeholderを採用しないでください。

## 14. Architecture

`AshfallGame.tsx`の巨大化を加速させず、最低限次の責務を分離してください。

- campaign content data
- story registry／flow／receipts
- combat runtime／active roster
- human enemy family
- boss definitions／abilities
- progression／economy
- support loadout／runtime
- asset profiles／manifest／decode gate
- save generation／legacy eligibility
- UI render／mobile layout
- QA fixture／evidence

Design Lockへmodule ownership、data／state／event／asset contract、変更予定file、競合file、non-goal、do-not-changeを記載してください。

## 15. Validation

最低限次を設計してください。

- story source hash／event completeness
- 30 Stage static integrity
- unit／class／unlock／economy simulation
- seven-active／same-character negative test
- support unlock／loadout／battle use
- boss spoiler／receipt／cross-mode
- old-player reward duplicate prevention
- save／replica／reset／import／recovery
- asset provenance／finite inventory／decode
- animation／VFX／audio presenceではなくruntime意味検査
- 1280×720、844×390、844×340
- Chromium／WebKit
- console／page／HTTP／request failure 0
- Stage 1〜30 fresh run
- defeat／retry／replay／reload
- low-speed network／offline／partial update／rollback
- performance／memory／render object cap

各Stageは推奨編成と代替編成の最低2 routeでclear evidenceを設計してください。

## 16. PR／release plan

- Design Lockとasset authoringはproduction implementationから分離してください。
- Lunaが追加architecture推測をせず進められる依存順へPRを分割してください。
- 大規模一括PRで競合、review不能、rollback不能にしないでください。
- 一括正式リリースとは、全機能を一つの正式Versionとして公開する意味です。開発中のPR分割、integration branch、candidate QAを禁止する意味ではありません。
- 最終integration後に全30 Stage通しQAを行い、High／Medium 0でなければreleaseしないでください。
- merge／tag／Release／Pagesは本missionで行わないでください。

## 17. 必須成果物

Design完了時、repository内のversioned正本またはcanonical Issueへ最低限次を固定してください。

1. Design ID／revision／baseline HEAD／tree
2. 30 Stage implementation matrix
3. class／counter matrix
4. unit balance table
5. active roster state machine
6. unit unlock calendar
7. support unlock／loadout contract
8. level cap／economy simulation
9. boss cross-mode unlock matrix
10. save generation／legacy reward contract
11. event／portrait／background／object inventory
12. RED PANTHER family contract
13. 変異ムガリアン社長contract
14. TAKUYA-Ω giant boss contract
15. Segawa identity／portrait contract
16. asset generation prompts／provenance／selected masters
17. architecture／module ownership
18. acceptance／negative／browser／PWA／save QA
19. PR dependency graph／rollback／stop conditions
20. Luna Handoff

## 18. 最初の返答

最初の進行報告で必ず次を示してください。

- `ROLE_LOCK: SOL_DESIGN`
- actual baseline branch／HEAD／tree
- current release identity
- 読み込んだ正本一覧
- story source hash verification結果
- 添付写真をSegawa identity referenceとして認識したこと
- open PR／branch conflict
- production code、merge、releaseを行わないこと
- 最初に調査するmodule群
- 既に検出したsource conflict
- `/goal`を使用すること

調査可能な事項をProducerへ質問して停止せず、repository、台本、tests、assetsから先に解決してください。

## 19. 停止条件

次の場合だけ停止してください。

- v10本文とProducer Decisionsが論理的に同時成立しない
- Segawa写真が欠落／破損しidentityを成立させられない
- live baselineを安全に固定できないbranch／PR conflict
- license／privacy上、正式採用可能なassetを作れない
- save／PWA／releaseを非破壊で設計できない重大事実
- 固定acceptanceがsimulationとruntimeの双方で同時達成不能

単なる数値選択、cost、wave、Story外unit配置、support tuning、bossの他mode追加先は停止理由にしないでください。

## 20. 最終出力

Design、静的tuning、許可されたasset production、Luna Handoffが完了したら次を返してください。

```text
DESIGN_LOCKED

DESIGN_ID:
REVISION:
BASELINE_HEAD:
BASELINE_TREE:
CANONICAL_DESIGN:

LOCKED_DECISIONS:
AUTONOMOUS_TUNING_SUMMARY:
ASSET_PRODUCTION_SUMMARY:
SEG_AWA_REFERENCE_HANDLING:
ACCEPTANCE_COUNT:
KNOWN_RESIDUAL_RISKS:

LUNA_HANDOFF:
- target branch
- implementation order
- PR dependency
- required tests／evidence
- stop conditions

NEXT_AUTHORIZED_ACTION:
- Luna implementation only
- no merge／release
```

`SEG_AWA_REFERENCE_HANDLING`は既存schemaに合わせて`SEGAWA_REFERENCE_HANDLING`へ綴りを正規化して構いません。
