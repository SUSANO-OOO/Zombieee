# 西新世紀末物語 — プロジェクト状態

更新日：2026-07-24

## 1. 正式公開

唯一の正式公開先：**GitHub Pages**

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：**Version 0.7.5**
- Version 0.7.5 game release SHA：`787e1c2cfdf3ce87c2150264abf190ee7339dd12`
- deployment workflow：`.github/workflows/github-pages-release.yml`
- public QA workflow：`.github/workflows/github-pages-public-qa.yml`
- GitHub Release：`v0.7.5`

公開後、SSR titleとhydration payloadに旧Version 0.7.1表記が残る問題をPR #59・#60で修正した。既存`v0.7.5` tagとgame release SHAは移動していない。

公開中の正確なversion、release SHA、request ID、Issue metadataは、Actions結果だけでなく正式URLの公開HTML metadataと照合する。

ChatGPT Sitesは旧公開先であり、0.7.1以降のdeployment、QA、正式判定、復旧に使用しない。

## 2. 現在のGitHub基準

本書更新前に確認した`main`：

`c64935fd6f293e0c39fa41d1c6096df81e09bf8c`

- repository visibility：`public`
- default branch：`main`
- PR #50：明示的Pages release contract、merge済み
- PR #51：Version 0.7.1 Stage 5／6 hotfix、merge済み
- PR #52〜#57：Version 0.7.5工程PR、merge済み
- PR #58：Version 0.7.5、merge済み
- PR #59・#60：公開title identity修正、merge済み
- Issue #43：Version 0.7.1、completed／closed
- Issue #44：Version 0.7.5、completed／closed
- Issue #61：Version 0.8.0、open
- save key：`nishijin-campaign-v1`
- 現行save schema：v7

現在値は作業開始時に再取得する。本書記載SHAを永久に最新として扱わない。

## 3. Version 0.7.5で完成した基盤

- data-driven content／event基盤
- generator、schema、registry、loader、validator、migration
- 連続battle spaceとplayer-facing固定3lane撤廃
- profile-driven ally／enemy AI
- 全11unitのRank 0〜4 progressionとcaps economy
- CRAWLER door／ramp deployment
- weapon-specific animation／VFX／SE／damage event
- machine gunの複数発砲・複数damage
- Stage 4〜6 mission flow
- schema 7 migration、recovery、export／import
- background／tab復帰、AudioContext、二重再生対策
- mobile performance QA
- human battle voice維持、story全文読み上げ未実装

Version 0.7.5 release candidateでは525 tests、正式公開後はtitle修正を含め528 testsが成功と報告されている。物理iPhoneは未確認で、WebKit iPhone相当と性能計測が代替証拠である。

## 4. 公開版プレイで確認された0.8.0対象

### コンテンツ量

- 現行Stage 1〜6は短く、Stage 7〜16の10battle stage追加が必要

### 背景・grounding

- Stage 6の一部場面は、battlefieldではなく壁面をcharacterが歩いているように見える
- unit／enemyが壁面設備やobject上へ浮く、縦積みされる場面がある
- Stage 7以降は明確な床面とruntime walkable spaceを一致させる必要がある
- Stage 6背景自体の修正はVersion 0.8.0の必須対象にしない

### CRAWLER出撃

- 扉前でunitが一瞬透過する
- walk motionと実移動が一致せず、滑るように戦場へ移動する
- door、occlusion、grounding、walk速度、footstepを同じdeployment flowへ接続する必要がある

### Character visual

- モンキーのevent portraitは顔が不自然で、魅力・精悍さ・identityの改善が必要
- event portraitとformation／personnel cardが同じportrait mappingを共有するため、新unitの全身立ち絵がcardへ小さく流用されている
- 全11unitへidentity master、event、card、battleの用途別profileが必要
- event画面で別lineのportraitが幽霊のように半透明表示される場面がある

### Audio／upgrade UX

- 設定画面にBGM／SEの独立volume sliderが必要
- unit強化時にcaps消費、成功、stat上昇を感じられるSE／effectが不足
- 最大Rank到達を通常強化と区別して表示・演出する必要がある

### Version identity

- 公開版のbattle headerに旧Version 0.7.1表示が残る場面が確認された
- browser title、battle header、title、hydration、metadataを単一release identityへ統一する必要がある

## 5. 次の正式作業

### Version 0.8.0

Issue：#61  
正式名称：**作戦区域拡張・戦闘演出改善**  
状態：**プロデューサー承認済み・未実装**

最上位正本：

1. `docs/PRODUCER_DECISIONS_0.8.0.md`
2. Issue #61
3. `AGENTS.md`
4. Version 0.7.5の現行コード、tests、QA記録

主対象：

- Stage 7〜16、合計10battle stage
- 最低4environment masterと10battle variant
- grounding、walkable、spawn、objective interaction
- CRAWLER出撃の透過・滑走修正
- モンキー再設計
- 全11unitの用途別visual profileとcard統一
- event portraitのghost表示修正
- BGM／SE volume slider
- upgrade／MAX Rank feedback
- player-facing Version identity統一
- 既存save、Stage 1〜6、audio、performanceの回帰

全ゲート通過後、Codexは`v0.8.0`正式公開、公開後QA、Issue #61 closeまで実行できる。

## 6. 長期方向

- 本編stage数：50を基準、将来追加可能
- playable unit：30体を基準、将来追加可能
- Challenge Mode：1session 3stage、約6sessionを将来目標
- Version 1.0まではbattle中心
- 長尺story量産は主対象外
- battle event、短文会話、将来story差し込み口を維持
- stable IDs、local save、migration、rollbackを全versionで維持

## 7. 安全境界

禁止：

- `main`直接push
- force push、共有履歴rebase・amend
- 既存tag移動・上書き
- repository visibility、課金、secrets、外部契約の無断変更
- 既存未commit・未追跡変更の削除
- save破壊・自動初期化
- ライセンス不明素材の正式採用
- ChatGPT Sites deployment
- 未確認・失敗の成功報告

重大な公開不具合は、直前の正常release SHAを確認し、通常のrevert PRまたはimmutable release再deploymentで復旧する。
