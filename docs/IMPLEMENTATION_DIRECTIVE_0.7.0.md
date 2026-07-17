# 西新世紀末物語 — Version 0.7.0 実行ランブック

更新日：2026-07-17
状態：実装からGitHub Pages正式公開までの実行正本

## 1. 目的と前提

この文書は、CodexがVersion 0.7.0を迷わず実装し、画像承認、品質確認、GitHub Pages正式公開まで完遂するための工程正本である。

開始時に読むのは次の2点だけ。

1. `docs/PRODUCER_DECISIONS_0.7.0.md`
2. 本書

詳細文書は指定工程でだけ読む。

- システム・数値：`docs/PRODUCT_SPEC_0.7.0.md`
- 人物・加入・内部ID：`docs/CHARACTERS_0.7.0.md`
- 物語：`docs/STORY_BIBLE_0.7.0.md`、`docs/SCENARIO_0.7.0_COMPLETE.md`、必要なPARTだけ
- リリース・復元：`docs/RELEASE_BACKUP_RECOVERY.md`

旧Issueコメント、旧PRコメント、旧稿を開始時に読み込まない。最新正本と衝突する旧情報は採用しない。

文書更新、CI成功、GitHub Pages preview成功だけでは0.7.0完成としない。ゲームコード、正式アセット、Stage 1〜6、save、実ブラウザQA、公開後QAが揃うまで未完成である。

## 2. リポジトリと開始条件

- repository：`SUSANO-OOO/Zombieee`
- branch：`feat/0.7.0-unit-collection`
- PR：#38
- Issue：#37
- save key：`nishijin-campaign-v1`
- target schema：v5
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 画像承認manifest：`docs/ASSET_APPROVALS_0.7.0.json`

開始時にリモート最新状態を取得する。文書記載SHAを現在値として固定しない。

最初の必須工程：

1. `origin/main`とfeature branchをfetch。
2. PR #38のstate、draft、base、head、mergeability、CIを確認。
3. 最新`origin/main`をfeature branchへ通常merge。
4. PR #39のSafari保存修正が履歴へ含まれることを確認。
5. 作業ツリーが意図した状態であることを確認。
6. `npm test`、Lint、`git diff --check`を実行。
7. baseline結果をPR #38へ一度だけ記録。

禁止：force push、公開履歴のrebase・amend、`main`直接push、既存未コミット変更の破棄。

## 3. 完成品質の定義

完成とは、単に仕様項目が存在することではない。

次をすべて満たすこと。

- パオパオ様が承認した人物・敵・背景の視覚的特徴が派生画像と実ゲームで維持される
- スマートフォン横画面で人物、敵、レーン、目的、操作が一目で理解できる
- 敵と味方が表示上もhitbox上も現実的に接触し、素通りしない
- ユニットの役割が数値説明だけでなく実戦で区別できる
- Stage 1〜6が同じ背景、同じ敵、同じ戦い方の繰返しにならない
- save移行で既存進行、所有、星、報酬を失わない
- BGM、環境音、SE、無音が場面に沿って機能し、二重再生や無音不具合がない
- 公開後の正式URLでfresh saveと既存saveの両方が最後まで遊べる

主観的な「イメージどおり」を自動テストだけで保証することはできない。その代わり、全新規画像の一枚承認、承認画像を基準にした派生同一性検査、統合画面証拠、段階レビューを必須化する。承認なしに推測で完成扱いにしない。

## 4. 実行フェーズ

各フェーズは、記載された出口条件を満たすまで完了扱いにしない。

### P0：同期・baseline・作業計画

入力：最新`main`、feature branch、Issue #37、PR #38。

作業：

- 最新`main`を通常merge
- baseline build、test、Lint、diff check
- 現行Stage 1〜3のfresh save、既存save、戦闘、音響、844×390、844×340を確認
- 現行コードの変更対象をモジュール別に整理
- Issue #37のチェックリストを現在状態へ更新

出口証拠：

- merge commit
- baseline test結果
- 変更予定モジュール一覧
- 既知不具合一覧
- PR #39取込み確認

P0未完了のままP1以降の本実装へ入らない。

### P1：正規化・データモデル・save v5

参照：Product Spec、Characters。

作業：

- ナオ、いくらちゃん、レイダーへ名称・ID・表示を正規化
- プレイアブル11名、所有状態、発見状態、調達状態、加入状態をデータ化
- 最大7枠、3プリセット、複数召喚のデータ構造
- schema v5
- v2〜v4 migration
- localStorageとIndexedDBの独立検証
- 一方破損時の復旧、両方破損時の回復画面
- migration前saveと直前正常saveの退避
- 星、報酬、加入の二重適用防止

出口証拠：

- migration matrix全成功
- fresh save、v2、v3、v4、片側破損、両側破損の自動テスト
- 既存所有と進行が減らない差分比較
- save export/import確認

P1のsave後方互換が成立するまで、既存saveを使う公開候補を作らない。

### P2：手動戦術撤去・味方AI・戦闘中コスト経済

参照：Producer Decisions、Product Spec。

作業：

- 前進、後退、防御、標準、突撃のUI、入力、状態、倍率、target bias、保存、説明を撤去
- 透明タップ領域、空白枠、死んだショートカットを除去
- 配置コスト、再出撃待ち、支援ゲージ、総攻撃は維持
- 味方AIの索敵、接触、通行阻害、再索敵を修正
- TAKUYA撃破直後に残存・後続敵を再取得
- コスト上限150基準、許容140〜160
- 第一調整では開始コストと自然回復速度を維持

出口証拠：

- 手動戦術関連のplayer-facing UI・入力・state検索結果0
- Stage 3 TAKUYA撃破後の決定的テスト
- 3レーン、近接、遠距離、ナオ、正面、背後、CRAWLER付近のテスト
- Stage 3 critical scenarioを異なるseedで100回実行し、敵素通り0
- WebKit browser scripted repetitionを10回実行し、敵素通り0
- コスト上限、開始コスト、自然回復の実測値

1件でも敵素通り、接触無視、表示とhitbox不一致があればP2不合格。

### P3：ユニット所有・編成・調達・役割実装

参照：Product Spec、Characters。

作業：

- 初期6名
- Stage 1後のクレイジーキング無料加入とタタラ調達
- Stage 2後のレイダー調達
- Stage 4後のガンテツ無料加入
- Stage 6後のモンキー無料加入
- キャップ、調達、所有、未遭遇、情報判明
- 最大7枠、3プリセット
- 同一人物の複数召喚
- ガンテツ高耐久盾役
- ナオ低コスト単体ヒーラー
- クレイジーキング近接範囲殲滅
- レイダー同一レーン直線範囲制圧
- タタラ対装甲・対拠点

出口証拠：

- 加入・調達・所有・migrationの自動テスト
- 3プリセット保存・読込
- 1枠、7枠、空き枠ありの出撃
- 同一人物複数召喚
- ナオ集中治療減衰
- ガンテツ肩代わり
- クレイジーキングとレイダーの攻撃形状差

役割品質：

- ナオ、簡易救護所、クマバーソンの回復用途が実戦で別
- クレイジーキング、レイダー、航空支援の群体処理用途が別
- タタラを範囲殲滅の代用品にしない
- 特定人物がいなければクリア不能な設計にしない

### P4：敵、Stage 4〜6、既存Stage再調整

参照：Product Spec、Story Bible、該当Scenario PART。

作業：

- 絡手、漏泥、走鬼、改札喰い
- Stage 4改札区域
- Stage 5ホーム／線路区域
- Stage 6保守トンネル／封鎖区域
- Stage 1・4救助自動成立
- Stage 5護衛
- Stage 6三電源と封鎖
- Stage 1〜3を7枠、コスト上限、役割追加に合わせ再調整
- 論理レーン、床面、anchor、hitboxを先に固定

出口証拠：

- Stage 1〜6の開始、勝利、敗北、再戦、結果、マップ復帰
- 各新敵の能力・予備動作テスト
- 各Stage専用背景・ランドマーク・戦闘目標
- debug lane／anchor／hitbox overlay証拠
- レーン外歩行0
- 新規Stage 4〜6を少なくとも3種類の異なる編成でクリア可能
- 単一人物必須0

### P5：物語、会話、音響

参照：Story Bible、Complete Scenario、必要なPARTだけ。

作業：

- fresh save直後のくまやプロローグ
- CRAWLER確保モンタージュ
- 四十三日後への接続
- Stage 1〜6の会話・結果
- 固定4名の人物像、口調、奇妙な言葉を保全
- ナオ、いくらちゃん、レイダー等の名称正規化
- BGM、環境音、SE、必要な無音
- キャラクターボイスは実装しない
- AudioContext解除、音声有効化、音量、二重再生・残留音防止

出口証拠：

- 話者別台詞一覧
- 旧表示名のplayer-facing検索結果0
- 音読監査
- プロローグ、スキップ、回想、戦闘前後の遷移
- 音声有効化成功・失敗表示
- 回転、ロック、タブ復帰、再戦後の二重再生0

### P6：画像制作・一枚承認・派生統合

P6はP1〜P5と並行可能。ただし承認前画像に依存する統合だけ停止する。

#### 画像キュー

次の順序を基本とする。技術依存で順序変更する場合は理由をPRへ一度だけ記録する。

1. 初期所有の新規人物：ハチ、ミズチ、ナオ
2. Stage 1〜2解放人物：タタラ、レイダー
3. Stage 4〜6人物：ガンテツ、モンキー
4. 非戦闘人物：いくらちゃん
5. 新敵：絡手、漏泥、走鬼、改札喰い
6. Stage 4背景・オブジェクト
7. Stage 5背景・オブジェクト
8. Stage 6背景・オブジェクト
9. プロローグ・重要イベントカット
10. 保全4名の新規派生が必要な場合、その派生

#### 承認依頼

```md
## 画像承認依頼 1件
- Asset ID：
- 種別：基準アート／ポートレート／立ち絵／スプライト／敵／背景／オブジェクト／イベントカット
- 対象人物・Stage：
- 用途：
- 予定パス：
- Revision：
- 元になる承認済みAsset ID：派生の場合のみ
- デザイン意図：1〜3行
- スマホ縮小時の識別点：
- 確認：世界観／人物同一性／役割識別／年齢・性別／武器・装備／破綻

[画像1枚]

この画像で進めてよいですか。
回答：承認／修正：...／却下
```

#### machine-readable manifest

Codexは最初の画像制作前に`docs/ASSET_APPROVALS_0.7.0.json`を作成する。画像承認用の別文書を乱立させない。

各entryは最低限次を持つ。

- assetId
- type
- subject
- intendedPath
- revision
- sourceApprovedAssetId
- status：draft／pending／approved／rejected／integrated
- approvedBy
- approvedAt
- approvalCommentUrl
- commitSha
- finalPath
- identityLockFields
- mobileEvidenceUrls

#### 視覚同一性契約

人物の基準アートが承認された時点で、次をidentity lockとする。

- 顔型
- 目、眉、鼻、口、顎
- 年齢感、性別表現
- 髪型、髪色
- 身長、体格、肩幅、姿勢
- 衣服、主要配色
- 武器、装備、シルエット

ポートレート、立ち絵、表情差分、スプライトは、承認済み基準アートの別人化を禁止する。

派生画像の承認依頼では、元の承認済み画像と並べて確認できる証拠を添える。100%表示とスマホ縮小の両方で別人に見える場合は不合格。

保全4名は既存採用画像をidentity lockとし、顔、髪、体格、服、武器、主要配色を変更しない。

#### 統合画面品質

個別画像承認だけで統合完了としない。承認済み画像を実ゲームへ入れた後、次を確認する。

- 844×390と844×340で識別可能
- 顔・武器・役割シルエットが潰れない
- 頭、手足、武器が切れない
- 足元が論理レーンへ接地
- UI、字幕、HP、カードと不自然に重ならない
- 背景と人物の明度・彩度が喧嘩しない
- ポートレート、立ち絵、スプライトが同一人物
- AI量産顔、フォトリアル、プラスチック3Dへ逸脱しない

出口証拠：

- `docs/ASSET_APPROVALS_0.7.0.json`
- Asset ID、revision、承認者、承認日時、commit、最終パス
- 元基準画像と派生画像の同一性比較
- 実ゲーム統合スクリーンショット
- 844×390と844×340の表示証拠

未承認画像を仮素材、背景素材、テスト素材として正式候補へ混ぜない。

### P7：統合QA、バランス、段階レビュー

全機能完成後に初めてまとめて検証する方式は禁止。次のレビューを段階実施する。

#### R1：基盤レビュー

対象：P0〜P2。

- main統合
- save v5
- 手動戦術撤去
- 味方AI
- コスト経済

High／Medium未解消0でP3以降を正式基盤とする。

#### R2：ゲームプレイループレビュー

対象：P3〜P5の画像非依存部分。

- 所有、編成、調達
- ユニット役割
- 敵、Stage 1〜6
- 物語、音響

High／Medium未解消0で最終アセット統合へ進む。

#### R3：視覚統合レビュー

対象：承認済みアセットの実ゲーム統合。

- identity lock
- UI、背景、接地、スプライト
- スマホ視認性
- 個別Stageの差別化

High／Medium未解消0でrelease candidateを作る。

#### R4：release candidateレビュー

対象：全体。

- fresh save
- v2〜v4 save
- Stage 1〜6
- AI critical cases
- balance
- audio
- 844×390、844×340、WebKit
- console、404
- rollback可能性

High／Medium未解消0でReady化可能。

レビューはread-only担当を使い、同じ実装担当の自己評価だけで合格にしない。

## 5. バランス品質

固定・準固定：

- ガンテツ：コスト48
- ナオ：コスト35基準、32〜38
- コスト上限：150基準、140〜160

CodexはP3開始時に、0.6.5 baselineと新仕様をもとに次の目標帯をProduct Specへ記録する。

- 各Stageの想定所要時間
- 推奨編成での成功率帯
- CRAWLER残存HP帯
- ユニット損失帯
- 初回出撃時間
- コスト溢れ率

目標帯を記録した後、テスト結果に合わせて都合よく無断変更しない。変更理由と前後値をPRへ記録する。

最低条件：

- 初期6名でStage 1クリア可能
- 調達人物なしでも本筋進行可能
- Stage 4〜6は複数編成でクリア可能
- 特定人物必須0
- 同一ユニット連打だけで全Stageが安定クリアできない
- コスト上限拡張で常時ユニット連打にならない
- 役割不一致編成より、敵に合う役割編成が明確に有利
- 難度調整のために敵HPだけを一律増減しない

必須計測：

- 初回出撃時間
- コスト溢れ率
- 連続展開回数
- Stage 1〜6の勝率と所要時間
- CRAWLER残存HP
- ユニット損失
- ナオ、簡易救護所、クマバーソンの回復寄与
- クレイジーキング、レイダー、航空支援の群体処理寄与
- ガンテツの肩代わり量
- タタラの装甲・拠点ダメージ寄与

## 6. スマートフォン品質

主対象：スマートフォン横画面。

公開前必須：

- 844×390
- 844×340
- Chromium
- Playwright WebKitのiPhone相当profile
- touch
- safe area
- ブラウザUI表示中
- 回転
- 画面ロック・復帰
- タブ復帰

UI最低条件：

- 主要タップ領域は原則44 CSS px以上
- 左右余白、中央ずれ、意図しないscroll 0
- 下部カード・ボタン切れ0
- 透明タップ領域0
- 読めない文字、豆粒キャラ0
- 回転後に操作不能状態を残さない
- BGM・SEの有効化状態が見て分かる

利用可能な物理iPhoneがある場合は公開前にも確認する。端末が利用不能なことだけを理由に他工程を永久停止しない。

正式URL公開後、Issue closeとbranch削除の前に物理iPhone Safariで必須確認する。重大不具合があればIssueを閉じずrevert PRで復旧する。

## 7. コミットと報告

工程単位で通常commit・通常pushする。

推奨単位：

1. P0 main統合・baseline
2. P1 save v5・正規化
3. P2 手動戦術撤去・AI・コスト経済
4. P3 所有・編成・調達・ユニット役割
5. P4 敵・Stageロジック
6. P5 物語・音響
7. P6 承認済みアセット統合
8. P7 QA・修正
9. release準備

禁止：

- 状態変化のない進捗コメント
- 承認待ちごとの空commit
- 一つの巨大commitへ全実装を押し込むこと
- 無関係な全面リファクタリング
- 同じファイルを複数エージェントが無調整で編集

Issue #37をタスク台帳として更新する。PR #38は変更概要、承認、QA、release証拠の所有元とする。

## 8. 公開前ゲート

全項目を満たすまでReady化しない。

- P0〜P7の全チェック完了
- 全新規画像が個別承認済み
- identity lockと派生同一性確認済み
- 正式アセットとmanifestが一致
- Stage 1〜6を開始から完了まで実プレイ可能
- build、全test、Lint、diff check、CI成功
- console warning/error 0
- 主要asset 404・参照切れ0
- migration・破損復旧成功
- 手動戦術UI・入力・状態の残存0
- 敵素通り再現0
- ナオ、クレイジーキング、レイダー、ガンテツ、タタラの役割が実戦で分離
- コスト上限拡張後も難度が崩壊していない
- 844×390、844×340の受入
- WebKit iPhone相当profile、touch、safe area、回転の受入
- R1〜R4 High／Medium未解消0
- PR #38に未解決の製品判断なし

## 9. GitHub Pages正式公開

公開前ゲート通過後、次を連続実行できる。

1. PR #38のbase、head、CI、mergeabilityを再取得。
2. PRをReady化。
3. PR経由で通常merge。
4. result SHAをrelease SHAとして固定。
5. `v0.7.0` annotated tagをrelease SHAへ作成・通常push。
6. tag targetを再確認。
7. GitHub Release `v0.7.0`を公開。
8. `main` pushで起動するGitHub Pages Release workflowを確認。
9. build、browser smoke、deployの全成功を確認。
10. 正式URLでrelease SHAを確認。
11. 公開後QAを実施。
12. 物理iPhone Safariで正式URLを確認。
13. 成功後にIssue #37とPR #38へ結果を記録。
14. Issue #37をcompletedでclose。
15. feature branchを通常削除。

ChatGPT Sitesへのdeployment、保存、履歴更新、QAは行わない。

## 10. 公開後QA

正式URL：`https://susano-ooo.github.io/Zombieee/`

最低確認：

- タイトルとVersion 0.7.0
- fresh save開始
- 既存v2〜v4 saveの続行
- プロローグ、マップ、編成、調達
- Stage 1〜6
- TAKUYA撃破後の残存敵
- ナオの低コスト回復と重複減衰
- クレイジーキングの近接範囲殲滅
- レイダーの同一レーン範囲制圧
- ガンテツの盾・肩代わり
- タタラの装甲・拠点破壊
- コスト上限と開始コスト・自然回復
- 承認済み画像と実画面の同一性
- 再読込後の進行保持
- BGM・SE有効化
- 844×390、844×340
- 物理iPhone Safari
- 主要画像・音声404 0
- console error 0

重大不具合を確認した場合：

- Issue #37を閉じない、または再open
- 直前release SHAを特定
- force操作を使わずrevert PRで復旧
- Pages workflowと正式URLを再確認
- 原因修正は新しい通常PRで行う

## 11. 最終報告

- release SHA
- merge commit
- tagとGitHub Release
- GitHub Pages workflow run
- 正式URL
- P0〜P7完了表
- R1〜R4レビュー結果
- 公開後QA
- 物理iPhone結果
- 画像承認一覧
- identity lock比較
- test・CI
- save migration
- AI critical test
- バランス実測
- console・404
- rollback不要／実施
- ChatGPT Sitesを更新していないこと
