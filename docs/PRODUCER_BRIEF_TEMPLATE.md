# 西新世紀末物語 — Producer Brief Template

更新日：2026-08-08

## 1. 役割

ProducerとChatGPT／司令塔が行ったアイデア出し・検討・比較・試案を、Sol Design Leadへ渡せる確定入力へ整理するためのテンプレートである。

ブレインストーミング中の発言、候補、思いつき、却下前の案を、そのまま実装要件として扱わない。Solへ設計依頼する時点で、本Briefに採用内容と未確定内容を分離する。

## 2. Template

```text
PRODUCER_BRIEF_ID: <version-or-feature>
STATUS: READY_FOR_SOL_DESIGN

OBJECTIVE:
- 今回達成したい主目的を1つ

PLAYER_OUTCOME:
- プレイヤーから見て何がどう良くなるか

WHY_NOW:
- 今回これを優先する理由

MUST_HAVE:
- 必ず実現すること

PREFERENCES / DIRECTION:
- 雰囲気、体験、優先したい方向性
- Solが設計へ落とす際の参考にするが、技術方式そのものを固定しない項目

DO_NOT_CHANGE / NON_GOALS:
- 今回触らないこと
- 維持必須の既存挙動

KNOWN_PROBLEMS / OBSERVATIONS:
- 実機所感、スクリーンショット、既知不具合、ユーザー観察
- 事実と仮説を可能な範囲で分ける

REFERENCES:
- Issue、URL、画像、動画、既存MD等

OPEN_PRODUCT_DECISIONS:
- Producer判断がまだ必要な項目
- 0件なら NONE

IDEAS_NOT_ADOPTED:
- 会話では出たが今回の要件には入れない案
- 後で再検討できるよう必要なものだけ記録

HANDOFF_TO_SOL:
- Solは本Briefを製品入力として現行code／Issue／testsを調査し、Design Lockへ変換する
- Solは未採用アイデアを勝手にscopeへ戻さない
- architecture、implementation detail、test設計はSolの責務
```

## 3. 運用

- Producer／司令塔との会話は自由に行う。途中案を逐一GitHub正本へしない。
- 実装へ進む判断が出た時点で、司令塔が会話を整理してProducer Briefを作る。
- Producer Briefは対象Issue本文、Issue comment、または対象Versionの指定MDへ固定する。
- SolはProducer Briefと現行repositoryを読んでDesign Lockを作る。
- LunaはProducer Briefの生のアイデアを直接実装判断に使わず、Solの最新Design Lock／Luna Handoffを実装正本とする。
- Producer Briefに矛盾や未確定product decisionが残る場合、Solは推測で埋めずblockerとして司令塔へ返す。
