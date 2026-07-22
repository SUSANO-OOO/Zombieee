# 西新世紀末物語 — GitHub Pages公開・復元手順

更新日：2026-07-22

## 1. 正式公開経路

唯一の正式公開先はGitHub Pages。

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- source：承認済みPRのmerge result SHA
- deployment：`.github/workflows/github-pages-release.yml`
- public QA：`.github/workflows/github-pages-public-qa.yml`
- ChatGPT Sitesは旧公開先であり、新規deployment、QA、復元に使用しない

正式deploymentは、明示的release requestまたは安全なmanual dispatchだけで実行する。通常の`main` pushやdocs-only mergeで製品版を自動deploymentしない。

## 2. release request

release requestは最低限次を持つ。

- `version`
- `release_ref`
- `release_sha`
- `issue_number`
- `request_id`

条件：

- `release_ref`が解決するcommitと`release_sha`が一致
- `version`がtag／GitHub Releaseと一致
- `issue_number`が対象releaseの実行台帳を指す
- `request_id`が一意
- public QAは同じrequestからversion、SHA、Issueを取得
- workflow内へ特定version、特定Issue、固定SHAを直書きしない

既存tagを移動・上書きしない。

## 3. 公開前preflight

対象releaseごとに確認する。

- GitHub Pages APIへアクセス可能
- Pages build typeがworkflow
- Actionsに`contents: read`、`pages: write`、`id-token: write`がある
- release requestまたはmanual dispatchからbuild、browser smoke、artifact upload、deployを実行可能
- PR段階のbuild、browser smoke、release contract testが成功
- repository visibilityとPages設定で匿名アクセス可能
- access control、認証要求、404がない
- 正式URLの現在release metadataを取得可能

一般公開不能、権限不足、secrets・課金・外部契約が必要な場合は、release工程を停止し、対象Issueへ原因、確認結果、安全な選択肢を報告する。repository visibilityを無断変更しない。

## 4. 公開前ゲート

対象バージョンのProducer Decisions、Execution Lock、Implementation Directive、Issueを完了する。

最低条件：

- 対象機能を実ゲームで確認
- fresh save、既存save、migration、破損復旧成功
- 1280×720、844×390、844×340、WebKit受入
- BGM、SE、戦闘ボイス、復帰後二重再生なし
- console error、page error、request failure、主要asset 404が0
- build、全test、Lint、`git diff --check`、CI成功
- 独立read-onlyレビューHigh／Medium未解消0
- 対象画像の確認ゲート完了

workflowやpreview成功だけでは公開前ゲート通過としない。

## 5. mergeとrelease SHA

1. PRのstate、draft、base、head、CI、mergeabilityを再取得
2. expected head SHAを固定
3. 必要ならReady化
4. PR経由で通常merge
5. merge result SHAを取得
6. head SHAではなくmerge result SHAをrelease SHAとする
7. `main`がrelease SHAを含むことを確認

禁止：`main`直接push、force push、共有履歴rebase・amend、head SHAの誤記。

## 6. tagとGitHub Release

1. release SHAへ対象versionのannotated tagを作成
2. tagを通常push
3. `tag^{commit}`がrelease SHAと一致することを確認
4. GitHub Releaseを作成
5. Release notesへ変更内容、save migration、公開URL、既知事項を記載

既存tagを移動・上書きしない。誤ったtagを公開済み履歴上で移動して隠蔽しない。

## 7. GitHub Pages deployment

1. release requestを作成または安全なmanual dispatchを実行
2. requestのversion、ref、SHA、Issue、request IDを確認
3. workflowが指定release SHAをdetached checkout
4. production build
5. static Pages build
6. 公開HTMLへversion／release SHA metadataを埋め込む
7. browser smoke
8. Pages artifact upload
9. deploy

確認：

- build成功
- browser smoke成功
- artifact upload成功
- deploy成功
- environment URLが正式URLと一致
- 公開HTMLのversion／release SHAがrequestと一致

失敗時は対象Issueを閉じず、feature branchまたは新しい修正PRで解消する。

## 8. 一般プレイヤー向け公開確認

認証済み開発者ブラウザだけで判定しない。

正式URLを次の条件で確認する。

- GitHub未ログインの新規ブラウザ相当
- Cookie、localStorage、IndexedDB、service worker、cacheなし
- 認証ヘッダーなし
- 直接URL入力

最低確認：

- HTTP成功
- 認証要求、404、access deniedなし
- タイトルと対象version表示
- 公開HTMLのrelease SHA一致
- 主要JS、CSS、画像、音声取得成功
- fresh saveで開始
- マップ、編成、Stage 1開始
- 対象release固有の必須導線
- console error、page error、request failure、主要asset 404が0

アクセス制限で一般プレイヤーが開けない場合、deployment successでも正式公開失敗とする。

## 9. 公開後QA

対象Issueとrelease contractに従い、少なくとも次を確認する。

- fresh save
- 公開版由来の既存save
- migration
- タイトル、マップ、編成、調達・強化
- 対象Stageと進行解放
- 勝利、敗北、再挑戦、撤退、再読込
- BGM、SE、戦闘ボイス
- 1280×720、844×390、844×340、WebKit
- touch、safe area、回転、画面ロック・復帰、タブ復帰
- asset 404、console error、page error、request failureが0

物理iPhoneまたは実機クラウドを利用可能なら確認する。利用不能な場合は、WebKit、frame time、memory等を代替証拠とし、物理実機・発熱未確認を明記する。

## 10. immutable release再deployment

公開版が意図せず別SHAへ変わった場合、正常な既存tag／release SHAを明示的release requestまたはmanual dispatchで再deploymentできる。

- ゲームコードを改変しない
- 既存tagを移動しない
- GitHub Release履歴を改変しない
- 再deployment後に公開HTML metadataと匿名アクセスを確認
- 対象Issueへ原因と復旧証拠を記録

## 11. ロールバック

重大不具合時：

1. 対象Issueを閉じない、または再open
2. 直前の正常release SHAを特定
3. 不具合mergeを通常のrevert PRで戻す
4. revert PRを通常merge
5. rollback用release requestを作成
6. Pages workflowを実行
7. 正式URLのversion／release SHAと匿名アクセスを確認
8. 原因修正は別の通常PRで行う

禁止：`main`のforce巻戻し、tag移動、Release履歴改変、ChatGPT Sitesへの一時退避。

## 12. バックアップ

必要に応じてrepository bundleを作成する。

- release SHAを含む
- SHA-256を記録
- `git bundle verify`
- `git bundle list-heads`
- 新規cloneまたは隔離directoryで復元確認

バックアップの存在だけで復元可能と断定しない。

## 13. 最終記録

対象Issueへ一件に集約して記録する。

- version
- merge result／release SHA
- annotated tag
- GitHub Release URL
- release request内容
- workflow run
- 正式URLと公開HTML metadata
- 匿名アクセス結果
- 公開後QA
- physical device結果または代替証拠
- rollback要否
- PR・Issue最終状態
- branch cleanup
- ChatGPT Sites未更新