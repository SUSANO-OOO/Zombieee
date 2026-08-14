# 西新世紀末物語 — v10正史台本・正式リリース設計基準

更新日：2026-08-14  
GitHub取込元：Google Docs「西新世紀末物語｜イベント台本 v10（再監査・実装候補稿）」

## 1. このディレクトリの目的

このディレクトリは、PROLOGUEからStage 30、ENDING、EPILOGUEまでを正式リリースへ実装する前に、物語の正本、Producer判断、現行実装との差分、Solへの設計依頼を混同せず固定する。

台本の内容をコードへ直接貼り付けるだけでは完了しない。現行の20 Stage、進行、CAPS経済、ユニット解放、育成、支援物資、ボス解放、画像契約、save、PWA、QAを、30 Stage正史へ整合させるための設計基準として使用する。

## 2. 正本の優先順位

この正式リリース計画では、次の順で参照する。

1. [`PRODUCER_DECISIONS_FINAL_RELEASE.md`](PRODUCER_DECISIONS_FINAL_RELEASE.md)  
   Producerが明示した製品判断、変更禁止、未決定事項を所有する。
2. [`STORY_SCRIPT_V10.md`](STORY_SCRIPT_V10.md)  
   物語、台詞、人物弧、Stage接続、演出指示の正本。本文を無断で要約・補完・修正しない。
3. Solが作成する最新のDesign Lock  
   実装architecture、data/state/event/asset contract、PR分割、acceptanceを所有する。
4. [`STORY_IMPLEMENTATION_MAP.md`](STORY_IMPLEMENTATION_MAP.md)  
   v10台本と2026-08-14時点の現行実装を照合した派生資料。上位正本を上書きしない。
5. Google Docs版  
   閲覧・台詞レビュー・共同編集用。GitHub版へ反映していない変更は実装正本にならない。
6. PDF／DOCX  
   PDFは表示確認、DOCXは編集交換用。実装正本にはしない。
7. 旧Story Bible、旧Issue、旧PR、旧台本  
   履歴・既存ID・再利用可能資産の調査用。v10と衝突する物語判断を優先しない。

恒久的な開発安全境界はルートの`AGENTS.md`、Sol/Lunaの順序は`docs/CODEX_TWO_THREAD_WORKFLOW.md`を引き続き優先する。

## 3. 取込記録

- 取込日：2026-08-14
- 取込形式：Google DocsからMarkdown export
- 取込ファイル：`STORY_SCRIPT_V10.md`
- UTF-8 bytes：138,747
- 行数：2,681
- SHA-256：`c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`
- 原文先頭ステータス：`全編再監査・世界観／人物導入ブラッシュアップ済み実装候補稿`
- Producer上の位置付け：正式リリース設計の基礎となる、完了済みストーリーライン

台本自身のステータス表現とProducerの今回の位置付けを両方保存する。取込時に本文を「完成稿」へ書き換えない。

## 4. 形式の扱い

### GitHubへ保存するもの

- Markdown正本
- Producer Decisions
- 実装差分マップ
- Sol向けDesign mission

### GitHubへ保存しないもの

- PDF：73ページの表示確認用。binaryで差分監査に不向き
- DOCX：編集交換用。binaryで差分監査に不向き
- Google Docsの重複export一式

PDF／DOCXをGit管理しないことは、内容を捨てることではない。実装で参照する文章はMarkdownへ一本化し、表示確認と編集交換は外部成果物として分離する。

## 5. 同期ルール

- 台本変更は専用branch／PRで行う。
- Google Docsだけを変更してGitHub正本を未更新のまま実装へ進まない。
- GitHubだけを変更した場合も、必要に応じてGoogle Docsへ意図的に同期する。
- 自動同期やsilent normalizationは行わない。
- 台本上の誤字、括弧、Markdown崩れを発見しても、原文正本と同じcommitで黙って直さない。別のeditorial diffとして根拠を残す。
- 古い`docs/STORY_BIBLE_0.7.0.md`等は削除しない。履歴資料として保持する。

## 6. 取込時に確認した未修正事項

次は原文に存在するが、取込時には修正していない。

- Stage 12のザキミヤ台詞に閉じ括弧が一つ多い箇所
- 一部の`■ SYSTEM`太字記法の揺れ
- 主人公名入力`{{PLAYER_NAME}}`を導入するv10と、旧Story Bibleの「主人公名入力なし」の衝突
- 台本上の「加入」表示と、Producerが求めるStage進行後のCAPS購入制との意味の衝突
- Producerが挙げた「ナオキ」がv10本文に登場せず、セガワとの関係も本文からは確定できない点

これらはSolが勝手に直す項目ではない。Design Lockで影響を特定し、台本修正が必要ならProducer decisionとして返す。
