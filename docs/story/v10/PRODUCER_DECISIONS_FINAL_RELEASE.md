# Version 1.0.0 正式リリース — Producer Decisions v4

更新日：2026-08-14  
状態：**Sol Design開始前の確定Producer Brief**  
対象：v10正史を基礎にしたPROLOGUE〜Stage 30／ENDING／エンドロール／EPILOGUE

## 1. 完成条件

`西新世紀末物語`をVersion **1.0.0**として完成させる。

完成とは、物語、30 Stage、戦闘、CAPS経済、配備登録、育成、支援、ボス、他mode、画像、animation、VFX、audio、save、offline、PWA update／rollback、スマートフォン横画面が一つの実プレイとして接続され、未配置、未接続、仮画像、診断placeholder、空演出、壊れたevent token、speaker／portrait mismatch、未完成objectが残っていない状態を指す。

実装PRは分割してよいが、断片的なplayer-facing状態を正式公開しない。

## 2. 正本と用語

1. 本書
2. `STORY_SCRIPT_V10.md`から復元・hash検証したv10全文
3. Solが作成する最新Design Lock
4. `STORY_IMPLEMENTATION_MAP.md`
5. live code／tests／assets／save／PWA
6. 旧Story Bible、旧Issue、旧PR、旧台本

台本復元期待値：

- UTF-8 bytes：`138747`
- lines：`2681`
- SHA-256：`c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`

player-facing車両名は**装甲車両**で統一する。`走行車両`は不採用。`CRAWLER`等は互換用内部ID、型名、asset path、migration aliasとして必要な場合だけ残し、通常UI、台本、任務、強化画面、図鑑、通知、設定、会話ログ、result、accessibility、save説明、metadataへ露出させない。

RED PANTHERの正式名称はStage 27で初開示する。それ以前は赤レンズ部隊、ガスマスク部隊等のgeneric表記を使う。

## 3. 主人公名system

### 3.1 入力導線

- titleでニューゲーム／`物語を始める`を選んだ後、PROLOGUE本文へ入る前に名前入力screenを表示する。
- 「入力した名前は仲間が物語中で呼ぶ名前になる」と明示する。
- main actionは`この名前で始める`。
- 未入力、または明示的skip時のfallbackは`指揮官`。
- 名前を入力しなくても進行不能にしない。
- 設定または人物情報から後で変更できる導線を置く。

### 3.2 入力・展開

- 1〜12 Unicode grapheme clusters。
- 前後空白を除去し、連続する通常空白／全角空白を一つへ縮約する。
- 改行、制御文字、双方向制御文字、悪用されるゼロ幅文字を拒否する。
- 日本語、英数字、一般的な絵文字を許可し、独断の禁止語filterを追加しない。
- HTML／markupとして解釈せず常にtextとして描画する。
- canonical tokenは`{{PLAYER_NAME}}`。v10本文の敬称・距離感をそのまま尊重し、全員が毎回名前を呼ぶ不自然な実装にしない。
- raw tokenをplayer-facingへ残さない。
- PROLOGUE、複数Chapter、Stage 30、ENDING、エンドロール、EPILOGUEへ実際に反映する。

### 3.3 保存・変更

主人公名はactive save、replica／backup、manual export／import、event log、既読event再生、既読自動skip、中断復帰、ENDING／EPILOGUE、accessibilityで同じ値を使う。

名前変更後は表示時に現在名へ展開してよいが、event ID、read state、選択履歴、receipt、報酬、加入、unlock、Stage進行を再発火させない。

844×390／844×340でsoftware keyboard表示中も、入力欄、確認、決定、戻るへ到達できること。12 graphemeでも話者欄、本文、log、portrait、buttonを崩さない。

## 4. 主人公と初見player

主人公は基本的に無言だが傍観者にしない。原則は、**主人公が何かをしたから次の台詞・戦闘・結果が発生する**ことである。

地図への目標設定、出撃・撤退・救助優先順位、扉・端末・解除盤の操作、装甲車両の移動、証拠の回収、セガワとの接続／遮断、散布系統の破壊、Stage 30の連携等を、`▶ PLAYER`のaction beatと実際のgameplay operationへ対応させる。fake choiceや未承認のstory branchingは追加しない。

Version 1.0.0は過去Versionの既読を前提にしない。初見playerが、人物、世界、西新、ムガリアン製薬、赤レンズ部隊、各Stageへ行く理由、勝利で変わること、次Stageへ進む理由を理解できるよう、広告、医療箱、病院、地下研究所、企業表示、人物の反応、短い会話、画面表示を段階的に使う。長い情報dumpやdeveloper jargonを通常UIへ出さない。

TAKUYA戦の主目標は次へ統一する。

- Stage 3：`大型変異感染者TAKUYAを撃破`
- Stage 30：`TAKUYA-Ωを撃破し、西新を守る`

右腕、右胸等の部位名を通常の主目標文にしない。必要な部位mechanicはtelegraph、boss HUD、animation、短い状況警告で伝える。

## 5. Event system

正式phase：

- `prologue`
- `pre`
- `post`
- `first-clear-post`
- `ending`
- `epilogue`

本編の長い台詞を`battle-story`／`mid-battle-dialogue`へ移さない。戦闘を停止する会話画面や、読まないと黒幕情報を理解できない戦闘字幕を使わない。戦闘voiceは現在状況への短い反応だけにする。

基本flow：

`作戦前event → 編成 → 戦闘 → result → 勝利後event → 解放／加入／報酬 → 次Stage`

加入、配備登録解禁、報酬を勝利後eventより先に表示しない。first-clear event、reward、unlock、加入はatomicかつidempotentに処理する。

Event UIは背景、左右portrait、speaker、dialogue、action beat、text advance、skip、conversation log、既読自動skip、explicit replay、暗転、必要最小限の演出、中断復帰を持つ。event IDは一意でversionedとし、unknown speaker、空本文、壊れたtoken、portrait mismatch、speaker mismatchを0にする。

## 6. 初期unit・role・召喚上限

初期unit：

1. ハチ — skirmisher／低cost
2. パイセン — frontline
3. クマバーソン — heavy
4. ババヤガ — marksman

一次role：`frontline／heavy／skirmisher／marksman／suppression／support／engineer`

- formationは最大7枠。
- 戦場のplayable active instance上限は合計7体。
- 同一characterは何度でも召喚可能。同じcharacterの複数体同時存在も許可する。
- 8体目だけをauthoritative stateで拒否し、command、cost、cooldown、receiptを消費しない。
- 装甲車両、NPC、escort、mission object、support object、敵は7体枠へ含めない。
- 独立HP／target／damageを持つplayer-controlled summonは7体枠へ含める。
- role構成はsoft requirement。特定character必須、class不足による出撃hard blockは禁止。
- 脅威categoryと推奨role／counter tagを簡潔に表示する。
- 複数編成clear証明、全Stageの編成matrix、大量evidenceは作らない。

低cost unitの複数召喚は禁止しない。総数7体、deployment cost、cooldown、敵構成で混成編成にも価値を持たせる。

## 7. Mission・boss

基本missionは現行基盤を再利用する次へ限定する。

1. 敵拠点破壊
2. 短い時間防衛
3. 必要なStageだけ電源switch
4. 必要なStageだけ台車／搬送object護衛
5. boss撃破

時間防衛は90秒前後、原則75〜120秒。150秒以上は原則禁止。escortは距離、速度、waveをまとめて短縮する。台本のト書きを理由に複雑な新mission systemを増やさない。bossへ不自然なhard time limitを置かない。

bossは現行より明確に強化する。HPだけでなくdamage、attack cadence、phase、add、target pressure、control resistance、telegraphを使う。低cost連打だけでmechanicを無視しにくくする一方、damage sponge、不可避即死、永久stun、長時間拘束は禁止する。全編成証明は不要で、章bossとStage 30を中心に必要なspot checkだけ行う。

## 8. 育成・CAPS・unlock

- campaign表示最大Levelは30。
- capはNew Game 5、Stage 5後10、Stage 10後15、Stage 15後20、Stage 20後25、Stage 25後30。
- CAPSは戦闘外恒久通貨。配備登録、Level up、equipment、support解禁、装甲車両HP強化に使う。
- story上は`合流`、system上は`戦闘配備登録が解禁`、CAPS操作は`配備登録`。
- ナオはStage 1後に解禁し、Stage 1初回報酬だけで登録可能。
- Stage 8開始までに7 primary roleへアクセス可能。
- ザキミヤStage 12、TKY Stage 14、Mrs.チハ Stage 17、宮本武蔵Stage 20の合流後に配備登録解禁。
- 現行16 playable unitはStage 20までに発見済みまたは配備登録可能。
- mandatory replay grindは禁止。
- Stage 30前に全unit、全support、全Level、全equipment、装甲車両強化を買い切れる供給過多にしない。

Solは標準進行の一本の計算表と、CAPS不足／過剰供給の境界確認だけでexact値を決定してよい。

## 9. 装甲車両

### 9.1 HP

- Stageごとに異なる装甲車両`baseHp`を廃止し、全campaign Stageで一つのcanonical base HPを使用する。
- battle開始時HPはcanonical base HP＋恒久upgrade分から一意に算出する。
- escort台車、civilian、電源設備等のHPは別contractとする。
- base HP、1回の増加量、最大回数、CAPS cost curveはSolが全30 Stageと経済から確定する。
- 強化だけでboss mechanicを無視できない上限を持たせる。

### 9.2 専用強化screen

- 拠点／管理画面上部付近に`装甲車両を強化する`入口を置く。
- 中央に装甲車両の全体graphicを大きく表示し、車体を切らない。
- 現在Level、現在HP、強化後HP、必要CAPS、所持CAPSを表示する。
- main actionは`HPを強化`、最大時は`強化上限`。
- 844×390／844×340で車両を豆粒化させず、文字、数値、button、safe areaを重ねない。
- 既存full vehicle graphicを優先し、専用画面に耐えない場合だけ新規assetを作る。

### 9.3 Transaction／feedback

CAPS減算、HP upgrade、receipt、saveをatomicに処理する。durable save成功後だけ、HP上昇表示、車両graphicの短い反応、チャリンチャリンと分かる金属的な強化SEを出す。二重tap、reload、multiple tabs、save retryによる二重減算／二重強化を禁止する。CAPS不足、上限、save失敗時は成功演出・成功SEを出さない。

## 10. Support

正式support：

1. 回復支援
2. 爆薬ドラム缶
3. 火炎ドラム缶

CAPSで恒久解禁し、出撃前に1種を装備する。battle中はbattle-local resource／cooldownを使用する。`pod`は通常loadoutから外す。航空支援／一斉砲撃は装甲車両固有abilityとして分離する。解禁windowは回復Stage 2〜3、爆薬Stage 5〜7、火炎Stage 9〜11とし、exact Stageは他unlockとの重複を避けてSolが決定する。

## 11. Character／asset

- event主要人物は腰上portrait。
- battle participantはbattle atlas必須。
- 既存assetを先に監査し、`NEW_REQUIRED`だけを有限個生成する。
- 新規identity masterは1画像1character、全身完全表示、武器・装備・手足を切らない、透明背景、文字・logo・枠・背景なし。candidateを一枚のcharacter sheetへまとめない。

### セガワ

ProducerがSolへ添付する写真は『ネコ殺しのセガワ特級博士』だけのprivate face identity reference。ナオキではない。別character、alias、IDを作らず他characterへ流用しない。v10ではplayer combatantではないためbattle atlasは原則不要。原写真、metadata、撮影背景をrepository、runtime、Issue、PR、CI artifact、QA evidence、log、公開物へ保存しない。Git管理対象にできるのは承認済みproject-original derived master／event portraitと非機微なprovenanceだけ。

### RED PANTHER

近接兵（survival knife）、盾兵、SMG兵、指揮官兵の四兵種を用意する。赤レンズのガスマスク等の組織共通装備を持たせつつ、体格、armor、武器、silhouetteで即時判別できること。四兵種はbattle participantでありbattle atlas、attack presentation、hit／defeat state、audio／VFXが必要。

### 変異ムガリアン社長

通常社長のidentity連続性を維持したboss identity、event／compendium read、boss atlas、telegraph、attack、hit、defeatを用意する。

### TAKUYA-Ω

既存TAKUYAのcharacter identityと見た目を明確に基礎にし、Stage 3のTAKUYAと同一個体の最終変異だと認識できる連続性を持たせる。

既存TAKUYAの顔・頭部・体格・特徴、橙色の安全vest残骸、人工armor、背面の複数投薬管を継承し、不均衡な異常肥大、左右非対称、肉体と人工armorの侵食・融合、投薬による暴走感、崩れたsilhouetteを加える。単なる巨大化、色違い、装甲追加、genericなAI怪物、無関係な別monster、綺麗すぎる近未来robotは不合格。

現行文書の「約2倍」は厳密な数値acceptanceにせず、既存TAKUYAとの連続性、final bossとしての圧力、mobile readability、telegraph、hitbox、animation、performanceを同時に満たすexact scaleをSolが確定する。

その他のcharacterはv10正本と既存identity、性別、年齢印象、武器、役割、服装を維持し、具体的不足がない限り再設計、別人化、武器変更、役割変更、無断のmain cast化を行わない。

## 12. Save／legacy／PWA

- Version 1.0.0は新campaign generation／namespaceで開始し、旧Stage進行は自動移行しない。
- 旧localStorage、IndexedDB、backup、manual export、last-known-goodを削除しない。
- 安全なsettingsだけ引継ぎ可能。
- 主人公名、event read state、event resume position、装甲車両upgrade Level／receiptを新saveへ保存する。
- legacy記念CAPS等の一回性処理はreload、recovery、manual import、multiple tabsで二重受取させない。
- reward、star、unlock、CAPS、upgrade、event、receiptを同一結果で二重適用しない。
- update、offline、rollback、commit-only recoveryでname／event／campaign saveを壊さない。

## 13. Solの自動調整権限

上記の製品判断を守る限り、Solは次をProducerへ一件ずつ戻さず確定してよい。

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

これはDesign／QA中の静的tuning権限であり、公開後runtimeのhidden DDAではない。

## 14. 実装分割・必要最小限のQA

Luna Handoffは最低限次の依存順へ分ける。

1. 主人公名／event基盤／save schema／event UI
2. PROLOGUE〜Stage 20接続
3. Stage 21〜30／ENDING／EPILOGUE／新敵・boss
4. 最終統合、asset、audio、PWA、全通しQA

必要な確認：

- 30 Stageのobjective、duration、wave、boss、unlockのdata接続
- 主人公名の入力、fallback、token展開、rename、save、log、ENDING／EPILOGUE
- 8体目reject、同一character複数召喚allow
- 装甲車両HPが全Stageでcanonical＋upgradeから算出
- 装甲車両強化screen、CAPS transaction、save、SE
- pre→battle→result→post→unlock／rewardの順序と二重処理0
- 章bossとStage 30のbalance spot check
- final candidateで名前入力からStage 1〜30、ENDING、エンドロール、EPILOGUEを一度通す
- 初回、続き、最初から、敗北、再戦、map復帰、reload、中断復帰
- save、offline、PWA update、rollback、legacy reward
- 844×390、844×340、1280×720
- missing asset、placeholder、unknown speaker、speaker／portrait mismatch、raw token 0

作成しないもの：複数編成clear matrix、全Stage複数編成証明、人間clear率の大規模計測、不要な大量evidence、監査だけのための新Issue／新文書。

## 15. Release gate

次が一つでも残る場合、`DESIGN_LOCKED`、`READY_FOR_RELEASE`、`APPROVE`、`完成`と報告しない。

- v10 hash未検証または全文未読
- 主人公名がPROLOGUE〜EPILOGUEへ反映されない
- raw token、speaker／portrait mismatch、未配置object、placeholder、未完成animation／VFX／audio
- 戦闘中の長いstory event
- 7体上限の迂回、同一character複数召喚の誤拒否
- 150秒以上の冗長な通常防衛／escortが理由なく残る
- 装甲車両HPのStage別ばらつき、強化screen未接続、transaction不整合
- CAPS、reward、unlock、receiptの二重適用
- save、offline、PWA、rollbackの破壊
- smartphone横画面で切れ、重なり、豆粒化、操作不能
- High／Medium finding未解消

## 16. 停止条件

Solは技術調査、数値、duration、wave、cost、module分割、test方式、asset棚卸し、名称drift修正、token設計で解ける事項を質問せず自律解決する。

停止できるのは次だけ。

- v10本文、人物弧、Stage因果、ENDING／EPILOGUEの変更が必要
- 既存character identityの置換が必要
- 新mode、新通貨、story branching、permadeath等の未承認systemが必要
- 旧save／asset削除、不可逆migration、history rewriteが必要
- license／commercial-use／provenanceが不明
- 正本同士の矛盾を本書と技術調査だけで一意に解けない