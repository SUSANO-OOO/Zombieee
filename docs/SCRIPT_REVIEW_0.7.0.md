# 西新世紀末物語 — Version 0.7.0 送信前レビュー

更新日：2026-07-17
状態：製品判断ロック済み／実装開始可能

## 1. 判定

Codexへ一気通貫ミッションとして送信可能。

文書作成だけで完成扱いにはしない。実装、画像承認、QA、GitHub Pages正式公開、公開後確認までがミッション範囲。

## 2. 実行入口

Codexが開始時に読むのは次の2点だけ。

1. `docs/PRODUCER_DECISIONS_0.7.0.md`
2. `docs/IMPLEMENTATION_DIRECTIVE_0.7.0.md`

詳細資料は該当工程でだけ読む。旧コメントと旧稿を開始時に読み込まない。

## 3. 製品判断

未決定：0件。

確定：

- 大衆居酒屋「くまや」
- 無言のプレイヤー指揮官
- ナオ、いくらちゃん、レイダー
- 初期所有6名と無料加入・調達条件
- 最大7枠、3プリセット、同一人物複数召喚
- ガンテツ配置コスト48、高HP・低攻撃
- 手動戦術機能の完全撤去
- TAKUYA撃破後を含む味方AI修正
- Stage 1・4の救助自動成立
- 新敵3種、改札喰い、Stage 4〜6
- キャラクターボイスなし
- スマートフォン最優先

## 4. アート

- Codexがデザイン、生成、加工、実装を担当
- 保全対象：パイセン、クマバーソン、ババヤガ、クレイジーキング
- 全面再設計：ハチ、ミズチ、ナオ、タタラ、レイダー、ガンテツ、モンキー、いくらちゃん
- フォトリアル、実写風、AI量産顔、流用、色替えだけの別人化は禁止
- 新規画像は一枚ごとの明示承認制
- 承認待ち中も画像非依存作業を継続

## 5. 戦闘

公開を阻害する不具合：

- 敵を無視して前進
- 接触中の敵を通過
- 表示とhitboxの不一致
- TAKUYA撃破後に残存・後続敵を再索敵しない
- 手動戦術UI・入力・状態の残存

Stage 1〜3、全ユニット種、全3レーン、TAKUYA撃破直後を純粋ロジック、反復シミュレーション、実ブラウザで検証する。

## 6. save

- schema v5
- v2〜v4 migration
- localStorageとIndexedDBの独立検証
- 一方破損時の復旧
- 両方破損時の回復画面
- 手動バックアップ、破損データ書出し、完全初期化
- 既存所有と進行を失わない
- 星、報酬、加入を二重適用しない

## 7. 公開経路

唯一の正式公開先：GitHub Pages。

正式URL：`https://susano-ooo.github.io/Zombieee/`

ChatGPT Sitesは旧公開先。新規deployment、QA、正式判定に使わない。

`.openai/hosting.json`はvinext build互換用メタデータとして保持できるが、Sites公開権限を意味しない。

## 8. 公開権限

全ゲート通過後、Codexは次を実行できる。

- PR #38 Ready化
- PR経由の通常merge
- release SHA確定
- `v0.7.0` annotated tag
- GitHub Release
- GitHub Pages deployment確認
- 正式URLで公開後QA
- Issue #37 close
- 公開後確認済みbranch削除

force push、`main`直接push、rebase／amend、tag移動は禁止。

## 9. リリースゲート

- 全画像個別承認済み
- Stage 1〜6実プレイ可能
- build、test、Lint、diff check、CI成功
- console error、asset 404、参照切れ0
- migration・破損復旧成功
- 手動戦術残存0
- 敵素通り0
- 844×390、844×340、物理iPhone Safari受入
- 独立review High 0／Medium 0

## 10. 結論

実行動線、製品判断、画像承認、QA、正式公開、rollbackの責任範囲は固定済み。

Codexは開始時に2文書だけを読み、詳細資料を工程別に参照し、画像承認待ち中も非画像作業を進める。全ゲート通過後はGitHub Pages正式公開まで連続実行する。
