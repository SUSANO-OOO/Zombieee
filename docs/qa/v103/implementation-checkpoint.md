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

再検査38028841146／Chromium job 114145402346では元の`Expected one active output, got 2`を保全できた。
製品sourceを照合すると、親のevent/UI mixerはbattle中も常駐し、子battle mixerが別contextを所有する。
従ってglobal要素数1の検査は「1 contextに1出力」の契約と一致していなかった。
各mixerのdiagnosticsにnative stream IDを加え、二つのownerそれぞれに1出力だけが対応し、
event場面音が0、battle BGMが1、重複loopが0であることを実streamと照合する。
録音信号の基準は維持し、context数を音源の二重再生と混同しない。
外側browser closeの失敗でも元のfailureとsummaryを残すよう保護。音声関連52/52、対象Lint・構文・diff成功。

## 実信号と復旧検査

3d5565bの遠隔Chromium job 114147515724は音声・全戦闘form・通常接触まで成功。
artifact 11661936604（zip SHA-256 `050446c67a233555653b344bea4bf5eaec0e6ca2f4f59409610333f5fa3cefbb`）の
3画面サイズ×通常／復帰の6 m4aすべてを回収。各40,388 bytes／2.380秒／stereo、RMS 0.0293–0.0360、peak 0.1699–0.3303。
各ownerのstream IDは復帰前後で同一、event場面音0・battle BGM1・重複loop0。

native WebKit job 114147515726は1280×720の通常／復帰と844×390の通常、計3録音に非ゼロ信号を確認。
844×390復帰直後のowner状態検査で失敗し、artifact 11661951864
（zip SHA-256 `2a4818acac6bd548594db0687f1bd30b4568e4ccba74c1d591e0b2f0ef791588`）を保全。
検査のdecodeが別のhardware AudioContextを開いていたためOfflineAudioContextへ変更。
復帰の待機は両ownerのcontext running・native再生・BGM1・重複0を20秒上限で確認する。
製品の復帰成功はこの再検査が通るまで未確認とする。

同runのPR Verifyはpartial PWA 21/23。全681素材hashが同じためrelease deltaは0だが、
fixtureが媒体差分ありと非bundle媒体差分取得を必須としていた。
実際の欠損cache修復は完了し、commit／save保存／offline／rollback条件は成功している。
差分0を許しながら、欠損に由来する実修復取得の存在・一意性、未知path0、保持hash再取得0、
3失敗＋1保留のbundle試行、進捗境界等の既存条件を維持するよう検査を修正した。
planner・manifest・復旧・版identityの無音37/37、対象Lint・構文・diff成功。

既存native PWA検査はdefault UAで直接出力を使うため、WebKit persistent partial fixtureをiPhone UAに設定。
同じinstalled profileをorigin socket切断後にSWから再起動した箇所で、event ownerのnative streamを
実MediaRecorderで保存・OfflineAudioContextでdecodeし、1 ownerに1出力と非ゼロ信号を追加確認する。
既存remote speaker muteと全復旧・save条件を維持。これも物理iPhoneのOS画面録画とは区別する。

7b900beの追加検査に対する独立reviewで、offline録音の保存先を作成する前にwriteするMediumを確認。
保存直前にmkdirし、既存録音への上書きを拒否するよう修正した。該当差分の独立再確認はH0／M0／L0。
2本の検査sourceの構文、request監査mock 12/12、対象Lint、diff check成功。PCのbrowser・音声未起動。
