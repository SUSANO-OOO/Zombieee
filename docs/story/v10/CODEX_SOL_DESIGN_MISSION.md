# Solへ送る一括指示 — Version 1.0.0正式リリース設計 v4（最終送信版）

以下を、**セガワのフェイスモデル写真と同じメッセージで、元のSol threadへ送る。**

このメッセージが最新のProducer決定であり、PR #169内の文言と矛盾する場合は本メッセージを優先してください。差分はDesign Lockへ明示的に反映し、技術調査で一意に解ける事項をProducerへ再質問しないでください。

---

`/goal`

`ROLE_LOCK: SOL_DESIGN`

## MISSION

`SUSANO-OOO/Zombieee`のv10正史を基礎に、PROLOGUEからStage 30、ENDING、エンドロール、EPILOGUEまでをVersion **1.0.0**として完成させるDesign Lockを作成してください。

Producerが行う初回操作は、この指示文とセガワ写真を送ることだけです。技術調査、数値、duration、wave、cost、module分割、test方式、asset棚卸しで解ける事項を一件ずつ質問して停止しないでください。

## 1. live確認と正本

Draft PR #169／branch `docs/story-v10-final-release-baseline`、live `main`、open Issue／PR、latest checksを再取得し、actual HEAD／treeを記録してください。古いSHAや過去報告を現在値として扱わないでください。

必ず次を読みます。

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_SOL_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. `docs/story/v10/README.md`
6. `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`
7. `docs/story/v10/STORY_SCRIPT_V10.md`
8. `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`
9. `docs/ASSET_STORAGE_POLICY.md`
10. live code、tests、assets、save、PWA

台本を復元し、PROLOGUEからEPILOGUEまで全文を読んでください。

```bash
python docs/story/v10/reconstruct_story_v10.py /tmp/STORY_SCRIPT_V10.md
```

期待値：

- UTF-8 bytes：`138747`
- lines：`2681`
- SHA-256：`c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`

要約資料だけで本文確認を代替しないでください。

## 2. 添付写真

添付写真は**『ネコ殺しのセガワ特級博士』だけのprivate face identity reference**です。

- ナオキではありません。
- 別character、alias、IDを作らないでください。
- セガワ以外へ流用しないでください。
- セガワはevent portrait用identity必須、player combatantではないためbattle atlasは原則不要です。
- 原写真、metadata、撮影背景をrepository、runtime、Issue、PR、CI artifact、QA evidence、log、公開物へ保存しないでください。
- Git管理対象にできるのは承認済みproject-original derived master／event portraitと非機微なprovenanceだけです。

## 3. 最新Producer決定

### 3.1 用語

player-facing正式名称は**装甲車両**です。

- `走行車両`は不採用。
- `CRAWLER`は互換用内部ID、型名、asset path、migration aliasとして必要な場合だけ残して構いません。
- 通常UI、台本、任務、強化画面、図鑑、通知、設定、会話ログ、result、accessibility、save説明、metadataへ`走行車両`／`CRAWLER`を露出させないでください。
- RED PANTHER正式名はStage 27で初開示。それ以前は赤レンズ部隊／ガスマスク部隊等のgeneric表記です。

### 3.2 主人公名

- ニューゲーム／`物語を始める`選択後、PROLOGUE前に名前入力screenを表示します。
- 入力名が仲間から呼ばれる名前になると明示し、main actionは`この名前で始める`。
- 未入力／skipは`指揮官`。名前未入力で進行不能にしません。
- 1〜12 Unicode grapheme。前後空白除去、連続空白縮約、改行／制御文字／bidi制御／悪用zero-width拒否。日本語、英数字、一般的絵文字を許可し、HTMLではなくtextとして描画します。
- canonical tokenは`{{PLAYER_NAME}}`。v10本文の敬称・呼称を保持し、raw tokenを残しません。
- PROLOGUE、複数Chapter、Stage 30、ENDING、エンドロール、EPILOGUEへ実際に反映します。
- active save、replica／backup、export／import、event log、replay、auto-skip、中断復帰、accessibilityで同一値を使用します。
- 設定または人物情報から変更可能にしますが、既読、receipt、報酬、加入、unlock、Stage進行を再発火させません。
- 844×390／844×340でsoftware keyboard表示中も入力、確認、決定、戻るへ到達できること。

### 3.3 主人公・初見player・event

主人公は基本的に無言ですが、傍観者にしません。進路、救助、端末、装甲車両、セガワとの接続／遮断、散布系統破壊、Stage 30の連携等を`▶ PLAYER` action beatと実操作へ対応させます。fake choiceや未承認のstory branchingは追加しません。

過去Versionを知らない初見playerが、人物、世界、西新、ムガリアン製薬、敵組織、各Stageへ行く理由、勝利結果、次Stage理由を理解できるよう、広告、医療箱、施設、人物反応、短い会話、画面表示で段階導入します。

正式event phase：`prologue／pre／post／first-clear-post／ending／epilogue`。

基本flow：`作戦前event → 編成 → 戦闘 → result → 勝利後event → 解放／加入／報酬 → 次Stage`。

長い`battle-story`、戦闘停止会話、黒幕情報を理解するために必須の戦闘字幕は使いません。skip、log、既読auto-skip、replay、中断復帰を持たせ、event、reward、unlock、加入を二重適用しません。

TAKUYAの主目標：

- Stage 3：`大型変異感染者TAKUYAを撃破`
- Stage 30：`TAKUYA-Ωを撃破し、西新を守る`

右腕、右胸等の部位名を通常の主目標にしません。

### 3.4 Unit・mission・boss

- 初期unit：ハチ、パイセン、クマバーソン、ババヤガ。
- primary role：`frontline／heavy／skirmisher／marksman／suppression／support／engineer`。
- formation最大7枠、戦場active合計7体。
- 同一characterを何度でも召喚でき、複数体同時存在も許可します。
- 8体目だけをauthoritative stateで拒否し、command、cost、cooldown、receiptを消費しません。
- 装甲車両、NPC、escort、mission object、support object、敵は7体枠外です。
- 特定character必須、class不足hard blockは禁止します。
- 複数編成clear matrix、全Stageの編成証明、大量evidenceは作りません。
- campaignで撃破済みのbossだけを、対応するSurvival／Outbreak等のboss poolへ追加します。campaign撃破receiptより前に他modeへ先行出現させず、unlockは一度だけ反映します。

基本missionは現行基盤の、敵拠点破壊、短い時間防衛、必要時だけ電源switch、必要時だけ台車／搬送object護衛、boss撃破へ限定します。防衛は90秒前後、原則75〜120秒。150秒以上は原則禁止。bossへ不自然なhard time limitを置きません。

bossはHPだけでなくdamage、cadence、phase、add、target pressure、control resistance、telegraphで現行より強化します。damage sponge、不可避即死、永久stun、長時間拘束は禁止。章bossとStage 30だけ必要なspot checkを行います。

### 3.5 Level・CAPS・support

- campaign表示最大Levelは30。capは5／10／15／20／25／30。
- CAPSは配備登録、Level up、equipment、support、装甲車両HP強化へ使用します。
- story上は`合流`、system上は`戦闘配備登録が解禁`、CAPS actionは`配備登録`。
- ナオStage 1後、ザキミヤStage 12、TKY Stage 14、Mrs.チハStage 17、宮本武蔵Stage 20後に配備登録解禁。
- Stage 8開始までに7 role、Stage 20までに現行16 playable unitへアクセス可能にします。
- unit配備登録、support、equipment、system等の主要unlockは、原則としてplayer-facing上1 Stageにつき1件へ分散します。物語上の合流が同Stageに固定される場合は、CAPS購入解禁やsupport解禁を許容window内でずらし、result後に複数の主要popupを連続表示しません。
- mandatory replay grindは禁止し、Stage 30前に全要素を買い切れる供給過多にもさせません。
- exact値は標準進行の一本の計算表と不足／過剰境界だけで調整します。

supportは回復支援、爆薬ドラム缶、火炎ドラム缶から1種装備。`pod`は通常loadoutから外し、航空支援／一斉砲撃は装甲車両固有abilityへ分離します。

### 3.6 装甲車両

- 全campaign Stageで一つのcanonical base HPを使用し、battle開始時HPはcanonical base＋恒久upgrade分から算出します。
- escort台車、civilian、電源等は別HPです。
- base HP、upgrade量、最大回数、CAPS curveは全30 Stageと経済から確定します。
- 拠点／管理画面上部に`装甲車両を強化する`入口を置きます。
- 専用screen中央に装甲車両全体graphic、現在Level、現在HP、強化後HP、必要CAPS、所持CAPS、`HPを強化`、`強化上限`を表示します。
- 844×390／844×340で豆粒化、切れ、重なりを起こしません。
- CAPS減算、upgrade、receipt、saveをatomic処理し、durable save成功後だけ車体反応とチャリンチャリン系強化SEを出します。

### 3.7 Character／stage／event asset

- event主要人物は、既存・新規を問わず、identityが分かる腰上portraitを必須とします。既存portraitがこの用途へ十分なら再利用し、不十分なものだけ承認済みidentity masterから派生させます。
- 実際に戦闘へ出るunit、enemy、bossはbattle atlas／spriteを必須とし、runtimeが要求する方向・待機・移動・攻撃・被弾・撃破等の状態を欠かしません。非戦闘人物へ不要なbattle atlasは作りません。
- Stage 21〜30を中心に、v10本文と任務を理解するために必要なstage背景、event cut、施設・端末・台車・敵拠点等のobject state、boss演出、VFX、audioを既存assetから先に監査します。
- inventoryの各項目を`REUSE／DERIVE／NEW_REQUIRED`へ分類し、既存assetが場所・時刻・任務・物語上の意味を満たす場合だけ再利用します。同じ背景の色替えや、無関係な画像の使い回しで別Stage／別eventを済ませません。
- `NEW_REQUIRED`だけを有限個生成します。画像枚数を膨らませるための候補量産は行わず、必要最小限の独立candidateを作り、用途適合・identity・構図・mobile視認性・実装可能性で自己監査します。
- 新規character identity masterは1画像1character、全身完全表示、武器・装備・手足を切らない、透明背景、文字・logo・枠・背景なしとします。複数の独立candidateを一枚のcharacter sheet／compositeへまとめません。
- event cut／stage背景は用途に応じた通常背景付き画像で構いませんが、画面内文字、logo、不要なUI、生成上の説明文は入れません。
- RED PANTHERはsurvival knife近接兵、盾兵、SMG兵、指揮官兵の四兵種。赤レンズのガスマスク等の組織共通装備を持たせつつ、体格、armor、武器、silhouetteで即時判別可能にします。
- 通常ムガリアン社長はevent portrait必須です。必要な場合は独立identity masterを作り、変異ムガリアン社長はその通常identityから派生させます。
- 変異ムガリアン社長は通常社長とのidentity連続性を維持したboss assetが必要です。

TAKUYA-Ωは既存TAKUYAを明確に基礎にします。既存TAKUYAの顔・頭部・体格・特徴、橙色安全vest残骸、人工armor、背面の複数投薬管を継承し、不均衡な異常肥大、左右非対称、肉体とarmorの侵食・融合、投薬暴走、崩れたsilhouetteを加え、ラスボスにふさわしいカオスで制御不能な最終形態にします。

単なる巨大化、色違い、装甲追加、genericなAI怪物、無関係な別monster、綺麗すぎる近未来robotは不合格です。authoring masterとboss presentationは、既存TAKUYAの全高／占有silhouetteに対して**約2倍（目安1.8〜2.2倍）**を維持します。camera、hitbox、animation上のexact値はSolが調整して構いませんが、通常boss程度へ縮小してはなりません。既存TAKUYAとの連続性、final boss圧力、mobile readability、telegraph、performanceを同時に満たしてください。

その他のcharacterはv10正本と既存identity、性別、年齢印象、武器、役割、服装を維持し、具体的不足がない限り再設計、別人化、武器変更、役割変更、無断のmain cast化を行いません。

### 3.7.1 Asset production authorization

`ASSET_PRODUCTION_CHECKPOINT: PRODUCER_AUTHORIZED`

finite asset inventory、identity lock、生成prompt、保存先、provenance、acceptanceをDesign Lockした後は、追加のProducer確認を待たず、利用可能なproject-original画像生成手段で`NEW_REQUIRED` candidateの生成、自己監査、不合格candidateの棄却、selected authoring masterの選定まで進めてください。

- `selected master`はprompt案や予定ではなく、実在する選定済みfile path、hash、寸法、用途、provenanceを持つ成果物とします。
- セガワ原写真は保存せず、そこから派生した承認可能なfictional authoring master／event portraitだけを扱います。
- authoring candidate／masterの保存は`docs/ASSET_STORAGE_POLICY.md`へ従い、production runtimeへの組込み、最適化、manifest登録、battle接続はLuna Handoffへ渡します。
- 生成toolが一時的に失敗した場合は、inventoryとpromptだけで完了扱いにせず、同一Design工程内で必要最小限の再試行を行います。実際に生成不能な外部制約だけを残存blockerとして明記します。

### 3.8 Save／legacy／PWA

- Version 1.0.0は新campaign generation／namespaceで開始し、旧Stage進行を自動移行しません。
- 旧localStorage、IndexedDB、backup、manual export、last-known-goodを削除しません。
- 主人公名、event read／resume、装甲車両upgrade Level／receiptを新saveへ保存します。
- 旧Versionのplay履歴を非破壊で検出し、新campaignへ**正式リリース記念CAPS**を一度だけ付与します。最初の安全な非戦闘screenで、付与額と新残高が分かる専用popupを表示します。exact額は序盤の意味ある選択肢を1つ増やすがChapter 1経済を飛ばさない範囲でSolが算出します。
- legacy記念CAPSをreload、recovery、manual import、multiple tabsで二重付与しません。
- Version 1.0.0のstandalone／PWA初回導入は、全required runtime assetをdownload・hash検証・commitし終えるまでgameplay開始を許可しません。開始後にrequired assetを追加取得する構成は禁止します。updateはchanged／missing assetだけをhash単位で取得し、旧generationをrollback用に保持します。
- update、offline、rollback、commit-only recoveryでname／event／campaign saveを壊しません。

## 4. Solへ委任するexact値

次はProducerへ一件ずつ戻さず自律確定して構いません。

- unit／enemy／boss stats
- deployment cost／cooldown
- 配備登録／Level up／support／装甲車両upgrade cost
- exact unlock Stage
- Stage／star／replay CAPS
- enemy wave／spawn／AI
- mission duration／escort speed／switch timing
- boss phase／telegraph／resistance／reward
- 装甲車両base HP／upgrade量／最大回数／cost curve
- other-mode unlock先／weight／repeat reward
- 旧player記念CAPS

公開後runtimeのhidden DDAは禁止します。

## 5. 必須成果物

- actual baseline HEAD／tree、source attestation、v10 hash結果
- 主人公名input／validation／token／save／rename／log contract
- 主人公actionとgame operationの対応表
- event phase／ID／flow／receipt／UI contract
- 初見player向けの世界観・人物・用語導入表
- 全30 Stageの場所、任務、行く理由、勝利結果、次Stage理由、duration、wave、boss、unlock表
- player-facing major unlockを1 Stageにつき1件へ分散したunlock cadence表
- unit、Level、CAPS、support、reward、economyのexact表
- 7-active total cap／duplicate summon contract
- 装甲車両canonical HP、upgrade curve、専用screen、transaction contract
- boss exact設計と、campaign撃破receiptに連動したcross-mode unlock mapping
- 通常ムガリアン社長、Segawa、TAKUYA-Ω、RED PANTHER、変異ムガリアン社長、既存主要人物portrait、必要なStage／event cutを含むfinite asset inventory（REUSE／DERIVE／NEW_REQUIRED、用途、状態、寸法、alpha、保存先、identity source、acceptance）
- legacy正式リリース記念CAPSの判定、額、専用popup、one-shot receipt contract
- Version 1.0.0 full-pack completeness／初回導入／差分update／rollback contract
- 実際に生成・自己監査したcandidate一覧と、file path／hashを持つselected authoring master、provenance
- module ownership、PR dependency、必要最小限のQA
- Lunaがそのまま実装開始できるHandoff全文

Luna Handoffは最低限、1)主人公名／event基盤、2)PROLOGUE〜Stage 20、3)Stage 21〜30／ENDING／EPILOGUE／新敵・boss、4)最終統合／asset／audio／PWA／通しQAの依存順に分けます。

## 6. 必要最小限の検証

- 30 Stage data接続
- 主人公名の入力、fallback、token、rename、save、log、ENDING／EPILOGUE
- pre→battle→result→post→unlock／rewardと二重適用0
- 8体目reject、同一character複数召喚allow
- 装甲車両HPが全Stageでcanonical＋upgrade
- 装甲車両強化screen、CAPS transaction、save、SE
- 章boss／Stage 30 spot check
- campaign boss撃破前後で他mode boss poolが正しく変わり、先行出現・二重unlockがないこと
- major unlockが同じStageへ不要に重複せず、結果popupが連打されないこと
- final candidateで名前入力からStage 1〜30、ENDING、エンドロール、EPILOGUEを一度通す
- 初回、続き、最初から、敗北、再戦、result、map復帰、reload、中断復帰
- legacy記念CAPS popupが一度だけ表示され、付与とsaveがatomicであること
- required full pack完了前は開始不可、開始後required追加fetch 0、差分update、offline、rollback
- 全Stage背景／object／event cutの不足・単純色替え・未配置0
- save、offline、PWA update、rollback、legacy reward
- 844×390、844×340、1280×720
- missing asset、placeholder、unknown speaker、speaker／portrait mismatch、raw token 0

複数編成clear matrix、全Stage複数編成証明、人間clear率の大規模計測、不要な大量evidence、監査だけのための新Issue／新文書は作りません。

## 6.1 現在の既知CI境界

PR #169はdocs-only baselineであり、Design開始自体は止めません。一方、既存PWA partial-failed update QAが赤い場合は、原因をlive状態で分類し、merge／Release前blockerとして記録してください。同一packを旧版／候補版として比較したfixture前提崩れと、実際のPWA product regressionを混同せず、このDesign missionを無関係なproduction修正へ拡張しません。

## 7. 権限・停止

このmissionではproduction code、runtime asset統合、save変更、main直接push、merge、tag、Release、Pages公開、Issue closeを行いません。Design文書および非runtimeのauthoring candidate／selected masterは、専用Design branch／Draft PR上で作成・更新して構いません。

次の場合だけ`PRODUCER_DECISION_REQUIRED`で停止してください。

- v10本文、人物弧、Stage因果、ENDING／EPILOGUEの変更が必要
- 既存character identityの置換が必要
- 新mode、新通貨、story branching、permadeath等の未承認systemが必要
- 旧save／asset削除、不可逆migration、history rewriteが必要
- license／commercial-use／provenanceが不明
- 正本同士の矛盾を最新Producer決定と技術調査だけで一意に解けない

完了時は`DESIGN_LOCKED`、Design ID、fixed branch／HEAD／tree、確定表、asset結果、残存risk、Luna Handoff全文、PR状態を返してください。要約だけで終わらせないでください。
