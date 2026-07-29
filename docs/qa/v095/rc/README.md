# Version 0.9.5 RC evidence

更新日：2026-07-30  
対象branch：`codex/0.9.5-rc`  
RC開始時integration SHA：`9c576b1acb89c5b05a47213fa0c8f450b8d6136c`

## 結論

Version 0.9.5 RC候補は、全16体の通常攻撃とmanual ability、VFX、
enemy、boss、CRAWLER、0.9.0残存不具合、雇用・解放・save導線、
smartphone向け描画負荷をplayer-facing runtimeで検証した。

正式公開はVersion 0.9.0のままである。Version 0.9.5は
`integration/0.9.5`までのRCであり、`main`最終merge、tag、Release、
GitHub Pages正式deployment、Issue #96 closeは行わない。

## Player-facingで成立した内容

- 全16体の通常攻撃とmanual abilityを、実battle画面で個別のwind-up、
  active、recovery、weapon cue、VFX、方向、接地として確認した。
- 通常enemy 12種、projectile 4種、boss、CRAWLERのdoor／fire／hit／
  critical／repairを実runtimeで確認した。
- 「調達」を「雇用」へ統一し、雇用可能popup、queue、durable receipt、
  「雇用画面へ」「あとで」を実画面で確認した。
- マヨちゃんはSurvival Wave 20到達で雇用可能になり、boss撃破不要、
  260 caps、既存解放維持、二重通知・二重取得なしを確認した。
- save schema v14で、正式公開版由来save、fresh save、破損復旧、
  localStorage／IndexedDB、origin分離、export／importを検証した。

## 出撃時の透過問題

残存不具合browser QAは96/96 pass、連続384 frameで実damage 96、
左向き攻撃96、論理／視覚off-floor 0、接地failure 0、composited
CRAWLER transparent pixel 0、diagnostic 0だった。

WebKitでraw Canvasだけを透明背景のままsampleしていた旧QAの
false positiveと、CRAWLERの合成境界を分離して修正・再検証した。
player-facingの最終合成画面では、combat-ready後のunit／CRAWLERは
完全表示、接地、正しい方向、visible cue後のdamageを満たす。

unitの出撃演出そのものは意図した表現としてpose opacityを
およそ0.72から1へ遷移させる。これは戦闘中に意図せず半透明のまま
残る不具合とは区別する。

## Performance比較

| 条件 | median frame | p95 frame | max gap | retained heap | memory proxy | simulation | render |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0.9.0 baseline | 16.7 ms | 16.7 ms | 50.0 ms | +3.27% | +0.00% | 計測なし | 59.90 Hz |
| 0.9.5 RC 通常stress／Auto 15分 | 16.7 ms | 16.8 ms | 66.7 ms | +2.21% | +0.00% | 60.01 Hz | 44.93 Hz |
| 0.9.5 RC Survival Wave 20／Auto 15分 | 33.3 ms | 33.4 ms | 100.0 ms | +3.61% | -16.91% | 60.01 Hz | 32.64 Hz |
| 0.9.5 RC Survival Wave 20／省電力 15分 | 16.7 ms | 16.8 ms | 66.7 ms | +14.15% | -17.33% | 60.01 Hz | 30.00 Hz |

全RC条件はgate pass、battle coverage 100%、diagnostic 0だった。
Wave 20のAuto／省電力は、同じ844×390、emulated DPR3、18 human、
24 persistent enemy、10 battlefield object、15分で比較した。双方とも
再準備0、Wave 20 `in-wave`を維持し、最終attack sequenceはhuman
11,490／11,488、enemy 17,040／17,039で、画質設定によるgameplay
outcome差はなかった。

同一scenarioのrender work proxy
`render frame × DPR cap² × effect density`はAuto 47,592.36、
省電力12,958.08で、72.77%低下した。このproxyはpixel密度、effect量、
render回数を合わせた相対比較であり、物理GPU消費電力の直接測定ではない。
省電力はsimulation 60.01 Hzを保ちながらrenderを30.00 Hzへ抑えた。
max gapは0.9.0 baselineより増えたが100 ms以内で、p95、heap、
memory proxyを含むRC gateは通過した。

これはdesktop Chromium／headless WebKitの代替証拠であり、物理端末の
発熱低下を確認済みとは扱わない。

## 全16体animation証拠

- unit：16
- browser case：8
- continuous-frame capture：708
- normal attack runtime proof：144
- manual ability special／recovery proof：100
- browser、ground anchor、visual off-floor、weapon cue failure：各0

[全16体animation contact sheet](./all-sixteen-animation-evidence.png)

## VFX、enemy、boss、CRAWLER証拠

- enemy／VFX browser case：6/6
- 通常enemy：12種
- projectile：4種、production transaction 24
- CRAWLER：6状態、production transaction 6
- continuous sequence：24
- boss foundation：12/12、anomaly：18/18
- CRAWLER defense：240/240、pass-through 0、objective direct 0

[VFX・enemy・boss・CRAWLER contact sheet](./vfx-enemy-boss-crawler-evidence.png)

## Browser QA集計

| 対象 | 結果 |
|---|---:|
| 代表6体 | 4/4 |
| 残り10体 | 4/4 |
| enemy／VFX | 6/6、diagnostic 0 |
| 残存不具合 | 96/96、diagnostic 0 |
| 雇用／マヨ解放 | 8/8 |
| save migration／origin | 78/78、matrix 6/6 |
| mobile lifecycle | 4/4 passed with capability gaps、failure 0 |
| asset decode | audio 399/399、portrait 34/34、image 57/57 |
| CRAWLER defense | 240/240 |
| battle space | 4/4 |
| boss foundation／anomaly | 12/12、18/18 |
| Survival Wave 1→5 | Chromium／WebKit 2/2 |
| Outbreak settlement | 6/6 |
| combat presentation | 4/4 |

machine-readable集計とraw evidenceのSHA-256は
[`rc-summary.json`](./rc-summary.json)に固定した。

## LAN試遊

- URL：`http://192.168.1.19:4173/`
- bind：`0.0.0.0:4173`
- 起動process：PID `11552`
- origin：GitHub Pages、localhostとは別save
- status：2026-07-30 07:57 JST、最終production build後にlocalhost／
  LAN双方HTTP 200、production HTML 9,648 bytes、title表示、
  `data-save-environment="lan"`、exact origin、console／page error 0を確認

正式release identityは別承認までVersion 0.9.0へ固定するため、browser
titleは「アーリーアクセス版 0.9.0」のままである。LAN画面は
「LAN試遊」とexact originを表示し、本READMEとbranch／SHAで0.9.5 RCを
識別する。これは0.9.5のtag／Release／正式deploymentを先取りしないため
の境界である。

LANのIPはhostのnetwork変更で変わり得る。producer確認時は本hostと
smartphoneを同じtrusted LANへ接続し、URLが開かない場合は最新IPv4を
再取得する。

## 物理端末へ残す確認

物理smartphoneの発熱、native Safari、実speaker聴感、物理touch、
safe area、回転、tab／画面lock復帰、BFCacheは未確認である。
desktop frame time、heap／memory proxy、Playwright WebKit、
mobile lifecycle diagnosticを代替証拠とし、正式release前に
[`PHYSICAL_SMARTPHONE_CHECKLIST.md`](./PHYSICAL_SMARTPHONE_CHECKLIST.md)
をproducerが実施する。
