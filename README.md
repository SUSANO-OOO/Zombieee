# 西新世紀末物語

西新・早良区周辺を再構成した区域で、生存者部隊と装甲車両を指揮する、スマートフォン横画面・PC対応のリアルタイムCanvas戦略・防衛ゲームです。

**[正式プレイURL](https://susano-ooo.github.io/Zombieee/)**

現在の配信版・release SHA・確認済み範囲・残件は **[PROJECT_STATE](docs/PROJECT_STATE.md)** を入口にしてください。mainは運用改修で公開版より先へ進むことがあります。Releaseの作成とPagesへの実配信は別です。ChatGPT Sitesは旧公開先です。

## 開発を始める

1. [AGENTS.md](AGENTS.md)の短い安全境界を読む。
2. [PROJECT_STATE](docs/PROJECT_STATE.md)から対象のProducer Decisionsと実行台帳へ進み、最新のユーザー指示・Issue／PR・実行結果と照合する。
3. ローカル変更と実行中作業を保全して、変更依存の実装・検証を行う。固定Sol／Luna間の往復や、新たな計画書は通常作業の前提ではありません。

Node.js `>=22.13.0` とnpmを使用します。依存の正本は `package-lock.json` です。

```bash
npm ci
npm run dev
```

PowerShellの実行ポリシーでnpmを呼べない場合は `npm.cmd` を使います。Playwright／WebKitの固定runtimeは検証条件なので、依存PRと一括で更新しません。

## 検証

```bash
npm test
npm run lint
npm run content:validate
git diff --check
```

`npm test` はproduction buildと全Nodeテストを含みます。build済みなら `node --test tests/<対象>.test.mjs` で対象検査を実行でき、CIはbuildを一度行ってからNodeテストを呼びます。変更した製品・共有処理には対応するbrowser・save・PWA・音・動作の確認を加えます。文書やCIだけの変更を、ゲーム全体の品質合格とは呼びません。

Actionsの検査選択と証拠条件は [ci-change-scope.mjs](scripts/ci-change-scope.mjs) とそのテストが所有します。実行したlane、再利用元、対象外と失敗は分けて確認してください。正式性能・物理iPhone・人間の聴感／実プレイ評価を混同しないでください。

## Codexの設定と分担

プロジェクトはモデルを固定しません。ユーザーが選んだモデルと推論設定を尊重し、旧版のSol／Luna役割名を現在のモデル指定として扱いません。独立した調査・レビューを分担できる場合も、親担当が結果を統合します。

設定は実行時指定、信頼されたプロジェクト設定、profile、ユーザー設定などの優先順位で決まります。AGENTSは別の指示読込経路です。設定を変える前に、利用中の版の `codex --help`、`codex doctor --help`、`codex debug prompt-input --help` と [公式の設定資料](https://learn.chatgpt.com/docs/config-file/config-basic)、[AGENTSの読込仕様](https://learn.chatgpt.com/docs/agent-configuration/agents-md)を照合します。利用可能モデル・推論段階はアカウントと実行環境で確認し、存在しない設定キーや機能を追加しません。

設定・指示ファイルの変更は、進行中のチャットへ即反映した証拠にはなりません。必要な場合は新しいセッションの実効設定・指示読込を確認します。ローカル診断の全文や認証情報はGitへ入れません。

## 文書と構成

| 入口 | 内容 |
|---|---|
| [PROJECT_STATE](docs/PROJECT_STATE.md) | 公開版、対象Issue、判断の優先順位、確認と残件 |
| [AGENTS](AGENTS.md) | 作業時の安全境界 |
| [公開・復旧手順](docs/RELEASE_BACKUP_RECOVERY.md) | PR、tag／Release、明示Pages配信、save／PWA復旧 |
| [製品判断と正史](docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md) | 日付付きのProducer判断。新しい明示判断を優先 |
| [素材・音の出典](docs/THIRD_PARTY_ASSETS.md) | 世代別の由来・条件と現行台帳への参照 |
| [ロードマップ](docs/PRODUCT_ROADMAP.md) | 過去の構想と後続判断の関係。実行許可ではない |

製品コードは `app/`、配信素材は `public/`、元素材は `assets/source/`、生成・検査は `scripts/` と `tests/` です。旧版名でも現行から参照されるものは保持します。`output/`・`outputs/` はローカル生成物で、必要な原証拠はIssueに記録した保存先と対応させて保全します。

## 音声の再生成

通常buildは保存済み音声を使い、VOICEVOXの導入は不要です。専用短声を再生成する場合だけ、[既存generator](scripts/build-v104-combat-voices.py)へ --runtime <directory> またはVOICEVOX_RUNTIMEを明示します。先に --check-runtime で必要ファイルを確認できます。これは合成成功やbyte一致の確認ではありません。

runtimeは既存台帳と同じVOICEVOX Core 0.17.0、Windows用ONNX Runtime、Open JTalk辞書、4.vvmを用意したsite/・runtime/構成です。12.vvmだけはgeneratorが[公式0.17.0配布](https://github.com/VOICEVOX/voicevox_vvm/releases/tag/0.17.0)から取得し、固定SHA-256を照合します。Core・辞書・各voiceの条件は[出典台帳](docs/THIRD_PARTY_ASSETS.md)とassets/source/v104/combat-audio/を参照し、元台帳・WAV・queryを保全してから差分を確認してください。所在不明の古いpromotion用フォルダを再生成の前提にしません。

## 公開を伴わない改修

通常のmain push、文書・CIの統合でゲームを再配信しません。公開は承認されたrelease request／安全なmanual dispatchと[公開手順](docs/RELEASE_BACKUP_RECOVERY.md)に従います。既存タグ、共有履歴、saveを維持し、復旧も通常PRで行います。
