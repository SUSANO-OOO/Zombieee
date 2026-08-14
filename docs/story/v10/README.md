# 西新世紀末物語 — v10正史台本・Version 1.0.0設計基準

更新日：2026-08-14  
GitHub取込元：Google Docs「西新世紀末物語｜イベント台本 v10（再監査・実装候補稿）」

## 1. 目的

このdirectoryは、PROLOGUEからStage 30、ENDING、EPILOGUEまでをVersion 1.0.0として実装する前に、次を混同せず固定する。

- 物語本文
- Producerの製品判断
- 現行gameとの差分
- SolのDesign／balance／asset mission
- Lunaへ渡す実装境界

台本をcodeへ貼り付け、Stage数を30に増やすだけでは完了しない。現行の20 Stage、進行、CAPS経済、unit解放、育成、支援、boss、画像、save、PWA、QAを30 Stage正史へ整合させるための設計基準として使用する。

## 2. 正本の優先順位

1. [`PRODUCER_DECISIONS_FINAL_RELEASE.md`](PRODUCER_DECISIONS_FINAL_RELEASE.md)  
   Version 1.0.0の製品判断、balance境界、Sol自動調整権限、変更禁止を所有する。
2. [`STORY_SCRIPT_V10.md`](STORY_SCRIPT_V10.md)と、そこから復元・hash検証したMarkdown全文  
   物語、台詞、人物弧、Stage接続、演出指示の正本。
3. Solが作成する最新Design Lock  
   architecture、data／state／event／asset contract、確定数値、PR分割、acceptanceを所有する。
4. [`STORY_IMPLEMENTATION_MAP.md`](STORY_IMPLEMENTATION_MAP.md)  
   台本と現行実装を照合した派生資料。上位正本を上書きしない。
5. [`CODEX_SOL_DESIGN_MISSION.md`](CODEX_SOL_DESIGN_MISSION.md)  
   ProducerがSegawa写真と一緒にSolへ送る一回限りの実行指示正本。
6. Google Docs版  
   閲覧、台詞review、共同編集用mirror。GitHub正本のhashを更新していない変更は実装正本にならない。
7. PDF／DOCX  
   PDFは表示確認、DOCXは編集交換用。実装正本にはしない。
8. 旧Story Bible、旧Issue、旧PR、旧台本  
   履歴、stable ID、再利用assetの調査用。v10と衝突する物語判断を優先しない。

恒久的な安全境界はrootの`AGENTS.md`、Sol／Lunaの順序は`docs/CODEX_TWO_THREAD_WORKFLOW.md`を優先する。

## 3. 原文完全性

- 取込日：2026-08-14
- 対象：PROLOGUE、Stage 1〜30、ENDING、EPILOGUE
- UTF-8 bytes：`138747`
- 行数：`2681`
- 原文SHA-256：`c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`
- bzip2 bytes：`33613`
- bzip2 SHA-256：`cf20d5637fb94c8a62abfc946980e3b03e94e3b318e5304e91b19d022c794815`
- base64 archive：15 part
- 原文先頭status：`全編再監査・世界観／人物導入ブラッシュアップ済み実装候補稿`
- Producer上の位置付け：完成リリース設計の基礎となる、完了済みストーリーライン

元Markdownは、単一request制約による欠落・文字化けを防ぐため、bzip2＋base64の15 partへ分割して`source/`へ保存している。復元するとGoogle DocsのMarkdown exportとbyte単位で一致する。

```bash
python docs/story/v10/reconstruct_story_v10.py /tmp/STORY_SCRIPT_V10.md
```

SolはDesign開始前にこの検証を通し、復元された全文を読む。Implementation Mapだけで原稿確認を代替しない。

## 4. 形式

### GitHubへ保存するもの

- hash検証できるMarkdown正本
- Producer Decisions
- implementation map
- Sol Design mission
- 正本復元・検証script
- Solが作成するDesign Lock／asset inventory／Luna Handoff

### GitHubへ重複保存しないもの

- PDF：73ページの表示確認用
- DOCX：編集交換用
- Google Docsの重複export一式
- Segawa face modelの原写真

Segawa写真はCodex promptへ直接添付し、Segawaのidentity referenceとしてだけ使用する。原写真、metadata、撮影背景をpublic repository、runtime、Issue、PRへ保存しない。derived event portraitだけを承認済みassetとして扱う。

## 5. 固定済みの主要判断

- 正式release：Version 1.0.0
- 初期unit：ハチ、パイセン、クマバーソン、ババヤガ
- balance class：7系統
- formation：最大7体
- battle active：最大7体、同じ固有characterは同時1体
- class構成：ソフト必須。特定character必須、hard quota、単一counterを禁止
- difficulty：hardcore寄りだがfair。hidden runtime DDAなし
- support：回復、爆薬ドラム缶、火炎ドラム缶から1種装備
- level cap：5／10／15／20／25／30、Stage 30 clear後35
- player名入力：追加しない。`{{PLAYER_NAME}}`は`指揮官`
- story上の参加：`合流`
- CAPSによる戦力化：`配属可能`→`配属準備`→`配属する`
- Segawa写真：セガワ本人のface identity reference
- `ナオキ`という別character／alias／IDは作らない
- 旧進行migration：不要。ただし旧save／backup削除禁止
- 旧player記念CAPS：Solが固定範囲内で自律算出し、一回だけ付与
- RED PANTHER正式名：Stage 27まで伏せる
- TAKUYAとTAKUYA-Ω：別boss identity／ID

詳細はProducer Decisionsを正本とする。

## 6. Solへ委任した事項

SolはProducer Decisionsの制約内で、次を自律確定する。

- unit combat stat／deployment cost／cooldown
- recruitment／upgrade／support cost
- Story外unitのunlock Stage
- Stage／star／replay CAPS
- wave／enemy／boss tuning
- support tuning
- bossの他mode追加先／threshold
- 旧player記念CAPS額
- threat tag／推奨class

これらを再度Producer decision待ちへ戻さない。deterministic simulation、before／after table、runtime evidenceを残す。

## 7. Asset production

`CODEX_SOL_DESIGN_MISSION.md`は、Design Lock完成後のasset candidate productionも事前承認している。

Solは次を満たした場合、追加promptを待たずに必要assetの候補生成・自己監査・authoring master選定まで進めてよい。

- finite asset inventory完成
- identity lock完成
- generation prompt／output spec完成
- acceptance／storage path／provenance完成
- Producer blocker 0

Solはproduction code／manifestへ統合しない。Lunaが承認済みassetを実装する。

## 8. 同期ルール

- 台本変更は専用branch／PRで行う。
- Google Docsだけを変更してGitHub正本を未更新のまま実装へ進まない。
- GitHubだけを変更した場合も、必要に応じてGoogle Docsへ意図的に同期する。
- 自動同期やsilent normalizationを行わない。
- 誤字、括弧、Markdown記法を原文取込commitで黙って直さない。editorial diffと根拠を残す。
- `source/`のpartを手編集しない。原稿変更時は全文からarchive、part、hashを再生成する。
- 旧`docs/STORY_BIBLE_0.7.0.md`等は履歴資料として保持する。

## 9. 原文上の未修正事項

次は原文に存在するが、取込時にsilent correctionしていない。

- Stage 12のザキミヤ台詞に閉じ括弧が一つ多い箇所
- 一部の`■ SYSTEM`太字記法の揺れ

次は製品判断として解決済み。

- `{{PLAYER_NAME}}`：`指揮官`へ固定解決
- 台本上の「加入」とCAPS：物語上は`合流`、gameplay上は`配属可能／配属準備`
- Segawa face reference：セガワ本人用。ナオキ関連は不採用

原文修正が必要な場合は、物語正本の別editorial PRで扱う。

## 10. このbaseline PRで行わないこと

- production code変更
- runtime asset統合
- 原写真保存
- save変更
- main直接commit
- merge、tag、Release、Pages公開
- test／acceptanceの弱体化

このbaselineがmainへ入った後、ProducerはSolへ`CODEX_SOL_DESIGN_MISSION.md`を実行する短いwrapperとSegawa写真だけを送る。
