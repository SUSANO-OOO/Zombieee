# 西新世紀末物語

西新世紀末物語（にしじんせいきまつものがたり）は、移動拠点を守りながら生存者部隊を指揮し、西新・早良区・百道浜周辺を再構成した区域を進むリアルタイムのCanvas戦略・防衛ゲームです。0.6.0では、タイトル、エリアマップ、編成、3ステージの戦闘、星評価、報酬、次ステージ解放をつなぐアーリーアクセス基盤を開発しています。

主対象はスマートフォン横画面で、PC横画面も正式対応です。ゲーム世界は960×540を基準とし、PC横画面、スマートフォン相当844×390、iPhone SafariでブラウザUI表示により高さが減る状態を確認対象とします。0.6.0候補の仕様と検証境界は[0.6.0製品仕様](docs/PRODUCT_SPEC_0.6.0.md)を参照してください。

## 文書マップ

| 文書 | 役割 |
|---|---|
| [AGENTS.md](AGENTS.md) | CodexとChatGPTが守る情報源、役割、承認工程、Local/Cloud分担、判断・検証原則 |
| [docs/CHATGPT_HANDOFF.md](docs/CHATGPT_HANDOFF.md) | 作品意図、長期構想、承認済みの製品・ゲーム仕様 |
| [docs/PRODUCT_SPEC_0.6.0.md](docs/PRODUCT_SPEC_0.6.0.md) | 0.6.0候補の承認済み要件、候補実装、暫定値、検証基準、将来差し替え境界 |
| [docs/QA_0.6.0.md](docs/QA_0.6.0.md) | 0.6.0候補のローカル実ブラウザ・表示領域・操作・自動検証の証拠 |
| [docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) | 0.5.0から1.0.0までの実装順、依存関係、完了条件、将来候補 |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | 現在の公開版、公開基準、検証記録、未完了作業、復元時の照合事項 |
| [docs/RELEASE_BACKUP_RECOVERY.md](docs/RELEASE_BACKUP_RECOVERY.md) | リリース、CI保護候補、tag、Release、bundle、オフデバイス保存、復元手順 |
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

`npm test`は本番ビルド後にNodeのテストを実行します。データベーススキーマを変更する承認済みタスクでは、必要に応じて`npm run db:generate`を使用します。

## 主要構成

- `app/AshfallGame.tsx`：ゲーム本体、画面遷移、描画、入力、戦闘ループ、HUD、visual viewport同期
- `app/CampaignScreens.tsx`：タイトル、エリアマップ、編成、会話、リザルトの表示
- `app/campaign.js`：ステージ、キャラクター、星、報酬、解放、バージョン付きセーブの純粋ロジック
- `app/battleDefinitions.js`：ステージ別の目的、ウェーブ、勝敗、戦闘定義
- `app/combatLifecycle.js`：標的制約、敵死亡、味方感染、火炎焼却の純粋ロジック
- `app/storyEvents.js`：差し替え可能な会話イベントデータ
- `app/gameRules.js`：数値定義、作戦、勝敗、レーン、標的選択などの純粋ロジック
- `app/globals.css`、`app/campaign.css`：戦闘HUD、キャンペーン画面、safe area、低い横画面のレイアウト
- `tests/`：キャンペーン、戦闘ライフサイクル、ステージ、イベント、主要仕様、サーバーレンダリングの自動テスト
- `public/`：背景、キャラクター、敵、CRAWLER、敵拠点などの画像
- `scripts/run-vinext.mjs`：OS共通のvinext起動ラッパー
- `.openai/hosting.json`：ChatGPT Sitesプロジェクト設定

## 開発コードと公開版

- 正式な開発コードは、プロデューサーが承認したGitHub `main`上のコミットです。
- 作業中のローカルまたはCloudの差分は、承認されるまでは候補状態です。
- ChatGPT Sitesの公開版は、実際に稼働している内容と公開基準コミットで管理します。
- GitHubへのpushとChatGPT Sitesへの公開は別工程です。
- 0.6.0の作業ブランチにある実装は、マージ・リリース・公開・製品受入が完了するまで候補状態です。公開版0.5.0の履歴上の名称や表示は書き換えません。

開発は、承認済みfeatureブランチでDraft PRまで進める実装ミッションと、固定したPR・SHAを基準にマージ・リリース・公開を行うリリース承認の二段階で扱います。詳細は[AGENTS.md](AGENTS.md)、現在の公開・検証状態は[PROJECT_STATE.md](docs/PROJECT_STATE.md)を確認してください。
