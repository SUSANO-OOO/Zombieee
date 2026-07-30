# 西新世紀末物語 — Version 0.9.5 Release Notes

更新日：2026-07-31

Version 0.9.5は、新しいStage、unit、bossを増やさず、Version 0.9.0の戦闘表示、スマートフォン性能、雇用導線、save安全性をplayer-facingで仕上げる品質更新です。

## プレイヤーが感じる主な変更

- 全16体の移動開始、歩行、停止、方向転換、通常攻撃、recoil、recovery、manual abilityの見え方を刷新しました。
- 銃口、投擲、刃先、projectile、impact、telegraph、hit timingを武器とdamage発生へ合わせました。
- CRAWLER出撃時の意図しない透過・欠けを修正し、doorによる自然な遮蔽と全16体の不透明表示を両立しました。
- enemy、boss、CRAWLER、戦場VFXの読みやすさを改善し、Raider、Crazy King、Baba Yaga、escort／cart AI等の残存不具合を修正しました。
- 取得表現を「調達」から「雇用」へ統一し、安全な画面で一度だけ表示する雇用可能popupを追加しました。
- マヨちゃんはSurvival Wave 20へ到達した時点で雇用可能になります。雇用費260 capsと宮本武蔵のStage 20解放は変わりません。

## スマートフォン描画

- 自動、高画質、省電力の3 modeを追加しました。画質modeでsimulation、damage、cooldown、報酬、解放結果は変わりません。
- device pixel ratio、render cadence、offscreen処理、static cache、object pool、effect上限、lifecycle復帰を調整しました。
- 同一scenarioの計測では、省電力modeのrender-work proxyがAuto比76.74%減りました。
- Producerの物理smartphone確認では発熱が残っています。Version 0.9.5で負荷を低減しましたが、発熱は継続最適化対象です。
- Codexは端末実温度を計測していません。端末、case、充電、周囲温度、browserで結果は変わります。

## Save互換

- save schemaをv13からv14へ一度だけmigrationします。
- owned、discovered、recruitable、Stage、stars、caps、Level、equipment、presets、records、Survival progress、settings、audio、backup、recovery、export／importを保持します。
- migrationはidempotentで、二重解放、二重receipt、二重caps消費を行いません。
- LAN、localhost、GitHub Pagesは別originのためsaveを自動共有しません。必要な場合だけexport／importを使用してください。

## QA

- full tests：758/758
- production build、Lint、content validator、`git diff --check`：pass
- 全16体出撃：576/576、walk／turn／attackのaligned before／after：192 frame
- Stage 1〜20 AI任務：120/120、CRAWLER defense：240/240、route／cart：12/12
- save migration／origin：78/78、雇用：6/6、マヨちゃんWave 20：2/2
- independent read-only review：High／Medium／Low 0

証拠正本は`docs/qa/v095/acceptance-corrections/README.md`です。

## 物理端末の確認境界

- Producerによる物理smartphone確認：Stage 1〜13
- Stage 14〜20：browser／WebKit／AI regressionで補完
- 未確認として残すもの：native Safari長時間、物理speaker聴感、端末実温度、物理touch／回転／screen lock復帰

未確認項目を確認済みとは報告しません。公開後は正式URLでfresh saveとVersion 0.9.0由来saveを含むPublic QAを実行します。

## 非対象

PWA、manifest、Service Worker、offline／install、App Store／Google Play対応、新Stage、新unit、新boss、engine全面書き直しはVersion 0.9.5へ含みません。
