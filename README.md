# 西新世紀末物語

西新・早良区周辺を再構成した区域で、生存者部隊と移動拠点CRAWLERを指揮するリアルタイムのCanvas戦略・防衛ゲームです。

## プレイ

**正式URL：<https://susano-ooo.github.io/Zombieee/>**

正式公開先はGitHub Pagesだけです。ChatGPT Sitesは旧公開先であり、今後の公開・QA・正式判定には使用しません。

主対象はスマートフォン横画面です。844×390、844×340、iPhone Safariのsafe areaとブラウザUI表示状態を優先し、PC横画面も正式対応します。

## 公開中

**Version 0.8.0**

- Stage 1〜16
- プレイアブル11名
- 最大7枠、3編成preset
- 連続battle spaceとprofile-driven AI
- Rank 0〜4 progressionとcaps economy
- Stageごとの背景、mission、grounding、objective
- BGM／SE独立volume
- unit card、upgrade／MAX feedback

正確なrelease SHA、tag、Issue、公開metadataは[PROJECT_STATE](docs/PROJECT_STATE.md)を確認してください。

## 次の開発

**Version 0.9.0**

実行台帳：[Issue #68](https://github.com/SUSANO-OOO/Zombieee/issues/68)

主対象：

- Stage 17〜20
- Survival Mode
- 敵の右端・右端外spawnとsurvival防衛前線
- boss共通基盤、既存boss改修、新boss5体
- 通常感染体6種
- 新プレイアブル5名、合計16名
- RankからLevel 1〜50への統合
- Stage進行によるlevel cap
- 個人equipment2枠、戦術equipment2枠
- caps経済再編
- 出撃、部隊、補給所、記録へのUI再構成
- 詳細result、敵／boss図鑑、survival記録

新プレイアブル5名のidentity master portraitはプロデューサーが各1枚制作し、Codexへ直接提供します。Codexは受領portraitからevent、card、battle sprite等を派生制作します。

0.9.0の正式製品判断は[プロデューサー決定台帳](docs/PRODUCER_DECISIONS_0.9.0.md)を参照してください。

## 文書

| 文書 | 役割 |
|---|---|
| [AGENTS.md](AGENTS.md) | 恒久的な実装・検証・GitHub・release原則 |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | 現在のrelease、SHA、公開、次の正式作業 |
| [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) | 長期目標、Version順、Stage／unit拡張方針 |
| [docs/PRODUCER_DECISIONS_0.9.0.md](docs/PRODUCER_DECISIONS_0.9.0.md) | Version 0.9.0の製品判断と境界 |
| [docs/RELEASE_BACKUP_RECOVERY.md](docs/RELEASE_BACKUP_RECOVERY.md) | GitHub Pages公開、tag、Release、rollback、bundle |
| [docs/CHARACTERS_0.7.0.md](docs/CHARACTERS_0.7.0.md) | 既存人物、役割、加入、内部IDの履歴基準 |
| [docs/STORY_BIBLE_0.7.0.md](docs/STORY_BIBLE_0.7.0.md) | 世界観と物語構造の履歴基準 |
| GitHub Issue / PR | 承認、実行ログ、画像確認、QA証拠 |

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

`npm test`は本番buildを含みます。対象Versionでは、content validator、browser QA、save migration、performance gate等を追加実行します。

## 主要構成

- `app/AshfallGame.tsx`：戦闘、描画、入力、HUD
- `app/CampaignScreens.tsx`：タイトル、map、編成、隊員、会話、result
- `app/campaign.js`：stage、unit、reward、save
- `app/battleDefinitions.js`：mission、wave、勝敗
- `app/combatLifecycle.js`：target、死亡、感染、焼却
- `app/unitProgression.js`：現行Rank progression
- `app/storyEvents.js`：会話event
- `app/gameRules.js`：戦闘rule
- `public/`：画像・音声asset
- `tests/`：仕様・回帰test
- `.github/workflows/github-pages-release.yml`：正式GitHub Pages build・smoke・deployment

## 開発と公開

- 正式コードはGitHub `main`上のrelease SHAです。
- feature／integration branchはPR、CI、QA、画像確認を通過するまで候補です。
- `main`への直接push、force push、共有履歴rebase・amendは禁止です。
- 正式releaseは対象Versionの最終実プレイ受入とrelease contract通過後に行います。
- 公開後に重大不具合があれば、force操作ではなくrevert PRまたはimmutable release再deploymentで復旧します。
