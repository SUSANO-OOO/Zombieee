# 西新世紀末物語 — Version 0.9.9.5 Release Notes

Version 0.9.9.5は、Version 0.9.9.4のgameplay、save、audio、PWA契約を維持したまま、player-facing visual integrityを修復するreleaseです。

- 後発5unitのportrait/cardを承認済みidentityから再派生し、白いmatte edgeと埋め込みpanelを除去
- Monkeyを承認済みVersion 0.7.0 identityとcrossbow presentationへ復帰
- production enemy/boss atlasのsource-facingを明示し、移動・target方向と見た目を一致
- stage objective、later enemy、supportを含むrequired battle visualを全件decode後だけbattle開始
- productionのmissing-asset placeholderを禁止し、診断fallbackをlocalhost QAへ限定
- 16 unit、18 event portrait、20 stage、全enemy方向/stateのfinite inventoryを自動検証

新しい人物identity、gameplay数値、save schema、AudioMixer、Service Worker protocolは変更していません。
