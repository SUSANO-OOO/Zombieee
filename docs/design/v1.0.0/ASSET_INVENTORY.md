# Version 1.0.0 Finite Asset Inventory

- Design ID: `V100-SOL-DL-001`
- Revision: `r2`
- Status: `LOCKED_FINITE_INVENTORY`
- Runtime integration: not performed in the Design PR

This inventory separates selected nonruntime authoring masters, existing production assets, required derivatives, and rejected candidates. Only rows marked `SELECTED` are staged as new identity masters.

## 1. Selected project-original authoring masters

| Status | Identity / use | Repository path | Dimensions | Bytes | SHA-256 | Locked visual contract |
|---|---|---|---:|---:|---|---|
| SELECTED | Segawa | `assets/source/v100/characters/segawa-identity-master-r2.png` | 934x1684 | 1,639,340 | `0bb98569efa36dbc7df6fbd7fb7ec2cce11671ddbe58f4ce84d9ce26fb187c1d` | Producer-reference face translated into the game's illustrated style; ivory/white scientist coat; no photorealistic cutout |
| SELECTED | Mugarian president, human | `assets/source/v100/characters/mugarian-president-identity-master-r2.png` | 1024x1536 | 1,477,448 | `c5c6a40e161197a15855ca7733dc3c4af7f32138516eb885130244a2c3b22ab6` | Middle-Eastern face; mature executive; ornate emerald jacquard suit and burgundy/gold accents |
| SELECTED | Mugarian president, mutated | `assets/source/v100/enemies/mugarian-president-mutated-identity-master-r4.png` | 1024x1536 | 2,315,854 | `be58f640e7b918e0a37a04d6e128b448c71926483a95f9a5a161cd83dfae0d72` | Same face/suit identity; exactly four rooted arms/four hands; staff plus three independent monster limbs; stitched grotesque form |
| SELECTED | TAKUYA-Ω | `assets/source/v100/enemies/takuya-omega-identity-master-r2.png` | 1024x1536 | 2,493,116 | `d46f6a96f693dbf0aa9b81b9ef2b1f5797f461c87505c7390c80464e3a0249af` | TAKUYA continuity; no orange garment; scarred stitched abomination; giant sword/maul; exactly two arms |
| SELECTED | RED PANTHER knife | `assets/source/v100/enemies/red-panther-knife-identity-master-r1.png` | 1024x1536 | 1,981,837 | `8875b636ed887caa34aa1a704c31291aa1a774c4429891d2c66e7356fc8082a2` | agile red-lens knife silhouette |
| SELECTED | RED PANTHER shield | `assets/source/v100/enemies/red-panther-shield-identity-master-r1.png` | 1024x1536 | 2,294,395 | `584e03350283e6e7a92709c98d14ca63a9574e53f46961a39b466a3760d5ea2f` | armored shield silhouette |
| SELECTED | RED PANTHER SMG | `assets/source/v100/enemies/red-panther-smg-identity-master-r1.png` | 1024x1536 | 1,876,195 | `3f03c2e8e6eae37173e637ea801944b1016858222437b4e0c4d3d320b2f52fd8` | ranged SMG silhouette |
| SELECTED | RED PANTHER commander | `assets/source/v100/enemies/red-panther-commander-identity-master-r1.png` | 1024x1536 | 1,841,071 | `dab75e9ec7e6e1075f969d021d8089477ca2e2cb40e3a1e416e5e029bade6dba` | command-grade red-lens silhouette |
| SELECTED | shared minor human event silhouette | `assets/source/v100/portraits/minor-human-shared-event-silhouette-r2.png` | 1024x1536 | 1,227,179 | `a5e58d69828d5dacf99ceae1ce427f88fe751fbf3b491eedd50e5992b8c0eeb7` | simple featureless gender-neutral and age-neutral silhouette; no face, hair, costume, occupation, accessory, weapon, or identity cues; minor speakers with no identity master only |

All selected files are PNG with an alpha channel. Transparent-background acceptance is alpha 0 outside the silhouette and alpha 254 or 255 in opaque core regions; a rendered checkerboard or solid matte is a failure.

## 2. Explicitly rejected or superseded candidates

These files may remain locally for audit history but must not be staged, referenced by runtime, or listed in the release manifest:

- `assets/source/v100/characters/segawa-identity-master-r1.png` — rejected as too photorealistic / insufficiently world-matched.
- `assets/source/v100/characters/mugarian-president-identity-master-r1.png` — superseded identity/costume direction.
- `assets/source/v100/enemies/mugarian-president-mutated-identity-master-r1.png` — superseded creature direction.
- `assets/source/v100/enemies/mugarian-president-mutated-identity-master-r3.png` — coherent two-arm form but superseded by Producer-approved four-arm r4.
- `assets/source/v100/enemies/takuya-omega-identity-master-r1.png` — rejected orange garment and insufficient horror/weapon direction.
- `assets/source/v100/portraits/minor-human-shared-event-portrait-r1.png` — rejected as an identifiable gendered person instead of the required neutral silhouette.

## 3. Existing production assets: reuse and derivative sources

`REUSE` means no identity redesign. `DERIVE` requires a new project-original runtime derivative with a distinct landmark/object/depth composition. `REFERENCE_ONLY` cannot ship unchanged.

| Stage/use | Classification | Existing source(s) | Required action |
|---|---|---|---|
| Stage 1 | REUSE | `/art/v060/battle-nishijin-shopping-street-v1.webp` | preserve |
| Stage 2 | REUSE | `/art/v060/battle-sawara-ward-office-v1.webp` | preserve |
| Stage 3 / 30 location | REUSE + DERIVE overlay | `/art/v060/battle-nishijin-defense-line-v1.webp` | Stage 30 uses exact location plus authored damage/dawn overlay |
| Stage 4-6 station | REUSE | `/art/v070/stages/station-*-background-v1.webp`, station object sheets | preserve and use authored mission objects |
| Stage 7-16 | REUSE | `/art/v080/stages/*background-v1.webp` | preserve; add missing authored state derivatives where required |
| Stage 17-20 | REUSE | `/art/v090/stages/{bay-tower-service,civic-archive-route,coastal-link-bridge,estuary-floodgate}-background-v1.webp` | preserve landmark identities |
| Stage 21 | DERIVE | logistics/freight sources | corporate HQ gate landmark and Mugarian branding |
| Stage 22 | DERIVE | hospital/research sources | clinical-trial wing and wife-reunion composition |
| Stage 23 | DERIVE | industrial/research sources | red-lens armory, lockers, special-operations landmark |
| Stage 24 | DERIVE | bay-tower source | vertical tech tower and twin-reactor landmark |
| Stage 25 | DERIVE | research lab sources | executive-lab hybrid, president arena |
| Stage 26 | REUSE + new states | evacuation freight yard | new escort/object states; no background recolor-only change |
| Stage 27 | DERIVE | research lab sources | Segawa private lab and RED PANTHER facility landmark |
| Stage 28 | DERIVE | `/art/v090/stages/coastal-power-rig-v1.png` | national dispersal network; four authored power nodes |
| Stage 29 | DERIVE | research core sources | high-security research core and elite-wave landmarks |
| Stage 30 | REUSE + DERIVE overlay | Stage 3 source | aftermath/dawn overlay and Ω entrance/defeat states |
| maintenance cart | REUSE | `/art/v095/mission-objects/maintenance-cart-v1.png` | visible escort object; no placeholder |
| Kurome prototype | REFERENCE_ONLY | `/art/v090-prototypes/bosses/` | create approved production derivative; prototype cannot ship as final |
| boss BGM | REUSE | current `music-v099-boss` production asset | preserve scene/asset ownership |
| armored vehicle | REUSE | current internal vehicle assets | player label remains `装甲車両`; stable internal IDs preserved |

## 4. Runtime derivative inventory Luna must produce

For each new named identity, Luna must generate only the finite derivatives used by registered routes:

| Identity | Required runtime derivatives |
|---|---|
| Segawa | event portrait, dialogue profile, any story cut required by the implementation map |
| Mugarian president | event portrait, dialogue profile, Stage 21-25 story cut(s) |
| mutated president | boss event portrait, entrance/idle/attack/hit/phase/death sprite states, defeat cut |
| TAKUYA-Ω | boss event portrait, entrance/idle/attack/hit/phase/death sprite states, ending defeat cut |
| each RED PANTHER type | idle/move/attack/hit/death states with semantic facing and weapon silhouette |
| shared minor human | featureless event silhouette only; no unit card, battle sprite, or boss derivative |

Runtime sprite packing may be a sheet or discrete frames, but every registered semantic state must have a structural pixel difference after runtime scaling. Translation-only or 1-pixel noise does not count.

## 5. Existing named portrait boundary

Reuse existing approved production portraits for the base cast and v0.9.9.5 identities, including Zakimiya, TKY, MrsChiha, Miyamoto, and Mayo-chan. Do not regenerate them merely for style uniformity. Crop/anchor/scale/container changes are allowed only when needed to satisfy the locked dialogue geometry without identity change.

## 6. Acceptance and negative tests

- Verify exact SHA-256, dimensions, alpha channel, and selected path for every new master.
- Verify rejected paths are absent from Git index and runtime references.
- Verify private Producer photos are absent from Git index, build output, artifact, and manifest.
- Verify four-arm president has exactly four rooted arms and four hands in the selected master and runtime silhouette.
- Verify TAKUYA-Ω has exactly two arms, no orange clothing, a giant sword/maul, and no matte/checkerboard residue.
- Verify RED PANTHER variants remain distinguishable at runtime display size.
- Verify the generic silhouette has no face, hair, costume, occupation, accessory, weapon, gender, age, ethnicity, or named-person identity cues and is limited to minor human speaker IDs enumerated in story content.
- Verify every required runtime asset decodes before the playable route mounts; failure/corruption blocks play and same-screen retry fetches only failed assets.

Any hash, identity, limb count, alpha, license, or speaker-boundary mismatch is a stop condition, not an invitation for Luna to select a substitute.
