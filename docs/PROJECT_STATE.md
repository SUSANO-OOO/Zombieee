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
- LAST_AUDITED_HEAD：`7429460950a37b2ac68415a5046547c97f8bb263`、tree `9c1cab7d8a8950a2ba475d89ffb986434ba36d15`。これはSOLが内容を監査した固定cursorであり、PRの可変なlive HEADではない。live HEADは毎回GitHub refから再取得する
- production implementation／runtime asset integration：Draft candidate上に実装済み。ただしPhase G未達のため`NOT_READY`
- current Design Lock：`V100-SOL-DL-001 r7`（Section 21のStage 3 correctionはremote 3/3で閉じ、Section 22が`.gitattributes`だけのsame-revision LF closureを所有する。r4 Phase G契約、r5 execution/release loop、r6 diagnosticsを維持。`PRODUCT_DESIGN_CHANGE: 0`）
- execution ledger：Issue #172。r7 Section 22 cursorを現在値として使用する。pre-r5 Issue本文と`V100-LOOP-LOCK-001` commentは暫定監査資料であり、並行Design Lockではない
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
- r7 correction HEAD `7429460950a37b2ac68415a5046547c97f8bb263`、tree `9c1cab7d8a8950a2ba475d89ffb986434ba36d15`のCI #908／run `32510923851`はterminal failure。Lunaは一回のcorrection commit/push後、manual retry／rerun／second commit／product correctionなしで`BLOCKED_RETURN_TO_SOL_R7_REMOTE_COMPLETE`へ停止した。
- PR Verify `96861615644`はCI同一rangeの`git diff --check`で`.gitattributes` 1-26行をtrailing whitespaceとして停止した。immutable blobはr7 packetでLF 27／CRLF 0、correction HEADでCRLF 26＋LF 6、いずれもno-BOM。分類は`REPO_HYGIENE / DOT_GITATTRIBUTES_MIXED_EOL / REMEDIATION_LOCAL`。報告されたlocal whitespace passは同一immutable blobと矛盾するためgate evidenceとして不採用。
- r7 Stage 3 correctionはremote focused 3/3成功（entrance `96867530097`、final-candidate `96867530121`、final-base `96867530136`）。final-base artifact `9457872989`は1 bounded attemptで完了した。分類は`REMEDIATION_CLOSED / REMOTE_FOCUSED_GREEN`であり、product combat/story/audio blockerはない。
- WebKit deployment 6軸のtop-level bounded summaryは6/6成功。736x414/brawlerと844x390/medicは既存のmaximum-two-attempt contract内でattempt 1 target-close、attempt 2成功。manual retryではなく`BOUNDED_RETRY_SUCCESS / CONTROL_GREEN`である。canonical viewport 48/48、enemy-runtime 6/6、hosted evidenceも成功したがfinal freezeには流用しない。
- PR Verifyが早期停止したため、同job内の6 Chromium deployment axesは未実行。Phase G `96861720725`も`needs: verify`でskippedした。WebKit deployment jobをChromium diagnosticの代替にしない。local full Phase Gとunfiltered remote Phase Gも未実行である。
- 現active分類は`SINGLE_FILE_REPO_HYGIENE / REMEDIATION_LOCAL`。Design revisionはr7を維持し、Section 22が`.gitattributes` LF/no-BOM normalizationとexact self LF contractだけを一回のbounded remediationへ固定する。Lunaにroot cause、scope、retry、promotion判断を委譲しない。
- LUNAのisolated Stage 6／24／25診断とlocal ordered trio 3/3はhistorical local evidenceであり、current candidateのremote/final evidenceではない。Section 22 remote returnをSOLが再分類するまでlocal full Phase Gとunfiltered remote Phase Gは停止する。
- audited HEAD `0f2c6e92ddb9de5410585ec8d78dae5f3c3e3f2b`のCI run `32455268714`ではPR Verify等は成功したが、Phase G job `96694829714`が`webkit-667x375-battle-extra`で45秒timeoutとなった。失敗stateは`null`、console／page／request／HTTP errorは0、Phase G validatorは未実行である。
- artifact `9437741041`（`v100-phase-g-production-evidence`、SHA-256 `08b7a3345a780ebb8adb3c1776b40e50ee90cc05b84d0227e613e5cb655efe4b`）は51 PNGのみを含む。48 core Chromium captureと3 Chromium battle-extraは存在するが、WebKit battle-extra、最終report、manifest、runtime evidenceは存在しない。
- docs-only HEAD `29c6046484d3a81793b416feb2474ca62adf77bd`のCI run `32465986052`ではStage 6を通過後、Phase G job `96726761976`が`webkit-736x414-battle-extra`（`stage24-panther-commander`）で`boss frontline unit 4 never entered cooldown from the ready state`により失敗した。失敗stateは再び`null`、console／page／request／HTTP errorは0、validatorは未実行である。
- artifact `9441563957`（SHA-256 `e6a13dd7d929763b424edc52853ffffd88ade38ff0568e87cf23b5bfea6dfa5a`）のuploadは52 filesを報告した。Stage 24 screenshotと最終report／manifest／runtime evidenceは未完成である。
- pre-r4 docs HEAD `cd99be209f143cbe70f313df4866759756ea18c8`までの`29c6046..cd99be2`差分はdocs 3ファイルのみで、`app/**`、Phase G harness、workflow、package、testsに変更はない。したがって新failureは現candidateへ適用されるlive blockerである。
- Stage 6限定診断ではclosure不能。Design Lock r4はWebKit battle-extra 3契約（Stage 6／24／25）へ共通checkpoint／lifecycle診断とordered focused regressionを固定する。根拠のない局所修正、generic retry、blanket timeout extensionは禁止する。
- PR #169／#170の依存関係とPhase G blockerが残るため、Ready化、merge、tag、Release、正式Pages公開は不可。

## 6. Version 1.0.0 execution cursor — r7 Section 22

- `LAST_AUDITED_HEAD`: `7429460950a37b2ac68415a5046547c97f8bb263`
- `LAST_AUDITED_TREE`: `9c1cab7d8a8950a2ba475d89ffb986434ba36d15`
- `FAILED_GATE`: run `32510923851`; PR Verify `96861615644` mixed-EOL `.gitattributes`; six Chromium deployment axes not run; Phase G `96861720725` skipped
- `LAST_GREEN_GATE`: Stage 3 remote 3/3、WebKit deployment bounded summaries 6/6、canonical viewports 48/48、WebKit enemy-runtime 6/6、hosted evidence。focused controls only、final freeze reuse不可
- `REMEDIATION_CLASS`: `REPO_HYGIENE / DOT_GITATTRIBUTES_MIXED_EOL / REMEDIATION_LOCAL`
- `RESUME_FROM`: `.gitattributes` LF/no-BOM normalization + exact self LF contract -> committed-blob and CI-range checks -> one normal remediation push -> wait for that correction-HEAD automatic run terminal -> `BLOCKED_RETURN_TO_SOL_R7_ATTR_LF_REMOTE_COMPLETE`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION`（Design Lock Section 22のone-file remediationのみ。root cause／scope／retry／promotion／製品判断権限なし）

Lunaは`.gitattributes`だけの一回のremediation commit／pushを行い、manual retry／rerun／second commitを行わない。automatic runの結果がgreenでもfailureでもterminal後は必ずSOLへ戻す。SOLの次回classificationとlocked packetなしにlocal full Phase G／unfiltered remoteへ進まない。

PR本文や状態文書の`LAST_AUDITED_HEAD`は監査cursorであり、可変なlive HEADの代替ではない。作業開始・push前・gate判定前にGitHubのPR refを再取得する。

### Post-V1 governance normalization debt

`AGENTS.md`／`docs/CODEX_TWO_THREAD_WORKFLOW.md`のgeneric Completion Packet経路と、Version 1.0.0 Design Lock Sections 19-21のProducer Visual Checkpoint／Final Acceptance経路には恒久文書上の差がある。現VersionではVersion固有のDesign Lock r7を優先し、active implementation branch上でgeneric governanceを改訂しない。V1 release後、別のgovernance normalization作業でgeneric文書をProducer checkpoint／final acceptance経路へ整合する。

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
