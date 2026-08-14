# 正式リリース版 — Producer Decisions

更新日：2026-08-14  
状態：**Producer Locked Brief v2／Sol Design開始可能**  
対象：v10正史台本を基礎にしたVersion 1.0.0・30 Stage完成リリース

## 1. 主目的

PROLOGUEからStage 30、ENDING、EPILOGUEまでを、未配置・未接続・仮画像・仮演出・未完成systemを残さず、Version 1.0.0として一括の正式リリースへ成立させる。

「台本を表示できる」「Stage数が30になった」「testsがgreen」だけでは完成としない。物語、戦闘、進行、CAPS経済、ユニット、支援物資、育成、ボス、他mode、画像、animation、effect、audio、save、PWA、スマートフォン表示を、ニューゲームからENDING／EPILOGUEまで一つの実プレイへ接続する。

## 2. Player-facing outcome

- 新規playerはニューゲームから開始し、人物・企業・用語の開示順を追いながらStage 1〜30を遊び、TAKUYA-Ω撃破後にENDING／EPILOGUEへ到達できる。
- 本編はハードコア寄りだが、初見殺し、特定character必須、説明されない即死、購入失敗による進行不能で難しくしない。
- 編成、役割理解、育成、操作判断が勝敗へ影響する一方、複数の攻略編成を成立させる。
- 既存playerも新campaignをニューゲームとして開始する。ただし旧dataを削除せず、正式リリース記念CAPSをpopup付きで一度だけ受け取れる。

## 3. 実行体制

- 最初のSol threadが`ROLE_LOCK: SOL_DESIGN`で現行code／assets／save／PWA／QAを調査し、Design Lockを作る。
- SolとLunaを同時並行で動かさない。
- 数値・unlock配置・wave等は、本書の制約内ならSolがsimulationと検証を根拠に自律確定してよい。
- Design Lock完成後、同じSol goal内で、事前承認済みassetについてidentity lock、prompt、候補生成、自己監査、authoring master選定まで続行してよい。production codeへの統合は行わない。
- Lunaは最新Design Lockと承認済みassetを正本としてproduction implementation、test、browser QA、self-review、Draft PRを担当する。
- Luna完了後、最初のSol threadが`SOL_FINAL_REVIEW`を行う。
- Solが限定remediationを行った場合はLuna validation後にSolが再reviewする。
- merge、tag、Release、Pages公開は別の明示承認まで行わない。

## 4. 物語上の固定判断

- `docs/story/v10/STORY_SCRIPT_V10.md`からhash検証して復元した全文を物語正本とする。
- 本編は30 Stage。
- v10が固定する人物弧、敵側の因果、ENDING、EPILOGUEを維持する。
- 主人公は無言だが、物語を動かす能動行動を担う。
- player名入力は追加しない。台本中の`{{PLAYER_NAME}}`はplayer-facingで常に`指揮官`へ解決する。新しいsave field、入力screen、人格分岐を作らない。
- ムガリアン製薬、赤レンズ部隊、RED PANTHER、セガワ、TAKUYA-Ωの開示順を崩さない。
- RED PANTHERの正式名称をStage 27より前の名称、図鑑、mission表示、asset labelでplayerへ露出させない。
- 既存playable unitを本編会話へ無理に追加しない。
- 新規CG大量制作を前提にせず、再利用可能な背景、左右腰上event portrait、短い演出、暗転、環境音を主軸にする。

## 5. Class／編成の正式contract

### 5.1 Balance class

正式リリースでbalance計算に用いるclassは、現行AI profileを基礎に次の7系統へ固定する。

1. `frontline`／前衛
2. `heavy`／重装
3. `skirmisher`／遊撃
4. `marksman`／精密射撃
5. `suppression`／制圧
6. `support`／支援
7. `engineer`／工兵

character固有の肩書、武器、能力名は残すが、balance上の新classを無秩序に増やさない。複合役割はprimary class＋role tagで表現する。

### 5.2 初期使用可能unit

ニューゲーム開始時に使用できるplayable unitは次の4体だけとする。

- ハチ：`skirmisher`／現行最安costの低コスト枠
- パイセン：`frontline`
- クマバーソン：`heavy`
- ババヤガ：`marksman`

ハチを4体目として正式確定する。別unit候補のdecision packetは不要。

### 5.3 Formationとbattle active cap

- 編成へ登録できるunitは最大7体。
- 同時に戦場へ存在できるplayable unitも最大7体。
- **同じ固有characterは同時に1体だけ**存在できる。7体のハチ等、同一人物の複製配置を認めない。
- 撃破は死亡ではなく戦闘不能・回収扱いとし、death／retreat presentationが完了してbattle stateから除去された時点でactive slotを解放する。
- 回収後は各unitのredeploy cooldownを経て再出撃できる。
- deployment開始済み、alive、downed、retreating、reviving中のplayable bodyはactive countへ含める。
- CRAWLER、敵、NPC escort、mission objective、support object、projectile、VFXは7枠へ含めない。
- abilityで生成され、独立してtarget／damage／HPを持つplayer-controlled summonは7枠へ含める。純粋な演出物は含めない。
- 8体目または同一characterの2体目はbattle stateでatomicに拒否し、command、cooldown、receiptを消費しない。UIとSEで理由を返す。
- touch、keyboard、rapid input、double action、multiple render frameを通じた迂回を禁止する。

### 5.4 Class編成は「ソフト必須」

- class数や特定classを編成画面でhard lockしない。
- 特定の固有characterを所持・購入していないとclear不能になる設計を禁止する。
- Stage previewではenemy threat tagと推奨roleを表示するが、強制条件にはしない。
- 単一class偏重は不利になるが、システム上の罰則でなく敵構成、射程、装甲、群れ、回復、objective pressureから自然に不利にする。
- 各主要mechanicには最低2系統のcounter routeを用意する。例：盾を破る方法を破砕だけに限定せず、側面、継続damage、control、support等の代替を設ける。
- permanent immunity、特定class以外damage 0、特定character ability以外解除不能を原則禁止する。
- 各Stageは、明確に異なる2種類以上の編成でclear可能なことをsimulation／runtime QAで示す。そのうち1つは最も分かりやすい推奨counterを含まない代替編成とする。

## 6. 難易度原則

### 6.1 基本

- 本編は一つのcanonical difficultyとして設計し、今回新しいdifficulty selectorは追加しない。
- 難しさは編成、配置、targeting、support timing、撤退／再出撃判断から作る。
- 敵HPと攻撃力だけを増やすdamage sponge化、不可避damage、画面外攻撃、読めない即死、長時間の足止めだけで難しくしない。
- runtime中にplayerへ隠して敵statやrewardを変えるdynamic difficulty adjustmentは導入しない。
- Solの自動調整は開発時の静的tuningだけとし、確定値をversion管理する。

### 6.2 導入と学習

- 新しいenemy trait／objective mechanicは、最初の登場で低圧の学習waveまたは明確な事前説明を置く。
- 複数mechanicを同時に初登場させない。
- bossの大技、phase変化、counter windowは844×390／844×340でも識別可能なtelegraphを持つ。
- 初見で回避不能な一撃撃破を禁止する。高damage攻撃は予兆、回避、軽減、interruptのいずれかを持つ。
- Stage失敗後は、前線崩壊、対空／遠距離不足、回復不足、objective放置等の実測原因を短く返す。正解編成を一つに固定する答え表示にはしない。

### 6.3 想定attempt

推奨level帯かつ役割を理解した標準playerの目安を次とする。

- Stage 1〜5：通常1〜2 attempt
- Stage 6〜20：通常1〜3 attempt
- Stage 21〜29：通常2〜4 attempt
- 主要boss：通常2〜4 attempt
- 推奨level・複数class・mechanic理解済みで5 attempt以上を恒常的に要求する場合はover-tuned候補

これはclear保証ではなくtuning targetである。実機playtestとsimulationが衝突した場合は実機結果を優先する。

### 6.4 Failureとretry

- 敗北でCAPS、永久unlock、unit、永続supportを失わない。
- battle-local resourceだけをresetする。
- 既読storyを強制再生せず、loadout変更または即再戦へ短い導線で戻れる。
- 敗北を利用したCAPS稼ぎ、二重reward、receipt再利用を禁止する。

## 7. Unlock／加入／配属

### 7.1 用語

- 物語上、人物がCRAWLERへ加わることは`合流`とする。
- gameplay上、戦闘で使用可能になる条件開放は`配属可能`とする。
- CAPS支払いbuttonは`配属する`または`配属準備`とし、人間の忠誠を金で買う表現にしない。
- CAPSは武器、装備、訓練、医療、輸送、補給を含む戦力化costとして扱う。
- 初期4体以外のplayable unitは、明示された例外がない限り、合流後または発見後にCAPSで配属する。

### 7.2 固定milestone

- Stage 1 clear：ナオを配属可能にする。最初の回復class導入。
- Stage 2 clear：回復支援物資を購入可能にする。
- Stage 4 clearまで：制圧classを最低1体、配属可能にする。
- Stage 6 clearまで：工兵classを最低1体、配属可能にする。
- Stage 6 clear時点で7 balance classすべてへアクセス可能にする。
- Stage 12 clear：ザキミヤを配属可能にする。
- Stage 14 clear：TKYを配属可能にする。
- Stage 17 clear：Mrs.チハを配属可能にする。
- Stage 20 clear：宮本武蔵を配属可能にする。
- 現行16 playable unitはStage 20 clearまでにすべて発見済みまたは配属可能にする。

Story外unitの正確な配置はSolが自律決定してよい。ただし、一つのStage clearへ複数の大きなunlockを重ねない。

`大きなunlock`は、新playable unit、新支援物資、新しい恒久system tutorialのいずれかを指す。level cap上昇、図鑑更新、boss defeat receipt、story sceneはこの重複制限へ含めない。

## 8. 支援物資

正式player-facing支援物資は次の3種へ一本化する。

1. 回復支援
2. 爆薬ドラム缶
3. 火炎ドラム缶

- 出撃前に3種から**1種だけ**装備する。
- 支援物資はplayable 7枠へ含めない。
- CAPSは恒久unlockにだけ使用する。unlock後の各battleで在庫を消費する方式にはしない。
- battle内使用はbattle-local command／scrapとcooldownで制限する。
- 敗北しても恒久unlockを失わない。
- 回復支援：Stage 2 clear後に購入可能。
- 爆薬ドラム缶：Stage 6 clear後に購入可能。
- 火炎ドラム缶：ザキミヤ登場後かつ同じStageへ重ねず、Stage 13 clear後に購入可能。
- CRAWLER barrage／airstrike等は支援物資3種とは別の緊急能力として扱う。4つ目の装備支援として混在させない。
- 現行`pod／drum／medical`と`barrel／medkit／molotov／airstrike`の二重contract、重複UI、旧fallbackを解消する。

数値、placement、cooldown、effect duration、animation、audioはSolが本書の難易度・経済制約内で自律調整する。

## 9. Unit progression

正式リリース本編のlevel capを次へ固定する。

| 進行 | 公開level cap |
|---|---:|
| New Game | 5 |
| Stage 5 clear | 10 |
| Stage 10 clear | 15 |
| Stage 15 clear | 20 |
| Stage 20 clear | 25 |
| Stage 25 clear | 30 |
| Stage 30 clear／postgame | 35 |

- Stage 30はlevel cap 30を基準にbalanceする。
- Level 35はENDING後のSurvival／異常発生／replay向け。
- 内部Level 50基盤は将来拡張用に保持してよいが、Version 1.0.0の通常player導線からLevel 36〜50へ到達させない。
- catch-up discountを維持し、後から配属したunitを現実的なcostで追いつかせる。
- 本編中に16体全員を最大育成することは標準目標にしない。
- 標準playerが主力7体を推奨帯へ維持し、2体程度の控えを主力から5 level以内へ保てるCAPS供給を基準にする。

## 10. CAPS economy

### 10.1 Player model

Solは最低限、次の3 profileをdeterministicにsimulationする。

- `minimal`：1 star中心、購入を絞る、replayほぼなし
- `standard`：2 star平均、5 Stageにつき0〜1 replay、7〜9体を主力運用
- `completionist`：3 star／replay／全unit／全supportを追う

### 10.2 固定制約

- `standard`は必須のclass access、7体主力育成、物語進行のためにgrindを要求しない。
- Stage 20時点で標準playerが7〜9体、Stage 30時点で10〜12体を現実的に配属できる供給を目安とする。
- 全16体、全支援、全員上限育成は本編初回clearだけで完成させず、replay／postgameの目標として残す。
- 一度の購入判断ミスでcampaignが詰まらない。現在到達済みStageのreplay 2回以内を目安に、次の有効な配属・強化へ復帰できる。
- first-clear、star milestone、replay、boss、他modeのreceiptを分離し、同一結果の二重付与を禁止する。
- supportは恒久unlock制であり、敗北ごとの買い直しを要求しない。
- replay rewardは初回報酬より明確に低くし、grind最適解が物語進行を上回らない。
- 旧player記念CAPSは、Stage 1〜10の総first-clear CAPSの8〜12%を目安にSolが確定する。早期〜中盤のunit 1体または複数の初期強化を選べるが、chapter economyを飛ばせない額にする。

## 11. Unit balanceの自動調整権限

Solは次を自律調整し、Design Lockへ確定値と根拠を記録してよい。

- deployment cost／cooldown
- HP／damage／attack interval／range／speed／defense
- heal／control／special abilityの数値
- recruitment cost／upgrade cost／support unlock cost
- Stage reward／star reward／replay reward
- wave、spawn timing、enemy count、enemy stat
- boss stat、phase threshold、telegraph window
- Story外unitの正確なunlock Stage
- bossのSurvival／異常発生追加threshold
- 旧player記念CAPS額

ただし次を守る。

- characterのidentity、武器、primary class、signature ability、物語上の役割を変更しない。
- 既存unitを別classへ移す場合は、現行dataでは成立しない根拠が必要で、`DESIGN_DELTA_REQUIRED`とする。
- generic encounterにおいて、単一unitがcost効率、durability、damage、utilityを同時に支配しない。
- 各unitに最低1つ、他unitへ完全に代替されない明確な用途を残す。
- specialized matchupの強さは許容するが、全Stageで常に最適になる万能unitを作らない。
- 既存unitの単一combat statを現行値から30%を超えて変更する場合は、理由、simulation、回帰riskをDesign Lockへ明記する。30%超を一律禁止はしない。
- tuningは固定seed、入力条件、before／after tableを保存し、再現可能にする。
- hidden runtime DDA、server-side remote tuning、playerごとの秘密補正は導入しない。
- 本書の制約内で成立する数値判断をProducerへ差し戻さない。矛盾して同時達成不能な場合だけ停止する。

## 12. Star／result contract

- 1 starはmission clear。
- 2／3 starはStage固有の防衛対象、base／escort integrity、救助、封鎖、objective達成度から設計する。
- timed mission以外へ一律のclear time条件を置かない。
- unit loss数を全Stage共通のstar条件にしない。
- 支援物資使用をstar減点にしない。
- 味方拠点HPと敵拠点HPを取り違えない。評価対象とsnapshot時点をStage contractへ明示する。
- resultは獲得CAPS、star、unlock、boss receipt、story progressionを一度だけ確定し、再描画・reload・戻る操作で再適用しない。

## 13. Boss／他mode

- Storyでbossへ遭遇した時点では、spoilerにならない最小情報だけ図鑑へ記録する。
- Story撃破後に正式名称、詳細図鑑、rematch、Survival／異常発生の適切なpoolを解放する。
- Story defeat、compendium reveal、他mode unlock、first reward、repeat reward、defeat countを別receipt／stateとして管理する。
- TAKUYAとTAKUYA-Ωは別boss ID、別result ID、別compendium IDとして扱う。
- Story未撃破bossを他mode、図鑑一覧、QAでplayer-facingに先出ししない。
- 各bossの正確な追加mode／wave thresholdはSolがstory順、difficulty、reward economyを壊さない範囲で自律決定する。

## 14. Save／旧player

- 旧20 Stage進行を新30 Stageへmigrationして継続させない。
- 旧save、localStorage、IndexedDB、backup、manual exportを削除・上書きしない。
- 新campaignは新generation／namespaceでfresh startする。
- 旧player eligibilityは旧dataをread-onlyで検出する。
- 記念CAPSはpopup付きで一度だけ付与し、localStorage／IndexedDB replica、reload、multiple tabs、manual import、recoveryを通じて二重受取できないreceiptを持つ。
- resetは新campaignだけを対象にし、旧player eligibility evidenceを誤って消さない。
- rollback、last-known-good、corrupt recovery、manual export／importを維持する。

## 15. 画像・戦闘asset

### 15.1 共通

- event会話へ継続的に登場する主要人物には、腰から上が判別できるevent portraitを用意する。
- 戦場へ出る人物・感染体・bossにはbattle sprite／atlasが必須。
- event-only人物にbattle atlasを作らない。
- battle-only量産兵へ不要な個別高精細portraitを大量制作しない。
- identity／battle masterは1画像1キャラ、全身、透過、文字なし、装備切れなしを基本とする。
- 既存assetはidentity、性別、顔、武器、役割、画風、crop、mobile readを監査し、合格なら再利用する。
- 新規assetにはsource、creator、license、Producer delegation、master/output hash、runtime bytes、生成promptを記録する。

### 15.2 RED PANTHER

共通identity：

- human
- 赤レンズのガスマスク
- 黒／gray主体、赤を限定accent
- grounded tactical equipment
- 過剰な近未来化をしない
- 同一組織と分かる装備言語
- 体格、armor、loadout、silhouetteで役割差を出す

必要兵種：

1. サバイバルナイフ近接兵
2. 盾兵
3. サブマシンガン兵
4. 指揮官兵

四兵種はbattle participantなので、identity master、battle atlas、attack presentation、hit／defeat、weapon VFX／audioが必須。近接兵のknifeをgenericな安価propに見せない。

### 15.3 TAKUYA-Ω

- 現行TAKUYAのidentityを踏襲する。
- 現行visual比およそ2倍のgiant bossとする。
- 橙色安全vestの残骸、人工armor、背面投薬管をidentity motifにする。
- 別個体に見える全面刷新をしない。
- distinct boss ID、body bounds、foot anchor、shadow、hitbox、telegraph、phase、attack、defeat、中和因子回収を設計する。
- event／compendium readとbattle atlasの両方を用意する。

### 15.4 ムガリアン社長

- 通常状態はevent portrait必須。
- Stage 25変異体は別identity state、boss atlas、entrance、telegraph、attack、defeat、compendiumが必須。
- 通常状態からの連続性を残す。

### 15.5 セガワのface reference

- Codexへ同時添付される写真は**セガワ本人のface identity reference**として扱う。
- `ナオキ`ではない。ナオキという別character、alias、ID、置換関係を新設しない。
- 写真をムガリアン社長、RED PANTHER指揮官、その他の人物へ流用しない。
- 原写真をpublic repository、runtime asset、Issue、PRへcommit／uploadしない。
- 原写真のmetadata、撮影情報、不要な背景情報を保存しない。
- セガワは主要event portraitが必須。現行v10ではplayerと戦うcharacterではないためbattle atlasは不要。
- face identity、年齢印象、主要顔特徴を保持し、衣装、表情、lightingをv10のセガワへ適応する。

## 16. Solが停止してProducerへ返してよい条件

次の場合だけ`DESIGN_DELTA_REQUIRED`またはProducer decision blockerとして停止してよい。

- v10本文と本書が論理的に同時成立しない
- identity referenceが破損／未添付でセガワの顔を成立させられない
- repositoryの実態が本書の前提と根本的に異なり、save／PWA／releaseを安全に設計できない
- 既存権利・license・privacy上、正式採用できないassetしかない
- 本書の複数の固定acceptanceがsimulationとruntimeの両方で同時達成不能
- main／branch／open PRの競合により安全なbaselineを固定できない

単なる数値選択、Story外unitのunlock配置、cost、wave、support調整、bossの他mode追加先は停止理由にしない。

## 17. 完成・正式リリース不可条件

次のいずれかが残る場合は「完成」「正式リリース可能」と報告しない。

- 未配置object
- missing asset、仮画像、diagnostic placeholderのproduction露出
- event portraitとspeakerの不一致
- battle participantのsprite／animation／attack presentation不足
- stage固有object、背景、objective、enemy wave、boss entrance／defeatの未接続
- effect、audio、battle bark、event transitionの空欄
- Stage clear後の次目的地、unlock、配属、他mode連携の断絶
- CAPS二重付与、二重購入、二重unlock
- 7体上限または同一character 1体制限の迂回
- 特定character未購入による進行不能
- save hydration／replica／reset／reward eligibilityの破壊
- smartphone横画面での切れ、重なり、豆粒化、操作不能
- Stage 1〜30、ENDING、EPILOGUEまでのfresh run未確認
- minimal／standard／completionist economy simulation未実施
- 各Stageの複数編成clear evidence不足
- HighまたはMedium findingの未解消

## 18. 変更禁止

- v10の人物弧、黒幕、開示順、ENDING／EPILOGUEを実装都合で改変しない。
- 既存unitのidentity、性別、顔、武器、signature roleを無断変更しない。
- `main`へ直接pushしない。
- force push、rebase、amend、既存tag移動をしない。
- 旧save、backup、assetを容量削減目的で削除しない。
- test、acceptance、visual thresholdを実装都合で弱体化しない。
- CI greenだけで完成扱いしない。
