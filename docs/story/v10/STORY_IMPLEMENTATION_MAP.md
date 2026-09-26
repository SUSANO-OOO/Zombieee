# v10正史台本 — Version 1.0.0実装差分マップ v2

更新日：2026-08-14  
性質：**派生資料。Producer Decisions、v10本文、最新Design Lockを上書きしない。**

## 1. 物語の軸

1. 目の前の一人を助ける
2. 救助を成立させる経路、病院、物流、封鎖網を取り戻す
3. 災害を実験・商品化へ利用したムガリアンとセガワを断つ
4. TAKUYA-Ωを倒し、西新へ生活を戻す

ENDINGは世界全体の完全救済ではない。西新の安全回廊、病院、食事、店の灯りが戻る一方、外部の危機は残る。

## 2. 主要Stage接続

| Stage | 主要内容 | Boss／合流／開示 |
|---:|---|---|
| 1 | 商店街でいくらちゃん救出 | ナオ配備登録解禁 |
| 2 | 区役所の最後の避難 | 回復支援解禁候補 |
| 3 | 西新防衛線 | TAKUYA、赤レンズ部隊が遺骸回収 |
| 4〜5 | 西新駅 | 改札喰い、医療case |
| 6〜10 | 保守トンネル〜T計画 | 病院地下とムガリアンの痕跡 |
| 11 | 検体隔離区画 | MOTHER |
| 12 | 搬送坑道 | ザキミヤ合流・配備登録解禁 |
| 13 | 物流線 | セガワ初登場 |
| 14 | 貨物退避場 | オオグチ、TKY合流・配備登録解禁 |
| 15〜16 | 外郭制御〜中央封鎖 | チハ生存確認、封鎖解除 |
| 17 | 湾岸タワー | クロメ、Mrs.チハ合流・配備登録解禁 |
| 18〜19 | 市民資料館〜海浜連絡橋 | 家族生存確認、証拠搬送 |
| 20 | 河口防潮門 | ガイレン、宮本武蔵合流・配備登録解禁 |
| 21〜23 | ムガリアン本部 | 赤レンズ人型部隊、チハの過去 |
| 24 | 技術開発塔 | フタゴ、社長とセガワの対立 |
| 25 | 役員研究所 | 変異ムガリアン社長 |
| 26 | 撤収ヤード | セガワの観測が発覚 |
| 27 | 私設研究区画 | RED PANTHER正式名、TAKUYA回収の意味 |
| 28 | 全国散布管制網 | 次の都市への散布停止 |
| 29 | 特級研究中枢 | 感染源原株破壊、TAKUYA-Ω起動 |
| 30 | 西新防衛線 | TAKUYA-Ω、セガワ死亡、中和因子 |

## 3. 主人公名・event

- ニューゲーム選択後、PROLOGUE前に主人公名を入力。未入力／skipは`指揮官`。
- 1〜12 grapheme、安全なtext描画、save／backup／export／import／log／replay／ENDING／EPILOGUEへ同じ値を使用。
- 設定から変更可能だが、既読、receipt、報酬、加入、unlockを再発火させない。
- `{{PLAYER_NAME}}`をv10本文の敬称・呼称どおりに展開し、raw tokenを残さない。
- 主人公は無言の傍観者ではなく、進路、救助、端末、装甲車両、接続／遮断、散布系統破壊、最終連携の実操作を担う。
- event phaseは`prologue／pre／post／first-clear-post／ending／epilogue`。
- 戦闘中の長いstory eventは使わない。
- 基本flowは`pre → 編成 → 戦闘 → result → post → unlock／reward`。
- 初見playerが人物、世界、ムガリアン、現在目的、次Stage理由を理解できるよう段階導入する。

## 4. Mission・duration

1. 敵拠点破壊
2. 短い時間防衛
3. 必要なStageだけ電源switch
4. 必要なStageだけ台車／搬送object護衛
5. boss撃破

時間防衛は90秒前後、原則75〜120秒。150秒以上は原則禁止。escortは距離、速度、waveをまとめて短縮し、bossへ不自然なhard time limitを置かない。

TAKUYAの主目標：

- Stage 3：`大型変異感染者TAKUYAを撃破`
- Stage 30：`TAKUYA-Ωを撃破し、西新を守る`

## 5. Unit・balance

- 初期4体：ハチ、パイセン、クマバーソン、ババヤガ。
- role：frontline／heavy／skirmisher／marksman／suppression／support／engineer。
- formation最大7枠、戦場active合計7体。
- 同一characterの複数召喚・同時存在を許可し、8体目だけを拒否。
- 装甲車両、NPC、escort、mission object、support object、敵は7体枠外。
- exact named unit必須、class不足hard block、複数編成clear matrixは禁止。
- bossはHPだけでなくphase、pressure、telegraph、resistanceで現行より強化。
- campaign Level capは5／10／15／20／25／30。
- mandatory replay grindは禁止。

## 6. CAPS・unlock・support

- CAPSは配備登録、Level、equipment、support、装甲車両HP強化へ使用。
- ナオStage 1後、ザキミヤStage 12、TKY Stage 14、Mrs.チハStage 17、宮本武蔵Stage 20後に配備登録解禁。
- Stage 8開始までに7 roleへアクセス可能、Stage 20までに現行16unitを発見済みまたは登録可能。
- supportは回復支援、爆薬ドラム缶、火炎ドラム缶から1種装備。
- 航空支援／一斉砲撃は装甲車両固有ability。
- exact値は標準進行の一本の計算表と不足／過剰境界でSolが決定。

## 7. 装甲車両

- 全campaign Stageで一つのcanonical base HPを使用。
- battle開始時最大HPはcanonical base HP＋恒久upgrade分。
- escort台車、civilian、電源等は別HP。
- 拠点／管理画面上部に`装甲車両を強化する`入口。
- 専用screen中央に車両全体graphic、現在Level、現在HP、強化後HP、必要CAPS、所持CAPS、`HPを強化`、`強化上限`を表示。
- CAPS減算、upgrade、receipt、saveをatomic処理し、durable save成功後だけ車体反応とチャリンチャリン系SEを出す。

## 8. 新規asset

| Asset | Event portrait | Full-body／master | Battle atlas |
|---|---:|---:|---:|
| ムガリアン社長 | 必須 | 推奨 | 不要 |
| 変異ムガリアン社長 | 必須 | 必須 | 必須 |
| セガワ | 必須 | 推奨 | 不要 |
| RED PANTHER近接兵 | 汎用可 | 必須 | 必須 |
| RED PANTHER盾兵 | 汎用可 | 必須 | 必須 |
| RED PANTHER SMG兵 | 汎用可 | 必須 | 必須 |
| RED PANTHER指揮官兵 | 必須候補 | 必須 | 必須 |
| TAKUYA-Ω | 必須 | 必須 | 必須 |
| 装甲車両強化screen | 不要 | 既存全体graphicを優先 | 不要 |

セガワ原写真をrepository、Issue、PR、artifact、evidenceへ保存しない。

TAKUYA-Ωは既存TAKUYAの顔・頭部・体格・特徴、橙色安全vest残骸、人工armor、背面投薬管を継承し、不均衡な異常肥大、左右非対称、肉体とarmorの融合、投薬暴走、崩れたsilhouetteを加える。単なる巨大化、色違い、無関係な別monster、綺麗な近未来robotは不合格。exact scaleは連続性、ラスボス圧力、mobile readability、telegraph、hitbox、performanceを満たす値をSolが決定する。

## 9. Save・QA

- 新campaign generation／namespaceでニューゲーム。
- 旧20 Stage進行は移行しないが、旧save、backup、manual export、last-known-goodを削除しない。
- 主人公名、event read／resume、装甲車両upgrade Level／receiptを新saveへ保存。
- reward、star、unlock、CAPS、event、upgradeの二重適用を防ぐ。
- final candidateで名前入力からStage 1〜30、ENDING、エンドロール、EPILOGUEを一度通す。
- 844×390、844×340、1280×720、save、offline、PWA update、rollbackを確認。
- missing asset、placeholder、unknown speaker、speaker／portrait mismatch、raw token 0。

不要な複数編成証明、大量evidence、監査専用Issue／文書は作らない。