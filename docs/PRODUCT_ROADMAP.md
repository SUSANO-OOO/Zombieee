# 西新世紀末物語 — PRODUCT ROADMAP

更新日：2026-08-04

## 1. 役割

本書は現在からVersion 1.0以降までの長期目標と依存関係を管理します。現在のrelease、SHA、QA状態は[PROJECT_STATE](PROJECT_STATE.md)、Version 0.9.9.0の製品判断と実行は[Issue #136](https://github.com/SUSANO-OOO/Zombieee/issues/136)、恒久運用は[AGENTS.md](../AGENTS.md)が所有します。

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
- 正式公開中のVersion 0.9.8.2は374 logical assets、79,330,439 distinct bytes

## 4. Version 0.9.9.0 — 戦闘体験・音響・演出・icon

実行正本：[Issue #136](https://github.com/SUSANO-OOO/Zombieee/issues/136)

状態：**PR1〜PR4 integration統合済み、Gate A合格、release-prep中**

目的：プレイヤーが操作、transaction、攻撃、命中、ability、boss、supportを音・映像・feedbackから明確かつ気持ちよく理解できる品質へ改善する。

統合内容：

- UI操作SE、reject feedback、atomic雇用／強化transaction、save-pending battle boundary
- normal／pressure／boss BGM、全16ability audio、semantic receipt ledger
- boss entrance／defeat、explosion、drum arrival、CRAWLER／barrage／airstrike presentation
- Producer承認A2によるversioned infected-face app icon
- project-original audio／icon provenance、PWA manifest／bundle integration

維持する境界：

- new Stage／unit／gameplay systemを追加しない
- damage、cooldown、targeting、reward、save schemaを変更しない
- AudioMixer／Service Worker／PWAを全面再設計しない
- 0.9.8.2 save、通貨、雇用、Level、equipment、解放、既読、records、settingsを保持

公開gate：別チャットのSol Auditor Finding 0とProducer Gate Bの明示承認後だけ、final main merge、annotated tag、GitHub Release、Pages manual dispatchへ進む。

## 5. Version 0.9.9.0以降

次Versionは0.9.9.0の公開後実測とIssue #24の残音響項目を確認してから、一つの主目的を新Issueで固定します。自動的に次の全項目を同時採用しません。

候補：

- Stage 21以降の本編拡張
- 新地域／人間敵勢力
- playable unit拡張
- equipment／formation synergy等の横成長
- Challenge／boss rush等のSurvival派生
- PWA payload／update／mobile performanceの継続改善

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
