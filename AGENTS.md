# 西新世紀末物語 — 作業の入口と安全境界

更新日：2026-10-26

## 最初に読むもの

1. ユーザーの最新の明示指示と、作業対象のProducer Decisions
2. [PROJECT_STATE](docs/PROJECT_STATE.md)から辿る実行台帳Issue・PR
3. 本書と[公開・復旧手順](docs/RELEASE_BACKUP_RECOVERY.md)
4. 対象コード・テスト・実行結果。記録と違えば不一致として調べる

製品判断、実行状態、過去の履歴を混同しない。旧Sol／Luna資料、終了済みDesign Lock、過去候補の成功や公開許可を、新しい作業の命令・合格・公開許可へ転用しない。現行の参照先と履歴はPROJECT_STATEが案内する。

## 開始と継続

- repository／remote／branch／HEAD、未コミット・未追跡変更、他の作業、最新main、対象Issue／PR、Actions、タグ／Release、正式URLの配信metadataを照合する。
- 既存変更や記録を削除・reset・上書きしない。必要なら隔離した作業領域を使う。
- 親担当が実装と統合を所有する。許可された独立調査・read-only reviewは問いを分け、同じfileを無調整に並行編集しない。
- 通常の技術判断に固定モデル名、逐次handoff、追加承認待ちを挟まない。ユーザー指定のモデル・推論設定を尊重し、PC全体設定は勝手に変えない。
- 完了した調査・成功記録は対象コード・素材・依存・検査・条件が対応する範囲で再利用する。同じ計画書、状態不変の報告、無関係な再検証を増やさない。
- 進捗・根拠・残件は既存の対象Issue／PRへ集約する。新しい管理体系や非対象機能を便乗追加しない。

## 製品と証拠の保全

- 人物identity、承認済み衣装・武器・正史・素材条件、stable ID、音声の人物対応を維持する。未承認人物や別人物voiceで穴埋めしない。全文読み上げの禁止を戦闘voice削除へ読み替えない。
- save全体の自動初期化、既存backupの削除、migrationや同一receiptによる報酬の二重適用は禁止。限定変更の許可があっても非対象データは保全する。
- 失敗・未実行・対象外・再利用・新規成功・未確認を区別する。テスト本数や静止画だけで、動き・音・遊びの完成としない。
- 物理iPhoneの保存録画音声、実speaker聴感、発熱、物理操作、人間受入を、WebKitや録音成功で確認済みと呼ばない。
- 証拠は元コード・条件・結果へ辿れるよう保持する。期限付きartifactは必要な原本を保全し、hashと読み戻しを確認する。SHAだけを控えて復元可能としない。

## 検証とGitHub

- 変更依存で対象test、Lint、build、content／生成検査、browser回帰を選ぶ。共有処理や影響不明の変更は範囲を広げる。品質基準・期限を緩めず、検査の修正は正常例と異常例で保証する。
- 製品・検査・実行環境・通信・後始末の二次障害を切り分ける。同条件の反復だけで原因解消としない。
- mainは保護されたPR経由のみ。操作直前にbase／head／CI／mergeabilityを再取得する。直接push、force push、共有履歴のrebase／amend、既存tag移動は禁止。
- 通常のpush・文書やCIのmergeを製品配信へ接続しない。明示された公開契約だけでPagesを実行する。release SHAはmerge結果とし、tag・Release・配信・実URLのmetadataを別々に照合する。
- 正式URLは https://susano-ooo.github.io/Zombieee/ 。ChatGPT Sitesは旧公開先であり、新規配信・QA・復旧に使わない。
- 権限・保護・visibility・課金・secrets・外部契約を無断変更しない。重大な公開不具合は既知の正常releaseを確認し、通常のrevert PRで復旧する。
