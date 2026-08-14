# 西新世紀末物語 — プロジェクト状態

更新日：2026-08-14

## 1. 現在の正式公開

唯一の正式公開先はGitHub Pages。

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：**Version 0.9.9.5**
- annotated tag：`v0.9.9.5`
- release／main SHA：`55d796cc577d1d9f903a4d2c6b4382196511db27`
- release tree：`0f8a5fb417ccca595d485d22c2c3cbe240b6ee28`
- final release PR：#167
- GitHub Release：Version 0.9.9.5

Version 0.9.9.5はVisual Integrity release。Independent Sol final reviewはHigh 0／Medium 0／Low 0、CIは1093／1093、Chromium／WebKit visual matrix、PWA差分update、save保持、offline launch、rollbackを確認済み。

物理iPhoneでのreplay、speaker、thermal behaviorはrelease時点で未確認のrisk accepted項目。将来確認で問題が出た場合も、既存tagを動かさず新しいIssue／releaseで扱う。

`main` HEADは動的である。作業開始、branch作成、PR操作、merge、tag、公開前後にlive GitHubから再取得する。本文中のSHAを永久に最新として扱わない。

## 2. 現行0.9.9.5の基盤

- 本編campaign：20 Stage
- playable unit：16体
- current initial unit：6体
- campaign progression：内部最大Level 50／現行player-facing cap 25
- story registry：`outbreak-origin-v8`
- mode：Campaign、Survival、異常発生
- save：localStorage、IndexedDB backup、replica reconciliation、last-known-good、corrupt recovery、manual export／import
- PWA：manifest、size／SHA-256検証、Cache Storage、generation commit、offline、rollback
- battle support：`pod／drum／medical`系と互換support系が併存
- asset policy：runtime assetとauthoring masterを分離し、provenance／hash／bytesを記録

Version 1.0.0はこの基盤を無視して新造せず、保全対象、置換対象、互換境界をDesign Lockで分離する。

## 3. 次の正式release target

次の製品targetは**Version 1.0.0**。

- 対象：PROLOGUE、Stage 1〜30、ENDING、EPILOGUE
- 正史：v10 event script
- 状態：実装前のdocs／Producer Lock整備中
- docs baseline：Draft PR #169
- branch：`docs/story-v10-final-release-baseline`
- production implementation：未着手
- runtime asset integration：未着手
- merge／tag／Release／Pages公開：未実施

PR #169のheadはdocs更新で動くため、固定値を本文へ埋め込まずlive PRから取得する。

## 4. Version 1.0.0で固定済みの主要判断

正本は`docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`。

- 初期unit：ハチ、パイセン、クマバーソン、ババヤガ
- primary role：frontline／heavy／skirmisher／marksman／suppression／support／engineer
- formation：最大7体
- battle active：最大7体、同じ固有characterは同時1体
- difficulty：単一のhardcore-but-fair campaign。hidden runtime DDAなし
- story進行：1 starで次Stage解禁。2／3 starは任意mastery
- campaign level cap：最大30。Stage 5刻みで5／10／15／20／25／30
- 主人公名入力：採用。未入力／skip時は`指揮官`
- unit加入：物語上`合流`、gameplay上`戦闘配備登録が解禁`、CAPS actionは`配備登録`
- support：回復支援、爆薬ドラム缶、火炎ドラム缶から1種装備
- 旧進行：新30 Stageへmigrationしない。旧save／backup削除禁止
- 旧player：一度だけ正式release記念CAPS
- RED PANTHER：正式名称はStage 27で初開示
- セガワ添付写真：セガワ本人のprivate face identity reference。原写真をpublic Git／artifactへ保存しない
- TAKUYAとTAKUYA-Ω：別boss ID／identity／reward／compendium

exact stats、cost、reward、wave、unlock Stage、support tuning、boss他mode配置、旧player記念CAPS額は、固定guardrail内でSolがsimulationとruntime QAにより自律確定する。

## 5. 正本と参照順

Version 1.0.0では次の順を使用する。

1. `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`
2. `docs/story/v10/STORY_SCRIPT_V10.md`からhash検証して復元したv10全文
3. Solが作成する最新Design Lock
4. `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`
5. 対象Versionの実行台帳Issue／PR
6. `AGENTS.md`
7. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
8. live code、tests、assets、QA
9. 旧Story Bible、旧Issue、旧PR、旧台本

旧文書がv10／Producer Decisionsと衝突する場合、履歴・stable ID・asset再利用の調査資料としてだけ使う。

## 6. 実行体制

標準フローはSol→Luna→元のSol。

1. Producer／司令塔が正本と製品境界を固定
2. 最初のSol threadが`SOL_DESIGN`
3. Solが現行repositoryを監査し、Design Lock、balance evidence、finite asset inventory、Luna Handoffを正本化
4. 事前承認済み範囲の必要assetは、Solがidentity lock／prompt／candidate／authoring masterまで作成可能
5. Lunaが`LUNA_IMPLEMENTATION`としてproduction code、asset integration、tests、browser QA、self-review、Draft PRを担当
6. Lunaのfixed HEAD／tree／Completion Packetを最初のSolへ返す
7. 最初のSolが`SOL_FINAL_REVIEW`
8. Sol remediationがある場合はLuna validation後にSolが再review
9. High／Medium 0、release gate、Producer公開承認後だけmerge／tag／Release／Pages公開

SolとLunaを同時並行に動かさない。LunaはDesignを独自変更せず、Solは通常のLuna実装を先回りしない。

## 7. Version 1.0.0のrelease gate

次が一つでも残る場合、完成／APPROVE／READY_FOR_RELEASEとしない。

- Stage 1〜30、ENDING、EPILOGUEのfresh run未確認
- 未配置object、missing asset、placeholder、speaker／portrait mismatch
- battle participantのsprite、animation、attack presentation、VFX、audio不足
- formation／battle 7体上限、同一unit一体制限の迂回
- exact named unit必須、counter未解禁、mandatory grind、economy softlock
- CAPS、reward、unlock、receiptの二重適用
- save hydration、replica、import／export、offline、rollback、legacy rewardの破壊
- 844×390、844×340、1280×720で切れ、重なり、豆粒化、操作不能
- console／page／HTTP／request failure
- High／Medium finding未解消

CI greenだけを完成根拠にしない。fixed HEADの実ブラウザ、通しplay、save／PWA evidenceを要求する。

## 8. 恒久禁止

- `main`直接push
- force push／rebase／amend
- 既存tag移動
- 旧save／backup／assetの削除
- cache全削除をmigration手段にすること
- license／commercial use／provenance不明assetの正式採用
- test／acceptance／visual thresholdの実装都合による弱体化
- Sol／Lunaの同時並行
- Segawa face model原写真のpublic repository／artifact保存

長期方向は`docs/PRODUCT_ROADMAP.md`、公開・復元は`docs/RELEASE_BACKUP_RECOVERY.md`、asset保存は`docs/ASSET_STORAGE_POLICY.md`を参照する。