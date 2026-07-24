# 西新世紀末物語 — Version 0.8.0 プロデューサー決定台帳

更新日：2026-07-24  
状態：**製品判断ロック済み・Codex一括実行可能**

## 1. 正式名称と目的

正式名称：

**Version 0.8.0「作戦区域拡張・戦闘演出改善」**

主目的：

- 現行6ステージでは短いため、Stage 7〜16のバトルステージを10件追加する
- Version 0.7.5で整備したデータ駆動・量産基盤を、実際のコンテンツ追加で証明する
- 戦場背景、接地、CRAWLER出撃、キャラクター表示、音量設定、強化feedbackを改善する
- 長尺ストーリーや新規大量unitではなく、遊べるバトル量と操作時の気持ちよさを増やす

実行台帳：Issue #61

参照順：

1. 本書
2. Issue #61
3. `AGENTS.md`
4. Version 0.7.5の現行コード、tests、QA記録

過去の0.7.5文書は実装履歴として参照できるが、0.8.0の対象、非対象、完了条件は本書とIssue #61を優先する。

## 2. 現在確認できている実装上の事実

Version 0.8.0では、次の現行構造を前提に修正する。

- `app/productionVisuals.js`の正式stage visual登録はStage 1〜6までで、未登録stageはfallback画像へ流れる
- `app/CampaignScreens.tsx`では、event portrait、formation card、personnel cardが同じ`PORTRAIT_ART` mappingを使用している
- event画面は別lineのportraitを自動選択し、inactive portraitとして半透明表示する
- `app/visualProfiles.js`の用途別profileは、現状いくらちゃん、CRAWLER、敵拠点が中心で、全11unitには展開されていない
- `app/crawlerDeployment.js`はdoor phaseとlaunch eventを管理するが、unit側のocclusion、grounding、walk速度同期まで単独では保証しない
- `app/audioMixer.js`には`bgmVolume`と`sfxVolume`が既に存在するため、slider追加で別audio engineを作る必要はない
- personnel画面は強化buttonとRank表示を持つが、通常強化・最大強化の専用SE、達成演出、stat差分animationは未接続
- 公開版スクリーンショットでは、battle headerに旧`Version 0.7.1`表記が残る場面がある

Codexは開始時に最新`main`を再取得し、上記が現在も事実か確認する。構造が変化している場合は、製品判断を変えず最新実装へ適用する。

## 3. Stage 7〜16

### 3.1 固定範囲

- Stage 7からStage 16まで、合計10件の正式battle stageを追加する
- Stage 6を1星以上でclearしたsaveは、migration後にStage 7を解放する
- Stage 7以降は順番に解放する
- 全stageへstable stage IDを設定する
- 星、基本報酬、再戦報酬、caps、結果、解放、saveを現行共通基盤へ登録する
- 10stageすべてをgenerator、schema、registry、validator、balance simulationへ通す
- stage固有の巨大runtime分岐を10件増殖させない

### 3.2 構成

4つの作戦区域へ2〜3stageずつまとめる。

- 区域A：Stage 7〜9
- 区域B：Stage 10〜12
- 区域C：Stage 13〜14
- 区域D：Stage 15〜16

具体的な名称と場所は、現行map、世界観、未使用landmarkを監査してCodexが決定できる。大学病院、地下研究区画、物流・避難経路、T計画関連区域を優先候補とする。

### 3.3 遊びの差

- 10stageのうち最低5種類のmission／objective patternを使用する
- 同じobjectiveを3stage連続させない
- 敵HPや数だけを増やして難易度を作らない
- composition、timing、objective、hazard、elite、spawn direction、戦場eventを組み合わせる
- Stage 16は追加10stageの締めとして、通常stageより明確に大きな最終戦体験を持つ
- 新unit、新enemy、長尺storyは必須にしない
- 特定unit、最大Rank、過剰周回を必須にしない
- 最低3種類の異なるformationでStage 7〜16を完走可能にする

## 4. Stage 7以降の戦場画像

Stage 6の背景修正は0.8.0の必須対象にしない。ただしStage 7以降で同じ問題を再発させない。

### 4.1 固定品質

- キャラクターが壁の上を歩いているように見える背景は禁止
- 各背景へ明確な床面、通路、接地線、奥行き、進行方向を持たせる
- 画像の床とruntimeのwalkable space、interaction point、spawn pointを一致させる
- 壁面panelや高所objectを、unitが空中に浮いて操作・攻撃する対象にしない
- unit、enemy、objectiveが壁へ張り付く、空中停止する、設備上へ縦積みされる状態を0件にする
- stage previewと実際のbattle backgroundを一致させる
- 単純な色替えだけで別stage扱いにしない

### 4.2 必要なart量

- 最低4種類のenvironment masterを用意する
- Stage 7〜16へ10件の意味のあるbattle variantを用意する
- 各variantは、床構造、前景物、障害物、照明、被害状況、目的物配置のいずれかで明確に区別する
- 1280×720、844×390、844×340で、床面、敵、味方、拠点、目的物をUIが過剰に隠さない

## 5. 戦闘画面の自然さ

- 味方・敵の空中浮遊、壁面張り付き、不自然な縦積みを修正する
- backgroundごとにwalkable mask、ground band、navigation、collision、interaction anchorを検証する
- CRAWLER、敵拠点、目的物、遮蔽物とunitのZ orderを自然にする
- production公開版へdebug hitbox、QA bounding box、内部ID、不要な矩形枠を表示しない
- 大型phase bannerは、戦闘を長時間隠さないサイズ、位置、表示時間へ調整する
- objective markerは必要性を保ちつつ、中央actionやcharacterを過剰に隠さない

## 6. CRAWLER出撃演出

現状の不自然な透過と滑走を修正する。

- unitが車体・扉前を不自然に透過しない
- 車内にいる間は車体でocclusionし、扉／rampを通過した位置から可視化する
- spawn直後から足元をgroundへ固定する
- walk cycle、移動速度、footstep、実座標を同期する
- 同じ姿勢のまま滑らせる方式は禁止
- door open、launch、doorway occupancy、run-out、door closeを同じruntime eventへ接続する
- 単体出撃、連続出撃、再出撃、複数queue、tab復帰後も透過・重複・滑走0

## 7. キャラクター表示

### 7.1 モンキー

添付画像の銀髪男性はモンキーである。

- 現行event portraitの顔が不自然で、魅力、精悍さ、本人らしさが不足しているため正式に再設計する
- 銀髪、若い男性、tactical装備、銃器担当の識別要素を維持する
- 単なる美化で別人化させない
- identity master、event portrait、formation card、battle representationの同一性を固定する
- 手、武器、姿勢、装備構造を破綻させない

### 7.2 全11unitの用途別profile

全11unitへ次を定義する。

- identity master
- event portrait
- formation／personnel card
- battle sprite

固定品質：

- formation／personnel cardで顔、上半身、主要武器、役割を一目で識別可能
- 全身立ち絵を小さく押し込むだけのcardは禁止
- クマバーソン、ババヤガ等と、顔位置、余白、倍率、視線、情報欄との距離を統一
- PC、844×390、844×340で顔欠け、武器欠け、豆粒化、文字干渉0

### 7.3 会話event

- 別lineのportraitを自動選択して幽霊のように薄く残す方式を撤廃または限定する
- 2人同時表示はevent dataで明示された構図だけにする
- inactive portraitは意図された同席表現として読めるopacity、位置、cropにするか非表示にする
- active speakerと背景のcontrast、足元、画面端の見切れを確認する

## 8. 音量設定

設定画面へ独立sliderを追加する。

- BGM：0〜100
- SE：0〜100

固定要件：

- 現行AudioMixerの`bgmVolume`と`sfxVolume`を使用する
- slider操作中に即時previewする
- 0は実質mute、100は安全な最大値
- BGMとSEを独立制御する
- battle voice、enemy voice、weapon、support、UI音はSE側のplayer設定へ従う
- 値をcampaign settingsへ保存し、再読込、tab復帰、browser再起動後も維持する
- 既存saveは合理的なdefaultへmigrationする
- touch、keyboard、aria label、現在値表示に対応する

## 9. 強化feedback

### 9.1 通常強化

- caps消費の短い通貨SE
- 強化成功SE
- cardまたはportraitの短い発光／pulse／ring effect
- Rank上昇表示
- 上昇stat差分の短いanimation
- caps残高減少を視覚的に認識可能
- 連打、二重購入、二重SEを防止

### 9.2 最大強化

- `最大強化`または`MAX`をcardで明確に表示
- 通常強化と異なる短い達成SE
- 操作を長時間止めない特別effect
- 最大Rank後は完成unitとして一目で判別可能
- reduced-motion時はmotionを抑え、表示と音で達成を伝える

音素材は既存audio systemへ登録する。ライセンス不明素材、有料外部serviceは使用しない。

## 10. Version identity

- browser titleだけでなく、battle header、title screen、hydration payload、公開metadata、Release表示を単一release identityから生成する
- Version 0.8.0公開時に、player-facingな0.7.1／0.7.5表記残存0
- testsで旧version文字列残存を検出する

## 11. Save・map・経済

- 現行save schema 7とstable IDsを基準にする
- 必要なschema updateはmigration前snapshot、last-known-good、localStorage、IndexedDB、export／importを維持する
- Stage 1〜6の星、報酬、所有、発見、調達、Rank、formation、caps、既読、settingsを維持する
- Stage 6 clear済みsaveはStage 7解放へ正しく移行する
- Stage 7〜16の星、報酬、解放の二重適用0
- mapは16nodeを単純に重ねず、region切替、scroll、pagination等からスマートフォンで自然な方式を採用する
- 10stage追加後も、調達・強化の誤選択で進行不能にならないようcaps economyをsimulationする

## 12. 実行単位

最低限次へ分ける。

1. audit／stage plan／save・map設計
2. Stage 7〜16 content／background／objective
3. battlefield grounding／CRAWLER deployment
4. visual profiles／Monkey／cards／event portrait
5. BGM・SE slider／upgrade feedback
6. integration QA／balance／release

一つの巨大commitへまとめない。各工程を単独で再開・rollback可能にする。

## 13. 必須QA

- Stage 1〜6回帰
- Stage 7〜16の通常解放、勝利、敗北、再挑戦、撤退、再読込
- fresh save
- Version 0.7.5公開版由来の既存save
- Stage 6 clear済みsaveからStage 7解放
- 10stage全背景のgrounding、walkable、spawn、objective interaction
- Monkeyのidentity master、event、card、battle同一性
- 全11unit card gallery
- event portrait ghost表示0
- CRAWLER単体出撃、連続出撃、再出撃
- BGM／SE slider保存と即時preview
- 通常強化、caps不足、連打、最大Rank到達、再読込
- 1280×720、844×390、844×340
- Chromium、Playwright WebKit iPhone相当
- touch、safe area、回転、tab／lock復帰
- BGM、SE、battle voice二重再生0
- console error、page error、request failure、主要asset 404が0
- production build、全test、Lint、`git diff --check`、CI成功
- independent read-only review High／Medium未解消0

物理iPhoneを使えない場合、発熱確認済みと報告しない。WebKit、frame time、memory等を代替証拠として明記する。

## 14. 非対象

- Stage 6背景の必須修正
- 新規大量unit
- 新規大量enemy
- 長尺storyの量産
- cloud save
- gacha、rarity、覚醒、限界突破
- 無目的なengine全面書き直し
- ChatGPT Sites deployment

## 15. Codexの裁量

固定製品判断と安全境界を守る限り、Codexは次を自律決定できる。

- Stage 7〜16の名称、位置、敵構成、wave、objective詳細
- environment masterの具体的art direction
- mapのregion切替方式
- grounding／navigation／occlusionの実装方式
- visual profileのdata形式
- upgrade effectとSEの具体方式
- initial balance数値
- test、fixture、simulation、QA証拠形式

技術方式の選択だけを理由に逐次質問しない。

## 16. リリース権限

Issue #61の全ゲート通過後、Codexは通常PR merge、result SHA取得、`v0.8.0` annotated tag、GitHub Release、明示的release requestによるGitHub Pages deployment、公開後QA、Issue #61のcompleted close、確認済みbranch cleanupまで連続実行できる。

公開後QAでは正式URL上で、既存saveとfresh save、Stage 7開始、代表stage、Stage 16勝利、音量保存、強化feedback、Monkey／card表示、CRAWLER出撃を実際に確認する。

## 17. 禁止

- `main`直接push
- force push、rebase、amend
- 既存tag移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- save破壊・自動初期化
- ライセンス不明素材の正式採用
- 未確認・失敗の成功報告
- Stage 7〜16を同一背景の色替えだけで済ませる
- 全身立ち絵を縮小しただけのunit cardを完成扱いする
- 0.8.0以外の大規模story、新規大量unit、全面engine書き直しを混在させる
