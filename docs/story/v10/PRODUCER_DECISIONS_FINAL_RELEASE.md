# Version 1.0.0 正式リリース — Producer Decisions v3

更新日：2026-08-14  
状態：**Sol Design開始前の確定Producer Brief**  
対象：v10正史台本を基礎にしたPROLOGUE〜Stage 30／ENDING／EPILOGUE

## 1. 目的

`西新世紀末物語`をVersion **1.0.0**として完成させる。

完成とは、Stage 1〜30、ENDING、EPILOGUE、戦闘、進行、CAPS経済、ユニット解放、育成、支援、ボス、他mode、画像、animation、VFX、audio、save、PWA、スマートフォン横画面が一つの実プレイとして接続され、未配置、未接続、仮画像、診断placeholder、空演出、未完成objectが残っていない状態を指す。

実装PRは分割してよいが、断片的なplayer-facing状態を正式公開しない。

## 2. 正本・表記

- 物語正本は`docs/story/v10/STORY_SCRIPT_V10.md`から復元・hash検証したv10全文。
- 本編は30 Stage。ENDINGとEPILOGUEまで必須。
- 作品の中心は「生き残る。人を生かす。西新を取り戻す」。
- 主人公は無言だが、行動で物語を動かす。
- player-facing車両名は**走行車両**。互換用内部IDとして`crawler`等を残してよいが、通常UIへ露出させない。
- RED PANTHERの正式名称はStage 27で初開示する。それ以前は赤レンズ部隊、ガスマスク部隊等のgeneric表記を使う。
- 既存characterのidentity、性別、武器、役割を勝手に変更しない。

## 3. 主人公名

v10の主人公名入力を採用する。

- ニューゲーム開始時に一度入力。
- 未入力／skip時は`指揮官`。
- 最大12 grapheme。
- 改行、制御文字、双方向制御文字、悪用されるゼロ幅文字を拒否し、常にtextとして描画する。
- save、export／import、既読skip、ENDING／EPILOGUE、accessibilityで同じ値を使う。

## 4. 初期ユニット・編成・召喚上限

### 4.1 初期4体

1. ハチ — skirmisher／低cost
2. パイセン — frontline
3. クマバーソン — heavy
4. ババヤガ — marksman

### 4.2 編成

- formationは最大7枠。
- 同じunit cardを複数枠へ重複登録する必要はない。
- 1〜7種類のunitを選択して出撃できる。
- 既存の3 presetは維持してよい。

### 4.3 戦場同時出現上限

- 戦場に同時に存在できるplayable unitは**合計7体**。
- **同一characterを複数回召喚してよい。複数体が同時に存在してもよい。**
- 制限対象はcharacter種類数ではなく、全playable active instanceの合計数だけ。
- 8体目だけをauthoritative battle stateで拒否する。
- 撃破／撤退によりentityがactive lifecycleから離脱した時点で1枠を戻す。
- 走行車両、NPC、escort対象、mission object、支援object、敵は7体枠へ含めない。
- 独立したHP、target、damageを持つplayer-controlled summonは7体枠へ含める。
- 8体目の拒否時はcommand、cooldown、receiptを消費せず、短い日本語表示とreject SEを一度だけ返す。
- touch、keyboard、rapid input、同一frameの二重入力でも8体を超えられないこと。

低cost unitの複数召喚自体は禁止しない。総数7体、deployment cost、cooldown、敵構成によって混成編成にも価値を持たせる。

## 5. クラス編成

一次roleは次の7系統。

1. frontline
2. heavy
3. skirmisher
4. marksman
5. suppression
6. support
7. engineer

対装甲、対ボス、範囲、control等はsecondary tagとして扱う。

- 特定character必須Stageは禁止。
- class不足を理由に出撃をhard blockしない。
- Stage briefingは脅威categoryと推奨role／counter tagを簡潔に表示する。
- 単一class偏重は敵構成上不利になり得るが、system罰則は設けない。
- hidden immunity、予告なし即死、永久stun、off-screen確定hit、単一characterだけが解除できるgimmickは禁止。
- boss／heavy enemyにはcontrol resistanceを持たせ、無限拘束を防ぐ。

**複数編成ごとのclear証明、通常Stage3編成／boss2編成のmatrix作成は要求しない。** これは時間を浪費するため、本missionの成果物・release gateから除外する。

## 6. Stage missionの範囲

v10台本のト書きは、必要以上に複雑な新mission systemを要求するものとして解釈しない。

正式版の基本missionは、現行基盤を使う次の範囲に限定する。

1. 敵拠点を破壊する
2. 一定時間、敵の進行から走行車両／防衛対象を守り抜く
3. 必要なStageだけ、電源switchを順番に起動する
4. 必要なStageだけ、台車／搬送objectを目的地まで移動・護衛する
5. bossを撃破する

- switch、台車、escortは脚本上必要なStageだけに使う。
- 新しい複雑なobjectiveを、変化を付ける目的だけで増やさない。
- player actionと台本の描写を一致させる。
- objectiveは一目で理解できる短い日本語で表示する。

### 6.1 制限時間

現行の150〜210秒級の長い防衛／escortは見直す。

- 時間防衛の標準は**90秒前後**。
- 原則範囲は**75〜120秒**。
- 150秒以上は原則使用しない。
- 180秒／210秒をそのまま踏襲しない。
- escortも無駄に長くせず、移動速度、距離、wave数をまとめて短縮する。
- boss戦は原則として不自然なhard time limitを置かない。
- countdownが必要なStageだけ、スマートフォン横画面を圧迫しない小さな表示を使う。

exact秒数、wave、spawnはSolがStage全体のテンポを見て調整してよい。

## 7. Boss balance

bossは現行より明確に強くする。

- 通常enemyの高HP版だけにしない。
- HP、damage、attack cadence、phase、add、target pressure、control resistance、telegraphを組み合わせる。
- 予兆は読み取れるが、無視して殴り続けるだけでは勝ちにくくする。
- 低cost unitの連打だけでmechanicを無視できないようにする。
- ただし過剰なdamage sponge、不可避即死、長時間拘束にはしない。
- TAKUYA-Ωは最終bossとして、既存TAKUYAより大幅に高い圧力を持つ。

Solは全編成証明を作らず、章bossとStage 30を中心に必要なspot checkだけ行う。

## 8. 育成

- campaignのplayer-facing最大Levelは30。
- 上限はNew Game 5、Stage 5後10、Stage 10後15、Stage 15後20、Stage 20後25、Stage 25後30。
- 内部Level 50基盤は他mode／将来用として保持する。
- stat growth、upgrade cost、catch-up discount、equipment contributionはSolがCAPS経済と合わせて決定する。
- deployment cost／cooldownを0または実質0へできないfloorを持たせる。
- permanent stun、無限heal、無限resource、cooldown bypass、同一receipt二重発火を防止する。

## 9. CAPS経済・配備登録

- CAPSは戦闘外の恒久通貨。
- unit配備登録、Level up、equipment、support解禁、走行車両HP強化に使う。
- battle中にCAPSを消費しない。
- story上は`合流`、system上は`戦闘配備登録が解禁`、CAPS操作は`配備登録`とする。
- ナオはStage 1後に解禁し、Stage 1初回報酬だけで登録可能にする。
- Stage 8開始までに7 primary roleへアクセス可能にする。
- ザキミヤはStage 12、TKYはStage 14、Mrs.チハはStage 17、宮本武蔵はStage 20の合流後に配備登録を解禁する。
- 現行16 playable unitはStage 20までに発見済みまたは配備登録可能にする。
- main storyにmandatory replay grindを要求しない。
- Stage 30前に全unit、全support、全Level、全equipment、走行車両強化を買い切れる供給過多にしない。

Solは巨大な三経済scenario報告を作らず、**標準進行の一本の計算表＋CAPS不足／過剰供給の境界確認**だけで調整してよい。

## 10. 走行車両HPと強化system

### 10.1 HPの統一

- 現行のStageごとに異なる`baseHp`を廃止する。
- campaign全Stageで、一つのcanonicalな走行車両最大HPを使用する。
- Stage固有の難易度はenemy、wave、boss、objectiveで作り、走行車両HPをStageごとに恣意的に上下させない。
- escort台車、civilian、電源設備等のmission object HPは走行車両HPと分離する。
- battle開始時の走行車両最大HPは、canonical base HP＋恒久強化分から一意に決定する。
- exact base HP、1回当たりの増加量、最大強化回数、CAPS cost curveはSolが全30 Stageと経済を見て確定する。
- 強化総量には明確な上限を設け、強化だけでboss mechanicsを無視できない範囲にする。

### 10.2 専用強化画面

走行車両HP強化は、既存画面へ小さなbuttonを詰め込まず、**独立した専用画面**として実装する。

導線：

- 拠点／管理画面の上部付近に、分かりやすい`走行車両を強化する`入口を置く。
- 入口を押すと走行車両強化画面へ遷移する。

専用画面：

- 中央に走行車両の全体graphicを大きく表示する。
- 車体を切らず、スマートフォン横画面でも全体像が読めること。
- 現在の強化Level、現在HP、強化後HP、必要CAPS、所持CAPSを簡潔に表示する。
- main actionは`HPを強化`。
- 最大到達時は`強化上限`を明示し、buttonを安全にdisabled化する。
- 戻る操作、focus、tap範囲、safe areaを既存UIと統一する。
- 844×390／844×340で車両が豆粒化せず、情報とbuttonが重ならないこと。

### 10.3 強化transaction・演出・SE

- CAPS残高、強化上限、pending saveを検証する。
- CAPS減算、HP upgrade、receipt、saveを一つのatomic transactionとして扱う。
- durable save成功後だけ、成功演出とSEを再生する。
- 二重tap、reload、multiple tabs、save retryで二重減算／二重強化しない。
- 成功時は短いHP上昇表示、車両graphicの控えめな反応、**チャリンチャリンと分かる金属的な強化SE**を入れる。
- 既存の購入／強化SEが適合するなら再利用し、不適合な場合だけ専用SEを追加する。
- CAPS不足、上限到達、save失敗では成功SEを鳴らさず、短いreject feedbackを返す。

## 11. 支援

正式player-facing支援は次の3種。

1. 回復支援
2. 爆薬ドラム缶
3. 火炎ドラム缶

- CAPSで一度だけ恒久解禁する。
- 出撃前に3種から1種を装備する。
- battle中はbattle-local resourceとcooldownで使用する。
- `pod`は通常loadoutから外す。
- 航空支援と一斉砲撃は走行車両固有abilityとして分離する。
- 解禁windowは回復Stage 2〜3、爆薬Stage 5〜7、火炎Stage 9〜11。exact StageはSolが他unlockとの重複を避けて決定する。

## 12. Boss・他mode

- Story撃破bossを、spoilerを出さずに図鑑／異常発生／Survivalへ接続する。
- 進行中runには途中追加せず、次回runからpoolへ反映する。
- TAKUYAとTAKUYA-Ωは別ID、別図鑑、別reward、別defeat countとする。
- exact mode、weight、repeat rewardはSolが決定する。

## 13. Save・旧player特典

- Version 1.0.0は新campaign generation／namespaceで開始する。
- 旧20 Stage進行を新30 Stageへ変換しない。
- 旧localStorage、IndexedDB、backup、manual export、last-known-goodを削除しない。
- 安全に分離できるsettingsだけ引き継いでよい。
- 旧playerだけに記念CAPSをpopup付きで一度付与する。
- exact額はSolが標準経済内で決める。序盤unit 1体または序盤support 1種を選べる程度を目安とする。
- reload、replica recovery、manual import、multiple tabsで二重受取できないreceiptを持つ。

## 14. Art・asset

- event主要人物は腰上portrait。
- battle participantはbattle atlas必須。
- RED PANTHER四兵種：survival knife melee、shield、SMG、commander。
- 変異ムガリアン社長：boss asset必須。
- TAKUYA-Ω：既存TAKUYAを踏襲し、現行比およそ2倍。橙色安全vest残骸、人工armor、背面投薬管を維持する。
- 走行車両強化画面は既存の全体graphicを優先して再利用し、品質不足の場合だけ追加authoring assetを作る。
- 既存assetを先に監査し、`NEW_REQUIRED`だけ生成する。
- セガワ写真はセガワ本人のprivate identity reference。原写真、metadata、撮影背景をpublic Git、Issue、PR、artifact、evidenceへ保存しない。

## 15. Solの自動調整権限

上記の製品判断を守る限り、Solは次を一件ずつProducerへ戻さず確定してよい。

- unit／enemy／boss stats
- deployment cost／cooldown
- 配備登録／Level up／support／走行車両強化cost
- exact unlock Stage
- Stage／star／replay CAPS
- enemy wave／spawn／AI
- mission duration／escort speed／switch timing
- boss phase／telegraph／resistance／reward
- 走行車両base HP、upgrade量、上限、cost curve
- other-mode unlock先／weight／repeat reward
- 旧player記念CAPS

自動調整はDesign／QA中の静的tuningであり、公開後runtimeのhidden DDAではない。

## 16. 必要最小限の検証

冗長な証拠作成は禁止する。必要なのは次だけ。

- 全30 Stageのobjective、時間、wave、boss、unlockがdata上接続されていること
- 8体目を拒否し、同一character複数召喚は許可されること
- CAPS、配備登録、Level up、support、走行車両強化の二重処理がないこと
- 走行車両HPが全Stageでcanonical値＋強化値から算出されること
- 章bossとStage 30のbalance spot check
- fresh campaignのStage 1〜30、ENDING、EPILOGUE通し確認を最終candidateで一度行うこと
- save、offline、PWA update、rollback、旧player特典の回帰
- 844×390、844×340、1280×720の主要導線確認
- missing asset、placeholder、speaker／portrait mismatch 0

**編成別clear matrix、全Stageの複数編成証明、不要な大量evidence、監査のためだけの新Issue／文書は作らない。**

## 17. Release gate

次が残る場合、`READY_FOR_RELEASE`、`APPROVE`、`完成`と報告しない。

- Stage 1〜30、ENDING、EPILOGUEの通し未確認
- 未配置object、missing asset、placeholder、未完成animation／VFX／audio
- 7体上限の迂回、同一character複数召喚の誤拒否
- 150秒以上の冗長な防衛／escortが理由なく残る
- 走行車両HPのStage別ばらつき、強化screen未接続、強化transaction不整合
- CAPS、reward、unlock、receiptの二重適用
- save、offline、PWA、rollbackの破壊
- smartphone横画面で切れ、重なり、豆粒化、操作不能
- High／Medium finding未解消
