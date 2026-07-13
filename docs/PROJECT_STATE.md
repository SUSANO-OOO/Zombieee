# ASHFALL OUTPOST — プロジェクト状態

更新日：2026-07-13

## 1. この文書の読み方

この文書は、公開版、開発状態、検証記録、未完了作業、現在の停止地点、別PC復元時の照合事項など、変動する事実だけを管理する。

- 恒久的な運用規則：[AGENTS.md](../AGENTS.md)
- 作品意図と承認済みゲーム仕様：[CHATGPT_HANDOFF.md](CHATGPT_HANDOFF.md)
- 実装順と依存関係：[PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md)
- セットアップと実行コマンド：[README.md](../README.md)
- 個別タスクの議論・判断・報告：対応するGitHub Issue

GitHub `main`の現在のHEADはリモートrefで都度確認する。更新していないローカルの`origin/main`を現在のGitHub `main`として扱わず、この文書にも「最新main SHA」を固定値として追記し続けない。

公開基準コミット、検証対象コミット、PRやIssueの状態は、その時点の状態を復元するために必要な範囲で記録する。

## 2. 現在の公開状態

- 公開URL：https://ashfall-outpost-defense.paopao9.chatgpt.site/
- ChatGPT Sitesバージョン：17
- Sites状態：success
- private deployment：succeeded
- 通常deployment：succeeded
- 公開基準コミット：`9a8815c47f5ef7a9df0b77cfb6ea1f07b637354a`
- 公開内容：0.5.0開発候補
- 正式な0.5.0製品受入：未完了
- 正式開発リポジトリ：非公開GitHub `SUSANO-OOO/Zombieee`
- 正式開発ブランチ：GitHub `main`

Sites公開処理自体は成功している。ただし、公開成功と製品受入完了は別であり、現在の公開内容を0.5.0完成版とは扱わない。

GitHubへのpushとChatGPT Sitesへの公開は別工程である。GitHub `main`へ反映された変更が自動的に公開版へ反映されるわけではない。

## 3. 正式開発ブランチの確認方法

現在のGitHub `main`が作業基準となる場合は、次のいずれかでリモートrefを確認してから基準コミットを確定する。

- GitHub APIまたはGitHub画面で`main`を確認する
- `git ls-remote origin refs/heads/main`でリモートrefを直接確認する
- `origin/main`を使う場合は、先に`git fetch origin`などで更新済みであることを確認する

更新していない`origin/main`は現在のGitHub `main`の証拠にはしない。リモートrefとは別に、ローカルの現在ブランチ、HEAD、作業ツリー、未追跡ファイル、stage済み差分、対応Issueも確認する。

## 4. 現在のGitHub状態

### PR #15

- URL：https://github.com/SUSANO-OOO/Zombieee/pull/15
- タイトル：`[0.5.0] 防護コンテナ着地体験とユニット役割可視化`
- 状態：merged・closed
- head：`feat/0.5.0-experience-quality`
- head SHA：`7e6fa9b7234a643db164b75cdda7735ac809df1c`
- merge commit：`9a8815c47f5ef7a9df0b77cfb6ea1f07b637354a`
- headブランチ：未削除

### Issue #14

- URL：https://github.com/SUSANO-OOO/Zombieee/issues/14
- 状態：open
- 公開成功後も製品受入が未完了のため、完了扱いにしない

### Issue #11

- URL：https://github.com/SUSANO-OOO/Zombieee/issues/11
- 状態：open
- 0.5.0統合設計の技術根拠として維持する

### Issue #16

- URL：https://github.com/SUSANO-OOO/Zombieee/issues/16
- 状態：open
- 0.5.0〜1.0.0ロードマップと現行状態の文書正式化を管理する
- 作業ブランチ：`docs/product-roadmap-v1`

## 5. Sitesバージョン17の再確認結果

2026-07-13、時間経過後の読み取り専用確認で次を確認した。

- Sitesバージョン17：success
- private deployment：succeeded
- 通常deployment：succeeded
- 公開基準コミット：指定SHAと一致
- 既存公開URL：新版
- GitHub `main`：指定SHAと一致
- Issue #14：open
- 再公開、別バージョン、別URL、編集、commit、push、Issue変更、ブランチ削除：未実施

報告コメント：

https://github.com/SUSANO-OOO/Zombieee/issues/14#issuecomment-4953784334

## 6. 現在の開発・QA状態

GitHub `main`には次が存在する。

- 3レーン戦闘
- 6種類の味方ユニット
- TAKUYAボス戦と敵拠点破壊
- 防護投下物
- 既存4支援行動
- ローカル限定の`?qa=endgame`終盤QAモード
- ローカル限定の`?qa=roles`6ユニット役割QAモード
- Windowsを含むOS共通のvinext起動ラッパー
- 復元と引き継ぎに使うプロジェクト文書

QAモードは、ホストが`localhost`または`127.0.0.1`の場合だけ有効とし、公開ドメインでは有効にしない。

## 7. 検証記録

PR #15およびIssue #14の報告上、次が成功している。

- テスト13/13
- Lint
- 本番ビルド
- PC横画面
- スマートフォン相当844×390
- 専用画像読み込み
- console warning／error 0件

公開URL上では、6ユニットカード、防護投下物説明、専用画像リソース、配置操作などを確認した。一方、敵・味方別着地ダメージと全6種類の専用戦闘キューを個別に完全捕捉する確認は未完了。

文書更新工程ではゲームテスト、Lint、ビルド、ブラウザ確認を再実行しない。

## 8. 製品受入で判明した未完了事項

### 戦術投下物

- 現行グラフィックが、意図した円筒形投下物ではなく要塞・建築物のように見える
- 正式方向は、大型ドラム缶を基礎形状とした円筒形装甲投下ポッド
- 敵・味方地点への投下可否と、敵・味方別着地ダメージの視覚的確認が不十分
- 現行コードには全体2個・各レーン1個の固定設置上限がある
- 製品方針ではプレイヤー向け固定上限を廃止し、スクラップ、空間、禁止領域、経路、耐久で制御する方向

### 6ユニット

- MEDICの回復演出が敵へ向かっているように見える
- BRAWLERなどの演出が何を示すか分かりにくい
- 通常攻撃、役割特性、将来のアクティブスキルの区別が不足
- 公開URL上で全6種類の専用戦闘キューを個別に完全確認できていない
- 現行クラス・カテゴリ名は暫定であり、将来変更する

### CRAWLERと敵拠点

- 現在のバス型CRAWLERは最終デザインではない
- 位置が下寄りに見え、戦場全体の構図に違和感がある
- 0.5.0では大型装輪移動拠点へ正式化する方針
- 現在の敵バリケードは正式な敵拠点表現として弱い
- 0.5.0では段階破損を持つ廃工業検問ゲート型へ正式化する方針

### 戦術システム

- 爆薬ドラム、炎上、救急物資、固定航空支援、CRAWLER全レーン一斉掃射は未実装または正式化前
- 指揮力、スクラップ、支援ゲージの役割整理が必要
- 戦闘前の簡易ロードアウトと、敗北後の再戦・ロードアウト変更導線が未実装

## 9. 文書正式化状態

2026-07-13、製品仕様とロードマップを次の5文書へ整理する工程を開始した。

- `README.md`
- `AGENTS.md`
- `docs/CHATGPT_HANDOFF.md`
- 新規`docs/PRODUCT_ROADMAP.md`
- `docs/PROJECT_STATE.md`

文書作業はIssue #16、ブランチ`docs/product-roadmap-v1`で管理する。ゲームコード、CSS、テスト、画像、設定、Sitesは変更対象外。

## 10. 現在の停止地点

- Sitesバージョン17公開：成功
- Issue #14製品受入：未完了
- Issue #14：open
- Issue #11：open
- Issue #16：open
- 旧作業ブランチ削除：未実施
- 0.5.0追加実装：未開始
- 現在の工程：文書ブランチの独立レビューと必要修正
- 次工程：文書PR作成（別承認）
- その次：文書PRレビュー
- レビュー通過後：`main`反映（別承認）
- 文書の`main`反映後：更新済みロードマップを前提とした読み取り専用技術監査

各工程は独立して扱う。次の明示承認なしに、ゲーム実装、文書PR作成、PRレビュー後の`main`反映、Sites公開、Issueクローズ、ブランチ削除へ進まない。

## 11. 次の技術監査で確認する内容

文書反映後、Codexへ読み取り専用で次を確認する。

1. CRAWLER、敵拠点、レーン、出撃口、HUDの座標依存
2. 新CRAWLER・敵拠点画像の描画と当たり判定範囲
3. 戦術投下ポッドの固定上限撤廃時の経路・重複・性能リスク
4. 戦術投下ポッド、爆薬ドラム、救急物資で共通化可能な設置・耐久・範囲効果処理
5. スクラップと支援ゲージの分離
6. 現行IRON BARREL、MEDKIT、MOLOTOV、AIRSTRIKEの再利用可能範囲
7. CRAWLER一斉掃射と航空支援の実装位置・役割分離
8. 簡易ロードアウトの最小変更
9. 6ユニット演出の発動条件と対象
10. 大量ユニット・大量設置物の性能上限
11. 844×390でのHUD占有率
12. QAモードで各機能を即時再現する方法
13. 必要最小限の共通構造
14. 全面リファクタリングを避けた変更候補ファイル
15. 0.5.0を一つのIssue・ブランチ・PRへまとめる技術的可否

## 12. 別PC復元時の照合事項

1. 非公開GitHubリポジトリを取得する
2. [README.md](../README.md)の前提環境、セットアップ、確認コマンドに従う
3. GitHub `main`のリモートrefを確認し、ローカル追跡状態と照合する
4. この文書の公開版、公開基準コミット、検証記録、未完了作業、停止地点を確認する
5. [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md)で次の製品工程を確認する
6. Sites公開が必要な場合は、プロデューサーの別承認後に行う

`node_modules`、`dist`、`work`、`outputs`などの生成フォルダは正式なソースバックアップではなく、必要に応じて再生成または別途移行する。

## 13. 更新条件

次の場合に、プロデューサーの承認を得てこの文書を更新する。

- 公開版、公開URL、公開基準コミットが変わった
- 検証を行い、対象コミット、環境、範囲、結果を正式記録する
- GitHub `main`上の開発状態の要約が変わった
- 未完了作業の追加、完了、優先順位変更が承認された
- 現在の停止地点と次工程が変わった
- 別PC復元やSites再接続の条件が変わった

コミット前、push前、公開前に、まだ完了していない工程を完了済みとして書かない。現在の`main` HEADを追うためだけの文書更新は行わない。
