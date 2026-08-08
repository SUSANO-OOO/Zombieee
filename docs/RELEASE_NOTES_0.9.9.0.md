# 西新世紀末物語 — Version 0.9.9.0 Release Notes

更新日：2026-08-08

Version 0.9.9.0は、戦闘中の操作、音響、boss／support演出、CRAWLER表現、mobile HUD、app iconを一つの体験として改善した品質更新です。実行正本は[Issue #136](https://github.com/SUSANO-OOO/Zombieee/issues/136)です。

**2026-08-08に正式公開完了しました。**

- 正式URL：<https://susano-ooo.github.io/Zombieee/>
- release SHA：`19a79404822ebc8f0cbd8a3b809b8ed0adbc28af`
- release tree：`305af62474c8a1ea118251023ec4ad58bee17975`
- annotated tag：`v0.9.9.0`
- final main PR：#142
- final remediation PR：#145
- final independent audit：**APPROVE — High 0／Medium 0／Low 0**
- Issue #136：`completed`

## プレイヤーが気づく変更

### 操作の反応が明確になりました

- 選択、決定、戻る、購入、強化、報酬、出撃、拒否に役割別の短いSEを追加しました。
- 雇用・強化はsaveへ確実に保存されたあとだけ成功表示と成功音を出します。
- caps不足、Level上限、未解放、編成上限、asset未準備等の禁止操作は、状態を変えずに拒否理由を返します。
- 同じ入力でgeneric cueとsemantic cueが二重に鳴らないよう、one input／one semantic cueへ整理しました。

### 戦況でBGMが変化します

- normal／pressure／bossを別のproduction BGMとして整理しました。
- Stage 3のTAKUYA incomingからboss生存中までboss BGMを維持し、無音sceneや旧track overrideへ落ちないよう修正しました。
- boss終了後は、その時点のpressure／normal状態からBGMを再解決します。
- persistent dialogue duckとtransient cue duckを分離し、entrance cue等がBGM stateを破壊しないようにしました。
- pause、画面非表示、tab／lock復帰、mute、BGM／SE volumeの既存挙動を維持します。

### 全16人のability audioを明示化しました

- 有効なability activation 1回につき、固有root cueを1件だけ発火します。
- readyは非ready→readyの遷移だけで鳴り、初回表示、reload、再描画では鳴りません。
- rootとtimeline subcueを分離し、通常weapon／hitへの暗黙fallbackを廃止しました。
- owner死亡、retreat、cancel、result、画面離脱後に遅延cueが漏れないようgeneration／receiptで管理します。

### boss・爆発・支援演出を改善しました

- boss entranceを短い警報、視線誘導、名前表示、固有cueで構成しました。
- boss defeatは停止、小爆発、中／大型爆発、火花、煙、破片、衝撃波、残留煙、決着cueの段階演出になりました。
- explosive drumは影、上方投下、回転、dust／spark、bounceを経てactiveになります。
- CRAWLER deploymentはunit alpha 1を維持し、車体base／interior／foreground maskによる物理occlusionへ変更しました。矩形clipや意図しない透過を使用しません。
- CRAWLERのbarrage／airstrikeは、車体へ接続されたproject-original pre-rendered RGBA装備へ変更しました。各7 semantic frameは微小移動ではなく構造的に異なる状態です。
- barrageはstowed／hatch-open／turret-rise／aim／firing／recoil／retract、airstrikeはstowed／mast-deploy／antenna-extend／targeting／inbound-signal／impact-confirmation／retractを持ちます。
- damage、cooldown、targeting、reward等のgameplay数値は変更していません。

### mobile HUDを再整理しました

- 844×390／844×340で、top／bottom safe zoneの所有を明確化しました。
- battle bannerを固定Canvas大型表示からDOMのserialized message領域へ移し、dialogue／boss／phase情報との衝突を解消しました。
- 操作文言14px以上、副情報12px以上を基準にしつつ、UI全体を無条件に巨大化せず、戦場を隠さない情報優先度へ整理しました。
- boss情報、CRAWLER警告、dialogue、bannerの重複・切断をbrowser evidenceで検査しました。

### app iconを感染者faceへ更新しました

- Producer承認A2を唯一のmasterとして、48／180／192／512／1024とmaskable iconを生成しました。
- 感染者の異常眼と口をmaskable safe zone内に収め、48pxでも顔の主形状が残るようにしました。
- icon pathはversioned追加し、旧icon filesはrollbackのため物理保持します。
- PWA `id`、`start_url`、`scope`は変えていません。

## Transaction・save安全性

- 雇用、強化、自動saveを共通queueで直列化し、古いrender stateが新しいtransactionを上書きしないようにしました。
- rapid tap、retry、画面遷移、save遅延、先行成功＋後続失敗でも、caps、ownership、Level、receiptを一度だけ確定します。
- save失敗時は成功popup／成功SEを出さず、旧saveを保持してlockを解放します。
- save-pending中はpause、speed、deploy、support、manual ability、battlefield pointer、result／retryをblockingし、戦闘simulationも進めません。
- save schemaはv14のままで、旧saveの通貨、雇用、Level、equipment、解放、既読、records、audio／render settingsを保持します。

## PWA・offline・update

正式公開pack：

- manifest：416 logical assets
- logical bytes：89,970,119
- distinct bytes：89,430,216
- source manifest SHA-256：`34c336e32838e11e0920cc1698ad45d4a26a8baabe9b0953794b0cb64426901a`
- audio bundle：250 slices、18,881,516 bytes
- evidence index：286 files、combined SHA-256 `35606446df29d866a511911499f942adacea58ed3ddf15b0c668828a3ad66c8b`

全assetのsize、SHA-256、Cache Storage保存、manifest commit ACKが完了するまでゲームを開始しません。未commit candidateをready扱いせず、commit-only recovery、active／previous generation、rollback、offline、saveとasset cacheの分離を維持します。

## Asset・権利

- 新規audio、icon、CRAWLER equipment rasterはproject-originalまたは正式に記録されたsource／provenanceを使用します。
- CRAWLER barrage／airstrikeの各7状態masterはproject-originalで制作し、runtime RGBA sheetへ変換しています。
- production assetのgenerator、hash、manifest membershipを検証します。
- 外部・出所不明素材は正式採用していません。

## 最終QA

- final independent audit：High 0／Medium 0／Low 0
- focused tests：398/398（final main audit時）
- full tests：985/985
- focused CRAWLER tests：8/8
- ESLint、production build、content validation、generator／drift、evidence index、`git diff --check`：pass
- PWA Chromium：34/34
- PWA WebKit：33/33
- save browser／migration matrix：78/78
- 1280×720：pass
- 844×390：pass
- 844×340：pass
- public title→map→loadout→assets ready→battle：pass
- fresh／schema v13／schema v14 save：pass
- IndexedDB delay／blocked、image.decode hang、低速network、optional asset hang fixture：pass
- console error、page error、HTTP error、request failure、horizontal overflow：0

## 残存する物理端末QA

Playwright WebKitは物理iPhoneではありません。次は未確認です。

- 物理iPhone本体speakerでの最終聴感
- 物理iPhoneでの発熱

これらはGitHub Releaseへ残存QAとして明記済みです。後から物理端末固有の異常が見つかった場合、公開済み0.9.9.0のtag／Release／履歴を改変せず、新しいfollow-up Issueで扱います。

Issue #24 `[Backlog][Audio] 正式BGM・SE制作と物理端末聴感QA` はopenのまま維持します。

## 非対象

- 新Stage、新unit、新通貨、新gameplay system
- story全文TTS、別人物voice流用、常設kill streak
- AudioMixer／PWA／Service Worker全面再設計
- save初期化、cache全削除
- App Store／Google Play／Capacitor

## 公開記録

PR #142はfinal independent audit High 0／Medium 0／Low 0確認後に通常mergeされ、merge result `19a79404822ebc8f0cbd8a3b809b8ed0adbc28af`をrelease SHAへ固定しました。annotated `v0.9.9.0`、GitHub Release、明示的Pages release request、Public QAを順に実行し、Issue #136は公開後QA成功後に`completed`としてcloseしました。

`main`直接push、force push、共有履歴rebase／amend、既存tag移動は行っていません。
