# 西新世紀末物語 — PRODUCT ROADMAP

更新日：2026-08-08

## 1. 役割

本書は現在からVersion 1.0以降までの長期目標と依存関係を管理します。現在のrelease、SHA、QA状態は[PROJECT_STATE](PROJECT_STATE.md)、恒久運用は[AGENTS.md](../AGENTS.md)が所有します。

Versionごとの製品判断と実行は、そのVersionのProducer Decisions／実行台帳Issueを正本とします。完了済みVersionのIssueを次Versionの実行権限として再利用しません。

## 2. 長期製品目標

- 本編Stage 50、playable unit 30体をVersion 1.0の完成基準とする
- Stage 50／30体を固定上限にせず、Stage 100、150以降へ拡張可能にする
- Version 1.0まではbattle体験を主対象にし、長尺storyの量産を主目的にしない
- smartphone横画面を第一基準、PC横画面を正式対応とする
- stable ID、local save、migration、PWA差分update、previous generation、rollbackを全Versionで維持する
- 一つのVersionは主目的を一つに絞り、関連改善を必要最小限に限定する
- vertical slice、主要UI／visual、RCで人手確認を入れる

## 3. 完了済みの基盤

### Version 0.5.0〜0.8.0

- Stage 1〜16、連続battle space、CRAWLER deployment、戦場物資、航空支援、一斉掃射
- playable 11名、formation、caps、Rank progression
- data-driven content／event foundation、save recovery、export／import
- BGM／SE独立volume、smartphone横画面、mobile performance QA

### Version 0.9.0

- Stage 17〜20、Survival、異常発生任務5件
- boss共通基盤、新boss5体、通常感染体6種
- playable 16名、全16体manual ability
- Level 1〜50基盤、equipment、records、図鑑、詳細result
- save schema v13、旧save migration

### Version 0.9.5系

- 全16体の移動・攻撃・manual ability animation刷新
- CRAWLER、enemy、boss、VFX、mobile render／memory／lifecycle改善
- 雇用UX、雇用可能popup、マヨちゃん解放
- save schema v14、v13 migration、origin別save保全

### Version 0.9.6〜0.9.8.2

- PWA、Service Worker、初回全件download、offline起動
- size／SHA-256／Cache Storage／manifest commit gate
- pause／resume／cancel／reload recovery、差分update、active／previous generation、rollback
- saveとasset cacheの分離
- audio bundle、lossless WebP transport derivative、初回全件取得時間の短縮

### Version 0.9.9.0 — 正式公開済み

実行正本：[Issue #136](https://github.com/SUSANO-OOO/Zombieee/issues/136)

状態：**2026-08-08正式公開完了**

- release SHA：`19a79404822ebc8f0cbd8a3b809b8ed0adbc28af`
- release tree：`305af62474c8a1ea118251023ec4ad58bee17975`
- annotated tag：`v0.9.9.0`
- final audit：APPROVE — High 0／Medium 0／Low 0
- Issue #136：completed

統合内容：

- UI操作SE、reject feedback、atomic雇用／強化transaction、save-pending battle boundary
- normal／pressure／boss BGM、全16ability audio、semantic receipt ledger
- boss entrance／defeat、explosion、drum arrival、CRAWLER deployment／barrage／airstrike presentation
- 844×390／844×340 mobile HUD safe-zone／readability修正
- Producer承認A2によるversioned infected-face app icon
- project-original audio／icon／CRAWLER equipment provenance、PWA manifest／bundle integration

公開後manifest：416 assets、89,970,119 logical bytes、89,430,216 distinct bytes。save schema v14、PWA active／previous／rollback／offline契約は維持しています。

物理iPhone本体speakerの聴感と発熱は未確認の残存QAであり、後続Issueで扱います。

## 4. 今後の実装方式

今後のVersion実装は、製品判断と実装責務を分離します。

1. Producerが一つの主目的、non-goal、受入境界を固定
2. **Sol Design Lead**が現行コードと正本を調査し、実装方式、責務、変更範囲、test／QA、PR分割、停止条件を設計
3. **Luna Implementation Lead**がSol設計を正本としてコード／asset／test／QA／PRを実装
4. Design Leadとは別コンテキストの**Sol Auditor**がfixed HEADをread-only監査
5. High／Medium未解消0と対象Versionのrelease gateを満たした場合だけintegration／main／releaseへ進む

Codexの`/goal`は、**長時間かどうかではなく、同じ達成目標を複数工程・checkpoint・反復検証にわたって保持する必要があるか**で判断します。Version／featureの正式設計、複数moduleをまたぐ実装、実装→QA→修正→PR、audit remediation、release missionは`/goal`対象です。read-only確認、単発test、typo修正、設計判断を伴わない小さな単一file修正等は通常promptで処理できます。

SolとLunaが`/goal`を使う場合は設計goalと実装goalを分離します。Lunaが重大な設計欠落を見つけた場合は独自再設計せずSolへ戻し、Design Lead Sol自身を最終独立Auditorにしません。

詳細は[AGENTS.md](../AGENTS.md)を正本とします。

## 5. Version 0.9.9.0以降

次Versionの主目的は**未確定**です。0.9.9.0の公開後実測、Issue #24の残音響項目、Producer判断を確認してから、新しい実行台帳Issueで一つだけ固定します。

候補：

- Stage 21以降の本編拡張
- 新地域／人間敵勢力
- playable unit拡張
- equipment／formation synergy等の横成長
- Challenge／boss rush等のSurvival派生
- PWA payload／update／mobile performanceの継続改善

候補は方向性の在庫であり、自動採用ではありません。複数候補を一つのVersionへ無条件に詰め込みません。

## 6. Version 1.0

Version 1.0では次を一つの完成loopとして統合します。

- 本編50stageを基準とするcampaign
- 30 playable unitsを基準とするroster
- acquisition、Level、equipment、formation、battle、reward、save
- multiple missions、bosses、events
- Survival／Challenge等の継続battle
- smartphone／PC横画面
- local save、migration、PWA update、rollback

Stage 50、30unitは完成基準であり、将来上限ではありません。

## 7. QA方針

- simulationはDPS、durability、wave、resource、economyを検証する
- soakはframe time、memory、queue、duplicate event等の技術劣化を検証する
- Chromium／WebKit automationは機能回帰を検証する
- 物理iPhoneはspeaker、earphone、touch、home-screen icon、lock復帰、発熱を検証する
- AI auto-playの敗北だけを難易度blockerにしない
- 人間の楽しさ、読みやすさ、難易度、art directionは人手受入が所有する
- implementation完了はtest本数だけでなく、Sol設計のacceptance criteriaと実ゲーム証拠で判定する
