# Version 1.0.0 Luna Implementation Handoff

- Canonical Design Lock: `V100-SOL-DL-001 r2`
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
3. `docs/CODEX_SOL_ROLE.md`
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
- Implement fixed level caps, costs, stat formulas, vehicle upgrades, and support values.
- Add the additive, idempotent 1.0.0 save migration and one-time 180 CAPS legacy gift receipt.
- Add data validators/simulations proving stage reachability, 9,000 total first/star CAPS, purchase affordability, cap gates, and receipt idempotency.

### Do not touch in Phase 1

- Runtime art, AudioMixer, PWA worker, existing combat presentation, or release workflow.
- Stable existing IDs or historical receipts.

### Gate

Focused campaign/economy/progression/save tests, fresh/current/legacy migration tests, build, lint, content validation, and diff check must pass before Phase 2. Commit this phase separately.

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
- Maintain identity between authoring master, event portrait, card/profile, and battle form.
- Implement RED PANTHER variants, mutated president with exactly four arms/four hands, and TAKUYA-Ω with exactly two arms and no orange garment.
- Limit the simple featureless gender-neutral minor-human silhouette to minor human speakers with no identity master; never assign it to a major named speaker or add face, hair, costume, occupation, accessory, or weapon cues.
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

- Register new runtime assets exactly once in the content/PWA manifests.
- Preserve unchanged-hash no-refetch, install/update/offline/rollback, commit-only recovery, and failed-only retry.
- Preserve boss-music scene ownership and zero double playback.
- Run all focused and full gates, save matrices, browser matrices, simulations, and reviewer-accessible evidence.

### Gate

No release action. Produce a Completion Packet with:

- implementation HEAD/tree and base;
- changed file inventory;
- phase commit list;
- focused/full/build/lint/content/drift/diff results;
- campaign/economy simulation results;
- save/PWA matrix;
- Chromium/WebKit evidence and artifact IDs/digests;
- selected master and runtime derivative hash map;
- known residual risks, clearly separating physical hardware from headless evidence.

Set `STATUS: READY_FOR_SOL_FINAL_REVIEW` and stop.

## 7. Negative tests that must exist

- 29 or 31 stages; duplicate stage; broken prerequisite; missing event/object; direct result skip.
- Wrong unit unlock/cost/cap/stat formula; cooldown/range level scaling; duplicate receipt/gift.
- Lost existing save field, reset, negative CAPS, or migration rerun mutation.
- Wrong boss values, hard boss timer, skipped entrance/defeat, boss music overwritten/silenced/doubled.
- Missing/corrupt/timeout required image becoming playable; placeholder/fallback rendered as production.
- Mutated president not exactly four rooted arms/four hands; TAKUYA-Ω not exactly two arms, orange clothing, wrong weapon, or identity loss.
- Generic minor portrait assigned to a major named speaker.
- Matte/checkerboard residue, opaque background, translation-only semantic frame, wrong facing, ghost/duplicate/fractional alpha.
- Mobile clipping/overflow/collision, portrait overlap outside 12-40 px, unsafe public-host safe-area override.
- PWA refetch of unchanged hashes, partial-update data loss, offline failure, or rollback mismatch.

## 8. Rollback granularity

- Keep each phase in normal, reviewable commits so an ordinary revert PR can remove one phase without history rewriting.
- Migration code and registry data must be revertable independently from large runtime assets.
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
