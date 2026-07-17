# 西新世紀末物語 — Version 0.7.0 実行ランブック

更新日：2026-07-17
状態：実装からGitHub Pages正式公開までの実行正本

## 1. 最初に読む文書

開始時に読むのは次の2点だけ。

1. `docs/PRODUCER_DECISIONS_0.7.0.md`
2. 本書

詳細文書は該当工程でだけ読む。

- システム・数値：`docs/PRODUCT_SPEC_0.7.0.md`
- 人物・加入・内部ID：`docs/CHARACTERS_0.7.0.md`
- 物語：`docs/STORY_BIBLE_0.7.0.md`、`docs/SCENARIO_0.7.0_COMPLETE.md`、必要なPARTだけ
- リリース・復元：`docs/RELEASE_BACKUP_RECOVERY.md`

旧Issueコメントや旧稿を開始時に読み込まない。最新正本と衝突する旧情報は採用しない。

## 2. リポジトリ

- repository：`SUSANO-OOO/Zombieee`
- branch：`feat/0.7.0-unit-collection`
- PR：#38
- Issue：#37
- save key：`nishijin-campaign-v1`
- target schema：v5
- 正式URL：`https://susano-ooo.github.io/Zombieee/`

開始時にリモート最新状態を取得する。文書記載SHAを現在値として固定しない。

## 3. 最初の工程

1. `origin/main`とfeature branchをfetch。
2. 作業ツリーとPR #38の状態を確認。
3. 最新`origin/main`をfeature branchへ通常merge。
4. PR #39のSafari保存修正が履歴に含まれることを確認。
5. `npm test`、Lint、`git diff --check`を実行。
6. 問題があればfeature branch上で修正し、通常commit・通常push。

禁止：force push、公開履歴のrebase・amend、`main`直接push。

## 4. 並行レーン

### A. 画像非依存

承認待ちに関係なく継続する。

- 手動戦術機能撤去
- 味方AI修正
- schema v5、migration、save復旧
- 所有、調達、キャップ、加入
- 7枠、3プリセット、複数召喚
- 戦闘中コスト経済
- 低コストヒーラーと範囲殲滅役
- 敵・ステージのデータとロジック
- UI骨格
- 音響ロジック
- 自動テスト

### B. 画像

- 一度に一枚だけ制作・承認依頼
- 承認待ち中に次画像を作らない
- 承認済み画像だけ統合
- 非画像作業は止めない

### C. QA

実装済み範囲を継続検証する。

- 844×390
- 844×340
- Chromium
- Playwright WebKitのiPhone相当profile
- touch、safe area、回転
- PC基本回帰
- console、404、操作、save

全機能完成後に初めてまとめて検証する方式は禁止。

## 5. 固定実装

`PRODUCER_DECISIONS_0.7.0.md`をそのまま実装する。

特に落とさないもの：

- ナオ、いくらちゃん、レイダーへの名称正規化
- ガンテツの配置コスト48と高HP盾役
- ナオの低コスト単体回復
- クレイジーキングの近接範囲殲滅
- レイダーの同一レーン直線範囲制圧
- 戦闘中コスト上限150基準、許容140〜160
- 同一人物の複数同時召喚
- 前進・後退・手動戦術モードの完全撤去
- TAKUYA撃破後を含む敵素通りAIの修正
- Stage 1・4の救助自動成立
- 新敵3種と改札喰い
- Stage 4〜6
- スマートフォン最優先
- キャラクターボイスなし

## 6. 戦力拡充とコスト経済

### ナオ

- コスト初期基準35、許容32〜38
- 低HP・低攻撃力
- 最低HP比率の味方へ移動単体治療
- 治療後に短時間の被ダメージ軽減
- 同一対象へ複数のナオが集中した場合、二体目以降の回復効率を減衰
- 簡易救護所の定点範囲回復と役割を分ける

### クレイジーキング

- 自身周辺または前方扇形の近接範囲攻撃
- 密集敵へ強い
- 接近リスクを残す
- 単体ボスと遠距離群体へ万能にしない

### レイダー

- 同一レーンの直線範囲、貫通または弾幕制圧
- 中遠距離の群体処理
- 連射継続で制圧性能上昇、過熱または再装填で連射を制限
- 円形範囲にせずクレイジーキングと差別化

### コスト上限

- 現行100から拡張
- 初期基準150
- 調整許容140〜160
- 第一調整では開始コストと自然回復速度を既存値のまま維持
- 上限、開始コスト、自然回復を同時に上方修正しない
- 上限拡張により、二体の中高コストまたは三体前後の低コストを計画展開できる状態を目標にする
- 簡単になりすぎる場合は開始コスト、自然回復、再出撃待ち、敵圧力を個別調整

必須計測：

- 初回出撃時間
- コスト溢れ率
- 連続展開回数
- Stage 1〜6の勝率と所要時間
- CRAWLER残存HP
- ユニット損失
- ナオ、簡易救護所、クマバーソンの回復寄与
- クレイジーキング、レイダー、航空支援の群体処理寄与

## 7. 手動戦術撤去

撤去：

- 前進、後退、防御、標準、突撃のボタン
- 同目的のキーボード・タッチ入力
- 専用状態、倍率、target bias、保存項目
- チュートリアル、説明、ARIA、ヘルプ
- 透明タップ領域、空白枠、死んだショートカット

残す：

- ユニット配置コスト
- 再出撃待ち
- 支援ゲージ
- 総攻撃など別目的の確定機能

共用関数は利用箇所を確認し、手動戦術専用部分だけを削除する。

## 8. 味方AIの公開阻害条件

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

純粋ロジック、反復シミュレーション、実ブラウザの3段階で確認する。

## 9. save

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

## 10. 画像承認

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

## 11. コミット方針

工程単位で通常commit・通常pushする。

推奨単位：

1. main統合・基準確認
2. 手動戦術撤去・AI
3. save v5
4. 所有・編成・調達・コスト経済
5. ヒーラー・範囲殲滅・ユニットバランス
6. 敵・ステージロジック
7. 承認済みアセット統合
8. 物語・音響
9. QA・修正
10. リリース準備

承認待ち画像ごとに空commitを作らない。進捗コメントは状態変化がある時だけ行う。

## 12. 公開前ゲート

全項目を満たすまでReady化しない。

- 全新規画像が個別承認済み
- 正式アセットとmanifestが一致
- Stage 1〜6を開始から完了まで実プレイ可能
- build、全test、Lint、diff check、CI成功
- console warning/error 0
- 主要asset 404・参照切れ0
- migration・破損復旧成功
- 手動戦術UI・入力・状態の残存0
- 敵素通り再現0
- ナオ、クレイジーキング、レイダーの役割が実戦で分離
- コスト上限拡張後も難度が崩壊していない
- 844×390、844×340の受入
- WebKit iPhone相当profile、touch、safe area、回転の受入
- 独立read-onlyレビュー High 0／Medium 0
- PR #38に未解決の製品判断なし

利用可能な物理iPhoneがある場合は公開前にも確認する。端末が利用不能なことだけを理由に、他の全工程を永久停止しない。

## 13. GitHub Pages正式公開

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

## 14. 公開後QA

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
- コスト上限と開始コスト・自然回復の表示・挙動
- 再読込後の進行保持
- BGM・SE有効化
- 844×390、844×340
- 物理iPhone Safari
- 主要画像・音声404 0
- console error 0

物理iPhoneまたは公開後QAで重大不具合を確認した場合：

- Issue #37を閉じない、または再open
- 直前release SHAを特定
- force操作を使わずrevert PRで復旧
- Pages workflowと正式URLを再確認
- 原因修正は新しい通常PRで行う

## 15. 最終報告

- release SHA
- merge commit
- tagとGitHub Release
- GitHub Pages workflow run
- 正式URL
- 公開後QA
- 物理iPhone結果
- 画像承認一覧
- test・CI
- save migration
- AI回帰
- ナオ・クレイジーキング・レイダーの実測
- コスト上限・開始コスト・自然回復の最終値
- console・404
- rollback不要／実施
- ChatGPT Sitesを更新していないこと
