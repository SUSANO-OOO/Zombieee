# 西新世紀末物語 — v10正史台本・Version 1.0.0設計基準

更新日：2026-08-14  
GitHub取込元：Google Docs「西新世紀末物語｜イベント台本 v10（再監査・実装候補稿）」

## 1. 目的

このdirectoryは、PROLOGUEからStage 30、ENDING、EPILOGUEまでをVersion 1.0.0として実装する前に、物語正本、Producer判断、現行gameとの差分、Sol Design mission、Luna実装境界を分離して固定する。

台本をcodeへ貼り付け、Stage数を30へ増やすだけでは完了しない。campaign、battle、CAPS、unit、Level、support、boss、走行車両、asset、save、PWA、QAを一体として扱う。

## 2. 正本の優先順位

1. [`PRODUCER_DECISIONS_FINAL_RELEASE.md`](PRODUCER_DECISIONS_FINAL_RELEASE.md)
2. [`STORY_SCRIPT_V10.md`](STORY_SCRIPT_V10.md)から復元・hash検証したv10全文
3. Solが作成する最新Design Lock
4. [`STORY_IMPLEMENTATION_MAP.md`](STORY_IMPLEMENTATION_MAP.md)
5. [`CODEX_SOL_DESIGN_MISSION.md`](CODEX_SOL_DESIGN_MISSION.md)
6. Google Docs版
7. PDF／DOCX
8. 旧Story Bible、旧Issue、旧PR、旧台本

恒久的な安全境界はroot `AGENTS.md`、Sol／Luna順序は`docs/CODEX_TWO_THREAD_WORKFLOW.md`を優先する。

## 3. 原文完全性

- 対象：PROLOGUE、Stage 1〜30、ENDING、EPILOGUE
- UTF-8 bytes：`138747`
- 行数：`2681`
- 原文SHA-256：`c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`
- bzip2 bytes：`33613`
- bzip2 SHA-256：`cf20d5637fb94c8a62abfc946980e3b03e94e3b318e5304e91b19d022c794815`
- archive：15 part

復元：

```bash
python docs/story/v10/reconstruct_story_v10.py /tmp/STORY_SCRIPT_V10.md
```

SolはImplementation Mapやpromptだけでなく、復元された全文を読む。

## 4. GitHubへ保存するもの

- hash検証可能なMarkdown正本
- Producer Decisions
- Implementation Map
- Sol Design Mission
- 復元script
- SolのDesign Lock／asset inventory／Luna Handoff

GitHubへ重複保存しないもの：

- PDF
- DOCX
- Google Docsの重複export
- セガワface model原写真

セガワ原写真、metadata、撮影背景はpublic repository、Issue、PR、CI artifact、QA evidence、logへ保存しない。

## 5. 固定済みの主要判断

- 正式release：Version 1.0.0
- 初期unit：ハチ、パイセン、クマバーソン、ババヤガ
- primary role：7系統
- formation：最大7枠
- battle active：playable instance合計7体
- 同一character：複数回召喚可、複数体同時存在可
- 8体目だけをauthoritative stateで拒否
- class構成：soft requirement。特定character必須禁止
- 複数編成clear matrix／全Stage編成証明：不要
- mission：拠点破壊、短い時間防衛、必要時のみ電源switch／台車護衛、boss撃破
- 時間防衛：90秒前後、原則75〜120秒、150秒以上は原則禁止
- boss：現行より強化。ただしdamage sponge／不可避即死は禁止
- campaign Level cap：30
- support：回復支援、爆薬ドラム缶、火炎ドラム缶から1種装備
- 走行車両HP：Stage別ばらつきを廃止しcanonical値へ統一
- 走行車両強化：CAPSによる上限付き恒久HP強化
- 走行車両強化screen：中央に全体graphic、`HPを強化`、強化SE
- 主人公名入力：採用。skip時`指揮官`
- story上：`合流`
- gameplay上：`戦闘配備登録が解禁`／`配備登録`
- 旧進行migration：不要。旧save／backup削除禁止
- 旧player記念CAPS：一度だけ
- RED PANTHER正式名：Stage 27まで伏せる
- セガワ写真：セガワ本人のprivate identity reference
- TAKUYAとTAKUYA-Ω：別boss ID／identity

詳細はProducer Decisionsを正本とする。

## 6. Solへ委任したexact調整

SolはProducer Decisionsの範囲内で、次を自律確定する。

- unit／enemy／boss stats
- deployment cost／cooldown
- 配備登録／Level up／support cost
- 走行車両base HP／upgrade量／最大回数／cost curve
- exact unlock Stage
- Stage／star／replay CAPS
- wave／spawn／AI
- mission duration／escort speed／switch timing
- boss phase／telegraph／resistance／reward
- boss他mode追加先
- 旧player記念CAPS

巨大な複数scenario報告は不要。標準進行の一本の計算表と、不足／過剰の境界確認でよい。

## 7. Asset production

finite inventory、identity lock、prompt、storage、provenance、acceptanceが揃った後、Solは事前承認済み範囲で`NEW_REQUIRED` assetのcandidate生成、自己監査、authoring master選定まで進めてよい。

- existing assetを先に監査
- 不要なvariant量産禁止
- failed candidateをruntimeへ入れない
- production統合はLuna担当

## 8. 同期ルール

- 台本変更は専用branch／PR。
- Google Docsだけを変更してGitHub正本を未更新のまま実装へ進まない。
- `source/` partを手編集しない。
- 誤字等を原文取込commitでsilent correctionしない。
- 旧Story Bibleは履歴資料として保持する。

## 9. 原文上の未修正事項

- Stage 12のザキミヤ台詞に閉じ括弧が一つ多い箇所
- 一部`■ SYSTEM`太字記法の揺れ

必要なら別editorial diffで扱う。

## 10. このbaseline PRで行わないこと

- production code変更
- runtime asset統合
- セガワ原写真保存
- save変更
- main直接commit
- merge、tag、Release、Pages公開
- test／acceptance弱体化
- 冗長な検証資料の量産

このbaselineを基準に、ProducerはSolへ`CODEX_SOL_DESIGN_MISSION.md`の実行指示とセガワ写真だけを送る。
