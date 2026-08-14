# Version 1.0.0 Design Lock

- Design ID: `V100-SOL-DL-001`
- Revision: `r2`
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
- The approved shared minor-human event image is a simple, featureless, gender-neutral and age-neutral human silhouette. It may be reused only for minor human speakers with no identity master, including generic researchers and Zakimiya's wife. It carries no face, hair, costume, occupation, ethnicity, accessory, weapon, or named-person identity cues, and it may not replace a named major character, playable unit, boss, or a person for whom a master exists.
- Revision r2 freezes the exact currently selected hashes in `ASSET_INVENTORY.md` and `PROVENANCE.md`. This limited contract correction has no character-art scope: the latest shared minor-human silhouette, Segawa, normal and mutated Mugarian president, TAKUYA-Ω, all four RED PANTHER roles, and every existing character remain unchanged. No older candidate/master may replace them and no new image candidate may be generated under this revision.

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

Hachi remains a skirmisher, Paisen frontline, Kumaverson heavy, Babayaga marksman, Nao support, Mizuchi suppression, and Monkey engineer. Existing roles for other units remain unchanged.

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

Implementation is ready for independent Sol review only when the fixed implementation HEAD/tree matches live GitHub, High 0 and Medium 0 remain, all locked identities/hashes are traceable, the required runtime/browser/save/PWA evidence is reviewer-accessible, and no release action has occurred.
