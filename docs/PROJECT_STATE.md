# 西新世紀末物語 — プロジェクト状態

更新日：2026-08-08

## 1. 正式公開

唯一の正式公開先はGitHub Pagesです。

- 正式URL：`https://susano-ooo.github.io/Zombieee/`
- 公開中version：**Version 0.9.9.0**
- 公開release SHA：`19a79404822ebc8f0cbd8a3b809b8ed0adbc28af`
- release tree：`305af62474c8a1ea118251023ec4ad58bee17975`
- annotated tag：`v0.9.9.0`
- GitHub Release：Version 0.9.9.0
- release request ID：`v0.9.9.0-19a7940-20260808T0448Z`
- release ledger：Issue #136
- final integration HEAD：`955ad53788c0049116845721c8e2bacd0f45d90e`
- final remediation HEAD：`50ec6cec553c155303a895891bf867d387024e8c`
- final main PR：#142
- final remediation PR：#145

`main` HEADは動的な開発状態であり、release後のdocs-only merge等により公開release SHAより先へ進む場合があります。この文書へ`main` HEADを固定値として埋め込まず、作業開始時・PR操作前・release前にGitHubのlive値を再取得します。公開版のimmutable identityは上記release SHA／tree／tag／GitHub Releaseで判定します。

Version 0.9.9.0のfinal independent auditは**APPROVE — High 0／Medium 0／Low 0**です。PR #142は通常merge済み、Issue #136は公開後QA成功後に`completed`としてclose済みです。

## 2. Version 0.9.9.0の公開後QA

- Pages release run：success
- Public QA run：success
- public HTML：Version、release SHA、request ID、Issue、`/Zombieee/` baseがrelease requestと一致
- manifest：416 assets
- logical bytes：89,970,119
- distinct bytes：89,430,216
- source manifest SHA-256：`34c336e32838e11e0920cc1698ad45d4a26a8baabe9b0953794b0cb64426901a`
- audio bundle：250 slices、18,881,516 bytes
- evidence index：286 files、combined SHA-256 `35606446df29d866a511911499f942adacea58ed3ddf15b0c668828a3ad66c8b`
- 1280×720：pass
- 844×390：pass
- 844×340：pass
- fresh save：pass
- Version 0.9.0 schema v13 save：pass
- Version 0.9.5 schema v14 save：pass
- title→map→loadout→assets ready→battle：pass
- IndexedDB delay／blocked、image.decode hang、低速network、optional asset hang fixture：pass
- console error／page error／HTTP error／request failure／horizontal overflow：0

Playwright WebKitは物理iPhone確認ではありません。物理iPhone本体speakerの聴感と発熱は未確認であり、GitHub Releaseに残存QAとして記録済みです。後日異常が見つかった場合は0.9.9.0の履歴を書き換えず、新しいfollow-up Issueで扱います。

## 3. Version 0.9.9.0のplayer-facing変更

### UI・transaction feedback

- 選択、決定、戻る、購入、強化、報酬、出撃、拒否をsemantic cueへ整理
- 雇用・強化のdurable save成功後だけ成功feedback／SEをpublish
- 雇用と強化、自動saveを共通queueで直列化し、stale save、二重減算、二重receiptを防止
- `aria-disabled`操作はreject feedbackを返しつつ、禁止stateを変更しない
- save-pending中は戦闘入力とframe進行を遮断

### Battle audio

- normal／pressure／boss BGMを明確化
- Stage 3 TAKUYA incomingからboss BGMをproduction pathで維持
- 全16unitのability activation root、timeline subcue、ready familyを明示契約化
- boss、defeat、explosion、supportをgeneration／receipt単位で一回だけ発火

### Battle presentation

- boss entrance／defeatを段階presentation化
- small／medium／large explosionを用途別に分離
- explosive drumに影、落下、回転、dust、spark、bounce、activationを追加
- CRAWLER deploymentのalpha／physical occlusionを修正
- barrage／airstrikeをproject-originalの構造的に異なる各7 semantic RGBA frameへ刷新
- 844×390／844×340 battle HUDのsafe-zone、文字サイズ、重なりを修正
- gameplay damage、cooldown、targeting、reward、save契約は変更なし

### App icon

- Producer承認A2からversioned favicon、Apple touch、192／512／1024、maskable iconを生成
- PWA `id`、`start_url`、`scope`は`./`を維持
- 旧icon filesはrollbackのため物理保持

## 4. PWA・save状態

- manifest：416 assets
- logical bytes：89,970,119
- distinct bytes：89,430,216
- audio bundle：250 slices、18,881,516 bytes
- save schema：v14、変更なし
- active／previous generation、差分update、rollback、offline、commit-only recoveryを維持
- saveとasset cacheを分離

PWAは全件のsize／SHA-256検証、Cache Storage保存、manifest commit ACK完了後だけゲーム開始します。

## 5. 今後の実装運用

今後の実装は、次の責務分離を標準とします。

1. Producerが対象Versionの主目的と製品境界を固定
2. **Sol Design Lead**が実装前設計を担当
3. **Luna Implementation Lead**がSol設計を正本として実装
4. Design Leadとは別コンテキストの**Sol Auditor**が固定HEADをread-only監査
5. High／Medium未解消0と対象Versionのrelease gateを満たした場合だけmerge／公開

Codexの`/goal`は、時間の長短ではなく、複数工程・複数checkpoint・反復検証をまたいで同じ達成目標を保持する必要があるmissionで使用します。Version／featureの正式設計、複数moduleをまたぐ実装、実装→QA→修正→PR、audit remediation、release工程等はgoal-managed missionです。read-only確認、単発test、typo修正、設計判断を伴わない小さな単一file修正等は通常promptで処理できます。

SolとLunaが`/goal`を使う場合、設計goalと実装goalは分離します。Lunaが実装中に重大な設計欠落を発見した場合は独自再設計せずSolへ戻し、Sol AuditorはDesign Lead Solとは別コンテキストで行います。詳細な判定基準は`AGENTS.md`を正本とします。

## 6. 次Versionの状態

Version 0.9.9.0以降の次Versionは**まだ主目的を固定していません**。新規実装へ入る前に、Producerが一つの主目的を選び、新しい実行台帳IssueまたはProducer Decisionsを作成します。

長期候補は`PRODUCT_ROADMAP.md`に保持します。自動的に複数候補を同時採用しません。

Issue #24 `[Backlog][Audio] 正式BGM・SE制作と物理端末聴感QA` はopenのままです。0.9.9.0でaudioの大幅改善は行いましたが、物理iPhone本体speaker／earphone／PC speakerの最終実聴等を含むBacklog全体の完了条件は未達のため、勝手にcloseしません。

## 7. 恒久基準

- repository：`SUSANO-OOO/Zombieee`
- default branch：`main`
- 正式release baseline：`19a79404822ebc8f0cbd8a3b809b8ed0adbc28af`
- save key：`nishijin-campaign-v1`
- stable ID、localStorage／IndexedDB、migration snapshot、last-known-good、recovery、export／importを維持
- smartphone横画面を第一基準、PC横画面も正式対応
- 本編Stage 1〜20、Survival、16 playable units、Level 1〜50基盤を維持
- `main`直接push、force push、rebase、amend、既存tag移動、save初期化、cache全削除、ライセンス不明asset採用は禁止
- goal-managed missionは`AGENTS.md`の判定基準に従って`/goal`を使用する

長期方向は[PRODUCT_ROADMAP](PRODUCT_ROADMAP.md)、公開・復元は[RELEASE_BACKUP_RECOVERY](RELEASE_BACKUP_RECOVERY.md)を参照してください。
