# Version 1.0.0 Luna Implementation Handoff

- Canonical Design Lock: `V100-SOL-DL-001 r4`
- Required design base: story baseline commit `435dc959d1972646f7e82b6c45d3f1c25d890252`
- Role lock for implementation: `LUNA_IMPLEMENTATION`
- Design status: `DESIGN_LOCKED`

Luna must read the entire Design Lock and Asset Inventory before editing. The values in those files are product decisions, not starting suggestions.

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
