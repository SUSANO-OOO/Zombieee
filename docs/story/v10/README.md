# 西新世紀末物語 — v10正史・Version 1.0.0設計基準

更新日：2026-08-14

## 1. 目的

PROLOGUEからStage 30、ENDING、エンドロール、EPILOGUEまでをVersion 1.0.0として実装する前に、物語本文、Producer判断、現行gameとの差分、Sol mission、Luna実装境界を固定する。

## 2. 正本の優先順位

1. [`PRODUCER_DECISIONS_FINAL_RELEASE.md`](PRODUCER_DECISIONS_FINAL_RELEASE.md)
2. [`STORY_SCRIPT_V10.md`](STORY_SCRIPT_V10.md)から復元・hash検証した全文
3. Solが作成する最新Design Lock
4. [`STORY_IMPLEMENTATION_MAP.md`](STORY_IMPLEMENTATION_MAP.md)
5. [`CODEX_SOL_DESIGN_MISSION.md`](CODEX_SOL_DESIGN_MISSION.md)
6. live code／tests／assets／save／PWA
7. Google Docs mirror
8. PDF／DOCX
9. 旧Story Bible、旧Issue、旧PR、旧台本

root `AGENTS.md`とSol／Luna workflowは恒久安全境界として併用する。

## 3. 原文完全性

- UTF-8 bytes：`138747`
- lines：`2681`
- SHA-256：`c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`
- archive：15 part

```bash
python docs/story/v10/reconstruct_story_v10.py /tmp/STORY_SCRIPT_V10.md
```

Solは復元後、PROLOGUEからEPILOGUEまで全文を読む。要約資料だけで本文確認を代替しない。

## 4. 固定済み主要判断

- 正式release：Version 1.0.0
- player-facing車両名：**装甲車両**。`走行車両`不採用、`CRAWLER`は内部互換のみ
- 主人公名：ニューゲーム後・PROLOGUE前に入力、fallback`指揮官`、全event／save／ENDING／EPILOGUEへ反映、後から変更可能
- 主人公：無言だが実操作で物語を動かす
- 初見player：人物、世界、ムガリアン、任務、次Stage理由を過去Versionなしで理解可能
- event：prologue／pre／post／first-clear-post／ending／epilogue。戦闘中の長いstory eventなし
- 初期unit：ハチ、パイセン、クマバーソン、ババヤガ
- formation最大7、battle active合計7、同一character複数召喚可
- role：7系統、特定character必須とclass hard block禁止
- mission：拠点破壊、短い時間防衛、必要時だけswitch／台車、boss
- Level cap：30
- support：回復支援、爆薬ドラム缶、火炎ドラム缶から1種
- 装甲車両HP：全Stageでcanonical base＋恒久upgrade
- 装甲車両強化：専用screen、atomic CAPS／save、チャリンチャリン系SE
- RED PANTHER：Stage 27で正式名開示、四兵種
- セガワ写真：セガワ専用private identity reference。原写真をGit／artifactへ保存しない
- TAKUYA-Ω：既存TAKUYAを継承したカオスな最終形態
- 旧進行migration不要、旧save／backup削除禁止
- 冗長な複数編成証明／大量evidence禁止

## 5. GitHubへ保存するもの

- hash検証できる台本正本
- Producer Decisions
- Implementation Map
- Sol Mission
- 復元script
- Sol Design Lock／asset inventory／Luna Handoff

GitHubへ保存しないもの：PDF、DOCX、Google Docs重複export、セガワ原写真。

## 6. このbaseline PRで行わないこと

- production code変更
- runtime asset統合
- save変更
- main直接push
- merge、tag、Release、Pages公開
- test／acceptance弱体化