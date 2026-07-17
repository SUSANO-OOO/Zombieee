# 西新世紀末物語 — Version 0.7.0 実行ランブック

更新日：2026-07-17
状態：実装からGitHub Pages正式公開までの実行正本

## 1. 最初に読むもの

開始時に読むのは次の2点だけ。

1. `docs/PRODUCER_DECISIONS_0.7.0.md`
2. 本書

詳細文書は該当フェーズで必要な箇所だけ読む。

- システム・数値：`docs/PRODUCT_SPEC_0.7.0.md`
- 人物・加入・内部ID：`docs/CHARACTERS_0.7.0.md`
- 物語：`docs/STORY_BIBLE_0.7.0.md`、`docs/SCENARIO_0.7.0_COMPLETE.md`、必要なPART
- リリース・復元：`docs/RELEASE_BACKUP_RECOVERY.md`

旧Issueコメント、旧PRコメント、旧稿は開始時に読み込まない。最新正本と衝突する旧情報を採用しない。

文書更新、CI成功、preview成功だけでは完成としない。ゲームコード、正式アセット、Stage 1〜6、save、実ブラウザQA、公開後QAが揃うまで未完成である。

## 2. リポジトリ

- repository：`SUSANO-OOO/Zombieee`
- branch：`feat/0.7.0-unit-collection`
- PR：#38
- Issue：#37
- save key：`nishijin-campaign-v1`
- target schema：v5
- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 画像承認manifest：`docs/ASSET_APPROVALS_0.7.0.json`

文書記載SHAを現在値として固定しない。作業開始時と重要操作直前にGitHubの最新状態を再取得する。

## 3. Codexの裁量

固定済み製品判断と安全境界を維持する限り、Codexは次を確認なしで決定できる。

- 内部アーキテクチャ、モジュール分割、型、関数、データ構造
- AI、save、描画、音響、アセットpipelineの具体的な方式
- 技術的に同等または高品質な代替実装
- テスト方法、seed、fixture、simulation、証拠形式
- 非依存タスクの並行順、フェーズ内の作業順
- 許容範囲内の数値調整
- 影響範囲を限定したrefactor、性能改善、アクセシビリティ改善
- connector、`gh`、通常gitの安全な使い分け

停止して確認するのは次に限る。

- 固定済み人物、物語、加入順、役割、名称、画風、公開先の変更が必要
- 許容範囲外の数値変更が必要
- 一枚単位の画像承認が必要
- repository visibility、課金、secrets、外部契約、法務・ライセンス判断が必要
- データ消失、履歴破壊、force操作など不可逆な変更が必要
- GitHub Pagesを匿名公開できず、安全な技術代替がない

上記以外の技術的迷い、軽微なUI調整、不具合修正、テスト追加、内部構造変更では逐次質問せず、自律的に実装・検証する。

禁止：force push、共有履歴のrebase・amend、`main`直接push、未承認画像の正式採用、repository visibility変更、secrets・課金・外部契約の無断変更。

## 4. 使用量と進行効率

- Issue #37を唯一のタスク台帳とする
- 完了済みフェーズを、依存仕様が変わらない限り読み直さない
- コード検索、diff、対象モジュールから入り、repository全体を無目的に再読込しない
- フェーズ中は対象testを優先し、全test・build・browser matrixは出口ゲートでまとめる
- 証拠と進捗コメントはフェーズ完了時に一件へ集約する
- 状態変化のないコメント、空commit、重複文書、重複調査を作らない
- 同じファイルを複数エージェントへ無調整で編集させない
- 画像は未承認派生を先回り生成しない
- 安全に再利用できるbrowser・依存関係・生成物cacheは再利用する
- 品質問題は発見フェーズ内で修正し、後工程へ持ち越さない

## 5. 完成品質

完成とは仕様項目が存在することではなく、次が実際に成立することを指す。

- 承認された人物・敵・背景の特徴が派生画像と実ゲームで維持される
- スマートフォン横画面で人物、敵、レーン、目的、操作が理解できる
- 敵と味方が表示上もhitbox上も自然に接触し、素通りしない
- ユニットの役割が実戦で区別できる
- Stage 1〜6が同じ背景・敵・攻略の反復にならない
- save移行で進行、所有、星、報酬を失わない
- BGM、環境音、SE、無音が機能し、無音不具合や二重再生がない
- 正式URLでfresh saveと既存saveの両方が遊べる

主観的な見た目は自動テストだけで保証しない。全新規画像の一枚承認、identity lock、派生比較、実ゲーム統合証拠、段階レビューで担保する。

## 6. 実行フェーズ

各フェーズは出口証拠が揃うまで完了扱いにしない。

### P0：同期・baseline・公開可否

作業：

1. `origin/main`とfeature branchをfetch
2. PR #38のstate、draft、base、head、mergeability、CIを確認
3. 最新`origin/main`を通常merge
4. PR #39のSafari保存修正を確認
5. baseline build、test、Lint、diff check
6. Stage 1〜3、fresh save、既存save、音響、844×390、844×340を確認
7. 変更対象モジュールと既知不具合を整理
8. GitHub Pages API、repository visibility、plan、匿名公開見込みを確認

出口証拠：merge commit、baseline結果、対象モジュール、既知不具合、PR #39取込み、匿名公開見込み。

P0未完了のまま本実装へ入らない。

### P1：名称・データ・save v5

参照：Product Spec、Characters。

作業：

- ナオ、いくらちゃん、レイダーへ名称・ID・表示を正規化
- プレイアブル11名、所有、発見、調達、加入をデータ化
- 最大7枠、3プリセット、複数召喚のデータ構造
- schema v5、v2〜v4 migration
- localStorageとIndexedDBを独立検証
- 一方破損復旧、両方破損時の回復画面
- migration前saveと直前正常saveを退避
- 星、報酬、加入の二重適用防止

出口証拠：migration matrix、fresh／v2／v3／v4／片側破損／両側破損テスト、所有・進行差分、export／import。

### P2：手動戦術撤去・AI・コスト経済

参照：Producer Decisions、Product Spec。

作業：

- 前進、後退、防御、標準、突撃のUI、入力、state、倍率、target bias、保存、説明を撤去
- 空白枠、透明タップ領域、死んだshortcutを除去
- 配置コスト、再出撃待ち、支援ゲージ、総攻撃を維持
- 味方AIの索敵、接触、通行阻害、再索敵を修正
- TAKUYA撃破後に残存・後続敵を再取得
- コスト上限150基準、許容140〜160
- 第一調整では開始コストと自然回復を維持

出口証拠：手動戦術player-facing残存0、Stage 3決定的テスト、3レーン・各役割テスト、100seedで敵素通り0、WebKit反復10回で敵素通り0、コスト実測。

敵素通り、接触無視、表示とhitbox不一致が1件でもあれば不合格。

### R1：基盤レビュー

P0〜P2を独立read-onlyレビューし、High／Medium未解消0とする。

### P3：所有・編成・調達・ユニット役割

参照：Product Spec、Characters。

作業：

- 初期6名
- クレイジーキング無料加入、タタラ調達
- レイダー調達
- ガンテツ無料加入
- モンキー無料加入
- キャップ、所有、未遭遇、情報判明、調達
- 1〜7枠、空き枠、3プリセット
- 同一人物複数召喚
- ガンテツ高耐久盾・肩代わり
- ナオ低コスト単体回復・集中治療減衰
- クレイジーキング近接範囲殲滅
- レイダー同一レーン直線範囲制圧
- タタラ対装甲・対拠点

出口証拠：加入・調達・所有・migrationテスト、プリセット保存読込、1枠／7枠／空き枠出撃、複数召喚、各役割の実測。

### P4：敵・Stage 1〜6

参照：Product Spec、Story Bible、該当Scenario PART。

作業：

- 絡手、漏泥、走鬼、改札喰い
- Stage 4改札区域
- Stage 5ホーム／線路区域
- Stage 6保守トンネル／封鎖区域
- Stage 1・4救助自動成立
- Stage 5護衛
- Stage 6三電源と封鎖
- Stage 1〜3を7枠・新経済へ再調整
- 論理レーン、床面、anchor、hitboxを先に固定

出口証拠：Stage 1〜6の開始・勝利・敗北・再戦・結果・復帰、敵能力テスト、debug overlay、レーン外歩行0、Stage 4〜6を3種類以上の編成でクリア、単一人物必須0。

### P5：物語・音響

参照：Story Bible、Scenario索引、必要なPART。

作業：

- くまやプロローグ
- CRAWLER確保モンタージュ
- 四十三日後への接続
- Stage 1〜6会話・結果
- 固定4名の人物像と口調を保全
- 旧表示名をplayer-facingから除去
- BGM、環境音、SE、必要な無音
- キャラクターボイス0
- AudioContext解除、音声有効化、音量、二重再生・残留音防止

出口証拠：話者別台詞一覧、旧表示名検索0、音読監査、シーン遷移、音声有効化表示、回転・ロック・タブ復帰・再戦後の二重再生0。

### R2：ゲームプレイループレビュー

P3〜P5の画像非依存部分を独立read-onlyレビューし、High／Medium未解消0とする。

### P6：画像制作・承認・統合

P1〜P5と並行可能。承認待ち画像に依存する統合だけ停止する。

画像キュー：初期所有人物、Stage 1〜2解放人物、Stage 4〜6人物、いくらちゃん、新敵、Stage 4〜6背景・オブジェクト、重要イベントカット、必要な保全4名派生。

最初の画像制作前に`docs/ASSET_APPROVALS_0.7.0.json`を作成する。承認管理文書を乱立させない。

各画像は一枚だけ提示し、Asset ID、種別、対象、用途、予定パス、revision、元承認Asset ID、短い意図、スマホ識別点を記載する。

基準アート承認後、顔、年齢感、髪、体格、服、配色、武器、装備、姿勢、シルエットをidentity lockとする。派生画像は元画像との比較証拠を添える。

個別画像承認だけで統合完了としない。844×390と844×340の実ゲームで、同一人物、識別性、切れ、接地、UI干渉、背景との調和を確認する。

出口証拠：manifest、承認URL、revision、commit、最終パス、派生比較、実ゲーム統合画像。

### R3：視覚統合レビュー

承認済みアセットのidentity lock、UI、背景、接地、スプライト、スマホ視認性、Stage差別化を独立reviewし、High／Medium未解消0とする。

### P7：統合QA・バランス

調整前に各Stageの目標所要時間、成功率帯、CRAWLER HP帯、損失帯、初回出撃時間、コスト溢れ率を記録する。結果を見て無断変更しない。

最低条件：

- 初期6名でStage 1クリア可能
- 調達人物なしでも本筋進行可能
- Stage 4〜6は複数編成でクリア可能
- 特定人物必須0
- 同一ユニット連打だけで全Stage安定クリア不可
- コスト上限拡張で常時連打化しない
- 役割適合編成が明確に有利
- 敵HPだけの一律増減で調整しない

必須QA：844×390、844×340、Chromium、WebKit iPhone相当profile、touch、safe area、ブラウザUI、回転、画面ロック・復帰、タブ復帰、主要タップ領域原則44 CSS px以上、scroll・中央ずれ・下部切れ・透明領域0、console warning/error 0、asset 404・参照切れ0。

### R4：release candidateレビュー

fresh save、v2〜v4 save、Stage 1〜6、AI critical cases、balance、audio、visual identity、mobile、console、404、rollback可能性を独立reviewし、High／Medium未解消0とする。

## 7. コミットと報告

工程単位で通常commit・通常pushする。

推奨単位：P0、P1、P2、P3、P4、P5、P6統合、P7、release準備。

一つの巨大commit、無関係な全面refactor、状態変化のないコメント、承認待ちごとの空commitは禁止する。

Issue #37をチェック台帳、PR #38を変更概要・承認・QA・release証拠の所有元とする。

## 8. 公開前ゲート

全項目を満たすまでReady化しない。

- P0〜P7完了
- R1〜R4 High／Medium未解消0
- 全新規画像個別承認
- identity lockと派生同一性確認
- 正式アセットとmanifest一致
- Stage 1〜6実プレイ可能
- build、全test、Lint、diff check、CI成功
- console warning/error 0
- asset 404・参照切れ0
- migration・破損復旧成功
- 手動戦術残存0
- 敵素通り0
- ユニット役割分離成立
- 難度崩壊なし
- 844×390、844×340、WebKit受入
- GitHub Pages匿名公開見込み確認
- 未解決製品判断0

## 9. GitHub Pages正式公開

ゲート通過後、次を連続実行できる。

1. PR #38のbase、head、CI、mergeabilityを再取得
2. PRをReady化
3. PR経由で通常merge
4. result SHAをrelease SHAとして固定
5. `v0.7.0` annotated tagを作成・通常push
6. tag targetを確認
7. GitHub Releaseを公開
8. GitHub Pages workflowのbuild、browser smoke、deploy成功を確認
9. 正式URLのrelease SHAを確認
10. GitHub未ログインの新規ブラウザ相当で、認証要求なし、HTTP成功、主要asset取得、fresh save開始、Stage 1開始を確認
11. fresh／既存save、Stage 1〜6、AI、音響、画像、再読込を公開後QA
12. 物理iPhoneまたは実機クラウドが利用可能なら確認
13. 利用不能ならWebKit代替ゲートの全証拠を確認し、物理実機未確認を最終報告へ明記
14. Issue #37とPR #38へ最終報告
15. Issue #37をcompletedでclose
16. feature branchを通常削除

private repositoryのまま匿名公開できない場合、repository visibilityを変更しない。Issueをopenのまま、原因、確認結果、安全な選択肢を報告して停止する。

ChatGPT Sitesへのdeployment、保存、履歴更新、QAは行わない。

## 10. ロールバック

重大不具合を確認した場合：

- Issue #37を閉じない、または再open
- 直前release SHAを特定
- force操作を使わずrevert PRで復旧
- Pages workflowと正式URLを再確認
- 原因修正は新しい通常PRで行う

## 11. 最終報告

- release SHA、merge commit、tag、GitHub Release
- Pages workflow run、正式URL、匿名アクセス結果
- P0〜P7完了表、R1〜R4結果
- 公開後QA
- 物理iPhone／実機クラウド結果、またはWebKit代替証拠
- 画像承認一覧、identity比較
- test、CI、save migration、AI critical test、バランス実測
- console、404、rollback要否
- ChatGPT Sitesを更新していないこと
