# Version 1.0.3 — インストール済みiPhoneの録画音声

2026-10-10の実機報告と継続修正指示に基づく。公開1.0.2
`cd246a3d8e93b69d8cb6b370d40f28924a0d86b6`から開始する。
実行台帳は未解消の[Issue #177](https://github.com/SUSANO-OOO/Zombieee/issues/177)を継続する。

## 対象と実装境界

iPhone 14 Pro Max／iOS 26.7.1のホーム画面へダウンロードしたPWAで、
ゲームは聞こえるが保存した画面録画が無音になる。Ver 1.0.2表示と録画時に通話していないことは確認済み。
Safariへの切替を解決策や受入条件にしない。

iOSの最終出力を`MediaStreamAudioDestinationNode → HTMLAudioElement.srcObject`へ渡す限定候補を検証する。
Web Audioによる音量・duck・limiter・SE・voiceを維持し、同一contextの出力先を一つにする。
通常のmixerとendingは別contextのままとし、endingの共有context／所有者を保つ。
他環境・API非対応時は既存の直接出力を維持。再生拒否、timeout、非表示、回転、終了、遅延したplay完了で
二重再生や終了後の再生を起こさない。マイク権限・録音権限・外部送信は追加しない。

R5脚本、人物、画像・音源、戦闘動作、Gore、save、報酬、stable ID、能力発動時の文字なしを維持する。
確認用のピッ音を追加しない。ユーザーPCでゲーム・ブラウザ・音声を起動しない。

## 検証と公開

無音mockで単一出力、拒否、timeout、遅延完了、共有owner、非表示・復帰・disposeを検査する。
遠隔native WebKitとChromiumで実MediaStreamの再生・信号・保存した音声データ、通常のBGM／SE／voice、
title／credits／ending、PWA更新・offlineを検査する。既存の全test、Lint、build、content、CI、独立read-only reviewを維持する。
通常PR・固定tag・Release・明示requestによるPages公開と公開後確認まで自律実行する。

MediaStream案は出力処理を変える仮説であり、実機の保存録画が直る保証はない。
[Apple Forums 818594 / FB22245447](https://developer.apple.com/forums/thread/818594)の短いRemoteIO bufferの報告も
今回の原因を確定するものではない。ブラウザ内部の録音成功をiOSの画面収録成功に代用しない。
実機の保存動画にBGM／SEが入る確認までは録画不具合を未解消として台帳をopenに保つ。
