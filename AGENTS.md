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

Version 0.9.9.0はIssue #136を実行正本として正式公開・close済みであり、以後の新規実装の実行権限として再利用しない。次Versionは、Producerが主目的を固定し、新しい実行台帳IssueまたはProducer Decisionsを作成してから設計へ入る。

製品判断はProducer Decisions、実行台帳は対象Issue、恒久安全境界は本書が所有する。過去コメント、旧PR、旧ロードマップ、会話上の検討案が現行正本と衝突する場合は採用しない。

## 2. 正しい情報源

- 正式コード：GitHub `main`上のrelease SHA
- 作業中コード：指定feature／integration branch
- 正式公開版：GitHub Pagesで配信中のrelease SHA
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 現在状態：`docs/PROJECT_STATE.md`
- 長期方向：`docs/PRODUCT_ROADMAP.md`
- 公開・復元：`docs/RELEASE_BACKUP_RECOVERY.md`
- 実行ログ・承認・QA：対象IssueとPR
- 実環境固有挙動：最新の実ブラウザQA

作業開始時、PR操作直前、merge直前、tag作成直前、公開後にGitHubの現在値を再取得する。文書記載SHAや過去報告を永久に最新として扱わない。

ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、障害復旧に使用しない。

## 3. 役割と実装分業

- プロデューサー：製品方向、主目的、固定判断、正式人物identity、画像採否、公開可否を決定する。
- ChatGPT：要件整理、GitHub正本整備、Solへの設計依頼、Lunaへの実装引き渡し、監査結果評価、工程判断を担当する。
- **Sol Design Lead**：実装前の設計担当。現行コード、対象Issue、既存contract、save／PWA／release境界を調査し、実装方式、責務、data contract、変更file範囲、non-goal、受入条件、test／QA、PR分割を固定する。原則として製品実装コードを書かない。
- **Luna Implementation Lead**：Solが固定した設計を正本として実装する。コード、asset、test、QA、通常commit／push、Draft PRを担当し、設計外のscopeを独自追加しない。
- **Sol Auditor**：Design Leadとは別の新規コンテキストで固定HEADをread-only監査する。設計担当Sol自身による自己監査を最終独立監査として扱わない。
- Claude Code：明示された限定範囲だけの一時代行。
- サブエージェント：限定調査、証拠収集、read-only review。最終製品判断を代行しない。

### 3.1 Sol Design Leadの完了条件

Solは実装を開始する前に、最低限次を確定する。

- baseline branch／HEAD／tree
- 一つの主目的とplayer-facing outcome
- non-goalと変更禁止範囲
- root causeまたは新機能の成立条件
- module／data／asset／stateの責務分離
- 変更予定fileと競合しやすいfile
- save、migration、PWA、Service Worker、audio、releaseへの影響境界
- acceptance criteria
- focused／full／browser／PWA／save等の必要testと証拠
- PR分割、依存順、停止条件
- Lunaへ渡すimplementation handoff

設計の完了は「説明を書いた」ことではなく、Lunaが追加の設計推測をせず実装へ入れる状態をいう。未解決の製品判断やarchitecture矛盾が残る場合、Solは実装へ渡さずblockerとして明示する。

### 3.2 Luna Implementation Leadの完了条件

LunaはSol設計を読み、指定scopeだけを実装する。

- 設計正本とbaselineを開始時に再取得
- feature／integration branch上でのみ変更
- acceptance criteriaに対応するtestを実装または更新
- 実ブラウザを含む必要QAを実行
- generator／manifest／asset provenance等の対象契約を更新
- full test、Lint、build、`git diff --check`等を通す
- commit／push後の固定HEAD／treeを記録
- PR本文へ変更内容、非変更範囲、検証、残存リスクを記録
- 独立Sol Auditorへ渡せる証拠を揃える

実装中に設計の重大な欠落、矛盾、scope変更が必要と判明した場合、Lunaは独自に再設計して進めない。作業を安全なcheckpointで止め、Solへ設計差分を返す。軽微な内部実装詳細は既存設計と安全境界の範囲で自律決定できる。

## 4. `/goal`運用

`/goal`は、**複数工程・複数checkpoint・反復検証をまたいで、同じ達成目標を継続して追う必要があるミッション**で使用する。時間の長短だけで判定しない。

### 4.1 `/goal`を必須とするケース

次のいずれかに該当する場合、通常promptだけで開始せず、担当スレッドで`/goal`を設定する。

- Solが対象Version／feature／PRの実装正本となる設計とLuna handoffを作る
- Lunaが実装→test→browser QA→修正→再検証→commit／push／PRのように複数checkpointをまたぐ
- 複数module／複数file／複数assetを横断する
- save／migration／PWA／Service Worker／audio／asset generation／release contractへ影響する
- generator、manifest、provenance、browser evidence等の複数証拠を揃える必要がある
- independent audit Findingを修正し、再監査可能なfixed HEADまで持っていく
- integration／main merge、tag、Release、Pages、Public QAまでを一つの承認済みrelease missionとして扱う
- 作業中に複数回の判断・再試行・follow-upが発生する可能性が高い

Sol Design LeadとLuna Implementation Leadが同一Versionで`/goal`を使う場合、**設計goalと実装goalは必ず分離**する。担当変更時にgoalをそのまま引き継がず、新担当が自分の責務に合わせて設定する。

### 4.2 `/goal`を不要とするケース

次のような原子的な作業は、通常promptで処理してよい。

- read-onlyの状態確認、SHA／PR／Issue／CIの確認
- 一つの質問へのコード調査・説明
- 一回のcommand／testだけで完了判定できる確認
- typo、表記修正、リンク修正等の小さなdocs修正
- 明確に限定された単一fileの小修正で、設計判断・migration・asset生成・browser QA・release操作を伴わず、直後の一回の検証で完了できるもの
- 既に固定された設計に対する、独立監査が要求した極小の機械的修正で、新たな設計判断を必要としないもの

原子的な作業でも、途中でscopeが広がり複数checkpointを必要とすると判明した時点で、作業を安全な状態で止め、`/goal`を設定してgoal-managed missionへ切り替える。

迷う場合は`/goal`を使う。不要なgoalを作るコストより、複数工程の途中で目的・停止条件・証拠が漂流するリスクを優先して避ける。

### 4.3 Goal contract

各`/goal`は最低限次を含む。

1. **Objective**：一つの達成対象
2. **Verifiable stopping condition**：何を確認できれば完了か
3. **Required sources**：最初に読むIssue、MD、branch、HEAD、tests、証拠
4. **Non-goals**：変更してはいけない範囲
5. **Validation loop**：進捗を証明するcommand、test、browser QA、artifact
6. **Checkpoints**：途中で何を固定して次へ進むか
7. **Pause／stop conditions**：権限不足、仕様矛盾、High／Medium回帰、外部承認待ち等

goalは「全部よくする」のようなopen-ended backlogにしない。対象Versionの一つの主目的に対応させる。

進行報告は簡潔に、`current checkpoint / verified / remaining / blocked`を示す。状態変化のない長文報告を繰り返さない。

`/goal`が利用できない環境では、goal必須条件に該当するmissionを通常promptへ黙って代替して開始しない。利用不可をtooling blockerとして報告し、Producerまたは司令塔が運用変更を明示するまで開始しない。原子的な作業は4.2の条件を満たす限り通常promptで継続できる。

### 4.4 Design goalの標準停止条件

Solのdesign goalは、次を満たした時点で完了とする。

- 実装正本となる設計がIssueまたは指定MDへ固定済み
- baseline／scope／non-goal／acceptance／tests／stop conditionsが明確
- Luna handoffが作成済み
- 未解決の重大設計事項が0、またはblockerとして明示済み
- 製品実装コードを開始していない

### 4.5 Implementation goalの標準停止条件

Lunaのimplementation goalは、対象工程について次を満たした時点で完了とする。

- Sol設計のacceptance criteriaを実装
- 必須test／build／QAが成功
- 意図しないscope変更がない
- fixed HEAD／treeと証拠が記録済み
- Draft PRが独立監査可能な状態

merge、tag、Release、Pages公開を同じgoalに含める場合は、対象Version正本がその操作を明示許可し、release gateと停止条件がgoal内に書かれている場合だけ許可する。

## 5. 作業開始

開始時に最低限確認する。

- repository、remote、branch、HEAD
- `main`の最新SHA
- working treeと未追跡file
- open PR、対象Issue
- tag、GitHub Release、Actions
- 正式URLのrelease metadata
- push、PR、Issue、Release、Actions権限
- baseline test、Lint、build、`git diff --check`
- 対象Version正本と旧文書の衝突
- 担当role
- 4.1に該当する場合、そのrole用`/goal`が設定済みか

既存未commit・未追跡変更を削除、reset、上書きしない。安全な別cloneまたは隔離worktreeを使用できる。

## 6. GitHub運用

- `main`はPR経由でのみ変更
- feature／integration branchへの通常pushのみ許可
- force push禁止
- 共有履歴のrebase・amend禁止
- PRのbase、head、CI、mergeabilityを操作直前に再取得
- merge後はhead SHAではなくmerge result SHAをrelease SHAとする
- tagとGitHub Releaseはrelease SHAへ固定
- 既存tagの移動・上書き禁止
- 状態変化のないcomment、空commit、重複文書を作らない
- 同じfileを複数agentで無調整に並行編集しない
- 旧Issueを削除・改変して現在の矛盾を隠さない
- 完了済み旧Issueをcloseする場合、後続実装・正本への移行先と完了根拠を最終commentへ残す

対象Versionでintegration branchが指定されている場合、工程branchをintegration向けPRとして段階統合できる。最終`integration/<version> → main`のReady化・mergeは、対象Version正本のrelease境界に従う。

## 7. 公開契約

正式deploymentは、明示的release requestまたは安全なmanual dispatchだけで実行する。

release requestは最低限次を持つ。

- `version`
- `release_ref`
- `release_sha`
- `issue_number`
- `request_id`

通常の`main` pushやdocs-only mergeで製品版を自動deploymentしない。PR段階のbuild、browser smoke、release contract検証は維持する。

`.github/pages-release-request.json`を状態文書の更新だけを理由に変更しない。変更によるdeployment triggerを理解せず触れない。

公開完了条件：

- production build成功
- static Pages build成功
- browser smoke成功
- Pages deploy成功
- 公開HTMLのversion／release SHAがrequestと一致
- 匿名browser相当で認証要求・404なし
- 主要asset取得成功
- fresh saveと既存saveの必須導線成功
- 対象Issueへの公開後QA記録

Actions成功だけで一般公開成功と断定しない。

## 8. 一気通貫ミッション

対象Issue、正本、公開先、停止条件、許可操作が明示されている場合、複数roleを連携して一つのVersion missionを完了できる。ただし**Sol設計とLuna実装の責務分離を省略しない。4.1に該当する各工程は、それぞれ独立した`/goal`を使用する**。

標準順序：

1. Producerが主目的と製品境界を固定
2. Sol Design Leadが設計goalを完了
3. Luna Implementation Leadが実装goalを完了
4. 別コンテキストのSol Auditorがfixed HEADをread-only review
5. FindingがあればLunaへ限定修正、設計変更が必要ならSolへ戻す
6. 対象Version正本のrelease gateを満たした場合だけmerge／tag／Release／Pagesへ進む

許可済みscopeでは、調査、設計、実装、対象文書・asset、test、Lint、build、実browser QA、不具合修正、通常commit・push、Draft PR、integration merge、独立review、承認済みrelease操作、公開後QA、Issue closeまで段階実行できる。

使用上限や時間切れで中断する場合は、完了工程、現在SHA、未完了項目、正確な再開位置、現在のgoal状態を対象Issueへ記録する。依存変更がない完了工程を最初からやり直さない。

## 9. 画像・identity

- 個別Versionでidentity masterの提供者が指定された場合、その責任分界を優先する
- プロデューサー提供の人物identity masterを、Codexが独自生成した別人物で置き換えない
- portraitからcard、event、battle sprite等を派生する場合、顔、髪、体格、衣装、武器、傷、配色を同一人物として維持する
- 最初の1体で派生基準を確認するよう指定されている場合、基準確定前に残りを量産しない
- 画像確認待ち中も、画像非依存のfoundation、save、AI、data、test、performance作業を継続する
- 未提出画像を仮人物で埋めて完成扱いにしない
- ライセンス不明素材を正式採用しない

## 10. 音声

ストーリー会話の全文読み上げを実装しないことと、戦闘中character voiceを削除することを混同しない。出撃、攻撃、被弾、戦闘不能の人間character voice、weapon sound、enemy voiceは明示変更がない限り維持する。

新unitへ別人物のvoiceを流用しない。正式voiceが未用意の場合は、対象Version正本に従ってtext bark、weapon sound、無voiceの状態を明示し、別人物voiceで穴埋めしない。

## 11. Save・migration

- stable IDを維持する
- migration前snapshot、last-known-good、localStorage／IndexedDB、破損復旧、export／importを維持する
- migrationを複数回適用しない
- 星、報酬、解放、通貨、equipmentを同一receiptで二重取得させない
- save全体の自動初期化は禁止
- 個別Version正本が通貨残高等の限定的再編を明示承認している場合、その対象だけを一度限りのmigrationとして実施できる
- 限定再編でも所有unit、stage進行、星、既読、編成、設定等の非対象dataを消さない
- 破壊的migration内容はplayerへ明示する

## 12. テスト・QA

テスト本数だけで完成としない。実ゲームの成立を確認する。

最低基準：

- 対象test、全test、Lint、build、`git diff --check`
- content validator、generator、必要なbalance／economy simulation
- console error、page error、request failure、主要asset 404が0
- 1280×720、844×390、844×340
- Playwright WebKit iPhone相当
- touch、safe area、回転、tab・画面lock復帰
- BGM、SE、戦闘voice、二重再生なし
- fresh save、公開版由来既存save、migration、破損復旧
- 対象Versionの新機能を実ゲームで確認
- independent read-only review High／Medium未解消0

物理iPhoneを利用できない場合、発熱、実speaker聴感、物理端末操作を確認済みと断定しない。frame time、memory、WebKit結果を代替証拠として明記する。

## 13. 安全境界

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
- Design Lead Solによる自己実装を標準運用化すること
- Design Lead Sol自身のreviewを最終独立監査として扱うこと
- 4.1のgoal-managed missionを`/goal`なしで開始すること

重大な公開不具合は、直前の正常release SHAを確認し、通常のrevert PRで復旧する。`main`のforce巻戻し、tag移動、Release履歴改変は禁止する。

## 14. 設計打ち切り

GitHub正本が承認済みで、開始前提に変化がない場合、同じ要件について新しい「最終計画書」を追加しない。実装を伴わない再監査、状態変化のない追加review、完了工程の無目的な再読込を禁止する。

計画を変更できるのは、プロデューサー判断の変更、実装・計測・QAで判明した重大事実、save・公開・法務・安全blockerがある場合だけとする。その場合も既存計画を全面再作成せず、対象Issueへ差分を記録し、必要ならSolのdesign goalを更新または再設定してからLunaへ戻す。
