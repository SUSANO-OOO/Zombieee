# 西新世紀末物語 — Version 0.9.5.1 Hotfix Release Notes

更新日：2026-07-31

Version 0.9.5.1は、正式公開版でタイトル画面または編成画面が無期限待機する問題だけを修正する緊急Hotfixです。実行正本はIssue #111です。

## 修正

- 正式GitHub Pagesを`preview／origin不明`と表示せず、client mount、reload、BFCache復帰時に正式originを再判定します。
- IndexedDBのopen、request、transactionを時間制限し、`savePersistence=checking`を無期限継続させません。
- 片方のsave replicaだけを読める場合、読めないreplicaを上書きせず、利用可能なsaveで縮退起動します。
- 保存先のtimeout／blocked／unavailable理由と再確認操作をplayer-facing表示します。
- 画像load／decodeを時間制限し、decode停止時は`onload + naturalWidth`を安全なfallbackとして使用します。
- 戦闘必須assetとoptional assetを分離し、optional assetの遅延だけで出撃を停止しません。
- Public QAを正式origin、save hydration完了、開始button enabled、map、loadout、asset ready、出撃button enabled、battle到達まで拡張します。

## Save互換

save schemaはv14のままです。Version 0.9.0由来v13 saveとVersion 0.9.5由来v14 saveを自動初期化せず、owned、Stage、星、caps、Level、equipment、編成、記録、Survival、設定、backup／recoveryを保持します。

## 非対象

PWA、Service Worker、offline／install、新Stage、新unit、新boss、engine全面書き直しは含みません。既存`v0.9.5` tag／Releaseは変更しません。
