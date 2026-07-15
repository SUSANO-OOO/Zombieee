# 西新世紀末物語 0.6.0 — Stage object production監査

更新日：2026-07-15

## 1. 目的と所有元

この文書は3つのproduction battle backgroundに既に描き込まれた静的環境物と、戦闘状態に応じて切り替える独立overlayを区別し、Canvasの仮図形へ戻らないための監査記録である。

- 背景path・景観方針：`docs/PRODUCT_SPEC_0.6.0.md`
- overlay path・配置・状態・collision：`app/stageObjectManifest.js`
- 生成source・権利・hash：`docs/THIRD_PARTY_ASSETS.md`
- 非破壊build：`scripts/build-v060-assets.py`
- 自動検証：`tests/stage-object-manifest.test.mjs`

原則は「変化しない景観は背景へ統合、戦闘中に状態が変わる物だけを透明overlay」に固定する。同じ物をbackground、legacy sprite、overlayの三重描画にしない。

## 2. Static / dynamic判定

| 分類 | production treatment | 実装規則 |
|---|---|---|
| 建物、道路、遠景、常設照明、固定した戦闘跡 | `authored-in-production-background` | 1600×900 WebPの一部として描画し、追加のCanvas図形を重ねない |
| 背景だけでは判別困難だった固定物 | `generated-transparent-overlay-v1` / `static-dressing` | stage専用clusterとして背景直後に一度だけ描画し、他stageへ使い回さない |
| 罠の作動、看板落下、shutter開閉、救援車両の撤収、瓦礫除去、物資箱開封、送信機損傷、感染nest phase | `generated-transparent-overlay-v1` | `STAGE_OBJECT_MANIFEST`の状態variantを排他的に描画する |
| HP bar、対象marker、警告ring、攻撃flash | runtime UI/effect | assetの代わりにしない。overlayの上へ短時間の状態表現として描画可能 |
| 過去の仮線、仮矩形、仮円、無地shutter、記号だけのvehicle/nest | placeholder primitive | productionでは削除する。fallbackとして成功扱いしない |

## 3. ステージ別監査

### 3.1 西新商店街

- stage ID：`stage-nishijin-shopping-street`
- background：`/art/v060/battle-nishijin-shopping-street-v1.webp`
- 背景へ固定：アーケード、店舗列、路面、配送車・自転車等の遠景、焼け跡、固定看板・照明、一般瓦礫

| slot | state | overlay | default | collision / 用途 |
|---|---|---|---|---|
| `static-dressing` | `static-dressing` | `nishijin-static-dressing-v1.png` | runtime常時 | 薬局、屋上外階段、商品棚、箱、かご、散乱品、血痕を正式補完 |
| `wire-trap` | `trap-armed` | `nishijin-wire-trap-intact-v1.png` | yes | lane上の作動前障害 |
| `wire-trap` | `trap-sprung` | `nishijin-wire-trap-sprung-v1.png` | no | 作動後の崩れた状態 |
| `arcade-sign` | `sign-hanging` | `nishijin-sign-intact-v1.png` | yes | 落下前 |
| `arcade-sign` | `sign-fallen` | `nishijin-sign-fallen-v1.png` | no | 落下後。地面collisionあり |
| `fire-shutter` | `shutter-closed` | `nishijin-fire-shutter-closed-v1.png` | yes | 閉鎖状態 |
| `fire-shutter` | `shutter-open` | `nishijin-fire-shutter-open-v1.png` | no | 開放状態 |
| `infection-node` | `base-exposed` | `nishijin-infection-node-active-v1.png` | no | 感染拠点露出後の攻撃対象差分 |
| `infection-node` | `base-destroyed` | `nishijin-infection-node-destroyed-v1.png` | no | HP 0後の崩落・発光停止state |

感染nodeはinteraction X=875、draw center X=850。`base-exposed`表示時は`/infected-checkpoint-v1.png`を同時に描画せず、このoverlayが置換する。背景内の感染色・煙は静的景観として残してよいが、同じ輪郭の拠点本体を二重に置かない。

### 3.2 早良区役所

- stage ID：`stage-sawara-ward-office`
- background：`/art/v060/battle-sawara-ward-office-v1.webp`
- 背景へ固定：庁舎、救援テント、避難誘導路、コーン・土嚢・投光器、寒色照明、遠景車両
- このmissionは時間防衛であり、感染拠点を攻撃対象として描画しない

| slot | state | overlay | default | collision / 用途 |
|---|---|---|---|---|
| `static-dressing` | `static-dressing` | `sawara-static-dressing-v1.png` | runtime常時 | 救護机、椅子、担架、搬送台車、掲示板、医療箱、水、弁当箱を正式補完 |
| `rescue-van` | `evac-blocked` | `sawara-rescue-van-blocked-v1.png` | yes | 撤収準備中、瓦礫付き |
| `rescue-van` | `evac-ready` | `sawara-rescue-van-ready-v1.png` | no | 出発可能 |
| `rubble` | `rubble-blocking` | `sawara-rubble-blocking-v1.png` | yes | route閉塞 |
| `rubble` | `rubble-cleared` | `sawara-rubble-cleared-v1.png` | no | 除去後路面 |
| `upper-window` | `under-fire` | `sawara-shooting-window-lit-v1.png` | yes | 庁舎内の警告灯・射撃窓 |
| `lunch-crate` | `supplies-sealed` | `sawara-lunch-crate-sealed-v1.png` | yes | 未開封物資 |
| `lunch-crate` | `supplies-open` | `sawara-lunch-crate-open-v1.png` | no | 開封・消費後 |

background内に固定された救急車・遠景車両は景観であり、overlayのrescue vanは撤収状態を伝える前景物である。重なって一台に見えない配置とし、variant間では同じ`slot`を排他的に切り替える。救援車両・瓦礫・物資のstateは経過秒から直接作らず、配備済み護衛人数と移動拠点HPで進む`convoyProgress`へ接続する。

### 3.3 西新防衛線・TAKUYA

- stage ID：`stage-nishijin-defense-line-takuya`
- background：`/art/v060/battle-nishijin-defense-line-v1.webp`
- 背景へ固定：感染煙、有刺鉄線、対車両障害物、クレーター、火災、赤色照明、遠景防衛設備

| slot | state | overlay | default | collision / 用途 |
|---|---|---|---|---|
| `static-dressing` | `static-dressing` | `defense-static-dressing-v1.png` | runtime常時 | 隔離標識、監視camera、放棄装備、土のう、鉄柵、封鎖gate、対車両障害物を正式補完 |
| `transmitter` | `transmitter-active` | `defense-transmitter-active-v1.png` | yes | 通信・作戦状態 |
| `transmitter` | `transmitter-damaged` | `defense-transmitter-damaged-v1.png` | no | 損傷・火花状態 |
| `spawn-marker` | `takuya-entry` | `defense-spawn-marker-v1.png` | no | TAKUYA出現地点の短時間表示 |
| `infection-nest` | `nest-dormant` | `defense-infection-nest-dormant-v1.png` | yes | boss戦前/中の閉鎖状態 |
| `infection-nest` | `nest-exposed` | `defense-infection-nest-exposed-v1.png` | no | TAKUYA撃破後の攻撃可能状態 |
| `infection-nest` | `nest-damaged` | `defense-infection-nest-damaged-v1.png` | no | HP低下状態 |
| `infection-nest` | `nest-destroyed` | `defense-infection-nest-destroyed-v1.png` | no | 破壊後 |

infection nest全状態は既存game ruleに合わせ、interaction X=875、draw center X=850へ固定する。Crawler側のX=126には置かない。nest variant表示中は`/infected-checkpoint-v1.png`を同時描画せず、overlayが置換する。`public/infected-nest-v1.png`は既存の未採用・由来未記録assetであり、本実装のfallbackとして使用しない。

## 4. Runtime API

```js
import { STAGE_OBJECT_MANIFEST, stageObjectsFor } from "./stageObjectManifest.js";

stageObjectsFor("stage-nishijin-shopping-street");
// defaultVisibleだけを返す

stageObjectsFor("stage-nishijin-shopping-street", ["trap-sprung", "sign-fallen", "shutter-open", "base-exposed"]);
// 指定状態のvariantだけを返す
```

- `stageObjectsFor(stageId)`は各mutable slotのdefaultを最大1点返す
- `stageObjectsFor(stageId, state)`は文字列または文字列配列を受け、指定状態と一致するvariantを返す
- 同一slotへ複数stateが渡された場合は配列後方のstateを採用し、二重表示しない
- 各entryは`path`, `placement`, `collision`, `defaultVisible`, `productionTreatment`を持つ
- `collision`は`purpose: "battlefield-supply-placement-exclusion"`として画像幅・高さから該当laneを計算し、previewと配置確定の両方へ同じ禁止範囲を渡す。味方・敵を不可視壁で止める物理collisionではない
- 感染拠点variantは`interactionX: 875`と`replacesRuntimeSprite: "/infected-checkpoint-v1.png"`を持つ
- rendererは同じslotから複数variantを同時描画しない

## 5. Placeholder置換監査

production描画では、旧`drawStageEnvironment`相当の次の表現をstage backgroundまたは本overlayへ置換する。

- 西新商店街の線だけの罠、矩形shutter、記号的看板
- 早良区役所の単色vehicle、矩形瓦礫、単純なwindow flash、弁当箱記号
- 西新防衛線の円だけのspawn marker、箱型送信機、楕円nest

残してよいCanvas描画はHP bar、attack warning、hit flash、短時間particleなどの状態UI/effectだけである。placeholder primitiveをasset load失敗時の通常fallbackへせず、asset errorとして検出する。

### 5.1 仮描画ごとの処置台帳

| 旧仮表現 / 未制作群 | stage | 処置 | production evidence / 削除理由 |
|---|---|---|---|
| 線だけの罠・wire | 西新 | 専用素材へ置換 | `wire-trap` 2 state。脚本上の作動前後を視認可能にするため削除不可 |
| 記号看板・落下物 | 西新 | 専用素材へ置換 | `arcade-sign` 2 state。落下後は配置禁止範囲も連動 |
| 無地shutter・防火扉 | 西新 | 専用素材へ置換 | `fire-shutter` 2 state。感染拠点露出と同期 |
| 楕円・単色の感染拠点 | 西新 | 専用素材へ置換 | `infection-node` active/destroyed。攻撃対象と描画を同じXへ固定 |
| 商品棚・薬局・屋上動線・かご・散乱品 | 西新 | stage専用固定素材へ統合 | `nishijin-static-dressing-v1.png`。他stageへ転用しない |
| 単色救援vehicle | 早良 | 専用素材へ置換 | `rescue-van` blocked/ready。救援目的をstateで表現 |
| 矩形瓦礫 | 早良 | 専用素材へ置換 | `rubble` blocking/cleared。previewと配置確定へ同じ禁止範囲 |
| 単純window flash | 早良 | 専用素材へ置換 | `upper-window`。ババヤガの射撃位置を固定 |
| 弁当箱記号 | 早良 | 専用素材へ置換 | `lunch-crate` sealed/open。クマバーソンの物資配置 |
| 机・椅子・担架・掲示板・水・医療箱 | 早良 | stage専用固定素材へ統合 | `sawara-static-dressing-v1.png`。車両は含めず背景・rescue overlayとの二重化を防止 |
| 箱型送信機 | 防衛線 | 専用素材へ置換 | `transmitter` active/damaged。偽救難音声の視覚的source |
| 円だけのspawn marker | 防衛線 | 専用素材へ置換 | `spawn-marker`。TAKUYA pending中だけ表示し、生存中は残さない |
| 楕円nest | 防衛線 | 専用素材へ置換 | `infection-nest` 4 state。TAKUYA撃破後に攻撃対象として露出 |
| 隔離表示・監視設備・放棄警備/軍用装備 | 防衛線 | stage専用固定素材へ統合 | `defense-static-dressing-v1.png`。biohazard記号は用いるが読めない仮文字は置かない |
| 車・tent・bicycle・街灯・投光器・防壁・配管・tank等の静的遠景 | 各stage | production背景へ正式統合 | 1600×900背景内で光源・遠近・接地を統一。追加overlayにすると二重表示になるため作らない |
| HP bar・照準ring・hit flash・particle | 共通 | runtime effectとして継続 | 物体代替ではなく短時間の状態情報であり、asset化するとgame stateと乖離するため |

## 6. 検証

`tests/stage-object-manifest.test.mjs`は次を検査する。

- 3 stage、25点のmanifest完全性（動的variant 22点＋stage専用static dressing 3点）
- background 3点のWebP image chunkと1600×900実寸
- overlay 25点のRGBA PNG decode、visible alpha、12px透明外周
- ID一意性、状態選択、default slot排他
- 必須slot（trap/sign/shutter/node、vehicle/rubble/window/crate、transmitter/marker/nest）の存在
- infection overlay 6点のdraw X=850、interaction X=875、legacy checkpoint置換指定
- 各stageの`productionInventory`が最低一覧を個別ID・処置・evidence付きで完全列挙

localhostでは全variant galleryに加え、実戦背景上でPC横画面と844×390を確認する。特に、人物・敵・Crawler・感染拠点とoverlayが重ならないこと、state切替時に旧variantが1frame残らないこと、背景に描き込まれた同種物と二重に見えないことを目視する。実機スマートフォン確認は公開前受入で別途行う。
