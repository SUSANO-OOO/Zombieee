# 西新世紀末物語 — Version 0.7.1／0.7.5 最終実行ロック

更新日：2026-07-19  
状態：**最終承認済み・Codex一括実行可能**

## 1. この文書の役割

本書は、`docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`に対する最後の実行補足である。

- `docs/PRODUCER_DECISIONS_0.7.5.md`の製品判断は変更しない
- 実行順、branch／PR運用、性能ゲート、量産基盤の実証、育成範囲について、本書が最新の確定手順となる
- 既存ランブックと実行手順が衝突する場合、**実行手順に限り本書を優先する**
- 本書のmain反映後は、製品判断変更または実装中に判明した事実上の重大blockerがない限り、開始前の追加設計レビュー、追加ロードマップ作成、追加指示書作成を行わない
- 技術的な曖昧さはCodexが裁量内で解決し、再び計画会議へ戻さない

最上位の参照順：

1. `docs/PRODUCER_DECISIONS_0.7.5.md`
2. 本書
3. `docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`
4. Issue #43
5. Issue #44
6. 工程別の実装・QA記録

## 2. 最終実行順

Codexは一度の開始依頼で、次を順番に実行する。

1. **R0：公開運用preflight**
2. **Version 0.7.1：Stage 5 hotfix**
3. **Version 0.7.1正式公開・公開後QA**
4. **Version 0.7.5：量産基盤・戦闘品質再構築**
5. **基準デザイン3点確認**
6. **0.7.5 release candidate完成**
7. **プロデューサー最終実プレイ受入で停止**
8. 合格後の別明示承認で0.7.5正式公開

0.7.1公開後、追加開始指示を待たず0.7.5へ継続する。

# R0 — 公開運用preflight

Stage 5のコード変更より先に、公開運用を安全な小規模ops PRで修正する。

## R0.1 現在公開状態の確認

- GitHubの最新`main`、tag、Release、open PR、workflow状態を再取得
- 正式URL `https://susano-ooo.github.io/Zombieee/` の公開HTMLからrelease metadataを取得
- 公開中のゲームが正式なVersion 0.7.0 release SHA `782c70351a8fe22ca4ca0daa926c31c83433653a`と一致するか確認
- 文書PRのmergeによって別SHAがdeployされていた場合、ゲームコード、tag、Releaseを変更せず、immutable Version 0.7.0を再deployして復旧
- Actions成功だけで復旧済みとせず、匿名ブラウザ相当で正式URLを確認

## R0.2 release contractの汎用化

release requestは最低限次を持つ。

- `version`
- `release_ref`
- `release_sha`
- `issue_number`
- `request_id`

固定値を撤廃する。

- public QA内の`0.7.0`直書き
- public QA内のIssue #37直書き
- 固定release SHAへの暗黙依存

正式deployは、明示的なrelease requestまたは安全なmanual dispatchだけで実行する。

- docs-onlyの`main` mergeで製品版を自動deployしない
- PR段階のbuild、browser smoke、契約検証は維持
- 既存tagを移動しない
- immutable release再公開能力は維持してよい
- workflow、request、public QAの契約テストを追加

## R0.3 完了条件

- ops専用branchとPR
- CI、Lint、test、diff check成功
- 独立read-onlyレビューHigh／Medium未解消0
- 通常merge
- 正式URLがVersion 0.7.0 release SHAを配信
- Issue #43へ結果と再開位置を記録

R0完了後にStage 5へ進む。0.7.5のB0では同じ汎用化を再実施せず、契約が維持されていることだけ確認する。

# Version 0.7.1 — Stage 5 hotfix

Stage 5については既存のProducer Decisions、Issue #43、Implementation Directiveに従う。

追加で固定すること：

- 0.7.5の戦闘基盤、レーン撤廃、育成、画像刷新をhotfixへ混在させない
- stable ID、save、星、報酬、既読、Stage 6解放を維持
- 3種類以上の異なる編成で通常クリア
- 調達ユニットなしで本筋進行可能
- Stage 4 → Stage 5 → Stage 6を通常導線で実ブラウザ確認
- 公開版でもStage 5クリアとStage 6解放を確認

全ゲート通過後、Issue #43の既承認範囲でVersion 0.7.1を正式公開し、そのまま0.7.5へ進む。

# Version 0.7.5 — branch／PR契約

## 1. branch構造

標準構造：

```text
main
└─ integration/0.7.5
   ├─ feat/0.7.5-content-pipeline
   ├─ feat/0.7.5-battle-space
   ├─ feat/0.7.5-ai-missions
   ├─ feat/0.7.5-progression
   └─ feat/0.7.5-visual-performance
```

名称は同等に明確なら変更できる。

## 2. merge権限

- 工程branchのPR baseは`integration/0.7.5`
- 対象test、全体回帰、CI、独立reviewが合格した工程PRは、Codexがintegration branchへ通常mergeできる
- integrationへのmergeは正式リリースではない
- 各工程merge SHAをIssue #44へ記録
- `integration/0.7.5 → main`の最終PRだけは、release candidate最終実プレイ合格後の明示承認までmergeしない
- `main`直接push、force push、rebase、amendは禁止
- 同じファイルを複数工程branchで無調整に並行編集しない

## 3. 作業単位

工程は少なくとも次へ分ける。

1. repository audit／migration design
2. content pipeline／generator／validator
3. battle space／placement／spawn
4. AI／missions／Stage 1〜6 migration
5. progression／economy／UI
6. portraits／scale／animation／VFX
7. event foundation
8. mobile performance
9. save migration／integration QA

一つの巨大commitにまとめない。各工程は単独で再開・rollback可能にする。

# 量産基盤の実証契約

100ユニット、100敵、100ステージ相当の合成試験だけで完成扱いにしない。

B2の出口ゲートとして、productionへ配信しないfixtureで次をgeneratorから作成する。

- テスト用ユニット1体
- テスト用敵1体
- テスト用ステージ1つ

必須確認：

- generatorに`--dry-run`または同等の非破壊確認がある
- 同じ入力から同じ成果物を生成する
- 再実行で不要な差分を作らない
- schema検証に合格
- ID重複を検出
- 必須アセット不足を正しく報告
- registry／loaderへ定型手順で登録
- core runtimeへ対象固有コードを追加しない
- buildと対象testが成功
- localhostまたはQA galleryで確認可能
- fixture除去後にproduction差分を残さない

この追加ドリルが成功して初めて「量産基盤が実際に使える」と判定する。

# 育成システムの範囲ロック

0.7.5の育成は、量産基盤とゲームループを証明する**minimum viable progression vertical slice**に限定する。

必須：

- 全11ユニットが同じ共通基盤から強化可能
- キャップを消費
- 数段階の成長
- 役割を壊さない少数の節目効果
- 後発ユニットの追いつき措置
- stable IDで保存
- migration
- 経済シミュレーション
- 誤投資で本編進行不能にしない

0.7.5では実装しない：

- 大規模スキルツリー
- 一人あたり多数の固有能力
- 装備在庫と装備厳選
- レアリティ
- ガチャ
- 覚醒
- 限界突破
- 複雑なrespec／返還経済

レベル制、Rank制、併用、段階数、価格曲線はCodexが決定できる。ただし上記vertical sliceを越えて育成だけを大型化しない。

# スマートフォン性能budget

B3の本実装へ入る前に、Version 0.7.1公開版と同一QA環境でbaselineを取得し、Issue #44へ性能budgetを記録する。

第一目標：

- 60Hz相当環境では通常戦闘のmedian 50fps以上
- p95 frame time 33ms以下
- warm-up後から15分終了時まで、median frame timeの継続悪化10%以内
- warm-up後から15分終了時まで、JS heapまたは取得可能な代替memory指標の増加25%以内
- 操作不能を招く100ms超long taskが連続しない
- background中は戦闘simulation、描画、不要audio更新を停止
- 復帰後にgame loop、BGM、SE、voiceを二重化しない
- browser自動reload、進行消失、入力不能0

環境制約で絶対値が測定不能な場合：

- 同一環境before／after比較
- frame time分布
- long task
- memory proxy
- 描画・AI更新回数

を代替証拠とする。

性能budgetは実装前に固定し、結果を見て説明なく緩和しない。達成不能な場合は、原因、計測限界、代替値をIssue #44へ記録する。

物理iPhoneを利用できない場合、発熱確認済みと断定しない。

# 最終停止条件

Codexが停止してプロデューサー確認を求めるのは次だけ。

1. いくらちゃん、CRAWLER、敵拠点の基準デザイン3点
2. 0.7.5 release candidateの最終実プレイ受入
3. stable ID変更が不可避
4. 既存saveを安全にmigrationできない
5. 固定製品判断を変更する必要がある
6. repository設定、課金、secrets、外部契約、法務・ライセンス判断が必要
7. 大量削除、履歴破壊、force操作など不可逆な変更が必要
8. 公開後の重大不具合

それ以外はCodexが技術判断して続行する。

# 設計打ち切りと変更管理

本書がmainへ反映された時点で、開始前設計を完了とする。

以後、次は禁止する。

- 同じ要件に対する新しい「最終」計画書の追加
- 実装を伴わない再監査の反復
- 状態変化のない追加レビュー
- 技術方式の選択を理由としたプロデューサーへの逐次質問
- 完了済み工程の無目的な最初からの再読込

変更できるのは次の場合だけ。

- プロデューサーが製品判断を変更した
- 実装中の計測・コード・QAで新しい重大事実が判明した
- セーブ、公開、法務、安全に関わるblockerが判明した

その場合も、既存計画を全面再作成せず、対象工程のIssueへ差分だけを記録する。

# Codexへ渡す開始文

本書main反映後、Codexへ送る文章は次だけとする。

> GitHubリポジトリ`SUSANO-OOO/Zombieee`の`main`にある`docs/PRODUCER_DECISIONS_0.7.5.md`、`docs/EXECUTION_LOCK_0.7.5.md`、`docs/IMPLEMENTATION_DIRECTIVE_0.7.5.md`、Issue #43、Issue #44を正本として、一気通貫ミッションを開始してください。最初にGitHubとローカルの現在状態を再取得し、`EXECUTION_LOCK_0.7.5.md`のR0公開運用preflightから進めてください。Version 0.7.1公開後は追加指示を待たずVersion 0.7.5へ継続し、定められた停止条件以外では自律的に実装・検証・修正を続けてください。
