# 西新世紀末物語 — プロジェクト状態

更新日：2026-08-24

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
- implementation candidate：Draft PR #171、historical branch name `codex/v1.0.0-luna-implementation`（branch名はcurrent ownerを決めない）
- LAST_AUDITED_HEAD：`4191afe2fe84283125c0e9ec817185c94685630c`、tree `cb808fff195d58fd96718cb8381f7f9091e9f313`。これはr20設計が監査した固定cursorであり、PRの可変なlive HEADではない。live HEADは毎回GitHub refから再取得する
- production implementation／runtime asset integration：Draft candidate上に実装済み。ただしPhase G未達のため`NOT_READY`
- current Design Lock：`V100-SOL-DL-001 r22` Sections 28-38。r12-r21のQA／evidence／byte契約を維持し、passing r21 Mayo controlで検出したaccepted checkpoint receiptのsummary永続化不足を閉じる。SOL単独ownerのsingle-checkpoint ship loopは不変。`PRODUCT_DESIGN_CHANGE: 0`
- execution ledger：Issue #172。Producer Master `5386346594`、`/goal` lock `5386372849`、Loop Audits `5386391321`／`5386349725`、role/counter `5386314197`を使用し、`5386320133`はinitial SOL cursorとして保持する。current role/cursorはIssue #172の最新explicit loop-ledger entryから読む。旧Luna/push/Visual/Final Acceptance cursorは履歴でありcurrent authorityではない
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

## 4. 実行体制 — V1 SOL single-owner override

Producerが明示的に旧分業へ戻すまで、SOLがVersion 1.0.0をend-to-endで所有する。旧`NEXT_OWNER: LUNA_IMPLEMENTATION`とbranch名は履歴であり実行指示ではない。

`SOL_DESIGN -> SOL_REMEDIATION -> machine gates -> browser/runtime verification -> human-player quality audit -> exact HEAD/tree freeze -> SOL_FINAL_REVIEW (read-only/adversarial) -> FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT`。

- finding／required failure／Producer rejectは同一`/goal`の`SOL_DESIGN`へ戻す。new candidateは影響evidenceを無効化し、再validationとfixed-HEAD reviewを行う
- Producerへ通常停止するのは最後のcheckpoint一度だけ。12画面はfinal packageへ統合し、旧Producer Visual Approvalと旧Producer Final Acceptanceの二段停止は使わない
- Producer承認後だけPR #169 -> #170 -> #171をlive ref／checks／mergeability／synthetic treeで順次統合する。verified #171 merge-result SHA/treeをrelease基準とし、approved candidate treeとの一致を必須とする
- その後だけannotated `v1.0.0`、GitHub Release、official Pages request、published-SHA public/PWA QA、recovery、Project State／Issue closureへ進む
- public environment green前に`/goal COMPLETE`、Issue close、release完了報告を行わない

## 5. 現在のblocker

- PR #169、#170、#171はいずれもDraft／未merge。PR #171はVersion 1.0.0 implementation candidateだが、`NOT_READY`である。
- current exact candidateはHEAD `4191afe2fe84283125c0e9ec817185c94685630c`／tree `cb808fff195d58fd96718cb8381f7f9091e9f313`。r19 local gateはgreenだったが、automatic focused run `32673445643`（#922、attempt 1）はterminal failure。retry／rerunなし。PR Verify `97277691325`はChromium deployment六viewport中五つで55-asset terminal errorをready待ちtimeoutとして終了し、Phase Gはdependency-skipped。WebKit deploymentは667x375／736x414／844x340／932x430でclean page crash、844x390／1280x720で全八unit pass。
- r20 classification：`QA_HARNESS_DEPLOYMENT_LIFECYCLE_OVERLOAD / EXHAUSTIVE_55_ASSET_GATE + FULL_SNAPSHOT_CHECKPOINT_POLLING + COMPOSITOR_SCREENSHOT / CLEAN_PAGE_CRASH / DESIGN_CHANGE_REQUIRED`。remediation：`FINITE_DEPLOYMENT_EVIDENCE_LIFECYCLE / REQUIRED_ASSET_PLAN + LEAN_HOST_TURN_CHECKPOINTS + FROZEN_PRODUCTION_CANVAS_PNG / DESIGN_CHANGE_REQUIRED`。native browser mechanismは推測せず、製品asset欠落・viewport・unit・pixel defectとも分類しない。
- r20 exact seven-path packetは、既存localhost-only finite asset switch、per-unit strict decode、terminal compact readiness、read-only lean deployment snapshot、Node-host 100 ms checkpoint freeze、checkpointごとのone full RGBA audit、production canvas direct PNGを一体で実装する。timeout／viewport／六checkpoint／pixel threshold／eight units／fatal-zero／one-attempt policyは変更しない。Phase G、workflow、bounded runner、CI BOM、public/package bytesは保持する。
- r20 final source/static/lint/build/diff/byteはgreen。exact r20 bytesのfresh Phase GはStage 6 3/3、Stage 24 3/3、ordered Stage 6 -> Stage 24 -> Stage 25 3/3で、mapping／14 resolved checkpoints／causal 4/4／single-producer-cache／fatal zeroを満たした。続くfirst-attempt Chromium six-viewport deploymentは5/6 case green、844x390だけMayo-chan `first-visible`で停止したため、WebKit full deployment／commit／pushは未実行。retry／rerunなし。
- 844x390では先行五unitが六checkpointを完了し、Mayo-chanも`fully-inside` direct canvas PNGまで成功。failure PNGは既にramp外で通常battle中のMayo-chanを示し、asset／strict decode／canvas／lifecycle／console/page/request/HTTPはclean。独立250 ms lean traceは1,052 msでprogress `0.117268`／`gateEntering: true`／`combatReady: false`を記録し、その後`0.3811`、`0.6450`、`0.9088`、`1`へ進んだ。自然なfirst-visible区間は存在し、host checkpoint flowだけがmonotonic overshoot前にlatch／acceptできなかった。100 ms samplerが当該区間を読んだかは推測しない。
- r21 classification：`QA_HARNESS_CHECKPOINT_FREEZE_OWNERSHIP_GAP / HOST_POLL_POST_CANDIDATE_FREEZE_DID_NOT_LATCH_EXISTING_NATURAL_SEMANTIC_INTERVAL / MONOTONIC_OVERSHOOT / DESIGN_CHANGE_REQUIRED`。remediation：`RUNTIME_SEMANTIC_CHECKPOINT_LATCH / LOCALHOST_ONLY_ARM + SAME_SIMULATION_TICK_PAUSE_RECEIPT + HOST_READBACK_ONE_AUDIT / DESIGN_CHANGE_REQUIRED`。自然移動後の既存semantic checkpointと`CRAWLER_DEPLOYMENT_CHECKPOINTS`の既存minimum（`first-visible`は`0.08`）を満たす同じsimulation tickでQA-only pause receiptへlatchし、hostはexact receipt後に一回だけfull auditする。caller threshold、位置／speed／progress／dt／threshold／timeout／retry／gameplay変更は禁止。
- r21 final source/staticはgreenで、新しいChromium 844x390 Mayo-only processはfirst attemptで六checkpoint／六direct PNG／一contact sheet／finite 30/30／fatal zeroを達成し、`first-visible`はprogress `0.08795115181416581`で合格した。ただしpost-gate execution auditで、hostがexact stable receiptを検証して返しているのにcheckpoint result serializerがreceiptを省略し、summary consumerから五つのsame-tick receiptを独立確認できないことを検出。r21 runはcontrol専用でfinal evidenceへ流用しない。
- r22 classification：`QA_EVIDENCE_PERSISTENCE_GAP / VERIFIED_RUNTIME_CHECKPOINT_RECEIPT_OMITTED_FROM_SUMMARY / DESIGN_CHANGE_REQUIRED`。remediation：`CHECKPOINT_RECEIPT_SERIALIZATION / EXACT_ACCEPTED_RECEIPT + STATIC_AND_RUNTIME_SUMMARY_ASSERTION / DESIGN_CHANGE_REQUIRED`。r21 app latch bytesを保持し、runner/testだけで`fully-inside` null＋後続五checkpointのbounded exact receiptをsummaryへ固定する。
- r17-r19 history：r17 ten-path draftはcommitせず保持中。three-script syntax、checkpoint／deployment／runtime source-behavior、seven-file load 7/7はgreenだが、exact focused source commandは59/60で停止した。唯一のfailureは`tests/ci-contract.test.mjs`がdeployment bounded runnerへ旧`attempt <= 2`／`isRetryableTargetClosedLog`を要求したこと。r17でlockedしたone-attempt/no-retry policyと矛盾する既存source ownerをtopologyへ含めなかったSOL設計自己不整合であり、browser／lint／build／commit／pushは未実行。
- r18 classification：`SOL_OWNED_SOURCE_CONTRACT_TOPOLOGY_OMISSION / NO_RETRY_DEPLOYMENT_POLICY_CONFLICT_WITH_EXISTING_CI_SOURCE_ASSERTION / DESIGN_CHANGE_REQUIRED`。remediation：`CI_CONTRACT_NO_RETRY_ALIGNMENT / EXACT_SINGLE_ATTEMPT_POSITIVE_NEGATIVE_ASSERTIONS / DESIGN_CHANGE_REQUIRED`。既存ten-path draftをbyte-preserveし、`tests/ci-contract.test.mjs`のdeployment assertion regionだけを追加修正する。material candidateはexact eleven paths／iteration 5のまま。
- r19 classification：`SOL_OWNED_BYTE_CONTRACT_MISDECLARATION / PREEXISTING_CI_CONTRACT_UTF8_BOM_DECLARED_NO_BOM / DESIGN_CHANGE_REQUIRED`。remediation：`SOURCE_BYTE_CONTRACT_CORRECTION / PRESERVE_EXISTING_UTF8_BOM_AND_LF_WITH_ZERO_SEMANTIC_CHANGE / DESIGN_CHANGE_REQUIRED`。r18 correction後はtargeted 1/1、load 7/7、focused 60/60、checkpoint 12/12、Design Lock 19/19、three-script syntaxがgreen。pre-lint byte auditでbase／worktree双方の`tests/ci-contract.test.mjs`が既存UTF-8 BOM＋LF-onlyと実証され、r18 no-BOM記述だけが誤りと確定した。eleven-path draftとCI assertion semantic diffを保持し、BOM除去／repository normalization／product変更を行わない。
- current required runはr16 iteration-4 candidate HEAD `d11464927efd1d21e573d969a767057bdd5c8b04`／tree `2ce952c6fe70c347e866e7201824ac623bbbe993`のautomatic focused run `32667714653`（#921、attempt 1）。PR Verify、六enemy-runtime shard、Hosted Runner、三Stage 3 route、deployment 1280x720／667x375／844x390／844x340／932x430はgreenだが、required Phase G job `97266100902`とdeployment 736x414 job `97267069513`がredでありrun全体はfailure。retry／rerun／timeout変更は行っていない。
- Phase G artifact `9500819430`／ZIP SHA-256 `797a635d4705a88fe4f3e9f135c4572f5f89faa3fa2e707d34fd4c1031ff99c5`はStage 6 WebKit 667x375でlean schema、1,406 bytes／1 ms、forbidden 0、二つのtrusted product pointerとproduction acceptanceを証明した後、elapsed 52,248 msにclean page crash、後刻`page.waitForFunction: Target crashed`。console／page／request／HTTPは0、failureState null。40 ms observerとrAF/default-pollingを含む多数consumerが同じlean bridgeを重複readしている。
- deployment artifact `9500961088`／ZIP SHA-256 `2b0f8158f4ac32181f537607a30f99dfb913dc722381e811a8f332d52b30ba57`は736x414でranger／scout／brawlerが全checkpoint pass後、Crazy Kingが33,219 msでclean crashし、既存automatic retryも28,681 msでclean crash。667x375 artifact `9500913162`／ZIP SHA-256 `53d7a462af9889fd8863a4f268eb5af61d52da48b628f6085deaebb89c98d00e`では同じexact candidateの全八unitがpassした。traceの250 ms full canvas auditとfirst-frame rAF毎のfull auditは六つのfrozen acceptance checkpoint auditに対し重複している。
- r17 classification：`QA_HARNESS_OBSERVATION_REENTRANCY / VALID_LEAN_PROFILE + RAF_RATE_DUPLICATE_SNAPSHOT + NONCHECKPOINT_PIXEL_AUDIT / DESIGN_CHANGE_REQUIRED`。remediation：`WEBKIT_QA_SINGLE_PRODUCER_OBSERVABILITY / 40MS_OBSERVER_CACHE_CONSUMERS + CHECKPOINT_ONLY_PIXEL_AUDIT + HOST_TURN_FIRST_FRAME_FREEZE + NO_RETRY / DESIGN_CHANGE_REQUIRED`。native WebKit termination mechanismは推測しない。`app/**`／product／gameplay／balance／AI／timing／viewport／timeout／causal／pixel acceptanceは変更しない。
- 以下のr15／r16項目はcurrent failureの来歴として保持するが、r17 cursorを上書きしない。
- r15 material candidateは未commit／未push。current exact seven-path draftでfresh Stage 6 3/3、Stage 24 3/3、ordered Stage 6 -> Stage 24 -> Stage 25 3/3は成立したが、その後のmandatory five-file focused source acceptanceが53/54で停止した。`app/AshfallGame.tsx`はUTF-8 no-BOM／CRLF-onlyでlean methodが一件存在しruntimeでも使用済みだが、LF-onlyの`tests/v100-phase-g-checkpoint.test.mjs` extractorがmethod boundaryをliteral LFだけで照合し、`missing localhost-only Phase G combat snapshot method`となった。retry／rerun／即時修正／commit／remote runは行っていない。
- r16 classification：`SOL_OWNED_SOURCE_CONTRACT_EOL_MISMATCH / LF_ONLY_REGEX_AGAINST_CRLF_APP_SOURCE / DESIGN_CHANGE_REQUIRED`。remediationは`SOURCE_TEST_EOL_PORTABILITY / CRLF_OR_LF_METHOD_BOUNDARY_WITHOUT_SOURCE_NORMALIZATION / DESIGN_CHANGE_REQUIRED`。r15 app／runner draft bytesを保持し、checkpoint extractorの二つのnewline boundaryだけをexact `\r?\n`へ変更する。意味assertion、test数、product、runtime、acceptanceは変更しない。
- current required failureはr14 iteration-3 candidate HEAD `7793433921f82c483a5b2f4a3887e56f6182c3f0`／tree `9a2ce2ca3028337a83667adf164c870e9ab157f6`のautomatic run `32661183323`、required Phase G job `97250055296`、artifact `9499106555`。`remote-trio-1` ordered position 1のStage 6 WebKit 667x375はproduction screenshotまで通過し、ordered position 2の`stage24-panther-commander`／actual `stage-mugarian-tech-tower`／WebKit 736x414でclean `page-crash`が120,711 msに発生した。Stage 25とsequences 2/3は未実行。
- Stage 24はmedic／scout／ranger／brawler／babayaga／kumaversonの六つのreal pointerをtrusted receipt＋production acceptanceで受理し、RED PANTHER commanderのmount／attack historyも成立済みだった。fatal console/page/request/HTTPは0、failureStateはnull。remote last accepted stateはwall 84,995 ms／battle 70.233 s、local same-tree三runは約89.1 s wall／約80.9 s battleでcausal 4/4、screenshot、unresolved 0まで完了した。
- historical remote run `32570366466`／job `97026632697`／artifact `9475382616`もunchanged product app treeでStage 6通過後のStage 24をclean page crashで停止しており、今回とwall位置は異なる。固定60/120秒product deadlineは成立しないが、long-lived Stage 24とremote WebKitでobservability workloadが再発ownerになっている。
- r15 classification：`QA_HARNESS_OBSERVABILITY_RESOURCE_PRESSURE / 40MS_FULL_BATTLE_QA_DEEP_SNAPSHOT + LONG_LIVED_STAGE24_WEBKIT_RENDERER_CRASH / DESIGN_CHANGE_REQUIRED`。remediationは`PHASE_G_LEAN_COMBAT_OBSERVABILITY / LOCALHOST_ONLY_BOUNDED_SNAPSHOT_SCHEMA + NO_FULL_SNAPSHOT_FALLBACK + PROFILED_LONG_ROUTE_ACCEPTANCE / DESIGN_CHANGE_REQUIRED`。
- source上、Phase G observerは40 msごとにfull localhost `getSnapshot()`を呼び、campaign/save/survival/equipment/geometryと各fighter最大128件のrender-audit historyをdeep-copyする。他のPhase G pollも同じfull snapshotを並行取得する。これはPages player-facing pathには存在しないlocalhost QA負荷である。r15は既存QA bridge内へread-only bounded `getPhaseGCombatSnapshot`を追加し、runner全battle readをno-fallbackでそこへ固定する。同じ長いStage 24 route／40 ms cadence／real deployment／causal acceptanceは維持し、early stop、browser reset、timeout、retry、product/gameplay変更を行わない。
- r15 material topologyは`app/AshfallGame.tsx`、Phase G runner/test、Design Lock test、Design Lock、Handoff、Project Stateのexact seven paths。app変更は既存localhost-only QA bridge block内のlean read methodだけであり、full `getSnapshot`とproduction public-host pathは不変。
- 以下のr14 Stage 6 failureはcurrent cursorではなく直前のrequired history。current runではStage 6が通過したため同gate counterは増えないが、focused全体green前のresetは禁止されている。
- current required failureはr13 atomic candidate HEAD `ab91621561926bbd4af90bb0d1ca8551699797d7`／tree `dc8dcc085bcc4e21429201d64e36e4290a14d027`のautomatic run `32656697160`、required Phase G job `97238965438`、artifact `9497903328`。`remote-trio-1` ordered position 1、variant `stage06-spitter-seal`、actual stage ID `stage-nishijin-station-tunnel-seal`、WebKit 667x375で、最初のrAF-only diagnostic sampleが1,041 msでtimeoutし、DOM sample／pointer／receipt／production acceptance前に停止した。Stage 24/25とsequences 2/3は未実行。
- artifactはexact candidate node `deployment-card-2`／kind `ranger`／slot `1`、correct route/stage/mount/formation、seven cards、energy 70、pointer count 0、fatal console/page/request/HTTP 0を保持する。初期eligibilityとrail centeringは完了したが、post-center DOM rect／hit owner／viewport／rail sampleはrAF待ちより後にあったため取得されなかった。product DOM、deployment handler、gameplay、balance、AI failureは確定しない。
- r14 classification：`QA_HARNESS_RENDER_OPPORTUNITY_COUPLING / RAF_ONLY_PRE-DOM_SAMPLE_TIMEOUT + UNCANCELLED_EVALUATE + PREFLIGHT_EVIDENCE_LOSS / DESIGN_CHANGE_REQUIRED`。remediationは`PHASE_G_SCHEDULER_INDEPENDENT_ACTIONABILITY / HOST_TURN_SEPARATED_SYNC_SNAPSHOTS + NONBLOCKING_RAF_TELEMETRY + PREINPUT_CANCELLATION_AND_EVIDENCE / DESIGN_CHANGE_REQUIRED`。
- r14 correctionはawaited rAFをdeployment DOM diagnosticsの前提から外す。host-owned 40 ms turnで分離したsynchronous snapshot二件にexact identity／eligibility／hit owner／stable rect/railとpage wall/performance advanceを要求し、rAFはnon-blocking telemetryのみとする。pre-input timeoutはcurrent capture page/contextをclose/awaitし、pending settlementと全preflight/cancellation evidenceを保持してpointer-zero attemptを一件recordする。timeout増加、retry、second pointer、acceptance弱体化、product/gameplay変更は禁止。
- r13 historical failureはlocal ordered sequence `r12-trio-fresh-2-d5986723-b`のStage 25 target-ownership gap。classificationは`QA_HARNESS_TARGET_OWNERSHIP_HISTORY / LIVE_ONLY_CONTACT_CHECKPOINT + ATTACK_HISTORY_WITHOUT_SIDE_KIND_TARGET_ATTRIBUTION / DESIGN_CHANGE_REQUIRED`、remediationは`PHASE_G_PROOF_ACTOR_TARGET_OWNERSHIP / MONOTONIC_SAME_FRAME_SOURCE_TARGET_IDENTITY + NO_GENERIC_SUBSTITUTION / DESIGN_CHANGE_REQUIRED`。r13 candidateではStage 25 fresh 3/3とordered trio fresh 3/3が成立し、bounded `targetOwnershipHistory`／no-substitution contractを実装済み。これはr14で維持するが、required remote Stage 6 redの代用にはならない。
- r12 required remote history：base HEAD `0495e95e3bc59fcf546ffa02ee83704a1f63e366`／tree `30071d5a9f4fd92e93f54ddea2e9713382247f74`、run `32636742294`、Phase G job `97189630445`、Stage 6 WebKit 667x375、artifact `9492754238`、PR Verify `97187545551` green。現在は同じrequired Stage 6 gateの二回目failureであり、immediate symptomが異なっても`SAME_GATE_REPEAT_COUNT: 2`として六subsystem auditを完了した。
- r12 historical classification：`QA_HARNESS_ACTIONABILITY_GATE_POLICY_FAILURE / PRE_POINTER_LOCATOR_STABILITY_TIMEOUT + FAILURE_CURSOR_FINALIZATION_LOSS / DESIGN_CHANGE_REQUIRED`。remediation classは`PHASE_G_REAL_POINTER_ACTIONABILITY / EXPLICIT_HIT_TEST + STABLE_RECT + ONE_INPUT + TRUE_FAILURE_CURSOR / DESIGN_CHANGE_REQUIRED`。Section 28のcontractはr13でも維持する。
- 以下のr8-r11項目は監査履歴でありcurrent cursorではない。
- r10 same-worktree bootstrap/preflight、focused source 43/43、lint、build、base-range／six-path auditはgreen。Stage 24 WebKit run 1はPASS、run 2は35 samples中`source=false`のみでFAILし、run 3／canonical Stage 3／correction commit・push／remote CIは未実行のままLunaが`BLOCKED_RETURN_TO_SOL_R10_RUNTIME`で停止した。
- raw run 2はRED PANTHER commander attack state／専用SE、impact receipt、damage/reaction、Futago ability、active battleを保持し、console/page/request/HTTP failure 0、cleanup前lifecycle loss 0。run 1だけ`13->25` edgeがfinal proof windowへ再出現した。production combat／VFX／audio defectではない。
- r11 classificationは`QA_HARNESS_CAUSAL_HISTORY / MONOTONIC_SOURCE_TARGET_EDGE_CLOBBER + FINAL_WINDOW_PHASE_COUPLING / DESIGN_CHANGE_REQUIRED`、causal `REMEDIATION_CLASS`は`PHASE_G_CAUSAL_HISTORY / MONOTONIC_SOURCE_EDGE + NON_DESTRUCTIVE_FINAL_MERGE / DESIGN_CHANGE_REQUIRED`。`startCombatRuntimeObserver`の履歴を`waitForCombatActivity`が瞬間arrayで置換し、observer停止後の`collectCombatCausalProof`を偶発的なfinal-window edgeへ依存させる。Section 26／Handoff 19はpage-lifetime edge attribution、non-destructive merge、negative no-substitution、same-worktree resume preflightを一つのcoherent contractとして固定する。
- r9 packet HEAD `3a40b95eafe8df17b9de907b6644e66912e1e218`、tree `486b9cf0cc92152372ff6414b61e2df440e8087a`でLunaはsix-path r8/r9 draftを保持／再構築したが、isolated worktreeに`sharp`と`playwright`がなく、focused commandは26 total／20 pass／6 failでsource assertionへ到達しなかった。dependency repair、retry／rerun、lint/build、WebKit、commit/push、remote correction CIはなく、`BLOCKED_RETURN_TO_SOL_R9`で停止した。
- r10 bootstrap returnのclassificationは`EXECUTION_ENVIRONMENT_PRECONDITION / ISOLATED_WORKTREE_DEPENDENCIES_ABSENT + HANDOFF_BOOTSTRAP_OMISSION / DESIGN_CHANGE_REQUIRED`、`REMEDIATION_CLASS`は`LOCAL_ACCEPTANCE_BOOTSTRAP / LOCKFILE_INSTALL + WORKTREE_LOCAL_BROWSERS + DRAFT_BYTE_PRESERVATION / DESIGN_CHANGE_REQUIRED`。source/product/gameplay failureではない。Design Lock r10 Section 25／Handoff 18は、same stopped worktreeのsix-path draftを再作成せず、lockfile固定`npm ci`、worktree-local Chromium/WebKit、package/draft hash preservation、native/browser/four-file load preflight、43/43、失敗phase別returnを一つのcontractとして所有する。
- Solはfresh isolated Windows worktree／`node_modules`なしから同contractを実証した。512 packages、Playwright 1.56.1、sharp 0.35.3、local Chromium build 1194／WebKit build 2215、両browser launch、four-file load、focused 43/43がgreenで、package／lock／six draft hashはbootstrap前後不変だった。これはsetup/source controlでありLuna correction、Phase G、remote、final evidenceには流用しない。
- r8 Sol packet HEAD `c6d3a2e8a925ca294fad82b47954d79b02a127bc`、tree `a4568cc2dbac3c6352de17170f92150865329ea2`でLunaはcorrection commit／push前のfocused source commandを実行し、43 total／41 pass／2 failで停止した。追加fix、retry／rerun、commit／push、remote correction CIはなく、Issue route `5379131527`どおり`BLOCKED_RETURN_TO_SOL_R8`でSOLへ戻った。
- `tests/ci-contract.test.mjs` failureは`DESIGN_CONTRACT_DEFECT / STALE_HUD_GENERIC_RETRY_ASSERTION + FIRST_COMMIT_ALLOWLIST_OMISSION / DESIGN_CHANGE_REQUIRED`。r8必須のattempt-local classifier behavioral testsは全件passしたが、pre-r8 CI source assertionがHUD runnerへgeneric `isRetryableTargetClosedLog`を要求し、Section 23は修正必須の同testをfirst-commit allowlistから漏らしていた。product／HUD implementation failureではない。
- `tests/v100-phase-g-checkpoint.test.mjs` failureは`QA_PROBE_SERIALIZATION / REJECTED_CANDIDATE_REASON_OMITTED / IMPLEMENTATION_MISMATCH_WITH_LOCKED_EVIDENCE`。cost 45／energy 27.8のrangerは正しく`candidates: []`へ拒否されたが、probeの`sample`がeligible-only listから生成され、rejected cardの`insufficient-energy`理由だけを落とした。production selection／deployment／balance failureではない。
- Design Lock r9 Section 24はfirst correction allowlistへ`tests/ci-contract.test.mjs`を追加し、HUD blockだけをexact classifier contractへ更新する。またPhase G probeはeligible-only `candidates`を維持しつつ全sample cardとrejection reasonをserializeする。r8 runtime behavior、timeout／retry／acceptance、Producer dynamic-quality directiveは変更しない。
- audited candidate HEAD `d1aab90ccefa8ad6601821c8520741bde49cd087`、tree `00df3ea842578cddc846059dd2c12f9dca1936a2`のCI #910／run `32539432537`はterminal failure。Lunaはretry／rerun／追加修正をせず、comment `5377146015`でSOLへ戻った。
- `.gitattributes` remediationはclosed。committed blobは1,340 bytes、no-BOM、LF 33、CR 0、self LF rule exactly once。PR Verify `96946366154`は六つのChromium capture軸を含めgreenであり、repository hygieneは再開しない。
- Phase G `96949389397`／artifact `9466905397`のStage 24 WebKit 736x414 failureは`QA_PREDICATE_OR_ORCHESTRATION / STALE_DOM_READY_VS_RUNTIME_AFFORDABILITY_ACTIONABILITY_RACE`。DOM ready表示と同一sampleのruntime command 27.8／cost 45が矛盾したままgeneric 30秒click waitへ入り、その後page crashとなった。production deployment／balance failureの証拠ではない。
- canonical WebKit `96954658044`／artifact `9467643324`の667x375 `stage3-boss` failureは`BROWSER_LIFECYCLE_OR_RESOURCE / CLEAN_UNEXPECTED_PAGE_CRASH_MISCLASSIFIED_BY_BOUNDED_HUD_RUNNER`。battle-ready後、clean diagnosticsのままunexpected page crashがlifecycle JSONLへ記録されたが、wrapped target-closeを既存classifierが認識しなかった。product message duration／presentation assertion failureの証拠ではない。
- CI #910の二件はpage crashという終端だけを共有し、原因ownerは独立する。Design Lock r8 Section 23／r9 Section 24がatomic DOM/runtime deployment eligibility、attempt-local clean-crash classification、source-contract closureを固定する。generic retry、blanket timeout extension、assertion弱体化、`app/**`／gameplay／balance／AI変更は禁止する。
- r11 corrected harnessでfresh local Stage 24 3/3、canonical Stage 3 3/3、six-path correction commit／push `0495e95e3bc59fcf546ffa02ee83704a1f63e366`までは完了した。correction-HEAD remote run #918はcurrent Stage 6 failureでredのため、focused remote complete green以後のlocal full Phase G 54/54＋validator＋full regressions、unfiltered remote complete green、dynamic runtime/human-quality evidenceは未完了である。
- r11 LUNA source returnはresume preflight PASS、five-file load PASS、focused 47 total／46 pass／1 fail、causal tests 4/4 PASS。実際の失敗は`tests/v100-design-lock.test.mjs`のr10 cross-source remediation-class assertionであり、`SOL human-player quality audit未完了` literalはlive／worktree双方に存在する。Section 27はtestを弱めず、Project Stateへ欠落していたr10 `REMEDIATION_CLASS`を追加するSOL-owned same-revision correctionとして閉じる。
- r11 source-contract history：HEAD `f3db25f00c9209830d79d7f01b599bdb02834a06`、tree `ee0bcd81f3aed9bedaf642f6990acf8907865259`、class `SOL_PACKET_CANONICAL_STATE_CONTRACT / R10_REMEDIATION_CLASS_OMITTED_FROM_PROJECT_STATE / REMEDIATION_LOCAL`。これはcurrent cursorではない。
- PR #169／#170の依存関係とPhase G blockerが残るため、Ready化、merge、tag、Release、正式Pages公開は不可。

## 6. Version 1.0.0 execution cursor — r23 Section 39

- `LOOP_ITERATION`: `5`。atomic material candidateはiteration 6、focused required gate完全green後のworkflow-only unfiltered restorationはiteration 7
- `SAME_GATE_REPEAT_COUNT`: `3` for deferred Stage 6
- `DEFERRED_STAGE24_REPEAT_COUNT`: `1`
- `DEPLOYMENT_736_REPEAT_COUNT`: `2`
- `DEPLOYMENT_844_REPEAT_COUNT`: `1`
- `DEPLOYMENT_ARTIFACT_COLLISION_REPEAT_COUNT`: `1`
- `ROLE_LOCK`: `SOL_DESIGN` until r23 four-path publication and green Design Lock 19/19；then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `4191afe2fe84283125c0e9ec817185c94685630c`
- `LAST_AUDITED_TREE`: `cb808fff195d58fd96718cb8381f7f9091e9f313`
- `FAILED_GATE`: first r22 full Chromium deployment後のartifact readback。runnerは288 logical PNG／48 logical sheetでexit 0したが、family-only filenamesによりKumaversonとMedicが全6 viewportで同じ保存先を共有し、unique pathsは252／42のみ。36 PNG recordsと6 sheet recordsが衝突し、Kumaverson recorded SHAは後勝ちMedic final fileと不一致。WebKit full deployment／commit／pushなし
- `LAST_GREEN_GATE`: r22 final source/static、first-attempt bounded Mayo receipt/PNG control、fresh r22 Phase G Stage 6 3/3・Stage 24 3/3・ordered trio 3/3。full Chromium exit-zeroはinvalid evidenceでgreen gateではなく、runner byte変更後は全r22 controlをdiagnosis専用とする
- `CLASSIFICATION`: `QA_EVIDENCE_ARTIFACT_IDENTITY_COLLISION / SHARED_FAMILY_FILENAME + LAST_WRITER_WINS_PNG_AND_CONTACT_SHEET_OVERWRITE / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `DEPLOYMENT_ARTIFACT_UNIQUE_IDENTITY_AND_INTEGRITY / FAMILY_PLUS_KIND_FILENAME + PRE-PASS_UNIQUE_PATH_AND_DISK_SHA_ASSERTION / DESIGN_CHANGE_REQUIRED`
- `RESUME_FROM`: preserve exact r22 seven-path draft/app bytes -> publish/lock r23 four design/source paths -> runner/test family-plus-kind filenames and pre-pass unique-path/final-disk-SHA integrity -> source/static/lint/build/diff/byte -> Chromium 667x375 Kumaverson+Medic once with 12+2 unique verified artifacts -> fresh r23 Phase G Stage 6/24/ordered 3/3 -> full Chromium six-viewports with 288+48 unique/disk-verified artifacts -> WebKit six-viewports/48 one-attempt unit processes -> atomic iteration-6 candidate -> one automatic focused complete green -> workflow-only iteration-7 restoration -> same-HEAD full Phase G 54/54/validator/regressions -> one unfiltered remote run -> exact-HEAD runtime/human audit -> clean fixed-HEAD `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approved stacked integration/release/Pages/public QA/recovery/closure
- `NEXT_OWNER`: `SOL_REMEDIATION` only after Issue-locked r23 publication and green Design Lock proof

PR本文や状態文書の`LAST_AUDITED_HEAD`は監査cursorであり、可変なlive HEADの代替ではない。r23は四つのSOL-owned design/source pathsをcommitせずIssue #172へraw SHA-256／blob ID／combined patch hashとDesign Lock source proofで固定する。`SOL_REMEDIATION`ではr21 app bytesを保持し、runner/testの既存二pathだけへfamily-plus-kind filenameとfail-closed artifact integrityを追加する。filtered/noncanonical runを含め、logical count、combined unique path、non-empty regular file、recorded-to-final-disk SHA equalityがgreenでなければterminal pass禁止。exact seven-path topology、product、Phase G、workflow、bounded runner、CI BOM、public/package bytesは不変。focused remote完全green後だけrepeat countersを0へresetし、workflow-only iteration-7 restorationとSection 28のfull/unfiltered/runtime/final-review/release routeへ進む。

### Post-V1 governance normalization debt

`AGENTS.md`／`docs/CODEX_TWO_THREAD_WORKFLOW.md`のgeneric two-thread／Completion Packet経路と、Version 1.0.0 Design Lock Sections 28-39のSOL single-owner／single final checkpoint経路には恒久文書上の差がある。現VersionではVersion固有のDesign Lock r23を優先し、active implementation branch上でgeneric governanceを改訂しない。V1 release後、別のgovernance normalization作業でgeneric文書を整合する。

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
- exact HEAD/treeの12画面を含むfinal release-candidate packageとSOL human-player quality audit未完了
- read-only／adversarial fixed-HEAD `SOL_FINAL_REVIEW`と一度だけの`FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT`未完了
- High／Medium finding未解消
