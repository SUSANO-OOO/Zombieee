# 西新世紀末物語 — 開発運用ルール

更新日：2026-08-08

## 1. 適用範囲

本書は、このリポジトリで作業するCodex、ChatGPT、Claude Code、サブエージェント、レビュー担当に適用する恒久ルールである。

個別Versionの製品判断と実行手順は、対象Versionの正本を優先する。

### 現行Versionの参照順

1. 対象Versionの`docs/PRODUCER_DECISIONS_<version>.md`
2. 対象Versionの実行台帳Issue
3. 対象Versionに専用Execution Lock／Implementation Directiveがある場合はその順序
4. 本書
5. 最新`main`のコード、tests、QA記録
6. 工程別Issue、PR、実装・QA記録

Version 0.9.9.0はIssue #136を実行正本として正式公開・close済みであり、以後の新規実装の実行権限として再利用しない。次VersionはProducerが主目的を固定し、新しい実行台帳IssueまたはProducer Decisionsを作成してから設計へ入る。

製品判断はProducer Decisions、実行台帳は対象Issue、恒久安全境界は本書が所有する。過去コメント、旧PR、旧ロードマップ、会話上の検討案が現行正本と衝突する場合は採用しない。

## 2. 正しい情報源

- 公開中正式コード：annotated tag／GitHub Releaseが指すrelease SHA
- `main` HEAD：開発・docs-only更新により公開release SHAより先へ進むことがある。現在値はGitHubから再取得する
- 作業中コード：指定feature／integration branch
- 正式公開版：GitHub Pagesで配信中のrelease SHA
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 現在状態：`docs/PROJECT_STATE.md`
- 長期方向：`docs/PRODUCT_ROADMAP.md`
- 公開・復元：`docs/RELEASE_BACKUP_RECOVERY.md`
- 2スレッド実行手順：`docs/CODEX_TWO_THREAD_WORKFLOW.md`
- Sol専用規約：`docs/CODEX_SOL_ROLE.md`
- Luna専用規約：`docs/CODEX_LUNA_ROLE.md`
- 実行ログ・承認・QA：対象IssueとPR
- 実環境固有挙動：最新の実ブラウザQA

作業開始時、PR操作直前、merge直前、tag作成直前、公開後にGitHubの現在値を再取得する。文書記載SHAや過去報告を永久に最新として扱わない。

ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、障害復旧に使用しない。

## 3. 標準実装トポロジー

通常のVersion／feature実装は、**同じプロジェクト内の2つの固定スレッドを順番に使用する**。

- **Sol thread**：全体設計 → 待機 → Luna完了後の最終review → 必要時の限定remediation
- **Luna thread**：Sol設計を受領 → 実装 → trial-and-error → self-review → Solへ返却 → 必要時のvalidation

### 3.1 絶対条件

- SolとLunaを同じmissionで同時並行に走らせない
- 自動的にSolからLuna、LunaからSolへroleを切り替えない
- Sol threadが通常のLuna実装を代行しない
- Luna threadがSol設計を勝手に再設計しない
- 一方のphaseがhandoff可能な状態になってから、もう一方へ人間または司令塔が明示的に渡す
- 同じSol threadを、最初の設計とLuna完了後の最終reviewに再利用する

各phase開始時、最初の進行報告で次のいずれか一つを明示する。

Sol thread:

- `ROLE_LOCK: SOL_DESIGN`
- `ROLE_LOCK: SOL_FINAL_REVIEW`
- `ROLE_LOCK: SOL_REMEDIATION`

Luna thread:

- `ROLE_LOCK: LUNA_IMPLEMENTATION`
- `ROLE_LOCK: LUNA_VALIDATION`

同時に複数の`ROLE_LOCK`を有効にしない。

## 4. 役割

- **Producer**：製品方向、主目的、固定判断、正式人物identity、画像採否、公開可否を決定する
- **ChatGPT／司令塔**：要件整理、GitHub正本整備、Solへの設計依頼、Sol→Luna→Solのhandoff、結果評価、工程判断を担当する
- **Sol Design Lead／Final Reviewer**：全体設計を細かく固定し、Lunaが実装を終えた後は同じSol threadで最終reviewを行う
- **Luna Implementation Lead**：Sol設計を正本として実装し、自分でtrial-and-errorとself-reviewを行い、fixed HEAD／treeと証拠をSolへ返す
- **fresh Sol Auditor**：対象Versionの正本、Producer判断、risk level、release gateが独立監査を明示要求した場合だけ追加する。通常の2スレッドフローの必須3本目ではない
- Claude Code：明示された限定範囲だけの一時代行
- サブエージェント：限定調査、証拠収集、read-only review。最終製品判断を代行しない

詳細なphase手順は`docs/CODEX_TWO_THREAD_WORKFLOW.md`を正本とする。

## 5. Solの責任

### 5.1 SOL_DESIGN

Solは実装開始前に、Lunaが追加の設計推測をしなくてよい粒度までDesign Lockを作る。

最低限固定するもの：

- Design ID／revision
- baseline branch／HEAD／tree
- 一つの主目的とplayer-facing outcome
- current behavior／root causeまたは新機能の成立条件
- architecture、module責務、data／state／event／asset contract
- 変更予定fileと競合file
- non-goal／変更禁止範囲
- save、migration、PWA、Service Worker、audio、releaseへの影響境界
- acceptance criteria
- positive／negative test
- focused／full／browser／PWA／save等のvalidation plan
- PR分割、依存順、停止条件
- Lunaがtrial-and-errorしてよい範囲
- Luna Handoff

Design LockはIssue commentまたは指定MDへ固定する。チャット内だけに残して正本扱いしない。

`SOL_DESIGN`中は原則として製品実装codeを書かない。

### 5.2 SOL_FINAL_REVIEW

LunaのCompletion Packetを受領したら、同じSol threadを`ROLE_LOCK: SOL_FINAL_REVIEW`へ切り替える。

SolはLunaの説明をそのまま信用せず、live PR／HEAD／tree／diff／tests／runtime evidenceを自分で再確認する。

最低限確認するもの：

- 最新Design revisionへの適合
- acceptance criteria全件
- scope drift／non-goal侵害
- architecture／contract破壊
- testが実装の意味を検査しているか
- runtime／browser evidence
- save／PWA／release境界
- High／Medium／Low Finding

問題0ならAPPROVE。問題があれば`REMEDIATION_LOCAL`または`DESIGN_CHANGE_REQUIRED`へ分類する。

### 5.3 SOL_REMEDIATION

次をすべて満たすFindingだけ、Producer方針としてSol自身が限定修正してよい。

- Design Lock自体は変更不要
- player-facing仕様変更なし
- architecture再設計なし
- save／migration／PWA／Service Worker／release contractの新規再設計なし
- 原因と必要修正範囲が具体的に固定できる
- 既存acceptanceの達成のための修正である

この場合だけ`ROLE_LOCK: SOL_REMEDIATION`へ切り替え、Finding範囲だけcode／testを修正してよい。新機能、ついで修正、acceptance弱体化は禁止する。

Solがcodeを変更した場合、その新HEADを直後に自己APPROVEしない。Lunaへ渡し、`LUNA_VALIDATION`で回帰確認後、同じSol threadへ戻して最終read-only reviewを行う。

設計変更が必要なら`SOL_DESIGN`へ戻りDesign revisionを上げ、Lunaへ再handoffする。

## 6. Lunaの責任

### 6.1 LUNA_IMPLEMENTATION

Lunaは最新Design Lockを正本として実装する。

- Design revisionとbaselineを開始時に再取得
- feature／integration branch上でのみ変更
- acceptance criteriaを実装checklistへ1:1でmapping
- 小さいcheckpointで実装
- focused test／generator／static check
- 必要なChromium／WebKit runtime確認
- Design Lock内の問題は自分でtrial-and-errorして修正
- full test、Lint、build、content、`git diff --check`等を実行
- self-review
- 通常commit／push、Draft PR
- fixed HEAD／treeと証拠を記録
- Completion Packetを元のSol threadへ返す

Lunaは内部実装の細部について試行錯誤してよい。ただしDesignの仕様、acceptance、save／PWA契約、non-goalを勝手に変更しない。

### 6.2 Luna Self Review

LunaはCI greenだけで完了扱いにしない。

最低限確認するもの：

- Design acceptance全件への証拠mapping
- scope外変更0
- unexpected delete／rename／mode change 0
- positive／negative test
- runtime/browser evidence
- save／PWA／asset契約の対象回帰
- console／page／HTTP／request failure
- fixed HEAD／treeとlive PR一致
- unresolved risk／未確認境界

完了時は`READY_FOR_SOL_REVIEW`を含むCompletion Packetを返す。

### 6.3 DESIGN_DELTA_REQUIRED

実装中に仕様・architecture・contractの新判断が必要になったら、Lunaは勝手に決めない。安全なcheckpointで止め、Design revision、発見事実、影響acceptance、必要な最小設計判断をSolへ返す。

### 6.4 LUNA_VALIDATION

Solが`SOL_REMEDIATION`でcodeを変更した後に使用する。

Lunaは新設計をせず、Solの新HEADについてFinding解消、original Design acceptance、回帰test、runtime evidenceを確認し、`VALIDATION_PASS`または`VALIDATION_FAIL`をSolへ返す。

Lunaが最終APPROVEを宣言しない。最終判断は同じSol threadへ戻す。

## 7. 各threadが読むMD

### Sol thread必須

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_SOL_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. 対象Version／featureの実行台帳IssueまたはProducer Decisions
6. 関連spec、tests、QA、現行code

### Luna thread必須

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_LUNA_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. 対象Version／featureの実行台帳Issue
6. Solが固定した**最新Design Lock／Luna Handoff**
7. Handoff指定のspec、tests、QA、code

LunaはSol専用MDを自分の権限として使用しない。SolもLuna専用MDを通常実装権限として使用しない。

## 8. `/goal`運用

`/goal`は、複数工程・複数checkpoint・反復検証をまたいで同じ達成目標を保持する必要があるmissionで使用する。時間の長短だけで判定しない。

### 8.1 `/goal`を原則必須とするケース

- SolがVersion／featureの正式Design LockとLuna Handoffを作る
- Lunaが通常のfeature実装を行い、実装→test→browser QA→修正→再検証→PRまで進める
- 複数module／file／assetを横断する
- save／migration／PWA／Service Worker／audio／asset generation／release contractへ影響する
- generator、manifest、provenance、browser evidence等の複数証拠を揃える
- Finding remediationが複数checkpointをまたぐ
- integration／release mission

Solのdesign goalとLunaのimplementation goalは別々に設定する。別threadのgoalをそのまま引き継がない。

### 8.2 `/goal`不要の原子的作業

- read-onlyのSHA／PR／Issue／CI確認
- 単発test
- typo／link修正
- 設計判断を伴わない小さい単一file修正
- 一回のverificationで閉じる作業

途中でscopeが広がったら安全に止め、`/goal`へ切り替える。

### 8.3 Goal contract

各goalは最低限次を持つ。

1. Objective
2. Verifiable stopping condition
3. Required sources
4. Non-goals
5. Validation loop
6. Checkpoints
7. Pause／stop conditions

## 9. 標準順序

同じmissionでは、常に次の順で一方ずつ進める。

1. Producer／司令塔が主目的と製品境界を固定
2. **Sol thread**：`SOL_DESIGN`でDesign Lock作成
3. SolがLuna Handoffを固定し、Solは待機
4. **Luna thread**：`LUNA_IMPLEMENTATION`で実装、trial-and-error、self-review
5. Lunaがfixed HEAD／treeとCompletion Packetを作成し、Lunaは待機
6. **元のSol thread**：`SOL_FINAL_REVIEW`で最終review
7. 問題0ならAPPROVE
8. `REMEDIATION_LOCAL`ならSolが限定修正 → Lunaが`LUNA_VALIDATION` → 元のSolが再review
9. `DESIGN_CHANGE_REQUIRED`ならSolがDesign revision更新 → Lunaへ再handoff
10. 対象Versionが独立監査を明示要求する場合だけfresh Sol Auditorを追加
11. release gateを満たした場合だけmerge／tag／Release／Pagesへ進む

## 10. GitHub運用

- `main`はPR経由でのみ変更
- feature／integration branchへの通常pushのみ許可
- force push禁止
- 共有履歴のrebase・amend禁止
- PRのbase、head、CI、mergeabilityを操作直前に再取得
- merge後はhead SHAではなくmerge result SHAをrelease SHAとする
- tagとGitHub Releaseはrelease SHAへ固定
- 既存tagの移動・上書き禁止
- 状態変化のないcomment、空commit、重複文書を作らない
- 同じfileをSolとLunaで並行編集しない
- 旧Issueを削除・改変して現在の矛盾を隠さない

対象Versionでintegration branchが指定されている場合、工程branchをintegration向けPRとして段階統合できる。最終`integration/<version> → main`のReady化・mergeは、対象Version正本のrelease境界に従う。

## 11. 公開契約

正式deploymentは、明示的release requestまたは安全なmanual dispatchだけで実行する。

release requestは最低限次を持つ。

- `version`
- `release_ref`
- `release_sha`
- `issue_number`
- `request_id`

通常の`main` pushやdocs-only mergeで製品版を自動deploymentしない。

公開完了条件：

- production build成功
- static Pages build成功
- browser smoke成功
- Pages deploy成功
- 公開HTMLのversion／release SHA一致
- 匿名browser相当で認証要求・404なし
- 主要asset取得成功
- fresh saveと既存saveの必須導線成功
- 対象Issueへの公開後QA記録

Actions成功だけで一般公開成功と断定しない。

## 12. 画像・identity

- 個別Versionでidentity masterの提供者が指定された場合、その責任分界を優先する
- プロデューサー提供人物identityを別人物で置き換えない
- portraitから派生する場合、顔、髪、体格、衣装、武器、傷、配色を同一人物として維持する
- 最初の1体で基準確認が必要なら、確定前に残りを量産しない
- 未提出画像を仮人物で埋めて完成扱いにしない
- ライセンス不明素材を正式採用しない

## 13. 音声

ストーリー全文読み上げを実装しないことと、戦闘中character voiceを削除することを混同しない。既存の人間battle voice、weapon sound、enemy voiceは明示変更がない限り維持する。

新unitへ別人物voiceを流用しない。

## 14. Save・migration

- stable IDを維持する
- migration前snapshot、last-known-good、localStorage／IndexedDB、破損復旧、export／importを維持する
- migrationを複数回適用しない
- 同一receiptで二重取得させない
- save全体の自動初期化は禁止
- 限定migrationでも非対象dataを消さない
- 破壊的migration内容はplayerへ明示する

## 15. テスト・QA

テスト本数だけで完成としない。実ゲーム成立を確認する。

最低基準：

- 対象test、全test、Lint、build、`git diff --check`
- content validator、generator、必要なsimulation
- console error、page error、request failure、主要asset 404が0
- 1280×720、844×390、844×340
- Playwright WebKit iPhone相当
- touch、safe area、回転、tab・lock復帰
- BGM、SE、戦闘voice、二重再生なし
- fresh save、公開版由来既存save、migration、破損復旧
- 対象Versionの新機能を実ゲームで確認
- Luna self-review完了
- Sol Final ReviewでHigh／Medium未解消0
- 対象Versionがindependent auditを要求する場合のみ、その独立監査High／Medium未解消0

物理iPhoneを利用できない場合、発熱、実speaker聴感、物理端末操作を確認済みと断定しない。

## 16. 安全境界

禁止：

- `main`直接push
- force push、共有履歴rebase・amend
- 既存tag移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- save全体の自動初期化
- ライセンス不明素材の正式採用
- 未確認・失敗の成功報告
- 検証不能な巨大commit・巨大差分
- ChatGPT Sitesへの新規deployment
- 対象Versionの非対象機能を便乗実装
- Lunaによる未承認のscope再設計
- Solによる通常のLuna実装の代行
- SolとLunaを同一Design Lock上で無調整に同時並行実行
- Sol remediation後のLuna validationを省略して自己承認
- 同じSol threadのFinal Reviewを独立監査と誤記
- goal-managed missionを必要な`/goal`なしで開始

重大な公開不具合は、直前の正常release SHAを確認し、通常のrevert PRで復旧する。`main`のforce巻戻し、tag移動、Release履歴改変は禁止する。

## 17. 設計打ち切り

GitHub正本が承認済みで開始前提に変化がない場合、同じ要件について無目的な「最終計画書」を追加しない。

計画を変更できるのは、Producer判断の変更、実装・計測・QAで判明した重大事実、save・公開・法務・安全blockerがある場合だけとする。その場合も既存計画を全面再作成せず、Design revisionを上げて差分を固定する。
