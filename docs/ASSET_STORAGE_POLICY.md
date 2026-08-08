# Runtime asset／authoring master policy

更新日：2026-08-08

## 目的

Zombieeeのruntime配布物とauthoring用の原版を分離し、manifest、Service Worker、Cache Storage、provenanceが指す配布assetを明確にする。公開配布の整理を行うが、既存Git履歴の書き換え、mass LFS移行、既存assetの一括移動・削除は行わない。

## 保存場所

- `public/`：production runtimeで配布するassetだけを置く。参照パスはasset manifestまたはshell cacheの契約に所属させる。
- `assets/source/`、`reference/`：authoring master、reference、alternate、生成中間物を置く。これらをruntime URLやPWA manifestへ直接追加しない。
- 各runtime asset familyは、端末で再生・表示するpreferred playable sourceを1件に固定する。重複形式を追加する場合は対象端末・fallback理由とbytesを記録する。

## provenance

新規または変更する正式assetには、少なくとも次を記録する。

- source、creator、license
- 商用利用、改変、再配布の可否
- producer approval
- master SHA-256、output SHA-256
- runtime asset count、logical bytes、distinct bytes

ライセンス不明素材は正式runtimeへ採用しない。単一masterが25 MiB以上、または同一familyが100 MiB以上になる場合は、commit前にProducer／storage Design reviewへ停止する。

## 変更・検証契約

- PR本文または対象Issueへruntime asset count、distinct bytes、manifest／audio bundle driftを記録する。
- `npm run content:validate`、asset manifest検証、必要なbundle検証を実行する。
- Service Worker、save、cache generation、release identityからruntime assetを参照する場合は、変更前後のcontract testを追加する。
- 既存assetの削除、上書き、履歴移行を容量削減だけの理由で行わない。
