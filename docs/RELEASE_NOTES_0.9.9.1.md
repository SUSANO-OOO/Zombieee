# 西新世紀末物語 — Version 0.9.9.1 Release Notes

更新日：2026-08-10

Version 0.9.9.1は、Version 0.9.9.0の実機プレイ後に確認したIssue #156のmobile presentation / interaction修正だけを含むpatch releaseです。ゲームルール、balance、save schema/value、AudioMixer、Version 0.9.9.0のtag／Releaseは変更しません。

## プレイヤーが気づく変更

- smartphone battle HUDのsafe-area、clipping、unit strip操作を修正しました。
- deploymentのopacity／occlusionを修正し、配置中のunitが不自然に透けないようにしました。
- Boss BGM `music-boss` のproduction pathとStage 3 contractを維持しました。
- event portrait／dialogueの構図をmobile viewportに合わせて修正しました。
- 公開UIから `CRAWLER` / `クローラー` の不要な表示を除去しました。
- mobile recordsの6/6表示を維持しました。

## 検証

- Sol Final Review：APPROVE（High 0／Medium 0／Low 0）
- Dynamic Mobile Playtest：WebKit 844×390、WebKit 844×340、Chromium 844×390の3ケース完了
- production sourceのsave／PWA／audio／gameplay契約を維持

Playwright WebKitは物理iPhoneではありません。物理iPhoneのspeaker／earphone聴感、発熱、長時間動作は残存QAとして扱います。今回の公開判定では、これらを確認済みとは表現しません。

## 非対象

- Version 0.9.9.0のtag、GitHub Release、release SHA、公開成果物の変更
- 新しいgameplay、balance、asset、audio、save schema、PWA runtimeの追加
- AudioMixerの再設計
