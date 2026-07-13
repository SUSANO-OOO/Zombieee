# ASHFALL OUTPOST

ASHFALL OUTPOSTは、CRAWLERを守りながら生存者部隊を指揮し、3レーンの戦場を押し返して敵陣の拠点を破壊するリアルタイムのCanvas防衛ゲームです。

主対象はスマートフォン横画面で、PC横画面も正式対応です。ゲーム世界は960×540を基準とし、PC横画面とスマートフォン相当844×390を基本確認対象とします。詳細な製品仕様、ロードマップ、検証原則は、下記の文書マップを参照してください。

## 文書マップ

| 文書 | 役割 |
|---|---|
| [AGENTS.md](AGENTS.md) | CodexとChatGPTが守る情報源、役割、承認工程、Local/Cloud分担、判断・検証原則 |
| [docs/CHATGPT_HANDOFF.md](docs/CHATGPT_HANDOFF.md) | 作品意図、長期構想、承認済みの製品・ゲーム仕様 |
| [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) | 0.5.0から1.0.0までの実装順、依存関係、完了条件、将来候補 |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | 現在の公開版、公開基準、検証記録、未完了作業、復元時の照合事項 |
| GitHub Issue | 個別タスクの議論、比較、報告、プロデューサー判断、承認履歴 |

変動する公開URL、版、コミット、検証結果はREADMEへ複製せず、[PROJECT_STATE.md](docs/PROJECT_STATE.md)で確認します。

## 前提環境

- Node.js `>=22.13.0`
- npm

## セットアップ

```bash
npm install
```

WindowsでPowerShellの実行ポリシーにより`npm`が使えない場合は、`npm.cmd`を使用します。

## 開発・確認コマンド

| 目的 | 通常 | Windowsで`npm.cmd`を使う場合 |
|---|---|---|
| 開発サーバー | `npm run dev` | `npm.cmd run dev` |
| 本番ビルド | `npm run build` | `npm.cmd run build` |
| 自動テスト | `npm test` | `npm.cmd test` |
| Lint | `npm run lint` | `npm.cmd run lint` |

`npm test`は本番ビルド後にNodeのテストを実行します。

## 主要構成

- `app/AshfallGame.tsx`：ゲーム本体、描画、入力、戦闘ループ、HUD
- `app/gameRules.js`：数値定義、作戦、勝敗、レーン、標的選択などの純粋ロジック
- `app/globals.css`：画面レイアウト、スマートフォン横画面、HUD
- `tests/rendered-html.test.mjs`：ルール、主要仕様、サーバーレンダリングの自動テスト
- `public/`：背景、キャラクター、敵、CRAWLER、敵拠点などの画像
- `scripts/run-vinext.mjs`：OS共通のvinext起動ラッパー
- `.openai/hosting.json`：ChatGPT Sitesプロジェクト設定

## 開発コードと公開版

- 正式な開発コードは、プロデューサーが承認したGitHub `main`上のコミットです。
- 作業中のローカルまたはCloudの差分は、承認されるまでは候補状態です。
- ChatGPT Sitesの公開版は、実際に稼働している内容と公開基準コミットで管理します。
- GitHubへのpushとChatGPT Sitesへの公開は別工程です。

各工程は自動的に次へ進めず、[AGENTS.md](AGENTS.md)の承認ルールに従います。現在の公開・検証状態は[PROJECT_STATE.md](docs/PROJECT_STATE.md)を確認してください。
