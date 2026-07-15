# 西新世紀末物語 0.6.0 — キャラクター画像・設定対応表

更新日：2026-07-15

## 1. この文書の位置づけ

この文書は、プロデューサー提供画像、内部kind、戦闘用画像、会話用画像の一対一対応を固定する正本である。

- 対象ブランチ：`feat/0.6.0-early-access-foundation`
- 対象Draft PR：#30
- 画像、表示名、内部ID、武器、役割、口調を別キャラクターへ流用しない
- `ブギーマン`は誤って作られた別名であり、独立キャラクターとして登録しない
- `reference/characters/producer-masters-v2/` は提供時のbytesを保持する読み取り専用の版管理原本であり、生成・切り出し処理の出力先にしない
- 旧`reference/characters/*-source.webp`は過去の閲覧用縮小コピーとして残すが、最新原本でもproduction assetでもない
- 実行時の正規pathとsource rectは[`app/spriteManifest.js`](../app/spriteManifest.js)を所有元とする

## 2. 新規3名の固定対応と最新原本

| 内部ID | 表示名 | 武器・役割 | 最新producer master | 実寸 | SHA-256 |
|---|---|---|---|---:|---|
| `crazy-king` | クレイジーキング | チェーンソー / 狂戦士・近接殲滅 | `reference/characters/producer-masters-v2/crazy-king-producer-master-v2.png` | 2172×724 RGB PNG | `0a4329786e31f6a10d646e3145eaed188ff434cedcb58a346ae8efa29161c789` |
| `kumaverson` | クマバーソン | フライパン / 前衛打撃・足止め | `reference/characters/producer-masters-v2/kumaverson-producer-master-v2.png` | 1672×941 RGB PNG | `1ea53c1c22cc811a6163246b88b749d7aeed69eff636ec60ec5f6d2228d70e68` |
| `babayaga` | ババヤガ | サプレッサー付き拳銃 / 精密射撃・特殊個体排除 | `reference/characters/producer-masters-v2/babayaga-producer-master-v2.png` | 2172×724 RGB PNG | `13b40c78d1de2d4b2cd83ce252745bdc91b5b5cc27c2ab4f4e90f63da265b143` |

3点とも添付時点で透明alphaを持たず、市松模様がRGBへ焼き込まれている。このため原本を実行時に直接描画せず、人物・装備・ポーズの制作参照として使用した。

### クレイジーキング

- 外見：黄色い筒状の頭部、緑のパーカー、赤いブーツ、血痕の付いたチェーンソー
- 人物像：破天荒で危険な雰囲気を持つが、戦闘時には頼れる。単なるギャグ要員にはしない

### クマバーソン

- 外見：黒髪の日本人男性、汚れた白いTシャツ、黒いパンツ、フライパン
- 人物像：破天荒だが頼れるおふざけキャラクター。食事、弁当、空腹を判断基準や冗談に使う
- 口調：自然な博多弁
- 関係：ババヤガの友人

### ババヤガ

- 外見：黒髪の日本人男性、白いワイシャツ、ネクタイ、黒いスラックス、ショルダーホルスター、サプレッサー付き拳銃
- 年齢：27歳
- 表の職業：大手証券会社社員
- 裏の活動：主に早良区内で活動するヒットマン
- 家庭：最近結婚した新婚。妻には頭が上がらない
- 人物像：冷静沈着なのにおふざけキャラクター。必要な場面では即座に本気になる
- 口調：標準語主体。素が出ると少し博多弁
- 関係：クマバーソンの友人

## 3. Production battle asset

| kind | runtime path | 実寸 / layout | SHA-256 |
|---|---|---|---|
| `crazy-king` | `/art/v060/characters/crazy-king-battle-v1.png` | 3360×896 RGBA / 480×448セル、7状態×右左2行 | `8858e7a32505baaffb21c3dfc58033a1a2a7b1e3293c370121e03e4328c97e5f` |
| `kumaverson` | `/art/v060/characters/kumaverson-battle-v1.png` | 3360×896 RGBA / 480×448セル、7状態×右左2行 | `b1fcca003c5635543b29ca9ca3e0b4f5a0b81a906a03ce22d2d6aa58ee49a346` |
| `babayaga` | `/art/v060/characters/babayaga-battle-v1.png` | 3360×896 RGBA / 480×448セル、7状態×右左2行 | `0868e7eafc96ac495b7fa708411635ba2736f35b9bbd9b173a96570e00123b08` |

状態順は`idle / walk-a / walk-b / attack-a / attack-b / hit / death`。各セルは最低12pxの完全透明外周を持つ。クレイジーキングとクマバーソンの左向き行は文字・左右固有装備を持たない右向き原画から制作し、ババヤガは拳銃とホルスターの整合を保つため左右を個別生成した。

`spriteFrameFor(kind, state, direction)`はfull authored cellを`sourceRect`として返し、実alpha領域を`contentRect`、透明余白を`gutter`として別途返す。`anchorY`は固定値ではなく、各frameの実測content bottom / source heightである。

## 4. 既存sprite監査

`SPRITE_MANIFEST`は既存味方6名、敵8種、新規3名の計17 kindを列挙する。

- 味方：`brawler / scout / ranger / medic / brute / gunner`
- 敵：`walker / runner / turned / spitter / shade / crusher / abomination / takuya`
- 新規：`crazy-king / kumaverson / babayaga`

既存PNGは6つの横並びauthoring cellである。大半は2172×724で正確に362px×6だが、`gunner-sprites-v1.png`だけは2170×725であり、実セル幅は`361 / 362 / 362 / 361 / 362 / 362`となる。従ってruntimeで`naturalWidth / 6`の小数値を都度使わず、manifestの整数source rectを使用する。各既存セルについてもdecoded alpha bboxから`contentRect`と四辺gutterを記録している。

legacy sheetは専用death frameを持たないため`death`は監査可能なfallbackとして`hit`frameを参照し、`derivedFrom: "hit"`を明示する。方向違いは`flipX`で表現し、新規3名は左右別rowを使用する。

保護対象`public/brawler-sprites-v1.png`は変更していない。監査SHA-256は`c2c8e5fa2241a4841c80ca817afe6efedcb235d0bccafabcad931776a8b7d3c4`。

## 5. 会話用portraitの固定対応

戦闘sheet URLを会話へ直接流用しない。人物10名はすべて`public/art/v060/characters/portraits/`内の独立ファイルへ割り当てる。

| 人物 | story key | portrait path |
|---|---|---|
| パイセン | `brawler` | `/art/v060/characters/portraits/brawler-portrait-v2.webp` |
| 橘 迅 | `scout` | `/art/v060/characters/portraits/scout-portrait-v2.webp` |
| 黒木 凛 | `ranger` | `/art/v060/characters/portraits/ranger-portrait-v2.webp` |
| 白石 直人 | `medic` | `/art/v060/characters/portraits/medic-portrait-v2.webp` |
| 大庭 豪 | `brute` | `/art/v060/characters/portraits/brute-portrait-v2.webp` |
| 真壁 玲奈 | `gunner` | `/art/v060/characters/portraits/gunner-portrait-v2.webp` |
| クレイジーキング | `crazy-king` | `/art/v060/characters/portraits/crazy-king-portrait-v2.webp` |
| クマバーソン | `kumaverson` | `/art/v060/characters/portraits/kumaverson-portrait-v2.webp` |
| ババヤガ | `babayaga` | `/art/v060/characters/portraits/babayaga-portrait-v2.webp` |
| 水城 奈々 | `guide` | `/art/v060/characters/portraits/guide-portrait-v2.webp` |

無線表示の`radio`は人物の代替ではない。人物を含まない専用通信端末`/art/v060/characters/portraits/radio-terminal-portrait-v1.webp`を使用し、`guide`とはpath・bytesの両方を分離する。

## 6. 誤登録と加工事故の禁止

- 白いワイシャツとサプレッサー付き拳銃の人物は`ババヤガ`であり、`ブギーマン`ではない
- `ブギーマン`の人物設定、台詞、内部ID、解放枠を新規作成しない
- 隣接frameの手、腕、武器、血、影、輪郭を混入させない
- 画像比率を崩さず、無理な引き伸ばしや縦長圧縮を行わない
- 左右反転で銃、ホルスター、文字、装備が不自然になる素材は別向き原画を使用する
- source buildは`scripts/build-v060-assets.py`を使い、`reference/`原本と保護対象legacy spriteを上書きしない
- 人物portraitの顔・髪・体格はキャラクター固有とし、別人物（特にパイセン）の顔立ちや参照画像を他キャラクターへ流用しない

## 7. 検証境界

`tests/sprite-manifest.test.mjs`は次を自動検証する。

- 17 kind、7状態、左右2方向の完全列挙
- decoded PNG実寸、source/content rect、gutter、実測baselineの一致
- 新3名全42セルの透明外周
- 全10人物portraitの存在、WebP image chunk decode、path一意性、battle sheet非参照
- radioとguideのpath・SHA分離
- 最新producer master 3点の実寸・SHA
- 保護対象brawlerのSHA不変

実戦表示サイズ、攻撃時の向き、接地点、血・武器の視認性はlocalhost全frame QA画面およびPC/844×390ブラウザで最終確認する。iPhone Safari実機受入は別のリリース前確認であり、この素材登録だけでは完了扱いにしない。
