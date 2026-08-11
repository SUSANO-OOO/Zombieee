# 西新世紀末物語 — Version 0.9.9.4 Release Notes

Version 0.9.9.4は、Version 0.9.9.3を既存ホーム画面PWAのまま更新した物理iPhoneで判明した、大画面iPhoneの戦闘表示を修正するreleaseです。

## Player-facing fixes

- 932×430相当のlandscape viewportでもmobile HUD契約を適用し、戦闘中のunit／support cardと下部情報が画面外へ見切れないよう修正
- 932×430相当でも、全18 event portraitの描画された胴体と会話boxの12〜40px overlapを維持
- 移動拠点からの出撃時、unitの身体がdoorを通過した時点で車体前面へ移し、腕だけが長時間見える状態を解消
- クマバーソンを出撃表示の必須browser QA対象へ追加

## Update safety

- PWAの削除・再インストール、Cache Storage削除、save初期化は不要
- Version 0.9.9.3のactive generationとsaveを保持したままVersion 0.9.9.4へ更新
- asset manifest 416件、audio bundle 250件、新規production asset 0件

Playwright WebKitは物理iPhone確認ではありません。正式公開前に、同じインストール済みPWAからHTTPS candidateを確認し、物理iPhoneでHUD、portrait、出撃表示をProducerが判定します。
