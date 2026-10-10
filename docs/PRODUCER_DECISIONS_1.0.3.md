# Version 1.0.3 — インストール済みiPhoneの録画音声

## 公開後の継続改善について（2026-10-10追加指示）

以下の本文は公開1.0.3当時の実装・公開契約を保全したもの。
公開後にProducerから追加された現在の目標は[Issue #177](https://github.com/SUSANO-OOO/Zombieee/issues/177)冒頭を実行台帳とする。
全味方・敵・ボス・派生形態の身体／手足と全アニメーション、戦闘の速度・攻撃力・波密度、
日本語表示、受領済みR9全文・新規カットシーン・場面別BGM／SE／環境音、没案TAKUYAの排除、
高揚感のあるスタート画面の曲、未解消のiPhone保存録画音声を含む。
変異会長／TAKUYA-Ωの白い背景残り、武蔵の背後の余分な刃と隣接ポーズの混入も修正する。
個別に指摘されたユニットだけで全体完了とはしない。旧本文のR5・素材・戦闘動作維持は、
この追加指示の対象箇所には適用しない。identity、save、進行、報酬、設定、Gore、戦闘voiceの保全は継続する。
後続版の番号と最終統合／正式公開はこの追記では固定・承認しない。

## 公開1.0.3当時の契約

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
