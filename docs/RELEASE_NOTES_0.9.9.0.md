# 西新世紀末物語 — Version 0.9.9.0 Release Notes

更新日：2026-08-04

Version 0.9.9.0は、戦闘中の操作、音響、boss／support演出、app iconを一つの体験として改善する品質更新です。実行正本は[Issue #136](https://github.com/SUSANO-OOO/Zombieee/issues/136)です。

この文書の時点ではrelease candidateです。正式URLは引き続きVersion 0.9.8.2を配信しており、Producer Gate B承認前に0.9.9.0を正式公開しません。

正式URL：<https://susano-ooo.github.io/Zombieee/>

## プレイヤーが気づく変更

### 操作の反応が明確になりました

- 選択、決定、戻る、購入、強化、報酬、出撃、拒否に役割別の短いSEを追加しました。
- 雇用・強化はsaveへ確実に保存されたあとだけ成功表示と成功音を出します。
- caps不足、Level上限、未解放、編成上限、asset未準備等の禁止操作は、状態を変えずに拒否理由を返します。
- 同じ入力でgeneric cueとsemantic cueが二重に鳴らないよう、one input／one semantic cueへ整理しました。

### 戦況でBGMが変化します

- 通常戦闘に加え、敵の圧力が高い状態のpressure BGM、boss BGMを追加しました。
- surface／stationのstage familyごとにpressure sceneを分けています。
- boss終了後は古い曲へ固定復帰せず、その時点のpressure状態から曲を再解決します。
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
- CRAWLERの屋根装備、砲塔、通信機器、barrage、airstrikeを車両と一体に見える表現へ改善しました。
- damage、cooldown、targeting、reward等のgameplay数値は変更していません。

### app iconを感染者faceへ更新します

- Producer承認A2を唯一のmasterとして、48／180／192／512／1024とmaskable iconを生成しました。
- 感染者の異常眼と口をmaskable safe zone内に収め、48pxでも顔の主形状が残るようにしました。
- icon pathは`/icons/v099/`へversioned追加し、旧icon filesはrollbackのため物理保持します。
- PWA `id`、`start_url`、`scope`は変えていません。

## Transaction・save安全性

- 雇用、強化、自動saveを共通queueで直列化し、古いrender stateが新しいtransactionを上書きしないようにしました。
- rapid tap、retry、画面遷移、save遅延、先行成功＋後続失敗でも、caps、ownership、Level、receiptを一度だけ確定します。
- save失敗時は成功popup／成功SEを出さず、旧saveを保持してlockを解放します。
- save-pending中はpause、speed、deploy、support、manual ability、battlefield pointer、result／retryをblockingし、戦闘simulationも進めません。
- save schemaはv14のままで、0.9.8.2の通貨、雇用、Level、equipment、解放、既読、records、audio／render settingsを保持します。

## PWA・offline・update

- 完全pack：410 logical assets
- logical bytes：86,794,856
- distinct bytes：86,254,953
- lossless WebP transport derivative：73
- audio bundle：249 slices、17,604,607 bytes

Version 0.9.8.2からの差分updateは、43 logical downloads／41 distinct objects／7,199,431 bytesです。367 assetsは同一hashを再利用し、再downloadしません。

全assetのsize、SHA-256、Cache Storage保存、manifest commit ACKが完了するまでゲームを開始しません。未commit candidateをready扱いせず、commit-only recovery、active／previous generation、rollback、offline、saveとasset cacheの分離を維持します。

## Asset・権利

- 追加36 audio assetsはproject-original recipe、master WAV、runtime MP3、provenance、SHA-256を記録しています。
- production MP3 encoderを固定し、clean outputでmasterを再生成・検証できます。
- A2 iconはproject-original generated rasterと承認master SHAを台帳化しています。
- B2／C2、reference、alternate format、authoring masterはruntime distribution packへ入りません。
- 外部・出所不明素材は使用していません。

## QA

工程PRでは次を確認しました。

- focused／full tests、ESLint、production build、content validation、`git diff --check`
- atomic transaction、save boundary、aria-disabled、one input／one cue
- normal／pressure／boss、16 ability、support、voice／SE混在
- boss entrance／defeat、explosion、drum、CRAWLER／barrage／airstrike
- Chromium／WebKit、1280×720、844×390、844×340
- Pages base path `/Zombieee/`
- PWA full install、差分update、active／previous、rollback、offline、reload recovery
- save migration、破損復旧、export／import
- manifest／audio bundle／lossless WebP drift
- console／page／request／HTTP failure 0
- 各工程の独立read-only review：High／Medium／Low 0

Playwright WebKitは物理iPhone確認ではありません。

## Gate Bで物理iPhone確認する項目

- 0.9.8.2からのupdateとsave保持
- UI SE、normal／pressure／boss、全16ability、voice／SE混在
- boss entrance／defeat、drum、CRAWLER支援
- home-screen icon更新挙動
- touch、lock／tab復帰
- 本体speaker、earphone
- 発熱の明確な異常有無

OSのhome-screen icon cacheにより表示更新が遅れる場合、実装不具合とOS制約を分けて記録します。削除・再追加を通常成功条件にはしません。

## 非対象

- 新Stage、新unit、新通貨、新gameplay system
- story全文TTS、別人物voice流用、常設kill streak
- AudioMixer／PWA／Service Worker全面再設計
- save初期化、cache全削除
- App Store／Google Play／Capacitor

## 公開境界

最終integration RCは別チャットのSol Auditorが固定HEADをread-only reviewします。ProducerがGate Bで「公開してよい」と明示した後だけ、final main PR通常merge、annotated `v0.9.9.0`、GitHub Release、Pages manual dispatchを実行します。release SHAはfinal main PRのmerge resultです。
