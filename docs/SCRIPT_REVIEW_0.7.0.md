# 西新世紀末物語 — Version 0.7.0 送信前レビュー

更新日：2026-07-17
状態：製品判断ロック済み／Codex実装開始可能

## 1. 判定

Codexへ一気通貫ミッションとして送信可能。

文書だけでは完成扱いにしない。実装、画像承認、段階レビュー、QA、GitHub Pages正式公開、匿名アクセス確認、公開後QAまでがミッション範囲。

## 2. 実行入口

開始時に読むのは次の2点だけ。

1. `docs/PRODUCER_DECISIONS_0.7.0.md`
2. `docs/IMPLEMENTATION_DIRECTIVE_0.7.0.md`

Issue #37を唯一のタスク台帳とする。詳細資料は該当フェーズで必要な箇所だけ読み、旧コメントと旧稿を探索しない。

## 3. 製品判断

未決定：0件。

確定：

- 大衆居酒屋「くまや」
- 無言のプレイヤー指揮官
- ナオ、いくらちゃん、レイダー
- 初期所有6名と加入・調達条件
- 最大7枠、3プリセット、同一人物複数召喚
- ガンテツ配置コスト48、高HP・低攻撃
- ナオ低コスト単体ヒーラー、コスト35基準・32〜38許容
- クレイジーキング近接範囲殲滅
- レイダー同一レーン直線範囲制圧
- タタラ対装甲・対拠点
- コスト上限150基準・140〜160許容
- 手動戦術機能の完全撤去
- TAKUYA撃破後を含む味方AI修正
- Stage 1・4救助自動成立
- 新敵3種、改札喰い、Stage 4〜6
- キャラクターボイスなし
- スマートフォン最優先
- 物理iPhone利用不能時はWebKit正式代替ゲートを使用可能
- private repositoryのまま匿名公開不能時はvisibilityを変更せず停止・報告

## 4. Codexの裁量

固定済み製品判断と安全境界を維持する限り、Codexは次を確認なしで自律決定できる。

- 内部アーキテクチャ、モジュール分割、型、関数、データ構造
- AI、save、描画、音響、アセットpipelineの具体的方式
- 技術的に同等または高品質な代替実装
- テスト方法、seed、fixture、simulation、証拠形式
- 非依存タスクの並行順、フェーズ内作業順
- 許容範囲内の数値調整
- 限定refactor、性能改善、アクセシビリティ改善
- connector、`gh`、通常gitの安全な代替利用

確認が必要なのは、固定製品判断変更、許容範囲外数値、一枚画像承認、visibility・課金・secrets・外部契約・法務、不可逆操作、匿名公開不能時に限る。

## 5. アート

- Codexがデザイン、生成、加工、実装を担当
- 保全対象：パイセン、クマバーソン、ババヤガ、クレイジーキング
- 全面再設計：ハチ、ミズチ、ナオ、タタラ、レイダー、ガンテツ、モンキー、いくらちゃん
- フォトリアル、実写風、AI量産顔、流用、色替えだけの別人化は禁止
- 新規画像は一枚ごとの明示承認制
- 基準画像承認後はidentity lock
- 派生画像は元画像との比較証拠が必須
- 個別画像承認だけで合格にせず、実ゲーム統合品質を確認
- 承認待ち中も画像非依存作業を継続

## 6. 戦闘

公開阻害：

- 敵を無視して前進
- 接触中の敵を通過
- 表示とhitboxの不一致
- TAKUYA撃破後に残存・後続敵を再索敵しない
- 手動戦術UI・入力・stateの残存

Stage 1〜3、全ユニット種、全3レーン、TAKUYA撃破直後を純粋ロジック、反復simulation、実ブラウザで検証する。

## 7. save

- schema v5
- v2〜v4 migration
- localStorageとIndexedDBの独立検証
- 一方破損時の復旧
- 両方破損時の回復画面
- 手動backup、破損データ書出し、完全初期化
- 既存所有・進行・星・報酬を失わない
- 星、報酬、加入を二重適用しない

## 8. 公開経路と権限

唯一の正式公開先：GitHub Pages。

正式URL：`https://susano-ooo.github.io/Zombieee/`

ChatGPT Sitesは旧公開先。新規deployment、QA、正式判定に使わない。

公開前ゲート通過後、CodexはPR #38 Ready化、PR経由の通常merge、release SHA確定、`v0.7.0` annotated tag、GitHub Release、GitHub Pages deployment、匿名アクセス確認、公開後QA、Issue #37 close、branch削除まで実行できる。

force push、`main`直接push、rebase／amend、tag移動、repository visibility変更は禁止。

## 9. 公開前ゲート

- P0〜P7完了
- R1〜R4 High／Medium未解消0
- 全画像個別承認、identity lock、統合品質確認済み
- Stage 1〜6実プレイ可能
- build、test、Lint、diff check、CI成功
- console error、asset 404、参照切れ0
- migration・破損復旧成功
- 手動戦術残存0
- 敵素通り0
- 844×390、844×340、WebKit iPhone相当profile、touch、safe area、回転受入
- GitHub Pages匿名公開見込み確認

## 10. 実機と匿名公開

物理iPhoneまたは実機クラウドが利用可能なら確認する。

利用不能な場合は、844×390、844×340、WebKit iPhone相当profile、touch、safe area、回転、画面ロック・復帰、タブ復帰の全成功を正式代替ゲートとする。物理実機未確認と証拠を最終報告へ明記して完了できる。

private repositoryのままGitHub Pagesを匿名公開できない場合、Codexはrepository visibilityを変更しない。Issue #37をopenのまま、原因、証拠、安全な選択肢を報告して停止する。

## 11. 結論

実行動線、製品判断、技術裁量、画像承認、QA、正式公開、匿名アクセス、rollbackの責任範囲は固定済み。

Codexは正本2点から開始し、Issue #37を台帳として自律実装する。追加のプロデューサー判断は現時点で不要。画像承認と明示された停止条件以外では逐次質問せず、公開可能な場合はGitHub Pages正式公開まで連続実行する。
