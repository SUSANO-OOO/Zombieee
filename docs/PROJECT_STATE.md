# 西新世紀末物語 — プロジェクト状態

更新日：2026-08-21

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
- LAST_AUDITED_HEAD：`21b3a2076b5ff580189c9cfe69fb4dc30193a45d`、tree `1f741a0cb0f202690c7f96d4578c3f26ef470a39`。これはSOLが内容を監査した固定cursorであり、PRの可変なlive HEADではない。live HEADは毎回GitHub refから再取得する
- production implementation／runtime asset integration：Draft candidate上に実装済み。ただしPhase G未達のため`NOT_READY`
- current Design Lock：`V100-SOL-DL-001 r6`（r4 Phase G契約とr5 execution/release loopを維持し、新required-CI failureの診断専用returnをSection 20へ固定。`PRODUCT_DESIGN_CHANGE: 0`）
- execution ledger：Issue #172。r6 cursorを現在値として使用する。pre-r5 Issue本文と`V100-LOOP-LOCK-001` commentは暫定監査資料であり、並行Design Lockではない
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
5. remote required CI／Phase G完全green後、Lunaは`PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`へ遷移し、actual productionの12画面（TITLE、名前入力、作戦地図、通常Stage選択、Boss Stage選択、出撃編成、隊員、出撃装備、装甲車両強化、代表event、通常battle HUD、戦果）をProducer確認へ出す
6. Producer Visual Approval前はCompletion Packetを確定せず、`READY_FOR_SOL_FINAL_REVIEW`へ進まない
7. Producer Visual Approval後に承認HEAD/treeと12 evidence IDをfreezeし、branch commitを作らずLuna Completion PacketをIssue／PR／immutable artifactで確定して元のSolへ返す。承認後のcommitはVisual Approvalとfreezeを無効化する
8. 元のSolが`SOL_FINAL_REVIEW`を行い、High／Medium 0なら`APPROVE`
9. `SOL FINAL REVIEW APPROVE`後も直ちに統合・公開せず、`PRODUCER_FINAL_ACCEPTANCE`へ進む
10. Producerの明示承認後だけPR #169 -> #170 -> #171をfresh checks／exact head／synthetic treeで順次統合し、#171 merge-result SHA/treeが承認treeと一致した場合だけtag、GitHub Release、official Pagesを実行する
11. published SHAを固定してpost-release QAを行い、その成功後に`PROJECT_STATE`更新と対象Issue／PR closeを行う

SolとLunaを同時並行に動かさない。

## 5. 現在のblocker

- PR #169、#170、#171はいずれもDraft／未merge。PR #171はVersion 1.0.0 implementation candidateだが、`NOT_READY`である。
- candidate `21b3a2076b5ff580189c9cfe69fb4dc30193a45d`でLF remediationは完了した。変更は`.gitattributes`、`.github/workflows/ci.yml`、`scripts/v100-phase-g-production-matrix.mjs`の3件のみ。workflow BOM／Phase G script no-BOM／checkpoint test blobを維持し、semantic diff 0、LF-only、CI-equivalent `git diff --check` PASSを確認済み。旧whitespace blockerはclosedである。
- focused run `32487312283`で新required failureが発生した。PR Verify job `96786672078`はChromium final-canvas deployment stepの`667x375`、`844x340`、`932x430`で30秒timeout（artifact `9448623917`）。3件とも`units: []`かつfailure screenshot／lifecycle pathなしであり、最初のunit/final-canvas assertion前の`openBattlePage`内setup/readiness failureである。WebKit Stage 3 job `96792165248`は`final-candidate`の`final-cut`で60秒timeout、`failureState: null`、console／page／request／HTTP／pending request 0（artifact `9449229851`）。同runの`entrance-candidate` job `96792165262`とexact-base `final-base` job `96792165296`は成功した。
- `.github/workflows/ci.yml`の`V1 Phase G Production Matrix`は`needs: verify`であるため、job `96789049082`はskipped。remote trio／local full Phase G／unfiltered remote Phase Gは未実行である。Lunaはstop contractどおりretry／rerun／追加修正を行っていない。
- 現分類は`REQUIRED_CI_PRODUCT_RUNTIME_DIAGNOSTIC / DESIGN_CHANGE_REQUIRED`。Design Lock r6 Section 20は二つのfailureを同一原因と仮定せず、既存QA APIから有限traceを得る一回限りのdiagnostic-only commit/runを固定する。Lunaにroot cause分類・correction・retry判断を委譲しない。
- LUNAのisolated Stage 6／24／25診断とlocal ordered trio 3/3は成立済みだが、current candidateのremote/final evidenceではない。r6診断のために再実行せず、Phase GはSOLの次回分類まで停止する。
- audited HEAD `0f2c6e92ddb9de5410585ec8d78dae5f3c3e3f2b`のCI run `32455268714`ではPR Verify等は成功したが、Phase G job `96694829714`が`webkit-667x375-battle-extra`で45秒timeoutとなった。失敗stateは`null`、console／page／request／HTTP errorは0、Phase G validatorは未実行である。
- artifact `9437741041`（`v100-phase-g-production-evidence`、SHA-256 `08b7a3345a780ebb8adb3c1776b40e50ee90cc05b84d0227e613e5cb655efe4b`）は51 PNGのみを含む。48 core Chromium captureと3 Chromium battle-extraは存在するが、WebKit battle-extra、最終report、manifest、runtime evidenceは存在しない。
- docs-only HEAD `29c6046484d3a81793b416feb2474ca62adf77bd`のCI run `32465986052`ではStage 6を通過後、Phase G job `96726761976`が`webkit-736x414-battle-extra`（`stage24-panther-commander`）で`boss frontline unit 4 never entered cooldown from the ready state`により失敗した。失敗stateは再び`null`、console／page／request／HTTP errorは0、validatorは未実行である。
- artifact `9441563957`（SHA-256 `e6a13dd7d929763b424edc52853ffffd88ade38ff0568e87cf23b5bfea6dfa5a`）のuploadは52 filesを報告した。Stage 24 screenshotと最終report／manifest／runtime evidenceは未完成である。
- pre-r4 docs HEAD `cd99be209f143cbe70f313df4866759756ea18c8`までの`29c6046..cd99be2`差分はdocs 3ファイルのみで、`app/**`、Phase G harness、workflow、package、testsに変更はない。したがって新failureは現candidateへ適用されるlive blockerである。
- Stage 6限定診断ではclosure不能。Design Lock r4はWebKit battle-extra 3契約（Stage 6／24／25）へ共通checkpoint／lifecycle診断とordered focused regressionを固定する。根拠のない局所修正、generic retry、blanket timeout extensionは禁止する。
- PR #169／#170の依存関係とPhase G blockerが残るため、Ready化、merge、tag、Release、正式Pages公開は不可。

## 6. Version 1.0.0 execution cursor — r6

- `LAST_AUDITED_HEAD`: `21b3a2076b5ff580189c9cfe69fb4dc30193a45d`
- `LAST_AUDITED_TREE`: `1f741a0cb0f202690c7f96d4578c3f26ef470a39`
- `FAILED_GATE`: run `32487312283`; PR Verify `96786672078` Chromium final-canvas; Stage 3 final-candidate `96792165248`; dependent Phase G `96789049082` skipped
- `LAST_GREEN_GATE`: LF byte/BOM/EOL/semantic-zero and whitespace checks; run `32487312283` pre-failure PR Verify steps through Chromium canonical HUD; WebKit enemy/hosted jobs; Stage 3 entrance-candidate and exact-base final control. Diagnostic controls only; final freeze reuse不可
- `REMEDIATION_CLASS`: `REQUIRED_CI_PRODUCT_RUNTIME_DIAGNOSTIC / DESIGN_CHANGE_REQUIRED`
- `RESUME_FROM`: Design Lock Section 20／Handoff Section 13のadditive observationのみ -> focused contract／lint／build／diff checks -> 一回のnormal diagnostic push -> その一回のCI runをterminalまで待機 -> `BLOCKED_RETURN_TO_SOL_DIAGNOSTIC_COMPLETE`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION`（diagnostic-only。root cause分類、correction、retry、Phase G、製品判断権限なし）

Lunaはallowlist内の一回のdiagnostic commit／pushだけを行い、結果が明白に見えてもcorrection、retry、rerun、second commitを行わない。run terminal後は必ずSOLへ戻す。SOLの次回classificationとlocked packetなしにPR Verify／remote trio／local full Phase G／unfiltered remoteへ進まない。

PR本文や状態文書の`LAST_AUDITED_HEAD`は監査cursorであり、可変なlive HEADの代替ではない。作業開始・push前・gate判定前にGitHubのPR refを再取得する。

### Post-V1 governance normalization debt

`AGENTS.md`／`docs/CODEX_TWO_THREAD_WORKFLOW.md`のgeneric Completion Packet経路と、Version 1.0.0 Design Lock Sections 19-20のProducer Visual Checkpoint／Final Acceptance経路には恒久文書上の差がある。現VersionではVersion固有のDesign Lock r6を優先し、active implementation branch上でgeneric governanceを改訂しない。V1 release後、別のgovernance normalization作業でgeneric文書をProducer checkpoint／final acceptance経路へ整合する。

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
- High／Medium finding未解消
