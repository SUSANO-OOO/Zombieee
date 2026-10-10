# 1.0.3 音声出力 checkpoint

## 元の失敗

公開1.0.2 `cd246a3d8e93b69d8cb6b370d40f28924a0d86b6`で、iPhone 14 Pro Max／iOS 26.7.1の
インストール済みPWAは聞こえるが、保存録画だけ無音。版表示と通話なしをProducerが確認。
AudioSessionの再生カテゴリ・復帰だけでは解消しなかった。Issue #177はopen。

## 限定変更

共通`audioOutput.js`でiOSの最終出力をMediaStream→native audioへ渡す。
1 contextに1出力、通常mixerとendingのcontextは別、endingのowner共有・100ms引継ぎを維持。
native volumeは1、既存Web Audio gain／duck／limiter／音源・SE・voiceを維持する。
非表示・portrait・pagehide・disposeで出力を停止し、遅延playを無効化する。
API非対応は既存の直接出力。再生拒否・timeoutはgesture復帰へ通知し、並列の直接出力を作らない。

独立reviewでpageshow listener順による復帰失敗を再現。mixerがoutputのpageAwayを解除してから復帰するよう修正し、
AudioSession非対応fixtureのpagehide→pageshow回帰を追加した。最終独立reviewと遠隔検査は別途記録する。

32e87eeの独立reviewでは同じtask内のending owner交代がキャンセル済み出力promiseを再利用するMediumを再現。
pause時にpendingを同期で切り離し、旧attemptのgeneration／identity guardを保った。即時owner交代の回帰を追加。
titleの同期pageshowにも同じguard順のMediumがあり、ending mix作成時に先行するforeground listenerを登録。
closed context置換時の旧native要素・track回収漏れLowも修正し、両方の実module回帰を追加した。

## ローカル検証

最終修正78d4098でbuild＋全1943/1943 tests、音声50/50、CI契約6/6、source Lint 0 errors／既存25 warnings、
content validator、manifest、diff check成功。
初回全testの既存strict shell検査はsandboxのGit Bash `NtCreateDirectoryObject / 0xC0000022`で失敗。
sourceを変えずsandbox外で同じ全testを実行して成功した。
最初のlintは保全した未追跡`output/`の旧browser vendor bundleまで走査して75 errorsとなった。
製品sourceと検査sourceを対象に、同ディレクトリだけを除外して再実行した。CIのclean checkoutには存在しない。

R5原稿SHA-256 `c324ba3783074ecabe80716d971c35d73028a7f98f2a8069760153b1c8b17cd6`。
全681配布素材177,926,708 bytesは1.0.2と同じhash。manifestは版番号だけ変更。
公開1.0.2→1.0.3で既存mediaの追加取得・削除0を検査。
脚本、save、報酬、人物、戦闘動作、Goreの製品変更なし。

ユーザーPCではゲーム・browser・音声を起動していない。全testの既存HTTP検査は一時loopback serverを作成・終了する。
遠隔browser内のMediaRecorder保存とdecode信号検査は、iOS Control Centerの保存録画成功とは異なる。
物理iPhoneの録画改善は未確認のままで、修正完了とは報告しない。

## 遠隔検査の最初の失敗

PR #179／CI 38028547424のChromium job 114144464392は、新規検査が既存request監査に存在しない
`stop()`を呼び出す後片付けのTypeErrorで失敗した。artifact 11660967358
（zip SHA-256 `e6002c73965b226d6536dd8112896168812d23fa444efec88a96ca7441ac314d`）とjob logを保全。
`settle()`も同じAPI取り違えだったため、既存の`closeContext()`とrequest reportで判定する。
元の失敗を後片付けエラーで隠さず、失敗時の画面・出力状態も残すよう検査だけを修正した。
この失敗を音声出力の成功や製品不具合の確定根拠にしない。
