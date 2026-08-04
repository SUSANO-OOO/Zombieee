# 西新世紀末物語 — プロジェクト状態

更新日：2026-08-04

## 1. 正式公開

唯一の正式公開先はGitHub Pagesです。

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：**Version 0.9.8.2**
- `main`／release SHA：`662ec6103a769846343e60dacf19dd36adeafdde`
- annotated tag：`v0.9.8.2`、同release SHA
- GitHub Release：[Version 0.9.8.2](https://github.com/SUSANO-OOO/Zombieee/releases/tag/v0.9.8.2)
- request ID：`v0.9.8.2-final-release-20260802`
- release ledger：Issue #133
- 公開HTML metadata：version `0.9.8.2`、release SHA `662ec6103a769846343e60dacf19dd36adeafdde`、Issue `133`

上記は2026-08-04にtag、Release、`main`、正式URLのHTMLから再取得した値です。ChatGPT Sitesは旧公開先であり、新規deployment、QA、正式判定、復旧に使用しません。

## 2. Version 0.9.9.0 release candidate

実行正本：[Issue #136](https://github.com/SUSANO-OOO/Zombieee/issues/136)

状態：**Gate A合格、PR1〜PR4 integration統合済み、release-prep中**

- integration branch：`integration/0.9.9.0`
- PR1 merge：`6e5c304f575a31c2e9762e652a2437e93291ef75`
- PR2 merge：`464975906e969444f71a9d2e48646b077f38f514`
- PR3 merge：`3e09b4c09cb1bc67cf1322bd539f5b0bc7e5d060`
- PR4 merge／release-prep source：`cc1b90474801224819d1d1905cbd5a5ed07a3365`
- release-prep branch：`codex/0.9.9.0-release-prep`
- final main PR、release SHA、tag、GitHub Release、Pages正式deployment：未作成／未実行

Gate Aで、現在のAudio、VFX、感染者face icon A2がProducer承認済みです。A2 master SHA-256は`88b5b3aff7f8a026b3bd9d95433c9363804f4e838d224df4c6298073ea3be38e`です。

## 3. Version 0.9.9.0のplayer-facing変更

### UI・transaction feedback

- 選択、決定、戻る、購入、強化、報酬、出撃、拒否をsemantic cueへ整理
- 雇用・強化のdurable save成功後だけ成功feedback／SEをpublish
- 雇用と強化、自動saveを共通queueで直列化し、stale save、二重減算、二重receiptを防止
- `aria-disabled`操作はreject feedbackを返しつつ、禁止stateを変更しない
- save-pending中は戦闘入力とframe進行を遮断

### Battle audio

- surface／stationのpressure BGMとboss BGMを追加
- normal↔pressure、boss entry／exitを戦況から解決
- 全16unitのability activation root、timeline subcue、ready familyを明示契約化
- boss、defeat、explosion、supportをgeneration／receipt単位で一回だけ発火
- 36 physical audio assetsをproject-original source、固定provenance、再現可能なmasterへ追加

### Battle presentation

- boss entrance／defeatを段階presentation化
- small／medium／large explosionを用途別に分離
- explosive drumに影、落下、回転、dust、spark、bounce、activationを追加
- CRAWLER roof machinery、barrage、airstrikeを装備と一体に見える表現へ改善
- gameplay damage、cooldown、targeting、reward、save契約は変更しない

### App icon

- Producer承認A2からversioned favicon、Apple touch、192／512／1024、maskable iconを生成
- PWA `id`、`start_url`、`scope`は`./`を維持
- 旧icon filesは物理保持し、新generationだけがA2 pathを参照

## 4. Asset・PWA状態

- manifest：410 logical assets
- logical bytes：86,794,856
- distinct bytes：86,254,953
- lossless WebP transport derivative：73
- audio bundle：249 slices、17,604,607 bytes
- Version 0.9.9.0追加：36 audio assets＋A2 icon 7 logical paths
- Version 0.9.8.2からの差分：43 logical downloads、41 distinct objects、7,199,431 bytes
- unchanged hash reuse：367 assets
- save schema：v14、変更なし

PWAは全件のsize／SHA-256検証、Cache Storage保存、manifest commit ACK完了後だけゲーム開始します。active／previous generation、差分update、rollback、offline、commit-only recovery、saveとasset cacheの分離を維持します。

## 5. QA状態

工程PRごとにfocused/full tests、Lint、production build、content validation、browser QA、PWA/update/rollback/offline/save QA、独立read-only reviewを実施し、integration merge前のPR起因FindingはHigh／Medium／Low 0です。

release-prepでは次を最終固定します。

- Version 0.9.9.0 identityとrelease SHA注入契約
- generated manifest／audio bundle／lossless WebP drift 0
- Chromium／WebKit、1280×720、844×390、844×340
- Pages base path `/Zombieee/`
- fresh install、0.9.8.2差分update、active／previous、rollback、offline、reload recovery
- fresh／existing save、migration、破損復旧、export／import
- Audio／VFX／icon combined regression
- console／page／request／HTTP failure 0

Playwright WebKitは物理iPhone確認ではありません。speaker、earphone、home-screen icon更新、lock復帰、発熱はGate BでProducerが物理iPhoneを確認します。

## 6. Release境界

公開順は次のとおりです。

1. release-prep PRをintegrationへ通常merge
2. final `integration/0.9.9.0 → main` PRを作成
3. 別チャットのSol Auditorが固定integration HEADをread-only reviewし、High／Medium／Low 0を確認
4. 同一固定HEADのGate B candidateを発行
5. Producerが物理iPhoneを確認し、「公開してよい」と明示
6. final main PRを通常mergeし、merge resultをrelease SHAに固定
7. annotated `v0.9.9.0` tag、GitHub Release
8. `main`からGitHub Pages Releaseをmanual dispatch
9. public metadata、匿名アクセス、fresh／existing save、PWA update、主要assetを確認
10. 公開後docs-only同期PR、Issue #24状態記録、Issue #136 close

`.github/pages-release-request.json`は変更しません。Gate B承認前のintegration→main merge、tag、Release、Pages正式公開は禁止です。

## 7. 恒久基準

- repository：`SUSANO-OOO/Zombieee`
- default branch：`main`
- save key：`nishijin-campaign-v1`
- stable ID、localStorage／IndexedDB、migration snapshot、last-known-good、recovery、export／importを維持
- smartphone横画面を第一基準、PC横画面も正式対応
- 本編Stage 1〜20、Survival、16 playable units、Level 1〜50基盤を維持
- `main`直接push、force push、rebase、amend、既存tag移動、save初期化、cache全削除、ライセンス不明asset採用は禁止

長期方向は[PRODUCT_ROADMAP](PRODUCT_ROADMAP.md)、公開・復元は[RELEASE_BACKUP_RECOVERY](RELEASE_BACKUP_RECOVERY.md)を参照してください。
