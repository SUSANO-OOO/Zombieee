# 西新世紀末物語 — プロジェクト状態

更新日：2026-08-14

## 1. 現在の正式公開

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：**Version 0.9.9.5**
- tag：`v0.9.9.5`
- release／main SHA：`55d796cc577d1d9f903a4d2c6b4382196511db27`
- release tree：`0f8a5fb417ccca595d485d22c2c3cbe240b6ee28`
- final release PR：#167

Version 0.9.9.5はVisual Integrity release。release時点のIndependent Sol final reviewはHigh 0／Medium 0／Low 0、CI 1093／1093、Chromium／WebKit visual matrix、PWA update、save保持、offline launch、rollbackを確認済み。

`main` HEADは動的である。作業開始時はlive GitHubを再取得する。

## 2. 現行0.9.9.5基盤

- campaign：20 Stage
- playable unit：16体
- initial unit：6体
- formation：最大7枠
- progression：内部Level 50／現行player-facing cap 25
- story registry：`outbreak-origin-v8`
- mode：Campaign、Survival、異常発生
- save：localStorage、IndexedDB backup、replica reconciliation、last-known-good、corrupt recovery、manual export／import
- PWA：manifest、size／SHA-256、Cache Storage、generation commit、offline、rollback
- support：`pod／drum／medical`系と互換系が併存
- campaign `baseHp`：Stageごとに異なる
- timed-defense／escort：150〜210秒級を含む

## 3. 次の正式release target

- target：**Version 1.0.0**
- 対象：PROLOGUE、Stage 1〜30、ENDING、EPILOGUE
- 正史：v10 event script
- docs baseline：Draft PR #169
- branch：`docs/story-v10-final-release-baseline`
- production implementation：未着手
- runtime asset integration：未着手
- merge／tag／Release／Pages公開：未実施

## 4. Version 1.0.0の主要固定判断

正本：`docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`

- 初期unit：ハチ、パイセン、クマバーソン、ババヤガ
- primary role：frontline／heavy／skirmisher／marksman／suppression／support／engineer
- formation：最大7枠
- battle active：playable instance合計7体
- 同一character：複数回召喚可、複数体同時存在可
- 8体目だけをauthoritative stateで拒否
- class構成：soft requirement。特定character必須禁止
- 複数編成clear matrix／全Stage複数編成証明：不要
- mission：拠点破壊、短い時間防衛、必要時のみ電源switch／台車護衛、boss撃破
- timed-defense：90秒前後、原則75〜120秒、150秒以上は原則禁止
- boss：現行より強化。ただしdamage sponge／不可避即死は禁止
- campaign Level cap：30
- support：回復支援、爆薬ドラム缶、火炎ドラム缶から1種装備
- 走行車両HP：Stage別ばらつきを廃止しcanonical値へ統一
- 走行車両HP強化：CAPSによる上限付き恒久upgrade
- 走行車両強化screen：独立画面、中央に全体graphic、`HPを強化`、成功SE
- 主人公名入力：採用。skip時`指揮官`
- story上：`合流`
- gameplay上：`戦闘配備登録が解禁`／`配備登録`
- 旧進行：新30 Stageへmigrationしない。旧save／backup削除禁止
- 旧player：一度だけ正式release記念CAPS
- RED PANTHER：正式名はStage 27で初開示
- セガワ写真：セガワ本人のprivate identity reference
- TAKUYAとTAKUYA-Ω：別boss ID／identity／reward

## 5. Solへ委任するexact値

Solは固定guardrail内で次を自律確定する。

- unit／enemy／boss stats
- deployment cost／cooldown
- 配備登録／Level up／support cost
- 走行車両base HP／upgrade量／最大回数／cost curve
- exact unlock Stage
- Stage／star／replay CAPS
- wave／spawn／AI
- mission duration／escort speed／switch timing
- boss phase／telegraph／resistance／reward
- boss他mode配置
- 旧player記念CAPS

公開後runtimeのhidden DDAは禁止。

## 6. 実行体制

1. Producer／司令塔が正本と製品境界を固定
2. Solが`SOL_DESIGN`としてDesign Lock、必要asset inventory、Luna Handoffを作成
3. 必要assetはSolが事前承認範囲でcandidate生成・選定まで実施可能
4. Lunaがproduction implementation、asset integration、test、browser QA、Draft PR
5. 最初のSolが`SOL_FINAL_REVIEW`
6. High／Medium 0とrelease gate達成後だけmerge／公開

SolとLunaを同時並行に動かさない。

## 7. 必要最小限のrelease gate

- Stage 1〜30、ENDING、EPILOGUEをfinal candidateで一度通す
- 未配置object、missing asset、placeholder、speaker mismatch 0
- battle participantのsprite、animation、VFX、audioが接続済み
- 8体目を拒否し、同一character複数召喚を誤拒否しない
- 150秒以上の冗長な防衛／escortが理由なく残っていない
- 走行車両HPが全Stageでcanonical＋upgradeから算出される
- 走行車両強化screen、CAPS、save、SEが接続済み
- CAPS、reward、unlock、receiptの二重適用なし
- save、offline、PWA update、rollback、旧player特典が正常
- 844×390、844×340、1280×720で切れ、重なり、豆粒化、操作不能なし
- console／page／HTTP／request failureなし
- High／Medium finding未解消0

複数編成clear matrix、全Stageの複数編成証明、不要な大量evidence、監査専用Issue／文書は作成しない。

## 8. 恒久禁止

- `main`直接push
- force push／rebase／amend
- 既存tag移動
- 旧save／backup／asset削除
- cache全削除をmigration手段にすること
- provenance不明assetの正式採用
- test／acceptanceの実装都合による弱体化
- Sol／Luna同時並行
- セガワ原写真のpublic repository／artifact保存
