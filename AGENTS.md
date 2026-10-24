# 西新世紀末物語 — 開発運用ルール

更新日：2026-10-20

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

### V1.0.0の現在の実行と製品品質

V1.0.0は`docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`、Issue #172、現行セッションのProducer指示を優先する。2026-10-03の指示により、作品全体の概念、30作品以上の具体的な研究と反映、視覚に入る全要素、開発運用を再評価する。旧候補の技術合格を今回の製品品質受入に転用しない。

- Producerが一気通貫の自律実行を指示したmissionでは、親担当が実装・検証を所有し、許可されたsubagentは限定調査とread-only reviewを担当する。下記の固定Sol/Lunaモデル名・逐次handoffを理由に通常技術判断や修正を停止しない。同じfileのwriterは一人とし、自分の変更を独立review済みと記録しない。
- 人物identity、正史、stable ID、save保全、最終承認と公開境界は固定条件。画面の箱の分け方、数値、algorithm、技術方式、検証fixture、作業順は、Producerが固定していない限り検証可能な仮説として扱う。現行実装を根拠に製品判断を逆算しない。
- 改善の単位はplayerの体験とする。`編成・支出 → 出撃と判断 → 攻撃・被弾の反応 → 結果と報酬 → 育成・再挑戦`のどこをどう良くするか、現在の具体的な不足と実装後の確認を既存台帳へ結び付ける。
- 作品調査は本数だけで完了にしない。参照した一次資料の具体的な場面・仕組み、狙い、本作へ採用する／しない理由、対応する実装と確認結果を記録する。画像や紹介文で未観測の戦闘・経済・音・動きを確認済みとしない。
- 視覚品質はタイトル、物語、編成、育成、戦場、結果、設定、復旧等の全導線を対象とし、背景・人物・敵・拠点・車両・小物・文字・icon・animation・VFXの整合、注目点、操作状態、世界観をスマートフォン横画面で確認する。幾何・pixel・asset取得の合格だけで美術の完成を断定しない。
- 全30 Stageの進行は開発者modeで確認し、通常操作は代表場面で検証する。AIが各Stageを攻略することを工程の前提にしない。Lv30等の強化fixtureは成立確認、実際に獲得可能な編成・育成・支出のfixtureは難易度・経済確認として区別する。
- CI・不具合検証、作品品質の評価、Producerの最終実プレイ受入を分ける。High/Medium未解消0やtest本数から面白さ・販売価値・人間100%制作を断定しない。既存の閾値、旧save保全、物理端末とbrowser代替証拠の区別、公開前承認は維持する。
- 状態変化や具体的な未解消のリスクに必要な検証だけを実行する。既存証拠と元の失敗を保全し、変更が適用されない範囲はsource bindingで再利用する。改善のない再監査、空commit、同じ報告、新しい最終計画書、無関係な基盤再設計を増やさない。

## 2. 正しい情報源

- 公開中正式コード：annotated tag／GitHub Releaseが指すrelease SHA
- `main` HEAD：開発・docs-only更新により公開release SHAより先へ進むことがある。現在値はGitHubから再取得する
- 作業中コード：指定feature／integration branch
- 正式公開版：GitHub Pagesで配信中のrelease SHA
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 現在状態：`docs/PROJECT_STATE.md`
- 長期方向：`docs/PRODUCT_ROADMAP.md`
- 公開・復元：`docs/RELEASE_BACKUP_RECOVERY.md`
- runtime asset／authoring master policy：`docs/ASSET_STORAGE_POLICY.md`
- 2スレッド実行手順：`docs/CODEX_TWO_THREAD_WORKFLOW.md`
- Sol専用規約：`docs/CODEX_SOL_ROLE.md`
- Luna専用規約：`docs/CODEX_LUNA_ROLE.md`
- 実行ログ・承認・QA：対象IssueとPR
- 実環境固有挙動：最新の実ブラウザQA

作業開始時、PR操作直前、merge直前、tag作成直前、公開後にGitHubの現在値を再取得する。文書記載SHAや過去報告を永久に最新として扱わない。

ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、障害復旧に使用しない。

## 3. 実行・確認

現行のProducer Decisions、実行台帳とユーザーの追加指示を親担当が実装から検証まで所有する。通常の技術修正・QA修正に途中承認や固定モデル名の引き継ぎを求めない。必要な独立read-only reviewは限定した差分で行い、自己reviewを独立reviewと呼ばない。

変更箇所と共有処理の影響範囲を先に検証する。未変更の範囲は依存するコード・素材・設定・環境を明記して既存証拠を再利用できる。Draftの対象検証は全体受入ではなく、最終統合候補で全体回帰・作品品質・必要な実機確認を行う。

全30面の進行・保存は開発者mode、通常操作は代表場面で確認する。AIの敗北は勝利へ置き換えず観測として残し、例外・入力不能・保存や証拠の取得失敗は技術的失敗として扱う。未採用の音声研究は製品回帰から分け、実機の保存録画によるBGM・SE確認を維持する。

Version 1.0.0のDesign Lock、旧Sol/Luna規約と引き継ぎ文書は履歴であり、現在の通常修正を止める承認・revision・役割往復の根拠にしない。新しい計画書を追加せず、結果と残件を既存Issueへ記録する。

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

`AshfallGame.tsx`は将来のfeatureが触る責務だけを、before/after contract testでrisk低減を示せる場合に限って局所抽出する。先行した全面refactorは禁止し、hardeningやfeatureを成立させるために広範な抽出が必要になった場合は停止してDesign revisionを要求する。

## 11. 公開契約

正式deploymentは、明示的release requestまたは安全なmanual dispatchだけで実行する。

release requestは最低限次を持つ。

- `operation`（`release`または`redeploy`）
- `deploy`（boolean）
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
