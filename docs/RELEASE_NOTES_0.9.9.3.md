# 西新世紀末物語 — Version 0.9.9.3 Release Notes

Version 0.9.9.3は、Version 0.9.9.2を既存ホーム画面PWAのまま更新した物理iPhoneで判明した、戦闘HUDと会話portrait配置の修正releaseです。

## Player-facing fixes

- 667×375／736×414を含む16:9 landscape phoneで、戦闘HUDが旧layoutへ戻って画面外へ見切れる問題を修正
- 文字サイズを下げず、長いunit名・support不足理由・phase補助表示を狭幅専用の列配分と折り返しで可読化
- safe-areaあり／なしの双方で、全18 event portraitの描画された胴体が会話boxへ12〜40px重なるよう修正

## Update safety

- PWAの削除・再インストール、Cache Storage削除、save初期化は不要
- Version 0.9.9.2のactive generationとsaveを保持したままVersion 0.9.9.3へ更新
- asset manifest 416件、audio bundle 250件、新規production asset 0件

Playwright WebKitは物理iPhone確認ではありません。正式公開後は、同じインストール済みPWAで更新し、物理iPhoneのHUD、portrait、speaker、操作、発熱をProducerが確認します。
