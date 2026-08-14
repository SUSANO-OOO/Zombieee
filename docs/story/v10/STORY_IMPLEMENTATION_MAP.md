# v10正史台本 — Version 1.0.0実装差分マップ

更新日：2026-08-14  
性質：**派生資料。台本本文・Producer Decisions・最新Design Lockを上書きしない。**

## 1. 物語の軸

v10は次の流れで進む。

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

## 3. Mission design

台本のト書きを新しい複雑なgame systemへ膨らませない。正式版の基本missionは次だけ。

1. 敵拠点を破壊
2. 一定時間、走行車両／防衛対象を守る
3. 必要なStageだけ電源switchを順次起動
4. 必要なStageだけ台車／搬送objectを移動・護衛
5. boss撃破

現行codeにはすでにassault、timed-defense、escort、sequential-sealがある。これを再利用・整理する。

### Duration

現行には150、165、180、195、210秒の防衛／escortがある。Version 1.0.0ではそのまま踏襲しない。

- 時間防衛：90秒前後
- 原則：75〜120秒
- 150秒以上：原則禁止
- escort：距離、速度、waveをまとめて短縮
- boss：原則hard time limitなし

## 4. Unit deployment

- formationは最大7枠。
- 戦場同時出現上限はplayable instance合計7体。
- 同一characterを複数回召喚してよい。
- 同一characterの複数体同時存在も許可する。
- 8体目だけをbattle stateで拒否する。
- 走行車両、NPC、escort、mission object、support object、敵は7体枠外。
- 独立HP／target／damageを持つplayer-controlled summonは7体枠内。

同一character一体制限、unique active contract、同一unit二重召喚拒否は不採用。

## 5. Class・balance

Primary role：

- frontline
- heavy
- skirmisher
- marksman
- suppression
- support
- engineer

- 初期4体：ハチ、パイセン、クマバーソン、ババヤガ。
- exact named unit必須は禁止。
- class不足で出撃をhard blockしない。
- 脅威categoryと推奨roleを簡潔に表示する。
- bossは現行より強くし、HPだけでなくphase、pressure、telegraph、resistanceを調整する。
- 低cost複数召喚は許可するが、総数7体、cost、cooldown、敵構成で混成編成にも価値を持たせる。

複数編成ごとのclear証明、通常Stage3編成／boss2編成matrixは作成しない。

## 6. Level・CAPS・unlock

- campaign表示最大Level：30。
- cap：5／10／15／20／25／30。
- story上は`合流`、system上は`戦闘配備登録が解禁`、CAPS操作は`配備登録`。
- ナオ：Stage 1後。
- ザキミヤ：Stage 12後。
- TKY：Stage 14後。
- Mrs.チハ：Stage 17後。
- 宮本武蔵：Stage 20後。
- Stage 8開始までに7 roleへアクセス可能。
- Stage 20までに現行16 playable unitを発見済みまたは配備登録可能。
- mandatory replay grindは禁止。

CAPSはunit、Level、equipment、support、走行車両HP強化へ配分する。Solは標準進行の一本の計算表と不足／過剰の境界だけを確認する。

## 7. 走行車両HP

現行campaignの`baseHp`はStageごとに1000、850、760、720、520等へばらついている。Version 1.0.0では統一する。

- campaign全Stageで一つのcanonical base HPを使用。
- battle開始時最大HPはcanonical base HP＋恒久upgrade分。
- Stage難度はenemy、wave、boss、objectiveで作る。
- escort台車、civilian、電源設備等は別HP。
- exact base HP、upgrade量、最大回数、CAPS curveはSolが決定。

## 8. 走行車両強化screen

### Entry

拠点／管理画面上部付近に`走行車両を強化する`入口を置く。

### Dedicated screen

- 中央に走行車両の全体graphicを大きく表示。
- 車体を切らない。
- 現在Level、現在HP、強化後HP、必要CAPS、所持CAPSを表示。
- main action：`HPを強化`。
- 最大時：`強化上限`。
- 844×390／844×340で車両、数値、buttonが重ならない。
- 既存full vehicle graphicを優先再利用。

### Transaction・SE

- CAPS減算、upgrade、receipt、saveをatomic処理。
- durable save成功後だけ成功演出とSE。
- 二重tap、reload、multiple tabs、retryで二重処理禁止。
- 成功時はHP上昇表示、車体の控えめな反応、チャリンチャリンと分かる金属的な強化SE。
- 既存SEが適合すれば再利用。不足時だけ専用SE。
- CAPS不足、上限、save失敗では成功SEを鳴らさない。

## 9. Support

正式支援：

1. 回復支援
2. 爆薬ドラム缶
3. 火炎ドラム缶

- 出撃前に1種装備。
- CAPSで恒久解禁。
- battle内はlocal resource／cooldown。
- `pod`は通常loadoutから外す。
- 航空支援／一斉砲撃は走行車両固有abilityとして分離。

## 10. 新規asset

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
| 走行車両強化screen | 不要 | 既存全体graphicを優先 | 不要 |

セガワ原写真をrepository、Issue、PR、artifact、evidenceへ保存しない。

## 11. Save

- 新campaign generation／namespaceでニューゲーム。
- 旧20 Stage進行を移行しない。
- 旧save、backup、manual export、last-known-goodを削除しない。
- 旧player記念CAPSは一度だけ。
- 走行車両upgrade Level／receiptを新saveへ保存。
- replica、import、multiple tabsで二重upgrade／二重特典を防ぐ。

## 12. 必要最小限のacceptance

- 30 Stageのobjective、duration、wave、boss、unlockが接続済み。
- 8体目reject、同一character複数召喚allow。
- 走行車両HPが全Stageでcanonical＋upgradeから算出。
- 走行車両強化screen、CAPS transaction、save、SEが接続済み。
- 章bossとStage 30のbalance spot check。
- final candidateでStage 1〜30、ENDING、EPILOGUEを一度通す。
- save、offline、PWA update、rollback、旧player特典を確認。
- 844×390、844×340、1280×720で主要導線を確認。
- missing asset、placeholder、speaker mismatch 0。

不要な複数編成証明、大量evidence、監査専用Issue／文書は作らない。
