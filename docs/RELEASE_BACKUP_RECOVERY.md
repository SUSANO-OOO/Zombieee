# 西新世紀末物語 — GitHub Pages公開・復元手順

更新日：2026-07-17

## 1. 正式公開経路

唯一の正式公開先はGitHub Pages。

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- source：`main`へPR経由で反映されたrelease SHA
- deployment：`.github/workflows/github-pages-release.yml`
- ChatGPT Sitesは旧公開先であり、新規deployment、QA、復元に使用しない

## 2. 公開前preflight

実装の後半まで進めてから公開不能と判明することを防ぐため、P0で次を確認する。

- repositoryのGitHub Pages APIへアクセス可能
- workflow build typeを作成・更新できる権限がある
- Actionsに`pages: write`と`id-token: write`がある
- `main` pushでbuild、browser smoke、artifact upload、deployが実行される
- private repositoryの現在のplan・Pages設定で、一般プレイヤー向け公開が可能か確認する
- 匿名公開を妨げるaccess controlがある場合、公開前阻害として記録する

P0時点でURL実体を公開できない場合でも、Pages API、repository plan、workflow権限を確認する。一般公開が不可能と判明した場合は、実装を破棄せずrelease工程だけ停止し、Issue #37へ理由を報告する。

## 3. 公開前ゲート

`docs/IMPLEMENTATION_DIRECTIVE_0.7.0.md`とIssue #37のP0〜P7、R1〜R4をすべて完了する。

最低条件：

- 全画像個別承認
- identity lock維持
- Stage 1〜6実プレイ可能
- save migrationと破損復旧成功
- 手動戦術残存0
- 敵素通り0
- スマートフォン受入完了
- build、test、Lint、diff check、CI成功
- console error、asset 404、参照切れ0
- High／Medium未解消0

workflowやpreviewが成功しただけでは公開前ゲート通過としない。

## 4. mergeとrelease SHA

1. PR #38のstate、draft、base、head、CI、mergeabilityを再取得。
2. expected head SHAを固定。
3. PRをReady化。
4. PR経由で通常merge。
5. merge結果のSHAを取得。
6. head SHAではなくmerge result SHAをrelease SHAとする。
7. `main`がrelease SHAを指すことを確認。

禁止：

- `main`直接push
- force push
- 共有履歴rebase・amend
- head SHAをrelease SHAとして誤記

## 5. tagとGitHub Release

1. release SHAへannotated tag `v0.7.0`を作成。
2. tagを通常push。
3. `v0.7.0^{commit}`がrelease SHAと一致することを確認。
4. GitHub Releaseを作成。
5. Release notesへ変更内容、save migration、公開URL、既知事項を記載。

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

失敗した場合はIssueを閉じず、原因をfeature branchまたは新しい修正PRで解消する。

## 7. 一般プレイヤー向け公開確認

公開完了は認証済みの開発者ブラウザだけで判定しない。

正式URLを次の条件で確認する。

- GitHubへログインしていない新規ブラウザ相当
- Cookie、localStorage、IndexedDB、service worker、cacheなし
- 認証ヘッダーなし
- 直接URL入力

最低確認：

- HTTP成功
- 認証要求、404、access deniedなし
- タイトル表示
- Version 0.7.0表示
- 主要JS、CSS、画像、音声取得成功
- fresh saveで物語開始
- マップ、編成、Stage 1開始
- console error 0

アクセス制限で一般プレイヤーが開けない場合、deployment successでも正式公開失敗とする。

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
- 物理iPhone Safari
- asset 404 0
- console error 0

公開後QAと物理iPhone確認の完了前にIssue close・branch削除を行わない。

## 9. ロールバック

重大不具合時：

1. Issue #37を閉じない、または再open。
2. 直前の正常release SHAを特定。
3. 不具合mergeを通常のrevert PRで戻す。
4. revert PRを通常merge。
5. GitHub Pages workflowを確認。
6. 正式URLと匿名アクセスを再確認。
7. 原因修正は別の通常PRで行う。

禁止：

- `main`のforce巻戻し
- tag移動
- Release履歴の改変による隠蔽
- ChatGPT Sitesへ一時退避して正式公開扱いにすること

## 10. バックアップ

リリース前に必要に応じてrepository bundleを作成する。

- release SHAを含むこと
- SHA-256を記録
- `git bundle verify`
- `git bundle list-heads`
- 新規cloneまたは隔離directoryで復元確認

バックアップの存在だけで復元可能と断定しない。

## 11. 最終記録

- release SHA
- merge commit
- annotated tag
- GitHub Release URL
- workflow run
- 正式URL
- 公開HTML release SHA
- 匿名アクセス結果
- 公開後QA
- 物理iPhone結果
- rollback要否
- Issue #37・PR #38状態
- branch cleanup
- ChatGPT Sites未更新
