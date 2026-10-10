# Version 1.0.2 — 実機報告への修正

2026-10-10のProducer指示に基づく。開始版は公開1.0.1、SHA `634f8de4b0fb15df902a7dd5983ea94237cfea9d`。
実行台帳：[Issue #177](https://github.com/SUSANO-OOO/Zombieee/issues/177)。

## 対象

- ホーム画面から起動したiPhone PWAで、ゲームは聞こえるが保存した画面録画が無音になる。音声の再生カテゴリ、Control Centerからの復帰、既存PWAの更新を修正・検証する。
- 全味方と敵の歩行・攻撃・被弾・復帰を改善する。クマバーソン、ババヤガ、パイセンを含む既存6人の関節歩行だけで完了としない。元画像の人物、衣装、武器、背丈を維持し、移動量と足運び、攻撃の構え・接触・戻りを接続する。
- 戦闘の血飛沫、傷口、部位欠損を強化する。武器と命中位置に応じて描き分け、同一ダメージの二重演出を防ぎ、敵の死亡・灰化と描画上限を維持する。

## 維持する条件

R5脚本、人物identity、stable ID、進行・報酬・通貨・設定・既存saveを維持する。能力発動に説明文字や名前を再追加しない。確認用のピッ音を出さない。ユーザーPCではブラウザ・ゲーム・音声を起動せず、実ブラウザ・音声検証はGitHub Actionsで行う。

## 実装と検証

音声と動作を別のcommitで実装する。音声は任意APIのfeature detection、所有者の共存、非表示・消音・終了後の再生禁止、一度だけの復帰を検査する。録画出力の復旧は物理iPhoneの保存動画で判定し、Mac WebKitや模擬AudioSessionの成功で代用しない。

動作は全runtime kindの対応表を持ち、実際のrendererで移動・左右・攻撃・被弾と画面サイズ1280×720／844×390／844×340を確認する。近接、射撃、重量型、人型感染者、四足・多脚、終盤bossを区別する。描画surface、frame time、武器socket・命中時刻の回帰を確認する。

対象test、全test、Lint、build、content validator、diff check、遠隔Chromium／native WebKit、独立read-only reviewを経て通常PRで統合する。既存release gateは弱めない。正式公開後にversion／SHA、asset、save・PWA更新を確認する。物理端末で未確認の録画音声や作品品質を成功・完了扱いにしない。
