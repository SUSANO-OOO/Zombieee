# 西新世紀末物語 — Codex 2スレッド実装フロー

更新日：2026-08-08

## 1. 目的

本書は、Codex上で **Solスレッド** と **Lunaスレッド** を分離し、設計・実装・検証が混線しないための実行プロトコルを定める。

恒久的な安全境界は `AGENTS.md`、現在の正式release状態は `docs/PROJECT_STATE.md`、長期方向は `docs/PRODUCT_ROADMAP.md` が正本である。本書はそれらを置き換えず、SolとLunaの実行順・引き継ぎ・mode切替を所有する。

## 2. 固定トポロジー

通常運用は2スレッドとする。

- **Sol thread**：全体設計、最終review、必要時の限定remediation
- **Luna thread**：実装、trial-and-error、self-review、回帰validation

**同一missionで一度にactiveなのは1スレッドだけ**とする。Sol Design完了後にSolは待機し、Lunaへ明示handoffする。Luna完了後にLunaは待機し、成果物を元のSolへ明示handoffする。SolとLunaを並列実行しない。

スレッドをまたいで人格・役割を混ぜない。Sol threadがLuna Implementation Leadとして通常実装を代行したり、Luna threadがSol Design Leadとして仕様・architectureを再設計したりしない。

各phase開始時に、担当は最初の進行報告で次の `ROLE_LOCK` を明示する。

Sol thread:

- `ROLE_LOCK: SOL_DESIGN`
- `ROLE_LOCK: SOL_FINAL_REVIEW`
- `ROLE_LOCK: SOL_REMEDIATION`

Luna thread:

- `ROLE_LOCK: LUNA_IMPLEMENTATION`
- `ROLE_LOCK: LUNA_VALIDATION`

`ROLE_LOCK`は**各スレッド内で現在何をしてよいかを固定する状態名**であり、モデルやスレッドを自動切替する機構ではない。同時に複数modeを有効にしない。mode変更時は新しい `ROLE_LOCK` を明示し、直前modeの権限を持ち越さない。

## 3. 必須読み込み

### 3.1 Sol thread

Solは各mission開始時に最低限次を読む。

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_SOL_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. 対象Version／featureの実行台帳IssueまたはProducer Decisions
6. 関連する既存spec、tests、QA証拠、現行code

`docs/CODEX_LUNA_ROLE.md`はhandoff設計の参考にはできるが、Sol自身の行動権限にはしない。

### 3.2 Luna thread

Lunaは各implementation開始時に最低限次を読む。

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_LUNA_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. 対象Version／featureの実行台帳Issue
6. **Solが固定した最新Design Lock／Luna Handoff**
7. Handoffが指定する関連code、spec、tests、QA証拠

Lunaは `docs/CODEX_SOL_ROLE.md` を自分の行動権限として使用しない。Roadmap候補や過去の設計案を、最新Design Lockを上書きする根拠にしない。

## 4. 標準フロー

### Phase 0 — Producer Brief

Producerまたは司令塔が最低限次を固定する。

- 一つの主目的
- player-facing outcome
- 明示的なnon-goal／変更禁止
- 既知のProducer判断

製品判断が未確定ならSolが勝手に確定せず、設計blockerとして返す。

### Phase 1 — Sol Design

`ROLE_LOCK: SOL_DESIGN`

Solは現行code／Issue／tests／save／PWA／release境界を調査し、Lunaが追加の設計推測をせず実装できる粒度まで設計する。

Design完了時に、Issue commentまたは指定MDへ **Design Lock** を固定する。

Design Lockは最低限次を持つ。

- Design ID／revision
- baseline branch／HEAD／tree
- objective／player outcome
- current behavior／root causeまたは新機能成立条件
- architecture／責務分離
- data／state／event／asset contract
- 変更予定file／競合file
- non-goal／変更禁止範囲
- save／migration／PWA／Service Worker／audio／release影響境界
- acceptance criteria
- focused／full／browser／PWA／save等のvalidation plan
- negative test／failure case
- PR分割／依存順
- pause／stop conditions
- Luna Handoff

Design mode中は製品実装codeを変更しない。

### Phase 2 — Luna Implementation

`ROLE_LOCK: LUNA_IMPLEMENTATION`

LunaはDesign Lockを実装正本として作業する。

LunaはDesign Lockの範囲内で、実装方式の細部についてtrial-and-errorしてよい。失敗した内部方式を捨て、別方式を試し、testを追加し、browser evidenceを取り直すことも許可する。ただし、acceptance／contract／non-goalを独自変更しない。

標準loop:

1. baseline／branch／Design revisionを再確認
2. acceptance criteriaを実装checklistへ写す
3. 小さいcheckpointで実装
4. focused test／必要なgenerator／静的check
5. 実ブラウザ・runtime確認
6. Findingがあれば同じDesign Lock内で修正
7. full test／Lint／build／content／diff check等
8. self-review
9. fixed HEAD／treeを記録
10. SolへCompletion Packetを渡す

### Phase 3 — Luna Self Review

Lunaは「testsがgreen」だけで完了扱いにしない。最低限次を自己監査する。

- Design acceptance criteria全件への証拠mapping
- scope外変更0
- unexpected deletion／rename／mode change 0
- regression test
- negative test
- runtime/browser evidence
- save／PWA／asset契約の対象回帰
- console／page／HTTP／request error
- fixed HEAD／tree
- unresolved risk／未確認境界

Completion Packetは最低限次を持つ。

- Design ID／revision
- implementation branch
- fixed HEAD／tree
- changed files summary
- acceptance matrix
- focused／full／browser QA結果
- evidence location／hash
- known residual risks
- `READY_FOR_SOL_REVIEW` または blocker

### Phase 4 — Sol Final Review

LunaのCompletion Packet受領後、**最初に設計した元のSol thread**へ戻り、明示的に

`ROLE_LOCK: SOL_FINAL_REVIEW`

へ切り替える。

Final Review modeは原則read-onlyである。SolはDesign Lockとfixed HEADの実差分、tests、runtime evidenceを照合し、単にLunaの報告文を信用して合格にしない。

最低確認:

- Design compliance
- acceptance全件
- non-goal／scope drift
- architecture／contract破壊
- testが実装を本当に検査しているか
- runtime evidence
- save／PWA／release境界
- High／Medium／Low Finding

問題がなければ `APPROVE` を出す。

## 5. SolがFindingを見つけた場合

Findingを2種類に分類する。

### 5.1 REMEDIATION_LOCAL

次をすべて満たす場合、Producer方針としてSol自身が限定修正へ進んでよい。

- Design Lock自体は変更不要
- player-facing仕様変更なし
- architectureの再設計なし
- save schema／migration方針の新規変更なし
- PWA／Service Worker／release contractの新規再設計なし
- Findingの原因と必要修正範囲をSolが具体的に固定できる
- 既存acceptance criteriaの達成のための修正である

Solは

`ROLE_LOCK: SOL_REMEDIATION`

へ切り替え、Findingで固定した範囲だけ実装してよい。

Sol Remediationでは新機能追加、ついで修正、Design拡張を禁止する。

### 5.2 DESIGN_CHANGE_REQUIRED

次のいずれかならSolが直接hotfixして完了させない。

- acceptance／仕様を変える必要がある
- architecture責務を変更する
- save／migration／PWA／Service Worker／release contractを再設計する
- 新しいasset方針／product decisionが必要
- 複数systemへ影響が広がり、旧Design LockではLunaが正しく判断できない

Solは `ROLE_LOCK: SOL_DESIGN` に戻り、Design revisionを上げ、新しいLuna Handoffを作る。その後Luna Implementationへ戻す。

## 6. Sol Remediation後の必須loop

Solがcodeを変更した場合、Solはその新HEADを即時自己承認しない。

1. Solがremediation commit／pushし、新fixed HEAD／treeと変更範囲を記録
2. Luna threadへ渡す
3. Lunaは `ROLE_LOCK: LUNA_VALIDATION` へ切り替える
4. Lunaは新設計をしない。Design acceptanceとSol Finding修正に対する回帰validationを実行
5. Lunaがvalidation結果、fixed HEAD／tree、regression evidenceをSolへ返す
6. 元のSol threadは `ROLE_LOCK: SOL_FINAL_REVIEW` へ戻り、最終read-only確認
7. 問題0ならAPPROVE

このloopにより、Solが自分で修正した直後に同じ判断だけで合格扱いすることを防ぐ。

## 7. `/goal`の使い分け

Goal modeは、成果と成功条件を定義し、継続的に同じ目標へ取り組ませる用途で使用する。

### Sol

- Version／featureのDesign Lock作成：原則`/goal`
- 単発のread-only fixed-HEAD review：通常promptでも可
- review→複数Finding→remediation→再reviewまで継続する場合：`/goal`
- 小さい機械的remediation一件：通常prompt可。複数checkpointへ広がれば`/goal`へ切替

### Luna

- 通常のfeature実装、複数file／module、実装→QA→修正→PR：`/goal`
- 単一の小修正＋一回のverificationのみ：通常prompt可
- Sol remediation後の複数回帰QA：必要なcheckpoint数に応じて`/goal`

Goalの選択基準は作業時間ではなく、複数工程にわたり同じobjective／success criteriaを保持する必要があるかで判断する。

## 8. Handoffの改変禁止

LunaはSol Handoffを受領したら、Design ID／revision／baseline／acceptanceを最初に再掲して固定する。

SolはFinal Reviewで、Lunaが参照したDesign revisionが最新であることを確認する。

古いDesign、会話上の案、Roadmap候補、過去PRを最新Design Lockより優先しない。

## 9. Release／独立監査

通常の2スレッドフローでは、**元のSol threadのFinal Reviewを最終技術review**とする。

ただし、対象Versionの正本、Producer判断、risk level、release gateが**独立監査**を要求する場合は、Designを担当したSol threadとは別のfresh Sol Auditor contextを追加する。その場合のみ、そのreviewを「independent audit」と呼ぶ。

同じSol threadのFinal Reviewを、独立監査と誤記しない。

## 10. 完了状態

実装missionの完了は、最低限次が成立した時点とする。

- 最新Design Lockが明確
- Luna implementation／self-review完了
- fixed HEAD／tree／証拠固定
- 元のSol threadのFinal Review合格
- Sol remediationがあった場合はLuna validation後に再review済み
- High／Medium未解消0
- 対象VersionのProducer／release gateを満たす

release操作は対象Version正本が許可した場合だけ実行する。
