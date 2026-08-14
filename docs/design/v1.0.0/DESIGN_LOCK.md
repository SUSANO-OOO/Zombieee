# Version 1.0.0 Design Lock

- Design ID: `V100-SOL-DL-001`
- Revision: `r1`
- Status: `DESIGN_LOCKED`
- Role owner: `SOL_DESIGN`
- Story baseline commit: `435dc959d1972646f7e82b6c45d3f1c25d890252`
- Story baseline tree: `4833a1eed29e3901e3dcfca01cf77db6846e5265`
- Reconstructed story SHA-256: `c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`
- Product target: `Version 1.0.0`

This document is the implementation lock for Version 1.0.0. Luna may choose internal algorithms only inside the trial-and-error boundaries below. Product behavior, economy, identities, stage order, save semantics, and acceptance thresholds are fixed here.

## 1. Authority and baseline

Apply sources in this order:

1. Current Producer instructions and corrections recorded in this lock.
2. `docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md`.
3. `docs/story/v10/STORY_SCRIPT_V10.md` reconstructed from the canonical story baseline.
4. `docs/story/v10/STORY_IMPLEMENTATION_MAP.md`.
5. `AGENTS.md` and the two-thread workflow documents.
6. Current implementation at the story baseline.

The baseline attestation is immutable for implementation comparison. If the story baseline branch moves, PR #169 changes, or any selected authoring-master hash differs, stop before implementing and request Sol re-attestation.

## 2. Producer deltas locked after the story document

These direct Producer decisions override older descriptions where they conflict:

- TAKUYA-Ω has no orange garment. Continuity is carried by TAKUYA's face, swept light hair, black eye covering, scars, chain/black hardware, asymmetrical enlarged right arm, and back tubes.
- TAKUYA-Ω is an unmistakable stitched abomination. Its weapon is a gigantic hybrid sword/maul, not the earlier compact weapon. Exactly two arms and two hands are allowed for TAKUYA-Ω.
- The mutated Mugarian president keeps the president's Middle-Eastern identity and ornate emerald executive suit remnants, but the final form has exactly four arms and four hands. Each arm has one coherent shoulder root. The upper-left hand carries the staff; the other three hands are independent monster limbs. No extra hands, fused wrist, or orphan limb is allowed.
- Segawa uses the Producer-provided face reference only as a private identity reference. The shipped design is a stylized world-matched illustration in an ivory/white scientist coat; the private photos are never committed or distributed.
- An approved shared human silhouette portrait may be reused only for minor human speakers with no identity master, including generic researchers and Zakimiya's wife. It may not replace a named major character, playable unit, boss, or a person for whom a master exists.

## 3. Global boundaries

### Exact change

- Expand the canonical campaign from Stage 1 through Stage 30, including ending, credits, and epilogue.
- Register the fixed unit unlocks, level progression, CAPS economy, vehicle upgrades, supports, bosses, events, dialogue, and stage assets defined below.
- Convert selected nonruntime masters into runtime derivatives without changing their identity.
- Preserve the established battle presentation, save recovery, PWA update, audio mixer, and mobile contracts.

### Do not change

- Stable IDs already present in saves.
- Existing Stage 1-20 completion, star, formation, equipment, settings, read-state, or currency data except through the one-time additive migration defined here.
- Existing voice ownership; do not fill missing voices with another actor.
- Existing PWA rollback semantics, AudioMixer ownership, deployed release history, or public URL.
- Physical-iPhone claims: WebKit evidence is not physical hardware evidence.

### Stop conditions

Stop and return to Sol if any of the following occurs:

- A selected master cannot produce a readable runtime derivative without identity loss.
- A story beat requires changing a locked stage order, named character outcome, or boss identity.
- Migration cannot preserve a byte-for-byte export of the pre-migration save.
- Required assets are absent, undecodable, unlicensed, or exceed the existing PWA distribution limits without an approved contract change.
- A High or Medium regression appears in save, PWA, audio, gameplay, mobile HUD, or prior Stage 1-20 content.
- GitHub write access, branch precondition, or release authority differs from the preflight in Section 15.

## 4. Campaign and mission contract

All stages unlock linearly from one-star completion of the previous stage. No alternate progression branch is introduced in 1.0.0.

| # | Canonical stage | Mission contract | Fixed presentation / identity |
|---:|---|---|---|
| 1 | Nishijin pharmacy rescue | destroy base, 3 waves | existing shopping-street route |
| 2 | Sawara ward-office defense | defend 90 s, 5 groups | existing ward-office route |
| 3 | TAKUYA interception | boss assault plus 2 add waves | existing Nishijin defense line; TAKUYA |
| 4 | Station gate | destroy base, 4 waves | existing station gate |
| 5 | Gate Eater seal | boss assault plus 3 adds | Gate Eater |
| 6 | Maintenance tunnel | escort maintenance cart, 4 groups | cart must be visible and authored |
| 7 | University hospital approach | defend 85 s | existing hospital approach |
| 8 | Emergency ward | destroy base, 4 waves | existing emergency ward |
| 9 | Basement mechanical room | activate 3 power nodes plus 4 response groups | all three authored power objects required |
| 10 | Decontamination gate | destroy base, 4 waves | research access/decon presentation |
| 11 | MOTHER chamber | boss assault plus brood | MOTHER |
| 12 | Freight tunnel | escort sealed transport, 4 groups | Zakimiya reunion beat |
| 13 | Logistics relay | destroy base, 5 waves | Segawa reveal route |
| 14 | Evacuation freight yard | boss assault | Ooguchi and TKY beat |
| 15 | T-Plan outer control | activate 3 power nodes plus 4 groups | authored power rig states |
| 16 | T-Plan central seal | activate 3 power nodes plus 4 groups | authored seal states |
| 17 | Bay tower | boss assault | Kurome and MrsChiha beat |
| 18 | Civic archive | defend 95 s | archive evacuation records |
| 19 | Coastal link bridge | escort, 5 groups | bridge route |
| 20 | Estuary floodgate | boss assault | Gairen and Miyamoto beat |
| 21 | Mugarian logistics HQ | destroy base, 5 waves | corporate freight/HQ gate derivative |
| 22 | Clinical-trial wing | defend 100 s | hospital/lab derivative; wife reunion |
| 23 | Special-operations armory | destroy base, 5 waves | red-lens armory derivative; MrsChiha reveal |
| 24 | Tech tower | boss assault | bay-tower derivative; Futago |
| 25 | Executive lab | boss assault | research/executive hybrid; mutated president |
| 26 | Evacuation yard | escort, 6 groups | freight yard reuse with new object states |
| 27 | Segawa private lab | destroy base, 6 waves plus RED PANTHER | private-lab derivative |
| 28 | National dispersal network | activate 4 power nodes plus 6 groups | coastal power-rig derivative |
| 29 | Research core | destroy base, 6 elite waves | high-security lab-core derivative |
| 30 | Final Nishijin defense line | TAKUYA-Ω boss; no hard timer | exact Stage 3 location with damage/dawn overlay |

### Acceptance criteria

- Exactly 30 unique stage IDs appear in campaign order and map order.
- Each mission objective is represented by authored objects and state transitions, not placeholder rectangles or diagnostic primitives.
- Stage 21-30 are not simple recolors. Reuse is allowed only where the table explicitly says reuse; derivatives must change landmark, object, and depth composition.
- Boss entrances, deaths, post-battle events, ending, credits, and epilogue are reachable without QA shortcuts.

### Negative tests

- Duplicate/missing stage ID, broken prerequisite, absent objective object, simple tint-only derivative, boss skipped, or direct result transition fails.
- Stage 30 cannot reuse an unrelated map; it must resolve to the Stage 3 location signature plus an authored aftermath overlay.

### Rollback

Campaign expansion is additive behind the 1.0.0 schema. A revert PR removes the new registry entries and migration while leaving pre-1.0.0 save data intact and exportable.

## 5. Unit registration and progression

### Registration

| Availability | Unit | CAPS |
|---|---|---:|
| initial | Hachi, Paisen, Kumaverson, Babayaga | free |
| Stage 1 | Nao | 80 |
| Stage 2 | Mizuchi | 100 |
| Stage 4 | Monkey | 110 |
| Stage 5 | Crazy King | 120 |
| Stage 6 | Raider | 130 |
| Stage 7 | Tatara | 145 |
| Stage 8 | Gantetsu | 150 |
| Stage 10 | Mayo-chan | 160 |
| Stage 12 | Zakimiya | 175 |
| Stage 14 | TKY | 190 |
| Stage 17 | MrsChiha | 210 |
| Stage 20 | Miyamoto Musashi | 230 |

Hachi remains a skirmisher, Paisen frontline, Kumaverson heavy, Babayaga marksman, Nao support, Mizuchi suppression, and Monkey engineer. Existing roles for other units remain unchanged.

### Level cap

Initial cap 5; Stage 5 raises it to 10; Stage 10 to 15; Stage 15 to 20; Stage 20 to 25; Stage 25 to 30.

Level-up costs for L2-L30 are fixed:

`10,12,14,16,18,20,22,24,26,30,34,38,42,46,52,58,64,70,76,84,92,100,108,116,126,138,150,162,174`

At level L, max HP is `round(baseHP * (1 + 0.025 * (L - 1)))`; damage and healing are `round(baseValue * (1 + 0.02 * (L - 1)))`. Cooldown, range, movement, animation duration, and target selection do not scale with level.

### Acceptance / negative / rollback

- Existing owned units remain owned; purchase is idempotent and receipt-backed.
- A unit cannot exceed the cap for the highest cleared stage.
- A duplicate receipt, replay, refresh, or migration rerun cannot grant a second purchase/level/reward.
- Cooldown/range scaling, fractional persisted stats, skipped costs, or cap bypass fails.
- Rollback reads and preserves levels above an older UI cap as opaque forward-compatible data; it must never zero them.

## 6. CAPS economy

- Stage `n` first clear: `80 + 10n` CAPS (Stage 1 = 90, Stage 30 = 380).
- Second star: `15 + 5 * floor((n - 1) / 5)` CAPS.
- Third star: `25 + 5 * floor((n - 1) / 5)` CAPS.
- Replay: `max(20, round-to-nearest-5(firstClear * 0.20))` CAPS.
- Sum of all first-clear and star rewards is exactly 9,000 CAPS.
- A standard two-star route yields approximately 7,875 CAPS.
- Existing pre-1.0.0 saves receive one receipt-backed legacy release gift of 180 CAPS exactly once.

No time-limited monetization, premium currency, purchase API, or negative balance is introduced.

## 7. Armored vehicle and supports

Player-facing wording is `装甲車両`; internal stable IDs may retain historical names for compatibility.

- Base vehicle HP: 680.
- Five upgrades each add 80 HP; maximum 1,080.
- Upgrade costs: 120, 180, 260, 360, 480 CAPS (total 1,400).

| Support | Cost | Cooldown |
|---|---:|---:|
| healing | 50 | 25 s |
| explosive drum | 40 | 20 s |
| incendiary drum | 55 | 28 s |
| barrage | 70 | 38 s |
| airstrike | 85 | 50 s |

Existing input, targeting, damage, trajectory, audio, VFX, door, deployment, and save behavior remain. No permanently floating equipment primitive may be reintroduced around the vehicle.

## 8. Boss contract

| Boss | HP | Damage | Cadence | Phase thresholds | Adds / special | Resistance |
|---|---:|---:|---:|---|---|---:|
| TAKUYA | 1600 | 34 | 1.25 s | 70%, 35% | 2 adds | 45 |
| Gate Eater | 2100 | 30 | 1.40 s | 75%, 40% | 3 adds | 55 |
| MOTHER | 2800 | 28 | 1.10 s | 70%, 40% | brood 4/6 | 60 |
| Ooguchi | 3400 | 42 | 1.55 s | 75%, 45% | charge | 65 |
| Kurome | 4100 | 34 | 0.90 s | 70%, 35% | clones | 70 |
| Gairen | 4700 | 48 | 1.65 s | 75%, 45% | shell cycle | 72 |
| Futago | 3000 each | 36 | 1.00 s | twin state | survivor enrages | 75 |
| mutated president | 6200 | 44 | 1.20 s | 70%, 35% | four-arm form | 80 |
| TAKUYA-Ω | 9200 | 56 | 1.35 s | 75%, 45%, 20% | 2 add waves | 85 |

No hard boss timer is allowed. Boss music must use the current production boss scene/asset contract and must not be silenced by a story event while a boss is alive. No duplicate playback.

## 9. Portrait and dialogue composition

- Major named characters use their own approved identity masters or existing production portraits.
- Segawa, the Mugarian president, mutated president, TAKUYA-Ω, and RED PANTHER variants use the selected masters in `ASSET_INVENTORY.md`.
- The shared minor-human portrait is permitted only for unnamed/generic human event speakers lacking an identity master.
- Dialogue portrait geometry must preserve the current mobile contract at 844x340, 844x390, and desktop regression at 1280x720: head visible, face centered, torso/dialogue overlap 12-40 px, no text/head collision, 44x44 controls, and no safe-area clipping.
- Dialogue logs use a solid-enough backplate and readable text; background imagery must not bleed through to reduce legibility.

Negative tests reject missing portraits for a registered speaker, identity substitution, white/checkerboard matte, opaque background on a transparent master, overlap below 12 or above 40, and generic portrait use for a major named character.

## 10. Asset and enemy contract

- Selected nonruntime masters are listed by exact path/hash in `ASSET_INVENTORY.md` and `assets/source/v100/PROVENANCE.md`.
- Runtime derivatives must be project-original, RGBA where transparency is required, visually readable after runtime scaling, and connected to the same identity across portrait/card/event/battle forms.
- RED PANTHER has four finite identities: knife, shield, SMG, and commander. Their silhouettes and weapon roles must remain distinguishable.
- Kurome's existing prototype is reference-only and cannot be promoted as production unchanged.
- Required production images must load and decode before entering the playable screen. A failed/timeout/corrupt required image blocks play and offers same-screen failed-only retry; no diagnostic polygon or silent degraded-ready fallback is allowed.

## 11. Save and migration

Root cause: the existing save schema covers Stage 1-20-era registries and does not yet own the 1.0.0 additive content, level caps, vehicle upgrades, and release gift.

Exact change:

- Add one idempotent migration receipt for 1.0.0.
- Preserve stable unit/stage/equipment IDs and all existing progression.
- Add defaults only for new fields; never reinitialize the full save.
- Store the 180 CAPS gift as a separate one-time receipt.
- Preserve export/import, corruption recovery, last-known-good, localStorage/IndexedDB separation, and rollback generation.

Acceptance: fresh save, 0.9.8.2 save, current published save, corrupted-save recovery, migration rerun, offline launch, update, failed update, commit-only recovery, and rollback all pass. Byte-level pre-migration export is stored in QA evidence.

Negative: double gift, lost unit/star/equipment/formation/settings/read-state, full reset, negative CAPS, duplicated receipt, or forward level truncation fails.

## 12. Mobile, performance, audio, and PWA

- Required matrix: Chromium and WebKit at 844x340, 844x390, and 1280x720; physical iPhone remains a residual hardware boundary if unavailable.
- Maintain safe-area env values on public hosts, readable HUD text, tap targets, battlefield area, no card/support overlap, no portrait/dialogue collision, and no horizontal page overflow.
- Maintain deployment final-canvas opacity/occlusion/duplicate contracts for every registered human unit.
- Maintain existing AudioMixer ownership, boss scene continuity, battle SE/voice rules, speaker/earphone controls, and zero double playback.
- PWA manifests include every new runtime asset exactly once by content hash; unchanged hashes are not refetched. Update, offline, rollback, and failed-only retry remain deterministic.
- New authoring masters are not automatically public/runtime assets. Only approved optimized derivatives enter the distribution manifest.

## 13. Test and evidence contract

Before Sol review, Luna must provide:

- focused tests for every changed registry and migration;
- full test, lint, production build, content validation, generator/drift checks, and `git diff --check`;
- campaign reachability and economy simulations;
- browser evidence for all required viewport/engine combinations;
- final-canvas deployment evidence, portrait contact sheets, mission-object state sheets, enemy direction/state sheets, and boss entrance/defeat routes;
- fresh/current/legacy save and PWA update/offline/rollback evidence;
- console/page/HTTP/request failure counts of zero, excluding only a separately proven browser capability boundary;
- artifact ID/digest and exact implementation HEAD/tree.

Existence-only and regex-only tests are insufficient where runtime pixels, decode, state transition, receipts, or audio ownership can be observed.

## 14. Implementation order and Luna discretion

Implementation order is fixed:

1. Foundation: stable registries, save schema/migration, campaign/economy/level data, contract tests.
2. Stage 1-20 story integration and regressions.
3. Stage 21-30, ending, new enemies/bosses, runtime derivatives, and mission objects.
4. Audio/PWA/mobile integration, complete browser/save matrix, evidence, and release-candidate packet.

Luna may iterate on code structure, pure helper decomposition, compression format, sprite-sheet packing, crop/anchor/scale, and test helper implementation. Luna may not change identities, stage order, fixed numbers, mission types, four-arm ownership, TAKUYA-Ω's no-orange design, generic-portrait boundary, save semantics, or acceptance thresholds.

## 15. Execution-path preflight

For required GitHub writes, use in order:

1. connected GitHub connector;
2. authenticated `gh` CLI;
3. authenticated Chrome/browser fallback.

Before each write, re-fetch live base/head/tree, branch state, PR state/Draft/mergeability, and permissions. If none of the three paths is authenticated, stop before local history diverges. No force push, amend, rebase, direct main push, Ready conversion, merge, tag, Release, Pages deployment, or Issue closure is authorized by this Design Lock.

## 16. Success condition

Implementation is ready for independent Sol review only when the fixed implementation HEAD/tree matches live GitHub, High 0 and Medium 0 remain, all locked identities/hashes are traceable, the required runtime/browser/save/PWA evidence is reviewer-accessible, and no release action has occurred.
