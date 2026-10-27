# 西新世紀末物語 — 現在状態

確認日：2026-10-26。これは確認時点の索引です。操作前にはGitHubと正式URLを再取得してください。

## 配信とソース

| 対象 | 確認結果 |
|---|---|
| 正式URL | https://susano-ooo.github.io/Zombieee/ |
| 配信HTML | Version **1.0.5**、HTTP 200、release SHA `ff5dba24e88c810182cda1f044bd26dfc3e512c1` |
| tag／Release | [v1.0.5](https://github.com/SUSANO-OOO/Zombieee/releases/tag/v1.0.5)、上記merge結果SHAへ固定 |
| 配信 | [Pages 40222966999](https://github.com/SUSANO-OOO/Zombieee/actions/runs/40222966999) 成功 |
| 公開後技術確認 | [40223310211](https://github.com/SUSANO-OOO/Zombieee/actions/runs/40223310211)、[旧1.0.3の実profile更新 40224749512](https://github.com/SUSANO-OOO/Zombieee/actions/runs/40224749512) 成功 |
| v1.0.4 | tag／Releaseは保持。[Pages 40064619979](https://github.com/SUSANO-OOO/Zombieee/actions/runs/40064619979) はsmoke中にcancel、deploy未開始。内容はPR #181の1.0.5へ引継ぎ |
| main | 配信後の運用・文書改修を含められる。main HEAD自体を配信済みと判断しない |

v1.0.5の公開は完了しています。これは全製品課題や実機受入の完了を意味しません。1.0.3から更新する利用者向けの累積変更は[Release notes](https://github.com/SUSANO-OOO/Zombieee/releases/tag/v1.0.5)で案内します。

## 作業と残件の入口

- **製品の継続課題・証拠・未確認： [Issue #177](https://github.com/SUSANO-OOO/Zombieee/issues/177)**。公開済みの[PR #181](https://github.com/SUSANO-OOO/Zombieee/pull/181)と[PR #180](https://github.com/SUSANO-OOO/Zombieee/pull/180)の履歴を保持します。
- **開発運用の整理： [Issue #182](https://github.com/SUSANO-OOO/Zombieee/issues/182)**。ゲーム仕様・人物・素材・saveの意味を変えず、公開版を維持する作業です。この作業のための新release／Pages配信はしません。
- 依存更新PRは製品・build・検証runtimeの影響を分けて判断します。Playwright／WebKit固定とvinext補修を、一括更新で無条件に置き換えません。

物理iPhoneで保存した画面録画のBGM／SE、実speaker聴感、発熱、物理インストール／操作、人間の最終実プレイ評価は未確認です。Issue #177と[音声残件 #24](https://github.com/SUSANO-OOO/Zombieee/issues/24)、[実機PWA #161](https://github.com/SUSANO-OOO/Zombieee/issues/161)を、技術合格だけで閉じません。技術的な録音・decode成功は人間の聴感確認ではありません。

過去S14／S30の30秒読取失敗は履歴を保持します。後始末で画面を閉じた後のsave取得失敗を、別のsave破損と確定していません。後続の通常プレイ成功は元の間欠障害の原原因確定とは区別します。

## 製品判断と指示の参照順

1. ユーザーの最新の明示判断。
2. [Producer Decisions FINAL_RELEASE](story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md)の新しい日付付き追記。現行動作・衣装・能力の五点は2026-10-24追記。短時間の頭上技名は文字だけで、旧非表示指定をこの範囲で上書きしています。
3. [1.0.3由来の継続判断](PRODUCER_DECISIONS_1.0.3.md)のうち後続指示で変更されていない人物・音・save等の条件。
4. 対象Issue／PRの実行状態と、[AGENTS](../AGENTS.md)・[公開／復旧手順](RELEASE_BACKUP_RECOVERY.md)の安全境界。
5. 現行コード・test・原証拠。不一致があれば仕様をコードへ合わせず、原因と影響を台帳へ記録する。

v10の正史・人物・30作戦の判断は維持します。[旧ロードマップ](PRODUCT_ROADMAP.md)の「V1=50stage／30unit」や、旧Sol／Luna・Design Lockは歴史資料です。新たな製品仕様や実行義務として復活させません。

## 確認結果の扱いと履歴

v1.0.5では対象五点の修正、影響する動作映像、通常プレイ、Phase G、正式Mac ARM性能と公開後save／PWA技術確認を、各実owner・条件で記録しています。正式High性能はrAF間隔p95が33ms以下・中央値の換算50FPS以上となる30秒測定を維持します。描画cadenceは各viewportの既定graphics profileに既存の許容幅（±10%、最低±3Hz）で照合し、Highは通常60Hz、スマホ横画面は画質を維持して45Hz描画です。診断用Intelや過去候補の成功と混同しません。判定の実装は `scripts/browser-performance-budget.mjs` と `app/renderPerformance.js`、数字・原本・再利用条件はIssue #177と `docs/qa/v105/` の証拠索引を参照します。

従来の巨大な状態文書は、当時の記述を保った[状態履歴](PROJECT_STATE_HISTORY_PRE_20261026.md)へ移しました。「未公開」「実行中」「現在」等は各記録当時の表現です。今の状態や新規作業の許可をそこから判断しないでください。存在しない `outputs/completion/tatara-ground-review-r1/native-last4s.mp4` の古いリンクは、現時点で復元を確認できない過去証拠として扱います。

旧[Sol役割](CODEX_SOL_ROLE.md)・[Luna役割](CODEX_LUNA_ROLE.md)・[二チャット手順](CODEX_TWO_THREAD_WORKFLOW.md)は当時の記録です。通常の修正や運用改修に、固定モデル・逐次承認・新Design Lockを追加する根拠にしません。
