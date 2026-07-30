# 西新世紀末物語 — Version 0.9.5 プロデューサー決定台帳

更新日：2026-07-31  
状態：**製品判断ロック済み・Producer acceptance correction完了・正式公開承認済み**

## 1. 正式な目的

Version 0.9.5は、正式公開中のVersion 0.9.0を基準に、次の品質改善を一つの更新として完成させる。

**スマートフォンで長時間遊びやすくする  
→ 全16体の戦闘アニメーションと攻撃の手応えを刷新する  
→ VFX、敵、boss、CRAWLER、戦場描画を磨く  
→ 0.9.0の残存表示・出撃不具合を横断修正する  
→ 雇用・解放・save導線を明確で魅力的にする**

foundation、state名、testだけを増やして完成扱いにしない。実際のplayer-facing画面で、動き、VFX、SE、接地、方向、攻撃timing、性能が成立することを完成条件とする。

## 2. 正本と所有範囲

参照順：

1. 本書
2. Issue #96
3. `AGENTS.md`
4. `docs/PROJECT_STATE.md`
5. `docs/PRODUCT_ROADMAP.md`
6. `docs/CHATGPT_HANDOFF.md`
7. 最新`main`のコード、tests、QA記録

本書は固定された製品判断を所有する。Issue #96は工程順、進捗、検証証拠、未解決事項を所有する。本Issue全文を別文書へ複製して第二の実行台帳を作らない。

## 3. 開始時のlive基準

2026-07-29のdocs-only開始時に次を再取得した。

- repository：`SUSANO-OOO/Zombieee`
- Version 0.9.0 release／latest `main`：`f2633c538756385f13d166d3adbcdd39b3a08b21`
- annotated `v0.9.0`、GitHub Release、公開Pages metadata：同release SHA
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- Pages request ID：`v0.9.0-formal-release-20260729`
- Issue #68：closed、Issue #96：open
- save key：`nishijin-campaign-v1`、schema：v13
- playable units：16名
- baseline：695 tests、production build、Lint、content validator、`git diff --check` pass
- Pages Release #150、Public QA #116：success
- 物理smartphone長時間発熱、実speaker、実Safari長時間挙動：未確認

SHA、Issue、PR、tag、Release、Actions、公開metadataは各GitHub操作直前にも再取得し、本節を永久に最新として扱わない。

## 4. 固定する製品判断

### Mobile performance

- 対象はiPhone限定ではなくsmartphone横画面全般
- simulationとrender cadenceを分離し、2倍速でもrenderは最大60fps
- battle canvas DPR上限、static cache、offscreen culling、pool、bounded effectsを使う
- hidden／pause／復帰でRAF、timer、AudioContext、voiceを二重生成しない
- 自動、高画質、省電力の3段階を用意し、画質でgameplay結果を変えない
- 物理端末未確認なら「発熱解消済み」と断定しない

### 全16体animation

- 現行clip契約を壊さずoptional clip、補間、timing、procedural motion、safe fallbackを追加
- 呼吸、重心、移動開始／停止／turn、接地、weapon anchor、recoil、被弾、戦闘不能を全16体で成立
- 全16 manual abilityで通常攻撃と異なるwind-up、active、recovery、VFX、SE、damage timingを維持または強化
- ハチ、レイダー、クレイジーキング、TKY、Mrs.チハ、マヨちゃんを代表6体のvertical sliceとし、品質確定後に残り10体へ展開
- 承認済みidentity masterを唯一の人物sourceとし、slide、off-floor、wrong-facing、hurt／death誤fallbackを残さない

### VFX、敵、boss、CRAWLER

- muzzle、projectile、trail、casing、swing、impact、explosion、smoke、hit stop、knockbackを武器とdamage timingへ同期
- 発生anchorを銃口、砲口、投擲手、刃先、口、固有器官へ合わせ、左右反転にも追随
- telegraphを床面、実hit geometry、攻撃timingへ一致させ、省電力でも危険範囲を読めるようにする
- enemy、boss、CRAWLERの登場、移動、攻撃、被弾、損傷、撃破／収納を役割が伝わる動きへ改善
- debug primitive、placeholder、意味不明なbox／bar／矢印をplayer-facing画面へ残さない

### 0.9.0残存不具合

画像添付待ちで停止しない。正式公開版、最新`main`、既存fixture、実runtime、連続frame capture、render／object registry監査からroot causeを特定する。

CRAWLER door／rampの透過・欠け・combat-ready、unit／enemyのslide・接地・向き、muzzle／projectile／VFX anchor、HUD重なり、smartphone不要表示、debug／placeholder、0.9.0修正項目の回帰を全Stage・全unit・全enemyへ横断修正する。

## 5. 雇用、解放、save

人間・動物unitをcapsで取得するplayer-facing表現は「雇用」へ統一する。取得buttonは「雇用」、取得可能状態は「雇用可能」、人物subsectionは「雇用候補」、自動加入は「加入」とする。stable ID、save key、内部function名は不要に変更しない。

初めて雇用可能になったunitは、戦闘中ではなくresult、checkpoint、map復帰等のsafe screenで一度だけpopup表示する。

- 正式portrait／card、unit名、役割、武器、解放理由、雇用費
- one-shot SE、短いdossier reveal、「雇用画面へ」「あとで」
- 複数解放queue、durable receipt、notice seen state
- reload、再戦、migrationで重複せず、owned unitへ表示しない

マヨちゃんは新規／未解放saveで`highestSurvivalWave >= 20`相当、すなわちWave 20へ入った時点で雇用可能にする。

- boss撃破は不要、雇用費260 capsを維持
- owned／discovered／recruitableの0.9.0 saveを再lockしない
- 既存最高wave 20以上はmigration後に解放し、未表示の場合だけpopupを一度queue
- 二重解放、二重receipt、二重caps消費を禁止
- 宮本武蔵のStage 20解放を維持
- 必要ならsave schemaをv14へ更新

LAN、localhost、GitHub Pagesは別originであり、localStorage／IndexedDBを共有しない。別originのfresh saveと正式URL上のsave消失を区別し、環境名とsave分離をQA／開発表示で明示する。

正式版saveを自動初期化せず、黙ってfresh saveへfallbackしない。migrationは一度だけ適用し、owned、discovered、recruitable、Stage、stars、caps、Level、equipment、presets、records、Survival progress、settings、audio、backup、recovery、export／importを保持する。

## 6. 実装・QA・RC境界

docs-only PRをCI、文書整合、独立read-only review High／Medium／Low未解消0で`main`へ通常mergeし、そのmerge resultから`integration/0.9.5`を作成する。

以後はIssue #96の順に工程branch／Draft PRを分ける。各工程はfocused tests、全tests、production build、Lint、`git diff --check`、対象browser QA、独立read-only reviewを通し、High／Medium未解消0、unresolved thread 0で`integration/0.9.5`へ通常mergeする。Lowはfinal RCまでに0とする。

RCでは次を`integration/0.9.5`へ揃える。

- 0.9.0とのperformance／memory同条件比較
- 全16体animationとmanual abilityの実画面証拠
- VFX、enemy、boss、CRAWLER、残存不具合の改善証拠
- 雇用、popup、マヨ解放、migration、origin別save結果
- LAN試遊URL、物理smartphone確認手順
- 未解決High／Medium／Low 0

通常の技術方式はCodexが自律決定する。Issue #96の監査改訂済み最新コメント（issue comment `5124971857`）は、P0-1〜P0-9、横断監査、修正QA、release preparation、final main PR、annotated tag、GitHub Release、Pages manual dispatch、Public QA、Issue closeまでの実行正本かつ正式release承認である。

Producer acceptance correctionはP0-1〜P0-9をplayer-facing実装と実画面証拠で満たし、全tests 758/758、production build、Lint、content validator、`git diff --check`、対象browser QA、独立read-only review High／Medium／Low 0で`integration/0.9.5`へ統合済みである。以降は同コメントの順序と停止条件に従い、通常の技術問題では停止しない。

## 7. 非対象と禁止

0.9.5へ混在させない。

- PWA、manifest、Service Worker、offline cache、install prompt
- App Store／Google Play／Capacitor
- 新Stage、新unit、新boss、新通貨
- cloud save、account、online ranking
- economy／difficultyの感覚的再調整
- Spine／DragonBones／全面bone化
- engine全面書き直し

PWA／offline／install対応はVersion 0.9.6へ分離する。

Issue comment `5124971857`の承認後も、次の順序と安全境界を守る。

- release preparationと全gate成功前に`integration/0.9.5 → main`をmergeしない
- final main PRのmerge result以外へ`v0.9.5`、GitHub Release、Pages requestを向けない
- GitHub Pages Releaseと自動Public QA成功前にIssue #96をcloseしない
- `.github/pages-release-request.json`を変更しない
- force push、rebase、amend、branch cleanupを行わない
- 既存tag移動・上書き、save全体の自動初期化、ChatGPT Sites deploymentを行わない
