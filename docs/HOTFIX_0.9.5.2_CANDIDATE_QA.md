# Version 0.9.5.2 P0 Hotfix candidate QA

This file is implementation and QA evidence only. Issue #113 and its latest Producer physical-device comment remain the sole execution authority.

## Candidate boundary

- Branch: `codex/0.9.5.2-hotfix`
- Base: Version 0.9.5.1 release SHA `4a21e551d4a5e9641b2374a3ba1da6f37e28e4c8`
- Candidate identity: Version 0.9.5.2
- Formal publication: not performed
- Physical smartphone acceptance: pending Producer confirmation
- `.github/pages-release-request.json`: unchanged
- PWA, Service Worker, offline/install work: not included

## Root causes and corrections

### Asset loading

The player-facing retry button called `window.location.reload()`. A failed loadout therefore returned to title, recreated the same failing load session, and could loop indefinitely.

The candidate replaces that path with a generation-owned session:

- 12-second outer deadline for critical work and six-second deadline for optional work
- two-request mobile concurrency cap and path deduplication
- minimal critical set: battlefield, CRAWLER enemy base, selected formation, and first-wave enemies
- optional/background set: later-wave atlases, support objects, and stage objects
- stale generation abort protection
- same-loadout retry of failed/pending critical paths only
- terminal `ready`, `degraded-ready`, or `error`; no unbounded `loading`
- exact QA diagnostics for generation, reason, pending paths, failed paths, restart count, category, and failure reason
- player-facing `n / total`, category/reason, separate retry control, and optional-degradation notice

### Audio

Audio asset failure was previously folded into one global failed state, and fetch, `arrayBuffer`, and `decodeAudioData` could remain pending.

The candidate adds:

- eight-second bounded source load/`arrayBuffer` and three-second decode deadline
- separate AudioContext, confirmation tone, BGM, SFX, voice, and optional status
- category plus optional diagnostics for every failed asset
- failed-cache-only retry without creating another AudioContext
- working SFX/voice playback when BGM fails
- duplicate-loop and context-create diagnostics
- visible unavailable-category summary on smartphone layouts

## Automated QA

| Gate | Result |
|---|---:|
| Focused asset/image/audio tests | pass |
| Full tests | 773 / 773 pass |
| Production build | pass |
| ESLint | pass, 0 warnings |
| Content validator | pass, 0 errors/warnings |
| `git diff --check` | pass |
| Chromium/WebKit hotfix browser matrix | 16 / 16 pass |

The browser matrix covers 1280×720, 844×390, and 844×340; touch and DPR 3; Stage 1, 6, and 13; HTTP failure; critical request hang; image decode hang; optional request hang; same-screen retry; BGM-only failure with working SFX/voice; optional audio failure; AudioContext suspend/recovery; and title-to-battle flow. Intentional injected 503 responses are recorded as expected evidence. All ordinary scenarios have zero console error, page error, request failure, and HTTP error.

## Production-build comparison

Chromium 844×390, touch, DPR 3, identical schema-v14 save, production builds. Cold and warm passes run in the same isolated browser context. Candidate optional loading is allowed to settle before the warm pass.

| Metric | 0.9.5 | 0.9.5.1 | 0.9.5.2 candidate |
|---|---:|---:|---:|
| Cold HTML response end | 20 ms | 15 ms | 15 ms |
| Cold title ready | 255 ms | 293 ms | 260 ms |
| Cold map ready | 141 ms | 89 ms | 82 ms |
| Cold loadout terminal | >15,000 ms timeout | 86 ms | 71 ms |
| Cold total requests | 70 | 48 | 35 |
| Cold transfer | 23.23 MB | 23.11 MB | 17.56 MB |
| Cold JavaScript transfer | 1.35 MB | 1.35 MB | 1.36 MB |
| Cold image requests | 34 | 34 | 21 |
| Cold image transfer | 19.31 MB | 19.31 MB | 13.75 MB |
| Cold audio preload requests | 24 | 2 | 2 |
| Candidate critical asset count | n/a | n/a | 9 |
| Warm HTML response end | 20 ms | 20 ms | 19 ms |
| Warm loadout terminal | >15,000 ms timeout | 52 ms | 63 ms |
| Warm transfer | 3.88 KB | 3.89 KB | 4.02 KB |
| Retained JS heap proxy | 14.3 MB | 12.7 MB | 12.7 MB |

The candidate removes the 0.9.5 terminal failure, preserves the 0.9.5.1 heap proxy, and reduces cold image requests by 38% and cold image transfer by 29% versus 0.9.5.1. The 11 ms warm loadout difference versus 0.9.5.1 is within this single-run browser measurement and is not claimed as an improvement.

Raw local evidence is generated under `outputs/v0952-hotfix/` by:

- `npm run qa:v0952-hotfix`
- `node scripts/v0952-performance-comparison.mjs`

## Physical smartphone gate

Formal merge, tag, Release, Pages deployment, Public QA, and Issue #113 close remain blocked until Producer acceptance on the same physical smartphone:

1. fresh save and existing save
2. at least two stages
3. intentional critical failure followed by the same-screen retry
4. no return to title and no reload loop
5. ordinary reload does not recreate a loop
6. confirmation tone, BGM, SFX, and voice from the physical speaker
7. acceptable temperature, responsiveness, and memory behavior

After that gate, Issue #113 controls formal publication. Issue #114 does not begin until Version 0.9.5.2 is physically accepted and formally published.
