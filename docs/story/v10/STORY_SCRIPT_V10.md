# v10正史台本 — GitHub正本入口

このファイルは、Google Docsから取り込んだ`西新世紀末物語｜イベント台本 v10（再監査・実装候補稿）`の**正本入口と完全性manifest**である。

台本本文は、GitHub取込時の単一requestサイズ制約で欠落・文字化けを起こさないよう、元のUTF-8 bytesをbzip2圧縮し、base64化した15個の連番partとして`source/`へ保存している。要約版ではない。復元するとGoogle DocsのMarkdown exportとbyte単位で一致する。

## 1. 原文

- 編集・閲覧用Google Docs：`https://docs.google.com/document/d/1xa-fXQlTZ8vTYdjoOuaA2ZGbiRNFL5EJcxE-D2rOmFM/edit`
- 対象範囲：PROLOGUE、Stage 1〜30、ENDING、EPILOGUE
- UTF-8 bytes：`138747`
- 行数：`2681`
- 原文SHA-256：`c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`
- bzip2 bytes：`33613`
- bzip2 SHA-256：`cf20d5637fb94c8a62abfc946980e3b03e94e3b318e5304e91b19d022c794815`
- base64 part数：`15`

## 2. 復元

標準libraryだけで復元・検証できる。

```bash
python docs/story/v10/reconstruct_story_v10.py /tmp/STORY_SCRIPT_V10.md
```

shellだけで復元する場合：

```bash
cat docs/story/v10/source/STORY_SCRIPT_V10.md.bz2.base64.part* \
  | tr -d '\n\r\t ' \
  | base64 --decode \
  | bzip2 --decompress \
  > /tmp/STORY_SCRIPT_V10.md

shasum -a 256 /tmp/STORY_SCRIPT_V10.md
# c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4
```

SolはDesign開始前に復元scriptを実行し、表示された原文SHA-256、bytes、linesが上記と一致することを確認してから、復元された全文を読むこと。`STORY_IMPLEMENTATION_MAP.md`だけを読んで台本本文を読んだ扱いにしてはならない。

## 3. 正本運用

- 物語、台詞、人物弧、Stage接続、演出指示は復元されたMarkdown本文を正本とする。
- `STORY_IMPLEMENTATION_MAP.md`は本文から導いた実装補助資料であり、本文を上書きしない。
- Google Docsは共同編集・台詞確認用mirror。Google Docsだけを変更してGitHubのSHAを更新しないまま実装へ進まない。
- PDFは73ページの表示確認用、DOCXは編集交換用であり、Git上の実装正本にはしない。
- 誤字、括弧、Markdown記法の揺れを見つけても、この取込commitでsilent correctionしない。別のeditorial diffとProducer判断を残す。
- `source/`のpartを個別に手編集しない。原稿変更時は、変更済みMarkdown全文から全partとhashを再生成する。

## 4. 連番part

`source/STORY_SCRIPT_V10.md.bz2.base64.part01`から`part15`までを、ファイル名昇順で連結する。欠番、重複、順序変更があれば復元・hash検証を失敗させる。
