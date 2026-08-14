# 正式リリース版 — Producer Decisions

更新日：2026-08-14  
状態：**Sol Design開始前のProducer Brief**  
対象：v10正史台本を基礎にした30 Stage完成リリース

## 1. 主目的

PROLOGUEからStage 30、ENDING、EPILOGUEまでを、未配置・未接続・仮画像・仮演出・未完成systemを残さず、一括の正式リリースとして成立させる。

「台本を表示できる」「Stage数が30になった」「testsがgreen」だけでは完成としない。物語、戦闘、進行、経済、ユニット、支援物資、育成、ボス、他mode、画像、animation、effect、audio、save、PWA、スマートフォン表示を実プレイで一つにつなげる。

## 2. Player-facing outcome

新規プレイヤーがニューゲームから開始し、置き去りにされる用語や人物導入なく、Stage 1からStage 30まで因果を追って遊び、TAKUYA-Ωを撃破し、ENDINGとEPILOGUEまで到達できる。

既存プレイヤーも新しい進行をニューゲームとして開始する。ただし、過去にプレイした事実は破棄せず、正式リリース記念のCAPSを一度だけ受け取れる。

## 3. 固定済みの製品判断

### 3.1 物語

- `docs/story/v10/STORY_SCRIPT_V10.md`を物語正本とする。
- 本編は30 Stage。
- v10が固定する人物弧、敵側の因果、ENDING、EPILOGUEを実装する。
- 主人公は無言だが、物語を動かす行動は主人公が担う。
- ムガリアン製薬、RED PANTHER、セガワ、TAKUYA-Ωの開示順を崩さない。
- 既存ユニットを本編会話へ無理に追加しない。
- 初見プレイヤーが人物・企業・用語を理解できる導入を維持する。
- 新規CGの大量制作を前提にせず、再利用可能な背景、腰上event portrait、短い演出、暗転、環境音を主軸とする。

### 3.2 実装担当

- 最初にSolが現行code／assets／save／PWA／QAを読み、全体Design Lockを作る。
- SolとLunaを同時に動かさない。
- Design Lock後、Lunaがproduction implementation、test、browser QA、self-review、Draft PRを担当する。
- Luna完了後、最初のSol threadがFinal Reviewを行う。
- Solは画像identity、asset inventory、generation contract、acceptanceを設計する。
- 実際の画像生成をSolへ担当させる場合は、Design Lock後に対象assetとidentity lockを固定した別checkpointとして明示承認する。現行の`SOL_DESIGN`中に、設計と大量のproduction asset生成を混在させない。
- Lunaは承認済みassetをruntimeへ統合する。identityや画風を独自に再設計しない。

### 3.3 初期使用可能ユニット

ニューゲーム開始時に使用できるplayable unitは**4体だけ**とする。

- ババヤガ
- クマバーソン
- パイセン
- 現行の低コストunit 1体

現在のcode上ではハチがdeployment cost 25で最安かつinitialである。このためハチが候補だが、Producerの発言だけでは正式名まで確定していない。Solはハチを**設計上の第一候補**として扱い、別unitへ置き換える必要がある事実を見つけた場合だけdecision deltaを返す。

### 3.4 ユニット解放・雇用

- ストーリー上の人物は、台本で指定された登場・合流時期に合わせて雇用導線を開く。
- 実際のplayable利用はCAPS購入制を基本とする。
- ストーリー外の既存unitも、適切なStage進行に応じてCAPS購入可能にする。
- 回復役は早期に雇用可能にする。
- 一つのStage clearで、複数の大きな雇用解放・支援解放・system解放を重ねすぎない。
- 解放を空白なく埋めること自体を目的にしない。物語の山場を雇用説明で分断しない。
- 台本にある「加入」表記とCAPS購入制の整合は、Design Lockでplayer-facing意味を一本化する。台本を黙って「雇用可能」に書き換えない。

### 3.5 戦場上限

- Stage上で同時に召喚・配置できるplayable unitは最大7体。
- 現行の無制限運用を廃止する。
- 目的は、低コストunitの物量だけで突破する最適解を抑え、編成と育成の価値を上げること。
- support object、支援物資、CRAWLER、NPC escort、敵を7体枠へ含めるかは現行実装を読んだ上でcontract化する。Producer intentはplayable unitの同時出撃枠である。

### 3.6 支援物資

Stage進行に合わせ、次のplayer-facing支援を段階的にCAPSで解放する。

- 回復
- ドラム缶
- 火炎ドラム缶

現行codeには`pod／drum／medical`と、互換系の`barrel／medkit／molotov／airstrike`が併存する。Solは重複UI・重複通貨・旧fallbackを残さず、最終的な三つの支援とCRAWLER固有能力を責務分離する。

### 3.7 育成

- unit level capは正式リリース内で再決定する。
- 現在の「内部最大50／公開上限25／Stage milestoneによる段階解放」をそのまま採用するとは限らない。
- 30 Stageの難易度、7体上限、CAPS総供給、雇用費、catch-up discount、他mode報酬を一体で試算して決める。
- 数字を先に決めてStageを合わせるのではなく、想定育成帯を各章・bossへ割り当てて逆算する。

### 3.8 ボスと他mode

- Storyで撃破したbossは、撃破状況に応じてSurvival／異常発生等の適切な他modeへ追加する。
- Story未撃破bossを名称・図鑑・他mode選択で先に露出させない。
- Story defeat、他mode unlock、図鑑発見、初回報酬、defeat countを同一booleanへ押し込まず、重複受取を防ぐdurable contractにする。
- Stage 25の変異ムガリアン社長、Stage 30のTAKUYA-Ωも対象に含める。

### 3.9 Save

- 旧進行を新しい30 Stageへ変換して継続させる必要はない。
- 正式リリースはニューゲーム前提でよい。
- ただし、旧saveやbackupを削除してはならない。
- 旧プレイヤー判定と記念CAPS付与のため、旧dataをread-only evidenceまたは退避snapshotとして保持する。
- 新進行は新しいschema／campaign generation／namespace等で開始し、旧進行と混ぜない。
- 記念CAPSは対象者へpopup付きで一度だけ付与し、reload、replica復旧、import、複数tabで二重受取できないようreceiptを保存する。

### 3.10 完成基準

次のいずれかが残る場合は「完成」「正式リリース可能」と報告しない。

- 未配置object
- missing asset、仮画像、診断placeholderのproduction露出
- event portraitとspeakerの不一致
- battle participantのsprite／animation／attack presentation不足
- stage固有object、背景、objective、enemy wave、boss entrance／defeatの未接続
- effect、audio、battle bark、event transitionの空欄
- Stage clear後の次目的地・解放・雇用・他mode連携の断絶
- CAPS二重付与、二重購入、二重unlock
- 7体上限の迂回
- save hydration／replica／reset／reward eligibilityの破壊
- smartphone横画面での切れ、重なり、豆粒化、操作不能
- Stage 1から30、ENDING、EPILOGUEまでのfresh run未確認
- HighまたはMedium findingの未解消

## 4. 画像・戦闘資産の固定判断

### 4.1 共通原則

- event会話へ継続的に登場する主要人物には、腰から上が判別できるevent portraitを用意する。
- 戦場へ出る人物・感染体・bossにはbattle sprite／atlasが必須。
- event-only人物にbattle spriteを作る必要はない。
- battle-only量産兵に個別の高精細event portraitを大量制作しない。
- 1画像1キャラ、全身、透過、文字なし、装備切れなしをidentity／battle masterの基本とする。
- 既存assetは、現在のidentity、性別、武器、役割を保ったまま再利用可否を監査する。
- 新規assetにはsource、creator、license、Producer approval、master/output hash、runtime bytesを記録する。

### 4.2 RED PANTHER

共通する勢力identity：

- 人型
- 赤レンズのガスマスク
- 黒／グレー主体、赤を限定accentにする
- 過剰な近未来装備にしない
- 同一組織と分かる装備言語を保つ
- 体格、armor、loadout、silhouetteで役割差を出す

必要兵種：

1. サバイバルナイフ近接兵
2. 盾兵
3. サブマシンガン兵
4. 指揮官兵

四兵種は戦場に出すためbattle assetが必須。汎用masked portraitをevent表示へ使うか、指揮官専用portraitを作るかはasset planで決める。

### 4.3 TAKUYA-Ω

- 現行TAKUYAのidentityを踏襲する。
- 現行比およそ2倍の巨大bossとして設計する。
- v10台本の橙色安全ベストの残骸、人工装甲、背面投薬管をidentity motifとして扱う。
- 別個体に見える全面刷新は不可。
- giant bossのbody bounds、foot anchor、shadow、hitbox、telegraph、sprite sheet規格を現行boss contractへ接続する。
- event／compendium／entrance用の読みとbattle atlasの両方を設計する。

### 4.4 その他新規人物・boss

- ムガリアン社長：通常event portrait必須。Stage 25変異体はboss battle asset必須。
- セガワ：主要event portrait必須。台本ではplayerが戦う相手ではなくTAKUYA-Ωに殺されるため、battle spriteは現時点では必須ではない。
- ナオキ：Producerから顔referenceをCodex送信時に添付予定。ただしv10本文には登場せず、役割、登場Stage、戦闘参加、セガワとの関係は未確定。画像生成やID追加を先行しない。
- 既存主要キャラ：event portraitは現行asset inventoryをまず監査し、腰上表示、表情、crop、identityが合格するものは再利用する。
- MOTHER、オオグチ、クロメ、ガイレン、フタゴ、改札喰い、TAKUYAは既存boss asset／contractを監査し、v10で成立する場合は再利用する。

## 5. Solが数値提案まで行い、Producer判断へ返す事項

以下は未確定であり、Solが推測でDesign Lockへ固定してはならない。現行codeと30 Stage全体を分析し、推奨値、代案、副作用、検証方法を一つのdecision packetへまとめる。

1. 正式リリースのversion番号
2. 4体目の初期低コストunitの正式名
3. 全unitのdeployment cost／cooldown再調整
4. 各unitの解禁Stageとrecruitment cost
5. 回復役の正確な解禁Stage
6. 三支援物資の解禁Stage、購入価格、戦闘内cost／cooldown
7. 各Stageのbase CAPS、初回・replay・star報酬
8. unit level最大値と章ごとのcap milestone
9. 旧プレイヤー記念CAPS額、対象判定、受取receipt
10. 各bossを追加する他modeと解禁条件
11. Stage 21〜30で必要な新規背景／object／一枚event imageの最小集合
12. ナオキの役割
13. 主人公名入力を採用するか、旧仕様へ戻すか
14. 台本上の「加入」とCAPS購入制のplayer-facing表現
15. 物理iPhone等、最終リリースで人手確認を必須にする項目

## 6. Non-goals

最初のSol Design missionでは次を行わない。

- production code実装
- mainへの直接変更
- 画像の無計画な大量生成
- v10台本のsilent rewrite
- 旧assetの削除・上書き
- 旧save削除
- release、tag、Pages公開
- 未決定数値の勝手な確定
