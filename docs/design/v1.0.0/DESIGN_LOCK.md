# Version 1.0.0 Design Lock

- Design ID: `V100-SOL-DL-001`
- Revision: `r5`
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
- Revision r3 inherits every r2 product, story, identity, asset, gameplay, save, audio, PWA, and presentation decision unchanged. It adds only the deterministic diagnosis and execution contract for the remote Phase G WebKit 667x375 failure. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r4 incorporates the subsequent remote Stage 24 failure and replaces the Stage 6-only diagnostic boundary with one finite WebKit battle-extra harness contract covering Stages 6, 24, and 25. It changes no product, story, identity, asset, gameplay, balance, AI, evidence, Producer checkpoint, save, audio, PWA, or release decision. `PRODUCT_DESIGN_CHANGE: 0`.
- Revision r5 keeps the complete r4 Phase G contract unchanged and makes the full Version 1.0.0 execution, return, visual-approval freeze, stacked-integration, release, post-release, rollback, and closure loop authoritative in Section 19. It adds no product behavior or acceptance weakening. `PRODUCT_DESIGN_CHANGE: 0`.

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
2. PR Verify on the new remote candidate;
3. the existing automated remote ordered WebKit trio, three complete sequences of Stage 6 -> Stage 24 -> Stage 25;
4. local unfiltered Phase G 54/54 plus validator and every Section 18.5 full regression;
5. restore the unfiltered Phase G workflow binding and prove its focused-only binding is absent;
6. one new unfiltered remote required-CI run, including Phase G 54/54, validator, all required jobs, and required artifacts;
7. wait until that entire required run is terminal; only complete green may enter the Producer Visual Checkpoint.

The already-complete isolated diagnostics and local ordered trio 3/3 are not repeated for the LF-only change, and they are not final evidence. A prior, local, partial, skipped, cancelled, neutral, or stale run cannot substitute for an attempt-specific required remote result. After the LF push, any required job failure or unexpected skip in the candidate's required run returns immediately to Sol after the run is terminal. Luna has no authority to decide that a failure is unrelated, flaky, retryable, or ignorable.

### 19.5 Current execution cursor and LF-only remediation

- `DESIGN_AUDITED_HEAD`: `c57bd2690ef1f50e92e99736d59dab86c4af71f9`
- `DESIGN_AUDITED_TREE`: `65bb817fc3b73526619e51ac4712094f7a1834e6`
- `LF_SEMANTIC_BASE`: `f7149732fadec5142d0e475f201984dd5a48e217`
- `FAILED_GATE`: runs `32475729057` and `32478283607`; PR Verify jobs `96751598547` and `96759071225`; `Check patch whitespace`; dependent Phase G skipped
- `LAST_GREEN_GATE`: isolated Stage 6/24/25 diagnostics complete and local ordered trio 3/3, local-only and not reusable for final freeze
- `REMEDIATION_CLASS`: `REPO_HYGIENE / REMEDIATION_LOCAL`
- `NEXT_OWNER`: `LUNA_IMPLEMENTATION`
- `RESUME_FROM`: exact-file LF remediation with semantic diff 0 -> PR Verify -> automated remote ordered trio 3/3

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
