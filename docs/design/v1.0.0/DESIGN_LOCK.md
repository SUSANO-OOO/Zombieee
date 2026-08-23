# Version 1.0.0 Design Lock

- Design ID: `V100-SOL-DL-001`
- Revision: `r14`
- Status: `DESIGN_LOCKED`
- Execution owner: `SOL`
- Design publication role: `SOL_DESIGN`; the active execution role is read from Issue #172
- Story baseline commit: `435dc959d1972646f7e82b6c45d3f1c25d890252`
- Story baseline tree: `4833a1eed29e3901e3dcfca01cf77db6846e5265`
- Reconstructed story SHA-256: `c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4`
- Product target: `Version 1.0.0`

This document is the implementation lock for Version 1.0.0. Under the current Producer override, SOL may choose internal algorithms only inside the active revision's boundaries. Historical Luna sections remain audit evidence and are not executable owner assignments. Product behavior, economy, identities, stage order, save semantics, and acceptance thresholds are fixed here.

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
- The approved shared minor-human event image is a simple, featureless, gender-neutral and age-neutral human silhouette. It may be reused only for minor human speakers with no identity master, including generic researchers and Zakimiya's wife. It carries no face, hair, costume, occupation, ethnicity, accessory, weapon, or named-person identity cues, and it may not replace a named major character, playable unit, boss, or a person for whom a master exists.
- Revision r2 freezes the exact currently selected hashes in `ASSET_INVENTORY.md` and `PROVENANCE.md`. This limited contract correction has no character-art scope: the latest shared minor-human silhouette, Segawa, normal and mutated Mugarian president, TAKUYA-Ω, all four RED PANTHER roles, and every existing character remain unchanged. No older candidate/master may replace them and no new image candidate may be generated under this revision.
- Revision r3 inherits every r2 product, story, identity, asset, gameplay, save, audio, PWA, and presentation decision unchanged. It adds only the deterministic diagnosis and execution contract for the remote Phase G WebKit 667x375 failure. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r4 incorporates the subsequent remote Stage 24 failure and replaces the Stage 6-only diagnostic boundary with one finite WebKit battle-extra harness contract covering Stages 6, 24, and 25. It changes no product, story, identity, asset, gameplay, balance, AI, evidence, Producer checkpoint, save, audio, PWA, or release decision. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r5 keeps the complete r4 Phase G contract unchanged and makes the full Version 1.0.0 execution, return, visual-approval freeze, stacked-integration, release, post-release, rollback, and closure loop authoritative in Section 19. It adds no product behavior or acceptance weakening. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r6 keeps Sections 18-19 unchanged and classifies the new required-CI failures at candidate `21b3a2076b5ff580189c9cfe69fb4dc30193a45d` as `DESIGN_CHANGE_REQUIRED`. Section 20 authorizes one additive, diagnostic-only harness commit and one resulting remote run; it authorizes no product correction. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r7 keeps Sections 18-20 and every product/release contract unchanged. It consumes the r6 traces, separates a five-file EOL hygiene failure from a WebKit final-base predicate-orchestration failure, and authorizes one bounded two-class QA/repository correction followed by one automatic remote validation run. No `app/**` or product correction is authorized. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r8 keeps Sections 18-19 and all product/release thresholds unchanged. It independently classifies CI #910's Phase G Stage 24 stale DOM/runtime deployment race and canonical Stage 3 clean unexpected-page-crash classifier gap, fixes their bounded QA ownership in Section 23, and makes Producer Directive `5377824157` an exact-HEAD/tree dynamic game-quality gate before the Producer Visual Checkpoint. No `app/**` or product correction is authorized. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r9 keeps every r8 remediation, promotion, dynamic-quality, and release contract unchanged. It closes the focused-local 41/43 return by adding one omitted source-contract test owner and fixing one diagnostic-probe serialization boundary; no runtime selection rule, retry policy, acceptance threshold, `app/**`, or product behavior changes. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r10 keeps the six-path r9 correction and all product/runtime/release contracts unchanged. It closes Producer Loop-Breaker `5379794856` by making isolated-worktree dependency bootstrap, worktree-local browser installation, native/browser/test-load preflight, draft byte preservation, failure ownership, and retry policy one executable local-gate contract. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r11 consumes runtime return route `5383696506` and the raw Stage 24 WebKit run-1/run-2 evidence. It corrects only the Phase G harness's non-monotonic source-to-target history and its final sampling-window coupling; it changes no product VFX, combat, audio, gameplay, balance, AI, timeout, acceptance threshold, or release gate. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r12 consumes the required Stage 6 WebKit actionability stop and replaces opaque locator stability ownership with explicit hit-test/stability evidence, exactly one trusted real pointer, production acceptance, page-scoped input serialization, and an immutable failure cursor. It also applies the Producer's temporary SOL single-owner and one-final-checkpoint release loop. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r13 consumes the second fresh local ordered-trio result under r12. It keeps the completed pointer/cursor correction and all product/release gates unchanged, and adds only monotonic same-frame source/target ownership evidence for the Stage 25 contact-first proof checkpoint. Generic attack, audio, causal-axis, or surviving-fighter evidence may not substitute for an exact living human target observation. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r14 consumes the authoritative r13 remote focused failure at the repeated required Stage 6 gate. It replaces r12's render-opportunity-coupled `requestAnimationFrame` actionability prerequisite with two host-turn-separated synchronous DOM/runtime/hit-test observations, retains rAF only as non-blocking scheduler evidence, and closes the pre-input timeout/evidence lifecycle. It changes no product, gameplay, timing, acceptance, viewport, retry, workflow, or release decision. `PRODUCT_DESIGN_CHANGE: 0`.

## 3. Global boundaries

### Exact change

- Expand the canonical campaign from Stage 1 through Stage 30, including ending, credits, and epilogue.
- Register the fixed unit unlocks, level progression, CAPS economy, vehicle upgrades, supports, bosses, events, dialogue, and stage assets defined below.
- Convert selected nonruntime masters into runtime derivatives without changing their identity.
- Preserve the established battle presentation, save recovery, PWA update, audio mixer, and mobile contracts.

### Do not change

- Stable IDs already present in saves.
- The pre-1.0.0 campaign namespace, its Stage 1-20 completion, stars, owned units, CAPS, read state, formation, equipment, backups, exports, and recovery snapshots. They remain legacy data and are never imported into the Version 1.0.0 campaign progression.
- Existing voice ownership; do not fill missing voices with another actor.
- Existing PWA rollback semantics, AudioMixer ownership, deployed release history, or public URL.
- Physical-iPhone claims: WebKit evidence is not physical hardware evidence.

### Stop conditions

Stop and return to Sol if any of the following occurs:

- A selected master cannot produce a readable runtime derivative without identity loss.
- A story beat requires changing a locked stage order, named character outcome, or boss identity.
- The new campaign bootstrap, legacy eligibility check, or rollback path would delete, rewrite, or make a byte-for-byte export of any pre-1.0.0 save unavailable.
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

The Stage 1-30 campaign is owned by the separate Version 1.0.0 namespace. A revert PR removes the new registry and namespace bootstrap while leaving the pre-1.0.0 namespace, backups, exports, and last-known-good data intact and eligible for rollback/recovery.

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

Primary role ownership is exact for all 16 player units. Existing player-facing class labels and combat kits remain; this table closes registry/filter/economy ownership and does not authorize a kit redesign.

| Unit | Primary role |
|---|---|
| Hachi | `skirmisher` |
| Paisen | `frontline` |
| Kumaverson | `heavy` |
| Babayaga | `marksman` |
| Nao | `support` |
| Mizuchi | `suppression` |
| Monkey | `engineer` |
| Crazy King | `frontline` |
| Raider | `suppression` |
| Tatara | `heavy` |
| Gantetsu | `heavy` |
| Mayo-chan | `skirmisher` |
| Zakimiya | `frontline` |
| TKY | `skirmisher` |
| MrsChiha | `marksman` |
| Miyamoto Musashi | `frontline` |

### Level cap

Initial cap 5; Stage 5 raises it to 10; Stage 10 to 15; Stage 15 to 20; Stage 20 to 25; Stage 25 to 30.

Level-up costs for L2-L30 are fixed:

`10,12,14,16,18,20,22,24,26,30,34,38,42,46,52,58,64,70,76,84,92,100,108,116,126,138,150,162,174`

At level L, max HP is `round(baseHP * (1 + 0.025 * (L - 1)))`; damage and healing are `round(baseValue * (1 + 0.02 * (L - 1)))`. Cooldown, range, movement, animation duration, and target selection do not scale with level.

### Acceptance / negative / rollback

- The Version 1.0.0 campaign starts with its locked initial roster; legacy owned units are not copied into it. Registration inside the new namespace is idempotent and receipt-backed.
- A unit cannot exceed the cap for the highest cleared stage.
- A duplicate receipt, replay, refresh, recovery, or import cannot grant a second purchase/level/reward in the Version 1.0.0 namespace.
- Cooldown/range scaling, fractional persisted stats, skipped costs, or cap bypass fails.
- Rollback reads and preserves levels above an older UI cap as opaque forward-compatible data; it must never zero them.

## 6. CAPS economy

- Stage `n` first clear: `80 + 10n` CAPS (Stage 1 = 90, Stage 30 = 380).
- Second star: `15 + 5 * floor((n - 1) / 5)` CAPS.
- Third star: `25 + 5 * floor((n - 1) / 5)` CAPS.
- Replay: `max(20, round-to-nearest-5(firstClear * 0.20))` CAPS.
- Sum of all first-clear and star rewards is exactly 9,000 CAPS.
- A standard two-star route yields approximately 7,875 CAPS.
- An eligible pre-1.0.0 play history grants the new Version 1.0.0 campaign one receipt-backed legacy release gift of 180 CAPS exactly once; no legacy CAPS balance or other progression is imported.

No time-limited monetization, premium currency, purchase API, or negative balance is introduced.

## 7. Armored vehicle, supports, and vehicle abilities

Player-facing wording is `装甲車両`; internal stable IDs may retain historical names for compatibility.

- Base vehicle HP: 680.
- Five upgrades each add 80 HP; maximum 1,080.
- Upgrade costs: 120, 180, 260, 360, 480 CAPS (total 1,400).

Exactly one player-facing support is equipped before sortie. Support ownership is permanent in the Version 1.0.0 namespace, but battle resource and cooldown are battle-local. Unlock stages are first-clear receipts; this keeps them separate from unit availability at stage entry and from level-cap milestones.

| Player-facing support | Stable ID | Unlock receipt | Unlock cost | Battle cost | Cooldown |
|---|---|---|---:|---:|---:|
| 回復支援 | `support-healing` | Stage 2 first clear: `v100:s02:support-healing:unlock` | 50 CAPS | 50 | 25 s |
| 爆薬ドラム缶 | `support-explosive-drum` | Stage 6 first clear: `v100:s06:support-explosive-drum:unlock` | 40 CAPS | 40 | 20 s |
| 火炎ドラム缶 | `support-incendiary-drum` | Stage 9 first clear: `v100:s09:support-incendiary-drum:unlock` | 55 CAPS | 55 | 28 s |

Stage 2, 6, and 9 are the exact unlock stages. The first-clear transaction reveals the support for purchase; it does not auto-purchase it. `pod` is not a normal loadout option. Equipping zero or more than one support, using an unowned support, granting the same unlock twice, or firing a support without its battle-local cost/cooldown fails.

航空支援 and 一斉砲撃 are not supports and never appear in the three-option support loadout. They are armored-vehicle-only abilities with separate stable IDs and the existing targeting, equipment-frame, audio, VFX, and cooldown ownership:

| Armored-vehicle ability | Stable ID | Battle cost | Cooldown |
|---|---|---:|---:|
| 一斉砲撃 | `vehicle-barrage` | 70 | 38 s |
| 航空支援 | `vehicle-airstrike` | 85 | 50 s |

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

### Story defeat to other-mode unlock

A boss becomes discoverable and selectable outside Story only after the first valid Story defeat receipt for that exact boss ID is durably committed. Entrance, encounter, damage, failure, QA fixture, another boss's receipt, or an older prototype ID cannot unlock it. Before that receipt, player-facing Compendium search, Outbreak selection, Survival pool construction, previews, names, silhouettes, rewards, and random rolls must omit the boss without leaving a spoiler-shaped locked slot.

| Story Stage | Boss / stable ID | First Story defeat receipt | Compendium discovery | Outbreak unlock | Survival pool unlock | First / repeat Story CAPS |
|---:|---|---|---|---|---|---:|
| 3 | TAKUYA / `boss-takuya` | `v100:s03:boss-takuya:first-defeat` | `compendium:boss-takuya` | `outbreak:boss-takuya` | `survival:boss-takuya` | 110 / 20 |
| 5 | 改札喰い / `boss-gate-eater` | `v100:s05:boss-gate-eater:first-defeat` | `compendium:boss-gate-eater` | `outbreak:boss-gate-eater` | `survival:boss-gate-eater` | 130 / 25 |
| 11 | MOTHER / `boss-mother` | `v100:s11:boss-mother:first-defeat` | `compendium:boss-mother` | `outbreak:boss-mother` | `survival:boss-mother` | 190 / 40 |
| 14 | オオグチ / `boss-ooguchi` | `v100:s14:boss-ooguchi:first-defeat` | `compendium:boss-ooguchi` | `outbreak:boss-ooguchi` | `survival:boss-ooguchi` | 220 / 45 |
| 17 | クロメ / `boss-kurome` | `v100:s17:boss-kurome:first-defeat` | `compendium:boss-kurome` | `outbreak:boss-kurome` | `survival:boss-kurome` | 250 / 50 |
| 20 | ガイレン / `boss-gairen` | `v100:s20:boss-gairen:first-defeat` | `compendium:boss-gairen` | `outbreak:boss-gairen` | `survival:boss-gairen` | 280 / 55 |
| 24 | フタゴ / `boss-futago` | `v100:s24:boss-futago:first-defeat` | `compendium:boss-futago` | `outbreak:boss-futago` | `survival:boss-futago` | 320 / 65 |
| 25 | 変異ムガリアン社長 / `boss-mugarian-president-mutated` | `v100:s25:boss-mugarian-president-mutated:first-defeat` | `compendium:boss-mugarian-president-mutated` | `outbreak:boss-mugarian-president-mutated` | `survival:boss-mugarian-president-mutated` | 330 / 65 |
| 30 | TAKUYA-Ω / `boss-takuya-omega` | `v100:s30:boss-takuya-omega:first-defeat` | `compendium:boss-takuya-omega` | `outbreak:boss-takuya-omega` | `survival:boss-takuya-omega` | 380 / 75 |

The first/repeat values are the existing Stage first-clear/replay formula, not an additional boss bonus, so the locked 9,000 CAPS economy remains unchanged. The atomic first-defeat commit records the Story result, increments `bossDefeatCount.<bossId>` from 0 to 1, discovers the Compendium entry, enables the exact Outbreak encounter and Survival pool entry, and enables Story replay for that Stage. Each later successful Story replay, Outbreak clear, or Survival boss clear increments the same boss-specific count once per unique result receipt; failed, cancelled, duplicate, or recovered-incomplete results do not increment it. Mode-specific clears keep their own reward contract; Story replay alone uses the repeat value above. TAKUYA and TAKUYA-Ω are separate IDs, identities, counters, receipts, discoveries, and mode entries. `boss-kurome-prototype` remains reference-only and cannot satisfy `boss-kurome`.

Negative tests must prove all nine bosses are absent from both other modes before their own Story receipt, one boss cannot unlock another, first/repeat rewards cannot double apply, replay cannot precede first defeat, counts are receipt-idempotent, and TAKUYA never aliases TAKUYA-Ω.

## 9. Portrait and dialogue composition

- Major named characters use their own approved identity masters or existing production portraits.
- Segawa, the Mugarian president, mutated president, TAKUYA-Ω, and RED PANTHER variants use the selected masters in `ASSET_INVENTORY.md`.
- The shared minor-human event silhouette is permitted only for unnamed/generic human event speakers lacking an identity master. It must remain simple, featureless, gender-neutral, and age-neutral.
- Dialogue portrait geometry must preserve the current mobile contract at 844x340, 844x390, and desktop regression at 1280x720: head visible, face centered, torso/dialogue overlap 12-40 px, no text/head collision, 44x44 controls, and no safe-area clipping.
- Dialogue logs use a solid-enough backplate and readable text; background imagery must not bleed through to reduce legibility.

Negative tests reject missing portraits for a registered speaker, identity substitution, white/checkerboard matte, opaque background on a transparent master, gender/age/occupation/identity cues in the shared silhouette, overlap below 12 or above 40, and generic silhouette use for a major named character.

## 10. Asset and enemy contract

- Selected nonruntime masters are listed by exact path/hash in `ASSET_INVENTORY.md` and `assets/source/v100/PROVENANCE.md`.
- Runtime derivatives must be project-original, RGBA where transparency is required, visually readable after runtime scaling, and connected to the same identity across portrait/card/event/battle forms.
- RED PANTHER has four finite identities: knife, shield, SMG, and commander. Their silhouettes and weapon roles must remain distinguishable.
- Kurome's existing prototype is reference-only and cannot be promoted as production unchanged.
- Required production images must load and decode before entering the playable screen. A failed/timeout/corrupt required image blocks play and offers same-screen failed-only retry; no diagnostic polygon or silent degraded-ready fallback is allowed.

## 11. Save and migration

Root cause: the existing `nishijin-campaign-v1` namespace represents the legacy Stage 1-20 campaign. Treating Version 1.0.0 as an additive migration would incorrectly transfer progression, stars, owned units, CAPS, read state, and receipts into a distinct 30-Stage campaign and would make rollback/recovery ownership ambiguous.

Exact change:

- The Version 1.0.0 primary storage namespace is `nishijin-campaign-v100`, with `campaignGeneration: "v100-new-campaign-1"`. It starts a new game with the locked initial roster, Stage 1 only, zero Story clears/stars/read receipts, **0 CAPS**, and no legacy ownership or upgrades. An eligible legacy player reaches 180 CAPS only through the separate one-time gift below.
- `nishijin-campaign-v1` and all of its derived localStorage, IndexedDB backup, pre-migration snapshot, last-known-good, manual export, and recovery keys remain byte-preserved legacy data. Version 1.0.0 reads them only for legacy eligibility, rollback, explicit recovery/export, and the safe settings whitelist; it never rewrites, clears, or promotes them to the active 30-Stage save.
- Automatic transfer is forbidden for Stage completion, stars, owned/discovered/recruitable units, CAPS/supplies, equipment, formation, unit level/rank, read events, event resume, result/acquisition/upgrade receipts, Survival/Outbreak progress, records, or vehicle/support ownership and upgrades.
- The only permitted legacy settings transfer is a validated field-by-field copy of `bgmEnabled`, `sfxEnabled`, `bgmVolume`, `sfxVolume`, `reducedMotion`, `battleEventMode`, `graphicsQuality`, and `autoSkipReadStory`. Unknown, malformed, or progression-bearing fields are discarded from the new save, not from the legacy source.
- Fresh Version 1.0.0 player name, event read/resume position, vehicle upgrade level/receipts, support ownership/equipment, boss discovery/unlocks/counts, and all new campaign receipts belong only to `nishijin-campaign-v100`.

### Legacy eligibility, 180 CAPS grant, and popup

Legacy eligibility is true only when a valid pre-1.0.0 namespace candidate or verified legacy manual export proves actual play (`campaignStarted` or at least one durable gameplay/result/acquisition receipt). Merely finding an empty/default key, a corrupt blob, QA data, or a Version 1.0.0 save is not eligibility.

- Entitlement receipt: `v100:release-gift:legacy-180:v1`.
- Popup receipt: `v100:release-gift:legacy-180:popup:v1`.
- Amount: exactly 180 CAPS, added to the new campaign balance only.
- Claim ownership uses one IndexedDB unique-key transaction plus the existing serialized campaign mutation boundary. The entitlement record is pending/committed and the save reducer is receipt-idempotent, so a crash between ledger and save writes resumes the incomplete side without adding CAPS twice.
- localStorage is a verified mirror, not the cross-tab claim authority. reload, recovery, manual import, multiple tabs, save retry, and restoring an older Version 1.0.0 backup cannot create a second entitlement receipt or second balance increase.
- After the CAPS commit is durable, exactly the tab that owns the claim displays one dedicated popup on the first safe non-combat screen (`title`, `base`, or `campaign-map`; never Story dialogue, formation, battle, result, ending, or recovery UI). It shows `付与CAPS: 180` and the resulting `新しいCAPS残高`. The popup receipt is committed after its first painted frame. If the app closes before that paint acknowledgement, the popup resumes later; after acknowledgement it never displays again.

Acceptance: fresh install with no legacy history gets no gift; valid 0.9.8.2/current-published localStorage, IndexedDB-only, last-known-good, backup, and verified manual-export eligibility each create a clean Version 1.0.0 new game and exactly one gift; corrupt-source recovery, simultaneous tabs, reload, import replay, pending-ledger recovery, offline launch, update, failed update, commit-only recovery, and rollback all preserve both namespaces and the entitlement invariant. Byte-level legacy exports before and after Version 1.0.0 play must match.

Negative: any legacy progression transfer, old-source mutation/deletion, empty-key eligibility, corrupt eligibility, unwhitelisted setting transfer, double gift, double popup, popup during combat/story/result, popup missing amount/balance, negative CAPS, receipt duplication, or rollback loss fails.

## 12. Mobile, performance, audio, and PWA

- Required matrix: Chromium and WebKit at 844x340, 844x390, and 1280x720; physical iPhone remains a residual hardware boundary if unavailable.
- Maintain safe-area env values on public hosts, readable HUD text, tap targets, battlefield area, no card/support overlap, no portrait/dialogue collision, and no horizontal page overflow.
- Maintain deployment final-canvas opacity/occlusion/duplicate contracts for every registered human unit.
- Maintain existing AudioMixer ownership, boss scene continuity, battle SE/voice rules, speaker/earphone controls, and zero double playback.
- On first standalone/PWA install, the gameplay gate remains closed until the complete required-runtime manifest is downloaded, byte-size and content-hash verified, stored, and acknowledged by a durable manifest commit. Title/base/campaign/battle gameplay routes and simulation must not mount before that commit. After the gate opens, network requests for required runtime assets are exactly zero; optional non-gameplay content cannot be promoted to required after start.
- An update computes the candidate from the committed active manifest and downloads only changed or missing hashes. Unchanged hashes are not refetched. The candidate cannot become active before complete verification and manifest commit; failure leaves the current generation playable. The previous committed generation and its manifest remain intact for rollback, offline launch, commit-only recovery, and failed-only retry.
- New authoring masters are not automatically public/runtime assets. Only approved optimized derivatives enter the distribution manifest.

PWA negative tests must cover gameplay before commit, missing/hash-mismatched/undecodable required assets, a post-start required request, unchanged-hash refetch, partial candidate activation, previous-generation deletion, duplicate manifest entries, and rollback to bytes that do not match the retained manifest.

## 13. Test and evidence contract

Before Sol review, Luna must provide:

- focused tests for every changed registry, new namespace/bootstrap, legacy eligibility/entitlement, boss unlock, support unlock, and PWA gate;
- full test, lint, production build, content validation, generator/drift checks, and `git diff --check`;
- campaign reachability and economy simulations;
- browser evidence for all required viewport/engine combinations;
- final-canvas deployment evidence, portrait contact sheets, mission-object state sheets, enemy direction/state sheets, and boss entrance/defeat routes;
- fresh/current/legacy dual-namespace save, multiple-tab entitlement/popup, and PWA first-install/update/offline/rollback evidence;
- console/page/HTTP/request failure counts of zero, excluding only a separately proven browser capability boundary;
- artifact ID/digest and exact implementation HEAD/tree.

Existence-only and regex-only tests are insufficient where runtime pixels, decode, state transition, receipts, or audio ownership can be observed.

## 14. Implementation order and Luna discretion

Implementation order is fixed:

1. Foundation: stable registries, separate campaign namespace/bootstrap, legacy eligibility/entitlement, campaign/economy/level/support/boss-mode data, contract tests.
2. Stage 1-20 story integration and regressions.
3. Stage 21-30, ending, new enemies/bosses, runtime derivatives, and mission objects.
4. Audio/PWA/mobile integration, complete browser/save matrix, evidence, and release-candidate packet.

Luna may iterate on code structure, pure helper decomposition, compression format, sprite-sheet packing, crop/anchor/scale, and test helper implementation. Luna may not change identities, stage order, fixed numbers, mission types, support/boss unlock stages, boss IDs, campaign namespaces, legacy eligibility/grant semantics, PWA gameplay gate, four-arm ownership, TAKUYA-Ω's no-orange design, generic-portrait boundary, save semantics, or acceptance thresholds.

## 15. Execution-path preflight

For required GitHub writes, use in order:

1. connected GitHub connector;
2. authenticated `gh` CLI;
3. authenticated Chrome/browser fallback.

Before each write, re-fetch live base/head/tree, branch state, PR state/Draft/mergeability, and permissions. If none of the three paths is authenticated, stop before local history diverges. No force push, amend, rebase, direct main push, Ready conversion, merge, tag, Release, Pages deployment, or Issue closure is authorized by this Design Lock.

## 16. Success condition

Remote required CI and the complete Phase G contract being green is a technical gate, not permission to enter the original Sol thread's Final Review. At that point Luna must set `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED` and present twelve screenshots captured from the actual production candidate:

1. `TITLE`;
2. `名前入力`;
3. `作戦地図`;
4. `通常Stage選択`;
5. `Boss Stage選択`;
6. `出撃編成`;
7. `隊員`;
8. `出撃装備`;
9. `装甲車両強化`;
10. `代表event`;
11. `通常battle HUD`;
12. `戦果`.

Before explicit Producer Visual Approval, Luna must not finalize the Completion Packet or set `STATUS: READY_FOR_SOL_FINAL_REVIEW`. After approval, freeze the final evidence set at the approved implementation HEAD/tree, finalize the Completion Packet without creating a branch commit, set `STATUS: READY_FOR_SOL_FINAL_REVIEW`, and stop for the original Sol thread's Final Review.

Implementation is ready for Sol Final Review only when the fixed implementation HEAD/tree matches live GitHub, High 0 and Medium 0 remain, all locked identities/hashes are traceable, the required runtime/browser/save/PWA evidence is reviewer-accessible, all remote required CI and Phase G gates are green, the twelve-screen Producer Visual Approval is recorded, the final evidence is frozen, and no release action has occurred.

## 17. PRE_IMPLEMENTATION_CLOSURE

- Closure status: `PRE_IMPLEMENTATION_CLOSED`
- Product-decision gaps: `PRODUCT_DECISION_GAPS: 0`
- This section resolves implementation ambiguity only. It does not revise the selected nine masters, character identities, fixed campaign/economy/boss values, or r2 save/PWA decisions.

### 17.1 Player-name contract

1. `物語を始める` opens the name screen before `v100:event:prologue`. The screen says `入力した名前は仲間が物語中で呼ぶ名前になります`, labels the field `主人公の名前`, uses `この名前で始める` as the primary action, and offers `入力せず進む`; empty input or that explicit skip stores `指揮官`.
2. Validation order is: Unicode NFC normalization; trim leading/trailing U+0020/U+3000; collapse each run of U+0020/U+3000 to one U+0020; reject; then count with `Intl.Segmenter("ja", { granularity: "grapheme" })` or a conformance-equivalent grapheme implementation. Valid length is 1-12 grapheme clusters.
3. Allowed content is Unicode letters, decimal numbers, combining marks, Hiragana, Katakana, Han, U+30FC, U+30FB, ASCII apostrophe/hyphen, single normalized spaces, and well-formed common emoji grapheme sequences. Newline, C0/C1 controls, bidi controls, isolated variation selectors, U+200B/U+200C, and U+200D outside a valid emoji ZWJ sequence fail. There is no arbitrary banned-word filter.
4. Invalid content displays `使用できない文字が含まれています`; over-length displays `名前は12文字以内で入力してください`; neither mutates save state. Settings rename uses the same pipeline and cancel preserves the old value.
5. Story source token `{{PLAYER_NAME}}` (including the Markdown-escaped source spelling) expands as escaped text at render time. IDs, receipts, node keys, read state, and saved source text never contain the chosen name. Event/log/replay/ENDING/credits/EPILOGUE always render the current valid name, so rename changes display only and never re-fires progression.
6. The same normalized value is preserved in primary save, verified mirror, backup, last-known-good, manual export/import, recovery, event resume/log, accessibility output, and cross-tab state. A malformed imported name falls back to the last valid Version 1.0.0 name, or `指揮官` if none exists; it never damages the imported legacy source.

### 17.2 Formation and active-instance boundary

- Formation has exactly seven ordered slots. A character ID may occupy multiple slots and each copy remains independently deployable; no uniqueness validation is permitted.
- `playableActiveCount` includes every human/player unit from accepted spawn command through deployment, combat-ready life, and defeat removal, plus any independently targetable player-controlled summon with its own HP/damage. The armored vehicle, NPC, escort, mission object, support object, and enemy are excluded.
- Spawn acceptance reads the authoritative count and performs the count reservation, command creation, battle-resource debit, cooldown start, and receipt creation in one serialized mutation. If the reserved count would exceed seven, the entire mutation is rejected: no command, resource, cooldown, receipt, animation, bark, or partial spawn. Concurrent taps/tabs cannot both reserve slot eight.
- Defeated/removed instances release one reservation exactly once. A deploying or temporarily hidden/occluded unit still occupies its reservation. Formation editing alone never creates an active instance.

### 17.3 Canonical story state machine, IDs, skip, replay, and recovery

- Canonical IDs are `v100:event:prologue`; for every `NN` from `01` to `30`, `v100:event:sNN:pre`, `v100:event:sNN:post`, and `v100:event:sNN:first-clear-post`; then `v100:event:ending`, `v100:event:credits`, and `v100:event:epilogue`. Battle barks/system banners are not story event IDs.
- New campaign order is name input -> Prologue -> Stage 1. Every attempt is `pre -> formation -> battle -> result`. Defeat ends at a defeat result and returns to formation/map without `post`, first-clear, star, reward, join, unlock, boss receipt, or next-stage unlock. First-clear victory continues `result -> post -> first-clear-post/finalize -> map`; replay victory continues `result -> post -> replay-finalize -> map` and never replays `first-clear-post`.
- Battle victory first persists a pending result snapshot without granting progression. Completing or skipping `post` reaches one serialized finalize transaction. On the first clear it commits result, highest stars, first-clear/star rewards, next-stage availability, unit/support/cap unlocks, join/discovery, boss defeat/mode gates, and the nonempty `first-clear-post` summary together. On replay it commits only the unique replay result/reward plus a newly earned star milestone, if any. A crash resumes the pending result/post/finalize boundary; it never requires a won battle to be replayed and never applies a receipt twice.
- After Stage 30 first-clear finalize: `ending -> credits -> epilogue -> postgame campaign-map`. Stage 30 battle replay returns to the map after `post`; ending/credits/epilogue replay is explicit from the event log and grants nothing.
- Skip advances through canonical nodes and marks the same versioned event read only after the destination node is durable. Skip cannot jump battle/result or bypass finalize. Explicit event replay is presentation-only, uses the current name, and never changes receipts, choices, joins, rewards, unlocks, stars, defeat counts, or Stage state.
- Event interruption persists `{eventId, phase, nodeIndex, nodeKey}` after each displayed node. Reload/import/recovery resumes the next unacknowledged node. A battle reload before a pending result returns to that Stage's formation with no debit/cooldown/result receipt retained. Multiple tabs use the existing single-writer/unique-receipt boundary; a stale tab must reload canonical state rather than replay a transition.
- The v10 story is linear. Any apparent prompt is an advance/action beat, not a product branch or hidden choice.

### 17.4 Stars, rewards, unlock receipts, and replay

- All 30 Stages use the same star contract. One star is a valid objective-complete victory with armored-vehicle HP above zero. Two stars require final armored-vehicle HP / current maximum HP >= 0.70. Three stars require >= 0.90. Escort/object HP, elapsed time, formation, unit deaths, and support use do not change stars; objective failure or vehicle destruction is defeat and awards zero.
- Stable receipts are `v100:sNN:first-clear`, `v100:sNN:star:2`, `v100:sNN:star:3`, and one unique `v100:sNN:replay:<battleRunId>` per successful replay. First clear always grants the Section 6 first-clear amount. Star 2/3 rewards grant once when that milestone is first reached, including both in the same atomic transaction when a first clear earns three stars. A replay grants the replay amount once and may also grant only previously unearned star milestones.
- Unit availability in Section 5 means purchase registration after that Stage's first-clear finalize; it never means ownership before purchase. Initial four are owned free. Level-cap, support, boss-mode, join, and next-stage changes use their locked first-clear/defeat receipts and appear only after durable finalize.

### 17.5 Stage content closure matrix

Enemy packs are fixed: `A = walker, runner, spitter, crusher`; `B = A + grappler, ooze, sprinter`; `C = B + shade, abomination`; `D = resonator, cagewalker, spindle, choir-knot, pall-manta, anchor-bloom`; `P = red-panther-knife, red-panther-shield, red-panther-smg, red-panther-commander`. A row may use only its listed pack/kinds and boss/add ownership. Luna may distribute those kinds among the already locked wave/group count, but may not invent another enemy identity.

Mission VFX ownership is fixed by objective: assault base has intact/damaged/critical/destroyed authored states; timed defense has perimeter/incoming/impact/success states; escort has moving/intact/damaged/critical/destroyed destination states; power/seal objectives have off/engaged/on plus connection/disconnection states for every node; bosses have entrance/telegraph/phase/hit/death/defeat states. Generic runtime polygons are diagnostic-only and cannot satisfy any row.

Story audio profiles reuse existing assets only: `STREET` = existing Stage 1-3 story scenes; `STATION` = existing station gate/platform/tunnel scenes; `MEDICAL` = `music-v070-stage2-tension` pre and `music-v070-rescue` post; `LAB` = `music-v070-station-tunnel` pre and `music-v070-return` post; `BAY` = `music-v070-stage3-approach` pre and `music-v070-return` post; `CORPORATE` = `music-v070-collapse-montage` pre and `music-v070-stage3-approach` post; `FINAL` = `music-v070-collapse-montage` pre and `music-v070-crawler-morning` post/ending. Nonboss battle uses the current normal/pressure scene for its location. Every live boss owns the current production `music-v099-boss` contract until death; story playback cannot silence or duplicate it. Credits have no dialogue and no BGM. Each reused montage background inherits only the ambience already owned by that source background route; a row with no source-route ambience is silent. Luna must not select, compose, or substitute another credits track.

| # | Stable Stage ID | Background / required objective | Enemy/boss ownership | Audio | First-clear payload beyond CAPS/stars/next Stage |
|---:|---|---|---|---|---|
| 1 | `stage-nishijin-shopping-street` | existing shopping street; infected base + pharmacy rescue | A | STREET | Nao purchase registration |
| 2 | `stage-sawara-ward-office` | existing ward office; 90 s evacuation perimeter | A + abomination | STREET | Mizuchi registration; healing-support purchase unlock |
| 3 | `stage-nishijin-defense-line-takuya` | existing Nishijin defense line; boss arena | A + shade/abomination; `boss-takuya`, two add waves | STREET/boss | TAKUYA discovery/mode gates |
| 4 | `stage-nishijin-station-gate` | station gate; destructible seal/base | A + grappler | STATION | Monkey registration |
| 5 | `stage-nishijin-station-platform` | station platform; sound lure/seal and boss arena | A + ooze/sprinter; `boss-gate-eater`, three adds | STATION/boss | Crazy King registration; level cap 10; Gate Eater gates |
| 6 | `stage-nishijin-station-tunnel-seal` | station tunnel; visible maintenance cart + destination | B | STATION | Raider registration; explosive-drum purchase unlock |
| 7 | `stage-university-hospital-approach` | hospital approach; 85 s medicine-transfer perimeter | B | MEDICAL | Tatara registration |
| 8 | `stage-hospital-emergency-ward` | emergency ward; infected base | B | MEDICAL | Gantetsu registration |
| 9 | `stage-hospital-evacuation-route` | basement mechanical room; exactly three power nodes | B | MEDICAL | incendiary-drum purchase unlock |
| 10 | `stage-research-access` | decontamination gate; destructible access seal | C | LAB | Mayo-chan registration; level cap 15 |
| 11 | `stage-research-containment` | specimen isolation chamber; supply pipes + boss arena | C; `boss-mother`, brood 4/6 | LAB/boss | MOTHER gates |
| 12 | `stage-research-freight-passage` | freight tunnel; sealed transport + destination | B + shade | LAB | Zakimiya registration |
| 13 | `stage-logistics-relay` | logistics relay; drug warehouse/export base | C | LAB | none |
| 14 | `stage-evacuation-freight-yard` | freight yard; three couplers + boss arena | C; `boss-ooguchi` | LAB/boss | TKY registration; Ooguchi gates |
| 15 | `stage-t-plan-outer-core` | T-Plan outer control; exactly three power nodes | C | LAB | level cap 20 |
| 16 | `stage-t-plan-central-seal` | T-Plan central seal; exactly three seal nodes | C | LAB | none |
| 17 | `stage-bay-tower-service` | bay-tower emergency corridor; boss arena | D; `boss-kurome` | BAY/boss | MrsChiha registration; Kurome gates |
| 18 | `stage-civic-archive-route` | civic archive; 95 s records-evacuation perimeter | D | BAY | none |
| 19 | `stage-coastal-link-bridge` | coastal bridge; evidence convoy + destination | D | BAY | none |
| 20 | `stage-estuary-floodgate-seal` | floodgate; control seal + boss arena | D; `boss-gairen` | BAY/boss | Miyamoto registration; level cap 25; Gairen gates |
| 21 | `stage-mugarian-logistics-hq` | corporate logistics HQ derivative; lure controller/base | D + Panther knife/SMG | CORPORATE | none |
| 22 | `stage-mugarian-clinical-trial-wing` | clinical-trial wing derivative; exactly 43 cell/rescue records and 100 s perimeter | D + Panther shield/SMG | CORPORATE | none |
| 23 | `stage-mugarian-special-operations-armory` | red-lens armory derivative; command vehicle/auth-key base | P | CORPORATE | none |
| 24 | `stage-mugarian-tech-tower` | tech-tower derivative; central controller + twin arena | Panther shield/commander; `boss-futago` | CORPORATE/boss | Futago gates |
| 25 | `stage-mugarian-executive-lab` | executive-lab derivative; medical equipment + boss arena | P; `boss-mugarian-president-mutated` | CORPORATE/boss | level cap 30; mutated-president gates |
| 26 | `stage-bay-evacuation-yard` | freight-yard reuse with new states; exactly three refrigerated trucks + destination | D + Panther SMG/commander | CORPORATE | none |
| 27 | `stage-segawa-private-lab` | private-lab derivative; lab seal/base | P, all four roles required | CORPORATE | none |
| 28 | `stage-national-dispersal-network` | coastal power-rig derivative; exactly four dispersal nodes | D + Panther shield/SMG/commander | FINAL | none |
| 29 | `stage-segawa-research-core` | high-security core derivative; overseas activation line + source-stock destruction | P, six elite waves | FINAL | none; TAKUYA-Ω activation is post-story only |
| 30 | `stage-nishijin-defense-line-takuya-omega` | exact Stage 3 location + damage/dawn overlay; evacuation buses/safe corridor | `boss-takuya-omega`; two add waves using A only | FINAL/boss | Ω gates; unlock ending -> credits -> epilogue |

Stage 30 has no midbattle story dialogue. Stage 22's `43` is a finite narrative/mission record count, not 43 simultaneously animated people. Stage 29's two destruction targets must both complete before victory. RED PANTHER present in Stage 30 pre-story are defeated by TAKUYA-Ω before the battle and are not an add roster.

### 17.6 Speaker, portrait, asset-readiness, and presentation ownership

- Major speaker IDs for Kumaverson, Paisen, Hachi, Mizuchi, Nao, Babayaga, Crazy King, Raider, Tatara, Gantetsu, Monkey, Mayo-chan, Zakimiya, TKY, MrsChiha, Miyamoto Musashi, Ikura, Segawa, human Mugarian president, mutated president, TAKUYA-Ω, and RED PANTHER commander resolve only to their own approved existing/selected identity. The `red-lens captain`, `RED PANTHER captain`, and commander-role dialogue are the selected RED PANTHER commander identity.
- `SYSTEM` and `PLAYER` action beats have no portrait. An offscreen/recorded speaker whose canonical label ends in `の声` or `メッセージ` has no portrait while offscreen; when that same identity appears in scene it uses its own identity. `知らない声` in Stage 13 has no portrait until the canonical Segawa reveal, after which Segawa r2 is used.
- Minor humans without a selected/existing identity—including Ando, shelter/rail/maintenance/medical staff, researchers, doctors, nurses, evacuees, the female station worker, and Zakimiya's wife—use the selected shared `minor-human-shared-event-silhouette-r2` when visible. It remains gender/age/occupation neutral; speaker text supplies the role. No other use is allowed.
- Every stage/event registers its background, all portraits reachable in that event, mission-object states, locked enemy/boss states, VFX, battle audio, event audio, UI icons, fonts, and ending/credits/epilogue assets in the required-runtime manifest. First install verifies and durably commits that complete set before gameplay/story/map mounts; after the gate opens, required fetches are zero.
- Mobile acceptance applies to the name screen, seven-slot formation, every story/log/replay screen, battle/result/first-clear summary, ending/credits/epilogue, and PWA progress/retry UI at Chromium/WebKit 844x340, 844x390, and 1280x720. Keyboard, safe area, 44x44 controls, readable text, battlefield area, and the 12-40 px portrait/dialogue overlap remain mandatory.

### 17.7 Runtime sprite scope closure

- Closure: `RUNTIME_SPRITE_SCOPE_CLOSED`. `PRODUCT_DESIGN_CHANGE: 0`.
- Version 1.0.0 has no task to create a new character identity, character design, or identity-master candidate. Every Producer-selected master and approved existing identity remains immutable. A runtime derivative made from that source is implementation work, not a redesign, and may not be replaced by a newly invented candidate.
- The core playable battle-atlas contract is exactly `idle`, `walk-a`, `walk-b`, `attack-a`, `attack-b`, `hit`, and `death`, for both `left` and `right`. Every registered state must be structurally distinguishable at runtime size. Existing ability presentation continues through the locked attack/active/recovery sequence plus registered VFX/audio; no extra `ability` atlas cell is required unless an `ASSET_INVENTORY.md` row explicitly requires one.

| Playable character | Combat kind | Status | Approved identity / current runtime source | Finite required action |
| --- | --- | --- | --- | --- |
| Hachi | `scout` | `REUSE_COMPLETE` | `/art/v070/characters/reference/hachi-base-r2.png` -> `/art/v070/characters/scout-battle-v1.png` | reuse seven states, both directions |
| Paisen | `brawler` | `DERIVE_RUNTIME_REQUIRED` | `/art/v060/characters/portraits/brawler-portrait-v2.webp` -> `/art/v060/characters/legacy/brawler-battle-gutter-v1.png` | derive approved-identity `idle`, `walk-a`, `walk-b`, `attack-a`, `attack-b`, `hit`, `death` atlas for both directions; `hit` and `death` must be structurally distinct |
| Kumaverson | `kumaverson` | `REUSE_COMPLETE` | `/art/v060/characters/portraits/kumaverson-portrait-v2.webp` -> `/art/v060/characters/kumaverson-battle-v1.png` | reuse seven states, both directions |
| Babayaga | `babayaga` | `REUSE_COMPLETE` | `/art/v060/characters/portraits/babayaga-portrait-v2.webp` -> `/art/v060/characters/babayaga-battle-v1.png` | reuse seven states, both directions |
| Nao | `medic` | `REUSE_COMPLETE` | `/art/v070/characters/reference/nao-base-r1.png` -> `/art/v070/characters/medic-battle-v1.png` | reuse seven states, both directions |
| Mizuchi | `ranger` | `REUSE_COMPLETE` | `/art/v070/characters/reference/mizuchi-base-r3.png` -> `/art/v070/characters/ranger-battle-v1.png` | reuse seven states, both directions |
| Monkey | `engineer` | `REUSE_COMPLETE` | `/art/v070/characters/reference/monkey-base-r11.png` -> `/art/v070/characters/engineer-battle-v1.png` | reuse seven states, both directions; never substitute the superseded V080 identity |
| Crazy King | `crazy-king` | `REUSE_COMPLETE` | `/art/v060/characters/portraits/crazy-king-portrait-v2.webp` -> `/art/v060/characters/crazy-king-battle-v1.png` | reuse seven states, both directions |
| Raider | `gunner` | `REUSE_COMPLETE` | `/art/v070/characters/reference/raider-base-r10.png` -> `/art/v070/characters/gunner-battle-v1.png` | reuse seven states, both directions |
| Tatara | `brute` | `REUSE_COMPLETE` | `/art/v070/characters/reference/tatara-base-r8.png` -> `/art/v070/characters/brute-battle-v1.png` | reuse seven states, both directions |
| Gantetsu | `guardian` | `REUSE_COMPLETE` | `/art/v070/characters/reference/gantetsu-base-r7.png` -> `/art/v070/characters/guardian-battle-v1.png` | reuse seven states, both directions |
| Mayo-chan | `mayo-chan` / `mayo-chan-feral` | `REUSE_COMPLETE` | `/art/v090/characters/reference/mayo-chan-identity-master-r1.png` -> both `/art/v090/characters/mayo-chan-battle-r1.png` and `/art/v090/characters/mayo-chan-feral-battle-r1.png` | reuse seven states, both directions, for normal and approved feral ability form |
| Zakimiya | `zakimiya` | `REUSE_COMPLETE` | `/art/v090/characters/reference/zakimiya-identity-master-r1.png` -> `/art/v090/characters/zakimiya-battle-r1.png` | reuse seven states, both directions |
| TKY | `tky` | `REUSE_COMPLETE` | `/art/v090/characters/reference/tky-identity-master-r1.png` -> `/art/v090/characters/tky-battle-r1.png` | reuse seven states, both directions |
| MrsChiha | `mrs-chiha` | `REUSE_COMPLETE` | `/art/v090/characters/reference/mrs-chiha-identity-master-r1.png` -> `/art/v090/characters/mrs-chiha-battle-r1.png` | reuse seven states, both directions |
| Miyamoto Musashi | `miyamoto-musashi` | `REUSE_COMPLETE` | `/art/v090/characters/reference/miyamoto-musashi-identity-master-r1.png` -> `/art/v090/characters/miyamoto-musashi-battle-r1.png` | reuse seven states, both directions |

- `NEW_RUNTIME_SPRITE_REQUIRED` playable units: none.
- Phase 2 -> Phase 3 entry: finish and integrate Paisen's approved-identity atlas; do not enter Phase 3 with the legacy `hit`/`death` alias.
- Phase 3: create and integrate only the finite `NEW_REQUIRED`/`DERIVE` runtime derivatives in `ASSET_INVENTORY.md`, including event portraits, RED PANTHER role atlases, mutated-president and TAKUYA-Ω entrance/idle/attack/hit/phase/death states, defeat cuts, and locked Stage 21-30 stage/mission-object derivatives.
- Phase 4 entry is a hard gate: every required runtime character/stage/mission image is complete, registered once, provenance-linked to its approved source, decode-valid at runtime size, and present in the required-runtime/PWA manifest.

### 17.8 Luna decision boundary after closure

Luna may choose module/file decomposition, immutable data representation, grapheme implementation that passes the exact contract, transaction helper structure, sprite packing/compression, crop/anchor/scale/alpha cleanup, cache batching, deterministic test-helper implementation, and spawn timestamps/lanes within each row's fixed roster and wave/group count. Luna may not choose or alter names, validation results, event IDs/order, Stage IDs/order/objectives, enemy families, boss IDs/values, unit roles/unlocks/costs, star thresholds, rewards, receipt semantics, speaker/portrait routing, story/audio profile mapping, selected assets, save namespaces, legacy/gift behavior, PWA gate, mobile thresholds, or any character identity.

Luna returns to Sol only for a true conflict between locked sources, an immutable selected asset that cannot produce its required derivative, a High/Medium regression, or a technically impossible acceptance contract. Missing product wording, unlock timing, role, Stage transition, asset owner, or retry/receipt behavior is no longer an escalation reason because it is fixed above and in the standalone handoff.

## 18. Revision r4 — remote Phase G WebKit battle-extra deterministic closure

### 18.1 Audited failure and design decision

- Audited implementation baseline: commit `0f2c6e92ddb9de5410585ec8d78dae5f3c3e3f2b`, tree `c2bd7f18d0930a9694763285dbff686c36fd27a5`.
- CI run `32455268714`, Phase G job `96694829714`, failed at the first WebKit battle-extra contract, `webkit-667x375-battle-extra`, with `page.waitForFunction: Timeout 45000ms exceeded` from `captureStateImpl` / `captureState` / the extra-contract loop.
- Artifact `9437741041`, `v100-phase-g-production-evidence`, has SHA-256 `08b7a3345a780ebb8adb3c1776b40e50ee90cc05b84d0227e613e5cb655efe4b`. It contains 51 PNGs: all 48 core Chromium captures and three Chromium battle-extra captures. It contains no WebKit battle-extra image, final Phase G report, manifest, or runtime evidence.
- The captured failure state is `null`; console, page, request, and HTTP error arrays are empty. Therefore the exact unresolved wait predicate and root cause are not proven by the current job or artifact. A page, context, or browser lifecycle failure is a possibility, not an established cause.
- CI run `32465986052` checked the synthetic merge whose PR head was docs-only commit `29c6046484d3a81793b416feb2474ca62adf77bd`. Phase G job `96726761976` passed the Stage 6 WebKit contract, then failed at `webkit-736x414-battle-extra`, mapped to `stage24-panther-commander`, with `boss frontline unit 4 never entered cooldown from the ready state` from the boss-frontline loop in `battlePage`.
- The second failure again recorded `failureState: null` with empty console, page, request, and HTTP failure arrays. Artifact `9441563957` has SHA-256 `e6a13dd7d929763b424edc52853ffffd88ade38ff0568e87cf23b5bfea6dfa5a`; its upload step reports 52 files. The ordered loop stopped before a Stage 24 screenshot, Stage 25 execution, and final report/manifest/runtime evidence.
- The later live head `cd99be209f143cbe70f313df4866759756ea18c8` differs from `29c6046` only in `PROJECT_STATE.md`, this Design Lock, and `LUNA_HANDOFF.md`; `app/**`, scripts, workflow, package, and tests are byte-unchanged across that range. The Stage 24 result is therefore current harness/runtime evidence, not a product-change regression.
- Decision: `DESIGN_REVISION_REQUIRED`. Stage 6-only focused success cannot predict closure: the same ordered WebKit battle-extra path can stop at Stage 24, while Stage 25 remains unexecuted. Revision r4 makes the three existing WebKit battle-extra contracts one finite diagnostic and regression unit. It does not authorize a product or gameplay change and does not assume both failures have the same root cause.

### 18.2 Owned files and functions

Diagnosis and a single QA-only correction are limited to these owners:

- `scripts/v100-phase-g-production-matrix.mjs`: only the three existing WebKit rows of `extraBattleContracts` (`stage06-spitter-seal`, `stage24-panther-commander`, `stage25-president`); `startCombatRuntimeObserver`; `waitForCombatActivity`; `collectCombatCausalProof`; `captureStateImpl`; `captureState`; `battlePage`, including deployment acceptance and boss-frontline orchestration; the battle-extra loop; final report/manifest writing.
- `tests/v100-phase-g-manifest.test.mjs` and `tests/v100-phase-g-negative.test.mjs`; one additional focused Phase G test file is allowed only if neither can express the checkpoint contract clearly.
- `.github/workflows/ci.yml`: only the `v100-phase-g-production` job's temporary focused binding, three fresh-context executions, and focused artifact upload. Other CI jobs remain enabled. The focused binding must be removed before the full remote Phase G run.
- `package.json`: only an exact focused Phase G command, if required to make local and remote execution identical.

The only new selector is `V100_PHASE_G_ONLY_ENGINE=webkit`. It may filter the existing battle-extra loop by engine only when `V100_PHASE_G_ONLY=battle-extra`; it must preserve the existing Stage 6 -> Stage 24 -> Stage 25 order, contracts, viewports, and evidence owners. It cannot skip a failed contract or affect the unfiltered 54-capture run.

No `app/**`, production asset, content registry, balance data, save/PWA implementation, or product runtime file is in r4 scope.

### 18.3 Required diagnostic evidence

Before changing wait or orchestration behavior, the focused runner must persist the same append-only, variant-aware checkpoint schema for every WebKit battle-extra contract. Required checkpoints are:

1. route opened;
2. formation visible;
3. battle mounted and page lifecycle listeners active;
4. combat observer started;
5. exact variant, Stage ID, viewport, expected boss/proof actor/proof unit, and ordered-run position recorded;
6. every formation or boss-frontline deployment attempt recorded with slot, unit kind, card state, affordability/resource state, click result, and accepted/rejected reason;
7. required boss/proof actor mounted, or the contract's explicit absence recorded;
8. a living human target acquired when the contract requires combat contact;
9. required proof-actor attack observed, including whether proof came from live state, audio cue, or historical receipt;
10. required proof unit deployed and attacked, or the contract's explicit absence recorded;
11. frontline deployment sequence completed, including its expected terminal card state for every attempted slot;
12. required manual ability and vehicle action observed, or each contract's explicit absence recorded;
13. causal proof complete;
14. screenshot saved.

Each checkpoint records monotonic elapsed time and the smallest existing player-visible/runtime identifiers needed to identify ownership. On failure, persist JSON before context cleanup plus a screenshot when the page remains available, the last completed checkpoint, the currently awaited predicate/invariant, deployment trace, latest readable snapshot, recent activity/cue identifiers, and page `close`, page `crash`, context close, and browser disconnect events. A terminal `state: null` without the variant, unresolved checkpoint, last readable state, and lifecycle evidence is an acceptance failure.

### 18.4 Root-cause classification and allowed correction

Exactly one class must be proven from the new evidence:

- `QA_PREDICATE_OR_ORCHESTRATION`: production combat activity occurred, but the runner missed or misclassified an existing signal. Correct only the QA predicate/orchestration in the owned files.
- `BROWSER_LIFECYCLE_OR_RESOURCE`: page/context/browser became unavailable or the runner leaked/contended resources, without evidence of a product-route fault. Correct only runner isolation, cleanup, or bounded focused-CI ownership.
- `PRODUCT_RUNTIME`: while the page remains healthy, the contract's required actor, target, deployment, attack, or production battle lifecycle genuinely does not occur. Stop and return to Sol; r4 gives no authority to edit product runtime or gameplay.
- `MEASURED_DEADLINE`: a required checkpoint completes consistently after its current deadline. The checkpoint's measured distribution may justify one named bounded deadline. A global timeout increase remains forbidden.

Allowed changes are one common checkpoint recorder, checkpoint labels/artifacts, read-only observation of existing production signals or the existing QA bridge, durable failure capture before cleanup, an exact predicate tied to an existing production event, and bounded focused-CI setup. After all three isolated diagnostics are recorded, one coherent QA-harness correction set may address the proven classes; it is committed once rather than patched variant-by-variant.

Forbidden changes include `app/**`; damage, HP, target selection, spawn/wave timing, AI, cost, cooldown, balance, hitbox, mission rules, game clocks, runtime asset behavior; fake actors/states/receipts; direct HP or lifecycle mutation; proof removal; weaker thresholds; omission of any WebKit battle-extra variant, viewport, actor, deployment, or evidence owner; generic retry; blanket timeout extension; and reuse of an artifact from another attempt as current evidence.

### 18.5 Acceptance and promotion gates

Focused acceptance requires all of the following:

- before correction, one isolated diagnostic run is captured for each existing WebKit contract: `stage06-spitter-seal` at 667x375, `stage24-panther-commander` at 736x414, and `stage25-president` at 932x430. If their proven causes cannot be handled by one coherent QA-harness correction set, stop and return to Sol;
- after that correction, the ordered trio Stage 6 -> Stage 24 -> Stage 25 passes three consecutive local sequences. Each sequence starts a fresh WebKit browser process and each contract uses a fresh context; no failed contract is retried inside a sequence;
- a bounded remote focused job then passes the same ordered trio three times with a fresh WebKit browser process per sequence and fresh context per contract;
- every contract run records all fourteen checkpoints, a valid screenshot, its unchanged combat causal proof, and zero console/page/request/HTTP diagnostic failure;
- an intentional impossible-predicate negative test exits nonzero and names the unresolved checkpoint, last valid state, and lifecycle status instead of returning only `state: null`;
- the existing sixteen semantic evidence claims and their ownership are not removed, merged, or weakened.

Full Phase G entry requires classified evidence for all three variants, one coherent correction set at most, ordered-trio local 3/3, ordered-trio remote 3/3, an allowed-file-only diff, and SOURCE / ADVERSARIAL / EXECUTION self-audits with High/Medium ambiguity zero. Then run local full Phase G and require 54/54 capture and validator success, followed by the full lint, production content validation, build, test, PWA update/recovery, save, audio, and browser regression set already required by this lock.

A full remote Phase G production-matrix execution is allowed only after those local full gates are green. After ordered-trio local 3/3, Luna may push the diagnostic commit with only the `v100-phase-g-production` job temporarily bound to three fresh ordered executions of all three WebKit battle-extra contracts; the rest of the PR workflow remains enabled and is not acceptance evidence for full Phase G. After ordered-trio remote 3/3 and local full green, restore that job to the unfiltered 54-capture command and push once for the full remote PR CI/Phase G run. Remote success is attempt-specific and may not be substituted by local or stale evidence. Complete remote green transitions only to the Section 16 `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED` gate, not directly to a Completion Packet or Sol final review.

### 18.6 Stop, escalation, and Producer guard

Stop and return to `SOL_DESIGN` without another localized fix when any of these occurs:

- evidence classifies the cause as `PRODUCT_RUNTIME`;
- the three diagnostics prove causes that cannot be handled by one coherent QA-harness correction set;
- the single correction set is followed by any failure in the ordered WebKit trio or any new failure in the same Phase G gate;
- ordered-trio remote execution fails after ordered-trio local 3/3;
- required failure evidence is still `null`, missing, or cannot identify the awaited predicate;
- closure would require weakening a production evidence claim, changing a locked product value, or editing a forbidden file.

All r2 Producer intent remains immutable. In particular, no gameplay, AI, damage, timing, balance, visual, audio, identity, story, mission, save, PWA, mobile, or release behavior may be changed to make QA green. `PRODUCT_DESIGN_CHANGE: 0`.

## 19. Revision r5 — authoritative execution and release loop

### 19.1 Authority and scope

This section is the Version 1.0.0-specific execution state machine. It supersedes generic Completion Packet ordering where that ordering conflicts with Sections 16 or 19. Issue #172 is the execution ledger for this state machine after Sol records r5 there. The earlier `V100-LOOP-LOCK-001` PR comment and the pre-r5 form of Issue #172 are audit inputs only, not a parallel Design Lock.

Revision r5 changes execution ownership and release safety only. It does not alter Section 18's Phase G diagnostics, product requirements, gameplay, balance, AI, save, PWA, assets, audio, the 54-capture contract, or any acceptance threshold. `PRODUCT_DESIGN_CHANGE: 0`.

Every state transition must record the immutable candidate HEAD and tree, the exact gate/run/job/artifact identifiers used, and the next state and owner in Issue #172 or the PR #171 body. A field named `LAST_AUDITED_HEAD` is a stable audit cursor, never a substitute for re-fetching the live PR ref. At every resume, push, gate decision, Producer checkpoint, review, integration step, and release action, re-fetch live GitHub state first and stop on mismatch.

### 19.2 Execution state machine

| State | Owner | Entry condition and only allowed action | Success transition | Failure or stop transition |
|---|---|---|---|---|
| `SOL_DESIGN_ACTIVE` | original Sol thread | Audit authority, live refs, evidence, current Design Lock, and the complete loop. Sol may edit canonical design/ledger metadata but not production implementation. | `DESIGN_LOCKED` with a revision, cursor, `NEXT_OWNER`, and `RESUME_FROM` -> `LUNA_IMPLEMENTATION_ACTIVE`. | Unresolved High/Medium ambiguity -> remain `NOT_LOCKED`; Luna stays stopped. |
| `LUNA_IMPLEMENTATION_ACTIVE` | Luna | Execute only the current Design Lock/Handoff from the exact cursor. Luna may use only the current phase's allowlist and may not choose product behavior, acceptance, return class, or release state. | Current focused/local/remote gate sequence advances exactly as Sections 18.5 and 19.4 specify. | Any stop condition -> `BLOCKED_RETURN_TO_SOL`; no repair commit, retry, rerun, or scope expansion unless the lock explicitly requires that run. |
| `BLOCKED_RETURN_TO_SOL` | original Sol thread | Luna records failing HEAD/tree, gate, run/job/artifact, last green gate, and diagnostics, then stops. | Sol classifies under Section 19.3 and emits either a same-revision bounded remediation packet or a new locked revision. | Missing evidence needed to classify -> Sol writes a bounded diagnostic design; Luna does not diagnose by improvisation. |
| `REMEDIATION_PACKET_READY` | Luna | Same Design revision; execute only Sol's exact allowlist, forbidden list, byte/semantic contract, validation, stop conditions, and cursor. | Return to the exact `RESUME_FROM`; never restart already-valid gates unless the packet says their dependency changed. | Any different failure, out-of-allowlist need, or failed acceptance -> `BLOCKED_RETURN_TO_SOL`. |
| `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED` | Producer | Enter only after the complete candidate-specific remote required CI and unfiltered Phase G are green. Submit the twelve Section 16 actual-production screens against one HEAD/tree. | Explicit Producer Visual Approval records `APPROVED_HEAD`, `APPROVED_TREE`, twelve evidence identifiers, and approval comment/time -> `PRODUCER_VISUAL_APPROVED_FREEZE`. | Reject or changes requested -> `SOL_DESIGN_ACTIVE`; Luna does not interpret the feedback or edit. |
| `PRODUCER_VISUAL_APPROVED_FREEZE` | Luna | Do not commit. Finalize the Completion Packet as Issue/PR text and immutable artifacts against the approved HEAD/tree. | Exact live HEAD/tree match and complete packet -> `READY_FOR_SOL_FINAL_REVIEW`; owner returns to original Sol thread. | Any branch commit or HEAD/tree mismatch invalidates the freeze and Visual Approval -> `SOL_DESIGN_ACTIVE`, then all candidate gates and the Visual Checkpoint must be repeated. |
| `SOL_FINAL_REVIEW_ACTIVE` | original Sol thread | Read-only audit of the frozen approved HEAD/tree and all required evidence. No fix in review mode. | High 0 / Medium 0 and no release action -> `SOL_FINAL_REVIEW_APPROVED`. | A finding routes only through Section 19.6. |
| `SOL_FINAL_REVIEW_APPROVED` | Producer | Sol records exact approved HEAD/tree and finding counts. No integration or release action yet. | -> `PRODUCER_FINAL_ACCEPTANCE`. | Any candidate mutation invalidates approval -> `SOL_DESIGN_ACTIVE`. |
| `PRODUCER_FINAL_ACCEPTANCE` | Producer | Producer accepts or rejects the exact Sol-approved HEAD/tree. Silence is not approval. | Explicit approval -> `STACKED_INTEGRATION_ACTIVE`. | Reject/changes requested -> `SOL_DESIGN_ACTIVE`; Section 19.7 applies. |
| `STACKED_INTEGRATION_ACTIVE` | ChatGPT/command thread acting as the Producer-authorized release executor | Execute Section 19.8 only. Each Ready/retarget/merge step requires fresh expected-head, base, required-check, mergeability, and synthetic-tree checks. | PR #171 merge result SHA/tree verified -> `RELEASE_SHA_LOCKED`. | Drift, conflict, failing/skipped required check, unexpected tree, or permission failure -> `BLOCKED_RETURN_TO_SOL`; no merge/tag/release. |
| `RELEASE_SHA_LOCKED` | the same Producer-authorized command thread | Release SHA is the PR #171 merge result on `main`; verify its tree is the Producer-accepted tree. Execute Section 19.9 only after explicit release authority remains current. | Annotated tag, matching GitHub Release, and explicit Pages release request succeed -> explicit `LUNA_VALIDATION` handoff for `RELEASED` QA. | Any mismatch or partial release failure -> stop and return to Sol; never move a tag or rewrite history. |
| `RELEASED` | Luna under a new explicit `ROLE_LOCK: LUNA_VALIDATION` post-release handoff | Run only the Section 19.10 post-release QA at the published SHA. Keep Issue #172 open; no repair, redeploy, rollback, or closure authority. | Report all gates green to the command thread -> controlled `PROJECT_STATE` update and `CLOSED`. | Public failure -> `POST_RELEASE_BLOCKED`; record evidence and return to Sol without repair. |
| `POST_RELEASE_BLOCKED` | original Sol thread, with Producer decision where release/product scope changes | Classify infrastructure redeploy versus product recovery and write an exact `RELEASE_BACKUP_RECOVERY.md`-conformant packet. | A separately authorized recovery flow begins. | Unresolved recovery authority or immutable-ref mismatch -> remain stopped; no Luna or command-thread improvisation. |
| `CLOSED` | ChatGPT/command thread | Enter only after published-SHA QA green. Update `PROJECT_STATE`, record release/post-QA evidence, close Issue #172 as completed, and clean only verified merged branches. | Version 1.0.0 loop complete. | Any missing evidence -> remain `RELEASED`; do not close. |

Only one owner is active. Sol and Luna do not implement or review in parallel. `READY_FOR_SOL_FINAL_REVIEW`, `SOL_FINAL_REVIEW_APPROVED`, `PRODUCER_FINAL_ACCEPTANCE`, `RELEASE_SHA_LOCKED`, `RELEASED`, and `CLOSED` are distinct states and may not be collapsed.

### 19.3 Sol classification after a return

Sol, never Luna, chooses exactly one class. Before Final Review, Sol remains in `SOL_DESIGN`, does not edit production code, and may issue a same-revision packet for Luna. Only a Final Review finding classified `REMEDIATION_LOCAL` permits `SOL_REMEDIATION` and its mandatory later `LUNA_VALIDATION`:

- `REMEDIATION_LOCAL`: root cause and correction are mechanical and bounded without changing product behavior, architecture, acceptance, evidence strength, save/PWA/release semantics, gameplay, balance, or AI. Keep the current revision and write one exact remediation packet with target files/functions, allowed and forbidden changes, validation, regression range, stop conditions, and cursor.
- `DESIGN_CHANGE_REQUIRED`: any product/runtime correction, architectural choice, acceptance change, ambiguous root cause requiring a new diagnostic contract, more than one incoherent correction set, or change to state ownership/return/release rules. Increment the Design revision, lock the delta, and issue a new handoff.

A new failure at the same required gate after a bounded remediation is never authority for another Luna fix. Luna returns to Sol after the first failed attempt. Sol may require new diagnostics only through one of the two classifications above.

### 19.4 Technical gate order and promotion

For the current r5 cursor, Luna executes this exact order:

1. Section 19.5 LF-only remediation and its semantic/byte checks;
2. commit/push normally and require PR Verify green in the resulting focused remote workflow run;
3. allow that same workflow run to start the already-bound automated remote ordered WebKit trio, require three complete sequences of Stage 6 -> Stage 24 -> Stage 25, then wait until the entire focused run is terminal; every required job must be green;
4. only then run local unfiltered Phase G 54/54 plus validator and every Section 18.5 full regression;
5. restore the unfiltered Phase G workflow binding and prove its focused-only binding is absent;
6. push normally and require one new unfiltered remote required-CI run, including Phase G 54/54, validator, all required jobs, and required artifacts;
7. wait until that entire unfiltered run is terminal; only complete green may enter the Producer Visual Checkpoint.

The already-complete isolated diagnostics and local ordered trio 3/3 are not repeated for the LF-only change, and they are not final evidence. A prior, local, partial, skipped, cancelled, neutral, or stale run cannot substitute for an attempt-specific required remote result. After the LF push, any required job failure or unexpected skip in the candidate's required run returns immediately to Sol after the run is terminal. Luna has no authority to decide that a failure is unrelated, flaky, retryable, or ignorable.

### 19.5 Current execution cursor and LF-only remediation

- `DESIGN_AUDITED_HEAD`: `c57bd2690ef1f50e92e99736d59dab86c4af71f9`
- `DESIGN_AUDITED_TREE`: `65bb817fc3b73526619e51ac4712094f7a1834e6`
- `LF_SEMANTIC_BASE`: `f7149732fadec5142d0e475f201984dd5a48e217`
- `FAILED_GATE`: runs `32475729057` and `32478283607`; PR Verify jobs `96751598547` and `96759071225`; `Check patch whitespace`; dependent Phase G skipped
- `LAST_GREEN_GATE`: isolated Stage 6/24/25 diagnostics complete and local ordered trio 3/3, local-only and not reusable for final freeze
- `REMEDIATION_CLASS`: `REPO_HYGIENE / REMEDIATION_LOCAL`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION`
- `RESUME_FROM`: exact-file LF remediation with semantic diff 0 -> push -> PR Verify green -> same focused run's automated remote ordered trio 3/3 -> every required job in that focused run terminal green

The exact packet in Handoff Section 12 is authoritative. It permits only LF normalization of `.github/workflows/ci.yml` and `scripts/v100-phase-g-production-matrix.mjs`, plus the three-path LF contract in `.gitattributes`. It preserves the workflow BOM, preserves `tests/v100-phase-g-checkpoint.test.mjs` byte-for-byte, forbids repository-wide normalization and all `app/**`/product/gameplay/evidence changes, and requires CI-equivalent `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD` plus semantic-diff-zero proof against `LF_SEMANTIC_BASE`.

Before editing, Luna re-fetches PR #171 and verifies the live history contains both `DESIGN_AUDITED_HEAD` and the r5 packet commit identified in Issue #172/PR #171. If targets changed after that packet, stop. The live HEAD is not embedded here because it changes when this docs-only revision is committed; it must be read from the GitHub ref.

### 19.6 Sol Final Review finding routing

Sol records one of these outcomes against the frozen HEAD/tree:

- `APPROVE`: High 0, Medium 0 -> `PRODUCER_FINAL_ACCEPTANCE`.
- `EVIDENCE_PACKET_INCOMPLETE`: no candidate commit is needed. Return to `LUNA_IMPLEMENTATION_ACTIVE` only to add or repair immutable evidence/ledger references for the same HEAD/tree. Producer Visual Approval remains valid only while both hashes remain exact. Then resume the same Sol Final Review.
- `REMEDIATION_LOCAL`: Sol exits review mode, owns and commits only the bounded local remediation allowed by the Sol role, then hands the new HEAD to `LUNA_VALIDATION`. Because the branch changed, all candidate technical gates, Producer Visual Checkpoint, evidence freeze, and Sol Final Review repeat.
- `DESIGN_CHANGE_REQUIRED`: return to `SOL_DESIGN_ACTIVE`, increment the revision, then Luna implements the new lock. All candidate technical gates, Producer Visual Checkpoint, evidence freeze, and Sol Final Review repeat.

Luna never chooses the finding class, the affected regression range, whether Visual Approval survives, or whether review may resume. Any branch commit after Visual Approval invalidates that approval; only same-HEAD/tree evidence completion may preserve it.

### 19.7 Producer Visual or Final Acceptance rejection

Any Producer rejection or changes request returns to `SOL_DESIGN_ACTIVE` with the exact Producer statement recorded. Sol decides whether the response is a same-revision `REMEDIATION_LOCAL` packet or `DESIGN_CHANGE_REQUIRED`. Luna makes no edit until a new Design-locked cursor exists. Any resulting branch commit requires the full candidate gate sequence, a new twelve-screen Visual Checkpoint and approval, a new freeze, a new Sol Final Review approval, and a new Producer Final Acceptance. A rejection never authorizes direct integration or release.

### 19.8 Stacked integration contract

The approved stack is exactly:

1. PR #169: `docs/story-v10-final-release-baseline` -> `main`;
2. PR #170: `codex/v1.0.0-sol-design` -> first the PR #169 branch, then retarget to updated `main` after #169 merges;
3. PR #171: `codex/v1.0.0-luna-implementation` -> first the PR #170 branch, then retarget to updated `main` after #170 merges.

At the r5 audit, the fixed heads are #169 `435dc959d1972646f7e82b6c45d3f1c25d890252`, #170 `6acf87fd235fb55d3d5e3ec1f8687b57a06dc769`, and #171's live ref, which must equal the Producer-accepted HEAD at integration time. These values are preconditions, not permissions to use stale state.

After explicit Producer Final Acceptance, make #169 Ready, require complete green/mergeable and exact head, then normally merge. Re-fetch `main`; retarget #170 to `main`, require a fresh complete green synthetic result, exact head, and mergeability, then normally merge. Re-fetch `main`; retarget #171 to `main`, require fresh complete green required CI including unfiltered Phase G, exact Producer-accepted head, and mergeability. Before merging #171, compute or obtain the synthetic merge tree and require it to equal `APPROVED_TREE`; unexpected `main` drift is a stop, not an allowed extra. Only then normally merge #171.

The PR #171 merge result commit, not a PR head or earlier main SHA, becomes `RELEASE_SHA`. Re-fetch it from `main`; require its tree to equal `APPROVED_TREE` and its ancestry to include the three approved PR heads. Any mismatch returns to Sol before tag, Release, or Pages. No force push, rebase, amend, direct-main push, bypassed check, or squash-dependent content reconstruction is authorized.

### 19.9 Tag, GitHub Release, and official Pages

Release action remains prohibited until `SOL_FINAL_REVIEW_APPROVED` and explicit `PRODUCER_FINAL_ACCEPTANCE` are both recorded for the exact approved HEAD/tree and stacked integration has produced the verified `RELEASE_SHA`.

The authorized executor then:

1. creates annotated tag `v1.0.0` at `RELEASE_SHA` without moving any existing tag;
2. creates the matching non-draft, non-prerelease GitHub Release at that tag;
3. keeps Issue #172 open and records tag, Release, SHA, and tree;
4. manually dispatches the official Pages workflow from `main` with exactly: `operation=release`, `deploy=true`, `version=1.0.0`, `release_ref=v1.0.0`, `release_sha=RELEASE_SHA`, `issue_number=172`, and one new unique `request_id`;
5. requires source validation, production build, static Pages build, browser smoke, deployment, and published metadata to succeed.

A PR workflow, preview, ordinary `main` push, docs update, tag alone, or Release alone is never the official deployment. ChatGPT Sites is excluded.

### 19.10 Post-release QA, recovery, and closure

At the public URL, verify the published version and SHA match `RELEASE_SHA`; anonymous access and major assets have no auth/404/request failure; fresh save and the supported previous-release save/PWA update paths work; save/export/import/corruption recovery and offline/rollback-generation contracts remain intact; required mobile/WebKit, audio, battle, event, ending/credits/epilogue, and Producer-accepted presentation evidence still represent the published build. Record exact browsers/devices and never substitute WebKit emulation for physical-iPhone claims.

If deployment infrastructure or published metadata is wrong while the immutable release code is proven correct, stop in `POST_RELEASE_BLOCKED` and return to Sol for an exact `RELEASE_BACKUP_RECOVERY.md` redeploy packet. If product code/content/save/PWA is wrong, return to Sol and Producer; recover through a normal revert/fix PR and a new immutable release request. Never force-reset `main`, move/overwrite `v1.0.0`, rewrite a Release, or claim rollback before the public SHA is verified. Luna has no autonomous post-release repair or rollback authority.

Only after post-release QA is green may a controlled follow-up update `PROJECT_STATE.md` with the published merge SHA/tree/tag/Release/Pages evidence, record completion in Issue #172, close it with `state_reason=completed`, and clean merged branches. The generic governance normalization debt is a separate post-V1 change and cannot delay or mutate this candidate unless Producer explicitly reopens it.

### 19.11 r5 audit result

The original Sol thread re-read all mandatory authorities and live PR/CI evidence, then performed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits. Revision r5 is locked only with `High ambiguity: 0` and `Medium ambiguity: 0`. This is design/execution closure, not product readiness, Visual Approval, Final Review approval, Producer Final Acceptance, integration, or release authorization.

## 20. Revision r6 — required-CI product-runtime diagnostic return

### 20.1 Audited evidence and classification

Sol re-fetched PR #171 and audited candidate HEAD `21b3a2076b5ff580189c9cfe69fb4dc30193a45d`, tree `1f741a0cb0f202690c7f96d4578c3f26ef470a39`, parent `3d0eb4ddfbee2365c33e7fd5e8dc6eff96c098db`, focused run `32487312283`, stop comment `5370853681`, job logs, artifacts, and workflow dependencies.

The LF packet itself is closed: its commit changes exactly `.gitattributes`, `.github/workflows/ci.yml`, and `scripts/v100-phase-g-production-matrix.mjs`; both normalized files have semantic diff zero against the parent, the workflow keeps its UTF-8 BOM, the Phase G script keeps no BOM, the checkpoint test blob is unchanged, and CI-equivalent `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD` passes. In run `32487312283`, `Check patch whitespace`, lint, content validation, build, tests, PWA partial-update QA, and Chromium canonical-HUD evidence passed before the new failure.

The new required failures are distinct and neither is classified as retryable:

- PR Verify job `96786672078` failed `Capture Issue 156 final-canvas deployment evidence (Chromium)`: `667x375`, `844x340`, and `932x430` timed out under an unchanged 30,000 ms setup/readiness wait, while `736x414`, `844x390`, and `1280x720` passed. Artifact `9448623917` reports `units: []` for all three failures and contains no failure screenshot or lifecycle path, proving the failure occurred inside `openBattlePage` before the first unit/checkpoint/final-canvas assertion. The job label is not a root-cause classification. The later Issue 165 upload error is secondary because its producer step was skipped after the primary failure.
- WebKit Stage 3 Audio Route job `96792165248` failed only `final-candidate` at `final-cut`: the 60,000 ms predicate timed out, `failureState` was null, diagnostics and pending requests were zero, and no retry condition matched. Artifact `9449229851` records the failure. In the same run, `entrance-candidate` job `96792165262` and exact PR-base `final-base` job `96792165296` passed. Candidate and base use the same `scripts/p5-browser-smoke.mjs` and `scripts/run-stage3-audio-bounded.mjs`; the controlled difference is the built product tree.
- `V1 Phase G Production Matrix` job `96789049082` was skipped because `.github/workflows/ci.yml` binds it with `needs: verify`. Therefore no remote ordered trio, local full Phase G, or unfiltered remote Phase G exists for this candidate.

This evidence proves candidate-specific required-regression divergence, but it does not identify the exact product owner for either failure and does not prove that the two failures share a cause. Under Section 19.3, an ambiguous root requiring a new diagnostic contract and potentially more than one correction set is `DESIGN_CHANGE_REQUIRED`. Revision r6 therefore classifies the return as `REQUIRED_CI_PRODUCT_RUNTIME_DIAGNOSTIC / DESIGN_CHANGE_REQUIRED`; it is not a same-revision retry or correction packet.

### 20.2 Diagnostic-only ownership

Luna may make one additive diagnostic commit affecting only:

- `scripts/v099-final-remediation-browser-smoke.mjs`: `enterLegacyQaBattle`, `openBattlePage`, `pauseAtDeploymentCheckpoint`, `queueAndPauseAtFirstDeploymentFrame`, `runDeploymentCase`, and failure serialization;
- `scripts/p5-browser-smoke.mjs`: `auditTakuyaFinalAudio`, the final-cut wait wrapper, and failure serialization;
- `scripts/run-stage3-audio-bounded.mjs`: report serialization only, if needed to preserve the child diagnostic record;
- `tests/v0995-runtime-evidence-contract.test.mjs`, `tests/stage3-final-bounded.test.mjs`, and `tests/ci-contract.test.mjs`: additive checks proving the diagnostic schema and unchanged retry/acceptance contract.

No other file is authorized. In particular, `.github/workflows/ci.yml`, `.gitattributes`, `scripts/v100-phase-g-production-matrix.mjs`, every `app/**` and `public/**` file, package files, product data/assets/audio, and all unrelated tests are forbidden. If the additive evidence cannot be produced from the existing browser QA APIs within this allowlist, Luna records that exact missing observation and returns to Sol without editing.

### 20.3 Required finite evidence

The diagnostic commit observes only; it must not call a new mutating QA method or change the order or arguments of existing mutating fixture calls.

For every Chromium deployment axis, begin a bounded `setupTrace` at page creation and retain at most 160 samples, no faster than once per 250 ms, through navigation, install-offer dismissal, legacy screen advancement, battle readiness, asset-boundary sealing, or failure. Each sample contains elapsed wall time, lifecycle phase, URL, document visibility, `.game-shell` screen, battle API presence, snapshot screen/running/paused/over/time, asset API presence, asset state/generation/completed/total/pending/failed/reason, current story line/screen when present, and console/page/request/HTTP/pending-request counts. `openBattlePage` must preserve this trace, the page close/crash signal, the last readable snapshot, and one failure screenshot even when it throws before returning the page to `runDeploymentCase`.

Only after readiness succeeds, persist a bounded `deploymentTrace` for the active unit and expected checkpoint. Sample no faster than once per 250 ms and retain at most 160 samples per unit. Each sample contains elapsed wall time, unit kind/family, expected checkpoint/progress, document visibility, snapshot time/paused/over, fighter presence/id/x/y, door X, ramp X, computed progress, `gateEntering`, `combatReady`, `entryRampCleared`, and the existing deployment audit's `active`, `checkpoint`, `unitPass`, actual/opaque pixel bounds, and `finalCompositePixels`. A timeout record also contains the last sample, queue/fixture result, lifecycle phase, diagnostics, and failure screenshot. Passed axes retain their final setup trace and final unit trace so the three passing viewports are controls; assertions and screenshot/contact-sheet counts remain unchanged.

For WebKit Stage 3 `final-candidate`, add a Node-owned `finalCutTrace` sampled once per second from immediately before resume until success, page close/crash, or the existing 60,000 ms deadline. Retain at most 75 samples. Each sample contains wall time, document visibility, audio dataset scene, snapshot time/paused/over/bossDefeated, the live TAKUYA id/hp/maxHp/ratio/combatReady/gateEntering/contained/state/cooldown/target, living-human count and kinds, `storyBattleReceiptEventIds`, `storyBattleEvaluatedCueKeys`, active/pending scripted bark IDs, and page/asset/pending-request state. Node also records page `close`/`crash`, the exact awaited predicate components, and the last successful sample even if a catch-time `page.evaluate` fails. The existing final-cut predicate, `P5_QA_TIMEOUT_MS`, and final-base control remain byte-equivalent in meaning.

One normal push of this diagnostic commit starts exactly one new CI run. Luna waits until that run is terminal and records the new HEAD/tree, run/job/artifact IDs, the six Chromium axis results, Stage 3 entrance-candidate/final-candidate/final-base results, PR Verify result, and Phase G result. No manual rerun, job rerun, second diagnostic commit, or correction is authorized. The remote run is diagnostic evidence even when the same required jobs fail as expected; it is not a green gate or final-freeze evidence.

### 20.4 Sol-only classification after diagnostic return

Luna does not name the root cause or choose a correction. On return, Sol applies these mechanical evidence distinctions:

- battle screen/running state or asset readiness never satisfies the existing setup predicate while the page remains live: setup/asset lifecycle owner;
- deployment queue/spawn absent, rAF live, or progress/checkpoint never advances after readiness: product deployment lifecycle owner;
- checkpoint/progress reached but composite/opacity/geometry audit diverges: product rendering/final-canvas owner;
- Stage 3 boss ratio never reaches 0.25 while the battle remains live: product combat-runtime regression owner;
- ratio reaches 0.25 but evaluated cue/receipt is absent: product story-trigger owner;
- cue/receipt exists but the scripted bark or expected audio scene is absent: product bark/audio-route owner;
- predicate components are all true while the waiter remains unresolved: QA predicate/orchestration owner;
- page close/crash or missing samples with an exact lifecycle signal: browser lifecycle/harness owner.

If the trace does not satisfy exactly one of these evidence classes for each failure, Sol writes the next design delta; Luna does not infer. If both failures resolve to one coherent QA-harness correction, Sol may issue a bounded remediation under a new locked cursor. Any `app/**` correction, multiple incoherent correction sets, gameplay/balance/AI effect, acceptance change, or evidence weakening requires another Design revision before implementation.

### 20.5 Acceptance, stop, and cursor

Before push, the diagnostic commit must pass:

1. `node --test tests/v0995-runtime-evidence-contract.test.mjs tests/stage3-final-bounded.test.mjs tests/ci-contract.test.mjs`;
2. `npm run lint` and `npm run build`;
3. `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD`;
4. diff audit proving only the Section 20.2 allowlist changed and no timeout, retry count, predicate, expected axis/unit/case, assertion, artifact retention, or pass/fail threshold weakened.

Cursor:

- `LAST_AUDITED_HEAD`: `21b3a2076b5ff580189c9cfe69fb4dc30193a45d`
- `LAST_AUDITED_TREE`: `1f741a0cb0f202690c7f96d4578c3f26ef470a39`
- `FAILED_GATE`: run `32487312283`; PR Verify `96786672078` Chromium final-canvas; Stage 3 final-candidate `96792165248`; dependent Phase G `96789049082` skipped
- `LAST_GREEN_GATE`: LF byte/BOM/EOL/semantic-zero contract and `Check patch whitespace` passed; run `32487312283` pre-failure PR Verify steps through Chromium canonical HUD passed; WebKit enemy shards, hosted evidence, Stage 3 entrance-candidate, and exact-base final control passed. These are diagnostic controls, not final-freeze evidence.
- `REMEDIATION_CLASS`: `REQUIRED_CI_PRODUCT_RUNTIME_DIAGNOSTIC / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Section 20 diagnostic-only execution
- `RESUME_FROM`: add only the Section 20.2 observations -> local focused contract/lint/build/diff checks -> one normal diagnostic push -> wait for that one CI run terminal -> `BLOCKED_RETURN_TO_SOL_DIAGNOSTIC_COMPLETE`

Any target/precondition drift, required observation needing an out-of-allowlist file, local acceptance failure, different remote failure, missing required artifact, or inability to preserve a last sample causes immediate `BLOCKED_RETURN_TO_SOL` with no push beyond the one authorized diagnostic commit and no correction. Phase G remains stopped. Producer Visual Checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, and Issue closure remain prohibited.

### 20.6 r6 audit result

Sol performed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against the live candidate and run. The diagnostic scope, evidence schema, single-push limit, return owner, and release boundary are locked with `High ambiguity: 0` and `Medium ambiguity: 0`. This is diagnostic design closure only, not root-cause correction or release readiness.

## 21. Revision r7 — r6 diagnostic classification and bounded correction

### 21.1 Audited evidence

Sol re-fetched PR #171 and audited live HEAD `bad1578b45171b476a8989c3180433ba14f973b7`, tree `fded05d05fd216d512cbec8a17d647a59cf1dd04`, parent/r6 packet `b986d153f10ad2fab1209bf32cc4faa3bea721d5`, run `32496778334`, Luna return comment `5372127863`, raw job logs, and artifacts `9452768749` / `9452903579`.

Run `32496778334` is terminal failure. The six WebKit enemy-runtime shards, hosted evidence, Stage 3 entrance-candidate, and Stage 3 final-candidate passed. Those six enemy-runtime shards are not the six Chromium deployment axes required by Section 20.3. PR Verify job `96817031062` stopped at `Check patch whitespace`, before the Chromium deployment diagnostic step, so the original Chromium setup/readiness diagnostic remains unexecuted. Phase G job `96817216110` was skipped through `needs: verify`; no remote ordered trio or Phase G artifact exists for this HEAD.

The raw base-range whitespace log reports CRLF-derived trailing whitespace in all five r6 diagnostic files, not only one test: `scripts/p5-browser-smoke.mjs` 2,246 lines, `scripts/v099-final-remediation-browser-smoke.mjs` 2,103, `tests/ci-contract.test.mjs` 192, `tests/stage3-final-bounded.test.mjs` 89, and `tests/v0995-runtime-evidence-contract.test.mjs` 79. Parent `b986d15` stores those files as LF-only. HEAD `bad1578` stores mixed CRLF/LF while preserving the prior BOM state: no BOM for the two scripts and `v0995` test; UTF-8 BOM for `ci-contract` and `stage3-final-bounded`. This is repository-byte hygiene, not product behavior.

Stage 3 final-base job `96823095853` exhausted the existing bounded two-attempt contract. Both attempts ended with `Target page, context or browser has been closed`, clean console/page/request/HTTP diagnostics, an explicit WebKit crash/close signal, and no manual retry. Artifact `9452903579` supplies the decisive second-attempt trace: at elapsed 15,043 ms the page was still live and visible, TAKUYA ratio was `0.20874999999999985`, `stage-takuya-final-v070` receipt and `final-weakpoint-exposed` evaluated cue existed, an active scripted final cue bark existed, `bossDefeated` remained false, and audio scene remained `boss`. Thus every existing final-cut predicate component was true well before the 60,000 ms deadline, yet page-owned `page.waitForFunction` remained unresolved; the page later emitted crash at 41,128 ms and close at 46,138 ms. The candidate control used the same fixture and completed in one attempt.

### 21.2 Independent classification and revision decision

The failures do not share a root cause:

- whitespace: `REPO_HYGIENE / FIVE_FILE_MIXED_EOL / REMEDIATION_LOCAL`; owner is the five diagnostic blobs plus their missing path-specific LF contract;
- Stage 3 final-base: `QA_HARNESS_PREDICATE_ORCHESTRATION / REMEDIATION_LOCAL`; owner is only the final-cut wait wrapper in `scripts/p5-browser-smoke.mjs`. The r6 trace satisfies Section 20.4's “predicate components all true while the waiter remains unresolved” class. The later WebKit crash is a secondary lifecycle consequence after the acceptance predicate had already become true, not evidence of a product combat/story/audio failure;
- original Chromium setup/readiness: `DIAGNOSTIC_PENDING`; PR Verify never reached the six deployment axes, so Sol makes no product/harness classification for that earlier failure yet.

Two independent correction sets plus a new wait owner require `DESIGN_CHANGE_REQUIRED` under Section 20.4. Revision r7 is therefore authoritative. Its aggregate class is `DUAL_LOCAL_REMEDIATION / REPO_HYGIENE + QA_HARNESS_PREDICATE_ORCHESTRATION / DESIGN_CHANGE_REQUIRED`. No product, gameplay, balance, AI, story, audio, VFX, save, PWA, acceptance, timeout, or retry change is required or allowed.

### 21.3 Exact authorized correction

Luna may make one correction commit affecting exactly these six files:

1. `.gitattributes`: add exactly these five path contracts and no wildcard/repository-wide rule:
   - `scripts/p5-browser-smoke.mjs text eol=lf`
   - `scripts/v099-final-remediation-browser-smoke.mjs text eol=lf`
   - `tests/ci-contract.test.mjs text eol=lf`
   - `tests/stage3-final-bounded.test.mjs text eol=lf`
   - `tests/v0995-runtime-evidence-contract.test.mjs text eol=lf`
2. Normalize those five files to LF. Preserve UTF-8 BOM in `tests/ci-contract.test.mjs` and `tests/stage3-final-bounded.test.mjs`; keep the other three no-BOM. `scripts/v099-final-remediation-browser-smoke.mjs` and `tests/v0995-runtime-evidence-contract.test.mjs` must have semantic diff zero against `bad1578` after CRLF/LF normalization.
3. In `scripts/p5-browser-smoke.mjs`, replace only the final-cut `page.waitForFunction` call with `waitForFinalCutPredicateFromNode`. The Node-owned loop evaluates the same three components—active scripted `stage-takuya-final-v070` cue, `bossDefeated === false`, and expected `boss` audio scene—using non-overlapping `page.evaluate` calls. Attempt start cadence is 50 ms, the total deadline is the unchanged `P5_QA_TIMEOUT_MS` / 60,000 ms, and the returned evidence records each component and `matched`. If the deadline expires it throws a `TimeoutError`; if page evaluate closes/crashes before a match it preserves that exact error for the existing bounded runner. No product mutation or fallback success is allowed.
4. Keep the r6 one-second `finalCutTrace`, its 75-sample cap, candidate/base distinction, final-base build, final story/audio assertions, and `scripts/run-stage3-audio-bounded.mjs` byte-identical. Do not add or remove an attempt; the existing maximum remains two.
5. In `tests/stage3-final-bounded.test.mjs`, add source-contract checks for the Node-owned function, exact three predicate components, 50 ms cadence, 60,000 ms shared deadline, non-overlap, and removal of page-owned `waitForFunction` only from the final-cut wait block. Retain all retry/no-weakening checks.
6. In `tests/ci-contract.test.mjs`, assert the five exact `.gitattributes` entries. Apart from this contract and EOL normalization, preserve its semantics. `tests/v0995-runtime-evidence-contract.test.mjs` receives EOL normalization only.

Every other file is forbidden, including `.github/workflows/ci.yml`, `scripts/run-stage3-audio-bounded.mjs`, Phase G files, every `app/**` / `public/**` file, package files, product data/assets/audio, and unrelated tests/docs. No timeout extension, retry/rerun expansion, predicate/assertion/axis/unit/case/artifact weakening, or product correction is authorized.

### 21.4 Validation, remote run, and stop

Before push, Luna must prove:

1. the five normalized files contain LF only and no bare CR; BOM states match Section 21.3;
2. `.gitattributes` differs only by the five exact entries;
3. normalized semantic diff is zero for the two EOL-only files, while the other semantic diff is limited to the exact wait/test contracts above;
4. `node --test tests/v0995-runtime-evidence-contract.test.mjs tests/stage3-final-bounded.test.mjs tests/ci-contract.test.mjs` passes;
5. `npm run lint`, `npm run build`, and `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD` pass;
6. exact diff audit confirms the six-file allowlist and no acceptance/timing/retry weakening.

The automatic CI run caused by Sol's docs/test-only r7 packet commit is metadata-only and is not the authorized correction run, a retry, or promotion evidence. Luna records its URL/status at preflight but neither reruns it nor substitutes it for correction evidence. Only the run whose `headSha` is Luna's one authorized correction commit counts below.

Luna then makes one normal commit and one normal push. Do not manually dispatch, rerun, retry, or create a second correction commit. Wait for that single correction-HEAD automatic CI run to become terminal. Record the immutable HEAD/tree/run/job/artifact IDs, PR Verify, all six Chromium deployment axis results and traces, Stage 3 entrance-candidate/final-candidate/final-base, the focused remote Phase G trio if PR Verify unlocks it, and every required job conclusion.

Regardless of green or failure, stop and return exactly `STATUS: BLOCKED_RETURN_TO_SOL_R7_REMOTE_COMPLETE`. Sol alone classifies the previously unexecuted Chromium traces and decides promotion. A local failure, target/precondition drift, out-of-allowlist need, missing artifact, or any different remote failure returns `STATUS: BLOCKED_RETURN_TO_SOL` without further change. Local full Phase G, unfiltered remote Phase G, Producer checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, and Issue closure remain prohibited.

### 21.5 Current cursor and audit result

- `LAST_AUDITED_HEAD`: `bad1578b45171b476a8989c3180433ba14f973b7`
- `LAST_AUDITED_TREE`: `fded05d05fd216d512cbec8a17d647a59cf1dd04`
- `FAILED_GATE`: run `32496778334`; PR Verify `96817031062` five-file mixed-EOL whitespace; Stage 3 final-base `96823095853` page-owned predicate unresolved then WebKit crash; Phase G `96817216110` skipped; Chromium deployment diagnostic not reached
- `LAST_GREEN_GATE`: r6 local focused acceptance 13/13, lint/build/syntax; run `32496778334` six WebKit enemy-runtime shards, hosted evidence, Stage 3 entrance-candidate, and Stage 3 final-candidate. Controls only; not final-freeze evidence.
- `REMEDIATION_CLASS`: `DUAL_LOCAL_REMEDIATION / REPO_HYGIENE + QA_HARNESS_PREDICATE_ORCHESTRATION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Section 21 bounded correction only
- `RESUME_FROM`: five-file LF/BOM normalization + exact LF attributes + Node-owned final-cut predicate wait -> focused local checks -> one normal correction push -> wait for that one automatic CI run terminal -> `BLOCKED_RETURN_TO_SOL_R7_REMOTE_COMPLETE`

Sol performed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against the live HEAD, raw logs, byte state, and traces. Revision r7 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`. This is correction-design closure only, not technical green or release readiness.

## 22. Revision r7 same-revision packet — `.gitattributes` LF closure

This packet supersedes Section 21 only for the next execution cursor. The product contract, r4 Phase G contract, r5 execution/release loop, r6 diagnostics, and the r7 Stage 3 correction remain unchanged. Revision remains `r7`; `PRODUCT_DESIGN_CHANGE: 0`.

### 22.1 Audited r7 return

Sol re-fetched PR #171 and audited live correction HEAD `7429460950a37b2ac68415a5046547c97f8bb263`, tree `9c1cab7d8a8950a2ba475d89ffb986434ba36d15`, parent/final r7 packet `146e5f8fbf677bc7658dd4d81ed85fe1b237fd60`, CI run `32510923851` (#908), PR Verify job `96861615644`, Luna return comment `5375174022`, the correction diff, raw job logs, and the relevant Stage 3/deployment artifacts.

The correction commit changed exactly the six paths authorized by Section 21.3. After ignoring line-ending differences, `scripts/v099-final-remediation-browser-smoke.mjs` and `tests/v0995-runtime-evidence-contract.test.mjs` have semantic diff zero; the remaining semantic changes are the five path-specific attributes, the Node-owned final-cut wait, and their exact source-contract tests. The five diagnostic files are LF-only with the fixed BOM states. No `app/**`, product, workflow, Phase G, timeout, retry, predicate, or acceptance change exists.

Run `32510923851` is terminal failure only because PR Verify's CI-equivalent `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...7429460950a37b2ac68415a5046547c97f8bb263` rejected `.gitattributes` lines 1-26. Immutable blob inspection proves:

- final r7 packet `.gitattributes`: no BOM, 27 LF, 0 CRLF;
- correction HEAD `.gitattributes`: no BOM, 26 CRLF plus 6 LF;
- correction HEAD's semantic `.gitattributes` delta is exactly the five authorized path entries.

Therefore the reported local base-range whitespace pass is contradicted by the immutable correction blob and the identical remote command; that local pass is rejected as gate evidence. Remote PR Verify remains authoritative. The contradiction does not create a product or harness root cause.

The r7 Stage 3 correction is closed as focused remote evidence: entrance-candidate `96867530097`, final-candidate `96867530121`, and final-base `96867530136` are 3/3 success, and final-base artifact `9457872989` completed in one bounded attempt. WebKit deployment jobs are 6/6 top-level bounded success. Artifact `9458154642` records a retryable target-close for 736x414/brawler attempt 1 followed by attempt 2 success; artifact `9458309296` records the same bounded sequence for 844x390/medic. Those are the existing fail-closed maximum-two-attempt runner contract, not a manual retry/rerun and not a product failure. They remain diagnostic controls, not final-freeze evidence.

The six successful WebKit deployment jobs are not PR Verify's six Chromium deployment axes. PR Verify stopped before all Chromium capture steps, and Phase G `96861720725` was skipped through `needs: verify`. Chromium setup/readiness and the focused remote Phase G trio therefore remain unexecuted for this correction HEAD.

### 22.2 Classification and revision decision

- current required failure: `REPO_HYGIENE / DOT_GITATTRIBUTES_MIXED_EOL / REMEDIATION_LOCAL`;
- local-report conflict: `LOCAL_VALIDATION_EVIDENCE_REJECTED / IMMUTABLE_BLOB_CONTRADICTION`; the correction is controlled by post-commit blob evidence and remote PR Verify, not by the rejected claim;
- Stage 3 final-cut: `REMEDIATION_CLOSED / REMOTE_FOCUSED_GREEN`;
- WebKit deployment axes: `BOUNDED_RETRY_SUCCESS / CONTROL_GREEN` under the unchanged maximum-two-attempt contract;
- Chromium deployment axes and focused Phase G: `DIAGNOSTIC_PENDING / NOT_RUN`.

The active aggregate is `SINGLE_FILE_REPO_HYGIENE / REMEDIATION_LOCAL`. This is the same coherent EOL-hygiene correction family already owned by r7, with one exact file and no new design, state owner, architecture, product behavior, or acceptance decision. Section 19.3 therefore requires a same-revision remediation packet: Design ID remains `V100-SOL-DL-001 r7`; no r8 revision is created.

### 22.3 Exact authorized correction

Luna may create one remediation commit changing exactly `.gitattributes` relative to its parent:

1. Normalize the entire `.gitattributes` blob to LF only, with no UTF-8 BOM and no bare CR.
2. Preserve every existing semantic line and order, including the five r7 path entries, and add exactly one self-contract line: `.gitattributes text eol=lf`.
3. Make no other semantic or byte change. Every other tracked path must remain byte-identical to the Sol packet parent; the valid Stage 3 correction at `7429460` is inherited unchanged.

Forbidden: every other path, wildcard or repository-wide normalization, `.github/workflows/ci.yml`, any QA runner/test, Phase G, `app/**`, `public/**`, package/product data/assets/audio, timeout/retry/predicate/assertion/axis weakening, product correction, and evidence deletion. Sol's docs/test-only packet commits are metadata and are not part of Luna's one-file remediation diff.

### 22.4 Validation, remote run, and mandatory return

Before commit, Luna must prove against correction HEAD `7429460` that the working change is `.gitattributes` only, its normalized semantic diff is the one self-contract line only, `git check-attr eol -- .gitattributes` resolves `eol: lf`, the file has no BOM/CRLF/bare CR, and every other tracked path is unchanged. Run the existing 14 focused tests, lint, build, and a working-tree base-range whitespace check.

Create exactly one normal remediation commit. Before push, inspect the committed blob—not only the working file—and require: no BOM, LF-only, no bare CR; the commit changes `.gitattributes` only relative to its parent; and `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD` passes. Then push once normally. Do not amend, rebase, force push, manually dispatch, retry/rerun, or create a second remediation commit.

Wait for the one automatic CI run whose `headSha` is Luna's remediation commit to become terminal. Record immutable HEAD/tree/run/job/artifact IDs and require/report separately:

1. PR Verify, including all six Chromium deployment axes/traces, with no skipped capture step;
2. the three Stage 3 jobs and their bounded summaries;
3. all six WebKit deployment bounded summaries, including every internal attempt;
4. the focused remote Phase G ordered Stage 6 -> Stage 24 -> Stage 25 trio if unlocked;
5. every other required job and unexpected skip/failure.

Regardless of green or failure, return exactly `STATUS: BLOCKED_RETURN_TO_SOL_R7_ATTR_LF_REMOTE_COMPLETE`. Sol alone classifies Chromium/Phase G evidence and unlocks any later local full Phase G or unfiltered remote run. Any local failure, precondition drift, out-of-allowlist need, missing artifact, remote failure, or unexpected skip returns without further change. Producer checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, and Issue closure remain prohibited.

### 22.5 Current execution cursor and audit

- `LAST_AUDITED_HEAD`: `7429460950a37b2ac68415a5046547c97f8bb263`
- `LAST_AUDITED_TREE`: `9c1cab7d8a8950a2ba475d89ffb986434ba36d15`
- `FAILED_GATE`: run `32510923851`; PR Verify `96861615644` rejected mixed-EOL `.gitattributes`; Chromium capture steps not run; Phase G `96861720725` skipped
- `LAST_GREEN_GATE`: r7 remote focused controls — Stage 3 3/3, WebKit deployment bounded summaries 6/6, canonical viewports 48/48, WebKit enemy-runtime 6/6, and hosted evidence; not reusable as final-freeze evidence
- `REMEDIATION_CLASS`: `REPO_HYGIENE / DOT_GITATTRIBUTES_MIXED_EOL / REMEDIATION_LOCAL`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for this one-file packet only
- `RESUME_FROM`: `.gitattributes` LF/no-BOM normalization + exact self LF contract -> committed-blob and CI-range checks -> one normal remediation push -> wait for that correction-HEAD automatic run terminal -> `BLOCKED_RETURN_TO_SOL_R7_ATTR_LF_REMOTE_COMPLETE`

Sol repeated SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against live refs, immutable blobs, raw logs, artifacts, and the existing state machine. Revision r7 remains locked with `High ambiguity: 0` and `Medium ambiguity: 0`. This packet is not technical green or release readiness.

## 23. Revision r8 — CI #910 dual QA-harness correction and final dynamic-quality gate

This section supersedes Section 22 only for the active execution cursor. Sections 18 and 19 remain the Phase G and release state machines; Sections 20-22 remain immutable audit history. Revision r8 changes QA orchestration and final evidence ownership only. It changes no product requirement, `app/**`, gameplay, balance, AI, save/PWA behavior, content, visual/audio asset, or acceptance threshold. `PRODUCT_DESIGN_CHANGE: 0`.

### 23.1 Live evidence and independent classifications

Sol re-fetched PR #171 at HEAD `d1aab90ccefa8ad6601821c8520741bde49cd087`, tree `00df3ea842578cddc846059dd2c12f9dca1936a2`, parent/Sol packet `2eae10b75a0f2b1fd3a013bc2cfc0d0e02cb254e`, CI run `32539432537` (#910), Luna return comment `5377146015`, Producer Directive `5377824157`, route comment `5377832557`, raw logs, and artifacts `9466905397` and `9467643324`.

The one-file `.gitattributes` remediation is closed. Its committed blob is 1,340 bytes, no BOM, 33 LF, zero CR, contains `.gitattributes text eol=lf` exactly once, and differs semantically from its parent only by that line. PR Verify `96946366154` is green, including all six Chromium capture axes. This repository-hygiene result is not reopened.

The two new failures are classified independently:

1. **Phase G job `96949389397`, Stage 24 / WebKit 736x414** — `QA_PREDICATE_OR_ORCHESTRATION / STALE_DOM_READY_VS_RUNTIME_AFFORDABILITY_ACTIONABILITY_RACE`.
   - Artifact `9466905397` proves the page mounted, assets were ready, the commander was observed, and diagnostics were clean before failure.
   - The third deployment candidate was DOM-marked `ready` / `aria-disabled=false`, but the same diagnostic sample records production command `27.8` against ranger cost `45` after medic and scout were accepted. The DOM selector and the authoritative runtime affordability state therefore were not one coherent selection boundary.
   - The runner entered the generic 30-second locator actionability wait. The element became non-actionable, the page emitted `page-crash` at 55,349 ms, and the post-click diagnostic could no longer evaluate. This is not proof that production deployment, cooldown, balance, or boss behavior failed. The owner is the Phase G candidate-selection/click orchestration.

2. **WebKit Canonical Viewport job `96954658044`, 667x375 / `stage3-boss`** — `BROWSER_LIFECYCLE_OR_RESOURCE / CLEAN_UNEXPECTED_PAGE_CRASH_MISCLASSIFIED_BY_BOUNDED_HUD_RUNNER`.
   - Artifact `9467643324` proves navigation, asset readiness, battle readiness, boss fixture preparation, entrance, and combat-ready wait completed. Build identity stayed stable and console/page/request/HTTP diagnostics are all empty.
   - The lifecycle JSONL records an unexpected `page crash` during `boss message settle` before normal cleanup. The resulting target-closed error was wrapped by `battle messages did not clear`, so `run-v099-hud-states-bounded.mjs` recorded `retryableTargetClosed: false` and did not exercise its existing second-attempt boundary.
   - This is not evidence that the battle message duration or product presentation assertion failed. The owner is exact lifecycle classification in the bounded HUD runner. A real product assertion without the clean unexpected-crash proof remains non-retryable.

Both incidents end in a WebKit page crash, but their preceding evidence and owners differ. The Phase G incident begins with a stale DOM/runtime eligibility race inside deployment orchestration; the canonical incident begins after a completed boss-ready boundary and exposes a bounded-runner classification gap. Neither incident may be used to infer the other's root cause.

These new QA contracts plus Producer Directive `5377824157` require `DESIGN_CHANGE_REQUIRED`. The authoritative Design ID is now `V100-SOL-DL-001 r8`.

### 23.2 Exact correction ownership

The first correction commit may change only:

- `scripts/v100-phase-g-production-matrix.mjs`;
- `tests/v100-phase-g-checkpoint.test.mjs`;
- `scripts/run-v099-hud-states-bounded.mjs`;
- `tests/v099-hud-states-bounded.test.mjs`;
- `.gitattributes`, only to add exact LF rules for the latter two paths.

The Phase G correction must:

1. derive a deployable candidate from one diagnostic sample that requires a visible DOM card with `data-state=ready` and `aria-disabled=false` **and** a live, running, unpaused, non-terminal production snapshot with queue capacity, finite cost, `energy >= cost`, and zero cooldown for that kind;
2. re-read the same fields immediately before the click; if eligibility changed, record `candidate-invalidated-before-click`, do not click, and resume the existing bounded slot search;
3. use a named deployment-only actionability deadline of at most 2,000 ms instead of the generic 30-second locator deadline; do not change any battle, combat-proof, Phase G, or global timeout;
4. after an actionability error, re-read state. A live page with an invalidated candidate is a recorded reselection, while a live page that still proves the candidate eligible is a hard `QA_HARNESS_ACTIONABILITY_DIVERGENCE`. Target/page/browser loss is a hard lifecycle failure with the existing checkpoint artifact;
5. keep the interaction as a normal player-facing Playwright click. `force`, DOM event dispatch, React handler invocation, QA state mutation, resource injection, direct queue/cooldown/energy mutation, or skipped deployment proof is forbidden;
6. preserve every existing acceptance signal and all fourteen battle-extra checkpoints.

The focused Phase G test must prove at least: stale `ready` DOM plus insufficient runtime command is rejected without click; an affordable/cooldown-zero candidate is selected; a candidate invalidated at the pre-click recheck is reselected; persistent live actionability divergence and lifecycle loss fail closed; existing deployment acceptance/checkpoint meaning is unchanged.

The bounded HUD correction must classify an attempt as retryable only when all of these are proven from the attempt's own summary and lifecycle JSONL: exactly one failed selected HUD case; stable build identity; zero console/page/request/HTTP diagnostics; a target-closed/crashed terminal error; an unexpected `page crash` before normal cleanup; and a previously completed battle-readiness milestone. The lifecycle file must resolve inside that attempt's evidence root. Missing, malformed, outside-root, dirty, cleanup-owned, assertion-only, timeout-only, or page-close-without-crash evidence is non-retryable. Maximum attempts remains exactly two, attempt 2 must independently satisfy the full real screenshot/state/diagnostic contract, and both attempts remain in the artifact.

Add exactly these lines to `.gitattributes`, with no wildcard or renormalization:

```gitattributes
scripts/run-v099-hud-states-bounded.mjs text eol=lf
tests/v099-hud-states-bounded.test.mjs text eol=lf
```

All five correction paths must be LF-only, retain their existing BOM states, and pass the CI-identical base-range whitespace check. Forbidden: `app/**`, production assets/content/audio, save/PWA, package changes, workflow changes in the first commit, global timeout/retry changes, weakened assertions/axes/checkpoints, generic retry, or any product/gameplay correction.

### 23.3 Focused acceptance and remote promotion

Before the first push, Luna must pass:

1. the exact focused source-contract tests for both corrections plus `tests/ci-contract.test.mjs` and `tests/v100-design-lock.test.mjs`;
2. lint, production build, and `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD`;
3. three consecutive fresh-process WebKit runs of only `stage24-panther-commander` at its fixed 736x414 contract, with every required checkpoint resolved, a screenshot, and zero diagnostic failures;
4. three consecutive bounded WebKit runs of only canonical 667x375 `stage3-boss`. Every sequence must end in a real pass; a sequence may use attempt 2 only when attempt 1 carries the exact clean unexpected-page-crash proof above.

Any automatic CI run whose head is a Sol-authored docs/test-only r8 packet after `LAST_AUDITED_HEAD` and before Luna's first correction commit is metadata-only. Luna records its URL/status at preflight but does not rerun it, classify it as a new return, or substitute it for local acceptance, the correction-head focused run, promotion evidence, or final-freeze evidence. Only the later automatic run whose `headSha` is Luna's one authorized correction commit counts as the focused remote gate below.

Luna may then make one normal correction commit and one normal push. The resulting automatic focused CI is authoritative. It must have PR Verify green, focused Phase G ordered Stage 6 -> Stage 24 -> Stage 25 green 3/3, canonical 667x375 `stage3-boss` green under the exact bounded rule, and every other required job terminal green. Any failure, unexpected skip, missing artifact, out-of-allowlist need, or inability to distinguish an assertion from a crash returns `STATUS: BLOCKED_RETURN_TO_SOL_R8` with no retry, rerun, or second correction.

If and only if that focused remote run is completely green, Luna continues without a Sol round trip:

1. run local full Phase G 54/54 and its validator;
2. run the full Section 18.5 regression set;
3. make one promotion commit changing only `.github/workflows/ci.yml` and, if needed to assert the exact job contract, `tests/ci-contract.test.mjs`;
4. restore `v100-phase-g-production` to the original unfiltered contract: one `npm run qa:v100-phase-g`, one `npm run qa:v100-phase-g-validate`, artifact `v100-phase-g-production-evidence`, path `outputs/v100-phase-g`, with no `V100_PHASE_G_ONLY*` filter or ordered-trio loop;
5. push once normally and wait for the automatic unfiltered PR CI. Require Phase G 54/54 plus validator and every required job green.

No amend, rebase, force push, manual rerun, manual workflow dispatch, empty commit, or third candidate commit is authorized. Any failure after the first correction set returns to Sol without another edit.

### 23.4 Producer final dynamic game-quality contract

Producer Directive `5377824157` is a final-gate requirement. Static documents, automated assertions, the 54-image manifest, and the twelve Producer Visual Checkpoint screenshots are necessary but not sufficient by themselves.

After complete unfiltered remote green and before requesting the Producer Visual Checkpoint, Luna must collect a `DYNAMIC_GAME_QUALITY_EVIDENCE_PACKET` at the exact candidate HEAD/tree using the existing production route and existing QA/developer reachability. It must reach states directly rather than grind through stages. Each evidence item records HEAD/tree, browser/viewport, route/state/stage, whether reachability used a QA shortcut, bounded timestamps or sequence frames, relevant runtime/audio identifiers, and console/page/request/HTTP diagnostics.

The packet must cover, with actual runtime observation:

- first-time title -> name -> map -> formation -> battle comprehension and control flow;
- representative normal battle plus Stage 3, Stage 24, Stage 25, and Stage 30 boss states;
- scale, position, facing, layering, clipping, portrait/identity, VFX/attack/hit origin, HUD overlap, battlefield readability, and audio/animation/VFX timing;
- representative event/dialogue tempo, transition timing, and return to control;
- smartphone landscape at 667x375 and 844x390 plus desktop 1280x720;
- win -> result -> post-event -> map, defeat -> retry, defeat -> map return;
- save/reload and interrupted resume at representative safe flow boundaries;
- the existing combat-FX representative evidence contract, including support, vehicle ability, mission object, and status/target indication.

QA/developer controls may establish reachability only. They cannot count as difficulty, balance, reward, clearability, save integrity, or normal-input evidence. Those remain owned by simulations, automation, and representative non-shortcut spot checks. `Could not inspect because the boss/enemy could not be defeated` is not an acceptable missing-evidence reason.

Luna owns high-volume execution and evidence collection. Sol owns the human-player quality judgment. The twelve-screen `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED` submission must reference the dynamic packet, but Producer Visual Approval does not itself satisfy the later Sol dynamic audit. After Producer Visual Approval, freeze the exact HEAD/tree, twelve IDs, and dynamic packet IDs without a branch commit. During `SOL_FINAL_REVIEW`, Sol must inspect the actual runtime/evidence and perform targeted direct runtime observation where needed for the Producer-listed quality axes. Any finding returns through Section 19.6/19.7 and invalidates the affected freeze when a candidate commit is required.

### 23.5 Current execution cursor, stop rules, and audit

- `LAST_AUDITED_HEAD`: `d1aab90ccefa8ad6601821c8520741bde49cd087`
- `LAST_AUDITED_TREE`: `00df3ea842578cddc846059dd2c12f9dca1936a2`
- `FAILED_GATE`: run `32539432537`; Phase G `96949389397` Stage 24 / WebKit 736x414; WebKit Canonical Viewport `96954658044` 667x375 / `stage3-boss`
- `LAST_GREEN_GATE`: PR Verify `96946366154`; Stage 3 audio 3/3; WebKit deployment 6/6; enemy-runtime 6/6; hosted evidence; all are candidate-specific controls, not final-freeze evidence
- `REMEDIATION_CLASS`: `DUAL_QA_HARNESS / PHASE_G_ATOMIC_DEPLOYMENT_ELIGIBILITY + HUD_LIFECYCLE_CRASH_CLASSIFICATION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Section 23 / Handoff Section 16 only
- `RESUME_FROM`: r8 two-owner harness correction -> focused local acceptance -> one correction push -> complete focused remote green -> local full Phase G 54/54 + validator + full regressions -> one unfiltered-workflow restoration push -> complete unfiltered remote green -> dynamic evidence packet + twelve-screen `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`

Luna must stop immediately on live-ref drift, product-runtime evidence, dirty diagnostics, an unclassified failure, a required forbidden-file change, focused/local-full/unfiltered failure, missing dynamic evidence, or any new required failure. The exact return is `STATUS: BLOCKED_RETURN_TO_SOL_R8`; Luna makes no additional fix or retry decision.

Producer checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, or Issue closure remains prohibited until its exact state-machine gate. Sol completed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against the live refs, raw logs, artifacts, code owners, Producer directive, and release tail. Revision r8 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`.

## 24. Revision r9 — r8 focused-local source-contract closure

This section supersedes Section 23 only for the active execution cursor. Section 23's two QA-harness remediation semantics, focused runtime acceptance, remote promotion, dynamic game-quality packet, Producer checkpoint, and release tail remain unchanged. Revision r9 changes one test allowlist omission and one probe-output contract only. It authorizes no `app/**`, production runtime/content/asset/audio/save/PWA, gameplay, balance, AI, timeout, retry-count, acceptance, workflow, or release change. `PRODUCT_DESIGN_CHANGE: 0`.

### 24.1 Live return and independent classifications

Sol re-fetched PR #171 open/Draft/unmerged at HEAD `c6d3a2e8a925ca294fad82b47954d79b02a127bc`, tree `a4568cc2dbac3c6352de17170f92150865329ea2`, Issue #172, route comment `5379131527`, Section 23, Handoff Section 16, and the current authorized harness owners/tests. No Luna correction commit, push, or remote correction run exists after the r8 Sol packet.

Sol preserved Luna's uncommitted r8 draft and reproduced the exact focused command:

```powershell
node --test tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs
```

The result is 43 total, 41 pass, 2 fail. The failures are independent:

1. **`tests/ci-contract.test.mjs` / HUD bounded runner** — `DESIGN_CONTRACT_DEFECT / STALE_HUD_GENERIC_RETRY_ASSERTION + FIRST_COMMIT_ALLOWLIST_OMISSION / DESIGN_CHANGE_REQUIRED`.
   - The r8 HUD implementation correctly removes the shared generic `isRetryableTargetClosedLog` decision and replaces it with the Section 23 attempt-local clean unexpected-crash proof. All HUD behavioral positives and fail-closed negatives in `tests/v099-hud-states-bounded.test.mjs` pass.
   - The pre-r8 CI source contract still requires the literal `isRetryableTargetClosedLog` in the HUD runner. Satisfying that assertion would contradict Section 23's exact classifier ownership and could reintroduce generic retry.
   - Section 23 requires `tests/ci-contract.test.mjs` to pass before push but omitted it from the first-correction allowlist. This is a Design Lock contradiction, not a HUD implementation or product failure.

2. **`tests/v100-phase-g-checkpoint.test.mjs` / insufficient-energy probe evidence** — `QA_PROBE_SERIALIZATION / REJECTED_CANDIDATE_REASON_OMITTED / IMPLEMENTATION_MISMATCH_WITH_LOCKED_EVIDENCE`.
   - The probe correctly returns `candidates: []` for DOM-ready ranger cost 45 against runtime energy 27.8. The production selection rule therefore rejects the unaffordable card as required.
   - Its `sample` field is incorrectly serialized from the already filtered eligible-candidate list, producing `sample: []` and dropping the rejected card's `insufficient-energy` reason.
   - The defect is confined to the diagnostic contract-probe response. It is not evidence of a production selection, deployment, cooldown, energy, balance, or gameplay failure.

Adding the omitted test owner changes the executable allowlist and resolves a direct r8 acceptance contradiction. The authoritative Design ID is therefore `V100-SOL-DL-001 r9`.

### 24.2 Exact bounded closure

Luna may retain the already-created uncommitted r8 draft. The one still-unmade correction commit may change exactly these six paths relative to the r9 Sol packet:

1. `scripts/v100-phase-g-production-matrix.mjs`;
2. `tests/v100-phase-g-checkpoint.test.mjs`;
3. `scripts/run-v099-hud-states-bounded.mjs`;
4. `tests/v099-hud-states-bounded.test.mjs`;
5. `.gitattributes`;
6. `tests/ci-contract.test.mjs`.

The five r8 paths retain Section 23.2 exactly. Apply only these two closure deltas:

- In the `V100_PHASE_G_CONTRACT_PROBE` response, keep `candidates` eligible-only, but serialize `sample` from every card in the coherent actionability-annotated sample, in input order. Each entry contains `kind` and its complete `actionability`. For ranger cost 45 / energy 27.8, `candidates` is `[]` and `sample[0]` proves `eligible: false`, cost 45, energy 27.8, and reason `insufficient-energy`. Do not change `deploymentEligibilityForCard`, production candidate filtering, click/recheck behavior, or the existing test expectation.
- In `tests/ci-contract.test.mjs`, change only the HUD bounded-runner assertion block. Preserve the enemy-runtime and deployment-runner `isRetryableTargetClosedLog` assertions. For the HUD runner, require absence of the generic helper and presence of `cleanUnexpectedHudCrashRetryable`, `evidencePathInside`, stable build identity, exact `page crash`, prior `battle readiness complete`, attempt-local lifecycle handling, and maximum two attempts. Preserve canonical state inventory, real-pass, no-skip, and fail-closed assertions.

`.gitattributes` retains exactly the two r8 HUD LF lines and no other semantic change. All six files must be LF-only and retain their pre-r9 BOM state. Repository-wide normalization, unrelated formatting, generic retry, weakened lifecycle/diagnostic proof, and any file outside the six-path allowlist are forbidden.

### 24.3 Acceptance, continuation, and stop rule

Before runtime acceptance, the exact four-file focused command in 24.1 must pass 43/43. Then run lint, production build, and `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD`. Diff audit must prove exactly the six allowed paths and the two closure deltas above on top of the unchanged r8 draft.

Only after those source gates are green, resume Section 23.3 / Handoff Section 16.3 at the two runtime-focused controls: Stage 24 WebKit 736x414 three consecutive fresh-process passes and canonical WebKit 667x375 `stage3-boss` three consecutive bounded passes. Luna then makes the still-unmade single correction commit and single normal push. The correction-head automatic focused CI, local full Phase G 54/54 plus validator/full regressions, one unfiltered-workflow restoration commit/push, unfiltered remote green, dynamic evidence packet, and Producer checkpoint proceed exactly as Section 23.

Any source test, lint, build, diff, focused runtime, remote, local-full, unfiltered, or evidence failure; any new cause; or any forbidden-file need returns `STATUS: BLOCKED_RETURN_TO_SOL_R9` without retry, rerun, additional correction, or scope expansion. A Sol docs/test-only r9 packet run is metadata-only under the existing Section 23 rule.

### 24.4 Current execution cursor and audit

- `LAST_AUDITED_HEAD`: `c6d3a2e8a925ca294fad82b47954d79b02a127bc`
- `LAST_AUDITED_TREE`: `a4568cc2dbac3c6352de17170f92150865329ea2`
- `AUDITED_PRODUCT_PARENT`: `d1aab90ccefa8ad6601821c8520741bde49cd087`
- `FAILED_GATE`: focused local source-contract command — 43 total / 41 pass / 2 fail; stale HUD `isRetryableTargetClosedLog` CI assertion and missing `insufficient-energy` rejected-card probe evidence; no correction commit/push or remote correction run
- `LAST_GREEN_GATE`: 41/43 focused source tests, including every r8 HUD behavioral positive/negative and every other Phase G contract test; r8 Sol design contract 18/18; prior CI #910 PR Verify and candidate controls remain historical controls only, not correction or final-freeze evidence
- `REMEDIATION_CLASS`: `DUAL_LOCAL_SOURCE_CONTRACT / HUD_CI_ASSERTION_ALLOWLIST + PHASE_G_PROBE_SERIALIZATION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Section 24 / Handoff Section 17 only
- `RESUME_FROM`: preserve or reconstruct the uncommitted r8 draft on the live r9 packet -> apply the exact CI assertion and probe serialization closures -> focused source command 43/43 -> lint/build/base-range diff -> Stage 24 WebKit 3/3 + canonical Stage 3 WebKit 3/3 -> one correction commit/push -> focused remote complete green -> Section 23 promotion/dynamic-evidence route

Producer Directive `5377824157`, the dynamic human-player quality audit, Visual Approval freeze, Completion Packet prohibition, Final Review, Producer Final Acceptance, stacked integration, release, and post-release boundaries remain unchanged. Sol completed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against the live refs, reproduced output, preserved draft, source contracts, and release tail. Revision r9 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`.

## 25. Revision r10 — isolated local-gate bootstrap loop-breaker

This section supersedes Section 24 only for the active execution cursor and local-gate setup. Section 24's exact six-path source correction remains unchanged; Section 23 retains focused runtime, remote promotion, full/unfiltered Phase G, dynamic evidence, Producer checkpoint, and release ownership. Producer directives `5377824157` and `5379637288` remain later quality gates. No `app/**`, product/runtime/content/asset/audio/save/PWA, gameplay, balance, AI, timeout, retry-count, acceptance, workflow, package, lockfile, or release change is authorized. `PRODUCT_DESIGN_CHANGE: 0`.

### 25.1 Return classification and revision decision

Sol re-fetched Issue #172 Producer Loop-Breaker `5379794856`, PR #171 open/Draft/unmerged at r9 packet HEAD `3a40b95eafe8df17b9de907b6644e66912e1e218`, tree `486b9cf0cc92152372ff6414b61e2df440e8087a`, Section 24, and Handoff Section 17. Luna preserved/reconstructed the six-path correction draft and stopped before correction commit/push or remote correction CI. The reported 26 total / 20 pass / 6 fail did not reach the intended source assertions: `sharp` was unavailable to `tests/v100-design-lock.test.mjs`, and `playwright` was unavailable to the Phase G probe tests.

Classification is `EXECUTION_ENVIRONMENT_PRECONDITION / ISOLATED_WORKTREE_DEPENDENCIES_ABSENT + HANDOFF_BOOTSTRAP_OMISSION / DESIGN_CHANGE_REQUIRED`. It is not a product, gameplay, balance, AI, Phase G behavior, or r9 source-correction failure. Because r9 specified an isolated worktree but did not own dependency installation, browser placement, module/native/browser load proof, or environment-vs-source stop routing, the authoritative Design ID is `V100-SOL-DL-001 r10`.

### 25.2 Preserved-worktree and dependency contract

Luna must resume in the same stopped isolated worktree. Advance it by normal fast-forward to the non-overlapping r10 Sol packet while preserving the existing unstaged six-path draft. No stash, reset, clean, checkout of a dirty path, patch reconstruction, cross-worktree copy, rebase, amend, or new worktree is authorized. Immediately after the fast-forward:

- HEAD is the live r10 Sol packet on PR #171's head history;
- staged changes and untracked files are zero;
- the unstaged tracked set is exactly `.gitattributes`, `scripts/run-v099-hud-states-bounded.mjs`, `scripts/v100-phase-g-production-matrix.mjs`, `tests/ci-contract.test.mjs`, `tests/v099-hud-states-bounded.test.mjs`, and `tests/v100-phase-g-checkpoint.test.mjs`;
- `package.json` SHA-256 is `45144b0bf6813d6b6cc47a79861217fc8fb73c744afbc2731f13bd7f2b6716f6` and `package-lock.json` SHA-256 is `c3167d50451b0887271cf0b06280b6fb1393a497c20229ccc865331e0ee9fcd6`;
- run the r10 guard's `snapshot` mode, which fails unless that exact status/package contract holds and records HEAD plus all eight hashes only under ignored `outputs/v100-r10-local-gate/draft-snapshot.json`.

The sole supported dependency strategy is a fresh worktree-local install from the committed lockfile. Reuse or linking of another worktree's `node_modules`, a global `sharp`/Playwright, a shared Playwright browser cache, individual `npm install`, `npm update`, lockfile repair, package-manager substitution, `npm approve-scripts`, or repository dependency edits is forbidden. Node must satisfy the committed `>=22.13.0` engine. Run each bootstrap command exactly once, in order, from the isolated worktree root:

```powershell
node scripts/v100-r10-local-gate-preflight.mjs snapshot
npm.cmd ci --no-audit --no-fund
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
& .\node_modules\.bin\playwright.cmd install chromium webkit
```

Ordinary network reads needed by those two lock-owned installers are authorized only for this bootstrap. `PLAYWRIGHT_BROWSERS_PATH=0` must remain set for every later preflight and Playwright/browser command in this execution. The resulting `node_modules` and browsers stay ignored and must never enter the correction diff or commit.

After bootstrap, `runtime` and later `verify` modes re-hash HEAD, `package.json`, `package-lock.json`, and the six draft files against that snapshot and require the same exact six-path status. This proves both lockfile/package immutability and preservation of the valid r8/r9 draft. The ignored snapshot is evidence only and never enters a diff or commit.

### 25.3 Mandatory preflight and focused acceptance

The Sol-authored `scripts/v100-r10-local-gate-preflight.mjs` is part of the r10 packet, not Luna's correction allowlist. It enforces the Node minimum, lockfile version, installed Playwright/sharp versions, sharp native pipeline, worktree-local Chromium/WebKit executables, and a real headless launch/page probe in both engines.

Run each command exactly once and require exit 0 in this order:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
node scripts/v100-r10-local-gate-preflight.mjs runtime
node --test --test-name-pattern='(?!)' tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs
node --test tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs
node scripts/v100-r10-local-gate-preflight.mjs verify
```

The initial snapshot command must have emitted `V100_R10_DRAFT_SNAPSHOT_OK`. The runtime command must emit `V100_R10_LOCAL_GATE_PREFLIGHT_OK` with Playwright `1.56.1`, sharp `0.35.3`, and both local browser launches. The load-only command must load all four test files without a module/native/runtime error. The focused source command must pass 43/43, and the final guard must emit `V100_R10_DRAFT_VERIFY_OK`. The load-only command is not an acceptance substitute and its file-level pass count is not added to 43.

Only after this complete bootstrap/preflight/source sequence and the second unchanged-hash/status check may Luna run `npm.cmd run lint`, `npm.cmd run build`, `git diff --check 6acf87fd235fb55d3d5e3ec1f8687b57a06dc769...HEAD`, and the exact six-path semantic/EOL/BOM audit. Then resume Section 23.3 / Handoff 16.3 at Stage 24 WebKit 3/3 and canonical 667x375 Stage 3 WebKit 3/3. The still-unmade one correction commit/push, focused remote green, full/unfiltered promotion, dynamic evidence, and Producer checkpoint remain exactly Sections 23-24.

### 25.4 Failure ownership and no-retry rule

There is one authorized pass through each phase. Do not rerun a failed command, switch dependency strategy, reuse a different workspace, install one package, edit an assertion, or perform another correction.

- Node/npm absence, Node below minimum, `npm ci`, registry/network, browser install/download, package/lock hash drift, draft hash/status drift, missing module/native binary, missing/non-local browser executable, or Chromium/WebKit launch/page-probe failure returns `STATUS: BLOCKED_RETURN_TO_SOL_R10_ENVIRONMENT`.
- A load-only failure after successful preflight returns `STATUS: BLOCKED_RETURN_TO_SOL_R10_LOADABILITY`.
- A 43-test assertion or source-contract failure after successful loadability returns `STATUS: BLOCKED_RETURN_TO_SOL_R10_SOURCE`.
- A later lint/build/diff/focused-runtime/remote/full/unfiltered/evidence failure returns `STATUS: BLOCKED_RETURN_TO_SOL_R10_RUNTIME`.

Each return records the live HEAD/tree, exact failed command and exit code, Node/npm versions, `PLAYWRIGHT_BROWSERS_PATH`, six-path status, package/draft before-after hashes, and the first failure output. It includes no retry, rerun, dependency self-repair, source edit, commit, push, or promotion.

### 25.5 Sol proof, execution cursor, and audit

Sol independently created a fresh detached isolated Windows worktree with no `node_modules`, reconstructed the unchanged six-path r9 correction for validation, and executed the prescribed path. `npm ci --no-audit --no-fund` installed 512 packages from the unchanged lockfile; worktree-local Chromium build 1194 and WebKit build 2215 installed under `node_modules/playwright-core/.local-browsers`. The preflight passed with Node `v24.18.0`, Playwright `1.56.1`, sharp `0.35.3`, a 91-byte sharp probe, and real Chromium/WebKit page launches. All four test files loaded, the exact focused command passed 43/43, and the six draft plus package/lock SHA-256 values were unchanged across bootstrap. This is a Sol setup/source control only, not Luna correction, remote, Phase G, product, or final-freeze evidence.

- `LAST_AUDITED_HEAD`: `3a40b95eafe8df17b9de907b6644e66912e1e218`
- `LAST_AUDITED_TREE`: `486b9cf0cc92152372ff6414b61e2df440e8087a`
- `AUDITED_PRODUCT_PARENT`: `d1aab90ccefa8ad6601821c8520741bde49cd087`
- `FAILED_GATE`: r9 focused local acceptance setup — 26 total / 20 pass / 6 fail because `sharp` and `playwright` were unavailable; source assertions not evaluated; no lint/build/WebKit/correction commit/push/remote correction CI
- `LAST_GREEN_GATE`: Sol r10 control — fresh isolated lockfile bootstrap, immutable package/draft hashes, native plus Chromium/WebKit preflight, four-file loadability, and exact focused source 43/43; control only, not candidate/final evidence
- `REMEDIATION_CLASS`: `LOCAL_ACCEPTANCE_BOOTSTRAP / LOCKFILE_INSTALL + WORKTREE_LOCAL_BROWSERS + DRAFT_BYTE_PRESERVATION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Section 25 / Handoff Section 18 only
- `RESUME_FROM`: same stopped isolated six-path draft -> normal fast-forward to r10 packet -> one mandatory lockfile/bootstrap sequence -> immutable-hash/status proof -> native/browser/load preflight -> focused 43/43 -> lint/build/base-range six-path audit -> Stage 24 WebKit 3/3 + canonical Stage 3 WebKit 3/3 -> one correction commit/push -> focused remote complete green -> unchanged Section 23 promotion/dynamic-evidence route

A Sol docs/test/preflight-only r10 packet run is metadata-only. Producer checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, or Issue closure remains prohibited. Sol completed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against the live refs, Producer Loop-Breaker, package/lock owners, clean installation, browser runtime, reproduced source correction, and release tail. Revision r10 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`.

## 26. Revision r11 — Stage 24 monotonic causal-history closure

This section supersedes Section 25 only for the active cursor after the successful r10 environment/source/lint/build gates and the Stage 24 run-2 return. Sections 23-25 retain the six-path r8/r9 correction, bootstrap policy, Stage 3 correction, promotion, dynamic-quality, Producer, and release contracts except where this section gives a later exact command or return status. Producer Loop-Breaker `5379794856` and route `5383696506` remain binding. No `app/**`, product/runtime/content/asset/audio/save/PWA, gameplay, balance, AI, timeout, retry-count, evidence threshold, package, lockfile, workflow, or release change is authorized. `PRODUCT_DESIGN_CHANGE: 0`.

### 26.1 Raw run comparison and classification

Sol re-fetched PR #171 open/Draft/unmerged at HEAD `3f4190eb0fa89eef59141692e338ff3a9c81b40b`, tree `8782ed45b0cc85130d0a86fc2ce3135be1f22160`, and independently read both local evidence trees from the same stopped six-path worktree.

- Run 1 and run 2 used the same `stage24-panther-commander`, WebKit, 736x414 contract and the same six accepted player-card sequence after the same initial medic invalidation: medic, scout, ranger, brawler, babayaga, kumaverson. Each recorder contains 14 deployment attempts, 35 causal samples, a mounted/attacking RED PANTHER commander, and a completed frontline sequence.
- Run 1 passed with source edge `13->25`, nine visual events, six reaction records, the required audio, all four causal stages true, and final Futago HP about 2361.4/2500.
- Run 2 failed only `source`: `sourceToTargetEdges=[]`, while travel/contact, reaction, and audio were true. Its raw activity still records the RED PANTHER commander and nine other actors attacking, `enemy-red-panther-commander-attack`, six start/impact receipts, damage/reaction, support impact, and Futago warning/impact audio. Futago remained 2500/2500 in the final 4.8-second window.
- Run 2 has zero console error, page error, request failure, or HTTP failure. Its only page/context close events occur at 90,676 ms during the runner's post-failure cleanup; there is no preceding lifecycle/resource loss. The production battle remains mounted with ten fighters and a combat-ready Futago.

Run 1 is a valid positive product/runtime control: an actual production source-target edge can be captured at this HEAD. It is not a deterministic acceptance control because the current harness makes success depend on whether another transient edge happens to occur inside the final proof window.

The current file does not serialize the 35 raw sample objects and the destructive assignment has already erased the pre-window edge arrays, so the evidence cannot prove that run 2 itself owned an earlier source-target edge. Sol therefore does not relabel run 2 green. That evidence-integrity loss is the reason to correct monotonic capture and require a fresh corrected 3/3; it is not permission to infer or synthesize a missing edge.

The exact harness defect is independent of the earlier deployment race. `startCombatRuntimeObserver` accumulates the last observed `attackIdentity` and `pendingWeaponHits`, but `waitForCombatActivity` replaces those histories with only the instantaneous snapshot arrays. `battlePage` then stops the observer before `collectCombatCausalProof`. The proof therefore sees an earlier real edge only if a new transient edge is present after the destructive replacement; run 1 happened to receive `13->25`, while run 2 did not. Attacker identity, attack cue, impact, reaction, and clean lifecycle prove that run 2 is not a production combat/VFX/audio failure, but they are intentionally not substituted for the missing source-target edge.

Classification is `QA_HARNESS_CAUSAL_HISTORY / MONOTONIC_SOURCE_TARGET_EDGE_CLOBBER + FINAL_WINDOW_PHASE_COUPLING / DESIGN_CHANGE_REQUIRED`. The authoritative Design ID is `V100-SOL-DL-001 r11`.

### 26.2 Exact coherent correction

The existing six-path r8/r9 draft remains the correction unit. Relative to the r11 Sol packet, Luna may change only these two already-dirty paths for r11 while preserving the other four draft paths byte-for-byte:

1. `scripts/v100-phase-g-production-matrix.mjs`
   - maintain page-lifetime, deduplicated `sourceToTargetEdges` and `sourceAttribution` from every real `snapshot.attackIdentity` and `snapshot.pendingWeaponHits` record with non-null `sourceId` and `targetId`;
   - serialize each attribution as exactly `{ edge, sourceId, targetId, channel }`, where `channel` is `attackIdentity` or `pendingWeaponHits`, and retain the first observation for a duplicate edge/channel;
   - keep transient attack/effect arrays bounded as today, but never replace or truncate the unique page-lifetime source-edge set merely because a later snapshot is empty;
   - make `waitForCombatActivity` merge current snapshot evidence into observer history instead of replacing historical attack, pending-hit, presentation, edge, or attribution fields;
   - make `collectCombatCausalProof` merge the stable observer edges/attribution into every proof result, including failure diagnostics, while still requiring at least one actual non-null source-target edge;
   - add the exact `V100_PHASE_G_CAUSAL_HISTORY_PROBE` JSON contract required by the Sol-owned r11 tests; production execution must use the same merge/aggregation helpers as the probe.
2. `.gitattributes`
   - add exactly `tests/v100-r11-combat-causal-history.test.mjs text eol=lf`; preserve every other line and the existing LF/no-BOM contract.

The Sol packet owns `tests/v100-r11-combat-causal-history.test.mjs`, the r11 `resume` preflight mode, documents, and design-lock assertions. Luna must not edit them. The first correction commit remains exactly the same six dirty paths already owned by Sections 23-24; r11 adds no seventh correction path.

Forbidden: treating `attackingActors`, an attack cue, a visual receipt, damage, reaction, or audio alone as `source=true`; synthetic edges; actor/target substitution; force click or DOM event injection; combat clock/HP/resource mutation; longer proof time; new retry; assertion/axis/checkpoint weakening; `app/**`; package/lock/workflow edits; repository-wide formatting. Product acceptance stays `source -> travel/contact -> target reaction -> audio`.

### 26.3 Preserved environment and focused acceptance

Do not reinstall dependencies, reinstall browsers, rerun the already-green r10 bootstrap, reconstruct the draft, or replace the workspace. In the same stopped worktree, fast-forward only the non-overlapping r11 Sol packet. Before any r11 edit, require exactly the same six unstaged paths, no staged/untracked file, the r10 snapshot at `outputs/v100-r10-local-gate/draft-snapshot.json`, unchanged package/lock and six draft hashes, and `PLAYWRIGHT_BROWSERS_PATH=0`. Run once:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
node scripts/v100-r10-local-gate-preflight.mjs resume
```

It must emit `V100_R11_RUNTIME_RETURN_PREFLIGHT_OK`; this proves that the snapshot head is the r10 packet, current HEAD descends from it, the six-path/package/lock bytes are unchanged from the already-green gate, sharp still runs, and worktree-local Chromium/WebKit still launch. Failure returns `BLOCKED_RETURN_TO_SOL_R11_ENVIRONMENT` without install, retry, workspace change, or edit.

After the exact two-path r11 correction, run each command once and require success:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
node --test --test-name-pattern='(?!)' tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs tests/v100-r11-combat-causal-history.test.mjs
node --test tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs tests/v100-r11-combat-causal-history.test.mjs
npm.cmd run lint
npm.cmd run build
git diff --check
```

The load-only command must load five files; focused source acceptance is exactly 47/47. The four new tests require monotonic edge survival, non-destructive final merge, stable production-channel attribution, and the no-substitution negative. Audit the working diff as exactly the six established correction paths; package/lock, `app/**`, workflow, and every Sol-owned r11 path must be clean. Preserve LF/BOM contracts.

Then run one corrected-harness acceptance sequence: three fresh-process Stage 24 WebKit-only runs followed by three canonical 667x375 Stage 3 WebKit runs, using the Section 23.3 commands with only sequence/evidence names changed to `r11-stage24-local-1..3` and `r11-stage3-canonical-local-1..3`. Pre-r11 run 1 is control evidence and run 2 is root-cause evidence; neither counts toward corrected 3/3 and neither is rerun as a generic retry.

Any source/lint/build/diff/allowlist/EOL failure returns `BLOCKED_RETURN_TO_SOL_R11_SOURCE`. Any Stage 24 or Stage 3 failure, different cause, missing raw evidence, or forbidden-file need returns `BLOCKED_RETURN_TO_SOL_R11_RUNTIME`. No command retry, run rerun, timeout increase, second local fix, or alternative attribution rule is authorized.

### 26.4 Commit, remote gate, continuation, and cursor

Only after focused 47/47, lint, build, diff/byte audit, corrected Stage 24 3/3, and canonical Stage 3 3/3 may Luna create the still-unmade single correction commit containing exactly the six established paths and push once normally. Require the resulting automatic focused remote run completely green. Any failure, skip, missing artifact, or new cause returns `BLOCKED_RETURN_TO_SOL_R11_REMOTE` with no manual rerun or second correction.

Focused remote complete green resumes Section 23.4 exactly: local full Phase G 54/54 plus validator and full regressions, one unfiltered-workflow restoration commit/push, complete unfiltered remote green, exact-HEAD/tree dynamic game-quality evidence, then `PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED`. Every Producer and release boundary remains unchanged.

- `LAST_AUDITED_HEAD`: `3f4190eb0fa89eef59141692e338ff3a9c81b40b`
- `LAST_AUDITED_TREE`: `8782ed45b0cc85130d0a86fc2ce3135be1f22160`
- `AUDITED_PRODUCT_PARENT`: `d1aab90ccefa8ad6601821c8520741bde49cd087`
- `FAILED_GATE`: r10 Stage 24 WebKit corrected-candidate local sequence, run 2 causal proof; `source=false`, other three stages true; run 3 and canonical Stage 3 not run; no correction commit/push/remote CI
- `LAST_GREEN_GATE`: same stopped worktree — r10 snapshot/bootstrap/native/browser/load/source 43/43, lint, build, base-range/six-path audit, plus Stage 24 run 1 positive control; none is correction-HEAD, promotion, or final-freeze evidence
- `REMEDIATION_CLASS`: `PHASE_G_CAUSAL_HISTORY / MONOTONIC_SOURCE_EDGE + NON_DESTRUCTIVE_FINAL_MERGE / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` for Section 26 / Handoff Section 19 only
- `RESUME_FROM`: same stopped six-path worktree -> non-overlapping r11 fast-forward -> one r11 resume preflight -> exact monotonic-history correction in two existing dirty paths -> five-file load + focused 47/47 -> lint/build/diff/byte audit -> fresh corrected Stage 24 3/3 -> canonical Stage 3 3/3 -> one six-path correction commit/push -> focused remote complete green -> unchanged full/unfiltered/dynamic-quality route

A Sol docs/test/preflight-only r11 packet run is metadata-only. Producer checkpoint, Completion Packet, Ready, merge, tag, Release, Pages, or Issue closure remains prohibited. Sol completed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against the raw run evidence and live refs. Revision r11 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`.

## 27. Revision r11 same-revision packet — Sol-owned source-contract consistency closure

This section supersedes Section 26 only for the source-gate cursor after `BLOCKED_RETURN_TO_SOL_R11_SOURCE`. The causal-history design, Luna's six-path correction draft, acceptance thresholds, stop rules, promotion route, Producer Loop-Breaker, and release boundaries are unchanged. This is a Sol-owned canonical-document correction, not a product, runtime, gameplay, balance, AI, evidence, dependency, workspace, or retry-policy change. The authoritative Design ID remains `V100-SOL-DL-001 r11`; no r12 revision is created. `PRODUCT_DESIGN_CHANGE: 0`.

### 27.1 Independent failure classification and ownership decision

Sol re-fetched PR #171 open/Draft/unmerged at HEAD `f3db25f00c9209830d79d7f01b599bdb02834a06`, tree `ee0bcd81f3aed9bedaf642f6990acf8907865259`, read the commit-pinned Section 26, Handoff Section 19, `tests/v100-design-lock.test.mjs`, and `docs/PROJECT_STATE.md`, then reproduced the exact five-file focused command in the same stopped six-path worktree. The result was 47 total / 46 pass / 1 fail, while the resume preflight, five-file load, all four r11 causal tests, and every other focused assertion were green.

The reported `SOL human-player quality audit未完了` absence is not the failing contract. That literal exists in both the live file and the stopped worktree and its assertion is reached only after the actual failure. The terminal failure is the earlier assertion at the r10 cross-source loop: `PROJECT_STATE.md` does not contain `LOCAL_ACCEPTANCE_BOOTSTRAP / LOCKFILE_INSTALL + WORKTREE_LOCAL_BROWSERS + DRAFT_BYTE_PRESERVATION / DESIGN_CHANGE_REQUIRED`. Design Lock Section 25 and Handoff Section 18 both own that exact r10 `REMEDIATION_CLASS`; Project State records the r10 head/tree, 26/20/6 result, classification, and bootstrap evidence but omitted the remediation-class literal.

The test assertion is correct because it verifies one historical execution contract across all three canonical owners. `PROJECT_STATE.md` is incomplete. Do not delete, relax, redirect, or make the assertion optional. Add the exact r10 `REMEDIATION_CLASS` to the existing r10 blocker entry and update the active cursor to this same-revision packet.

Classification is `SOL_PACKET_CANONICAL_STATE_CONTRACT / R10_REMEDIATION_CLASS_OMITTED_FROM_PROJECT_STATE / REMEDIATION_LOCAL`.

### 27.2 Exact Sol-owned correction and proof

The Sol packet may change only these four Sol-owned paths:

1. `docs/PROJECT_STATE.md`: add the missing exact r10 remediation-class literal and record this source return/current cursor;
2. `docs/design/v1.0.0/DESIGN_LOCK.md`: add this same-revision closure;
3. `docs/design/v1.0.0/LUNA_HANDOFF.md`: add the corresponding resume-only handoff;
4. `tests/v100-design-lock.test.mjs`: bind Sections 27/20 and the corrected Project State contract without creating another test case or weakening any existing assertion.

Preserve the existing six-path Luna draft byte-for-byte. No `app/**`, product/runtime source, package/lock, workflow, preflight, causal test, timeout, retry count, evidence threshold, or other document/test is allowed. The correction must remain a separate Sol-owned commit whose parent is `f3db25f00c9209830d79d7f01b599bdb02834a06`.

Before handoff, Sol must run in that same stopped worktree and require:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
node --test --test-name-pattern='r11 preserves r8-r10 ownership and closes monotonic Stage 24 causal history' tests/v100-design-lock.test.mjs
node --test tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs tests/v100-r11-combat-causal-history.test.mjs
git diff --check
```

The targeted Design Lock/Project State contract must pass 1/1 and the focused source suite must pass exactly 47/47. The six draft SHA-256 values and path set must equal the pre-correction snapshot. Only the four Sol-owned paths may be staged for the Sol packet; after that commit, the worktree must again show exactly the same six Luna-owned unstaged paths.

This Sol execution closes only the Sol-owned source-contract failure. It is not product, lint, build, Stage 24/Stage 3 runtime, correction-commit, remote, Phase G, promotion, or final evidence.

### 27.3 Cursor, resume point, and exact owner

- `LAST_AUDITED_HEAD`: `f3db25f00c9209830d79d7f01b599bdb02834a06`
- `LAST_AUDITED_TREE`: `ee0bcd81f3aed9bedaf642f6990acf8907865259`
- `FAILED_GATE`: r11 focused source acceptance, 47 total / 46 pass / 1 fail; `tests/v100-design-lock.test.mjs` r10 cross-source `REMEDIATION_CLASS` assertion; lint/build/runtime/commit/push not run
- `LAST_GREEN_GATE`: r11 resume preflight, five-file load, 46/47 focused assertions including r11 causal 4/4; after this packet, Sol-owned targeted 1/1 and exact focused 47/47 are mandatory before handoff
- `REMEDIATION_CLASS`: `SOL_PACKET_CANONICAL_STATE_CONTRACT / R10_REMEDIATION_CLASS_OMITTED_FROM_PROJECT_STATE / REMEDIATION_LOCAL`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION` only after Sol's same-worktree 1/1 and 47/47 proof, four-path packet commit/push, six-draft byte read-back, and live GitHub normalization
- `RESUME_FROM`: same stopped six-path worktree at the published Section 27 packet -> no repeat of resume preflight, five-file load, or focused 47/47 -> lint -> build -> diff/byte/six-path audit -> fresh corrected Stage 24 3/3 -> canonical Stage 3 3/3 -> one six-path correction commit/push -> focused remote complete green -> unchanged Section 23 full/unfiltered/dynamic-quality route

Luna must not edit or recommit any of the four Sol-owned packet paths. If live history does not contain the published Section 27 packet directly after `f3db25f00c9209830d79d7f01b599bdb02834a06`, the six dirty paths/hashes differ from the recorded values, or any new source failure appears, return `BLOCKED_RETURN_TO_SOL_R11_SOURCE` without retry, rerun, additional edit, commit, or push. Existing Section 26 runtime/remote stop statuses remain unchanged.

## 28. Revision r12 — SOL single-owner Stage 6 actionability closure and ship loop

This section is the only active Version 1.0.0 execution design. It supersedes every r1-r11 owner, handoff, intermediate Producer checkpoint, Completion Packet, and return-route instruction where they conflict, while retaining them as immutable audit history. Producer Master Directive v3 `5386346594`, `/goal` lock `5386372849`, Loop Audits `5386391321` and `5386349725`, role/counter closure `5386314197`, and initial SOL cursor `5386320133` are the Version-specific authority; the current mutable cursor is always the latest explicitly labeled Issue #172 loop-ledger entry. Until the Producer explicitly restores the prior split, SOL owns design, remediation, validation, fixed-HEAD review, approved integration, release, and published-SHA closure. The historical branch name does not assign Luna. `PRODUCT_DESIGN_CHANGE: 0`.

### 28.1 Live evidence and independent classification

SOL re-fetched PR #171 Draft/open/unmerged at HEAD `0495e95e3bc59fcf546ffa02ee83704a1f63e366`, tree `30071d5a9f4fd92e93f54ddea2e9713382247f74`, and independently read run `32636742294`, PR Verify job `97187545551`, Phase G job `97189630445`, artifact `9492754238`, its raw JSON/PNG, workflow log, source, product DOM/CSS, and a prior positive control.

- PR Verify is green. Required Phase G failed at ordered position 1, `stage06-spitter-seal`, WebKit 667x375, before any pointer was dispatched. Stage 24 and Stage 25 were not run.
- The resolved ranger card remained `ready`, `aria-disabled=false`, runtime-eligible, queue `0/3`, cost 45, energy about 70, cooldown 0, at the same `185.5,295,78.5x60` rect before and after the failure. Page lifecycle was live/visible/complete and console/page/request/HTTP fatal diagnostics were zero.
- `locator.click({ timeout: 2_000 })` stopped while waiting for visible/enabled/stable. The battle clock advanced only about 0.083 seconds over 3.666 wall-clock seconds. Exact scheduler/observer contention is not inferred; no trace or DOM snapshot exists.
- Prior run `32570366466` used the same runner image and WebKit build and passed this exact Stage 6/viewport before failing later at Stage 24. The prior and current `app` tree is the same `e8591f0b244debf972fdc10e2c3941f20069cea1`; the `public` tree is also identical. There is no product-tree delta; only non-product QA, governance, test, and EOL-contract paths changed. `0495e95` introduced the hard two-second click deadline and immediate divergence policy.
- Failure finalization is lossy: the raw cursor awaited `formation-deployment`, but later absent/unresolved synthesis cleared it and produced a misleading later `lastCompletedCheckpoint`.

Classification is `QA_HARNESS_ACTIONABILITY_GATE_POLICY_FAILURE / PRE_POINTER_LOCATOR_STABILITY_TIMEOUT + FAILURE_CURSOR_FINALIZATION_LOSS / DESIGN_CHANGE_REQUIRED`. The immediate stop owner is proved; the low-level scheduler/observer reason remains unresolved. A product deployment, balance, layout, or handler defect is not established. This revision removes the opaque stability predicate as the action owner, records the missing facts, sends one real pointer only after explicit finite preconditions, and fails closed if product evidence appears.

### 28.2 Exact coherent remediation

The r12 packet uses one atomic Issue-locked publication topology. While `SOL_DESIGN` is active, SOL may modify only paths 3-6 below and must not commit them separately. SOL records their raw SHA-256, Git blob IDs, combined binary-patch SHA-256, exact unstaged status, `git diff --check`, and focused source result in Issue #172. The Issue entry then changes the active role to `SOL_REMEDIATION` and locks those four bytes. Remediation may modify only paths 1-2; the first material candidate commit contains the resulting total six-path diff relative to `0495e95e3bc59fcf546ffa02ee83704a1f63e366`. There is no docs-only intermediate commit and no recreation of the four-path design packet.

The first r12 material candidate may change only these six tracked paths:

1. `scripts/v100-phase-g-production-matrix.mjs`
2. `tests/v100-phase-g-checkpoint.test.mjs`
3. `tests/v100-design-lock.test.mjs`
4. `docs/design/v1.0.0/DESIGN_LOCK.md`
5. `docs/design/v1.0.0/LUNA_HANDOFF.md`
6. `docs/PROJECT_STATE.md`

The implementation requirements are exact:

1. Replace every deployment-card pointer site in this Phase G runner—including initial helper, sustain proof, sustain redeploy, non-boss primary, boss primary, and proof fallback—with one `performVerifiedDeploymentPointer` owner. No deployment-card site may retain an ignored `.catch(() => {})`, direct locator/ElementHandle click, or caller-owned stale acceptance baseline. The helper owns the final `before` snapshot and `waitForDeploymentAcceptance` result.
2. Add a page-scoped single-flight input mutex named `withPhaseGPageInputLock`. Every verified deployment invocation and every battle pointer action that can run while the sustain task is live—including sustain-generated ability/support/canvas input and the concurrent main-flow manual/vehicle proof actions—must acquire the same mutex; alternatively the runner may join the sustain task before a later pointer, but it may never overlap one. A deployment critical section spans final re-query, eligibility, scroll, frame samples, listener installation, the one pointer, receipt/outcome classification, production acceptance, and listener cleanup. Re-query only after acquiring the lock. Waiting for this lock consumes no deployment attempt; a lifecycle loss while waiting is a hard stop.
3. Identify a candidate by the exact DOM node plus `data-kind` plus `data-slot-index`; a QA-only WeakMap/counter node identity is allowed. Normalize an event owner only with `event.target.closest('button.unit-card')`. Re-query the requested identity and recompute the same production DOM/runtime eligibility immediately before input and again at the terminal sample. A disconnected/re-rendered node, changed kind/slot, or ineligible candidate before dispatch returns `candidate-invalidated-before-pointer`, sends zero pointer, and uses only the existing bounded route: primary continues its existing candidate/attempt loop, sustain proof/redeploy waits for its next existing sustain iteration, and fallback may reselect only inside its existing 45-second budget. Generic sustain redeploy preserves its existing diagnostics DOM-order eligible candidate `[0]` and does not add a `deployedKinds` exclusion.
4. Scroll only by one in-page DOM evaluation of the nearest `.unit-cards` rail. Use the single deterministic formula `targetLeft = clamp(rail.scrollLeft + cardCenterX - railCenterX, 0, rail.scrollWidth - rail.clientWidth)` and call `rail.scrollTo({ left: targetLeft, behavior: "instant" })`. Smooth scrolling and Playwright locator/ElementHandle `scrollIntoViewIfNeeded` are forbidden because they reintroduce opaque actionability/stability ownership. Then collect bounded browser-frame samples.
5. Each sample serializes wall time and frame cadence; exact node/kind/slot; card and nearest rail rects; rail `scrollLeft`; visual viewport; viewport/rail intersection; native `disabled`; `aria-disabled`; `data-state`; display/visibility/opacity/pointer-events; active animation summaries; center point; `document.elementFromPoint` target; and nearest card owner identity. Require two consecutive distinct `requestAnimationFrame` samples with the same exact identity; absolute delta <= 0.75 CSS px for card x/y/width/height and rail `scrollLeft`; a minimum 28x24 CSS-pixel hit surface; center inside the visual viewport, card rect, and rail rect; enabled production eligibility; and center owner equal to that exact button or its descendant. The terminal immediate recheck must remain within the same 0.75 CSS-pixel tolerance.
6. Set `DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS = 5_000`, `DEPLOYMENT_POINTER_FRAME_SAMPLE_TIMEOUT_MS = 1_000`, maximum 12 serialized samples, and `DEPLOYMENT_POINTER_DISPATCH_DEADLINE_MS = 2_000`. A frame sample must resolve as a recorded timeout when no rAF arrives within one second. Candidate node/kind/slot/eligibility invalidation uses only item 3's bounded zero-pointer route. Budget or sample exhaustion, no consecutive stable pair, obstruction, off-viewport/rail state, or sampled hit-owner mismatch sends zero input and is a hard `QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE` return to `SOL_DESIGN`; lifecycle loss is a hard `lifecycle-loss` return. Persist all samples for every branch. No preflight branch authorizes timeout tuning, an immediate patch, or a blind rerun.
7. Immediately before dispatch, revalidate the same node/kind/slot, production eligibility, center coordinate, and `elementFromPoint` owner. Pre-dispatch identity failure is `candidate-invalidated-before-pointer`; coordinate/owner failure is `coordinate-invalidated-before-pointer`; both send zero pointer and may use only the bounded routes in item 3.
8. Install one per-invocation, attempt-ID-correlated, document capture listener before input. It may not call `preventDefault` or alter propagation. When the document remains live, explicitly remove it in `finally`. When dispatch cancellation is required, await page/context close before returning; disposal of that terminal document/listener is the cleanup. Serialize all `pointerdown`, `pointerup`, and `click` observations, including unrelated events, with type, `isTrusted`, pointer type, button, client point, target tag/classes, normalized node/kind/slot owner, attempt ID, order, and elapsed time. Unrelated events never satisfy the receipt. Send exactly one pointer for the logical attempt using `page.mouse.click` at the recorded center. `locator.click`, `force:true`, DOM `.click()`, `dispatchEvent`, QA-bridge deployment, and product state/resource/time mutation are forbidden.
9. Bound the pointer call and receipt delivery by `DEPLOYMENT_POINTER_DISPATCH_DEADLINE_MS`. A deadline closes/cancels the page or context immediately, awaits that close, records call start/end/error and lifecycle, and stops as `BROWSER_POINTER_DISPATCH_TIMEOUT`; a bare `Promise.race` that leaves a possible late click is forbidden. The expected cancellation close remains `BROWSER_POINTER_DISPATCH_TIMEOUT` and is not reclassified as `lifecycle-loss`. An independent page/context/browser close is `lifecycle-loss`; another pointer API rejection is `BROWSER_POINTER_API_ERROR`. None permits retry.
10. Each capture receipt also serializes the pre-handler production eligibility/state observed during document capture. Outcome precedence is exhaustive and exact:
    1. dispatch timeout, independent lifecycle loss, and other pointer API rejection use item 9 and stop;
    2. correlate the dispatched `pointerdown -> pointerup -> click` sequence by attempt ID, ordered event type, primary button, client point, and timing. A correlated trusted sequence whose normalized owner differs from the terminal card is `PRODUCT_ACTIONABILITY_SURFACE_DIVERGENCE`. A missing, partial, untrusted, mixed-owner, or out-of-order exact sequence is `BROWSER_POINTER_RECEIPT_MISSING`. Unrelated captured events are retained but ignored. Neither branch may become success even if production state changes;
    3. require receipt-time pre-handler node/kind/slot, eligibility, and owner to match the terminal pre-dispatch sample. A node/identity/eligibility mismatch is `candidate-invalidated-during-pointer`; a coordinate/hit-owner mismatch not already classified in step 2 is `coordinate-invalidated-during-pointer`. Both are uncertainty stops;
    4. only after steps 1-3 are green, evaluate/wait the unchanged production acceptance against the helper-owned `before` snapshot. Success requires the logical AND of the exact ordered trusted same-card receipt, matching receipt-time pre-handler identity/eligibility/owner, and production acceptance. A successful ready-to-cooldown/queue/energy/card/fighter transition is acceptance and must return success; expected post-handler state drift is never candidate invalidation;
    5. if that production acceptance is absent, independent lifecycle loss remains `lifecycle-loss`; a later disconnected/re-rendered node or changed kind/slot is `candidate-invalidated-during-pointer`; a later changed coordinate/owner is `coordinate-invalidated-during-pointer`; otherwise the exact trusted same-card receipt with no acceptance is `PRODUCT_DEPLOYMENT_ACCEPTANCE_MISSING`.

Every non-success branch persists raw evidence, permits no second pointer, and returns the SOL loop to `SOL_DESIGN`; no branch authorizes an immediate second patch or rerun.
11. Preserve the Phase G total at 54 (48 core plus the six Stage 3/4/6/21/24/25 extras), all causal axes, viewport contracts, existing candidate/attempt limits, and gameplay acceptance. No axis, screenshot, error channel, or product assertion may be weakened.
12. Add pure `deploymentPointerPreconditionDecision` and `deploymentPointerOutcome` classifiers. `V100_PHASE_G_DEPLOYMENT_POINTER_PROBE` accepts only serialized samples, receipts, lifecycle, and acceptance inputs and mutates no runtime. Its exactly five new behavioral contracts prove: stable exact identity permits one decision; pre-dispatch invalidation permits zero; overlay/off-viewport/unstable evidence permits zero; ordered trusted receipts plus production acceptance is positive; and coordinate/lifecycle/API/no-receipt/no-acceptance branches remain distinct while no post-dispatch branch permits retry.
13. Before any failure synthesis, call `freezeCheckpointFailureCursor` once and store one immutable nested `failure.preFinalizationCheckpointSnapshot`, then derive `awaitingAtFailure`, `lastCompletedBeforeFailure`, and `unresolvedBeforeFailure` only from it. A checkpoint not reached because of an earlier failure remains unresolved and is never relabeled `absent` or resolved. `writeFailureFile` may append later lifecycle/diagnostics, but may not spread a live snapshot over any frozen failure field. Expose this pure rule through `V100_PHASE_G_CHECKPOINT_FINALIZATION_PROBE` and exactly one new contract. The five pointer contracts plus this one cursor contract are the exact six-test increase from 48 to 54.

During the four-path design publication and first material six-path candidate, forbidden changes are: any `app/**`, `public/**`, package/lock, workflow, gameplay, balance, AI, save/PWA, story/content, asset/audio/VFX, damage/hitbox/timing, product acceptance, Phase G count/viewport, retry-count, or repository-wide formatting change. The later Section 28.3 workflow-only restoration is the sole workflow exception and cannot be folded into the first candidate. No blind rerun and no old artifact may count for the new candidate.

### 28.3 Acceptance, promotion, and stop routing

Use only the existing isolated worktree at exact base `0495e95`; preserve its worktree-local dependencies and browsers proven by r10/r11. Do not reinstall, share `node_modules`, switch workspaces, or repeat a green bootstrap. Before the first remediation edit, the resume preflight must prove: HEAD/tree exactly `0495e95`/`30071d5`; exactly the four unstaged design paths 3-6 and no other staged, unstaged, or untracked path; raw/file/blob/combined-patch hashes exactly equal the Issue #172 r12 publication ledger; `git diff --check` green; and the published five-file focused suite 48/48. A mismatch returns to `SOL_DESIGN` without reconstructing the packet.

Set `$env:PLAYWRIGHT_BROWSERS_PATH='0'`. The load-only command is `node --test --test-name-pattern='(?!)' tests/v100-phase-g-checkpoint.test.mjs tests/v099-hud-states-bounded.test.mjs tests/ci-contract.test.mjs tests/v100-design-lock.test.mjs tests/v100-r11-combat-causal-history.test.mjs`. After the exact two harness-path remediation, run the same five files without the name filter and require exactly 54/54: the prior 48 plus exactly five r12 pointer contracts and one failure-cursor contract. Static assertions must prove all six deployment sites route through the helper; every sustain-time concurrent battle pointer site, including main-flow manual/vehicle proof, routes through the shared mutex or occurs only after sustain join; and exactly one `page.mouse.click` exists inside the deployment helper. Scope negative source assertions to the deployment helper plus its six invocation regions: no raw unit-card click, `scrollIntoViewIfNeeded`, `force`, DOM click, event-dispatch deployment, QA-bridge deployment, product state/resource/time mutation, post-dispatch retry/second pointer, or lossy cursor overlay there. Existing non-deployment QA reads, causal-history observation, required boss setup, and already-authorized non-WebKit capture retry elsewhere in the runner remain unchanged and are not globally forbidden tokens.

Then require in order:

1. `npm.cmd run lint`, `npm.cmd run build`, working-tree `git diff --check`, exact total six-path allowlist, LF/BOM/semantic audit, and no product-tree or forbidden diff;
2. three separate fresh processes with `V100_PHASE_G_ONLY=battle-extra`, `V100_PHASE_G_ONLY_ENGINE=webkit`, `V100_PHASE_G_ONLY_VARIANT=stage06-spitter-seal`, unique `V100_PHASE_G_SEQUENCE_ID`, and fresh `V100_PHASE_G_EVIDENCE_DIR`; require capture variant `stage06-spitter-seal`, actual stage ID `stage-nishijin-station-tunnel-seal`, 667x375, exactly 3/3, exact trusted receipts, production acceptance, and zero fatal diagnostics;
3. three separate fresh processes with `V100_PHASE_G_ONLY=battle-extra`, `V100_PHASE_G_ONLY_ENGINE=webkit`, `V100_PHASE_G_ONLY_VARIANT` unset, unique sequence IDs, and fresh evidence directories; each process must run the existing order Stage 6 -> Stage 24 -> Stage 25 and pass, so the ordered trio is exactly 3/3 with no in-sequence retry;
4. one normal atomic six-path candidate commit/push, GitHub exact HEAD/tree read-back, loop iteration increment to 2, and its automatic focused remote run. PR Verify, all required jobs, the ordered trio 3/3, required artifact upload/digest, and run conclusion must all be green before promotion;
5. if the live workflow is focused, first reset `SAME_GATE_REPEAT_COUNT` only after the candidate focused required gate is green, then create locally a second commit changing only `.github/workflows/ci.yml` back to the exact original unfiltered Phase G job: one `npm run qa:v100-phase-g`, one `npm run qa:v100-phase-g-validate`, artifact name `v100-phase-g-production-evidence`, path `outputs/v100-phase-g`, and no `V100_PHASE_G_ONLY*` or ordered-trio loop. This release-validation HEAD increments `LOOP_ITERATION` from 2 to 3 when created; record candidate/promotion HEAD/tree and invalidate candidate-HEAD final evidence. Do not push it yet. If no restoration is required, iteration remains 2;
6. at that locally committed restored-workflow HEAD, run unfiltered local Phase G 54/54, its validator, and every full regression required by this lock. Only after all are green, push once and require the unfiltered remote run at that exact HEAD to finish Phase G 54/54, validator, every required job, and required artifacts completely green. If restoration is not needed, run these local and remote gates at the unchanged correction HEAD;
7. collect exact final-candidate HEAD/tree actual-runtime evidence for story, event, battle, combat VFX, audio, required viewports/mobile landscape, save/resume/progression, PWA fresh/update/offline/recovery, asset/privacy/provenance, and release contracts, plus the twelve-screen visual set and SOL human-player audit.

Any source/build/diff/allowlist/preflight failure returns to `SOL_DESIGN` without another edit. Any Stage 6 or ordered-trio failure persists its raw pointer/failure-cursor evidence and returns to `SOL_DESIGN`; if it is the same required Stage 6 gate, set `SAME_GATE_REPEAT_COUNT: 2` and perform the required QA-harness/DOM-actionability/runtime/browser-lifecycle/evidence-pipeline/acceptance subsystem audit before any further correction. Any later local/remote/runtime/human-quality failure follows the same SOL-owned design/remediation loop. Required remote red is authoritative; no manual rerun, job rerun, blind retry, or stale green substitutes for it.

### 28.4 Persistent state machine and release tail

There is one persistent `/goal` and one SOL owner:

`SOL_DESIGN -> SOL_REMEDIATION -> machine gates -> browser/runtime verification -> human-player quality audit -> exact HEAD/tree freeze -> SOL_FINAL_REVIEW (read-only/adversarial) -> FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT`.

A material finding or Producer rejection returns within the same goal to `SOL_DESIGN`; any new candidate invalidates affected evidence and requires a new fixed-HEAD review. The twelve-screen set is part of the final package, not a separate Producer stop. `ACTIVE_PRODUCER_CHECKPOINT_COUNT: 1`. Previous `PRODUCER_VISUAL_CHECKPOINT`, separate `PRODUCER_FINAL_ACCEPTANCE`, Completion Packet, and `READY_FOR_SOL_FINAL_REVIEW` routing is historical and inactive under this override.

`SOL_FINAL_REVIEW` is a strict firewall. Enter it only in an isolated or fresh-equivalent checkout pinned to one exact SHA/tree with staged, unstaged, and untracked state all empty. Announce `ROLE_LOCK: SOL_FINAL_REVIEW`, then perform only read-only/adversarial source, diff, Issue/PR, required-CI/artifact, runtime, human-quality, integration, release, and rollback audit. No file, branch, PR state, Issue state, workflow, tag, Release, Pages request, or evidence may be mutated while that role is active. Any High, Medium, PB, unfinished-product, evidence, or cursor finding ends the review as not approved and changes the role back to `SOL_DESIGN` before any edit.

The frozen final release-candidate packet must identify: exact candidate SHA/tree and clean-checkout proof; PR #169/#170/#171 live base/head/tree/check/mergeability and synthetic-tree plan; required run/job/artifact IDs and digests; unfiltered 54-capture manifest and validator; full regressions; runtime and SOL human-player audit; the twelve exact screen evidence IDs; story/event/battle, global combat VFX, audio, mobile/safe-area/touch, save/migration/PWA/offline/recovery, asset/privacy/provenance, release/Pages/rollback closure; known residual nonblocking risks; `High: 0`, `Medium: 0`, `PB: 0`, unfinished product surfaces `0`; and `RELEASE_READY: YES`. Only that single packet may be submitted to `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT`.

Only explicit approval at the final checkpoint authorizes SOL to re-fetch and integrate stacked PR #169 -> #170 -> #171 in order, verifying each live head/base/check/mergeability and the final synthetic/merge-result tree. The verified PR #171 merge-result commit—not a PR head—becomes `RELEASE_SHA`; its tree must equal the approved candidate tree. Then and only then may SOL create the annotated `v1.0.0` tag, non-draft/non-prerelease GitHub Release, exact seven-field official Pages release request, and perform published-SHA public/PWA QA and recovery. The goal completes only after the public environment is green and GitHub/Project State/Issue closure matches it.

### 28.5 Current cursor and audit result

- `LOOP_ITERATION`: `1` during this read-only design closure; increment to `2` when the material r12 candidate HEAD is created; if a workflow-restoration promotion HEAD is required, increment to `3` when that release-validation HEAD is created; if no restoration is required, remain `2`. Record every old/new HEAD/tree in Issue #172 and invalidate prior candidate final evidence
- `SAME_GATE_REPEAT_COUNT`: `1`; reset only after leaving this gate green, or set to `2` if the next exact candidate fails the same required Stage 6 gate
- `LAST_AUDITED_HEAD`: `0495e95e3bc59fcf546ffa02ee83704a1f63e366`
- `LAST_AUDITED_TREE`: `30071d5a9f4fd92e93f54ddea2e9713382247f74`
- `FAILED_GATE`: run `32636742294`, Phase G job `97189630445`, Stage 6 WebKit 667x375 before pointer dispatch; artifact `9492754238`; Stage 24/25 not run
- `LAST_GREEN_GATE`: PR Verify job `97187545551` and prior exact-app-tree Stage 6 positive control; neither is r12 candidate or final-freeze evidence
- `REMEDIATION_CLASS`: `PHASE_G_REAL_POINTER_ACTIONABILITY / EXPLICIT_HIT_TEST + STABLE_RECT + ONE_INPUT + TRUE_FAILURE_CURSOR / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `SOL_REMEDIATION`
- `RESUME_FROM`: exact `0495e95` worktree with the Issue-locked four-path design packet -> two-path harness remediation -> focused 54/54/static gates -> Stage 6 3/3 -> ordered WebKit trio 3/3 -> one atomic six-path candidate commit/push -> candidate remote focused complete green -> local workflow-only restoration commit -> full local 54/54/validator/regressions at restored HEAD -> one promotion push -> same-HEAD unfiltered remote complete green -> exact-HEAD runtime/human audit -> frozen read-only `SOL_FINAL_REVIEW`

SOL completed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against the authority stack, live refs, raw current/prior artifacts, source ownership, state transitions, failure branches, evidence invalidation, integration ordering, and release/public recovery tail. Revision r12 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`.

## 29. Revision r13 — Stage 25 monotonic target-ownership closure

This section supersedes Section 28 only for the new local ordered-trio failure, the current execution cursor, and the additional target-ownership evidence contract. Every completed r12 pointer/cursor rule, six-path atomic topology, product boundary, promotion gate, SOL single-owner loop, final-review firewall, one Producer checkpoint, stacked integration order, and release/public recovery tail remains unchanged. `PRODUCT_DESIGN_CHANGE: 0`.

### 29.1 Actual evidence and independent classification

SOL retained the exact uncommitted r12 six-path candidate on base HEAD `0495e95e3bc59fcf546ffa02ee83704a1f63e366`, tree `30071d5a9f4fd92e93f54ddea2e9713382247f74`. The focused five-file source suite passed 54/54; lint had zero errors; build and `git diff --check` passed; no `app/**`, `public/**`, workflow, package/lock, staged, or untracked change existed. Three separate Stage 6 WebKit 667x375 processes passed with capture variant `stage06-spitter-seal`, actual stage ID `stage-nishijin-station-tunnel-seal`, exact trusted mouse receipt trios, production acceptance, unresolved checkpoints zero, and fatal diagnostics zero.

Fresh ordered-trio sequence `r12-trio-fresh-1-d5986723-a` then passed Stage 6 -> Stage 24 -> Stage 25 in the fixed order. Its report is `outputs/v100-r12-trio-fresh-1-d5986723-a/phase-g-report.json`, 10,048,138 bytes, SHA-256 `cf1011e6557fa2203f8e5b5d286b25ce2dce4bec5aba7a421803f4dfca78365d`. Stage 25 observed `red-panther-shield` targeting the living human `guardian` at 40,483 ms and observed the shield attack at 43,330 ms; every checkpoint resolved.

The second fresh sequence `r12-trio-fresh-2-d5986723-b` passed Stage 6 and Stage 24, then failed Stage 25 WebKit 932x430 at the checkpoint completeness assertion. SOL did not run sequence 3, rerun, retry, or patch. The truthful frozen failure cursor is:

- variant `stage25-president`, actual stage ID `stage-mugarian-executive-lab`, ordered position 3;
- `lastCompletedBeforeFailure: screenshot-saved`;
- sole `unresolvedBeforeFailure: living-human-target-acquired-or-not-required`;
- shield attack observed from historical production runtime at 46,107 ms and again by the final proof predicate;
- deployment sequence complete, causal proof 86 samples with source/contact-or-travel/target-reaction/audio all true, screenshot saved, live battle, and console/page/request/HTTP failures zero;
- failure JSON `outputs/v100-r12-trio-fresh-2-d5986723-b/diagnostics/stage25-president-webkit-932x430.json`, 5,949,466 bytes, SHA-256 `78349ab86a65c333c2ce3bebafa4649dd3430a9d04c2fa79e7b7734a47aee469`;
- production screenshot SHA-256 `baa88e20bdda49af10b65c990c1cae343974746c36f7cae4e486983703f75925`; diagnostic screenshot SHA-256 `dd9e5d542fd2248d0314331654772516d11e526a10a9c0aef125924b59957765`.

The existing page-lifetime history retains source-target ID edges and attacking actor kinds, but not the same-frame mapping from those IDs to source/target side, kind, HP, and living state. The contact-first checkpoint separately polls only the current `proofActor.targetId` and stops polling as soon as historical attack evidence becomes true. Therefore the failed artifact cannot distinguish a transient real shield -> living-human target that fell between polls from a shield attack against a non-human object. The unresolved checkpoint is truthful and must not be marked complete from generic attack, audio, causal-axis, current-human-count, or screenshot evidence. A product targeting/gameplay failure is not established; a human target is also not established.

Classification is `QA_HARNESS_TARGET_OWNERSHIP_HISTORY / LIVE_ONLY_CONTACT_CHECKPOINT + ATTACK_HISTORY_WITHOUT_SIDE_KIND_TARGET_ATTRIBUTION / DESIGN_CHANGE_REQUIRED`.

Remediation class is `PHASE_G_PROOF_ACTOR_TARGET_OWNERSHIP / MONOTONIC_SAME_FRAME_SOURCE_TARGET_IDENTITY + NO_GENERIC_SUBSTITUTION / DESIGN_CHANGE_REQUIRED`.

### 29.2 Exact coherent remediation

The first material candidate remains one atomic six-path commit against `0495e95`; no intermediate docs-only commit is allowed. While `SOL_DESIGN` is active, SOL may update only the existing four design/source-contract paths and must publish/lock their new r13 bytes in Issue #172. Under `SOL_REMEDIATION`, SOL may edit only the existing two harness paths. The total allowed paths remain:

1. `scripts/v100-phase-g-production-matrix.mjs`;
2. `tests/v100-phase-g-checkpoint.test.mjs`;
3. `tests/v100-design-lock.test.mjs`;
4. `docs/design/v1.0.0/DESIGN_LOCK.md`;
5. `docs/design/v1.0.0/LUNA_HANDOFF.md`;
6. `docs/PROJECT_STATE.md`.

Implement all of the following as one bounded evidence-lifecycle correction:

1. Extend both behaviorally identical copies of `mergeCombatActivityHistory`—the Node pure probe owner and the in-page production observer owner—with a bounded monotonic array named `targetOwnershipHistory`. Do not replace or clear it when a later snapshot is empty.
2. For each production snapshot, build one same-snapshot fighter map keyed by exact fighter ID. Derive observations from both: (a) a fighter's current `targetId`; and (b) each exact `attackIdentity` or `pendingWeaponHits` sourceId/targetId pair. Record an observation only when both source and target resolve in that same production snapshot. No later/current fighter may be used to backfill an older edge.
3. Each observation uses the exact field names `channel`, `battleTime`, `sourceId`, `sourceSide`, `sourceKind`, `targetId`, `targetSide`, `targetKind`, `targetHp`, and `targetAlive`. `channel` is `targetId`, `attackIdentity`, or `pendingWeaponHits`; `targetAlive` is true only when `targetHp` is finite and greater than zero. Deduplicate by channel plus exact source/target IDs/sides/kinds and living state. Preserve first-observed order. Once 96 unique observations exist, ignore later new unique observations; never evict, replace, clear, or reorder any accepted observation. This bound changes no production state or sampling interval.
4. Add a pure selector `proofActorHumanTargetFromHistory`. It scans accepted observations in first-observed order and may return the first positive only when source side is `zombie`, source kind exactly equals the requested proof actor, target side is `human`, and `targetAlive === true`. Source-target ID edges without same-frame identities, `fighterActors`, `attackingActors`, audio cues, damage/reaction, causal axes, current surviving-human count, or a non-human target never satisfy it.
5. `readProofActorContactState` keeps the current exact live-target check and also queries this monotonic selector. Live target evidence takes precedence; otherwise the exact historical observation may resolve `living-human-target-acquired-or-not-required`. The checkpoint details must state `evidence: live-target` or `evidence: monotonic-target-history`, plus observation channel, source/target IDs, target kind, and production time. It may not synthesize a target kind or mark the checkpoint merely because an attack occurred. Immediately after the existing final proof-actor attack predicate succeeds, call `readProofActorContactState` exactly once with no added wait, retry, deployment, or attack attempt so history already accepted by the observer is consumed before checkpoint completeness is evaluated.
6. Serialize `targetOwnershipHistory` in the existing report/failure runtime evidence and causal samples, but do not use it to weaken or bypass any of the four generic causal axes. Preserve the frozen failure cursor and structured primary/cleanup evidence from r12.
7. Extend `V100_PHASE_G_CAUSAL_HISTORY_PROBE` without adding a sixth source file. Inside the existing checkpoint contract test, prove: exact shield -> living human ownership survives a later empty frame; a non-human target does not satisfy the selector; an attack/audio/edge without same-frame source/target identities does not satisfy it; both merge copies and the reader carry the exact field/selector; the final proof predicate is followed by the one exact no-wait reader call; the first accepted observation is returned; and history stops at the first 96 without eviction. Keep the five-file focused total exactly 54/54; no test block is added or removed.
8. Preserve every r12 deployment pointer, mutex, receipt, acceptance, cancellation, cursor, timeout, checkpoint inventory, capture count, viewport, and retry rule byte-for-byte except for the smallest integration needed to serialize the new history. Do not alter the player-like medical/support placement, formation, deployment order, battle clock, boss acceleration, proof actor, proof target requirement, or product runtime.

Forbidden changes remain: `app/**`, `public/**`, workflow in the material candidate, package/lock, gameplay, AI, targeting, balance, damage, HP, hitbox, timing, content, assets, audio/VFX, save/PWA, product acceptance, causal acceptance, checkpoint removal/auto-resolution, timeout increase, additional attempt, blind rerun, and repository-wide formatting. A passing attack against a support object is not human-target proof.

### 29.3 Acceptance, execution order, and stop routing

Use the same isolated worktree, local dependencies, and local Playwright browsers; do not reinstall, reconstruct, stash, reset, or copy `node_modules`. Before remediation, publish the r13 four-path byte/hash/blob/patch ledger to Issue #172 and verify exact base HEAD/tree, exactly six current unstaged paths, staged/untracked zero, four published design bytes, two preserved r12 remediation drafts, and `git diff --check` green.

After the two-path r13 correction, run in this order:

1. five-file load-only and the same five-file focused command, exactly 54/54; checkpoint test remains exactly 12 tests and contains the new target-history behavior within an existing test;
2. lint, build, `git diff --check`, exact six-path allowlist, LF/BOM/byte audit, and forbidden/product/workflow/package diff zero;
3. three separate fresh Stage 25 WebKit 932x430 processes selected by `V100_PHASE_G_ONLY_VARIANT=stage25-president`, each with a unique sequence ID and fresh evidence directory. Require actual stage ID `stage-mugarian-executive-lab`, exact living-human ownership evidence for `red-panther-shield`, shield attack evidence, causal four-axis success, production screenshot, all checkpoints resolved, and fatal diagnostics zero;
4. only after Stage 25 3/3, run three separate fresh ordered Stage 6 -> Stage 24 -> Stage 25 WebKit processes with no variant filter and no in-sequence retry. Require all three ordered sequences green with exact variants/stage IDs/viewports, all trusted deployment receipts and production acceptances, all checkpoints resolved, and fatal diagnostics zero. Neither r12 ordered sequence counts for r13 acceptance;
5. create and normally push the one atomic six-path candidate, read back exact GitHub HEAD/tree, and require the automatic focused remote run completely green. `LOOP_ITERATION` remains 2 for this r13 remediation cycle/candidate;
6. continue Section 28.3 items 5-7 unchanged: workflow-only restoration if required, locally committed restored HEAD, unfiltered local Phase G 54/54 plus validator/full regressions, one promotion push, same-HEAD complete unfiltered remote green, exact-HEAD runtime/human audit, and frozen read-only final review.

No local failure authorizes a rerun or immediate edit. Persist the exact target history and return to `SOL_DESIGN`:

- a history-positive/checkpoint-unresolved mismatch is `QA_HARNESS_TARGET_HISTORY_CONSUMER_DIVERGENCE`;
- shield attack with only non-human ownership is `PROOF_ACTOR_HUMAN_TARGET_NOT_ESTABLISHED` and remains a real evidence/fixture stop, not permission to relax the checkpoint;
- no same-frame mapping despite attack evidence is `QA_HARNESS_TARGET_IDENTITY_OBSERVATION_GAP`;
- lifecycle, pointer, causal, source, or another gate uses its existing exact owner/status.

The r12 Stage 6 required failure did not repeat: Stage 6 passed three standalone processes and both ordered sequences reached/passed it. The current Stage 25 ordered-trio checkpoint is a different required gate and its `SAME_GATE_REPEAT_COUNT` is 1. A second r13 failure at that exact Stage 25 checkpoint sets the count to 2 and requires another subsystem-level audit before any edit.

### 29.4 Current cursor and audit result

- `LOOP_ITERATION`: `2` — the Stage 25 material finding begins the second coherent remediation cycle; the first r12 material candidate commit was never created. The r13 atomic candidate remains iteration 2. A later workflow-restoration promotion HEAD is iteration 3
- `SAME_GATE_REPEAT_COUNT`: `1` for the current Stage 25 ordered-trio target-ownership checkpoint; this is not a second Stage 6 failure
- `ROLE_LOCK`: `SOL_DESIGN` until the r13 four-path packet is published and locked; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `0495e95e3bc59fcf546ffa02ee83704a1f63e366`
- `LAST_AUDITED_TREE`: `30071d5a9f4fd92e93f54ddea2e9713382247f74`
- `FAILED_GATE`: local ordered sequence `r12-trio-fresh-2-d5986723-b`, ordered position 3, Stage 25 WebKit 932x430; `living-human-target-acquired-or-not-required` unresolved; sequence 3 not run
- `LAST_GREEN_GATE`: final r12 source 54/54, lint/build/diff/topology; Stage 6 standalone 3/3; ordered sequence `r12-trio-fresh-1-d5986723-a` 3/3; sequence 2 Stage 6 and Stage 24 passed before the Stage 25 stop. These are diagnosis/comparison evidence and do not count after r13 runner bytes change
- `REMEDIATION_CLASS`: `PHASE_G_PROOF_ACTOR_TARGET_OWNERSHIP / MONOTONIC_SAME_FRAME_SOURCE_TARGET_IDENTITY + NO_GENERIC_SUBSTITUTION / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `SOL_REMEDIATION` after the Issue-locked r13 publication
- `RESUME_FROM`: same exact six-path worktree -> publish/lock r13 four-path design bytes -> two-path target-history remediation -> focused 54/54/static/lint/build/diff/topology -> fresh Stage 25 3/3 -> fresh ordered trio 3/3 -> one atomic six-path candidate commit/push -> complete focused remote green -> unchanged Section 28 promotion/full/unfiltered/runtime/final-review/release route

SOL performed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits against both local ordered sequences, the frozen failure cursor, current runner/observer/checkpoint ownership, live PR/Issue refs, unchanged product tree, and the full release tail. The contract cannot turn generic attack evidence into human-target success, cannot mutate gameplay to manufacture a target, and has finite negative stop branches. Revision r13 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`.

## 30. Revision r14 — repeated Stage 6 scheduler-independent actionability closure

This section supersedes Sections 28-29 only for the repeated required Stage 6 failure, the deployment sampling/evidence lifecycle, the current cursor, and iteration numbering. Every r12 exact-card identity, centered rail, single-flight mutex, one real pointer, trusted receipt, production acceptance, cancellation, immutable failure cursor, and no-retry rule remains authoritative. Every r13 target-ownership/no-substitution rule remains authoritative. The SOL single-owner loop, one final Producer checkpoint, stacked integration, release, Pages, public-QA, recovery, and closure tail remain unchanged. `PRODUCT_DESIGN_CHANGE: 0`.

### 30.1 Live evidence and six-subsystem audit

SOL created and normally pushed the r13 atomic candidate `ab91621561926bbd4af90bb0d1ca8551699797d7`, tree `dc8dcc085bcc4e21429201d64e36e4290a14d027`, parent `0495e95e3bc59fcf546ffa02ee83704a1f63e366`. Its exact six-path patch is 216,822 bytes, SHA-256 `32059480e4ab172a4f86416c83f693ccc7edc4d77d7c19bf1f4946aca4eab074`. Local focused 54/54, checkpoint 12/12, lint/build/diff/byte/topology, Stage 25 fresh 3/3, and ordered Stage 6 -> Stage 24 -> Stage 25 fresh 3/3 were green. These local results are comparison evidence and do not override required remote red.

Automatic pull-request CI run `32656697160` attempt 1 used exact candidate HEAD `ab916215`. PR Verify job `97236416025`, all six WebKit enemy-runtime shards, WebKit Hosted Runner Evidence, and all three canonical Stage 3 audio-route jobs were green. Required Phase G job `97238965438` failed before input in sequence `remote-trio-1`, ordered position 1, variant `stage06-spitter-seal`, actual stage ID `stage-nishijin-station-tunnel-seal`, WebKit 667x375. Stage 24, Stage 25, and remote sequences 2/3 did not run. No manual rerun, job rerun, retry, timeout change, or correction followed.

Focused artifact `9497903328` uploaded successfully. Its workflow ZIP digest and independently downloaded ZIP SHA-256 are both `ac0f1e188d62ba8a6bdb63c14d50602105ef4024a8dbe37386561b8ae138e2c8`. The sole failure JSON is 24,580 bytes, SHA-256 `1df4ccde455829c59cb9a9ec0b09d36b552ba2a3abad7d391a79a3312f86d1bb`; the PNG is 441,529 bytes, SHA-256 `c477d2964df1aa5765c0bca8e548b9569f6b6cce2a603f34e637a11d27ffa0f9`. The frozen cursor correctly preserved `awaitingAtFailure: formation-deployment`, the last completed checkpoint, and all later unresolved checkpoints.

The exact immediate failure is `QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE`, `pointerCount: 0`, at phase `non-boss-primary`. The candidate identity had already resolved as exact node `deployment-card-2`, kind `ranger`, slot `1`; initial runtime eligibility and deterministic rail centering had therefore completed. The first requested frame sample then returned only a timeout record after 1,041 ms against `DEPLOYMENT_POINTER_FRAME_SAMPLE_TIMEOUT_MS = 1_000`. No DOM/actionability sample, pointer receipt, or production acceptance observation exists. The page remained on the correct battle route with wave 1, seven visible unit cards and energy 70; the PNG shows a complete production battle surface. Console/page/request/HTTP failures are all zero.

The required Section 28.3 subsystem audit is:

1. **QA harness:** `readBattleDeploymentDiagnostics` awaits `requestAnimationFrame` before collecting any DOM/runtime facts. `preflightStep` races that pending page evaluation against one host timer and treats missing rAF delivery as actionability divergence. The race does not cancel the pending evaluation. This couples DOM input proof to a compositor/rendering opportunity that the harness does not own.
2. **DOM actionability:** the path proves the initial exact candidate was runtime-eligible and the rail-centering evaluation completed. The artifact does not contain a post-center rect, hit owner, viewport/rail intersection, or stability sample because sampling stopped before the first DOM read. A DOM obstruction or product surface defect is therefore not established.
3. **Runtime:** route, stage, mount, observer, battle HUD, formation, resources, and page task execution were live before the rAF wait. Product time remained at the opening boundary and no fighter had deployed because pointer count was zero. No gameplay, balance, AI, or deployment-handler failure is established.
4. **Browser lifecycle:** page/context/browser closure, crash, navigation, and fatal browser channels are absent. The current artifact loses visibility/focus/ready-state and scheduler facts at the failed sample because those fields are collected only after rAF. The HTML rendering model permits user agents to select or skip rendering opportunities based on visibility, performance, hardware, and other reasons; rAF is not a universal page-task liveness guarantee. The governing reference is `https://html.spec.whatwg.org/multipage/webappapis.html#update-the-rendering`.
5. **Evidence pipeline:** the immutable checkpoint cursor worked, but the thrown preflight branch did not call `recordPointerResult`; `deploymentAttempts` is empty and the already-read initial diagnostics/centering result are overwritten by the timeout-only evidence. The artifact is truthful but insufficiently complete for low-level scheduler/DOM attribution.
6. **Acceptance:** no pointer was dispatched, so neither an exact trusted receipt nor production state transition was tested. Existing receipt and production-acceptance rules remain necessary and unchanged; remote red cannot be reclassified as product acceptance failure or ignored from local success.

This is the second failure of the same required Stage 6 gate, even though the immediate r12 symptom was opaque locator stability and the r13 symptom is rAF-only sampling. `SAME_GATE_REPEAT_COUNT` is 2. Continuing the same render-opportunity-dependent strategy is forbidden.

Classification is `QA_HARNESS_RENDER_OPPORTUNITY_COUPLING / RAF_ONLY_PRE-DOM_SAMPLE_TIMEOUT + UNCANCELLED_EVALUATE + PREFLIGHT_EVIDENCE_LOSS / DESIGN_CHANGE_REQUIRED`.

Remediation class is `PHASE_G_SCHEDULER_INDEPENDENT_ACTIONABILITY / HOST_TURN_SEPARATED_SYNC_SNAPSHOTS + NONBLOCKING_RAF_TELEMETRY + PREINPUT_CANCELLATION_AND_EVIDENCE / DESIGN_CHANGE_REQUIRED`.

### 30.2 Exact coherent remediation

The r14 design publication and material candidate use the same six-path atomic topology, now relative to exact clean base `ab91621561926bbd4af90bb0d1ca8551699797d7` / tree `dc8dcc085bcc4e21429201d64e36e4290a14d027`. Under `SOL_DESIGN`, modify only paths 3-6 and publish their raw SHA-256, Git blob IDs, combined binary-patch hash, status, EOL/BOM, and focused design/source proof to Issue #172 without an intermediate commit. Only after that byte lock may `SOL_REMEDIATION` modify paths 1-2. The next material commit contains all six paths atomically:

1. `scripts/v100-phase-g-production-matrix.mjs`;
2. `tests/v100-phase-g-checkpoint.test.mjs`;
3. `tests/v100-design-lock.test.mjs`;
4. `docs/design/v1.0.0/DESIGN_LOCK.md`;
5. `docs/design/v1.0.0/LUNA_HANDOFF.md`;
6. `docs/PROJECT_STATE.md`.

Implement all requirements below as one correction:

1. Keep `DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS = 5_000`, `DEPLOYMENT_POINTER_MAX_SAMPLES = 12`, `DEPLOYMENT_POINTER_DISPATCH_DEADLINE_MS = 2_000`, the 0.75 CSS-pixel stability tolerance, minimum 28x24 hit surface, and every identity/hit/eligibility rule. Replace only the misleading frame-read name with `DEPLOYMENT_POINTER_DIAGNOSTIC_READ_TIMEOUT_MS = 1_000` and add `DEPLOYMENT_POINTER_SAMPLE_SEPARATION_MS = 40`. This is not a one-line timeout increase: no existing deadline increases.
2. `readBattleDeploymentDiagnostics` becomes a synchronous page evaluation. Remove its `awaitAnimationFrame` parameter and forbid `await new Promise((resolve) => requestAnimationFrame(resolve))` in the deployment preflight path. It must collect DOM card/rail rects, exact identity, runtime eligibility, center owner, viewport, `sampleOrdinal`, wall clock, `performance.now`, `document.visibilityState`, `document.hidden`, `document.readyState`, `document.hasFocus()`, and the current scheduler-probe state before returning.
3. Add one preflight-scoped, QA-only rAF telemetry probe. Install it with a synchronous page evaluation, store request time/handle and observed callback time in a page registry, and never await it. Every snapshot serializes whether the probe is `pending` or `observed`. Pending rAF alone never authorizes or rejects a pointer. Cleanup cancels a still-pending handle and removes the registry entry; page disposal is accepted cleanup. No probe may mutate product time, state, DOM, CSS, resource, or input.
4. For each stability sample, wait exactly one host-owned 40 ms sampling turn outside the page, then perform one bounded synchronous diagnostic read. Serialize host turn start/end/elapsed plus page wall/performance clocks. The precondition requires two consecutive samples with strictly increasing ordinal, at least 40 ms host separation minus a 1 ms scheduling tolerance, at least 16 ms positive page wall-clock and performance-clock advance, the same exact node/kind/slot, production eligibility, actionable/hit-owner facts, stable card rect, and stable rail scroll. A repeated ordinal, non-advancing clock, or missing task-turn evidence is `QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE` with pointer zero. rAF may be pending in a valid pair.
5. The immediate terminal recheck remains required after receipt installation and before dispatch. It is synchronous, must match the accepted sample identity/eligibility/coordinate/owner within the same 0.75 CSS-pixel tolerance, and does not require another 40 ms turn. The one `page.mouse.click` and exact receipt/acceptance conjunction remain unchanged.
6. Refactor the bounded pre-input operation owner so a diagnostic/centering/receipt-install evaluation that exceeds its existing per-read or remaining overall deadline does not remain orphaned. Close and await disposal of the current capture context/page, observe the pending operation settlement, persist lifecycle/cancellation evidence, and return one terminal pointer-zero failure. Do not close or reuse another capture's context; do not convert timeout into a retry.
7. Create one preflight evidence object before the first requery and retain: requested phase/kind/slot, initial diagnostics, centered result, scheduler-probe installation/readback/cleanup, every host turn, every synchronous sample, terminal recheck, timeout cancellation, and primary/cleanup errors. On every thrown pre-input branch, record exactly one deployment attempt before rethrowing the original classified error. The recorder must not overwrite an earlier primary failure with cleanup failure.
8. Update `deploymentPointerPreconditionDecision` and the existing `V100_PHASE_G_DEPLOYMENT_POINTER_PROBE` only for the new task-turn/clock evidence. Inside the existing five pointer behavioral test blocks, prove: rAF pending plus two valid task-turn samples is positive; rAF observed plus the same facts is positive; same-turn/repeated-ordinal/non-advancing clocks remain pointer-zero divergence; identity, eligibility, obstruction, off-viewport, lifecycle, receipt, and production-acceptance negatives remain unchanged. Add no test block: the checkpoint file remains exactly 12 tests and the five-file focused suite remains exactly 54/54.
9. Preserve r13 `targetOwnershipHistory`, `proofActorHumanTargetFromHistory`, no-substitution rules, causal four axes, and the one no-wait final contact read. Preserve Phase G total/viewports/mapping, deployment candidate/attempt limits, formation, proof actors, product timing, and every accepted screenshot/error channel.

Forbidden changes are: any `.github/**` in the r14 material commit; `app/**`, `public/**`, package/lock, product DOM/CSS/runtime; gameplay, balance, AI, targeting, damage, HP, hitbox, battle clock, story/content, asset/audio/VFX, save/PWA; force click, locator click, DOM click, event dispatch, QA-bridge deployment, product state mutation; timeout increase; retry/additional pointer/additional canonical attempt; checkpoint/causal/receipt/acceptance weakening; or repository-wide normalization. The later workflow-only restoration remains the sole workflow exception.

### 30.3 Acceptance, execution order, and stop routing

Use the existing clean isolated worktree, its worktree-local dependencies and browsers, and `PLAYWRIGHT_BROWSERS_PATH=0`. Do not reinstall, share `node_modules`, reconstruct, stash, reset, or amend. Before the first harness edit, require exact HEAD/tree `ab916215`/`dc8dcc0`; exactly the four Issue-locked design paths unstaged; staged/untracked zero; four raw/file/blob/patch hashes exact; `git diff --check` green; and the r14 design/source contract green. Any mismatch returns to `SOL_DESIGN` without reconstruction.

After the two-path remediation, require in this exact order:

1. five-file load-only 5/5 and the same five-file focused suite exactly 54/54; checkpoint test exactly 12/12; static/source assertions for every item in Section 30.2;
2. `npm.cmd run lint`, `npm.cmd run build`, working-tree `git diff --check`, exact six-path allowlist, EOL/BOM/byte audit, and forbidden-tree diff zero;
3. three separate fresh Stage 6 WebKit 667x375 processes with exact variant and actual stage ID, unique sequence/evidence IDs, trusted pointer receipts, production acceptance, all checkpoints resolved, fatal diagnostics zero, and scheduler evidence serialized. No r13 process counts;
4. three separate fresh ordered Stage 6 -> Stage 24 -> Stage 25 WebKit processes, no variant filter and no in-sequence retry. Require exact order/mapping/viewports, every deployment receipt/acceptance, r13 Stage 25 living-human ownership, causal 4/4, screenshots, unresolved zero, fatal zero, and three distinct report/nine distinct screenshot hashes;
5. create and normally push one atomic six-path r14 candidate, set `LOOP_ITERATION: 3`, read back exact GitHub HEAD/tree, and require its automatic focused run attempt 1 completely green: PR Verify, ordered trio 3/3, artifact/digest, every required job, and whole-run conclusion;
6. only after focused complete green, reset `SAME_GATE_REPEAT_COUNT` to 0. Because the live workflow remains focused, create locally one workflow-only restoration commit as iteration 4, restoring the exact original unfiltered Phase G job from Section 28.3. Do not push it until same-HEAD local unfiltered Phase G 54/54, validator, and every full regression are green; then push once and require same-HEAD unfiltered remote complete green and artifacts;
7. continue the unchanged exact-HEAD runtime, SOL human-player, twelve-screen, source/diff/integration/release/rollback audit, clean fixed-HEAD `SOL_FINAL_REVIEW`, one `FINAL PRODUCER RELEASE-CANDIDATE CHECKPOINT`, explicit-approval stacked integration, annotated tag, GitHub Release, official Pages, published-SHA QA/recovery, Project State, and Issue closure route.

No local or remote failure authorizes retry, rerun, timeout tuning, or immediate edit. Persist raw evidence and return to `SOL_DESIGN`. A repeat at Stage 6 increments `SAME_GATE_REPEAT_COUNT` to 3 and requires a new subsystem audit before any strategy change. A synchronous diagnostic-read timeout is not rAF absence; classify it from its cancellation/lifecycle evidence. rAF pending with valid task-turn samples must continue to exact pointer/receipt/acceptance, while invalid DOM/hit/runtime facts retain their existing product-versus-harness owners. Any Stage 24, Stage 25, source, causal, lifecycle, artifact, full-gate, runtime, or human-quality failure uses its exact evidence owner and the same SOL loop.

### 30.4 Current cursor and audit result

- `LOOP_ITERATION`: `2` at failed r13 candidate `ab916215`; the next atomic r14 material candidate is iteration 3; the later workflow-restoration release-validation HEAD is iteration 4
- `SAME_GATE_REPEAT_COUNT`: `2` for the required Stage 6 gate; reset only after the r14 focused required gate is completely green
- `ROLE_LOCK`: `SOL_DESIGN` until the r14 four-path packet is published and byte-locked; then `SOL_REMEDIATION`
- `LAST_AUDITED_HEAD`: `ab91621561926bbd4af90bb0d1ca8551699797d7`
- `LAST_AUDITED_TREE`: `dc8dcc085bcc4e21429201d64e36e4290a14d027`
- `FAILED_GATE`: run `32656697160`, job `97238965438`, artifact `9497903328`, `remote-trio-1` ordered position 1, Stage 6 WebKit 667x375, first rAF-only sample timeout before DOM sample and before pointer; Stage 24/25 and sequences 2/3 not run
- `LAST_GREEN_GATE`: PR Verify `97236416025`, all six enemy-runtime shards, Hosted Runner Evidence, three canonical Stage 3 routes, and exact r13 local source/static/Stage25/ordered-trio comparison evidence; none substitutes for required Phase G red
- `CLASSIFICATION`: `QA_HARNESS_RENDER_OPPORTUNITY_COUPLING / RAF_ONLY_PRE-DOM_SAMPLE_TIMEOUT + UNCANCELLED_EVALUATE + PREFLIGHT_EVIDENCE_LOSS / DESIGN_CHANGE_REQUIRED`
- `REMEDIATION_CLASS`: `PHASE_G_SCHEDULER_INDEPENDENT_ACTIONABILITY / HOST_TURN_SEPARATED_SYNC_SNAPSHOTS + NONBLOCKING_RAF_TELEMETRY + PREINPUT_CANCELLATION_AND_EVIDENCE / DESIGN_CHANGE_REQUIRED`
- `NEXT_OWNER`: `SOL_REMEDIATION` only after the Issue-locked r14 publication and green design/source proof
- `RESUME_FROM`: exact clean `ab916215` worktree -> publish/lock r14 four-path bytes -> edit only two harness paths -> focused 54/54/checkpoint 12/12/static/lint/build/diff/byte -> fresh Stage 6 3/3 -> fresh ordered trio 3/3 -> one atomic iteration-3 candidate push -> complete focused remote green -> workflow-only iteration-4 restoration -> same-HEAD full local/unfiltered remote/runtime/human/final-review/release route

SOL completed SOURCE, DESIGN, ADVERSARIAL, EXECUTION, LOOP, and RELEASE audits using the raw log, downloaded artifact/PNG, exact source, local positive scheduler timing, current live PR/Issue/run/job/artifact state, the HTML rendering-opportunity model, and every downstream release transition. The contract cannot treat rAF absence as product failure or success; cannot dispatch without two exact actionable snapshots; cannot weaken trusted receipt/production acceptance; cannot leave a timed-out pre-input operation live; and cannot reuse local green against remote red. Revision r14 is locked with `High ambiguity: 0` and `Medium ambiguity: 0`.
