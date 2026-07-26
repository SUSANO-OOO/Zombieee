# 西新世紀末物語 — Version 0.9.0 プロデューサー決定台帳

更新日：2026-07-26  
状態：**製品判断ロック済み・Codex実装開始可能**

## 1. 正式な目的

Version 0.9.0は、次のプレイループを完成させる。

**本編を進める  
→ ユニットを育成・装備する  
→ サバイバルで限界へ挑む  
→ ボス・装備・キャップを獲得する  
→ 編成を改善して再挑戦する**

0.9.0は、単なるサバイバル追加ではない。Version 0.7.5／0.8.0で整備した量産基盤を使い、戦闘、ボス、育成、装備、UI、コンテンツ量を一本の循環へ接続する。

実行台帳：Issue #68

## 2. 正本と参照順

1. 本書
2. Issue #68
3. `AGENTS.md`
4. 最新`main`のコード、tests、QA記録
5. 過去Version文書、Issue、PRは実装履歴

旧文書と本書が衝突する場合、過去履歴を改変せず、本書を0.9.0の現在判断として優先する。

## 3. 開始時に再取得する事実

本書作成時に確認した基準：

- repository：`SUSANO-OOO/Zombieee`
- latest release commit：`dbc4bd7edea94fdadce094526384ea4a0f181587`
- current implementation：Version 0.8.0
- campaign：Stage 1〜16
- playable units：11名
- formation presets：3
- progression：Rank 0〜4
- battle space：player-facing固定3laneを撤廃した連続空間
- official hosting：GitHub Pages
- save key：`nishijin-campaign-v1`

SHA、公開metadata、Issue、PR、tag、Release、Actionsは作業開始時と各操作直前に再取得する。文書内SHAを永久に最新として扱わない。

## 4. 0.9.0の固定規模

- 本編Stage 17〜20を追加し、公開時点の本編を20stageとする
- 新プレイアブルunitを5名追加し、合計16名とする
- 新しい通常感染体designを6種追加する
- 新規bossを5体追加する
- TAKUYAと改札喰いを既存boss改修対象とする
- survival modeを追加する
- Rank 0〜4をLevel 1〜50へ統合する
- 個人equipmentと部隊戦術equipmentを追加する
- UIを出撃、部隊、補給所、記録へ再構成する

## 5. Stage 17〜20

- Stage 16を1星以上でclearしたsaveはStage 17を通常解放する
- Stage 17以降は順番に解放する
- stable stage ID、星、初回報酬、再戦報酬、caps、結果、解放、saveへ登録する
- 最低3種類のmission／objective patternを使う
- 敵HP・敵数の単純増加だけで4stageを作らない
- Stage 20は0.9.0本編追加分の締めとして、通常stageより明確に大きな戦闘体験を持つ
- 新通常感染体6種をStage 17〜20で段階的に初登場させる
- 新boss5体を本編4stageへ無理に全投入せず、異常発生任務とsurvivalへ分担する
- 地域名・地点は、既存map、Stage 16後の状態、未使用landmarkを監査して決める
- 長尺storyは量産せず、短文会話、battle event、結果文で接続する

### Stage数の長期方針

- Stage 50は将来の基準であり固定上限ではない
- 将来Stage 100、150以上へ追加可能な構造を維持する
- stage数、level上限、save schema、map UIを同じ固定値へ結合しない
- 0.9.0でStage 21〜50を一括制作しない

## 6. Survival Mode

### 基本

- 無限wave制
- 5waveごとにboss出現
- 5waveを約3〜4分の標準区切りとする
- 10wave到達は約6〜8分を第一調整帯とする
- 全滅またはCRAWLER破壊で終了
- 最高到達wave、撃破数、boss撃破数、使用編成、装備、結果を保存する
- 完全clearは設けない

### checkpoint、撤退、再開

- boss撃破ごと、つまり5wave単位でcheckpoint保存
- 任意撤退可能
- 敗北・撤退でも完了済みwave分の報酬を持ち帰る
- 未完了wave分は報酬対象外
- 同じcheckpointから報酬を二重取得しない
- browser終了、tab終了、再読込後も最後の有効checkpointから再開できる

### 開始地点短縮

- wave 10到達後：次回wave 11開始を選択可能
- wave 20到達後：次回wave 21開始を選択可能
- 以後10waveごとに同方式で解放
- skipped区間の報酬を再取得しない
- 後半開始時は、その地点相当の一時強化を合理的に付与する

### 速度

- 1倍／2倍を実装する
- boss登場時はいったん1倍へ戻す
- 登場後は再び2倍へ変更可能
- 2倍でもattack telegraph、危険範囲、状態変化を判別可能にする

### 一時強化

- boss撃破後に3択から1つ選ぶ
- 攻撃、防御、回復、射程、再出撃、CRAWLER回復、boss特効等を候補にする
- 選択中は戦闘停止
- 取得済み効果と合計値を確認可能
- run終了時に消滅

### map

- 0.9.0ではsurvival専用mapを1種類作る
- 10wave、20wave、30wave等で損傷、停電、感染拡大、火災等の段階変化を見せる
- 単純な色替えだけで別状態扱いにしない

## 7. 戦場構図と右端出現

- 適用可能なmissionでは、敵を画面右端または右端外から自然に侵入させる
- `spawnX`だけを変更して完了扱いにしない
- sprite実表示幅、透明余白、combat-ready地点、攻撃開始、被弾可否、collision、射程、敵拠点位置を一致させる
- 出現完了前は攻撃、被弾、collision対象外
- 画面外から射撃しない
- bossは全身が戦場へ入るまで戦闘開始しない
- mission typeごとにspawn profileを持ち、全stageへ同一座標を強制しない

### survival専用前線

- survivalでは破壊対象の敵拠点を置かない
- 右端外の感染流入口から出現させる
- 味方が右端へ張り付かないよう防衛前線を設ける
- 前衛、射撃、支援が自然な前後関係を作る
- 一時追撃後は前線へ戻る

## 8. Boss共通基盤

共通data：

- 専用HP bar
- 表示名、段階
- 登場警告、専用SE
- attack telegraph
- display size
- body bounds
- foot anchor
- shadow
- hitbox
- attack range
- 状態異常耐性
- 形態変化
- 召喚／部位変化
- 固有報酬
- 図鑑情報

通常敵の巨大版として個別分岐を量産しない。

### size

- 通常敵と並んだ瞬間にbossと認識できる大きさにする
- 844×340のprototype第一受入帯：通常boss実表示身体高約110〜135px、巨大型約135〜155px
- 数値を永久固定せず、実表示身体、横幅、味方視認性、足元、telegraphから調整する
- attack・変形時だけ一時的に横へ展開可能
- 見た目だけ巨大でhitboxが小さい状態を禁止する
- 味方がboss身体を不自然にすり抜けない

### 既存boss

- TAKUYAと改札喰いを共通boss基盤へ移す
- size、登場、attack、telegraph、HP表示、接地、撃破、結果接続を再調整する
- 既存stageの勝利条件、星、報酬、saveを壊さない

## 9. 新規boss 5体

役割：

1. 召喚・戦場制圧型
2. 突進・捕食型
3. 遠距離追跡・妨害型
4. 外骨格展開・防御切替型
5. 融合人型・分裂／多段階型

表現：

- 完全異形4体
- 人間の面影を強く残す異形1体
- 人体融合、内臓露出、欠損を使用可能
- 破裂演出は短く限定的
- 胎児的表現は多用しない
- 各bossに異なるsilhouette、attack loop、counterplay、固有ギミックを持たせる
- 各bossに異常発生任務を1件用意する
- 異常発生任務clear後にsurvival抽選へ追加する
- 同一bossを連続出現させない

### 作業名

- マザー：召喚型
- オオグチ：捕食・突進型
- クロメ：遠距離・視線妨害型
- ガイレン：外骨格展開型
- フタゴ：融合人型・分裂型

上記は作業名。`クロメ`と`ガイレン`を優先候補とし、全5体の正式表示名はidentity master確認時にプロデューサーが最終固定する。Codexは別名を独自確定して公開しない。

### 制作順

- 最初に1体だけidentity masterとbattle animationを完成
- 844×390・844×340の実ゲームでsize、接地、右端侵入、味方視認性、telegraph、attack rangeを確認
- 基準確定前に残り4体を量産しない

## 10. 通常感染体6種

- 新しい通常感染体designを6種追加する
- 色替え、服替え、既存sprite軽微加工だけで6種扱いにしない
- 全6種で顔、体格、姿勢、歩行、損傷、攻撃部位を変える
- 少なくとも3種は新しいbehavior profileを持つ
- 残りは既存profileを再利用可能だが、地域・用途・silhouetteが明確に異なること
- 現行walker、runner、spitter、crusher、shade、abomination、grappler、ooze、sprinterと完全重複させない
- Stage 17〜20で理解可能な順序で初登場させる
- 初登場前にStage 1〜6へ無差別追加しない
- 初登場後はsurvivalと適合する後半stageへ追加可能
- content pipeline、AI profile、animation clip、audio registryへ登録する
- 最終名は完成した見た目と能力に合わせる
- 漢字名だけに統一せず、漢字、カタカナ、現場通称を使い分けられる

## 11. 新プレイアブルunit 5名

- 現行11名＋5名で合計16名
- 既存人物の単純上位互換にしない
- 新5名に最低限、boss対策、群体制御、部隊支援の役割を含める
- 残り2名も既存11名と異なる投入判断を持たせる
- 特定新unitを本編clear必須にしない
- 新unitなしでもStage 1〜16の既存導線を維持する

### identity masterの責任分界

新プレイアブル5名の正式な基準portraitはプロデューサーが制作し、Codexへ直接渡す。

- プロデューサーが各unitにつきportrait画像1枚を提供する
- Codexは受領portraitを唯一の人物identity基準として使う
- Codexは代替人物、別顔、別衣装のidentity masterを独自生成して置換しない
- Codexはportraitからevent portrait、formation／personnel card、battle sprite／atlas、thumbnail等を派生制作する
- 顔、髪、体格、肌、衣装、装備、武器、配色、傷、アクセサリーを同一人物として維持する
- portraitから見えない全身、背面、武器裏面等はidentityを壊さない範囲で補完する
- display name、主役割、主要武器が未指定なら候補提案は可能だが、正式採用にはプロデューサー判断が必要
- 画像待ち中もsurvival、save、equipment、UI、boss、enemy、test作業を継続する
- 未提出分を別人物で埋めて0.9.0完成扱いにしない

### 派生制作ゲート

- 最初の1名でportrait → card → battle spriteの派生基準を確認する
- identity、接地、向き、武器、frame、スマホ表示が成立後、残り4名へ展開する
- 844×390・844×340で顔欠け、武器欠け、豆粒化、UI干渉、別人化0

## 12. Level 1〜50

現行Rank 0〜4をLevel 1〜50へ統合する。

migration：

- Rank 0 → Lv1
- Rank 1 → Lv2
- Rank 2 → Lv3
- Rank 3 → Lv4
- Rank 4 → Lv5

単なる表示変更で弱体化しない。現行能力、累計投入caps、実戦強度を保持する。

### level cap milestone

- 初期：Lv5
- Stage 5 clear：Lv10
- Stage 10 clear：Lv15
- Stage 15 clear：Lv20
- Stage 20 clear：Lv25
- 将来Stage 25 clear：Lv30
- 将来Stage 30 clear：Lv35
- 将来Stage 35 clear：Lv40
- 将来Stage 40 clear：Lv45
- 将来Stage 50 clear：Lv50

0.9.0ではLv50を扱えるdata、UI、save、calculationを作る。公開時に通常解放できる上限はStage 20対応のLv25。survival到達waveではlevel capを解放しない。Stage 100、150へ増えてもLevelを自動追随させない。

## 13. Caps経済再編

主用途：

- unit level up
- 通常equipment購入
- equipment強化
- 新unit取得
- 必要な恒久解放

### migration

- 所有unit、stage進行、星、既読、編成、設定、移行後levelは維持
- 旧経済の未使用caps残高は、新経済用の共通開始資金へ一度だけ再編する
- 開始資金を0にしない
- 基本equipment購入と複数回のlevel upを試せるが、全unit最大強化はできない額にする
- 金額はlevel／equipment価格simulation後に決める
- 初回起動時に再編内容を表示する
- receipt／migration flagで二重再編を防ぐ

## 14. Equipment

### slots

- 各unit：個人equipment 2枠
- 各編成preset：戦術equipment 2枠
- 現行3presetへunit編成、個人equipment割当、戦術equipmentを保存する
- global inventoryを共有し、所持数以上に同時装備しない

### 初期量

- 個人equipment：約10種
- 戦術equipment：約5種
- boss固有equipment：5種
- 合計約20種

### rules

- 最大5段階強化
- 固定性能
- random optionなし
- rarity厳選なし
- gachaなし
- 合成・分解なし
- 同名team buffの無制限stackなし

### 入手

- 通常equipment：補給所でcaps購入
- 上位equipment：survival到達報酬
- 固有equipment：boss初回撃破、撃破回数、異常発生任務

### icons

- 全equipmentへ正式な専用iconを作る
- 文字だけ、色違いだけ、同じ肉片iconの使い回しで済ませない
- 約40pxでも武器、防具、医療、通信、生体装備をsilhouetteで識別可能にする

## 15. UI

トップ：

- 出撃
- 部隊
- 補給所
- 記録

内部：

- 出撃：本編、survival、異常発生任務
- 部隊：編成、隊員、level、個人equipment、戦術equipment、preset
- 補給所：新unit、通常equipment、equipment強化、入手先
- 記録：敵図鑑、boss図鑑、survival最高記録、戦績

`調達`を主要名称として廃止する。補給所はunit、equipment、強化を扱う。

デザイン：

- 操作構造：軍事端末70%
- 装飾：生体汚染ホラー30%
- 意味のない発光枠、過剰gradient、細かい文字、豆粒cardを避ける
- 844×390・844×340で主要tap targetを確保
- equipment情報をbattle unit cardへ常時詰め込まない
- survivalは専用HUDへ置換し、現行HUDへ情報を足すだけで済ませない

## 16. Result・図鑑

Survival result：

- 到達wave
- 撃破数
- boss撃破数
- unit別与damage
- unit別被damage
- 回復量
- 獲得caps
- 獲得equipment
- 最高記録更新

Boss図鑑：

- 画像
- 表示名・分類
- 初回遭遇
- 攻撃特性
- 発見済み弱点
- 撃破回数
- 固有equipment

初遭遇前に能力・弱点を全公開しない。

## 17. 実装単位

最低限次へ分ける。

1. GitHub正本・現行状態・旧Issue整合
2. survival data／save／checkpoint／speed foundation
3. battlefield right-edge spawn／defense front／専用HUD
4. boss共通基盤＋既存boss改修＋新boss prototype
5. 通常感染体6種＋Stage 17〜20
6. 残りboss4体＋異常発生任務5件
7. Rank→Level、caps migration、economy simulation
8. equipment、inventory、icons、preset
9. UI、result、図鑑、記録
10. 新プレイアブル5名の派生画像、data、battle統合
11. integration QA、balance、release candidate

画像待ち工程と画像非依存工程を不必要に直列化しない。

## 18. GitHub整合

実装前に次を行う。

- `docs/PROJECT_STATE.md`をVersion 0.8.0公開済みへ更新
- `docs/PRODUCT_ROADMAP.md`へ0.8.0完了と0.9.0範囲を反映
- `AGENTS.md`の旧Version専用参照順を、最新個別正本へ適用可能な構造へ更新
- `README.md`の現在開発表記を更新
- 旧Issueを無条件削除・改変しない
- 完了済み旧Issueは、後続実装・正本への移行先を記録してclose可能
- 残作業があるbacklogは現行仕様へscopeを狭める
- `.github/pages-release-request.json`をdocs整理のために変更せず、deploymentを発火させない

## 19. QA

- 対象test、全test、Lint、production build、`git diff --check`
- content validator、generator、economy simulation、save migration matrix
- fresh save、Version 0.8.0由来save、破損復旧、export／import
- Stage 1〜16回帰
- Stage 17〜20の解放、勝利、敗北、撤退、再挑戦、再読込
- survival 5／10／20wave、boss、checkpoint、再開、撤退、敗北、報酬、二重取得0
- Level cap、Rank migration、caps再編、equipment購入・強化・装備・preset
- 新unit5名、通常感染体6種、新boss5体、既存boss2体
- 1280×720、844×390、844×340
- Chromium、Playwright WebKit iPhone相当
- touch、safe area、回転、tab／lock復帰
- 2倍速時のsimulation、audio、telegraph、save
- 15分以上のsurvival performance gate
- console error、page error、request failure、主要asset 404が0
- independent read-only review High／Medium未解消0

物理iPhoneを使えない場合、実機・発熱・本体speaker聴感を確認済みと報告しない。

## 20. 非対象

- Stage 21〜50の一括制作
- Stage 100／150の実制作
- 長尺story章の量産
- online ranking
- PvP、guild
- daily mission
- 新恒久通貨
- random equipment option
- rarity厳選
- equipment合成・分解
- gacha
- 覚醒・限界突破
- cloud save
- 無目的なengine全面書き直し

## 21. Git・release境界

Codexは、本書とIssue #68の範囲内で、調査、設計、実装、対象asset、test、通常commit、feature／integration branchへの通常push、Draft PR、integrationへの工程merge、独立reviewまで進められる。

次はrelease candidate最終実プレイ合格後の別承認まで禁止する。

- `integration/0.9.0 → main`最終PR Ready化
- `main` merge
- `v0.9.0` tag
- GitHub Release
- GitHub Pages正式deployment
- Issue #68 close
- release branch cleanup

### プロデューサー確認地点

1. 新boss prototype 1体
2. 新プレイアブル1名のportrait派生prototype
3. 新boss5体、通常感染体6種、equipment iconのidentity gallery
4. Version 0.9.0 release candidate最終実プレイ

技術方式だけを理由に逐次停止しない。画像確認待ち中も画像非依存作業を継続する。
