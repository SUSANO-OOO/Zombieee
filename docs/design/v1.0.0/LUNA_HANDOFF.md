# Version 1.0.0 Historical Luna Handoff / Current SOL Execution Handoff

- Canonical Design Lock: `V100-SOL-DL-001 r36`
- Required design base: story baseline commit `435dc959d1972646f7e82b6c45d3f1c25d890252`
- Active execution owner: `SOL`
- Active handoff: `NONE`
- Luna status: `SUPERSEDED_FOR_V1_SOL_SINGLE_OWNER`
- Design status: `DESIGN_LOCKED`

Sections 1-44 are retained as audit history. Do not resume Luna or execute a historical `NEXT_OWNER: LUNA_IMPLEMENTATION`, `BLOCKED_RETURN_TO_SOL`, Producer Visual Checkpoint, Completion Packet, or Producer Final Acceptance route while the Producer's SOL single-owner override is active. Section 45 is the sole current execution handoff.

## 1. Branch and PR contract

- Start from the merged/approved Design PR result, not from an older local checkout.
- Use a new `codex/` implementation branch and a Draft PR. Do not implement on the Sol design branch.
- Re-fetch live base/head/tree, open PRs, branch protection, and permissions before branch creation and before every push.
- Normal commits and normal pushes only. No amend, rebase, force push, direct main push, Ready conversion, merge, tag, Release, Pages deployment, or Issue closure.
- If the story baseline PR is not yet merged, target the explicitly approved integration/base branch and record the dependency in the PR body.

## 2. Required reading

1. `AGENTS.md`
2. `docs/CODEX_TWO_THREAD_WORKFLOW.md`
3. `docs/CODEX_LUNA_ROLE.md`
4. `docs/PROJECT_STATE.md`
5. `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`
6. `docs/story/v10/STORY_SCRIPT_V10.md`
7. `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`
8. `docs/design/v1.0.0/DESIGN_LOCK.md`
9. `docs/design/v1.0.0/ASSET_INVENTORY.md`
10. `assets/source/v100/PROVENANCE.md`

Confirm the selected master hashes before any derivative work. A mismatch is a stop condition.

## 3. Phase 1 — foundation, save, and data

### Owned modules

- `app/campaign.js`
- `app/campaignEconomy.js`
- `app/campaignStorage.js`
- `app/unitProgression.js`
- `app/CampaignScreens.tsx`
- the smallest new pure-data modules needed to keep the 30-stage registry auditable
- corresponding focused tests

### Exact work

- Register exactly 30 ordered stages, prerequisites, mission types, events, unit unlocks, and rewards.
- Implement fixed level caps, costs, stat formulas, vehicle upgrades, the three-support one-of-three loadout, Stage 2/6/9 support unlock receipts, and separate vehicle-only barrage/airstrike abilities.
- Create `nishijin-campaign-v100` / `v100-new-campaign-1` as a 0-CAPS new campaign. Do not add an additive migration from `nishijin-campaign-v1`; preserve every legacy source byte-for-byte and copy only the Design Lock's explicit settings whitelist.
- Implement the cross-tab/recovery-safe 180 CAPS entitlement and single safe-screen popup with the exact receipt IDs in the Design Lock.
- Register all nine Story boss gates, distinct stable IDs, atomic first-defeat discovery/mode unlocks, replay, receipt-idempotent counts, and the fixed first/repeat Story rewards. TAKUYA and TAKUYA-Ω must never alias.
- Add data validators/simulations proving stage reachability, 9,000 total first/star CAPS, purchase affordability, cap gates, support separation, spoiler-safe boss pools, dual-namespace preservation, and receipt idempotency.

### Do not touch in Phase 1

- Runtime art, AudioMixer, PWA worker, existing combat presentation, or release workflow.
- Stable existing IDs or historical receipts.

### Gate

Focused campaign/economy/progression/save tests, fresh/current/legacy dual-namespace tests, multiple-tab entitlement/popup tests, support/boss unlock tests, build, lint, content validation, and diff check must pass before Phase 2. Commit this phase separately.

## 4. Phase 2 — Stage 1-20 story integration

### Owned modules

- `app/storyFlow.js`
- `app/storyEvents.js`
- `app/storyBattleBarks.js`
- `app/campaign.js` only for Phase 1-locked data corrections
- `app/stageObjectManifest.js`
- `app/productionVisuals.js`
- `app/battleAssetPlan.js`
- `app/AshfallGame.tsx` integration points only
- focused story/presentation/object/asset tests

### Exact work

- Integrate the canonical story events and mission-object states for Stages 1-20.
- Preserve existing stage landmarks and fixed player-facing wording.
- Ensure power, escort, base, boss, entrance, death, and post-battle transitions are visible and reachable.
- Reuse approved existing portraits; make only crop/anchor/layout changes required by the dialogue contract.
- Before Phase 3 begins, replace only Paisen's legacy battle sheet with an approved-identity seven-state/two-direction runtime atlas whose `hit` and `death` states are structurally distinct. This is the only Stage 1-20 playable sprite derivation required by the closure.

### Gate

- Story event order and branching match the implementation map.
- Stage 1-20 regression, all required mission objects, dialogue geometry, deployment final canvas, boss audio continuity, and mobile matrix pass.
- No newly generated replacement identity for an already approved character.

## 5. Phase 3 — Stage 21-30, ending, enemies, and assets

### Owned modules

- the same stage/story registries, with new stage-specific modules allowed
- `app/bossFoundation.js`
- `app/spriteManifest.js`
- `app/enemyFacingContract.js`
- `app/productionVisuals.js`
- `app/stageObjectManifest.js`
- `app/battleAssetPlan.js`
- optimized runtime art under a new versioned public asset directory
- asset generator/provenance/manifest tests

### Exact work

- Implement Stage 21-30 and ending/credits/epilogue exactly as locked.
- Produce only the finite runtime derivatives listed in `ASSET_INVENTORY.md`.
- Produce and integrate the locked Stage 21-30 event portraits, RED PANTHER role atlases, mutated-president and TAKUYA-Ω entrance/idle/attack/hit/phase/death states and defeat cuts, plus the locked stage/mission-object derivatives. These are required runtime derivatives, not new identity-master candidates.
- Maintain identity between authoring master, event portrait, card/profile, and battle form.
- Implement RED PANTHER variants, mutated president with exactly four arms/four hands, and TAKUYA-Ω with exactly two arms and no orange garment.
- Limit the simple featureless gender-neutral minor-human silhouette to minor human speakers with no identity master; never assign it to a major named speaker or add face, hair, costume, occupation, accessory, or weapon cues.
- Treat all nine currently selected authoring masters as immutable inputs. Do not generate another character candidate or redesign Segawa, either Mugarian president form, TAKUYA-Ω, any RED PANTHER role, the shared minor-human silhouette, or an existing character.
- Add authored map derivatives and mission objects; no tint-only stage, rectangle placeholder, diagnostic polygon, or silent asset fallback.
- Required-image readiness must require successful decode before mounting playable presentation and support failed-only same-screen retry.

### Asset trial-and-error boundary

Luna may adjust crop, anchor, scale, packing, compression, sprite frame layout, and alpha edge cleanup. Luna may not redraw/reinterpret the selected face, costume, limb count, weapon class, silhouette, or color identity. If a master cannot satisfy runtime readability within those operations, stop for Sol rather than generating a substitute.

### Gate

- Exact master hashes and derivative provenance.
- Structural semantic-frame tests at runtime size.
- Chromium/WebKit state/facing/final-canvas evidence.
- Stage 21-30 objective, boss entrance/defeat, ending, credits, and epilogue reachability.

## 6. Phase 4 — integration, PWA, audio, and release-candidate evidence

### Owned modules

- `app/productionAudio.js` and `app/battleAudioContracts.js` only where new registered routes require entries
- PWA manifest/update helpers only for new optimized runtime hashes
- mobile/dialogue CSS only for locked acceptance failures
- workflow/test helpers required for deterministic evidence

### Exact work

- Do not enter Phase 4 until every required runtime character/stage/mission image is complete, registered once, provenance-linked to its approved source, decode-valid at runtime size, and represented in the required-runtime/PWA manifest.
- Register new runtime assets exactly once in the content/PWA manifests.
- Gate first standalone/PWA gameplay until the complete required-runtime manifest is downloaded, size/hash verified, stored, and durably committed; assert zero required-runtime fetches after gameplay begins.
- For updates fetch changed/missing hashes only, retain the previous committed generation for rollback, and preserve unchanged-hash no-refetch, offline, commit-only recovery, and failed-only retry.
- Preserve boss-music scene ownership and zero double playback.
- Run all focused and full gates, save matrices, browser matrices, simulations, and reviewer-accessible evidence.

### Gate

No release action. After all technical gates are green, do not finalize a Completion Packet. First set `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED` and submit the actual-production twelve-screen set required by Design Lock Section 16. Keep the following Completion Packet evidence as a draft until explicit Producer Visual Approval:

- implementation HEAD/tree and base;
- changed file inventory;
- phase commit list;
- focused/full/build/lint/content/drift/diff results;
- campaign/economy simulation results;
- save/PWA matrix;
- Chromium/WebKit evidence and artifact IDs/digests;
- selected master and runtime derivative hash map;
- known residual risks, clearly separating physical hardware from headless evidence.

Before Producer Visual Approval, `STATUS: READY_FOR_SOL_FINAL_REVIEW` is forbidden. After approval, freeze the final evidence at the approved HEAD/tree, finalize the Completion Packet above, set `STATUS: READY_FOR_SOL_FINAL_REVIEW`, and stop.

## 7. Negative tests that must exist

- 29 or 31 stages; duplicate stage; broken prerequisite; missing event/object; direct result skip.
- Wrong unit/support unlock/cost/cap/stat formula; two supports equipped; barrage/airstrike mixed into support; cooldown/range level scaling; duplicate receipt/gift.
- Any legacy progression copied into `nishijin-campaign-v100`; legacy source mutation/deletion; nonzero fresh starting CAPS; unsafe settings transfer; duplicate entitlement/popup; popup outside a safe non-combat screen.
- Story-undefeated boss exposed in Compendium/Outbreak/Survival; wrong boss unlocks; TAKUYA/TAKUYA-Ω alias; replay-before-defeat; duplicate boss count or reward.
- Wrong boss values, hard boss timer, skipped entrance/defeat, boss music overwritten/silenced/doubled.
- Missing/corrupt/timeout required image becoming playable; placeholder/fallback rendered as production.
- Mutated president not exactly four rooted arms/four hands; TAKUYA-Ω not exactly two arms, orange clothing, wrong weapon, or identity loss.
- Generic minor portrait assigned to a major named speaker.
- Matte/checkerboard residue, opaque background, translation-only semantic frame, wrong facing, ghost/duplicate/fractional alpha.
- Mobile clipping/overflow/collision, portrait overlap outside 12-40 px, unsafe public-host safe-area override.
- PWA gameplay before required-manifest commit, required fetch after gameplay start, refetch of unchanged hashes, partial-update activation/data loss, previous-generation loss, offline failure, or rollback mismatch.

## 8. Rollback granularity

- Keep each phase in normal, reviewable commits so an ordinary revert PR can remove one phase without history rewriting.
- New-namespace/legacy-entitlement code and registry data must be revertable independently from large runtime assets; reverting cannot remove or rewrite `nishijin-campaign-v1` or its recovery material.
- Do not delete old runtime assets or move tags. A failed release candidate remains Draft/unmerged.

## 9. Stop and escalate to Sol

Stop immediately for:

- any Design Lock contradiction or missing product decision;
- changed baseline/selected hash;
- private reference photo appearing in tracked/build/artifact output;
- identity/limb/weapon contract impossible without redesign;
- save/PWA/audio/mobile High or Medium regression;
- missing GitHub authorization or failed branch precondition;
- inability to prove a required runtime condition without weakening a test.

Do not compensate with a new product decision, unapproved placeholder, weaker assertion, extra retry, direct state transition, or release action.

## 10. PRE_IMPLEMENTATION_CLOSURE — standalone execution map

- Closure: `PRE_IMPLEMENTATION_CLOSED`
- `PRODUCT_DECISION_GAPS: 0`
- `LUNA_HANDOFF_READY: YES`
- The selected nine masters and all existing character identities are immutable. There is no task to generate a new character identity, character design, or identity-master candidate, and there is no authority to revisit a Producer-approved design.
- Producing the finite battle sprites/atlases, event portraits, boss entrance/idle/attack/hit/phase/death states, and other `NEW_REQUIRED`/`DERIVE` runtime images in `ASSET_INVENTORY.md` is Luna's required Phase 3 work. A derivative based on the selected/approved identity is not a redesign; a newly invented substitute identity-master candidate is forbidden.

### 10.1 What to encode first

Create one auditable immutable Version 1.0.0 registry (it may be split into pure modules) that is the only runtime source for:

1. the 30 stable Stage IDs and Section 17.5 row values in `DESIGN_LOCK.md`;
2. all 30 `pre/post/first-clear-post` event triplets plus Prologue, Ending, Credits, and Epilogue;
3. the exact 16-unit availability/CAPS/primary-role rows, initial four, level caps/costs/formulas;
4. uniform 1/2/3-star thresholds, first/star/replay receipt patterns, and the first-clear payload list below;
5. the three support rows, two separate vehicle abilities, vehicle upgrades, and nine boss rows;
6. background, objective-state, enemy-pack/boss, VFX, audio-profile, speaker, portrait, and required-asset ownership.

Do not duplicate mutable copies of these values across UI and battle code. Validators must compare every consumer to the canonical registry.

### 10.2 Exact name, formation, and transaction behavior

- Name UI precedes Prologue. It uses `主人公の名前`, the explanation and actions fixed in Design Lock 17.1, NFC -> U+0020/U+3000 trim/collapse -> exact character rejection -> 1-12 grapheme validation, fallback `指揮官`, escaped `{{PLAYER_NAME}}` render-time expansion, current-name replay/log rendering, and the same validated value in save/backup/export/import/recovery/accessibility. Invalid import never overwrites a valid name. Rename cannot alter any ID/read/receipt/reward/unlock state.
- Formation is seven ordered slots and permits duplicate character IDs. Count every accepted deploying/alive player instance and independently targetable player summon; exclude the vehicle/NPC/escort/object/support/enemy. Reserve count + command + cost + cooldown + receipt atomically. Slot eight rejects all of them atomically. Hidden/deploying units still count; defeated removal releases once.
- Event IDs are exactly `v100:event:prologue`, `v100:event:s01..s30:{pre|post|first-clear-post}`, `v100:event:ending`, `v100:event:credits`, `v100:event:epilogue`.
- Flow is name -> Prologue -> Stage 1; then each attempt `pre -> formation -> battle -> result`. Defeat returns without post/progression. Victory persists a pending result, then `post`, then one atomic first-clear/replay finalize and summary. Stage 30 first clear continues Ending -> Credits -> Epilogue -> postgame map. Skip cannot cross battle/result/finalize. Presentation replay grants nothing.
- Persist event cursor after each node. Event reload resumes the next unacknowledged node; battle reload before a pending result returns to formation without retained battle-local debits; pending victory resumes result/post/finalize. Unique receipts and the single-writer boundary own reload/recovery/import/multiple-tab idempotency.
- Stars are universal: victory/vehicle HP > 0 = one; final vehicle ratio >= 0.70 = two; >= 0.90 = three. First clear and newly reached stars grant once; replay grants its unique repeat receipt and only previously unearned star milestones. No time, escort HP, support, formation, or unit-death star condition exists.

### 10.3 Exact first-clear payloads

Every Stage first clear also unlocks the next Stage except Stage 30. `none` below means no additional product unlock beyond CAPS/stars/next Stage.

| Stage | Additional durable first-clear payload |
|---:|---|
| 1 | Nao purchase registration |
| 2 | Mizuchi registration; `support-healing` purchase unlock |
| 3 | TAKUYA discovery, Outbreak entry, Survival pool, replay |
| 4 | Monkey registration |
| 5 | Crazy King registration; level cap 10; Gate Eater discovery/modes/replay |
| 6 | Raider registration; `support-explosive-drum` purchase unlock |
| 7 | Tatara registration |
| 8 | Gantetsu registration |
| 9 | `support-incendiary-drum` purchase unlock |
| 10 | Mayo-chan registration; level cap 15 |
| 11 | MOTHER discovery/modes/replay |
| 12 | Zakimiya registration |
| 13 | none |
| 14 | TKY registration; Ooguchi discovery/modes/replay |
| 15 | level cap 20 |
| 16 | none |
| 17 | MrsChiha registration; Kurome discovery/modes/replay |
| 18 | none |
| 19 | none |
| 20 | Miyamoto Musashi registration; level cap 25; Gairen discovery/modes/replay |
| 21 | none |
| 22 | none |
| 23 | none |
| 24 | Futago discovery/modes/replay |
| 25 | level cap 30; mutated-president discovery/modes/replay |
| 26 | none |
| 27 | none |
| 28 | none |
| 29 | none; Ω activation remains post-story presentation |
| 30 | TAKUYA-Ω discovery/modes/replay; Ending/Credits/Epilogue availability |

Availability rows are purchase registration, not free ownership; only Hachi, Paisen, Kumaverson, and Babayaga start owned. Boss mode entries remain spoiler-absent until their own exact Story receipt.

### 10.4 Canonical speaker/portrait routing by event

Within each row, use the v10 source's exact line order and action beats; the set is an allowlist, not permission to synthesize dialogue. `PLAYER`/`SYSTEM` have no portrait. `...の声`, recorded voice, and `...メッセージ` are offscreen/no portrait. A visible minor human without an identity master uses only the selected neutral r2 silhouette. The RED PANTHER/red-lens captain uses the selected commander identity. Stage 13 `知らない声` has no portrait until Segawa is named.

| Event | Allowed narrative speakers/owners |
|---|---|
| Prologue | Kumaverson, Paisen, Babayaga; minor man/voice -> shared silhouette/no-portrait rule |
| S01 | Paisen, Kumaverson, Babayaga, Ikura; woman's voice is offscreen |
| S02 | Ikura, Paisen, Babayaga, Kumaverson; shelter staff/Ando -> shared silhouette |
| S03 | Paisen, Kumaverson, Ikura, Babayaga; recorded woman offscreen; red-lens captain/operative -> Panther commander/role master |
| S04 | Ikura, Paisen, Kumaverson, Babayaga; station staff/female worker -> shared silhouette, voice offscreen |
| S05 | Paisen, Ikura, Kumaverson, Babayaga; maintenance staff -> shared silhouette, voice offscreen |
| S06 | Ikura, Babayaga, Paisen, Kumaverson; MrsChiha message uses her identity only when visually shown; rescue voice offscreen |
| S07 | Paisen, Ikura, Kumaverson; doctor -> shared silhouette |
| S08 | Paisen, Kumaverson, Ikura; nurse -> shared silhouette, voice offscreen |
| S09 | Ikura, Paisen, Kumaverson, Babayaga |
| S10 | Paisen, Ikura, Kumaverson, Babayaga |
| S11 | Paisen, Kumaverson, Ikura, Babayaga; researcher -> shared silhouette, voices offscreen |
| S12 | Zakimiya, Kumaverson, Babayaga, Ikura; recovery team -> shared silhouette |
| S13 | Ikura, Paisen, Kumaverson, Babayaga, Zakimiya, Segawa; unknown/rescue voices offscreen, Segawa portrait begins at reveal |
| S14 | TKY, Kumaverson, Paisen, Ikura, Babayaga; evacuee -> shared silhouette |
| S15 | Ikura, Segawa, TKY, Paisen, Babayaga; MrsChiha voice offscreen |
| S16 | Ikura, TKY, Babayaga, Segawa, Paisen; MrsChiha voice offscreen |
| S17 | MrsChiha, Babayaga, Ikura, Zakimiya |
| S18 | Ikura, Zakimiya, Kumaverson, human Mugarian president, Paisen, MrsChiha, Babayaga, Segawa |
| S19 | human Mugarian president, Zakimiya, MrsChiha, Segawa, Paisen, Kumaverson, Ikura |
| S20 | Ikura, Kumaverson, Segawa, TKY, Babayaga, Paisen, Crazy King, MrsChiha, Zakimiya, Miyamoto Musashi |
| S21 | Panther commander, Kumaverson, TKY, Miyamoto, MrsChiha, Ikura, Babayaga, Zakimiya, Paisen, Segawa |
| S22 | Zakimiya, Ikura, MrsChiha, Kumaverson, Babayaga, Panther commander; Zakimiya's wife -> shared silhouette |
| S23 | MrsChiha, Paisen, Kumaverson, Ikura, Babayaga, Panther commander, Segawa |
| S24 | human Mugarian president, MrsChiha, Kumaverson, Zakimiya, Ikura, Segawa, TKY |
| S25 | human then mutated Mugarian president, Zakimiya, Kumaverson, MrsChiha, Segawa, Ikura, Paisen; researcher voice offscreen |
| S26 | Ikura, Paisen, Kumaverson, MrsChiha, Segawa; researcher voice offscreen |
| S27 | Ikura, MrsChiha, Panther commander, Paisen, Segawa, Kumaverson, Zakimiya, Babayaga |
| S28 | Ikura, MrsChiha, Paisen, Segawa, Zakimiya, TKY, Miyamoto, Kumaverson, Babayaga |
| S29 | Segawa, Kumaverson, MrsChiha, Ikura, Paisen |
| S30 | Paisen, Babayaga, Segawa, Kumaverson, Zakimiya, TKY, MrsChiha, Miyamoto, Ikura; Ikura/researcher voice offscreen; TAKUYA-Ω owns boss identity |
| Ending | Miyamoto, doctor/researcher/female station worker -> shared silhouette, Kumaverson, Paisen, Ikura, Babayaga, MrsChiha |
| Credits | no dialogue/portrait/BGM; exact visual montage, inheriting only each reused source background route's existing ambience (otherwise silence) |
| Epilogue | Kumaverson, Ikura, Paisen, TKY, MrsChiha, Zakimiya, Babayaga; Zakimiya's wife -> shared silhouette; current `{{PLAYER_NAME}}` in canonical lines |

Every major speaker not marked minor/offscreen resolves to its approved existing portrait or the exact selected master derivative. Unknown speaker, empty text, raw token, missing portrait, major-to-silhouette substitution, and speaker/portrait mismatch are hard failures.

### 10.5 Stage presentation and required-runtime ownership

- Implement every Design Lock 17.5 row literally: exact stable Stage ID, background/reuse/derivative boundary, authored objective states, listed enemy pack/boss/adds, mission VFX family, story audio profile, and first-clear payload. Do not substitute current 0.9.x labels where the locked player-facing Stage/object differs; retain historical internal IDs where the row intentionally does so.
- Stage 29 is a real battle: six elite Panther waves and both the overseas activation line and source stock must be destroyed. TAKUYA-Ω activation occurs only in its `post`. Stage 30 pre-story removes the two Panther guards before combat; the combat roster is Ω plus its two A-pack add waves and contains no story dialogue.
- Register all reachable background, portrait, mission-object state, enemy/boss state, VFX, audio, UI/font, Ending/Credits/Epilogue assets as required before first-install gameplay. Decode/hash/size/store/manifest-commit must finish before title/base/map/story/battle simulation mounts. Required requests after gate-open are exactly zero. Update fetches only changed/missing hashes and retains the prior committed generation.
- Browser acceptance is Chromium/WebKit 844x340, 844x390, and 1280x720 for name/keyboard, seven-slot formation, event/log/replay, battle/result/summary, Ending/Credits/Epilogue, and PWA gate/retry. Preserve public safe-area values, 44x44 controls, battlefield readability, and 12-40 px portrait overlap.

### 10.6 Existing playable runtime sprite inventory

- Closure: `RUNTIME_SPRITE_SCOPE_CLOSED`. `PRODUCT_DESIGN_CHANGE: 0`.
- The required playable atlas states are exactly `idle`, `walk-a`, `walk-b`, `attack-a`, `attack-b`, `hit`, and `death`, in both directions. Registered semantic states must remain structurally distinguishable. Ability presentation reuses the locked attack/active/recovery sequence plus VFX/audio unless the asset inventory explicitly requires another cell.

| Character | Kind | Status | Approved identity source -> current runtime | Required work |
| --- | --- | --- | --- | --- |
| Hachi | `scout` | `REUSE_COMPLETE` | `hachi-base-r2.png` -> `scout-battle-v1.png` | none |
| Paisen | `brawler` | `DERIVE_RUNTIME_REQUIRED` | `brawler-portrait-v2.webp` -> `brawler-battle-gutter-v1.png` | Phase 2: derive all seven states in both directions; make `hit` and `death` structurally distinct |
| Kumaverson | `kumaverson` | `REUSE_COMPLETE` | `kumaverson-portrait-v2.webp` -> `kumaverson-battle-v1.png` | none |
| Babayaga | `babayaga` | `REUSE_COMPLETE` | `babayaga-portrait-v2.webp` -> `babayaga-battle-v1.png` | none |
| Nao | `medic` | `REUSE_COMPLETE` | `nao-base-r1.png` -> `medic-battle-v1.png` | none |
| Mizuchi | `ranger` | `REUSE_COMPLETE` | `mizuchi-base-r3.png` -> `ranger-battle-v1.png` | none |
| Monkey | `engineer` | `REUSE_COMPLETE` | `monkey-base-r11.png` -> `engineer-battle-v1.png` | none; superseded V080 identity is forbidden |
| Crazy King | `crazy-king` | `REUSE_COMPLETE` | `crazy-king-portrait-v2.webp` -> `crazy-king-battle-v1.png` | none |
| Raider | `gunner` | `REUSE_COMPLETE` | `raider-base-r10.png` -> `gunner-battle-v1.png` | none |
| Tatara | `brute` | `REUSE_COMPLETE` | `tatara-base-r8.png` -> `brute-battle-v1.png` | none |
| Gantetsu | `guardian` | `REUSE_COMPLETE` | `gantetsu-base-r7.png` -> `guardian-battle-v1.png` | none |
| Mayo-chan | `mayo-chan` / `mayo-chan-feral` | `REUSE_COMPLETE` | `mayo-chan-identity-master-r1.png` -> normal + feral battle atlases | none |
| Zakimiya | `zakimiya` | `REUSE_COMPLETE` | `zakimiya-identity-master-r1.png` -> `zakimiya-battle-r1.png` | none |
| TKY | `tky` | `REUSE_COMPLETE` | `tky-identity-master-r1.png` -> `tky-battle-r1.png` | none |
| MrsChiha | `mrs-chiha` | `REUSE_COMPLETE` | `mrs-chiha-identity-master-r1.png` -> `mrs-chiha-battle-r1.png` | none |
| Miyamoto Musashi | `miyamoto-musashi` | `REUSE_COMPLETE` | `miyamoto-musashi-identity-master-r1.png` -> `miyamoto-musashi-battle-r1.png` | none |

- `NEW_RUNTIME_SPRITE_REQUIRED`: none among the 16 playable units.
- Phase 2 target: Paisen only, completed before Phase 3 begins.
- Phase 3 targets: only the finite `NEW_REQUIRED`/`DERIVE` entries in `ASSET_INVENTORY.md` for Stage 21-30 enemies/bosses, event portraits, stage art, mission objects, and their semantic states.
- Phase 4 may begin only after all required runtime character sprites and other required runtime images satisfy the completion/registration/provenance/decode/manifest gate above.

### 10.7 What Luna may and may not decide

Luna may decide only implementation mechanics: file/module decomposition, immutable registry representation, conformance-equivalent grapheme helper, serialized transaction helper, sprite sheet/discrete-frame packing, compression, crop/anchor/scale/alpha cleanup, cache batching, deterministic QA helper structure, and spawn time/lane distribution inside a row's fixed enemy roster and wave/group count.

Luna must not change character/master identity, crop into a redesign, generate a candidate, choose a different Stage/event/object/enemy/boss, alter any number/role/unlock/cost/star/reward/receipt, add a branch, change portrait ownership, choose different music, weaken readiness/PWA/save/mobile contracts, migrate legacy progression, or turn a failed acceptance into optional evidence.

Return to Sol only for: (1) a true contradiction among locked sources; (2) a selected immutable asset that cannot yield the required runtime derivative within crop/pack/alpha operations; (3) a High/Medium regression; or (4) a technically impossible acceptance contract. Do not return because wording, role, unlock timing, Stage sequence, speaker/portrait mapping, receipt/recovery behavior, or asset owner is unspecified: each is fixed above and in the Design Lock closure.

## 11. Revision r4 — Phase G WebKit battle-extra execution packet

This section supersedes the r3 Stage 6-only execution packet. Job `96694829714` failed `stage06-spitter-seal`; later job `96726761976` passed Stage 6 and failed `stage24-panther-commander` at `boss frontline unit 4 never entered cooldown from the ready state`. Both failures ended with `failureState: null` and empty console/page/request/HTTP arrays. The second run stopped before Stage 25. Therefore all three existing WebKit battle-extra contracts are one finite diagnostic and regression unit; their root causes must still be proven independently.

`ASSET_INVENTORY.md`, `PROVENANCE.md`, and runtime provenance retain their r2 asset revision intentionally: r4 changes no selected asset, hash, provenance, identity, runtime derivative ownership, gameplay, balance, or AI.

Execute Design Lock Section 18 in this order:

1. Re-fetch PR #171 and stop if its head is not the handed-off head. Add the Section 18.3 common checkpoint/lifecycle recorder before changing wait or deployment behavior.
2. Run one isolated diagnostic for each variant: `stage06-spitter-seal`, `stage24-panther-commander`, and `stage25-president`. Persist all diagnostics even when one variant fails.
3. Assign a Section 18.4 root-cause class to each variant. If any is `PRODUCT_RUNTIME`, remains unclassified, or the three proven causes require more than one coherent QA-harness correction set, stop and return to Sol.
4. Make exactly one coherent correction set in the Section 18.2 allowlist. Do not patch and rerun variant-by-variant.
5. Run the ordered trio Stage 6 -> Stage 24 -> Stage 25 three consecutive times locally. Each sequence uses a fresh WebKit browser process and each contract a fresh context; any failure ends the sequence without retry and returns to Sol.
6. After ordered-trio local 3/3 only, push the diagnostic commit with only CI's `v100-phase-g-production` job temporarily bound to three fresh ordered-trio sequences and a focused artifact. Do not disable other jobs. Any focused failure returns to Sol.
7. After ordered-trio remote 3/3 only, run local full Phase G and require 54/54 plus validator success, then run every full regression gate named in Section 18.5.
8. After every local full gate is green only, restore `v100-phase-g-production` to the unfiltered 54-capture command and push once for full remote PR CI/Phase G. A new failure in the same gate returns to Sol; do not apply a second correction.
9. Complete remote green transitions to the Producer Visual Checkpoint, not directly to a Completion Packet or Sol final review.

Keep `V100_PHASE_G_ONLY_VARIANT` for each isolated diagnostic. Before correction, run exactly one fresh process per variant:

```powershell
$env:V100_PHASE_G_ONLY='battle-extra'
Remove-Item Env:V100_PHASE_G_ONLY_ENGINE -ErrorAction SilentlyContinue
$diagnosticFailures=@()
foreach ($variant in @('stage06-spitter-seal', 'stage24-panther-commander', 'stage25-president')) {
  $env:V100_PHASE_G_ONLY_VARIANT=$variant
  $env:V100_PHASE_G_EVIDENCE_DIR="outputs/v100-phase-g-r4-diagnostic-$variant"
  npm.cmd run qa:v100-phase-g
  if ($LASTEXITCODE -ne 0) { $diagnosticFailures += $variant }
}
$diagnosticFailures
```

Persist the diagnostic even when a command exits nonzero, then continue only to collect the remaining isolated diagnostics; do not correct behavior between variants. Add one bounded QA-only selector, `V100_PHASE_G_ONLY_ENGINE=webkit`, so an ordered focused sequence can execute exactly the three existing WebKit battle-extra contracts without changing their mapping or evidence ownership. The post-correction local acceptance command is:

```powershell
$env:V100_PHASE_G_ONLY='battle-extra'
$env:V100_PHASE_G_ONLY_ENGINE='webkit'
Remove-Item Env:V100_PHASE_G_ONLY_VARIANT -ErrorAction SilentlyContinue
1..3 | ForEach-Object {
  $env:V100_PHASE_G_EVIDENCE_DIR="outputs/v100-phase-g-r4-local-sequence-$_"
  npm.cmd run qa:v100-phase-g
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Before the Producer checkpoint, prepare: exact base/head/tree; all three isolated diagnostic artifacts and root-cause classes; the single coherent correction diff; changed-file list; ordered-trio local 3/3 run identifiers; ordered-trio remote 3/3 job/artifact; local 54/54 report/manifest/runtime evidence; full local gate results; full remote run/job/artifact; zero console/page/request/HTTP failures; and an explicit statement that no `app/**`, gameplay, balance, AI, product behavior, release state, or evidence threshold changed.

After every Section 18.5 local and remote technical gate is satisfied, set `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED` and submit these actual-production screens: (1) `TITLE`, (2) `名前入力`, (3) `作戦地図`, (4) `通常Stage選択`, (5) `Boss Stage選択`, (6) `出撃編成`, (7) `隊員`, (8) `出撃装備`, (9) `装甲車両強化`, (10) `代表event`, (11) `通常battle HUD`, and (12) `戦果`.

Producer Visual Approval is a hard gate. Before approval, do not finalize the Completion Packet and do not set `STATUS: READY_FOR_SOL_FINAL_REVIEW`. After approval, freeze final evidence at the approved HEAD/tree, finalize the Completion Packet, set `STATUS: READY_FOR_SOL_FINAL_REVIEW`, and stop for Sol final review. If a Section 18 stop condition occurs, use `STATUS: BLOCKED_RETURN_TO_SOL` and stop. No Ready conversion, merge, tag, Release, formal Pages deployment, or Issue closure is authorized.

### 11.1 SOL remediation cursor — LF-only repository hygiene

The cursor fields in this subsection are retained as the original r4 byte-audit record and are superseded for execution by Section 12.1. Section 11.1 remains authoritative only for the exact LF byte/semantic acceptance commands referenced by Section 12.2.

This packet does not revise r4. CI run `32475729057` stopped before the remote focused Phase G job because PR Verify job `96751598547` failed its exact-base/head `git diff --check`. The audited commit changes only `.github/workflows/ci.yml`, `scripts/v100-phase-g-production-matrix.mjs`, and the new `tests/v100-phase-g-checkpoint.test.mjs`; `app/**` is unchanged. The first two Git blobs contain mixed CRLF/LF, while the checkpoint test Git blob is LF-only. This is `REPO_HYGIENE / REMEDIATION_LOCAL`, separate from the one coherent r4 harness correction.

Execution cursor:

- `LAST_AUDITED_HEAD`: `f7149732fadec5142d0e475f201984dd5a48e217`
- `FAILED_GATE`: run `32475729057` / PR Verify job `96751598547` / `Check patch whitespace`
- `LAST_GREEN_GATE`: isolated Stage 6／24／25 diagnostics complete; local ordered trio Stage 6 -> Stage 24 -> Stage 25 passed 3/3, with `screenshot-saved` as the last checkpoint and diagnostic errors 0. This is local-only and not final-freeze evidence
- `REMEDIATION_CLASS`: `REPO_HYGIENE / REMEDIATION_LOCAL`
- `RESUME_FROM`: LF remediation semantic-diff 0 -> PR Verify -> automated remote ordered trio 3/3
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for this exact LF-only packet; no product or design judgment is delegated

Before editing, re-fetch PR #171. Treat the field above as a stable audit cursor, not as the mutable live HEAD. Stop if the current PR history does not contain `LAST_AUDITED_HEAD`, or if another actor changed any target after this packet commit.

The complete allowed change is:

1. Normalize only `.github/workflows/ci.yml` and `scripts/v100-phase-g-production-matrix.mjs` from their mixed EOL state to LF. Do not change text, ordering, indentation, trailing whitespace, executable mode, or final newline.
2. Preserve the existing byte contracts: `.github/workflows/ci.yml` keeps its UTF-8 BOM and final LF; `scripts/v100-phase-g-production-matrix.mjs` keeps no BOM and a final LF; `tests/v100-phase-g-checkpoint.test.mjs` keeps no BOM, 20 LF, CRLF 0, and its final LF.
3. Add only these exact path contracts to the root `.gitattributes`; do not add wildcard rules and do not renormalize the repository:

```gitattributes
.github/workflows/ci.yml text eol=lf
scripts/v100-phase-g-production-matrix.mjs text eol=lf
tests/v100-phase-g-checkpoint.test.mjs text eol=lf
```

4. Stage or renormalize only those three paths plus `.gitattributes`. A repository-wide `git add --renormalize .` or unrelated cleanup is forbidden.

Byte and semantic acceptance before commit:

- normalized `.github/workflows/ci.yml` SHA-256 is exactly `93bd86855702b5a4e7333ff860a4410fdc4e772b256a9d2a3730fac8eb40a8da`, with BOM present, CRLF 0, LF 592, lone CR 0, and final LF present;
- normalized `scripts/v100-phase-g-production-matrix.mjs` SHA-256 is exactly `3d8cc8a30674ea5261fd516685ab116c398f8c3e30e8f1f882e7e4b32f1ad6f2`, with BOM absent, CRLF 0, LF 2328, lone CR 0, and final LF present;
- `tests/v100-phase-g-checkpoint.test.mjs` remains byte-identical at SHA-256 `6001a58e541ff94c7e9819eb8b6bc0eb5a8646bf94275caee816d0a9eace22bd`;
- `git diff --ignore-space-at-eol --exit-code f7149732fadec5142d0e475f201984dd5a48e217 -- .github/workflows/ci.yml scripts/v100-phase-g-production-matrix.mjs tests/v100-phase-g-checkpoint.test.mjs` passes;
- `git check-attr text eol -- .github/workflows/ci.yml scripts/v100-phase-g-production-matrix.mjs tests/v100-phase-g-checkpoint.test.mjs` reports `text: set` and `eol: lf` for all three;
- the `.gitattributes` diff is only the three exact entries above;
- CI-equivalent `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD` passes;
- changed files for this LF remediation are exactly the two normalized files and `.gitattributes`; the checkpoint test remains unchanged from `LAST_AUDITED_HEAD`.

Do not rerun the already-complete isolated diagnostics or local ordered trio merely because of this EOL-only correction. After the semantic-diff and byte checks pass, commit and push normally, then resume exactly at PR Verify. PR Verify success unlocks the automated remote ordered trio already bound in `v100-phase-g-production`.

If any remote ordered-trio sequence fails, set `STATUS: BLOCKED_RETURN_TO_SOL` and stop without another fix. If the remote ordered trio passes 3/3, continue with local full Phase G 54/54 plus validator and all Section 18.5 full regressions, then restore the unfiltered 54-capture workflow and run unfiltered remote CI／Phase G. No local or prior artifact substitutes for attempt-specific remote evidence. Any unrelated required-CI failure may be recorded, but it grants no repair authority under this LF-only packet; complete remote green remains mandatory.

After complete remote green, transition to `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`. The release tail is fixed as: Producer Visual Approval -> final evidence freeze -> `READY_FOR_SOL_FINAL_REVIEW` -> SOL FINAL REVIEW `APPROVE` -> `PRODUCER_FINAL_ACCEPTANCE` -> only after explicit Producer approval, integration／tag／GitHub Release／official Pages -> post-release QA at the published SHA -> `PROJECT_STATE` update and closure. No earlier release-state mutation is authorized.

The generic Completion Packet path in `AGENTS.md` and `CODEX_TWO_THREAD_WORKFLOW.md` remains governance debt. For Version 1.0.0, the current Version-specific Design Lock's Producer checkpoint and release tail take precedence. Do not edit generic governance on the active implementation branch; normalize it in a separate post-V1 governance change.

## 12. Revision r5 — final execution-loop handoff

Revision r5 keeps every r4 Phase G diagnostic, correction, acceptance, evidence, and Producer intent guard unchanged. It makes Design Lock Section 19 the sole Version 1.0.0 execution/release state machine. Issue #172 becomes its execution ledger only after the r5 Design commit is published. The earlier `V100-LOOP-LOCK-001` comment and pre-r5 Issue body are superseded audit inputs, not implementation authority. `PRODUCT_DESIGN_CHANGE: 0`.

### 12.1 Current execution cursor

- `LAST_AUDITED_HEAD`: `c57bd2690ef1f50e92e99736d59dab86c4af71f9`
- `LAST_AUDITED_TREE`: `65bb817fc3b73526619e51ac4712094f7a1834e6`
- `LF_SEMANTIC_BASE`: `f7149732fadec5142d0e475f201984dd5a48e217`
- `FAILED_GATE`: runs `32475729057` and `32478283607`; PR Verify jobs `96751598547` and `96759071225`; `Check patch whitespace`; V1 Phase G skipped
- `LAST_GREEN_GATE`: isolated Stage 6/24/25 diagnostics complete; local ordered trio Stage 6 -> Stage 24 -> Stage 25 passed 3/3; local-only and not final-freeze evidence
- `REMEDIATION_CLASS`: `REPO_HYGIENE / REMEDIATION_LOCAL`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION`
- `RESUME_FROM`: exact-file LF remediation with semantic diff 0 -> push -> PR Verify green -> same focused run's automated remote ordered trio 3/3 -> every required job in that focused run terminal green

Before editing, re-fetch PR #171. Require its live history to contain `LAST_AUDITED_HEAD` and the r5 Design packet commit recorded in Issue #172/PR #171. If the branch, base, target files, Design revision, PR state, or another required precondition has changed, return `STATUS: BLOCKED_RETURN_TO_SOL` without editing. The live HEAD must be read from GitHub; no body field is a live-ref substitute.

### 12.2 Exact authorized action

Execute the LF-only byte contract already specified in Section 11.1, with no semantic change:

1. normalize only `.github/workflows/ci.yml` and `scripts/v100-phase-g-production-matrix.mjs` to LF;
2. preserve the existing UTF-8 BOM of `.github/workflows/ci.yml` and do not add a BOM to the script;
3. add only these `.gitattributes` entries: `.github/workflows/ci.yml text eol=lf`, `scripts/v100-phase-g-production-matrix.mjs text eol=lf`, and `tests/v100-phase-g-checkpoint.test.mjs text eol=lf`;
4. keep `tests/v100-phase-g-checkpoint.test.mjs` byte-identical at SHA-256 `6001a58e541ff94c7e9819eb8b6bc0eb5a8646bf94275caee816d0a9eace22bd`;
5. require the two post-normalization SHA-256 values, BOM state, LF/CRLF counts, `.gitattributes` exact diff, Section 11.1 semantic-zero command, and CI-equivalent `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD` all to pass;
6. changed files for this remediation are exactly the two normalized files and `.gitattributes`.

Forbidden: repository-wide renormalization; `app/**`; test logic; workflow meaning; Phase G behavior; gameplay, balance, AI, save/PWA, product assets/audio; evidence weakening; formatting cleanup outside the three paths; amend, rebase, force push, direct-main push, Ready, merge, tag, Release, Pages, or Issue closure.

Do not rerun the completed isolated diagnostics or local ordered trio solely for the EOL-only change. After local byte/semantic acceptance, commit and push normally, then resume at PR Verify.

### 12.3 Exact promotion and stop rules

After the LF push:

1. commit/push the accepted LF-only change normally and observe the resulting focused remote workflow run;
2. require PR Verify green; it unlocks the already-bound automated remote ordered trio in that same run. Require three complete Stage 6 -> Stage 24 -> Stage 25 sequences with no in-sequence retry, then wait for the entire focused run to become terminal before local promotion;
3. any required job failure or unexpected skip in that terminal run, including any trio failure, returns `STATUS: BLOCKED_RETURN_TO_SOL`; record HEAD/tree, run/job/artifact, failed gate, last green gate, and diagnostics, then stop without a fix or rerun;
4. only terminal focused-run green plus remote trio 3/3 permits local unfiltered Phase G 54/54 plus validator and every Section 18.5 full regression;
5. only after local full green, restore unfiltered Phase G, prove the focused binding is absent, push normally, and require one new complete unfiltered remote CI/Phase G run;
6. only complete terminal green transitions to `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED` with the exact Section 16 twelve-screen set.

Before Producer Visual Approval, do not finalize a Completion Packet or set `READY_FOR_SOL_FINAL_REVIEW`. After explicit approval, record `APPROVED_HEAD`, `APPROVED_TREE`, all twelve evidence IDs, and approval evidence; create no commit; finalize the packet in Issue/PR/artifacts; verify live HEAD/tree are exact; then set `READY_FOR_SOL_FINAL_REVIEW` and return to the original Sol thread.

Any branch commit after Visual Approval invalidates both the freeze and Visual Approval and returns to Sol; all candidate gates and the checkpoint repeat. A same-HEAD/tree evidence-reference completion may return through `LUNA_IMPLEMENTATION` only when Sol explicitly classifies it as `EVIDENCE_PACKET_INCOMPLETE`. `LUNA_VALIDATION` remains reserved for a Sol-authored remediation commit. Luna never classifies a failure, finding, Producer rejection, regression range, approval validity, or release state.

### 12.4 Release boundary

Luna stops at `READY_FOR_SOL_FINAL_REVIEW`. The remaining authoritative route is Design Lock Sections 19.6-19.10:

`SOL_FINAL_REVIEW_APPROVED` -> `PRODUCER_FINAL_ACCEPTANCE` -> explicit Producer approval -> sequential #169/#170/#171 integration with fresh checks and exact tree verification -> PR #171 merge-result `RELEASE_SHA` -> annotated `v1.0.0` -> matching GitHub Release -> explicit official Pages release request using open Issue #172 -> published-SHA post-release QA -> `PROJECT_STATE` update and closure.

Any Sol finding or Producer rejection returns through Sol's classification. After successful official deployment, a new explicit `ROLE_LOCK: LUNA_VALIDATION` handoff may authorize only Design Lock Section 19.10 published-SHA QA. No Luna release, integration, rollback, redeploy, post-release repair, or closure judgment is delegated.

## 13. Revision r6 — required-CI diagnostic-only handoff

Run this section only. It supersedes Section 12's LF action because the LF contract is now closed. Sections 18-19, all product requirements, and every release boundary remain unchanged. `PRODUCT_DESIGN_CHANGE: 0`.

### 13.1 Execution cursor

- `LAST_AUDITED_HEAD`: `21b3a2076b5ff580189c9cfe69fb4dc30193a45d`
- `LAST_AUDITED_TREE`: `1f741a0cb0f202690c7f96d4578c3f26ef470a39`
- `FAILED_GATE`: run `32487312283`; PR Verify `96786672078` Chromium final-canvas; Stage 3 final-candidate `96792165248`; dependent Phase G `96789049082` skipped
- `LAST_GREEN_GATE`: LF byte/BOM/EOL/semantic-zero and whitespace checks passed; pre-failure PR Verify steps through Chromium canonical HUD, WebKit enemy/hosted jobs, Stage 3 entrance-candidate, and exact-base final control passed; none is final-freeze evidence
- `REMEDIATION_CLASS`: `REQUIRED_CI_PRODUCT_RUNTIME_DIAGNOSTIC / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for diagnostics only
- `RESUME_FROM`: additive observations -> focused contract/lint/build/diff checks -> one normal diagnostic push -> wait for that one CI run terminal -> `BLOCKED_RETURN_TO_SOL_DIAGNOSTIC_COMPLETE`

Before editing, re-fetch PR #171. Its open Draft branch must still contain `LAST_AUDITED_HEAD` and the r6 packet commit recorded in Issue #172 and the PR body. Re-fetch the actual live HEAD/tree rather than copying either document field. Any branch/base/target/revision/PR-state drift returns to Sol without editing.

### 13.2 Exact authorized work

Add observations only in these existing owners:

1. `scripts/v099-final-remediation-browser-smoke.mjs`: record the bounded `setupTrace` and, after readiness, `deploymentTrace` defined by Design Lock 20.3 from `enterLegacyQaBattle`, `openBattlePage`, `pauseAtDeploymentCheckpoint`, `queueAndPauseAtFirstDeploymentFrame`, `runDeploymentCase`, and failure serialization. Preserve the page/trace/screenshot when `openBattlePage` throws before returning. Keep all six viewports, eight unit families, six checkpoints, waits, assertions, screenshots, and contact sheets unchanged.
2. `scripts/p5-browser-smoke.mjs`: record the Node-owned one-second `finalCutTrace` defined by Design Lock 20.3 around `auditTakuyaFinalAudio`. Preserve the current predicate, 60-second deadline, final-base fixture, story/audio assertions, and candidate/base distinction.
3. `scripts/run-stage3-audio-bounded.mjs`: only preserve that child trace in `bounded-summary.json` if the existing serialization omits it. Do not broaden `isRetryableTargetClosed` or add an attempt.
4. Add only schema/no-weakening checks to `tests/v0995-runtime-evidence-contract.test.mjs`, `tests/stage3-final-bounded.test.mjs`, and `tests/ci-contract.test.mjs`.

Forbidden: `.github/workflows/ci.yml`, `.gitattributes`, Phase G files, every `app/**` and `public/**` path, package files, product data/assets/audio, timeout/retry/predicate/assertion/axis/unit/case/artifact changes, gameplay/balance/AI/save/PWA/VFX changes, and any correction inferred from the trace.

### 13.3 Validation, push, and mandatory return

Run exactly:

1. `node --test tests/v0995-runtime-evidence-contract.test.mjs tests/stage3-final-bounded.test.mjs tests/ci-contract.test.mjs`;
2. `npm run lint`;
3. `npm run build`;
4. `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD`;
5. an exact diff audit proving the allowlist and no acceptance/retry/timing semantic change.

Commit once and push normally once. Do not manually dispatch, retry, or rerun anything. Wait for the resulting automatic CI run to become terminal. Record HEAD/tree, run/job/artifact IDs, all six Chromium deployment axis results, the three Stage 3 matrix results, PR Verify, and Phase G state in one PR comment.

Then return exactly:

`STATUS: BLOCKED_RETURN_TO_SOL_DIAGNOSTIC_COMPLETE`

Sol, not Luna, classifies each trace and writes any correction packet. Do not make a second commit, retry, rerun, Phase G run, local full regression, or product correction. A pre-push acceptance failure or missing out-of-allowlist observation returns `STATUS: BLOCKED_RETURN_TO_SOL` without push. Ready, merge, tag, Release, Pages, Producer checkpoint, Completion Packet, and Issue closure are prohibited.

### 13.4 Short Luna handoff

Re-fetch PR #171; execute Design Lock Section 20 / Handoff Section 13 only. Add bounded failure traces in the three authorized QA scripts and three authorized contract tests, preserving every predicate/deadline/retry/assertion/axis. Pass the exact local checks, make one normal diagnostic commit/push, wait for that one CI run to finish, record its immutable evidence, and return `BLOCKED_RETURN_TO_SOL_DIAGNOSTIC_COMPLETE`. No `app/**`, correction, retry/rerun, Phase G, or release action.

## 14. Revision r7 — bounded EOL and final-cut wait correction

Run this section only. Section 13 diagnostics are complete and must not be reimplemented. Sections 18-21 of the Design Lock, the r5 execution/release loop, and every product requirement remain unchanged. `PRODUCT_DESIGN_CHANGE: 0`.

### 14.1 Execution cursor and fixed classifications

- `LAST_AUDITED_HEAD`: `bad1578b45171b476a8989c3180433ba14f973b7`
- `LAST_AUDITED_TREE`: `fded05d05fd216d512cbec8a17d647a59cf1dd04`
- `FAILED_GATE`: run `32496778334`; PR Verify `96817031062` five-file mixed-EOL whitespace; Stage 3 final-base `96823095853` predicate satisfied in trace but page-owned waiter unresolved before WebKit crash; Phase G `96817216110` skipped; Chromium deployment diagnostic not reached
- `LAST_GREEN_GATE`: local r6 focused acceptance; six WebKit enemy-runtime shards, hosted evidence, Stage 3 entrance-candidate, and Stage 3 final-candidate in run `32496778334`; controls only, not final-freeze evidence
- whitespace class: `REPO_HYGIENE / FIVE_FILE_MIXED_EOL / REMEDIATION_LOCAL`
- Stage 3 class: `QA_HARNESS_PREDICATE_ORCHESTRATION / REMEDIATION_LOCAL`
- `REMEDIATION_CLASS`: `DUAL_LOCAL_REMEDIATION / REPO_HYGIENE + QA_HARNESS_PREDICATE_ORCHESTRATION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Design Lock Section 21 only
- `RESUME_FROM`: five-file LF/BOM normalization + exact LF attributes + Node-owned final-cut predicate wait -> focused local checks -> one normal correction push -> wait for that one automatic CI run terminal -> `BLOCKED_RETURN_TO_SOL_R7_REMOTE_COMPLETE`

Before editing, re-fetch PR #171. It must remain open/Draft on `codex/v1.0.0-luna-implementation`, based on `6acf87fd235fb55d3d5e3ec1f8687b57a06dc769`, and its history must contain `LAST_AUDITED_HEAD` plus the r7 packet recorded in Issue #172 and the PR body. Any drift returns `STATUS: BLOCKED_RETURN_TO_SOL` without editing.

### 14.2 Exact authorized work

Change exactly six files:

1. `.gitattributes`: add only the five exact `text eol=lf` entries listed in Design Lock 21.3; no wildcard or repository-wide normalization.
2. Normalize `scripts/p5-browser-smoke.mjs`, `scripts/v099-final-remediation-browser-smoke.mjs`, `tests/ci-contract.test.mjs`, `tests/stage3-final-bounded.test.mjs`, and `tests/v0995-runtime-evidence-contract.test.mjs` to LF. Preserve BOM only in `ci-contract` and `stage3-final-bounded`; the other three remain no-BOM.
3. Keep `scripts/v099-final-remediation-browser-smoke.mjs` and `tests/v0995-runtime-evidence-contract.test.mjs` semantic-identical to `LAST_AUDITED_HEAD` after newline normalization.
4. In `scripts/p5-browser-smoke.mjs`, replace only the final-cut page-owned waiter with `waitForFinalCutPredicateFromNode`: same three predicate components, non-overlapping Node-owned `page.evaluate`, 50 ms attempt cadence, unchanged 60,000 ms deadline, explicit component evidence, `TimeoutError` at deadline, and exact close/crash propagation before a match. Keep `finalCutTrace` unchanged.
5. In `tests/stage3-final-bounded.test.mjs`, add the exact Node-wait/no-weakening source contract. In `tests/ci-contract.test.mjs`, assert the five LF attributes.

Forbidden: every other file, especially `.github/workflows/ci.yml`, `scripts/run-stage3-audio-bounded.mjs`, Phase G, `app/**`, `public/**`, packages, product data/assets/audio, and docs. Do not change timeout, retry count, predicate meaning, assertions, axes, units, cases, artifacts, gameplay, balance, AI, story, audio, VFX, save, or PWA behavior.

### 14.3 Validation, push, and mandatory return

Run the exact byte/BOM/semantic checks in Design Lock 21.4, then:

1. `node --test tests/v0995-runtime-evidence-contract.test.mjs tests/stage3-final-bounded.test.mjs tests/ci-contract.test.mjs`;
2. `npm run lint`;
3. `npm run build`;
4. `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD`;
5. exact six-file allowlist and no-weakening audit.

The automatic run triggered by Sol's docs/test-only r7 packet commit is metadata-only. Record its URL/status at preflight, but do not rerun it or use it as correction/promotion evidence. Only the later run whose `headSha` is your one authorized correction commit counts.

Make one normal commit and one normal push. Do not manually dispatch, rerun, retry, or make a second correction commit. Wait for that correction-HEAD automatic CI run to become terminal and record: HEAD/tree; run/job/artifact IDs; PR Verify; all six Chromium deployment axes and traces; Stage 3 entrance-candidate/final-candidate/final-base; focused remote Phase G trio if unlocked; and every required conclusion.

Then return exactly:

`STATUS: BLOCKED_RETURN_TO_SOL_R7_REMOTE_COMPLETE`

Return this status whether the run is green or failed. Sol alone classifies the Chromium traces and promotion. Do not run local full Phase G or unfiltered remote Phase G, and do not enter Producer checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, or closure.

### 14.4 Short Luna handoff

Re-fetch PR #171; execute Design Lock Section 21 / Handoff Section 14 only. Normalize the five diagnostic files to their exact LF/BOM contract, add only their five path-specific LF attributes, and replace only the Stage 3 final-cut page-owned waiter with the specified non-overlapping Node-owned 50 ms / 60 s waiter using the unchanged predicate. Pass the exact byte/semantic/focused checks, make one normal commit/push, wait for that single automatic CI run to finish, record immutable evidence, and return `BLOCKED_RETURN_TO_SOL_R7_REMOTE_COMPLETE`. No other file, product change, retry/rerun, second commit, local full/unfiltered Phase G, or release action.

## 15. Revision r7 same-revision handoff — `.gitattributes` LF closure

Run this section only. Section 14 correction is implemented and its Stage 3 result is closed; do not reimplement or alter it. Design Lock Section 22 is the sole active packet. Revision remains `V100-SOL-DL-001 r7`; `PRODUCT_DESIGN_CHANGE: 0`.

### 15.1 Execution cursor and fixed classifications

- `LAST_AUDITED_HEAD`: `7429460950a37b2ac68415a5046547c97f8bb263`
- `LAST_AUDITED_TREE`: `9c1cab7d8a8950a2ba475d89ffb986434ba36d15`
- `FAILED_GATE`: run `32510923851`; PR Verify `96861615644` rejected `.gitattributes` lines 1-26 as trailing whitespace; six Chromium capture axes were not run; Phase G `96861720725` was skipped
- `LAST_GREEN_GATE`: Stage 3 3/3, WebKit deployment bounded summaries 6/6, canonical viewports 48/48, WebKit enemy-runtime 6/6, and hosted evidence in run `32510923851`; focused controls only, not final-freeze evidence
- current class: `REPO_HYGIENE / DOT_GITATTRIBUTES_MIXED_EOL / REMEDIATION_LOCAL`
- Stage 3: `REMEDIATION_CLOSED / REMOTE_FOCUSED_GREEN`
- Chromium and focused Phase G: `DIAGNOSTIC_PENDING / NOT_RUN`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Design Lock Section 22 only
- `RESUME_FROM`: `.gitattributes` LF/no-BOM normalization + exact self LF contract -> committed-blob and CI-range checks -> one normal remediation push -> wait for that correction-HEAD automatic run terminal -> `BLOCKED_RETURN_TO_SOL_R7_ATTR_LF_REMOTE_COMPLETE`

Before editing, re-fetch PR #171. It must remain open/Draft on `codex/v1.0.0-luna-implementation`, based on `6acf87fd235fb55d3d5e3ec1f8687b57a06dc769`; live history must contain correction HEAD `7429460` and the current Sol packet identified by the PR body and Issue #172. Any drift returns `STATUS: BLOCKED_RETURN_TO_SOL` without editing.

### 15.2 Exact authorized work

Change exactly one file relative to the Sol packet parent: `.gitattributes`.

1. Normalize its entire blob to LF only; retain no UTF-8 BOM and no bare CR.
2. Preserve every existing line and order, including the five Section 21 entries.
3. Add exactly `.gitattributes text eol=lf` as the sole semantic line.
4. Keep every other tracked path byte-identical to the parent. In particular, do not touch the five normalized diagnostic files or the valid Node-owned Stage 3 wait.

Forbidden: every other file; wildcard/repository-wide normalization; workflow, QA runner/test, Phase G, `app/**`, `public/**`, package/product data/assets/audio; timeout/retry/predicate/assertion/axis changes; product correction; evidence deletion. Do not repeat completed diagnostics or local full/unfiltered Phase G.

### 15.3 Validation, commit, remote run, and stop

Before commit, prove:

1. `git diff --name-only` against the Sol packet parent reports `.gitattributes` only;
2. against correction HEAD `7429460`, normalized semantic diff is only `.gitattributes text eol=lf`;
3. `.gitattributes` has no BOM, CRLF, or bare CR, and `git check-attr eol -- .gitattributes` reports `eol: lf`;
4. the existing 14 focused tests, lint, build, and working-tree base-range whitespace check pass.

Make exactly one normal commit. Before push, inspect `HEAD:.gitattributes` as raw committed bytes and re-prove LF-only/no-BOM/no-CR, one-file parent diff, and `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD` green. Push once normally. No amend, rebase, force push, manual dispatch, retry/rerun, or second remediation commit.

Wait for that remediation-HEAD automatic CI run to become terminal. Record PR Verify with all six Chromium capture axes/traces, Stage 3 3/3, all six WebKit deployment bounded summaries and attempts, focused remote Phase G ordered Stage 6 -> Stage 24 -> Stage 25 if unlocked, and every required conclusion/artifact. Never collapse a skipped or inner failed record into green.

Then return exactly, whether green or failed:

`STATUS: BLOCKED_RETURN_TO_SOL_R7_ATTR_LF_REMOTE_COMPLETE`

Sol alone classifies and authorizes the next gate. No additional change, local full/unfiltered Phase G, Producer checkpoint, Completion Packet, Ready, integration, release, deployment, or closure.

### 15.4 Short Luna handoff

Re-fetch PR #171 and execute Design Lock Section 22 / Handoff Section 15 only. Change only `.gitattributes`: normalize the committed blob to LF/no-BOM/no-CR, preserve all existing lines, and add exactly `.gitattributes text eol=lf`. Prove the one-file semantic/byte contract, existing focused tests/lint/build, and CI-identical base-range `git diff --check`; make one normal commit/push; wait for that HEAD's automatic CI run to finish; record Chromium, Stage 3, WebKit deployment attempts, focused Phase G, and all required results; then return `BLOCKED_RETURN_TO_SOL_R7_ATTR_LF_REMOTE_COMPLETE`. No other edit, retry/rerun, second commit, product change, full/unfiltered Phase G, or release action.

## 16. Revision r8 — CI #910 correction, promotion, and dynamic evidence handoff

Run this section only. Design Lock Section 23 is the sole active packet. Sections 14-15 are completed history and must not be reimplemented. `PRODUCT_DESIGN_CHANGE: 0`.

### 16.1 Execution cursor

- `LAST_AUDITED_HEAD`: `d1aab90ccefa8ad6601821c8520741bde49cd087`
- `LAST_AUDITED_TREE`: `00df3ea842578cddc846059dd2c12f9dca1936a2`
- `FAILED_GATE`: run `32539432537`; Phase G `96949389397` Stage 24 / WebKit 736x414; canonical WebKit `96954658044` 667x375 / `stage3-boss`
- `LAST_GREEN_GATE`: PR Verify `96946366154`; Stage 3 audio 3/3; WebKit deployment 6/6; enemy-runtime 6/6; hosted evidence; not final-freeze evidence
- Phase G class: `QA_PREDICATE_OR_ORCHESTRATION / STALE_DOM_READY_VS_RUNTIME_AFFORDABILITY_ACTIONABILITY_RACE`
- canonical class: `BROWSER_LIFECYCLE_OR_RESOURCE / CLEAN_UNEXPECTED_PAGE_CRASH_MISCLASSIFIED_BY_BOUNDED_HUD_RUNNER`
- `REMEDIATION_CLASS`: `DUAL_QA_HARNESS / PHASE_G_ATOMIC_DEPLOYMENT_ELIGIBILITY + HUD_LIFECYCLE_CRASH_CLASSIFICATION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Design Lock Section 23 only
- `RESUME_FROM`: r8 harness correction -> focused local acceptance -> one correction push -> focused remote complete green -> local full Phase G 54/54 + validator + full regressions -> one unfiltered-workflow restoration push -> unfiltered remote complete green -> dynamic evidence packet + twelve-screen `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`

Before editing, re-fetch PR #171. Require open, Draft, unmerged, head branch `codex/v1.0.0-luna-implementation`, base `codex/v1.0.0-sol-design` at `6acf87fd235fb55d3d5e3ec1f8687b57a06dc769`, and history containing `LAST_AUDITED_HEAD` plus this r8 packet. Drift returns `STATUS: BLOCKED_RETURN_TO_SOL_R8` without editing.

### 16.2 First correction commit

Change only these paths:

1. `scripts/v100-phase-g-production-matrix.mjs`: select boss-frontline cards from one coherent DOM/runtime diagnostic sample; require runtime affordability, queue capacity, running/unpaused/non-terminal state, and zero cooldown; revalidate before click; record and reselect an invalidated candidate; use a deployment-only actionability deadline no greater than 2,000 ms; fail closed on persistent live divergence or lifecycle loss. Keep a normal non-force Playwright click and all existing checkpoints/assertions.
2. `tests/v100-phase-g-checkpoint.test.mjs`: add exact stale-ready, affordable-ready, pre-click invalidation, persistent divergence, lifecycle-loss, and no-weakening contracts.
3. `scripts/run-v099-hud-states-bounded.mjs`: allow attempt 2 only from the attempt-local, inside-root lifecycle JSONL proving a clean unexpected page crash before cleanup after battle readiness, with stable build identity, target-close/crash terminal error, and zero diagnostics. Maximum attempts stays two and a complete real pass remains mandatory.
4. `tests/v099-hud-states-bounded.test.mjs`: cover the clean crash retry and every fail-closed negative named in Design Lock 23.2.
5. `.gitattributes`: add only `scripts/run-v099-hud-states-bounded.mjs text eol=lf` and `tests/v099-hud-states-bounded.test.mjs text eol=lf`.

Do not change workflow in this first commit. Forbidden: `app/**`, product/runtime/assets/audio/save/PWA/package changes, global timeout/retry changes, force click/event dispatch/state mutation, weakened axes/assertions/checkpoints, unrelated formatting, or repository-wide normalization. All five files remain LF-only with their existing BOM states.

### 16.3 Local acceptance, first push, and focused remote gate

Run the focused tests for both corrected owners plus `tests/ci-contract.test.mjs` and `tests/v100-design-lock.test.mjs`, then lint, build, and the CI-identical base-range `git diff --check`.

Run three fresh-process WebKit Stage 24-only sequences with:

```powershell
$env:V100_PHASE_G_ONLY='battle-extra'
$env:V100_PHASE_G_ONLY_ENGINE='webkit'
$env:V100_PHASE_G_ONLY_VARIANT='stage24-panther-commander'
1..3 | ForEach-Object {
  $env:V100_PHASE_G_SEQUENCE_ID="r8-stage24-local-$_"
  $env:V100_PHASE_G_EVIDENCE_DIR="outputs/v100-r8-stage24-local-$_"
  npm.cmd run qa:v100-phase-g
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Run the canonical WebKit 667x375 `stage3-boss` bounded sequence exactly three times with:

```powershell
$env:ISSUE156_WEBKIT_HUD_STATE='stage3-boss'
$env:V099_FINAL_REMEDIATION_QA_ENGINES='webkit'
$env:V099_FINAL_REMEDIATION_QA_VIEWPORTS='667x375'
$env:V099_FINAL_REMEDIATION_QA_TIMEOUT_MS='60000'
1..3 | ForEach-Object {
  $env:ISSUE156_WEBKIT_HUD_EVIDENCE_ROOT="outputs/v100-r8-stage3-canonical-local-$_"
  node scripts/run-v099-hud-states-bounded.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Each sequence must end in one real screenshot/state pass; attempt 2 is allowed only when attempt 1 proves the exact clean unexpected crash. Existing values of the named environment variables must be replaced by the values above for these sequences; unrelated Phase G filter variables must not be passed to the canonical runner.

Any automatic CI run triggered only by Sol's docs/test r8 packet before your correction commit is metadata-only. Record its URL/status at preflight; do not rerun it, return it as a new failure, or use it as correction/promotion/final-freeze evidence. Only the later automatic run whose `headSha` is your one authorized correction commit counts below.

After all local acceptance is green, create one normal correction commit and push once. Wait for its automatic CI. Require every required job green, including focused ordered trio 3/3 and canonical 667x375 `stage3-boss`. Any failure/skip/missing artifact or different cause returns `STATUS: BLOCKED_RETURN_TO_SOL_R8`; no manual retry/rerun or second correction.

### 16.4 Local full gate and unfiltered remote promotion

Only after the focused remote run is completely green:

1. run local full Phase G 54/54 and `npm.cmd run qa:v100-phase-g-validate`;
2. run every Section 18.5 full regression;
3. create one promotion commit changing only `.github/workflows/ci.yml` and, only if needed for the exact source contract, `tests/ci-contract.test.mjs`;
4. restore `v100-phase-g-production` to one unfiltered `npm run qa:v100-phase-g`, one validator command, artifact `v100-phase-g-production-evidence`, and path `outputs/v100-phase-g`; remove the focused environment and ordered-trio loop;
5. push once and wait for the automatic unfiltered run. Require 54/54, validator, and every required job green.

Any local-full or unfiltered-remote failure returns `STATUS: BLOCKED_RETURN_TO_SOL_R8` without another edit. No amend, rebase, force push, manual dispatch/rerun, empty commit, or third candidate commit.

### 16.5 Dynamic game-quality evidence and Producer checkpoint

After complete unfiltered remote green, use existing QA/developer reachability to collect the exact-HEAD/tree `DYNAMIC_GAME_QUALITY_EVIDENCE_PACKET` required by Design Lock 23.4. Do not grind through stages only to reach a state. Record shortcut use explicitly; never cite it as difficulty/balance evidence.

Cover the first-time flow, representative normal battle, Stages 3/24/25/30, visual/identity/VFX/HUD/control/timing quality, representative dialogue tempo/transitions, 667x375 and 844x390 landscape plus 1280x720, win/result/post/map, defeat/retry/map, save/reload/interrupted resume, combat FX/support/vehicle/mission/status evidence, and clean runtime diagnostics.

Then set `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED` and submit the unchanged twelve actual-production screens with links to the dynamic packet. Stop for Producer review. Do not finalize the Completion Packet or set `READY_FOR_SOL_FINAL_REVIEW`. Producer Visual Approval does not replace Sol's later dynamic human-player audit.

### 16.6 Exact short Luna handoff

Re-fetch PR #171 and execute Design Lock Section 23 / Handoff Section 16 only. Start from the live branch containing this Sol r8 packet; `d1aab90ccefa8ad6601821c8520741bde49cd087` is the immutable audited product parent, not a checkout target. Correct only the Phase G atomic deployable-card selection/actionability race and the canonical HUD clean unexpected-page-crash classifier, with their exact tests and two LF attributes; change no `app/**` or product behavior. Pass Stage 24 WebKit 3/3 and canonical 667x375 Stage 3 3/3 locally, make one correction push, and require the automatic focused CI completely green. Then run local full Phase G 54/54 + validator + full regressions, restore only the Phase G job to unfiltered 54/54 in one promotion push, and require complete remote green. Finally collect the exact-HEAD/tree dynamic game-quality packet and request the twelve-screen Producer Visual Checkpoint. On any drift, failure, new cause, forbidden-file need, or missing evidence, stop with `BLOCKED_RETURN_TO_SOL_R8`; no retry/rerun or extra fix.

## 17. Revision r9 — focused-local source-contract handoff

Run this section only. Design Lock Section 24 is the sole active cursor. Section 23 / Handoff Section 16 remain authoritative for the underlying r8 harness behavior, runtime-focused controls, promotion, dynamic evidence, Producer checkpoint, and release tail. `PRODUCT_DESIGN_CHANGE: 0`.

### 17.1 Cursor and classifications

- `LAST_AUDITED_HEAD`: `c6d3a2e8a925ca294fad82b47954d79b02a127bc`
- `LAST_AUDITED_TREE`: `a4568cc2dbac3c6352de17170f92150865329ea2`
- `AUDITED_PRODUCT_PARENT`: `d1aab90ccefa8ad6601821c8520741bde49cd087`
- `FAILED_GATE`: exact focused local source command, 43 total / 41 pass / 2 fail; no correction commit/push or remote correction run
- HUD CI class: `DESIGN_CONTRACT_DEFECT / STALE_HUD_GENERIC_RETRY_ASSERTION + FIRST_COMMIT_ALLOWLIST_OMISSION / DESIGN_CHANGE_REQUIRED`
- Phase G probe class: `QA_PROBE_SERIALIZATION / REJECTED_CANDIDATE_REASON_OMITTED / IMPLEMENTATION_MISMATCH_WITH_LOCKED_EVIDENCE`
- `LAST_GREEN_GATE`: 41/43 source tests, including all r8 HUD behavioral tests and all other Phase G contract tests; r8 design tests 18/18; prior remote controls are not correction/final-freeze evidence
- `REMEDIATION_CLASS`: `DUAL_LOCAL_SOURCE_CONTRACT / HUD_CI_ASSERTION_ALLOWLIST + PHASE_G_PROBE_SERIALIZATION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Section 24 / Section 17 only
- `RESUME_FROM`: preserve or reconstruct the uncommitted r8 draft on the live r9 packet -> exact two source-contract closures -> focused 43/43 -> lint/build/base-range diff -> Stage 24 WebKit 3/3 + canonical Stage 3 WebKit 3/3 -> one correction commit/push -> focused remote complete green -> Section 23 promotion/dynamic-evidence route

Before editing, re-fetch PR #171. Require open, Draft, unmerged, head branch `codex/v1.0.0-luna-implementation`, base `codex/v1.0.0-sol-design` at `6acf87fd235fb55d3d5e3ec1f8687b57a06dc769`, and live history containing audited HEAD plus this r9 Sol packet. If the stopped uncommitted r8 draft is present, its dirty paths must be exactly the five Section 23.2 paths; retain it while advancing to the non-overlapping r9 packet. If it is absent, reconstruct only the six-path Section 24 contract. Any different dirty path, overlap, or inability to establish the exact baseline returns `STATUS: BLOCKED_RETURN_TO_SOL_R9` without editing or cleanup.

### 17.2 Exact two closures and allowlist

The one correction commit may contain exactly:

- the five unchanged r8 draft paths: `scripts/v100-phase-g-production-matrix.mjs`, `tests/v100-phase-g-checkpoint.test.mjs`, `scripts/run-v099-hud-states-bounded.mjs`, `tests/v099-hud-states-bounded.test.mjs`, `.gitattributes`;
- `tests/ci-contract.test.mjs`, added by r9 only for the HUD source-contract block.

Apply no new r8 behavioral change. Make exactly these closures:

1. In the Phase G contract-probe JSON, change `sample` to serialize every actionability-annotated sampled card in input order, not the eligible-only `candidates`. Keep `candidates` eligible-only. The insufficient-energy fixture must return `candidates: []` and a ranger sample with `eligible: false`, cost 45, energy 27.8, and `insufficient-energy`. Do not alter production selection/filter/click/recheck behavior or the test.
2. In `tests/ci-contract.test.mjs`, edit only the HUD bounded-runner assertion block. Require that the HUD runner does not use `isRetryableTargetClosedLog` and does contain the exact lifecycle classifier/proofs named in Design Lock 24.2. Do not change the enemy-runtime or deployment-runner generic-helper assertions, the workflow contract, canonical HUD inventory, pass evidence, retry maximum, or no-skip/fail-closed requirements.

Preserve exactly the two r8 `.gitattributes` additions. No other semantic/EOL/BOM change, workflow edit, `app/**`, product/runtime/package/asset/audio/save/PWA change, timeout/retry change, generic retry, or assertion weakening is authorized.

### 17.3 Exact acceptance and continuation

Run exactly:

```powershell
node --test tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs
```

Require 43/43. Then require `npm.cmd run lint`, `npm.cmd run build`, `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD`, and an exact six-path diff audit.

Only then resume Handoff 16.3 at Stage 24 WebKit 3/3 and canonical 667x375 Stage 3 WebKit 3/3. If both pass, make the still-unmade single normal correction commit/push and require its automatic focused CI completely green. Continue Handoff 16.4-16.5 unchanged only after that green run: local full Phase G 54/54 + validator + full regressions, one unfiltered-workflow restoration commit/push, complete unfiltered remote green, exact-HEAD/tree dynamic evidence packet, and twelve-screen `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`.

Any failure, new cause, unexpected skip, missing artifact/evidence, forbidden-file need, or live-ref drift returns `STATUS: BLOCKED_RETURN_TO_SOL_R9` with no retry, rerun, additional correction, or scope expansion. Sol r9 packet CI is metadata-only.

### 17.4 Exact short Luna handoff

Re-fetch PR #171 and execute Design Lock Section 24 / Handoff Section 17 only. Preserve the stopped five-path r8 draft if its baseline and dirty paths are exact; otherwise reconstruct only the six allowed paths. Fix only two source-contract defects: serialize every coherent Phase G probe sample card so the rejected ranger retains `insufficient-energy`, and replace only the stale HUD `isRetryableTargetClosedLog` CI assertion with the exact attempt-local clean-crash classifier contract while preserving the enemy/deployment assertions. Require focused 43/43, lint, build, base-range diff check, exact six-path diff, Stage 24 WebKit 3/3, and canonical 667x375 Stage 3 WebKit 3/3; then make the still-unmade one correction commit/push and require focused remote complete green. Continue the unchanged r8 full/unfiltered/dynamic-evidence route only after green. On any failure or drift, return `BLOCKED_RETURN_TO_SOL_R9`; no retry/rerun or extra fix.

## 18. Revision r10 — isolated local-gate bootstrap handoff

Run this section only. Design Lock Section 25 is the sole active cursor. Preserve the stopped six-path r8/r9 correction draft; do not reconstruct it. Sections 23-24 / Handoff Sections 16-17 remain authoritative for its source semantics and every later runtime, promotion, evidence, Producer, and release gate. `PRODUCT_DESIGN_CHANGE: 0`.

### 18.1 Cursor and owner

- `LAST_AUDITED_HEAD`: `3a40b95eafe8df17b9de907b6644e66912e1e218`
- `LAST_AUDITED_TREE`: `486b9cf0cc92152372ff6414b61e2df440e8087a`
- `AUDITED_PRODUCT_PARENT`: `d1aab90ccefa8ad6601821c8520741bde49cd087`
- `FAILED_GATE`: r9 focused local setup — 26 total / 20 pass / 6 fail because `sharp` and `playwright` were unavailable; source assertions, lint/build, WebKit, commit/push, and remote correction CI were not reached
- `LAST_GREEN_GATE`: Sol control only — clean isolated install, immutable package/draft bytes, sharp plus local Chromium/WebKit preflight, four-file load, focused 43/43
- `REMEDIATION_CLASS`: `LOCAL_ACCEPTANCE_BOOTSTRAP / LOCKFILE_INSTALL + WORKTREE_LOCAL_BROWSERS + DRAFT_BYTE_PRESERVATION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Design Lock Section 25 / Handoff Section 18 only
- `RESUME_FROM`: same six-path isolated draft -> fast-forward r10 -> one bootstrap -> hash/status proof -> preflight/load/focused 43/43 -> lint/build/diff -> two runtime-focused 3/3 gates -> one correction push -> focused remote green -> unchanged promotion/dynamic-evidence route

### 18.2 Exact workspace and bootstrap

Re-fetch PR #171. Require open, Draft, unmerged, head branch `codex/v1.0.0-luna-implementation`, base `codex/v1.0.0-sol-design` at `6acf87fd235fb55d3d5e3ec1f8687b57a06dc769`, and live history containing r9 packet `3a40b95eafe8df17b9de907b6644e66912e1e218` followed by the r10 Sol packet. In the same stopped isolated worktree, normal-fast-forward to the r10 packet without stash/reset/clean/rebase/checkout/copy or touching a dirty path.

After fast-forward, require no staged or untracked files and exactly these six unstaged paths: `.gitattributes`, `scripts/run-v099-hud-states-bounded.mjs`, `scripts/v100-phase-g-production-matrix.mjs`, `tests/ci-contract.test.mjs`, `tests/v099-hud-states-bounded.test.mjs`, `tests/v100-phase-g-checkpoint.test.mjs`. Require `package.json` SHA-256 `45144b0bf6813d6b6cc47a79861217fc8fb73c744afbc2731f13bd7f2b6716f6` and `package-lock.json` SHA-256 `c3167d50451b0887271cf0b06280b6fb1393a497c20229ccc865331e0ee9fcd6`. The first command below enforces and snapshots that whole state under ignored `outputs/`.

Do not inspect or reuse another worktree's dependencies. Run once, in order:

```powershell
node scripts/v100-r10-local-gate-preflight.mjs snapshot
npm.cmd ci --no-audit --no-fund
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
& .\node_modules\.bin\playwright.cmd install chromium webkit
```

No individual/global package install, alternate package manager, lock repair/update, dependency link/junction/copy, shared browser cache, `npm approve-scripts`, or fallback strategy is authorized. Network reads are allowed only for these exact lock-owned installers. Afterward, package/lock hashes and every six-path hash must be unchanged; Git status remains the exact same six unstaged paths.

### 18.3 Exact preflight, source gate, and continuation

Keep `PLAYWRIGHT_BROWSERS_PATH=0` and run each once:

```powershell
node scripts/v100-r10-local-gate-preflight.mjs runtime
node --test --test-name-pattern='(?!)' tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs
node --test tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs
node scripts/v100-r10-local-gate-preflight.mjs verify
```

Require `V100_R10_DRAFT_SNAPSHOT_OK`, `V100_R10_LOCAL_GATE_PREFLIGHT_OK`, both local browser launches, four-file load exit 0, focused 43/43, and `V100_R10_DRAFT_VERIFY_OK`. Then require lint, build, base-range `git diff --check`, and exact six-path semantic/EOL/BOM audit. Only then resume Handoff 16.3 at Stage 24 WebKit 3/3 and canonical 667x375 Stage 3 WebKit 3/3; make the still-unmade one correction commit/push only after both pass. Focused remote, full/unfiltered promotion, dynamic evidence, and Producer checkpoint remain unchanged.

### 18.4 Exact stop routing

Run each phase once. Environment/bootstrap/hash/native/browser failure returns `BLOCKED_RETURN_TO_SOL_R10_ENVIRONMENT`; four-file load failure returns `BLOCKED_RETURN_TO_SOL_R10_LOADABILITY`; focused 43-test assertion failure returns `BLOCKED_RETURN_TO_SOL_R10_SOURCE`; any later gate failure returns `BLOCKED_RETURN_TO_SOL_R10_RUNTIME`. Record the exact command, exit code, versions, environment value, status, hashes, and first failure. Do not retry, rerun, repair a dependency, change workspace, edit source, commit, push, or promote.

### 18.5 Exact short Luna handoff

Re-fetch PR #171 and execute Design Lock Section 25 / Handoff Section 18 only. Keep the same stopped isolated worktree and existing six-path r8/r9 draft; fast-forward only the non-overlapping r10 Sol packet without stash/reset/clean/reconstruction. Run exactly one worktree-local `npm ci`, set `PLAYWRIGHT_BROWSERS_PATH=0`, install Chromium/WebKit once, prove package/lock and all six draft hashes/status unchanged, then run the r10 native/browser preflight, four-file load, and focused 43/43 once. Only after green run lint/build/base-range six-path audit, Stage 24 WebKit 3/3, and canonical Stage 3 WebKit 3/3; then make the still-unmade one correction commit/push and require focused remote green before the unchanged promotion/dynamic-evidence route. Route environment, loadability, source, or later failures to the matching `BLOCKED_RETURN_TO_SOL_R10_*` status with no retry/rerun/self-repair or extra edit.

## 19. Revision r11 — Stage 24 causal-history handoff

Run this section only. Design Lock Section 26 is the sole active cursor. Keep Producer Loop-Breaker `5379794856`; do not reinterpret route `5383696506` as permission to retry run 2 or make a product change. Sections 23-25 / Handoff Sections 16-18 remain authoritative where Section 26 does not supersede them. `PRODUCT_DESIGN_CHANGE: 0`.

### 19.1 Cursor and fixed classification

- `LAST_AUDITED_HEAD`: `3f4190eb0fa89eef59141692e338ff3a9c81b40b`
- `LAST_AUDITED_TREE`: `8782ed45b0cc85130d0a86fc2ce3135be1f22160`
- `FAILED_GATE`: Stage 24 WebKit local run 2; 35 samples, `source=false`, travel/contact + reaction + audio true; run 3 and canonical Stage 3 not run; no correction commit/push/remote CI
- `LAST_GREEN_GATE`: r10 environment/source 43/43, lint, build, base-range/six-path audit, and Stage 24 run 1 positive control in the same stopped worktree; control only
- Classification: `QA_HARNESS_CAUSAL_HISTORY / MONOTONIC_SOURCE_TARGET_EDGE_CLOBBER + FINAL_WINDOW_PHASE_COUPLING / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `PHASE_G_CAUSAL_HISTORY / MONOTONIC_SOURCE_EDGE + NON_DESTRUCTIVE_FINAL_MERGE / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Design Lock Section 26 / Handoff Section 19 only
- `RESUME_FROM`: same stopped six-path worktree -> r11 fast-forward -> resume preflight -> exact two-path causal-history correction -> five-file load + 47/47 -> lint/build/diff/byte audit -> fresh corrected Stage 24 3/3 -> canonical Stage 3 3/3 -> one six-path correction commit/push -> focused remote complete green -> unchanged full/unfiltered/dynamic-quality route

### 19.2 Workspace, preflight, and exact correction

Re-fetch PR #171. Require open, Draft, unmerged, branch `codex/v1.0.0-luna-implementation`, base `codex/v1.0.0-sol-design` at `6acf87fd235fb55d3d5e3ec1f8687b57a06dc769`, and live history containing r10 packet `3f4190eb0fa89eef59141692e338ff3a9c81b40b` followed only by the r11 Sol packet. In the same stopped isolated worktree, fast-forward the non-overlapping packet without stash/reset/clean/rebase/checkout/copy/reconstruction. Require no staged/untracked file and exactly the existing six unstaged paths.

Do not run `npm ci`, install a browser/package, or rerun the r10 bootstrap/source 43. Keep the existing local dependencies, set `PLAYWRIGHT_BROWSERS_PATH=0`, and run `node scripts/v100-r10-local-gate-preflight.mjs resume` once before editing. Require `V100_R11_RUNTIME_RETURN_PREFLIGHT_OK`.

Then change only:

1. `scripts/v100-phase-g-production-matrix.mjs`: implement the exact page-lifetime deduplicated `sourceToTargetEdges`/`sourceAttribution`, non-destructive wait merge, proof merge/serialization, and shared `V100_PHASE_G_CAUSAL_HISTORY_PROBE` contract in Design Lock 26.2.
2. `.gitattributes`: add exactly `tests/v100-r11-combat-causal-history.test.mjs text eol=lf` and nothing else.

Preserve the four other r8/r9 draft paths byte-for-byte. Do not edit the Sol-owned r11 test, documents, design test, or preflight. Do not treat attacker/audio/impact/reaction evidence without an actual sourceId-targetId record as source proof. No synthetic edge, timeout/retry extension, product/runtime mutation, `app/**`, package/lock/workflow, assertion weakening, or seventh correction path.

### 19.3 Acceptance, commit, continuation, and stop

With `PLAYWRIGHT_BROWSERS_PATH=0`, run once: five-file load-only; the same five-file focused source command; lint; build; working-tree `git diff --check`; exact six-path semantic/EOL/BOM audit. The five files are the four r10 focused files plus `tests/v100-r11-combat-causal-history.test.mjs`; require 47/47.

Run three fresh corrected Stage 24 WebKit processes and then three canonical 667x375 Stage 3 WebKit processes with the Section 23.3 commands, naming evidence `r11-stage24-local-1..3` and `r11-stage3-canonical-local-1..3`. The old run 1/2 are comparison evidence only and do not count. After complete local green, make one normal correction commit containing exactly the six established paths, run base-to-HEAD `git diff --check`, push once, and require the resulting automatic focused remote run completely green.

- resume-preflight failure: `BLOCKED_RETURN_TO_SOL_R11_ENVIRONMENT`;
- load/source/lint/build/diff/allowlist/EOL failure: `BLOCKED_RETURN_TO_SOL_R11_SOURCE`;
- local Stage 24/Stage 3 failure or different evidence cause: `BLOCKED_RETURN_TO_SOL_R11_RUNTIME`;
- remote failure/skip/missing artifact/new cause: `BLOCKED_RETURN_TO_SOL_R11_REMOTE`.

On any stop, record live HEAD/tree, command, exit, first failure, environment, status/hashes, and raw evidence paths; do not retry, rerun, self-repair, add a fix, change workspace, commit, push again, or promote. Only focused remote complete green resumes local full Phase G 54/54 + validator + full regressions, one unfiltered-workflow restoration, unfiltered remote complete green, dynamic-quality packet, and `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`.

### 19.4 Exact short Luna handoff

Re-fetch PR #171 and execute Design Lock Section 26 / Handoff Section 19 only. In the same stopped six-path worktree, fast-forward the non-overlapping r11 packet, keep `PLAYWRIGHT_BROWSERS_PATH=0`, and run the r11 `resume` preflight once; do not reinstall or repeat the green r10 gates. Correct only monotonic source-target history/non-destructive final merge in `scripts/v100-phase-g-production-matrix.mjs` plus the one LF line in `.gitattributes`; preserve the other four draft paths and all Sol-owned r11 files. Require five-file load, focused 47/47, lint/build/diff/byte audit, fresh corrected Stage 24 3/3, and canonical Stage 3 3/3; then make the one six-path correction commit/push and require focused remote complete green. On any failure use the exact r11 return status with no retry/rerun/extra edit. No Producer checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, or Issue closure.

## 20. Revision r11 same-revision handoff — Sol-owned source-contract closure

Run this section only. Design Lock Section 27 is the active cursor; Section 26 remains the unchanged causal implementation/runtime contract. Sol independently reproduced the 46/47 return and proved that the live/stopped Project State already contains `SOL human-player quality audit未完了`. The actual failing regex is the earlier missing r10 `LOCAL_ACCEPTANCE_BOOTSTRAP / LOCKFILE_INSTALL + WORKTREE_LOCAL_BROWSERS + DRAFT_BYTE_PRESERVATION / DESIGN_CHANGE_REQUIRED` remediation-class literal. Sol corrected Project State and retained the assertion. `PRODUCT_DESIGN_CHANGE: 0`.

### 20.1 Cursor

- `LAST_AUDITED_HEAD`: `f3db25f00c9209830d79d7f01b599bdb02834a06`
- `LAST_AUDITED_TREE`: `ee0bcd81f3aed9bedaf642f6990acf8907865259`
- `FAILED_GATE`: r11 focused source acceptance 46/47; Sol-owned r10 cross-source Project State contract; lint/build/runtime/commit/push not run
- `LAST_GREEN_GATE`: r11 resume preflight, five-file load, causal 4/4, and every other focused assertion; Sol then requires same-worktree targeted 1/1 and focused 47/47 before publishing this packet
- Classification/`REMEDIATION_CLASS`: `SOL_PACKET_CANONICAL_STATE_CONTRACT / R10_REMEDIATION_CLASS_OMITTED_FROM_PROJECT_STATE / REMEDIATION_LOCAL`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` after the published Sol packet and green proof only
- `RESUME_FROM`: same stopped six-path worktree at the Section 27 packet -> lint -> build -> diff/byte/six-path audit -> fresh corrected Stage 24 3/3 -> canonical Stage 3 3/3 -> one six-path correction commit/push -> focused remote complete green -> unchanged full/unfiltered/dynamic-quality route

### 20.2 Exact short Luna handoff

Re-fetch PR #171 and require its live history to contain the published Design Lock Section 27 / Handoff Section 20 Sol packet directly after `f3db25f00c9209830d79d7f01b599bdb02834a06`. Continue in the same stopped worktree with exactly the same six unstaged paths and hashes. Do not edit or recommit `docs/PROJECT_STATE.md`, either design document, or `tests/v100-design-lock.test.mjs`; Sol has already run the targeted contract 1/1 and the exact focused suite 47/47 in this worktree. Do not repeat the resume preflight, five-file load, or focused source suite. Resume at lint, then build, diff/byte/six-path audit, fresh corrected Stage 24 3/3, canonical Stage 3 3/3, the one six-path correction commit/push, and focused remote complete green. On any failure, drift, or need outside the six-path correction, use the existing exact r11 return status and stop without retry/rerun/extra edit. No Producer checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, or Issue closure.

## 21. Revision r12 — no active Luna handoff

Design Lock Section 28 and the latest explicitly labeled Issue #172 loop-ledger entry are the sole active cursor. Producer directives `5386346594`, `5386372849`, `5386391321`, `5386349725`, and `5386314197` replace the previous SOL/Luna routing for this Version until explicitly revoked; `5386320133` is the initial SOL cursor, not a permanently current value. The repository filename, Section 2 historical reading list, and historical `LUNA_HANDOFF_READY: YES` do not assign current ownership.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `DESIGN_PUBLICATION_ROLE`: `SOL_DESIGN`
- `NEXT_ROLE`: `SOL_REMEDIATION`; the active role is read from the current Issue #172 cursor
- `LAST_AUDITED_HEAD`: `0495e95e3bc59fcf546ffa02ee83704a1f63e366`
- `LAST_AUDITED_TREE`: `30071d5a9f4fd92e93f54ddea2e9713382247f74`
- `FAILED_GATE`: run `32636742294`, Phase G job `97189630445`, capture variant `stage06-spitter-seal`, actual stage ID `stage-nishijin-station-tunnel-seal`, WebKit 667x375 before pointer dispatch; artifact `9492754238`
- `LAST_GREEN_GATE`: PR Verify `97187545551`; prior same-app-tree Stage 6 positive control only
- `CLASSIFICATION`: `QA_HARNESS_ACTIONABILITY_GATE_POLICY_FAILURE / PRE_POINTER_LOCATOR_STABILITY_TIMEOUT + FAILURE_CURSOR_FINALIZATION_LOSS / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `PHASE_G_REAL_POINTER_ACTIONABILITY / EXPLICIT_HIT_TEST + STABLE_RECT + ONE_INPUT + TRUE_FAILURE_CURSOR / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `1` now -> `2` at the atomic six-path candidate -> `3` only if the workflow-restoration promotion HEAD is created; without restoration remain `2`
- `SAME_GATE_REPEAT_COUNT`: `1` now; reset only after the candidate focused required gate is green, before an authorized promotion HEAD
- `NEXT_OWNER`: `SOL_REMEDIATION`
- `RESUME_FROM`: exact `0495e95` worktree with Issue-locked four-path design packet -> edit only the two Phase G harness paths -> focused 54/54/static gates -> Stage 6 3/3 -> ordered Stage 6/24/25 trio 3/3 -> one atomic six-path candidate commit/push -> candidate remote focused complete green -> local workflow-only restoration commit -> same-HEAD local full 54/54/validator/regressions -> one promotion push -> unfiltered remote complete green -> exact-HEAD runtime/human audit -> frozen read-only `SOL_FINAL_REVIEW`

Current SOL required reading is `AGENTS.md`, `docs/CODEX_TWO_THREAD_WORKFLOW.md`, `docs/CODEX_SOL_ROLE.md`, `docs/PROJECT_STATE.md`, Producer Decisions, Design Lock Section 28, this Section 21, the latest Issue #172 cursor, and live PR/CI/artifacts. It does not alter the historical Luna reading list.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r12` and Issue #172.** Do not send these instructions to Luna. Under `SOL_DESIGN`, lock the exact four docs/design-test paths byte-for-byte in Issue #172 without an intermediate commit. Under `SOL_REMEDIATION`, edit only `scripts/v100-phase-g-production-matrix.mjs` and `tests/v100-phase-g-checkpoint.test.mjs`, producing one atomic six-path material candidate. Implement the page-scoped single-flight mutex for every battle pointer that can overlap the sustain task, exact node/kind/slot preflight, the clamped centered DOM rail-scroll formula, bounded real pointer/receipt/outcome contract whose success is `exact trusted receipt AND receipt-time pre-handler match AND production acceptance`, and immutable failure cursor from Section 28.2. Require the exact Section 28.3 preflight and focused 54/54 (five pointer plus one cursor contract), capture variant plus actual stage-ID evidence, Stage 6 3/3, ordered trio 3/3, and complete focused remote green. If workflow restoration is required, reset the same-gate counter, create the workflow-only iteration-3 HEAD locally, run local full gates at that HEAD, then make the single unfiltered promotion push; without restoration remain iteration 2. Record every old/new HEAD/tree and invalidate earlier final evidence. Any failure returns inside the same SOL-owned `/goal`; the only routine Producer stop is `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` after a clean fixed-HEAD `SOL_FINAL_REVIEW`.

## 22. Revision r13 — no active Luna handoff / Stage 25 target ownership

Design Lock Section 29 and the latest explicitly labeled Issue #172 r13 loop-ledger entry are the sole active cursor. Section 21 is retained as the completed r12 design/remediation/runtime history. Producer's SOL single-owner override remains active; no Luna execution, classification, retry, correction choice, or handoff is authorized.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r13 four-path design/source packet is published and locked; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `0495e95e3bc59fcf546ffa02ee83704a1f63e366`
- `LAST_AUDITED_TREE`: `30071d5a9f4fd92e93f54ddea2e9713382247f74`
- `FAILED_GATE`: local ordered sequence `r12-trio-fresh-2-d5986723-b`, ordered position 3, variant `stage25-president`, actual stage ID `stage-mugarian-executive-lab`, WebKit 932x430; sole unresolved checkpoint `living-human-target-acquired-or-not-required`; sequence 3 was not run
- `LAST_GREEN_GATE`: r12 source 54/54 plus lint/build/diff/topology, Stage 6 standalone 3/3, ordered sequence 1 complete 3/3, and sequence 2 Stage 6/24; diagnosis/comparison evidence only after r13 runner bytes change
- `CLASSIFICATION`: `QA_HARNESS_TARGET_OWNERSHIP_HISTORY / LIVE_ONLY_CONTACT_CHECKPOINT + ATTACK_HISTORY_WITHOUT_SIDE_KIND_TARGET_ATTRIBUTION / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `PHASE_G_PROOF_ACTOR_TARGET_OWNERSHIP / MONOTONIC_SAME_FRAME_SOURCE_TARGET_IDENTITY + NO_GENERIC_SUBSTITUTION / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `2`; the r12 material candidate was never committed, the r13 atomic six-path candidate remains iteration 2, and only a later workflow-restoration promotion HEAD is iteration 3
- `SAME_GATE_REPEAT_COUNT`: `1` for the current Stage 25 target-ownership checkpoint; this is not a repeated Stage 6 failure
- `NEXT_OWNER`: `SOL_REMEDIATION` after the Issue-locked r13 publication
- `RESUME_FROM`: same exact six-path worktree -> publish/lock r13 four-path design bytes -> edit only the two Phase G harness paths -> focused 54/54/static/lint/build/diff/topology -> fresh Stage 25 WebKit 932x430 3/3 -> fresh ordered Stage 6/24/25 trio 3/3 -> one atomic six-path candidate commit/push -> complete focused remote green -> unchanged Section 28 promotion/full/unfiltered/runtime/final-review/release route

The r13 correction is finite. Extend both behaviorally identical `mergeCombatActivityHistory` owners with bounded monotonic `targetOwnershipHistory` (maximum 96). Each positive observation must resolve the exact source and target IDs in the same production snapshot and use the exact fields `channel`, `battleTime`, `sourceId`, `sourceSide`, `sourceKind`, `targetId`, `targetSide`, `targetKind`, `targetHp`, and `targetAlive`. Preserve first-observed order; after the first 96 unique observations, ignore newer uniques without eviction or replacement. `proofActorHumanTargetFromHistory` returns the first accepted requested proof actor on side `zombie` targeting a live `human`; current live-target evidence has priority. Immediately after the final proof-actor predicate succeeds, invoke the contact reader once without wait/retry so accepted history is consumed before checkpoint completeness. Generic source-target edges, attacking actors, audio, causal axes, current human count, screenshots, or non-human targets are never substitutes. Preserve all r12 pointer, mutex, receipt, acceptance, cancellation, failure-cursor, timeout, checkpoint, viewport, and no-retry contracts.

Acceptance is exact five-file focused 54/54 with the target-history behavior added inside the existing `V100_PHASE_G_CAUSAL_HISTORY_PROBE`, checkpoint file still exactly 12 tests, then static gates, Stage 25 fresh 3/3, and ordered trio fresh 3/3. A history-positive/checkpoint-unresolved mismatch returns `QA_HARNESS_TARGET_HISTORY_CONSUMER_DIVERGENCE`; shield attack with only non-human ownership returns `PROOF_ACTOR_HUMAN_TARGET_NOT_ESTABLISHED`; attack evidence without same-frame identity returns `QA_HARNESS_TARGET_IDENTITY_OBSERVATION_GAP`. No failure authorizes rerun, immediate edit, gameplay/targeting change, timeout extension, checkpoint weakening, or extra attempt.

Current SOL required reading is `AGENTS.md`, `docs/CODEX_TWO_THREAD_WORKFLOW.md`, `docs/CODEX_SOL_ROLE.md`, `docs/PROJECT_STATE.md`, Producer Decisions, Design Lock Sections 28-29, this Section 22, the latest Issue #172 cursor, and live PR/CI/artifacts. It does not alter the historical Luna reading list.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r13` and Issue #172.** In `SOL_DESIGN`, publish and byte-lock the four current docs/design-test paths without an intermediate commit. Only after that publication switch to `SOL_REMEDIATION` and edit the two existing Phase G harness paths. Add first-96/no-eviction same-frame `targetOwnershipHistory` to both merge owners, the exact no-substitution selector/reader/report evidence, the one no-wait final-predicate consumer read, and the required behavior assertions inside the existing causal-history probe. Preserve the r12 six-path draft and every r12 actionability/cursor contract. Require focused 54/54, checkpoint 12/12, static gates, Stage 25 3/3, ordered trio 3/3, one atomic six-path candidate, complete focused remote green, then the unchanged promotion/full/unfiltered/runtime/final-review/release route. Any failure returns inside this SOL-owned `/goal`; do not route to Luna.

## 23. Revision r14 — no active Luna handoff / scheduler-independent Stage 6 actionability

Design Lock Section 30 and the latest explicitly labeled Issue #172 r14 loop-ledger entry are the sole active cursor. Sections 21-22 remain immutable r12-r13 history. Producer's SOL single-owner override remains active; Luna is stopped and receives no classification, retry, correction, QA, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r14 four-path packet is published, byte-locked, and its design/source proof is green; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `ab91621561926bbd4af90bb0d1ca8551699797d7`
- `LAST_AUDITED_TREE`: `dc8dcc085bcc4e21429201d64e36e4290a14d027`
- `FAILED_GATE`: automatic run `32656697160`, required Phase G job `97238965438`, artifact `9497903328`, `remote-trio-1` ordered position 1, Stage 6 WebKit 667x375; first rAF-only diagnostic sample timed out before any DOM sample or pointer; Stage 24/25 and sequences 2/3 were not run
- `LAST_GREEN_GATE`: PR Verify `97236416025`, six enemy-runtime shards, Hosted Runner Evidence, three canonical Stage 3 routes, plus r13 local source/static/Stage25/ordered-trio comparison evidence; none substitutes for required Phase G red
- `CLASSIFICATION`: `QA_HARNESS_RENDER_OPPORTUNITY_COUPLING / RAF_ONLY_PRE-DOM_SAMPLE_TIMEOUT + UNCANCELLED_EVALUATE + PREFLIGHT_EVIDENCE_LOSS / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `PHASE_G_SCHEDULER_INDEPENDENT_ACTIONABILITY / HOST_TURN_SEPARATED_SYNC_SNAPSHOTS + NONBLOCKING_RAF_TELEMETRY + PREINPUT_CANCELLATION_AND_EVIDENCE / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `2` at failed r13 candidate; the atomic r14 material candidate is iteration 3; the later workflow-only release-validation HEAD is iteration 4
- `SAME_GATE_REPEAT_COUNT`: `2` for the required Stage 6 gate; reset only after the r14 focused required gate is completely green
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r14 publication and green design/source proof
- `RESUME_FROM`: exact clean `ab916215` worktree -> publish/lock r14 four-path bytes -> edit only the two Phase G harness paths -> focused 54/54/checkpoint 12/12/static/lint/build/diff/byte -> fresh Stage 6 3/3 -> fresh ordered Stage 6/24/25 trio 3/3 -> one atomic iteration-3 candidate push -> focused remote complete green -> workflow-only iteration-4 restoration -> same-HEAD full local/unfiltered remote/runtime/human/final-review/release route

The bounded correction removes awaited `requestAnimationFrame` from deployment diagnostics. Each sample uses one host-owned 40 ms turn followed by one synchronous, 1,000 ms-bounded DOM/runtime/hit-test snapshot. Two consecutive observations must preserve exact node/kind/slot, eligibility, hit owner, card rect, and rail position while proving increasing ordinals, at least 39 ms host separation, and at least 16 ms page wall/performance advance. One QA-only rAF probe is non-blocking telemetry: `pending` neither passes nor fails the gate. The terminal synchronous recheck, single real `page.mouse.click`, exact trusted pointerdown/up/click receipt, pre-handler identity/eligibility/owner, and production acceptance remain mandatory.

Any pre-input timeout must close and await only the current capture page/context, observe pending settlement, persist cancellation/lifecycle evidence, and record exactly one pointer-zero deployment attempt before rethrowing the primary classified error. Initial diagnostics, centering, scheduler probe, host turns, all samples, terminal recheck, cleanup, and primary/cleanup errors must survive in the failure artifact. There is no timeout increase, retry, second pointer, extra canonical attempt, product mutation, gameplay/balance/AI change, acceptance weakening, workflow edit in the material candidate, or repository-wide normalization. Preserve every r13 target-ownership/no-substitution and causal-evidence rule.

Acceptance remains five-file load 5/5, focused 54/54, checkpoint 12/12, static source proof, lint/build/diff/byte/topology, fresh Stage 6 3/3, and fresh ordered trio 3/3. Create one atomic six-path iteration-3 candidate only after all local gates are green. Required remote red remains authoritative. Another Stage 6 failure sets the same-gate count to 3 and returns to `SOL_DESIGN` with a fresh subsystem audit; no rerun or immediate micro-patch is permitted. Focused complete green alone authorizes the separate workflow-only iteration-4 restoration and the unchanged full/unfiltered/runtime/human audit -> clean fixed-HEAD `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> explicit-approval stacked integration/release/Pages/public-QA/recovery/closure tail.

Current SOL required reading is `AGENTS.md`, `docs/CODEX_TWO_THREAD_WORKFLOW.md`, `docs/CODEX_SOL_ROLE.md`, `docs/PROJECT_STATE.md`, Producer Decisions, Design Lock Sections 28-30, this Section 23, the latest Issue #172 cursor, and live PR/CI/artifacts. It does not reactivate the historical Luna reading list.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r14` and Issue #172.** Publish and byte-lock the four r14 design/source paths first. Then, in `SOL_REMEDIATION`, change only the runner and checkpoint test: synchronous scheduler-independent deployment snapshots separated by host turns, non-blocking rAF telemetry, finite cancellation, complete preflight evidence, and one recorded pointer-zero attempt on thrown pre-input failure. Keep r12 receipt/acceptance/cursor and r13 target-ownership contracts unchanged. Require focused 54/54, checkpoint 12/12, Stage 6 3/3, ordered trio 3/3, and one atomic iteration-3 candidate with automatic focused remote complete green. Any failure returns inside this SOL-owned `/goal`; do not route to Luna.

## 24. Revision r15 — no active Luna handoff / lean Stage 24 combat observability

Design Lock Section 31 and the latest explicitly labeled Issue #172 r15 loop-ledger entry are the sole active cursor. Sections 21-23 remain immutable r12-r14 history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, source edit, retry, QA, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r15 four-path packet is published, byte-locked, and source-green; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `7793433921f82c483a5b2f4a3887e56f6182c3f0`
- `LAST_AUDITED_TREE`: `9a2ce2ca3028337a83667adf164c870e9ab157f6`
- `FAILED_GATE`: automatic run `32661183323`, required Phase G job `97250055296`, artifact `9499106555`, `remote-trio-1` ordered position 2, Stage 24 WebKit 736x414, clean `page-crash` at 120,711 ms after six trusted accepted deployments; Stage 6 passed, Stage 25 and sequences 2/3 did not run
- `LAST_GREEN_GATE`: exact-tree local r14 source/static, Stage 6 3/3, ordered trio 3/3; current PR Verify, six enemy-runtime shards, Hosted Runner Evidence, three Stage 3 routes, and remote Stage 6. None substitutes for required Phase G red
- `CLASSIFICATION`: `QA_HARNESS_OBSERVABILITY_RESOURCE_PRESSURE / 40MS_FULL_BATTLE_QA_DEEP_SNAPSHOT + LONG_LIVED_STAGE24_WEBKIT_RENDERER_CRASH / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `PHASE_G_LEAN_COMBAT_OBSERVABILITY / LOCALHOST_ONLY_BOUNDED_SNAPSHOT_SCHEMA + NO_FULL_SNAPSHOT_FALLBACK + PROFILED_LONG_ROUTE_ACCEPTANCE / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `3`; r15 material candidate is 4; later workflow-only unfiltered restoration is 5
- `SAME_GATE_REPEAT_COUNT`: `1` for active Stage 24; deferred Stage 6 count remains 2 until focused complete green
- `NEXT_OWNER`: `SOL_REMEDIATION` only after Issue-locked r15 publication and green source proof
- `RESUME_FROM`: exact clean `7793433921` worktree -> four-path r15 byte lock -> three-path lean QA remediation -> focused/static/lint/build/diff/byte -> Stage 6 3/3 + Stage 24 3/3 + ordered trio 3/3 -> atomic iteration-4 candidate -> focused remote complete green -> workflow-only iteration-5 unfiltered restoration -> full/runtime/human/SOL_FINAL_REVIEW -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only release/public-QA/closure tail

The sole app change is one read-only `getPhaseGCombatSnapshot` method inside the already localhost-only QA bridge block. It exposes only the bounded battle facts required by Phase G and excludes campaign/save/survival/equipment/geometry and render-audit histories. The existing full `getSnapshot`, production render/game loop, player behavior, and public-host path remain unchanged. The Phase G runner must use the lean method without fallback for every battle read, retain the exact 40 ms observer cadence and all r12-r14 proof rules, emit a lean schema/profile in success and failure evidence, and preserve the last non-null readable state across a crash.

Do not shorten Stage 24, stop after the commander attack, reset the browser between ordered positions, reduce actors, alter resources/timing, add a timeout/retry/pointer, or edit workflow/product behavior. Fresh acceptance is focused 54/54 and checkpoint 12/12, exact seven-path static/lint/build/diff/byte, Stage 6 3/3, Stage 24 3/3, ordered trio 3/3, then one automatic focused remote attempt completely green. A lean-profile Stage 24 crash returns to `SOL_DESIGN` for process/resource evidence with no immediate edit.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r15` and Issue #172.** Publish and byte-lock the four r15 design/source paths first. In `SOL_REMEDIATION`, edit only `app/AshfallGame.tsx`, `scripts/v100-phase-g-production-matrix.mjs`, and `tests/v100-phase-g-checkpoint.test.mjs` to add the localhost-only bounded combat snapshot, require it without full-snapshot fallback, profile it, and retain the last readable crash cursor. Preserve every pointer, receipt, target-ownership, causal, timing, viewport, and no-retry rule. Require the exact local and remote sequence above; any failure stays inside this SOL-owned `/goal` and never routes to Luna.

## 25. Revision r16 — no active Luna handoff / CRLF-safe source acceptance

Design Lock Section 32 and the latest explicitly labeled Issue #172 r16 byte-lock comment are the sole active cursor. Sections 21-24 remain immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, source edit, retry, QA, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r16 four-path packet is published, byte-locked, and Design Lock source-green; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `7793433921f82c483a5b2f4a3887e56f6182c3f0`
- `LAST_AUDITED_TREE`: `9a2ce2ca3028337a83667adf164c870e9ab157f6`
- `FAILED_GATE`: same-worktree five-file focused source acceptance 53/54; checkpoint test line 243 could not extract the existing CRLF lean method with an LF-only boundary regex; no commit or remote run
- `LAST_GREEN_GATE`: five-file load-only 5/5; r15 fresh Stage 6/24/ordered runtime results are comparison-only after r16 source bytes change
- `CLASSIFICATION`: `SOL_OWNED_SOURCE_CONTRACT_EOL_MISMATCH / LF_ONLY_REGEX_AGAINST_CRLF_APP_SOURCE / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `SOURCE_TEST_EOL_PORTABILITY / CRLF_OR_LF_METHOD_BOUNDARY_WITHOUT_SOURCE_NORMALIZATION / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `3`; r16 material candidate remains 4; workflow-only restoration remains 5
- `SAME_GATE_REPEAT_COUNT`: `1` for deferred Stage 24; `DEFERRED_STAGE6_REPEAT_COUNT`: `2`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r16 publication and green Design Lock proof
- `RESUME_FROM`: preserve current seven-path draft -> change only the checkpoint extractor to exact `\r?\n` boundaries -> focused/static/lint/build/diff/byte -> fresh Stage 6 3/3 + Stage 24 3/3 + ordered trio 3/3 -> atomic iteration-4 candidate -> one automatic focused attempt -> unchanged promotion/full/runtime/human audit -> fixed-HEAD `SOL_FINAL_REVIEW` -> `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only release tail

Keep the r15 app and runner draft bytes unchanged. The only post-lock remediation edit is the existing checkpoint test's lean-method boundary extractor. It must accept CRLF or LF only, retain exact method names and brace indentation, and preserve every required/forbidden field assertion, the exact 40 ms cadence, profile/failure cursor, twelve-test inventory, and 54-test focused total. Do not normalize the app source in memory or on disk, loosen arbitrary whitespace, change app/runner/workflow/package/public bytes, rerun around a failure, or weaken runtime acceptance.

After the one correction, run the previously failing checkpoint test once; then require load 5/5, focused 54/54, checkpoint 12/12, runner syntax, lint, build, diff/EOL/BOM/topology, and a frozen seven-path adversarial diff. Because final candidate source bytes differ from all earlier captures, repeat fresh Stage 6 3/3, Stage 24 3/3, and ordered trio 3/3 before the one atomic candidate. Any failure returns inside this SOL-owned `/goal` to `SOL_DESIGN` with raw evidence and no retry, rerun, or immediate edit.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r16` and Issue #172.** Byte-lock the four r16 design/source paths, keep the r15 app/runner draft unchanged, then edit only the checkpoint extractor from LF-only boundaries to exact CRLF-or-LF boundaries. Re-run the complete r16 acceptance on final bytes, publish one seven-path iteration-4 candidate, and require one automatic focused remote attempt completely green before promotion. No product change, Luna route, retry, Ready, merge, tag, Release, or Pages action is authorized.

## 26. Revision r17 — no active Luna handoff / WebKit QA single-producer observability

Design Lock Section 33 and the latest explicitly labeled Issue #172 r17 byte-lock comment are the sole active cursor. Sections 21-25 remain immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, source edit, retry, QA, promotion, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r17 four-path packet is published, byte-locked, and Design Lock 19/19 is green; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `d11464927efd1d21e573d969a767057bdd5c8b04`
- `LAST_AUDITED_TREE`: `2ce952c6fe70c347e866e7201824ac623bbbe993`
- `FAILED_GATE`: automatic run `32667714653`, attempt 1; Phase G job `97266100902` / artifact `9500819430`, Stage 6 WebKit 667x375 valid-lean-profile page crash after two accepted pointers; independently deployment job `97267069513` / artifact `9500961088`, WebKit 736x414 Crazy King clean page crashes under the existing high-frequency pixel trace and automatic retry
- `LAST_GREEN_GATE`: exact-tree local r16 gates plus remote PR Verify, six enemy-runtime shards, Hosted Runner, all Stage 3 routes, and deployment 1280x720/667x375/844x390/844x340/932x430; none substitutes for either required red job
- `CLASSIFICATION`: `QA_HARNESS_OBSERVATION_REENTRANCY / VALID_LEAN_PROFILE + RAF_RATE_DUPLICATE_SNAPSHOT + NONCHECKPOINT_PIXEL_AUDIT / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `WEBKIT_QA_SINGLE_PRODUCER_OBSERVABILITY / 40MS_OBSERVER_CACHE_CONSUMERS + CHECKPOINT_ONLY_PIXEL_AUDIT + HOST_TURN_FIRST_FRAME_FREEZE + NO_RETRY / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `4`; r17 material candidate is 5; workflow-only unfiltered restoration is 6
- `SAME_GATE_REPEAT_COUNT`: `3` for Stage 6; `DEFERRED_STAGE24_REPEAT_COUNT`: `1`; `DEPLOYMENT_736_REPEAT_COUNT`: `1`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r17 publication and green Design Lock proof
- `RESUME_FROM`: exact clean r16 candidate -> four-path r17 byte lock -> six-path QA-only remediation -> 60/60/static/lint/build/diff/byte -> Stage 6 3/3 + Stage 24 3/3 + ordered trio 3/3 + canonical deployment eight units once/48 PNG/eight sheets -> one iteration-5 candidate -> one automatic focused complete green -> iteration-6 workflow restoration -> full/unfiltered/runtime/human -> read-only `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only integration/release/public-QA/closure

Phase G keeps one direct lean bridge producer at 40 ms and publishes `window.__PHASE_G_LAST_COMBAT_SNAPSHOT__`. Every continuous consumer reads that cache; all combat `page.waitForFunction` predicates use explicit numeric `polling: 100`; the bounded profile/observer/event-time sites are the only direct-reader exceptions. Preserve exact pointer receipts, target ownership, causal 4/4, fourteen checkpoints, timeouts, viewports, and failure cursor. The profile must say `consumerMode: "single-producer-cache"`.

Canonical deployment trace samples retain lifecycle/snapshot/fighter/progress facts but perform no canvas or pixel audit. First-frame discovery uses 100 ms Node host turns, pauses on banner plus exact progress zero, and performs one frozen pixel verification. All six existing checkpoint pixel/opacity/silhouette/final-canvas validations, 48 screenshots, and eight contact sheets remain mandatory. Each canonical unit runs exactly once; target-close or any other first-attempt failure is terminal, with no retry.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r17` and Issue #172.** Byte-lock the four r17 design/source paths first. Then edit only the six QA harness/test paths from Section 33: one 40 ms lean-snapshot producer with cached consumers, explicit 100 ms wait polling, checkpoint-only deployment pixel audits, host-turn first-frame freeze, and exactly one canonical attempt per unit. Preserve `app/**` byte-for-byte and every product/causal/pixel/viewport/timeout gate. Require the complete local sequence, one atomic iteration-5 candidate, and one automatic focused attempt completely green before workflow restoration. Any failure stays inside this SOL-owned `/goal` and returns to `SOL_DESIGN`; do not route to Luna or retry.

## 27. Revision r18 — no active Luna handoff / CI no-retry source-owner alignment

Design Lock Section 34 and the latest explicitly labeled Issue #172 r18 byte-lock comment are the sole active cursor. Sections 21-26 remain immutable audit history. Producer's SOL single-owner override remains active; Luna remains stopped.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r18 four-path packet is published, byte-locked, and Design Lock 19/19 is green; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `d11464927efd1d21e573d969a767057bdd5c8b04`
- `LAST_AUDITED_TREE`: `2ce952c6fe70c347e866e7201824ac623bbbe993`
- `FAILED_GATE`: local exact seven-file focused source command 59/60; the existing `tests/ci-contract.test.mjs` deployment region still required two-attempt/target-close-retry tokens removed by locked r17; browser/lint/build/commit/push were not run
- `LAST_GREEN_GATE`: seven-file load-only 7/7, 59/60 focused, checkpoint/deployment/runtime/design source and behavior, and three edited-script syntax checks
- `CLASSIFICATION`: `SOL_OWNED_SOURCE_CONTRACT_TOPOLOGY_OMISSION / NO_RETRY_DEPLOYMENT_POLICY_CONFLICT_WITH_EXISTING_CI_SOURCE_ASSERTION / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `CI_CONTRACT_NO_RETRY_ALIGNMENT / EXACT_SINGLE_ATTEMPT_POSITIVE_NEGATIVE_ASSERTIONS / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `4`; material candidate remains 5; workflow-only restoration remains 6
- `SAME_GATE_REPEAT_COUNT`: `3`; `DEFERRED_STAGE24_REPEAT_COUNT`: `1`; `DEPLOYMENT_736_REPEAT_COUNT`: `1`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r18 publication and green Design Lock proof
- `RESUME_FROM`: preserve exact ten-path r17 draft -> change only existing ci-contract deployment assertions -> targeted 1/1 + load 7/7 + focused 60/60 + complete source/static gates -> unchanged browser acceptance -> iteration-5 candidate -> one automatic focused run -> Section 33 full/unfiltered/runtime/human -> read-only `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only release loop

The only post-lock correction is `tests/ci-contract.test.mjs`: replace its two positive deployment retry-token assertions with positive exact `const attempt = 1` and negative no-retry assertions. Preserve every other assertion and all ten existing draft paths. The final material topology is exactly eleven paths; `app/**`, workflow, package/lock, public, product, timeout, viewport, causal, pixel, and evidence bytes remain forbidden.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r18` and Issue #172.** Byte-lock the four r18 design/source paths, then edit only the existing deployment-runner assertion region in `tests/ci-contract.test.mjs`. Require targeted 1/1, load 7/7, focused 60/60 and all Section 34 source gates before resuming Section 33 browser acceptance. Do not rebuild the ten-path draft, retry, route to Luna, or change any harness/product contract.

## 28. Revision r19 — no active Luna handoff / preserve existing CI source BOM

Design Lock Section 35 and the latest explicitly labeled Issue #172 r19 byte-lock comment are the sole active cursor. Sections 21-27 remain immutable audit history. Producer's SOL single-owner override remains active; Luna remains stopped.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r19 four-path packet is published, byte-locked, and Design Lock 19/19 is green; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `d11464927efd1d21e573d969a767057bdd5c8b04`
- `LAST_AUDITED_TREE`: `2ce952c6fe70c347e866e7201824ac623bbbe993`
- `FAILED_GATE`: r18 pre-lint byte audit; exact base and current `tests/ci-contract.test.mjs` both have the pre-existing UTF-8 BOM and LF-only lines, while r18 incorrectly declared no BOM; no lint/build/browser/commit/push
- `LAST_GREEN_GATE`: targeted 1/1, load 7/7, focused 60/60, checkpoint 12/12, Design Lock 19/19, three-script syntax, and exact eleven-path topology before the BOM assertion
- `CLASSIFICATION`: `SOL_OWNED_BYTE_CONTRACT_MISDECLARATION / PREEXISTING_CI_CONTRACT_UTF8_BOM_DECLARED_NO_BOM / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `SOURCE_BYTE_CONTRACT_CORRECTION / PRESERVE_EXISTING_UTF8_BOM_AND_LF_WITH_ZERO_SEMANTIC_CHANGE / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `4`; material candidate remains 5; workflow-only restoration remains 6
- `SAME_GATE_REPEAT_COUNT`: `3`; `DEFERRED_STAGE24_REPEAT_COUNT`: `1`; `DEPLOYMENT_736_REPEAT_COUNT`: `1`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r19 publication and green Design Lock proof
- `RESUME_FROM`: preserve the exact current eleven-path draft -> r19 four-path byte lock -> final load 7/7 + focused 60/60 + checkpoint 12/12 + syntax/diff/topology/corrected byte audit -> lint/build -> unchanged browser acceptance -> iteration-5 candidate -> one automatic focused complete green -> Section 33 full/unfiltered/runtime/human -> `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only release loop

The sole r19 correction is the canonical byte declaration. `tests/ci-contract.test.mjs` remains LF-only, UTF-8 with its existing BOM, and keeps exactly the already-green deployment assertion diff. Do not edit that path again, strip its BOM, normalize any file, repeat the targeted test separately, or change another design/harness/product/acceptance rule. Final focused 60/60 includes the CI source contract.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r19` and Issue #172.** Byte-lock the four r19 design/source paths, preserve all eleven candidate paths including the existing `tests/ci-contract.test.mjs` BOM, then run the final Section 35 source/byte gates and resume Section 33 browser acceptance only if green. No Luna route, retry, rerun, product edit, Ready, merge, tag, Release, or Pages action is authorized.

## 29. Revision r20 — no active Luna handoff / finite deployment lifecycle

Design Lock Section 36 and the latest explicitly labeled Issue #172 r20 byte-lock comment are the sole active cursor. Sections 21-28 remain immutable audit history. Producer's SOL single-owner override remains active; Luna remains stopped and receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r20 four-path packet is published, byte-locked, and Design Lock 19/19 is green; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `4191afe2fe84283125c0e9ec817185c94685630c`
- `LAST_AUDITED_TREE`: `cb808fff195d58fd96718cb8381f7f9091e9f313`
- `FAILED_GATE`: automatic run `32673445643`, attempt 1: PR Verify `97277691325` failed five Chromium deployment setup axes with terminal 55-asset error hidden behind readiness timeout; WebKit deployment jobs `97281054120`, `97281054139`, `97281054121`, and `97281054124` clean-crashed at 667x375, 736x414, 844x340, and 932x430; Phase G was dependency-skipped
- `LAST_GREEN_GATE`: exact r19 local source/static/Phase-G/deployment gates plus remote six enemy shards, Hosted Runner, three Stage 3 routes, WebKit deployment 844x390/1280x720, and Pages dry-run; none substitutes for required red/skipped gates
- `CLASSIFICATION`: `QA_HARNESS_DEPLOYMENT_LIFECYCLE_OVERLOAD / EXHAUSTIVE_55_ASSET_GATE + FULL_SNAPSHOT_CHECKPOINT_POLLING + COMPOSITOR_SCREENSHOT / CLEAN_PAGE_CRASH / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `FINITE_DEPLOYMENT_EVIDENCE_LIFECYCLE / REQUIRED_ASSET_PLAN + LEAN_HOST_TURN_CHECKPOINTS + FROZEN_PRODUCTION_CANVAS_PNG / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `5`; r20 material candidate is 6; workflow-only unfiltered restoration is 7
- `SAME_GATE_REPEAT_COUNT`: `3`; `DEFERRED_STAGE24_REPEAT_COUNT`: `1`; `DEPLOYMENT_736_REPEAT_COUNT`: `2`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r20 publication and green Design Lock proof
- `RESUME_FROM`: exact clean r19 candidate -> four-path r20 byte lock -> three-path finite deployment remediation -> source/static/lint/build/diff/byte -> Phase G Stage 6/24/ordered 3/3 -> Chromium six-viewports deployment -> WebKit six-viewports/48 one-attempt unit processes -> atomic iteration-6 candidate -> one automatic focused complete green -> iteration-7 unfiltered restoration -> full/runtime/human -> read-only `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only integration/release/public-QA/closure

The only app edit is one read-only `getCrawlerDeploymentProofSnapshot` method inside the existing localhost-only battle QA bridge. Its selected-fighter receipt includes only current bounded identity/position/entry facts, the current `renderAudit` record (including pose/effective opacity), and current sampled `animationPose`; it copies no render history. Continuous deployment trace/first-frame/checkpoint reads use that bounded schema on Node-host 100 ms turns; each accepted checkpoint still performs one frozen full RGBA audit. Deployment uses the existing finite local asset plan and strict-decodes each exact unit atlas once before its fixture. Setup reports terminal asset error and failed paths immediately. Accepted checkpoint evidence is serialized directly from the frozen production battle canvas to validated PNG; it does not use the full-page compositor or wait on fonts. All six checkpoints, all pixel thresholds, eight units, six viewports, hashes, contact sheets, timeouts, error channels, and first-attempt-only policy remain mandatory.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r20` and Issue #172.** Publish and byte-lock the four r20 design/source paths first. Then edit only `app/AshfallGame.tsx`, `scripts/v099-final-remediation-browser-smoke.mjs`, and `tests/v0995-runtime-evidence-contract.test.mjs`: finite deployment asset mode plus one strict unit decode, terminal compact setup, localhost-only lean deployment snapshot, Node-host checkpoint freeze with one full audit, and frozen production-canvas PNG capture. Preserve Phase G, bounded runner, workflow, CI BOM, product/gameplay, timeout, viewport, and acceptance bytes. Require the complete local matrix, one atomic iteration-6 candidate, and one automatic focused attempt completely green before workflow restoration. Any failure stays inside this SOL-owned `/goal` and returns to `SOL_DESIGN`; do not route to Luna or retry.

## 30. Revision r21 — no active Luna handoff / runtime semantic checkpoint latch

Design Lock Section 37 and the latest explicitly labeled Issue #172 r21 byte-lock comment are the sole active cursor. Sections 21-29 remain immutable audit history. Producer's SOL single-owner override remains active; Luna remains stopped and receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until the r21 four-path packet is published, byte-locked, and Design Lock 19/19 is green; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `4191afe2fe84283125c0e9ec817185c94685630c`
- `LAST_AUDITED_TREE`: `cb808fff195d58fd96718cb8381f7f9091e9f313`
- `FAILED_GATE`: first r20 local Chromium six-viewport deployment run; five cases passed and 844x390 failed only Mayo-chan `first-visible` after `fully-inside`, while the independent lean trace proved the natural semantic interval occurred before monotonic overshoot; no retry and no later WebKit deployment
- `LAST_GREEN_GATE`: r20 final source/static/lint/build/diff/byte, r20 Phase G Stage 6/24/ordered 3/3, and five Chromium viewport controls; comparison/diagnosis only for r21
- `CLASSIFICATION`: `QA_HARNESS_CHECKPOINT_FREEZE_OWNERSHIP_GAP / HOST_POLL_POST_CANDIDATE_FREEZE_DID_NOT_LATCH_EXISTING_NATURAL_SEMANTIC_INTERVAL / MONOTONIC_OVERSHOOT / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `RUNTIME_SEMANTIC_CHECKPOINT_LATCH / LOCALHOST_ONLY_ARM + SAME_SIMULATION_TICK_PAUSE_RECEIPT + HOST_READBACK_ONE_AUDIT / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `5`; r21 material candidate remains 6; workflow-only unfiltered restoration remains 7
- `SAME_GATE_REPEAT_COUNT`: `3`; `DEFERRED_STAGE24_REPEAT_COUNT`: `1`; `DEPLOYMENT_736_REPEAT_COUNT`: `2`; `DEPLOYMENT_844_REPEAT_COUNT`: `1`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r21 publication and green Design Lock proof
- `RESUME_FROM`: preserve r20 seven-path draft -> r21 four-path byte lock -> finish three-path semantic-latch correction -> source/static/lint/build/diff/byte -> Chromium 844x390 Mayo-only once -> fresh r21 Phase G Stage 6/24/ordered 3/3 -> Chromium six-viewports -> WebKit six-viewports/48 one-attempt units -> atomic iteration-6 candidate -> automatic focused complete green -> iteration-7 unfiltered restoration -> full/runtime/human -> read-only `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only integration/release/public-QA/closure

The exact correction keeps the natural simulation as owner. `armCrawlerDeploymentCheckpoint` atomically arms one existing crawler-door fighter/checkpoint and unpauses without changing position or accepting a caller threshold. The unchanged `f.gateEntering` movement path evaluates its existing semantic checkpoint after natural movement, derives the unchanged canonical minimum from `CRAWLER_DEPLOYMENT_CHECKPOINTS` (including `0.08` for `first-visible`), and on the same simulation tick pauses and records one bounded immutable receipt. Host code waits for that exact receipt, then performs one settled lean reread and one full RGBA audit. It does not pause from progress alone, add a second arm, increase sampling frequency, rewind/teleport/step the fighter, widen thresholds, extend timeout, retry, use rAF/`waitForFunction`, or weaken any of six checkpoint/pixel/PNG/contact-sheet contracts. Public-host and unarmed behavior remain unchanged.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r21` and Issue #172.** Preserve all existing r20 draft bytes and exact seven-path topology. Publish and byte-lock the four r21 design/source paths, then edit only the existing app/runner/runtime-test paths to add one localhost-only exact checkpoint arm, same-simulation-tick pause receipt, bounded snapshot readback, and host one-audit acceptance. Require load 7/7, focused 60/60, checkpoint 12/12, Design Lock 19/19, syntax/lint/build/diff/byte, one fresh Chromium 844x390 Mayo-only process, fresh r21 Stage 6/24/ordered 3/3, the full Chromium matrix, and 48 fresh WebKit unit processes. Any first failure returns inside this SOL-owned `/goal` to `SOL_DESIGN` with no immediate edit/retry/rerun; do not route to Luna.

## 31. Revision r22 — no active Luna handoff / receipt persistence

Design Lock Section 38 and the latest explicitly labeled Issue #172 r22 byte-lock comment are the sole active cursor. Sections 21-30 remain immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, QA, retry, promotion, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until r22 four-path publication/byte lock and Design Lock 19/19; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `4191afe2fe84283125c0e9ec817185c94685630c`
- `LAST_AUDITED_TREE`: `cb808fff195d58fd96718cb8381f7f9091e9f313`
- `FAILED_GATE`: post-r21 execution audit after a first-attempt passing Chromium 844x390 Mayo-only process; internal stable checkpoint receipts were not copied into serialized checkpoint results; later Phase G/full deployment/commit/push not run
- `LAST_GREEN_GATE`: r21 source/static and Mayo 6/6 pixel/PNG/contact-sheet control; not final r22 evidence
- `CLASSIFICATION`: `QA_EVIDENCE_PERSISTENCE_GAP / VERIFIED_RUNTIME_CHECKPOINT_RECEIPT_OMITTED_FROM_SUMMARY / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `CHECKPOINT_RECEIPT_SERIALIZATION / EXACT_ACCEPTED_RECEIPT + STATIC_AND_RUNTIME_SUMMARY_ASSERTION / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `5`; material candidate 6; workflow-only restoration 7
- `SAME_GATE_REPEAT_COUNT`: `3`; `DEFERRED_STAGE24_REPEAT_COUNT`: `1`; `DEPLOYMENT_736_REPEAT_COUNT`: `2`; `DEPLOYMENT_844_REPEAT_COUNT`: `1`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r22 publication and green Design Lock proof
- `RESUME_FROM`: preserve exact r21 seven-path draft/app bytes -> r22 four-path byte lock -> runner/test receipt serialization only -> source/static/lint/build/diff/byte -> one new Chromium 844x390 Mayo-only process with five persisted receipts -> fresh Phase G Stage 6/24/ordered 3/3 -> full Chromium -> full WebKit -> atomic iteration-6 candidate -> automatic focused complete green -> unfiltered/full/runtime/human -> read-only `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only release loop

The r21 runtime semantic latch is accepted and must remain byte-identical. For the five checkpoints after `fully-inside`, the runner copies the already-verified bounded receipt into each checkpoint result only after asserting exact schema, fighter identity/kind, checkpoint, x/y, progress, and canonical minimum. `fully-inside` stores `checkpointReceipt: null`. No ref/history/full snapshot, product state, threshold input, second arm, retry, or extra attempt is allowed.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r22` and Issue #172.** Preserve the r21 app latch and all seven draft paths. Publish/byte-lock the four r22 design/source paths, then edit only the runner checkpoint-result serializer and its existing runtime source test. Require exact 60/60, 12/12, 19/19, syntax/lint/build/diff/byte, and one new Chromium 844x390 Mayo-only process whose summary has null for `fully-inside` plus five exact persisted receipts. Then run fresh Phase G Stage 6/24/ordered 3/3 and the full Chromium/WebKit deployment gates. Any first failure returns to `SOL_DESIGN` in this same `/goal` without immediate edit/retry/rerun; do not route to Luna.

## 32. Revision r23 — no active Luna handoff / unique persisted deployment artifacts

Design Lock Section 39 and the latest explicitly labeled Issue #172 r23 byte-lock comment are the sole active cursor. Sections 21-31 remain immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, QA, retry, promotion, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until r23 four-path publication/byte lock and Design Lock 19/19; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `4191afe2fe84283125c0e9ec817185c94685630c`
- `LAST_AUDITED_TREE`: `cb808fff195d58fd96718cb8381f7f9091e9f313`
- `FAILED_GATE`: first r22 full Chromium deployment post-run artifact readback; 288 logical PNG records mapped to only 252 unique paths and 48 logical sheets mapped to only 42 unique paths because Kumaverson and Medic shared family-only destinations; later Medic bytes overwrote every Kumaverson destination; no WebKit full deployment/commit/push
- `LAST_GREEN_GATE`: r22 final source/static, bounded Mayo receipt/PNG control, and fresh r22 Stage 6 3/3, Stage 24 3/3, ordered trio 3/3. Full Chromium's exit-zero result is invalid evidence and all r22 controls are diagnosis-only after runner changes
- `CLASSIFICATION`: `QA_EVIDENCE_ARTIFACT_IDENTITY_COLLISION / SHARED_FAMILY_FILENAME + LAST_WRITER_WINS_PNG_AND_CONTACT_SHEET_OVERWRITE / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `DEPLOYMENT_ARTIFACT_UNIQUE_IDENTITY_AND_INTEGRITY / FAMILY_PLUS_KIND_FILENAME + PRE-PASS_UNIQUE_PATH_AND_DISK_SHA_ASSERTION / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `5`; material candidate remains 6; workflow-only restoration remains 7
- `SAME_GATE_REPEAT_COUNT`: `3`; `DEFERRED_STAGE24_REPEAT_COUNT`: `1`; `DEPLOYMENT_736_REPEAT_COUNT`: `2`; `DEPLOYMENT_844_REPEAT_COUNT`: `1`; `DEPLOYMENT_ARTIFACT_COLLISION_REPEAT_COUNT`: `1`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r23 publication and green Design Lock proof
- `RESUME_FROM`: preserve exact r22 seven-path draft/app bytes -> r23 four-path byte lock -> runner/test family-plus-kind paths and pre-pass unique-path/final-disk-SHA integrity -> source/static/lint/build/diff/byte -> Chromium 667x375 Kumaverson+Medic once -> fresh r23 Stage 6/24/ordered 3/3 -> full Chromium 288+48 unique/disk-verified artifacts -> 48 one-attempt WebKit units -> atomic iteration-6 candidate -> automatic focused complete green -> workflow-only iteration-7 restoration -> full/unfiltered/runtime/human -> clean fixed-HEAD `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only release loop

The correction is evidence-only. Checkpoint paths must include `${unit.family}-${unit.kind}` and contact sheets must include `${family}-${kind}`. Before terminal pass, the runner inventories all recorded checkpoint and sheet paths, requires logical counts, combined path uniqueness, non-empty regular files, and exact recorded-to-final-disk SHA-256 equality, and persists the bounded integrity result in `summary.json`. This applies even to filtered/noncanonical runs. Equal content hashes are allowed; equal paths are not. Product, app bytes, gameplay, render, checkpoint, pixel, timeout, retry, viewport, Phase G, workflow, public/package, and CI-BOM contracts do not change.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r23` and Issue #172.** Preserve all seven current draft paths and the r21 app bytes. Publish/byte-lock the four r23 design/source paths, then edit only the deployment runner and its existing runtime source test to add family-plus-kind filenames and fail-closed unique-path/final-disk-SHA integrity. Require 60/60, 12/12, 19/19, syntax/lint/build/diff/byte, one fresh Chromium 667x375 Kumaverson+Medic process with 12+2 unique verified artifacts, fresh r23 Stage 6/24/ordered 3/3, full Chromium with 288+48 unique verified artifacts, and 48 fresh WebKit unit processes. Any first failure returns to `SOL_DESIGN` in this same `/goal`; do not route to Luna, retry, rerun, micro-patch, commit, push, or promote.

## 33. Revision r24 — no active Luna handoff / canonical revision identity alignment

Design Lock Section 40 and the latest explicitly labeled Issue #172 r24 byte-lock comment are the sole active cursor. Sections 21-32 remain immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, QA, retry, promotion, or release decision.

- `STATUS`: `NO_ACTIVE_LUNA_HANDOFF`
- `CURRENT_OWNER`: `SOL`
- `ROLE_LOCK`: `SOL_DESIGN` until r24 four-path publication/byte lock and Design Lock 19/19; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `97e6bc60a9130c68b8a1cfcd86b7b76b9d769478`
- `LAST_AUDITED_TREE`: `f9ff663dd8e3c36f8553153fe1d4fc3d5b0d4727`
- `FAILED_GATE`: post-push canonical source audit before acceptance of queued CI #923; active r23 sections existed, but Design/Handoff/Project State current revision declarations and their positive source assertions remained r22
- `LAST_GREEN_GATE`: r23 final local source/static/lint/build/diff/byte, targeted Chromium 14/14, fresh Phase G Stage 6/24/ordered 3/3, full Chromium 336/336, and full WebKit 48/48 processes/336 artifacts; all are diagnosis/remediation controls after exact HEAD changes
- `CLASSIFICATION`: `SOL_OWNED_CANONICAL_REVISION_HEADER_DRIFT / R23_SECTIONS_PUBLISHED_WITH_R22_DESIGN_HANDOFF_PROJECT_STATE_HEADERS_AND_POSITIVE_ASSERTIONS / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `CANONICAL_REVISION_IDENTITY_ALIGNMENT / R24_HEADER_SUMMARY_CURSOR_AND_NEGATIVE_STALE_ASSERTIONS / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `6`; r24 docs/test-only candidate is iteration 7; workflow-only restoration is iteration 8
- `CANONICAL_REVISION_HEADER_DRIFT_REPEAT_COUNT`: `1`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r24 publication and green Design Lock proof
- `RESUME_FROM`: preserve r23 product/runtime/runner bytes and remote commit -> correct only Design/Handoff/Project State/design-test current revision identity -> byte lock and source gates -> atomic iteration-7 docs/test candidate -> one automatic focused r24 run -> complete green -> workflow-only iteration-8 restoration -> exact-HEAD full/unfiltered/runtime/human -> read-only `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release loop

The r24 correction is canonical docs/test ownership only. It changes no product, app, runner, runtime evidence, gameplay, balance, AI, render, artifact, timeout, retry, viewport, Phase G, workflow, public/package, lockfile, CI-BOM, or release-request byte. The source test must positively require r24 in all active headers/cursor and negatively reject r22/r23 there while retaining historical r22/r23 audit sections.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r24` and Issue #172.** Preserve remote r23 commit/tree and every non-design blob. Correct only the four named design/source paths, prove 60/60, 12/12, 19/19, syntax/lint/build/diff/byte, publish one atomic docs/test-only iteration-7 candidate, and accept only its one automatic focused run. Any first failure returns to `SOL_DESIGN` in this same `/goal`; do not route to Luna, retry, rerun, micro-patch, or promote.

## 34. Revision r25 — no active Luna handoff / WebKit lifecycle isolation

Design Lock Section 41 and the latest explicitly labeled Issue #172 r25 byte-lock comment are the sole active cursor. Sections 1-33 remain immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, QA, retry, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the r25 four-path Issue byte lock and Design Lock 19/19
- `LAST_AUDITED_HEAD`: `585eed74e5725e40f992ef4c7f85a0179ae2ae8f`
- `LAST_AUDITED_TREE`: `09f04dd9b6bdadef99c9b71ddc2cad5553077c1f`
- `FAILED_GATE`: terminal automatic focused CI `32687912194` (#924), attempt 1 — Phase G `97319047736` clean Stage 24 page crash, WebKit deployment 844x340 `97320937838` clean Ranger/half page crash, and 844x390 `97320937859` clean Crazy King/fixture page crash; no rerun
- `LAST_GREEN_GATE`: all other executable r24 jobs, including PR Verify, six enemy-runtime, hosted-runner, three Stage 3, and deployment 667x375/736x414/932x430/1280x720; r23 local controls are comparison-only
- `CLASSIFICATION`: `REMOTE_WEBKIT_QA_LIFECYCLE_COUPLING / PHASE_G_CROSS_CAPTURE_BROWSER_REUSE + DEPLOYMENT_DIAGNOSTIC_PAGE_IO_REENTRANCY / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `WEBKIT_QA_CAPTURE_LIFECYCLE_ISOLATION / FRESH_PHASE_G_BATTLE_EXTRA_BROWSER_PER_CAPTURE + COOPERATIVE_SINGLE_PAGE_IO_DEPLOYMENT_TRACE / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `7`; r25 material candidate is iteration 8; workflow-only restoration is iteration 9
- `SAME_GATE_REPEAT_COUNT`: `4`; `DEFERRED_STAGE24_REPEAT_COUNT`: `2`; `R24_REMOTE_DEPLOYMENT_CLEAN_CRASH_COUNT`: `2`
- `ROLE_LOCK`: `SOL_DESIGN` until r25 four-path publication/byte lock and Design Lock 19/19; then `SOL_REMEDIATION`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r25 publication and green Design Lock proof
- `RESUME_FROM`: preserve exact r24 product bytes -> r25 four-path byte lock -> Phase G fresh WebKit battle-extra process plus cooperative deployment page-I/O in four runner/test paths -> 60/60 + 12/12 + 19/19 + syntax/lint/build/diff/byte -> Stage 6/24/ordered 3/3 -> 844x340 Ranger 3/3 + 844x390 Crazy King 3/3 -> full Chromium/WebKit deployment -> atomic iteration-8 candidate -> one automatic focused run -> complete green -> workflow-only iteration-9/full/unfiltered/runtime/human -> `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release loop

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r25` and Issue #172.** Byte-lock the four r25 design/source paths, then edit only the four locked runner/test paths. Give every WebKit battle-extra capture a fresh process with persisted one-capture session proof, and make deployment trace reads cooperative with the main flow and overlap-wait zero. Preserve all product bytes, timeouts, attempts, checkpoints, causal/pixel/artifact thresholds, and release boundaries. Any first failure returns to `SOL_DESIGN`; do not route to Luna, retry, rerun, or micro-patch.

## 35. Revision r26 — no active Luna handoff / contact-first live-target continuity

Design Lock Section 42 and the latest explicitly labeled Issue #172 r26 byte-lock comment are the sole active cursor. Sections 1-34 remain immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, QA, retry, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the r26 four-path Issue byte lock and Design Lock 19/19
- `LAST_AUDITED_HEAD`: `585eed74e5725e40f992ef4c7f85a0179ae2ae8f`
- `LAST_AUDITED_TREE`: `09f04dd9b6bdadef99c9b71ddc2cad5553077c1f`
- `FAILED_GATE`: first r25 local ordered acceptance, run 2 position 3 Stage 25 WebKit 932x430; fresh process remained live/fatal-zero, monotonic shield-to-living-Ranger target history existed, current humans reached zero, exact shield attack/causal proof never occurred, and the unchanged 45,000 ms proof wait expired; ordered run 3 and later gates were not run
- `LAST_GREEN_GATE`: r25 source/static, Stage 6 standalone 3/3, Stage 24 standalone 3/3, ordered run 1 all positions, and ordered run 2 positions 1-2; runtime evidence is comparison-only after r26 Phase G bytes change
- `CLASSIFICATION`: `QA_HARNESS_CONTACT_FIRST_TARGET_CONTINUITY_DEADLOCK / MONOTONIC_LIVING_TARGET_HISTORY_STOPS_FRONTLINE + SUPPRESSES_REAL_CARD_REDEPLOY_BEFORE_PROOF_ATTACK / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `PHASE_G_CONTACT_FIRST_LIVE_TARGET_CONTINUITY / HISTORICAL_TARGET_EVIDENCE_ONLY + REAL_CARD_SURVIVAL_REDEPLOY_WHILE_ATTACK_PENDING / DESIGN_CHANGE_REQUIRED`
- `LOOP_ITERATION`: `7`; material candidate remains iteration 8; workflow-only restoration remains iteration 9
- `SAME_GATE_REPEAT_COUNT`: `4`; `DEFERRED_STAGE24_REPEAT_COUNT`: `2`; `R24_REMOTE_DEPLOYMENT_CLEAN_CRASH_COUNT`: `2`; `R25_LOCAL_STAGE25_PROOF_ATTACK_REPEAT_COUNT`: `1`
- `ROLE_LOCK`: `SOL_DESIGN` until r26 four-path publication/byte lock and Design Lock 19/19; then `SOL_REMEDIATION`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r26 publication and green Design Lock proof
- `RESUME_FROM`: preserve exact r25 eight-path draft/evidence -> r26 four-path byte lock -> change only Phase G runner/checkpoint test for live-target continuity -> 60/60 + 12/12 + 19/19 + syntax/lint/build/diff/byte -> fresh Stage 6/24/25 standalone 3/3 each + ordered trio 3/3 -> r25 targeted/full deployment acceptance -> atomic iteration-8 candidate -> one automatic focused run -> complete green -> workflow-only iteration-9/full/unfiltered/runtime/human -> `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release loop

The exact correction is finite. Keep monotonic target history and `hasHumanTarget` as r13 acceptance evidence, add current-snapshot-only `hasLiveHumanTarget`, and use only the latter in contact-first deployment early-break decisions. Add pure `proofActorTargetContinuityDecision`. While the boss is engaged, contact-first attack is pending, and fewer than two live humans remain, it may enable exactly the existing trusted `sustain-redeploy` real-card pointer after opening deployment. It cannot create or mutate a fighter, target, attack, audio, resource, HP, clock, state, AI, checkpoint, or product contract. Do not set Stage 25 `keepHumanTargetAlive`, change its formation, widen 45 seconds, retry, or weaken exact target/attack/four-axis causal proof.

Paths 1-4 are SOL-owned design/source publication. Under `SOL_REMEDIATION`, edit only `scripts/v100-phase-g-production-matrix.mjs` and `tests/v100-phase-g-checkpoint.test.mjs`; preserve the r25 cooperative deployment runner/test bytes. Extend the existing `V100_PHASE_G_CAUSAL_HISTORY_PROBE` and existing checkpoint test block without changing the 12/60/19 counts. After static green, require new Stage 6/24/25 standalone 3/3 and ordered 3/3 evidence on final bytes, then the unexecuted r25 targeted/full deployment matrix. Any first failure returns to `SOL_DESIGN` with raw evidence and no edit/retry/rerun.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r26` and Issue #172.** Byte-lock the four r26 design/source paths, then change only the Phase G runner/checkpoint test to separate historical target evidence from current live-target continuity and enable the existing real-card survival redeploy while contact-first attack proof is pending. Preserve all r25 lifecycle/deployment bytes, product bytes, timeouts, attempts, target/causal acceptance, and release boundaries. Run the exact Section 42 sequence once; any first failure returns to `SOL_DESIGN` without Luna, retry, rerun, or micro-patch.

## 36. Revision r27 — no active Luna handoff / finite WebKit host-process diagnostics

- `ROLE_LOCK`: `SOL_DESIGN` until the four SOL-owned design/source files are byte-locked in Issue #172 and Design Lock 19/19 is green; then `SOL_REMEDIATION`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after that lock. Luna remains stopped and receives no handoff.

### Classification and immutable input

- exact rejected candidate: HEAD `8e914497272a45ecb7e0558546b05fd4f1bd6cac`, tree `310742c60cba2ee07ba4f9acd8bd9d23b7fa8db8`
- terminal automatic focused CI: #925 / run `32697709716`, attempt 1
- Phase G failure: job `97346394306`, artifact `9509889112`, `remote-trio-1` position 2 Stage 24, fresh browser, two accepted real deployments, fatal zero, last readable live state at 16,207 ms, page crash at 57,361 ms
- deployment failures: job `97347974699`, artifact `9510070531`, 667x375 Tatara after two completed checkpoints; job `97347974482`, artifact `9510311447`, 844x340 Mayo-chan after one completed checkpoint. Both used fresh one-attempt child processes, cooperative page-I/O with overlap-wait zero, fatal zero, and no retry
- same-run green controls: every source/nondeployment required job plus deployment 736x414, 844x390, 932x430, and 1280x720
- aggregate classification: `REMOTE_WEBKIT_CLEAN_PAGE_CRASH_RECURRENCE / FRESH_PHASE_G_AND_COOPERATIVE_DEPLOYMENT_PAGES + PROCESS_RESOURCE_OWNER_UNOBSERVED / DESIGN_CHANGE_REQUIRED`
- remediation class: `WEBKIT_HOST_PROCESS_RESOURCE_TELEMETRY / PROC_CGROUP_DESCENDANT_LIFECYCLE + PAGE_CRASH_CORRELATION + ZERO_ACCEPTANCE_CHANGE / DESIGN_CHANGE_REQUIRED`

Do not infer product, gameplay, a named unit/viewport, OOM, native WebContent, browser root, or surviving-renderer ownership without r27 telemetry. Preserve all r25/r26 behavior and evidence predicates exactly.

### Exact execution packet

Relative to clean r26 HEAD, the r27 delta is exactly ten paths: Design Lock, this Handoff, Project State, Design Lock test, new `scripts/webkit-host-resource-telemetry.mjs`, Phase G runner/checkpoint test, deployment bounded parent, deployment browser harness, and deployment runtime source test. Under `SOL_REMEDIATION`, only the six runner/helper/test paths may change; the four design/source paths are locked bytes.

Implement exactly Section 43.2:

1. one host-only, no-spawn/no-exec/no-page/no-input/no-env-mutation Linux `/proc` + cgroup v2 + pressure JSONL recorder at serialized 500 ms cadence, with sanitized descendant roles/resources, event correlation, disappearance tracking, and bounded final summary;
2. truthful non-Linux `supported: false / linux-proc-cgroup-unavailable` fallback;
3. per-fresh-page Phase G WebKit battle-extra recorder attached after page creation and before route configuration, retained through page/context/browser lifecycle and existing failure artifact;
4. per-child deployment recorder owned by the existing WebKit lifecycle plus one parent recorder across canonical unit child start/exit boundaries;
5. existing test blocks only, with positive telemetry ownership and negative child-process/page/input/environment assertions;
6. zero changes to `app/**`, `.github/**`, workflow/package/public/release bytes, browser version/flags, product behavior, timeout, existing polling, retry/attempt, route/order, pointer, checkpoint, causal, pixel, screenshot, or artifact acceptance.

### Acceptance and exact cursor

Run in this order: exact topology/byte/EOL/BOM/diff audit -> three-script syntax -> helper import/fallback -> load-only 7/7 -> focused 60/60 -> checkpoint 12/12 -> Design Lock 19/19 -> deployment/runtime 3/3 -> lint -> build -> one local Stage 24 and fresh 667x375 Tatara plus 844x340 Mayo integration -> atomic iteration-9 diagnostic commit -> normal non-force push -> one automatic focused attempt 1.

The remote diagnostic result always returns to `SOL_DESIGN`, including complete green. Green is `DIAGNOSTIC_NO_REPRODUCTION`, not promotion. Any failure retains its first evidence; no rerun, retry, micro-patch, or stale substitution. SOL uses cgroup deltas and descendant-role survival/disappearance to select host-resource, WebContent/native, browser-root, renderer/page-I/O liveness, diagnostic-source, or inconclusive ownership before an iteration-10 remediation. Workflow-only unfiltered restoration is iteration 11 and remains forbidden until the later remediation candidate has complete focused green.

- `LAST_AUDITED_HEAD`: `8e914497272a45ecb7e0558546b05fd4f1bd6cac`
- `LAST_AUDITED_TREE`: `310742c60cba2ee07ba4f9acd8bd9d23b7fa8db8`
- `FAILED_GATE`: CI #925 Phase G Stage 24 plus deployment 667x375 Tatara and 844x340 Mayo-chan clean page crashes; canonical HUD dependency-skipped
- `LAST_GREEN_GATE`: exact r26 local complete acceptance and the listed remote green controls; comparison only
- `NEXT_OWNER`: `SOL_REMEDIATION` only after r27 byte lock and Design Lock 19/19
- `RESUME_FROM`: clean r26 -> finite telemetry implementation/local integration -> atomic diagnostic iteration 9 -> one automatic remote attempt -> mandatory SOL_DESIGN classification

The release tail remains unchanged: later coherent remediation -> complete focused green -> workflow-only iteration 11 -> same-HEAD full/unfiltered/runtime/human -> fixed-HEAD read-only/adversarial `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> explicit approval only -> stacked integration/tag/Release/official Pages/published-SHA QA/recovery/closure.

`High ambiguity: 0`. `Medium ambiguity: 0`.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r27` and Issue #172.**

## 37. Revision r28 — no active Luna handoff / fail-closed three-axis WebKit diagnostics

Design Lock Section 44 and the latest explicitly labeled Issue #172 r28 byte-lock comment are the sole active cursor. Sections 1-36 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r28 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `63eb718fa81ad378c71098c8e01798ea18d4ca4c`
- `LAST_AUDITED_TREE`: `a675ee258d2fa65114fda6b5cb9c0ca645e5494a`
- `FAILED_GATE`: terminal automatic CI #926 / run `32704113198`: Phase G `97366143168` Stage 25 page crash masked by a generic cooldown invariant; Hosted `97364691262` visual WebKit termination; Stage 3/deployment/HUD dependency-skipped
- `LAST_GREEN_GATE`: same-HEAD PR Verify, six enemy-runtime shards, Phase G Stage 6 and Stage 24, Hosted safe-area 11/11 and records 5/5; comparison only
- `CLASSIFICATION`: `R27_DIAGNOSTIC_EVIDENCE_INVALID_AND_INCOMPLETE / MASKED_PHASE_G_PAGE_CRASH + HOSTED_VISUAL_PAGE_TERMINATION + DEPLOYMENT_UNOBSERVED / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `WEBKIT_PROCESS_EVIDENCE_FAIL_CLOSED / PROC_SELF_ROOT + WPE_ROLE_LIFECYCLE + PRIMARY_CRASH_LATCH + HOSTED_AND_DEPLOYMENT_TERMINAL_OBSERVATION / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until the r28 byte lock and 19/19; then `SOL_REMEDIATION`; the automatic result always returns to `SOL_DESIGN`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after that lock. Luna remains stopped
- `RESUME_FROM`: clean r27 -> nine-path diagnostic repair -> exact source/static/local bounded controls -> atomic iteration 10 -> one automatic three-axis observation -> mandatory SOL_DESIGN owner classification

Exact SOL execution packet:

1. Change only the nine remediation paths named in Section 44.2. Repair Linux telemetry around `/proc/self`, robust stat parsing, bounded descendant fallback, WPE role recognition, and fail-closed root/WebContent validity. Update both existing deployment telemetry callers so invalid Linux telemetry fails an otherwise passing axis but remains secondary to a prior page/unit failure.
2. Latch and preserve the first Phase G `page-crash` as primary over later generic cooldown/locator/evaluate messages. Do not change any existing acceptance or deadline.
3. Give Hosted visual exactly one WebKit attempt, attach process/page/browser lifecycle telemetry before launch, and persist its terminal report on failure. Do not discard first-failure arrays.
4. Add `DEBUG: pw:browser` to Phase G and Hosted visual. Keep the existing deployment debug setting.
5. Temporarily execute the unchanged six-case deployment matrix with job-level `always()` even when Hosted/Stage 3 is red, while adding Hosted as a direct canonical-HUD dependency so diagnostic deployment can never unlock promotion. No `continue-on-error`; all job results remain hard.
6. Prove the exact thirteen-path topology, parser/validity/crash precedence, existing test counts, CI dependency contract, syntax/load/focused/runtime/lint/build/diff/byte gates, non-Linux fallback, and the three bounded local regression controls. Publish one normal atomic iteration-10 commit and accept one automatic run only.
7. Return to `SOL_DESIGN` whether red or green. Classify Phase G, Hosted, and deployment independently from valid process/cgroup/native stderr evidence. No additional diagnostic revision is allowed unless r28 itself fails its explicit diagnostic-source validity contract.

The release tail is unchanged: owner-specific iteration-11 remediation -> complete focused green -> workflow-only iteration-12 restoration -> exact-HEAD full Phase G 54/54/validators/regressions/unfiltered remote/runtime/human/save/PWA/asset/release audits -> fixed-HEAD read-only/adversarial `SOL_FINAL_REVIEW` -> one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT` -> approval-only stacked integration/tag/Release/official Pages/published-SHA QA/recovery/closure.

`High ambiguity: 0`. `Medium ambiguity: 0`.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r28` and Issue #172.**

## 38. Revision r29 — no active Luna handoff / owner-specific WebKit QA correction

Design Lock Section 45 and the latest explicitly labeled Issue #172 r29 byte-lock comment are the sole active cursor. Sections 1-37 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r29 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `2328e28a6678d56c65582fa07f9b5cff470d8799`
- `LAST_AUDITED_TREE`: `6781c750a7901324462039003ce12c16ad6c58a3`
- `FAILED_GATE`: automatic CI #927 / run `32709911420`: PR Verify Linux mock/default-telemetry mismatch, Hosted cross-case WebKit termination, five deployment viewport QA-only frozen-audit terminations; Phase G and Stage 3 dependency-skipped; no retry/rerun
- `LAST_GREEN_GATE`: same-HEAD six enemy-runtime shards, Hosted safe-area 11/11 and records 5/5, deployment 667x375 eight units/48 checkpoints, and local r28 controls; comparison-only
- `CLASSIFICATION`: `SOL_OWNED_QA_WEBKIT_EXECUTION_BOUNDARIES / LINUX_MOCK_TELEMETRY_REALISM + HOSTED_CROSS_CASE_BROWSER_LIFETIME + DEPLOYMENT_FULL_WORLD_PIXEL_AUDIT_SURFACES / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `WEBKIT_QA_CASE_AND_REGION_OWNERSHIP / TEST_ONLY_TELEMETRY_INJECTION + FRESH_HOSTED_BROWSER_PER_CASE + REGION_LOCAL_FROZEN_PIXEL_AUDIT / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until the r29 byte lock and 19/19; then `SOL_REMEDIATION`; any failed gate returns to `SOL_DESIGN`
- `LOOP_ITERATION`: r29 owner-specific candidate is iteration 11; workflow-only unfiltered restoration remains iteration 12
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the r29 Issue byte lock and green Design Lock proof
- `RESUME_FROM`: exact clean r28 HEAD/tree -> r29 four-path byte lock -> exact five-path implementation -> source/static plus bounded browser controls -> atomic nine-path iteration-11 candidate -> one automatic focused run -> complete green only -> workflow-only iteration-12 restoration -> exact-HEAD full/unfiltered/runtime/human -> read-only/adversarial `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release tail

Exact SOL execution handoff:

1. Change only the five implementation/test paths in Section 45.2 after the four design paths are byte-locked. Preserve the r28 diagnostic workflow topology and every product/acceptance byte outside the named QA-only function.
2. Add the test-only deployment telemetry factory boundary with production default identity and primary-error precedence; use deterministic unsupported and supported-invalid fixtures inside the existing three test blocks.
3. Give each Hosted ready/fault case one fresh browser and close/await it after the case. Keep the exact cases, order, assertions, report, artifacts, timeouts, and one attempt.
4. Make only the QA-only `fighterUnitLayerPixelAudit` unit/foreground/composite surfaces region-sized with integer world-to-region translation and `(0,0,width,height)` reads. Product draw order, crop, pixels, thresholds, checkpoints, and public canvas remain unchanged.
5. Require final syntax/load, bounded deployment 3/3, runtime evidence 3/3, focused 60/60, Design Lock 19/19, lint/build/diff/byte/topology/negative audits; then Chromium 844x340/brute, the five exact WebKit deployment pairs, Hosted 844x340 ready plus mission/delay 844x340, and ordered Phase G Stage 6 -> Stage 24 -> Stage 25 3/3 as fixed in Section 45.3. Do not rerun a failed command before returning to `SOL_DESIGN`.
6. If all local gates are green, create one atomic exact nine-path iteration-11 commit, normal non-force push, exact ref/tree/compare readback, and accept only its automatic CI attempt. Any red returns to `SOL_DESIGN` without immediate edit/retry. Complete automatic focused green alone authorizes workflow-only iteration 12, not readiness or release.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r29` and Issue #172.**

## 39. Revision r30 — no active Luna handoff / approved-pixel atlas and PWA transport correction

Design Lock Section 46 and the latest explicitly labeled Issue #172 r30 byte-lock comment are the sole active cursor. Sections 1-38 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r30 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `2962be753c2c3e8741a523a4d67a3092f1d90b50`
- `LAST_AUDITED_TREE`: `7effc512b6969759ceea2d62aa5a8d2ed1502747`
- `FAILED_GATE`: terminal automatic CI #928 / run `32716292056`, attempt 1: only Phase G `97402460108`, Stage 24 WebKit 736x414 WPE WebContent termination; exact clean-HEAD PWA raster check independently reports six stale V1 motion derivatives; no retry/rerun
- `LAST_GREEN_GATE`: same-HEAD 65/66 CI jobs and exact r29 local gates; comparison-only
- `CLASSIFICATION`: `V1_RUNTIME_ATLAS_PACKING_AND_TRANSPORT_CONSISTENCY / OVERSIZED_TRANSPARENT_CELL_SURFACES + SIX_STALE_PWA_DERIVATIVES / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `V1_APPROVED_PIXEL_PRESERVING_ATLAS_REPACK / 544PX_CENTERED_CELLS + EXACT_VISIBLE_AND_DISPLAY_GEOMETRY_HASHES + LOSSLESS_PWA_REGENERATION / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until r30 byte lock and 19/19; then `SOL_REMEDIATION`; any first failure returns to `SOL_DESIGN`
- `LOOP_ITERATION`: r29 iteration 11 rejected; r30 material candidate is iteration 12; workflow-only restoration becomes iteration 13
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the r30 Issue byte lock and green Design Lock proof
- `RESUME_FROM`: exact clean r29 HEAD/tree -> r30 four-path byte lock -> exact 25 material/generated paths -> reproducible source/static/browser acceptance -> atomic 29-path iteration-12 candidate -> one automatic focused run -> complete green only -> workflow-only iteration-13 restoration -> exact-HEAD full/unfiltered/runtime/human -> read-only/adversarial `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release tail

Exact SOL execution handoff:

1. Change only the 25 material/generated paths after the four design paths are byte-locked. Set the six custom atlas cells to 544 x 512, preserve the exact common scale and every approved bounded RGBA pixel, subtract the 368 px centered transparent crop from manifest x coordinates, and change no renderer/gameplay/animation behavior.
2. Generate in this order: V1 runtime assets, lossless PWA raster derivatives, asset manifest. After each command require only its Design Lock Section 46 allowlist; repeat/check each generator and require zero drift. The final cumulative topology is exactly 29 paths.
3. Require the six approved visible hashes, exact 84-record display geometry hash `93e48efa1692b14a61d2de29641570cd10d2f02149f85d9f89815f68861ff53d`, six unchanged common scales, exact 76.50 MiB decoded budget, 16 px gutters, flip/state/source/provenance contracts, and logical-PNG/PWA alpha plus visible-RGB equality.
4. Run Section 46.3 source/static/lint/build/diff/byte/topology gates once, then fresh Stage 24 standalone 3/3, Stage 25 standalone 3/3, and ordered Stage 6 -> Stage 24 -> Stage 25 3/3 on final bytes. Do not use r29 captures as candidate proof.
5. If all local gates pass, create one atomic exact 29-path iteration-12 commit, normal non-force push, exact ref/tree/compare readback, and accept only its automatic CI attempt. Any red returns to `SOL_DESIGN` with first evidence and no edit/retry/rerun. Complete focused green only authorizes workflow-only iteration 13, not readiness or release.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r30` and Issue #172.**

## 40. Revision r31 — no active Luna handoff / exact ordered invocation and reaction-history continuity

Design Lock Section 47 and the latest explicitly labeled Issue #172 r31 byte-lock comment are the sole active cursor. Sections 1-39 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r31 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `2962be753c2c3e8741a523a4d67a3092f1d90b50`
- `LAST_AUDITED_TREE`: `7effc512b6969759ceea2d62aa5a8d2ed1502747`
- `FAILED_GATE`: the first r30 ordered-local command omitted `V100_PHASE_G_ONLY=battle-extra` and `V100_PHASE_G_ONLY_ENGINE=webkit`, entered the full matrix, and stopped before Stage 6 at Chromium 1280x720 battle-normal; source/contact/audio true, target reaction false, 81 samples, a real impact pending for 0.02 seconds, live page, fatal diagnostics zero; no retry/rerun/edit
- `LAST_GREEN_GATE`: exact r30 generator/source/static/lint/build/byte audits and fresh Stage 24 standalone 3/3 plus Stage 25 standalone 3/3; comparison-only after runner proof bytes change
- `CLASSIFICATION`: `QA_HARNESS_EPHEMERAL_TARGET_REACTION_HISTORY_GAP / 40MS_OBSERVER_REACTION_NOT_SERIALIZED + 120MS_CONSUMER_BOUNDARY / DESIGN_CHANGE_REQUIRED`; independent `SOL_LOCAL_EXECUTION_CONTRACT_OMISSION / ORDERED_COMMAND_MISSING_BATTLE_EXTRA_AND_WEBKIT_FILTERS / INVALID_CURRENT_GATE_OBSERVATION`
- `REMEDIATION_CLASS`: `QA_CAUSAL_REACTION_HISTORY_CONTINUITY / ACTUAL_40MS_REACTION_RECORDS + 96_RECORD_FIRST_OBSERVED_BOUND + EXACT_FOCUSED_ORDERED_PREFLIGHT / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until r31 byte lock and 19/19; then `SOL_REMEDIATION`; any first failure returns to `SOL_DESIGN`
- `LOOP_ITERATION`: r30 uncommitted iteration 12 returned; r31 coherent candidate is iteration 13; workflow-only restoration becomes iteration 14
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the r31 Issue byte lock and green Design Lock proof
- `RESUME_FROM`: preserve exact r30 29-path draft -> r31 four-path byte lock -> edit only runner plus existing checkpoint/causal-history tests -> full source/static/core/standalone/ordered acceptance -> atomic exact 32-path iteration-13 candidate -> one automatic focused run -> complete green only -> workflow-only iteration-14 restoration -> exact-HEAD full/unfiltered/runtime/human -> read-only/adversarial `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release tail

Exact SOL execution handoff:

1. Preserve all current r30 atlas, PNG, metadata, PWA, manifest, provenance, app-manifest, runtime-sprite, generator, runtime-motion test, and four design/source draft bytes. Do not regenerate or rebuild the 29-path draft merely because r31 changes QA proof ownership.
2. After the r31 four-path byte lock, edit only `scripts/v100-phase-g-production-matrix.mjs`, `tests/v100-phase-g-checkpoint.test.mjs`, and `tests/v100-r11-combat-causal-history.test.mjs`. In both history merge owners, retain only actual 40 ms snapshot reactions: fighter flash, knock, hurt/hit/stagger/die animation, or defined damage text. Deduplicate exact signals and keep the first 96 without eviction.
3. Propagate the structured history into samples, stable history, proof/report/failure evidence and the unchanged `targetReaction` predicate. Audio, pending hit, source edge, attack, presentation, ownership, elapsed time, or predicted future impact may never substitute. Keep all durations, cadences, timeouts, browsers, attempts, causal stages, and product behavior unchanged.
4. Extend existing test blocks only. Require real-reaction survival after empty frames, pending-hit/audio no-substitution, first-96 bound, both owners, propagation, 40 ms cadence, fixed durations, r11 4/4, checkpoint 12/12, focused 60/60, Design Lock 19/19, and all Section 47.3 static gates.
5. Run the focused Chromium battle-normal control, then fresh Stage 24 3/3 and Stage 25 3/3. For each ordered N=1..3 set exactly `V100_PHASE_G_ONLY=battle-extra`, `V100_PHASE_G_ONLY_ENGINE=webkit`, no `V100_PHASE_G_ONLY_VARIANT`, a unique sequence id and evidence root; require exactly Stage 6/24/25 and sessions `webkit-1/2/3`. Do not use an unfiltered command and do not rerun a first red.
6. Only complete local green authorizes one atomic exact 32-path iteration-13 commit, normal non-force push, exact ref/tree/compare readback, and its one automatic focused attempt. Complete focused green alone authorizes workflow-only iteration 14, not Ready or release.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r31` and Issue #172.**

## 41. Revision r32 — no active Luna handoff / observer lifetime covers causal proof

Design Lock Section 48 and the latest explicitly labeled Issue #172 r32 byte-lock comment are the sole active cursor. Sections 1-40 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r32 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `2962be753c2c3e8741a523a4d67a3092f1d90b50`
- `LAST_AUDITED_TREE`: `7effc512b6969759ceea2d62aa5a8d2ed1502747`
- `FAILED_GATE`: correctly filtered r31 Chromium battle-normal control; 1280x720 completed, first 844x390 attempt failed with 88 samples, source/contact/audio true, actual reaction/history empty, live page and fatal diagnostics zero; 844x340 and every later browser/commit/remote gate were not run; no retry/rerun/edit
- `LAST_GREEN_GATE`: complete r31 source/static/material/lint/build gates plus Chromium 1280x720 production screenshot; comparison-only after observer-lifecycle bytes change
- `CLASSIFICATION`: `QA_HARNESS_COMBAT_OBSERVER_LIFETIME_GAP / OBSERVER_STOPS_IN_CONFIGURE_BEFORE_CAUSAL_COLLECTION / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `QA_CAUSAL_OBSERVER_PROOF_WINDOW_OWNERSHIP / KEEP_40MS_OBSERVER_LIVE_THROUGH_COLLECTOR + STOP_IN_CAPTURE_FINALLY + EXISTING_ACTUAL_REACTION_HISTORY / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until r32 byte lock and 19/19; then `SOL_REMEDIATION`; any first failure returns to `SOL_DESIGN`
- `LOOP_ITERATION`: r31 uncommitted iteration 13 returned; r32 coherent candidate is iteration 14; workflow-only restoration becomes iteration 15
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the r32 Issue byte lock and green Design Lock proof
- `RESUME_FROM`: preserve exact r31 32-path draft -> r32 four-path byte lock -> same three-path observer-lifetime correction -> complete source/static/Chromium-core/Stage24/Stage25/exact-ordered acceptance -> atomic exact 32-path iteration-14 candidate -> one automatic focused run -> complete green only -> workflow-only iteration-15 restoration -> exact-HEAD full/unfiltered/runtime/human -> read-only/adversarial `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release tail

Exact SOL execution handoff:

1. Preserve every r30 material byte and every r31 actual-reaction history byte. The cumulative allowlist remains exactly 32 paths; add no file.
2. Edit only `scripts/v100-phase-g-production-matrix.mjs`, `tests/v100-phase-g-checkpoint.test.mjs`, and, only if required by the existing block, `tests/v100-r11-combat-causal-history.test.mjs`.
3. Keep the existing 40 ms observer start in `battlePage`, remove only its stop from the `battlePage` finally, and keep sustain shutdown/error ownership unchanged. In `captureStateImpl`, wrap the unchanged causal collector in `try/finally`; keep the observer live through all samples and its stable-history read, then stop it in that finally before acceptance/screenshot/runtime promotion. Context cleanup remains terminal if configure fails before collection.
4. Do not change actual-signal allowlist, first 96, no-substitution, 40/120 ms, 12,000/4,800 ms, timeout, browser, attempt, viewport, stage, causal predicate, product, asset, workflow, package, or release bytes. Extend existing test blocks only and require the exact Section 48.2 lifecycle order.
5. Re-run all Section 48.3 static gates, then a wholly new filtered Chromium three-viewport core control. The r31 1280 screenshot cannot be promoted. Run new Stage 24 3/3, Stage 25 3/3, and three exact filtered ordered sequences only after core 3/3. Any first red returns to SOL_DESIGN with no edit/retry/rerun.
6. Only complete local green authorizes one atomic exact 32-path iteration-14 commit, normal non-force push, and one automatic focused attempt. Complete focused green alone authorizes workflow-only iteration 15, not Ready or release.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r32` and Issue #172.**

## 42. Revision r33 — no active Luna handoff / identity-bound causal target reaction

Design Lock Section 49 and the latest explicitly labeled Issue #172 r33 byte-lock comment are the sole active cursor. Sections 1-41 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r33 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `2962be753c2c3e8741a523a4d67a3092f1d90b50`
- `LAST_AUDITED_TREE`: `7effc512b6969759ceea2d62aa5a8d2ed1502747`
- `FAILED_GATE`: post-r32-green adversarial aggregate/source acceptance audit; 18/18 production captures were green, but 120/1,728 reaction records were target-less `damage-text`, including status/heal labels, and the current predicate accepts any reaction key; no commit/push/remote/retry/rerun followed
- `LAST_GREEN_GATE`: complete r32 source/static/material/lint/build and 18 fresh production browser captures; comparison-only after proof eligibility changes
- `CLASSIFICATION`: `QA_CAUSAL_TARGET_REACTION_IDENTITY_FAIL_OPEN / TARGETLESS_DAMAGE_TEXT_INCLUDES_STATUS_AND_HEAL + ANY_REACTION_PREDICATE / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `QA_CAUSAL_TARGET_REACTION_IDENTITY_BINDING / FIGHTER_ID_SIDE_KIND_ONLY + SOURCE_EDGE_TARGET_MATCH + DAMAGE_TEXT_EXCLUDED / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until r33 byte lock and 19/19; then `SOL_REMEDIATION`; any first failure returns to `SOL_DESIGN`
- `LOOP_ITERATION`: r32 uncommitted iteration 14 returned from post-green adversarial audit; r33 coherent candidate is iteration 15; workflow-only restoration becomes iteration 16
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the r33 Issue byte lock and green Design Lock proof
- `RESUME_FROM`: preserve exact r32 32-path draft -> r33 four-path byte lock -> edit only the same three QA paths -> full source/static/new Chromium core/Stage24/Stage25/exact-ordered acceptance -> atomic exact 32-path iteration-15 candidate -> one automatic focused run -> complete green only -> workflow-only iteration-16 restoration -> exact-HEAD full/unfiltered/runtime/human -> read-only/adversarial `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release tail

Exact SOL execution handoff:

1. Preserve all r30 material bytes, r31 first-96 observation continuity, and r32 observer-lifetime ownership. The cumulative allowlist remains exactly 32 paths; add no file.
2. Edit only `scripts/v100-phase-g-production-matrix.mjs`, `tests/v100-phase-g-checkpoint.test.mjs`, and `tests/v100-r11-combat-causal-history.test.mjs`.
3. In both reaction-history owners, retain only fighter `flash > 0`, `knock > 0`, and `hurt|hit|stagger|die` animation records with target id/side/kind. Remove all `damage-text` reaction records while preserving its independent status-marker parsing. Keep exact dedupe and first 96.
4. In the proof builder, reject target-less history again and require at least one identity-bound fighter reaction whose target id occurs as the target in a real source-target edge. Serialize `targetReactionHistory`; unrelated fighter reaction and damage/status/heal text cannot substitute.
5. Extend existing test blocks only; keep r11 4/4, checkpoint 12/12, focused 60/60, Design Lock 19/19, every r32 lifecycle/timing negative, and every product/material byte unchanged.
6. Invalidate r32 browser reports for promotion. Run wholly new r33 Chromium core 3/3, Stage 24 standalone 3/3, Stage 25 standalone 3/3, and ordered trio 3/3. Every one of 18 captures requires causal 4/4, nonempty identity-bound edge-matched `targetReactionHistory`, no target-less/damage-text reaction, production PNG/hash, and fatal zero. First red returns to SOL_DESIGN without edit/retry/rerun.
7. Only complete local green authorizes one atomic exact 32-path iteration-15 commit, normal non-force push, and one automatic focused attempt. Complete focused green alone authorizes workflow-only iteration 16, not Ready or release.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r33` and Issue #172.**

## 43. Revision r34 — no active Luna handoff / byte snapshots and matched WebKit runtime

Design Lock Section 50 and the latest explicitly labeled Issue #172 r34 byte-lock comment are the sole active cursor. Sections 1-42 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r34 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `e8cfc3b557e9316a33186935c98d110f33bcc5a9`
- `LAST_AUDITED_TREE`: `0bbffaf3d14114985bf9c4ba7ddca5ae0524f195`
- `FAILED_GATE`: terminal automatic CI #929 / run `32747475096`: PR Verify `97496346503` three stale byte snapshots; Stage 3 final-candidate `97503465033` two clean target losses; deployment 667x375 `97507755900` and 932x430 `97507755990` WPE WebContent disappearance/replacement; Phase G and canonical HUD dependency-skipped; no retry/rerun/edit
- `LAST_GREEN_GATE`: exact r33 local source/static/material and 18 browser captures; same remote provenance/whitespace/lint/content/build; six enemy shards, Hosted, Stage 3 entrance/base, four deployment viewports; Pages preview `32747475124` build green/deploy skipped. Comparison-only
- `CLASSIFICATION`: `SOL_OWNED_RELEASE_PREP_BYTE_SNAPSHOT_DRIFT / APPROVED_SIX_ATLAS_TRANSPORT_REDUCTION_NOT_PROPAGATED_TO_EXACT_UPDATE_BYTE_ASSERTIONS / DESIGN_CHANGE_REQUIRED`; `REMOTE_HOSTED_WEBKIT_NATIVE_RUNTIME_ENVELOPE / MULTI_HARNESS_TARGET_PROCESS_LOSS + UNPINNED_SYSTEM_DEPENDENCY_SURFACE / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `RELEASE_PREP_APPROVED_SIZE_SNAPSHOT_PROPAGATION / ONE_SIX_PATH_TRANSPORT_DELTA + ALL_COUNTS_HASH_REUSE_AND_PAYLOAD_VERIFICATION_PRESERVED / DESIGN_CHANGE_REQUIRED`; `MATCHED_PLAYWRIGHT_RUNTIME_ENVELOPE / DIGEST_PINNED_OFFICIAL_V1_56_1_NOBLE + INIT_IPC + EXACT_PACKAGE_BROWSER_PREFLIGHT + STAGE3_PROCESS_TELEMETRY / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until r34 byte lock and 19/19; then `SOL_REMEDIATION`; any first failure returns to `SOL_DESIGN`
- `LOOP_ITERATION`: r33 iteration 15 is terminal red; r34 exact eleven-path correction is iteration 16; workflow-only unfiltered restoration is iteration 17
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the r34 Issue byte lock and green Design Lock proof
- `RESUME_FROM`: preserve exact clean r33 candidate -> r34 four-path byte lock -> exact seven-path remediation -> focused 35/35 + full 1,195/1,195 and static gates -> atomic exact eleven-path iteration-16 candidate -> one automatic focused run -> complete green only -> workflow-only iteration-17 restoration retaining the pinned envelope -> exact-HEAD full/unfiltered/runtime/human -> fixed-HEAD read-only/adversarial `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release tail

Exact SOL execution handoff:

1. Keep the 28 r33 committed paths outside the Section 50.2 allowlist byte-identical. Of the four overlapping governance paths (`docs/PROJECT_STATE.md`, Design Lock, Handoff, and `tests/v100-design-lock.test.mjs`), permit only the locked r34 design/source delta. Change exactly the eleven Section 50.2 paths; no `app/**`, `public/**`, package/lock, product, asset, timeout, retry, viewport, checkpoint, pixel, causal, release-request, or acceptance change.
2. Propagate the one approved `6_309_676`-byte transport reduction to the four exact release-prep snapshots while preserving every count/hash/path/payload assertion and exactly three release-prep tests.
3. In only Phase G, Stage 3, and deployment jobs, use exact official image `mcr.microsoft.com/playwright:v1.56.1-noble@sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a`, options `--init --ipc=host`, explicit bash, and the exact preflight. Remove only those jobs' dynamic browser-install steps; keep package/browser versions and all QA commands unchanged.
4. Add the one bounded preflight source/test. Require Linux, `/ms-playwright`, package 1.56.1, Chromium 1194/141.0.7390.37 when requested, WebKit 2215/26.0, exact executable roots, and one local-data launch/evaluate/close per requested engine. No download or fallback.
5. Attach existing host-process telemetry to the Stage 3 bounded parent across its unchanged maximum two attempts. A Linux pass requires complete valid root/WebContent evidence; product failure remains primary. Do not change clean-target-close eligibility or deadline.
6. Require focused 35/35, full 1,195/1,195, content, lint, build, diff/EOL/BOM/topology and forbidden-path zero. Local Windows source checks are not Linux container proof; do not rerun or promote r33 browser evidence.
7. Only complete local green authorizes one atomic exact eleven-path iteration-16 commit, normal non-force push, and one automatic attempt. Every required job and artifact listed in Section 50.5 must be green. Any first red returns to SOL_DESIGN without edit/retry/rerun/host fallback.
8. Complete iteration-16 green alone authorizes workflow-only iteration 17 retaining the pinned envelope. It does not authorize Ready, merge, tag, Release, Pages, or final evidence.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r34` and Issue #172.**

## 44. Revision r35 — no active Luna handoff / bounded WebKit wait-owner diagnostic

Design Lock Section 51 and the latest explicitly labeled Issue #172 r35 byte-lock comment are the sole active cursor. Sections 1-43 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r35 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `a12d738ddb276c096fad6eee6490e78cb2914a51`
- `LAST_AUDITED_TREE`: `4d59d17634a7b8bbda02aaf6576abba99dd9e7de`
- `FAILED_GATE`: terminal automatic CI #930 / run `32756548112`: Hosted `97529855291`, Phase G `97531166109`, and deployment 667x375 `97531211614`, 844x390 `97531211541`, 844x340 `97531211559`, 932x430 `97531211515` lost WPE WebContent; Stage 3 and canonical HUD dependency-skipped; no retry/rerun/edit
- `LAST_GREEN_GATE`: exact r34 local focused 35/35, Design Lock 19/19, full 1,195/1,195 and static gates; remote PR Verify, six enemy shards, deployment 736x414 and 1280x720, and Pages preview build/deploy-skipped. Comparison-only
- `CLASSIFICATION`: `REMOTE_WEBKIT_HOST_IO_WAIT_CORRELATION / SIX_TERMINAL_AXES_WITH_WPE_D_STATE + ELEVATED_HOST_IO_PSI / KERNEL_WAIT_OWNER_UNOBSERVED / DESIGN_CHANGE_REQUIRED`; `R34_RUNTIME_HYPOTHESIS_FALSIFIED / PINNED_OFFICIAL_RUNTIME_STILL_LOSES_WPE_ACROSS_HOSTED_PHASE_G_DEPLOYMENT / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `WEBKIT_KERNEL_WAIT_OWNER_DIAGNOSTIC / D_STATE_WCHAN + PROC_IO_AND_BLKIO + EXACT_OPERATION_SPANS / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until r35 byte lock and 19/19; then `SOL_REMEDIATION`; every automatic diagnostic result returns to `SOL_DESIGN`
- `LOOP_ITERATION`: r34 iteration 16 is terminal red; r35 diagnostic is iteration 17; owner-specific remediation is no earlier than iteration 18; workflow-only restoration is no earlier than iteration 19
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the r35 Issue byte lock and green Design Lock proof
- `RESUME_FROM`: exact clean r34 HEAD/tree -> r35 four-path byte lock -> exact six-path diagnostic implementation -> focused 34/34 + full/static gates -> atomic exact ten-path iteration-17 candidate -> one automatic diagnostic run -> always return to SOL_DESIGN -> owner-specific r36 remediation -> complete focused automatic green -> workflow-only restoration no earlier than iteration 19 -> exact-HEAD full/unfiltered/runtime/human -> fixed-HEAD `SOL_FINAL_REVIEW` -> one final Producer checkpoint -> approval-only release tail

Exact SOL execution handoff:

1. Change exactly the ten Section 51.3 paths. Under remediation edit only the shared host telemetry, its existing runtime test, the deployment harness, Hosted visual harness, Phase G harness, and existing Phase G checkpoint test. Preserve every other r34 byte.
2. Keep outer telemetry schema/cadence. On each WPE WebContent `D` sample, persist the bounded identity-bound nested wait-owner record: sanitized `wchan`, proc I/O counters, proc stat fault/tick/thread/block-I/O-delay fields, bounded stack status/content, current PSI/cgroup/process fields, and current operation context. Cap details at the first 64 `D` samples per stable identity; summary retains all counts/fingerprints/first-last counters.
3. Add sanitized mutable context and begin/end events. Deployment must name asset, fixture, first-frame, requested checkpoint advance, validation, canvas PNG, hash, trace, and contact sheet before each operation. Hosted must name ready/fault case and asset/fault/recovery/final-canvas/mutable-canvas/screenshot operations. Phase G must name configure, production contract, causal proof, observer stop, screenshot, overflow, runtime, and final diagnostics.
4. A Linux `D` sample without a matching wait-owner attempt is telemetry-invalid. Permission denial, `wchan=0`, process disappearance, partial reads, and no reproduction are explicit diagnostic outcomes, not pass substitutes.
5. Do not change workflow, container, browser/package version or flags, timeout, retry/attempt count, dependencies, focus, viewport/unit/stage/checkpoint/causal/pixel/evidence contracts, `app/**`, `public/**`, assets, package/lock, release request, or product behavior. Do not add RAM/cache/GC/sleep/resource-threshold remediation in r35.
6. Require parser/missing-permission tests, operation-span static proof, focused 34/34, full tests, content, lint, build, YAML, diff/EOL/BOM/topology, clean worktree, and forbidden zero. Windows unsupported output is not Linux runtime proof.
7. Only complete local green authorizes one atomic exact ten-path iteration-17 commit, normal non-force push, and one automatic attempt. No rerun, retry, edit, or alternate host.
8. The automatic result always returns to `SOL_DESIGN`, even if green. Classify only `DIAGNOSTIC_COMPLETE`, `DIAGNOSTIC_EVIDENCE_INVALID`, or `DIAGNOSTIC_NO_REPRODUCTION`, then lock one owner-specific r36 remediation. No Ready, merge, tag, Release, Pages, or final evidence.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r35` and Issue #172.**

## 45. Revision r36 — no active Luna handoff / owner-specific WebKit QA closure

Design Lock Section 52 and the latest explicitly labeled Issue #172 r36 byte-lock comment are the sole active cursor. Sections 1-44 are immutable audit history. Producer's SOL single-owner override remains active; Luna receives no diagnosis, edit, retry, QA, promotion, or release decision.

- `STATUS`: `DESIGN_LOCKED` only after the four SOL-owned r36 design/source files are Issue-byte-locked and Design Lock 19/19 is green
- `LAST_AUDITED_HEAD`: `be4acc7a034858cd9918714895d423da71f4ebf6`
- `LAST_AUDITED_TREE`: `f9c7d4306f7104b57ab287767aebba3d19d48775`
- `FAILED_GATE`: automatic CI #931 / `32764650981`: Phase G Stage 6 `97557384758` crashed during already-satisfied causal collection; deployment 736x414 `97559866922`, 844x340 `97559866871`, and 1280x720 `97559866973` lost the page during QA-only final checkpoint audit; Stage 3 final-base `97558371928` stopped in source preparation at command-scoped repository ownership; canonical HUD dependency-skipped; no retry/rerun/edit
- `LAST_GREEN_GATE`: exact r35 local focused 34/34, Design Lock 19/19, full 1,195/1,195 and static gates; remote PR Verify, six enemy shards, Hosted, both Stage 3 candidate cases, deployment 667x375/844x390/932x430, and Pages preview build/deploy-skipped. Comparison-only
- `CLASSIFICATION`: `QA_HARNESS_WEBKIT_CAUSAL_COLLECTION_LIFETIME / PROOF_ALREADY_COMPLETE + MAX_DURATION_POLLING_CONTINUES_INTO_ANON_PIPE_WRITE_BACKPRESSURE / DESIGN_CHANGE_REQUIRED`; `QA_ONLY_DEPLOYMENT_PIXEL_AUDIT_SURFACE_LIFETIME / FOUR_DETACHED_CANVASES_PER_CHECKPOINT + SYNCHRONOUS_FINAL_AUDIT_OVER_WPE_ANON_PIPE / DESIGN_CHANGE_REQUIRED`; `WORKFLOW_REPOSITORY_SAFE_DIRECTORY_PRECONDITION / STAGE3_FINAL_BASE_SOURCE_PREPARATION_ONLY / REMEDIATION_LOCAL`
- `REMEDIATION_CLASS`: `BOUNDED_CAUSAL_PROOF_CONVERGENCE + SINGLE_REUSABLE_QA_PIXEL_AUDIT_SURFACE + COMMAND_SCOPED_STAGE3_SAFE_DIRECTORY / DESIGN_CHANGE_REQUIRED`
- `ROLE_LOCK`: `SOL_DESIGN` until r36 byte lock and 19/19; then `SOL_REMEDIATION`; any first failure returns to `SOL_DESIGN`
- `LOOP_ITERATION`: r35 diagnostic iteration 17 is terminal; r36 coherent remediation is iteration 18; workflow-only unfiltered restoration is iteration 19 after complete automatic green only
- `SAME_GATE_REPEAT_COUNT`: `9` for required remote Phase G
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the r36 Issue byte lock and green Design Lock proof
- `RESUME_FROM`: exact clean r35 HEAD/tree -> r36 corrected four-path byte lock -> exact seven-path remediation -> source/static/full/browser acceptance -> atomic exact eleven-path iteration-18 candidate -> one automatic focused run -> complete green only -> workflow-only iteration-19 restoration -> same-HEAD full local/unfiltered remote -> production runtime/human audit -> evidence freeze -> fixed-HEAD SOL_FINAL_REVIEW -> one final Producer checkpoint -> approval-only release tail

Exact SOL execution handoff:

1. Change exactly the eleven Design Lock Section 52.3 paths. Under remediation edit only the Phase G harness/test, QA-only fighter audit, deployment harness/runtime contract test, and workflow/CI contract test. Of the six r35 diagnostic implementation paths, preserve the two non-overlapping paths (`scripts/webkit-host-resource-telemetry.mjs` and `scripts/v0995-visual-integrity-browser-smoke.mjs`) byte-for-byte; in the four overlapping paths, permit only the exact r36 contract and preserve all r35 operation-span diagnostics.
   Preserve `tmp-r35-deploy-compare/`, `tmp-r35-hosted/`, `tmp-r35-phaseg/`, and ignored `outputs/r36-*` local evidence unstaged and uncommitted under the `AGENTS.md` no-delete boundary. Candidate readback requires exact eleven-path index/tree ownership and tracked/index clean after commit, with no untracked path outside those three named forensic directories; fixed-HEAD final review later uses a separate fresh-equivalent fully clean checkout.
2. Phase G: keep the existing maximum durations, 120 ms sample cadence, 40 ms observer, final stable-history rebuild, four-stage proof, and final invariant. Permit convergence only after actual 4/4 proof, 2,400 ms minimum dwell, and eight valid samples. Persist the exact `v100-phase-g-causal-collection/v1` receipt. No incomplete or early proof may pass.
3. Deployment: use exactly one reusable detached DOM scratch canvas/context for the six unchanged copied pixel passes. Return and validate `v100-fighter-unit-layer-audit-scratch/v1` with surface/context counts 1 and pass count 6. Preserve production pixels, geometry, transforms, draw order, analyzer, metrics, thresholds, six checkpoints, 48 one-attempt units, PNGs, sheets, and artifacts.
4. Stage 3: add only command-scoped `git -c safe.directory="$GITHUB_WORKSPACE"` to exact-base `cat-file` verification and worktree creation. No Git config mutation, wildcard, clone, SHA substitution, attempt change, or runtime bypass.
5. Require all source/static/full gates plus fresh Chromium Phase G core 3/3, WebKit Stage 6 3/3, ordered trio 3/3, full Chromium deployment, and full bounded WebKit deployment. Existing evidence is comparison-only. Any first red returns to `SOL_DESIGN`; no retry/rerun/edit.
6. Only one atomic exact eleven-path iteration-18 commit and normal non-force push is permitted. Its automatic attempt must be completely green across every required job and artifact. Complete green alone authorizes separate workflow-only iteration 19; it authorizes no Ready, merge, tag, Release, Pages, or final evidence.
7. Iteration 19 restores only the exact unfiltered Phase G 54/54 invocation, retains r34/r36 runtime and evidence contracts, and must pass same-HEAD local full/validator/regressions and one unfiltered automatic remote run before production runtime/human and fixed-HEAD final review.
8. Continue without Luna until the one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT`; only explicit Producer approval authorizes stacked integration and release operations.

Exact handoff: **NO ACTIVE LUNA HANDOFF — SOL continues under `V100-SOL-DL-001 r36` and Issue #172.**
