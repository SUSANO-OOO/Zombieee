# 西新世紀末物語 — GitHub Pages公開・復元手順

更新日：2026-07-17

## 1. 正式公開経路

唯一の正式公開先はGitHub Pages。

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- source：`main`へPR経由で反映されたrelease SHA
- deployment：`.github/workflows/github-pages-release.yml`
- ChatGPT Sitesは旧公開先であり、新規deployment、QA、復元に使用しない

## 2. 公開前preflight

P0で次を確認する。

- GitHub Pages APIへアクセス可能
- workflow build typeを作成・更新できる
- Actionsに`pages: write`と`id-token: write`がある
- `main` pushでbuild、browser smoke、artifact upload、deployが実行される
- private repositoryのplan・Pages設定で一般プレイヤー向け匿名公開が可能か
- 匿名公開を妨げるaccess controlがないか

一般公開が不可能と判明した場合、実装は破棄しない。release工程だけ停止し、Issue #37へ原因、確認結果、安全な選択肢を報告する。

Codexはrepository visibilityを変更しない。

## 3. 公開前ゲート

実行ランブックとIssue #37のP0〜P7、R1〜R4を完了する。

最低条件：

- 全画像個別承認、identity lock、統合品質確認済み
- Stage 1〜6実プレイ可能
- save migrationと破損復旧成功
- 手動戦術残存0
- 敵素通り0
- スマートフォン受入完了
- build、test、Lint、diff check、CI成功
- console error、asset 404、参照切れ0
- High／Medium未解消0
- 匿名公開見込み確認済み

workflowやpreview成功だけでは公開前ゲート通過としない。

## 4. mergeとrelease SHA

1. PR #38のstate、draft、base、head、CI、mergeabilityを再取得
2. expected head SHAを固定
3. PRをReady化
4. PR経由で通常merge
5. merge result SHAを取得
6. head SHAではなくmerge result SHAをrelease SHAとする
7. `main`がrelease SHAを指すことを確認

禁止：`main`直接push、force push、共有履歴rebase・amend、head SHAの誤記。

## 5. tagとGitHub Release

1. release SHAへannotated tag `v0.7.0`を作成
2. tagを通常push
3. `v0.7.0^{commit}`がrelease SHAと一致することを確認
4. GitHub Releaseを作成
5. Release notesへ変更内容、save migration、公開URL、既知事項を記載

既存tagを移動・上書きしない。

## 6. GitHub Pages deployment

`main` pushで`GitHub Pages Release` workflowを起動する。

確認：

- production build成功
- static Pages build成功
- browser smoke成功
- Pages artifact upload成功
- deploy成功
- environment URLが正式URLと一致
- 公開HTMLのreleaseメタ情報がrelease SHAと一致

失敗時はIssueを閉じず、feature branchまたは新しい修正PRで解消する。

## 7. 一般プレイヤー向け公開確認

認証済み開発者ブラウザだけで判定しない。

正式URLを次の条件で確認する。

- GitHub未ログインの新規ブラウザ相当
- Cookie、localStorage、IndexedDB、service worker、cacheなし
- 認証ヘッダーなし
- 直接URL入力

最低確認：

- HTTP成功
- 認証要求、404、access deniedなし
- タイトルとVersion 0.7.0表示
- 主要JS、CSS、画像、音声取得成功
- fresh saveで物語開始
- マップ、編成、Stage 1開始
- console error 0

アクセス制限で一般プレイヤーが開けない場合、deployment successでも正式公開失敗とする。visibilityは変更せず、Issue #37をopenのまま報告する。

## 8. 公開後QA

- fresh save
- v2〜v4 save migration
- プロローグ
- マップ、編成、調達
- Stage 1〜6
- TAKUYA撃破後の残存敵
- ユニット役割
- コスト経済
- BGM・SE
- 再読込
- 844×390
- 844×340
- WebKit iPhone相当profile
- asset 404 0
- console error 0

物理iPhoneまたは実機クラウドが利用可能なら確認する。

利用不能な場合は、844×390、844×340、WebKit iPhone相当profile、touch、safe area、回転、画面ロック・復帰、タブ復帰の全成功を正式代替ゲートとする。物理実機未確認と代替証拠を最終記録へ明記したうえでIssue close・branch削除まで進めてよい。

物理実機で重大不具合を確認した場合はIssueを閉じず、通常のrevert PRで復旧する。

## 9. ロールバック

重大不具合時：

1. Issue #37を閉じない、または再open
2. 直前の正常release SHAを特定
3. 不具合mergeを通常のrevert PRで戻す
4. revert PRを通常merge
5. GitHub Pages workflowを確認
6. 正式URLと匿名アクセスを再確認
7. 原因修正は別の通常PRで行う

禁止：`main`のforce巻戻し、tag移動、Release履歴改変、ChatGPT Sitesへの一時退避。

## 10. バックアップ

必要に応じてrepository bundleを作成する。

- release SHAを含む
- SHA-256を記録
- `git bundle verify`
- `git bundle list-heads`
- 新規cloneまたは隔離directoryで復元確認

バックアップの存在だけで復元可能と断定しない。

## 11. 最終記録

- release SHA、merge commit、annotated tag
- GitHub Release URL
- workflow run、正式URL、公開HTML release SHA
- 匿名アクセス結果
- 公開後QA
- 物理iPhone・実機クラウド結果、またはWebKit代替証拠
- rollback要否
- Issue #37・PR #38状態
- branch cleanup
- ChatGPT Sites未更新
