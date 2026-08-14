# Solへ送る一括指示 — Version 1.0.0正式リリース設計

以下を、**セガワのフェイスモデル写真と同じメッセージで**最初のSol threadへ送る。

---

`/goal`

`ROLE_LOCK: SOL_DESIGN`

## MISSION

`SUSANO-OOO/Zombieee`のv10正史を基礎に、PROLOGUEからStage 30、ENDING、EPILOGUEまでをVersion **1.0.0**として完成させるためのDesign Lockを作成してください。

Producerが行う初回操作は、この指示文と添付写真を送ることだけです。技術調査で解ける事項や、事前承認済みguardrail内のbalance値を一件ずつ質問して停止しないでください。

## Phase 0 — repository正本の整合確認

最初にproduction codeへ触れず、Draft PR #169／branch `docs/story-v10-final-release-baseline`を確認してください。

- `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`
- `docs/story/v10/CODEX_SOL_DESIGN_MISSION.md`
- `docs/story/v10/README.md`
- `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`
- `docs/PROJECT_STATE.md`
- PR #169本文／checklist

上記をlive repositoryと照合し、旧記述、Naoki誤記、主人公名入力の否定、未確定扱い、Version 0.9.9.0の旧current-state等が残っていれば、最新Producer Decisionsへ整合させたdocs-only correctionとして同branchへ通常commit／pushしてください。mainへ直接pushしないでください。

Phase 0でproduction implementation、asset削除、save変更、merge、tag、Release、Pages公開を行わないでください。

## 添付写真のidentity

このメッセージに添付する人物写真は、**セガワ本人のフェイスモデル**です。

- ナオキではありません。
- セガワをナオキと同一視したり、別人物へ置換したりしないでください。
- セガワのevent portrait用identity referenceとして、顔立ち、年齢印象、髪、輪郭、recognizabilityを固定してください。
- セガワはevent portrait必須ですが、v10ではplayerが直接戦う相手ではないためbattle atlasは原則不要です。
- 原写真をpublic repository、runtime、Issue、PR、CI artifact、QA evidence、logへ保存・転記しないでください。
- metadata、撮影情報、不要な背景情報を保持しないでください。
- repositoryへ入れられるのは、承認済みの架空characterとして派生したSegawa authoring master／event portraitと、`Producer-provided private identity reference`という非機微なprovenance記録だけです。

## 最初に読む正本

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_SOL_ROLE.md`
4. live `docs/PROJECT_STATE.md`
5. `docs/story/v10/README.md`
6. `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`
7. `docs/story/v10/STORY_SCRIPT_V10.md`
8. `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`
9. `docs/ASSET_STORAGE_POLICY.md`
10. 現行code、tests、asset manifest、QA scripts、open Issue／PR、release workflow

台本本文は必ず次で復元・検証してください。

```bash
python docs/story/v10/reconstruct_story_v10.py /tmp/STORY_SCRIPT_V10.md
```

期待値：

```text
UTF-8 bytes: 138747
Lines: 2681
SHA-256: c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4
```

復元した全文をPROLOGUEからStage 30、ENDING、EPILOGUEまで読んでください。`STORY_IMPLEMENTATION_MAP.md`だけを読んで本文確認済みとしないでください。

## Producerが確定した製品判断

### Release／正規表記

- 正式releaseはVersion 1.0.0。
- player-facing車両名は`装甲車両`。内部互換IDは残してよいがUIへ露出させない。
- RED PANTHERの正式名はStage 27で初開示。以前は赤レンズ部隊／ガスマスク部隊等のgeneric表記。
- v10の主人公名入力を採用。skip時は`指揮官`、最大12 grapheme。

### 初期編成／戦場

- 初期unitはハチ、パイセン、クマバーソン、ババヤガの4体。
- formationは最大7枠、同じ固有unit cardの重複登録は禁止。
- 戦場のplayable active上限は7体。
- 同一named unitのactive instanceは最大1。撤退完了＋cooldown後に再配備可能。
- NPC、escort、装甲車両、support object、敵は7枠外。
- 独立target／HP／damageを持つplayer-controlled summonは7枠に含める。
- 8体目／同一unit二重配備はauthoritative stateで拒否。

### Role composition

一次roleは`frontline／heavy／skirmisher／marksman／suppression／support／engineer`。

- exact named unit必須は禁止。
- 通常Stageはsoft role check。
- chapter gate／bossでもclass名によるhard entry gateは原則作らない。強いcounterには最低2つの異なるrouteを用意する。
- tutorial以外の通常Stageは3種類以上、専門bossは2種類以上の明確に異なる合法編成でclear可能にする。
- briefingは正確な敵一覧でなく、脅威categoryと推奨role／counter tagを2〜4件表示。

### Difficulty

- 単一のhardcore-but-fair campaign。新difficulty selectorは追加しない。
- hidden DDA／player連動hidden scalingは禁止。
- retry無料、敗北でCAPS／unit／装備／story progressを失わない。
- 敗因と改善hintを表示。
- 1 starだけで次Stage解禁。2／3 starは任意mastery。
- additional starは味方objective integrity／救助／任意目標を基本とし、mission自体がtimedでない限りspeedだけを条件にしない。

### Level／economy

- campaignの表示最大levelは30。内部Level 50基盤は将来／他mode用に保持。
- capはNew Game 5、Stage 5後10、Stage 10後15、Stage 15後20、Stage 20後25、Stage 25後30。
- CAPSは戦闘外恒久通貨。battle中にCAPSを使わない。
- story上は`合流`、systemは`戦闘配備登録が解禁`、CAPS actionは`配備登録`。
- ナオはStage 1後に解禁し、Stage 1 first-clear収入だけで登録可能。
- suppressionはStage 4まで、engineer／controlはStage 6まで、追加heavy／breakerはStage 8までに選択肢を用意。
- Stage 8開始までに7 primary roleすべてへアクセス可能にする。
- ザキミヤはStage 12、TKYはStage 14、Mrs.チハはStage 17、宮本武蔵はStage 20の物語合流後に配備登録を解禁する。
- 現行16 playable unitはStage 20 clearまでに全て発見済みまたは配備登録可能にする。
- main storyにmandatory replay grindを要求しない。
- completionistがStage 30前に全要素を買い切る供給過多にしない。

### Support

player-facing支援は次の3種へ一本化：

1. 回復支援
2. 爆薬ドラム缶
3. 火炎ドラム缶

- CAPSで恒久解禁、battle中はbattle resource／cooldownを使用。
- 出撃前に3種から1種だけ装備する。
- `pod`は通常player loadoutから外す。
- 航空支援／一斉砲撃は装甲車両固有abilityとして分離。
- 解禁windowは回復Stage 2〜3、爆薬Stage 5〜7、火炎Stage 9〜11。exact Stageはunlock重複を避けて決める。

### Save／legacy reward

- 新campaign generation／namespaceでニューゲーム。
- 旧Stage進行は移行しないが、旧localStorage／IndexedDB／backup／manual exportを削除しない。
- 安全に分離できるsettingsだけ引継ぎ可。
- 旧player記念CAPSは一度だけ。額は序盤unit 1体または序盤support 1種を選べる程度で、campaign first-clear総収入の15%以下。
- reload、replica recovery、import、multiple tabsで二重受取不可。

### Art

- event主要人物は腰上portrait。
- battle participantはbattle atlas必須。
- RED PANTHER四兵種：survival knife melee、shield、SMG、commander。
- infected AIのskin差し替えで済ませず、人間敵の射線、距離維持、後退、cover、beacon、指揮を設計。
- 変異ムガリアン社長はboss asset必須。
- TAKUYA-Ωは既存TAKUYAを踏襲し現行比約2倍。橙色安全vest残骸、人工armor、背面投薬管を維持し、別giant boss IDとする。

## Solへ事前承認する自動調整範囲

上記guardrail内なら、次のexact値をProducerへ一件ずつ差し戻さず、自分でsimulation、test、runtime QAを反復してDesign Lockへ確定して構いません。

- unit／enemy／boss stats
- deployment cost／cooldown
- 配備登録costとexact unlock Stage
- Stage／star／replay CAPS
- level-up cost／growth curve／catch-up discount
- command／scrap／support gauge
- support effect／cost／cooldown／active limit
- enemy wave／spawn／AI tuning
- boss phase／telegraph／resistance／reward
- other-mode unlock先／weight／repeat reward
- 旧player記念CAPS exact額
- Stage別推奨role／counter tag

これはDesign／QA中のbalance最適化権限です。公開後runtimeでplayer別に隠れて難易度を変える権限ではありません。

## 必須simulation／acceptance

- minimal／standard／completionistの三経済simulation
- Stageごとのowned roster、median level、残CAPS
- counterが必要になる前のunlock／affordability証明
- 通常Stage3編成以上、専門boss2編成以上のclear matrix
- low-cost spam、permanent control、infinite heal、resource loop、duplicate receiptのnegative test
- recommended capでのStage時間／味方objective integrity／敗因
- 844×390、844×340、1280×720のruntime evidence
- fresh Stage 1〜30、ENDING、EPILOGUE通し
- save hydration／replica／import／offline／rollback／legacy reward
- asset decode、missing／placeholder 0、speaker／portrait mismatch 0

人間clear率の目標はStage 1〜2が75〜90%、通常Stage55〜75%、chapter boss35〜55%、Stage 30が25〜45%。これは実playtest目標であり、bot simulationだけで達成したと断定しないでください。

## Design Lock必須成果物

1. Design ID／revision、actual baseline HEAD／tree
2. current-state audit
3. 30 Stage implementation matrix
4. event／speaker／portrait matrix
5. stage background／object matrix
6. role／counter／formation matrix
7. unit unlock／配備登録calendar
8. support unlock calendar
9. canonical CAPS economy／level／battle balance table
10. 7-active／unique-unit contract
11. RED PANTHER human enemy contract
12. new boss contracts
13. boss cross-mode unlock matrix
14. save generation／legacy reward design
15. asset inventory／identity lock／generation prompt／storage／provenance
16. architecture／module ownership／data-state-event-asset contract
17. positive／negative／browser／PWA／save／performance／accessibility QA
18. integration branch／PR dependency graph
19. protected files／rollback／stop conditions
20. Luna Handoff

## Asset production authorization

Design Lock内のfinite inventory、identity lock、generation prompt、storage、provenance、acceptanceが揃った後、Solは`ASSET_PRODUCTION_CHECKPOINT: PRODUCER_AUTHORIZED`を明示し、追加のProducer確認を待たず同じgoal内で必要assetの候補生成、自己監査、authoring master選定まで進めて構いません。

- `NEW_REQUIRED`だけを依存順に生成する。
- 同一characterの無秩序なvariantを作らない。
- failed candidateをruntimeへ入れない。
- raw Segawa face photoをpublic Git／artifact／evidenceへ保存しない。
- production code／manifestへの統合はLuna Handoffへ渡す。

## 停止条件

次の場合だけ`PRODUCER_DECISION_REQUIRED`で停止してください。

- v10本文、人物弧、Stage因果、ENDING／EPILOGUEの変更が必要
- 添付セガワ写真または既存character identityの変更／置換が必要
- 新mode、新通貨、分岐、permadeath等、未承認のplayer-facing systemが必要
- 旧save／asset削除、不可逆migration、history rewriteが必要
- exact named unit必須、mandatory grind、hidden DDAなしでは成立しない
- asset license／commercial use／provenanceが不明
- 正本同士の矛盾が技術調査で一意に解けない

それ以外は自律解決してください。

## Phase完了時

Phase 0 docs correction後、そのfixed HEADをbaselineとしてDesignを続けてください。

この最初のmissionではproduction implementation、main merge、tag、Release、Pages公開を行いません。Design Lockをbranch／Issue／指定MDへ正本化し、`DESIGN_LOCKED`、balance evidence、asset production packet、Luna Handoffを返してください。
