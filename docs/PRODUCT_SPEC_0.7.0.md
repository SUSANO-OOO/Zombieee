# 西新世紀末物語 — 0.7.0製品仕様

更新日：2026-07-17

## 1. 位置づけ

0.7.0は、1.0.0正式ローンチ前のアーリーアクセス更新である。表示上は`Version 0.7.0`とし、`アーリーアクセス版`表記を維持する。

0.7.0の中心目的は、**ユニットを集め、個性を見極め、7枠の部隊を組む楽しさを完成させること**である。機能数を増やすこと自体を目的にせず、所有、調達、編成、出撃、再編成の一連の体験を成立させる。

## 2. 固定基準

- repository：`SUSANO-OOO/Zombieee`
- fixed base：`main@706dd0ffaa51346bd061b2b4e72b4ce033537771`
- work branch：`feat/0.7.0-unit-collection`
- current public：ChatGPT Sites v23
- public source SHA：`706dd0ffaa51346bd061b2b4e72b4ce033537771`
- public URL：`https://ashfall-outpost-defense.paopao9.chatgpt.site/`
- current save key：`nishijin-campaign-v1`
- current save schema：v4

## 3. 物語・脚本正本

0.7.0の物語・台詞・サウンド演出は次を正本とする。

- `docs/STORY_BIBLE_0.7.0.md`
- `docs/SCENARIO_0.7.0_COMPLETE.md`
- `docs/SCENARIO_0.7.0_PART1_PROLOGUE_STAGE1.md`
- `docs/SCENARIO_0.7.0_PART2_STAGE2_STAGE3.md`
- `docs/SCENARIO_0.7.0_PART3_STATION_ENDING_SOUND.md`
- `docs/NARRATIVE_RESEARCH_0.7.0.md`
- `docs/SCRIPT_REVIEW_0.7.0.md`

script versionは`outbreak-origin-v6`。
`chapter-nishijin-station-v1`、v2、`outbreak-origin-v3`、v4、v5は不採用とし、旧稿由来の台詞・あらすじ・模倣音声中心の設定・機械的な説明会話・笑えない形式的ユーモアを実装へ残さない。

fresh saveで「物語を始める」を押した直後、タイトル画面上の長文ではなく、映像、漫画的なカット運び、環境音、SE、無音を含む導入シーンを再生する。導入はスキップと再視聴へ対応する。

## 4. v6脚本の品質条件

- 研究員パートは、専門用語の朗読ではなく、死後反応のラット、隠蔽、排水へ逃げる絵で分かる導入にする。
- 会話は、人物同士の反応、遠慮、苛立ち、照れ、沈黙、ユーモア、後悔を含める。
- ユーモアは怖さを誤魔化す人間の反応として使う。単なる冗談メモを挿入しない。
- 各場面で、誰が何を守りたいかが台詞に出るようにする。
- 説明が必要な箇所は、会話ではなくUI、地図、端末、画面演出へ分離する。

## 5. 一括実装範囲

1. 0.6.5正式公開状態と文書の現在化
2. schema v5とv2〜v4後方互換migration
3. 旧`supplies`を1対1で保持する通貨`キャップ`
4. 未遭遇、情報判明、調達可能、所有済みの4状態
5. プレイアブル11名と非戦闘オペレーター
6. 主要クラス、役割タグ、人物別固有特性
7. ユニット一覧・調達タブ
8. 最大7枠編成と3プリセット
9. `前進`・`後退`の短時間命令
10. 新敵`絡手`、`漏泥`、`走鬼`
11. 大型特殊個体`改札喰い`
12. 西新駅地下3ステージ
13. 西新周辺を再構成したCRAWLER作戦卓型エリアマップ
14. 既存3ステージの7枠制向け再調整
15. ファイル・文字列の手動バックアップと復元
16. 二段階確認付き完全初期化
17. 導入映像からエピローグまでの台本v6
18. BGM、環境音、SE、無音、ボイスダッキング
19. 0.6.5スマートフォン品質の回帰防止
