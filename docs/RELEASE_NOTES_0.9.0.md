# 西新世紀末物語 Version 0.9.0

Version 0.9.0は、本編、育成、装備、boss、Survivalを一つの反復ループへ統合する大型アップデートです。

## 主な追加・変更

- 本編をStage 20まで拡張
- 無限wave、5waveごとのboss、checkpoint、撤退・再開、1倍／2倍、boss撃破後の3択強化を備えたSurvival Mode
- 5件の異常発生任務
- 敵の右端・右端外spawn、出現完了後のcombat-ready、Survival専用防衛前線
- プレイアブル5名を追加し、合計16名へ拡張
- 全16体へ個体別cooldownを持つ固有の手動アビリティと頭上ready iconを追加
- 通常感染体6種を追加
- boss共通基盤、TAKUYA／改札喰いの改修、新boss5体を追加
- RankをLevel 1〜50基盤へ移行し、Stage 20時点でLv25まで通常解放
- caps経済を再編
- 個人equipment2枠、編成preset別の戦術equipment2枠、約20種・5段階強化の装備を追加
- 出撃、部隊、補給所、記録へ主要UIを再構成
- 詳細result、敵図鑑、boss図鑑、Survival最高記録、戦績を追加
- 戦闘表示、VFX、SE、mobile横画面UIを改善

## セーブデータ

- save schemaはVersion 0.9.0でv13へ移行します。
- Version 0.8.0以前の所有unit、進行、星、既読、編成、設定を引き継ぎます。
- 旧RankはLevelへ移行し、旧caps残高は新経済の開始資金へ一度だけ再編します。
- localStorage／IndexedDB、migration snapshot、last-known-good、export／importによる復旧経路を維持します。

## 確認上の注記

- Chromium／WebKitの1280×720、844×390、844×340を正式QA対象とします。
- 物理iPhoneでの長時間発熱、実speaker／earphone聴感、Safari BFCacheを含む長時間実機挙動は未確認です。WebKit iPhone相当、safe area、frame time、memory proxyを代替証拠とします。

正式公開先は [GitHub Pages](https://susano-ooo.github.io/Zombieee/) です。
