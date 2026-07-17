# 西新世紀末物語

西新・早良区周辺を再構成した区域で、生存者部隊と移動拠点CRAWLERを指揮するリアルタイムのCanvas戦略・防衛ゲームです。

## プレイ

**正式URL：<https://susano-ooo.github.io/Zombieee/>**

正式公開先はGitHub Pagesだけです。ChatGPT Sitesは旧公開先であり、今後の公開・QA・正式判定には使用しません。

主対象はスマートフォン横画面です。844×390、844×340、iPhone Safariのsafe areaとブラウザUI表示状態を優先し、PC横画面は基本回帰を確認します。

## 現在の開発

Version 0.7.0では、次を統合します。

- プレイアブル11名
- 最大7枠と3プリセット
- キャップによる人物調達
- 西新駅地下Stage 4〜6
- 新感染体3種と大型特殊個体
- schema v5とSafari save復旧
- 味方AIとスマートフォンUIの改善

0.7.0の実行入口：

1. [プロデューサー決定台帳](docs/PRODUCER_DECISIONS_0.7.0.md)
2. [実行ランブック](docs/IMPLEMENTATION_DIRECTIVE_0.7.0.md)

詳細資料はランブックの指示に従い、該当工程でだけ読みます。

## 文書

| 文書 | 役割 |
|---|---|
| [AGENTS.md](AGENTS.md) | 恒久的な実装・検証原則 |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | 現在のrelease、SHA、公開状態 |
| [docs/RELEASE_BACKUP_RECOVERY.md](docs/RELEASE_BACKUP_RECOVERY.md) | GitHub Pages公開、tag、Release、rollback、bundle |
| [docs/PRODUCT_SPEC_0.7.0.md](docs/PRODUCT_SPEC_0.7.0.md) | 0.7.0のシステム仕様 |
| [docs/CHARACTERS_0.7.0.md](docs/CHARACTERS_0.7.0.md) | 人物、役割、加入、内部ID |
| [docs/STORY_BIBLE_0.7.0.md](docs/STORY_BIBLE_0.7.0.md) | 世界観と物語構造 |
| GitHub Issue / PR | 判断、画像承認、実行ログ、QA証拠 |

## 前提環境

- Node.js `>=22.13.0`
- npm

```bash
npm install
npm run dev
```

WindowsでPowerShellの実行ポリシーにより`npm`を使えない場合は、`npm.cmd`を使用します。

## 検証

```bash
npm test
npm run lint
git diff --check
```

`npm test`は本番ビルドを含みます。

## 主要構成

- `app/AshfallGame.tsx`：戦闘、描画、入力、HUD
- `app/CampaignScreens.tsx`：タイトル、マップ、編成、会話、リザルト
- `app/campaign.js`：ステージ、人物、報酬、save
- `app/battleDefinitions.js`：ステージ目的、ウェーブ、勝敗
- `app/combatLifecycle.js`：標的、死亡、感染、焼却
- `app/storyEvents.js`：会話イベント
- `app/gameRules.js`：数値、レーン、戦闘ルール
- `public/`：画像・音声アセット
- `tests/`：仕様・回帰テスト
- `.github/workflows/github-pages-playtest.yml`：正式GitHub Pages build・smoke・deployment

## 開発と公開

- 正式コードはGitHub `main`上のrelease SHAです。
- feature branchはPR、CI、QA、画像承認を通過するまで候補です。
- リリースゲート通過後、PR merge、annotated tag、GitHub Release、GitHub Pages deploymentを一連で行います。
- 公開後に重大不具合があれば、force操作ではなくrevert PRで復旧します。
