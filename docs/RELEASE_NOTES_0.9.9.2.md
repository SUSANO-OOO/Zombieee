# 西新世紀末物語 — Version 0.9.9.2 Release Notes

Version 0.9.9.2は、既存ホーム画面PWAを削除・再インストールせず、保存済みsaveと検証済みassetを保持したまま更新できるようにするpatch releaseです。

## プレイヤーが気づく変更

- 大きなaudio bundleの転送を、個々のslice timeoutから分離しました。
- 転送中に進捗がある限り、30秒を超えてもbundleを途中で中断しません。
- 同一bundleを共有するsliceが、同じbundleをsliceごとに再取得しないようにしました。
- pause、resume、cancel、failure retry、再起動後の未取得分再開を維持します。
- 既存のsave schema、Service Workerのgeneration／rollback契約、Cache Storageの検証契約を変更しません。

## 検証

- owner timeoutのdeterministic reproductionを修正前に確認し、修正後に再実行しました。
- 進捗中のslow bundle、bundle単位retry、Cache Storage write failure、session cancelを検証しました。
- Version 0.9.9.0／0.9.9.1、既存save、PWA update、offline、rollbackの回帰を対象にします。
- 自動WebKitは物理iPhone確認ではありません。物理iPhoneでの既存ホーム画面PWA更新は別途Producer受入境界です。

## 非対象

- Version 0.9.9.0／0.9.9.1のtag、GitHub Release、正式Pages成果物の変更
- gameplay、battle、CSS、audio素材、AudioMixer、save schemaの変更
- アプリ削除、再インストール、save初期化、Cache全削除を成功条件にすること
