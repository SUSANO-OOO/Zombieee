# 西新世紀末物語 — Version 0.7.0 実行ランブック

更新日：2026-07-17
状態：実装からGitHub Pages正式公開までの実行正本

## 1. 最初に読む文書

開始時に読むのは次の2点だけ。

1. `docs/PRODUCER_DECISIONS_0.7.0.md`
2. 本書

詳細文書は該当工程でのみ読む。

- システム・数値：`docs/PRODUCT_SPEC_0.7.0.md`
- 人物・加入・内部ID：`docs/CHARACTERS_0.7.0.md`
- 物語実装：`docs/STORY_BIBLE_0.7.0.md`、`docs/SCENARIO_0.7.0_COMPLETE.md`、必要なPARTだけ
- リリース・復元：`docs/RELEASE_BACKUP_RECOVERY.md`

全資料を開始時に読み込まない。旧Issueコメントや旧稿は検索対象にせず、最新正本と衝突した場合は無視する。

## 2. リポジトリ

- repository：`SUSANO-OOO/Zombieee`
- branch：`feat/0.7.0-unit-collection`
- PR：#38
- Issue：#37
- save key：`nishijin-campaign-v1`
- target schema：v5
- 唯一の正式公開URL：`https://susano-ooo.github.io/Zombieee/`

開始時に最新状態を再取得する。記載SHAが古い場合はリモートの最新値を採用する。

## 3. 最初の工程

1. `origin/main`とfeature branchをfetch。
2. 作業ツリーとPR #38の状態を確認。
3. 最新`origin/main`をfeature branchへ通常merge。
4. PR #39のSafari保存修正が履歴に含まれることを確認。
5. `npm test`、Lint、`git diff --check`を実行。
6. 問題があればfeature branch上で修正し、通常commit・通常push。

禁止：force push、公開履歴のrebase・amend、`main`直接push。

## 4. 実装の並行レーン

### レーンA：画像非依存

承認待ちに関係なく継続する。

- 手動戦術機能撤去
- 味方AI修正
- schema v5、migration、save復旧
- 所有、調達、キャップ、加入
- 7枠、3プリセット、複数召喚
- 敵・ステージのデータとロジック
- UI骨格
- 音響ロジック
- 自動テスト

### レーンB：画像

一枚ずつ制作・承認・統合する。

- 一度に一枚だけ承認依頼
- 承認待ち中に次画像を作らない
- 承認済み画像だけ統合
- 非画像作業は止めない

### レーンC：QA

実装済み範囲を継続的に検証する。

- 844×390
- 844×340
- WebKit／Safari互換
- PC基本回帰
- console、404、操作、save

全機能完成後にまとめて初めてテストする方式は禁止。

## 5. 固定実装

製品判断は`PRODUCER_DECISIONS_0.7.0.md`をそのまま実装する。特に次を落とさない。

- ナオ、いくらちゃん、レイダーへの名称正規化
- ガンテツの配置コスト48と高HP盾役
- 同一人物の複数同時召喚
- 前進・後退・手動戦術モードの完全撤去
- TAKUYA撃破後を含む敵素通りAIの修正
- Stage 1・4の救助自動成立
- 新敵3種と改札喰い
- Stage 4〜6
- スマートフォン最優先
- キャラクターボイスなし

## 6. 手動戦術撤去

撤去するもの：

- 前進、後退、防御、標準、突撃のボタン
- 同目的のキーボード・タッチ入力
- 専用状態、倍率、target bias、保存項目
- チュートリアル、説明、ARIA、ヘルプ
- 透明タップ領域、空白枠、死んだショートカット

残すもの：

- ユニット配置コスト
- 再出撃待ち
- 支援ゲージ
- 総攻撃など別目的の確定機能

共用関数は利用箇所を確認し、手動戦術専用部分だけを削除する。

## 7. 味方AIのリリース阻害条件

次のいずれかが1件でも再現したら公開不可。

- 攻撃可能な敵を無視して前進
- 接触中の敵を通過
- 表示上は接触しているのにhitbox上は無視
- TAKUYA撃破後に残存・後続敵を再索敵しない
- target消失後に停止または無目的前進
- 敵を攻撃せず死亡し、敵だけが増え続ける

必須検証：

- Stage 1〜3
- 全ユニット種
- 全3レーン
- 正面、背後、CRAWLER付近、レーン移動中
- TAKUYA撃破直後
- 残存敵＋後続敵
- 近接、遠距離、ナオ

純粋ロジックテスト、反復シミュレーション、実ブラウザの3段階で確認する。

## 8. save

- localStorageとIndexedDBを両方読む
- 両方を独立検証
- 有効な新しい候補を採用
- 一方破損時は正常側から復旧
- 両方破損時は自動初期化しない
- 手動バックアップ読込、破損データ書出し、完全初期化
- migration前saveと直前正常saveを保持
- v2〜v4→v5
- 星、報酬、加入の二重適用防止

save移行失敗、既存所有消失、日をまたいだ進行消失は公開不可。

## 9. 画像承認フォーマット

```md
## 画像承認依頼 1件
- Asset ID：
- 用途：
- 予定パス：
- Revision：
- デザイン意図：1〜3行
- 確認：世界観／人物同一性／役割識別／スマホ視認性／破綻

[画像1枚]

この画像で進めてよいですか。
回答：承認／修正：...／却下
```

承認履歴はasset manifestとPR #38へ記録する。未承認画像を仮素材としてゲームへ入れない。

## 10. コミット方針

工程単位で通常commit・通常pushする。

推奨単位：

1. main統合・基準確認
2. 手動戦術撤去・AI
3. save v5
4. 所有・編成・調達
5. 敵・ステージロジック
6. 承認済みアセット統合
7. 物語・音響
8. QA・修正
9. リリース準備

承認待ち画像ごとに不要な空commitを作らない。進捗コメントも状態変化がある時だけ行う。

## 11. リリースゲート

全項目を満たすまでReady化しない。

- 全新規画像が個別承認済み
- 正式アセットとmanifestが一致
- Stage 1〜6を開始から完了まで実プレイ可能
- build、全test、Lint、diff check成功
- CI成功
- console warning/error 0
- 主要asset 404・参照切れ0
- migration・破損復旧成功
- 手動戦術UI・入力・状態の残存0
- 敵素通り再現0
- 844×390、844×340、物理iPhone Safari受入
- 独立read-onlyレビュー High 0／Medium 0
- PR #38に未解決の製品判断なし

技術的に同等な解決方法はCodexが選べる。製品判断を変える場合だけ確認する。

## 12. GitHub Pages正式公開

ゲート通過後、次を連続実行できる。

1. PR #38のbase、head、CI、mergeabilityを再取得。
2. PRをReady化。
3. 通常のPR mergeで`main`へ反映。`main`直接pushは禁止。
4. result SHAをrelease SHAとして固定。
5. `v0.7.0` annotated tagをrelease SHAへ作成・通常push。
6. tag targetを再確認。
7. GitHub Release `v0.7.0`を公開。
8. `main` pushで起動するGitHub Pages workflowを確認。
9. build、browser smoke、deployがすべて成功するまで公開成功扱いにしない。
10. 正式URLでrelease SHAを確認。
11. 公開後QAを実施。
12. Issue #37とPR #38へ結果を記録。
13. Issue #37をcompletedでclose。
14. 公開後確認完了後にfeature branchを通常削除。

ChatGPT Sitesへのdeployment、保存、履歴更新、QAは行わない。

## 13. 公開後QA

正式URL：`https://susano-ooo.github.io/Zombieee/`

最低確認：

- タイトル表示とVersion 0.7.0
- fresh save開始
- 既存v2〜v4 saveの続行
- プロローグ、マップ、編成、調達
- Stage 1〜6
- TAKUYA撃破後の残存敵
- 再読込後の進行保持
- BGM・SE有効化
- 844×390、844×340
- 主要画像・音声404 0
- console error 0

公開後に重大不具合を確認した場合：

- Issue #37を再open
- 直前release SHAを特定
- force操作を使わずrevert PRで復旧
- Pages workflow成功と正式URLを再確認
- 原因修正は新しい通常PRで行う

## 14. 最終報告

- release SHA
- merge commit
- tagとGitHub Release
- GitHub Pages workflow run
- 正式URL
- 公開後QA
- 画像承認一覧
- test・CI
- save migration
- AI回帰
- console・404
- rollback不要／実施の有無
- ChatGPT Sitesを更新していないこと
