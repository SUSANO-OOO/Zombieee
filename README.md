# 西新世紀末物語

西新・早良区周辺を再構成した区域で、生存者部隊と移動拠点CRAWLERを指揮するリアルタイムCanvas戦略・防衛ゲームです。

## プレイ

**正式URL：<https://susano-ooo.github.io/Zombieee/>**

正式公開先はGitHub Pagesだけです。現在の正式公開版は**Version 0.9.9.0**です。ChatGPT Sitesは旧公開先であり、公開・QA・正式判定には使用しません。

- release SHA：`19a79404822ebc8f0cbd8a3b809b8ed0adbc28af`
- release tree：`305af62474c8a1ea118251023ec4ad58bee17975`
- annotated tag：`v0.9.9.0`
- 実行台帳：Issue #136（completed）

主対象はスマートフォン横画面です。844×390、844×340、iPhone Safariのsafe areaとブラウザUI表示状態を優先し、PC横画面も正式対応します。

## Version 0.9.9.0

Version 0.9.9.0は、戦闘体験・音響・演出・app iconの品質更新です。

- selection／confirm／back／purchase／upgrade／reward／deploy／rejectのUI操作SE
- durable save成功後だけ成立する雇用・強化feedback
- normal／pressure／bossの戦況別BGM
- 全16unitの固有ability activation／timeline／ready audio
- boss entrance／defeat、explosion、drum arrival、CRAWLER／barrage／airstrike presentation
- Producer承認A2による感染者face app icon
- save schema v14、PWA全件install、active／previous、rollback、offlineの維持
- final independent audit：High 0／Medium 0／Low 0

公開後QAでは1280×720、844×390、844×340、fresh／schema v13／schema v14 save、title→map→loadout→assets ready→battle、主要障害fixtureを確認し、console／page／HTTP／request failureは0でした。

物理iPhone本体speakerの聴感と発熱は未確認の残存QAです。自動WebKit結果を物理実機確認済みとは扱いません。

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

## 開発運用

今後の実装は、原則として次の責務分離で進めます。

1. Producerが主目的と製品境界を固定
2. **Sol Design Lead**が実装設計を担当
3. **Luna Implementation Lead**がSol設計を正本として実装
4. Design Leadとは別コンテキストの**Sol Auditor**が固定HEADをread-only監査
5. High／Medium未解消0と対象Versionのrelease gateを満たした場合だけmerge／公開へ進む

Codexの`/goal`は、時間の長短ではなく**複数工程・複数checkpoint・反復検証をまたいで同じ目標を追う必要があるmission**で使用します。Version／featureの正式設計、複数moduleをまたぐ実装、実装→QA→修正→PR、audit remediation、release工程等ではSolとLunaがそれぞれ独立した`/goal`を使います。一方、read-only確認、単発test、typo修正、設計判断を伴わない小さな単一file修正等は通常promptで処理できます。詳細な判定基準は[AGENTS.md](AGENTS.md)を正本とします。

## 文書

| 文書 | 役割 |
|---|---|
| [AGENTS.md](AGENTS.md) | 恒久的な役割分担、`/goal`、実装・検証・GitHub・release原則 |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | 現在の正式release、SHA、QA、次工程境界 |
| [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) | 長期目標、Version順、Stage／unit拡張方針 |
| [docs/RELEASE_NOTES_0.9.9.0.md](docs/RELEASE_NOTES_0.9.9.0.md) | 0.9.9.0の正式変更、save／PWA互換、QA、残存物理端末境界 |
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

`npm test`はproduction buildを含みます。release candidateではChromium／WebKit、PWA full install／update／rollback／offline、save migration、対象Version固有のbrowser QAも実行します。

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
