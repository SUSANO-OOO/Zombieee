# Version 0.9.5 Producer acceptance correction evidence

更新日：2026-07-31  
対象branch：`codex/0.9.5-acceptance-corrections`  
製品修正commit：`dcf8fbc0baa665c9c7563b559385d1fa97e34ea1`  
証拠harness commit：`dad88d7963311f0eafe1305f86cb84a354daff5d`  
連続比較harness commit：`3f41f87bff7d4565eaa88a5e20f12d10b97c25b3`  
integration base：`5bc0d6b26dbad46501e7f1677af9a3d409dd20dc`

## 正本

唯一の実行正本はIssue #96の
[監査改訂済み最新コメント](https://github.com/SUSANO-OOO/Zombieee/issues/96#issuecomment-5124971857)
（comment ID `5124971857`）である。

本書と[`acceptance-summary.json`](./acceptance-summary.json)は、
technical RC時点の許容判断を上書きするProducer acceptance correctionの
証拠である。過去RCの`opacity 0.72 → 1`を演出として許容した判断は採用しない。

## 結論

P0-1〜P0-9は9/9 passした。製品実装の最終production distは
recursive SHA-256
`2d88fb68d12d8592c44f33f98fd2410c8b241720fbcf690c6bd53dbcf7e4507b`
へ固定した。

現在の受入reportとhistorical contextを含む計23本のreportは
[`report-lock.json`](./report-lock.json)でpathとSHA-256を固定し、
製品修正commit以後にplayer-facing product fileが変わっていないことを
generatorが検証する。build identityを持つ10本のdirect reportは、
start／end／現在の`dist`が同じrecursive SHAでなければ生成を拒否する。

## P0受入結果

| 項目 | 結果 |
|---|---|
| P0-1 出撃時の透過 | canonical 576/576、unit-layer 96 case／192 frame、修正前後の連続16 case／192 frame、修正後opacity 1 |
| P0-2 Crazy King active表示 | lifecycle 2/2、pause中継続とbattle復帰を分離確認 |
| P0-3 全16体manual表示 | browser 6 case、各16 ready icon、activation 32、lifecycle category 8、diagnostic 0 |
| P0-4 Raider | 右向き攻撃、左retarget、wind-up／active／recovery成立 |
| P0-5 Baba Yaga SE | runtime再生、dedupe、相対音量、gain 0.95、clip 0 |
| P0-6 全16体walk／slide | canonical 576/576、16/16でwalk-a＋walk-b、通常攻撃96/96 |
| P0-7 cart／AI | 12/12、terminal recovery・route release・攻撃再開・damage成立 |
| P0-8 横断AI | Stage 1〜20を120/120、infected 6種・36 lifecycle category、完了activation 53 |
| P0-9 正式小型cart | 480×168 asset、72 decoded frame、geometric fallback 0 |

出撃追加証拠は全16体について、door内部、境界、ramp、出口、着地、
combat-readyの6段階を、修正前後それぞれ同一runで連続captureした。
修正前は固定integration SHA `5bc0d6b`の96 frame中34 frameで透過し、
最小pose opacityは約0.7346だった。修正後96 frameはpose opacity、
effective opacity、animation opacityがすべて1で、接地とunit-layer
auditもpassした。

[全16体・修正前後の出撃6段階](./all-sixteen-deployment-sequence.png)

[全16体・修正前後の歩行／方向転換／攻撃6段階](./all-sixteen-walk-before-after.png)

[player-facing correction集約](./player-facing-corrections.png)

各比較は全16体で`BEFORE`と`AFTER`を同一viewport・同一方向・同一局面へ
揃え、画像ごとのSHA-256をsummaryへ記録した。`BEFORE`はtechnical RCの
視覚文脈であり、最終build拘束の合否証拠には使用しない。`AFTER`、
修正後出撃6段階、数値matrixを正式受入に使う。

## 横断監査

- enemy／VFX：6/6、projectile transaction 24、CRAWLER transaction 6
- CRAWLER defense：240/240、pass-through 0、objective direct 0
- battle space：4/4
- combat presentation：4/4、deferred impact 36、Baba lethal proof 4
- Survival：6/6、atomic retry receipt `0 → 1 → 1 → 2`
- Outbreak：6/6
- asset decode：audio 399/399、portrait 34/34、image 58/58
- save／origin：Version 0.9.0 schema 13 → schema 14、78/78、
  once／idempotent、fresh／破損復旧／export／import
- 雇用／マヨちゃん：雇用6/6、Survival Wave 20 runtime entry 2/2

AI 120件と一部feature reportは旧schemaのためreport内にrecursive build
hashを持たない。これらはreport自身のSHA-256、製品source commit、
現在のdist hash、製品commit以後の変更pathを`report-lock`で固定する。
build hashを内蔵するdirect reportと同じ暗号学的主張は行わない。

## Performance

| 条件 | median | p95 | max gap | retained heap | memory proxy | simulation | render |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0.9.0 baseline | 16.7 ms | 16.7 ms | 50.0 ms | +3.27% | +0.00% | 計測なし | 59.90 Hz |
| corrected通常stress／Auto 15分 | 16.7 ms | 16.8 ms | 83.3 ms | +8.48% | +0.00% | 60.01 Hz | 44.67 Hz |
| corrected Wave 20／Auto 15分 | 16.7 ms | 33.4 ms | 116.7 ms | +6.58% | -18.71% | 60.01 Hz | 38.21 Hz |
| corrected Wave 20／省電力 15分 | 16.7 ms | 16.8 ms | 66.7 ms | +6.29% | -19.93% | 60.01 Hz | 30.00 Hz |

3条件はbattle coverage 100%、gate pass、browser diagnostic 0だった。
Wave 20のAutoと省電力はengine、viewport、DPR、duration、初期fixture、
harness設定、最終wave／HP／生存数／receiptを実dataで比較し、
gameplay outcome一致を確認した。攻撃sequence差は2%以内である。

render work proxy
`render frame × DPR cap² × effect density`は55,703.70から12,958.08へ
76.74%低下した。これは物理GPU消費電力や端末温度の直接測定ではない。

## Static validation

- production build：pass
- 全test：758/758 pass
- Lint：pass
- content validation：pass
- `git diff --check`：pass
- evidence helper focused test：8/8 pass

証拠生成後、全test、Lint、production build契約、`git diff --check`を
PR前に再確認する。production buildの再実行でrandom deployment UUIDを
含むrecursive hashを変えないため、同じ製品sourceに対する既存成功buildを
固定している。

## LAN試遊

- URL：`http://192.168.1.19:4173/`
- bind：`0.0.0.0:4173`
- process：PID `16524`
- 2026-07-31 JSTにlocalhost／LANのHTTP 200を確認

release preparation前のためHTML release identityは正式公開中の0.9.0を
維持する。0.9.5正式identityはrelease-prep PRで更新する。LAN、localhost、
GitHub Pagesは別originであり、saveは自動共有されない。

## 未確認の物理端末範囲

次は確認済みと断定しない。

- 物理smartphoneの発熱
- native Safari
- 実speakerの聴感
- 物理touch、safe area、回転、tab／画面lock、BFCache
- Stage 14〜20の物理端末play

代替証拠はChromium／WebKit、844×390／844×340／1280×720、
frame time、heap／memory proxy、mobile lifecycle diagnosticである。
mobile lifecycleはcapability-gap pass 4、failure 0、diagnostic 0。
