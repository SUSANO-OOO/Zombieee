# Version 0.9.5 employment and Mayo unlock evidence

## Authority and scope

- Version 0.9.0 release SHA: `f2633c538756385f13d166d3adbcdd39b3a08b21`
- Version 0.9.5 phase base: `2797a18bef859755e012c81d54496b6f60452b39`
- Issue authority: `#96`
- Scope: 「調達」から「雇用」へのplayer-facing変更、雇用可能通知、
  マヨちゃんのSurvival Wave 20到達解放、save schema 14

この工程はStage、unit、bossを追加せず、PWA、Service Worker、
offline／install対応、engine全面書き直しを行わない。

## Player-facing behavior

- app上のplayer-facing「調達」を「雇用」へ変更した。
- 雇用候補が生じると、正式人物カード、役割、武器、解放理由、費用を持つ
  `雇用可能` popupを安全な非戦闘画面で表示する。
- popupの`雇用画面へ`は人員画面の雇用tabへ直接移動し、`あとで`はmapへ
  留まる。いずれも44 pxのtouch targetを維持する。
- 通知確認はsaveへの永続化成功後だけ画面へ反映する。保存不能または例外時は
  popupを閉じず、操作lockを解除してpopup内に保存警告を表示する。
- popupは短いbackdrop、panel、人物カードの開示演出を持ち、
  `prefers-reduced-motion: reduce`では全て停止する。
- 通知SEは汎用決定音と分離した`employment-dossier-reveal`を、
  stable dedupe keyで一度だけ要求する。

## Mayo unlock contract

- マヨちゃんはStage 20報酬ではなく、Survival Wave 20へ到達した時点で
  雇用可能になる。Wave 20 boss撃破は不要で、雇用費は260キャップ。
- Stage 20で雇用可能になる宮本武蔵の既存契約は維持する。
- Wave 20へ入って撤退した場合、最高到達waveは20になる一方、未完了Wave 20の
  報酬は支給せず、Wave 21開始も解放しない。
- Wave 20の実runtime `queue-wave` eventで到達権利を保存するまで戦闘をpauseし、
  保存失敗時は通常pause menuへ迂回させず、同じblockerから再試行する。
- `highestWave`は完了wave、`highestReachedWave`は到達waveとして分離する。
- Version 0.9.0 saveでマヨちゃんが所有済み、発見済み、または雇用可能だった
  状態は再lockしない。

## Durable notice and receipt behavior

schema 14は次を保存する。

- `employmentNoticeReceipts`: 雇用可能になった事実のstable receipt
- `seenEmploymentNoticeIds`: playerが確認した通知

通知IDは`employment-available:<stable-unit-id>`である。複数の雇用候補は
receipt順にqueueされ、一件を確認しても次の未確認通知を失わない。雇用transaction
も従来どおり`recruit:<stable-unit-id>`で一度だけ適用される。

schema 13のマヨちゃん未所有fixtureを使ったproduction browser QAでは、
900キャップから260キャップを一度だけ消費し、schema 14へ640キャップ、
所有済み、雇用receipt 1、通知receipt・既読を保存した。再読込後のpopup再表示、
二重消費、二重receiptはいずれも0だった。

## Browser QA

`npm.cmd run qa:v095-employment`をproduction buildに対して実行した。

- Chromium／WebKit
- 1280×720、844×390、844×340
- touch入力
- popup matrix 6／6 + production-runtime Wave 20 entry 2／2 = 8／8 passed
- popupと雇用画面のoverflowなし
- 人物カード512×512 decode成功
- 44 px buttonを全caseで確認
- console error、page error、request failure、HTTP error: 0
- 通知cue request: popup各case 1回
- 通常motion 5／5でbackdrop、panel、人物カードの3 animation完走
- reduced-motion 1／1でanimation 0
- popup確認save失敗 6／6でinline error、popup維持、再試行成功
- Chromium／WebKitのWave 20 entry 2／2で、実frameの`queue-wave`から
  `in-wave`、`reachedWave: 20`、`runtimeWaveQueued: true`をreadback
- Wave 20到達save失敗 2／2でblocker維持、通常pause迂回0、再試行成功
- 永続結果は完了19／到達20、Wave 21開始未解放、run settlement 0、
  未完了reward 0、雇用通知receiptあり

Chromium 3／3では実AudioContextが`running`でwarning 0だった。headless WebKit
3／3はAudioContext生成前に既知のgesture制約でblockされ、cue requestのみを
確認した。この結果をWebKit実speaker再生成功とは扱わない。

## Cross-checks and required gates

- focused campaign／Survival／rendered HTML／audio tests: 143／143
- all tests: 731／731
- production build: passed
- Lint: passed
- `git diff --check`: passed
- Survival Wave browser QA: Chromium／WebKit 2／2、Wave 5 boss撃破後の
  Wave 6強化選択まで到達、diagnostics 0
- save migration browser matrix: Chromium／WebKit、844×390／844×340の
  4／4 matrix、44／44 cases、diagnostics 0

headless browserは描画、touch導線、保存、decode、mixer状態を検証する。
物理スマートフォンの発熱、実speaker聴感、物理端末操作は未確認であり、
RCのproducer acceptanceに残す。

## Reproduction

```powershell
npm.cmd run build
npm.cmd run qa:v095-employment
npm.cmd run qa:survival-waves
npm.cmd run qa:save-migration
node --test tests/campaign.test.mjs tests/survival-foundation.test.mjs tests/survival-runtime.test.mjs tests/rendered-html.test.mjs
npm.cmd test
npm.cmd run lint
git diff --check
```
