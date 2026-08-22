# 西新世紀末物語 — プロジェクト状態

更新日：2026-08-22

## 1. 現在の正式公開

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：Version 0.9.9.5
- release／main基準SHA：`55d796cc577d1d9f903a4d2c6b4382196511db27`
- release tree：`0f8a5fb417ccca595d485d22c2c3cbe240b6ee28`
- annotated tag：`v0.9.9.5`

live `main`、PR HEAD、checksは作業開始時に再取得し、本文の固定値を永久に最新として扱わない。

## 2. 次の正式release target

- target：Version 1.0.0
- 対象：PROLOGUE、Stage 1〜30、ENDING、エンドロール、EPILOGUE
- 正史：v10 event script
- story baseline：Draft PR #169、head `435dc959d1972646f7e82b6c45d3f1c25d890252`
- design baseline：Draft PR #170、head `6acf87fd235fb55d3d5e3ec1f8687b57a06dc769`
- implementation candidate：Draft PR #171、branch `codex/v1.0.0-luna-implementation`
- LAST_AUDITED_HEAD：`d1aab90ccefa8ad6601821c8520741bde49cd087`、tree `00df3ea842578cddc846059dd2c12f9dca1936a2`。これはSOLが内容を監査した固定cursorであり、PRの可変なlive HEADではない。live HEADは毎回GitHub refから再取得する
- production implementation／runtime asset integration：Draft candidate上に実装済み。ただしPhase G未達のため`NOT_READY`
- current Design Lock：`V100-SOL-DL-001 r8`（Section 23がCI #910の独立した二つのQA-harness failure、remote promotion、Producer Directive `5377824157`のdynamic-quality gateを所有する。Sections 18-19のPhase G／release loopを維持。`PRODUCT_DESIGN_CHANGE: 0`）
- execution ledger：Issue #172。r8 Section 23 cursorを現在値として使用する。pre-r5 Issue本文と`V100-LOOP-LOCK-001` commentは暫定監査資料であり、並行Design Lockではない
- main merge／tag／Release／Pages公開：未実施

## 3. Version 1.0.0固定事項

- player-facing車両名：**装甲車両**。`走行車両`不採用、`CRAWLER`は内部互換のみ
- 主人公名：ニューゲーム後・PROLOGUE前に入力。fallback`指揮官`。全event、log、save、ENDING／EPILOGUEへ反映し後から変更可能
- 主人公：無言だが実操作で物語を動かす
- event phase：prologue／pre／post／first-clear-post／ending／epilogue。戦闘中の長いstory eventなし
- 初期unit：ハチ、パイセン、クマバーソン、ババヤガ
- primary role：frontline／heavy／skirmisher／marksman／suppression／support／engineer
- formation最大7、battle active合計7、同一character複数召喚可
- mission：拠点破壊、短い時間防衛、必要時だけswitch／台車、boss
- campaign Level cap：30
- support：回復支援、爆薬ドラム缶、火炎ドラム缶
- 装甲車両HP：canonical base＋恒久upgrade。専用強化screen、atomic transaction、強化SE
- RED PANTHER正式名はStage 27で初開示
- セガワ写真はセガワ専用private identity reference。原写真をpublic Git／artifactへ保存しない
- TAKUYA-Ωは既存TAKUYAの連続性を保つカオスな最終形態
- 旧campaign進行は移行しないが、旧save／backupは削除しない
- 複数編成clear matrix、大量evidence、監査専用Issueを作らない

exact stats、cost、reward、duration、wave、unlock、装甲車両upgrade curve、boss他mode配置、旧player記念CAPS額は、固定guardrail内でSolが自律確定する。

## 4. 実行体制

1. Producer／司令塔が正本と製品境界を固定
2. 元のSol threadが`SOL_DESIGN`
3. SolがDesign Lock、有限asset inventory、必要asset candidate、Luna Handoffを作成
4. Lunaが`LUNA_IMPLEMENTATION`としてproduction実装、asset統合、tests、browser QA、Draft PR
5. remote required CI／unfiltered Phase G 54/54＋validator完全green後、Lunaはexact HEAD/treeで`DYNAMIC_GAME_QUALITY_EVIDENCE_PACKET`を収集する。既存QA／developer controlは状態到達だけに使用し、difficulty／balance／reward／clearability／save integrityの証拠へ流用しない
6. dynamic packet完成後、Lunaは`PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`へ遷移し、packet参照とactual productionの12画面（TITLE、名前入力、作戦地図、通常Stage選択、Boss Stage選択、出撃編成、隊員、出撃装備、装甲車両強化、代表event、通常battle HUD、戦果）をProducer確認へ出す
7. Producer Visual Approval前はCompletion Packetを確定せず、`READY_FOR_SOL_FINAL_REVIEW`へ進まない
8. Producer Visual Approval後に承認HEAD/tree、12 evidence ID、dynamic packet IDをfreezeし、branch commitを作らずLuna Completion PacketをIssue／PR／immutable artifactで確定して元のSolへ返す。承認後のcommitはVisual Approvalとfreezeを無効化する
9. 元のSolが`SOL_FINAL_REVIEW`でactual runtime／dynamic evidenceをhuman-player視点で監査し、High／Medium 0なら`APPROVE`
10. `SOL FINAL REVIEW APPROVE`後も直ちに統合・公開せず、`PRODUCER_FINAL_ACCEPTANCE`へ進む
11. Producerの明示承認後だけPR #169 -> #170 -> #171をfresh checks／exact head／synthetic treeで順次統合し、#171 merge-result SHA/treeが承認treeと一致した場合だけtag、GitHub Release、official Pagesを実行する
12. published SHAを固定してpost-release QAを行い、その成功後に`PROJECT_STATE`更新と対象Issue／PR closeを行う

SolとLunaを同時並行に動かさない。

## 5. 現在のblocker

- PR #169、#170、#171はいずれもDraft／未merge。PR #171はVersion 1.0.0 implementation candidateだが、`NOT_READY`である。
- audited candidate HEAD `d1aab90ccefa8ad6601821c8520741bde49cd087`、tree `00df3ea842578cddc846059dd2c12f9dca1936a2`のCI #910／run `32539432537`はterminal failure。Lunaはretry／rerun／追加修正をせず、comment `5377146015`でSOLへ戻った。
- `.gitattributes` remediationはclosed。committed blobは1,340 bytes、no-BOM、LF 33、CR 0、self LF rule exactly once。PR Verify `96946366154`は六つのChromium capture軸を含めgreenであり、repository hygieneは再開しない。
- Phase G `96949389397`／artifact `9466905397`のStage 24 WebKit 736x414 failureは`QA_PREDICATE_OR_ORCHESTRATION / STALE_DOM_READY_VS_RUNTIME_AFFORDABILITY_ACTIONABILITY_RACE`。DOM ready表示と同一sampleのruntime command 27.8／cost 45が矛盾したままgeneric 30秒click waitへ入り、その後page crashとなった。production deployment／balance failureの証拠ではない。
- canonical WebKit `96954658044`／artifact `9467643324`の667x375 `stage3-boss` failureは`BROWSER_LIFECYCLE_OR_RESOURCE / CLEAN_UNEXPECTED_PAGE_CRASH_MISCLASSIFIED_BY_BOUNDED_HUD_RUNNER`。battle-ready後、clean diagnosticsのままunexpected page crashがlifecycle JSONLへ記録されたが、wrapped target-closeを既存classifierが認識しなかった。product message duration／presentation assertion failureの証拠ではない。
- 二件はpage crashという終端だけを共有し、原因ownerは独立する。Design Lock r8 Section 23がatomic DOM/runtime deployment eligibilityとattempt-local clean-crash classificationを別々のbounded correctionとして固定する。generic retry、blanket timeout extension、assertion弱体化、`app/**`／gameplay／balance／AI変更は禁止する。
- current candidateでlocal Stage 24 3/3、canonical Stage 3 3/3、correction-HEAD focused remote complete green、local full Phase G 54/54＋validator＋full regressions、unfiltered-workflow restoration、unfiltered remote complete green、dynamic evidence packet、Producer Visual Checkpointは未完了である。
- PR #169／#170の依存関係とPhase G blockerが残るため、Ready化、merge、tag、Release、正式Pages公開は不可。

## 6. Version 1.0.0 execution cursor — r8 Section 23

- `LAST_AUDITED_HEAD`: `d1aab90ccefa8ad6601821c8520741bde49cd087`
- `LAST_AUDITED_TREE`: `00df3ea842578cddc846059dd2c12f9dca1936a2`
- `FAILED_GATE`: run `32539432537`; Phase G `96949389397` Stage 24／WebKit 736x414; canonical WebKit `96954658044` 667x375／`stage3-boss`
- `LAST_GREEN_GATE`: PR Verify `96946366154`、Stage 3 audio 3/3、WebKit deployment 6/6、enemy-runtime 6/6、hosted evidence。candidate-specific controls only、final freeze reuse不可
- `REMEDIATION_CLASS`: `DUAL_QA_HARNESS / PHASE_G_ATOMIC_DEPLOYMENT_ELIGIBILITY + HUD_LIFECYCLE_CRASH_CLASSIFICATION / DESIGN_CHANGE_REQUIRED`
- `RESUME_FROM`: r8 two-owner harness correction -> focused local acceptance -> one correction push -> complete focused remote green -> local full Phase G 54/54 + validator + full regressions -> one unfiltered-workflow restoration push -> complete unfiltered remote green -> dynamic evidence packet + twelve-screen `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION`（Design Lock Section 23／Handoff Section 16のみ。root cause／scope／retry／promotion／製品判断権限なし）

LunaはSection 23のfirst correction commit／pushを一回だけ行う。focused remote complete greenの場合だけ同Sectionのlocal full gateと一回のunfiltered-workflow restorationへ進む。いずれかのfailure、unexpected skip、missing artifact、new cause、forbidden-file need、dynamic evidence欠落では追加修正／retry／rerunをせず、`STATUS: BLOCKED_RETURN_TO_SOL_R8`でSOLへ戻す。

PR本文や状態文書の`LAST_AUDITED_HEAD`は監査cursorであり、可変なlive HEADの代替ではない。作業開始・push前・gate判定前にGitHubのPR refを再取得する。

### Post-V1 governance normalization debt

`AGENTS.md`／`docs/CODEX_TWO_THREAD_WORKFLOW.md`のgeneric Completion Packet経路と、Version 1.0.0 Design Lock Section 19／23のProducer Visual Checkpoint／Final Acceptance経路には恒久文書上の差がある。現VersionではVersion固有のDesign Lock r8を優先し、active implementation branch上でgeneric governanceを改訂しない。V1 release後、別のgovernance normalization作業でgeneric文書をProducer checkpoint／final acceptance経路へ整合する。

## 7. Release gate

次が残る場合、完成／APPROVE／READY_FOR_RELEASEとしない。

- 名前入力からStage 1〜30、ENDING、エンドロール、EPILOGUEの通し未確認
- raw name token、unknown speaker、speaker／portrait mismatch
- 未配置object、missing asset、placeholder、未完成animation／VFX／audio
- 7体上限の迂回、同一character複数召喚の誤拒否
- 150秒以上の冗長な通常防衛／escort
- 装甲車両HPのStage別ばらつき、強化screen／transaction未接続
- CAPS、reward、unlock、event、receiptの二重適用
- save、offline、PWA update、rollbackの破壊
- 844×390、844×340、1280×720で切れ、重なり、豆粒化、操作不能
- `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`のactual production 12画面に対するProducer Visual Approval未取得
- exact HEAD/treeのdynamic game-quality packetとSOL human-player quality audit未完了
- High／Medium finding未解消
