# 西新世紀末物語

西新・早良区周辺を再構成した区域で、生存者部隊と移動拠点CRAWLERを指揮するリアルタイムのCanvas戦略・防衛ゲームです。

## プレイ

**正式URL：<https://susano-ooo.github.io/Zombieee/>**

正式公開先はGitHub Pagesだけです。ChatGPT Sitesは旧公開先であり、今後の公開・QA・正式判定には使用しません。

主対象はスマートフォン横画面です。844×390、844×340、iPhone Safariのsafe areaとブラウザUI表示状態を優先し、PC横画面も正式対応します。

## Version 0.9.0 release source

**Version 0.9.0**

- Stage 1〜20と異常発生任務
- 無限wave、checkpoint、3択強化を備えたSurvival Mode
- プレイアブル16名と、全16体の個体別手動アビリティ
- 通常感染体6種、boss共通基盤、既存boss改修、新boss5体
- Level 1〜50基盤と、Stage 20時点でLv25までの通常解放
- 個人equipment2枠、編成preset別の戦術equipment2枠、約20種の装備
- caps経済再編、詳細result、敵／boss図鑑、戦績記録
- smartphone横画面向けの出撃・部隊・補給所・記録UI

Version 0.9.0はrelease SHA `f2633c538756385f13d166d3adbcdd39b3a08b21`をannotated `v0.9.0`、GitHub Release、GitHub Pagesへ正式公開済みです。公開request IDは`v0.9.0-formal-release-20260729`です。

正確なrelease SHA、tag、Issue、公開metadataは[PROJECT_STATE](docs/PROJECT_STATE.md)を確認してください。

## Version 0.9.0の実行記録

実行台帳：[Issue #68](https://github.com/SUSANO-OOO/Zombieee/issues/68)

主な統合内容：

- Stage 17〜20
- Survival Mode
- 敵の右端・右端外spawnとsurvival防衛前線
- boss共通基盤、既存boss改修、新boss5体
- 通常感染体6種
- 新プレイアブル5名、合計16名
- 全16体の頭上ready icon式・個体別手動アビリティ
- RankからLevel 1〜50への統合
- Stage進行によるlevel cap
- 個人equipment2枠、戦術equipment2枠
- caps経済再編
- 出撃、部隊、補給所、記録へのUI再構成
- 詳細result、敵／boss図鑑、survival記録

新プレイアブル5名のidentity master portraitはプロデューサー提供の正式画像を使用し、event、card、battle sprite等へ展開しています。

0.9.0の正式製品判断は[プロデューサー決定台帳](docs/PRODUCER_DECISIONS_0.9.0.md)、プレイアブル側の個別能力と頭上UIは[手動アビリティ仕様](docs/PLAYABLE_UNIT_ABILITIES_0.9.0.md)を参照してください。

## Version 0.9.5の開発

Version 0.9.5は[Issue #96](https://github.com/SUSANO-OOO/Zombieee/issues/96)を実行台帳とし、smartphone性能、全16体の戦闘アニメーション、VFX、敵／boss／CRAWLER、0.9.0残存不具合、雇用UX、マヨちゃん解放、save migrationを一つの品質更新として進めます。

最上位の製品判断は[Version 0.9.5プロデューサー決定台帳](docs/PRODUCER_DECISIONS_0.9.5.md)です。docs-only PRを`main`へ通常mergeした結果から`integration/0.9.5`を作成し、工程branch／Draft PRを段階統合します。

`integration/0.9.5 → main`、`v0.9.5` tag、GitHub Release、GitHub Pages正式deployment、Issue #96 closeは別承認まで行いません。PWA、Service Worker、offline／install対応はVersion 0.9.6へ分離します。

## 文書

| 文書 | 役割 |
|---|---|
| [AGENTS.md](AGENTS.md) | 恒久的な実装・検証・GitHub・release原則 |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | 現在のrelease、SHA、公開、次の正式作業 |
| [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) | 長期目標、Version順、Stage／unit拡張方針 |
| [docs/PRODUCER_DECISIONS_0.9.5.md](docs/PRODUCER_DECISIONS_0.9.5.md) | Version 0.9.5の製品判断とrelease境界 |
| [docs/PRODUCER_DECISIONS_0.9.0.md](docs/PRODUCER_DECISIONS_0.9.0.md) | Version 0.9.0の製品判断と公開履歴 |
| [docs/PLAYABLE_UNIT_ABILITIES_0.9.0.md](docs/PLAYABLE_UNIT_ABILITIES_0.9.0.md) | 全16体の手動アビリティ、ready icon、個体別cooldown、新5体の戦闘仕様 |
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
- `app/unitProgression.js`：Level progression
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
