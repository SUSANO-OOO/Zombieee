# Solへ送る一括指示 — Version 1.0.0正式リリース設計

以下を、**セガワのフェイスモデル写真と同じメッセージで**最初のSol threadへ送る。

---

`/goal`

`ROLE_LOCK: SOL_DESIGN`

## MISSION

`SUSANO-OOO/Zombieee`のv10正史を基礎に、PROLOGUEからStage 30、ENDING、EPILOGUEまでをVersion **1.0.0**として完成させるDesign Lockを作成してください。

Producerが行う初回操作は、この指示文と添付写真を送ることだけです。技術調査で解ける事項、事前承認済み範囲の数値調整、必要assetの整理を一件ずつ質問して停止しないでください。

## 1. 最初に確認する正本

Draft PR #169／branch `docs/story-v10-final-release-baseline`を取得し、次を読むこと。

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_SOL_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. `docs/story/v10/README.md`
6. `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`
7. `docs/story/v10/STORY_SCRIPT_V10.md`
8. `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`
9. `docs/ASSET_STORAGE_POLICY.md`
10. live code、tests、assets、save、PWA、open Issue／PR

台本本文は必ず次で復元する。

```bash
python docs/story/v10/reconstruct_story_v10.py /tmp/STORY_SCRIPT_V10.md
```

期待値：

```text
UTF-8 bytes: 138747
Lines: 2681
SHA-256: c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4
```

復元したPROLOGUE、Stage 1〜30、ENDING、EPILOGUE全文を読むこと。要約資料だけで本文確認を代替しないこと。

## 2. 添付写真

添付写真は**セガワ本人のprivate face identity reference**。

- ナオキではない。
- 別character、alias、IDを作らない。
- セガワ以外へ流用しない。
- セガワのevent portrait用identityを固定する。
- v10でplayer combatantではないためbattle atlasは原則不要。
- 原写真、metadata、撮影背景をrepository、runtime、Issue、PR、CI artifact、QA evidence、logへ保存しない。
- Git管理対象にできるのは承認済みderived fictional master／event portraitと、非機微なprovenance記録だけ。

## 3. 固定済み製品判断

### 3.1 Release・story

- 正式releaseはVersion 1.0.0。
- player-facing車両名は`走行車両`。
- RED PANTHER正式名はStage 27で初開示。
- v10の主人公名入力を採用。skip時は`指揮官`、最大12 grapheme。
- 台本の人物弧、Stage因果、ENDING、EPILOGUEを勝手に変更しない。

### 3.2 初期unit・召喚

- 初期unitはハチ、パイセン、クマバーソン、ババヤガ。
- formationは最大7枠。
- 戦場に同時存在できるplayable instanceは合計7体。
- **同一characterを複数回召喚してよい。複数体同時存在も許可する。**
- 8体目だけをauthoritative stateで拒否する。
- 走行車両、NPC、escort、mission object、support object、敵は7枠外。
- 独立HP／target／damageを持つplayer-controlled summonは7枠内。

同一character一体制限、unique active contract、同一unit二重配備拒否は導入しないこと。

### 3.3 Role composition

一次role：

`frontline／heavy／skirmisher／marksman／suppression／support／engineer`

- exact named unit必須は禁止。
- class不足で出撃をhard blockしない。
- Stage briefingは脅威categoryと推奨role／counter tagを簡潔に表示。
- hidden immunity、予告なし即死、永久stun、単一characterだけが解除できるgimmickは禁止。

**複数編成clear証明、通常Stage3編成／boss2編成のmatrix、編成別大量evidenceは作成しないこと。**

### 3.4 Stage mission

基本missionは現行基盤を使う次の範囲に限定する。

1. 敵拠点破壊
2. 一定時間、敵の進行から走行車両／防衛対象を守る
3. 必要なStageだけ電源switchを順次起動
4. 必要なStageだけ台車／搬送objectを移動・護衛
5. boss撃破

- 台本のト書きを理由に、新しい複雑なmission systemを増やさない。
- switch／台車は必要なStageだけ。
- player actionと台本描写を一致させる。
- 現行の150〜210秒級missionをそのまま流用しない。
- 時間防衛は90秒前後、原則75〜120秒。
- 150秒以上は原則禁止。
- escortも距離、速度、waveを調整して短くする。
- bossへ不自然なhard time limitを置かない。

### 3.5 Boss

- bossは現行より明確に強くする。
- HPだけでなくdamage、cadence、phase、add、target pressure、control resistance、telegraphを調整する。
- 低cost連打だけでmechanicを無視しにくくする。
- damage sponge、不可避即死、長時間拘束にはしない。
- TAKUYA-Ωは既存TAKUYAより大幅に高い圧力を持つfinal boss。

全Stageの編成証明は不要。章bossとStage 30を中心に必要なspot checkだけ行う。

### 3.6 Level・CAPS・unlock

- campaign表示最大Levelは30。
- capはNew Game 5、Stage 5後10、Stage 10後15、Stage 15後20、Stage 20後25、Stage 25後30。
- CAPSは戦闘外恒久通貨。
- story上は`合流`、system上は`戦闘配備登録が解禁`、CAPS操作は`配備登録`。
- ナオはStage 1後に解禁し、Stage 1初回報酬だけで登録可能。
- Stage 8開始までに7 primary roleへアクセス可能。
- ザキミヤStage 12、TKY Stage 14、Mrs.チハ Stage 17、宮本武蔵Stage 20の合流後に配備登録解禁。
- 現行16 playable unitはStage 20までに発見済みまたは配備登録可能。
- mandatory replay grindは禁止。

CAPS計算は巨大な三scenario報告にしない。標準進行の一本の計算表と、CAPS不足／過剰供給の境界確認だけでよい。

### 3.7 走行車両HP

- 現行のStage別`baseHp`ばらつきを廃止する。
- 全campaign Stageで一つのcanonical base HPを使う。
- battle開始時HPはcanonical base HP＋恒久upgrade分から算出する。
- Stage難度はenemy、wave、boss、objectiveで調整し、走行車両HPをStageごとに変えない。
- escort台車、civilian、電源等のHPは別contract。
- exact base HP、upgrade量、最大回数、CAPS curveはSolが全30 Stageと経済から決定する。

### 3.8 走行車両強化画面

独立screenを実装するDesignにする。

導線：

- 拠点／管理画面上部付近に`走行車両を強化する`入口。
- 押すと専用画面へ遷移。

画面：

- 中央に走行車両の全体graphicを大きく表示。
- 車体を切らない。
- 現在Level、現在HP、強化後HP、必要CAPS、所持CAPSを簡潔表示。
- main actionは`HPを強化`。
- 最大時は`強化上限`。
- 844×390／844×340で車両が豆粒化せず、buttonや数値が重ならない。
- 既存full vehicle graphicを優先再利用。品質不足の場合だけ新規asset。

transaction／feedback：

- CAPS減算、HP upgrade、receipt、saveをatomic処理。
- durable save成功後だけ成功演出とSE。
- 二重tap、reload、multiple tabs、save retryで二重減算／二重強化禁止。
- 成功時は短いHP上昇表示、車両graphicの控えめな反応、**チャリンチャリンと分かる金属的な強化SE**。
- 既存SEが合えば再利用し、合わなければ短い専用SEだけ追加。
- CAPS不足、上限、save失敗時は成功SEを鳴らさない。

### 3.9 Support

正式支援：

1. 回復支援
2. 爆薬ドラム缶
3. 火炎ドラム缶

- CAPSで恒久解禁。
- 出撃前に1種装備。
- battle中はbattle-local resource／cooldown。
- `pod`は通常loadoutから外す。
- 航空支援／一斉砲撃は走行車両固有abilityとして分離。
- 解禁windowは回復Stage 2〜3、爆薬Stage 5〜7、火炎Stage 9〜11。

### 3.10 Save・旧player

- 新campaign generation／namespaceでニューゲーム。
- 旧Stage進行は移行しない。
- 旧localStorage／IndexedDB／backup／manual export／last-known-goodを削除しない。
- 安全なsettingsだけ引継ぎ可。
- 旧player記念CAPSはpopup付きで一度だけ。
- reload、replica recovery、manual import、multiple tabsで二重受取不可。

### 3.11 Art

- event主要人物は腰上portrait。
- battle participantはbattle atlas必須。
- RED PANTHER四兵種：survival knife melee、shield、SMG、commander。
- 変異ムガリアン社長はboss asset必須。
- TAKUYA-Ωは既存TAKUYA踏襲、現行比約2倍、橙色安全vest残骸、人工armor、背面投薬管。
- existing assetを先に監査し、`NEW_REQUIRED`だけ生成する。

## 4. Solへ委任するexact調整

次はProducerへ一件ずつ戻さず、Design／QA中に自律確定してよい。

- unit／enemy／boss stats
- deployment cost／cooldown
- 配備登録／Level up／support／走行車両upgrade cost
- exact unlock Stage
- Stage／star／replay CAPS
- enemy wave／spawn／AI
- mission duration／escort speed／switch timing
- boss phase／telegraph／resistance／reward
- 走行車両base HP／upgrade量／最大回数／cost curve
- other-mode unlock先／weight／repeat reward
- 旧player記念CAPS

公開後runtimeでplayer別に隠れて難度を変えるDDAは禁止。

## 5. 必須成果物

1. actual baseline HEAD／tree
2. 30 Stage implementation table
3. 各Stageのmission type、duration、waves、boss、unlock
4. unit／Level／CAPS／support balance table
5. 7-active total cap contract。同一character複数召喚許可を明記
6. 走行車両canonical HP／upgrade／専用screen／transaction contract
7. RED PANTHER contract
8. 変異ムガリアン社長／TAKUYA-Ω contract
9. boss cross-mode mapping
10. save generation／legacy reward contract
11. finite asset inventory／identity lock／prompt／provenance
12. module ownership／PR dependency
13. 必要最小限のQAとLuna Handoff

## 6. 必要最小限の検証

- 30 Stageのdata接続
- 8体目reject、同一character複数召喚allow
- CAPS／unlock／upgrade／receiptの二重処理防止
- 走行車両HPが全Stageでcanonical＋upgradeから算出
- 章boss／Stage 30のspot check
- final candidateでfresh Stage 1〜30、ENDING、EPILOGUEを一度通す
- save、offline、PWA update、rollback、legacy reward
- 844×390、844×340、1280×720の主要導線
- missing asset／placeholder／speaker mismatch 0

次は作らないこと。

- 複数編成clear matrix
- 全Stageの複数編成証明
- 人間clear率の大規模計測
- 不要な大量evidence
- 監査だけのための新Issue／新文書

## 7. Asset production authorization

finite inventory、identity lock、prompt、storage、provenance、acceptanceが揃ったら、

`ASSET_PRODUCTION_CHECKPOINT: PRODUCER_AUTHORIZED`

を明示し、追加確認を待たず必要assetのcandidate生成、自己監査、authoring master選定まで進めてよい。

- `NEW_REQUIRED`だけを生成。
- failed candidateをruntimeへ入れない。
- raw Segawa photoをGit／artifact／evidenceへ保存しない。
- production code／manifestへの統合はLuna Handoffへ渡す。

## 8. 停止条件

次の場合だけ`PRODUCER_DECISION_REQUIRED`で停止する。

- v10本文、人物弧、Stage因果、ENDING／EPILOGUEの変更が必要
- セガワ写真または既存character identityの変更／置換が必要
- 新mode、新通貨、分岐、permadeath等、未承認systemが必要
- 旧save／asset削除、不可逆migration、history rewriteが必要
- asset license／commercial use／provenanceが不明
- 正本同士の矛盾が技術調査で一意に解けない

数値、duration、wave、cost、module分割、test方式は自律解決すること。

## 9. このmissionの禁止事項

- production implementation
- main直接push
- merge
- tag
- GitHub Release
- Pages公開
- 原写真保存
- 台本silent rewrite
- hidden runtime DDA
- 特定character必須Stage
- mandatory replay grind
- placeholder正式採用
- 冗長な検証資料の量産

完了時は`DESIGN_LOCKED`、Design ID、fixed HEAD／tree、確定表、asset結果、残存risk、Luna Handoffを返すこと。
