# Version 1.0.0 正式リリース — Producer Decisions v2

更新日：2026-08-14  
状態：**Sol Design開始前の確定Producer Brief**  
対象：v10正史台本を基礎にしたPROLOGUE〜Stage 30／ENDING／EPILOGUEの完成リリース

## 1. 主目的

`西新世紀末物語`をVersion **1.0.0**として完成させる。

完成とは、台本を表示できること、Stage数が30になること、CIがgreenになることではない。物語、戦闘、進行、CAPS経済、ユニット解放、育成、支援、ボス、他mode、画像、animation、VFX、audio、save、PWA、スマートフォン横画面を一つの実プレイとして接続し、未配置、未接続、仮画像、診断placeholder、空演出、未完成objectを残さないことを意味する。

途中の実装PRは分割してよいが、Stage 1〜30が一体として成立するまで、断片的なplayer-facing状態を正式公開しない。

## 2. 正本・正規表記

- 物語正本は`docs/story/v10/STORY_SCRIPT_V10.md`から復元・hash検証したv10全文。
- 本編は30 Stage。ENDINGとEPILOGUEまで必須。
- 作品の中心は「生き残る。人を生かす。西新を取り戻す」。
- 主人公は無言だが、扉を開く、証拠を保存する、最後の一人を待つ、避難路の前へ立つ等の行動で物語を動かす。
- player-facing車両名は**装甲車両**。互換目的の内部IDとして`crawler`等を残しても、台詞、UI、地図、図鑑、通知、alt、字幕、読み上げへ露出させない。
- 正式名称は`ムガリアン製薬`、`ムガリアン社長`、`セガワ`、`ネコ殺しのセガワ特級博士`、`TAKUYA`、`TAKUYA-Ω`。
- 赤レンズのガスマスク部隊はStage 26までは正体を伏せ、Stage 27で初めて正式名称**RED PANTHER**を開示する。Stage 27以前のUI、図鑑、敵名、字幕で正式名称を先出ししない。
- 既存ユニットを本編会話へ無理に追加せず、現在のidentity、性別、武器、役割を新設定で上書きしない。

## 3. 主人公名

v10の主人公名入力を採用する。

- ニューゲーム開始時に一度入力する。
- 未入力／skip時の表示名は`指揮官`。
- 保存先は新campaign generation内のplayer profile。
- 最大12 grapheme。前後空白を除去し、改行、制御文字、双方向制御文字、ゼロ幅の悪用文字を拒否する。HTML／markupとして解釈せず常にtextとして描画する。
- 日本語、英数字、絵文字は使用可能。禁止語filterを独断で追加しない。
- 台詞token展開、save、export／import、既読skip、ENDING／EPILOGUE、accessibility読み上げで同じ値を使用する。
- `{{PLAYER_NAME}}`は入力名、未設定時は`指揮官`。`{{PLAYER_NAME_SAN}}`は入力名＋`さん`、未設定時は`指揮官`へ展開する。

## 4. 初期ユニットと編成

### 4.1 初期4体

ニューゲーム開始時に戦闘配備できるunitは次の4体だけとする。

1. ハチ — skirmisher／低cost
2. パイセン — frontline
3. クマバーソン — heavy
4. ババヤガ — marksman

現行codeでハチが最安costかつ高速迎撃役であるため、4体目の低cost unitは**ハチで確定**する。

### 4.2 編成枠

- formationは最大7枠。
- 同じ固有unit cardを複数枠へ登録できない。
- 1〜7体で出撃可能。後半は7体編成を標準想定とする。
- 既存の3 presetは維持してよい。

### 4.3 戦場同時出撃上限

- 戦場に存在できるplayable unitは最大7体。
- **同じ固有キャラクターを同時に複数体出さない。** 1 unitにつきactive instanceは最大1。
- 撃破／戦闘不能時は永久死亡ではなく撤退扱い。entityがactive lifecycleから完全に離脱してslotが解放され、個別cooldownが満了した後に再配備できる。
- HPが0になった瞬間だけでslotを先行解放しない。
- 装甲車両、NPC、escort対象、temporary story actor、支援object、敵は7枠へ含めない。
- abilityで生成され、独立target／HP／damageを持つplayer-controlled summonは7枠へ含める。純粋な演出物は含めない。
- 8体目、同一unitの二重配備、rapid input、touch／keyboard二重入力はauthoritative battle stateで拒否する。UIだけの制限にしない。
- 拒否時は状態を変更せず、command、cooldown、receiptを消費せず、短い日本語表示とreject SEを一度だけ返す。

この変更の目的は低cost連打を封じ、7枠のクラス構成と各unitの育成価値を成立させることにある。

## 5. クラス／役割編成

現行aiProfileを基礎に、一次roleを次の7系統へ統一する。

1. frontline
2. heavy
3. skirmisher
4. marksman
5. suppression
6. support
7. engineer

`tank`、`breaker`、`anti-boss`、`anti-armor`、`anti-air`、`area`、`control`等はsecondary counter tagとして扱う。一次roleを増殖させず、Stage briefingとbalance testでsecondary tagを使う。

### 5.1 Stage briefing

- 正確な敵編成は隠す。
- 出撃前に、脅威categoryと推奨role／counter tagを2〜4件だけ表示する。
- 編成に不足があれば警告するが、原則として出撃自体はblockしない。
- 推奨はキャラクター名ではなくrole／counter tagで示す。

### 5.2 クラスチェック

- 通常Stageはsoft checkを基本とする。
- chapter gate／boss Stageでもclass名によるhard entry gateは原則作らない。mechanic上どうしても強いcounterが必要な場合は、明示済みのrole／counter tagを最大1系統まで要求できる。
- exact named unit必須は禁止。
- 強いcounterには最低2つの異なるunit／戦術的routeを用意する。
- 必要なcounterは該当Stage前に解禁され、first-clear中心の経済で少なくとも1つを登録可能でなければならない。
- hidden immunity、予告なしの即死、永久stun、off-screen確定hit、対処不能なspawn、単一unitだけが解除できるgimmickは禁止。
- bossとheavy enemyにはcontrol resistance／diminishing returnを持たせ、無限拘束を防ぐ。
- supportは事故回避と戦術拡張に使えるが、全roleを無視できる万能解にはしない。

### 5.3 編成多様性の受入基準

- tutorialを除く通常Stageは、少なくとも3種類の明確に異なる合法編成でrecommended cap内clear可能。
- 専門性の高いboss Stageも、少なくとも2種類の合法編成でclear可能。
- 低cost単一role偏重が、混成編成より一貫して高いclear率を出す状態を不合格とする。
- 新しい脅威を出す前に、UI上の説明、counterの解禁、試せる安全な導入を置く。

## 6. 難易度方針

### 6.1 基本

- Version 1.0.0 campaignは単一の意図された難易度で設計する。新しいEasy／Hard selectorは追加しない。
- 難度は**hardcoreだがfair**。判断、編成、配置、再挑戦で突破できること。
- runtimeで敵を密かに弱体化／強化するhidden DDAは導入しない。
- player level連動のhidden enemy scalingも導入しない。Stage値はrelease内で固定し、Design／QA段階で調整する。
- 敗北時にCAPS、unit、装備、story progressを失わない。retry costは0。
- 敗北画面は「役割不足」「育成不足」「object防衛失敗」「配置不良」等、観測できた原因と再挑戦の具体的hintを返す。自動nerfはしない。

### 6.2 体験目標

人間playtestでの目標値であり、自動testだけで達成したと断定しない。

- Stage 1〜2：初見clear 75〜90%
- 通常Stage：recommended帯の初見clear 55〜75%
- chapter boss：35〜55%
- Stage 30：25〜45%
- 1〜3回のretry、編成変更、1〜2段階の育成後：75〜90%がclear可能

目安時間：

- 通常Stage：3〜5分
- boss／複合objective：4〜7分
- 失敗が確定しているのに長時間消化させない。

### 6.3 星評価

- 1 starはStage clearそのもの。次Stageの解禁は1 starだけで成立する。
- 2／3 starは任意のmastery。story進行、必須unit、必須support、ENDING到達条件にしない。
- 追加starは味方側objectiveのintegrity、救助、任意目標等で判定する。
- mission自体がtime-basedでない限り、速度だけをstar条件にしない。
- 条件は出撃前または戦闘中に確認可能とし、hidden conditionを使わない。
- 味方拠点と敵拠点、escort object等の参照対象をIDで明示し、取り違えtestを持つ。

## 7. 育成

### 7.1 Level cap

- campaignのplayer-facing最大levelは**30**。
- 内部Level 50基盤はSurvival／将来拡張用として保全し、campaign UIでは30を超えて育成できない。
- campaign cap milestoneは次で固定する。

| 到達条件 | 上限 |
|---|---:|
| New Game | 5 |
| Stage 5 clear | 10 |
| Stage 10 clear | 15 |
| Stage 15 clear | 20 |
| Stage 20 clear | 25 |
| Stage 25 clear | 30 |

- Stage 30はLevel 30を前提にbalanceする。Version 1.0.0ではENDING後もcampaign unit levelを30より上へ解禁しない。
- enemy値をlevelだけで上げず、wave、role pressure、objective、AI、positioningを組み合わせて難度を作る。
- stat growth、upgrade cost、catch-up discount、equipment contributionの正確な数値はSolがsimulationで決定する。
- overlevelだけでboss mechanicsを無視できない一方、育成が無意味にもならない範囲にする。

### 7.2 Build破壊防止

- deployment cost／cooldownを0または実質0へできないglobal floorを設ける。
- permanent stun loop、無限heal、無限resource、同一receipt二重発火、cooldown bypassをnegative testで禁止する。
- modifierは加算／乗算順を一か所で定義し、UI表示値とruntime値を一致させる。
- equipmentはroleを強めるが、primary classの弱点を完全に消さない。
- boss equipmentは有力なsidegradeとし、次のmandatory bossを倒す必須条件にしない。

## 8. CAPS経済と配備登録

### 8.1 通貨の意味

- CAPSは戦闘外の恒久通貨。
- unitの戦闘配備登録、level up、equipment、supportの恒久解禁に使う。
- battle中にCAPSを消費しない。
- battle内resourceはcommand、scrap、support gauge等へ分離し、Stage終了時にCAPSと混同しない。

### 8.2 「加入」と購入制の整合

人物そのものを買う表現は禁止する。

- story上：`合流`
- system上：`戦闘配備登録が解禁`
- CAPS購入action：`配備登録`
- 初期4体：`配備登録済み`

CAPSは本人への雇用料ではなく、装備、整備、弾薬、医療、車両内slot等を含む戦闘配備資源として扱う。v10の会話本文は変えず、SYSTEM copyと雇用UIをこの用語へ統一する。

### 8.3 解禁原則

- story characterは正史上の合流直後に配備登録を解禁する。
- ナオはStage 1 clear後にsupportとして解禁し、Stage 1のfirst-clear収入だけで登録可能にする。
- suppressionの選択肢はStage 4まで、engineer／controlはStage 6まで、追加heavy／breakerはStage 8までに少なくとも1体を解禁する。
- Stage 8開始までに7 primary roleすべてへアクセス可能にする。
- ザキミヤはStage 12、TKYはStage 14、Mrs.チハはStage 17、宮本武蔵はStage 20の物語合流後に配備登録を解禁する。
- 現行16 playable unitはStage 20 clearまでに全て発見済みまたは配備登録可能にする。
- Stage 21〜30では原則として新playable unitを追加せず、育成・編成・物語終盤へ集中させる。
- 同一Stage clearへ大きなunit解禁、support解禁、system解禁を重ねすぎない。原則1つ、やむを得ない場合でも2つまで。
- exact unlock calendarはSolが30 Stage全体の物語と経済を見て固定する。

### 8.4 経済guardrail

Solはexact reward／costを自動調整してよいが、次を満たすこと。

- main storyを進めるためのmandatory replay grindは0。
- first-clear中心の収入で、各role check前に必要counterを最低1つ登録できる。
- Stage 30到達時、standard playerが7体の中核編成をchapter cap近辺まで育成できる。
- 一つの合理的な購入選択で後続Stageが永久softlockしない。
- replay報酬は失敗回復とcompletion用に残すが、first-clearより高効率にしない。
- completionistがStage 30前に全unit、全support、全level、全equipmentを購入し切る供給過多にしない。
- minimal／standard／completionistの三経済simulationを行い、各Stageのowned roster、median level、残CAPSを記録する。
- tuning値は散在させず、canonical balance dataへ集約する。

### 8.5 旧プレイヤー記念CAPS

- 有効なpre-1.0.0 campaign save／backup／receiptを非破壊で検出したplayerだけ対象。
- popup付きで一度だけ付与する。
- 額はSolが経済simulationで固定する。
- 目安は「序盤unit 1体の配備登録」または「序盤support 1種の解禁」のどちらか一つを選べる程度。
- Chapter 1を飛ばせる額、複数主要unitを一括登録できる額、想定campaign first-clear総収入の15%を超える額は禁止。
- reload、localStorage／IndexedDB replica recovery、manual import、multiple tabs、rollbackで二重受取できないdurable receiptを持つ。

## 9. 支援

player-facing支援は次の3種へ一本化する。

1. 回復支援 — 味方の範囲回復
2. 爆薬ドラム缶 — 高い瞬間爆発。持続炎上なし
3. 火炎ドラム缶 — 低めの初撃＋持続燃焼／減速

- CAPSで一度だけ恒久解禁する。
- 戦闘中の使用はbattle resourceとcooldownで管理し、CAPSを再消費しない。
- 出撃前に3種から1種だけ装備する。
- `pod`はproduction player loadoutから外す。互換／rollback用内部assetを残しても通常UIへ出さない。
- 航空支援と一斉砲撃は装甲車両固有abilityとして分離し、上記3支援へ混ぜない。
- 解禁windowは、回復支援Stage 2〜3、爆薬ドラム缶Stage 5〜7、火炎ドラム缶Stage 9〜11。exact Stageと価格はSolが他unlockとの重複を避けて固定する。
- 支援だけでrole構成を全面的に無視できないよう、効果、resource、cooldown、同時active数を調整する。

## 10. ボス・人間敵・他mode

### 10.1 Boss

- TAKUYA、改札喰い、MOTHER、オオグチ、クロメ、ガイレン、フタゴ、変異ムガリアン社長、TAKUYA-Ωをstory receiptに接続する。
- TAKUYAとTAKUYA-Ωは別ID、別compendium、別defeat count、別reward、別Survival pool entryとする。
- story未撃破bossを名称、図鑑、mode選択、Survival抽選、loading tipで先出ししない。
- story撃破後、対象bossは次回開始する他mode runからpoolへ反映する。進行中runへ途中追加しない。
- exact Outbreak／Survival配置、weight、報酬はSolがbalanceとspoiler制約内で固定する。

### 10.2 RED PANTHER

- 四兵種すべてbattle participantであり、battle atlas、attack presentation、hit／defeat／retreat state、audio／VFXが必須。
- infected AIのskin差し替えは禁止する。
- human enemy foundationとして、射線、距離維持、後退、cover利用、感染誘導beacon、target選択を設計する。
- commanderは単なる高HP版ではなく、味方への指揮、beacon、隊形変更等の戦場上の役割を持つ。
- 四兵種の装備言語は統一するが、体格、armor、weapon、silhouetteで即時判別できること。
- 近接兵のsurvival knifeはgroundedで魅力的な固有形状とし、cheap generic propにしない。

## 11. Save／PWA

- Version 1.0.0は新campaign generation／namespaceで開始する。
- 旧Stage 1〜20の進行、星、owned roster、CAPS、既読を新30 Stageへ変換しない。
- 旧localStorage、IndexedDB、backup、manual export、last-known-goodを削除しない。
- 旧dataはeligibility evidence／rollback sourceとしてread-only保全する。
- audio、graphics、accessibility、story playback等のsettingsだけ、安全に分離できる場合は引き継いでよい。
- 新campaign saveと旧saveを混ぜず、hydration、replica reconciliation、reset、import／export、corrupt recoveryを設計する。
- asset cache全削除をmigration手段にしない。

## 12. Art／asset

### 12.1 共通

- 全30 Stageと全eventをfinite inventory化し、`REUSE／RECOMPOSE／NEW_REQUIRED／OPTIONAL`へ分類する。
- event会話へ継続登場する主要人物は、腰から上が判別できるevent portraitを持つ。
- battle participantはbattle sprite／atlas必須。event-only人物にbattle atlasは不要。
- 1画像1キャラ、全身、透過、文字なし、装備・手足・武器切れなしをidentity／battle masterの基本とする。
- 既存assetはidentity、性別、武器、役割、crop、844×390／844×340での読みを監査し、合格するものは再利用する。
- 新assetはsource、creator、license、Producer approval、master／output hash、runtime bytesを記録する。

### 12.2 セガワの添付画像

このmissionと同時にProducerが添付する人物写真は、**セガワ本人のface identity reference**である。

- ナオキではない。
- セガワを別人物へ置換しない。
- 年齢印象、顔立ち、髪、輪郭、recognizabilityをidentity lockへ反映する。
- セガワは主要event portrait必須。
- script上playerが直接戦う相手ではないためbattle atlasは原則不要。
- 原写真をpublic repository、runtime、Issue、PR、CI artifact、QA evidence、logへ保存・転記しない。metadata、撮影情報、不要な背景情報も保持しない。
- repositoryへ入れられるのは、承認済みの架空characterとして派生したSegawa authoring master／event portraitと、`Producer-provided private identity reference`という非機微なprovenance記録だけとする。

### 12.3 RED PANTHER／新boss

- RED PANTHER四兵種：identity master＋battle atlas。commanderは必要に応じevent portrait。
- ムガリアン社長：通常event portrait。
- 変異ムガリアン社長：identity master＋boss atlas＋event／compendium read。
- TAKUYA-Ω：現行TAKUYAのidentityを継承し、現行比およそ2倍。橙色安全vest残骸、人工armor、背面投薬管をmotif化し、別giant boss IDとしてentrance、phase、telegraph、attack、hit、defeat、中和因子回収まで設計する。

## 13. Solの自動調整権限

Producerは、上記の製品判断とguardrailを守る限り、Solが次のexact値を調査、simulation、test、実機QAで反復調整し、Design Lockへ確定することを事前承認する。

- unit stats、deployment cost、cooldown
- recruitment／配備登録costとexact unlock Stage
- Stage reward、first-clear、star、replay CAPS
- level-up cost、stat curve、catch-up discount
- command／scrap／support gaugeの初期値、回復、上限
- support effect、battle cost、cooldown、active limit
- enemy count、wave timing、AI tuning、HP、damage、speed
- boss HP、phase threshold、telegraph、resistance、reward
- other-mode unlock先、weight、repeat reward
- 旧player記念CAPSのexact額
- Stage別推奨role／counter tag

SolはこれらをProducerへ一件ずつ差し戻さず、canonical balance tableとevidenceを含むDesign Lockへ固定してよい。

ただし、runtime hidden DDAは禁止する。自動調整とはDesign／QA中の数値最適化であり、公開後のplayerごとの密かな難易度変更ではない。

## 14. Solの停止条件

次の場合だけ`PRODUCER_DECISION_REQUIRED`として停止する。

1. v10の台詞、人物弧、Stage因果、ENDING／EPILOGUEを変更する必要がある。
2. 添付face referenceまたは既存character identityを変更／置換する必要がある。
3. この文書にない新しいplayer-facing system、mode、通貨、分岐、permadeathを導入する必要がある。
4. 旧save／assetの削除、不可逆migration、main history rewriteが必要になる。
5. exact named unit必須、mandatory grind、hidden DDAなしでは受入基準を満たせない。
6. assetのlicense／provenance／commercial useが確認できない。
7. Design Lock同士が矛盾し、技術調査で一意に解けない。

技術的に解ける数値、module分割、data structure、test方式、asset生成方式は質問せず自律解決する。

## 15. Balance validation

Solは主観的な「よさそう」で数値を確定せず、最低限次をDesign Lockへ含める。

1. unit efficiency table：damage、effective HP、control、utility、cost、cooldown
2. class／threat counter matrix
3. Stage 1〜30 recommended Level／threat／viable composition matrix
4. minimal／standard／completionist economy simulation
5. underlevel／recommended／overlevel fixtures
6. same-unit duplicate、low-cost spam、support spamのnegative test
7. objective ignore、boss mechanic ignore、offscreen attackのnegative test
8. unlock calendarと一Stage一major unlock audit
9. all 16unitに少なくとも一つの有利局面と一つの不利局面があること
10. 通常Stageに最低3つ、boss Stageに最低2つのviable compositionがあること
11. exact named unit、boss equipment、3star、他mode grindをStory必須にしないこと
12. smartphone 844×390／844×340で7card、class coverage、support、abilityが操作可能なこと

自動simulationは最終的なgame feelの証明ではない。Luna implementation後にbrowser runtime、real play、physical iPhoneを含む候補版QAを行う。

## 16. Sol asset production checkpoint

Design Lock内のfinite inventory確定後、Solは`ASSET_PRODUCTION_CHECKPOINT: PRODUCER_AUTHORIZED`を明示し、追加のProducer承認を待たず、同じgoal内で必要assetの候補生成、自己監査、authoring master選定まで進めてよい。

- existing assetを`REUSE／RECOMPOSE／NEW_REQUIRED／OPTIONAL`へ分類する。
- `NEW_REQUIRED`だけを依存順に生成し、同一characterの無秩序なvariantを作らない。
- identity lock、prompt、dimensions、alpha、direction、frame consistency、mobile read、storage、provenance、acceptanceを先に固定する。
- failed candidateをruntimeへ入れない。
- raw Segawa face photoをpublic Git／artifact／evidenceへ保存しない。
- production code／manifestへの統合はLuna Handoffへ渡す。

## 17. 完成・release gate

次のどれかが残る場合、`READY_FOR_RELEASE`、`APPROVE`、`完成`と報告しない。

- Stage 1〜30、ENDING、EPILOGUEのfresh run未確認
- formation／battle 7体上限、同一unit二重配備の迂回
- exact named unit必須、counter未解禁、mandatory grind、economy softlock
- 未配置object、missing asset、placeholder、speaker／portrait mismatch
- battle participantのsprite、animation、attack presentation、VFX、audio不足
- Stage固有背景、objective、wave、boss entrance／defeat未接続
- reportだけ存在し、実ブラウザevidenceがない
- CAPS、reward、unlock、receiptの二重適用
- save hydration、replica、import／export、offline、rollbackの破壊
- 844×390、844×340、1280×720で切れ、重なり、豆粒化、操作不能
- console／page／HTTP／request failure
- High／Medium finding未解消

最終公開前に、少なくともfresh campaign全通し、代表的なminimal／standard／completionist save、主要role別編成、全boss、全support、旧player reward、PWA partial update／offline／rollbackを固定HEADで検証する。
