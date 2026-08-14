# 西新世紀末物語 — プロジェクト状態

更新日：2026-08-14

## 1. 現在の正式公開

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：Version 0.9.9.5
- release／main基準SHA：`55d796cc577d1d9f903a4d2c6b4382196511db27`
- release tree：`0f8a5fb417ccca595d485d22c2c3cbe240b6ee28`
- annotated tag：`v0.9.9.5`

live `main`、PR HEAD、checksは作業開始時に再取得し、本文の固定値を永久に最新として扱わない。

## 2. 次の正式release target

- target：Version 1.0.0
- 対象：PROLOGUE、Stage 1〜30、ENDING、エンドロール、EPILOGUE
- 正史：v10 event script
- docs baseline：Draft PR #169
- branch：`docs/story-v10-final-release-baseline`
- production implementation：未着手
- runtime asset integration：未着手
- main merge／tag／Release／Pages公開：未実施

## 3. Version 1.0.0固定事項

- player-facing車両名：**装甲車両**。`走行車両`不採用、`CRAWLER`は内部互換のみ
- 主人公名：ニューゲーム後・PROLOGUE前に入力。fallback`指揮官`。全event、log、save、ENDING／EPILOGUEへ反映し後から変更可能
- 主人公：無言だが実操作で物語を動かす
- event phase：prologue／pre／post／first-clear-post／ending／epilogue。戦闘中の長いstory eventなし
- 初期unit：ハチ、パイセン、クマバーソン、ババヤガ
- primary role：frontline／heavy／skirmisher／marksman／suppression／support／engineer
- formation最大7、battle active合計7、同一character複数召喚可
- mission：拠点破壊、短い時間防衛、必要時だけswitch／台車、boss
- campaign Level cap：30
- support：回復支援、爆薬ドラム缶、火炎ドラム缶
- 装甲車両HP：canonical base＋恒久upgrade。専用強化screen、atomic transaction、強化SE
- RED PANTHER正式名はStage 27で初開示
- セガワ写真はセガワ専用private identity reference。原写真をpublic Git／artifactへ保存しない
- TAKUYA-Ωは既存TAKUYAの連続性を保つカオスな最終形態
- 旧campaign進行は移行しないが、旧save／backupは削除しない
- 複数編成clear matrix、大量evidence、監査専用Issueを作らない

exact stats、cost、reward、duration、wave、unlock、装甲車両upgrade curve、boss他mode配置、旧player記念CAPS額は、固定guardrail内でSolが自律確定する。

## 4. 実行体制

1. Producer／司令塔が正本と製品境界を固定
2. 元のSol threadが`SOL_DESIGN`
3. SolがDesign Lock、有限asset inventory、必要asset candidate、Luna Handoffを作成
4. Lunaが`LUNA_IMPLEMENTATION`としてproduction実装、asset統合、tests、browser QA、Draft PR
5. Luna Completion Packetを元のSolへ返す
6. 元のSolが`SOL_FINAL_REVIEW`
7. High／Medium 0とrelease gateを満たした場合だけmerge／公開

SolとLunaを同時並行に動かさない。

## 5. 現在のblocker

PR #169はdocs-onlyのDraftで未merge。branchの正本文書とPR本文をVersion 1.0.0最新決定へ揃え、checksを再確認するまでmergeしない。

CIではlint、production content validation、build、testsが成功していても、PWA partial-update recovery等のrequired checkが失敗している場合はgreen扱いしない。Design開始は可能だが、merge／Release承認は不可。

## 6. Release gate

次が残る場合、完成／APPROVE／READY_FOR_RELEASEとしない。

- 名前入力からStage 1〜30、ENDING、エンドロール、EPILOGUEの通し未確認
- raw name token、unknown speaker、speaker／portrait mismatch
- 未配置object、missing asset、placeholder、未完成animation／VFX／audio
- 7体上限の迂回、同一character複数召喚の誤拒否
- 150秒以上の冗長な通常防衛／escort
- 装甲車両HPのStage別ばらつき、強化screen／transaction未接続
- CAPS、reward、unlock、event、receiptの二重適用
- save、offline、PWA update、rollbackの破壊
- 844×390、844×340、1280×720で切れ、重なり、豆粒化、操作不能
- High／Medium finding未解消