# 西新世紀末物語

西新・早良区周辺を再構成した区域で、生存者部隊と移動拠点CRAWLERを指揮するリアルタイムCanvas戦略・防衛ゲームです。

## プレイ

**正式URL：<https://susano-ooo.github.io/Zombieee/>**

正式公開先はGitHub Pagesだけです。現在の正式公開版は**Version 0.9.8.2**です。ChatGPT Sitesは旧公開先であり、公開・QA・正式判定には使用しません。

主対象はスマートフォン横画面です。844×390、844×340、iPhone Safariのsafe areaとブラウザUI表示状態を優先し、PC横画面も正式対応します。

## Version 0.9.9.0 release candidate

Version 0.9.9.0は[Issue #136](https://github.com/SUSANO-OOO/Zombieee/issues/136)を実行正本とする戦闘体験・音響・演出・app iconの品質更新です。

- selection／confirm／back／purchase／upgrade／reward／deploy／rejectのUI操作SE
- durable save成功後だけ成立する雇用・強化feedback
- normal／pressure／bossの戦況別BGM
- 全16unitの固有ability activation／timeline／ready audio
- boss entrance／defeat、explosion、drum arrival、CRAWLER／barrage／airstrike presentation
- Producer承認A2による感染者face app icon
- 0.9.8.2 save schema v14、PWA全件install、active／previous、rollback、offlineの維持

PR1〜PR4は`integration/0.9.9.0`へ統合済みで、release-prepと最終監査中です。**まだ正式公開版ではありません。** 別チャットのSol Auditor Finding 0とProducer Gate Bの「公開してよい」という明示承認前に、main merge、tag、Release、Pages正式公開は行いません。

詳細は[Version 0.9.9.0 Release Notes](docs/RELEASE_NOTES_0.9.9.0.md)と[PROJECT_STATE](docs/PROJECT_STATE.md)を参照してください。

## 現行ゲーム

- Campaign Stage 1〜20、Survival、異常発生任務5件
- playable 16名、最大7枠、3 formation presets
- 全16体のmanual ability、Level 1〜50基盤、equipment
- 通常感染体6種、既存boss改修、新boss5体
- CRAWLER deployment、戦場物資、航空支援、一斉掃射
- localStorage／IndexedDB、migration snapshot、last-known-good、recovery、export／import
- PWA初回全件download、size／SHA-256検証、Cache Storage、manifest commit
- offline、差分update、active／previous generation、rollback

## 文書

| 文書 | 役割 |
|---|---|
| [AGENTS.md](AGENTS.md) | 恒久的な実装・検証・GitHub・release原則 |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | 現在の正式release、RC、SHA、公開境界 |
| [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) | 長期目標、Version順、Stage／unit拡張方針 |
| [docs/RELEASE_NOTES_0.9.9.0.md](docs/RELEASE_NOTES_0.9.9.0.md) | 0.9.9.0の変更、save／PWA互換、QA、Gate B境界 |
| [docs/RELEASE_BACKUP_RECOVERY.md](docs/RELEASE_BACKUP_RECOVERY.md) | GitHub Pages公開、tag、Release、rollback |
| [docs/PLAYABLE_UNIT_ABILITIES_0.9.0.md](docs/PLAYABLE_UNIT_ABILITIES_0.9.0.md) | 全16体のmanual ability仕様 |
| GitHub Issue / PR | 製品判断、承認、実行ログ、QA証拠 |

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
npm run content:validate
git diff --check
```

`npm test`はproduction buildを含みます。release candidateではChromium／WebKit、PWA full install／update／rollback／offline、save migration、audio／VFX／iconのbrowser QAも実行します。

## 主要構成

- `app/AshfallGame.tsx`：戦闘、描画、入力、HUD
- `app/CampaignScreens.tsx`：タイトル、map、編成、隊員、会話、result
- `app/productionAudio.js`：production cue／scene registry
- `app/battleAudioRuntime.js`：semantic receipt／delayed cue runtime
- `app/battlePresentationV099.js`：0.9.9.0 presentation state
- `app/pwaRuntime.js`：PWA runtime／generation管理
- `public/asset-manifest.json`：全件install manifest
- `public/sw.js`：Service Worker
- `tests/`、`scripts/*browser-smoke.mjs`：仕様・browser回帰

## 開発と公開

- 正式コードはGitHub `main`上のrelease SHAです。
- feature／integration branchはPR、CI、QA、Producer gateを通過するまで候補です。
- `main`直接push、force push、共有履歴rebase・amend、既存tag移動は禁止です。
- 正式releaseはfinal main PRのmerge result SHAへ固定します。
- 公開後の重大不具合はrevert PRまたはimmutable release再deploymentで復旧します。
